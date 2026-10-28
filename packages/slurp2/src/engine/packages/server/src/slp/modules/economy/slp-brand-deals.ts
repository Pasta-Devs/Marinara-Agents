/**
 * Brand deals: the ads already in Slurp's ad pool come to Creators as paid partnership offers.
 *
 * Pure and deterministic. A Creator Slurp posts for answers in character, from their card: a brand
 * that fits their niche is a yes, one that clashes with who they are (or a card that says they never
 * do ads) is a no, with a reason of their own. A yes becomes a sponsored post in their voice on an
 * ordinary slot (no extra model call), and the fee reaches their earnings when it goes up. An offer
 * to a page the player runs waits for the player in Studio; a yes pays at once.
 *
 * The spice slice may later tag offers by heat; the ad's own `contentRating` under the ads ceiling
 * is the only gate here.
 */
import { SLURP_DRAMATIC, SLURP_NEVER_PATTERN } from "../feed/slp-life-moments.js";
import { DAY_MS, clampText, hash } from "../projects/slp-project.js";
import {
  SLURP_TIES_ADVANCE_MS,
  SLURP_TIE_PLAN_STALE_DAYS,
  slurpCreatorInterests,
  type SlurpTieCreator,
} from "../projects/slp-creator-ties.js";

const HOUR_MS = 60 * 60 * 1000;
const ANSWER_AFTER_MS = 2 * HOUR_MS;
const PLAYER_ANSWER_DAYS = 3;
const MAX_OPEN_OFFERS = 4;
/** A brand looks for a Creator in this share of the world's windows (slice I pace: ties ≈ 4 % of posts). */
export const SLURP_DEAL_CHANCE = 60;
/** The same brand does not come back to the same Creator for a while. */
const BRAND_REST_DAYS = 14;
/** A refusal is worth a post for a few days, then it is old news. */
const REFUSAL_NEWS_DAYS = 3;
const KEEP_FINISHED = 40;

/** One ad from the pool (a brand's product, R), as far as a deal needs it. */
export type SlurpDealAd = {
  id: string;
  brand: string;
  product: string;
  copy: string;
  categories: readonly string[];
  contextTags: readonly string[];
  /** R: the brand it belongs to, its category and how it talks; the product's look and spice fit. */
  brandId?: string;
  brandCategory?: string;
  tone?: string;
  look?: string;
  rating?: SlurpDealRating;
  /** The brand's logo (served URL), for the Stir card. */
  logoUrl?: string;
};

export type SlurpDealRating = "tame" | "suggestive" | "explicit";
/** A Creator's spice level as deals read it (`SLP_SPICE_LEVELS`). */
export type SlurpDealSpice = "flirty" | "suggestive" | "explicit";

/**
 * Spice fit (R): a tame product suits anyone, a suggestive one a page at "suggestive" or more, an
 * explicit one only an explicit page. A Creator with no known level counts as flirty.
 */
export function slurpDealSpiceFits(rating: SlurpDealRating | undefined, spice: SlurpDealSpice | undefined): boolean {
  if (!rating || rating === "tame") return true;
  if (rating === "suggestive") return spice === "suggestive" || spice === "explicit";
  return spice === "explicit";
}

export type SlurpBrandDealStatus = "offered" | "accepted" | "planned" | "done" | "declined";
export type SlurpDealDecline = "offBrand" | "noAds" | "notNow" | "noAnswer" | "player";

export type SlurpBrandDeal = {
  id: string;
  adId: string;
  brand: string;
  product: string;
  copy: string;
  creatorId: string;
  fee: number;
  status: SlurpBrandDealStatus;
  decline: SlurpDealDecline | null;
  offeredAt: string;
  answeredAt: string | null;
  plannedAt: string | null;
  postId: string | null;
  /** The fee reached their earnings. */
  paidAt: string | null;
  /** They already posted about turning it down. */
  toldFans: boolean;
  /** The player said the owed post is up ("Mark as posted", U): the reminder goes, no post needed. */
  markedAt?: string | null;
  /** R: what the product looks like and how the brand talks, for the sponsored post. */
  look?: string;
  tone?: string;
  /** R: the player made it happen from Stir; the Creator said yes. */
  pushed?: boolean;
};

/** What a brand pays: a small Creator gets a small deal. Grows on a square root of the followers. */
export function slurpBrandDealFee(followers: number): number {
  const reach = Math.max(0, Number.isFinite(followers) ? followers : 0);
  return Math.min(600, Math.max(25, Math.round(25 + Math.sqrt(reach) * 1.5)));
}

