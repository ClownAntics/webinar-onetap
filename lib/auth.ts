import { createSupabaseServer } from "./supabase/server";
import { env } from "./env";

export type AuthReason = "ok" | "signed_out" | "not_allowed" | "unconfigured";

export interface EmployeeResult {
  email: string | null;
  reason: AuthReason;
}

/** True if the email's domain is in the allowed employee-domain list. */
export function isAllowedEmail(email?: string | null): boolean {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && env.allowedDomains.includes(domain);
}

/**
 * Resolve the current admin visitor. Returns reason:
 *  - "ok"           signed in with an allowed employee domain
 *  - "signed_out"   no session
 *  - "not_allowed"  signed in, but not an allowed domain
 *  - "unconfigured" auth env not set (scaffold / not wired yet)
 */
export async function getEmployee(): Promise<EmployeeResult> {
  let sb;
  try {
    sb = await createSupabaseServer();
  } catch {
    return { email: null, reason: "unconfigured" };
  }
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { email: null, reason: "signed_out" };
  if (!isAllowedEmail(user.email)) return { email: user.email ?? null, reason: "not_allowed" };
  return { email: user.email ?? null, reason: "ok" };
}
