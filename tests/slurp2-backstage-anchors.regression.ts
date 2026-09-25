import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";

import { slurp2Source } from "./slurp2-source";
import {
  SLP_BACKSTAGE_TARGETS,
  type SlpBackstageTarget,
} from "../packages/slurp2/src/engine/packages/client/src/slp/base/navigation/slp-backstage-target";
import { SLP_BACKSTAGE_SETTING_PLACEMENT } from "../packages/slurp2/src/engine/packages/client/src/slp/features/backstage/slp-backstage-placement";
import { SLP_CREATOR_SETTING_TAB } from "../packages/slurp2/src/engine/packages/client/src/slp/features/creators/settings/slp-creator-settings-contract";

// Backstage is a thin host over one explicit panel registry. This proves the registry is complete,
// unambiguous, statically inspectable, and that every searchable setting lands on a real anchor in
// the real component the registry names. There is no React renderer in this repository, so the
// registry entries are resolved to their component files and those files are read; the browser
// suite is what exercises the rendered DOM.

const client = join(import.meta.dirname, "../packages/slurp2/src/engine/packages/client/src");
const registryPath = join(client, "slp/app/backstage/slp-backstage-registry.ts");
const registry = readFileSync(registryPath, "utf8");
const read = (file: string) => readFileSync(join(client, file), "utf8");

// --- the registry is a plain, inspectable list -------------------------------------------------

const imports = new Map(
  [...registry.matchAll(/import\s+\{\s*([\w$]+)\s*\}\s+from\s+"([^"]+)"/gu)].map(([, name, from]) => [name, from]),
);
const entries = [...registry.matchAll(/\{\s*target:\s*"([^"]+)",\s*Component:\s*([\w$]+)\s*\}/gu)].map(
  ([, target, component]) => ({ target: target as SlpBackstageTarget, component }),
);
assert.ok(entries.length > 0, "the Backstage panel registry must list its entries literally");

