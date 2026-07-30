import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Only run on admin surfaces (keeps public /w and /api/register untouched).
export const config = {
  matcher: ["/admin/:path*", "/auth/:path*", "/api/admin/:path*", "/api/reporting/:path*"],
};
