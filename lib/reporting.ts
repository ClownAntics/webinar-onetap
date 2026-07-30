import { salesSupabase, appSupabase } from "./supabase";
import type { AttendanceRow, SalesOrder, WebinarMetrics } from "./types";

/**
 * Revenue attribution — faithful port of the "Generate Webinar Summary" Apps
 * Script (README-build-v3.md §4a). Figures MUST reconcile with the old sheet,
 * so do not "improve" these rules without agreement.
 */
export const ATTRIBUTION_DAYS = 7;
export const REACTIVATION_THRESHOLD_DAYS = 180;

const DAY_MS = 1000 * 60 * 60 * 24;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Floor a date to its UTC calendar day (epoch ms). Attribution is day-level —
 * the original sheet compared date-only cells, so a same-day purchase counts
 * regardless of the webinar's clock time. Comparing on days keeps backfilled
 * and live webinars consistent.
 */
const toUTCDayMs = (iso: string): number => {
  const d = new Date(iso);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

export interface WebinarInput {
  webinarId: string;
  topic: string;
  date: string; // webinar date (ISO)
  registrants: AttendanceRow[]; // all rows for this webinar (attended + no-show)
}

/**
 * Load every td_order row for the given emails from the sales mirror.
 * Columns are TeamDesk-mirrored and must be double-quoted — the JS client
 * handles quoting when we select by exact name.
 */
export async function loadSalesForEmails(
  emails: string[]
): Promise<Map<string, SalesOrder[]>> {
  const byEmail = new Map<string, SalesOrder[]>();
  if (emails.length === 0) return byEmail;

  const unique = Array.from(new Set(emails.map((e) => e.toLowerCase().trim())));
  const sb = salesSupabase();

  // Chunk to keep the IN() list reasonable.
  const CHUNK = 500;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from("td_order")
      .select('"Email","Date","OrderNumber","TotalCostCalced"')
      .in("Email", slice);
    if (error) throw new Error(`td_order query failed: ${error.message}`);
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const email = String(row["Email"] ?? "").toLowerCase().trim();
      if (!email || !row["Date"]) continue;
      const order: SalesOrder = {
        email,
        date: String(row["Date"]),
        orderNumber: String(row["OrderNumber"] ?? ""),
        amount: Number(row["TotalCostCalced"] ?? 0),
      };
      const list = byEmail.get(email) ?? [];
      list.push(order);
      byEmail.set(email, list);
    }
  }
  return byEmail;
}

/**
 * Compute per-webinar metrics. `lifetimeAttendance` maps email -> total webinars
 * attended across ALL history (drives New/Returning/VIP tiers).
 */
