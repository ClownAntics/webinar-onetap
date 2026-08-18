import { NextRequest, NextResponse } from "next/server";
import { appSupabase } from "@/lib/supabase";
import { markOptedOut } from "@/lib/omnisend";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  if (!email) return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });

  try {
    await appSupabase().from("webinar_optouts").insert({ email });
  } catch {
    /* scaffold: Supabase optional */
  }
  try {
    await markOptedOut(email);
  } catch {
    /* ignore */
  }

  return NextResponse.json({ ok: true });
}
