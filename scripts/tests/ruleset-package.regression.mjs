import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packageArtifactName } from "../catalog-path-safety.mjs";
import { createDeterministicZip } from "../deterministic-zip.mjs";
import {
  RULESET_ASSET_PATH,
  assertRulesetAssetDocument,
  assertRulesetPackageContract,
  isRulesetPackage,
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

// The published artifact must be reproducible: the same manifest and asset bytes
// have to produce the same zip, or every rebuild would churn the catalog's sha256
// and the Engine would see an "update" that changed nothing.
const manifestBuffer = Buffer.from(`${JSON.stringify(shippedManifest, null, 2)}\n`);
const assetBuffer = await readFile(join(packageRoot, RULESET_ASSET_PATH));
const zipEntries = [
  { name: "manifest.json", data: manifestBuffer },
  { name: RULESET_ASSET_PATH, data: assetBuffer },
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
