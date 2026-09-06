import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  slurpPostBeat,
  slurpPostBeatInstruction,
  slurpStorySlots,
  SLURP_POST_FORMATS,
  SLURP_STORY_RATE,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-post-beat.js";

// ── Consecutive posts must differ ───────────────────────────────────────────
// This is the whole point. A random draw can repeat; rotation cannot, and repetition of situation
// is exactly what made an office worker post from the same desk in the same pose every time.
for (const creator of ["creator-a", "creator-b", "creator-c"]) {
  for (let index = 0; index < 400; index += 1) {
    const current = slurpPostBeat(creator, index);
    const next = slurpPostBeat(creator, index + 1);
    assert.notEqual(current.place, next.place, `${creator} repeated a place at ${index}`);
    assert.notEqual(current.framing, next.framing, `${creator} repeated a framing at ${index}`);
    assert.notEqual(current.moment, next.moment, `${creator} repeated a moment at ${index}`);
  }
}

// Deterministic, so the same post always carries the same angle rather than shifting on re-read.
assert.deepEqual(slurpPostBeat("creator-a", 7), slurpPostBeat("creator-a", 7));
// Two Creators set up together must not march through the cycle in lockstep.
assert.notDeepEqual(slurpPostBeat("creator-a", 0), slurpPostBeat("creator-b", 0));

// Nonsense sequence numbers must still produce a usable beat.
for (const sequence of [-5, 0.5, Number.NaN]) {
  const beat = slurpPostBeat("creator-a", sequence);
  assert.ok(beat.place && beat.framing && beat.moment && beat.company, `no beat for ${sequence}`);
  assert.ok(SLURP_POST_FORMATS.includes(beat.format));
}

// ── The format mix stays believable ─────────────────────────────────────────
// Auto-posting hardcoded `caption`, so three of four formats never fired. Rotating them is the
// cheapest change to the feed — but a page of essays is as monotonous as a page of one-liners.
const formats = new Map<string, number>();
for (let index = 0; index < 800; index += 1) {
  const format = slurpPostBeat("creator-a", index).format;
  formats.set(format, (formats.get(format) ?? 0) + 1);
}
assert.equal(formats.size, SLURP_POST_FORMATS.length, "every format must appear");
assert.ok((formats.get("caption") ?? 0) / 800 > 0.4, "a creator page is mostly short captions");
assert.ok((formats.get("long_form") ?? 0) / 800 < 0.25, "long form must not take over the feed");

// ── The instruction varies along axes, never dictating a scene ──────────────
// "Somewhere other than where you usually post" lets the character's own life answer. A concrete
// setting would overwrite the character card, which is the opposite of "same person, different
// life".
const instruction = slurpPostBeatInstruction(slurpPostBeat("creator-a", 3));
assert.match(instruction, /Keep the person exactly as the character card describes them/u);
assert.match(instruction, /directions to vary along, not a scene to copy/u);

// ── Wiring ──────────────────────────────────────────────────────────────────
const root = join(import.meta.dirname, "..", "packages/slurp/src/engine/packages/server/src");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const generation = read("services/slurp/slurp-generation.service.ts");
// The model could not see what it had already depicted, so it reinvented the same picture.
assert.match(generation, /post\.imagePrompt \? .*showed:.* : line/u);
// "Do not reuse their exact wording" is satisfied by eight captions about one desk.
assert.match(generation, /Do not repeat a recent post's setting, activity, framing, or wardrobe/u);
assert.match(
  generation,
  /slurpPostBeat\(account\.id, await noodle\.countNoodlerPostsByAccount\(account\.id\), settings\.storyRate\)/u,
);

// The automatic path pinned the format and passed a constant guide. Between them they defeated
// every variety mechanism on the one path that generates most posts.
const reserve = read("services/slurp/slurp-reserve.operation.ts");
assert.doesNotMatch(reserve, /format: "caption"/u, "automatic posts must not pin one format");
assert.doesNotMatch(reserve, /noodlerPostGuide:/u, "a constant guide reads as player direction");

// ── The clock must be used, not just supplied ───────────────────────────────
// The exact date and time were already in the prompt and nothing asked the model to place the post
// inside the character's day, so every post read as happening in the same undefined moment. For a
// Creator with no Conversation Schedule that is the only situational anchor available.
const timing = read("services/slurp/slurp-post-timing.ts");
assert.match(timing, /Place this post inside the character's own day at that hour and weekday/u);
assert.match(timing, /A Tuesday morning and a Saturday night are different posts from the same person/u);

// ── Stories ────────────────────────────────────────────────────────────────
// Automatic posting only ever produced feed posts, so the Story shelf could only be filled by hand.
{
  for (const creator of ["creator-a", "creator-b", "creator-c", "creator-d"]) {
    let stories = 0;
    for (let index = 0; index < 400; index += 1) {
      const beat = slurpPostBeat(creator, index);
      if (!beat.story) continue;
      stories += 1;
      // A Story is a picture with one line under it. An announcement or an essay is not one.
      assert.equal(beat.format, "caption", `${creator} made a ${beat.format} a Story at ${index}`);
    }
    assert.ok(stories > 0, `${creator} never posts a Story`);
    assert.ok(stories < 200, `${creator} posts too many Stories: ${stories}/400`);
  }
  const storyIndex = Array.from({ length: 40 }, (_, index) => index).find(
    (index) => slurpPostBeat("creator-a", index).story,
  );
  assert.notEqual(storyIndex, undefined);
  assert.match(slurpPostBeatInstruction(slurpPostBeat("creator-a", storyIndex!)), /This one is a Story/u);
  assert.doesNotMatch(slurpPostBeatInstruction(slurpPostBeat("creator-a", storyIndex!, "off")), /This one is a Story/u);
}

// The Stories setting is a real dial: `off` means off, and the rate is monotonic.
{
  const share = (rate: (typeof SLURP_STORY_RATE)[number]) => {
    let stories = 0;
    for (const creator of ["creator-a", "creator-b", "creator-c"]) {
      for (let index = 0; index < 400; index += 1) if (slurpPostBeat(creator, index, rate).story) stories += 1;
    }
    return stories;
  };
  assert.equal(share("off"), 0, "off must be a real off switch, not a quieter setting");
  assert.ok(share("rare") > 0);
  assert.ok(share("rare") < share("regular"), "rare must be rarer than regular");
  assert.ok(share("regular") < share("often"), "often must be more than regular");
  // Only caption slots may become Stories, whatever the rate.
  for (const rate of SLURP_STORY_RATE) {
    for (const slot of slurpStorySlots(rate)) assert.ok(slot % 2 === 0, `${rate} put a Story on slot ${slot}`);
    for (const creator of ["creator-a", "creator-b"]) {
      for (let index = 0; index < 100; index += 1) {
        const beat = slurpPostBeat(creator, index, rate);
        if (beat.story) assert.equal(beat.format, "caption");
      }
    }
  }
  // An unset or unknown rate must behave as the shipped default rather than silently disabling.
  assert.deepEqual([...slurpStorySlots(undefined)], [...slurpStorySlots("regular")]);
}

console.log("slurp post beat regression passed");
