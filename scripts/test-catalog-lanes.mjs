import assert from "node:assert/strict";
import {
  assertManifestBuildProvenance,
  catalogMajorsForRange,
} from "./catalog-lanes.mjs";

assert.deepEqual(catalogMajorsForRange("2.3.0", "3.0.0"), [2]);
assert.deepEqual(catalogMajorsForRange("2.3.0", "4.0.0"), [2, 3]);
assert.deepEqual(catalogMajorsForRange("3.2.0", "3.3.0"), [3]);
assert.throws(() => catalogMajorsForRange("3.0.0", "3.0.0"), /must be increasing/u);

assert.doesNotThrow(() =>
  assertManifestBuildProvenance({
    schemaVersion: 1,
    id: "legacy-package",
    engine: { min: "2.3.0", maxExclusive: "3.0.0" },
  }),
);
assert.doesNotThrow(() =>
  assertManifestBuildProvenance({
    schemaVersion: 2,
    id: "staging-package",
    builtAgainst: { engineVersion: "3.2.2" },
    engine: { min: "3.2.0", maxExclusive: "3.3.0" },
  }),
);
assert.throws(
  () =>
    assertManifestBuildProvenance({
      schemaVersion: 2,
      id: "misrouted-staging-package",
      builtAgainst: { engineVersion: "3.2.2" },
      engine: { min: "2.3.0", maxExclusive: "3.0.0" },
    }),
  /outside its declared compatibility range/u,
);

console.log("Catalog lane routing and build provenance tests passed.");
