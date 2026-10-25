import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { rebuildGachaBundles } from "../scripts/gacha-forge-bundle-patches.mjs";

const directory = await mkdtemp(join(tmpdir(), "gacha-rebuild-"));
const root = pathToFileURL(join(directory, "packages/gacha-forge") + "/");
try {
  const sourceRoot = new URL("../packages/gacha-forge/", import.meta.url);
  await mkdir(root, { recursive: true });
  const shared = pathToFileURL(join(directory, "sources/engine/packages/shared/dist") + "/");
  for (const file of ["constants/model-lists.js"]) {
    const target = new URL(file, shared);
    await mkdir(new URL("./", target), { recursive: true });
    await cp(new URL(`../sources/engine/packages/shared/dist/${file}`, import.meta.url), target);
  }
  for (const file of ["client.js", "server.mjs", "bundle-patches.json", "src"]) {
    await cp(new URL(file, sourceRoot), new URL(file, root), { recursive: true });
  }
  const originalClient = await readFile(new URL("client.js", root), "utf8");
  const originalServer = await readFile(new URL("server.mjs", root), "utf8");
  await rebuildGachaBundles(root);
  assert.equal(await readFile(new URL("client.js", root), "utf8"), originalClient, "clean replay is byte-identical");
  assert.equal(
    await readFile(new URL("server.mjs", root), "utf8"),
    originalServer,
    "server clean replay is byte-identical",
  );
  const sources = [
    ["browser-presentation", ["client.js"]],
    ["material-navigation", ["client.js"]],
    ["story-entry", ["client.js"]],
    ["upgrade-assist-client", ["client.js"]],
    ["upgrade-assist-server", ["server.mjs"]],
    ["time-zone-server", ["server.mjs"]],
    ["player-choice-text", ["client.js", "server.mjs"]],
    ["home-presentation", ["client.js"]],
    ["unit-notifications", ["client.js"]],
    ["image-avatar-references", ["server.mjs"]],
    ["story-memory", ["server.mjs"]],
    ["story-memory-integration", ["server.mjs"]],
    ["story-memory-fit", ["server.mjs"]],
    ["story-memory-shared", ["server.mjs"]],
    ["shared-token-estimator", ["server.mjs"]],
    ["story-memory-client", ["client.js"]],
    ["story-memory-en", ["client.js"]],
    ["enemy-encounters-client", ["client.js"]],
    ["enemy-encounters-server", ["server.mjs"]],
    ["player-choices-en", ["client.js"]],
    ["player-choices-client", ["client.js"]],
    ["player-choices-server", ["server.mjs"]],
    ["audio-settings", ["client.js", "server.mjs"]],
    ["audio-en", ["client.js"]],
    ["audio-client", ["client.js"]],
    ["audio-story", ["client.js"]],
  ];
  for (const [name, bundles] of sources) {
    const source = new URL(`src/${name}.mjs`, root);
    const before = await readFile(source, "utf8");
    // Bundled helpers discard comments; a pure export proves their input is rebuilt as well.
    const marker =
      name === "story-memory-shared" ? "export const forgeRebuildProof = true;" : "// source rebuild proof";
    const changed =
      name === "shared-token-estimator"
        ? before.replace("hundredthTokens / 100", "hundredthTokens / 101.125")
        : before + `\n${marker}\n`;
    assert.notEqual(changed, before, `${name} fixture changes its source`);
    await writeFile(source, changed);
    await rebuildGachaBundles(root);
    const regenerated = new Map();
    for (const bundle of bundles) {
      const value = await readFile(new URL(bundle, root), "utf8");
      assert.ok(
        value.includes(
          name === "story-memory-shared"
            ? "forgeRebuildProof"
            : name === "shared-token-estimator"
              ? "101.125"
              : "// source rebuild proof",
        ),
        `${name} changes regenerate ${bundle}`,
      );
      regenerated.set(bundle, value);
    }
    await rebuildGachaBundles(root);
    for (const [bundle, value] of regenerated) {
      assert.equal(await readFile(new URL(bundle, root), "utf8"), value, `${name} ${bundle} replay is deterministic`);
    }
    await writeFile(source, before);
    await rebuildGachaBundles(root);
    for (const bundle of bundles) {
      assert.equal(
        await readFile(new URL(bundle, root), "utf8"),
        bundle === "server.mjs" ? originalServer : originalClient,
        `${name} restoring source restores ${bundle}`,
      );
    }
  }
  assert.equal(await readFile(new URL("client.js", root), "utf8"), originalClient, "client sources stay independent");
  assert.equal(await readFile(new URL("server.mjs", root), "utf8"), originalServer, "server sources stay independent");
  await writeFile(new URL("client.js", root), originalClient + "\n// unknown bundle edit");
  await assert.rejects(rebuildGachaBundles(root), /Unrecognized Forge bundle client\.js/u);
  console.log("Forge bundle source rebuild regression passed.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
