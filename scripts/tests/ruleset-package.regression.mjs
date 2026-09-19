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
  assertRulesetBattle,
  assertRulesetCatalogs,
  assertRulesetCombat,
  assertRulesetCreatures,
  assertRulesetPackageContract,
  assertRulesetScaled,
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
// A path inside the reserved family that does not have its shape is refused outright. It would
// otherwise be hashed and zipped like any asset while skipping every catalog check.
for (const malformed of ["catalogs/Spells.json", "catalogs/my-list.json", "catalogs/nested/spells.json"]) {
  assert.throws(
    () =>
      assertRulesetPackageContract(
        rulesetManifest({ contributions: { assets: { paths: [RULESET_ASSET_PATH, malformed] } } }),
      ),
    /is not a "catalogs\/<id>\.json" asset/u,
    malformed,
  );
}
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

// ── Battles (Capability API 1.22) ──
//
// A `battle` block is nothing but references into the sheet beside it, and it
// ships inside ruleset.json where the manifest cannot show it. The same pinning
// applies: each rejection is a package that would install and then lend a fight
// nothing, or be refused outright by a host that predates the key.

// The package as committed opts in, and its block holds together.
assert.equal(assertRulesetBattle(shippedManifest, parsedAsset), true);

const battleSheet = {
  lists: [
    {
      id: "knacks",
      columns: [
        { id: "name", type: "text" },
        { id: "ready", type: "boolean" },
        { id: "tier", type: "number" },
        { id: "phase", type: "enum", values: ["day", "night"] },
      ],
    },
    // A list whose rows are pools is keyed by a row's name, so it can never be a battle pool.
    { id: "counters", pools: { nameColumn: "name", maxColumn: "max" }, columns: [{ id: "name", type: "text" }] },
  ],
  live: {
    pools: [{ id: "grit" }, { id: "luck" }, { id: "slots_1" }, { id: "slots_2" }, { id: "stress", start: "empty" }],
  },
};
const battleDocument = (battle) => ({ id: "test", version: 1, name: "Test", sheet: battleSheet, battle });
const battle = {
  health: { pool: "grit" },
  energy: { pool: "luck" },
  slots: [
    { pool: "slots_1", level: 1 },
    { pool: "slots_2", level: 2 },
  ],
  skills: [{ list: "knacks", onlyWhen: "ready", alwaysWhen: { column: "tier", equals: 0 } }],
};
const battleManifest = rulesetManifest({ capabilityApi: { major: 1, minor: 22 } });

assert.equal(assertRulesetBattle(battleManifest, battleDocument(battle)), true);
// A ruleset with no battle block at all is untouched, and needs no 1.22.
assert.equal(assertRulesetBattle(rulesetManifest(), battleDocument(undefined)), false);
assert.throws(
  () => assertRulesetBattle(rulesetManifest({ capabilityApi: { major: 1, minor: 21 } }), battleDocument(battle)),
  /ships a battle block and must declare capability API 1\.22 or newer/u,
);
assert.doesNotThrow(() =>
  assertRulesetBattle(rulesetManifest({ capabilityApi: { major: 2, minor: 0 } }), battleDocument(battle)),
);

// The pools a fight reads have to be declared live pools of this very sheet.
assert.throws(
  () => assertRulesetBattle(battleManifest, battleDocument({ ...battle, health: { pool: "vigor" } })),
  /battle health names unknown live pool "vigor"/u,
);
assert.throws(
  () => assertRulesetBattle(battleManifest, battleDocument({ ...battle, health: { pool: "counters" } })),
  /battle health "counters" is a list whose rows are pools, not a live pool/u,
);
assert.throws(() => assertRulesetBattle(battleManifest, battleDocument({ skills: [] })), /must name a health pool/u);
// A pool that starts empty counts up, so as health every fresh character would begin already down.
assert.throws(
  () => assertRulesetBattle(battleManifest, battleDocument({ ...battle, health: { pool: "stress" } })),
  /battle health pool "stress" starts empty, so it cannot be hit points/u,
);
// Hit points cannot also be the fight's fuel: the Engine drains one as damage and spends the other.
assert.throws(
  () => assertRulesetBattle(battleManifest, battleDocument({ ...battle, energy: { pool: "grit" } })),
  /battle energy pool "grit" cannot also be the health pool/u,
);
assert.throws(
  () => assertRulesetBattle(battleManifest, battleDocument({ ...battle, energy: { pool: "vigor" } })),
  /battle energy names unknown live pool "vigor"/u,
);

