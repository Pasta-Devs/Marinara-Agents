// Mood is the fast layer rapport cannot express. The rules that matter are the damping ones: a
// long-standing fan is forgiven a bad message, a stranger is not, and silence heals.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  applySlurpMood,
  recoverSlurpMood,
  slurpMoodTone,
  SLURP_MOOD_MAX,
  SLURP_MOOD_MIN,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-mood.js";
import { readSlurpDmReply } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-dm-response.js";

const apply = (mood: number, shift: Parameters<typeof applySlurpMood>[0]["shift"], rapportScore = 0) =>
  applySlurpMood({ mood, shift, rapportScore, minutesSinceUpdate: 0 });

// A direction, never a position. One message cannot move the whole range.
assert.ok(apply(0, "sharp_down") > SLURP_MOOD_MIN, "one message must not bottom out the mood");
assert.ok(apply(0, "up") < SLURP_MOOD_MAX, "one message must not max out the mood");
assert.equal(apply(12, "same"), 12);

// History buys credit, and only against a fall. A whale is forgiven what a stranger is not.
const strangerFall = apply(0, "down", 0);
const whaleFall = apply(0, "down", 100);
assert.ok(whaleFall > strangerFall, "rapport must soften a fall");
assert.equal(apply(0, "up", 0), apply(0, "up", 100), "rapport must not inflate a rise");

// Diminishing returns near the top, the same shape `scoreSlurpRapport` uses for its signals.
assert.ok(apply(90, "up") - 90 < apply(0, "up") - 0, "a rise must shrink as the mood approaches the cap");

// Clamped at both ends whatever the history.
let low = 0;
for (let index = 0; index < 40; index += 1) low = apply(low, "sharp_down");
assert.ok(low >= SLURP_MOOD_MIN);
let high = 0;
for (let index = 0; index < 40; index += 1) high = apply(high, "up");
assert.ok(high <= SLURP_MOOD_MAX);

// Silence heals, and never past neutral in either direction.
assert.ok(recoverSlurpMood(-60, 60 * 5) > -60);
assert.equal(recoverSlurpMood(-60, 60 * 1000), 0);
assert.equal(recoverSlurpMood(60, 60 * 1000), 0);
assert.equal(recoverSlurpMood(0, 10_000), 0);

// Bands are what the prompt reads.
assert.equal(slurpMoodTone(40), "warm");
assert.equal(slurpMoodTone(0), "neutral");
assert.equal(slurpMoodTone(-40), "cool");
assert.equal(slurpMoodTone(-80), "cold");

// A reply with good words and no envelope is still the thing the fan asked for. Never fail a
// message because the simulation's extra fields were missing.
assert.deepEqual(readSlurpDmReply({ content: "hey" }), {
  content: "hey",
  moodShift: "same",
  remember: [],
  stateSignals: [],
});
assert.deepEqual(readSlurpDmReply("hey"), { content: "hey", moodShift: "same", remember: [], stateSignals: [] });
assert.equal(readSlurpDmReply({ content: "hey", tone: "playful" }).content, "hey", "unknown fields must be dropped");
assert.equal(readSlurpDmReply({ content: "hey", moodShift: "nonsense" }).moodShift, "same");
assert.equal(readSlurpDmReply({ content: "hey", remember: ["a", "b", "c"] }).remember.length, 2);
assert.deepEqual(readSlurpDmReply({ content: "hey", remember: ["  ", "kept"] }).remember, [
  { op: "add", text: "kept" },
]);
assert.throws(() => readSlurpDmReply({ moodShift: "up" }), /no usable content/u);

// The contract is defined locally. `@marinara-engine/shared` owns the comment-reply schema and is
// not in this repo, so the direct-message fields cannot be added there.
const generation = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-message-generation.service.ts",
  "utf8",
);
assert.doesNotMatch(generation, /noodleGeneratedNoodlerReplySchema/u);
assert.match(generation, /noodleResponseFormat\(input\.connection\.model, "noodler_dm"\)/u);

// Notes are model output about the player, stored and replayed into a later prompt. They are
// redacted on the way in and on the way out, and they never reach the system block.
assert.match(generation, /remember: generated\.remember[\s\S]{0,200}?protectNoteOperation/u);
assert.match(generation, /knownAboutFan: \{[\s\S]{0,240}?working: known\.working/u);

const storage = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/storage/slurp-messages.storage.ts",
  "utf8",
);
assert.match(storage, /applySlurpThreadNotes\(thread\.notes, input\.remember\)/u);

// The reply is what the fan asked for. Recording the simulation around it must never lose it.
const operation = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-message.operation.ts",
  "utf8",
);
assert.match(operation, /recordReplyOutcome\(thread\.id[\s\S]{0,160}?\.catch\(/u);

console.log("slurp chat mood regression passed");
