/**
 * Direct-message rules: who may open a thread, what one costs, and how fast a creator answers.
 *
 * Pure, like `slurp-wallet.ts` and `slurp-rapport.ts`, so the gate and the pacing can be tested
 * without an Engine checkout. Nothing here reads the DB or the clock beyond what it is handed.
 */
import { readSlurpRapportWeights, type SlurpRapport, type SlurpRapportWeights } from "./slurp-rapport.js";

/** Storage key for the per-creator messaging settings blob. Mirrors the creator-prices key. */
export const SLURP_CREATOR_MESSAGING_KEY = "slurp.creator.messaging";

export type SlurpDmPolicy =
  /** Anyone may write, and the thread opens immediately. */
  | "open"
  /** Non-subscribers land in the request tray. Subscribers write straight through. */
  | "subscribers"
  /** Non-subscribers may buy their way past the tray by paying the request fee. */
  | "paid"
  /** Nobody new may open a thread. Existing active threads keep working. */
  | "closed";

export const SLURP_DM_POLICIES: readonly SlurpDmPolicy[] = ["open", "subscribers", "paid", "closed"];

export type SlurpCreatorMessaging = {
  dmPolicy: SlurpDmPolicy;
  /** Coins a non-subscriber pays to skip the request tray under the `paid` policy. */
  requestFee: number;
  /** Default price the creator puts on a locked message. */
  ppvPrice: number;
  rapportWeights: SlurpRapportWeights;
};

export const SLURP_DEFAULT_CREATOR_MESSAGING: SlurpCreatorMessaging = {
  dmPolicy: "subscribers",
  requestFee: 5,
  ppvPrice: 8,
  rapportWeights: readSlurpRapportWeights(undefined),
};

export function readSlurpCreatorMessaging(value: unknown): SlurpCreatorMessaging {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const coins = (input: unknown, fallback: number) =>
    typeof input === "number" && Number.isInteger(input) && input >= 0 && input <= 9999 ? input : fallback;
  return {
    dmPolicy: SLURP_DM_POLICIES.includes(raw.dmPolicy as SlurpDmPolicy)
      ? (raw.dmPolicy as SlurpDmPolicy)
      : SLURP_DEFAULT_CREATOR_MESSAGING.dmPolicy,
    requestFee: coins(raw.requestFee, SLURP_DEFAULT_CREATOR_MESSAGING.requestFee),
    ppvPrice: coins(raw.ppvPrice, SLURP_DEFAULT_CREATOR_MESSAGING.ppvPrice),
    rapportWeights: readSlurpRapportWeights(raw.rapportWeights),
  };
}

export type SlurpThreadState = "request" | "active" | "declined";

export type SlurpMessageKind =
  | "text"
  | "tip"
  | "ppv"
  | "system"
  | "broadcast"
  | "post_preview"
  | "commission_brief"
  | "commission_quote"
  | "commission_delivery";

/**
 * What happens when a viewer writes to a creator they have no active thread with.
 *
 * `fee` is charged before the thread opens, so an unaffordable fee is refused rather than
 * silently opening a free thread — the whole point of the paid policy.
 */
export type SlurpThreadAdmission =
  { allowed: true; state: SlurpThreadState; fee: number } | { allowed: false; reason: "closed" };

export function admitSlurpThread(
  messaging: SlurpCreatorMessaging,
  context: { subscribed: boolean; existingState: SlurpThreadState | null },
): SlurpThreadAdmission {
  // An open thread stays open. A policy change must never strand a conversation already running,
  // and a declined thread must never reopen itself just because the viewer subscribed.
  if (context.existingState === "active") return { allowed: true, state: "active", fee: 0 };
  if (context.existingState === "declined") return { allowed: false, reason: "closed" };
  if (context.subscribed) return { allowed: true, state: "active", fee: 0 };
  switch (messaging.dmPolicy) {
    case "open":
      return { allowed: true, state: "active", fee: 0 };
    case "subscribers":
      return { allowed: true, state: "request", fee: 0 };
    case "paid":
      return { allowed: true, state: "active", fee: messaging.requestFee };
    case "closed":
      return { allowed: false, reason: "closed" };
  }
}

/**
 * How long before the creator answers, in milliseconds.
 *
 * Online means near-instant: the reply is generated on send and only held behind the typing
 * indicator. Offline means queued, but rapport and a paid subscription buy an answer anyway —
 * a whale who writes at 3am is exactly the fan a creator picks the phone up for.
 */
export type SlurpReplyPacing = {
  mode: "instant" | "queued";
  /** Milliseconds to hold an instant reply behind the typing indicator. */
  typingMs: number;
  /** When queued, the earliest the scheduler may generate. */
  notBeforeMs: number;
};

const MINUTE = 60_000;

