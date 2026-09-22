import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

const routes = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/creators/slp-continuity-routes.ts",
);
const storage = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/data/continuity/slp-continuity-storage.ts",
);
const panel = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/slp/features/creators/SlpContinuityPanel.tsx",
);
const creators = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/slp/features/creators/SlpCreatorsPanel.tsx",
);

// The editor is the only surface that reads everything, including records no prompt may read.
assert.match(storage, /listSlurpContinuityFor\(db, creatorAccountId, "creator_editor", \{ at, limit: 200 \}\)/u);
assert.match(routes, /listSlurpContinuityForEditor\(app\.db, creatorAccountId\)/u);
// Plans and quiet slots are visible next to the records they produced.
assert.match(routes, /listSlurpOpportunities\(app\.db, creatorAccountId, 25\)/u);

// Everything the plan asks the editor to do has a route.
for (const route of [
  /app\.get\("\/continuity\/:creatorAccountId"/u,
  /app\.post\("\/continuity\/:creatorAccountId\/facts"/u,
  /app\.patch\("\/continuity\/facts\/:id"/u,
  /app\.post\("\/continuity\/:target\/:id\/retract"/u,
  /app\.post\("\/continuity\/proposals\/:id\/:decision"/u,
  /app\.post\("\/continuity\/facts\/:id\/promote"/u,
]) {
  assert.match(routes, route, `missing route ${route}`);
}
// Unknown targets and decisions are refused rather than guessed at.
assert.match(routes, /if \(target !== "facts" && target !== "events"\) return reply\.code\(404\)/u);
assert.match(routes, /if \(decision !== "approve" && decision !== "reject"\) return reply\.code\(404\)/u);
// Written text is bounded and typed, the same way the extractor's is.
assert.match(routes, /text: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(SLURP_CONTINUITY_TEXT_MAX\)/u);
assert.match(routes, /factType: z\.enum\(SLURP_CONTINUITY_FACT_TYPES\)/u);
// A note the player writes is private until they publish it.
assert.match(routes, /audienceScope: z\.enum\(SLURP_AUDIENCE_SCOPES\)\.default\("creator_private"\)/u);

// Approving writes the proposed record as a manual contribution; rejecting closes it for good.
assert.match(storage, /status: decision === "approve" \? "applied" : "rejected"/u);
assert.match(storage, /if \(String\(row\.status\) !== "pending"\) return "not_pending";/u);
assert.match(
  storage,
  /createSlurpContinuityFact\(db, \{ \.\.\.candidate, status: "active", contribution: "manual" \}, at\)/u,
);

// The panel: approve, reject, edit, retract, publish, search, and the plans behind the posts.
assert.match(creators, /"continuity"/u, "the Creator page has a continuity tab");
assert.match(creators, /<SlurpContinuityPanel creatorAccountId=\{selectedCreator\.id\}/u);
for (const action of [
  /proposals\/\$\{encodeURIComponent\(proposal\.id\)\}\/\$\{decision\}/u,
  /facts\/\$\{encodeURIComponent\(fact\.id\)\}\/retract/u,
  /facts\/\$\{encodeURIComponent\(fact\.id\)\}\/promote/u,
]) {
  assert.match(panel, action, `the panel cannot ${action}`);
}
assert.match(panel, /useSlurpContinuityEdit/u);
assert.match(panel, /placeholder=\{t\("ui\.slurp\.continuity\.search"/u);
// Evidence is shown, so a remembered line can be checked against what was actually said.
assert.match(panel, /ui\.slurp\.continuity\.evidence/u);
// Publishing never offers the scope a fact already has, and only widens toward the Creator's own.
assert.match(panel, /PROMOTION_TARGETS\.filter\(\(target\) => target !== fact\.audienceScope\)/u);
assert.match(panel, /const PROMOTION_TARGETS = \["creator_private", "creator_public", "cross_platform"\] as const;/u);
// A retracted record is not editable, retractable, or publishable again.
assert.equal((panel.match(/fact\.status === "retracted"/gu) ?? []).length, 3);

console.log("slurp continuity editor regression checks passed");

// A proposal whose source messages changed or vanished is refused as stale, never applied.
assert.match(storage, /slurpExtractionSourceHash\(current\) !== String\(row\.sourceHash\)/u);
assert.match(storage, /set\(\{ status: "stale", reviewedAt: at\.toISOString\(\), reviewer: "system" \}\)/u);
// Links are deleted with their Creator.
assert.match(storage, /tx\.delete\(slurpContinuityLinks\)/u);
// Message requests open the Creator's continuity editor directly.
const requestsPanel = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/slp/features/messages/SlpThreadRequestsPanel.tsx",
);
assert.match(requestsPanel, /<SlpOpenContinuityButton/u);
assert.match(creators, /openContinuity\(continuityCreatorId\)/u);
assert.match(creators, /<SlpContinuityOverview onOpen=\{openContinuity\} \/>/u);
