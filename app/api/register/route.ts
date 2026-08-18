import { NextRequest, NextResponse } from "next/server";
import { addRegistrant } from "@/lib/zoom";
import { appSupabase } from "@/lib/supabase";
import { pushRegistration } from "@/lib/omnisend";
import type { Brand } from "@/lib/brands";
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
  let brand: Brand = "facepaint";
  try {
    const sb = appSupabase();
    const { data } = await sb
      .from("webinar_config")
      .select("zoom_question_title, display_title, zoom_topic, start_time, brand")
      .eq("webinar_id", webinarId)
      .maybeSingle();
    if (data) {
      questionTitle = data.zoom_question_title;
      title = data.display_title ?? data.zoom_topic ?? undefined;
      startTime = data.start_time ?? undefined;
      brand = (data.brand as Brand) ?? "facepaint";
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
      // Last names are unused everywhere (Blake+Yumer 2026-08-17) — send
      // empty rather than a "-" placeholder that clutters Zoom exports.
      last_name: lastName ?? "",
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

  // 4) Omnisend: contact + "webinar registered" event (SPEC-omnisend-sms.md).
  //    Best-effort — registration never fails on Omnisend; the cron sweep is
  //    the retry path and also logs successful pushes for idempotency.
  if (status === "success") {
    try {
      const ok = await pushRegistration(
        { webinarId, topic: title ?? webinarId, startTime: startTime ?? null, brand },
        { email, firstName }
      );
      if (ok) {
        await appSupabase()
          .from("webinar_send_log")
          .upsert(
            [{ webinar_id: webinarId, send_type: "omnisend_registered", email: email.toLowerCase() }],
            { onConflict: "webinar_id,send_type,email", ignoreDuplicates: true }
          );
      }
    } catch (err) {
      console.error("[register] omnisend push failed:", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ status, joinUrl: joinUrl!, title, startTime });
}