// Slots: declared, each pool and each level used once, and a level 5e could hold.
assert.throws(
  () => assertRulesetBattle(battleManifest, battleDocument({ ...battle, slots: [{ pool: "vigor", level: 1 }] })),
  /battle slot pool names unknown live pool "vigor"/u,
);
assert.throws(
  () => assertRulesetBattle(battleManifest, battleDocument({ ...battle, slots: [{ pool: "grit", level: 1 }] })),
  /battle slot pool "grit" is already the health or energy pool/u,
);
assert.throws(
  () => assertRulesetBattle(battleManifest, battleDocument({ ...battle, slots: [{ pool: "luck", level: 1 }] })),
  /battle slot pool "luck" is already the health or energy pool/u,
);
assert.throws(
  () =>
    assertRulesetBattle(
      battleManifest,
      battleDocument({
        ...battle,
        slots: [
          { pool: "slots_1", level: 1 },
          { pool: "slots_1", level: 2 },
        ],
      }),
    ),
  /battle repeats the slot pool "slots_1"/u,
);
assert.throws(
  () =>
    assertRulesetBattle(
      battleManifest,
      battleDocument({
        ...battle,
        slots: [
          { pool: "slots_1", level: 1 },
          { pool: "slots_2", level: 1 },
        ],
      }),
    ),
  /battle repeats the slot level 1/u,
);
for (const level of [0, 10, 1.5, "1"]) {
  assert.throws(
    () => assertRulesetBattle(battleManifest, battleDocument({ ...battle, slots: [{ pool: "slots_1", level }] })),
    /battle slot pool "slots_1" has level .*, not 1 to 9/u,
    String(level),
  );
}

// Skills: the list exists, the gate is a boolean column, and the value compared against a column is
// one that column could hold. A comparison that can never match would silently drop every row.
assert.throws(
  () => assertRulesetBattle(battleManifest, battleDocument({ ...battle, skills: [{ list: "tricks" }] })),
  /battle skills name unknown list "tricks"/u,
);
assert.throws(
  () =>
    assertRulesetBattle(battleManifest, battleDocument({ ...battle, skills: [{ list: "knacks", onlyWhen: "tier" }] })),
  /battle skills onlyWhen "tier" must name a boolean column/u,
);
assert.throws(
  () =>
    assertRulesetBattle(battleManifest, battleDocument({ ...battle, skills: [{ list: "knacks", onlyWhen: "gone" }] })),
  /battle skills onlyWhen "gone" must name a boolean column/u,
);
// alwaysWhen is the exception to onlyWhen. Alone it would gate nothing, which reads like a filter
// and is not one, so the Engine refuses it and so does the build.
assert.throws(
  () =>
    assertRulesetBattle(
      battleManifest,
      battleDocument({ ...battle, skills: [{ list: "knacks", alwaysWhen: { column: "tier", equals: 0 } }] }),
    ),
  /battle skills alwaysWhen is the exception to onlyWhen, so it needs onlyWhen beside it/u,
);
assert.throws(
  () =>
    assertRulesetBattle(
      battleManifest,
      battleDocument({
        ...battle,
        skills: [{ list: "knacks", onlyWhen: "ready", alwaysWhen: { column: "gone", equals: 0 } }],
      }),
    ),
  /battle skills alwaysWhen names unknown column "gone"/u,
);
assert.throws(
  () =>
    assertRulesetBattle(
      battleManifest,
      battleDocument({
        ...battle,
        skills: [{ list: "knacks", onlyWhen: "ready", alwaysWhen: { column: "tier", equals: "0" } }],
      }),
    ),
  /battle skills alwaysWhen "tier" is a number column, so equals must be a number/u,
);
assert.throws(
  () =>
    assertRulesetBattle(
      battleManifest,
      battleDocument({
        ...battle,
        skills: [{ list: "knacks", onlyWhen: "ready", alwaysWhen: { column: "ready", equals: 1 } }],
      }),
    ),
  /battle skills alwaysWhen "ready" is a boolean column, so equals must be true or false/u,
);
assert.throws(
  () =>
    assertRulesetBattle(
      battleManifest,
      battleDocument({
        ...battle,
        skills: [{ list: "knacks", onlyWhen: "ready", alwaysWhen: { column: "name", equals: 1 } }],
      }),
    ),
  /battle skills alwaysWhen "name" is a text column, so equals must be a string/u,
);
assert.throws(
  () =>
    assertRulesetBattle(
      battleManifest,
      battleDocument({
        ...battle,
        skills: [{ list: "knacks", onlyWhen: "ready", alwaysWhen: { column: "phase", equals: "dusk" } }],
      }),
    ),
  /battle skills alwaysWhen "dusk" is not one of the values of "phase"/u,
);
assert.doesNotThrow(() =>
  assertRulesetBattle(
    battleManifest,
    battleDocument({
      ...battle,
      skills: [{ list: "knacks", onlyWhen: "ready", alwaysWhen: { column: "phase", equals: "night" } }],
    }),
  ),
);

