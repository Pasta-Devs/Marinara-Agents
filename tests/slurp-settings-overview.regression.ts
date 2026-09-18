import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  slurpActivityPresetForSettings,
  slurpActivityPresetPatch,
} from "../packages/slurp2/src/engine/packages/client/src/components/slurp/slurp-activity-presets";
import { slurp2BackstageSource } from "./slurp2-backstage-source";
import { slurp2Source } from "./slurp2-source";

assert.equal(slurpActivityPresetForSettings({ autoPostingScheduleEnabled: false, postsPerDay: 7 }), "manual");
assert.equal(slurpActivityPresetForSettings({ autoPostingScheduleEnabled: true, postsPerDay: 4 }), "lively");
assert.equal(slurpActivityPresetForSettings({ autoPostingScheduleEnabled: true, postsPerDay: 3 }), null);
assert.deepEqual(slurpActivityPresetPatch("manual"), { autoPostingScheduleEnabled: false });
assert.deepEqual(slurpActivityPresetPatch("veryActive"), {
  autoPostingScheduleEnabled: true,
  postsPerDay: 8,
});

async function main() {
  const [settings, navigation, store, home, shell, english] = await Promise.all([
    slurp2BackstageSource(),
    readFile("packages/slurp2/src/engine/packages/client/src/components/slurp/slurp-navigation.types.ts", "utf8"),
    slurp2Source("packages/slurp2/src/engine/packages/client/src/stores/slurp-package.store.ts"),
    slurp2Source("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpHome.tsx"),
    readFile("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpShell.tsx", "utf8"),
    slurp2Source("packages/slurp2/src/engine/packages/client/src/localization/locales/en.json"),
  ]);

  assert.match(navigation, /section\?: SlurpBackstageSection;/u);
  assert.match(navigation, /target\?: SlurpBackstageTarget;/u);
  // The store validates both halves of a deep link and migrates every persisted legacy section.
  assert.match(store, /isSlurpBackstageSection\(value\.section\)/u);
  assert.match(store, /targetBelongsToSection\(value\.section, value\.target\)/u);
  assert.match(store, /SLURP_LEGACY_SETTINGS_DESTINATION/u);
  assert.match(home, /section: "overview"/u);
  assert.match(settings, /const settingsSections = SLURP_SETTINGS_SECTIONS;/u);
  assert.match(
    navigation,
    /SLURP_BACKSTAGE_SECTIONS as SLURP_SETTINGS_SECTIONS/u,
    "the five Backstage destinations must remain the shared navigation source",
  );
  assert.match(settings, /section === "overview"/u);
  assert.match(settings, /const imagesReady = imageConnections\.length > 0 && imageEnabledCreators\.length > 0/u);
  assert.match(settings, /updatePatch\(\{ autoPostingScheduleEnabled: true, postsPerDay: value \}\)/u);
  assert.match(settings, /slurpAudiencePresetFor\(settings\)/u);
  assert.match(settings, /<OverviewActivity/u);
  assert.match(settings, /section === "overview" \|\| target === "audience"/u);
  assert.match(english, /"ui\.slurp\.settings\.overview\.activity\.title": "Activity"/u);
  assert.match(settings, /<ChoiceRow/u);
  assert.match(shell, /"--slurp-hero"/u);
  assert.match(shell, /"--slurp-nav-active"/u);
  assert.match(english, /"ui\.slurp\.settings\.tabs\.overview": "Overview"/u);
  assert.match(home, /inlineAdsEnabled=\{slurpSettingsQuery\.data\?\.inlineAdsEnabled !== false\}/u);
  assert.match(home, /if \(!inlineAdsEnabled \|\| searchTerm \|\| tab !== "all" \|\| !ad\) return null;/u);
  assert.match(home, /onCompose: openPostComposer/u);
  assert.match(settings, /value=\{settings\.inlineAdsEnabled\}/u);
  assert.match(settings, /target === "ads"/u);
  assert.match(settings, /inlineAdsFrequency/u);
  assert.match(settings, /inlineAdsSteering/u);
  // Deleting everything cannot be undone, so it needs the typed word, not a default button.
  assert.match(
    settings,
    /showPromptDialog\(\{\s*title: t\("ui\.slurp\.settings\.advanced\.deleteAllConfirmTitle"\)[\s\S]{0,500}?if \(typed\?\.trim\(\) !== "DELETE"\) return;\s*deleteAllData\.mutate/u,
  );
  // Lorebook context is opt-in, scoped to Slurp, and never costs a post.
  assert.match(settings, /update\("enableLorebookContext", value\)/u);
  const generation = await readFile(
    "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-generation.service.ts",
    "utf8",
  );
  assert.match(generation, /settings\.enableLorebookContext\s*\?\s*await processLorebooks\(/u);
  assert.match(generation, /generationTriggers: \["slurp"\],\s*previewOnly: true,/u);
  assert.match(
    generation,
    /\.catch\(\(error: unknown\) => \{\s*logger\.warn\(error, "\[slurp\] Lorebook context failed/u,
  );
  assert.match(generation, /"# World lore", protect\(input\.loreContext\)/u);
  // Carryover to chats is controlled from Slurp itself.
  assert.match(settings, /ui\.slurp\.settings\.carryover\.title/u);
  assert.match(settings, /update\(\s*"carryoverModes"/u);
  assert.match(
    shell,
    /data-component="NoodleView\.MobileBottomNav"[\s\S]*data-component="NoodleView\.MobileAccountSwitcher"/u,
  );
  // The persona avatar is the drawer trigger now; the bottom bar carries no logo.
  assert.match(
    shell,
    /data-component="NoodleView\.MobileAccountSwitcher"[\s\S]*?onClick=\{\(\) => onMobileDrawerOpenChange\(true\)\}/u,
  );
  assert.match(shell, /onClick=\{onOpenMessages\}/u, "the bottom bar must reach Messages");
  assert.match(shell, /onClick=\{onOpenWallet\}/u, "the menu must reach the Wallet");
  assert.doesNotMatch(
    shell.slice(
      shell.indexOf('data-component="NoodleView.MobileDrawer"'),
      shell.indexOf("</aside>", shell.indexOf('data-component="NoodleView.MobileDrawer"')),
    ),
    /MobileAccountSwitcher/u,
  );

  console.log("Slurp settings overview regressions passed.");
}

void main();
