// A fingerprint ratchet on the published server.mjs of every code package (Pasta-Devs/Marinara-Agents#1487).
// Each fingerprint is a literal that only one stateful Engine module (or library) contains, so finding it in a
// package server means that package ships its own copy of the module: a second llama-server manager, a
// second connection-admission table, a second Intiface client, a Pino worker. The baseline lists the
// (package, fingerprint) pairs published today; a new pair fails, and so does a listed pair that is gone, so the
// list only shrinks. The de-dup rebuild empties it.
// Run: node scripts/tests/server-singleton-gate.regression.mjs
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const engineServer = join(root, "sources/engine/packages/server/src");
const baselinePath = join(root, "scripts/server-singleton-baseline.json");

/** fingerprint -> where it comes from (a vendored Engine module, or an npm package). */
export const SERVER_SINGLETON_FINGERPRINTS = {
  "Timed out waiting for the local sidecar server": "services/sidecar/sidecar-process.service.ts",
  "sidecar-config.json": "services/sidecar/sidecar-model.service.ts",
  "is not available for background generation.": "services/generation/connection-admission.ts",
  CLAUDE_CODE_ENTRYPOINT: "npm:@anthropic-ai/claude-agent-sdk",
  "pino-pretty": "lib/logger.ts",
  ButtplugNodeWebsocketClientConnector: "services/haptic/buttplug-service.ts",
  "https://accounts.spotify.com/api/token": "services/spotify/spotify.service.ts",
};

// The proof: each vendored fingerprint really is in the module it names, and in no other vendored server module.
for (const [fingerprint, origin] of Object.entries(SERVER_SINGLETON_FINGERPRINTS)) {
  if (origin.startsWith("npm:")) continue;
  assert.ok(
    readFileSync(join(engineServer, origin), "utf8").includes(fingerprint),
    `${fingerprint} is not in ${origin}`,
  );
  const elsewhere = readdirSync(engineServer, { recursive: true })
    .filter((path) => /\.(ts|mjs|js)$/u.test(path) && path !== origin)
    .filter((path) => readFileSync(join(engineServer, path), "utf8").includes(fingerprint));
  assert.deepEqual(elsewhere, [], `${fingerprint} also appears in ${elsewhere.join(", ")}`);
}

const packagesDir = join(root, "packages");
const found = {};
for (const id of readdirSync(packagesDir).sort()) {
  const serverPath = join(packagesDir, id, "server.mjs");
  if (!existsSync(serverPath)) continue;
  const bundle = readFileSync(serverPath, "utf8");
  const hits = Object.keys(SERVER_SINGLETON_FINGERPRINTS).filter((fingerprint) => bundle.includes(fingerprint));
  if (hits.length) found[id] = hits.sort();
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8")).packages;
const failures = [];
for (const [id, hits] of Object.entries(found)) {
  for (const fingerprint of hits) {
    if (!baseline[id]?.includes(fingerprint)) {
      failures.push(
        `${id}/server.mjs contains "${fingerprint}" (${SERVER_SINGLETON_FINGERPRINTS[fingerprint]}): ` +
          "it bundles a copy of a stateful Engine service; reach it through api.runtime",
      );
    }
  }
}
for (const [id, listed] of Object.entries(baseline)) {
  for (const fingerprint of listed) {
    if (!found[id]?.includes(fingerprint)) {
      failures.push(
        `${id}/server.mjs no longer contains "${fingerprint}"; remove it from scripts/server-singleton-baseline.json`,
      );
    }
  }
}
assert.deepEqual(failures, [], failures.join("\n"));
console.log(
  `Server singleton gate: ${Object.values(found).flat().length} baselined copies in ${Object.keys(found).length} packages`,
);
