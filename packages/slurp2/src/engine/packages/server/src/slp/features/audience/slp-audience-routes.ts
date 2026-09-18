import { z } from "zod";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import {
  planSlurpFanTypeRebalance,
  slurpFanTypeForPinnedOrSeed,
  slurpFanTypeTraits,
  slurpFanTypeSpendTier,
  slurpFanTypeWeeklyBudget,
  slurpFanTypeActiveHour,
} from "../../../../../shared/src/slp/slp-fan-types.js";
import { ensureAmbientNoodleAccounts, isAmbientNoodleAccount } from "../../data/audience/slp-ambient-profiles.js";
import { tryNoodleOperation } from "../../base/locking/slp-operation-lock.js";
import { noodleAmbientProfileRerollSchema, type NoodleAccount } from "@marinara-engine/shared";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import { rerollAmbientNoodleProfiles } from "./slp-ambient-profile-generation-service.js";
import {
  SLURP_FUNNEL_STAGES,
  SLURP_NAMED_CAST_LIMIT,
  isSlurpPopulationMemberId,
} from "../../../../../shared/src/slp/slp-population.js";
import { slurpCreatorReach } from "../../modules/audience/slp-reach.js";
import { slurpPlatformScaleMultiplier } from "../../modules/audience/slp-scale.js";
import {
  slurpCharacterIdFromFanEntityId,
  slurpAudienceCharacterFanTypeId,
  slurpAudienceCharacterTraits,
} from "../../modules/audience/slp-audience-characters.js";
import { isNoodlerHiddenFromViewer } from "../../base/identity/slp-access.js";
import { runNoodlerFanActivity, getNoodlerFanActivityStatus } from "./slp-fan-activity-operation.js";
import { isConnectionAdmissionFailure } from "../../../services/generation/connection-admission.js";
import { getErrorMessage } from "../../modules/creators/slp-public-support.js";
import { logger } from "../../../lib/logger.js";
import type { FastifyInstance } from "fastify";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";

