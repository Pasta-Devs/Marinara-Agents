import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");
const routes = readFileSync("packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts", "utf8");

assert.match(home, /onAddStory=\{openStoryComposer\}/u);
assert.match(home, /updateNoodlerPostDraft\(mainAuthorProfile\.id, \{ postType: "story", poll: null, title: "" \}\)/u);
assert.match(home, /useState\(draft\.postType === "story"\)/u);
assert.match(home, /ui\.slurp\.moments\.add/u);
assert.doesNotMatch(home, /localizeUi\("ui\.slurp\.moments\.detail"\)/u);
assert.match(home, /aria-label=\{localizeUi\("ui\.slurp\.moments\.title"\)\}/u);
assert.doesNotMatch(home, /id="slurp-moments-heading"/u, "The rail must not spend a visible row on a heading");
assert.match(home, /border-b border-\[var\(--noodle-divider\)\].*slurp-surface-raised/u);
assert.match(home, /function SlurpMomentShelfTile/u);
assert.match(home, /aspect-\[3\/4\]/u, "Story shelf items must preview the Story rather than only its avatar");
assert.match(home, /useSlurpMediaSrc\(moment\.post\.imageUrl, \{ width: 320 \}\)/u);
assert.match(home, /72 \* 60 \* 60 \* 1000/u, "Stories must remain available for 72 hours");
assert.match(home, /Keep a Creator's active Stories together/u, "Story navigation must group a Creator's sequence");
assert.match(home, /useRecordSlurpStoryView/u, "Opening a Story must record a view");
assert.match(routes, /noodler\/stories\/:id\/view/u, "Story views need a write route");
assert.match(routes, /noodler\/stories\/:id\/views/u, "Creators need a Story viewer-list route");
assert.match(home, /useSlurpStoryViews/u, "The Story viewer list must be visible in the UI");
assert.match(home, /ui\.slurp\.moments\.views/u, "The Story viewer must show its viewer count");
assert.match(home, /linear-gradient\(to_top,rgba\(9,5,12,0\.92\)/u, "Story labels need a readable media fade");
assert.match(home, /scroll-padding-inline-start:1rem/u, "scroll snapping must preserve the shelf's leading inset");
assert.doesNotMatch(home, /bg-\[linear-gradient\(145deg,var\(--noodle-accent\),var\(--slurp-warm\)\)\]/u);

for (const locale of ["de", "en", "ko", "pl"]) {
  const messages = JSON.parse(
    readFileSync(`packages/slurp2/src/engine/packages/client/src/localization/locales/${locale}.json`, "utf8"),
  ) as Record<string, unknown>;
  assert.equal(typeof messages["ui.slurp.moments.add"], "string", `${locale} must label the Add Story action`);
}

console.log("slurp stories shelf regression passed");
