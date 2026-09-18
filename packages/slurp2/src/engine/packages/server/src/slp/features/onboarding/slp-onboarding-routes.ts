import { noodleBulkNoodlerAccountCreateSchema, noodleStageProfileSchema } from "@marinara-engine/shared";
import { z } from "zod";
import {
  slurpDiscoveryProfileSchema,
  slurpDiscoveryProfileComplete,
} from "../../../services/slurp/slurp-discovery-profile.js";
import { slurpDisclosureMode } from "../../../services/slurp/slurp-disclosure.js";
import { resolveNoodlerSourceSnapshot } from "../../../services/slurp/slurp-source-resolve.js";
import {
  stageProfileContainsPublicIdentity,
  stageProfileContainsSourceDetails,
} from "../../../services/slurp/slurp-generation.service.js";
import { resolveNoodlerCreatorArtwork } from "../../../services/slurp/slurp-public-profiles.service.js";
import { minimizeNoodlerSourceSnapshot } from "../../../services/slurp/slurp-source.js";
import { isSlurpFileUniqueConstraintError } from "../../base/host/slp-file-errors.js";
import { resolveSlurpTextConnection } from "../../../services/slurp/slurp-connection.js";
import { settleAgentJobsWithConcurrencyLimit } from "../../../services/agents/agent-concurrency.js";
import { logger } from "../../../lib/logger.js";
import { generateNoodlerStageProfileDraft } from "../../../services/slurp/slurp-stage-profile-draft.service.js";
import type { FastifyInstance } from "fastify";
import type { SlpRouteDeps } from "../../base/host/slp-viewer-context.js";

const slurpBulkNoodlerAccountCreateSchema = noodleBulkNoodlerAccountCreateSchema.extend({
  connectionId: z.string().min(1).nullable().optional(),
});

const slurpStageProfileSchema = noodleStageProfileSchema.extend(slurpDiscoveryProfileSchema.shape);
// Older clients could skip gender and tags; a new Creator needs both so Discover can find them.
const SLURP_NEW_CREATOR_DISCOVERY_MESSAGE = "A new Creator needs a gender and at least 3 tags.";
const slurpNoodlerAccountCreateSchema = z
  .object({
    stageProfile: slurpStageProfileSchema.refine(slurpDiscoveryProfileComplete, {
      message: SLURP_NEW_CREATOR_DISCOVERY_MESSAGE,
      path: ["tags"],
    }),
  })
  .strict();
