import assert from "node:assert/strict";
import {
  readStoredNotes,
  findPromiseNotes,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-thread-notes.js";
const notes = readStoredNotes(
  JSON.stringify([
    { id: "w1", text: "fan likes cats", tier: "working" },
    { id: "w2", text: "keep this", tier: "working", tags: ["promise"], metadata: { type: "promise", maxFollowUps: 2 } },
    { id: "w3", text: "I will send the photo tomorrow", tier: "working" },
  ]),
);
assert.deepEqual(notes[1].tags, ["promise"]);
assert.equal(notes[1].metadata?.maxFollowUps, 2);
assert.deepEqual(
  findPromiseNotes(notes).map((n) => n.id),
  ["w2", "w3"],
);
console.log("slurp thread notes regression: ok");
