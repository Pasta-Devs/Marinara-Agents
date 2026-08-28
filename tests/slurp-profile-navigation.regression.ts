import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const home = readFileSync(
  join(root, "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx"),
  "utf8",
);
const settings = readFileSync(
  join(root, "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpSettings.tsx"),
  "utf8",
);

assert.match(
  home,
  /const prepareNavigationAwayFromProfileEditor = async \(\) => \{[\s\S]*?confirmDiscardProfileDraft\(\)[\s\S]*?clearProfileEditorState\(\)/u,
  "Editor navigation must confirm and clear the draft before leaving",
);
for (const handler of ["goToHub", "goToNoodlerSearch"]) {
  const start = home.indexOf(`const ${handler} = async`);
  const end = home.indexOf(";\n  ", start + 1);
  const source = home.slice(start, end > start ? end : start + 500);
  assert.match(
    source,
    /prepareNavigationAwayFromProfileEditor\(\)/u,
    `${handler} must clear editor state before navigation`,
  );
}
assert.match(
  home,
  /const closeProfileEditor = async \(\) => \{[\s\S]*?prepareNavigationAwayFromProfileEditor\(\)/u,
  "Closing the editor must use the same draft cleanup path",
);
assert.match(settings, /const commit = async \(raw = draft, resetInvalid = true\)/u);
assert.match(settings, /void commit\(nextDraft, false\)/u, "Number steppers must persist native arrow input events");

console.log("Slurp profile navigation regressions passed");
