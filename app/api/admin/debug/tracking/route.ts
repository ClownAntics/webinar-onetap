import { NextRequest, NextResponse } from "next/server";
import { getEmployee } from "@/lib/auth";
import { getZoomToken } from "@/lib/zoom";

export const runtime = "nodejs";

/**
 * TEMP debug: returns the raw Zoom tracking_sources response so we can see the
 * exact field names. Remove once the stats mapping is confirmed.
 *   /api/admin/debug/tracking?webinarId=83557297414
 */
export async function GET(req: NextRequest) {
  if ((await getEmployee()).reason !== "ok") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const webinarId = req.nextUrl.searchParams.get("webinarId");
  if (!webinarId) return NextResponse.json({ error: "webinarId required" }, { status: 400 });

  try {
    const token = await getZoomToken();
    const res = await fetch(`https://api.zoom.us/v2/webinars/${webinarId}/tracking_sources`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const json = await res.json();
    return NextResponse.json({ httpStatus: res.status, json });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
