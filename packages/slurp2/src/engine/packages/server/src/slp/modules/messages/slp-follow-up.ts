import { randomUUID } from "node:crypto";

/**
 * Creator-initiated follow-up messages with promise tracking.
 *
 * Supports:
 * - Simple reminders ("I'll remind you in 30 minutes")
 * - Promise delivery (tip rewards, exclusive content)
 * - Task updates (commission progress, multiple check-ins)
 * - Recurring updates ("I'll keep you posted throughout the day")
 * - Proactive check-ins ("I'll message you later tonight")
 *
 * The AI signals intent to follow up, and this system schedules and generates messages.
 */

/** `opener`: the Creator writes first in a quiet chat on their own (the world tick plans it), nothing promised. */
export type FollowUpType = "reminder" | "promise_delivery" | "task_update" | "check_in" | "recurring" | "opener";

export type ScheduledFollowUp = {
  id: string;
  scheduledAt: string;
  type: FollowUpType;
  reason: string;
  context: string;
  /** Link to a thread note containing the promise/commitment */
  relatedNoteId?: string;
  /** For sequences: "2 of 3 updates" */
  sequenceNumber?: number;
  totalInSequence?: number;
  /** For recurring: pattern like "every 4 hours" */
  recurringPattern?: string;
  /** When it first came due; `scheduledAt` moves with each wait (task E). */
  firstDueAt?: string;
};

/**
 * AI's structured follow-up intent from the generation response.
 */
export type FollowUpIntent = {
  type: FollowUpType;
  /** Single time like "30 minutes", "2 hours", "tonight" OR interval like "every 4 hours" */
  timing: string;
  /** How many follow-ups in sequence (1 for single, 3+ for recurring) */
  count?: number;
  /** What this follow-up is about */
  reason: string;
  /** Additional context */
  context?: string;
  /** If related to a promise/commitment being remembered */
  relatedToNote?: boolean;
};

/**
 * Parse natural language timing into minutes from now.
 */
export function parseTimingToMinutes(timing: string): number | null {
  const lower = timing.toLowerCase().trim();

  // Direct numbers: "30 minutes", "1.5 hours", "2 days". The decimal and the day and week units
  // were missing, so "1.5 hours" read as 5 hours and "2 days" fell through to the one-hour default.
  const directMatch = lower.match(/(\d+(?:\.\d+)?)\s*(minute|min|hour|hr|day|week)s?\b/);
  if (directMatch) {
    const amount = Number(directMatch[1]);
    const perUnit = { minute: 1, min: 1, hour: 60, hr: 60, day: 1440, week: 10080 }[directMatch[2]] ?? 1;
    return Math.round(amount * perUnit);
  }

  // Named times
  if (lower.includes("tonight") || lower.includes("evening")) return 240; // 4 hours
  if (lower.includes("tomorrow") || lower.includes("next day")) return 1440; // 24 hours
  if (lower.includes("later today") || lower.includes("this afternoon")) return 180; // 3 hours
  if (lower.includes("soon") || lower.includes("bit") || lower.includes("little while")) return 60; // 1 hour
  if (lower.includes("morning")) return 720; // 12 hours (next morning)
  if (lower.includes("lunch")) return 240; // 4 hours
  if (lower.includes("dinner")) return 360; // 6 hours

  return null;
}

/**
 * Detect promise keywords in text that suggest a follow-up should be scheduled.
 * This helps catch promises the AI makes but doesn't explicitly signal via followUp.
 */
