import { NextRequest, NextResponse } from "next/server";
import { fetchRegistrants, fetchParticipants, listWebinars } from "@/lib/zoom";
import { appSupabase } from "@/lib/supabase";
import { cleanWebinarTitle } from "@/lib/format";

export const runtime = "nodejs";
export const maxDuration = 300;

// Host/self rows to drop, per the Apps Script.
const EXCLUDE_EMAILS = new Set(["gbcabot@gmail.com"]);
const EXCLUDE_NAMES = new Set(["blake cabot"]);

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
      results[w.id] = await syncOne(w.id).catch((err) => ({
        error: err instanceof Error ? err.message : String(err),
      }));
    }

    // Past webinars with no config row (not in the sheet backfill) get a
    // minimal COMPLETE config so they leave "Needs attention" and count in
    // Trends. Never touches existing rows.
    const sb = appSupabase();
    const { data: existing } = await sb.from("webinar_config").select("webinar_id");
    const have = new Set((existing ?? []).map((c) => c.webinar_id));
    const newConfigs = past
      .filter((w) => !have.has(String(w.id)))
      .map((w) => ({
        webinar_id: String(w.id),
        zoom_topic: w.topic ?? null,
        display_title: cleanWebinarTitle(w.topic) || w.topic || null,
        start_time: w.start_time ?? null,
        status: "COMPLETE",
      }));
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
    return NextResponse.json({ ok: true, webinarId: body.webinarId, ...(await syncOne(body.webinarId)) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith("zoom:") ? 502 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

async function syncOne(webinarId: string): Promise<{ registrants: number; attended: number; noShows: number }> {
  let registrants, participants;
  try {
    [registrants, participants] = await Promise.all([
      fetchRegistrants(webinarId),
      fetchParticipants(webinarId),
    ]);
  } catch (err) {
    throw new Error(`zoom: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Sum attended minutes per email (a participant can have multiple sessions).
  const minutesByEmail = new Map<string, number>();
  for (const p of participants) {
    const email = (p.user_email ?? "").toLowerCase().trim();
    const name = (p.name ?? "").toLowerCase().trim();
    if (!email) continue;
    if (EXCLUDE_EMAILS.has(email) || EXCLUDE_NAMES.has(name)) continue;
    const mins = Math.round((p.duration ?? 0) / 60);
    minutesByEmail.set(email, (minutesByEmail.get(email) ?? 0) + mins);
  }

  // One row per registrant; attended = present in the participant report.
  const rows: {
    webinar_id: string;
    email: string;
    attended: boolean;
    duration_min: number | null;
  }[] = [];
  const seen = new Set<string>();
  for (const r of registrants) {
    const email = (r.email ?? "").toLowerCase().trim();
    const name = `${r.first_name ?? ""} ${r.last_name ?? ""}`.toLowerCase().trim();
    if (!email || seen.has(email)) continue;
    if (EXCLUDE_EMAILS.has(email) || EXCLUDE_NAMES.has(name)) continue;
    seen.add(email);
    const attended = minutesByEmail.has(email);
    rows.push({
      webinar_id: webinarId,
      email,
      attended,
      duration_min: attended ? (minutesByEmail.get(email) ?? 0) : null,
    });
  }

  // Include attendees who joined but never registered (guests).
  for (const [email, mins] of minutesByEmail) {
    if (seen.has(email)) continue;
    seen.add(email);
    rows.push({ webinar_id: webinarId, email, attended: true, duration_min: mins });
  }

  const sb = appSupabase();
  // Upsert in chunks on the (webinar_id, email) unique constraint.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await sb
      .from("webinar_attendance")
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "webinar_id,email" });
    if (error) throw new Error(error.message);
  }

  const attended = rows.filter((r) => r.attended).length;
  return { registrants: rows.length, attended, noShows: rows.length - attended };
}
