import { NextRequest, NextResponse } from "next/server";
import { addRegistrant } from "@/lib/zoom";
import { appSupabase } from "@/lib/supabase";
import { fireEvent, upsertContact } from "@/lib/omnisend";
import type { RegisterRequest, RegisterResult } from "@/lib/types";

export const runtime = "nodejs";

function isEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}

export async function POST(req: NextRequest): Promise<NextResponse<RegisterResult>> {
  let body: RegisterRequest;
  try {
    body = (await req.json()) as RegisterRequest;
  } catch {
    return NextResponse.json({ status: "error", message: "Bad request" }, { status: 400 });
  }

  const { webinarId, email, firstName, lastName, source, answer } = body;
  if (!webinarId || !email || !isEmail(email)) {
    return NextResponse.json(
      { status: "error", message: "Missing or invalid webinarId/email" },
      { status: 400 }
    );
  }

  // 1) Look up config (best-effort — the landing page requires a Ready config,
  //    but registration should still work if only Zoom is wired).
  let questionTitle: string | null = null;
  let title: string | undefined;
  let startTime: string | undefined;
  try {
    const sb = appSupabase();
    const { data } = await sb
      .from("webinar_config")
      .select("zoom_question_title, display_title, zoom_topic, start_time")
      .eq("webinar_id", webinarId)
      .maybeSingle();
    if (data) {
      questionTitle = data.zoom_question_title;
      title = data.display_title ?? data.zoom_topic ?? undefined;
      startTime = data.start_time ?? undefined;
    }
  } catch {
    /* Supabase not configured in scaffold — continue */
  }

  // 2) Register with Zoom.
  let joinUrl: string;
  let status: RegisterResult["status"] = "success";
  try {
    const result = await addRegistrant(webinarId, {
      email,
      first_name: firstName || "-",
      last_name: lastName || "-",
      custom_questions:
        questionTitle && answer ? [{ title: questionTitle, value: answer }] : undefined,
    });
    joinUrl = result.join_url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Already-registered is a success path in Zoom's model; surface as duplicate.
    if (/already|3009|exist/i.test(msg)) {
      status = "duplicate";
      joinUrl = "";
    } else {
      return NextResponse.json({ status: "error", message: msg }, { status: 502 });
    }
  }

  // 3) Log the attempt (best-effort).
  try {
    const sb = appSupabase();
    await sb.from("webinar_reg_events").insert({
      webinar_id: webinarId,
      email,
      first_name: firstName,
      source,
      question_answer: answer ?? null,
      status,
    });
  } catch {
    /* ignore logging failures in scaffold */
  }

  // 4) Omnisend event + contact (best-effort).
  try {
    await upsertContact({ email, firstName, tags: [`webinar-${webinarId}`, `src-${source}`] });
    await fireEvent("webinar_registered", email, {
      webinar_id: webinarId,
      title,
      start_time: startTime,
      join_url: joinUrl!,
      source,
    });
  } catch {
    /* ignore */
  }

  return NextResponse.json({ status, joinUrl: joinUrl!, title, startTime });
}
