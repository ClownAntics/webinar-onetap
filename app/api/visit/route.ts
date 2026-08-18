import { NextRequest, NextResponse } from "next/server";
import { appSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * POST /api/visit { webinarId, source } — one row per landing-page load.
 * The denominator for per-source conversion (visits -> registrations).
 * Client-side beacon (so most bots never fire it); preview loads excluded
 * by the client. Always 204 — visit logging must never surface errors.
 */
export async function POST(req: NextRequest) {
  try {
    const { webinarId, source } = (await req.json()) as { webinarId?: string; source?: string };
    if (webinarId && /^\d{9,12}$/.test(webinarId)) {
      await appSupabase()
        .from("webinar_visits")
        .insert({ webinar_id: webinarId, source: source?.slice(0, 20) ?? null });
    }
  } catch {
    /* table missing / bad body — never an error to the caller */
  }
  return new NextResponse(null, { status: 204 });
}
