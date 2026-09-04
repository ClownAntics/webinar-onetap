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

/**
 * Zoom rejects registrations that skip a REQUIRED custom question (code 300,
 * e.g. Claire's webinar 2026-08-18). One-tap must never dead-end on that
 * misconfiguration: parse the demanded question title out of the error and
 * retry with the visitor's answer — or a "-" placeholder when they gave none.
 */
async function addRegistrantWithRequiredQuestions(
  webinarId: string,
  base: { email: string; first_name: string; last_name: string },
  initialQuestions: { title: string; value: string }[] | undefined,
  answer: string | undefined
) {
  let cq = initialQuestions;
  const tried = new Set((cq ?? []).map((q) => q.title));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await addRegistrant(webinarId, { ...base, custom_questions: cq });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const m = msg.match(/required in custom_questions:\s*(.*?)\.?"\s*\}/);
      if (!m || tried.has(m[1])) throw err;
      tried.add(m[1]);
      cq = [...(cq ?? []), { title: m[1], value: answer?.trim() || "-" }];
    }
  }
  return addRegistrant(webinarId, { ...base, custom_questions: cq });
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
    // Zoom REJECTS blank last names (code 300, verified 2026-08-18 — empty
    // and " " both fail), so the "-" placeholder is mandatory when unknown.
    const result = await addRegistrantWithRequiredQuestions(
      webinarId,
      { email, first_name: firstName || "-", last_name: lastName?.trim() || "-" },
      questionTitle && answer ? [{ title: questionTitle, value: answer }] : undefined,
      answer
    );
    joinUrl = result.join_url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Already-registered is a success path in Zoom's model; surface as duplicate.
    // Same for Zoom's per-registrant daily cap (3 add-registrant calls per email
    // per day): hitting it means this person already registered today — show
    // them success, not an error (bit Blake while re-testing, 2026-08-18).
    if (/already|3009|exist/i.test(msg) || /daily rate limit.*for the registrant/i.test(msg)) {
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
        { email, firstName, joinUrl: joinUrl! }
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
