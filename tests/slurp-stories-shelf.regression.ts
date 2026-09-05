import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");

assert.match(home, /onAddStory=\{openStoryComposer\}/u);
assert.match(home, /updateNoodlerPostDraft\(mainAuthorProfile\.id, \{ postType: "story", poll: null, title: "" \}\)/u);
assert.match(home, /useState\(draft\.postType === "story"\)/u);
assert.match(home, /ui\.slurp\.moments\.add/u);
assert.match(home, /ui\.slurp\.moments\.detail/u);
assert.match(home, /border-b border-\[var\(--noodle-divider\)\].*slurp-surface-raised/u);

for (const locale of ["de", "en", "ko", "pl"]) {
  const messages = JSON.parse(
    readFileSync(`packages/slurp/src/engine/packages/client/src/localization/locales/${locale}.json`, "utf8"),
  ) as Record<string, unknown>;
  assert.equal(typeof messages["ui.slurp.moments.add"], "string", `${locale} must label the Add Story action`);
}

console.log("slurp stories shelf regression passed");