const AD_TOPIC =
  /\b(ads?|adverts?|sponsor\w*|brands?|brand deals?|sell-?outs?|selling out|promo\w*|partnerships?|werbung)\b/iu;
/** Personality that turns deals down more often: they would rather stay "real". */
const PICKY = /\b(indie|authentic|anti-?capitalis\w*|punk|rebel\w*|underground|diy|minimalis\w*|principled)\b/iu;

const never = (text: string) =>
  text.split(/(?<=[.!?])\s+|\n+/u).filter((sentence) => SLURP_NEVER_PATTERN.test(sentence));

/** How well an ad fits a Creator: shared words between the ad's categories/tags and their niche. */
export function slurpDealFit(
  ad: SlurpDealAd,
  creator: Pick<SlurpTieCreator, "text" | "tags"> & { spice?: SlurpDealSpice },
): number {
  if (!slurpDealSpiceFits(ad.rating, creator.spice)) return 0;
  const wanted = [...new Set([...ad.categories, ...ad.contextTags, ...(ad.brandCategory ?? "").split(/[\s,/]+/u)])]
    .filter(Boolean)
    .map((word) => word.toLocaleLowerCase());
  const have = new Set([...creator.tags.map((tag) => tag.toLocaleLowerCase()), ...slurpCreatorInterests(creator)]);
  const text = creator.text.toLocaleLowerCase();
  return wanted.filter((word) => have.has(word) || (word.length >= 4 && text.includes(word))).length;
}

/** The Creator's own answer to an offer, from their card. */
export function slurpDealAnswer(
  deal: Pick<SlurpBrandDeal, "id" | "brand" | "product">,
  ad: SlurpDealAd,
  creator: SlurpTieCreator & { spice?: SlurpDealSpice },
): { accept: boolean; decline: SlurpDealDecline | null } {
  const lines = never(creator.text);
  if (lines.some((line) => AD_TOPIC.test(line))) return { accept: false, decline: "noAds" };
  const words = [ad.brand, ad.product, ...ad.categories]
    .map((word) => word.toLocaleLowerCase())
    .filter((word) => word.length >= 3);
  if (lines.some((line) => words.some((word) => line.toLocaleLowerCase().includes(word))))
    return { accept: false, decline: "offBrand" };
  const fit = slurpDealFit(ad, creator);
  if (fit === 0) return { accept: false, decline: "offBrand" };
  // Even a good fit is sometimes a "not right now"; picky personalities say it more often.
  const odds = PICKY.test(creator.text) ? 3 : 6;
  return hash(`${deal.id}:answer`) % odds === 0
    ? { accept: false, decline: "notNow" }
    : { accept: true, decline: null };
}

// ─── Storage shape ──────────────────────────────────────────────────────────────────────────────

const STATUSES: readonly SlurpBrandDealStatus[] = ["offered", "accepted", "planned", "done", "declined"];
const DECLINES: readonly SlurpDealDecline[] = ["offBrand", "noAds", "notNow", "noAnswer", "player"];
const date = (value: unknown) => (typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null);

export function readSlurpBrandDeals(raw: unknown): SlurpBrandDeal[] {
  return (Array.isArray(raw) ? raw : []).flatMap((entry): SlurpBrandDeal[] => {
    const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
    const id = clampText(item?.id, 64);
    const creatorId = clampText(item?.creatorId, 128);
    const brand = clampText(item?.brand, 80);
    const offeredAt = date(item?.offeredAt);
    if (!item || !id || !creatorId || !brand || !offeredAt) return [];
    return [
      {
        id,
        adId: clampText(item.adId, 120),
        brand,
        product: clampText(item.product, 120),
        copy: clampText(item.copy, 600),
        creatorId,
        fee: typeof item.fee === "number" && Number.isInteger(item.fee) && item.fee > 0 ? item.fee : 25,
        status: STATUSES.includes(item.status as SlurpBrandDealStatus)
          ? (item.status as SlurpBrandDealStatus)
          : "offered",
        decline: DECLINES.includes(item.decline as SlurpDealDecline) ? (item.decline as SlurpDealDecline) : null,
        offeredAt,
        answeredAt: date(item.answeredAt),
        plannedAt: date(item.plannedAt),
        postId: clampText(item.postId, 128) || null,
        paidAt: date(item.paidAt),
        toldFans: item.toldFans === true,
        ...(date(item.markedAt) ? { markedAt: date(item.markedAt) } : {}),
        ...(clampText(item.look, 400) ? { look: clampText(item.look, 400) } : {}),
        ...(clampText(item.tone, 300) ? { tone: clampText(item.tone, 300) } : {}),
        ...(item.pushed === true ? { pushed: true } : {}),
      },
    ];
  });
}

