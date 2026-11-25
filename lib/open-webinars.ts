// Webinars open for sign-up — shared by the permanent link (/next) and the
// public list (/webinars).

import { appSupabase } from "@/lib/supabase";
import { BRANDS, type Brand } from "@/lib/brands";

/** A webinar with no end_time is treated as over this long after it starts. */
const DEFAULT_LENGTH_MS = 2 * 60 * 60 * 1000;

/** Same rule the admin uses to put a webinar in the Masterclasses tab. */
export const isMasterclassTitle = (t: string | null | undefined) => /master ?class/i.test(t ?? "");

/**
 * The brand comes from the domain the link was opened on
 * (webinars.facepaint.com / webinars.clownantics.com); ?brand= overrides,
 * which is how the vercel.app URL and CareerLearning reach their own list.
 */
export function brandFor(host: string | null | undefined, override?: string | null): Brand {
  const asked = override?.toLowerCase();
  if (asked && (BRANDS as readonly string[]).includes(asked)) return asked as Brand;
  const h = (host ?? "").toLowerCase();
  if (h.includes("clownantics")) return "clownantics";
  if (h.includes("careerlearning")) return "careerlearning";
  return "facepaint";
}

export interface OpenWebinar {
  webinar_id: string;
  title: string;
  start_time: string;
  banner_url: string | null;
}

/**
 * Set-up (not NEEDS_SETUP), not yet ended, free webinars for one brand,
 * soonest first. Masterclasses are paid and never appear here.
 */
export async function listOpenWebinars(brand: Brand): Promise<OpenWebinar[]> {
  // Anything that started more than DEFAULT_LENGTH_MS ago can only still be
  // open if its end_time says so — this bound keeps the read small.
  const earliest = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await appSupabase()
    .from("webinar_config")
    .select("webinar_id, display_title, zoom_topic, start_time, end_time, banner_url")
    .eq("brand", brand)
    .neq("status", "NEEDS_SETUP")
    .gte("start_time", earliest)
    .order("start_time", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);

  const now = Date.now();
  type Row = {
    webinar_id: string;
    display_title: string | null;
    zoom_topic: string | null;
    start_time: string;
    end_time: string | null;
    banner_url: string | null;
  };
  return ((data ?? []) as Row[])
    .filter((r) => {
      const ends = r.end_time ? new Date(r.end_time).getTime() : new Date(r.start_time).getTime() + DEFAULT_LENGTH_MS;
      return ends > now;
    })
    .filter((r) => !isMasterclassTitle(r.zoom_topic) && !isMasterclassTitle(r.display_title))
    .map((r) => ({
      webinar_id: r.webinar_id,
      title: r.display_title || r.zoom_topic || "Free webinar",
      start_time: r.start_time,
      banner_url: r.banner_url,
    }));
}

/**
 * Query params worth carrying from a permanent link / list into a sign-up
 * page: the channel tag and any identity the link brought with it.
 */
export const PASS_THROUGH = ["src", "e", "fn", "ln"] as const;