export function detectPromiseFromText(text: string): {
  detected: boolean;
  type: FollowUpType;
  timing: string;
  reason: string;
} | null {
  const lower = text.toLowerCase();

  // Promise delivery patterns
  const promisePatterns = [
    /i['’]ll (?:send|give|show) (?:you )?(.+?) (?:later|tonight|tomorrow|soon)/i,
    /(?:will|gonna) (?:send|give|show) (?:you )?(.+?) (?:later|tonight|tomorrow|soon)/i,
    /(?:promised|promise) (?:to )?(?:send|give|show) (?:you )?(.+)/i,
  ];

  for (const pattern of promisePatterns) {
    const match = text.match(pattern);
    if (match) {
      const what = match[1]?.trim() || "something special";
      const timingMatch = text.match(/(?:later|tonight|tomorrow|soon|in \d+ (?:hour|minute)s?)/i);
      const timing = timingMatch ? timingMatch[0] : "tonight";
      return {
        detected: true,
        type: "promise_delivery",
        timing,
        reason: `Send ${what}`,
      };
    }
  }

  // Task update patterns
  const taskPatterns = [
    // Only work for the fan. Without "your", "finishing my coffee" scheduled a task update.
    /(?:working on|finishing|completing) your (.+)/i,
    /(?:i['’]ll|will) (?:let you know|update you|keep you posted) (?:about|on|when)/i,
  ];

  for (const pattern of taskPatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        detected: true,
        type: "task_update",
        timing: "4 hours",
        reason: "Task progress update",
      };
    }
  }

  // Reminder patterns
  const reminderPatterns = [
    /(?:i['’]ll|will) remind (?:you|u) (?:about|to) (.+?) in (\d+) (\w+)/i,
    /remind(?:er)? (?:about|for) (.+)/i,
  ];

  for (const pattern of reminderPatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        detected: true,
        type: "reminder",
        timing: match[2] && match[3] ? `${match[2]} ${match[3]}` : "30 minutes",
        reason: `Reminder about ${match[1]?.trim() || "previous conversation"}`,
      };
    }
  }

  return null;
}

/**
 * Parse recurring interval: "every 2 hours" → 120 minutes
 */
export function parseRecurringInterval(pattern: string): number | null {
  const match = pattern.match(/every\s+(\d+)\s*(minute|hour|min|hr)s?/i);
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  return unit.startsWith("h") ? amount * 60 : amount;
}

/**
 * Create scheduled follow-ups from AI intent.
 */
export function createScheduledFollowUps(
  intent: FollowUpIntent,
  currentTime: Date = new Date(),
  relatedNoteId?: string,
): ScheduledFollowUp[] {
  const followUps: ScheduledFollowUp[] = [];

  if (intent.type === "recurring" && intent.count && intent.count > 1) {
    // Multiple follow-ups at intervals
    const intervalMinutes = parseRecurringInterval(intent.timing) ?? parseTimingToMinutes(intent.timing) ?? 120;

    for (let i = 0; i < intent.count; i++) {
      const delayMinutes = intervalMinutes * (i + 1);
      followUps.push({
        id: `followup-${randomUUID()}`,
        scheduledAt: new Date(currentTime.getTime() + delayMinutes * 60_000).toISOString(),
        type: intent.type,
        reason: intent.reason,
        context: intent.context ?? "",
        relatedNoteId,
        sequenceNumber: i + 1,
        totalInSequence: intent.count,
        recurringPattern: intent.timing,
      });
    }
  } else {
    // Single follow-up
    const delayMinutes = parseTimingToMinutes(intent.timing) ?? 60;
    followUps.push({
      id: `followup-${randomUUID()}`,
      scheduledAt: new Date(currentTime.getTime() + delayMinutes * 60_000).toISOString(),
      type: intent.type,
      reason: intent.reason,
      context: intent.context ?? "",
      relatedNoteId,
    });
  }

  return followUps;
}

/**
 * Check if a follow-up is due to be sent.
 */
export function isFollowUpDue(followUp: ScheduledFollowUp, now: Date = new Date()): boolean {
  return new Date(followUp.scheduledAt) <= now;
}

/**
 * Follow-ups are promises (task E): a blocked one waits and tries again, it is never dropped for
 * being old. Only an opener (nobody asked for it) ends two days after it was planned; a promise
 * ends only with its thread (gone, closed, cleared). The Creator's "writes on their own" switch
 * stops openers only; a promise made in a reply still goes out.
 */
export const SLURP_FOLLOW_UP_OVERDUE_MS = 2 * 24 * 60 * 60_000;
/** `createdAt`: when it was planned (the follow-up row's creation). */
export function isFollowUpOverdue(followUp: { createdAt?: string }, now: Date = new Date()): boolean {
  const promised = Date.parse(followUp.createdAt ?? "");
  return Number.isFinite(promised) && now.getTime() - promised > SLURP_FOLLOW_UP_OVERDUE_MS;
}
/** Whether a wait may end this follow-up: an old opener only. */
export function slurpFollowUpExpires(followUp: { type: string; createdAt?: string }, now: Date = new Date()): boolean {
  return followUp.type === "opener" && isFollowUpOverdue(followUp, now);
}

/** More than this past its first due time, the Creator says sorry for the wait. */
export const SLURP_FOLLOW_UP_LATE_MS = 2 * 60 * 60_000;
export function isFollowUpLate(firstDueAt: string | undefined, now: Date = new Date()): boolean {
  const due = Date.parse(firstDueAt ?? "");
  return Number.isFinite(due) && now.getTime() - due > SLURP_FOLLOW_UP_LATE_MS;
}

/**
 * The next try after a failed generation: half the time the promise is already late, between 15
 * minutes and 12 hours. A failure right after it came due retries soon; a promise failing for days
 * costs two model calls a day at most. No attempt count is stored: the lateness is the count.
 */
export function slurpFollowUpRetryAt(firstDueAt: string | undefined, now: Date = new Date()): string {
  const due = Date.parse(firstDueAt ?? "");
  const late = Number.isFinite(due) ? Math.max(0, now.getTime() - due) : 0;
  const delay = Math.min(12 * 60 * 60_000, Math.max(15 * 60_000, late / 2));
  return new Date(now.getTime() + delay).toISOString();
}

/**
 * The row update after a failed generation. A promise goes back to the queue at the retry time;
 * an opener fails for good. `firstDueAt` is pinned, because a row from before 0.3.0 has none and
 * its moving `scheduledAt` would keep the lateness (and so the back-off) at zero forever.
 */
export function slurpFailedFollowUpPatch(
  row: { type?: unknown; scheduledAt?: unknown; firstDueAt?: unknown } | undefined,
  now: Date = new Date(),
): { status: "failed" | "pending"; scheduledAt: string; firstDueAt: string } {
  const firstDueAt = String(row?.firstDueAt ?? row?.scheduledAt ?? now.toISOString());
  return row?.type === "opener"
    ? { status: "failed", scheduledAt: String(row.scheduledAt ?? now.toISOString()), firstDueAt }
    : { status: "pending", scheduledAt: slurpFollowUpRetryAt(firstDueAt, now), firstDueAt };
}

/** The shape `slurpAllowsUnsolicitedText` needs from a stored message. Duck-typed: a `SlurpMessage` fits as-is. */
export type SlpGateMessage = {
  role: "viewer" | "creator";
  kind?: string;
  metadata?: Record<string, unknown> | null;
};

/** A quote, a system note, or a Support desk notice asks for nothing; it is not the viewer replying. */
const isRealViewerReply = (message: SlpGateMessage): boolean =>
  message.role === "viewer" && message.kind !== "system" && message.metadata?.deskQuiet !== true;

/** Already-shipped follow-up types that are "nobody asked" rather than an owed promise. */
const SLURP_UNSOLICITED_FOLLOW_UP_TYPES: ReadonlySet<string> = new Set(["opener", "check_in", "recurring"]);

/**
 * A creator message counts whether or not it carries the newer `metadata.unsolicited` marker:
 * every send this gate must cover already stamps `metadata.followUpType` (the follow-up scheduler)
 * or `metadata.dramaChoice` (the drama choice job), including rows written before this setting
 * shipped. Only the canned first-touch opener (`slp-world-operation.ts`) has no other marker, so it
 * carries `metadata.unsolicited` explicitly.
 */
export const isUnsolicitedCreatorMessage = (message: SlpGateMessage): boolean => {
  if (message.role !== "creator") return false;
  const meta = message.metadata;
  if (!meta) return false;
  if (meta.unsolicited === true) return true;
  if (meta.dramaChoice != null) return true;
  return typeof meta.followUpType === "string" && SLURP_UNSOLICITED_FOLLOW_UP_TYPES.has(meta.followUpType);
};

/**
 * Settings › Messaging: "Stop after one unanswered text" (global, off by default). Scans a
 * thread's messages, oldest first, same order `listMessages` already returns.
 *
 * A direct reply, an owed promise/reminder/task update, a commission delivery, or a scene/system
 * line is neither case below and is skipped. Everything else in the window must be one or the
 * other, so exhausting a full window without a match is read as "still blocked", not "allowed" —
 * only a thread with no messages at all (a brand-new thread's first text) is allowed by default.
 */
export function slurpAllowsUnsolicitedText(history: readonly SlpGateMessage[]): boolean {
  for (let i = history.length - 1; i >= 0; i--) {
    if (isRealViewerReply(history[i])) return true;
    if (isUnsolicitedCreatorMessage(history[i])) return false;
  }
  return history.length === 0;
}

/**
 * Generate a follow-up message prompt context.
 */
export function formatFollowUpContext(followUp: ScheduledFollowUp, promiseText?: string, late = false): string {
  // `scheduledAt` is when it came due, not when it was promised, so no "minutes ago" is stated:
  // the old count told the model a false fact.
  // Nobody asked for an opener, so it must not claim a promise.
  if (followUp.type === "opener")
    return `Nobody asked and you promised nothing: you are writing first in this quiet chat. ${followUp.reason}`;
  let context = `You promised a ${followUp.type} earlier and it is due now. Reason: ${followUp.reason}.`;

  if (followUp.sequenceNumber && followUp.totalInSequence) {
    context += ` This is update ${followUp.sequenceNumber} of ${followUp.totalInSequence}.`;
  }

  if (followUp.context) {
    context += ` Context: ${followUp.context}`;
  }

  // The words she remembered, so the follow-up keeps the promise she actually made.
  if (promiseText) {
    context += ` What you promised: "${promiseText}". Keep this promise now.`;
  }

  // A promise kept late is still kept (task E): she owns the wait in her own words, then delivers.
  if (late) {
    context += ` You are late with this. Open with a short, casual sorry for the wait in your own voice (one line, no excuses list), then keep the promise.`;
  }

  return context;
}
