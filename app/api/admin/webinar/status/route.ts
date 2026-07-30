import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appSupabase } from "@/lib/supabase";
import { nextStatusOnManual, type ManualAction } from "@/lib/status";
import type { WebinarStatus } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if ((await cookies()).get("admin_ok")?.value !== "1") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { webinarId, action } = (await req.json().catch(() => ({}))) as {
    webinarId?: string;
    action?: ManualAction;
  };
  if (!webinarId || (action !== "emailed_artist" && action !== "designs_received")) {
    return NextResponse.json({ error: "webinarId + valid action required" }, { status: 400 });
  }

  const sb = appSupabase();
  const { data: cfg } = await sb
    .from("webinar_config")
    .select("status")
    .eq("webinar_id", webinarId)
    .maybeSingle<{ status: WebinarStatus }>();

  const current: WebinarStatus = cfg?.status ?? "NEEDS_SETUP";
  const next = nextStatusOnManual(current, action);

  if (next !== current) {
    const { error } = await sb
      .from("webinar_config")
      .update({ status: next })
      .eq("webinar_id", webinarId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: next });
}
