import assert from "node:assert/strict";
import { isDirectlyInvitedNoodleCharacter } from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-invited-post-draft-access";

assert.equal(isDirectlyInvitedNoodleCharacter(null), false);
assert.equal(
  isDirectlyInvitedNoodleCharacter({ kind: "character", invited: false }),
  false,
);
assert.equal(
  isDirectlyInvitedNoodleCharacter({ kind: "persona", invited: true }),
  false,
);
assert.equal(
  isDirectlyInvitedNoodleCharacter({ kind: "character", invited: true }),
  true,
);

console.log("Noodle invited post draft authorization regressions passed.");
