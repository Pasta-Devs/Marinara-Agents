import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packageArtifactName } from "../catalog-path-safety.mjs";
import { createDeterministicZip } from "../deterministic-zip.mjs";
import {
  RULESET_ASSET_PATH,
  RULESET_CATALOG_MAX_BYTES,
  assertRulesetAssetDocument,
  assertRulesetCatalogs,
  assertRulesetPackageContract,
  isRulesetCatalogAssetPath,
  isRulesetPackage,
  rulesetCatalogAssetPaths,
} from "../ruleset-package-checks.mjs";

// A `ruleset` package is the only package shape in this catalog with no Agent, so
// the agent-definition assertions in validate-catalog.mjs are skipped for it and
// these checks stand in their place. They are the whole safety net for the shape,
// which is why each rejection is pinned to its message here rather than only to
// "it threw": a check that silently stopped covering one of these would otherwise
// still pass.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const packageRoot = join(repoRoot, "packages/ruleset-5e-2014");
const shippedManifest = JSON.parse(await readFile(join(packageRoot, "manifest.json"), "utf8"));
const shippedAsset = await readFile(join(packageRoot, RULESET_ASSET_PATH), "utf8");

// The package as committed must satisfy the contract.
assert.equal(isRulesetPackage(shippedManifest), true);
assert.equal(assertRulesetPackageContract(shippedManifest), true);
const parsedAsset = assertRulesetAssetDocument(shippedAsset, shippedManifest.id);
assert.equal(typeof parsedAsset.id, "string");

// An ordinary agent package is left alone: the contract reports "not a ruleset"
// rather than demanding ruleset metadata of it.
assert.equal(
  assertRulesetPackageContract({
    id: "quest",
    kind: ["agent"],
    entrypoints: { agents: "agents.json" },
    permissions: [],
    files: [{ path: "agents.json", sha256: "a".repeat(64), bytes: 10 }],
  }),
  false,
);

function rulesetManifest(overrides = {}) {
  return {
    schemaVersion: 2,
    capabilityApi: { major: 1, minor: 20 },
    id: "ruleset-test",
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: [RULESET_ASSET_PATH] } },
    files: [{ path: RULESET_ASSET_PATH, sha256: "b".repeat(64), bytes: 12 }],
    permissions: [],
    restartRequired: false,
    ...overrides,
  };
}

// A ruleset kind mixed with another kind would take the data-only branch and skip the Agent contract.
assert.throws(
  () => assertRulesetPackageContract(rulesetManifest({ kind: ["ruleset", "agent"] })),
  /must declare "ruleset" as its only kind/u,
);

// (a) A ruleset that also declares an Agent entrypoint.
assert.throws(
  () => assertRulesetPackageContract(rulesetManifest({ entrypoints: { agents: "agents.json" } })),
  /must not declare the agents entrypoint/u,
);
// The same rejection covers runtime code, which a data-only package cannot ship.
assert.throws(
  () => assertRulesetPackageContract(rulesetManifest({ entrypoints: { server: "server.mjs" } })),
  /must not declare the server entrypoint/u,
);
assert.throws(
  () => assertRulesetPackageContract(rulesetManifest({ entrypoints: { client: "client.js" } })),
  /must not declare the client entrypoint/u,
);
assert.throws(
  () => assertRulesetPackageContract(rulesetManifest({ entrypoints: { knowledge: "knowledge.json" } })),
  /must not declare the knowledge entrypoint/u,
);

// (b) A ruleset whose ruleset.json is not listed in the declared assets.
assert.throws(
  () => assertRulesetPackageContract(rulesetManifest({ contributions: {} })),
  /does not list ruleset\.json in contributions\.assets\.paths/u,
);
// Listed as an asset but never declared in files[], so it ships with no hash.
assert.throws(
  () =>
    assertRulesetPackageContract(
      rulesetManifest({ files: [{ path: "other.json", sha256: "c".repeat(64), bytes: 4 }] }),
    ),
  /must declare ruleset\.json in manifest\.files/u,
);

// (c) A non-ruleset package that lists ruleset.json.
assert.throws(
  () => assertRulesetPackageContract(rulesetManifest({ kind: ["agent"], entrypoints: { agents: "agents.json" } })),
  /declares the reserved ruleset\.json asset but is not kind "ruleset"/u,
);

