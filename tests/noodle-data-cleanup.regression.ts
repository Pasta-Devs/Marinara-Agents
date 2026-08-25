import assert from "node:assert/strict";
import { staleNoodleAccountIds } from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-data-cleanup";

const stale = staleNoodleAccountIds(
  [
    { id: "character-live", kind: "character", entityId: "character-1", invited: "true" },
    { id: "character-uninvited", kind: "character", entityId: "character-3", invited: "false" },
    { id: "character-deleted", kind: "character", entityId: "character-2", invited: "true" },
    { id: "persona-live", kind: "persona", entityId: "persona-1", invited: "true" },
    { id: "persona-deleted", kind: "persona", entityId: "persona-2", invited: "true" },
    { id: "ambient-live", kind: "random_user", entityId: "ambient-1", invited: "true" },
    { id: "ambient-uninvited", kind: "random_user", entityId: "ambient-2", invited: "false" },
  ],
  new Set(["character-1"]),
  new Set(["persona-1"]),
);

assert.deepEqual([...stale].sort(), [
  "ambient-uninvited",
  "character-deleted",
  "character-uninvited",
  "persona-deleted",
]);
console.log("Noodle data cleanup regression passed.");
