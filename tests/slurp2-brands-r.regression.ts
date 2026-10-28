/**
 * R — brands and products: the shipped parody brands, brands holding products with old ads finding
 * their brand by name (no rewrite), switching a brand off, export/import with and without brands,
 * deals picking a fitting product by brand words and spice fit, the pace setting, the sponsored post
 * showing the product, the Stir lever (preview = run, never writes on preview), and the actions.
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { slurp2Source } from "./slurp2-source";
import {
  slurpAdvanceBrandDeals,
  slurpDealFit,
  slurpDealLever,
  slurpDealSpiceFits,
  readSlurpBrandDeals,
  SLURP_DEAL_PACE,
  type SlurpBrandDeal,
  type SlurpDealAd,
  type SlurpDealSpice,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-brand-deals.ts";
import {
  SLURP_NO_TIES,
  type SlurpTieCreator,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-ties.ts";
import { slurpTieBeat } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-tie-beats.ts";
import { SLP_ACTIONS, slpActionCatalog } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-actions.ts";

const SERVER = "packages/slurp2/src/engine/packages/server/src";
const CLIENT = "packages/slurp2/src/engine/packages/client/src/slp";

const creator = (id: string, text: string, tags: string[], automatic = true): SlurpTieCreator => ({
  id,
  name: id[0]!.toUpperCase() + id.slice(1),
  text,
  tags,
  automatic,
  followers: 400,
});
const gamer = creator("kai", "Streams games every night, speedruns and cosy RPGs on Twitch.", ["gaming"]);
const lifter = creator("rue", "Fitness coach, gym every morning, meal prep and squats.", ["fitness"]);
const spicy = creator("vex", "Lingerie model and late-night tease. Loves toys and date nights.", ["lingerie"]);
const player = creator("me", "Streams games with friends.", ["gaming"], false);

async function main() {
  // ─── 1. Shipped brands and the pool storage (in-memory app settings, like the storage test) ───
  const root = await mkdtemp(join(tmpdir(), "garnish-brands-"));
  try {
    await cp(`${SERVER}/services/garnish-ads`, join(root, "services/garnish-ads"), { recursive: true });
    await mkdir(join(root, "services/storage"), { recursive: true });
    // The export module needs zod.
    await symlink(resolve("node_modules"), join(root, "node_modules"));
    await writeFile(
      join(root, "services/storage/app-settings.storage.ts"),
      `const data = new Map<string, string>();
  export function createAppSettingsStorage(_db: unknown) {
    return { get: async (key: string) => data.get(key) ?? null, set: async (key: string, value: string) => void data.set(key, value) };
  }`,
    );
    const load = (file: string) => import(pathToFileURL(join(root, "services/garnish-ads", file)).href);
    const { GARNISH_BASE_ADS, GARNISH_BASE_BRANDS } = await load("garnish-ads.base.ts");
    const { garnishAdBrandId, garnishBrandId } = await load("garnish-ads.types.ts");
    const { createGarnishAdsStorage } = await load("garnish-ads.storage.ts");
    const { exportGarnishAds, importGarnishAds } = await load("garnish-ads.export.ts");

    const names = GARNISH_BASE_BRANDS.map((brand: { name: string }) => brand.name);
    for (const name of ["Bepis", "Gamerfuel", "McNoodles"]) assert.ok(names.includes(name), `${name} ships`);
    assert.ok(GARNISH_BASE_BRANDS.length >= 13, "the three old brands plus ten parody brands");
    const brandIds = new Set(GARNISH_BASE_BRANDS.map((brand: { id: string }) => brand.id));
    for (const ad of GARNISH_BASE_ADS) {
      assert.ok(brandIds.has(garnishAdBrandId(ad)), `${ad.id} belongs to a shipped brand`);
      assert.ok(ad.copy.length > 0 && ad.priceFeel && ad.look, `${ad.id} has a pitch, price feel and look`);
    }
    for (const brand of GARNISH_BASE_BRANDS.slice(3))
      assert.ok(
        GARNISH_BASE_ADS.some((ad: { brandId?: string }) => ad.brandId === brand.id),
        `${brand.name} has products`,
      );
    const ratings = new Set(GARNISH_BASE_ADS.map((ad: { contentRating: string }) => ad.contentRating));
    assert.ok(ratings.has("suggestive") && ratings.has("explicit"), "some shipped products are adult");
    // The old three keep their ids, so hidden lists, events and deals still point at them.
    assert.deepEqual(
      GARNISH_BASE_ADS.slice(0, 3).map((ad: { id: string }) => ad.id),
      ["nightjar-midnight-blend", "moonmilk-afterglow", "black-halo-private-rooms"],
    );
    assert.equal(new Set(GARNISH_BASE_ADS.map((ad: { id: string }) => ad.id)).size, GARNISH_BASE_ADS.length);

    const pool = createGarnishAdsStorage({} as never);
    // Migration: an ad stored before brands (no brandId) finds a brand by its name, nothing rewritten.
    await pool.add({
      id: "user-old",
      platform: "slurp",
      kind: "inline",
      brand: "Old Corner Shop",
      product: "Penny sweets",
      copy: "Like it used to be.",
      categories: ["snack"],
      contextTags: [],
      contentRating: "tame",
      origin: "user",
    });
    const brands = await pool.listBrands("slurp");
    const old = brands.find((brand: { id: string }) => brand.id === garnishBrandId("Old Corner Shop"));
    assert.ok(old, "an old ad shows up under a brand named like it");
    assert.equal(old.category, "snack");
    assert.equal(
      (await pool.listActive("slurp")).some((ad: { id: string }) => ad.id === "user-old"),
      true,
    );
    // An edited shipped ad (stored without brandId, as before R) still sits under its shipped brand.
    await pool.update("nightjar-midnight-blend", { copy: "Edited before R." });
    const overrides = (await pool.listBrands("slurp")).filter(
      (brand: { name: string }) => brand.name === "Nightjar Coffee",
    );
    assert.equal(overrides.length, 1, "no second Nightjar brand");

    // Switching a brand off hides every product of it; on brings them back.
    const bepis = garnishBrandId("Bepis");
    const bepisBrand = (await pool.listBrands("slurp")).find((brand: { id: string }) => brand.id === bepis);
    await pool.saveBrand({ ...bepisBrand, disabledAt: "2026-09-28T00:00:00.000Z" });
    assert.equal(
      (await pool.listActive("slurp")).some((ad: { brandId?: string }) => ad.brandId === bepis),
      false,
      "a switched-off brand shows nothing",
    );
    await pool.saveBrand({ ...bepisBrand, disabledAt: null });
    assert.ok((await pool.listActive("slurp")).some((ad: { brandId?: string }) => ad.brandId === bepis));
    // A shipped brand is only switched off, never deleted.
    await pool.removeBrand(bepis);
    assert.ok((await pool.listBrands("slurp")).find((brand: { id: string }) => brand.id === bepis)?.disabledAt);
    await pool.saveBrand({ ...bepisBrand, disabledAt: null });

    // Renaming a brand writes the new name onto its products (an old ad keeps its brand).
    await pool.saveBrand({ ...old, name: "New Corner Shop" });
    const renamed = (await pool.listAll("slurp")).find((ad: { id: string }) => ad.id === "user-old");
    assert.equal(renamed.brand, "New Corner Shop");
    assert.equal(garnishAdBrandId(renamed), old.id, "it stays with the same brand");
    // Deleting an own brand takes its own products with it and names them for their files.
    const removed = await pool.removeBrand(old.id);
    assert.deepEqual(
      removed.map((ad: { id: string }) => ad.id),
      ["user-old"],
    );
    assert.equal(
      (await pool.listAll("slurp")).some((ad: { id: string }) => ad.id === "user-old"),
      false,
    );

    // Export carries brands; an old export without brands still imports.
    const exported = await exportGarnishAds(pool, "slurp");
    assert.ok(exported.brands.some((brand: { id: string }) => brand.id === bepis));
    const { brands: _brands, ...legacy } = exported;
    assert.deepEqual(await importGarnishAds(pool, legacy, "merge"), {
      imported: exported.ads.length,
      events: exported.events.length,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  // ─── 2. Spice fit and brand words in the deal fit ───
  const table: [string, SlurpDealSpice | undefined, boolean][] = [
    ["tame", undefined, true],
    ["suggestive", undefined, false],
    ["suggestive", "flirty", false],
    ["suggestive", "suggestive", true],
    ["explicit", "suggestive", false],
    ["explicit", "explicit", true],
  ];
  for (const [rating, level, fits] of table)
    assert.equal(slurpDealSpiceFits(rating as never, level), fits, `${rating} for ${level}`);
  const ad = (id: string, over: Partial<SlurpDealAd>): SlurpDealAd => ({
    id,
    brand: "Brand",
    product: id,
    copy: "Pitch.",
    categories: [],
    contextTags: [],
    ...over,
  });
  const chair = ad("chair", { brand: "Throne Gaming", brandId: "brand-throne", brandCategory: "gaming chair" });
  assert.ok(slurpDealFit(chair, gamer) > 0, "the brand's category alone makes a gamer fit");
  assert.equal(slurpDealFit(chair, lifter), 0);
  const wand = ad("wand", { categories: ["toys", "lingerie"], rating: "explicit" });
  assert.equal(slurpDealFit(wand, spicy), 0, "an explicit product never goes to a page without a level");
  assert.ok(slurpDealFit(wand, { ...spicy, spice: "explicit" }) > 0);

  // ─── 3. The world clock: spice-gated offers and the pace setting ───
  const start = Date.parse("2026-09-01T00:00:00.000Z");
  const run = (pace: number, ads: SlurpDealAd[], spice?: Map<string, SlurpDealSpice>) => {
    let deals: SlurpBrandDeal[] = [];
    let last: string | null = null;
    const seen = new Set<string>();
    let n = 0;
    for (let hour = 0; hour < 24 * 90; hour += 6) {
      const at = new Date(start + hour * 3_600_000);
      deals = slurpAdvanceBrandDeals(deals, {
        creators: [gamer, lifter, spicy],
        ads,
        at,
        activity: 1,
        lastLook: last,
        newId: () => `d${n++}`,
        pace,
        spice,
      });
      for (const deal of deals) seen.add(deal.id);
      last = at.toISOString();
      // Offers settle quickly so the one-open-offer rule does not cap the count.
      deals = deals.map((deal) => (deal.status === "accepted" ? { ...deal, status: "done" } : deal));
    }
    return { deals, offers: seen.size };
  };
  const pool2 = [chair, ad("whey", { categories: ["fitness", "gym"] }), wand];
  const spiceMap = new Map<string, SlurpDealSpice>([["vex", "explicit"]]);
  const normal = run(SLURP_DEAL_PACE.normal, pool2, spiceMap);
  // Many fitting products, so the 14-day brand rest never caps the count and only the pace decides.
  const wide = Array.from({ length: 30 }, (_, index) => ad(`game-${index}`, { categories: ["games"] }));
  const paced = (pace: number) => run(pace, wide).offers;
  assert.equal(paced(SLURP_DEAL_PACE.off), 0, "Off: no new offers");
  console.log("offers over 90 days, rare / normal / often:", [0.4, 1, 1.7].map(paced).join(" / "));
  assert.ok(paced(SLURP_DEAL_PACE.rare) < paced(SLURP_DEAL_PACE.normal), "Rarely < Sometimes");
  assert.ok(paced(SLURP_DEAL_PACE.often) > paced(SLURP_DEAL_PACE.normal), "Often > Sometimes");
  for (const deal of normal.deals.filter((entry) => entry.adId === "wand"))
    assert.equal(deal.creatorId, "vex", "the explicit product only goes to the explicit page");
  assert.ok(
    normal.deals.some((deal) => deal.adId === "wand" && deal.status !== "declined"),
    "and she takes it",
  );
  const noSpice = run(SLURP_DEAL_PACE.normal, pool2);
  assert.equal(
    noSpice.deals.some((deal) => deal.adId === "wand"),
    false,
    "no level known: no explicit offer",
  );

  // ─── 4. The sponsored post shows the product in the Creator's own voice ───
  const at = new Date("2026-09-10T12:00:00.000Z");
  const accepted = readSlurpBrandDeals([
    {
      id: "d1",
      adId: "bepis-classic",
      brand: "Bepis",
      product: "Bepis Classic",
      copy: "It is not the one you were thinking of.",
      creatorId: "kai",
      fee: 80,
      status: "accepted",
      offeredAt: at.toISOString(),
      answeredAt: at.toISOString(),
      look: "a sweating blue cola can",
      tone: "Loud, sugary, retro mascot energy.",
    },
  ]);
  assert.equal(accepted[0]!.look, "a sweating blue cola can", "the reader keeps the look");
  const sponsor = slurpTieBeat({
    creatorId: "kai",
    creatorText: gamer.text,
    sequence: 2,
    ties: SLURP_NO_TIES,
    deals: accepted,
    names: new Map([["kai", "Kai"]]),
    intents: ["casual", "set"],
    at,
  });
  assert.equal(sponsor!.beat.anchorKind, "sponsor");
  assert.match(sponsor!.beat.line, /Show it in the picture: a sweating blue cola can\./u);
  assert.match(sponsor!.beat.line, /The brand talks like this: Loud, sugary.*the post is in your own voice/u);
  assert.match(sponsor!.beat.line, /#ad/u);

  // ─── 5. The Stir lever: pure, preview = run ───
  const products = [
    ad("bepis-classic", { brand: "Bepis", brandId: "brand-bepis", categories: ["drinks", "games"] }),
    ad("bepis-zero", { brand: "Bepis", brandId: "brand-bepis", categories: ["drinks", "fitness"] }),
    chair,
  ];
  const base = { ads: products, at, id: "lever-1" };
  const byBrand = slurpDealLever([], { ...base, creator: lifter, brandId: "brand-bepis" });
  assert.equal(byBrand.ad!.id, "bepis-zero", "a brand picks its best product for this Creator");
  assert.equal(byBrand.deal!.status, "offered");
  assert.deepEqual(byBrand.notes, ["mayDecline"]);
  const named = slurpDealLever([], { ...base, creator: lifter, productId: "chair" });
  assert.equal(named.ad!.id, "chair", "a named product is taken as it is");
  assert.deepEqual(named.notes, ["offBrand"], "and the card says it will likely say no");
  const pushed = slurpDealLever([], { ...base, creator: lifter, productId: "chair", happen: true });
  assert.equal(pushed.deal!.status, "accepted");
  assert.equal(pushed.deal!.pushed, true);
  assert.deepEqual(pushed.notes, []);
  const own = slurpDealLever([], { ...base, creator: player, brandId: "brand-bepis", happen: true });
  assert.equal(own.deal!.status, "offered", "a page the player runs answers in Studio");
  assert.ok(own.notes.includes("notAutomatic"));
  assert.equal(slurpDealLever(byBrand.deals, { ...base, creator: lifter }).error, "busy");
  assert.equal(slurpDealLever([], { ...base, creator: lifter, productId: "nope" }).error, "noProduct");
  // Same input, same answer: what the preview showed is what the run stores.
  assert.deepEqual(slurpDealLever([], { ...base, creator: lifter, brandId: "brand-bepis" }), byBrand);
  const lever = slurp2Source(`${SERVER}/slp/features/projects/slp-brand-deal-lever.ts`);
  assert.match(lever, /if \(!run \|\| !plan\.deal\) return \{ preview, dealId: null \};/u, "a preview writes nothing");

  // ─── 6. The action layer ───
  for (const name of ["list-brands", "offer-brand-deal", "draw-brand-picture"] as const)
    assert.ok(
      slpActionCatalog().some((entry) => entry.name === name),
      `${name} is in the catalog`,
    );
  assert.equal(SLP_ACTIONS["offer-brand-deal"].schema.safeParse({ accountId: "kai", extra: 1 }).success, false);
  assert.deepEqual(SLP_ACTIONS["offer-brand-deal"].schema.parse({ accountId: "kai" }), {
    accountId: "kai",
    happen: false,
    preview: false,
  });
  const runner = slurp2Source(`${SERVER}/slp/features/assist/slp-action-runner.ts`);
  for (const name of ["list-brands", "offer-brand-deal", "draw-brand-picture"])
    assert.match(runner, new RegExp(`case "${name}"`, "u"));

  // ─── 7. Wiring pins ───
  const ties = slurp2Source(`${SERVER}/slp/features/projects/slp-creator-ties-service.ts`);
  assert.match(ties, /SLURP_DEAL_PACE\[slpBrandDealsPace\(settings\)/u);
  assert.match(ties, /pace,\n\s+spice,/u);
  const routes = slurp2Source(`${SERVER}/slp/features/ads/slp-ads-routes.ts`);
  assert.match(routes, /brandLogoUrl: logos\.get\(garnishAdBrandId\(item\)\)/u);
  assert.match(routes, /brand\?\.logoUrl\]/u, "the image route serves logos");
  const panel = slurp2Source(`${CLIENT}/features/ads/SlpAdsPanel.tsx`);
  assert.match(panel, /<SlpBrandsPanel/u);
  assert.match(panel, /settingKey="brandDealsPace"/u);
  const brandsPanel = slurp2Source(`${CLIENT}/features/ads/SlpBrandsPanel.tsx`);
  assert.match(brandsPanel, /runSlpAction\("draw-brand-picture"/u);
  assert.match(brandsPanel, /role="switch"/u);
  const assist = slurp2Source(`${CLIENT}/features/assist/SlpPictureAssist.tsx`);
  assert.match(assist, /const profileSlot = !onUse && \(target === "avatar" \|\| target === "cover"\)/u);

  console.log("slurp2 brands (R) regression passed");
}

void main();
