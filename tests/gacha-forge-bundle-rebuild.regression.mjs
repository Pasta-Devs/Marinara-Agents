import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
  // The ledger also pastes the shared forge kit, which sits beside the package at sources/forge-kit.
  const kitSource = new URL("../sources/forge-kit/", import.meta.url);
  const kit = pathToFileURL(join(directory, "sources/forge-kit") + "/");
  await cp(kitSource, kit, { recursive: true });
  const kitNames = new Set(
    (await readdir(kitSource)).filter((file) => file.endsWith(".mjs")).map((file) => file.replace(/\.mjs$/u, "")),
  );
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
    ["weapon-eligibility", ["server.mjs"]],
    ["time-zone-server", ["server.mjs"]],
    ["chat-continuity-server", ["server.mjs"]],
    ["story-cancel-server", ["server.mjs"]],
    ["character-card-context", ["server.mjs"]],
    ["story-expressions", ["client.js", "server.mjs"]],
    ["story-expressions-server", ["server.mjs"]],
    ["player-choice-text", ["client.js", "server.mjs"]],
    ["home-presentation", ["client.js"]],
    ["background-download-client", ["client.js"]],
    ["background-unlocks-client", ["client.js"]],
    ["background-unlocks-server", ["server.mjs"]],
    ["unit-notifications", ["client.js"]],
    ["unit-art-client", ["client.js"]],
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
    ["audio-prompts", ["server.mjs"]],
    ["audio-en", ["client.js"]],
    ["voice-picking", ["client.js"]],
    ["audio-client", ["client.js"]],
    ["audio-story", ["client.js"]],
    ["formation-combat-shared", ["client.js", "server.mjs"]],
    ["formation-combat-server", ["server.mjs"]],
    ["formation-combat-legacy", ["server.mjs"]],
    ["formation-migration-server", ["server.mjs"]],
    ["formation-combat-en", ["client.js"]],
    ["formation-combat-client", ["client.js"]],
    ["formation-settings-en", ["client.js"]],
    ["formation-settings-client", ["client.js"]],
    ["combat-voices-server", ["server.mjs"]],
    ["combat-voices-en", ["client.js"]],
    ["combat-voices-client", ["client.js"]],
    ["combat-ultimate-client", ["client.js"]],
    ["seasonal-events-server", ["server.mjs"]],
    ["seasonal-events-adapter", ["server.mjs"]],
    ["seasonal-events-client", ["client.js"]],
    ["seasonal-events-en", ["client.js"]],
  ];
  const listed = new Set(sources.map(([name]) => name));
  for (const name of kitNames) assert.ok(listed.has(name), `forge kit module ${name} has a rebuild proof entry`);
  // Every source changes at once, each with its own proof, so the whole list takes four rebuilds rather than three per
  // source; a proof names its source and ends in a period, so no proof is a prefix of another.
  const changes = [];
  for (const [name, bundles] of sources) {
    const source = kitNames.has(name) ? new URL(`${name}.mjs`, kit) : new URL(`src/${name}.mjs`, root);
    const before = await readFile(source, "utf8");
    // Bundled helpers discard comments; a pure export proves their input is rebuilt as well.
    const proof =
      name === "story-memory-shared"
        ? "forgeRebuildProof"
        : name === "shared-token-estimator"
          ? "101.125"
          : `// source rebuild proof: ${name}.`;
    const changed =
      name === "story-memory-shared"
        ? before + `\nexport const ${proof} = true;\n`
        : name === "shared-token-estimator"
          ? before.replace("hundredthTokens / 100", `hundredthTokens / ${proof}`)
          : before + `\n${proof}\n`;
    assert.notEqual(changed, before, `${name} fixture changes its source`);
    await writeFile(source, changed);
    changes.push({ name, bundles, source, before, proof });
  }
  await rebuildGachaBundles(root);
  const regenerated = new Map();
  for (const bundle of ["client.js", "server.mjs"]) {
    regenerated.set(bundle, await readFile(new URL(bundle, root), "utf8"));
  }
  for (const { name, bundles, proof } of changes) {
    for (const bundle of bundles) {
      assert.ok(regenerated.get(bundle).includes(proof), `${name} changes regenerate ${bundle}`);
    }
  }
  await rebuildGachaBundles(root);
  for (const [bundle, value] of regenerated) {
    assert.equal(
      await readFile(new URL(bundle, root), "utf8"),
      value,
      `changed sources ${bundle} replay is deterministic`,
    );
  }
  for (const { source, before } of changes) await writeFile(source, before);
  await rebuildGachaBundles(root);
  assert.equal(
    await readFile(new URL("client.js", root), "utf8"),
    originalClient,
    "restoring sources restores client.js",
  );
  assert.equal(
    await readFile(new URL("server.mjs", root), "utf8"),
    originalServer,
    "restoring sources restores server.mjs",
  );
  await writeFile(new URL("client.js", root), originalClient + "\n// unknown bundle edit");
  await assert.rejects(rebuildGachaBundles(root), /Unrecognized Forge bundle client\.js/u);
  console.log("Forge bundle source rebuild regression passed.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
