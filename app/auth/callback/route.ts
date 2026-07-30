import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * OAuth callback. Exchanges the code for a session (sets cookies), then
 * redirects to `next` (default /admin). Add this URL to Supabase Auth →
 * URL Configuration → Redirect URLs.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/admin";

  if (code) {
    try {
      const supabase = await createSupabaseServer();
      await supabase.auth.exchangeCodeForSession(code);
    } catch {
      return NextResponse.redirect(new URL("/admin?auth=error", url.origin));
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
