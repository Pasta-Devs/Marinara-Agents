import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { readSlurpDmReply } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-dm-response.js";
import {
  applySlurpThreadNotes,
  notesForPrompt,
  readSlurpNoteOperations,
  readStoredNotes,
  SLURP_LONGTERM_NOTE_LIMIT,
  SLURP_WORKING_NOTE_LIMIT,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-thread-notes.js";

const name = { id: "l1", text: "name is Alex", tier: "longterm" as const };

assert.deepEqual(readStoredNotes("[]"), []);
assert.deepEqual(readStoredNotes("not-json"), []);
assert.deepEqual(readStoredNotes({}), []);

const migrated = readStoredNotes(JSON.stringify(["name is Alex", "works night shifts at a hospital"]));
assert.deepEqual(
  migrated.map((note) => note.text),
  ["name is Alex", "works night shifts at a hospital"],
);
assert.equal(
  migrated.every((note) => note.tier === "working"),
  true,
);

const overflow = Array.from({ length: 12 }, (_, index) => `fact ${index + 1}`);
const overflowed = readStoredNotes(JSON.stringify(overflow));
assert.equal(overflowed.filter((note) => note.tier === "longterm").length, 4);
assert.equal(overflowed.filter((note) => note.tier === "working").length, SLURP_WORKING_NOTE_LIMIT);
assert.equal(overflowed[0]?.text, "fact 1");
assert.equal(overflowed.at(-1)?.text, "fact 12");

const structured = readStoredNotes(
  JSON.stringify([
    { id: "w3", text: "works night shifts at a hospital", tier: "working" },
    { id: "l1", text: "name is Alex", tier: "longterm" },
  ]),
);
assert.deepEqual(structured, [{ id: "w3", text: "works night shifts at a hospital", tier: "working" }, name]);

assert.deepEqual(readSlurpNoteOperations(["new cat named Bean"]), [{ op: "add", text: "new cat named Bean" }]);
assert.deepEqual(readSlurpNoteOperations([{ op: "forget", id: "w3" }]), [{ op: "forget", id: "w3" }]);
assert.deepEqual(readSlurpNoteOperations([{ op: "keep", id: "w3" }]), [{ op: "keep", id: "w3" }]);
assert.deepEqual(readSlurpNoteOperations([{ op: "replace", id: "w3", text: "quit hospital job" }]), [
  { op: "replace", id: "w3", text: "quit hospital job" },
]);
assert.equal(readSlurpNoteOperations([{ op: "add" }, { op: "forget" }, "  "]).length, 0);
assert.equal(readSlurpNoteOperations(["a", "b", "c"]).length, 2);

const replaced = applySlurpThreadNotes(
  [{ id: "w3", text: "works night shifts at a hospital", tier: "working" }, name],
  [{ op: "replace", id: "w3", text: "quit hospital job" }],
);
assert.deepEqual(replaced.find((note) => note.id === "w3")?.text, "quit hospital job");
assert.equal(
  replaced.some((note) => note.text === "works night shifts at a hospital"),
  false,
);

const forgotten = applySlurpThreadNotes(
  [{ id: "w3", text: "works night shifts at a hospital", tier: "working" }, name],
  [{ op: "forget", id: "w3" }],
);
assert.deepEqual(forgotten, [name]);

const kept = applySlurpThreadNotes(
  [{ id: "w3", text: "has a cat named Bean", tier: "working" }, name],
  [{ op: "keep", id: "w3" }],
);
assert.equal(kept.find((note) => note.text === "has a cat named Bean")?.tier, "longterm");
assert.equal(
  kept.some((note) => note.id === "w3"),
  false,
);

const added = applySlurpThreadNotes([name], [{ op: "add", text: "starts a new job on Monday" }]);
assert.equal(added.at(-1)?.tier, "working");
assert.equal(added.at(-1)?.id, "w1");

assert.deepEqual(applySlurpThreadNotes([name], [{ op: "add", text: "name is Alex" }]), [name]);
assert.deepEqual(applySlurpThreadNotes([name], [{ op: "forget", id: "w9" }]), [name]);
assert.deepEqual(applySlurpThreadNotes([name], [{ op: "keep", id: "l1" }]), [name]);

const fullLongTerm = Array.from({ length: SLURP_LONGTERM_NOTE_LIMIT }, (_, index) => ({
  id: `l${index + 1}`,
  text: `stable ${index + 1}`,
  tier: "longterm" as const,
}));
const refusedKeep = applySlurpThreadNotes(
  [...fullLongTerm, { id: "w1", text: "temporary plan", tier: "working" }],
  [{ op: "keep", id: "w1" }],
);
assert.equal(refusedKeep.find((note) => note.id === "w1")?.tier, "working");
assert.equal(refusedKeep.filter((note) => note.tier === "longterm").length, SLURP_LONGTERM_NOTE_LIMIT);

const workingOverflow = applySlurpThreadNotes(
  Array.from({ length: SLURP_WORKING_NOTE_LIMIT }, (_, index) => ({
    id: `w${index + 1}`,
    text: `recent ${index + 1}`,
    tier: "working" as const,
  })),
  [{ op: "add", text: "newest fact" }],
);
assert.equal(workingOverflow.filter((note) => note.tier === "working").length, SLURP_WORKING_NOTE_LIMIT);
assert.equal(
  workingOverflow.some((note) => note.text === "recent 1"),
  false,
);
assert.equal(workingOverflow.at(-1)?.text, "newest fact");

const prompt = notesForPrompt([{ id: "w3", text: "quit hospital job", tier: "working" }, name]);
assert.deepEqual(prompt.working, [{ id: "w3", text: "quit hospital job" }]);
assert.deepEqual(prompt.longTerm, [{ id: "l1", text: "name is Alex" }]);

assert.deepEqual(readSlurpDmReply({ content: "hey", remember: [{ op: "forget", id: "w3" }] }).remember, [
  { op: "forget", id: "w3" },
]);
assert.deepEqual(readSlurpDmReply({ content: "hey", remember: ["kept"] }).remember, [{ op: "add", text: "kept" }]);

const generation = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-message-generation.service.ts",
  "utf8",
);
assert.match(generation, /knownAboutFan: \{[\s\S]{0,240}?working: known\.working/u);
assert.match(generation, /protectNoteOperation/u);
assert.match(generation, /Use forget with the fact's id/u);
assert.match(generation, /Review the fan's newest message against memory on every reply/u);
assert.match(
  generation,
  /Use an empty array only when the newest message adds, changes, or confirms no personal fact/u,
);

const storage = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/storage/slurp-messages.storage.ts",
  "utf8",
);
assert.match(storage, /applySlurpThreadNotes\(thread\.notes, input\.remember\)/u);
assert.doesNotMatch(storage, /SLURP_THREAD_NOTE_LIMIT/u);

const view = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpMessages.tsx", "utf8");
assert.match(view, /const SLURP_MEMORY_TIER_LIMIT = 8/u);
assert.match(view, /rows\.length\}\/\{SLURP_MEMORY_TIER_LIMIT/u);
assert.match(view, /rows\.length >= SLURP_MEMORY_TIER_LIMIT/u);
assert.equal((view.match(/label=\{localizeUi\("ui\.slurp\.messages\.memories"/gu) ?? []).length, 1);
assert.doesNotMatch(view, /title="What they remember about you"/u);
assert.doesNotMatch(view, /title="Memories"/u);

console.log("slurp thread notes regression passed");
