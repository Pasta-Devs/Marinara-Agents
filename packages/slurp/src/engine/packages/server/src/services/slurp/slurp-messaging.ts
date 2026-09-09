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

/**
 * A creator's messaging settings, falling back to `defaults`.
 *
 * The fallback is a parameter rather than the shipped constant so Settings can move the starting
 * point for every creator nobody has configured by hand, without writing a row for each of them.
 */
export function readSlurpCreatorMessaging(
  value: unknown,
  defaults: SlurpCreatorMessaging = SLURP_DEFAULT_CREATOR_MESSAGING,
): SlurpCreatorMessaging {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const coins = (input: unknown, fallback: number) =>
    typeof input === "number" && Number.isInteger(input) && input >= 0 && input <= 9999 ? input : fallback;
  return {
    dmPolicy: SLURP_DM_POLICIES.includes(raw.dmPolicy as SlurpDmPolicy)
      ? (raw.dmPolicy as SlurpDmPolicy)
      : defaults.dmPolicy,
    requestFee: coins(raw.requestFee, defaults.requestFee),
    ppvPrice: coins(raw.ppvPrice, defaults.ppvPrice),
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
 * Now incorporates conversation momentum, check-in behavior, and realistic typing delays.
 * Subscribers get near-instant replies when online + high rapport, but delays when rapport is low.
 * Non-subscribers need higher rapport for instant replies.
 */
export type SlurpReplyPacing = {
  mode: "instant" | "delayed" | "queued";
  /** Milliseconds to hold an instant reply behind the typing indicator. */
  typingMs: number;
  /** When queued/delayed, the earliest the scheduler may generate. */
  notBeforeMs: number;
  /** Debug info for pacing panel. */
  debug?: {
    reach: number;
    moodDrag: number;
    momentumBoost: string;
    decision: string;
  };
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
  /** Conversation momentum from slurp-conversation-momentum.ts */
  momentum?: "hot" | "warm" | "cold" | "frozen";
  /** Reply content length (for realistic typing delay calculation). */
  replyLength?: number;
  /** Talkativeness 0-100 from generated schedule. */
  talkativeness?: number;
}): SlurpReplyPacing {
  const mood = Math.max(-100, Math.min(100, input.mood ?? 0));
  const momentum = input.momentum ?? "cold";
  const replyLength = input.replyLength ?? 100;
  const talkativeness = input.talkativeness ?? 50;

  // Mood drag: -0.5 when delighted, +1.0 when cold
  const moodDrag = mood > 60 ? 0.5 : mood < -20 ? 1.8 : 1.0;

  // Calculate reach: rapport + subscription bonus + mood bonus
  const reach = Math.min(1, Math.max(0, input.rapport.score / 100 + (input.subscribed ? 0.2 : 0) + mood / 400));

  // ONLINE PATH: Creator is actively available
  if (input.online) {
    // Subscribers with high rapport get near-instant replies
    if (input.subscribed && reach >= 0.7) {
      const typingMs = calculateTypingDelay(replyLength, momentum, mood, talkativeness, "instant");
      return {
        mode: "instant",
        typingMs,
        notBeforeMs: 0,
        debug: { reach, moodDrag, momentumBoost: momentum, decision: "subscriber + high rapport + online" },
      };
    }

    // Subscribers with moderate rapport get fast replies
    if (input.subscribed && reach >= 0.4) {
      const typingMs = calculateTypingDelay(replyLength, momentum, mood, talkativeness, "fast");
      return {
        mode: "instant",
        typingMs,
        notBeforeMs: 0,
        debug: { reach, moodDrag, momentumBoost: momentum, decision: "subscriber + moderate rapport + online" },
      };
    }

    // High rapport non-subscribers get decent speed
    if (reach >= 0.75) {
      const typingMs = calculateTypingDelay(replyLength, momentum, mood, talkativeness, "normal");
      return {
        mode: "instant",
        typingMs,
        notBeforeMs: 0,
        debug: { reach, moodDrag, momentumBoost: momentum, decision: "high rapport + online" },
      };
    }

    // Everyone else when online gets slower but still instant replies
    const typingMs = calculateTypingDelay(replyLength, momentum, mood, talkativeness, "slow");
    return {
      mode: "instant",
      typingMs,
      notBeforeMs: 0,
      debug: { reach, moodDrag, momentumBoost: momentum, decision: "online (baseline)" },
    };
  }

  // OFFLINE PATH: Creator is not actively available

  // Hot momentum extends availability - they're still in the conversation
  if (momentum === "hot") {
    const typingMs = calculateTypingDelay(replyLength, momentum, mood, talkativeness, "normal");
    return {
      mode: "instant",
      typingMs,
      notBeforeMs: 0,
      debug: { reach, moodDrag, momentumBoost: "hot", decision: "hot conversation extends availability" },
    };
  }

  // High reach (subscriber + good rapport) gets check-in reply
  if (reach >= 0.6) {
    // They'll check messages and reply within 10-20 minutes
    const checkInDelay = Math.round((10 + Math.random() * 10) * MINUTE * moodDrag);
    const typingMs = calculateTypingDelay(replyLength, momentum, mood, talkativeness, "fast");
    return {
      mode: "delayed",
      typingMs,
      notBeforeMs: checkInDelay,
      debug: { reach, moodDrag, momentumBoost: momentum, decision: "high rapport check-in reply" },
    };
  }

  // Medium reach gets delayed check-in reply (30-60 min)
  if (reach >= 0.4) {
    const checkInDelay = Math.round((30 + Math.random() * 30) * MINUTE * moodDrag);
    const typingMs = calculateTypingDelay(replyLength, momentum, mood, talkativeness, "normal");
    return {
      mode: "delayed",
      typingMs,
      notBeforeMs: checkInDelay,
      debug: { reach, moodDrag, momentumBoost: momentum, decision: "medium rapport check-in reply" },
    };
  }

  // Low reach waits for schedule
  const scheduled = input.minutesUntilOnline === null ? 120 : Math.max(15, input.minutesUntilOnline);
  // Reach still shortens wait a bit (max 50% reduction)
  const reduction = 1 - reach * 0.5;
  const finalDelay = Math.round(scheduled * MINUTE * reduction * moodDrag);

  // Cap at 3 hours (180 minutes) per user config
  const cappedDelay = Math.min(finalDelay, 180 * MINUTE);

  return {
    mode: "queued",
    typingMs: 0,
    notBeforeMs: cappedDelay,
    debug: { reach, moodDrag, momentumBoost: momentum, decision: "wait for schedule" },
  };
}

/**
 * Calculate realistic typing delay based on content length and context.
 *
 * Simulates: reading the message, thinking, typing, maybe revising, random distractions.
 */
function calculateTypingDelay(
  replyLength: number,
  momentum: "hot" | "warm" | "cold" | "frozen",
  mood: number,
  talkativeness: number,
  speed: "instant" | "fast" | "normal" | "slow",
): number {
  // Base thinking time: 3-11 seconds (reading + considering response)
  const thinkingTime = 3000 + Math.random() * 8000;

  // Typing time: ~40 words per minute = ~200 chars/min
  let typingSpeed = momentum === "hot" ? 250 : 200; // chars per minute
  if (speed === "instant") typingSpeed *= 1.5;
  if (speed === "slow") typingSpeed *= 0.7;

  const typingTime = (replyLength / typingSpeed) * 60_000;

  // Revision time: longer replies = pause to reread
  const revisionTime = replyLength > 100 ? Math.random() * 5000 : 0;

  // Random distraction: 15% chance of +20-90 seconds
  const distraction = Math.random() < 0.15 ? 20_000 + Math.random() * 70_000 : 0;

  // Mood modifier: delighted = faster, cold = slower
  const moodMultiplier = mood > 60 ? 0.6 : mood < -20 ? 1.8 : 1.0;

  // Talkativeness: chatty people type faster (thoughts flow easily)
  const talkMultiplier = 1 - talkativeness / 200; // 0.5x to 1.0x

  const total = (thinkingTime + typingTime + revisionTime) * moodMultiplier * talkMultiplier + distraction;

  // Clamp to 2s-90s range
  return Math.round(Math.max(2000, Math.min(90_000, total)));
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

/**
 * Delay between bubbles in a multi-message burst.
 *
 * Now content-aware and varied to feel natural, not robotic.
 */
export function slurpReplyBubbleDelayMs(input: {
  bubbleIndex: number;
  bubbleCount: number;
  previousBubble?: string;
  nextBubble: string;
  momentum?: "hot" | "warm" | "cold" | "frozen";
  mood?: number;
}): number {
  const momentum = input.momentum ?? "cold";
  const mood = input.mood ?? 0;
  const nextLength = input.nextBubble.length;

  // Base delay: ~20ms per character (realistic typing speed)
  const typingTime = nextLength * 20;

  // Thinking pause between messages
  const isAfterThought = /^(actually|also|oh|wait|and|but|plus|or|like)/i.test(input.nextBubble);
  const thinkingPause = isAfterThought ? 2000 + Math.random() * 6000 : 500 + Math.random() * 2500;

  // Momentum: hot conversation = sometimes rapid-fire
  const pacing = momentum === "hot" && Math.random() < 0.3 ? 0.4 : 1.0;

  // Mood: delighted = faster bubbles, cold = slower
  const moodMultiplier = mood > 60 ? 0.7 : mood < -20 ? 1.5 : 1.0;

  const totalDelay = (typingTime + thinkingPause) * pacing * moodMultiplier;

  // Clamp to 500ms-30s range (much wider than old 1.5s-8s)
  return Math.round(Math.max(500, Math.min(30_000, totalDelay)));
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
