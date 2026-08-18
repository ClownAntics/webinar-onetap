import { NextResponse } from "next/server";
import { listWebinars, fetchRegistrants, type ZoomWebinar } from "@/lib/zoom";
import { appSupabase } from "@/lib/supabase";
import { syncAttendance } from "@/lib/attendance";
import { computeAllWebinarMetrics, writeSummaryCache } from "@/lib/reporting";
import { pushRegistration, pushAttended, pushStarting, hasOmnisend, type WebinarEventInfo } from "@/lib/omnisend";
import type { Brand } from "@/lib/brands";

export const runtime = "nodejs";
export const maxDuration = 300;

// Sweep registrations into Omnisend for webinars starting within this window.
const SWEEP_DAYS = 14;
// "webinar starting" fires when 0 < start - now <= this (cron runs every 15min;
// webinar_send_log makes overlap harmless).
const STARTING_WINDOW_MS = 20 * 60_000;

interface CronReport {
  attendanceSynced: string[];
  omnisendRegistered: number;
  omnisendAttended: number;
  webinarStarting: number;
  errors: string[];
}

/**
 * Vercel Cron (every 15 min, schedule in vercel.json). Everything idempotent —
 * Omnisend pushes and events are recorded in webinar_send_log before/after
 * firing, so reruns never double-send. Per SPEC-omnisend-sms.md.
 */
export async function GET() {
  const now = Date.now();
  const r: CronReport = { attendanceSynced: [], omnisendRegistered: 0, omnisendAttended: 0, webinarStarting: 0, errors: [] };
  const sb = appSupabase();

  let upcoming: ZoomWebinar[] = [];
  let past: ZoomWebinar[] = [];
  try {
    [upcoming, past] = await Promise.all([listWebinars("upcoming"), listWebinars("past")]);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  // Config lookup (brand + display titles) for event payloads.
  const { data: cfgData } = await sb
    .from("webinar_config")
    .select("webinar_id, brand, display_title, zoom_topic, start_time");
  const cfg = new Map((cfgData ?? []).map((c) => [c.webinar_id, c]));
  const infoFor = (w: ZoomWebinar): WebinarEventInfo => {
    const c = cfg.get(w.id);
    return {
      webinarId: w.id,
      topic: c?.display_title ?? c?.zoom_topic ?? w.topic ?? w.id,
      startTime: c?.start_time ?? w.start_time ?? null,
      brand: ((c?.brand as Brand) ?? "facepaint") as Brand,
    };
  };

  // Send-log lookup for the webinars we might touch this run.
  const touchIds = [...new Set([...upcoming.map((w) => w.id), ...past.map((w) => w.id)])];
  const { data: logData } = await sb
    .from("webinar_send_log")
    .select("webinar_id, send_type, email")
    .in("webinar_id", touchIds);
  const logged = new Set((logData ?? []).map((l) => `${l.webinar_id}|${l.send_type}|${l.email}`));
  const logRows: { webinar_id: string; send_type: string; email: string }[] = [];
  const mark = (wid: string, type: string, email: string) => {
    logged.add(`${wid}|${type}|${email}`);
    logRows.push({ webinar_id: wid, send_type: type, email });
  };

  // ---- 1) Attendance sync shortly after each webinar ends -------------------
  for (const w of past) {
    const ended = new Date(w.start_time).getTime() + (w.duration ?? 60) * 60_000;
    if (now >= ended && now - ended < 24 * 60 * 60_000) {
      try {
        await syncAttendance(w.id);
        r.attendanceSynced.push(w.id);
      } catch (err) {
        r.errors.push(`sync ${w.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ---- 2) Omnisend registration sweep (upcoming, next SWEEP_DAYS) -----------
  // Catches Zoom-native registrants and retries any failed instant pushes.
  for (const w of upcoming) {
    const info = infoFor(w);
    if (!hasOmnisend(info.brand)) continue;
    const start = info.startTime ? new Date(info.startTime).getTime() : null;
    if (!start || start < now || start - now > SWEEP_DAYS * 24 * 60 * 60_000) continue;
    try {
      const regs = await fetchRegistrants(w.id);
      for (const reg of regs) {
        const email = (reg.email ?? "").toLowerCase().trim();
        if (!email || logged.has(`${w.id}|omnisend_registered|${email}`)) continue;
        if (await pushRegistration(info, { email, firstName: reg.first_name })) {
          mark(w.id, "omnisend_registered", email);
          r.omnisendRegistered++;
        }
      }
    } catch (err) {
      r.errors.push(`sweep ${w.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ---- 3) "webinar starting" events at T-15 (join link for the SMS flow) ----
  for (const w of upcoming) {
    const info = infoFor(w);
    if (!hasOmnisend(info.brand)) continue;
    const start = info.startTime ? new Date(info.startTime).getTime() : null;
    if (!start || start <= now || start - now > STARTING_WINDOW_MS) continue;
    try {
      const regs = await fetchRegistrants(w.id);
      for (const reg of regs) {
        const email = (reg.email ?? "").toLowerCase().trim();
        if (!email || !reg.join_url || logged.has(`${w.id}|webinar_starting|${email}`)) continue;
        if (await pushStarting(info, { email, joinUrl: reg.join_url })) {
          mark(w.id, "webinar_starting", email);
          r.webinarStarting++;
        }
      }
    } catch (err) {
      r.errors.push(`starting ${w.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ---- 4) "webinar attended" events (after the post-webinar sync) -----------
  for (const w of past) {
    const info = infoFor(w);
    if (!hasOmnisend(info.brand)) continue;
    const ended = new Date(w.start_time).getTime() + (w.duration ?? 60) * 60_000;
    if (now < ended || now - ended >= 24 * 60 * 60_000) continue;
    try {
      const { data: att } = await sb
        .from("webinar_attendance")
        .select("email")
        .eq("webinar_id", w.id)
        .eq("attended", true)
        .limit(1000);
      const emails = (att ?? []).map((a) => a.email.toLowerCase()).filter((e) => !logged.has(`${w.id}|omnisend_attended|${e}`));
      if (emails.length === 0) continue;
      // Lifetime attended counts for the rolling property, one query.
      const counts = new Map<string, number>();
      const CHUNK = 200;
      for (let i = 0; i < emails.length; i += CHUNK) {
        const { data: rows } = await sb
          .from("webinar_attendance")
          .select("email")
          .in("email", emails.slice(i, i + CHUNK))
          .eq("attended", true)
          .limit(10000);
        for (const row of rows ?? []) {
          const e = row.email.toLowerCase();
          counts.set(e, (counts.get(e) ?? 0) + 1);
        }
      }
      for (const email of emails) {
        if (await pushAttended(info, { email, attendedCount: counts.get(email) ?? 1 })) {
          mark(w.id, "omnisend_attended", email);
          r.omnisendAttended++;
        }
      }
    } catch (err) {
      r.errors.push(`attended ${w.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Persist idempotency log.
  if (logRows.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < logRows.length; i += CHUNK) {
      await sb.from("webinar_send_log").upsert(logRows.slice(i, i + CHUNK), {
        onConflict: "webinar_id,send_type,email",
        ignoreDuplicates: true,
      });
    }
  }

  // ---- 5) Refresh the webinar_summary cache (dashboard revenue chips) -------
  let summaryError: string | undefined;
  try {
    const { metrics } = await computeAllWebinarMetrics();
    await writeSummaryCache(metrics);
  } catch (err) {
    summaryError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({ ok: true, ...r, summaryError });
}