// The remaining data-only guarantees.
assert.throws(
  () => assertRulesetPackageContract(rulesetManifest({ permissions: ["storage"] })),
  /must declare no permissions/u,
);
assert.throws(
  () => assertRulesetPackageContract(rulesetManifest({ restartRequired: true })),
  /restartRequired must be false/u,
);
assert.throws(
  () => assertRulesetPackageContract(rulesetManifest({ schemaVersion: 1 })),
  /must use capability package manifest v2/u,
);
// Capability API 1.20 is the Engine release that introduced the ruleset seam.
assert.throws(
  () => assertRulesetPackageContract(rulesetManifest({ capabilityApi: { major: 1, minor: 19 } })),
  /must declare capability API 1\.20 or newer/u,
);
assert.doesNotThrow(() => assertRulesetPackageContract(rulesetManifest({ capabilityApi: { major: 1, minor: 21 } })));
assert.doesNotThrow(() => assertRulesetPackageContract(rulesetManifest({ capabilityApi: { major: 2, minor: 0 } })));

// (d) A ruleset.json with no id, plus the other identity fields the Engine keys on.
assert.throws(
  () => assertRulesetAssetDocument(JSON.stringify({ version: 1, name: "Test" }), "ruleset-test"),
  /must carry a non-empty string id/u,
);
assert.throws(
  () => assertRulesetAssetDocument(JSON.stringify({ id: "  ", version: 1, name: "Test" }), "ruleset-test"),
  /must carry a non-empty string id/u,
);
assert.throws(
  () => assertRulesetAssetDocument(JSON.stringify({ id: "test", version: 0, name: "Test" }), "ruleset-test"),
  /must carry an integer version of 1 or more/u,
);
assert.throws(
  () => assertRulesetAssetDocument(JSON.stringify({ id: "test", version: 1.5, name: "Test" }), "ruleset-test"),
  /must carry an integer version of 1 or more/u,
);
assert.throws(
  () => assertRulesetAssetDocument(JSON.stringify({ id: "test", version: 1 }), "ruleset-test"),
  /must carry a non-empty string name/u,
);
assert.throws(() => assertRulesetAssetDocument("{ not json", "ruleset-test"), /is not valid JSON/u);
assert.throws(() => assertRulesetAssetDocument("[]", "ruleset-test"), /must be a JSON object/u);

// ── Catalogs (Capability API 1.21) ──
//
// A catalog is the second reserved asset family a ruleset package may ship, and
// the only one that can be large. The same rejections are pinned here for the
// same reason: these checks are the whole safety net between a generated
// catalog file and an install that refuses it.

assert.equal(isRulesetCatalogAssetPath("catalogs/spells.json"), true);
assert.equal(isRulesetCatalogAssetPath("catalogs/Spells.json"), false);
assert.equal(isRulesetCatalogAssetPath("catalogs/nested/spells.json"), false);
assert.equal(isRulesetCatalogAssetPath(RULESET_ASSET_PATH), false);

// The package as committed must satisfy the catalog contract too, entries and all.
const shippedCatalogPaths = rulesetCatalogAssetPaths(shippedManifest);
const shippedCatalogSources = new Map();
for (const catalogPath of shippedCatalogPaths) {
  shippedCatalogSources.set(catalogPath, await readFile(join(packageRoot, catalogPath), "utf8"));
}
const shippedSummaries = assertRulesetCatalogs(shippedManifest, parsedAsset, shippedCatalogSources);
assert.ok(shippedSummaries.length > 0, "the shipped ruleset must declare at least one catalog");
for (const summary of shippedSummaries) {
  assert.ok(summary.entryCount > 0, `catalog ${summary.id} must ship entries`);
  if (summary.bytes !== null) assert.ok(summary.bytes <= RULESET_CATALOG_MAX_BYTES);
}
// Every declared catalog asset is hash-pinned with the bytes it actually has.
for (const catalogPath of shippedCatalogPaths) {
  const declared = shippedManifest.files.find((file) => file.path === catalogPath);
  const buffer = await readFile(join(packageRoot, catalogPath));
  assert.ok(declared, `${catalogPath} must be declared in manifest.files`);
  assert.equal(declared.sha256, createHash("sha256").update(buffer).digest("hex"));
  assert.equal(declared.bytes, buffer.byteLength);
}

