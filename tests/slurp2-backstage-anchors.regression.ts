import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SLURP_BACKSTAGE_SETTING_PLACEMENT,
  type SlurpBackstageSection,
} from "../packages/slurp2/src/engine/packages/client/src/components/slurp/slurp-backstage";

const dir = join(import.meta.dirname, "../packages/slurp2/src/engine/packages/client/src/components/slurp");
const read = (file: string) => readFileSync(join(dir, file), "utf8");

const pageFile: Record<SlurpBackstageSection, string> = {
  overview: "SlurpBackstageOverview.tsx",
  creators: "SlurpBackstageCreators.tsx",
  world: "SlurpBackstageWorld.tsx",
  automation: "SlurpBackstageAutomation.tsx",
  prompts: "SlurpBackstagePrompts.tsx",
  maintenance: "SlurpBackstageMaintenance.tsx",
};

// Every searchable setting must render an anchor on the page its registry entry names, or search lands nowhere.
const missing = Object.entries(SLURP_BACKSTAGE_SETTING_PLACEMENT)
  .filter(
    ([key, placement]) => !placement.internal && !read(pageFile[placement.section]).includes(`settingKey="${key}"`),
  )
  .map(([key, placement]) => `${key} -> ${pageFile[placement.section]}`);
assert.deepEqual(missing, [], "each non-internal setting has a SettingAnchor on its registry page");

// World and Automation stage edits through update()/updatePatch() so they reach Review and apply.
// Library item editors use their own mutations and never call save(), so the allowlist is empty.
const directSaveAllowlist: string[] = [];
for (const file of [pageFile.world, pageFile.automation]) {
  const lines = read(file)
    .split("\n")
    .filter((line) => /\bsave\(/u.test(line) && !directSaveAllowlist.some((allowed) => line.includes(allowed)));
  assert.deepEqual(lines, [], `${file} must not save plain settings directly`);
}

// Search deep links: the key travels with navigation, the shell focuses the anchor, and the list is a real listbox.
const shell = read("SlurpSettings.tsx");
const chrome = read("SlurpBackstageChrome.tsx");
assert.match(shell, /onSelect=\{\(nextSection, nextTarget, settingKey\)/u);
assert.match(shell, /focusSettingAnchor\(settingKey\)/u);
assert.match(chrome, /role="listbox"/u);
assert.match(chrome, /aria-activedescendant=/u);
assert.match(chrome, /!placement\.internal/u);
assert.match(read("SlurpBackstageKit.tsx"), /data-setting-key=\{settingKey\}/u);

console.log("slurp2 backstage anchors regression passed");
