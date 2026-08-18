import { env } from "./env";
import type { Brand } from "./brands";

/**
 * Omnisend client (API v5) — per-brand accounts (SPEC-omnisend-sms.md).
 * FacePaint + Clownantics have keys; CareerLearning no-ops.
 *
 * Data model (agreed 2026-08-17): custom EVENTS for history + flow triggers,
 * rolling contact PROPERTIES for state, one permanent tag. NOT per-webinar tags.
 *   events:     "webinar registered", "webinar attended", "webinar starting"
 *   properties: lastWebinarRegistered, lastWebinarAttended, webinarsAttendedCount
 *   tag:        webinar-audience
 */

const API = "https://api.omnisend.com/v5";

function keyFor(brand: Brand | string | null | undefined): string | undefined {
  return env.omnisend.keys[(brand as string) ?? "facepaint"];
}

/** Whether this brand has an Omnisend account wired (CareerLearning doesn't). */
export function hasOmnisend(brand: Brand | string | null | undefined): boolean {
  return !!keyFor(brand);
}

async function omnisend(apiKey: string, path: string, body: unknown): Promise<boolean> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(`[omnisend] ${path} -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return false;
  }
  return true;
}

export interface WebinarEventInfo {
  webinarId: string;
  topic: string;
  /** ISO start time of the webinar. */
  startTime: string | null;
  brand: Brand;
}

/** Upsert the contact (email subscribed per landing-page disclosure). */
async function upsertContact(
  apiKey: string,
  email: string,
  firstName: string | undefined,
  properties: Record<string, unknown>
): Promise<boolean> {
  return omnisend(apiKey, "/contacts", {
    identifiers: [
      { type: "email", id: email, channels: { email: { status: "subscribed", statusDate: new Date().toISOString() } } },
    ],
    ...(firstName ? { firstName } : {}),
    tags: ["webinar-audience"],
    customProperties: properties,
  });
}

async function fireEvent(
  apiKey: string,
  eventName: string,
  email: string,
  properties: Record<string, unknown>
): Promise<boolean> {
  return omnisend(apiKey, "/events", {
    eventName,
    origin: "api",
    contact: { email },
    properties,
  });
}

/** Registration: contact upsert + "webinar registered" event. */
export async function pushRegistration(
  w: WebinarEventInfo,
  contact: { email: string; firstName?: string }
): Promise<boolean> {
  const apiKey = keyFor(w.brand);
  if (!apiKey) return false; // brand without Omnisend (or key unset) — silent no-op
  const day = (w.startTime ?? "").slice(0, 10);
  const ok = await upsertContact(apiKey, contact.email, contact.firstName, {
    lastWebinarRegistered: day,
  });
  const ev = await fireEvent(apiKey, "webinar registered", contact.email, {
    webinarId: w.webinarId,
    topic: w.topic,
    webinarDate: day,
    brand: w.brand,
  });
  return ok && ev;
}

/** Post-webinar: "webinar attended" event + rolling attended props. */
export async function pushAttended(
  w: WebinarEventInfo,
  contact: { email: string; attendedCount: number }
): Promise<boolean> {
  const apiKey = keyFor(w.brand);
  if (!apiKey) return false;
  const day = (w.startTime ?? "").slice(0, 10);
  const ok = await upsertContact(apiKey, contact.email, undefined, {
    lastWebinarAttended: day,
    webinarsAttendedCount: contact.attendedCount,
  });
  const ev = await fireEvent(apiKey, "webinar attended", contact.email, {
    webinarId: w.webinarId,
    topic: w.topic,
    webinarDate: day,
    brand: w.brand,
  });
  return ok && ev;
}

/** Opt-out: unsubscribe the email in every configured brand account. */
export async function markOptedOut(email: string): Promise<void> {
  for (const apiKey of Object.values(env.omnisend.keys)) {
    if (!apiKey) continue;
    await omnisend(apiKey, "/contacts", {
      identifiers: [
        { type: "email", id: email, channels: { email: { status: "unsubscribed", statusDate: new Date().toISOString() } } },
      ],
      tags: ["webinar-optout"],
    });
  }
}

/** T-15: "webinar starting" event with the personal join link (SMS flow trigger). */
export async function pushStarting(
  w: WebinarEventInfo,
  contact: { email: string; joinUrl: string }
): Promise<boolean> {
  const apiKey = keyFor(w.brand);
  if (!apiKey) return false;
  return fireEvent(apiKey, "webinar starting", contact.email, {
    webinarId: w.webinarId,
    topic: w.topic,
    startTime: w.startTime ?? "",
    joinUrl: contact.joinUrl,
    brand: w.brand,
  });
}