// A catalog asset on a package that never claimed to be a ruleset.
assert.throws(
  () =>
    assertRulesetPackageContract(
      rulesetManifest({ kind: ["agent"], contributions: { assets: { paths: ["catalogs/spells.json"] } } }),
    ),
  /declares the reserved catalogs\/spells\.json asset but is not kind "ruleset"/u,
);
// Capability API 1.21 is the release that introduced catalogs.
const withCatalogAsset = (overrides = {}) =>
  rulesetManifest({
    capabilityApi: { major: 1, minor: 21 },
    contributions: { assets: { paths: [RULESET_ASSET_PATH, "catalogs/knacks.json"] } },
    files: [
      { path: RULESET_ASSET_PATH, sha256: "b".repeat(64), bytes: 12 },
      { path: "catalogs/knacks.json", sha256: "d".repeat(64), bytes: 40 },
    ],
    ...overrides,
  });
assert.doesNotThrow(() => assertRulesetPackageContract(withCatalogAsset()));
assert.throws(
  () => assertRulesetPackageContract(withCatalogAsset({ capabilityApi: { major: 1, minor: 20 } })),
  /ships a catalog asset and must declare capability API 1\.21 or newer/u,
);
// Listed as an asset but never hash-pinned, so it would ship unverified.
assert.throws(
  () =>
    assertRulesetPackageContract(
      withCatalogAsset({ files: [{ path: RULESET_ASSET_PATH, sha256: "b".repeat(64), bytes: 12 }] }),
    ),
  /must declare catalogs\/knacks\.json in manifest\.files/u,
);

// The document side. A tiny ruleset stands in for the shipped one so each
// rejection is provoked by exactly one difference.
const testDocument = (catalogs) => ({
  id: "test",
  version: 1,
  name: "Test",
  sheet: { lists: [{ id: "knacks", columns: [{ id: "name" }, { id: "notes" }] }] },
  catalogs,
});
const knack = { id: "road-sense", label: "Road Sense", rows: [{ list: "knacks", values: { name: "Road Sense" } }] };
const inlineCatalog = { id: "knacks", label: "Knacks", feeds: ["knacks"], entries: [knack] };
const inlineManifest = rulesetManifest({ capabilityApi: { major: 1, minor: 21 } });

assert.deepEqual(assertRulesetCatalogs(inlineManifest, testDocument([inlineCatalog])), [
  { id: "knacks", entryCount: 1, bytes: null },
]);
// A ruleset with no catalogs at all is untouched, and needs no 1.21.
assert.deepEqual(assertRulesetCatalogs(rulesetManifest(), testDocument(undefined)), []);
assert.throws(
  () => assertRulesetCatalogs(rulesetManifest(), testDocument([inlineCatalog])),
  /ships catalogs and must declare capability API 1\.21 or newer/u,
);
assert.throws(
  () => assertRulesetCatalogs(inlineManifest, testDocument([{ ...inlineCatalog, feeds: ["tricks"] }])),
  /feeds unknown list "tricks"/u,
);
assert.throws(
  () => assertRulesetCatalogs(inlineManifest, testDocument([inlineCatalog, inlineCatalog])),
  /repeats the catalog id "knacks"/u,
);
assert.throws(
  () => assertRulesetCatalogs(inlineManifest, testDocument([{ ...inlineCatalog, asset: "catalogs/knacks.json" }])),
  /must have exactly one of "entries" or "asset"/u,
);
// A row may only write into a list the catalog feeds, and only into columns
// that list actually has, or the sheet would refuse the pick.
assert.throws(
  () =>
    assertRulesetCatalogs(
      inlineManifest,
      testDocument([{ ...inlineCatalog, entries: [{ ...knack, rows: [{ list: "tricks", values: {} }] }] }]),
    ),
  /writes into "tricks", which is not one of its feeds/u,
);
assert.throws(
  () =>
    assertRulesetCatalogs(
      inlineManifest,
      testDocument([{ ...inlineCatalog, entries: [{ ...knack, rows: [{ list: "knacks", values: { grit: 1 } }] }] }]),
    ),
  /sets "grit", which list "knacks" has no column for/u,
);
assert.throws(
  () =>
    assertRulesetCatalogs(
      inlineManifest,
      testDocument([{ ...inlineCatalog, entries: [{ ...knack, id: "Road Sense" }] }]),
    ),
  /is not lowercase letters, digits and hyphens/u,
);
assert.throws(
  () => assertRulesetCatalogs(inlineManifest, testDocument([{ ...inlineCatalog, entries: [knack, knack] }])),
  /repeats the entry id "road-sense"/u,
);

