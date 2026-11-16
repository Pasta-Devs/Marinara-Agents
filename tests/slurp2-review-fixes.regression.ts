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
assert.match(plan, /!\(isTeaser && ctx\.beats\.arc && !nudged\)/u);

// Beat facts never crowd out the Creator's limits and notes: only the newest few stay active.
const beats = read("features/feed/slp-post-beat-service.ts");
assert.match(beats, /const SLURP_ACTIVE_BEAT_FACTS = 3;/u);
assert.match(beats, /moveSlurpContinuityStatus\(db, "fact", fact\.id, "expired", at\)/u);
// The background card read never replaces the player's edited anchors: proved on a real store in
// `slurp2-anchor-edits.regression.ts`. Here: the beat service reads through that one store.
assert.match(beats, /slurpCanonAnchorsFor\(db, accountId, readingText\(context\), at,/u);

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

// A post answer cut off by the token limit goes to the correction turn, which asks for a shorter post; an answer
// that still closes on `}` is kept even when a stray quote fools the scan.
assert.match(prompt, /jsonishLooksTruncated\(answer\) && !\/\[\}\\\]\]/u);
assert.match(prompt, /error\.message === SLURP_POST_CUT_OFF[\s\S]*Write a shorter post/u);

// "Resolve" claims the Creator before it reads the desk, so a double tap gets one line and one reply.
const desk = read("features/messages/desk/slp-desk-routes.ts");
const resolve = desk.slice(desk.indexOf('"/slurp/desk/ticket/resolve"'), desk.indexOf('"/slurp/desk/offer/answer"'));
assert.ok(
  resolve.indexOf("resolving.add(") > 0 && resolve.indexOf("resolving.add(") < resolve.indexOf("readSlurpSupportDesk("),
);
assert.match(resolve, /finally \{\s*resolving\.delete\(/u);

console.log("slurp2 review fixes regression checks passed");
