import { NextResponse, type NextRequest } from "next/server";
import { brandFor, listOpenWebinars, PASS_THROUGH } from "@/lib/open-webinars";

export const dynamic = "force-dynamic";

/**
 * Permanent link for bios: /next?src=instagram always lands on the brand's
 * next free webinar, so the link never has to be re-pasted (and never points
 * at a webinar that already ran). src/e/fn/ln pass through, so the channel is
 * recorded exactly as with a dated link. Nothing scheduled → the list page,
 * which says so instead of showing a past webinar.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const brand = brandFor(request.headers.get("x-forwarded-host") ?? request.headers.get("host"), sp.get("brand"));

  let webinarId: string | null = null;
  try {
    webinarId = (await listOpenWebinars(brand))[0]?.webinar_id ?? null;
  } catch {
    webinarId = null;
  }

  const target = new URL(webinarId ? `/w/${webinarId}` : "/webinars", request.url);
  for (const key of PASS_THROUGH) {
    const v = sp.get(key);
    if (v) target.searchParams.set(key, v);
  }
  // The list page needs the brand when it can't read it off the domain.
  if (!webinarId && sp.get("brand")) target.searchParams.set("brand", sp.get("brand")!);

  // Temporary + uncached: the destination changes every week.
  const res = NextResponse.redirect(target, 307);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
