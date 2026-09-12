/**
 * Reading one Creator's own state out of storage, for the things she publishes.
 *
 * Split from `slurp-post-stance.ts` for the reason `slurp-day-vibe.service.ts` is split from
 * `slurp-day-vibe.ts`: the rules stay importable and testable without an Engine checkout, and the
 * panel can render the exact instructions the prompt was built from rather than an approximation.
 */
import type { DB } from "../../db/connection.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { describeSlurpDayVibe } from "./slurp-day-vibe.service.js";
import { slurpGoalProgress } from "./slurp-goal.js";
import { resolveSlurpPostStance, slurpPostStanceInstruction } from "./slurp-post-stance.js";

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
    const dayVibe = await describeSlurpDayVibe(db, creatorAccountId, at);
    const goal = await slurp.getGoal(creatorAccountId);
    const progress = goal ? slurpGoalProgress(goal, (await slurp.getEarnings(creatorAccountId)).lifetime) : null;
    return slurpPostStanceInstruction(resolveSlurpPostStance({ state, dayVibe, goal: progress, at }));
  } catch {
    return null;
  }
}
