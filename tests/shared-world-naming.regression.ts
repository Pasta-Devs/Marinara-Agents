import assert from "node:assert/strict";
import { nextAvailableSharedWorldName } from "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/shared-world-naming";

assert.equal(nextAvailableSharedWorldName("Arcadia world", []), "Arcadia world");
assert.equal(
  nextAvailableSharedWorldName("Arcadia world", ["arcadia WORLD"]),
  "Arcadia world (copy)",
  "Friendly-name collisions must be detected case-insensitively",
);
assert.equal(
  nextAvailableSharedWorldName("Arcadia world", ["Arcadia world", "Arcadia world (copy)"]),
  "Arcadia world (copy 2)",
  "Repeated detached copies must remain distinguishable",
);
assert.equal(nextAvailableSharedWorldName("   ", []), "Untitled world");
assert.ok(
  nextAvailableSharedWorldName("A".repeat(120), ["A".repeat(120)]).length <= 120,
  "Collision suffixes must preserve the shared-world name limit",
);

console.info("Shared-world naming regression passed.");
