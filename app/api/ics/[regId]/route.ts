import { NextRequest, NextResponse } from "next/server";
import { buildICS } from "@/lib/calendar";

export const runtime = "nodejs";

/**
 * Serves an .ics for a registration. In the full build, `regId` looks up the
 * stored registrant (join_url + times). For the scaffold we accept the event
 * details as query params so the Success screen's "Add to Apple/Outlook" works
 * end-to-end without a DB round-trip.
 *
 *   /api/ics/<regId>?title=...&start=<iso>&end=<iso>&join=<url>
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ regId: string }> }
) {
  await params; // regId reserved for DB lookup in the full build
  const sp = req.nextUrl.searchParams;
  const title = sp.get("title") ?? "FacePaint.com Webinar";
  const start = sp.get("start");
  const end = sp.get("end");
  const join = sp.get("join") ?? "";

  if (!start) {
    return NextResponse.json({ error: "missing start" }, { status: 400 });
  }
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date(startDate.getTime() + 60 * 60 * 1000);

  const ics = buildICS({ title, start: startDate, end: endDate, joinUrl: join });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="facepaint-webinar.ics"',
    },
  });
}