export const slurpDealOpen = (deal: SlurpBrandDeal) =>
  deal.status === "offered" || deal.status === "accepted" || deal.status === "planned";

function trim(deals: SlurpBrandDeal[]): SlurpBrandDeal[] {
  const finished = deals
    .filter((deal) => !slurpDealOpen(deal))
    .sort((left, right) => (right.answeredAt ?? right.offeredAt).localeCompare(left.answeredAt ?? left.offeredAt))
    .slice(0, KEEP_FINISHED);
  return [...deals.filter(slurpDealOpen), ...finished];
}

// ─── The world clock ────────────────────────────────────────────────────────────────────────────

export type SlurpDealsInput = {
  creators: readonly SlurpTieCreator[];
  /** Active ads under the ads ceiling. */
  ads: readonly SlurpDealAd[];
  at: Date;
  activity: number;
  /** When the ties were last looked at; deals move on the same clock. */
  lastLook: string | null;
  newId: () => string;
  /** The player's "Brand deals" pace (R): 0 = off, 1 = as before. */
  pace?: number;
  /** Each Creator's spice level (R), for the spice fit. */
  spice?: ReadonlyMap<string, SlurpDealSpice>;
};

/** The "Brand deals" setting (R) as a multiplier on how often a brand looks for a Creator. */
export const SLURP_DEAL_PACE = { off: 0, rare: 0.4, normal: 1, often: 1.7 } as const;
export type SlurpDealPace = keyof typeof SLURP_DEAL_PACE;

/**
 * One look at the deals: due answers, stale plans freed, expired offers, and now and then a new
 * offer to the Creator the pool fits best.
 */
export function slurpAdvanceBrandDeals(deals: SlurpBrandDeal[], input: SlurpDealsInput): SlurpBrandDeal[] {
  const { at } = input;
  if (input.lastLook && at.getTime() - Date.parse(input.lastLook) < SLURP_TIES_ADVANCE_MS) return deals;
  const stamp = at.toISOString();
  const byId = new Map(input.creators.map((creator) => [creator.id, creator]));
  const adById = new Map(input.ads.map((ad) => [ad.id, ad]));
  const days = (from: string) => (at.getTime() - Date.parse(from)) / DAY_MS;

  let next = deals.map((deal): SlurpBrandDeal => {
    const creator = byId.get(deal.creatorId);
    if (slurpDealOpen(deal) && !creator) return { ...deal, status: "declined", decline: "noAnswer", answeredAt: stamp };
    if (deal.status === "planned" && deal.plannedAt && days(deal.plannedAt) >= SLURP_TIE_PLAN_STALE_DAYS)
      return { ...deal, status: "accepted", plannedAt: null };
    if (deal.status !== "offered" || !creator) return deal;
    if (!creator.automatic)
      return days(deal.offeredAt) >= PLAYER_ANSWER_DAYS
        ? { ...deal, status: "declined", decline: "noAnswer", answeredAt: stamp }
        : deal;
    if (at.getTime() - Date.parse(deal.offeredAt) < ANSWER_AFTER_MS) return deal;
    const ad = adById.get(deal.adId) ?? {
      id: deal.adId,
      brand: deal.brand,
      product: deal.product,
      copy: deal.copy,
      categories: [],
      contextTags: [],
    };
    const answer = slurpDealAnswer(deal, ad, { ...creator, spice: input.spice?.get(creator.id) });
    return answer.accept
      ? { ...deal, status: "accepted", answeredAt: stamp }
      : { ...deal, status: "declined", decline: answer.decline, answeredAt: stamp, toldFans: false };
  });

  const window = Math.floor(at.getTime() / SLURP_TIES_ADVANCE_MS);
  const roll = hash(`${window}:deal`) % 100;
  if (
    next.filter(slurpDealOpen).length < MAX_OPEN_OFFERS &&
    roll < Math.round(SLURP_DEAL_CHANCE * Math.max(0, input.activity) * (input.pace ?? 1))
  ) {
    const busy = new Set(next.filter(slurpDealOpen).map((deal) => deal.creatorId));
    const offered = (creatorId: string, adId: string) =>
      next.some((deal) => deal.creatorId === creatorId && deal.adId === adId && days(deal.offeredAt) < BRAND_REST_DAYS);
    // Brands go where they fit. A brand with no fit anywhere makes no offer.
    const options = input.creators
      .filter((creator) => !busy.has(creator.id))
      .flatMap((creator) =>
        input.ads
          .filter((ad) => !offered(creator.id, ad.id))
          .map((ad) => ({ creator, ad, fit: slurpDealFit(ad, { ...creator, spice: input.spice?.get(creator.id) }) })),
      )
      .filter((option) => option.fit > 0)
      .sort(
        (left, right) =>
          right.fit - left.fit ||
          hash(`${window}:${left.creator.id}:${left.ad.id}`) - hash(`${window}:${right.creator.id}:${right.ad.id}`),
      );
    const pick = options[0];
    if (pick) next = [...next, slurpNewDeal(input.newId(), pick.ad, pick.creator, stamp)];
  }
  return trim(next);
}

