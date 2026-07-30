import { env } from "./env";

/**
 * Minimal Omnisend client. Events drive Yumer's 5 automations
 * (README-build-v3.md §5). No-ops (with a warning) when unconfigured so the
 * scaffold runs without an API key.
 */
type OmnisendEvent =
  | "webinar_registered"
  | "webinar_tease_due"
  | "webinar_reminder_due"
  | "webinar_attended"
  | "webinar_noshow";

const API = "https://api.omnisend.com/v5";

async function omnisend(path: string, body: unknown) {
  if (!env.omnisend.apiKey) {
    console.warn(`[omnisend] not configured — skipping ${path}`);
    return;
  }
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": env.omnisend.apiKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(`[omnisend] ${path} -> ${res.status}: ${await res.text()}`);
  }
}

/** Fire a custom event for a contact. */
export async function fireEvent(
  event: OmnisendEvent,
  email: string,
  properties: Record<string, unknown>
) {
  await omnisend("/events", {
    email,
    eventName: event,
    properties,
  });
}

/** Create/update a contact (used by the "not you?" form + register). */
export async function upsertContact(input: {
  email: string;
  firstName?: string;
  tags?: string[];
}) {
  await omnisend("/contacts", {
    identifiers: [
      { type: "email", id: input.email, channels: { email: { status: "subscribed" } } },
    ],
    firstName: input.firstName,
    tags: input.tags,
  });
}
