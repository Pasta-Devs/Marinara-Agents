import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const home = readFileSync(
  join(root, "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx"),
  "utf8",
);
const locale = JSON.parse(
  readFileSync(join(root, "packages/slurp/src/engine/packages/client/src/localization/locales/en.json"), "utf8"),
) as Record<string, string>;

assert.equal(locale["ui.slurp.creatorForm.cancel"], "Cancel");
assert.match(
  home,
  /<StageProfileForm[\s\S]*?onCancel=\{editingProfileId \? closeProfileEditor : cancelCreateProfile\}[\s\S]*?backLabel=\{localizeUi\("ui\.slurp\.creatorForm\.cancel"\)\}/u,
  "Discarding a new Creator profile must be named Cancel",
);
assert.match(
  home,
  /onBack=\{[\s\S]*?\(\) => setCreationStep\("source"\)[\s\S]*?\}/u,
  "Back must remain navigation between setup steps",
);

console.log("Slurp Creator cancel action regression passed");
