/**
 * Collabs, rivalries and brand deals on the world clock, and what they mean for the next post.
 *
 * No model calls: the world decides requests, answers, offers and rivalry stages by code (see the
 * rules in `slp-creator-ties.ts` and `slp-brand-deals.ts`), and the posts ride ordinary slots.
 */
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { newId } from "../../../utils/id-generator.js";
import { readSlurpCreatorSteering } from "../../data/creators/slp-steering-storage.js";
import { SLP_POLY_CARD_WORDS } from "../../../../../shared/src/slp/slp-creator-steering.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import { readSlurpCardPeople, readSlurpCreatorFitText } from "../../data/creators/slp-flavour-source.js";
import { SLURP_PARTNER_RELATION } from "../../modules/creators/slp-spice.js";
import { slurpAdvanceBonds, slurpBondsFor } from "../../modules/projects/slp-creator-bonds.js";
import { mutateSlurpCreatorTies, readSlurpCreatorTiesDocument } from "../../data/projects/slp-creator-ties-storage.js";
import { slurpCreatorReach } from "../../../../../shared/src/slp/slp-reach.js";
import { slurpPlatformScaleMultiplier, slurpWorldActivityMultiplier } from "../../../../../shared/src/slp/slp-scale.js";
import {
  slurpPairKey,
  slurpAdvanceCreatorTies,
  slurpAgreeCollabInDm,
  slurpCollabPostIdsFor,
  slurpEchoCollab,
  slurpPlanCollab,
  slurpSettleCollab,
  slurpTellRivalry,
  type SlurpTieCreator,
} from "../../modules/projects/slp-creator-ties.js";
import { readSlurpTieStamp } from "../../modules/projects/slp-tie-stamp.js";
import { DAY_MS } from "../../modules/projects/slp-project.js";
import { slurpPlayerCoupleStep, type SlurpPlayerCoupleStep } from "../../modules/projects/slp-player-couple.js";
import {
  slurpAnnounceCollab,
  slurpCollabCrossover,
  slurpHoldsCollabDrop,
} from "../../modules/projects/slp-collab-work.js";
import {
  slurpAdvanceBrandDeals,
  slurpDealOwesPost,
  slurpDealReceipt,
  slurpPlanDeal,
  slurpPostPaysOwedDeal,
  slurpSettleDeal,
  slurpSettleOwedDeal,
  slurpToldFansAboutDeal,
  SLURP_DEAL_PACE,
  type SlurpDealPace,
  type SlurpBrandDeal,
} from "../../modules/economy/slp-brand-deals.js";
import { loadSlurpDealAds, loadSlurpDealSpice } from "./slp-brand-deal-source.js";
import { slurpTieBeat } from "../../modules/feed/slp-tie-beats.js";
import { slurpBondBeat } from "../../modules/feed/slp-bond-beats.js";
import {
  slurpAdvanceCouples,
  slurpCoupleActive,
  slurpCoupleOf,
  slurpCoupleTold,
  slurpCouplePostIdsFor,
  slurpSetUpCouple,
  slurpSettleCouplePost,
  type SlurpCouple,
} from "../../modules/projects/slp-creator-couples.js";
import { slurpCoupleFit } from "../../modules/projects/slp-couple-fit.js";
import {
  closeSlurpCouplePages,
  notifySlurpPlayerCouples,
  slurpCouplesWorldInput,
} from "./slp-creator-couples-service.js";
import { slurpIsCouplePage } from "../../modules/projects/slp-creator-couples.js";
import type { SlurpBeat } from "../../modules/feed/slp-post-beat.js";
import type { SlurpContentIntent } from "../../../../../shared/src/slp/slp-content-axes.js";
import { bookSlurpHeldSlot, readSlurpSlotTimes } from "../feed/slp-held-slots-contract.js";
import { slurpPausedNow } from "../../data/settings/slp-pause-storage.js";

type Storage = ReturnType<typeof createSlurpStorage>;
type Account = Awaited<ReturnType<Storage["listNoodlerAccounts"]>>[number];

/** A page the player runs itself: Slurp never writes its posts. */
export const slurpRunsItself = (account: { kind: string; sourceKind?: string | null }) =>
  !(account.kind === "persona" && account.sourceKind === "persona");

