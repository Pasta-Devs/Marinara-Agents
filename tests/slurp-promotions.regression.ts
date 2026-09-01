import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ads = readFileSync("packages/slurp/src/engine/packages/server/src/services/slurp/slurp-ads.ts", "utf8");
assert.match(ads, /kind: "inline"/u);
assert.match(ads, /kind: "creator"/u);
assert.match(ads, /function adTagsFromPersona/u);
assert.match(ads, /function creatorPromotionForAccount/u);
assert.match(ads, /slurp\.viewer\.\$\{personaId\}\.ads/u);

const routes = readFileSync("packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts", "utf8");
assert.match(routes, /\/noodler\/viewer\/ads/u);
assert.match(routes, /inlineAdsEnabled/u);

const card = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpInlineAd.tsx", "utf8");
assert.match(card, /Sponsored/u);
assert.match(card, /Hide this ad/u);

const postCard = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpCreatorPostCard.tsx",
  "utf8",
);
assert.match(postCard, /Paid partnership with/u);

console.log("Slurp promotion regressions passed.");
