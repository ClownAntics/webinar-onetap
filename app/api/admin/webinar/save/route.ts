import { NextRequest, NextResponse } from "next/server";
import { appSupabase } from "@/lib/supabase";
import { getEmployee } from "@/lib/auth";
import { getWebinar, getRegistrantQuestions } from "@/lib/zoom";
import { nextStatusOnSave } from "@/lib/status";
import { BRANDS, type Brand } from "@/lib/brands";
import type { WebinarConfig, WebinarStatus } from "@/lib/types";

export const runtime = "nodejs";

interface SaveBody {
  webinarId: string;
  brand?: Brand;
  display_title?: string;
  question_text?: string;
  zoom_question_title?: string;
  banner_url?: string;
  agenda?: string;
  replay_url?: string;
  discount_code?: string;
  discount_expiry?: string;
}

export async function POST(req: NextRequest) {
  if ((await getEmployee()).reason !== "ok") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as SaveBody | null;
  if (!body?.webinarId) {
    return NextResponse.json({ error: "webinarId required" }, { status: 400 });
  }

  const sb = appSupabase();

  // Existing config (to detect replay empty->set + current status).
  const { data: existing } = await sb
    .from("webinar_config")
    .select("*")
    .eq("webinar_id", body.webinarId)
    .maybeSingle<WebinarConfig>();

  // Zoom facts (topic/times) — best-effort; fall back to existing.
  const zw = await getWebinar(body.webinarId).catch(() => null);
  // Zoom is the source of truth for the schedule: a webinar rescheduled in
  // Zoom must win over our stored snapshot (a stale date feeds the landing
  // page, calendar buttons, and Omnisend events). Stored value is only the
  // fallback when Zoom is unreachable.
  const startTime = zw?.start_time ?? existing?.start_time ?? null;
  const endTime = zw?.start_time
    ? new Date(new Date(zw.start_time).getTime() + (zw.duration ?? 60) * 60_000).toISOString()
    : existing?.end_time ?? null;
  const endPassed = endTime ? Date.now() > new Date(endTime).getTime() : false;

  // Answers count (threshold for EMAIL_ARTIST).
  const { count: answersCount } = await sb
    .from("webinar_reg_events")
    .select("id", { count: "exact", head: true })
    .eq("webinar_id", body.webinarId)
    .not("question_answer", "is", null);

  const merged = {
    brand: (BRANDS.includes(body.brand as Brand) ? body.brand : existing?.brand) ?? "facepaint",
    display_title: body.display_title ?? existing?.display_title ?? null,
    question_text: body.question_text ?? existing?.question_text ?? null,
    zoom_question_title: body.zoom_question_title ?? existing?.zoom_question_title ?? null,
    banner_url: body.banner_url ?? existing?.banner_url ?? null,
    agenda: body.agenda ?? existing?.agenda ?? null,
    replay_url: body.replay_url ?? existing?.replay_url ?? null,
    discount_code: body.discount_code ?? existing?.discount_code ?? null,
    discount_expiry: body.discount_expiry || existing?.discount_expiry || null,
  };

  // The answer only reaches Zoom if we know Zoom's exact question title
  // (custom_questions match by title). The Setup UI never sends it, so
  // capture it from Zoom on save whenever it's missing.
  if (!merged.zoom_question_title) {
    const questions = await getRegistrantQuestions(body.webinarId).catch(() => [] as string[]);
    merged.zoom_question_title = questions[0] ?? null;
  }

  const replayNewlySet =
    !existing?.replay_url && !!merged.replay_url && merged.replay_url.trim().length > 0;

  const current: WebinarStatus = existing?.status ?? "NEEDS_SETUP";
  const nextStatus = nextStatusOnSave(current, {
    hasSetup: !!merged.display_title && !!merged.question_text,
    agendaFilled: !!merged.agenda && merged.agenda.trim().length > 0,
    replayNewlySet,
    endPassed,
    answersCount: answersCount ?? 0,
  });

  const { error: upsertErr } = await sb.from("webinar_config").upsert(
    {
      webinar_id: body.webinarId,
      ...merged,
      status: nextStatus,
      zoom_topic: existing?.zoom_topic ?? zw?.topic ?? null,
      start_time: startTime,
      end_time: endTime,
    },
    { onConflict: "webinar_id" }
  );
  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: nextStatus, replayNewlySet });
}