// ── Scaled catalog columns (Capability API 1.23) ──
//
// A `scaled` column is a promise that the ruleset keeps a number the player otherwise would. It is
// nothing but references into the sheet beside it, and it can ride inline or inside a catalog
// asset, so the same pinning applies: each rejection is a package that would install and then leave
// a maximum it promised to keep sitting at whatever it was picked with, or one an Engine that
// predates the key would refuse outright.

// The package as committed keeps nine class resources, and its references hold together.
assert.equal(assertRulesetScaled(shippedManifest, parsedAsset, shippedCatalogSources), 9);

const scaledSheet = {
  fields: [
    { id: "level", label: "Level", type: "number" },
    { id: "mood", label: "Mood", type: "text" },
    { id: "casting", label: "Casting", type: "enum", values: ["none", "cha"] },
  ],
  derived: [{ id: "knack_uses", label: "Knack uses" }],
  abilities: [{ id: "cha", label: "Charisma" }],
  skills: [{ id: "roads", label: "Roads" }],
  saves: [{ id: "grit_save", label: "Grit save" }],
  lists: [
    {
      id: "knacks",
      label: "Knacks",
      columns: [
        { id: "name", label: "Name", type: "text" },
        { id: "max", label: "Maximum", type: "number" },
      ],
    },
  ],
};
const scaledCatalog = (entries) => ({ id: "knacks", label: "Knacks", feeds: ["knacks"], entries });
const scaledDocument = (entries) => ({
  id: "test",
  version: 1,
  name: "Test",
  sheet: scaledSheet,
  catalogs: [scaledCatalog(entries)],
});
/** One entry whose single knacks row is kept by the ruleset. */
const scaledEntry = (scaled, values = { name: "Road Sense", max: 1 }, extraRows = []) => ({
  id: "road-sense",
  label: "Road Sense",
  rows: [{ list: "knacks", values, scaled }, ...extraRows],
});
const scaledManifest = rulesetManifest({ capabilityApi: { major: 1, minor: 23 } });
const byLevel = { max: { from: { field: "level" } } };

assert.equal(assertRulesetScaled(scaledManifest, scaledDocument([scaledEntry(byLevel)])), 1);
// A catalog with no scaled row anywhere is untouched, and needs no 1.23.
assert.equal(assertRulesetScaled(rulesetManifest(), testDocument([inlineCatalog])), 0);
assert.equal(assertRulesetScaled(rulesetManifest(), testDocument(undefined)), 0);
assert.throws(
  () =>
    assertRulesetScaled(
      rulesetManifest({ capabilityApi: { major: 1, minor: 22 } }),
      scaledDocument([scaledEntry(byLevel)]),
    ),
  /ships scaled catalog rows and must declare capability API 1\.23/u,
);
assert.doesNotThrow(() =>
  assertRulesetScaled(
    rulesetManifest({ capabilityApi: { major: 2, minor: 0 } }),
    scaledDocument([scaledEntry(byLevel)]),
  ),
);
// A scaled row inside a catalog ASSET is read the same way: the manifest cannot show the keys
// inside either file, so the gate has to open both.
const scaledAssetDocument = {
  id: "test",
  version: 1,
  name: "Test",
  sheet: scaledSheet,
  catalogs: [{ id: "knacks", label: "Knacks", feeds: ["knacks"], asset: "catalogs/knacks.json" }],
};
const scaledAssetSources = (scaled) =>
  new Map([
    ["catalogs/knacks.json", JSON.stringify({ schemaVersion: 1, catalog: "knacks", entries: [scaledEntry(scaled)] })],
  ]);
assert.equal(assertRulesetScaled(scaledManifest, scaledAssetDocument, scaledAssetSources(byLevel)), 1);
assert.throws(
  () =>
    assertRulesetScaled(
      rulesetManifest({ capabilityApi: { major: 1, minor: 22 } }),
      scaledAssetDocument,
      scaledAssetSources(byLevel),
    ),
  /ships scaled catalog rows and must declare capability API 1\.23/u,
);
// An asset this check cannot read is assertRulesetCatalogs' rejection to make, with its own message.
assert.equal(assertRulesetScaled(scaledManifest, scaledAssetDocument, new Map()), 0);

