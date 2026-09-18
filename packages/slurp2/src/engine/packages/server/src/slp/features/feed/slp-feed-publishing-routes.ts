import { noodlerTargetedRefreshSchema, noodlerGenerationRequestSchema } from "@marinara-engine/shared";
import { z } from "zod";
import { getSlurpPostGuidance, updateSlurpPostGuidance } from "../../../services/slurp/slurp-post-guidance.storage.js";
import {
  SLURP_BUILT_IN_POST_GUIDANCE,
  SLURP_POST_GUIDANCE_MAX_LENGTH,
} from "../../../services/slurp/slurp-post-guidance.js";
import { resolveSlurpTextConnection } from "../../../services/slurp/slurp-connection.js";
import { generateSlurpPostGuidanceDraft } from "../../../services/slurp/slurp-post-guidance-draft.service.js";
import { logger } from "../../../lib/logger.js";
import { getErrorMessage } from "../../../services/slurp/slurp-public-support.js";
import {
  getNoodlerImageConnections,
  updateNoodlerImageConnections,
} from "../../../services/slurp/slurp-image-connections.js";
import {
  generateAndApplyNoodlerPost,
  refreshAllNoodlerCreatorsNow,
  refreshTargetedNoodlerCreatorsNow,
} from "../../../services/slurp/slurp-post.operation.js";
import { resolveSlurpAutomaticPostAccess } from "../../../services/slurp/slurp-generation.service.js";
import {
  admissionModeForRequest,
  isConnectionAdmissionFailure,
} from "../../../services/generation/connection-admission.js";
import type { FastifyInstance } from "fastify";
import { slurpPostTypeSchema } from "../../base/host/slp-request-schemas.js";
import {
  type DecodedNoodlerMediaRequest,
  decodeNoodlerMediaRequest,
  sendNoodlerMediaError,
} from "../../base/host/slp-multipart.js";
import type { SlpRouteDeps } from "../../base/host/slp-viewer-context.js";

const slurpTargetedRefreshSchema = noodlerTargetedRefreshSchema.extend({
  access: z.enum(["public", "locked"]).optional(),
});
// The packaged shared bundle wraps this schema in a refinement, so `.extend` is not always
// available. Extend the underlying object and re-run the full base schema in a refinement.
// Same trick as the post-create schema below: the packaged shared bundle may wrap the generation
// schema, so extend the underlying object rather than the export.
const slurpNoodlerGenerationRequestSchema = (
  noodlerGenerationRequestSchema instanceof z.ZodEffects
    ? noodlerGenerationRequestSchema.innerType()
    : noodlerGenerationRequestSchema
).extend({ postType: slurpPostTypeSchema.default("post"), generateImage: z.boolean().optional() });

