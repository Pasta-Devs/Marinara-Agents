import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const card = readFileSync("packages/slurp/src/engine/packages/server/src/services/slurp/slurp-share-card.ts", "utf8");
// Every field on the card is user- or model-authored, so it reaches the SVG untrusted. One
// unescaped `&` in a display name would produce invalid XML and fail the whole render.
assert.match(card, /function escapeXml/u);
for (const field of ["input.displayName", "input.handle"]) {
  assert.match(card, new RegExp(`escapeXml\\(${field.replace(".", "\\.")}\\)`, "u"), `${field} must be escaped`);
}
assert.match(card, /escapeXml\(line\)/u, "wrapped title and body lines must be escaped");
// No sharp means no card, never a broken download.
assert.match(card, /if \(!sharp\) return null;/u);

const routes = readFileSync("packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts", "utf8");
const shareRoute = routes.slice(
  routes.indexOf('"/noodler/posts/:id/share-card"'),
  routes.indexOf('app.post("/noodler/posts/:id/interactions"'),
);
assert.ok(shareRoute.length > 0, "the share-card route must exist");
// A share card of a locked post would be a way to read paid content for free.
assert.match(shareRoute, /readable\.locked/u, "a locked post must never be rendered for a viewer");
assert.match(shareRoute, /post\.access === "locked"/u, "a locked post must never be rendered on the owner path");
assert.match(shareRoute, /Content-Disposition/u);

const postCard = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpPostCard.tsx",
  "utf8",
);
const menu = postCard.slice(postCard.indexOf("ui.noodle.noodlepostcard.postActions"));
// Share is on every post; edit and delete stay behind the management capability.
assert.match(menu, /ui\.slurp\.post\.share/u);
assert.match(menu, /\{ctx\.postManagement && \(/u, "edit and delete must stay gated");
assert.doesNotMatch(
  postCard.slice(
    postCard.indexOf("{/*\n              The menu is on every post"),
    postCard.indexOf("ui.slurp.post.share"),
  ),
  /\{ctx\.postManagement && \(\n\s+<div className="relative shrink-0">/u,
  "the menu container itself must not be gated",
);

console.log("slurp-share-card regression passed");
