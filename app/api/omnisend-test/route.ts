import { NextRequest, NextResponse } from "next/server";
import { pushRegistration, pushAttended, pushStarting } from "@/lib/omnisend";
import type { Brand } from "@/lib/brands";

export const runtime = "nodejs";

/**
 * POST /api/omnisend-test { email, brand? }
 * Fires one sample of each webinar event for the given email so the event
 * types exist in Omnisend's automation-trigger dropdown (Omnisend only lists
 * events that have fired at least once). Uses the TEST webinar's identity.
 * Safe: creates/updates only the contact you pass in.
 */
export async function POST(req: NextRequest) {
  const { email, brand } = (await req.json().catch(() => ({}))) as { email?: string; brand?: Brand };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }
  const w = {
    webinarId: "87555460720",
    topic: "TEST — do not join",
    startTime: "2026-12-31T21:00:00Z",
    brand: (brand ?? "facepaint") as Brand,
  };
  const results = {
    registered: await pushRegistration(w, { email, firstName: "Test" }),
    attended: await pushAttended(w, { email, attendedCount: 1 }),
    starting: await pushStarting(w, { email, joinUrl: "https://zoom.us/j/87555460720" }),
  };
  return NextResponse.json({ ok: true, brand: w.brand, results });
}
