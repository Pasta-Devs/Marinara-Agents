import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const base = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/garnish-ads/garnish-ads.base.ts",
  "utf8",
);
assert.match(base, /kind: "inline"/u);
assert.match(base, /kind: "creator"/u);
assert.match(base, /contentRating: "/u, "every base ad needs a content rating for the host gate");

const ads = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/garnish-ads/garnish-ads.service.ts",
  "utf8",
);
assert.match(ads, /function creatorAdForProfile/u);
// The stored state key is deliberately unchanged by the garnish-ads rename, so
// existing hidden-ad lists survive.
assert.match(ads, /slurp\.viewer\.\$\{subjectId\}\.ads/u);

const seam = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-garnish-context.ts",
  "utf8",
);
assert.match(seam, /function garnishTagsFromPersona/u);

const routes = readFileSync("packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts", "utf8");
assert.match(routes, /\/noodler\/viewer\/ads/u);
assert.match(routes, /inlineAdsEnabled/u);

const card = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpInlineAd.tsx", "utf8");
assert.match(card, /labels\.sponsored/u);
assert.match(card, /labels\.hide/u);
assert.match(card, /onAction/u, "inline promotion CTA must be wired");
assert.match(card, /ExternalLink/u, "inline promotion CTA must communicate an action");

const home = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");
assert.match(
  home,
  /slurpSettingsQuery\.data\?\.inlineAdsEnabled !== false/u,
  "Home must honor the inline promotion setting",
);
assert.match(home, /ui\.slurp\.ads\.opened/u, "the inline promotion CTA must provide user feedback");

const settings = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpSettings.tsx",
  "utf8",
);
assert.match(settings, /ui\.slurp\.settings\.inlinePromotions/u);
assert.match(settings, /ui\.slurp\.settings\.inlinePromotionsDetail/u);

const postCard = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpCreatorPostCard.tsx",
  "utf8",
);
assert.match(postCard, /Paid partnership with/u);

// The slot maths decides where ads land in the feed, and an off-by-one here silently wastes the
// first slot. Run the real expression rather than matching its source text.
const slotSource = home.match(
  /const inlineAdForIndex = \(index: number\) => \{[\s\S]*?index % inlineAdEvery !== inlineAdEvery - 1\) return null;\s*return inlineAdsQuery\.data\?\.items\[([^\]]+)\] \?\? null;/u,
);
assert.ok(slotSource, "inlineAdForIndex must keep its slot expression in one readable place");
const adIndexFor = (index: number, inlineAdEvery: number) =>
  index % inlineAdEvery !== inlineAdEvery - 1
    ? null
    : (new Function("index", "inlineAdEvery", `return ${slotSource[1]};`) as (i: number, e: number) => number)(
        index,
        inlineAdEvery,
      );
for (const every of [2, 4, 8]) {
  const slots = [...Array(40).keys()].filter((index) => adIndexFor(index, every) !== null);
  assert.deepEqual(
    slots.map((index) => adIndexFor(index, every)),
    slots.map((_value, position) => position),
    `every=${every}: the nth ad slot must take the nth ad, starting at the first one`,
  );
  assert.equal(slots[0], every - 1, `every=${every}: the first ad must follow the first ${every} posts`);
}

console.log("Slurp promotion regressions passed.");
