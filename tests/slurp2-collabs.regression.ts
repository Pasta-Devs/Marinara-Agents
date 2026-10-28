import assert from "node:assert/strict";

import { slurpCollabPartners } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-project.js";
import { slurpCrossoverPartner } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-arc-crossover.js";

const candidates = [
  { id: "tagged", tags: ["gym"], related: false, eligible: true },
  { id: "paired", tags: [], related: false, eligible: true },
  { id: "paired-busy", tags: [], related: false, eligible: false },
];
// Find a day the one-in-four roll fires, then check who gets picked.
let at: Date | null = null;
for (let day = 0; day < 40 && !at; day += 1) {
  const candidate = new Date(day * 86_400_000);
  if (slurpCrossoverPartner({ creatorAccountId: "me", at: candidate, creatorTags: ["gym"], candidates }))
    at = candidate;
}
assert.ok(at);
assert.equal(
  slurpCrossoverPartner({
    creatorAccountId: "me",
    at,
    creatorTags: ["gym"],
    candidates,
    collabIds: ["paired", "paired-busy"],
  }),
  "paired",
  "an eligible collab partner beats a tag match; an ineligible one is skipped",
);
assert.equal(
  slurpCrossoverPartner({ creatorAccountId: "me", at, creatorTags: ["gym"], candidates, collabIds: ["paired-busy"] }),
  "tagged",
  "with no eligible collab partner the tag match still applies",
);

const collabs = [
  { creatorIds: ["me", "you"] as [string, string], content: "joint photo sets" },
  { creatorIds: ["them", "me"] as [string, string], content: "" },
];
assert.deepEqual(slurpCollabPartners(collabs, "me"), [
  { partnerId: "you", content: "joint photo sets" },
  { partnerId: "them", content: "" },
]);
assert.deepEqual(slurpCollabPartners(collabs, "nobody"), []);

console.log("slurp2 collabs regression passed");
