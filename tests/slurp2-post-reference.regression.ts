import assert from "node:assert/strict";
import {
  selectSlurpReference,
  slurpReferenceCandidates,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-reference.ts";
import {
  checkSlurpBeatClaims,
  slurpPostBriefSection,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-brief.ts";

const at = new Date("2026-09-25T12:00:00.000Z");
const daysAgo = (days: number) => new Date(at.getTime() - days * 86_400_000).toISOString();

// Candidates are facts, not captions: a beat line, a set title, a saved chat moment, a delivered label.
const candidates = slurpReferenceCandidates({
  posts: [
    { id: "fresh", title: "Today", createdAt: daysAgo(0.2), metadata: { slurpBeat: { line: "too fresh" } } },
    { id: "p1", title: "Cape", createdAt: daysAgo(3), metadata: { slurpBeat: { line: "You finish the red cape" } } },
    { id: "s1", title: "Neon set", createdAt: daysAgo(5), metadata: { contentIntent: "set" } },
    { id: "plain", title: "Coffee", createdAt: daysAgo(4), metadata: {} },
    { id: "old", title: "Old", createdAt: daysAgo(45), metadata: { slurpBeat: { line: "too old" } } },
  ],
  chatMoments: [{ id: "f1", text: "the evening at the bar with the regulars" }],
  keptPromises: [
    { id: "o1", topic: "red dress set", completedAt: daysAgo(2) },
    { id: "o2", topic: "", completedAt: daysAgo(2) },
  ],
  at,
});
assert.deepEqual(
  candidates.map((candidate) => candidate.id),
  ["post:p1", "set:s1", "chat:f1", "promise:o1"],
);
assert.equal(candidates[0]!.text, "an earlier post of yours: You finish the red cape");
assert.ok(!candidates.some((candidate) => /Coffee/u.test(candidate.text)), "a caption without a beat is never quoted");

// About one post in three refers back, and a recent reference is not repeated.
let referred = 0;
for (let sequence = 0; sequence < 600; sequence += 1) {
  if (selectSlurpReference("creator-r", sequence, candidates, [])) referred += 1;
}
assert.ok(referred > 140 && referred < 260, `referred ${referred} of 600`);
for (let sequence = 0; sequence < 100; sequence += 1) {
  const pick = selectSlurpReference("creator-r", sequence, candidates, ["chat:f1"]);
  assert.notEqual(pick?.id, "chat:f1");
}
assert.equal(selectSlurpReference("creator-r", 1, [], []), null);

// The brief offers it once, and the claim check accepts it as a supported earlier event.
const beat = {
  type: "opinion" as const,
  anchorKind: "places" as const,
  anchor: "the bar",
  line: "You judge the new menu at the bar",
  cast: [],
  place: "the bar",
  reference: candidates[2]!,
};
assert.match(
  slurpPostBriefSection(beat, at, (value) => value),
  /Callback: you may refer back to the evening at the bar with the regulars, in passing\./u,
);
const claims = { people: [], earlierEvents: ["that evening with the regulars"], stateChanges: [] };
assert.equal(checkSlurpBeatClaims(claims, beat, []).ok, true);
assert.equal(checkSlurpBeatClaims(claims, { ...beat, reference: undefined }, []).ok, false);

console.log("slurp2 post reference regression checks passed");
