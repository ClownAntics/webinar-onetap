import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }
  return NextResponse.redirect(new URL("/admin", new URL(req.url).origin), { status: 303 });
}
