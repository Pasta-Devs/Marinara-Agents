import assert from "node:assert/strict";
import {
  SLURP_CAMPAIGN_MAX_AGE_MS,
  SLURP_CAMPAIGN_TEMPLATE,
  slurpCampaignStageCanMove,
  slurpNextCampaignStage,
  type SlurpCampaignStageView,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-campaign.ts";
import { slurp2Source } from "./slurp2-source";

const HOUR = 60 * 60_000;
const start = new Date("2026-09-21T12:00:00.000Z");
const later = (ms: number) => new Date(start.getTime() + ms);
const campaign = (statuses: Record<string, SlurpCampaignStageView["status"]>, id = "c1"): SlurpCampaignStageView[] =>
  SLURP_CAMPAIGN_TEMPLATE.map((stage, position) => ({
    id: `${id}-${stage.kind}`,
    campaignId: id,
    kind: stage.kind,
    position,
    access: stage.access,
    status: statuses[stage.kind] ?? "planned",
    dueAt: later(stage.delayMs).toISOString(),
  }));

// The shape: set first, then a public teaser that can preview it, then a callback a day on.
assert.deepEqual(
  SLURP_CAMPAIGN_TEMPLATE.map((stage) => stage.kind),
  ["set", "teaser", "callback"],
);
assert.equal(SLURP_CAMPAIGN_TEMPLATE[1]!.access, "public", "a teaser sells to people who have not paid");
assert.ok(SLURP_CAMPAIGN_TEMPLATE[2]!.delayMs >= 12 * HOUR, "a callback the same afternoon is not a callback");
assert.ok(SLURP_CAMPAIGN_MAX_AGE_MS > SLURP_CAMPAIGN_TEMPLATE[2]!.delayMs);

// A stage never runs before the stage it follows has finished: no teaser for a set that does not
// exist yet, even when the teaser is due.
const setPending = campaign({ set: "claimed" });
assert.equal(slurpNextCampaignStage(setPending, { at: later(30 * HOUR), access: "public" }), null);

// Once the set is done, the teaser runs only when due and only in a public slot.
const setDone = campaign({ set: "completed" });
assert.equal(slurpNextCampaignStage(setDone, { at: later(HOUR), access: "public" }), null, "not before it is due");
assert.equal(slurpNextCampaignStage(setDone, { at: later(3 * HOUR), access: "locked" }), null, "not in a locked slot");
assert.equal(slurpNextCampaignStage(setDone, { at: later(3 * HOUR), access: "public" })?.kind, "teaser");
// The callback waits for the teaser, unless the teaser was let go.
assert.equal(slurpNextCampaignStage(setDone, { at: later(30 * HOUR), access: "locked" }), null);
assert.equal(
  slurpNextCampaignStage(campaign({ set: "completed", teaser: "skipped" }), { at: later(30 * HOUR), access: "locked" })
    ?.kind,
  "callback",
);
assert.equal(
  slurpNextCampaignStage(campaign({ set: "completed", teaser: "completed" }), {
    at: later(30 * HOUR),
    access: "public",
  })?.kind,
  "callback",
);
// Finished campaigns offer nothing.
assert.equal(
  slurpNextCampaignStage(campaign({ set: "completed", teaser: "completed", callback: "completed" }), {
    at: later(40 * HOUR),
    access: "public",
  }),
  null,
);
// Two campaigns do not block each other; the earliest due stage goes first.
const two = [...campaign({ set: "completed" }, "a"), ...campaign({ set: "claimed" }, "b")];
assert.equal(slurpNextCampaignStage(two, { at: later(3 * HOUR), access: "public" })?.campaignId, "a");

// Stage transitions: only open stages move, and a finished stage stays finished.
assert.ok(slurpCampaignStageCanMove("planned", "claimed"));
assert.ok(slurpCampaignStageCanMove("planned", "skipped"));
assert.ok(slurpCampaignStageCanMove("claimed", "completed"));
for (const done of ["completed", "skipped", "cancelled"] as const) {
  for (const to of ["planned", "claimed", "completed", "skipped", "cancelled"] as const) {
    assert.ok(!slurpCampaignStageCanMove(done, to), `${done} must be final`);
  }
}

// Wiring.
const plan = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-post-plan-service.ts");
// A due stage takes an undirected slot, but never outranks the player's own direction or purpose.
assert.match(plan, /!directed && !chosen && !previewOnly\s*\?\s*await listOpenSlurpCampaignStages/u);
assert.match(plan, /const forced = chosen \?\? \(stage \? slurpCampaignStageIntent\(stage\.kind\) : undefined\);/u);
// The teaser previews its own set's picture, cropped on the server.
assert.match(plan, /other\.kind === "set"\)\?\.postId/u);
assert.match(plan, /stage\?\.kind === "teaser" && reuse\.preview[\s\S]*?delivery: "cropped_preview"/u);
// The stage is claimed by the plan running it; a set outside a campaign opens one.
assert.match(plan, /moveSlurpCampaignStage\(db, stage, "claimed", \{ at, opportunityId: opportunity\.id \}\)/u);
assert.match(plan, /axes\?\.intent === "set"[\s\S]*?openSlurpCampaign\(db, \{/u);
// Every path that completes a plan also advances its stage.
for (const file of [
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-generation-service.ts",
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/reserve/slp-reserve-operation.ts",
]) {
  assert.match(slurp2Source(file), /completeSlurpCampaignStageFor\(db, opportunity\.id,/u, file);
}
const storage = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/data/feed/slp-campaign-storage.ts");
// Stages count from publication, and expired campaigns cancel their unfinished stages.
assert.match(storage, /const at = \(input\.dueAt \?\? input\.at\)\.getTime\(\);/u);
assert.match(storage, /await closeSlurpCampaign\(db, String\(campaign\.id\), "cancelled", at\);/u);
assert.match(storage, /if \(!slurpCampaignStageCanMove\(stage\.status, to\)\) return false;/u);

console.log("slurp campaign regression checks passed");