// The column has to be a number column of the very list the row writes into.
assert.throws(
  () => assertRulesetScaled(scaledManifest, scaledDocument([scaledEntry({ grit: { from: { field: "level" } } })])),
  /scales "grit", which is not a number column of "knacks"/u,
);
assert.throws(
  () => assertRulesetScaled(scaledManifest, scaledDocument([scaledEntry({ name: { from: { field: "level" } } })])),
  /scales "name", which is not a number column of "knacks"/u,
);
// `values` still holds what the row starts as, because an entry is picked before anything knows
// which sheet it lands on.
assert.throws(
  () => assertRulesetScaled(scaledManifest, scaledDocument([scaledEntry(byLevel, { name: "Road Sense" })])),
  /scales "max" but its values hold no starting number for it/u,
);
assert.throws(
  () => assertRulesetScaled(scaledManifest, scaledDocument([scaledEntry(byLevel, { name: "Road Sense", max: "1" })])),
  /scales "max" but its values hold no starting number for it/u,
);
// A kept row must be the entry's only one for its list, or a marked row on a sheet could not be
// matched back to the spec that writes it.
assert.throws(
  () =>
    assertRulesetScaled(
      scaledManifest,
      scaledDocument([
        scaledEntry(byLevel, { name: "Road Sense", max: 1 }, [{ list: "knacks", values: { name: "Second" } }]),
      ]),
    ),
  /scales a row that is not its only one for the list "knacks"/u,
);
// One to four columns of a row, because a row is a row and not a second place to declare values.
assert.throws(
  () => assertRulesetScaled(scaledManifest, scaledDocument([scaledEntry({})])),
  /scales 0 columns, not 1 to 4/u,
);
assert.throws(
  () =>
    assertRulesetScaled(
      scaledManifest,
      scaledDocument([
        {
          id: "road-sense",
          label: "Road Sense",
          rows: [
            {
              list: "knacks",
              values: { name: "Road Sense", max: 1 },
              scaled: Object.fromEntries(["a", "b", "c", "d", "e"].map((key) => [key, { from: { const: 1 } }])),
            },
          ],
        },
      ]),
    ),
  /scales 5 columns, not 1 to 4/u,
);
assert.throws(
  () =>
    assertRulesetScaled(scaledManifest, scaledDocument([scaledEntry({ max: { from: { field: "level" }, step: 2 } })])),
  /scaled "max" has the unknown key "step"/u,
);

// The reference. Exactly one key, naming something this sheet really declares and of the right type.
for (const [from, message] of [
  [{}, /from names exactly one of/u],
  [{ field: "level", const: 1 }, /from names exactly one of/u],
  [{ fields: "level" }, /from has the unknown key "fields"/u],
  [{ const: "1" }, /from const must be a finite number/u],
  [{ field: "levels" }, /from names unknown field "levels"/u],
  [{ field: "mood" }, /from field "mood" is not a number/u],
  [{ abilityModFromField: "mood" }, /from field "mood" is not an enum/u],
  [{ abilityModFromField: "casting" }, null],
  [{ derived: "knack_uses" }, null],
  [{ derived: "knack_use" }, /from names unknown derived value "knack_use"/u],
  [{ abilityMod: "cha" }, null],
  [{ abilityMod: "wis" }, /from names unknown ability "wis"/u],
  [{ abilityScore: "wis" }, /from names unknown ability "wis"/u],
  [{ skillMod: "rivers" }, /from names unknown skill "rivers"/u],
  [{ saveMod: "luck_save" }, /from names unknown save "luck_save"/u],
  ["level", /from must be a value reference/u],
]) {
  const document = scaledDocument([scaledEntry({ max: { from } })]);
  if (message) assert.throws(() => assertRulesetScaled(scaledManifest, document), message, JSON.stringify(from));
  else assert.doesNotThrow(() => assertRulesetScaled(scaledManifest, document), JSON.stringify(from));
}

// The step table. Thresholds ascend, because the lookup walks them in order and takes the last one
// at or below the input; a table out of order would simply answer with the wrong step.
for (const [table, message] of [
  [
    [
      [1, 2],
      [3, 3],
    ],
    null,
  ],
  [[], /table must be a non-empty array/u],
  ["1,2", /table must be a non-empty array/u],
  [
    [
      [3, 3],
      [1, 2],
    ],
    /table thresholds must ascend/u,
  ],
  [
    [
      [1, 2],
      [1, 3],
    ],
    /table thresholds must ascend/u,
  ],
  [[[1, 2, 3]], /each table step is a \[threshold, value\] pair of numbers/u],
  [[["1", 2]], /each table step is a \[threshold, value\] pair of numbers/u],
  [Array.from({ length: 101 }, (entry, index) => [index, index]), /table holds 101 steps, over 100/u],
]) {
  const document = scaledDocument([scaledEntry({ max: { from: { field: "level" }, table } })]);
  if (message) assert.throws(() => assertRulesetScaled(scaledManifest, document), message, JSON.stringify(table));
  else assert.doesNotThrow(() => assertRulesetScaled(scaledManifest, document), JSON.stringify(table));
}

