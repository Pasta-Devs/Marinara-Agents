/**
 * #115: a restore must leave settings alone unless the user opts in AND the archive carries
 * slurp2 settings, so a Legacy import can no longer wipe every setting.
 * #123: subscribing implies following; the Following feed reads one union set. Because the union
 * pins followed=true, a subscriber could never unfollow, so the follow toggle is hidden behind the
 * subscribed flag and replaced by a static "Subscribed" badge.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { slurp2BackstageSource } from "./slurp2-backstage-source";
import { slurp2Source } from "./slurp2-source";
import { isSlurpPreferenceSettingKey } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/maintenance/slp-backup";

const pkg = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => slurp2Source(join(pkg, path));

const storage = read("server/src/services/storage/slurp.storage.ts");
const importStart = storage.indexOf("async importSlurpBackup(");
const importBody = storage.slice(importStart, storage.indexOf("await tx._fileStore.flush();", importStart));
assert.match(
  importBody,
  /const carriesKeys = Object\.keys\(backup\.settings \?\? \{\}\)\.some\(\(key\) => key\.startsWith\(SLURP_SETTINGS_NAMESPACE\)\);\s*const replaceSettings = backup\.importSettings === true && carriesKeys;/u,
  "preferences are replaced only on opt-in with slurp2 settings present",
);
// R1-100: only preferences wait for the opt-in; data keys (wallets, earnings, storylines) come back with the tables.
assert.match(
  importBody,
  /const restoresKey = \(key: string\) => replaceSettings \|\| !isSlurpPreferenceSettingKey\(key\);/u,
);
const guard = importBody.indexOf("if (carriesKeys) {");
assert.ok(
  guard > 0 && guard < importBody.indexOf("settingsTx.remove("),
  "nothing is wiped when the archive carries no slurp2 keys (a Legacy import)",
);
assert.match(
  importBody,
  /for \(const row of stale\) if \(restoresKey\(String\(row\.key\)\)\) await settingsTx\.remove/u,
);
assert.match(importBody, /if \(restoresKey\(key\)\) await settingsTx\.set\(key, value\);/u);
for (const key of ["slurp2.settings", "slurp2.image-connections", "slurp2.post-guidance", "slurp2.viewer.p1.settings"])
  assert.equal(isSlurpPreferenceSettingKey(key), true, key);
for (const key of [
  "slurp2.viewer.v1.wallet",
  "slurp2.creator.c1.earnings",
  "slurp2.creator.c1.projects",
  "slurp2.creator.c1.goal",
  "slurp2.creator.c1.wardrobe",
  "slurp2.creator-prices",
  "slurp2.canon-anchors",
])
  assert.equal(isSlurpPreferenceSettingKey(key), false, key);

const routes = read("server/src/routes/slurp.routes.ts");
assert.match(routes, /importSlurpBackup\(\{ settings, tables, importSettings \}\)/u);
assert.match(routes, /restoreImportSettingsRequested\(req\.query\)/u, "the route reads the opt-in flag");
assert.match(
  read("server/src/services/slurp/slurp-backup.ts"),
  /importSettings === "1"/u,
  "the opt-in flag defaults off",
);
assert.match(
  routes,
  /const followedIds = new Set\(\[\.\.\.\(viewer\.settings\.social\.followingAccountIds \?\? \[\]\), \.\.\.subscribedIds\]\)/u,
  "subscribed creators count as followed",
);

const client = read("client/src/hooks/use-slurp.ts");
assert.match(client, /startSlurpRestore\(archive: File \| Blob, importSettings = false\)/u);
assert.match(client, /inspectSlurpRestore\(archive: File \| Blob\)/u);
assert.match(client, /applySlurpRestoreInspection\(/u);
const settingsUi = slurp2BackstageSource();
assert.match(settingsUi, /useState\(false\);\n\s*const \[restoreImportSettings/u);
assert.match(settingsUi, /inspectSlurpRestore\(file\)/u);
assert.match(settingsUi, /const inspection = restoreInspection;[\s\S]*?showConfirmDialog\(/u);
assert.match(settingsUi, /applySlurpRestoreInspection\(inspection\.id, restoreImportSettings\)/u);
assert.match(settingsUi, /restoreInspection\.hasSlurp2Settings/u);

const home = read("client/src/components/slurp/SlurpHome.tsx");
assert.doesNotMatch(
  home,
  /followingAccountIds/u,
  "the client must use the server's followed flag, not the raw follow list",
);
assert.match(
  routes,
  /subscribed: context\.subscribedIds\.has\(account\.id\)/u,
  "the creator payload that carries followed must also carry subscribed",
);
const followButton = home.indexOf("onClick={() => onToggleFollow(");
assert.ok(followButton > 0, "the profile follow toggle must still exist for non-subscribers");
const beforeFollow = home.slice(0, followButton);
assert.match(
  beforeFollow.slice(beforeFollow.lastIndexOf("leadingActions=")),
  // 0.0.8 dropped the static badge: the subscribe button already shows the subscription, so the
  // follow toggle is simply hidden while subscribed. Step 3.2: "subscribed" means renewing; a
  // cancelled one gets the fan row again under Resume subscription.
  /\{renewing \? \(/u,
  "the follow toggle must be gated on viewerCreator.subscribed",
);

console.log("slurp2 restore settings and follow regression passed");
