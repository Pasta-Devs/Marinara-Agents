import assert from "node:assert/strict";
import { normalizeNoodlerStageProfileDraft } from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodler-stage-profile-normalize";

// A model that answers with its own field names used to fail the whole creator, which the
// wizard reported as "creation failed" for every selected character.
assert.deepEqual(
  normalizeNoodlerStageProfileDraft({
    name: "Velvet Hours",
    username: "@velvet_hours",
    description: "Late nights, louder mornings.",
    personality: "Dry, teasing, never explains the joke.",
  }),
  {
    name: "Velvet Hours",
    username: "@velvet_hours",
    description: "Late nights, louder mornings.",
    personality: "Dry, teasing, never explains the joke.",
    displayName: "Velvet Hours",
    handle: "velvet_hours",
    bio: "Late nights, louder mornings.",
    stagePersonality: "Dry, teasing, never explains the joke.",
  },
);

// Wrapped and single-item-array answers unwrap to the same object.
const wrapped = normalizeNoodlerStageProfileDraft({
  profile: { displayName: "Nine", handle: "nine", bio: "", stagePersonality: "" },
});
assert.equal(wrapped?.displayName, "Nine");
assert.equal(
  normalizeNoodlerStageProfileDraft([{ displayName: "Nine", handle: "nine" }])?.handle,
  "nine",
);
assert.equal(
  normalizeNoodlerStageProfileDraft({ profiles: [{ displayName: "Nine", handle: "nine" }] })?.handle,
  "nine",
);

// Real fields always win over an alias, and empty optionals become empty strings.
const preferred = normalizeNoodlerStageProfileDraft({
  displayName: "Real",
  name: "Alias",
  handle: "real",
});
assert.equal(preferred?.displayName, "Real");
assert.equal(preferred?.bio, "");
assert.equal(preferred?.stagePersonality, "");

// A missing handle is derived from the name rather than failing the creator.
assert.equal(
  normalizeNoodlerStageProfileDraft({ displayName: "Velvet Hours!" })?.handle,
  "velvet_hours_",
);

// Non-objects still fail, so a prose answer reaches the retry instead of being accepted.
assert.equal(normalizeNoodlerStageProfileDraft("Sure, here is a profile"), null);
assert.equal(normalizeNoodlerStageProfileDraft(null), null);

console.log("NoodleR stage profile draft regressions passed.");