export function computeWebinarMetrics(
  webinar: WebinarInput,
  lifetimeAttendance: Map<string, number>,
  salesByEmail: Map<string, SalesOrder[]>
): WebinarMetrics {
  const attendees = new Set<string>();
  const noShows = new Set<string>();
  const registrants = new Set<string>();

  for (const r of webinar.registrants) {
    const email = r.email.toLowerCase().trim();
    if (!email) continue;
    registrants.add(email);
    if (r.attended) attendees.add(email);
    else noShows.add(email);
  }

  const webinarDayMs = toUTCDayMs(webinar.date);
  const windowEndMs = webinarDayMs + ATTRIBUTION_DAYS * DAY_MS;
  const reactivationCutoffMs = webinarDayMs - REACTIVATION_THRESHOLD_DAYS * DAY_MS;

  let newAttendees = 0;
  let returningAttendees = 0;
  let vipAttendees = 0;
  for (const email of attendees) {
    const lifetime = lifetimeAttendance.get(email) ?? 0;
    if (lifetime === 1) newAttendees++;
    else if (lifetime >= 2) returningAttendees++;
    if (lifetime >= 5) vipAttendees++;
  }

  let registeredWhoAreCustomers = 0;
  for (const email of registrants) {
    const sales = salesByEmail.get(email);
    if (sales && sales.reduce((s, o) => s + o.amount, 0) > 0) {
      registeredWhoAreCustomers++;
    }
  }

  let attendeesWhoBoughtWithinWindow = 0;
  let revenueWithinWindowAttendees = 0;
  let noShowsWhoBoughtWithinWindow = 0;
  let revenueWithinWindowNoShows = 0;
  let totalWindowCustomerValue = 0;
  let customersInWindow = 0;
  const lagDays: number[] = [];

  let newCustomersCount = 0;
  let newCustomersRevenue = 0;
  let reactivatedCount = 0;
  let reactivatedRevenue = 0;
  let activeCount = 0;
  let activeRevenue = 0;

  for (const email of attendees) {
    const sales = salesByEmail.get(email);
    if (!sales || sales.length === 0) continue;

    let boughtWithinWindow = false;
    let revenueWindow = 0;
    for (const order of sales) {
      const orderDayMs = toUTCDayMs(order.date);
      if (orderDayMs >= webinarDayMs && orderDayMs <= windowEndMs) {
        boughtWithinWindow = true;
        revenueWindow += order.amount;
        lagDays.push(Math.floor((orderDayMs - webinarDayMs) / DAY_MS));
      }
    }
    if (!boughtWithinWindow) continue;

    attendeesWhoBoughtWithinWindow++;
    revenueWithinWindowAttendees += revenueWindow;
    totalWindowCustomerValue += revenueWindow;
    customersInWindow++;

    // Segment by prior order history.
    let priorOrderCount = 0;
    let mostRecentPriorMs: number | null = null;
    for (const order of sales) {
      const orderDayMs = toUTCDayMs(order.date);
      if (orderDayMs < webinarDayMs) {
        priorOrderCount++;
        if (mostRecentPriorMs === null || orderDayMs > mostRecentPriorMs) {
          mostRecentPriorMs = orderDayMs;
        }
      }
    }
    if (priorOrderCount === 0) {
      newCustomersCount++;
      newCustomersRevenue += revenueWindow;
    } else if (mostRecentPriorMs !== null && mostRecentPriorMs < reactivationCutoffMs) {
      reactivatedCount++;
      reactivatedRevenue += revenueWindow;
    } else {
      activeCount++;
      activeRevenue += revenueWindow;
    }
  }

  for (const email of noShows) {
    const sales = salesByEmail.get(email);
    if (!sales) continue;
    let boughtWithinWindow = false;
    let revenueWindow = 0;
    for (const order of sales) {
      const orderDayMs = toUTCDayMs(order.date);
      if (orderDayMs >= webinarDayMs && orderDayMs <= windowEndMs) {
        boughtWithinWindow = true;
        revenueWindow += order.amount;
      }
    }
    if (boughtWithinWindow) {
      noShowsWhoBoughtWithinWindow++;
      revenueWithinWindowNoShows += revenueWindow;
      totalWindowCustomerValue += revenueWindow;
      customersInWindow++;
    }
  }

  const totalRegistered = registrants.size;
  const totalAttended = attendees.size;
  const totalNoShows = noShows.size;
  const totalRevenueWithinWindow =
    revenueWithinWindowAttendees + revenueWithinWindowNoShows;

  return {
    webinarId: webinar.webinarId,
    topic: webinar.topic,
    date: webinar.date,
    totalRegistered,
    totalAttended,
    totalNoShows,
    attendanceRate:
      totalRegistered > 0 ? Math.round((totalAttended / totalRegistered) * 100) : 0,
    newAttendees,
    returningAttendees,
    vipAttendees,
    registeredWhoAreCustomers,
    attendeesWhoBoughtWithinWindow,
    revenueWithinWindowAttendees: round2(revenueWithinWindowAttendees),
    noShowsWhoBoughtWithinWindow,
    revenueWithinWindowNoShows: round2(revenueWithinWindowNoShows),
    totalRevenueWithinWindow: round2(totalRevenueWithinWindow),
    avgCustomerValueWindow:
      customersInWindow > 0 ? round2(totalWindowCustomerValue / customersInWindow) : 0,
    conversionRateAttendees:
      totalAttended > 0
        ? Math.round((attendeesWhoBoughtWithinWindow / totalAttended) * 100)
        : 0,
    conversionRateNoShows:
      totalNoShows > 0
        ? Math.round((noShowsWhoBoughtWithinWindow / totalNoShows) * 100)
        : 0,
    revenuePerAttendee:
      totalAttended > 0 ? round2(totalRevenueWithinWindow / totalAttended) : 0,
    revenuePerRegistrant:
      totalRegistered > 0 ? round2(totalRevenueWithinWindow / totalRegistered) : 0,
    avgLagDays:
      lagDays.length > 0
        ? Math.round((lagDays.reduce((a, b) => a + b, 0) / lagDays.length) * 10) / 10
        : null,
    newCustomersCount,
    newCustomersRevenue: round2(newCustomersRevenue),
    reactivatedCount,
    reactivatedRevenue: round2(reactivatedRevenue),
    activeCount,
    activeRevenue: round2(activeRevenue),
  };
}

