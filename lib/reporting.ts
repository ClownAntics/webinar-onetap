import { salesSupabase, appSupabase, fetchAllRows } from "./supabase";
import type { Brand } from "./brands";
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

interface OrderRpcRow {
  email: string;
  order_date: string;
  order_number: string | null;
  amount: number | null;
}

/**
 * Fetch orders for a batch of (lowercased) emails via the rpc. A response of
 * exactly the 1000-row PostgREST cap means possible truncation — split the
 * email batch in half and recurse until every response is complete.
 */
async function fetchOrdersFor(
  sb: ReturnType<typeof salesSupabase>,
  emails: string[]
): Promise<OrderRpcRow[]> {
  const { data, error } = await sb.rpc("webinar_orders_for_emails", { p_emails: emails });
  if (error) throw new Error(`td_order query failed: ${error.message}`);
  const rows = (data ?? []) as OrderRpcRow[];
  if (rows.length >= 1000 && emails.length > 1) {
    const mid = Math.ceil(emails.length / 2);
    const [a, b] = await Promise.all([
      fetchOrdersFor(sb, emails.slice(0, mid)),
      fetchOrdersFor(sb, emails.slice(mid)),
    ]);
    return [...a, ...b];
  }
  return rows;
}

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
  brand: Brand;
  isMasterclass: boolean;
  tickets: number;
  ticketRevenue: number;
}

const isMasterclassTopic = (topic: string | null | undefined) => /master ?class/i.test(topic ?? "");

export interface MasterclassSale {
  description: string;
  tickets: number;
  revenue: number;
  /** ISO date parsed from the description's YYYYMMDD prefix, if present. */
  date: string | null;
  matched: boolean;
}

/**
 * Order-insensitive matching key: TeamDesk descriptions and Zoom topics name
 * the same class with the words swapped around ("20260611 Special FX (Dutch
 * Bihary) Masterclass" vs "Dutch Bihary (Special FX) Masterclass") — so strip
 * the date prefix, drop punctuation, and sort the words.
 */
const topicKey = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .replace(/^\s*\d{6,8}\s*/, "")
    .replace(/master\s+class/g, "masterclass")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");

