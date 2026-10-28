import type { SlpPulseTarget, SlpTask } from "../../base/state/slp-task-store";

/**
 * Pulse (task C), the pure part: which section a task sits in, where a tap goes, today's AI use,
 * and one "Coming up" list. The sheet in `SlpPulse.tsx` only draws this.
 */

export type PulseServerTask = {
  id: string;
  kind: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  publishAt?: string;
  accountIds: string[];
  detail?: string | null;
  progress?: { completed: number; total: number } | null;
  postId?: string | null;
  viewerAccountId?: string | null;
  retry?: { path: string; body: unknown } | null;
  stirActions?: string[];
};

export type PulseNext = {
  id: string;
  kind: "post" | "reply" | "promise" | "opener" | "fans" | "event";
  at: string;
  accountIds: string[];
  viewerAccountId?: string | null;
  label?: string | null;
};

export type PulseUsage = {
  callsToday: number;
  activeCreators?: number;
  mode?: "off" | "present" | "background";
  callsPerDayLimit?: number;
  tokensPerCall?: number;
};

export type PulseSection = "running" | "queued" | "failed" | "done";

const FAILED = new Set(["failed", "error", "abandoned"]);
const QUEUED = new Set(["queued", "prepared", "pending", "waiting", "connection_required", "claimed"]);

/** Where a server task belongs. A scheduled post is "Coming up", not a section of its own. */
export function slpPulseServerSection(status: string, terminal: boolean): PulseSection | "scheduled" {
  if (status === "scheduled") return "scheduled";
  if (FAILED.has(status)) return "failed";
  if (terminal) return "done";
  if (QUEUED.has(status)) return "queued";
  return "running";
}

export function slpPulseClientSection(task: Pick<SlpTask, "status">): PulseSection {
  return task.status === "failed" ? "failed" : task.status === "done" ? "done" : "running";
}

/**
 * Where a tap on a server task goes: the post it made, the chat it wrote in (only the player's own
 * chats open), else the Creator's page. Null when it names nobody (a fan run).
 */
export function slpPulseServerTarget(
  task: Pick<PulseServerTask, "accountIds" | "postId" | "viewerAccountId">,
  ownViewerIds: ReadonlySet<string>,
): SlpPulseTarget | null {
  const accountId = task.accountIds[0];
  if (!accountId) return null;
  if (task.viewerAccountId && ownViewerIds.has(task.viewerAccountId)) return { chatCreatorId: accountId };
  return task.postId ? { accountId, postId: task.postId } : { accountId };
}

export function slpPulseNextTarget(next: PulseNext, ownViewerIds: ReadonlySet<string>): SlpPulseTarget | null {
  const accountId = next.accountIds[0];
  if (!accountId) return null;
  if (next.viewerAccountId && ownViewerIds.has(next.viewerAccountId)) return { chatCreatorId: accountId };
  return { accountId };
}

/** Today's AI use against the day's limit, in tokens (F: tokens only, no money). */
export function slpPulseAiToday(usage: PulseUsage | undefined) {
  if (!usage) return null;
  const perCall = usage.tokensPerCall ?? 3000;
  const limitCalls = Math.max(0, usage.callsPerDayLimit ?? 0);
  const usedCalls = Math.max(0, usage.callsToday);
  return {
    off: usage.mode === "off",
    usedCalls,
    limitCalls,
    usedTokens: usedCalls * perCall,
    limitTokens: limitCalls * perCall,
    /** 0–1 for the bar; a limit of 0 reads as full, never as a division by zero. */
    share: limitCalls > 0 ? Math.min(1, usedCalls / limitCalls) : 1,
    creators: usage.activeCreators ?? 0,
  };
}

/**
 * "Coming up": the server's list plus any scheduled post it does not already have (an older server
 * sends no list), soonest first, at most `limit`.
 */
export function slpPulseComingUp(
  next: readonly PulseNext[],
  scheduled: readonly Pick<PulseServerTask, "id" | "publishAt" | "accountIds">[],
  limit = 12,
): PulseNext[] {
  const known = new Set(
    next.filter((entry) => entry.kind === "post").map((entry) => `${entry.accountIds[0]}@${entry.at}`),
  );
  const extra = scheduled
    .filter((task) => task.publishAt && !known.has(`${task.accountIds[0]}@${task.publishAt}`))
    .map((task) => ({ id: task.id, kind: "post" as const, at: task.publishAt!, accountIds: task.accountIds }));
  return [...next, ...extra].sort((left, right) => Date.parse(left.at) - Date.parse(right.at)).slice(0, limit);
}

/** A running line for the top of Pulse: "2 running · 1 queued · 1 failed · 5 coming up". Empty when quiet. */
export function slpPulseSummaryCounts(counts: Record<PulseSection | "next", number>) {
  return (["running", "queued", "failed", "next"] as const).filter((key) => counts[key] > 0);
}

/** Server tasks still running: Pulse polls fast only while there are any (0.3.6). */
export const slpPulseRunningCount = (tasks: readonly PulseServerTask[] = []) =>
  tasks.filter((task) => slpPulseServerSection(task.status, slpPulseTaskDone(task.status)) === "running").length;

/** A status that ends a task: it moves to "Recent". */
export function slpPulseTaskDone(status: string) {
  return new Set([
    "completed",
    "complete",
    "success",
    "failed",
    "error",
    "abandoned",
    "published",
    "discarded",
    "sent",
    "cancelled",
    // A Stir play taken back with Undo (task C).
    "undone",
    // A fan run that found nothing to do ends as "skipped"; Pulse showed it "Working" forever (R1-103).
    "skipped",
  ]).has(status);
}
