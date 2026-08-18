import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const [noodleView, noodleTypes, slurpEntry, slurpTypes] = await Promise.all([
    readFile("packages/noodle/src/engine/packages/client/src/components/noodle/NoodleView.tsx", "utf8"),
    readFile("packages/noodle/src/engine/packages/client/src/components/noodle/noodle-navigation.types.ts", "utf8"),
    readFile("packages/slurp/src/engine/packages/client/src/slurp-package-entry.tsx", "utf8"),
    readFile("packages/slurp/src/engine/packages/client/src/components/slurp/slurp-navigation.types.ts", "utf8"),
  ]);
  assert.doesNotMatch(noodleView, /Noodler|noodler/u);
  assert.doesNotMatch(noodleTypes, /Noodler|noodler/u);
  assert.match(slurpEntry, /SlurpHome/u);
  assert.match(slurpEntry, /marinara-capability-slurp/u);
  assert.match(slurpTypes, /mode: "creator"/u);
  assert.match(slurpTypes, /sourceAccountId: string/u);
  assert.doesNotMatch(slurpTypes, /mode: "noodler"/u);
  console.log("Noodle and Slurp navigation isolation regressions passed.");
}

void main();