const noodleImagePromptConfirmationSchema = z.object({
  prompts: z
    .array(
      z.object({
        id: z.string().min(1),
        prompt: z.string().trim().min(1).max(20_000),
        negativePrompt: z.string().trim().max(20_000).optional(),
      }),
    )
    .max(20),
  debugMode: z.boolean().optional(),
});
export async function slpFeedPublishingRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { connections, noodle, noodlerImages } = deps;
  app.get("/noodler/auto-post/status", async (_req, reply) => {
    return noodle.getNoodlerReserveStatus();
  });

  app.patch("/noodler/auto-post/schedule/:slotId", async (req, reply) => {
    const body = z.object({ publishAt: z.string().datetime() }).safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const { slotId } = req.params as { slotId: string };
    const result = await noodle.rescheduleNoodlerPost(slotId, body.data.publishAt);
    if (result === "not_found") return reply.code(404).send({ error: "Scheduled Slurp post not found." });
    if (result === "not_future") return reply.code(400).send({ error: "Publication time must be in the future." });
    if (result === "not_editable") return reply.code(409).send({ error: "This Slurp post is no longer editable." });
    if (result === "conflict") {
      return reply.code(409).send({ error: "This publication time is too close to another Creator post." });
    }
    return noodle.getNoodlerReserveStatus();
  });

  // `builtIn` travels with the value so the client can show what applies while a field is empty
  // without keeping its own copy of the wording.
  app.get("/noodler/post-guidance", async () => ({
    ...(await getSlurpPostGuidance(app.db)),
    builtIn: SLURP_BUILT_IN_POST_GUIDANCE,
  }));

  /**
   * Set the global direction for public or locked posts, or one Creator's override of it.
   *
   * Sent the same way as the image-connection map: `creatorId` selects the override, its absence
   * means the global field. An empty string clears the level being written and lets the level
   * below it apply again.
   */
  app.patch("/noodler/post-guidance", async (req, reply) => {
    const body = z
      .object({
        creatorId: z.string().min(1).nullable().optional(),
        public: z.string().max(SLURP_POST_GUIDANCE_MAX_LENGTH).optional(),
        locked: z.string().max(SLURP_POST_GUIDANCE_MAX_LENGTH).optional(),
        /** A Creator's private content menu. Only valid with `creatorId`: it has no global level. */
        menu: z.string().max(SLURP_POST_GUIDANCE_MAX_LENGTH).optional(),
      })
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const { creatorId } = body.data;
    if (body.data.public === undefined && body.data.locked === undefined && body.data.menu === undefined) {
      return reply.code(400).send({ error: "Send public, locked, or menu." });
    }
    if (body.data.menu !== undefined && !creatorId) {
      return reply.code(400).send({ error: "A content menu belongs to one Creator; send creatorId." });
    }
    if (creatorId && !(await noodle.getNoodlerAccountById(creatorId))) {
      return reply.code(404).send({ error: "Slurp stage profile not found" });
    }
    const next = await updateSlurpPostGuidance(app.db, (current) => {
      const patch = (entry: { public: string; locked: string; menu: string }) => ({
        public: body.data.public ?? entry.public,
        locked: body.data.locked ?? entry.locked,
        menu: body.data.menu ?? entry.menu,
      });
      if (!creatorId) return { ...current, defaults: patch(current.defaults) };
      return {
        ...current,
        creators: {
          ...current.creators,
          [creatorId]: patch(current.creators[creatorId] ?? { public: "", locked: "", menu: "" }),
        },
      };
    });
    return { ...next, builtIn: SLURP_BUILT_IN_POST_GUIDANCE };
  });

  /** Draft one access direction with the model. Returns the text; saving it stays the client's call. */
  app.post("/noodler/post-guidance-draft", async (req, reply) => {
    const body = z
      .object({
        access: z.enum(["public", "locked"]),
        creatorId: z.string().min(1).nullable().optional(),
        currentDraft: z.string().max(SLURP_POST_GUIDANCE_MAX_LENGTH).optional(),
        guidance: z.string().max(2000).optional(),
        connectionId: z.string().min(1).nullable().optional(),
      })
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const settings = await noodle.getSettings();
    const connection = await resolveSlurpTextConnection(
      connections,
      body.data.connectionId ?? settings.generationConnectionId,
    );
    if (!connection) return reply.code(404).send({ error: "Slurp generation connection not found" });
    try {
      return await generateSlurpPostGuidanceDraft(app.db, {
        access: body.data.access,
        creatorId: body.data.creatorId ?? null,
        currentDraft: body.data.currentDraft ?? "",
        guidance: body.data.guidance ?? "",
        connection,
        promptBlocks: settings.promptBlocks,
      });
    } catch (error) {
      logger.error(error, "[slurp] Post guidance draft failed using %s", connection.model || connection.provider);
      // Written for the user (no answer, empty answer, leaked identity), so show the reason.
      return reply.code(500).send({ error: `Post guidance draft failed: ${getErrorMessage(error)}` });
    }
  });

  app.get("/noodler/image-connections", async () => getNoodlerImageConnections(app.db));

  app.patch("/noodler/image-connections", async (req, reply) => {
    const body = z
      .object({
        defaultConnectionId: z.string().min(1).nullable().optional(),
        creatorId: z.string().min(1).optional(),
        connectionId: z.string().min(1).nullable().optional(),
      })
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const { creatorId, connectionId, defaultConnectionId } = body.data;
    // A creatorId without a connectionId (or the reverse) silently did nothing.
    if ((creatorId === undefined) !== (connectionId === undefined)) {
      return reply.code(400).send({
        error: "Set creatorId and connectionId together to map a Creator to an image connection.",
      });
    }
    if (creatorId && !(await noodle.getNoodlerAccountById(creatorId))) {
      return reply.code(404).send({ error: "Slurp stage profile not found" });
    }
    for (const candidateConnectionId of [defaultConnectionId, connectionId]) {
      if (candidateConnectionId === undefined || candidateConnectionId === null) continue;
      const connection = await connections.getWithKey(candidateConnectionId);
      if (!connection || connection.provider !== "image_generation") {
        return reply.code(404).send({ error: "Slurp image connection not found" });
      }
    }
    return updateNoodlerImageConnections(app.db, (current) => {
      const creatorConnectionIds = { ...current.creatorConnectionIds };
      if (creatorId) {
        if (connectionId) creatorConnectionIds[creatorId] = connectionId;
        else delete creatorConnectionIds[creatorId];
      }
      return {
        defaultConnectionId: defaultConnectionId !== undefined ? defaultConnectionId : current.defaultConnectionId,
        creatorConnectionIds,
      };
    });
  });

  // Manual test trigger: runs one automatic-style post immediately, the same way the
  // scheduler does (locked access, no guide), without waiting for the next cadence
  // schedule or requiring auto-posting to be enabled.
  app.post("/noodler/accounts/:id/auto-post/run-now", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const result = await generateAndApplyNoodlerPost(app.db, {
        mode: "noodler",
        targetAccountId: id,
        access: await resolveSlurpAutomaticPostAccess(noodle, id),
      });
      // Run-now never sets reviewImagePromptsBeforeSend, so the generator can only return a
      // plain post here — no image-prompt review is ever produced on this path.
      if (result.status === "generated") return result.post;
      if (result.status === "busy") {
        return reply.code(409).send({
          error: "A generation for this Slurp account is already running.",
        });
      }
      if (result.status === "connection_required") {
        return reply.code(400).send({ error: "Select a Slurp generation connection first." });
      }
      if (result.status === "connection_not_found") {
        return reply.code(404).send({ error: "Slurp generation connection not found" });
      }
      if (result.status === "disabled") {
        return reply.code(400).send({ error: "Persona-owned Slurp profiles cannot post automatically" });
      }
      return reply.code(404).send({ error: "Slurp account not found." });
    } catch (error) {
      logger.error(error, "[slurp] Manual run-now failed");
      return reply.code(500).send({ error: "Manual post generation failed." });
    }
  });

  // Global manual trigger: runs every automation-enabled creator (prioritizing those
  // scheduled soonest), consuming each selected creator's near-future slot the same way
  // an automatic run would. One creator's failure does not affect the others.
  app.post("/noodler/auto-post/refresh-now", async (_req, reply) => {
    const result = await refreshAllNoodlerCreatorsNow(app.db);
    if (result.status === "disabled") return reply.code(404).send({ error: "Not Found" });
    return { outcomes: result.outcomes };
  });

  app.post("/noodler/auto-post/refresh-targeted", async (req, reply) => {
    const parsed = slurpTargetedRefreshSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = await refreshTargetedNoodlerCreatorsNow(
      app.db,
      parsed.data.accountIds,
      parsed.data.executionId,
      parsed.data.access ?? "locked",
    );
    if (result.status === "disabled") return reply.code(404).send({ error: "Not Found" });
    return { outcomes: result.outcomes };
  });

  app.post("/noodler/refresh/images", async (req, reply) => {
    const parsed = noodleImagePromptConfirmationSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = await noodlerImages.generateReviewedImages({
      prompts: parsed.data.prompts,
      debugMode: parsed.data.debugMode === true,
    });
    if (!result.ok) return reply.code(400).send({ error: result.message });
    return { finalized: result.finalized };
  });

  app.post("/refresh", async (req, reply) => {
    let decoded: DecodedNoodlerMediaRequest<z.output<typeof slurpNoodlerGenerationRequestSchema>>;
    try {
      decoded = await decodeNoodlerMediaRequest(req, {
        withMedia: slurpNoodlerGenerationRequestSchema,
        withoutMedia: slurpNoodlerGenerationRequestSchema,
      });
    } catch (error) {
      return sendNoodlerMediaError(reply, error);
    }
    if (!decoded.success) return reply.code(400).send({ error: decoded.error.flatten() });
    if (decoded.data.mode !== "noodler") return reply.code(404).send({ error: "Not Found" });
    try {
      const result = await generateAndApplyNoodlerPost(
        app.db,
        decoded.data,
        decoded.media,
        admissionModeForRequest(req.headers),
      );
      if (result.status === "generated") {
        return result.imagePromptReview ? { ...result.post, imagePromptReview: result.imagePromptReview } : result.post;
      }
      if (result.status === "busy") {
        return reply.code(409).send({
          error: "A generation for this Slurp account is already running.",
        });
      }
      if (result.status === "connection_required") {
        return reply.code(400).send({ error: "Select a Slurp generation connection first." });
      }
      if (result.status === "connection_not_found") {
        return reply.code(404).send({ error: "Slurp generation connection not found" });
      }
      if (result.status === "disabled") {
        return reply.code(400).send({ error: "Persona-owned Slurp profiles cannot post automatically" });
      }
      return reply.code(404).send({ error: "Slurp account not found." });
    } catch (error) {
      if (isConnectionAdmissionFailure(error)) return reply.code(409).send({ error: getErrorMessage(error) });
      logger.error(error, "[slurp] Slurp post generation failed");
      return reply.code(500).send({ error: "Slurp post generation failed." });
    }
  });
}
