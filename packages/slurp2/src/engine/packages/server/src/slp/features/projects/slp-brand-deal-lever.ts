/**
 * Brands and their products as brand deals see them (R), and the Stir lever "give <Creator> a deal
 * with <brand / product>". The lever answers a preview that writes nothing and a run that stores
 * exactly the previewed offer; the rules are pure (`slurpDealLever` in `slp-brand-deals.ts`).
 */
import type { DB } from "../../../db/connection.js";
import { newId } from "../../../utils/id-generator.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { mutateSlurpCreatorTies, readSlurpCreatorTiesDocument } from "../../data/projects/slp-creator-ties-storage.js";
import {
  slurpDealFit,
  slurpDealLever,
  slurpDealSpiceFits,
  type SlurpDealAd,
} from "../../modules/economy/slp-brand-deals.js";
import type { SlpBrandFit } from "../../../../../shared/src/slp/slp-brand-deal-preview.js";
import { createGarnishAds } from "../ads/slp-ads-contract.js";
import { loadSlurpDealAds, loadSlurpDealSpice } from "./slp-brand-deal-source.js";
import { loadSlurpTieCreators } from "./slp-creator-ties-service.js";
import { slpInlineAdsOn } from "../../../../../shared/src/slp/slp-extensions.js";

export type SlurpBrandDealLeverInput = { accountId: string; brandId?: string; productId?: string; happen?: boolean };

/** What the lever shows before "Do it": who, which brand and product, the fee, fit notes, or why not. */
export type SlurpBrandDealLeverPreview = {
  who: { id: string; name: string }[];
  detail: {
    brand: string | null;
    product: string | null;
    productId: string | null;
    brandId: string | null;
    fee: number | null;
    pitch: string | null;
    logoUrl: string | null;
  };
  notes: { kind: string; name: string }[];
  error: "notFound" | "noProduct" | "busy" | "adsOff" | null;
  when: "nextPost" | "now";
  refusable: boolean;
  summary: string;
};

/**
 * Preview (`run` false) or run the lever. A run stores exactly the offer the preview showed (same
 * id rules; the Creator's answer then follows on the world clock unless `happen`).
 */
export async function slurpBrandDealLever(
  db: DB,
  input: SlurpBrandDealLeverInput,
  run: boolean,
  at = new Date(),
): Promise<{ preview: SlurpBrandDealLeverPreview; dealId: string | null }> {
  const settings = await createSlurpStorage(db).getSettings();
  const [creators, ads, spice, document] = await Promise.all([
    loadSlurpTieCreators(db, at),
    loadSlurpDealAds(db, settings),
    loadSlurpDealSpice(db),
    readSlurpCreatorTiesDocument(db),
  ]);
  const found = creators.find((entry) => entry.id === input.accountId);
  const empty: SlurpBrandDealLeverPreview = {
    who: found ? [{ id: found.id, name: found.name }] : [],
    detail: { brand: null, product: null, productId: null, brandId: null, fee: null, pitch: null, logoUrl: null },
    notes: [],
    error: null,
    when: "nextPost",
    refusable: !input.happen,
    summary: "",
  };
  if (!found)
    return { preview: { ...empty, error: "notFound", summary: "That Creator does not exist." }, dealId: null };
  if (!slpInlineAdsOn(settings))
    return { preview: { ...empty, error: "adsOff", summary: "Ads are switched off in Backstage." }, dealId: null };
  const creator = { ...found, spice: spice.get(found.id) };
  const id = newId();
  const plan = slurpDealLever(document.deals, { creator, ads, ...input, at, id });
  const preview: SlurpBrandDealLeverPreview = {
    ...empty,
    error: plan.error,
    refusable: creator.automatic && !input.happen,
    when: creator.automatic ? "nextPost" : "now",
    notes: plan.notes.map((kind) => ({ kind, name: found.name })),
    detail: {
      brand: plan.ad?.brand ?? null,
      product: plan.ad?.product ?? null,
      productId: plan.ad?.id ?? null,
      brandId: plan.ad?.brandId ?? null,
      fee: plan.deal?.fee ?? null,
      pitch: plan.ad?.copy ?? null,
      logoUrl: plan.ad?.logoUrl ?? null,
    },
    summary: plan.deal
      ? `${plan.ad!.brand} offers ${found.name} a paid post about ${plan.ad!.product} for ${plan.deal.fee} coins.${creator.automatic ? (input.happen ? " They say yes and post it on their next ordinary slot." : " They answer in their own way and may say no.") : " It waits for you in your Dashboard."}`
      : plan.error === "busy"
        ? `${found.name} already has a brand offer open.`
        : "No product fits that choice.",
  };
  if (!run || !plan.deal) return { preview, dealId: null };
  const stored = await mutateSlurpCreatorTies(db, (current) => {
    // Checked again under the write: a deal that opened meanwhile wins.
    const again = slurpDealLever(current.deals, { creator, ads, ...input, at, id });
    if (!again.deal) return null;
    return { document: { ...current, deals: again.deals }, result: again.deal.id };
  });
  return { preview, dealId: stored ?? null };
}

/**
 * The brands a helper can name (the `list-brands` action): switched-on brands and their live products.
 * With a Creator, each product says whether it fits them: spice first, then the brand words (the
 * same two rules the world clock uses to offer deals).
 */
export async function listSlurpBrandCatalog(db: DB, accountId?: string) {
  const settings = await createSlurpStorage(db).getSettings();
  const { pool } = createGarnishAds(db);
  const [brands, ads] = await Promise.all([pool.listBrands("slurp"), loadSlurpDealAds(db, settings)]);
  const found = accountId ? (await loadSlurpTieCreators(db)).find((entry) => entry.id === accountId) : undefined;
  const creator = found ? { ...found, spice: (await loadSlurpDealSpice(db)).get(found.id) } : null;
  const fitOf = (ad: SlurpDealAd): SlpBrandFit | undefined =>
    !creator
      ? undefined
      : !slurpDealSpiceFits(ad.rating, creator.spice)
        ? "spice"
        : slurpDealFit(ad, creator) > 0
          ? "fits"
          : "offBrand";
  return {
    adsOn: slpInlineAdsOn(settings),
    brands: brands
      .filter((brand) => !brand.disabledAt)
      .map((brand) => ({
        id: brand.id,
        name: brand.name,
        category: brand.category,
        logoUrl: brand.logoUrl ?? null,
        products: ads
          .filter((ad) => ad.brandId === brand.id)
          .map((ad) => {
            const fit = fitOf(ad);
            return { id: ad.id, name: ad.product, pitch: ad.copy, spice: ad.rating ?? "tame", ...(fit ? { fit } : {}) };
          }),
      }))
      .filter((brand) => brand.products.length > 0),
  };
}
