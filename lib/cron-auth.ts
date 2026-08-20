import { env } from "@/lib/env";

/**
 * Guard for machine-invoked endpoints (/api/cron, /api/zoom-history). They
 * are idempotent, but an anonymous caller can still burn the Zoom rate limit,
 * so when CRON_SECRET is set the request must carry it as a bearer token —
 * the exact header Vercel's cron scheduler sends automatically. Unset
 * (local dev / scaffold) => open, matching the optional-env convention.
 */
export function cronAuthorized(req: Request): boolean {
  if (!env.cronSecret) return true;
  return req.headers.get("authorization") === `Bearer ${env.cronSecret}`;
}