// ── Combat (Capability API 1.26) and creatures (1.27) ──
//
// A combat block is nothing but references into the sheet beside it, and a creature is written
// entirely in the combat block's own names, so the same pinning applies once more: each rejection
// is a package that would install and then be a missing number in the middle of a turn, or one an
// Engine that predates the key would refuse outright. These mirror the Engine's own rules and are
// never stricter than them: that was the review lesson on 0.3.0 and 0.4.0.

// The package as committed opts into both, and everything they name holds together.
assert.equal(assertRulesetCombat(shippedManifest, parsedAsset), true);
assert.ok(
  assertRulesetCreatures(shippedManifest, parsedAsset, shippedCatalogSources) > 300,
  "the shipped bestiary must carry the SRD creatures",
);

const combatSheet = {
  fields: [
    { id: "ac", label: "Armor Class", type: "number" },
    { id: "speed", label: "Speed", type: "number" },
    { id: "mood", label: "Mood", type: "text" },
  ],
  derived: [{ id: "initiative", label: "Initiative" }],
  abilities: [{ id: "str", label: "Strength" }],
  skills: [],
  saves: [{ id: "str_save", label: "Strength save" }],
  lists: [
    {
      id: "attacks",
      label: "Attacks",
      columns: [
        { id: "name", label: "Name", type: "text" },
        { id: "ability", label: "Ability", type: "enum", values: ["str"] },
        { id: "proficient", label: "Proficient", type: "boolean" },
        { id: "bonus", label: "Bonus", type: "number" },
        { id: "damage", label: "Damage", type: "dice" },
        { id: "damage_type", label: "Damage type", type: "text" },
      ],
    },
    {
      id: "spells",
      label: "Spells",
      columns: [
        { id: "name", label: "Name", type: "text" },
        { id: "level", label: "Level", type: "number" },
        { id: "prepared", label: "Prepared", type: "boolean" },
      ],
    },
  ],
  live: {
    pools: [{ id: "hp" }, { id: "stress", start: "empty" }],
    tracks: [{ id: "wins" }, { id: "losses" }],
    text: [{ id: "concentration" }],
    conditions: [{ id: "prone" }, { id: "stunned" }],
  },
};
const combatBlock = {
  kind: "attack-vs-defense",
  health: { pool: "hp" },
  defense: { field: "ac" },
  initiative: { dice: { count: 1, sides: 20 }, modifier: { derived: "initiative" } },
  attackRoll: { dice: { count: 1, sides: 20 }, advantage: true, naturals: { max: "critical", min: "miss" } },
  economy: {
    budgets: [
      { id: "action", label: "Action", per: "turn", count: 1 },
      { id: "bonus", label: "Bonus action", per: "turn", count: 1 },
    ],
    movement: { field: "speed" },
  },
  attacks: [
    {
      list: "attacks",
      budget: "action",
      name: "name",
      toHit: { ability: { column: "ability" }, proficiency: { column: "proficient" }, bonus: { column: "bonus" } },
      damage: { dice: { column: "damage" }, ability: { column: "ability" }, type: { column: "damage_type" } },
    },
  ],
  abilities: [{ list: "spells", onlyWhen: "prepared", alwaysWhen: { column: "level", equals: 0 }, budget: "action" }],
  standard: ["dodge", "help"],
  conditions: [{ condition: "prone", effects: ["own-attacks-disadvantage"] }],
  concentration: { text: "concentration", save: "str_save", floor: 10, fromDamage: 0.5 },
  dying: { kind: "saves", successes: "wins", failures: "losses", dice: { count: 1, sides: 20 }, succeedAt: 10 },
  damageTypes: ["fire", "cold"],
  threat: {
    tiers: [
      { id: "low", label: "Low", health: [1, 10], defense: 12, toHit: 3, damagePerRound: [1, 4], saveDifficulty: 11 },
    ],
  },
};
const combatDocument = (combat) => ({ id: "test", version: 1, name: "Test", sheet: combatSheet, combat });
const combatManifest = rulesetManifest({ capabilityApi: { major: 1, minor: 26 } });
/** The shipped block with one thing changed, so every rejection has exactly one cause. */
const combatWith = (edit) => {
  const combat = structuredClone(combatBlock);
  edit(combat);
  return combatDocument(combat);
};

assert.equal(assertRulesetCombat(combatManifest, combatDocument(combatBlock)), true);
// A ruleset with no combat block at all is untouched, and needs no 1.26.
assert.equal(assertRulesetCombat(rulesetManifest(), combatDocument(undefined)), false);
assert.throws(
  () => assertRulesetCombat(rulesetManifest({ capabilityApi: { major: 1, minor: 25 } }), combatDocument(combatBlock)),
  /ships a combat block and must declare capability API 1\.26 or newer/u,
);
assert.doesNotThrow(() =>
  assertRulesetCombat(rulesetManifest({ capabilityApi: { major: 2, minor: 0 } }), combatDocument(combatBlock)),
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.kind = "clash")),
    ),
  /combat kind "clash" is not one the Engine resolves/u,
);