const descDate = (s: string): string | null => {
  const m = s.match(/^\s*(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/**
 * Ticket sales per masterclass from the TeamDesk mirror (verified against the
 * TD "Annual SKU Unit Sales Table" report). Empty list if the SQL function
 * (migration 0004) isn't installed yet — reports degrade to $0 tickets.
 */
export async function loadMasterclassSales(): Promise<MasterclassSale[]> {
  try {
    const { data, error } = await salesSupabase().rpc("webinar_masterclass_sales");
    if (error) throw new Error(error.message);
    return ((data ?? []) as { description: string; tickets: number; revenue: number }[]).map((r) => ({
      description: r.description,
      tickets: Number(r.tickets ?? 0),
      revenue: Number(r.revenue ?? 0),
      date: descDate(r.description),
      matched: false,
    }));
  } catch (err) {
    console.warn("masterclass sales unavailable:", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Find the ticket-sales row for a webinar: same word-set key, and when several
 * runs of the same class exist, the one dated within 3 days of the webinar.
 */
export function matchMasterclassSale(
  sales: MasterclassSale[],
  topic: string | null,
  webinarDate: string | null
): MasterclassSale | undefined {
  const key = topicKey(topic);
  if (!key) return undefined;
  const candidates = sales.filter((s) => topicKey(s.description) === key);
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1 || !webinarDate) return candidates[0];
  const wd = new Date(webinarDate).getTime();
  return (
    candidates.find((c) => c.date && Math.abs(new Date(c.date).getTime() - wd) < 3 * DAY_MS) ??
    candidates[0]
  );
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

  // webinar_orders_for_emails (migration 0003): matches lower("Email") via an
  // expression index — case-insensitive and fast on the 230k-row mirror.
  // NOTE: do NOT add .order()/.range() to this rpc — PostgREST's sort wrapper
  // on function results hits the 8s statement timeout. Instead call plain
  // (fast) and split any chunk that fills the 1000-row response cap.
  const CHUNK = 200;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const data = await fetchOrdersFor(sb, slice);
    for (const row of data) {
      const email = row.email.trim();
      if (!email || !row.order_date) continue;
      const order: SalesOrder = {
        email,
        date: row.order_date,
        orderNumber: String(row.order_number ?? ""),
        amount: Number(row.amount ?? 0),
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
    brand: webinar.brand,
    isMasterclass: webinar.isMasterclass,
    tickets: webinar.tickets,
    ticketRevenue: webinar.ticketRevenue,
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
  brand: Brand | null;
}

/** Build the per-webinar input fields that come from config + ticket sales.
 *  Marks the matched sale so callers can report leftovers (classes that sold
 *  tickets but have no webinar record in the app). */
function classify(cfg: ConfigRow, mcSales: MasterclassSale[]) {
  const raw = cfg.zoom_topic ?? cfg.display_title ?? "";
  // A webinar is a masterclass when a paid product matches it — TeamDesk's
  // type filter is the source of truth, not the name (e.g. "Facepaint Jam").
  // Name test kept as fallback for classes whose product sold zero tickets.
  const sale =
    matchMasterclassSale(mcSales, raw, cfg.start_time) ??
    matchMasterclassSale(mcSales, cfg.display_title, cfg.start_time);
  const isMasterclass = !!sale || isMasterclassTopic(raw) || isMasterclassTopic(cfg.display_title);
  if (sale) sale.matched = true;
  return {
    brand: (cfg.brand ?? "facepaint") as Brand,
    isMasterclass,
    tickets: sale?.tickets ?? 0,
    ticketRevenue: sale?.revenue ?? 0,
  };
}

/**
 * Compute metrics for every webinar that has both attendance rows and a config
 * date. Reads the app Supabase (attendance + config) and the sales mirror
 * (td_order). Returns rows sorted by webinar date ascending (for trends).
 */
export async function computeAllWebinarMetrics(): Promise<{
  metrics: WebinarMetrics[];
  skipped: number;
  /** Masterclasses that sold tickets but have no webinar record in the app. */
  unmatchedSales: MasterclassSale[];
}> {
  const app = appSupabase();

  const attendance = await fetchAllRows<AttendanceRow>((from, to) =>
    app.from("webinar_attendance").select("webinar_id, email, attended, duration_min").order("id").range(from, to)
  ).catch((err) => {
    throw new Error(`webinar_attendance read failed: ${err instanceof Error ? err.message : String(err)}`);
  });

  const { data: cfgData, error: cfgErr } = await app
    .from("webinar_config")
    .select("webinar_id, display_title, zoom_topic, start_time, brand");
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
  const [salesByEmail, mcSales] = await Promise.all([
    loadSalesForEmails(attendance.map((r) => r.email)),
    loadMasterclassSales(),
  ]);

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
          ...classify(cfg, mcSales),
        },
        lifetime,
        salesByEmail
      )
    );
  }

  metrics.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const unmatchedSales = mcSales.filter((s) => !s.matched);
  return { metrics, skipped, unmatchedSales };
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

  const attendance = await fetchAllRows<AttendanceRow>((from, to) =>
    app.from("webinar_attendance").select("webinar_id, email, attended, duration_min").order("id").range(from, to)
  ).catch((err) => {
    throw new Error(`webinar_attendance read failed: ${err instanceof Error ? err.message : String(err)}`);
  });
  const rows = attendance.filter((r) => r.webinar_id === webinarId);
  if (rows.length === 0) return null;

  const { data: cfg } = await app
    .from("webinar_config")
    .select("webinar_id, display_title, zoom_topic, start_time, brand")
    .eq("webinar_id", webinarId)
    .maybeSingle<ConfigRow>();
  if (!cfg?.start_time) return null;

  const lifetime = buildLifetimeAttendance(attendance);
  const needsMc = isMasterclassTopic(cfg.zoom_topic) || isMasterclassTopic(cfg.display_title);
  const [sales, mcSales] = await Promise.all([
    loadSalesForEmails(rows.map((r) => r.email)),
    needsMc ? loadMasterclassSales() : Promise.resolve([] as MasterclassSale[]),
  ]);
  return computeWebinarMetrics(
    {
      webinarId,
      topic: cfg.display_title ?? cfg.zoom_topic ?? webinarId,
      date: cfg.start_time,
      registrants: rows,
      ...classify(cfg, mcSales),
    },
    lifetime,
    sales
  );
}

/**
 * Persist computed metrics into webinar_summary — the dashboard reads this
 * cache for per-card revenue chips (recomputed by /api/cron).
 */
export async function writeSummaryCache(metrics: WebinarMetrics[]): Promise<void> {
  if (metrics.length === 0) return;
  const rows = metrics.map((m) => ({
    webinar_id: m.webinarId,
    topic: m.topic,
    webinar_date: m.date.slice(0, 10),
    total_registered: m.totalRegistered,
    total_attended: m.totalAttended,
    total_no_shows: m.totalNoShows,
    attendance_rate: m.attendanceRate,
    new_attendees: m.newAttendees,
    returning_attendees: m.returningAttendees,
    vip_attendees: m.vipAttendees,
    registered_who_are_customers: m.registeredWhoAreCustomers,
    total_revenue_within_window: m.totalRevenueWithinWindow,
    revenue_per_attendee: m.revenuePerAttendee,
    revenue_per_registrant: m.revenuePerRegistrant,
    new_customers_count: m.newCustomersCount,
    new_customers_revenue: m.newCustomersRevenue,
    reactivated_count: m.reactivatedCount,
    reactivated_revenue: m.reactivatedRevenue,
    active_count: m.activeCount,
    active_revenue: m.activeRevenue,
    computed_at: new Date().toISOString(),
  }));
  const sb = appSupabase();
  const { error } = await sb.from("webinar_summary").upsert(rows, { onConflict: "webinar_id" });
  if (error) throw new Error(`webinar_summary write failed: ${error.message}`);
}
