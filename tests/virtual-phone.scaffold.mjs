import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(repoRoot, "packages/virtual-phone");
const manifest = JSON.parse(await readFile(join(packageRoot, "manifest.json"), "utf8"));
const client = await readFile(join(packageRoot, manifest.entrypoints.client), "utf8");
const developmentCatalog = JSON.parse(await readFile(join(repoRoot, "test-catalog.json"), "utf8"));
const developmentEntry = developmentCatalog.packages.find((entry) => entry.manifest.id === "virtual-phone");

assert.equal(manifest.id, "virtual-phone");
assert.equal(manifest.version, "2.0.3");
assert.equal(manifest.entrypoints.server, "server.mjs");
assert.equal(manifest.restartRequired, true);
assert.deepEqual(manifest.permissions, ["routes", "storage", "ui"]);
assert.match(client, /marinara-capability-virtual-phone/u);
assert.ok(developmentEntry);
assert.match(developmentEntry.iconUrl, /\/hold-the-phone\//u);
assert.match(developmentEntry.artifact.url, /\/hold-the-phone\//u);

console.log("Virtual Phone scaffold valid.");
