import type { FastifyInstance } from "fastify";
import { logger } from "../../../lib/logger.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { generateAndApplyCreatorPost, resolveSlurpAutomaticPostAccess } from "../feed/slp-feed-contract.js";
import { z } from "zod";
import { newId } from "../../../utils/id-generator.js";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { mutateSlurpCreatorTies, readSlurpCreatorTiesDocument } from "../../data/projects/slp-creator-ties-storage.js";
import {
  slurpBlockCollab,
  slurpCollabDueNow,
  slurpCollabOpen,
  slurpCoolRivalry,
  slurpDeclineCollab,
  slurpDropCollab,
  slurpPushCollab,
  slurpRivalryActive,
  slurpSuggestCollab,
  slurpUnblockPair,
  type SlurpCreatorTies,
  type SlurpTieError,
} from "../../modules/projects/slp-creator-ties.js";
import {
  slurpAnswerDeal,
  slurpDealOpen,
  slurpDealOwesPost,
  slurpMarkDealPosted,
  slurpDealReceipt,
} from "../../modules/economy/slp-brand-deals.js";
import { loadSlurpTieCreators, slurpRunsItself } from "./slp-creator-ties-service.js";
import { createGarnishAds, garnishAdBrandId, type GarnishAd, type GarnishBrand } from "../ads/slp-ads-contract.js";
import {
  slurpCoupleActive,
  slurpIsCouplePage,
  slurpSetUpCouple,
  slurpSteerCouple,
  type SlurpCouple,
  type SlurpCoupleError,
} from "../../modules/projects/slp-creator-couples.js";
import { closeSlurpCouplePage, closeSlurpCouplePages, openSlurpCouplePage } from "./slp-creator-couples-service.js";
import {
  SLURP_BOND_KINDS,
  SLURP_BOND_MAX_LEVEL,
  slurpBondActive,
  slurpEndBond,
  slurpSetBond,
  type SlurpBond,
  type SlurpBondError,
} from "../../modules/projects/slp-creator-bonds.js";

const RECENT = 8;
const ERRORS: Record<SlurpTieError | "notFound" | "notOpen", [number, string]> = {
  notFound: [404, "That request is gone."],
  notOpen: [409, "That one is already settled."],
  sameCreator: [400, "Pick two different Creators."],
  noHost: [400, "Pick at least one Creator Slurp posts for, so someone can write the joint post."],
  busy: [409, "Those two are already talking about a collab."],
};
/** Why a couple cannot happen, in the world's words (7b-couples). */
const COUPLE_ERRORS: Record<SlurpCoupleError, [number, string]> = {
  notFound: [404, "That couple is gone."],
  notOpen: [409, "That does not fit where those two are right now."],
  noHost: [400, "Pick at least one Creator Slurp posts for."],
  same: [400, "Pick two different Creators."],
  busy: [409, "One of them is already seeing someone on Slurp."],
  taken: [409, "One of them is already with someone."],
  notInto: [409, "Neither romance nor dating is something they are looking for."],
  noDating: [409, "One of them does not date, and would not start for this."],
  orientation: [409, "They are not each other's type."],
  romance: [409, "Their romance settings keep these two apart."],
  pageOpen: [409, "Their shared page is already open."],
  mono: [409, "One of them is monogamous and already with someone."],
};

/** Why a bond cannot be set, in the world's words (Drama, bonds). */
const BOND_ERRORS: Record<SlurpBondError, [number, string]> = {
  same: [400, "Pick two different Creators."],
  unknown: [404, "That bond is gone."],
  full: [409, "One of them already has as many friends at that level as anyone keeps."],
  couple: [409, "Those two are together right now, not exes."],
};

/**
 * Collabs, rivalries and brand deals in Studio: see what is going on between Creators, push a
 * request through, block a pair, suggest a pairing, cool a rivalry down, and answer brand offers for
 * the pages the player runs.
 */
