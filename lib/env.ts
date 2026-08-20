/**
 * Centralized env access. Server-only values must never be imported into a
 * client component. `optional()` lets the app boot in a half-configured state
 * during scaffolding so pages render without every integration wired up.
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  zoom: {
    accountId: optional("ZOOM_ACCOUNT_ID"),
    clientId: optional("ZOOM_CLIENT_ID"),
    clientSecret: optional("ZOOM_CLIENT_SECRET"),
    hostUserId: optional("ZOOM_HOST_USER_ID") ?? "service@facepaint.com",
  },
  supabase: {
    url: optional("SUPABASE_URL"),
    serviceKey: optional("SUPABASE_SERVICE_KEY"),
  },
  // Public Supabase creds for Auth (Google sign-in). Safe to expose to the browser.
  publicSupabase: {
    url: optional("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: optional("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  },
  // Employees are gated by email domain (Google Workspace).
  allowedDomains: (optional("ADMIN_ALLOWED_DOMAINS") ?? "clownantics.com,facepaint.com,careerlearning.com")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
  sales: {
    url: optional("SALES_SUPABASE_URL"),
    key: optional("SALES_SUPABASE_KEY"),
  },
  omnisend: {
    apiKey: optional("OMNISEND_API_KEY"), // legacy single-key (unused)
    // Per-brand accounts. CareerLearning has none (their email is on Fresh).
    keys: {
      facepaint: optional("OMNISEND_API_KEY_FACEPAINT"),
      clownantics: optional("OMNISEND_API_KEY_CLOWNANTICS"),
      careerlearning: undefined,
    } as Record<string, string | undefined>,
  },
  siteUrl: optional("NEXT_PUBLIC_SITE_URL") ?? "https://webinars.facepaint.com",
  // Bearer token for the cron + history endpoints. Vercel's scheduler sends
  // "Authorization: Bearer <CRON_SECRET>" automatically when this env var is
  // set. Unset (local dev) => the check is skipped.
  cronSecret: optional("CRON_SECRET"),
};

export { required };
