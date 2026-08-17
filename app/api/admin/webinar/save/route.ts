import { NextRequest, NextResponse } from "next/server";
import { appSupabase } from "@/lib/supabase";
import { getEmployee } from "@/lib/auth";
import { getWebinar, getRegistrantQuestions } from "@/lib/zoom";
import { fireEvent, upsertContact } from "@/lib/omnisend";
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
  const startTime = existing?.start_time ?? zw?.start_time ?? null;
  const endTime =
    existing?.end_time ??
    (zw?.start_time
      ? new Date(new Date(zw.start_time).getTime() + (zw.duration ?? 60) * 60_000).toISOString()
      : null);
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

  let sends: { attended: number; noshow: number } | undefined;
  if (replayNewlySet && endPassed) {
    sends = await fireReplaySends(body.webinarId, merged.discount_code, merged.discount_expiry, merged.replay_url);
  }

  return NextResponse.json({ ok: true, status: nextStatus, replayNewlySet, sends });
}

/**
 * Replay-save trigger (README-build-v3.md §2). Fires attendee/no-show sends
 * once, idempotent via webinar_send_log's (webinar_id, send_type, email) unique key.
 */
async function fireReplaySends(
  webinarId: string,
  code: string | null,
  discountExpiry: string | null,
  replayUrl: string | null
): Promise<{ attended: number; noshow: number }> {
  const sb = appSupabase();
  const { data: attendance } = await sb
    .from("webinar_attendance")
    .select("email, attended")
    .eq("webinar_id", webinarId);

  const rows = attendance ?? [];
  const attendees = rows.filter((r) => r.attended).map((r) => r.email);
  const noShows = rows.filter((r) => !r.attended).map((r) => r.email);

  // Skip anyone already logged for this send type (idempotency).
  const { data: alreadyLogged } = await sb
    .from("webinar_send_log")
    .select("send_type, email")
    .eq("webinar_id", webinarId);
  const logged = new Set((alreadyLogged ?? []).map((l) => `${l.send_type}|${l.email}`));

  let attendedCount = 0;
  let noshowCount = 0;
  const logRows: { webinar_id: string; send_type: string; email: string }[] = [];

  for (const email of attendees) {
    if (logged.has(`webinar_attended|${email}`)) continue;
    await fireEvent("webinar_attended", email, { code, discount_expiry: discountExpiry, replay_url: replayUrl });
    await upsertContact({ email, tags: ["webinar-attendee"] });
    logRows.push({ webinar_id: webinarId, send_type: "webinar_attended", email });
    attendedCount++;
  }
  for (const email of noShows) {
    if (logged.has(`webinar_noshow|${email}`)) continue;
    await fireEvent("webinar_noshow", email, { code, discount_expiry: discountExpiry, replay_url: replayUrl });
    logRows.push({ webinar_id: webinarId, send_type: "webinar_noshow", email });
    noshowCount++;
  }

  if (logRows.length > 0) {
    await sb.from("webinar_send_log").upsert(logRows, {
      onConflict: "webinar_id,send_type,email",
      ignoreDuplicates: true,
    });
  }

  return { attended: attendedCount, noshow: noshowCount };
}
