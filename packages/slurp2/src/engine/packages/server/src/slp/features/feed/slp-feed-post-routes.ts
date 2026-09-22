import { createSlpPoll, readSlpPollFromMetadata } from "../../../../../shared/src/slp/slp-polls.js";
import {
  slpCreatorCreateInteractionSchema,
  slpCreatorPostCreateWithMediaSchema,
  slpCreatorPostUpdateSchema,
  slpCreatorRemoveInteractionSchema,
  slpCreatorReplyRequestSchema,
  slpCreatorViewerPersonaSchema,
  slpInteractionUpdateSchema,
} from "../../../../../shared/src/slp/slp-social.schema.js";
import { z } from "zod";
import { canViewCreatorPost } from "../../base/identity/slp-access.js";
import {
  readCreatorMediaPath,
  resolveCreatorMediaAbsolutePath,
  readCreatorLockedTeaser,
  resolveCreatorMediaVariant,
  unlinkCreatorMedia,
} from "../../base/media/slp-media.js";
import { existsSync } from "fs";
import { extname, basename, dirname } from "path";
import { slpInteractions, slpReports } from "../../../db/schema/slurp.js";
import { and, eq } from "../../../db/file-query.js";
import { newId, now } from "../../../utils/id-generator.js";
import { isSlurpFileUniqueConstraintError } from "../../base/host/slp-file-errors.js";
import { generateAndApplyCreatorReply } from "../messages/slp-messages-contract.js";
import { logger } from "../../../lib/logger.js";
import { tryCreatorAccountOperation } from "../../base/locking/slp-account-operation-lock.js";
import { createCreatorPost, updateCreatorPostWithMedia } from "./slp-post-operation.js";
import { isDirectlyInvitedSlpCharacter } from "../../modules/feed/slp-invited-post-draft-access.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import { generateInvitedSlpPostDraft } from "./slp-invited-post-draft-service.js";
import { isConnectionAdmissionFailure } from "../../../services/generation/connection-admission.js";
import { getErrorMessage } from "../../modules/creators/slp-public-support.js";
import { listSlurpPostMedia } from "../../data/feed/slp-post-media-storage.js";
import type { FastifyInstance } from "fastify";
import { slurpPostTypeSchema } from "../../modules/requests/slp-request-schemas.js";
import {
  type DecodedCreatorMediaRequest,
  decodeCreatorMediaRequest,
  sendCreatorMediaError,
  readCreatorMultipart,
} from "../../base/host/slp-multipart.js";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { slurpPromptContext } from "../../base/prompting/slp-prompt-blocks.js";
import { recordSlurpContinuityEvent } from "../../data/continuity/slp-continuity-storage.js";
import { slurpContinuityIdentityOf } from "../../modules/continuity/slp-continuity-rules.js";
const slurpCreatorPostCreateBaseSchema = (
  slpCreatorPostCreateWithMediaSchema instanceof z.ZodEffects
    ? slpCreatorPostCreateWithMediaSchema.innerType()
    : slpCreatorPostCreateWithMediaSchema
) as typeof slpCreatorPostCreateWithMediaSchema;
const slurpCreatorPostCreateWithMediaSchema = slurpCreatorPostCreateBaseSchema
  .extend({
    postType: slurpPostTypeSchema.default("post"),
    linkedPostId: z.string().trim().min(1).nullable().optional(),
    imagePrompt: z.string().trim().max(2000).nullable().optional(),
    // Multipart bodies carry numbers as text, and an empty field means "use the Creator's price".
    unlockPrice: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.coerce.number().int().min(0).max(9999).optional(),
    ),
  })
  .superRefine(
    (
      {
        postType: _postType,
        linkedPostId: _linkedPostId,
        unlockPrice: _unlockPrice,
        imagePrompt: _imagePrompt,
        ...rest
      },
      ctx,
    ) => {
      const result = slpCreatorPostCreateWithMediaSchema.safeParse(rest);
      if (!result.success) {
        for (const issue of result.error.issues) ctx.addIssue(issue);
      }
    },
  );