/** Every Creator as the tie rules see them: fit text from the card, tags, reach. Shared couple pages are not Creators here. */
export async function loadSlurpTieCreators(db: DB, at = new Date()): Promise<SlurpTieCreator[]> {
  const storage = createSlurpStorage(db);
  const [all, settings] = await Promise.all([storage.listNoodlerAccounts(), storage.getSettings()]);
  const accounts = all.filter((account: Account) => !slurpIsCouplePage(account));
  const followers = await createSlurpPopulationStorage(db).countFollowersForCreators(
    accounts.map((account) => account.id),
  );
  const scale = slurpPlatformScaleMultiplier(settings.platformScale);
  return Promise.all(
    accounts.map(async (account: Account) => {
      const text = await readSlurpCreatorFitText(db, { account, source: await storage.resolveAccountSource(account) });
      // Polyamory (0.3.5): the style the player picked, else poly words on their card.
      const steering = await readSlurpCreatorSteering(db, account.id).catch(() => null);
      const style = steering?.relationshipStyle ?? null;
      const cardPeople = await readSlurpCardPeople(db, account.id).catch(() => []);
      return {
        id: account.id,
        name: account.displayName,
        text,
        tags: account.settings.profile.tags ?? [],
        automatic: slurpRunsItself(account),
        gender: account.settings.profile.gender ?? null,
        cardPartners: cardPeople
          .filter((person) => SLURP_PARTNER_RELATION.test(person.relation))
          .map((person) => person.name),
        cardPeople,
        poly: style ? style === "poly" : SLP_POLY_CARD_WORDS.test(text),
        // An unreadable setting is no permission: fail closed (no romance) until it reads again.
        romance: steering ? steering.romance : { off: true, only: [] },
        followers: slurpCreatorReach(
          { accountId: account.id, createdAt: account.createdAt, realFollowers: followers.get(account.id) ?? 0, scale },
          at,
          settings.simulationTuning.reach,
        ),
      };
    }),
  );
}

/**
 * Settle what went up, then (every few hours) let the world answer, offer, and start or move ties.
 * Settling runs every tick, so a joint post reaches the partner's page within one tick.
 */
export async function advanceSlurpCreatorTies(db: DB, at = new Date()): Promise<void> {
  // "Pause all": ties, couples and bonds stand still while Slurp is paused.
  if (await slurpPausedNow(db)) return;
  await settleSlurpTiePosts(db, at);
  const { ties } = await readSlurpCreatorTiesDocument(db);
  if (ties.advancedAt && at.getTime() - Date.parse(ties.advancedAt) < 6 * 60 * 60 * 1000) return;
  const storage = createSlurpStorage(db);
  const settings = await storage.getSettings();
  const creators = await loadSlurpTieCreators(db, at);
  const pace = SLURP_DEAL_PACE[settings.brandDealsPace as SlurpDealPace] ?? 1;
  // Loaded even when paced off: open offers still get answered against their product.
  const ads = await loadSlurpDealAds(db, settings);
  const spice = ads.some((ad) => ad.rating && ad.rating !== "tame") ? await loadSlurpDealSpice(db) : undefined;
  const activity = slurpWorldActivityMultiplier(settings.worldActivity);
  const paired = settings.creatorCollabs.map((collab) => collab.creatorIds);
  const storylines = await slurpCouplesWorldInput(db, creators);
  const before = await readSlurpCreatorTiesDocument(db);
  const after = await mutateSlurpCreatorTies(db, (document) => {
    const ties = slurpAdvanceCreatorTies(document.ties, { creators, at, activity, paired, newId });
    const around = fromTies(ties, at);
    const couples = slurpAdvanceCouples(document.couples, { creators, at, activity, newId, storylines, ...around });
    const next = {
      ties,
      couples,
      bonds: slurpAdvanceBonds(document.bonds, { creators, couples, at, activity, newId, ...around }),
      deals: slurpAdvanceBrandDeals(document.deals, {
        creators,
        ads,
        at,
        activity,
        lastLook: document.ties.advancedAt,
        newId,
        pace,
        spice,
      }),
    };
    return { document: next, result: next };
  });
  // A breakup closes a shared page: nobody is charged again for a page that stopped.
  if (after) await closeSlurpCouplePages(db, before.couples, after.couples);
  // Dates, anniversaries and her jealousy with the player's own page reach the player's inbox.
  if (after) await notifySlurpPlayerCouples(db, before.couples, after.couples);
}