// No glob loading, no filesystem discovery, no side-effect registration, no import-time mutation.
assert.doesNotMatch(registry, /import\.meta\.glob|require\.context|readdirSync|globSync/u, "no glob loading");
assert.doesNotMatch(registry, /\bimport\s*\(/u, "no dynamic import");
assert.doesNotMatch(registry, /\bregister[A-Z]\w*\(/u, "no side-effect registration");
assert.doesNotMatch(registry, /^\s*(?:globalThis|window)\./mu, "no import-time global mutation");

// --- every target has exactly one entry, and every entry has a known target --------------------

const registered = entries.map((entry) => entry.target);
assert.deepEqual(
  [...new Set(registered)].sort(),
  registered.slice().sort(),
  "no Backstage target may appear twice in the registry",
);
assert.deepEqual(
  registered.slice().sort(),
  [...SLP_BACKSTAGE_TARGETS].sort(),
  "every Backstage target has exactly one registry entry, and the registry invents none",
);

// --- each entry resolves to a real component in a real file -----------------------------------

const panelFile = new Map<SlpBackstageTarget, string>();
for (const entry of entries) {
  const specifier = imports.get(entry.component);
  assert.ok(specifier, `${entry.component} must be imported directly, not built at run time`);
  const file = `${join(dirname("slp/app/backstage/slp-backstage-registry.ts"), specifier)}.tsx`;
  const source = read(file);
  assert.match(
    source,
    new RegExp(`export function ${entry.component}\\b`, "u"),
    `${file} must export ${entry.component}`,
  );
  panelFile.set(entry.target, file);
}

// --- every non-internal setting renders its anchor on its registered panel ---------------------

// A Creator-scoped setting is not on a Backstage page at all: it lives in the Creator settings
// modal, which the Creators page opens. Its anchor has to exist in one of that modal's sections,
// and the modal has to be reachable from the page the placement names.
const creatorSettingsDir = join(client, "slp/features/creators/settings");
const creatorSettingsSource = readdirSync(creatorSettingsDir)
  .filter((name) => /\.tsx?$/u.test(name))
  .map((name) => readFileSync(join(creatorSettingsDir, name), "utf8"))
  .join("\n");
const missing = Object.entries(SLP_BACKSTAGE_SETTING_PLACEMENT)
  .filter(([key, placement]) => {
    if (placement.internal) return false;
    const host = placement.scope === "creator" ? creatorSettingsSource : read(panelFile.get(placement.target)!);
    // A pair control takes its keys as props (`settingKey: "…"`) and draws the anchors itself.
    return !host.includes(`settingKey="${key}"`) && !host.includes(`settingKey: "${key}"`);
  })
  .map(
    ([key, placement]) =>
      `${key} -> ${placement.scope === "creator" ? "creator settings modal" : panelFile.get(placement.target)}`,
  );
assert.deepEqual(missing, [], "each non-internal setting has a SettingAnchor on its registered panel");

// The modal is only a home for those settings if the page that owns them can open it, and if a
// search result for one of them knows which tab to open.
const creatorsPanel = read("slp/features/creators/SlpCreatorsPanel.tsx");
assert.match(creatorsPanel, /openSlpCreatorSettings\(/u, "the Creators page opens the settings modal");
for (const [key, placement] of Object.entries(SLP_BACKSTAGE_SETTING_PLACEMENT)) {
  if (placement.internal || placement.scope !== "creator") continue;
  assert.ok(
    SLP_CREATOR_SETTING_TAB[key],
    `${key} lives in the Creator settings modal, so it must name the tab a search result opens`,
  );
}

// Internal settings stay host-only: they are runtime or setup state with no Backstage control, so
// they are hidden from search and exempt from anchors. Keep that exemption honest and non-empty.
const internal = Object.entries(SLP_BACKSTAGE_SETTING_PLACEMENT).filter(([, placement]) => placement.internal);
assert.ok(internal.length > 0, "the internal-setting exemption must still describe real settings");
for (const [, placement] of internal) {
  assert.ok(SLP_BACKSTAGE_TARGETS.includes(placement.target), "an internal setting still names a real target");
}

// --- unknown targets keep the old fallback ------------------------------------------------------

const shell = read("slp/app/backstage/SlpBackstageShell.tsx");
assert.match(registry, /function slpBackstagePanelFor\([^)]*\): SlpBackstagePanelEntry \| undefined/u);
assert.match(shell, /const panel = slpBackstagePanelFor\(target\);/u);
// An unknown target renders the frame with no panel, exactly as the self-gating pages did.
assert.match(shell, /\{Panel \? <Panel \{\.\.\.page\} \/> : null\}/u);
// The host must not keep a second lookup beside the registry.
assert.doesNotMatch(shell, /switch \(target\)/u, "the shell must not duplicate the registry with a switch");
assert.equal(
  (shell.match(/\{\.\.\.page\} \/>/gu) ?? []).length,
  3,
  "the shell renders one registry panel plus its two overlays, and no hard-coded page list",
);

// --- preserved negatives -------------------------------------------------------------------------

// Settings controls stage edits through update()/updatePatch() so they reach Review and apply.
// Library item editors use their own mutations and never call save(), so the allowlist is empty.
const engine = join(import.meta.dirname, "../packages/slurp2/src/engine");
const directSaveAllowlist: string[] = [];
for (const key of ["SlurpBackstageWorld.tsx", "SlurpBackstageAutomation.tsx"]) {
  const lines = slurp2Source(join(engine, "packages/client/src/components/slurp", key))
    .split("\n")
    .filter((line) => /\bsave\(/u.test(line) && !directSaveAllowlist.some((allowed) => line.includes(allowed)));
  assert.deepEqual(lines, [], `${key} must not save plain settings directly`);
}

// Search deep links: the key travels with navigation, the shell focuses the anchor, and the list is a real listbox.
const navigation = read("slp/features/backstage/SlpBackstageNavigation.tsx");
assert.match(shell, /onSelect=\{\(nextSection, nextTarget, settingKey\)/u);
assert.match(shell, /focusSettingAnchor\(settingKey\)/u);
assert.match(navigation, /role="listbox"/u);
assert.match(navigation, /aria-activedescendant=/u);
assert.match(navigation, /!placement\.internal/u);
assert.match(read("slp/modules/settings/SlpSettingsKit.tsx"), /data-setting-key=\{settingKey\}/u);

console.log("slurp2 backstage anchors regression passed");
