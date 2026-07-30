import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { passcode } = (await req.json().catch(() => ({}))) as { passcode?: string };

  if (!env.adminPasscode) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_PASSCODE not set" },
      { status: 500 }
    );
  }
  if (passcode !== env.adminPasscode) {
    return NextResponse.json({ ok: false, error: "Wrong passcode" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_ok", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8h
  });
  return res;
}