/** What the couple rules need from the ties: open rivalries, and who made a collab with someone lately. */
function fromTies(ties: ReturnType<typeof slurpAdvanceCreatorTies>, at: Date) {
  const recent = ties.collabs.filter(
    (collab) =>
      (collab.status === "posted" || collab.status === "planned") &&
      at.getTime() - Date.parse(collab.postedAt ?? collab.plannedAt ?? collab.askedAt) < 14 * 24 * 60 * 60 * 1000,
  );
  return {
    rivals: new Set(
      ties.rivalries
        .filter((rivalry) => rivalry.stage !== "over")
        .map((rivalry) => slurpPairKey(rivalry.fromId, rivalry.toId)),
    ),
    collabbedWith: new Map(
      recent.flatMap((collab) => [
        [collab.hostId, collab.partnerId],
        [collab.partnerId, collab.hostId],
      ]),
    ),
  };
}

/** A sponsored post the player's own page owed went up (#ad or the brand in it): the Studio reminder goes. */
async function settleSlurpOwedPosts(db: DB, deals: readonly SlurpBrandDeal[], at: Date): Promise<void> {
  const owed = deals.filter((deal) => slurpDealOwesPost(deal, at));
  if (!owed.length) return;
  const storage = createSlurpStorage(db);
  const found: { id: string; postId: string }[] = [];
  for (const deal of owed) {
    const posts = await storage.listNoodlerPostsByAccount(deal.creatorId, 12);
    const post = posts.find((entry: { id: string; content: string; createdAt: string }) =>
      slurpPostPaysOwedDeal(deal, entry),
    );
    if (post) found.push({ id: deal.id, postId: post.id });
  }
  if (found.length)
    await mutateSlurpCreatorTies(db, (document) => ({
      document: {
        ...document,
        deals: found.reduce((next, entry) => slurpSettleOwedDeal(next, entry.id, entry.postId), document.deals),
      },
      result: null,
    }));
}

/** Planned collabs and sponsored posts whose post went up: shown on both pages, fee paid. */
async function settleSlurpTiePosts(db: DB, at: Date): Promise<void> {
  const { ties, deals, couples } = await readSlurpCreatorTiesDocument(db);
  await settleSlurpOwedPosts(db, deals, at);
  const planned = [
    ...ties.collabs
      .filter((collab) => collab.status === "planned")
      .map((collab) => ({ id: collab.id, hostId: collab.hostId })),
    ...deals.filter((deal) => deal.status === "planned").map((deal) => ({ id: deal.id, hostId: deal.creatorId })),
    // Old joint couple posts (before U, couples post their own now): look on both pages a while longer.
    ...couples
      .filter((couple) =>
        couple.moments.some((moment) => at.getTime() - Date.parse(moment.at) < 5 * 24 * 60 * 60 * 1000),
      )
      .flatMap((couple) => [
        { id: couple.id, hostId: couple.aId },
        { id: couple.id, hostId: couple.bId },
      ]),
  ];
  if (!planned.length) return;
  const storage = createSlurpStorage(db);
  const found = new Map<string, { id: string; createdAt: string }>();
  const jointCouplePosts: { coupleId: string; postId: string }[] = [];
  for (const hostId of new Set(planned.map((entry) => entry.hostId))) {
    for (const post of await storage.listNoodlerPostsByAccount(hostId, 12)) {
      const stamp = readSlurpTieStamp(post.metadata);
      if (stamp?.kind === "couple") {
        if (stamp.joint && !stamp.pageId) jointCouplePosts.push({ coupleId: stamp.id, postId: post.id });
      } else if (stamp && !stamp.declined && !stamp.echo && !stamp.announce && !found.has(stamp.id))
        found.set(stamp.id, post);
    }
  }
  const settleCouples = jointCouplePosts.filter(
    (entry) => !couples.find((couple) => couple.id === entry.coupleId)?.postIds.includes(entry.postId),
  );
  if (settleCouples.length)
    await mutateSlurpCreatorTies(db, (document) => ({
      document: {
        ...document,
        couples: document.couples.map((couple) =>
          settleCouples
            .filter((entry) => entry.coupleId === couple.id)
            .reduce((next, entry) => slurpSettleCouplePost(next, entry.postId), couple),
        ),
      },
      result: null,
    }));
  if (!found.size) return;
  const paid = await mutateSlurpCreatorTies(db, (document) => {
    let next = document;
    const toPay: { creatorId: string; fee: number; brand: string; id: string }[] = [];
    const settled: { id: string; hostId: string; partnerId: string }[] = [];
    for (const [tieId, post] of found) {
      const deal = next.deals.find((entry) => entry.id === tieId && entry.status === "planned");
      if (deal) toPay.push({ creatorId: deal.creatorId, fee: deal.fee, brand: deal.brand, id: deal.id });
      const collab = next.ties.collabs.find((entry) => entry.id === tieId && entry.status === "planned");
      if (collab) settled.push({ id: collab.id, hostId: collab.hostId, partnerId: collab.partnerId });
      next = {
        ...next,
        ties: slurpSettleCollab(next.ties, tieId, post),
        deals: deal ? slurpSettleDeal(next.deals, tieId, post, at) : next.deals,
      };
    }
    return { document: next, result: { toPay, settled } };
  });
  for (const collab of paid?.settled ?? [])
    await crossSlurpCollabFans(db, collab).catch((error: unknown) =>
      logger.warn(error, "[slurp-ties] Could not bring fans across after a collab"),
    );
  // The receipt id makes a repeated settle pay once.
  for (const fee of paid?.toPay ?? [])
    await storage
      .creditSponsorFee(fee.creatorId, fee.fee, fee.brand, slurpDealReceipt(fee.id))
      .catch((error: unknown) => logger.warn(error, "[slurp-ties] Could not pay a sponsor fee"));
}

