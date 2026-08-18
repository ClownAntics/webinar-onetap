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
  const { email, brand, probe } = (await req.json().catch(() => ({}))) as { email?: string; brand?: Brand; probe?: boolean };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  // probe: raw Omnisend call surfacing the actual status + error body.
  if (probe) {
    const { env } = await import("@/lib/env");
    const apiKey = env.omnisend.keys[(brand as string) ?? "facepaint"];
    if (!apiKey) return NextResponse.json({ probe: "no key configured for brand" });
    const res = await fetch("https://api.omnisend.com/v5/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
      body: JSON.stringify({
        identifiers: [{ type: "email", id: email, channels: { email: { status: "subscribed", statusDate: new Date().toISOString() } } }],
      }),
      cache: "no-store",
    });
    return NextResponse.json({ probe: res.status, body: (await res.text()).slice(0, 400) });
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
