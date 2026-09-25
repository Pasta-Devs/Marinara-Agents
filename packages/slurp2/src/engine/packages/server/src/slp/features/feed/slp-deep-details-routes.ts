import type { FastifyInstance } from "fastify";
import { eq } from "../../../db/file-query.js";
import { slpInteractions, slpPostUnlocks, slurpContentOpportunities } from "../../../db/schema/slurp.js";
import type { SlpDeepDetailsResponse } from "../../../../../shared/src/slp/slp-deep-details.js";
import { getSlurpPostDeepDetails } from "../../data/feed/slp-post-deep-details-storage.js";
import { listSlurpContinuityLinks } from "../../data/continuity/slp-continuity-storage.js";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";

/**
 * Everything behind one post, for its Creator's Deep details view: the recorded prompt and draws,
 * the plan row it closed, the links it takes part in, and how it has done since.
 *
 * Managed-only, like the other post management routes: the record holds the full prompt, source
 * card and continuity notes included, and never reaches a viewer projection.
 */
export async function slpDeepDetailsRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { noodle } = deps;
  app.get("/slurp/posts/:id/deep-details", async (req, reply) => {
    const { id } = req.params as { id: string };
    const post = await noodle.getNoodlerPostById(id);
    const creator = post ? await noodle.getNoodlerAccountById(post.authorAccountId) : null;
    if (!post || !creator) return reply.code(404).send({ error: "Not Found" });
    const detailsId = typeof post.metadata.deepDetailsId === "string" ? post.metadata.deepDetailsId : null;
    const [details, plans, links, interactions, unlocks] = await Promise.all([
      detailsId ? getSlurpPostDeepDetails(app.db, detailsId) : Promise.resolve(null),
      app.db.select().from(slurpContentOpportunities).where(eq(slurpContentOpportunities.postId, id)),
      listSlurpContinuityLinks(app.db, creator.id),
      app.db.select().from(slpInteractions).where(eq(slpInteractions.postId, id)),
      app.db.select().from(slpPostUnlocks).where(eq(slpPostUnlocks.postId, id)),
    ]);
    const plan = plans[0];
    const text = (value: unknown) => (typeof value === "string" && value ? value : null);
    const response: SlpDeepDetailsResponse = {
      post: {
        id: post.id,
        title: post.title ?? null,
        content: post.content,
        access: post.access,
        source: post.source,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        imageUrl: post.imageUrl,
        imagePrompt: post.imagePrompt,
        images: post.images.map((image) => ({
          position: image.position,
          imageUrl: image.imageUrl,
          imagePrompt: image.imagePrompt,
        })),
        metadata: post.metadata,
      },
      creator: { id: creator.id, displayName: creator.displayName, handle: creator.handle },
      details,
      plan: plan
        ? {
            id: String(plan.id),
            workflow: String(plan.workflow),
            plannedAt: String(plan.plannedAt),
            dueAt: text(plan.dueAt),
            completedAt: text(plan.completedAt),
            sourceEventId: text(plan.sourceEventId),
            slotId: text(plan.slotId),
            topic: text(plan.topic),
          }
        : null,
      links: links
        .filter(
          (link) =>
            link.fromId === id || link.toId === id || (plan && [link.fromId, link.toId].includes(String(plan.id))),
        )
        .map(({ fromType, fromId, toType, toId, relation }) => ({ fromType, fromId, toType, toId, relation })),
      stats: {
        likes: interactions.filter((row) => row.type === "like").length,
        replies: interactions.filter((row) => row.type === "reply").length,
        unlocks: unlocks.length,
      },
    };
    return response;
  });
}