// The pools, fields and derived values a fight reads have to be on the sheet beside it.
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.health = { pool: "vigor" })),
    ),
  /combat health names unknown live pool "vigor"/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.health = { pool: "stress" })),
    ),
  /combat health pool "stress" starts empty, so it cannot be hit points/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.defense = { field: "guard" })),
    ),
  /combat defense names unknown field "guard"/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.defense = { field: "mood" })),
    ),
  /combat defense field "mood" is not a number/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.initiative.modifier = { derived: "wits" })),
    ),
  /combat initiative modifier names unknown derived value "wits"/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.economy.movement = { field: "pace" })),
    ),
  /combat economy movement names unknown field "pace"/u,
);
// A natural result is one face of one die, exactly as it is for a check.
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.attackRoll.dice = { count: 2, sides: 6 })),
    ),
  /combat attack roll naturals need a single die/u,
);
assert.doesNotThrow(() =>
  assertRulesetCombat(
    combatManifest,
    combatWith((combat) => {
      combat.attackRoll.dice = { count: 2, sides: 6 };
      combat.attackRoll.naturals = { max: "none", min: "none" };
    }),
  ),
);

// The action economy: budgets are named once, and everything that spends one names a declared one.
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.economy.budgets = [])),
    ),
  /combat economy declares 1 to 8 budgets/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.economy.budgets[1].id = "action")),
    ),
  /combat repeats the budget "action"/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.economy.budgets[0].per = "fight")),
    ),
  /combat budget "action" refills per turn or per round/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.attacks[0].budget = "swing")),
    ),
  /combat attacks "attacks" budget names unknown budget "swing"/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.abilities[0].budget = "swing")),
    ),
  /combat abilities "spells" budget names unknown budget "swing"/u,
);

// Weapons: every column a fight reads a number out of has to be the right sort of column.
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.attacks[0].list = "gear")),
    ),
  /combat attacks name unknown list "gear"/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.attacks[0].name = "bonus")),
    ),
  /combat attacks name must name a text column, not number/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.attacks[0].damage.dice.column = "name")),
    ),
  /combat attacks damage dice must name a dice column, not text/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.attacks[0].damage.dice.column = "swing")),
    ),
  /combat attacks damage dice names unknown column "swing"/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => delete combat.attacks[0].damage.dice),
    ),
  /combat attacks "attacks" must name the dice column its rows are rolled from/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.attacks[0].toHit.ability.column = "name")),
    ),
  /combat attacks toHit ability must name a enum column, not text/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.attacks[0].toHit.proficiency.column = "bonus")),
    ),
  /combat attacks toHit proficiency must name a boolean column, not number/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.attacks[0].damage.type.column = "bonus")),
    ),
  /combat attacks damage type must name a text or enum column, not number/u,
);

// Abilities are gated exactly as battle skills are, and roll against references the sheet has.
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.abilities[0].onlyWhen = "level")),
    ),
  /combat abilities onlyWhen "level" must name a boolean column/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => delete combat.abilities[0].onlyWhen),
    ),
  /combat abilities alwaysWhen is the exception to onlyWhen, so it needs onlyWhen beside it/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.abilities[0].alwaysWhen.equals = "0")),
    ),
  /combat abilities alwaysWhen "level" is a number column, so equals must be a number/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.abilities[0].toHit = { derived: "aim" })),
    ),
  /combat abilities "spells" toHit names unknown derived value "aim"/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.abilities[0].saveDifficulty = { field: "dc" })),
    ),
  /combat abilities "spells" saveDifficulty names unknown field "dc"/u,
);

// The closed vocabularies: standard actions, condition effects, and the names both point at.
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.standard = ["sprint"])),
    ),
  /combat standard action "sprint" is not one the Engine resolves/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.standard = ["dodge", "dodge"])),
    ),
  /combat repeats the standard action "dodge"/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.conditions[0].condition = "hexed")),
    ),
  /combat maps unknown condition "hexed"/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => combat.conditions.push(combat.conditions[0])),
    ),
  /combat repeats the condition "prone"/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.conditions[0].effects = ["trips"])),
    ),
  /combat condition "prone" has the unknown effect "trips"/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.conditions[0].failsSaves = ["luck_save"])),
    ),
  /combat condition "prone" fails unknown save "luck_save"/u,
);

