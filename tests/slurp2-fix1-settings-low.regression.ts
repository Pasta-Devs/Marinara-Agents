import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Fix phase 1, batch M (REVIEW-1 settings + cross-cutting low): R1-133, R1-134, R1-137, R1-139, R1-140,
// R1-141, R1-142.
const pkg = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(pkg, path), "utf8");
const en = JSON.parse(read("client/src/slp/locales/en.json")) as Record<string, string>;

// R1-133: Reset drops staged edits of the same keys.
assert.match(read("client/src/slp/app/backstage/SlpBackstageShell.tsx"), /!\(key in reset\)/u);
// R1-134: Studio, Activity and valid Backstage places survive a reload.
const store = read("client/src/slp/base/state/slp-package-store.ts");
assert.match(store, /case "studio":\s*case "notifications":\s*return true;/u);
assert.match(store, /legacy && !\(isSlpBackstageSection\(value\.section\) && isSlpBackstageTarget\(value\.target\)\)/u);
// R1-137: page names are localized.
assert.equal(en["ui.slurp.settings.backstage.targets.improve"], "Improve with AI");
assert.doesNotMatch(
  read("client/src/slp/features/backstage/SlpBackstageNavigation.tsx"),
  /\{SLP_BACKSTAGE_TARGET_LABELS\[item\]\}/u,
);
// R1-139: no persona → an honest empty page.
assert.match(
  read("client/src/slp/app/screens/SlpHomeDestinations.tsx"),
  /!viewerPersonaId &&\s*\(navigation\.view === "wallet"/u,
);
// R1-140: the open chat resets with the persona.
assert.match(
  read("client/src/slp/features/messages/SlpMessages.tsx"),
  /if \(threadPersonaId !== personaId\) \{\s*setThreadPersonaId\(personaId\);\s*setOpenThreadId\(null\);/u,
);
// R1-141: rebalance failures are reported.
assert.equal(
  (read("client/src/slp/features/audience/SlpFanTypesPanel.tsx").match(/rebalanceFailed/gu) ?? []).length >= 2,
  true,
);
// R1-142: English singulars exist for count copy.
for (const key of [
  "ui.slurp.studio.likes",
  "ui.slurp.moments.views",
  "ui.slurp.settings.backstage.apply.staged",
  "ui.noodle.noodlepostcard.showMoreComments",
])
  assert.ok(en[`${key}_one`] && !/\{\{count\}\} \w+s\b/u.test(en[`${key}_one`]!.replace("{{count}} more", "")), key);

console.log("slurp2 fix1 settings low regression passed");
