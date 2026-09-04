import { createHash } from "crypto";

/**
 * A/B bucketing (SPEC-v2 §6b).
 *
 * Omnisend segments are rule-based, not random, so the app assigns the bucket
 * itself: a stable hash of the email, written to contacts as `ab_bucket` and
 * matched by two segments Yumer builds once ("... and ab_bucket = A" / "= B").
 *
 * Stable rather than per-test random, deliberately: the same person always
 * lands in the same arm, so results stay comparable across webinars and a
 * biased bucket is detectable instead of being reshuffled into the noise.
 */
export type Bucket = "A" | "B";

export function bucketFor(email: string): Bucket {
  const norm = email.trim().toLowerCase();
  // First byte of the digest — uniform enough for a 50/50 split.
  const byte = createHash("sha256").update(norm).digest()[0];
  return byte % 2 === 0 ? "A" : "B";
}

/**
 * Split a list of registrant emails by bucket. Used to attribute REGISTRATIONS
 * to each arm — the only honest score for an SMS test, since Omnisend's SMS
 * click counts are ~8x inflated by carrier link scanners.
 */
export function splitByBucket(emails: string[]): Record<Bucket, number> {
  const out: Record<Bucket, number> = { A: 0, B: 0 };
  for (const e of emails) out[bucketFor(e)]++;
  return out;
}

/** Candidate ET hours offered when a send is opted into a send_time test. */
export const TIME_CHOICES = [7, 9, 11, 13, 15, 17, 19] as const;


/**
 * Counterbalancing: which bucket receives which arm, per send.
 *
 * `ab_bucket` is stable per person, so without this bucket A would get the
 * earlier slot on EVERY send — and running time tests on all four emails would
 * measure "people who got everything early" rather than four independent
 * results. Flipping the mapping on half the sends decorrelates them, and costs
 * nothing: no extra property, no extra segment.
 *
 * Deterministic, so a send always keeps the same orientation and results stay
 * comparable across webinars.
 */
const FLIPPED_SENDS = new Set(["fri_email", "dayof_sms_reg", "recap_returning"]);

export function bucketForArm(sendKey: string, arm: "A" | "B"): Bucket {
  const flip = FLIPPED_SENDS.has(sendKey);
  if (arm === "A") return flip ? "B" : "A";
  return flip ? "A" : "B";
}

/** Attribute a registrant to the arm they were actually in, for scoring. */
export function armFor(sendKey: string, email: string): "A" | "B" {
  const bucket = bucketFor(email);
  return bucketForArm(sendKey, "A") === bucket ? "A" : "B";
}


/**
 * What an experiment arm produced. Ordered by how much each metric is worth
 * trusting:
 *
 *   revenue       — the point of the exercise. 7-day attributed sales.
 *   registrations — the app's own record, unaffected by bot inflation.
 *   attendees     — showing up, from Zoom's report.
 *   opened/clicked— Omnisend's numbers; on SMS these are ~8x inflated by
 *                   carrier link scanners, so they are context, not a score.
 */
export interface ArmResult {
  arm: "A" | "B";
  sent: number | null;
  registrations: number;
  attendees: number;
  revenue: number;
  opened: number | null;
  clicked: number | null;
}

/** Percentage lift of B over A on a metric; null when A is zero. */
export function lift(a: number, b: number): number | null {
  if (!a) return null;
  return ((b - a) / a) * 100;
}
