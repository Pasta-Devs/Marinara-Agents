import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const definitions = JSON.parse(
  await readFile(new URL("../packages/inventory-tracker/agents.json", import.meta.url), "utf8"),
);
assert.equal(definitions.length, 1);
const [tracker] = definitions;
assert.equal(tracker.id, "inventory-tracker");
assert.equal(tracker.category, "tracker");
assert.equal(tracker.phase, "post_processing");
assert.equal(tracker.defaultInjectAsSection, true);

const prompt = tracker.defaultPromptTemplate;
for (const contract of [
  '"currencies"',
  '"equipped"',
  '"inventory"',
  "Output all three arrays every turn",
  "Copy locked rows exactly",
  "never also in inventory",
  "Omit qty when it is 1",
]) {
  assert.ok(prompt.includes(contract), `Prompt is missing contract: ${contract}`);
}

for (const packageId of ["world-state", "character-tracker", "custom-tracker", "inventory-tracker"]) {
  const [definition] = JSON.parse(
    await readFile(new URL(`../packages/${packageId}/agents.json`, import.meta.url), "utf8"),
  );
  const [incremental, legacy] = definition.defaultPromptTemplate.split("Legacy full-output instructions:\n");
  assert.match(incremental, /When the host explicitly says "tracker_incremental_updates: supported"/);
  assert.match(incremental, /"updates": \[rows\], "removed": \["existing identity"\]/);
  assert.match(incremental, /omitted values stay unchanged/);
  assert.match(incremental, /Without that host marker, use the legacy full-array format/);
  assert.ok(legacy?.includes("Schema:"), `${packageId} retains the older Engine's output contract`);
}
assert.match(prompt, /Every existing quantity change MUST include qty, including qty:1/);
assert.match(prompt, /Only new items may omit qty for 1/);
const example = JSON.parse(prompt.split("Schema:\n")[1].split("\nRules:")[0]);
assert.equal(typeof example.inventory[0].description, "string");
assert.equal(typeof example.inventory[0].location, "string");
assert.match(prompt, /never invent item properties or storage locations/);
assert.match(prompt, /Preserve known details in full arrays/);
assert.match(prompt, /For incremental updates, omit unchanged details/);

console.log("Inventory Tracker package contract regression passed.");