/**
 * A collab went up: some of each page's fans come across and follow the other one (U: collabs bring
 * crossover subscribers; followers become subscribers through the usual funnel). Counted on the collab.
 */
async function crossSlurpCollabFans(db: DB, collab: { id: string; hostId: string; partnerId: string }) {
  const population = createSlurpPopulationStorage(db);
  const [hostFans, partnerFans] = await Promise.all([
    population.listTiesForCreator(collab.hostId),
    population.listTiesForCreator(collab.partnerId),
  ]);
  const following = (fans: typeof hostFans) =>
    new Set(
      fans.filter((fan) => !["stranger", "viewer", "liker", "lapsed"].includes(fan.stage)).map((fan) => fan.memberId),
    );
  const toHost = slurpCollabCrossover(partnerFans, following(hostFans), `${collab.id}:host`);
  const toPartner = slurpCollabCrossover(hostFans, following(partnerFans), `${collab.id}:partner`);
  for (const [creatorId, members] of [
    [collab.hostId, toHost],
    [collab.partnerId, toPartner],
  ] as const)
    for (const memberId of members)
      await population.advanceTie(memberId, creatorId, { stage: "follower", interactions: 2 }).catch(() => undefined);
  await mutateSlurpCreatorTies(db, (document) => ({
    document: {
      ...document,
      ties: {
        ...document.ties,
        collabs: document.ties.collabs.map((entry) =>
          entry.id === collab.id ? { ...entry, crossover: { host: toHost.length, partner: toPartner.length } } : entry,
        ),
      },
    },
    result: null,
  }));
}

/**
 * This Creator's next ordinary post, when a collab, a deal or a rivalry takes it. The collab or deal
 * is marked planned so no second slot takes it. Any failure is a warning and an ordinary post.
 */