// Concentration, dying and the damage types.
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.concentration.text = "holding")),
    ),
  /combat concentration names unknown live text "holding"/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.concentration.save = "luck_save")),
    ),
  /combat concentration names unknown save "luck_save"/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.dying.kind = "bleeding")),
    ),
  /combat dying kind "bleeding" is not "saves"/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.dying.successes = "saves")),
    ),
  /combat dying successes names unknown track "saves"/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.dying.failures = "wins")),
    ),
  /combat dying counts successes and failures on two different tracks/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.dying.condition = "hexed")),
    ),
  /combat dying names unknown condition "hexed"/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => {
        combat.dying.dice = { count: 2, sides: 10 };
        combat.dying.naturals = { max: "revive-1" };
      }),
    ),
  /combat dying naturals need a single die/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.damageTypes = ["fire", "Fire"])),
    ),
  /combat repeats the damage type "Fire"/u,
);

// The threat scale: one rung per id, and a band whose lowest is really the lowest.
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.threat.tiers = [])),
    ),
  /combat threat declares 1 to 40 tiers/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => combat.threat.tiers.push(combat.threat.tiers[0])),
    ),
  /combat threat repeats the tier "low"/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.threat.tiers[0].health = [10, 1])),
    ),
  /combat threat tier "low" health lowest is above its highest/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.threat.tiers[0].damagePerRound = [9, 4])),
    ),
  /combat threat tier "low" damagePerRound lowest is above its highest/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.threat.tiers[0].health = [1, 10.5])),
    ),
  /combat threat tier "low" health is a pair of whole numbers/u,
);
assert.throws(
  () =>
    assertRulesetCombat(
      combatManifest,
      combatWith((combat) => (combat.threat.tiers[0].toHit = "3")),
    ),
  /combat threat tier "low" toHit is a whole number/u,
);

// ── Creatures ──

const creature = () => ({
  health: { dice: "3d8", flat: 3 },
  defense: 12,
  initiativeModifier: 1,
  speed: 30,
  abilities: { str: 12 },
  saves: { str_save: 3 },
  resist: ["fire"],
  conditionImmunities: ["prone"],
  tier: "low",
  traits: [{ name: "Wary", text: "It watches the door." }],
  actions: [
    { id: "bite", name: "Bite", budget: "action", toHit: 3, damage: { dice: "1d6", flat: 1, type: "fire" } },
    {
      id: "howl",
      name: "Howl",
      budget: "action",
      save: { save: "str_save", difficulty: 11, onSuccess: "half" },
      damage: { dice: "1d4", type: "cold" },
      applies: [{ condition: "stunned", duration: "until-save", saveEnds: { save: "str_save", at: "turn-end" } }],
    },
    { id: "both", name: "Bite and howl", budget: "action", sequence: [{ action: "bite", times: 2 }] },
  ],
});
const bestiaryDocument = (edit = () => {}, header = {}) => {
  const block = creature();
  edit(block);
  return {
    id: "test",
    version: 1,
    name: "Test",
    sheet: combatSheet,
    combat: combatBlock,
    catalogs: [
      {
        id: "beasts",
        label: "Beasts",
        holds: "creatures",
        entries: [{ id: "hound", label: "Hound", creature: block }],
        ...header,
      },
    ],
  };
};
const creatureManifest = rulesetManifest({ capabilityApi: { major: 1, minor: 27 } });

assert.equal(assertRulesetCreatures(creatureManifest, bestiaryDocument()), 1);
// A ruleset with no bestiary at all is untouched, and needs no 1.27.
assert.equal(assertRulesetCreatures(rulesetManifest(), combatDocument(combatBlock)), 0);
assert.throws(
  () => assertRulesetCreatures(rulesetManifest({ capabilityApi: { major: 1, minor: 26 } }), bestiaryDocument()),
  /ships a bestiary and must declare capability API 1\.27 or newer/u,
);
// A bestiary writes no rows, so it feeds no list, and it needs a fight to be written in.
assert.throws(
  () =>
    assertRulesetCreatures(
      creatureManifest,
      bestiaryDocument(() => {}, { feeds: ["attacks"] }),
    ),
  /catalog "beasts" holds creatures, so it feeds no list/u,
);
assert.throws(
  () =>
    assertRulesetCreatures(creatureManifest, {
      ...bestiaryDocument(),
      combat: undefined,
    }),
  /catalog "beasts" holds creatures, which need a combat block to be written in/u,
);
// Rows and creatures never mix, in either direction.
assert.throws(
  () =>
    assertRulesetCreatures(creatureManifest, {
      ...bestiaryDocument(),
      catalogs: [
        {
          id: "gear",
          label: "Gear",
          feeds: ["attacks"],
          entries: [{ id: "hound", label: "Hound", creature: creature() }],
        },
      ],
    }),
  /catalog "gear" holds rows, so entry "hound" cannot carry a creature/u,
);
for (const [edit, message] of [
  [(entry) => delete entry.creature, /carries no creature, and this catalog holds creatures/u],
  [(entry) => (entry.rows = [{ list: "attacks", values: {} }]), /has both rows and a creature/u],
  [(entry) => (entry.mechanics = { kind: "attack" }), /says what it does in its own actions/u],
]) {
  const document = bestiaryDocument();
  edit(document.catalogs[0].entries[0]);
  assert.throws(() => assertRulesetCreatures(creatureManifest, document), message);
}

