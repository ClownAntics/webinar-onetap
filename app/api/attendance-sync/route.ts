import { NextRequest, NextResponse } from "next/server";
import { listWebinars } from "@/lib/zoom";
import { appSupabase } from "@/lib/supabase";
import { cleanWebinarTitle } from "@/lib/format";
import { syncAttendance } from "@/lib/attendance";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/attendance-sync  { webinarId }  — sync one webinar.
 * POST /api/attendance-sync  { all: true }  — sync every past webinar Zoom
 * still lists (fills gaps the sheet backfill didn't cover, e.g. Clownantics /
 * CareerLearning / masterclass webinars). Idempotent upserts either way.
 *
 * Pull the Zoom participant report, match to registrants by email, and upsert
 * ONE row per registrant into webinar_attendance (attended + duration_min).
 * Fires nothing — post-webinar sends wait for the replay URL.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { webinarId?: string; all?: boolean };

  if (body.all) {
    let past;
    try {
      past = await listWebinars("past");
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 502 }
      );
    }
    const results: Record<string, unknown> = {};
    for (const w of past) {
      results[w.id] = await syncAttendance(w.id).catch((err) => ({
        error: err instanceof Error ? err.message : String(err),
      }));
    }

    // Past webinars with no config row (not in the sheet backfill) get a
    // minimal COMPLETE config so they leave "Needs attention" and count in
    // Trends. Never touches existing rows.
    const sb = appSupabase();
    const { data: existing } = await sb.from("webinar_config").select("webinar_id");
    const have = new Set((existing ?? []).map((c) => c.webinar_id));
    // Zoom's "past" list can include recurring webinars whose next occurrence
    // is in the future — only genuinely-ended ones get COMPLETE.
    const newConfigs = past
      .filter((w) => !have.has(String(w.id)))
      .map((w) => {
        const ended = w.start_time ? new Date(w.start_time).getTime() < Date.now() : false;
        return {
          webinar_id: String(w.id),
          zoom_topic: w.topic ?? null,
          display_title: cleanWebinarTitle(w.topic) || w.topic || null,
          start_time: w.start_time ?? null,
          status: ended ? "COMPLETE" : "NEEDS_SETUP",
        };
      });
    if (newConfigs.length > 0) {
      const { error } = await sb.from("webinar_config").insert(newConfigs);
      if (error) return NextResponse.json({ error: error.message, results }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      synced: past.length,
      configsCreated: newConfigs.map((c) => `${c.webinar_id} ${c.zoom_topic}`),
      results,
    });
  }

  if (!body.webinarId) {
    return NextResponse.json({ error: "webinarId or all:true required" }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, webinarId: body.webinarId, ...(await syncAttendance(body.webinarId)) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith("zoom:") ? 502 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