/** Build the lifetime attendance map from all attendance rows across history. */
export function buildLifetimeAttendance(
  allAttendance: AttendanceRow[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of allAttendance) {
    if (!r.attended) continue;
    const email = r.email.toLowerCase().trim();
    if (!email) continue;
    map.set(email, (map.get(email) ?? 0) + 1);
  }
  return map;
}

interface ConfigRow {
  webinar_id: string;
  display_title: string | null;
  zoom_topic: string | null;
  start_time: string | null;
}

/**
 * Compute metrics for every webinar that has both attendance rows and a config
 * date. Reads the app Supabase (attendance + config) and the sales mirror
 * (td_order). Returns rows sorted by webinar date ascending (for trends).
 */
export async function computeAllWebinarMetrics(): Promise<{
  metrics: WebinarMetrics[];
  skipped: number;
}> {
  const app = appSupabase();

  const { data: attData, error: attErr } = await app
    .from("webinar_attendance")
    .select("webinar_id, email, attended, duration_min");
  if (attErr) throw new Error(`webinar_attendance read failed: ${attErr.message}`);
  const attendance = (attData ?? []) as AttendanceRow[];

  const { data: cfgData, error: cfgErr } = await app
    .from("webinar_config")
    .select("webinar_id, display_title, zoom_topic, start_time");
  if (cfgErr) throw new Error(`webinar_config read failed: ${cfgErr.message}`);
  const configBy:Map<string, ConfigRow> = new Map(
    ((cfgData ?? []) as ConfigRow[]).map((c) => [c.webinar_id, c])
  );

  // Group attendance rows by webinar.
  const byWebinar = new Map<string, AttendanceRow[]>();
  for (const r of attendance) {
    const list = byWebinar.get(r.webinar_id) ?? [];
    list.push(r);
    byWebinar.set(r.webinar_id, list);
  }

  const lifetime = buildLifetimeAttendance(attendance);
  const salesByEmail = await loadSalesForEmails(attendance.map((r) => r.email));

  const metrics: WebinarMetrics[] = [];
  let skipped = 0;
  for (const [webinarId, rows] of byWebinar) {
    const cfg = configBy.get(webinarId);
    if (!cfg?.start_time) {
      skipped++; // no date -> can't attribute; backfill a config row to include it
      continue;
    }
    metrics.push(
      computeWebinarMetrics(
        {
          webinarId,
          topic: cfg.display_title ?? cfg.zoom_topic ?? webinarId,
          date: cfg.start_time,
          registrants: rows,
        },
        lifetime,
        salesByEmail
      )
    );
  }

  metrics.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return { metrics, skipped };
}

/**
 * Metrics for a single webinar (detail page revenue block). Needs ALL attendance
 * for the lifetime-tier map, but only loads sales for this webinar's emails.
 * Returns null if the webinar has no attendance or no config date yet.
 */
export async function computeOneWebinarMetrics(
  webinarId: string
): Promise<WebinarMetrics | null> {
  const app = appSupabase();

  const { data: allAtt, error } = await app
    .from("webinar_attendance")
    .select("webinar_id, email, attended, duration_min");
  if (error) throw new Error(`webinar_attendance read failed: ${error.message}`);
  const attendance = (allAtt ?? []) as AttendanceRow[];
  const rows = attendance.filter((r) => r.webinar_id === webinarId);
  if (rows.length === 0) return null;

  const { data: cfg } = await app
    .from("webinar_config")
    .select("display_title, zoom_topic, start_time")
    .eq("webinar_id", webinarId)
    .maybeSingle();
  if (!cfg?.start_time) return null;

  const lifetime = buildLifetimeAttendance(attendance);
  const sales = await loadSalesForEmails(rows.map((r) => r.email));
  return computeWebinarMetrics(
    {
      webinarId,
      topic: cfg.display_title ?? cfg.zoom_topic ?? webinarId,
      date: cfg.start_time,
      registrants: rows,
    },
    lifetime,
    sales
  );
}
