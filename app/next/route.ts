import { NextResponse, type NextRequest } from "next/server";
import { appSupabase } from "@/lib/supabase";
import { BRANDS, type Brand } from "@/lib/brands";

export const dynamic = "force-dynamic";

/**
 * Evergreen link: /next?src=instagram always lands on the brand's next
 * webinar, so a bio link never has to be re-pasted each week (and never
 * points at a webinar that already ran). Everything in the query string
 * (src, e, fn, ln) is passed through to /w/<webinarId> untouched, so the
 * channel is recorded exactly as if the dated link had been used.
 */

/** A webinar with no end_time is treated as over this long after it starts. */
const DEFAULT_LENGTH_MS = 2 * 60 * 60 * 1000;

/** The brand comes from the domain the link was opened on; ?brand= overrides. */
function brandFor(request: NextRequest): Brand {
  const asked = request.nextUrl.searchParams.get("brand")?.toLowerCase();
  if (asked && (BRANDS as readonly string[]).includes(asked)) return asked as Brand;
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").toLowerCase();
  if (host.includes("clownantics")) return "clownantics";
  if (host.includes("careerlearning")) return "careerlearning";
  return "facepaint";
}

interface Row {
  webinar_id: string;
  start_time: string;
  end_time: string | null;
}

/**
 * The earliest set-up webinar that hasn't ended yet. If nothing is upcoming,
 * the most recent one — a past webinar's page beats a dead link.
 */
async function nextWebinarId(brand: Brand): Promise<string | null> {
  const { data, error } = await appSupabase()
    .from("webinar_config")
    .select("webinar_id, start_time, end_time")
    .eq("brand", brand)
    .neq("status", "NEEDS_SETUP")
    .not("start_time", "is", null)
    .order("start_time", { ascending: false })
    .limit(25);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Row[];
  const now = Date.now();
  const endsAt = (r: Row) =>
    r.end_time ? new Date(r.end_time).getTime() : new Date(r.start_time).getTime() + DEFAULT_LENGTH_MS;

  const upcoming = rows.filter((r) => endsAt(r) > now);
  // rows are newest-first, so the last upcoming row is the soonest one
  return (upcoming[upcoming.length - 1] ?? rows[0])?.webinar_id ?? null;
}

export async function GET(request: NextRequest) {
  let webinarId: string | null = null;
  try {
    webinarId = await nextWebinarId(brandFor(request));
  } catch {
    webinarId = null;
  }

  const target = new URL(webinarId ? `/w/${webinarId}` : "/", request.url);
  if (webinarId) {
    request.nextUrl.searchParams.forEach((value, key) => {
      if (key !== "brand") target.searchParams.append(key, value);
    });
  }

  // Temporary + uncached: the destination changes every week.
  const res = NextResponse.redirect(target, 307);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
