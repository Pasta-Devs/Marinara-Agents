import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Bulk onboarding queries characters only, on purpose. That leaves the active persona with no
// obvious way to become a Creator: it is reachable only by hunting for itself in the generic
// source picker. This entry point is the separate persona path, and it must stay separate from
// character creation rather than being folded back into the bulk list.

const home = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");
const routes = readFileSync("packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts", "utf8");
const storage = readFileSync("packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts", "utf8");
const enLocale = JSON.parse(
  readFileSync("packages/slurp/src/engine/packages/client/src/localization/locales/en.json", "utf8"),
) as Record<string, string>;

// The persona's own Creator is found by the link back to its Noodle account, not by name.
assert.match(home, /id: persona\.id,/u);
assert.doesNotMatch(home, /id: `persona:\$\{persona\.id\}`/u);
assert.match(
  home,
  /accountsQuery\.data\?\.find\(\s*\(profile\) => profile\.sourceAccountId === shellPersonaAccount\.id,?\s*\)/u,
);
assert.match(storage, /sourceAccountId: account\.sourceEntityId,/u);
assert.doesNotMatch(storage, /slurpSourceAccountId: account\.sourceEntityId,/u);

// Both destinations reuse navigation targets that already existed: create-profile preselects the
// source and opens at the disclosure step, so this adds no parallel creation flow.
assert.match(home, /view: "create-profile",\s*sourceAccountId: shellPersonaAccount\.id,/u);
assert.match(
  home,
  /onOpenProfile:[\s\S]*?mainAuthorProfile[\s\S]*?view: "profile"[\s\S]*?shellPersonaAccount[\s\S]*?view: "create-profile"[\s\S]*?sourceAccountId: shellPersonaAccount\.id/u,
  "The shell profile action must open or create the active persona's Creator profile",
);
assert.match(
  home,
  /myCreatorProfile\s*\?\s*\{\s*mode: "creator",\s*view: "profile",\s*accountId: myCreatorProfile\.id,?\s*\}/u,
);
assert.match(
  home,
  /navigation\.mode !== "creator" \|\| navigation\.view !== "create-profile"\)[\s\S]{0,240}setCreationStep\("disclosure"\)/u,
  "create-profile must still open at the disclosure step with the source preselected",
);

// No active persona means no button at all, rather than one that navigates nowhere.
assert.match(home, /\{shellPersonaAccount && \(\s*<button/u);

// The label flips once the persona has a Creator, so the button never offers a second one.
assert.match(
  home,
  /myCreatorProfile\s*\?\s*"ui\.noodle\.noodlerhome\.myCreatorProfile"\s*:\s*"ui\.noodle\.noodlerhome\.createMyCreatorProfile",/u,
);
for (const key of [
  "ui.noodle.noodlerhome.myCreatorProfile",
  "ui.noodle.noodlerhome.createMyCreatorProfile",
  "ui.noodle.noodlerhome.myCreatorProfileDetail",
]) {
  assert.equal(typeof enLocale[key], "string", `${key} must exist in the English catalog`);
}
assert.match(enLocale["ui.noodle.noodlerhome.myCreatorProfileDetail"], /\{\{persona\}\}/u);

// A persona that already has a Creator is filtered out by the direct source key, so the create
// branch cannot be reached for one — the button must be showing "My Creator profile" by then.
assert.match(routes, /linkedIds\.has\(`\$\{account\.kind\}:\$\{account\.entityId\}`\)/u);

// Bulk onboarding stays character-only; this path is what covers personas.
const bulk = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpOnboardingPanel.tsx",
  "utf8",
);
assert.doesNotMatch(bulk, /kind="persona"|"persona"\s*\)/u, "bulk onboarding must not start listing personas");

console.log("NoodleR persona Creator entry-point regressions passed.");
