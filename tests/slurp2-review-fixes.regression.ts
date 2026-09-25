import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) =>
  readFileSync(join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/server/src/slp", path), "utf8");

// A retried or rewritten slot keeps its promise or claimed campaign stage.
const plan = read("features/feed/slp-post-plan-service.ts");
assert.match(plan, /\(slotPlan\?\.sourceEventId \? slotPlan : null\) \?\?/u);
assert.match(plan, /entry\.status === "claimed" && entry\.opportunityId === slotPlan\.id/u);
// An arc post in a teaser slot gets no card beat beside the project block.
assert.match(plan, /!\(isTeaser && ctx\.beats\.arc\)/u);

// Beat facts never crowd out the Creator's limits and notes: only the newest few stay active.
const beats = read("features/feed/slp-post-beat-service.ts");
assert.match(beats, /const SLURP_ACTIVE_BEAT_FACTS = 3;/u);
assert.match(beats, /moveSlurpContinuityStatus\(db, "fact", fact\.id, "expired", at\)/u);
// The background card read never replaces the player's edited anchors.
assert.match(beats, /writeAnchors\(db, accountId, \{ key, anchors \}, true\)/u);

// The memory block is identity-protected like the rest of the prompt.
const prompt = read("features/feed/slp-post-prompt.ts");
assert.match(prompt, /protectCreatorGeneratedIdentity\(\s*input\.continuityInstruction\?\.trim\(\) \?\? ""/u);

// Staleness is judged on the content hash at every fingerprint site.
for (const path of [
  "data/feed/reserve/slp-reserve-storage-1.ts",
  "data/feed/reserve/slp-reserve-storage-2.ts",
  "features/feed/reserve/slp-reserve-operation.ts",
]) {
  assert.doesNotMatch(read(path), /slpCreatorReservePolicyFingerprint\(/u, path);
  assert.match(read(path), /slpCreatorReserveFingerprintFor\(/u, path);
}

console.log("slurp2 review fixes regression checks passed");