// Every name a creature carries is one the ruleset already has.
for (const [edit, message] of [
  [(block) => (block.tier = "deadly"), /names unknown threat tier "deadly"/u],
  [(block) => (block.abilities = { grit: 3 }), /names unknown ability "grit"/u],
  [(block) => (block.saves = { luck_save: 3 }), /names unknown save "luck_save"/u],
  [(block) => (block.resist = ["starfire"]), /is resist to unknown damage type "starfire"/u],
  [(block) => (block.immune = ["starfire"]), /is immune to unknown damage type "starfire"/u],
  [(block) => (block.vulnerable = ["starfire"]), /is vulnerable to unknown damage type "starfire"/u],
  [(block) => (block.conditionImmunities = ["hexed"]), /is immune to unknown condition "hexed"/u],
  [
    (block) => (block.traits = Array.from({ length: 9 }, () => ({ name: "A", text: "B" }))),
    /carries 9 traits, over the 8 limit/u,
  ],
  [(block) => (block.actions = []), /carries 1 to 12 actions, not 0/u],
  [(block) => (block.actions[1].id = "bite"), /repeats the action id "bite"/u],
  [(block) => (block.actions[0].budget = "swing"), /spends unknown budget "swing"/u],
  [(block) => (block.actions[0].damage.type = "starfire"), /deals unknown damage type "starfire"/u],
  [(block) => (block.actions[1].save.save = "luck_save"), /forces unknown save "luck_save"/u],
  [
    (block) => (block.actions[1].saveDifficulty = 12),
    /has a save of its own, and that save's difficulty is what a save-ends uses/u,
  ],
  [(block) => (block.actions[1].applies[0].condition = "hexed"), /applies unknown condition "hexed"/u],
  [(block) => (block.actions[1].applies[0].saveEnds.save = "luck_save"), /ends "stunned" on unknown save "luck_save"/u],
  [(block) => delete block.actions[1].applies[0].saveEnds, /applies "stunned" until a save it does not name/u],
  [
    (block) => {
      delete block.actions[1].save;
      delete block.actions[1].damage;
      block.actions[1].autoHit = true;
    },
    /ends a condition on a save with no difficulty to roll against/u,
  ],
  [(block) => (block.actions[2].toHit = 3), /is a sequence, so it carries no toHit of its own/u],
  [(block) => (block.actions[2].sequence = []), /names 1 to 6 steps, not 0/u],
  [(block) => (block.actions[2].sequence[0].action = "a_stranger"), /names unknown action "a_stranger"/u],
  [(block) => (block.actions[2].sequence[0].action = "both"), /names itself/u],
  [
    (block) => {
      block.actions.push({ id: "again", name: "Again", budget: "action", sequence: [{ action: "both", times: 1 }] });
    },
    /names "both", and a sequence cannot name another/u,
  ],
  [
    (block) => {
      block.actions[0].signature = { cost: 1 };
    },
    /buys an action with points but declares no signaturePoints/u,
  ],
]) {
  assert.throws(() => assertRulesetCreatures(creatureManifest, bestiaryDocument(edit)), message, String(message));
}
// Points declared beside an action bought with them is the shape that passes.
assert.doesNotThrow(() =>
  assertRulesetCreatures(
    creatureManifest,
    bestiaryDocument((block) => {
      block.actions[0].signature = { cost: 1 };
      block.signaturePoints = 3;
    }),
  ),
);
// A bestiary shipped as its own asset is read exactly the same way.
{
  const document = bestiaryDocument();
  const inline = document.catalogs[0].entries;
  document.catalogs[0] = { id: "beasts", label: "Beasts", holds: "creatures", asset: "catalogs/beasts.json" };
  const sources = new Map([
    ["catalogs/beasts.json", JSON.stringify({ schemaVersion: 1, catalog: "beasts", entries: inline })],
  ]);
  assert.equal(assertRulesetCreatures(creatureManifest, document, sources), 1);
  // An asset this check cannot read is assertRulesetCatalogs' rejection to make, with a better message.
  assert.equal(assertRulesetCreatures(creatureManifest, document, new Map()), 0);
}

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