const slurpCreatorPostCreateSchema = slurpCreatorPostCreateWithMediaSchema.superRefine((input, ctx) => {
  if (!input.content && !input.poll && !input.uploadedImageUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["content"],
      message: "Posts need a body, image, or poll.",
    });
  }
});
function requestRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
export async function slpFeedPostRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { connections, creatorBelongsToViewer, noodle, slpCreatorImages, resolveViewerIdentity, resolveViewerPersona } =
    deps;
  app.post("/slurp/posts/:id/report", async (req, reply) => {
    const body = z
      .object({
        personaId: z.string().trim().min(1),
        targetType: z.enum(["post", "reply"]),
        targetId: z.string().trim().min(1),
        // The first six are the shipped values and stay, so stored reports keep their meaning.
        // The rest are the categories a real social network offers, plus the three that only
        // make sense here: a Creator passing themselves off as a real person, paid content
        // reposted for free, and a Creator who reads as underage.
        reason: z.enum([
          "spam",
          "illegal",
          "privacy",
          "harassment",
          "adult",
          "other",
          "hate",
          "violence",
          "self_harm",
          "misinformation",
          "scam",
          "intellectual_property",
          "impersonation",
          "leaked_paid",
          "underage",
        ]),
        details: z.string().trim().max(2000).default(""),
      })
      .strict()
      .superRefine((value, context) => {
        if (value.reason === "other" && !value.details) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["details"],
            message: "Details are required for Other.",
          });
        }
      })
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const routePostId = (req.params as { id: string }).id;
    if (body.data.targetType === "post" && body.data.targetId !== routePostId) {
      return reply.code(400).send({ error: "The report target does not match the post." });
    }
    const identity = await resolveViewerIdentity(body.data.personaId);
    if (!identity?.actor) return reply.code(404).send({ error: "Slurp viewer profile not found" });
    const post = await noodle.getNoodlerPostById(routePostId);
    if (!post) return reply.code(404).send({ error: "Post not found" });
    const creator = await noodle.getNoodlerAccountById(post.authorAccountId);
    if (!creator) return reply.code(404).send({ error: "Creator not found" });
    if (creatorBelongsToViewer(creator, identity.viewer))
      return reply.code(403).send({ error: "You cannot report your own content." });
    let target: Record<string, unknown> = {
      title: post.title,
      content: post.content,
      mediaReference: post.imageUrl,
      access: post.access,
      visibleReplies: [],
    };
    if (body.data.targetType === "reply") {
      const [interaction] = await app.db
        .select()
        .from(slpInteractions)
        .where(eq(slpInteractions.id, body.data.targetId));
      if (!interaction || interaction.postId !== post.id || interaction.type !== "reply") {
        return reply.code(404).send({ error: "Reply not found" });
      }
      target = {
        ...target,
        reply: { id: interaction.id, content: interaction.content, createdAt: interaction.createdAt },
      };
    } else {
      const replies = await app.db.select().from(slpInteractions).where(eq(slpInteractions.postId, post.id));
      target.visibleReplies = replies
        .filter((item) => item.type === "reply")
        .map((item) => ({ id: item.id, content: item.content, createdAt: item.createdAt }));
    }
    const existing = await app.db
      .select()
      .from(slpReports)
      .where(
        and(
          eq(slpReports.reporterAccountId, identity.actor.id),
          eq(slpReports.targetType, body.data.targetType),
          eq(slpReports.targetId, body.data.targetId),
        ),
      );
    if (existing[0]) return { reported: true, duplicate: true };
    const createdAt = now();
    const reportId = newId();
    await app.db.insert(slpReports).values({
      id: reportId,
      reporterAccountId: identity.actor.id,
      creatorAccountId: creator.id,
      targetType: body.data.targetType,
      targetId: body.data.targetId,
      reason: body.data.reason,
      details: body.data.details,
      snapshot: JSON.stringify(target),
      createdAt,
    });
    const creatorIdentity = slurpContinuityIdentityOf(creator);
    await recordSlurpContinuityEvent(app.db, {
      ...creatorIdentity,
      eventType: "report_received",
      source: "user",
      realityScope: "slurp",
      audienceScope: "creator_private",
      payload: {
        reportId,
        targetType: body.data.targetType,
        reason: body.data.reason,
        details: body.data.details,
        effect: { sentiment: "model_pending", audience: "model_pending" },
      },
      relatedIds: [body.data.targetId, reportId],
      fingerprint: `report:${reportId}`,
      contribution: "system",
      occurredAt: new Date(createdAt),
    });
    return { reported: true, duplicate: false };
  });
  async function resolveReadableCreatorPost(personaId: string, postId: string) {
    const viewer = await resolveViewerPersona(personaId);
    const post = viewer ? await noodle.getNoodlerPostById(postId) : null;
    const creator = post ? await noodle.getNoodlerAccountById(post.authorAccountId) : null;
    if (!viewer || !post || !creator) return null;
    if (creatorBelongsToViewer(creator, viewer)) return { viewer, post, creator, locked: false };
    const [subscriptions, unlocks] = await Promise.all([
      noodle.listSubscriptionsForViewer(viewer.id),
      noodle.listPostUnlocksForViewer(viewer.id),
    ]);
    const subscribed = subscriptions.some((item) => item.creatorAccountId === creator.id);
    const locked = !canViewCreatorPost({
      post,
      subscribed,
      unlockedPostIds: new Set(unlocks.map((item) => item.postId)),
    });
    // Locked is reported rather than refused: the media route still owes a locked viewer a
    // blurred teaser. Every caller that needs the post's protected content checks it.
    return { viewer, post, creator, locked };
  }
  async function resolveGatedCreatorPost(personaId: string, postId: string) {
    const readable = await resolveReadableCreatorPost(personaId, postId);
    // A viewer persona linked to the creator's own public account may read its posts, but
    // is not an audience member and must not persist self-interactions.
    if (!readable || readable.locked || creatorBelongsToViewer(readable.creator, readable.viewer)) return null;
    return readable;
  }
  async function resolveInteractableCreatorPost(personaId: string, postId: string) {
    const readable = await resolveReadableCreatorPost(personaId, postId);
    return !readable || readable.locked ? null : readable;
  }
  // Access-checked serving for NoodleR-owned media. This entire router is installed
  // through registerPrivilegedRoutes, so the host authenticates the Engine owner before
  // any handler runs. A persona query additionally gates that owner-scoped request as a fan
  // (subscriber/unlock/hidden all enforced), which is why audience-facing projections bind
  // the viewer's persona into every media URL they hand out. No persona is the owner path,
  // the same trusted management surface as the other /slurp/accounts routes. The bytes
  // live outside any publicly readable gallery namespace, so this is the only way in.
  app.get("/noodler/posts/:id/media", async (req, reply) => {
    const { id } = req.params as { id: string };
    const personaId = (req.query as { personaId?: string }).personaId;
    const readable = personaId ? await resolveReadableCreatorPost(personaId, id) : null;
    const post = personaId ? readable?.post : await noodle.getNoodlerPostById(id);
    if (!post) return reply.code(404).send({ error: "Not Found" });
    const mediaPath = readCreatorMediaPath(post);
    const absolute = mediaPath ? resolveCreatorMediaAbsolutePath(mediaPath) : null;
    if (!absolute || !existsSync(absolute)) return reply.code(404).send({ error: "Not Found" });
    // A locked viewer gets the blurred derivative, never the original bytes. If it cannot be
    // built the frame stays empty rather than falling back to the protected image.
    if (readable?.locked) {
      const teaser = await readCreatorLockedTeaser(absolute);
      if (!teaser) return reply.code(404).send({ error: "Not Found" });
      return reply
        .header("Cache-Control", "private, max-age=300")
        .header("Content-Disposition", `inline; filename="slurp-${id}.jpg"`)
        .type("image/jpeg")
        .send(teaser);
    }
    const width = z.coerce
      .number()
      .int()
      .optional()
      .safeParse((req.query as { width?: string }).width);
    const served = await resolveCreatorMediaVariant(absolute, width.success ? width.data : undefined);
    return (
      reply
        // The post-owned URL is stable across ordinary feed refreshes, but an owner can replace
        // its bytes in place. Audience URLs include distinct locked/original variants, so an
        // unlock changes the browser cache key instead of retaining a cached teaser.
        .header("Cache-Control", "private, max-age=300")
        // This URL ends in `/media`, so saving a post image produced a file with no extension, or
        // one the browser guessed. `inline` keeps it displaying in the feed and only names it on
        // the way to disk, with the extension the bytes actually have.
        .header("Content-Disposition", `inline; filename="slurp-${id}${extname(basename(served)).toLowerCase()}"`)
        .sendFile(basename(served), dirname(served))
    );
  });
  app.get("/noodler/posts/:id/media/:position", async (req, reply) => {
    const { id, position: rawPosition } = req.params as { id: string; position: string };
    const position = Number.parseInt(rawPosition, 10);
    if (!Number.isInteger(position) || position < 1) return reply.code(404).send({ error: "Not Found" });
    const personaId = (req.query as { personaId?: string }).personaId;
    const readable = personaId ? await resolveReadableCreatorPost(personaId, id) : null;
    const post = personaId ? readable?.post : await noodle.getNoodlerPostById(id);
    if (!post) return reply.code(404).send({ error: "Not Found" });
    const media = (await listSlurpPostMedia(app.db, id)).find((item) => item.position === position);
    const absolute = media ? resolveCreatorMediaAbsolutePath(media.mediaPath) : null;
    if (!absolute || !existsSync(absolute)) return reply.code(404).send({ error: "Not Found" });
    if (readable?.locked) {
      const teaser = await readCreatorLockedTeaser(absolute);
      if (!teaser) return reply.code(404).send({ error: "Not Found" });
      return reply.header("Cache-Control", "private, max-age=300").type("image/jpeg").send(teaser);
    }
    const width = z.coerce
      .number()
      .int()
      .optional()
      .safeParse((req.query as { width?: string }).width);
    const served = await resolveCreatorMediaVariant(absolute, width.success ? width.data : undefined);
    return reply.header("Cache-Control", "private, max-age=300").sendFile(basename(served), dirname(served));
  });
  app.post("/slurp/posts/:id/interactions", async (req, reply) => {
    const parsed = slpCreatorCreateInteractionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (parsed.data.type === "repost") return reply.code(400).send({ error: "Reposts are not available in Slurp." });
    const { id } = req.params as { id: string };
    const identity = await resolveViewerIdentity(parsed.data.personaId);
    if (!identity?.actor) return reply.code(404).send({ error: "Slurp viewer profile not found" });
    const gated = await resolveInteractableCreatorPost(parsed.data.personaId, id);
    if (!gated) return reply.code(404).send({ error: "Slurp post not found" });
    const actor = creatorBelongsToViewer(gated.creator, identity.viewer) ? gated.creator : identity.actor;
    if (parsed.data.type === "vote") {
      const poll = readSlpPollFromMetadata(gated.post.metadata);
      const optionId = parsed.data.content?.trim() ?? "";
      if (!poll?.options.some((option) => option.id === optionId)) {
        return reply.code(400).send({ error: "Choose a valid poll option." });
      }
    }
    const interaction = await noodle.createNoodlerInteraction(id, {
      actorAccountId: actor.id,
      viewerPersonaId: identity.personaId,
      type: parsed.data.type,
      content: parsed.data.content ?? null,
      parentInteractionId: parsed.data.parentInteractionId ?? null,
    });
    if (!interaction) return reply.code(400).send({ error: "Could not add that Slurp interaction." });
    // Taking part pays, capped per day. A like is one tap, so only the interactions that cost the
    // player something to write are rewarded — otherwise the cap is reached by tapping hearts.
    if (actor.id !== gated.creator.id && (parsed.data.type === "reply" || parsed.data.type === "vote")) {
      await noodle.earnCoins(identity.personaId, "engagement", parsed.data.type);
    }
    return reply.code(201).send(interaction);
  });
  app.post("/slurp/stories/:id/view", async (req, reply) => {
    const parsed = slpCreatorViewerPersonaSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const identity = await resolveViewerIdentity(parsed.data.personaId);
    const post = await noodle.getNoodlerPostById(id);
    if (!identity?.actor || !post || post.metadata.noodlerPostType !== "story") {
      return reply.code(404).send({ error: "Story not found" });
    }
    const gated = await resolveGatedCreatorPost(parsed.data.personaId, id);
    if (!gated || gated.locked) return reply.code(404).send({ error: "Story not found" });
    const existing = await app.db
      .select()
      .from(slpInteractions)
      .where(
        and(
          eq(slpInteractions.postId, id),
          eq(slpInteractions.actorAccountId, identity.actor.id),
          eq(slpInteractions.type, "story_view"),
        ),
      );
    if (existing[0]) return { viewed: true, duplicate: true };
    try {
      await app.db.insert(slpInteractions).values({
        id: newId(),
        postId: id,
        parentInteractionId: null,
        actorAccountId: identity.actor.id,
        type: "story_view",
        content: null,
        imageUrl: null,
        actorSnapshot: JSON.stringify({
          id: identity.actor.id,
          handle: identity.actor.handle,
          displayName: identity.actor.displayName,
        }),
        createdAt: now(),
      });
    } catch (error) {
      if (
        !isSlurpFileUniqueConstraintError(error, "slurp2_interactions", [
          "postId",
          "actorAccountId",
          "type",
          "parentInteractionId",
        ])
      )
        throw error;
      return { viewed: true, duplicate: true };
    }
    return { viewed: true, duplicate: false };
  });
  app.get("/slurp/stories/:id/views", async (req, reply) => {
    const parsed = slpCreatorViewerPersonaSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const post = await noodle.getNoodlerPostById(id);
    if (!post || post.metadata.noodlerPostType !== "story") return reply.code(404).send({ error: "Story not found" });
    const identity = await resolveViewerIdentity(parsed.data.personaId);
    const creator = await noodle.getNoodlerAccountById(post.authorAccountId);
    if (!identity?.viewer || !creator) {
      return reply.code(404).send({ error: "Slurp persona not found" });
    }
    const rows = await app.db
      .select()
      .from(slpInteractions)
      .where(and(eq(slpInteractions.postId, id), eq(slpInteractions.type, "story_view")));
    return {
      count: rows.length,
      viewers: rows.map((row) => {
        try {
          return JSON.parse(row.actorSnapshot);
        } catch {
          return { id: row.actorAccountId, displayName: "Viewer", handle: "" };
        }
      }),
    };
  });
  app.post("/slurp/posts/:postId/interactions/:interactionId/creator-reply", async (req, reply) => {
    const parsed = slpCreatorReplyRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { postId, interactionId } = req.params as {
      postId: string;
      interactionId: string;
    };
    const identity = await resolveViewerIdentity(parsed.data.personaId);
    if (!identity?.actor) return reply.code(404).send({ error: "Slurp viewer profile not found" });
    try {
      const result = await generateAndApplyCreatorReply(app.db, {
        postId,
        parentInteractionId: interactionId,
        viewerPersonaId: identity.personaId,
        viewerActorAccountId: identity.actor.id,
        debugMode: parsed.data.debugMode === true,
      });
      if (result.status === "generated") return reply.code(201).send(result);
      if (result.status === "busy") {
        return reply.code(409).send({
          error: "Another operation for this Slurp account is already running.",
        });
      }
      if (result.status === "connection_required") {
        return reply.code(400).send({ error: "Select a Slurp generation connection first." });
      }
      if (result.status === "connection_not_found") {
        return reply.code(404).send({ error: "Slurp generation connection not found" });
      }
      if (result.status === "exhausted") {
        // The ceiling is installation-wide, not per creator: saying otherwise sends the user to
        // another creator that is just as blocked.
        return reply.code(429).send({
          error: "No automatic creator replies are left in the last 24 hours.",
        });
      }
      if (result.status === "ineligible") {
        return reply.code(404).send({
          error: "That Slurp reply can no longer receive a creator reply.",
        });
      }
      // `duplicate` carries the existing interaction and is a success: the reply the caller
      // wanted is already there.
      return result;
    } catch (error) {
      logger.error(error, "[noodler-reply] Creator reply generation failed");
      return reply.code(500).send({ error: "Creator reply generation failed." });
    }
  });
  app.delete("/slurp/posts/:id/interactions", async (req, reply) => {
    const parsed = slpCreatorRemoveInteractionSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const identity = await resolveViewerIdentity(parsed.data.personaId);
    if (!identity?.actor) return reply.code(404).send({ error: "Slurp viewer profile not found" });
    const gated = await resolveInteractableCreatorPost(parsed.data.personaId, id);
    if (!gated) return reply.code(404).send({ error: "Slurp post not found" });
    const actor = creatorBelongsToViewer(gated.creator, identity.viewer) ? gated.creator : identity.actor;
    const interaction = await noodle.deleteNoodlerInteraction(id, {
      actorAccountId: actor.id,
      viewerPersonaId: identity.personaId,
      type: parsed.data.type,
      parentInteractionId: parsed.data.parentInteractionId ?? null,
    });
    if (!interaction) return reply.code(404).send({ error: "Slurp interaction not found" });
    return interaction;
  });
  app.patch("/slurp/posts/:postId/interactions/:interactionId", async (req, reply) => {
    const { postId, interactionId } = req.params as { postId: string; interactionId: string };
    const parsed = slpInteractionUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const interaction = await noodle.getInteractionById(interactionId);
    if (!interaction || interaction.postId !== postId)
      return reply.code(404).send({ error: "Slurp comment not found" });
    if (interaction.type !== "reply") return reply.code(403).send({ error: "Only comments can be edited." });
    const identity = await resolveViewerIdentity(parsed.data.personaId);
    if (!identity?.actor) return reply.code(404).send({ error: "Slurp viewer profile not found" });
    const actor = await noodle.getNoodlerAccountById(interaction.actorAccountId);
    const canManage =
      interaction.actorAccountId === identity.actor.id ||
      creatorBelongsToViewer(actor, identity.viewer) ||
      (actor?.kind === "character" && actor.sourceKind === "character");
    if (!canManage) return reply.code(403).send({ error: "You can only edit comments owned by this persona." });
    const content = parsed.data.content === undefined ? interaction.content : parsed.data.content?.trim() || null;
    const imageUrl = parsed.data.imageUrl === undefined ? interaction.imageUrl : parsed.data.imageUrl?.trim() || null;
    if (!content && !imageUrl) return reply.code(400).send({ error: "Comments need text or an image." });
    const updated = await noodle.updateInteraction(interactionId, { content, imageUrl });
    if (!updated) return reply.code(404).send({ error: "Slurp comment not found" });
    return updated;
  });
  app.delete("/slurp/posts/:postId/interactions/:interactionId", async (req, reply) => {
    const { postId, interactionId } = req.params as { postId: string; interactionId: string };
    const parsed = slpCreatorViewerPersonaSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const interaction = await noodle.getInteractionById(interactionId);
    if (!interaction || interaction.postId !== postId)
      return reply.code(404).send({ error: "Slurp comment not found" });
    if (interaction.type !== "reply") return reply.code(403).send({ error: "Only comments can be deleted." });
    const identity = await resolveViewerIdentity(parsed.data.personaId);
    if (!identity?.actor) return reply.code(404).send({ error: "Slurp viewer profile not found" });
    const actor = await noodle.getNoodlerAccountById(interaction.actorAccountId);
    const canManage =
      interaction.actorAccountId === identity.actor.id ||
      creatorBelongsToViewer(actor, identity.viewer) ||
      (actor?.kind === "character" && actor.sourceKind === "character");
    if (!canManage) return reply.code(403).send({ error: "You can only delete comments owned by this persona." });
    const deleted = await noodle.deleteInteractionById(interactionId);
    if (deleted.length === 0) return reply.code(404).send({ error: "Slurp comment not found" });
    return deleted;
  });
  // NoodleR posts are stage-profile posts the user fully owns, so edit/delete route
  // through the NoodleR-only storage methods (getNoodlerPostById) rather than the Noodle
  // /posts endpoints, which reject any post whose author is not a Noodle account.
  app.patch("/slurp/posts/:id", async (req, reply) => {
    const body = requestRecord(req.body);
    const accountId = typeof body?.accountId === "string" ? body.accountId : null;
    if (!accountId) return reply.code(400).send({ error: "accountId is required" });
    const { accountId: _accountId, ...updateBody } = body;
    const parsed = slpCreatorPostUpdateSchema.safeParse(updateBody);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const existing = await noodle.getNoodlerPostById(id, true);
    if (!existing) return reply.code(404).send({ error: "Slurp post not found" });
    if (existing.authorAccountId !== accountId) return reply.code(403).send({ error: "Forbidden" });
    const nextContent = parsed.data.content === undefined ? existing.content : parsed.data.content;
    const nextPoll =
      parsed.data.poll === undefined
        ? readSlpPollFromMetadata(existing.metadata)
        : parsed.data.poll
          ? createSlpPoll(parsed.data.poll)
          : null;
    const nextHasImage = parsed.data.removeImage ? false : Boolean(existing.imageUrl);
    if (!nextContent.trim() && !nextPoll && !nextHasImage) {
      return reply.code(400).send({ error: "Posts need a body, image, or poll." });
    }
    // The media path has to be re-read under the lock: the pre-lock `existing` snapshot can
    // name a file a concurrent write already replaced, and unlinking that deletes live bytes.
    const locked = await tryCreatorAccountOperation(existing.authorAccountId, async () => {
      const current = parsed.data.removeImage ? await noodle.getNoodlerPostById(id) : null;
      const updated = await noodle.updateNoodlerPost(id, parsed.data);
      return updated
        ? {
            updated,
            staleMedia: current ? readCreatorMediaPath(current) : null,
          }
        : null;
    });
    if (!locked.acquired) {
      return reply.code(409).send({
        error: "Another operation for this Slurp account is already running.",
      });
    }
    if (!locked.value) return reply.code(404).send({ error: "Slurp post not found" });
    if (parsed.data.removeImage) unlinkCreatorMedia(locked.value.staleMedia);
    return locked.value.updated;
  });
  app.post("/slurp/posts", async (req, reply) => {
    let decoded: DecodedCreatorMediaRequest<
      z.output<typeof slurpCreatorPostCreateWithMediaSchema> | z.output<typeof slurpCreatorPostCreateSchema>
    >;
    try {
      decoded = await decodeCreatorMediaRequest(req, {
        withMedia: slurpCreatorPostCreateWithMediaSchema,
        withoutMedia: slurpCreatorPostCreateSchema,
      });
    } catch (error) {
      return sendCreatorMediaError(reply, error);
    }
    if (!decoded.success) return reply.code(400).send({ error: decoded.error.flatten() });
    if (decoded.data.postType === "story" && !decoded.media) {
      return reply.code(400).send({ error: "Stories need an image." });
    }
    if (decoded.data.postType === "story" && decoded.data.poll) {
      return reply.code(400).send({ error: "Stories cannot contain polls." });
    }
    if (decoded.data.linkedPostId) {
      if (decoded.data.postType !== "story") {
        return reply.code(400).send({ error: "Only Stories can link to a Post." });
      }
      const linkedPost = await noodle.getNoodlerPostById(decoded.data.linkedPostId);
      if (!linkedPost || linkedPost.authorAccountId !== decoded.data.targetAccountId) {
        return reply.code(400).send({ error: "The linked Post must belong to this Creator." });
      }
    }
    const result = await createCreatorPost(app.db, decoded.data, decoded.media);
    if (result.status === "created") return reply.code(201).send(result.post);
    if (result.status === "busy") {
      return reply.code(409).send({
        error: "Another operation for this Slurp account is already running.",
      });
    }
    if (result.status === "disabled") return reply.code(404).send({ error: "Not Found" });
    return reply.code(404).send({ error: "Slurp stage profile not found" });
  });
  app.post("/slurp/posts/:id/media", async (req, reply) => {
    const { id } = req.params as { id: string };
    let multipart: Awaited<ReturnType<typeof readCreatorMultipart>>;
    try {
      multipart = await readCreatorMultipart(req);
    } catch (error) {
      return sendCreatorMediaError(reply, error);
    }
    const payload = requestRecord(multipart.payload);
    const accountId = typeof payload?.accountId === "string" ? payload.accountId : null;
    if (!accountId) return reply.code(400).send({ error: "accountId is required" });
    const { accountId: _accountId, ...updatePayload } = payload;
    const parsed = slpCreatorPostUpdateSchema.safeParse(updatePayload);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (parsed.data.removeImage) {
      return reply.code(400).send({ error: "A replacement image cannot also remove the image." });
    }
    const result = await updateCreatorPostWithMedia(app.db, id, accountId, parsed.data, multipart.media);
    if (result.status === "updated") return result.post;
    if (result.status === "busy") {
      return reply.code(409).send({
        error: "Another operation for this Slurp account is already running.",
      });
    }
    if (result.status === "disabled") return reply.code(404).send({ error: "Not Found" });
    if (result.status === "forbidden") return reply.code(403).send({ error: "Forbidden" });
    return reply.code(404).send({ error: "Slurp post not found" });
  });
  app.post("/slurp/posts/:id/image/generate", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = z
      .object({
        accountId: z.string().min(1),
        // A failed picture is usually a bad prompt, so the retry may carry a rewritten one.
        imagePrompt: z.string().trim().min(1).max(2000).optional(),
        // Redraw a post that already has a picture; the old one comes back if the redraw fails.
        replace: z.boolean().optional(),
        debugMode: z.boolean().optional(),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const post = await noodle.getNoodlerPostById(id);
    if (!post) return reply.code(404).send({ error: "Slurp post not found" });
    if (post.authorAccountId !== parsed.data.accountId) return reply.code(403).send({ error: "Forbidden" });
    if (post.imageUrl && parsed.data.replace !== true) {
      return reply.code(409).send({ error: "This post already has an image." });
    }
    const previousImageUrl = post.imageUrl;
    const account = await noodle.getNoodlerAccountById(post.authorAccountId);
    const imagePrompt =
      parsed.data.imagePrompt ||
      post.imagePrompt?.trim() ||
      [post.title, post.content]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join("\n")
        .trim() ||
      `A new social media image for ${account?.displayName || "the creator"}.`;
    if (imagePrompt !== post.imagePrompt || previousImageUrl) {
      await noodle.updatePostMedia(post.id, { imagePrompt, ...(previousImageUrl ? { imageUrl: null } : {}) });
    }
    const result = await slpCreatorImages.generateReviewedImages({
      prompts: [{ id: post.id, prompt: imagePrompt }],
      debugMode: parsed.data.debugMode === true,
      retryStoredPrompt: true,
    });
    const updated = await noodle.getNoodlerPostById(id);
    if (result.ok && updated?.imageUrl) return updated;
    // The old picture was cleared only so the redraw could claim the post; a failed redraw gives it back.
    // It never clears a claim: another request that now owns the redraw keeps it.
    if (previousImageUrl && updated && !updated.imageUrl) {
      await noodle.restorePostImageIfUnclaimed(post.id, previousImageUrl);
    }
    if (!result.ok) return reply.code(400).send({ error: result.message });
    if (updated?.updatedAt !== post.updatedAt && updated?.metadata.imageGenerationFailed === true) {
      return reply.code(502).send({ error: "Image generation failed. Try again later." });
    }
    return reply.code(409).send({ error: "This image is already being generated." });
  });
  app.delete("/slurp/posts/:id", async (req, reply) => {
    const accountId =
      typeof (req.query as { accountId?: unknown })?.accountId === "string"
        ? (req.query as { accountId: string }).accountId
        : null;
    if (!accountId) {
      return reply.code(400).send({ error: "accountId is required" });
    }
    const { id } = req.params as { id: string };
    const existing = await noodle.getNoodlerPostById(id);
    if (!existing) return reply.code(404).send({ error: "Slurp post not found" });
    if (existing.authorAccountId !== accountId) return reply.code(403).send({ error: "Forbidden" });
    const locked = await tryCreatorAccountOperation(existing.authorAccountId, () => noodle.softDeleteNoodlerPost(id));
    if (!locked.acquired) {
      return reply.code(409).send({
        error: "Another operation for this Slurp account is already running.",
      });
    }
    if (!locked.value) return reply.code(404).send({ error: "Slurp post not found" });
    return locked.value;
  });
  app.post("/slurp/posts/:id/restore", async (req, reply) => {
    const body = (req.body ?? {}) as { accountId?: unknown };
    const accountId = typeof body.accountId === "string" ? body.accountId : null;
    if (!accountId) return reply.code(400).send({ error: "accountId is required" });
    const { id } = req.params as { id: string };
    const existing = await noodle.getNoodlerPostById(id, true);
    if (!existing || existing.authorAccountId !== accountId)
      return reply.code(404).send({ error: "Slurp post not found" });
    const restored = await tryCreatorAccountOperation(accountId, () => noodle.restoreNoodlerPost(id));
    if (!restored.acquired)
      return reply.code(409).send({ error: "Another operation for this Slurp account is already running." });
    if (!restored.value) return reply.code(409).send({ error: "This post can no longer be restored." });
    return restored.value;
  });
  /**
   * Draft one post for a directly invited character, optionally steered by the user's guidance.
   *
   * Restored with the ambient reroll above: the split kept the service and dropped the route.
   */
  app.post("/accounts/:id/post-draft", async (req, reply) => {
    const body = z
      .object({
        guidance: z.string().trim().max(20_000).optional(),
        connectionId: z.string().trim().min(1).optional(),
        debugMode: z.boolean().optional(),
      })
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const { id } = req.params as { id: string };
    const account = await noodle.getAccountById(id);
    if (!isDirectlyInvitedSlpCharacter(account)) {
      return reply.code(403).send({ error: "Only directly invited characters can generate post drafts." });
    }
    const settings = await noodle.getSettings();
    const connection = await resolveSlurpTextConnection(
      connections,
      body.data.connectionId ?? settings.generationConnectionId,
    );
    if (!connection) return reply.code(400).send({ error: "Select a Slurp generation connection first." });
    try {
      const prompts = slurpPromptContext(settings);
      return await generateInvitedSlpPostDraft(app.db, account!, connection, {
        ...body.data,
        promptBlocks: prompts.blocks,
        promptInstructions: prompts.instructions,
      });
    } catch (error) {
      if (isConnectionAdmissionFailure(error)) return reply.code(409).send({ error: getErrorMessage(error) });
      logger.error(error, "[slurp] Invited post draft generation failed");
      return reply.code(500).send({ error: getErrorMessage(error) });
    }
  });
}
