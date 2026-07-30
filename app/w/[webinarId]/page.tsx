import RegistrationClient from "./registration-client";
import { appSupabase } from "@/lib/supabase";
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

  const config = await loadConfig(webinarId);

  return (
    <RegistrationClient
      webinarId={webinarId}
      email={get("e") ?? ""}
      firstName={get("fn") ?? ""}
      lastName={get("ln") ?? ""}
      source={(get("src") as "sms" | "email" | "social") ?? "sms"}
      config={config}
    />
  );
}
