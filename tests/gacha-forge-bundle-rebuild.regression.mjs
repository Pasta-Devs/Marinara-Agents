import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { rebuildGachaBundles } from "../scripts/gacha-forge-bundle-patches.mjs";

const directory = await mkdtemp(join(tmpdir(), "gacha-rebuild-"));
const root = pathToFileURL(directory + "/");
try {
  const sourceRoot = new URL("../packages/gacha-forge/", import.meta.url);
  for (const file of ["client.js", "server.mjs", "bundle-patches.json", "src"]) {
    await cp(new URL(file, sourceRoot), new URL(file, root), { recursive: true });
  }
  const originalClient = await readFile(new URL("client.js", root), "utf8");
  const originalServer = await readFile(new URL("server.mjs", root), "utf8");
  await rebuildGachaBundles(root);
  assert.equal(await readFile(new URL("client.js", root), "utf8"), originalClient, "clean replay is byte-identical");
  const source = new URL("src/browser-presentation.mjs", root);
  const before = await readFile(source, "utf8");
  await writeFile(source, before + "\n// source rebuild proof\n");
  await rebuildGachaBundles(root);
  const regenerated = await readFile(new URL("client.js", root), "utf8");
  assert.ok(regenerated.includes("// source rebuild proof"), "source changes regenerate an existing bundle");
  await rebuildGachaBundles(root);
  assert.equal(await readFile(new URL("client.js", root), "utf8"), regenerated, "new source replay is deterministic");
  await writeFile(source, before);
  await rebuildGachaBundles(root);
  assert.equal(await readFile(new URL("client.js", root), "utf8"), originalClient, "restoring source restores bytes");
  assert.equal(await readFile(new URL("server.mjs", root), "utf8"), originalServer, "server bytes are preserved");
  await writeFile(new URL("client.js", root), originalClient + "\n// unknown bundle edit");
  await assert.rejects(rebuildGachaBundles(root), /Unrecognized Forge bundle client\.js/u);
  console.log("Forge bundle source rebuild regression passed.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
