import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(repoRoot, "packages/virtual-phone");
const manifest = JSON.parse(await readFile(join(packageRoot, "manifest.json"), "utf8"));
const client = await readFile(join(packageRoot, manifest.entrypoints.client), "utf8");
const server = await readFile(join(packageRoot, manifest.entrypoints.server), "utf8");
const developmentCatalog = JSON.parse(await readFile(join(repoRoot, "test-catalog.json"), "utf8"));
const developmentEntry = developmentCatalog.packages.find((entry) => entry.manifest.id === "virtual-phone");

assert.equal(manifest.id, "virtual-phone");
assert.equal(manifest.version, "2.10.1");
assert.equal(manifest.entrypoints.server, "server.mjs");
assert.equal(manifest.restartRequired, true);
assert.deepEqual(manifest.permissions, ["conversation-actions", "chat-read", "prompt-context", "routes", "storage", "ui"]);
assert.match(client, /marinara-capability-virtual-phone/u);
assert.match(client, /Pay and place order/u);
assert.match(client, /Confirm delivery/u);
assert.doesNotMatch(client, /Story controls/u);
assert.doesNotMatch(client, /Search apps or the web/u);
assert.match(client, /Choose apps for the dock/u);
assert.match(client, /Rich world generation/u);
assert.match(server, /\/shop\/orders/u);
assert.doesNotMatch(server, /Invent 2 to 4 private notes/u);
assert.doesNotMatch(server, /Invent this character's recent money history/u);
assert.doesNotMatch(server, /Describe 2 to 4 photos already/u);
assert.match(server, /This phone is offline/u);
assert.ok(developmentEntry);
assert.match(developmentEntry.iconUrl, /\/hold-the-phone\//u);
assert.match(developmentEntry.artifact.url, /\/hold-the-phone\//u);

console.log("Virtual Phone scaffold valid.");
