/**
 * Direct-message rules: who may open a thread, what one costs, and how fast a creator answers.
 *
 * Pure, like `slurp-wallet.ts` and `slurp-rapport.ts`, so the gate and the pacing can be tested
 * without an Engine checkout. Nothing here reads the DB or the clock beyond what it is handed.
 */
import { readSlurpRapportWeights, type SlurpRapport, type SlurpRapportWeights } from "./slp-rapport.js";
import { slurpRotationHash } from "../feed/slp-post-variation.js";

/** Storage key for the per-creator messaging settings blob. Mirrors the creator-prices key. */
export const SLURP_CREATOR_MESSAGING_KEY = "slurp2.creator.messaging";

export type SlurpDmPolicy =
  /** Anyone may write, and the thread opens immediately. */
  | "open"
  /** Non-subscribers land in the request tray. Subscribers write straight through. */
  | "subscribers"
  /** Non-subscribers may buy their way past the tray by paying the request fee. */
  | "paid"
  /** Nobody new may open a thread. Existing active threads keep working. */
  | "closed";

/**
 * A queued reply bubble due this long ago was never delivered: the delivery tick runs every 15 s, so
 * it is stuck (its thread or message files were removed under it, or every delivery throws). A stuck
 * bubble must not hold "already writing back" forever.
 */
export const SLURP_REPLY_BUBBLE_STALE_MS = 2 * 60_000;
export function slurpReplyBubbleStale(deliverAt: string, now = Date.now()): boolean {
  const due = Date.parse(deliverAt);
  return !Number.isFinite(due) || due < now - SLURP_REPLY_BUBBLE_STALE_MS;
}

export const SLURP_DM_POLICIES: readonly SlurpDmPolicy[] = ["open", "subscribers", "paid", "closed"];

export type SlurpCreatorMessaging = {
  dmPolicy: SlurpDmPolicy;
  /** Coins a non-subscriber pays to skip the request tray under the `paid` policy. */
  requestFee: number;
  /** Default price the creator puts on a locked message. */
  ppvPrice: number;
  rapportWeights: SlurpRapportWeights;
  /** Off: this Creator never writes first — no follow-ups and no other unprompted direct message. */
  proactiveMessages: boolean;
  /** Price stamped on this Creator's new locked posts. Null uses Settings → Wallet. */
  unlockPrice: number | null;
  /** Commission price for an average brief. Quotes scale from it by how much the brief asks for. */
  commissionBase: number;
  commissionMin: number;
  commissionMax: number;
  /** Quote audience briefs automatically. Character Creators always do. */
  autoQuote: boolean;
  /** Last weekly dynamic price adjustment. */
  pricedAt: string | null;
};

