import assert from "node:assert/strict";
import { staleNoodleAccountIds } from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-data-cleanup";

const stale = staleNoodleAccountIds(
  [
    { id: "character-live", kind: "character", entityId: "character-1" },
    { id: "character-deleted", kind: "character", entityId: "character-2" },
    { id: "persona-live", kind: "persona", entityId: "persona-1" },
    { id: "persona-deleted", kind: "persona", entityId: "persona-2" },
    { id: "ambient", kind: "random_user", entityId: "ambient-1" },
  ],
  new Set(["character-1"]),
  new Set(["persona-1"]),
);

assert.deepEqual([...stale].sort(), ["character-deleted", "persona-deleted"]);
console.log("Noodle data cleanup regression passed.");
