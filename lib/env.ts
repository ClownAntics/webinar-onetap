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
  sales: {
    url: optional("SALES_SUPABASE_URL"),
    key: optional("SALES_SUPABASE_KEY"),
  },
  omnisend: {
    apiKey: optional("OMNISEND_API_KEY"),
  },
  adminPasscode: optional("ADMIN_PASSCODE"),
  siteUrl: optional("NEXT_PUBLIC_SITE_URL") ?? "https://webinars.facepaint.com",
};

export { required };
