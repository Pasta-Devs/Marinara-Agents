/**
 * Pulse (task C): what ran and what comes next, from rows the tasks route already reads. Pure.
 *
 * - Stir plays are tasks: done, part done (a step failed, the others ran) or undone.
 * - "Coming up" merges the next posts, queued replies, promised follow-ups, the next fan run and
 *   the next occasions into one list by time, so the player sees what Slurp will do on its own.
 */

/** One thing Slurp will do on its own, with its time. `viewerAccountId`: whose chat it lands in. */
export type SlurpPulseNext = {
  id: string;
  kind: "post" | "reply" | "promise" | "opener" | "fans" | "event";
  at: string;
  accountIds: string[];
  viewerAccountId?: string | null;
  label?: string | null;
};

export type SlurpPulsePlay = {
  id: string;
  at: string;
  steps: { action: string; input: Record<string, unknown>; ok: boolean; error: string | null }[];
  undone: boolean;
};

const PLAY_ACCOUNT_KEYS = ["accountId", "aId", "bId", "hostId", "partnerId", "fromId", "toId"] as const;

/** The plays of the last day as Pulse tasks. A play is "failed" when a step failed, with that step's reason. */
export function slurpPulsePlayTasks(plays: readonly SlurpPulsePlay[], now: Date, windowMs = 86_400_000) {
  return plays
    .filter((play) => now.getTime() - Date.parse(play.at) <= windowMs)
    .map((play) => {
      const failed = play.steps.filter((step) => !step.ok);
      const accountIds = [
        ...new Set(
          play.steps.flatMap((step) =>
            PLAY_ACCOUNT_KEYS.map((key) => step.input[key]).filter(
              (value): value is string => typeof value === "string" && value.length > 0,
            ),
          ),
        ),
      ];
      return {
        id: `play:${play.id}`,
        kind: "stir-play",
        status: play.undone ? "undone" : failed.length > 0 ? "failed" : "completed",
        createdAt: play.at,
        updatedAt: play.at,
        accountIds,
        // The first failing step says why; the rest of the play still ran.
        detail: failed[0]?.error ?? null,
        stirActions: play.steps.map((step) => step.action),
        progress:
          play.steps.length > 1 ? { completed: play.steps.length - failed.length, total: play.steps.length } : null,
      };
    });
}

/** The next start of each yearly occasion within `days` (today counts), for "Coming up". */
export function slurpUpcomingAnnualEvents(
  events: readonly {
    id: string;
    name: string;
    enabled: boolean;
    activation: { kind: string; month?: number; day?: number };
  }[],
  now: Date,
  days = 14,
): { id: string; name: string; startsAt: string }[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return events.flatMap((event) => {
    const { month, day } = event.activation;
    if (!event.enabled || event.activation.kind !== "annual" || !month || !day) return [];
    const start = [0, 1]
      .map((offset) => Date.UTC(now.getUTCFullYear() + offset, month - 1, day))
      .find((value) => value > today);
    return start !== undefined && start - today <= days * 86_400_000
      ? [{ id: event.id, name: event.name, startsAt: new Date(start).toISOString() }]
      : [];
  });
}

/**
 * One "Coming up" list, soonest first. A reply or follow-up already due shows as "now" (it waits for
 * the next tick); anything else in the past is dropped. At most `limit` entries.
 */
export function slurpPulseNext(
  input: {
    now: Date;
    slots: readonly { id: string; accountId: string; publishAt: string }[];
    replies: readonly { threadId: string; creatorAccountId: string; viewerAccountId: string; at: string | null }[];
    followUps: readonly {
      id: string;
      creatorAccountId: string;
      viewerAccountId: string;
      type: string;
      at: string;
      reason: string;
    }[];
    fansAt: string | null;
    events: readonly { id: string; name: string; startsAt: string; accountIds?: string[] }[];
  },
  limit = 12,
): SlurpPulseNext[] {
  const now = input.now.getTime();
  const due = (at: string | null) => (at && Date.parse(at) > now ? at : input.now.toISOString());
  const future = (at: string) => Date.parse(at) > now;
  const entries: SlurpPulseNext[] = [
    ...input.slots
      .filter((slot) => future(slot.publishAt))
      .map((slot) => ({
        id: `post:${slot.id}`,
        kind: "post" as const,
        at: slot.publishAt,
        accountIds: [slot.accountId],
      })),
    ...input.replies.map((reply) => ({
      id: `reply:${reply.threadId}`,
      kind: "reply" as const,
      at: due(reply.at),
      accountIds: [reply.creatorAccountId],
      viewerAccountId: reply.viewerAccountId,
    })),
    ...input.followUps.map((followUp) => ({
      id: `follow-up:${followUp.id}`,
      kind: followUp.type === "opener" ? ("opener" as const) : ("promise" as const),
      at: due(followUp.at),
      accountIds: [followUp.creatorAccountId],
      viewerAccountId: followUp.viewerAccountId,
      label: followUp.reason.slice(0, 120) || null,
    })),
    ...(input.fansAt && future(input.fansAt)
      ? [{ id: "fans:next", kind: "fans" as const, at: input.fansAt, accountIds: [] }]
      : []),
    ...input.events
      .filter((event) => future(event.startsAt))
      .map((event) => ({
        id: `event:${event.id}`,
        kind: "event" as const,
        at: event.startsAt,
        accountIds: event.accountIds ?? [],
        label: event.name,
      })),
  ];
  return entries.sort((left, right) => Date.parse(left.at) - Date.parse(right.at)).slice(0, limit);
}