export const SLURP_DEFAULT_CREATOR_MESSAGING: SlurpCreatorMessaging = {
  dmPolicy: "subscribers",
  requestFee: 5,
  ppvPrice: 8,
  rapportWeights: readSlurpRapportWeights(undefined),
  proactiveMessages: true,
  unlockPrice: null,
  commissionBase: 40,
  commissionMin: 10,
  commissionMax: 400,
  autoQuote: true,
  pricedAt: null,
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
  const bigCoins = (input: unknown, fallback: number) =>
    typeof input === "number" && Number.isInteger(input) && input >= 1 && input <= 99_999 ? input : fallback;
  // Bounds are edited one field at a time, so keep them ordered: min ≤ base ≤ max.
  const commissionMin = bigCoins(raw.commissionMin, defaults.commissionMin);
  const commissionMax = Math.max(commissionMin, bigCoins(raw.commissionMax, defaults.commissionMax));
  const commissionBase = Math.min(
    commissionMax,
    Math.max(commissionMin, bigCoins(raw.commissionBase, defaults.commissionBase)),
  );
  return {
    dmPolicy: SLURP_DM_POLICIES.includes(raw.dmPolicy as SlurpDmPolicy)
      ? (raw.dmPolicy as SlurpDmPolicy)
      : defaults.dmPolicy,
    requestFee: coins(raw.requestFee, defaults.requestFee),
    ppvPrice: coins(raw.ppvPrice, defaults.ppvPrice),
    rapportWeights: readSlurpRapportWeights(raw.rapportWeights),
    proactiveMessages: typeof raw.proactiveMessages === "boolean" ? raw.proactiveMessages : defaults.proactiveMessages,
    unlockPrice: typeof raw.unlockPrice === "number" ? coins(raw.unlockPrice, 0) : defaults.unlockPrice,
    commissionBase,
    commissionMin,
    commissionMax,
    // Saving any price used to write the whole object, so a stored `false` does not prove anyone
    // turned quoting off. Only a value the player set on purpose overrides the default.
    autoQuote: raw.autoQuoteChosen === true && typeof raw.autoQuote === "boolean" ? raw.autoQuote : defaults.autoQuote,
    pricedAt: typeof raw.pricedAt === "string" ? raw.pricedAt : defaults.pricedAt,
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

/**
 * Player-set reply timing, in minutes. Mirrors the `messages*` Slurp settings of the same names,
 * so a caller can hand over the settings object itself.
 */
export type SlurpReplyDelays = {
  /** A Creator with no Conversation Schedule answers as if online instead of guessing from posts. */
  messagesUnscheduledAlwaysReachable: boolean;
  messagesHighRapportDelayMinMinutes: number;
  messagesHighRapportDelayMaxMinutes: number;
  messagesMediumRapportDelayMinMinutes: number;
  messagesMediumRapportDelayMaxMinutes: number;
  /** Wait when an offline Creator has no known return time. */
  messagesUnknownReturnDelayMinutes: number;
  /** Ceiling on any reply wait. Zero answers right away. */
  messagesMaxReplyDelayMinutes: number;
  /** No schedule, posted within two hours: back in this range. */
  messagesRecentPostAwayMinMinutes: number;
  messagesRecentPostAwayMaxMinutes: number;
  /** No schedule, posted two to twelve hours ago: back in this range. */
  messagesStalePostAwayMinMinutes: number;
  messagesStalePostAwayMaxMinutes: number;
};

export const SLURP_DEFAULT_REPLY_DELAYS: SlurpReplyDelays = {
  messagesUnscheduledAlwaysReachable: false,
  messagesHighRapportDelayMinMinutes: 10,
  messagesHighRapportDelayMaxMinutes: 20,
  messagesMediumRapportDelayMinMinutes: 30,
  messagesMediumRapportDelayMaxMinutes: 60,
  // A Creator nobody has bought anything from still answers her messages the same day. The shipped
  // waits (two hours before a first answer, four before a stale one) read as a dead inbox, and the
  // only way to get a reply was the Reply now button.
  messagesUnknownReturnDelayMinutes: 45,
  messagesMaxReplyDelayMinutes: 90,
  messagesRecentPostAwayMinMinutes: 15,
  messagesRecentPostAwayMaxMinutes: 45,
  messagesStalePostAwayMinMinutes: 45,
  messagesStalePostAwayMaxMinutes: 120,
};

/**
 * Whether the viewer drew a picture into this chat less than `cooldownMinutes` ago (the
 * `messagesViewerImageCooldownMinutes` setting). 0 turns the wait off.
 */
export function slurpViewerImageOnCooldown(
  messages: readonly { role: string; createdAt: string; metadata: { generatedContext?: unknown } }[],
  cooldownMinutes: number,
  now = Date.now(),
): boolean {
  return slurpViewerImageReadyAt(messages, cooldownMinutes, now) !== null;
}

/**
 * The draft for a photo the player took and sends in a chat: the persona's own appearance, no
 * Creator (R1-054). The photo may not show the sender at all, so the look is conditional.
 */
export function slurpViewerPhotoPrompt(brief: string, appearance: string): string {
  return [
    "A photo the sender took themselves and sends in a private chat.",
    `The photo shows: ${brief}`,
    appearance ? `If the sender is in the photo, they look like this: ${appearance}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The chat uploads among some messages' metadata: only files in the shared messages folder. A
 * Creator's own message media lives in that Creator's folder, and a thread can hold another
 * Creator's files (a media offer), so nothing outside the folder is returned.
 */
export function slurpUploadedMessageMediaPaths(
  metadata: readonly Record<string, unknown>[],
  messagesFolder: string,
): string[] {
  return metadata.flatMap((entry) => {
    const path = entry.noodlerMediaPath;
    return typeof path === "string" &&
      path.startsWith(messagesFolder) &&
      !path.slice(messagesFolder.length).includes("..")
      ? [path]
      : [];
  });
}

/** When the viewer may draw the next picture (ISO), or null when they may draw one now. */
export function slurpViewerImageReadyAt(
  messages: readonly { role: string; createdAt: string; metadata: { generatedContext?: unknown } }[],
  cooldownMinutes: number,
  now = Date.now(),
): string | null {
  if (cooldownMinutes <= 0) return null;
  let latest = -Infinity;
  for (const message of messages) {
    if (message.role !== "viewer" || message.metadata.generatedContext !== "viewer") continue;
    const at = Date.parse(message.createdAt);
    if (at > latest) latest = at;
  }
  const readyAt = latest + cooldownMinutes * MINUTE;
  return readyAt > now ? new Date(readyAt).toISOString() : null;
}

/** A point inside a player-set range. A range entered backwards still reads as a range. */
export function slurpDelayInRange(min: number, max: number, variance: number): number {
  return Math.min(min, max) + variance * Math.abs(max - min);
}

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
  /** Player-set timing. Defaults keep the shipped pacing. */
  delays?: SlurpReplyDelays;
  /**
   * The Creator has never answered in this thread.
   *
   * A stranger scores no rapport, is not subscribed, and therefore always landed on the slowest
   * path — which is the one case a creator page actually answers: a new person in the inbox.
   */
  firstContact?: boolean;
  /** A paid sexting session runs: she answers right away, online or not. */
  sexting?: boolean;
}): SlurpReplyPacing {
  const delays = input.delays ?? SLURP_DEFAULT_REPLY_DELAYS;
  const maxDelayMs = delays.messagesMaxReplyDelayMinutes * MINUTE;
  const mood = Math.max(-100, Math.min(100, input.mood ?? 0));
  const momentum = input.momentum ?? "cold";
  const replyLength = input.replyLength ?? 100;
  const talkativeness = input.talkativeness ?? 50;

  // Mood drag: -0.5 when delighted, +1.0 when cold
  const moodDrag = mood > 60 ? 0.5 : mood < -20 ? 1.8 : 1.0;

  // Calculate reach: rapport + subscription bonus + mood bonus
  const earned = input.rapport.score / 100 + (input.subscribed ? 0.2 : 0) + mood / 400;
  // A first message is worth answering even from somebody who has given nothing yet.
  const reach = Math.min(1, Math.max(0, input.firstContact ? Math.max(earned, 0.45) : earned));

  if (input.sexting) {
    const typingMs = calculateTypingDelay(replyLength, momentum, mood, talkativeness, "instant");
    return {
      mode: "instant",
      typingMs,
      notBeforeMs: 0,
      debug: { reach, moodDrag, momentumBoost: momentum, decision: "sexting session" },
    };
  }

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

  // A zero ceiling means the player wants no wait at all, so the reply is not queued behind one.
  if (maxDelayMs <= 0) {
    return {
      mode: "instant",
      typingMs: 0,
      notBeforeMs: 0,
      debug: { reach, moodDrag, momentumBoost: momentum, decision: "offline, no reply delay allowed" },
    };
  }

  // High reach (subscriber + good rapport) gets check-in reply
  if (reach >= 0.6) {
    // They'll check messages and reply within 10-20 minutes
    // Deterministic based on rapport score for consistency
    const variance = (input.rapport.score % 10) / 10; // 0.0 to 1.0
    const checkInDelay = Math.min(
      maxDelayMs,
      Math.round(
        slurpDelayInRange(
          delays.messagesHighRapportDelayMinMinutes,
          delays.messagesHighRapportDelayMaxMinutes,
          variance,
        ) *
          MINUTE *
          moodDrag,
      ),
    );
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
    const variance = (input.rapport.score % 10) / 10; // 0.0 to 1.0
    const checkInDelay = Math.min(
      maxDelayMs,
      Math.round(
        slurpDelayInRange(
          delays.messagesMediumRapportDelayMinMinutes,
          delays.messagesMediumRapportDelayMaxMinutes,
          variance,
        ) *
          MINUTE *
          moodDrag,
      ),
    );
    const typingMs = calculateTypingDelay(replyLength, momentum, mood, talkativeness, "normal");
    return {
      mode: "delayed",
      typingMs,
      notBeforeMs: checkInDelay,
      debug: { reach, moodDrag, momentumBoost: momentum, decision: "medium rapport check-in reply" },
    };
  }

  // Low reach waits for schedule
  const scheduled =
    input.minutesUntilOnline === null
      ? delays.messagesUnknownReturnDelayMinutes
      : Math.max(15, input.minutesUntilOnline);
  // Reach still shortens wait a bit (max 50% reduction)
  const reduction = 1 - reach * 0.5;
  const finalDelay = Math.round(scheduled * MINUTE * reduction * moodDrag);

  const cappedDelay = Math.min(finalDelay, maxDelayMs);

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
 *
 * Uses deterministic randomness (seeded by reply length) so the same reply always takes
 * roughly the same time - consistency feels more human than true randomness.
 */
function calculateTypingDelay(
  replyLength: number,
  momentum: "hot" | "warm" | "cold" | "frozen",
  mood: number,
  talkativeness: number,
  speed: "instant" | "fast" | "normal" | "slow",
): number {
  // Deterministic "random" based on content length for consistency
  const seed = replyLength % 1000;
  const pseudoRandom = (offset: number) => (((seed + offset) * 9301 + 49297) % 233280) / 233280;

  // Base thinking time: 3-11 seconds (reading + considering response)
  const thinkingTime = 3000 + pseudoRandom(1) * 8000;

  // Typing time: ~40 words per minute = ~200 chars/min
  let typingSpeed = momentum === "hot" ? 250 : 200; // chars per minute
  if (speed === "instant") typingSpeed *= 1.5;
  if (speed === "slow") typingSpeed *= 0.7;

  const typingTime = (replyLength / typingSpeed) * 60_000;

  // Revision time: longer replies = pause to reread
  const revisionTime = replyLength > 100 ? pseudoRandom(2) * 5000 : 0;

  // Random distraction: 15% chance of +20-90 seconds
  const distraction = pseudoRandom(3) < 0.15 ? 20_000 + pseudoRandom(4) * 70_000 : 0;

  // Mood modifier: delighted = faster, cold = slower
  const moodMultiplier = mood > 60 ? 0.6 : mood < -20 ? 1.8 : 1.0;

  // Talkativeness: chatty people type faster (thoughts flow easily)
  // FIXED: Was backwards - now 100 talkativeness = 0.5x time (2x faster)
  const talkMultiplier = 1.5 - talkativeness / 200; // 1.5x (slow) to 0.5x (fast)

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
  // A sentence ends at punctuation followed by a space, so "3.5k" and "v1.2" stay whole.
  const parts = trimmed
    .split(/(?<=[.!?…]["')\]]?(?:\s*\p{Extended_Pictographic}\uFE0F?)*)\s+|\n+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  // A lone "..." or "!!" is a lead-in to the next sentence, not a message of its own.
  const sentences: string[] = [];
  for (const [index, part] of parts.entries()) {
    const last = sentences.at(-1);
    if (last !== undefined && /^[\p{P}\s]+$/u.test(last)) sentences[sentences.length - 1] = `${last} ${part}`;
    else if (index === parts.length - 1 && /^[\p{P}\s]+$/u.test(part) && last !== undefined)
      sentences[sentences.length - 1] = `${last}${part}`;
    else sentences.push(part);
  }
  if (sentences.length < 2) return [trimmed];
  // Aim at `limit` (the player's "up to this many"), one sentence or more per bubble, but keep each
  // bubble worth sending: about 20 characters or more. Halving the sentences first meant a limit of
  // 3 or 4 almost never applied (R1-003).
  let target = Math.min(limit, sentences.length);
  while (target > 2 && trimmed.length / target < 20) target -= 1;
  if (target < 2) return [trimmed];
  // Spread the sentences evenly, so a limit of 4 over 4 sentences really sends four.
  const bubbles: string[] = [];
  for (let index = 0; index < target; index += 1) {
    const from = Math.floor((index * sentences.length) / target);
    const to = Math.floor(((index + 1) * sentences.length) / target);
    bubbles.push(sentences.slice(from, to).join(" "));
  }
  return bubbles.filter(Boolean);
}

/**
 * Delay between bubbles in a multi-message burst.
 *
 * Now content-aware and varied to feel natural, not robotic.
 * Uses deterministic variance based on content for consistency.
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

  // Deterministic "random" based on bubble content
  const seed = nextLength + input.bubbleIndex * 100;
  const pseudoRandom = (offset: number) => (((seed + offset) * 9301 + 49297) % 233280) / 233280;

  // Base delay: ~20ms per character (realistic typing speed)
  const typingTime = nextLength * 20;

  // Thinking pause between messages
  const isAfterThought = /^(actually|also|oh|wait|and|but|plus|or|like)/i.test(input.nextBubble);
  const thinkingPause = isAfterThought ? 2000 + pseudoRandom(1) * 6000 : 500 + pseudoRandom(2) * 2500;

  // Momentum: hot conversation = sometimes rapid-fire
  const pacing = momentum === "hot" && pseudoRandom(3) < 0.3 ? 0.4 : 1.0;

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

/**
 * Paid commissions of automatic Creators that nothing is going to deliver (7c M-005).
 *
 * The player's accept route draws and schedules its own delivery; a quote an AI fan accepted on the
 * world tick, or an accept whose scheduling failed, was left `accepted` with no delivery time and
 * sat paid and silent forever. These get a delivery time from the same pacing, counted from the
 * accept, so an old one is due at once. A fresh accept is left alone for ten minutes, because the
 * accept route may still be drawing it. Hand-run Creators deliver by hand and are never listed.
 */
export function slurpUnscheduledCommissionDeliveries(
  commissions: readonly Pick<
    SlurpCommissionLike,
    "id" | "creatorAccountId" | "state" | "deliverAt" | "price" | "brief" | "updatedAt"
  >[],
  automaticCreatorIds: ReadonlySet<string>,
  now: Date,
): { id: string; deliverAt: string }[] {
  return commissions.flatMap((commission) => {
    if (commission.state !== "accepted" || commission.deliverAt) return [];
    if (!automaticCreatorIds.has(commission.creatorAccountId)) return [];
    const acceptedAt = Date.parse(commission.updatedAt);
    if (!Number.isFinite(acceptedAt) || now.getTime() - acceptedAt < 10 * MINUTE) return [];
    const due =
      acceptedAt + slurpCommissionDeliveryDelayMs({ price: commission.price, briefLength: commission.brief.length });
    return [{ id: commission.id, deliverAt: new Date(Math.max(due, now.getTime())).toISOString() }];
  });
}
type SlurpCommissionLike = {
  id: string;
  creatorAccountId: string;
  state: string;
  deliverAt: string | null;
  price: number;
  brief: string;
  updatedAt: string;
};

/** Days an unanswerable request waits before it expires (7c M-009). */
export const SLURP_REQUEST_EXPIRY_DAYS = 5;

/**
 * Message requests to automatic Creators that nobody is going to answer (7c M-009): the reply path
 * gave up on them (no reply owed, which is what it does for an AI fan it cannot answer) and they
 * have been quiet for five days. They expire, so a Creator's open requests do not grow forever.
 * A request still owed a reply (a persona's) is left for the reply path.
 */
export function slurpExpiredRequestIds(
  threads: readonly {
    id: string;
    creatorAccountId: string;
    state: string;
    needsReply: boolean;
    lastMessageAt: string;
  }[],
  automaticCreatorIds: ReadonlySet<string>,
  now: Date,
): string[] {
  return threads
    .filter(
      (thread) =>
        thread.state === "request" &&
        !thread.needsReply &&
        automaticCreatorIds.has(thread.creatorAccountId) &&
        now.getTime() - Date.parse(thread.lastMessageAt) > SLURP_REQUEST_EXPIRY_DAYS * 86_400_000,
    )
    .map((thread) => thread.id);
}

/**
 * An automatic Creator answers about one in four AI fans who write to her (task E); the rest go
 * unanswered and expire with the requests above. Picked by the fan's message id, so a retry after
 * a busy lock or a spent budget asks the same question and gets the same answer. Only a plain text
 * message fits: a tip, a shared post or a commission brief has its own path. A fan the Creator
 * already answered in this thread keeps the conversation (per fan, not per message).
 */
export const SLURP_AI_FAN_ANSWER_ONE_IN = 4;
export function slurpAnswersAiFan(message: { id: string; kind: string }, answeredBefore = false): boolean {
  if (message.kind !== "text") return false;
  return answeredBefore || slurpRotationHash(`ai-fan:${message.id}`) % SLURP_AI_FAN_ANSWER_ONE_IN === 0;
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

/** The Creator's latest posts for a DM prompt (drafts left out), each marked when this fan owns it. */
export function slurpDmRecentPosts<
  T extends { id: string; title: string | null; content: string; access: string; imageUrl: string | null },
>(rows: readonly T[], unlocked: { has(id: string): boolean }, max: number) {
  return rows
    .filter((post) => post.access !== "draft")
    .slice(0, max)
    .map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      access: post.access,
      imageUrl: post.imageUrl,
      unlockedByFan: unlocked.has(post.id),
    }));
}
