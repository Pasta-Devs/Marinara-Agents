import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyNoodleCleanupIfStillStale,
  staleNoodleAccountIds,
} from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-data-cleanup";

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

const storageSource = readFileSync(
  new URL("../packages/noodle/src/engine/packages/server/src/services/storage/noodle.storage.ts", import.meta.url),
  "utf8",
);
assert.match(storageSource, /applyNoodleCleanupIfStillStale/u);

const accountRows = [{ id: "character-reinvited", kind: "character", entityId: "character-4", invited: "true" }];
const dependentRows = ["post", "interaction", "digest", "run", "subscription", "unlock"];
applyNoodleCleanupIfStillStale({
  plannedAccountIds: ["character-reinvited"],
  currentAccounts: accountRows,
  characterIds: new Set(["character-4"]),
  personaIds: new Set(),
  counts: { accounts: 1, posts: 1, interactions: 1, digests: 1, refreshRuns: 1, subscriptions: 1, unlocks: 1 },
  apply: async () => {
    accountRows.splice(0);
    dependentRows.splice(0);
  },
}).then(
  (cleanupCounts) => {
    assert.deepEqual(cleanupCounts, {
      accounts: 0,
      posts: 0,
      interactions: 0,
      digests: 0,
      refreshRuns: 0,
      subscriptions: 0,
      unlocks: 0,
    });
    assert.equal(accountRows.length, 1, "a reinvited account must survive cleanup");
    assert.equal(dependentRows.length, 6, "dependent rows must survive when cleanup becomes stale");
    console.log("Noodle data cleanup regression passed.");
  },
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