export async function planSlurpTieBeat(
  db: DB,
  input: {
    creatorId: string;
    creatorText: string;
    sequence: number;
    intents: readonly SlurpContentIntent[];
    at: Date;
    /** The slot's own time: a collab drop goes to the slot held at its hour (V). */
    dueAt?: Date | null;
    previewOnly?: boolean;
  },
): Promise<SlurpBeat | null> {
  try {
    const { ties, deals, couples } = await readSlurpCreatorTiesDocument(db);
    const ids = new Set([
      ...ties.collabs.flatMap((collab) => [collab.hostId, collab.partnerId]),
      ...ties.rivalries.flatMap((rivalry) => [rivalry.fromId, rivalry.toId]),
      ...couples.flatMap((couple) => [
        couple.aId,
        couple.bId,
        ...(couple.page ? [couple.page.accountId] : []),
        ...couple.moments.flatMap((moment) => (moment.withId ? [moment.withId] : [])),
      ]),
    ]);
    if (!ids.has(input.creatorId) && !deals.some((deal) => deal.creatorId === input.creatorId)) return null;
    const storage = createSlurpStorage(db);
    const names = new Map<string, string>();
    const playerIds = new Set<string>();
    for (const id of ids) {
      const account = await storage.getNoodlerAccountById(id);
      if (account) names.set(id, account.displayName);
      if (account && !slurpRunsItself(account)) playerIds.add(id);
    }
    // A collab to announce names its drop hour, and Slurp holds that hour like a teased drop (V).
    const announcing = ties.collabs.some(
      (collab) => collab.hostId === input.creatorId && collab.status === "agreed" && !collab.announcedAt,
    );
    const slots =
      announcing && !input.previewOnly
        ? await readSlurpSlotTimes(db, input.creatorId, input.at).catch(() => null)
        : null;
    const planned = slurpTieBeat({ ...input, ties, deals, couples, names, playerIds, slots });
    if (!planned || input.previewOnly) return planned?.beat ?? null;
    const { tie } = planned.beat;
    await mutateSlurpCreatorTies(db, (document) => ({
      document: {
        ...document,
        // A couple moment is told once each; one on their shared page for both of them.
        couples:
          tie.kind === "couple" && tie.momentId
            ? document.couples.map((couple) =>
                couple.id === tie.id
                  ? slurpCoupleTold(couple, [
                      `${input.creatorId}:${tie.momentId}`,
                      ...(tie.joint || tie.pageId ? [`${tie.partnerId}:${tie.momentId}`] : []),
                    ])
                  : couple,
              )
            : document.couples,
        ties:
          tie.kind === "collab"
            ? tie.echo
              ? slurpEchoCollab(document.ties, tie.id)
              : tie.announce
                ? slurpAnnounceCollab(document.ties, tie.id, input.at, planned.dropAt)
                : slurpPlanCollab(document.ties, tie.id, input.at)
            : tie.kind === "rival"
              ? slurpTellRivalry(document.ties, tie.id, input.creatorId)
              : document.ties,
        deals:
          tie.kind !== "sponsor"
            ? document.deals
            : tie.declined
              ? slurpToldFansAboutDeal(document.deals, tie.id)
              : slurpPlanDeal(document.deals, tie.id, input.at),
      },
      result: null,
    }));
    // Without a held slot (automatic posting off, or the booking failed) the drop takes the host's
    // first slot from its hour on.
    if (planned.dropAt && slots)
      await bookSlurpHeldSlot(db, input.creatorId, new Date(planned.dropAt), input.at).catch((error: unknown) =>
        logger.warn(error, "[slurp-ties] Could not hold the collab drop's hour; it takes the next slot"),
      );
    return planned.beat;
  } catch (error) {
    logger.warn(error, "[slurp-ties] Could not plan a collab, deal or rivalry post; this one is ordinary");
    return null;
  }
}

/**
 * Now and then an ordinary post is a moment with a friend, roommate or coworker (Drama, bonds). Runs
 * after the player's steering, so it never takes a slot the player pointed somewhere. Never fails a post.
 */
export async function planSlurpBondBeat(
  db: DB,
  input: { creatorId: string; sequence: number },
): Promise<SlurpBeat | null> {
  try {
    const { bonds } = await readSlurpCreatorTiesDocument(db);
    const mine = slurpBondsFor(bonds, input.creatorId);
    if (!mine.length) return null;
    const storage = createSlurpStorage(db);
    const names = new Map<string, string>();
    for (const bond of mine) {
      const otherId = bond.aId === input.creatorId ? bond.bId : bond.aId;
      const account = await storage.getNoodlerAccountById(otherId);
      if (account) names.set(otherId, account.displayName);
    }
    return slurpBondBeat({ creatorId: input.creatorId, bonds: mine, names, sequence: input.sequence });
  } catch (error) {
    logger.warn(error, "[slurp-ties] Could not plan a moment with a friend; this post is ordinary");
    return null;
  }
}