// The asset side. The path is derived from the catalog's id, so a file cannot
// belong to another catalog and an orphan file cannot ride along unread.
const assetCatalog = { id: "knacks", label: "Knacks", feeds: ["knacks"], asset: "catalogs/knacks.json" };
const assetDocument = testDocument([assetCatalog]);
const assetManifest = withCatalogAsset();
const catalogFile = (overrides = {}) =>
  new Map([
    ["catalogs/knacks.json", JSON.stringify({ schemaVersion: 1, catalog: "knacks", entries: [knack], ...overrides })],
  ]);

assert.deepEqual(assertRulesetCatalogs(assetManifest, assetDocument, catalogFile()), [
  { id: "knacks", entryCount: 1, bytes: catalogFile().get("catalogs/knacks.json").length },
]);
assert.throws(
  () => assertRulesetCatalogs(assetManifest, testDocument([{ ...assetCatalog, asset: "catalogs/tricks.json" }])),
  /must name "catalogs\/knacks\.json"/u,
);
assert.throws(
  () => assertRulesetCatalogs(inlineManifest, assetDocument),
  /is not declared in contributions\.assets\.paths/u,
);
assert.throws(
  () => assertRulesetCatalogs(assetManifest, assetDocument, new Map()),
  /missing the catalogs\/knacks\.json/u,
);
assert.throws(
  () => assertRulesetCatalogs(assetManifest, assetDocument, catalogFile({ catalog: "tricks" })),
  /names catalog "tricks", not "knacks"/u,
);
assert.throws(
  () => assertRulesetCatalogs(assetManifest, assetDocument, catalogFile({ schemaVersion: 2 })),
  /must carry schemaVersion 1/u,
);
assert.throws(
  () => assertRulesetCatalogs(assetManifest, assetDocument, new Map([["catalogs/knacks.json", "{ not json"]])),
  /is not valid JSON/u,
);
assert.throws(
  () =>
    assertRulesetCatalogs(
      assetManifest,
      assetDocument,
      new Map([
        [
          "catalogs/knacks.json",
          `{"schemaVersion":1,"catalog":"knacks","entries":[],"pad":"${"x".repeat(RULESET_CATALOG_MAX_BYTES)}"}`,
        ],
      ]),
    ),
  new RegExp(`over the ${RULESET_CATALOG_MAX_BYTES}-byte limit`, "u"),
);
// A declared asset no catalog names would be hashed and shipped but never read.
assert.throws(
  () => assertRulesetCatalogs(assetManifest, testDocument([inlineCatalog]), catalogFile()),
  /declares catalogs\/knacks\.json but no catalog in ruleset\.json names it/u,
);
assert.throws(
  () => assertRulesetCatalogs(assetManifest, testDocument(undefined)),
  /declares catalogs\/knacks\.json but its ruleset\.json has no catalogs/u,
);

// The published artifact must be reproducible: the same manifest and asset bytes
// have to produce the same zip, or every rebuild would churn the catalog's sha256
// and the Engine would see an "update" that changed nothing.
const manifestBuffer = Buffer.from(`${JSON.stringify(shippedManifest, null, 2)}\n`);
const assetBuffer = await readFile(join(packageRoot, RULESET_ASSET_PATH));
// Every declared asset rides the zip in declaration order, catalogs included.
const zipEntries = [
  { name: "manifest.json", data: manifestBuffer },
  ...shippedManifest.contributions.assets.paths.map((path) => ({
    name: path,
    data: path === RULESET_ASSET_PATH ? assetBuffer : Buffer.from(shippedCatalogSources.get(path)),
  })),
];
const digest = (buffer) => createHash("sha256").update(buffer).digest("hex");
const first = createDeterministicZip(zipEntries);
const second = createDeterministicZip(zipEntries);
assert.equal(digest(first), digest(second), "a rebuilt ruleset artifact must be byte-identical");

// And it must be the artifact actually committed for this package.
const committedArtifact = await readFile(
  join(repoRoot, "artifacts", packageArtifactName(shippedManifest.id, shippedManifest.version)),
);
assert.equal(digest(first), digest(committedArtifact), "the committed artifact must match a fresh build");

// The declared hash and size must describe the committed asset bytes.
const declaredAsset = shippedManifest.files.find((file) => file.path === RULESET_ASSET_PATH);
assert.equal(declaredAsset.sha256, digest(assetBuffer));
assert.equal(declaredAsset.bytes, assetBuffer.byteLength);

console.log("ruleset package contract: OK");
