/**
 * Merge V, M, R, F into laser-guided-slurp: the follow-ups decided on R and F. Brand deals are a Stir
 * lever (planner, deck, preview with the logo, fitting products first), "Write new ads" writes whole
 * brands, "Posts per day" grows with the Creators unless the player set it, and the budget summary
 * shows tokens only.
 */
import assert from "node:assert/strict";
import {
  slurpPostsPerDayIsCustom,
  slurpSizedPostsPerDay,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-model-budget.ts";
import { SLP_ACTION_META } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-actions.ts";
import { buildSlpStirPlanMessages } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/assist/slp-stir-plan.ts";
import { slurp2Source } from "./slurp2-source.ts";

const root = "packages/slurp2/src/engine/packages";
const source = (side: "client" | "server" | "shared", path: string) => slurp2Source(`${root}/${side}/src/slp/${path}`);

// --- F: "Posts per day" = 2 + 1.9 per active Creator, inside 1–96 --------------------------------
// Pulse + E (orchestrator, 2026-09-29): never below the old default 4, so 0 Creators give 4, not 2.
assert.equal(slurpSizedPostsPerDay(0), 4);
assert.equal(slurpSizedPostsPerDay(3), 8);
assert.equal(slurpSizedPostsPerDay(8), 17, "the sim's 17 at 8 Creators");
assert.equal(slurpSizedPostsPerDay(100), 96, "never above the setting's ceiling");
assert.equal(slurpSizedPostsPerDay(-2), 4);
// Only a number the player set stays: a fresh install and the shipped 4 grow, another number is theirs.
assert.equal(slurpPostsPerDayIsCustom({}), false);
assert.equal(slurpPostsPerDayIsCustom({ postsPerDay: 4 }), false);
assert.equal(slurpPostsPerDayIsCustom({ postsPerDay: 10 }), true);
assert.equal(slurpPostsPerDayIsCustom({ postsPerDay: 10, postsPerDayCustom: false }), false);
assert.equal(slurpPostsPerDayIsCustom({ postsPerDay: 4, postsPerDayCustom: true }), true);
assert.match(
  source("server", "modules/settings/slp-settings.ts"),
  /candidate\.postsPerDayCustom = slurpPostsPerDayIsCustom\(rawRecord\);/u,
);
// Every reader sees the sized number (one chokepoint), a PATCH with a number marks it as the player's.
assert.match(
  source("server", "data/creators/slp-creators-storage-1.ts"),
  /if \(!settings\.postsPerDayCustom\)\s+settings\.postsPerDay = slurpSizedPostsPerDay\(await countSlurpActiveCreators\(db\)\);/u,
);
assert.match(
  source("server", "data/creators/slp-creators-storage-2.ts"),
  /input\.postsPerDay !== undefined && input\.postsPerDayCustom === undefined/u,
);
// Pulse + E: "Let it grow again" became the fifth Publishing preset "Grows with Creators", whose
// patch clears the flag (tests/slurp2-pulse-e.regression.ts).
assert.match(
  source("client", "modules/creator/slp-activity-presets.ts"),
  /if \(preset === "grows"\) return \{ autoPostingScheduleEnabled: true, postsPerDayCustom: false \};/u,
);
assert.match(source("client", "features/settings/slp-settings-defaults.ts"), /"postsPerDayCustom",/u);

// --- F: the budget summary shows tokens only -----------------------------------------------------
for (const lang of ["en", "de", "ko", "pl"]) {
  const value = (JSON.parse(source("client", `locales/${lang}.json`)) as Record<string, string>)[
    "ui.slurp.settings.aiBudget.outlook.cost"
  ];
  assert.ok(value?.includes("{{tokens}}"), `${lang}: tokens stay`);
  assert.ok(!/\$|\{\{cost\}\}|달러/u.test(value ?? ""), `${lang}: no money example`);
}
assert.doesNotMatch(source("client", "features/audience/SlpAudienceConfigPanel.tsx"), /currency: "USD"/u);

// --- F × W: the Plans row stays flat (no sizing entry) ---------------------------------------------
assert.match(source("shared", "slp-model-budget.ts"), /plan: jobPolicy\(2, 20\),/u);

// --- R × W: brand deals are a Stir lever ---------------------------------------------------------
assert.equal(SLP_ACTION_META["offer-brand-deal"].deck, true);
assert.equal(SLP_ACTION_META["offer-brand-deal"].category, "work");
assert.equal(SLP_ACTION_META["offer-brand-deal"].refusable, true);
assert.equal(SLP_ACTION_META["list-brands"].deck, false);
const messages = buildSlpStirPlanMessages({
  text: "Bepis sponsors Mira",
  creators: [{ id: "mira", name: "Mira", handle: "mira", automatic: true }],
  world: { couples: [], collabs: [], rivalries: [], events: [], storylines: [] },
  brands: [{ id: "brand-bepis", name: "Bepis", products: [{ id: "bepis-cola", name: "Bepis Cola" }] }],
});
assert.match(messages[1]!.content, /# Brands\n- brand-bepis: Bepis \(products: bepis-cola Bepis Cola\)/u);
assert.doesNotMatch(messages[0]!.content, /arrive soon/u, "brand deals are no longer 'soon'");
// The picker lists fitting products only; Show all reveals the rest with why they do not fit.
const pick = source("client", "features/stir/SlpStirBrandPick.tsx");
assert.match(pick, /rows\.filter\(\(row\) => all \|\| row\.fits \|\| row\.product\.id === value\)/u);
assert.match(pick, /ui\.slurp\.stir\.fit\.\$\{product\.fit \?\? "offBrand"\}/u);
const lever = source("server", "features/projects/slp-brand-deal-lever.ts");
assert.match(
  lever,
  /: !slurpDealSpiceFits\(ad\.rating, creator\.spice\)\s+\? "spice"\s+: slurpDealFit\(ad, creator\) > 0\s+\? "fits"\s+: "offBrand"/u,
);
assert.match(lever, /logoUrl: plan\.ad\?\.logoUrl \?\? null/u, "the preview card carries the brand logo");
assert.match(source("client", "features/stir/SlpStirCards.tsx"), /<SlpStirBrandLogo name=/u);
// Brand offer cards in Business show the logo.
assert.match(
  source("server", "features/projects/slp-creator-ties-routes.ts"),
  /logoUrl: logoOf\.get\(deal\.adId\) \?\? null/u,
);
assert.match(source("client", "features/projects/SlpCollabsPanel.tsx"), /avatarUrl: deal\.logoUrl \?\? null/u);

// --- R: "Write new ads" writes whole brands with 2–3 products --------------------------------------
const generation = source("server", "features/ads/slp-garnish-generation-service.ts");
assert.match(generation, /fictional brands for an in-world social feed, each with 2 or 3 products/u);
assert.match(generation, /await pool\.saveBrand\(brand\);/u);
assert.match(generation, /brandId,\n\s+product: item\.product,/u, "each product joins its new brand");
assert.match(generation, /entry\.products\.slice\(0, 3\)/u);

console.log("slurp2 merge V, M, R, F follow-ups: ok");
