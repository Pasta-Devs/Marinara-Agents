import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  slurpPostBeat,
  slurpPostBeatInstruction,
  SLURP_POST_FORMATS,
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
assert.match(generation, /slurpPostBeat\(account\.id, await noodle\.countNoodlerPostsByAccount\(account\.id\)\)/u);

// The automatic path pinned the format and passed a constant guide. Between them they defeated
// every variety mechanism on the one path that generates most posts.
const reserve = read("services/slurp/slurp-reserve.operation.ts");
assert.doesNotMatch(reserve, /format: "caption"/u, "automatic posts must not pin one format");
assert.doesNotMatch(reserve, /noodlerPostGuide:/u, "a constant guide reads as player direction");

console.log("slurp post beat regression passed");
