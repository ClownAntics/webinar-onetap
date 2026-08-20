import RegistrationClient from "./registration-client";
import { cookies } from "next/headers";
import { appSupabase } from "@/lib/supabase";
import { getWebinar } from "@/lib/zoom";
import type { WebinarConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadConfig(webinarId: string): Promise<WebinarConfig | null> {
  try {
    const sb = appSupabase();
    const { data } = await sb
      .from("webinar_config")
      .select("*")
      .eq("webinar_id", webinarId)
      .maybeSingle();
    return (data as WebinarConfig) ?? null;
  } catch {
    // Supabase not configured yet — let the client render a preview.
    return null;
  }
}

/**
 * The webinar's native Zoom registration URL — the safety net. If the one-tap
 * API register fails (e.g. the write scope isn't enabled yet), the page sends
 * the user here so it's never a dead end.
 */
async function loadRegistrationUrl(webinarId: string): Promise<string | undefined> {
  try {
    const w = await getWebinar(webinarId);
    return w?.registration_url;
  } catch {
    return undefined;
  }
}

/**
 * Sanitize ?src= into a stats channel. Free-form (Yumer/Aubrey pick their own
 * labels) but bounded. Missing src is "direct" — NOT "sms", which used to
 * silently inflate the SMS numbers for any link posted without a tag.
 */
function normalizeSource(raw?: string): string {
  const s = (raw ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 20);
  return s || "direct";
}

/**
 * Returning-registrant cookie (set client-side after a successful
 * registration). Lets a past registrant get the one-tap experience from the
 * plain website/social link, where the URL carries no identity. URL params
 * always win — a personalized email/SMS link behaves exactly as before.
 */
async function readIdentityCookie(): Promise<{ e: string; fn: string; ln: string } | null> {
  try {
    const raw = (await cookies()).get("onetap_identity")?.value;
    if (!raw) return null;
    const v = JSON.parse(decodeURIComponent(raw)) as { e?: string; fn?: string; ln?: string };
    if (typeof v.e !== "string" || !v.e.includes("@")) return null;
    return { e: v.e, fn: typeof v.fn === "string" ? v.fn : "", ln: typeof v.ln === "string" ? v.ln : "" };
  } catch {
    return null; // malformed cookie — fall back to the form
  }
}

export default async function WebinarLanding({
  params,
  searchParams,
}: {
  params: Promise<{ webinarId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { webinarId } = await params;
  const sp = await searchParams;

  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;

  const [config, registrationUrl] = await Promise.all([
    loadConfig(webinarId),
    loadRegistrationUrl(webinarId),
  ]);

  const cookieId = get("e") ? null : await readIdentityCookie();

  return (
    <RegistrationClient
      webinarId={webinarId}
      email={get("e") ?? cookieId?.e ?? ""}
      firstName={get("fn") ?? cookieId?.fn ?? ""}
      lastName={get("ln") ?? cookieId?.ln ?? ""}
      source={normalizeSource(get("src"))}
      config={config}
      registrationUrl={registrationUrl}
      preview={get("preview") === "1"}
      previewBrand={get("brand")}
    />
  );
}
