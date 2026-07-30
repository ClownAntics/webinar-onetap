import { NextRequest, NextResponse } from "next/server";
import { fetchRegistrants, fetchParticipants } from "@/lib/zoom";
import { appSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

// Host/self rows to drop, per the Apps Script.
const EXCLUDE_EMAILS = new Set(["gbcabot@gmail.com"]);
const EXCLUDE_NAMES = new Set(["blake cabot"]);

/**
 * POST /api/attendance-sync  { webinarId }
 * Pull the Zoom participant report, match to registrants by email, and upsert
 * ONE row per registrant into webinar_attendance (attended + duration_min).
 * Fires nothing — post-webinar sends wait for the replay URL.
 */
export async function POST(req: NextRequest) {
  const { webinarId } = (await req.json().catch(() => ({}))) as { webinarId?: string };
  if (!webinarId) {
    return NextResponse.json({ error: "webinarId required" }, { status: 400 });
  }

  let registrants, participants;
  try {
    [registrants, participants] = await Promise.all([
      fetchRegistrants(webinarId),
      fetchParticipants(webinarId),
    ]);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
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

  try {
    const sb = appSupabase();
    // Upsert in chunks on the (webinar_id, email) unique constraint.
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await sb
        .from("webinar_attendance")
        .upsert(rows.slice(i, i + CHUNK), { onConflict: "webinar_id,email" });
      if (error) throw new Error(error.message);
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  const attended = rows.filter((r) => r.attended).length;
  return NextResponse.json({
    ok: true,
    webinarId,
    registrants: rows.length,
    attended,
    noShows: rows.length - attended,
  });
}
