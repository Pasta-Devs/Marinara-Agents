import assert from "node:assert/strict";
import { join } from "node:path";
import { slurp2Source } from "./slurp2-source";
import {
  classifySlurpRefreshOutcome,
  countSlurpRefreshOutcomes,
  slurpRefreshOutcomeNames,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/creators/slp-refresh-batch.ts";
import type { SlpCreatorRefreshNowOutcome } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-social.types.ts";

// "Create posts now" once reported a full batch while the feed showed one post fewer: a Story slot
// sends the post to the Stories row, and a Creator busy with another run was skipped at once.
const root = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => slurp2Source(join(root, path));

const operation = read("server/src/services/slurp/slurp-post.operation.ts");
const targeted = operation.slice(operation.indexOf("export async function refreshTargetedCreatorsNow"));
assert.match(targeted, /\{ allowStory: false, playerAsked: true \}/u, "manual refresh must not produce Stories");
assert.match(
  targeted,
  /while \(result\.status === "busy" && Date\.now\(\) - startedAt < MANUAL_REFRESH_BUSY_WAIT_MS\)/u,
);

const generation = read("server/src/services/slurp/slurp-generation.service.ts");
assert.match(generation, /input\.allowStory !== false && variation\?\.story === true/u);

// The names toast moved off the Backstage monolith's split and into the hook that owns the
// mutation (the state layer, not a component); read it directly rather than through the
// SlurpSettings.tsx component key, which tests/slurp2-client-hooks.regression.ts relies on
// excluding from the state-layer hook inventory.
const refreshHooks = read("client/src/slp/features/creators/slp-creator-refresh-hooks.ts");
assert.match(refreshHooks, /slurpRefreshOutcomeNames\(result\.outcomes, outcomeClass, nameFor\)/u);
// A Creator missing from the account cache gets a neutral label, never a raw account id.
assert.match(refreshHooks, /byId\.get\(accountId\) \?\? t\("ui\.slurp\.ties\.someone"\)/u);

// The result toast's counts and names must agree: both read the same classifier, so a Creator who
// is "busy" or "disabled" is never counted as skipped but named as failed, or the reverse.
const outcome = (accountId: string, status: SlpCreatorRefreshNowOutcome["status"]): SlpCreatorRefreshNowOutcome => ({
  accountId,
  status,
});

// Only busy: all five count and name as skipped, none as failed.
{
  const outcomes = ["a", "b", "c", "d", "e"].map((id) => outcome(id, "busy"));
  assert.deepEqual(countSlurpRefreshOutcomes(outcomes), { made: 0, skipped: 5, failed: 0 });
  for (const o of outcomes) assert.equal(classifySlurpRefreshOutcome(o.status), "skipped");
  const { names, extra } = slurpRefreshOutcomeNames(outcomes, "skipped", (id) => id);
  assert.deepEqual(names, ["a", "b", "c", "d", "e"]);
  assert.equal(extra, 0);
  assert.deepEqual(slurpRefreshOutcomeNames(outcomes, "failed", (id) => id).names, []);
}

// busy + error: one skipped bucket, one failed bucket, and the counts match the name lists.
{
  const outcomes = [outcome("a", "busy"), outcome("b", "error"), outcome("c", "disabled")];
  assert.deepEqual(countSlurpRefreshOutcomes(outcomes), { made: 0, skipped: 2, failed: 1 });
  assert.deepEqual(slurpRefreshOutcomeNames(outcomes, "skipped", (id) => id).names, ["a", "c"]);
  assert.deepEqual(slurpRefreshOutcomeNames(outcomes, "failed", (id) => id).names, ["b"]);
}

// More than 5 names: capped at 5, the rest counted in `extra`, not silently dropped.
{
  const outcomes = ["a", "b", "c", "d", "e", "f", "g"].map((id) => outcome(id, "skipped"));
  const { names, extra } = slurpRefreshOutcomeNames(outcomes, "skipped", (id) => id);
  assert.deepEqual(names, ["a", "b", "c", "d", "e"]);
  assert.equal(extra, 2);
}

// A Creator not in the name lookup (the onboarding wizard's first batch has no account cache yet)
// falls back to the caller's neutral label instead of leaking a raw account id.
{
  const outcomes = [outcome("uncached-id", "skipped")];
  const { names } = slurpRefreshOutcomeNames(outcomes, "skipped", (id) => (id === "uncached-id" ? "Someone" : id));
  assert.deepEqual(names, ["Someone"]);
}

console.log("slurp2 manual refresh regression passed");