export function slurpReplyPacing(input: {
  online: boolean;
  rapport: SlurpRapport;
  subscribed: boolean;
  /** Characters the viewer wrote. A one-word poke does not earn a considered reply. */
  messageLength: number;
  /** Minutes until the creator's schedule brings them back, when it is known. */
  minutesUntilOnline: number | null;
  /**
   * Conversation mood, -100 to 100. See `slurp-mood.ts`.
   *
   * A mood that only changes word choice is a number. A mood that changes how fast somebody
   * answers is a person: being kept waiting is how annoyance actually reads in a chat, long
   * before the words arrive.
   */
  mood?: number;
}): SlurpReplyPacing {
  const mood = Math.max(-100, Math.min(100, input.mood ?? 0));
  // -0.4 when delighted, +0.6 when cold. Multiplies every wait in both branches.
  const drag = mood >= 0 ? 1 - (mood / 100) * 0.4 : 1 + (-mood / 100) * 0.6;
  const considered = Math.min(1, input.messageLength / 200);
  if (input.online) {
    // 1.2s to 4s before the mood is applied. Long enough to read as typing, short enough that
    // nobody waits on it.
    return { mode: "instant", typingMs: Math.round((1200 + considered * 2800) * drag), notBeforeMs: 0 };
  }
  // Off-hours reach: a stranger waits for the schedule, a whale gets an answer in minutes. A warm
  // conversation reaches further, and a bad one does not get answered at midnight at all.
  const reach = Math.min(1, Math.max(0, input.rapport.score / 100 + (input.subscribed ? 0.2 : 0) + mood / 400));
  if (reach >= 0.55) {
    return { mode: "instant", typingMs: Math.round((2000 + (1 - reach) * 6000) * drag), notBeforeMs: 0 };
  }
  const scheduled = input.minutesUntilOnline === null ? 90 : Math.max(2, input.minutesUntilOnline);
  // Warmth shortens the wait without ever erasing it, so the schedule still means something.
  return { mode: "queued", typingMs: 0, notBeforeMs: Math.round(scheduled * MINUTE * (1 - reach * 0.7) * drag) };
}

/**
 * Break one reply into the two or three messages a person would actually have sent.
 *
 * Nobody texts in paragraphs. They send a thought, then a correction, then an afterthought, and a
 * creator who always answers in exactly one tidy block reads as a form letter however good the
 * words are. This is the cheapest authenticity available: no model call, no extra tokens.
 *
 * Only when the conversation is going well. Somebody being short with you does not send three
 * messages, so a curt stance returns the reply whole and the shape itself carries the mood.
 */
export function splitSlurpReplyBurst(content: string, allow: boolean, limit = 3): string[] {
  const trimmed = content.trim();
  if (!allow || trimmed.length < 90) return [trimmed];
  // Split on sentence ends only. Splitting mid-clause produces two fragments rather than two
  // messages, which reads worse than the paragraph it replaced.
  const parts = trimmed.match(/[^.!?\n]+[.!?]*[\n]*/g)?.map((part) => part.trim()) ?? [];
  const sentences = parts.filter(Boolean);
  if (sentences.length < 2) return [trimmed];
  // Pack into at most `limit` bubbles, keeping them roughly even so one is not a single word.
  const target = Math.min(limit, Math.max(2, Math.round(sentences.length / 2)));
  const perBubble = Math.ceil(sentences.length / target);
  const bubbles: string[] = [];
  for (let index = 0; index < sentences.length; index += perBubble) {
    bubbles.push(sentences.slice(index, index + perBubble).join(" "));
  }
  return bubbles.filter(Boolean);
}

/** Delay between bubbles. It is deterministic and capped so a restart cannot extend the burst. */
export function slurpReplyBubbleDelayMs(input: { bubbleIndex: number; bubbleCount: number }): number {
  const index = Math.max(1, Math.trunc(input.bubbleIndex));
  const count = Math.max(2, Math.trunc(input.bubbleCount));
  return Math.min(8_000, 1_500 + Math.round((index / count) * 1_500));
}

/**
 * How long a character Creator takes to finish a commissioned piece, in milliseconds.
 *
 * The picture is drawn before the fan is charged, so this delay buys nothing technically — it is
 * the whole product. A commission that lands in the same second as the payment is a vending
 * machine, and the wait is what makes it work somebody did for you.
 *
 * Pure and deterministic, like `slurpReplyPacing`: a bigger commission and a longer brief read as
 * more work. Never instant, and never long enough that the player forgets they ordered it.
 */
export function slurpCommissionDeliveryDelayMs(input: { price: number; briefLength: number }): number {
  const effort = Math.min(1, Math.max(0, input.price) / 200) * 0.7 + Math.min(1, input.briefLength / 600) * 0.3;
  return Math.round(5 * MINUTE + effort * (45 * MINUTE - 5 * MINUTE));
}

/** One line of thread summary for the inbox. Kept short: the list shows it on one row. */
export function slurpMessagePreview(kind: SlurpMessageKind, content: string, price: number): string {
  const trimmed = content.replace(/\s+/g, " ").trim();
  if (kind === "tip") return `Tipped ${price} coins`;
  // Never the content: the preview is shown in the inbox before the fan has paid, so quoting the
  // first line of a locked message hands over exactly what was being sold.
  if (kind === "ppv") return "Sent locked content";
  if (kind === "commission_brief") return `Commission request: ${clamp(trimmed, 50)}`;
  if (kind === "commission_quote") return `Quoted ${price} coins`;
  if (kind === "commission_delivery") return "Delivered a commission";
  if (kind === "post_preview") return "Shared a post";
  return clamp(trimmed, 80);
}

const clamp = (value: string, limit: number) => (value.length <= limit ? value : `${value.slice(0, limit - 1)}…`);
