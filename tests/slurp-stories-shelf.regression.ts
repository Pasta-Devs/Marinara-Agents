import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");

assert.match(home, /onAddStory=\{openStoryComposer\}/u);
assert.match(home, /updateNoodlerPostDraft\(mainAuthorProfile\.id, \{ postType: "story", poll: null, title: "" \}\)/u);
assert.match(home, /useState\(draft\.postType === "story"\)/u);
assert.match(home, /ui\.slurp\.moments\.add/u);
assert.doesNotMatch(home, /localizeUi\("ui\.slurp\.moments\.detail"\)/u);
assert.match(home, /border-b border-\[var\(--noodle-divider\)\].*slurp-surface-raised/u);
assert.match(home, /function SlurpMomentShelfTile/u);
assert.match(home, /aspect-\[3\/4\]/u, "Story shelf items must preview the Story rather than only its avatar");
assert.match(home, /useSlurpMediaSrc\(moment\.post\.imageUrl, \{ width: 320 \}\)/u);
assert.match(home, /linear-gradient\(to_top,rgba\(9,5,12,0\.92\)/u, "Story labels need a readable media fade");
assert.match(home, /scroll-padding-inline-start:1rem/u, "scroll snapping must preserve the shelf's leading inset");
assert.doesNotMatch(home, /bg-\[linear-gradient\(145deg,var\(--noodle-accent\),var\(--slurp-warm\)\)\]/u);

for (const locale of ["de", "en", "ko", "pl"]) {
  const messages = JSON.parse(
    readFileSync(`packages/slurp/src/engine/packages/client/src/localization/locales/${locale}.json`, "utf8"),
  ) as Record<string, unknown>;
  assert.equal(typeof messages["ui.slurp.moments.add"], "string", `${locale} must label the Add Story action`);
}

console.log("slurp stories shelf regression passed");
