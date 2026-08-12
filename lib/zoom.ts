import { env } from "./env";

/**
 * Zoom Server-to-Server OAuth. Token is account-scoped and cached ~55 min.
 * All webinars live under one shared host account (env.zoom.hostUserId).
 */

interface CachedToken {
  token: string;
  expiresAt: number;
}
let cached: CachedToken | null = null;

export async function getZoomToken(): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt > now + 60_000) return cached.token;

  const { accountId, clientId, clientSecret } = env.zoom;
  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom credentials not configured");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Zoom token error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}

async function zoomFetch(path: string, init?: RequestInit) {
  const token = await getZoomToken();
  return fetch(`https://api.zoom.us/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

export interface ZoomWebinar {
  id: string;
  topic: string;
  agenda?: string; // the description shown on the Zoom registration page
  start_time: string;
  duration: number;
  registration_url?: string;
}

/**
 * Best-effort: pull the banner image off the public registration page (Zoom's
 * API doesn't expose the branding banner URL). Tries og:image first, then a
 * banner-ish image. Returns undefined if nothing plausible is found.
 */
export async function fetchWebinarBanner(registrationUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(registrationUrl, { cache: "no-store" });
    if (!res.ok) return undefined;
    const html = await res.text();
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (og?.[1] && /^https?:\/\//.test(og[1])) return og[1];
    const banner = html.match(/https:\/\/[^"'\s]+(?:banner|brand)[^"'\s]*\.(?:png|jpe?g|webp)/i);
    return banner?.[0];
  } catch {
    return undefined;
  }
}

/** List webinars for the shared host account. */
export async function listWebinars(
  type: "upcoming" | "past" = "upcoming"
): Promise<ZoomWebinar[]> {
  const res = await zoomFetch(
    `/users/${encodeURIComponent(env.zoom.hostUserId)}/webinars?type=${type}&page_size=100`
  );
  if (!res.ok) throw new Error(`listWebinars ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { webinars?: ZoomWebinar[] };
  return data.webinars ?? [];
}

/** Fetch a single webinar's details (topic, times, native registration_url). */
export async function getWebinar(webinarId: string): Promise<ZoomWebinar | null> {
  const res = await zoomFetch(`/webinars/${webinarId}`);
  if (!res.ok) return null;
  return (await res.json()) as ZoomWebinar;
}

/** Fetch the webinar's custom-question titles (to map the admin question). */
export async function getRegistrantQuestions(webinarId: string): Promise<string[]> {
  const res = await zoomFetch(`/webinars/${webinarId}/registrants/questions`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    custom_questions?: { title: string }[];
  };
  return (data.custom_questions ?? []).map((q) => q.title);
}

export interface ZoomRegistrant {
  email: string;
  first_name?: string;
  last_name?: string;
}

/** All registrants for a webinar (paginated). */
export async function fetchRegistrants(webinarId: string): Promise<ZoomRegistrant[]> {
  const out: ZoomRegistrant[] = [];
  let next = "";
  do {
    const res = await zoomFetch(
      `/webinars/${webinarId}/registrants?page_size=300${next ? `&next_page_token=${next}` : ""}`
    );
    if (!res.ok) throw new Error(`fetchRegistrants ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      registrants?: ZoomRegistrant[];
      next_page_token?: string;
    };
    out.push(...(data.registrants ?? []));
    next = data.next_page_token ?? "";
  } while (next);
  return out;
}

export interface ZoomParticipant {
  user_email?: string;
  name?: string;
  duration?: number; // seconds
}

/** Participant report for a past webinar (paginated). Requires report:read scope. */
export async function fetchParticipants(webinarId: string): Promise<ZoomParticipant[]> {
  const out: ZoomParticipant[] = [];
  let next = "";
  do {
    const res = await zoomFetch(
      `/report/webinars/${webinarId}/participants?page_size=300${next ? `&next_page_token=${next}` : ""}`
    );
    if (!res.ok) throw new Error(`fetchParticipants ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      participants?: ZoomParticipant[];
      next_page_token?: string;
    };
    out.push(...(data.participants ?? []));
    next = data.next_page_token ?? "";
  } while (next);
  return out;
}

export interface AddRegistrantResult {
  registrant_id: string;
  join_url: string;
}

/** Register someone for a webinar. Returns their personal join_url. */
export async function addRegistrant(
  webinarId: string,
  input: {
    email: string;
    first_name: string;
    last_name: string;
    custom_questions?: { title: string; value: string }[];
  }
): Promise<AddRegistrantResult> {
  const res = await zoomFetch(`/webinars/${webinarId}/registrants`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`addRegistrant ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as AddRegistrantResult;
}
