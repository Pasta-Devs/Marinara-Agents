// validate-catalog refuses a client that writes browser storage the Engine owns (Pasta-Devs/Marinara-Agents#1478,
// #1487): it may not register a persisted store under an Engine key, set or remove one, or open the Engine's audio
// cache database. Reading the keys stays allowed. The negative controls are published bundles that carried vendored
// Engine stores: Tic-Tac-Toe 1.0.5 (the UI settings), Chess 1.0.5 (chat drafts) and World Maps 1.5.1 (map moves).
// The prebuilt packages, which the de-dup rebuild does not touch, must pass as published.
// Run: node scripts/tests/host-storage-key-gate.regression.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertClientLeavesEngineStorageAlone, readZip } from "../package-manifest-integrity.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function publishedClient(packageId, version) {
  const artifactPath = join(repoRoot, `artifacts/${packageId}-${version}.zip`);
  return readZip(["-p", artifactPath, "client.js"], {
    packageId,
    artifactPath,
    member: "client.js",
    purpose: "read",
  }).stdout.toString("utf8");
}

for (const [packageId, version, control, refusal] of [
  [
    "tic-tac-toe",
    "1.0.5",
    /marinara-engine-ui",version:74/u,
    /registers a persisted store under "marinara-engine-ui"/u,
  ],
  ["chess", "1.0.5", /marinara-input-drafts/u, /writes "marinara-input-drafts"/u],
  [
    "hierarchical-maps",
    "1.5.1",
    /marinara-pending-spatial-transitions/u,
    /writes "marinara-pending-spatial-transitions"/u,
  ],
]) {
  const published = publishedClient(packageId, version);
  assert.match(published, control, `${packageId} ${version} must still carry the vendored store`);
  assert.throws(() => assertClientLeavesEngineStorageAlone(packageId, published), refusal);
}

// Literal and minified writers, including through an identifier bound to the key.
for (const [writer, refusal] of [
  ['localStorage.setItem("marinara-engine-ui", "{}")', /writes "marinara-engine-ui"/u],
  ["window.localStorage.removeItem( 'marinara-engine-ui:host' )", /removes "marinara-engine-ui:host"/u],
  ['var Zt="marinara-active-chat-id";function q(e){localStorage.setItem(Zt,e)}', /writes "marinara-active-chat-id"/u],
  ["const k=`marinara-input-drafts`;sessionStorage.removeItem(k)", /removes "marinara-input-drafts"/u],
  ['persist(()=>({}),{name:"marinara-pinned-gallery-images"})', /registers a persisted store under/u],
  ['let p="marinara_sidecar_prompted",o=1;localStorage.setItem(p,"1")', /writes "marinara_sidecar_prompted"/u],
  ['const D="marinara-tts-audio-cache";indexedDB.open(D,1)', /opens the "marinara-tts-audio-cache" database/u],
]) {
  assert.throws(() => assertClientLeavesEngineStorageAlone("sample", writer), refusal, writer);
}

for (const reader of [
  // Quartermaster reads Debug mode from the key.
  'JSON.parse(localStorage.getItem("marinara-engine-ui"))?.state?.debugMode === true',
  // Noodle imports its old navigation from the key once.
  'var LK="marinara-engine-ui";JSON.parse(window.localStorage.getItem(LK)??"null")',
  // The read-only adapters (sources/host-client-overlay) on an Engine without the namespace.
  'JSON.parse(globalThis.localStorage?.getItem("marinara-engine-ui")??"null")?.state',
  'JSON.parse(globalThis.localStorage?.getItem("marinara-pending-spatial-transitions")??"null")',
  // A package's own key that merely starts like an Engine key.
  'localStorage.setItem("marinara-engine-ui-noodle-legacy","1")',
  // A comparison is not a binding.
  'if(key==="marinara-input-drafts")localStorage.setItem(key2,"x")',
]) {
  assert.doesNotThrow(() => assertClientLeavesEngineStorageAlone("sample", reader), reader);
}

// Prebuilt packages ship as they are, so they must already leave Engine storage alone.
for (const packageId of [
  "beholder",
  "gacha-forge",
  "quartermaster",
  "relationship-tracker",
  "pixelforge",
  "modern-life-sim",
  "long-term-memory",
  "memory-nag",
]) {
  const client = await readFile(join(repoRoot, `packages/${packageId}/client.js`), "utf8");
  assert.doesNotThrow(() => assertClientLeavesEngineStorageAlone(packageId, client), packageId);
}

console.log("Engine storage key gate: ok");
