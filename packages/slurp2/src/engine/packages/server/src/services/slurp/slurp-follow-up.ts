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

export type FollowUpType = "reminder" | "promise_delivery" | "task_update" | "check_in" | "recurring";

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

  // Direct numbers: "30 minutes", "2 hours"
  const directMatch = lower.match(/(\d+)\s*(minute|hour|min|hr)s?/);
  if (directMatch) {
    const amount = parseInt(directMatch[1], 10);
    const unit = directMatch[2];
    return unit.startsWith("h") ? amount * 60 : amount;
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
    /i['']ll (?:send|give|show) (?:you )?(.+?) (?:later|tonight|tomorrow|soon)/i,
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
    /(?:working on|finishing|completing) (?:your |the )?(.+)/i,
    /(?:i['']ll|will) (?:let you know|update you|keep you posted) (?:about|on|when)/i,
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
    /(?:i['']ll|will) remind (?:you|u) (?:about|to) (.+?) in (\d+) (\w+)/i,
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
        id: `followup-${Date.now()}-${i}`,
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
      id: `followup-${Date.now()}`,
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
 * Generate a follow-up message prompt context.
 */
export function formatFollowUpContext(followUp: ScheduledFollowUp): string {
  const timeAgo = Math.round((Date.now() - new Date(followUp.scheduledAt).getTime()) / 60_000);
  const timing = timeAgo > 2 ? `about ${timeAgo} minutes ago` : "just now";

  let context = `You scheduled a ${followUp.type} ${timing}. Reason: ${followUp.reason}.`;

  if (followUp.sequenceNumber && followUp.totalInSequence) {
    context += ` This is update ${followUp.sequenceNumber} of ${followUp.totalInSequence}.`;
  }

  if (followUp.context) {
    context += ` Context: ${followUp.context}`;
  }

  return context;
}