/** The slot at `slotAt` is held for a collab drop this Creator hosts (V): the reserve keeps ideas off it. */
export async function slurpHeldCollabDrop(db: DB, creatorId: string, slotAt: Date): Promise<boolean> {
  return slurpHoldsCollabDrop((await readSlurpCreatorTiesDocument(db)).ties, creatorId, slotAt);
}

/** Joint posts that show on this Creator's page although the partner wrote them: collabs and couple posts. */
export async function slurpCollabPostIdsForCreator(db: DB, creatorId: string): Promise<string[]> {
  const { ties, couples } = await readSlurpCreatorTiesDocument(db);
  return [...slurpCollabPostIdsFor(ties, creatorId), ...slurpCouplePostIdsFor(couples, creatorId)];
}

/** After a breakup or a crush that faded, the chat does not start a new crush on the player this soon. */
const SLURP_PLAYER_CRUSH_REST_DAYS = 14;

/**
 * Her answer to the player said what the talk did to the two of them (Drama, "your relationship"):
 * a crush starts, dating begins, it becomes official, a fight makes it rocky, or they make up. The
 * model only reports the talk; `slurpPlayerCoupleStep` and the card rules decide whether it counts.
 * Returns the couple as it is now, or null when nothing changed.
 */
export async function applySlurpPlayerUs(
  db: DB,
  input: { creatorId: string; pageId: string; step: SlurpPlayerCoupleStep; why: string },
): Promise<SlurpCouple | null> {
  const at = new Date();
  const creators = await loadSlurpTieCreators(db, at);
  const creator = creators.find((entry) => entry.id === input.creatorId);
  const page = creators.find((entry) => entry.id === input.pageId);
  if (!creator?.automatic || !page || page.automatic) return null;
  const polyamory = (await createSlurpStorage(db).getSettings()).polyamory === true;
  return mutateSlurpCreatorTies(db, (document) => {
    const last = slurpCoupleOf(document.couples, creator.id, page.id);
    if (last && slurpCoupleActive(last)) {
      // A private DM can describe a group relationship, but only its primary pair steers the group.
      if (![last.aId, last.bId].includes(creator.id) || ![last.aId, last.bId].includes(page.id)) return null;
      const next = slurpPlayerCoupleStep(last, input.step, { at, creatorId: creator.id, detail: input.why });
      if (!next) return null;
      return {
        document: { ...document, couples: document.couples.map((entry) => (entry.id === last.id ? next : entry)) },
        result: next,
      };
    }
    // A new crush: only "closer", only where her card allows it, and not right after the last one ended.
    if (input.step !== "closer" || !slurpCoupleFit(creator, page).fits) return null;
    if (last && at.getTime() - Date.parse(last.stageAt) < SLURP_PLAYER_CRUSH_REST_DAYS * DAY_MS) return null;
    // #1293: an ex with a chosen aftermath never restarts on its own from a talk that only revisits
    // old messages; getting back together then takes an explicit reunite, not a model's "closer".
    if (last?.aftermath) return null;
    const id = newId();
    const next = slurpSetUpCouple(document.couples, creator, page, { at, id, polyamory, crush: true });
    if (typeof next === "string") return null;
    return { document: { ...document, couples: next }, result: next.find((entry) => entry.id === id)! };
  });
}

/** Two pages agreed on a joint post in their own DM; the replying Creator hosts and writes it. */
export async function agreeSlurpCollabInDm(
  db: DB,
  input: { hostId: string; partnerId: string; idea: string; hostShare: number | null; shoot?: boolean },
): Promise<void> {
  const creators = await loadSlurpTieCreators(db);
  const host = creators.find((creator) => creator.id === input.hostId);
  const partner = creators.find((creator) => creator.id === input.partnerId);
  if (!host?.automatic || !partner || host.id === partner.id) return;
  await mutateSlurpCreatorTies(db, (document) => ({
    document: {
      ...document,
      ties: slurpAgreeCollabInDm(document.ties, host, partner, {
        at: new Date(),
        id: newId(),
        idea: input.idea,
        hostShare: input.hostShare,
        shoot: input.shoot,
      }),
    },
    result: null,
  }));
}
