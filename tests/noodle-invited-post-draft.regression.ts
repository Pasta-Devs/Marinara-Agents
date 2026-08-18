import assert from "node:assert/strict";
import { isDirectlyInvitedNoodleCharacter } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-invited-post-draft-access";

assert.equal(isDirectlyInvitedNoodleCharacter(null), false);
assert.equal(isDirectlyInvitedNoodleCharacter({ kind: "character", invited: false }), false);
assert.equal(isDirectlyInvitedNoodleCharacter({ kind: "persona", invited: true }), false);
assert.equal(isDirectlyInvitedNoodleCharacter({ kind: "character", invited: true }), true);

// Stored rows can carry a non-boolean `invited` (a legacy 0/1, a string, null).
// Only a real `true` authorizes the draft.
[0, 1, "true", "1", "", null, undefined].forEach((invited) => {
  assert.equal(
    isDirectlyInvitedNoodleCharacter({
      kind: "character",
      invited: invited as never,
    }),
    false,
    `invited=${JSON.stringify(invited)} must not authorize an invited-post draft`,
  );
});

console.log("Noodle invited post draft authorization regressions passed.");