/** A fresh offer of this product to this Creator. */
function slurpNewDeal(
  id: string,
  ad: SlurpDealAd,
  creator: Pick<SlurpTieCreator, "id" | "followers">,
  stamp: string,
): SlurpBrandDeal {
  return {
    id,
    adId: ad.id,
    brand: ad.brand,
    product: ad.product,
    copy: ad.copy,
    creatorId: creator.id,
    fee: slurpBrandDealFee(creator.followers),
    status: "offered",
    decline: null,
    offeredAt: stamp,
    answeredAt: null,
    plannedAt: null,
    postId: null,
    paidAt: null,
    toldFans: false,
    ...(ad.look ? { look: ad.look } : {}),
    ...(ad.tone ? { tone: ad.tone } : {}),
  };
}

// ─── The Stir lever (R): "give <Creator> a deal with <brand / product>" ────────────────────────

export type SlurpDealLeverInput = {
  creator: SlurpTieCreator & { spice?: SlurpDealSpice };
  ads: readonly SlurpDealAd[];
  brandId?: string;
  productId?: string;
  /** Make it happen: a Creator Slurp posts for says yes now. */
  happen?: boolean;
  at: Date;
  id: string;
};

/**
 * What a brand deal lever would do, and the deals after it. Pure: the preview and the run use the
 * same answer. A product named is taken as it is (the player chose it, fit or not); a brand picks its
 * best-fitting product for this Creator; nothing named picks the best fit in the whole pool.
 * `notes` are fit notes for the preview card; `error` means nothing happens.
 */
export function slurpDealLever(
  deals: readonly SlurpBrandDeal[],
  input: SlurpDealLeverInput,
): {
  error: "noProduct" | "busy" | null;
  notes: ("noAds" | "offBrand" | "spice" | "mayDecline" | "notAutomatic")[];
  ad: SlurpDealAd | null;
  deal: SlurpBrandDeal | null;
  deals: SlurpBrandDeal[];
} {
  const { creator } = input;
  const none = (error: "noProduct" | "busy") => ({ error, notes: [], ad: null, deal: null, deals: [...deals] });
  if (deals.some((deal) => deal.creatorId === creator.id && slurpDealOpen(deal))) return none("busy");
  const candidates = input.productId
    ? input.ads.filter((ad) => ad.id === input.productId)
    : input.ads.filter((ad) => !input.brandId || ad.brandId === input.brandId);
  const ranked = candidates
    .map((ad) => ({ ad, fit: slurpDealFit(ad, creator) }))
    .sort((left, right) => right.fit - left.fit || left.ad.id.localeCompare(right.ad.id));
  const ad = ranked[0]?.ad;
  if (!ad) return none("noProduct");
  const stamp = input.at.toISOString();
  const offer = slurpNewDeal(input.id, ad, creator, stamp);
  const notes: ("noAds" | "offBrand" | "spice" | "mayDecline" | "notAutomatic")[] = [];
  if (!creator.automatic) notes.push("notAutomatic");
  if (!slurpDealSpiceFits(ad.rating, creator.spice)) notes.push("spice");
  const answer = slurpDealAnswer(offer, ad, creator);
  if (creator.automatic && !input.happen && answer.decline && answer.decline !== "notNow")
    notes.push(answer.decline === "noAds" ? "noAds" : "offBrand");
  else if (creator.automatic && !input.happen && notes.length === 0) notes.push("mayDecline");
  // A page the player runs answers in Studio as always; a Creator Slurp posts for says yes now when pushed.
  const deal: SlurpBrandDeal =
    creator.automatic && input.happen ? { ...offer, status: "accepted", answeredAt: stamp, pushed: true } : offer;
  return { error: null, notes, ad, deal, deals: [...deals, deal] };
}