export async function slpCreatorTiesRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { noodle, resolveViewerPersona, creatorBelongsToViewer } = deps;
  const personaSchema = z.object({ personaId: z.string().trim().min(1) });

  async function view(viewer: NonNullable<Awaited<ReturnType<typeof resolveViewerPersona>>>) {
    const { pool } = createGarnishAds(app.db);
    const [{ ties, deals, couples, bonds }, accounts, ads, brands] = await Promise.all([
      readSlurpCreatorTiesDocument(app.db),
      noodle.listNoodlerAccounts(),
      pool.listAll("slurp"),
      pool.listBrands("slurp"),
    ]);
    // Q: an open offer shows the brand's 1.91:1 banner (the feed picture for an older ad).
    const bannerOf = new Map(ads.map((ad: GarnishAd) => [ad.id, ad.wideImageUrl || ad.imageUrl || null]));
    // R: every offer card wears its brand's logo.
    const logos = new Map(brands.map((brand: GarnishBrand) => [brand.id, brand.logoUrl ?? null]));
    const logoOf = new Map(ads.map((ad: GarnishAd) => [ad.id, logos.get(garnishAdBrandId(ad)) ?? null]));
    const newest = <T>(list: T[], at: (entry: T) => string) =>
      [...list].sort((left, right) => at(right).localeCompare(at(left))).slice(0, RECENT);
    return {
      creators: accounts.map((account) => ({
        id: account.id,
        name: account.displayName,
        handle: account.handle,
        avatarUrl: account.avatarUrl ?? null,
        own: creatorBelongsToViewer(account, viewer),
        automatic: slurpRunsItself(account),
        couplePage: slurpIsCouplePage(account),
      })),
      // Together now first, then the newest that ended.
      couples: [
        ...couples.filter(slurpCoupleActive),
        ...newest(
          couples.filter((couple: SlurpCouple) => !slurpCoupleActive(couple)),
          (couple: SlurpCouple) => couple.stageAt,
        ),
      ].map(({ told: _told, postIds: _posts, ...couple }: SlurpCouple) => couple),
      collabs: [
        ...ties.collabs.filter(slurpCollabOpen),
        ...newest(
          ties.collabs.filter((collab) => !slurpCollabOpen(collab)),
          (collab) => collab.answeredAt ?? collab.askedAt,
        ),
      ],
      rivalries: [
        ...ties.rivalries.filter(slurpRivalryActive),
        ...newest(
          ties.rivalries.filter((rivalry) => !slurpRivalryActive(rivalry)),
          (rivalry) => rivalry.stageAt,
        ),
      ],
      // `owesPost`: the player's own page took it and has not posted it yet; Studio reminds them.
      deals: [
        ...deals.filter(slurpDealOpen),
        ...newest(
          deals.filter((deal) => !slurpDealOpen(deal)),
          (deal) => deal.answeredAt ?? deal.offeredAt,
        ),
      ].map((deal) => ({
        ...deal,
        owesPost: slurpDealOwesPost(deal, new Date()),
        bannerUrl: deal.status === "offered" ? (bannerOf.get(deal.adId) ?? null) : null,
        logoUrl: logoOf.get(deal.adId) ?? null,
      })),
      // Bonds (Drama): every active one, then the newest that ended, for the People map.
      bonds: [
        ...bonds.filter(slurpBondActive),
        ...newest(
          bonds.filter((bond: SlurpBond) => !slurpBondActive(bond)),
          (bond: SlurpBond) => bond.endedAt ?? bond.changedAt,
        ),
      ],
      blocked: ties.blocked,
    };
  }

  const viewerFrom = async (
    body: unknown,
    reply: { code: (code: number) => { send: (value: unknown) => unknown } },
  ) => {
    const parsed = personaSchema.safeParse(body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.flatten() });
      return null;
    }
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) reply.code(404).send({ error: "Slurp persona not found" });
    return viewer;
  };

  /** One change to the ties, answered with the whole Studio view. */
  const change = async (
    req: { body: unknown; params: unknown },
    reply: Parameters<typeof viewerFrom>[1],
    run: (ties: SlurpCreatorTies, at: Date) => SlurpCreatorTies | SlurpTieError,
  ) => {
    const viewer = await viewerFrom(req.body, reply);
    if (!viewer) return;
    const outcome = await mutateSlurpCreatorTies(app.db, (document) => {
      const next = run(document.ties, new Date());
      return typeof next === "string"
        ? { document, result: next }
        : { document: { ...document, ties: next }, result: "ok" as const };
    });
    if (outcome && outcome !== "ok") return reply.code(ERRORS[outcome][0]).send({ error: ERRORS[outcome][1] });
    return view(viewer);
  };
  const id = (req: { params: unknown }) => (req.params as { id: string }).id;

  app.get("/slurp/ties", async (req, reply) => {
    const viewer = await viewerFrom(req.query, reply);
    return viewer ? view(viewer) : undefined;
  });

  app.post("/slurp/ties/collabs/:id/push", (req, reply) =>
    change(req, reply, (ties, at) => slurpPushCollab(ties, id(req), at)),
  );
  app.post("/slurp/ties/collabs/:id/decline", (req, reply) =>
    change(req, reply, (ties, at) => slurpDeclineCollab(ties, id(req), at)),
  );
  app.post("/slurp/ties/collabs/:id/block", (req, reply) =>
    change(req, reply, (ties, at) => slurpBlockCollab(ties, id(req), at)),
  );
  app.post("/slurp/ties/collabs/:id/drop", (req, reply) =>
    change(req, reply, (ties, at) => slurpDropCollab(ties, id(req), at)),
  );
  // Due now, then the host writes it at once (the beat planner takes a due collab first). Not awaited:
  // a post takes a model call, and the Studio view answers right away.
  // One post per collab at a time: a second tap while the first is being written is refused.
  const postingNow = new Set<string>();
  app.post("/slurp/ties/collabs/:id/post-now", async (req, reply) => {
    const collabId = id(req);
    if (postingNow.has(collabId)) return reply.code(409).send({ error: "That collab is being posted already." });
    const hostId = (await readSlurpCreatorTiesDocument(app.db)).ties.collabs.find((c) => c.id === collabId)?.hostId;
    const answer = await change(req, reply, (ties, at) => slurpCollabDueNow(ties, collabId, at));
    if (hostId && !reply.sent) {
      postingNow.add(collabId);
      void resolveSlurpAutomaticPostAccess(createSlurpStorage(app.db), hostId)
        .then((access) => generateAndApplyCreatorPost(app.db, { mode: "noodler", targetAccountId: hostId, access }))
        .catch((error: unknown) => logger.warn(error, "[slurp-ties] Could not post the collab now"))
        .finally(() => postingNow.delete(collabId));
    }
    return answer;
  });
  app.post("/slurp/ties/unblock", async (req, reply) => {
    const parsed = z
      .object({ key: z.string().trim().min(3).max(260) })
      .passthrough()
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return change(req, reply, (ties) => slurpUnblockPair(ties, parsed.data.key));
  });
  app.post("/slurp/ties/rivalries/:id/cool", (req, reply) =>
    change(req, reply, (ties, at) => slurpCoolRivalry(ties, id(req), at)),
  );

  app.post("/slurp/ties/collabs", async (req, reply) => {
    const parsed = z
      .object({ aId: z.string().trim().min(1), bId: z.string().trim().min(1) })
      .passthrough()
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const creators = await loadSlurpTieCreators(app.db);
    const a = creators.find((creator) => creator.id === parsed.data.aId);
    const b = creators.find((creator) => creator.id === parsed.data.bId);
    if (!a || !b) return reply.code(404).send({ error: "Creator account not found" });
    return change(req, reply, (ties, at) => slurpSuggestCollab(ties, a, b, { at, id: newId() }));
  });

  /** A deal of a page this viewer runs, or null once the error is answered (404 / 403). */
  const ownDeal = async (
    dealId: string,
    viewer: NonNullable<Awaited<ReturnType<typeof resolveViewerPersona>>>,
    reply: Parameters<typeof viewerFrom>[1],
  ) => {
    const deal = (await readSlurpCreatorTiesDocument(app.db)).deals.find((entry) => entry.id === dealId);
    const creator = deal ? await noodle.getNoodlerAccountById(deal.creatorId) : null;
    if (!deal || !creator) {
      reply.code(404).send({ error: ERRORS.notFound[1] });
      return null;
    }
    if (!creatorBelongsToViewer(creator, viewer)) {
      reply.code(403).send({ error: "Only the Creator's own page can answer this offer." });
      return null;
    }
    return { deal, creator };
  };

  /** A brand offer to a page the player runs: yes pays the fee now, no ends it. */
  app.post("/slurp/ties/deals/:id/answer", async (req, reply) => {
    const parsed = personaSchema.extend({ accept: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const own = await ownDeal(id(req), viewer, reply);
    if (!own) return;
    const { deal, creator } = own;
    const outcome = await mutateSlurpCreatorTies(app.db, (document) => {
      const next = slurpAnswerDeal(document.deals, deal.id, parsed.data.accept, new Date());
      return typeof next === "string"
        ? { document, result: next }
        : { document: { ...document, deals: next }, result: "ok" as const };
    });
    if (outcome && outcome !== "ok") return reply.code(ERRORS[outcome][0]).send({ error: ERRORS[outcome][1] });
    if (parsed.data.accept) await noodle.creditSponsorFee(creator.id, deal.fee, deal.brand, slurpDealReceipt(deal.id));
    return view(viewer);
  });

  /** "Mark as posted" (U): the player's own page posted the sponsored post its own way; the reminder goes. */
  app.post("/slurp/ties/deals/:id/posted", async (req, reply) => {
    const viewer = await viewerFrom(req.body, reply);
    const own = viewer ? await ownDeal(id(req), viewer, reply) : null;
    if (!own) return;
    const outcome = await mutateSlurpCreatorTies(app.db, (document) => {
      const next = slurpMarkDealPosted(document.deals, own.deal.id, new Date());
      return typeof next === "string"
        ? { document, result: next }
        : { document: { ...document, deals: next }, result: "ok" as const };
    });
    if (outcome && outcome !== "ok") return reply.code(ERRORS[outcome][0]).send({ error: ERRORS[outcome][1] });
    return view(viewer);
  });

  /** One change to the couples, answered with the whole Studio view. */
  const changeCouples = async (
    req: { body: unknown },
    reply: Parameters<typeof viewerFrom>[1],
    run: (couples: SlurpCouple[], at: Date) => SlurpCouple[] | SlurpCoupleError,
  ) => {
    const viewer = await viewerFrom(req.body, reply);
    if (!viewer) return;
    const outcome = await mutateSlurpCreatorTies(app.db, (document) => {
      const next = run(document.couples, new Date());
      return typeof next === "string"
        ? { document, result: next }
        : { document: { ...document, couples: next }, result: "ok" as const };
    });
    if (outcome && outcome !== "ok")
      return reply.code(COUPLE_ERRORS[outcome][0]).send({ error: COUPLE_ERRORS[outcome][1] });
    return view(viewer);
  };

  /** Set two Creators up: they start flirting; against a card it happens anyway, colored by the card. */
  app.post("/slurp/ties/couples", async (req, reply) => {
    const parsed = z
      .object({ aId: z.string().trim().min(1), bId: z.string().trim().min(1) })
      .passthrough()
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const creators = await loadSlurpTieCreators(app.db);
    const a = creators.find((creator) => creator.id === parsed.data.aId);
    const b = creators.find((creator) => creator.id === parsed.data.bId);
    if (!a || !b) return reply.code(404).send({ error: "Creator account not found" });
    const polyamory = (await noodle.getSettings()).polyamory === true;
    return changeCouples(req, reply, (couples, at) => slurpSetUpCouple(couples, a, b, { at, id: newId(), polyamory }));
  });

  /** Plan a date, stir some drama, patch it up, end it, or get them back together. */
  app.post("/slurp/ties/couples/:id/steer", async (req, reply) => {
    const parsed = z
      .object({ steer: z.enum(["date", "drama", "patchUp", "breakUp", "reunite"]) })
      .passthrough()
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const creators = await loadSlurpTieCreators(app.db);
    const before = (await readSlurpCreatorTiesDocument(app.db)).couples;
    const answer = await changeCouples(req, reply, (couples, at) =>
      slurpSteerCouple(couples, id(req), parsed.data.steer, { at, creators }),
    );
    // A breakup closes their shared page: stop its renewals too.
    if (parsed.data.steer === "breakUp")
      await closeSlurpCouplePages(app.db, before, (await readSlurpCreatorTiesDocument(app.db)).couples);
    return answer;
  });

  /** Open their shared page (opt-in), or close it with a goodbye post. */
  app.post("/slurp/ties/couples/:id/page", async (req, reply) => {
    const parsed = personaSchema.extend({ open: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const outcome = parsed.data.open
      ? await openSlurpCouplePage(app.db, id(req))
      : await closeSlurpCouplePage(app.db, id(req));
    if (typeof outcome === "string")
      return reply.code(COUPLE_ERRORS[outcome][0]).send({ error: COUPLE_ERRORS[outcome][1] });
    return view(viewer);
  });

  /** One change to the bonds, answered with the whole Studio view. */
  const changeBonds = async (
    req: { body: unknown },
    reply: Parameters<typeof viewerFrom>[1],
    run: (bonds: SlurpBond[], couples: SlurpCouple[], at: Date) => SlurpBond[] | SlurpBondError,
  ) => {
    const viewer = await viewerFrom(req.body, reply);
    if (!viewer) return;
    const outcome = await mutateSlurpCreatorTies(app.db, (document) => {
      const next = run(document.bonds, document.couples, new Date());
      return typeof next === "string"
        ? { document, result: next }
        : { document: { ...document, bonds: next }, result: "ok" as const };
    });
    if (outcome && outcome !== "ok")
      return reply.code(BOND_ERRORS[outcome][0]).send({ error: BOND_ERRORS[outcome][1] });
    return view(viewer);
  };

  /** Make two Creators friends, roommates, coworkers or exes, or change how close friends are. Locked. */
  app.post("/slurp/ties/bonds", async (req, reply) => {
    const parsed = z
      .object({
        aId: z.string().trim().min(1),
        bId: z.string().trim().min(1),
        kind: z.enum(SLURP_BOND_KINDS),
        level: z.number().int().min(0).max(SLURP_BOND_MAX_LEVEL).optional(),
      })
      .passthrough()
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const [a, b] = await Promise.all([
      noodle.getNoodlerAccountById(parsed.data.aId),
      noodle.getNoodlerAccountById(parsed.data.bId),
    ]);
    if (!a || !b || slurpIsCouplePage(a) || slurpIsCouplePage(b))
      return reply.code(404).send({ error: "Creator account not found" });
    const { aId, bId, kind, level } = parsed.data;
    return changeBonds(req, reply, (bonds, couples, at) =>
      slurpSetBond(bonds, { aId, bId, kind, level, couples }, { at, id: newId() }),
    );
  });

  /** End a bond: they stop being friends, move out, stop working together, or let the ex go. */
  app.post("/slurp/ties/bonds/:id/end", (req, reply) =>
    changeBonds(req, reply, (bonds, _couples, at) => slurpEndBond(bonds, id(req), at)),
  );
}
