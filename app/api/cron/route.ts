import { NextResponse } from "next/server";
import { listWebinars } from "@/lib/zoom";
import { computeAllWebinarMetrics, writeSummaryCache } from "@/lib/reporting";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Vercel Cron entry (schedule in vercel.json, e.g. every 15 min). Idempotent —
 * every send is recorded in webinar_send_log before firing.
 *
 * Responsibilities (README-build-v3.md §2):
 *   - T-3 days before start: fire webinar_tease_due per registrant IF agenda set
 *   - T-1 hr before start:   fire webinar_reminder_due per registrant
 *   - after end_time:        trigger attendance-sync once  (WIRED below)
 *
 * TODO(full build): tease/reminder sends with webinar_send_log idempotency.
 */
export async function GET() {
  const now = Date.now();
  const results: { attendanceSynced: string[] } = { attendanceSynced: [] };

  try {
    const past = await listWebinars("past");
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    for (const w of past) {
      const ended = new Date(w.start_time).getTime() + (w.duration ?? 60) * 60_000;
      // Sync once, shortly after the webinar ends (within this cron window).
      if (now >= ended && now - ended < 24 * 60 * 60_000) {
        await fetch(`${origin}/api/attendance-sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ webinarId: w.id }),
        }).catch(() => {});
        results.attendanceSynced.push(w.id);
      }
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  // Refresh the webinar_summary cache (dashboard revenue chips). ~10s.
  let summaryError: string | undefined;
  try {
    const { metrics } = await computeAllWebinarMetrics();
    await writeSummaryCache(metrics);
  } catch (err) {
    summaryError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    ok: true,
    ...results,
    summaryError,
    note: "tease/reminder sends still TODO (need webinar_send_log idempotency)",
  });
}
