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

console.log("Inventory Tracker package contract regression passed.");
