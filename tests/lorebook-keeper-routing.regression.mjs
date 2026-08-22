import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageRoot = new URL("../packages/lorebook-keeper/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", packageRoot), "utf8"));
const agents = JSON.parse(await readFile(new URL("agents.json", packageRoot), "utf8"));
const keeper = agents.find((agent) => agent.id === "lorebook-keeper");

assert.equal(manifest.version, "1.0.5");
assert.ok(keeper, "Lorebook Keeper definition must exist");
assert.match(keeper.defaultPromptTemplate, /Classify every durable fact before writing it/u);
for (const category of ["npc", "world", "scene", "player"]) {
  assert.match(keeper.defaultPromptTemplate, new RegExp(`- ${category}:`, "u"));
  assert.equal(typeof keeper.defaultSettings.lorebookNamingScheme[category], "string");
}
assert.match(keeper.defaultPromptTemplate, /Inspect <writable_lorebooks>/u);
assert.match(keeper.defaultPromptTemplate, /Never use an alias when a matching writable book already exists/u);
assert.match(keeper.defaultPromptTemplate, /If none exists, set targetLorebook to the category alias/u);
assert.match(keeper.defaultPromptTemplate, /never omit targetLorebook/u);
assert.match(
  keeper.defaultPromptTemplate,
  /never write to the original\/default lorebook merely because it is attached/u,
);

process.stdout.write("Lorebook Keeper routing regression passed.\n");
