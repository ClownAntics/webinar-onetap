import { NextRequest, NextResponse } from "next/server";
import { listWebinarReports } from "@/lib/zoom";
import { appSupabase } from "@/lib/supabase";
import { cleanWebinarTitle } from "@/lib/format";
import { syncAttendance } from "@/lib/attendance";
import { loadMasterclassSales, matchMasterclassSale } from "@/lib/reporting";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/zoom-history  { from?: "YYYY-MM-DD" }
 * Walk Zoom's webinar REPORTS month by month (reaches further back than the
 * past-webinars list, bounded by Zoom's report retention), find sessions that
 * match a paid masterclass product (or are named like one), then sync their
 * attendance and create COMPLETE config rows. Idempotent.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { from?: string };
  const start = new Date(body.from ?? "2024-06-01");
  const now = new Date();

  // Collect month windows [from, to].
  const months: [string, string][] = [];
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (d <= now) {
    const from = d.toISOString().slice(0, 10);
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    months.push([from, (end < now ? end : now).toISOString().slice(0, 10)]);
    d.setUTCMonth(d.getUTCMonth() + 1);
  }

  const found: { id: string; topic: string; start_time: string }[] = [];
  const monthErrors: Record<string, string> = {};
  for (const [from, to] of months) {
    try {
      found.push(...(await listWebinarReports(from, to)));
    } catch (err) {
      monthErrors[from] = err instanceof Error ? err.message : String(err);
    }
  }

  // Which of these look like paid classes? Product match first, name second.
  const mcSales = await loadMasterclassSales();
  const dedup = new Map(found.map((w) => [w.id, w]));
  const targets = [...dedup.values()].filter(
    (w) =>
      /master ?class/i.test(w.topic) ||
      matchMasterclassSale(mcSales, w.topic, w.start_time) ||
      matchMasterclassSale(mcSales, cleanWebinarTitle(w.topic), w.start_time)
  );

  const sb = appSupabase();
  const { data: existing } = await sb.from("webinar_config").select("webinar_id");
  const have = new Set((existing ?? []).map((c) => c.webinar_id));

  const results: Record<string, unknown> = {};
  for (const w of targets) {
    results[w.id] = {
      topic: w.topic,
      start: w.start_time,
      sync: await syncAttendance(w.id).catch((err) => ({
        error: err instanceof Error ? err.message : String(err),
      })),
    };
    if (!have.has(w.id) && new Date(w.start_time).getTime() < Date.now()) {
      const { error } = await sb.from("webinar_config").insert({
        webinar_id: w.id,
        zoom_topic: w.topic,
        display_title: cleanWebinarTitle(w.topic) || w.topic,
        start_time: w.start_time,
        status: "COMPLETE",
      });
      if (error) (results[w.id] as Record<string, unknown>).configError = error.message;
    }
  }

  return NextResponse.json({
    ok: true,
    monthsScanned: months.length,
    webinarsSeen: dedup.size,
    masterclassMatches: targets.length,
    monthErrors,
    results,
  });
}
