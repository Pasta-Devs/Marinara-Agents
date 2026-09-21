import {
  slpAccountSettingsPatchSchema,
  slpStageProfileDraftRequestSchema,
  slpStageProfileUpdateSchema,
} from "../../../../../shared/src/slp/slp-social.schema.js";
import { slpContinuityRoutes } from "./slp-continuity-routes.js";
import {
  slurpDiscoveryProfileSchema,
  SLURP_DISCOVERY_TAG_LIMIT,
  SLURP_DISCOVERY_GENDERS,
} from "../../modules/discovery/slp-discovery-profile.js";
import { z } from "zod";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import { generateSlurpConversationSchedule } from "../messages/slp-messages-contract.js";
import { slurpPlatformScaleMultiplier } from "../../modules/audience/slp-scale.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import { slurpCreatorReach } from "../../../../../shared/src/slp/slp-reach.js";
import { generateCreatorStageProfileDraft } from "./slp-stage-profile-draft-service.js";
import { logger } from "../../../lib/logger.js";
import { getErrorMessage } from "../../modules/creators/slp-public-support.js";
import { tryCreatorAccountOperation } from "../../base/locking/slp-account-operation-lock.js";
import { resolveCreatorSourceSnapshot } from "../../data/creators/slp-source-resolve.js";
import { slurpDisclosureMode, slpCreatorDisclosureReviewReasons } from "../../modules/creators/slp-disclosure.js";
import { stageProfileContainsPublicIdentity, stageProfileContainsSourceDetails } from "../feed/slp-feed-contract.js";
import { compareCreatorSourceSnapshots, minimizeCreatorSourceSnapshot } from "../../base/identity/slp-source.js";
import { verifyCreatorSourceRevisionToken } from "../../base/identity/slp-source-revision.js";
import type { FastifyInstance } from "fastify";
import { slurpDiscoveryTagNameSchema } from "../../modules/requests/slp-request-schemas.js";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { slurpPromptContext } from "../../base/prompting/slp-prompt-blocks.js";