/** The `identity` lock is shared by refresh, reroll, and profile edits, so the 409 stays operation-neutral. */
const NOODLE_IDENTITY_LOCK_BUSY = "Another Slurp identity operation is already running. Wait for it to finish.";
export async function slpAudienceRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const {
    buildViewerContext,
    buildViewerShell,
    characters,
    connections,
    creatorBelongsToViewer,
    noodle,
    resolveViewerPersona,
  } = deps;
  app.get("/settings/audience-characters", async (req, reply) => {
    const parsed = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(30),
        offset: z.coerce.number().int().min(0).default(0),
        search: z.string().trim().max(120).default(""),
      })
      .safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const [groups, page] = await Promise.all([
      characters.listGroups(),
      characters.listPage({
        includeBuiltIn: true,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
        search: parsed.data.search,
        sort: "name-asc",
      }),
    ]);
    return {
      groups: groups.map((group: { id: string; name: string; characterIds: string }) => ({
        id: group.id,
        name: group.name,
        characterIds: (() => {
          try {
            const parsed = JSON.parse(group.characterIds);
            return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
          } catch {
            return [];
          }
        })(),
      })),
      characters: await characters.listSummariesByIds(page.items.map((row) => row.id)),
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      hasMore: page.hasMore,
    };
  });
  app.get("/settings/audience-characters/groups", async () => ({
    groups: (await characters.listGroups()).map((group: { id: string; name: string; characterIds: string }) => ({
      id: group.id,
      name: group.name,
      characterIds: (() => {
        try {
          const parsed = JSON.parse(group.characterIds);
          return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
        } catch {
          return [];
        }
      })(),
    })),
  }));
  // Shares only ever applied to new members. Preview and apply run the same deterministic plan, so
  // what the player is shown is what gets written.
  async function planFanTypeRebalance() {
    const settings = await noodle.getSlurpSettings();
    const members = await createSlurpPopulationStorage(app.db).listAll(5000);
    return planSlurpFanTypeRebalance(members, settings.fanTypes);
  }
  app.get("/fan-types/rebalance/preview", async () => {
    const plan = await planFanTypeRebalance();
    return { changed: plan.changes.length, counts: plan.counts };
  });
  app.post("/fan-types/rebalance", async () => {
    const plan = await planFanTypeRebalance();
    // All or nothing: a failed write rolls the pass back instead of reporting the planned count.
    await app.db.transaction(async (tx) => {
      const population = createSlurpPopulationStorage(tx);
      for (const change of plan.changes) await population.setFanType(change.memberId, change.to);
    });
    return { changed: plan.changes.length, counts: plan.counts };
  });

  /**
   * The managed ambient roster, seeded on read.
   *
   * The reroll below takes explicit account ids, so the client needs to see the crowd before it
   * can change any of it.
   */
  app.get("/ambient-profiles", async () => {
    const settings = await noodle.getSettings();
    const accounts = await ensureAmbientNoodleAccounts(noodle, settings.allowRandomUsers);
    return {
      allowRandomUsers: settings.allowRandomUsers,
      items: accounts.map((account) => ({
        id: account.id,
        handle: account.handle,
        displayName: account.displayName,
        bio: account.bio,
        avatarUrl: account.avatarUrl,
      })),
    };
  });

  /** Edit an ambient profile. The manual-edit flag keeps the seeder and legacy rename off it. */
  app.patch("/ambient-profiles/:id", async (req, reply) => {
    const parsed = z
      .object({
        displayName: z.string().trim().min(1).max(120),
        handle: z.string().trim().min(1).max(36),
        bio: z.string().max(500),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const operation = await tryNoodleOperation("identity", async () => {
      // Ambient management edits the roster while it is hidden, so it reads past the hide filter.
      const account = await noodle.getAccountById(id, { includeHidden: true });
      if (!account || !isAmbientNoodleAccount(account)) return null;
      return noodle.updateAccountProfile(id, { ...parsed.data, profile: { profileManuallyEdited: true } });
    });
    if (!operation.acquired) return reply.code(409).send({ error: NOODLE_IDENTITY_LOCK_BUSY });
    if (!operation.value) return reply.code(404).send({ error: "Ambient profile not found" });
    return operation.value;
  });

  /**
   * Reroll the generated identities of the managed ambient profiles.
   *
   * Restored after the standalone Noodle/Slurp split dropped the route but kept the service, which
   * left the feature unreachable. Serialized on the shared `identity` lock, because a reroll and a
   * profile edit rewriting the same accounts would interleave.
   */
  app.post("/ambient-profiles/reroll", async (req, reply) => {
    const parsed = noodleAmbientProfileRerollSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const settings = await noodle.getSettings();
    const connection = await resolveSlurpTextConnection(connections, settings.generationConnectionId);
    if (!connection) return reply.code(400).send({ error: "Select a Slurp generation connection first." });
    const operation = await tryNoodleOperation("identity", async () => {
      await ensureAmbientNoodleAccounts(noodle, settings.allowRandomUsers);
      const accounts = (
        await Promise.all(parsed.data.accountIds.map((id) => noodle.getAccountById(id, { includeHidden: true })))
      ).filter((account): account is NoodleAccount => account !== null);
      if (accounts.length !== parsed.data.accountIds.length || accounts.some((a) => !isAmbientNoodleAccount(a))) {
        return { status: "invalid" } as const;
      }
      return {
        status: "ok" as const,
        result: await rerollAmbientNoodleProfiles({
          db: app.db,
          noodle,
          accounts,
          connection,
          debugMode: parsed.data.debugMode ?? false,
          promptBlocks: settings.promptBlocks,
        }),
      };
    });
    if (!operation.acquired) return reply.code(409).send({ error: NOODLE_IDENTITY_LOCK_BUSY });
    if (operation.value.status === "invalid") {
      return reply.code(400).send({ error: "Only managed ambient Slurp profiles can be rerolled." });
    }
    return operation.value.result;
  });

  /**
   * Who follows a Creator, by name.
   *
   * Followers were a number and nothing else — there was no list route and no list anywhere in the
   * client. The funnel has held the people all along.
   *
   * Named entries stop at the cast limit on purpose. `total` carries the platform reach, so the
   * list reads as "these people, and this many more" rather than pretending to be complete.
   */
  app.get("/noodler/accounts/:id/followers", async (req, reply) => {
    const { id } = req.params as { id: string };
    const creator = await noodle.getNoodlerAccountById(id);
    if (!creator) return reply.code(404).send({ error: "Slurp stage profile not found" });
    const population = createSlurpPopulationStorage(app.db);
    const at = new Date();
    const followerFloor = SLURP_FUNNEL_STAGES.indexOf("follower");
    const followersSettings = await noodle.getSettings();
    const items = (await population.listNamedCast(id, SLURP_NAMED_CAST_LIMIT * 3))
      .filter(
        (entry) =>
          SLURP_FUNNEL_STAGES.indexOf(entry.tie.stage as (typeof SLURP_FUNNEL_STAGES)[number]) >= followerFloor,
      )
      .slice(0, SLURP_NAMED_CAST_LIMIT)
      .map((entry) => ({
        id: entry.tie.memberId,
        displayName: entry.member.displayName,
        handle: entry.member.handle,
        avatarUrl: null,
        avatarCrop: null,
        stage: entry.tie.stage,
        audienceArc: entry.tie.audienceArc,
        traits: entry.member.traits,
        spent: entry.tie.spent,
        followedAt: entry.tie.firstSeenAt,
      }));
    return {
      items,
      total: slurpCreatorReach(
        {
          accountId: creator.id,
          createdAt: creator.createdAt,
          realFollowers: (await population.countFollowersForCreators([id])).get(id) ?? 0,
          scale: slurpPlatformScaleMultiplier(followersSettings.platformScale),
        },
        at,
        followersSettings.simulationTuning.reach,
      ),
    };
  });

  /**
   * One person from the generated audience, and their history with one Creator.
   *
   * A name on a like or a comment told the player nothing, and the audience has no profile page to
   * open — that is the constraint that keeps it free. This is the card instead: stage, direction,
   * what they have paid, and what they are like.
   */
  app.get("/noodler/audience/:memberId", async (req, reply) => {
    const { memberId } = req.params as { memberId: string };
    const creatorAccountId = (req.query as { creatorAccountId?: unknown }).creatorAccountId;
    const population = createSlurpPopulationStorage(app.db);
    /**
     * The card subject: a generated member, or a character the user invited.
     *
     * A generated member holds a `slurp2_population` row that carries all of this. An invited
     * character holds an account row instead, so its traits, spend tier and active hour come from
     * the same Fan Type the simulation pays it on — otherwise the card would describe somebody the
     * world does not act like.
     */
    const subject = await (async () => {
      // Only a generated member has a row, so an account id skips the read rather than paying for a
      // query that can only return null.
      if (isSlurpPopulationMemberId(memberId)) {
        const member = await population.get(memberId).catch(() => null);
        if (!member) return null;
        return {
          id: member.id,
          displayName: member.displayName,
          handle: member.handle,
          traits: member.traits,
          spendTier: member.spendTier,
          activeHour: member.activeHour,
          joinedAt: member.joinedAt,
        };
      }
      const account = await noodle.getAccountById(memberId, { includeHidden: true }).catch(() => null);
      const characterId = account ? slurpCharacterIdFromFanEntityId(account.entityId) : null;
      if (!account || !characterId) return null;
      const settings = await noodle.getSettings();
      const card = await characters.getById(characterId).catch(() => null);
      const fanType = slurpFanTypeForPinnedOrSeed(
        settings.fanTypes,
        slurpAudienceCharacterFanTypeId(settings, characterId),
        account.id,
      );
      const cardTraits = slurpAudienceCharacterTraits(card);
      return {
        id: account.id,
        displayName: account.displayName,
        handle: account.handle,
        traits: cardTraits.length > 0 ? cardTraits : slurpFanTypeTraits(fanType, account.id),
        spendTier: slurpFanTypeSpendTier(slurpFanTypeWeeklyBudget(fanType, account.id)),
        activeHour: slurpFanTypeActiveHour(fanType, account.id),
        joinedAt: account.createdAt,
      };
    })();
    if (!subject) return reply.code(404).send({ error: "Audience member not found" });
    const tie =
      typeof creatorAccountId === "string" && creatorAccountId
        ? ((await population.listTiesForCreator(creatorAccountId)).find((entry) => entry.memberId === memberId) ?? null)
        : null;
    return {
      ...subject,
      tie: tie
        ? {
            stage: tie.stage,
            audienceArc: tie.audienceArc,
            spent: tie.spent,
            interactions: tie.interactions,
            firstSeenAt: tie.firstSeenAt,
            subscribed: Boolean(tie.paidThroughAt),
          }
        : null,
    };
  });

  app.patch("/noodler/accounts/:id/follow", async (req, reply) => {
    const body = req.body as { personaId?: unknown; followed?: unknown };
    if (typeof body?.personaId !== "string" || typeof body.followed !== "boolean") {
      return reply.code(400).send({ error: "personaId and followed are required" });
    }
    const { id } = req.params as { id: string };
    const viewer = await resolveViewerPersona(body.personaId);
    const creator = await noodle.getNoodlerAccountById(id);
    if (
      !viewer ||
      !creator ||
      creatorBelongsToViewer(creator, viewer) ||
      isNoodlerHiddenFromViewer(creator, viewer.id)
    ) {
      return reply.code(404).send({ error: "Slurp stage profile not found" });
    }
    const updated = await noodle.updateViewerFollow(viewer.id, creator.id, body.followed);
    if (!updated) return reply.code(400).send({ error: "Could not update follow state" });
    // Following is a funnel move like any other. Before this the social list and the funnel were
    // two separate counts of the same person, and reach added both — so a persona who followed and
    // subscribed counted twice, at 25x weight each.
    if (body.followed) {
      await noodle.advanceAudienceTie(viewer.id, creator.id, { stage: "follower" });
    } else {
      await createSlurpPopulationStorage(app.db)
        .lapseTie(viewer.id, creator.id)
        .catch(() => undefined);
    }
    const freshViewer = await resolveViewerPersona(body.personaId);
    return buildViewerShell(await buildViewerContext(freshViewer ?? updated.account));
  });

  app.post("/noodler/fan-activity/refresh-now", async (req, reply) => {
    try {
      const result = await runNoodlerFanActivity({
        db: app.db,
        mode: "manual",
        debugMode: (req.body as { debugMode?: unknown } | undefined)?.debugMode === true,
      });
      if (result.status === "disabled") return reply.code(404).send({ error: "Not Found" });
      if (result.status === "busy") return reply.code(409).send({ error: "Slurp fan activity is already running." });
      if (result.status === "limit_reached")
        return reply.code(429).send({ error: "Today's audience activity limit has been reached." });
      if (result.status === "connection_required") {
        return reply.code(400).send({ error: "Select a Slurp generation connection first." });
      }
      if (result.status === "connection_not_found") {
        return reply.code(404).send({ error: "Slurp generation connection not found" });
      }
      return result;
    } catch (error) {
      if (isConnectionAdmissionFailure(error)) return reply.code(409).send({ error: getErrorMessage(error) });
      logger.error(error, "[slurp] Fan activity generation failed");
      return reply.code(500).send({ error: "Fan activity generation failed." });
    }
  });

  app.get("/noodler/fan-activity/status", async () => getNoodlerFanActivityStatus(app.db));
}