export async function slpOnboardingRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { characterGallery, characters, connections, firstPostQueue, noodle, resolveNoodlerPublicIdentity } = deps;
  app.post("/accounts/:id/noodler", async (req, reply) => {
    const parsed = slurpNoodlerAccountCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const publicAccount = await noodle.resolveSourceByEntityId(id);
    if (!publicAccount) {
      return reply.code(404).send({ error: "Noodle account not found" });
    }
    // The shared schema still accepts Secret; Slurp creates it as Hinted.
    parsed.data.stageProfile.disclosureMode = slurpDisclosureMode(parsed.data.stageProfile.disclosureMode);
    const sourceSnapshot = publicAccount ? await resolveNoodlerSourceSnapshot(app.db, publicAccount) : null;
    if (
      publicAccount &&
      (stageProfileContainsPublicIdentity(
        parsed.data.stageProfile,
        await resolveNoodlerPublicIdentity(publicAccount),
      ) ||
        (sourceSnapshot && stageProfileContainsSourceDetails(parsed.data.stageProfile, sourceSnapshot)))
    ) {
      return reply.code(400).send({
        error: "Hinted stage profiles cannot use identifying source names or details.",
      });
    }
    try {
      const artwork = await resolveNoodlerCreatorArtwork({
        characters,
        characterGallery,
        publicAccount,
        disclosureMode: parsed.data.stageProfile.disclosureMode,
      });
      const created = await noodle.createNoodlerAccount(
        publicAccount.kind as "character" | "persona",
        publicAccount.entityId,
        parsed.data.stageProfile,
        undefined,
        sourceSnapshot
          ? minimizeNoodlerSourceSnapshot(sourceSnapshot, parsed.data.stageProfile.disclosureMode)
          : undefined,
        artwork.avatarUrl,
        artwork.bannerUrl,
      );
      if (!created) return reply.code(404).send({ error: "Noodle account not found" });
      const profile = (await noodle.listNoodlerStageProfiles()).find((item) => item.id === created.id);
      if (!profile) throw new Error("Failed to load the created Slurp stage profile.");
      return reply.code(201).send(profile);
    } catch (error) {
      if (isSlurpFileUniqueConstraintError(error, "slurp2_accounts", ["sourceKind", "sourceEntityId"])) {
        return reply.code(409).send({
          error: "A Slurp creator already exists for this Noodle account.",
        });
      }
      throw error;
    }
  });

  app.post("/noodler/accounts/bulk", async (req, reply) => {
    const parsed = slurpBulkNoodlerAccountCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { noodleAccountIds, disclosureMode, disclosureExceptions, autoPosting, connectionId, executionId } =
      parsed.data;
    if (noodleAccountIds.length === 0) {
      return reply.code(201).send({ created: [], skipped: [], failed: [], reasons: [], executionId });
    }
    const settings = await noodle.getSettings();
    const connection = await resolveSlurpTextConnection(
      connections,
      connectionId === undefined ? settings.generationConnectionId : connectionId,
    );
    if (!connection) return reply.code(400).send({ error: "The selected writing connection is not available." });
    const created: string[] = [];
    const skipped: string[] = [];
    // Operational failures (provider/storage) are reported apart from expected exclusions
    // so a provider outage cannot look like a batch of harmless skips.
    const failed: string[] = [];
    // Every exclusion carries a reason against its creator: without one the wizard can only
    // report a count, and one batch can fail for several different causes.
    const reasons: { accountId: string; reason: string }[] = [];
    const noteReason = (accountId: string, reason: string) => {
      reasons.push({ accountId, reason });
    };
    const errorReason = (error: unknown) => (error instanceof Error ? error.message : String(error));
    // The account row and its scheduler settings are two writes. A retry that finds the row
    // already there must still apply the settings, or a creator whose first attempt failed
    // between the two is reported as created while never receiving its auto-posting config.
    const applyAutoPosting = (accountId: string) =>
      noodle.patchAccountSettings(accountId, {
        subtree: "scheduler",
        patch: { autoPosting },
      });
    const settledCreations = await settleAgentJobsWithConcurrencyLimit(noodleAccountIds, 4, async (noodleAccountId) => {
      const publicAccount = await noodle.resolveSourceByEntityId(noodleAccountId);
      const existing = publicAccount
        ? await noodle.getNoodlerAccountForSource(publicAccount.kind as "character" | "persona", publicAccount.entityId)
        : null;
      if (existing) {
        if (executionId && existing.settings.profile.noodlerWizardExecutionId === executionId) {
          try {
            await applyAutoPosting(existing.id);
            created.push(existing.id);
          } catch (error) {
            logger.error(error, "[slurp] Bulk replay could not apply auto-posting for %s", noodleAccountId);
            failed.push(noodleAccountId);
            noteReason(noodleAccountId, errorReason(error));
          }
        } else {
          skipped.push(noodleAccountId);
          noteReason(
            noodleAccountId,
            "Already a Slurp creator from an earlier run. Remove the existing creator first to create it again.",
          );
        }
        return;
      }
      const accountDisclosure = slurpDisclosureMode(disclosureExceptions[noodleAccountId] ?? disclosureMode);
      if (!publicAccount) {
        skipped.push(noodleAccountId);
        noteReason(noodleAccountId, "The source character or persona no longer exists in Noodle.");
        return;
      }
      try {
        const stageProfile = await generateNoodlerStageProfileDraft(app.db, {
          request: {
            noodleAccountId,
            disclosureMode: accountDisclosure,
            guidance: "",
          },
          connection,
        });
        // The draft carries form-only keys (notes, source snapshot, revision token) that the strict
        // create schema refuses. Validating them made every open-mode Creator skip with a wrong reason.
        const {
          notes: _notes,
          sourceSnapshot: _draftSnapshot,
          sourceRevisionToken: _draftToken,
          ...generatedProfile
        } = stageProfile as typeof stageProfile & { sourceSnapshot?: unknown; sourceRevisionToken?: unknown };
        const validatedProfile = slurpNoodlerAccountCreateSchema.safeParse({ stageProfile: generatedProfile });
        if (!validatedProfile.success) {
          skipped.push(noodleAccountId);
          noteReason(
            noodleAccountId,
            validatedProfile.error.issues.every((issue) => issue.message === SLURP_NEW_CREATOR_DISCOVERY_MESSAGE)
              ? "The generated stage profile did not include a valid gender and at least 3 tags."
              : `The generated stage profile could not be used: ${validatedProfile.error.issues
                  .map((issue) => `${issue.path.slice(1).join(".") || "profile"} ${issue.message}`)
                  .join("; ")}`,
          );
          return;
        }
        const sourceSnapshot = await resolveNoodlerSourceSnapshot(app.db, publicAccount);
        // Belt-and-braces: the generator already enforces leak protection, but keep the guard.
        if (
          stageProfileContainsPublicIdentity(stageProfile, await resolveNoodlerPublicIdentity(publicAccount)) ||
          (sourceSnapshot && stageProfileContainsSourceDetails(stageProfile, sourceSnapshot))
        ) {
          skipped.push(noodleAccountId);
          noteReason(
            noodleAccountId,
            "The generated stage profile repeated the linked public identity, so it was rejected. Try again, or set the disclosure mode to open.",
          );
          return;
        }
        const artwork = await resolveNoodlerCreatorArtwork({
          characters,
          characterGallery,
          publicAccount,
          disclosureMode: accountDisclosure,
        });
        const account = await noodle.createNoodlerAccount(
          publicAccount.kind as "character" | "persona",
          publicAccount.entityId,
          validatedProfile.data.stageProfile,
          executionId,
          sourceSnapshot ? minimizeNoodlerSourceSnapshot(sourceSnapshot, accountDisclosure) : undefined,
          artwork.avatarUrl,
          artwork.bannerUrl,
        );
        if (!account) {
          skipped.push(noodleAccountId);
          noteReason(noodleAccountId, "The creator record could not be written.");
          return;
        }
        await applyAutoPosting(account.id);
        created.push(account.id);
      } catch (error) {
        if (isSlurpFileUniqueConstraintError(error, "slurp2_accounts", ["sourceKind", "sourceEntityId"])) {
          const replayed = await noodle.getNoodlerAccountForSource(
            publicAccount.kind as "character" | "persona",
            publicAccount.entityId,
          );
          if (executionId && replayed?.settings.profile.noodlerWizardExecutionId === executionId) {
            // This branch already runs inside the outer catch, so an unguarded throw here would
            // escape the loop and fail the whole batch instead of this one creator.
            try {
              await applyAutoPosting(replayed.id);
              created.push(replayed.id);
            } catch (autoPostingError) {
              logger.error(
                autoPostingError,
                "[slurp] Bulk replay could not apply auto-posting for %s",
                noodleAccountId,
              );
              failed.push(noodleAccountId);
              noteReason(noodleAccountId, errorReason(autoPostingError));
            }
          } else {
            skipped.push(noodleAccountId);
            noteReason(
              noodleAccountId,
              "Already a Slurp creator from an earlier run. Remove the existing creator first to create it again.",
            );
          }
          return;
        }
        logger.error(error, "[slurp] Bulk stage profile generation failed for %s", noodleAccountId);
        failed.push(noodleAccountId);
        noteReason(noodleAccountId, errorReason(error));
        return;
      }
    });
    settledCreations.forEach((result, index) => {
      if (result.status === "fulfilled") return;
      const noodleAccountId = noodleAccountIds[index]!;
      logger.error(result.reason, "[slurp] Bulk stage profile setup failed for %s", noodleAccountId);
      failed.push(noodleAccountId);
      noteReason(noodleAccountId, errorReason(result.reason));
    });
    const profiles = await noodle.listNoodlerStageProfiles();
    return reply.code(201).send({
      created: profiles.filter((profile) => created.includes(profile.id)),
      skipped,
      failed,
      reasons,
      executionId,
    });
  });

  app.post("/noodler/first-posts/enqueue", async (req, reply) => {
    const parsed = z
      .object({
        executionId: z.string().trim().min(1).max(128),
        accountIds: z.array(z.string().trim().min(1).max(64)).min(1).max(24),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return { jobs: await firstPostQueue.enqueue(parsed.data.executionId, parsed.data.accountIds) };
  });

  app.get("/noodler/first-posts/status", async (req, reply) => {
    const parsed = z.object({ executionId: z.string().trim().min(1).max(128) }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return firstPostQueue.status(parsed.data.executionId);
  });
}
