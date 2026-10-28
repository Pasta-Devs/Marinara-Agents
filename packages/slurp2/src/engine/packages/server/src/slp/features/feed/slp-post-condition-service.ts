/**
 * Reading one Creator's own state out of storage, for the things she publishes.
 *
 * Split from `slurp-post-stance.ts` for the reason `slurp-day-vibe.service.ts` is split from
 * `slurp-day-vibe.ts`: the rules stay importable and testable without an Engine checkout, and the
 * panel can render the exact instructions the prompt was built from rather than an approximation.
 */
import type { DB } from "../../../db/connection.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { slurpGoalProgress } from "../../modules/projects/slp-goal.js";
import { resolveSlurpPostStance, slurpPostStanceInstruction } from "../../modules/feed/slp-post-stance.js";

/**
 * The "how you are today" block for one Creator, or null when today adds nothing.
 *
 * Every read here is best-effort. A Creator whose state cannot be loaded is a Creator having an
 * ordinary day, exactly as `describeSlurpDayVibe` decided for the same question: this must never
 * cost a post.
 */
export async function describeSlurpPostCondition(
  db: DB,
  creatorAccountId: string,
  at = new Date(),
): Promise<string | null> {
  try {
    const slurp = createSlurpStorage(db);
    const state = await slurp.getCreatorState(creatorAccountId);
    const goal = await slurp.getGoal(creatorAccountId);
    const progress = goal ? slurpGoalProgress(goal, (await slurp.getEarnings(creatorAccountId)).lifetime) : null;
    // A partial day's earnings compared with a full-day average made early posts systematically
    // disappointed, then cached that verdict all day. Feed mood comes from grounded state/events;
    // the income day-vibe remains available to private conversations and explicit business work.
    return slurpPostStanceInstruction(resolveSlurpPostStance({ state, dayVibe: null, goal: progress, at }));
  } catch {
    return null;
  }
}
