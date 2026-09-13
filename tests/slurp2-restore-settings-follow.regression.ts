/**
 * #115: a restore must leave settings alone unless the user opts in AND the archive carries
 * slurp2 settings, so a Legacy import can no longer wipe every setting.
 * #123: subscribing implies following; the Following feed reads one union set.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pkg = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(pkg, path), "utf8");

const storage = read("server/src/services/storage/slurp.storage.ts");
const importStart = storage.indexOf("async importSlurpBackup(");
const importBody = storage.slice(importStart, storage.indexOf("await tx._fileStore.flush();", importStart));
assert.match(
  importBody,
  /const replaceSettings =\s*backup\.importSettings === true &&\s*Object\.keys\(backup\.settings \?\? \{\}\)\.some\(\(key\) => key\.startsWith\(SLURP_SETTINGS_NAMESPACE\)\)/u,
  "settings are replaced only on opt-in with slurp2 settings present",
);
const guard = importBody.indexOf("if (replaceSettings) {");
assert.ok(guard > 0 && guard < importBody.indexOf("settingsTx.remove("), "the settings wipe must sit behind the opt-in guard");

const routes = read("server/src/routes/slurp.routes.ts");
assert.match(routes, /importSlurpBackup\(\{ settings, tables, importSettings \}\)/u);
assert.match(routes, /importSettings === "1"/u, "the route reads the opt-in flag, default off");
assert.match(
  routes,
  /const followedIds = new Set\(\[\.\.\.\(viewer\.settings\.social\.followingAccountIds \?\? \[\]\), \.\.\.subscribedIds\]\)/u,
  "subscribed creators count as followed",
);

const client = read("client/src/hooks/use-slurp.ts");
assert.match(client, /startSlurpRestore\(archive: File \| Blob, importSettings = false\)/u);
const settingsUi = read("client/src/components/slurp/SlurpSettings.tsx");
assert.match(settingsUi, /useState\(false\);\n\s*const \[restoreImportSettings/u);
assert.match(settingsUi, /startSlurpRestore\(file, restoreImportSettings\)/u);

const home = read("client/src/components/slurp/SlurpHome.tsx");
assert.doesNotMatch(home, /followingAccountIds/u, "the client must use the server's followed flag, not the raw follow list");

console.log("slurp2 restore settings and follow regression passed");
