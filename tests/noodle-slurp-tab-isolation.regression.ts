import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function manifest(packageId: "noodle" | "slurp") {
  return JSON.parse(readFileSync(`packages/${packageId}/manifest.json`, "utf8")) as {
    contributions?: { homeBrowserTab?: { iconPaths?: string[] } };
  };
}

assert.deepEqual(manifest("noodle").contributions?.homeBrowserTab?.iconPaths, ["noodle-klusek.png"]);
assert.deepEqual(manifest("slurp").contributions?.homeBrowserTab?.iconPaths, ["slurp-logo.png"]);

const noodleShell = readFileSync(
  "packages/noodle/src/engine/packages/client/src/components/noodle/NoodleShell.tsx",
  "utf8",
);
const slurpShell = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpShell.tsx",
  "utf8",
);
for (const [surface, source] of [
  ["Noodle", noodleShell],
  ["Slurp", slurpShell],
] as const) {
  assert.doesNotMatch(
    source,
    /NoodleModeToggle|BOW_SWAP_KEYFRAMES|data-noodle-bow/u,
    `${surface} retains mode-switch UI`,
  );
}

console.log("Noodle and Slurp tab isolation regressions passed.");
