/**
 * Fan comments (slurp2 0.4.7): a fan line never repeats one already under the post, short titles get
 * quoted, a fan's question can come back as a callback, and the business arcs ship.
 */
import assert from "node:assert/strict";
import {
  slurpAudienceQuestion,
  slurpAudienceReactionFrom,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/slp-world-copy.ts";
import { slurpReferenceCandidates } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-reference.ts";
import { SLURP_ARC_LIBRARY_SEED } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-arc-library.ts";

// No repeat: with the first pick already under the post, the next fan picks another line.
for (let index = 0; index < 50; index += 1) {
  const seed = `post-${index}:fan`;
  const first = slurpAudienceQuestion(seed);
  assert.notEqual(slurpAudienceQuestion(seed, { taken: [first.toLowerCase()] }), first, `question repeats for ${seed}`);
  const reaction = slurpAudienceReactionFrom(seed, []);
  const again = slurpAudienceReactionFrom(seed, [], { taken: [reaction.toLowerCase()] });
  assert.notEqual(again, reaction, `reaction repeats for ${seed}`);
}

// Titles: a short title shows up in some lines, a long one never does.
const seeds = Array.from({ length: 120 }, (_, index) => `titled-${index}`);
const short = seeds.map((seed) => slurpAudienceQuestion(seed, { title: '"Gym day"' }));
assert.ok(
  short.some((line) => line.includes('"Gym day"')),
  "a short title is quoted",
);
assert.ok(!short.some((line) => line.includes('""')), "quotes are trimmed");
const long = "A very long title that goes on and on about the whole day at the gym";
assert.ok(
  seeds.every((seed) => !slurpAudienceQuestion(seed, { title: long }).includes(long)),
  "a long title is never quoted",
);
assert.ok(
  seeds.some((seed) => slurpAudienceReactionFrom(seed, [], { title: "Gym day" }).includes('"Gym day"')),
  "reactions quote a short title too",
);

// A titled line already under the post is not picked again, and a `$` in a title stays as typed.
for (const seed of seeds) {
  const first = slurpAudienceReactionFrom(seed, [], { title: "Gym day" });
  const again = slurpAudienceReactionFrom(seed, [], { title: "Gym day", taken: [first.toLowerCase()] });
  assert.notEqual(again, first, `titled reaction repeats for ${seed}`);
}
assert.ok(
  seeds.some((seed) => slurpAudienceQuestion(seed, { title: "Only $' left" }).includes('"Only $\' left"')),
  "a $ in a title is not a replace pattern",
);

// A fan question becomes a callback inside the window, not after it.
const at = new Date("2026-10-28T12:00:00.000Z");
const daysAgo = (days: number) => new Date(at.getTime() - days * 86_400_000).toISOString();
const question = (id: string, days: number) => ({
  id,
  handle: "milo",
  question: "when is the next drop?",
  postTitle: "Gym day",
  createdAt: daysAgo(days),
});
const references = slurpReferenceCandidates({
  posts: [],
  chatMoments: [],
  keptPromises: [],
  questions: [question("q1", 3), question("q2", 0.2), question("q3", 40)],
  at,
});
assert.deepEqual(
  references.map((reference) => reference.id),
  ["question:q1"],
);
assert.equal(references[0]!.kind, "question");
assert.match(references[0]!.text, /@milo .*"Gym day": "when is the next drop\?"/u);

// Business arcs are built in.
const arcIds = SLURP_ARC_LIBRARY_SEED.map((arc) => arc.id);
for (const id of ["sale_week", "burnout_break", "gear_upgrade", "leak_scare", "page_anniversary"])
  assert.ok(arcIds.includes(id), `${id} arc ships`);

// A bank with one unused line always returns it, and a spent titled bank falls back to the plain one.
const letters = Array.from({ length: 26 }, (_, n) => `body-${String.fromCharCode(97 + n)}`);
for (const seed of seeds.slice(0, 40)) {
  const reaction = slurpAudienceReactionFrom(seed, letters, { taken: letters.slice(1) });
  assert.ok(reaction.includes("body-a"), `the one unused line is picked for ${seed}`);
}
// Spend the titled bank one line at a time: once it is used up, no seed gets a titled line.
const spent: string[] = [];
for (let round = 0; round < 12; round += 1) {
  for (const seed of seeds) {
    const line = slurpAudienceReactionFrom(seed, letters, { title: "Gym day", taken: spent });
    if (line.includes('"Gym day"')) spent.push(line.toLowerCase());
  }
}
assert.ok(spent.length > 0, "titled lines exist");
assert.ok(
  seeds.every(
    (seed) => !slurpAudienceReactionFrom(seed, letters, { title: "Gym day", taken: spent }).includes('"Gym day"'),
  ),
  "a spent titled bank falls back to the plain bank",
);

console.log("slurp2 fan comments: ok");
