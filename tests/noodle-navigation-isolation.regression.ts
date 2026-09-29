import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const [noodleView, noodleTypes] = await Promise.all([
    readFile("packages/noodle/src/engine/packages/client/src/components/noodle/NoodleView.tsx", "utf8"),
    readFile("packages/noodle/src/engine/packages/client/src/components/noodle/noodle-navigation.types.ts", "utf8"),
  ]);
  assert.doesNotMatch(noodleView, /Noodler|noodler/u);
  assert.doesNotMatch(noodleTypes, /Noodler|noodler/u);
  console.log("Noodle navigation isolation regressions passed.");
}

void main();