const slpStageProfileUpdateRequestSchema = slpStageProfileUpdateSchema.extend({
  ...slurpDiscoveryProfileSchema.shape,
  location: z.string().trim().max(120).optional(),
  sourceRevisionToken: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/u)
    .optional(),
  confirmAvatarReview: z.boolean().optional(),
});
export async function slpCreatorsRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  await slpContinuityRoutes(app);
  const { characters, connections, noodle, resolveNoodlerPublicIdentity, resolveViewerPersona } = deps;
  // One edit for many Creators, also used for a single Creator's quick edit. Capped so one request stays bounded.
  app.post("/slurp/accounts/bulk-update", async (req, reply) => {
    const tagList = z.array(slurpDiscoveryTagNameSchema).max(SLURP_DISCOVERY_TAG_LIMIT);
    const body = z
      .object({
        ids: z.array(z.string().trim().min(1)).min(1).max(500),
        patch: z
          .object({
            gender: z.enum(SLURP_DISCOVERY_GENDERS).nullable().optional(),
            tags: tagList.optional(),
            addTags: tagList.optional(),
            removeTags: z.array(slurpDiscoveryTagNameSchema).max(100).optional(),
            autoPosting: z.boolean().optional(),
            imagesEnabled: z.boolean().optional(),
          })
          .strict()
          .refine((patch) => Object.values(patch).some((value) => value !== undefined), "Nothing to change."),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    return noodle.bulkUpdateCreatorProfiles([...new Set(body.data.ids)], body.data.patch);
  });

  app.patch("/accounts/:id/settings", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = slpAccountSettingsPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const account = await noodle.getNoodlerAccountById(id);
    if (!account) return reply.code(404).send({ error: "Creator account not found" });
    if (
      account.sourceKind === "persona" &&
      account.kind === "persona" &&
      parsed.data.subtree === "scheduler" &&
      parsed.data.patch.autoPosting?.enabled === true
    ) {
      return reply.code(400).send({ error: "Persona-owned Slurp profiles cannot post automatically." });
    }
    const updated = await noodle.patchAccountSettings(id, parsed.data);
    if (!updated) return reply.code(404).send({ error: "Creator account not found" });
    return updated;
  });

  app.patch("/accounts/:id/profile", async (req, reply) => {
    const parsed = z
      .object({ personaId: z.string().trim().min(1), profile: z.object({ location: z.string().trim().max(120) }) })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const { id } = req.params as { id: string };
    const account = await noodle.getNoodlerAccountById(id);
    if (!account) return reply.code(404).send({ error: "Creator account not found" });
    const updated = await noodle.updateAccountProfile(id, { profile: parsed.data.profile });
    if (!updated) return reply.code(404).send({ error: "Creator account not found" });
    return updated;
  });

  app.get("/slurp/accounts", async (_req, reply) => {
    return noodle.listNoodlerStageProfiles();
  });

  app.post("/slurp/accounts/:id/conversation-schedule/refresh", async (req, reply) => {
    const { id } = req.params as { id: string };
    const account = await noodle.getNoodlerAccountById(id);
    const source = account ? await noodle.resolveAccountSource(account) : null;
    if (!account || !source || source.kind !== "character") {
      return reply.code(404).send({ error: "A linked Engine character is required." });
    }
    const character = await characters.getById(source.entityId);
    if (!character) return reply.code(404).send({ error: "Linked Engine character not found." });
    const scheduleSettings = await noodle.getSettings();
    const connection = await resolveSlurpTextConnection(connections, scheduleSettings.generationConnectionId);
    if (!connection) return reply.code(409).send({ error: "Select a text generation connection first." });
    const data = (typeof character.data === "string" ? JSON.parse(character.data) : character.data) as Record<
      string,
      unknown
    >;
    const extensions =
      data.extensions && typeof data.extensions === "object" && !Array.isArray(data.extensions)
        ? (data.extensions as Record<string, unknown>)
        : {};
    let generated: Awaited<ReturnType<typeof generateSlurpConversationSchedule>>;
    try {
      generated = await generateSlurpConversationSchedule(
        connection,
        {
          name: String(data.name ?? source.displayName),
          description: String(data.description ?? ""),
          personality: String(data.personality ?? ""),
        },
        scheduleSettings.simulationTuning.prompts.scheduleExtra,
        slurpPromptContext(scheduleSettings).blocks,
      );
    } catch (error) {
      req.log.warn({ err: error }, "Conversation schedule generation returned invalid output");
      // The model's own words go back to the panel: without them every failure looks identical and
      // there is nothing to act on but "try again".
      return reply.code(502).send({
        error:
          `The generation connection did not return a complete schedule. ${error instanceof Error ? error.message : ""}`.trim(),
      });
    }
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
    monday.setHours(0, 0, 0, 0);
    await characters.update(source.entityId, {
      extensions: {
        ...extensions,
        conversationSchedule: { ...generated, weekStart: monday.toISOString() },
        conversationSchedulesEnabled: true,
      },
    });
    return {
      state: "active",
      blocks: Object.values(generated.days).reduce((count, day) => count + day.length, 0),
    };
  });

  // Fan and follower totals per creator account, so a list of profiles needs one request
  // instead of one per row. Keyed by creator account id.
  // ponytail: counts by scanning; swap for aggregate queries if a player ever keeps
  // enough creator profiles for this to show up in the request time.
  app.get("/slurp/account-connection-counts", async (_req, _reply) => {
    const creators = await noodle.listNoodlerAccounts();
    const at = new Date();
    // Real followers come from the audience funnel, and only from there. Following also moves the
    // funnel now, so adding the social following list on top would count the same person twice —
    // at 25x weight each.
    const countsScaleSettings = await noodle.getSettings();
    const countsScale = slurpPlatformScaleMultiplier(countsScaleSettings.platformScale);
    const countsPopulation = createSlurpPopulationStorage(app.db);
    const countsFunnel = await countsPopulation.countFollowersForCreators(creators.map((creator) => creator.id));
    const countsSubscribers = await countsPopulation.countSubscribersForCreators(creators.map((creator) => creator.id));
    const entries = await Promise.all(
      creators.map(async (creator) => [
        creator.id,
        {
          // Fans are subscribers. Both halves are exact rows and neither is reach: the personas
          // on this install pay through subscription rows, and the generated audience pays through
          // the funnel because it holds no wallet.
          fans:
            (await noodle.listSubscriptionsForCreator(creator.id)).length + (countsSubscribers.get(creator.id) ?? 0),
          // Followers are social proof and nothing charges against them, so they carry the
          // synthetic platform reach. Real followers are folded in at a heavy weight.
          followers: slurpCreatorReach(
            {
              accountId: creator.id,
              createdAt: creator.createdAt,
              realFollowers: countsFunnel.get(creator.id) ?? 0,
              scale: countsScale,
            },
            at,
            countsScaleSettings.simulationTuning.reach,
          ),
        },
      ]),
    );
    return Object.fromEntries(entries) as Record<string, { fans: number; followers: number }>;
  });

  app.post("/slurp/stage-profile-draft", async (req, reply) => {
    const parsed = slpStageProfileDraftRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const settings = await noodle.getSettings();
    const connection = await resolveSlurpTextConnection(
      connections,
      parsed.data.connectionId ?? settings.generationConnectionId,
    );
    if (!connection) return reply.code(404).send({ error: "Slurp generation connection not found" });
    try {
      return await generateCreatorStageProfileDraft(app.db, {
        request: parsed.data,
        connection,
        promptBlocks: slurpPromptContext(settings).blocks,
        promptInstructions: slurpPromptContext(settings).instructions,
      });
    } catch (error) {
      logger.error(
        error,
        "[slurp] Stage profile draft generation failed using %s",
        connection.model || connection.provider,
      );
      // The reason is written for the user (no JSON, empty answer, leaked identity), so show it.
      return reply.code(500).send({
        error: `Stage profile draft generation failed: ${getErrorMessage(error)}`,
      });
    }
  });

  app.put("/slurp/accounts/:id/stage-profile", async (req, reply) => {
    const parsed = slpStageProfileUpdateRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    let discardedPreparedPostCount = 0;
    const locked = await tryCreatorAccountOperation(id, async () => {
      const slpCreatorAccount = await noodle.getNoodlerAccountById(id);
      const publicAccount = slpCreatorAccount ? await noodle.resolveAccountSource(slpCreatorAccount) : null;
      const currentSourceSnapshot = publicAccount ? await resolveCreatorSourceSnapshot(app.db, publicAccount) : null;
      // The shared schema still accepts Secret; Slurp saves it as Hinted.
      parsed.data.disclosureMode = slurpDisclosureMode(parsed.data.disclosureMode);
      if (
        publicAccount &&
        (stageProfileContainsPublicIdentity(parsed.data, await resolveNoodlerPublicIdentity(publicAccount)) ||
          (currentSourceSnapshot && stageProfileContainsSourceDetails(parsed.data, currentSourceSnapshot)))
      ) {
        return { status: "identity_conflict" } as const;
      }
      const submittedSnapshotIsCurrent =
        parsed.data.sourceSnapshot &&
        currentSourceSnapshot &&
        compareCreatorSourceSnapshots(parsed.data.sourceSnapshot, currentSourceSnapshot).state === "current";
      const submittedRevisionIsCurrent =
        parsed.data.sourceRevisionToken &&
        currentSourceSnapshot &&
        verifyCreatorSourceRevisionToken(parsed.data.sourceRevisionToken, id, currentSourceSnapshot);
      const sourceRevisionIsCurrent =
        parsed.data.disclosureMode === "open" ? submittedSnapshotIsCurrent : submittedRevisionIsCurrent;
      if (parsed.data.acceptSourceChanges && !sourceRevisionIsCurrent) {
        return { status: "source_revision_conflict" } as const;
      }
      if (slpCreatorAccount) {
        const currentMode = slpCreatorAccount.settings.privacy.identityDisclosure ?? "open";
        const [publishedPosts, preparedPosts] = await Promise.all([
          noodle.listAllNoodlerPostsByAccount(id),
          noodle.listNoodlerPreparedPosts(),
        ]);
        const publicIdentity = publicAccount ? await resolveNoodlerPublicIdentity(publicAccount) : null;
        const preparedForCreator = preparedPosts.filter(
          (post) => post.creatorAccountId === id && post.state === "prepared",
        );
        const identifyingPostCount = currentSourceSnapshot
          ? publishedPosts.filter((post) => {
              const candidate = {
                displayName: "review",
                handle: "review",
                bio: [post.title, post.content].filter(Boolean).join(" "),
                stagePersonality: "",
                disclosureMode: parsed.data.disclosureMode,
              };
              return (
                (publicIdentity && stageProfileContainsPublicIdentity(candidate, publicIdentity)) ||
                stageProfileContainsSourceDetails(candidate, currentSourceSnapshot)
              );
            }).length
          : publishedPosts.length;
        const reviewReasons = slpCreatorDisclosureReviewReasons({
          currentMode,
          nextMode: parsed.data.disclosureMode,
          postCount: identifyingPostCount,
          mediaCount: publishedPosts.filter((post) => Boolean(post.imageUrl)).length,
          // Any avatar/banner must trigger review, including ones adopted from the linked
          // source (whose URL lives outside the NoodleR media namespace, so
          // readNoodler*MediaPath would return null and skip the check).
          hasAvatar: Boolean(slpCreatorAccount.avatarUrl),
          hasBanner: Boolean(slpCreatorAccount.settings.profile.bannerUrl),
          preparedPostCount: preparedForCreator.length,
        });
        const unresolvedReviewReasons = parsed.data.confirmAvatarReview
          ? reviewReasons.filter((reason) => reason.code !== "creator_avatar")
          : reviewReasons;
        if (unresolvedReviewReasons.length > 0) {
          return {
            status: "disclosure_review_required",
            reviewReasons: unresolvedReviewReasons,
          } as const;
        }
        await Promise.all(preparedForCreator.map((post) => noodle.discardNoodlerPreparedPost(post.id)));
        // The downgrade throws away unreleased reserve posts; say how many.
        discardedPreparedPostCount = preparedForCreator.length;
      }
      const currentMode = slpCreatorAccount?.settings.privacy.identityDisclosure ?? "open";
      const sourceSnapshot =
        currentSourceSnapshot &&
        (parsed.data.disclosureMode !== currentMode || (parsed.data.acceptSourceChanges && sourceRevisionIsCurrent))
          ? minimizeCreatorSourceSnapshot(currentSourceSnapshot, parsed.data.disclosureMode)
          : undefined;
      const {
        acceptSourceChanges: _acceptSourceChanges,
        sourceSnapshot: _sourceSnapshot,
        sourceRevisionToken: _sourceRevisionToken,
        confirmAvatarReview: _confirmAvatarReview,
        location,
        ...stageProfile
      } = parsed.data;
      const updated = await noodle.updateNoodlerStageProfile(id, stageProfile, sourceSnapshot ?? undefined, location);
      if (!updated) return { status: "not_found" } as const;
      const profile = (await noodle.listNoodlerStageProfiles()).find((item) => item.id === updated.id);
      if (!profile) throw new Error("Failed to load the updated Slurp stage profile.");
      return { status: "updated", profile, discardedPreparedPostCount } as const;
    });
    if (!locked.acquired) {
      return reply.code(409).send({
        error: "Another operation for this Slurp account is already running.",
      });
    }
    if (locked.value.status === "identity_conflict") {
      return reply.code(400).send({
        error: "Hinted stage profiles cannot use identifying source names or details.",
      });
    }
    if (locked.value.status === "disclosure_review_required") {
      return reply.code(409).send({
        error: "Review or remove existing creator content before using a more private identity mode.",
        reviewRequired: locked.value.reviewReasons.map((reason) => reason.label),
        reviewRequiredCodes: locked.value.reviewReasons,
      });
    }
    if (locked.value.status === "not_found") {
      return reply.code(404).send({ error: "Slurp stage profile not found" });
    }
    if (locked.value.status === "source_revision_conflict") {
      return reply.code(409).send({
        error:
          "The linked source changed or this draft expired. Generate a fresh draft before accepting source changes.",
      });
    }
    return {
      ...locked.value.profile,
      discardedPreparedPostCount: locked.value.discardedPreparedPostCount,
    };
  });

  app.post("/slurp/accounts/:id/source/dismiss", async (req, reply) => {
    const { id } = req.params as { id: string };
    const locked = await tryCreatorAccountOperation(id, async () => {
      const account = await noodle.getNoodlerAccountById(id);
      const publicAccount = account ? await noodle.resolveAccountSource(account) : null;
      const sourceSnapshot = publicAccount ? await resolveCreatorSourceSnapshot(app.db, publicAccount) : null;
      if (!account || !sourceSnapshot) return false;
      await noodle.updateNoodlerSourceSnapshot(
        id,
        minimizeCreatorSourceSnapshot(sourceSnapshot, account.settings.privacy.identityDisclosure ?? "open"),
      );
      return true;
    });
    if (!locked.acquired) return reply.code(409).send({ error: "Another Creator operation is already running." });
    if (!locked.value) return reply.code(404).send({ error: "Slurp source not found" });
    return (await noodle.listNoodlerStageProfiles()).find((profile) => profile.id === id);
  });

  app.post("/slurp/accounts/:id/source/adopt-identity", async (req, reply) => {
    const { id } = req.params as { id: string };
    const locked = await tryCreatorAccountOperation(id, async () => {
      const account = await noodle.getNoodlerAccountById(id);
      const publicAccount = account ? await noodle.resolveAccountSource(account) : null;
      const sourceSnapshot = publicAccount ? await resolveCreatorSourceSnapshot(app.db, publicAccount) : null;
      if (!account || !sourceSnapshot) return "missing" as const;
      return (await noodle.adoptNoodlerPublicIdentity(id, sourceSnapshot))
        ? ("updated" as const)
        : ("invalid" as const);
    });
    if (!locked.acquired) return reply.code(409).send({ error: "Another Creator operation is already running." });
    if (locked.value === "missing") return reply.code(404).send({ error: "Slurp source not found" });
    if (locked.value === "invalid") {
      return reply.code(400).send({
        error: "Only open Creator profiles can adopt the public identity.",
      });
    }
    return (await noodle.listNoodlerStageProfiles()).find((profile) => profile.id === id);
  });
}
