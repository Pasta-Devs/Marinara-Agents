import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("packages/noodle/manifest.json", "utf8")) as {
  contributions?: { homeBrowserTab?: { iconPaths?: string[] } };
};
assert.deepEqual(manifest.contributions?.homeBrowserTab?.iconPaths, ["noodle-klusek.png"]);

const noodleShell = readFileSync(
  "packages/noodle/src/engine/packages/client/src/components/noodle/NoodleShell.tsx",
  "utf8",
);
assert.doesNotMatch(
  noodleShell,
  /NoodleModeToggle|BOW_SWAP_KEYFRAMES|data-noodle-bow/u,
  "Noodle retains mode-switch UI",
);

console.log("Noodle tab isolation regressions passed.");
