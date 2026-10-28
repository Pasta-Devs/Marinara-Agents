import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveCatalogGeneratedAt, writeCatalogFamily } from "../catalog-lanes.mjs";

// A per-build wall-clock `generatedAt` churns all three catalog files on no-op
// rebuilds and guarantees a one-line merge conflict between any two
// concurrently regenerated catalogs, forcing every other open PR to rebase.
// These checks pin the deterministic behavior: preserve the committed value by
// default, refresh only on explicit MARINARA_CATALOG_STAMP_GENERATED_AT=1.

const EPOCH = "1970-01-01T00:00:00.000Z";
const COMMITTED = "2026-01-02T03:04:05.678Z";

function sampleCatalog(generatedAt) {
  return {
    schemaVersion: 1,
    generatedAt,
    packages: [
      {
        manifest: {
          schemaVersion: 1,
          id: "alpha",
          name: "Alpha",
          version: "1.0.0",
          engine: { min: "2.3.0", maxExclusive: "3.0.0" },
        },
      },
    ],
  };
}

async function readLaneGeneratedAt(repoRoot, relativePath) {
  const parsed = JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
  return parsed.generatedAt;
}

async function withTempRepo(run) {
  const repoRoot = await mkdtemp(join(tmpdir(), "catalog-generatedat-"));
  try {
    await run(repoRoot);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

// A fresh checkout with no committed catalog resolves to a fixed epoch so even
// a from-scratch build is byte-deterministic (never a wall-clock stamp).
delete process.env.MARINARA_CATALOG_STAMP_GENERATED_AT;
await withTempRepo(async (repoRoot) => {
  assert.equal(await resolveCatalogGeneratedAt(join(repoRoot, "catalog")), EPOCH);
});

// A committed value that is not a canonical ISO-8601 datetime (date-only,
// impossible calendar date, or non-canonical form) is rejected and self-heals
// to the epoch — never preserved into a catalog the Engine schema would reject.
for (const malformed of ["2026-08-16", "2026-13-45T00:00:00.000Z", "2026-02-30T00:00:00.000Z", "not-a-date", ""]) {
  await withTempRepo(async (repoRoot) => {
    await mkdir(join(repoRoot, "catalog"), { recursive: true });
    await writeFile(join(repoRoot, "catalog/catalog.json"), `${JSON.stringify(sampleCatalog(malformed), null, 2)}\n`);
    assert.equal(
      await resolveCatalogGeneratedAt(join(repoRoot, "catalog")),
      EPOCH,
      `malformed generatedAt "${malformed}" must fall back to epoch`,
    );
  });
}

// A committed catalog's timestamp is preserved even when the in-memory catalog
// carries a different (fresh) value from the build.
await withTempRepo(async (repoRoot) => {
  await mkdir(join(repoRoot, "catalog"), { recursive: true });
  await writeFile(join(repoRoot, "catalog/catalog.json"), `${JSON.stringify(sampleCatalog(COMMITTED), null, 2)}\n`);

  await writeCatalogFamily(repoRoot, sampleCatalog("2099-12-31T23:59:59.000Z"));
  assert.equal(await readLaneGeneratedAt(repoRoot, "catalog/catalog.json"), COMMITTED);
  assert.equal(await readLaneGeneratedAt(repoRoot, "catalog/v2/catalog.json"), COMMITTED);

  // A second no-op rebuild is byte-identical (deterministic), timestamp included.
  const before = await readFile(join(repoRoot, "catalog/catalog.json"), "utf8");
  await writeCatalogFamily(repoRoot, sampleCatalog("2098-01-01T00:00:00.000Z"));
  const after = await readFile(join(repoRoot, "catalog/catalog.json"), "utf8");
  assert.equal(after, before);
});

// The publish opt-in refreshes the stamp to a fresh, valid ISO datetime.
await withTempRepo(async (repoRoot) => {
  await mkdir(join(repoRoot, "catalog"), { recursive: true });
  await writeFile(join(repoRoot, "catalog/catalog.json"), `${JSON.stringify(sampleCatalog(COMMITTED), null, 2)}\n`);

  process.env.MARINARA_CATALOG_STAMP_GENERATED_AT = "1";
  try {
    await writeCatalogFamily(repoRoot, sampleCatalog(COMMITTED));
  } finally {
    delete process.env.MARINARA_CATALOG_STAMP_GENERATED_AT;
  }

  const stamped = await readLaneGeneratedAt(repoRoot, "catalog/catalog.json");
  assert.notEqual(stamped, COMMITTED);
  assert.notEqual(stamped, EPOCH);
  assert.ok(!Number.isNaN(Date.parse(stamped)), "stamped generatedAt must be a valid ISO datetime");
  assert.ok(Date.parse(stamped) > Date.parse(COMMITTED));
});

console.log("catalog generatedAt determinism: OK");
