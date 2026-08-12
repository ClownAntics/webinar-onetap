import RegistrationClient from "./registration-client";
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

  return (
    <RegistrationClient
      webinarId={webinarId}
      email={get("e") ?? ""}
      firstName={get("fn") ?? ""}
      lastName={get("ln") ?? ""}
      source={(get("src") as "sms" | "email" | "social") ?? "sms"}
      config={config}
      registrationUrl={registrationUrl}
      preview={get("preview") === "1"}
    />
  );
}