/** Whether a refusal is fresh enough to talk about, and whether this Creator would. */
export function slurpRefusalWorthAPost(
  deal: SlurpBrandDeal,
  creator: Pick<SlurpTieCreator, "text">,
  at: Date,
): boolean {
  if (deal.status !== "declined" || deal.toldFans || !deal.answeredAt) return false;
  if (deal.decline === "noAnswer" || deal.decline === "player") return false;
  if ((at.getTime() - Date.parse(deal.answeredAt)) / DAY_MS > REFUSAL_NEWS_DAYS) return false;
  return SLURP_DRAMATIC.test(creator.text) || PICKY.test(creator.text) || hash(`${deal.id}:tell`) % 3 === 0;
}

// ─── The player's answer (pages the player runs) and posts ──────────────────────────────────────

export function slurpAnswerDeal(
  deals: SlurpBrandDeal[],
  id: string,
  accept: boolean,
  at: Date,
): SlurpBrandDeal[] | "notFound" | "notOpen" {
  const deal = deals.find((entry) => entry.id === id);
  if (!deal) return "notFound";
  if (deal.status !== "offered") return "notOpen";
  const stamp = at.toISOString();
  // A page the player runs is paid on "yes"; Slurp does not write that page's posts, so the sponsored
  // post is the player's to make. Studio reminds them until it is up (`slurpDealOwesPost`).
  return deals.map((entry) =>
    entry.id !== id
      ? entry
      : accept
        ? { ...entry, status: "done" as const, answeredAt: stamp, paidAt: stamp }
        : { ...entry, status: "declined" as const, decline: "player" as const, answeredAt: stamp, toldFans: true },
  );
}

/** How long Studio reminds the player of a sponsored post their own page owes. */
export const SLURP_OWED_POST_DAYS = 14;

/** A deal the player's own page took and has not posted yet (a Creator Slurp posts for settles its own). */
export function slurpDealOwesPost(deal: SlurpBrandDeal, at: Date): boolean {
  return (
    deal.status === "done" &&
    !deal.postId &&
    !deal.markedAt &&
    !!deal.answeredAt &&
    at.getTime() - Date.parse(deal.answeredAt) < SLURP_OWED_POST_DAYS * 24 * 60 * 60 * 1000
  );
}

/** Whether this post of the page pays what it owes: after the yes, with #ad or the brand in it. */
export function slurpPostPaysOwedDeal(
  deal: SlurpBrandDeal,
  post: { content: string; createdAt: string | Date },
): boolean {
  if (!deal.answeredAt || new Date(post.createdAt).getTime() < Date.parse(deal.answeredAt)) return false;
  const text = post.content.toLocaleLowerCase();
  return (
    /(^|[^\p{L}\p{N}_])#ad\b/iu.test(post.content) ||
    (deal.brand.length > 1 && text.includes(deal.brand.toLocaleLowerCase()))
  );
}

/** The player marks an owed post as posted (U: no dead end when the post has no #ad or brand name). */
export function slurpMarkDealPosted(
  deals: SlurpBrandDeal[],
  id: string,
  at: Date,
): SlurpBrandDeal[] | "notFound" | "notOpen" {
  const deal = deals.find((entry) => entry.id === id);
  if (!deal) return "notFound";
  if (!slurpDealOwesPost(deal, at)) return "notOpen";
  return deals.map((entry) => (entry.id === id ? { ...entry, markedAt: at.toISOString() } : entry));
}

/** The owed post went up: the reminder goes away. */
export function slurpSettleOwedDeal(deals: SlurpBrandDeal[], id: string, postId: string): SlurpBrandDeal[] {
  return deals.map((deal) => (deal.id === id && !deal.postId ? { ...deal, postId } : deal));
}

export function slurpPlanDeal(deals: SlurpBrandDeal[], id: string, at: Date): SlurpBrandDeal[] {
  return deals.map((deal) =>
    deal.id === id ? { ...deal, status: "planned" as const, plannedAt: at.toISOString() } : deal,
  );
}

export function slurpToldFansAboutDeal(deals: SlurpBrandDeal[], id: string): SlurpBrandDeal[] {
  return deals.map((deal) => (deal.id === id ? { ...deal, toldFans: true } : deal));
}

/** The sponsored post went up: the deal is done, and the fee is owed now (paid once, by receipt id). */
export function slurpSettleDeal(
  deals: SlurpBrandDeal[],
  id: string,
  post: { id: string; createdAt: string },
  at: Date,
) {
  return deals.map((deal) =>
    deal.id === id && !deal.postId
      ? { ...deal, status: "done" as const, postId: post.id, paidAt: at.toISOString() }
      : deal,
  );
}

/** The receipt id a deal's fee is paid under, so a repeated settle never pays twice. */
export const slurpDealReceipt = (dealId: string) => `sponsor:${dealId}`;
