import type { WebinarStatus } from "./types";

/**
 * Webinar status lifecycle (README-build-v3.md §3). Mix of auto + manual
 * transitions. Status is stored on webinar_config; auto rules are (re)applied
 * on save and can be layered for display via autoAdjust().
 */

export const ANSWERS_THRESHOLD = 10;

export interface StatusMeta {
  label: string;
  fg: string;
  bg: string;
  hint: string;
  tone: "red" | "amber" | "gray" | "green" | "dark";
}

export const STATUS_META: Record<WebinarStatus, StatusMeta> = {
  NEEDS_SETUP: { label: "NEEDS SETUP", fg: "#B41F24", bg: "#FBE3E4", tone: "red", hint: "Set up this webinar to go live." },
  AWAITING_ANSWERS: { label: "AWAITING ANSWERS", fg: "#666767", bg: "#E9E9EB", tone: "gray", hint: "Invites out — answers accumulating." },
  EMAIL_ARTIST: { label: "EMAIL ARTIST", fg: "#8a6d00", bg: "#FFF3C4", tone: "amber", hint: "Enough answers — send the wishlist to the presenter." },
  AWAITING_ARTIST: { label: "AWAITING ARTIST", fg: "#666767", bg: "#E9E9EB", tone: "gray", hint: "Waiting on design confirmation." },
  NEEDS_AGENDA: { label: "NEEDS AGENDA", fg: "#8a6d00", bg: "#FFF3C4", tone: "amber", hint: "Designs confirmed — paste the agenda." },
  READY: { label: "READY", fg: "#3c7d2b", bg: "#E8F5E1", tone: "green", hint: "All set — automations armed." },
  AWAITING_BLOG_POST: { label: "AWAITING BLOG POST", fg: "#8a6d00", bg: "#FFF3C4", tone: "amber", hint: "Webinar done — create the blog post, paste the replay URL." },
  COMPLETE: { label: "COMPLETE", fg: "#ffffff", bg: "#2F5D22", tone: "dark", hint: "Post-webinar sends fired." },
};

export interface StatusSignals {
  hasSetup: boolean; // display title + question set
  agendaFilled: boolean;
  replayNewlySet: boolean; // empty -> set this save
  endPassed: boolean;
  answersCount: number;
}

/** Layer time/answer auto-rules on top of a stored status (idempotent). */
export function autoAdjust(
  current: WebinarStatus,
  ctx: { answersCount: number; endPassed: boolean }
): WebinarStatus {
  if (ctx.endPassed && current === "READY") return "AWAITING_BLOG_POST";
  if (!ctx.endPassed && current === "AWAITING_ANSWERS" && ctx.answersCount >= ANSWERS_THRESHOLD) {
    return "EMAIL_ARTIST";
  }
  return current;
}

const AGENDA_ADVANCEABLE: WebinarStatus[] = [
  "AWAITING_ANSWERS",
  "EMAIL_ARTIST",
  "AWAITING_ARTIST",
  "NEEDS_AGENDA",
];

/** Compute the next status when the setup form is saved. */
export function nextStatusOnSave(current: WebinarStatus, s: StatusSignals): WebinarStatus {
  // Replay save is the terminal trigger.
  if (s.replayNewlySet && s.endPassed) return "COMPLETE";

  let next = current;
  if (current === "NEEDS_SETUP" && s.hasSetup) next = "AWAITING_ANSWERS";
  if (s.agendaFilled && AGENDA_ADVANCEABLE.includes(next)) next = "READY";
  return autoAdjust(next, { answersCount: s.answersCount, endPassed: s.endPassed });
}

/**
 * A webinar "needs your attention" only if it's red/amber AND still actionable.
 * A never-configured webinar whose date has passed is not actionable.
 */
export function isActionable(status: WebinarStatus, isPast: boolean): boolean {
  const tone = STATUS_META[status].tone;
  if (!["red", "amber"].includes(tone)) return false;
  if (status === "NEEDS_SETUP" && isPast) return false;
  return true;
}

export type ManualAction = "emailed_artist" | "designs_received";

/** Manual small-button transitions. */
export function nextStatusOnManual(current: WebinarStatus, action: ManualAction): WebinarStatus {
  if (action === "emailed_artist" && (current === "AWAITING_ANSWERS" || current === "EMAIL_ARTIST")) {
    return "AWAITING_ARTIST";
  }
  if (action === "designs_received" && current === "AWAITING_ARTIST") {
    return "NEEDS_AGENDA";
  }
  return current;
}
