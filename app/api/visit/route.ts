import { NextRequest, NextResponse } from "next/server";
import { appSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * POST /api/visit { webinarId, source, email? } — one row per landing-page load.
 * The denominator for per-source conversion (visits -> registrations).
 * Client-side beacon (so most bots never fire it); preview loads excluded
 * by the client. Always 204 — visit logging must never surface errors.
 *
 * `email` (present whenever the link was personalized, or the visitor is a
 * remembered registrant) makes this a first-party CLICK record: it is what the
 * day-of "SMS clickers" audience is built from. Omnisend's own SMS click
 * counts are ~8x inflated by carrier scanners and link previews; this beacon
 * only fires for real browsers that run JS.
 */
export async function POST(req: NextRequest) {
  try {
    const { webinarId, source, email } = (await req.json()) as {
      webinarId?: string;
      source?: string;
      email?: string;
    };
    if (webinarId && /^\d{9,12}$/.test(webinarId)) {
      const clean = (email ?? "").trim().toLowerCase();
      await appSupabase()
        .from("webinar_visits")
        .insert({
          webinar_id: webinarId,
          source: source?.slice(0, 20) ?? null,
          email: EMAIL_RE.test(clean) ? clean : null,
        });
    }
  } catch {
    /* table missing / bad body — never an error to the caller */
  }
  return new NextResponse(null, { status: 204 });
}
