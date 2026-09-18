import { noodlerViewerPersonaSchema } from "@marinara-engine/shared";
import { z } from "zod";
import { noodlerUnseenCreatorAccountIds } from "../../../services/slurp/slurp-viewer-unseen.js";
import { isSlurpViewerActorAccount } from "../../../services/storage/slurp.storage.js";
import { isNoodlerHiddenFromViewer } from "../../../services/slurp/slurp-access.js";
import type { FastifyInstance } from "fastify";
import {
  NOODLER_FEED_PAGE_SIZE,
  noodlerPageCursorSchema,
  type NoodlerViewerSignalResponse,
} from "../../base/host/slp-request-schemas.js";
import type { SlpRouteDeps } from "../../base/host/slp-viewer-context.js";

const noodlerViewerFeedQuerySchema = noodlerViewerPersonaSchema
  .extend({
    tab: z.enum(["following", "all"]).default("all"),
    search: z.string().trim().max(200).default(""),
    limit: z.coerce.number().int().min(1).max(NOODLER_FEED_PAGE_SIZE).default(NOODLER_FEED_PAGE_SIZE),
    cursorAt: z.string().datetime().optional(),
    cursorId: z.string().trim().min(1).max(200).optional(),
  })
  .refine(
    (value) => Boolean(value.cursorAt) === Boolean(value.cursorId),
    "cursorAt and cursorId must be provided together",
  );

const noodlerProfilePostsQuerySchema = noodlerPageCursorSchema.and(
  z.object({
    personaId: z.string().trim().min(1).optional(),
    filter: z.enum(["posts", "media"]).default("posts"),
    limit: z.coerce.number().int().min(1).max(NOODLER_FEED_PAGE_SIZE).default(NOODLER_FEED_PAGE_SIZE),
  }),
);
export async function slpFeedViewerRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const {
    buildViewerContext,
    buildViewerShell,
    creatorBelongsToViewer,
    noodle,
    noodlerViewerSignalCache,
    projectViewerPosts,
    resolveViewerPersona,
  } = deps;
  app.get("/noodler/viewer/unseen-count", async (req, reply) => {
    const parsed = noodlerViewerPersonaSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const accounts = await noodle.listNoodlerAccounts();
    const unseenCreatorAccountIds = noodlerUnseenCreatorAccountIds(accounts, viewer.id);
    const visibleAccounts = accounts.filter(
      (account) =>
        !isSlurpViewerActorAccount(account) &&
        (creatorBelongsToViewer(account, viewer) || !isNoodlerHiddenFromViewer(account, viewer.id)),
    );
    const visibleAccountIds = visibleAccounts.map((account) => account.id);
    const generationKey = [
      app.db._fileStore.getTableWriteGeneration("slurp2_posts"),
      app.db._fileStore.getTableWriteGeneration("slurp2_interactions"),
      app.db._fileStore.getTableWriteGeneration("slurp2_accounts"),
      viewer.settings.social.noodlerFeedSeenAt ?? "never",
      [...visibleAccountIds].sort().join(","),
      [...unseenCreatorAccountIds].sort().join(","),
    ].join("|");
    const cached = noodlerViewerSignalCache.get(viewer.id);
    if (cached?.generationKey === generationKey) return cached.value;
    const signal = await noodle.getNoodlerViewerSignal(
      visibleAccountIds,
      unseenCreatorAccountIds,
      viewer.settings.social.noodlerFeedSeenAt,
    );
    const latestCreator = visibleAccounts.sort(
      (left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id),
    )[0];
    const value: NoodlerViewerSignalResponse = {
      count: signal.count,
      revision: {
        latestPost: signal.latestPost,
        latestPostId: signal.latestPostId,
        latestPostAccountId: signal.latestPostAccountId,
        latestPostUpdate: signal.latestPostUpdate,
        updatedPostId: signal.updatedPostId,
        updatedPostAccountId: signal.updatedPostAccountId,
        latestInteraction: signal.latestInteraction,
        interactionPostId: signal.interactionPostId,
        latestCreator: latestCreator ? `${latestCreator.updatedAt}:${latestCreator.id}` : null,
      },
    };
    if (!noodlerViewerSignalCache.has(viewer.id) && noodlerViewerSignalCache.size >= 100) {
      const oldestKey = noodlerViewerSignalCache.keys().next().value;
      if (oldestKey) noodlerViewerSignalCache.delete(oldestKey);
    }
    noodlerViewerSignalCache.set(viewer.id, { generationKey, value });
    return value;
  });

  app.post("/noodler/viewer/mark-seen", async (req, reply) => {
    const parsed = noodlerViewerPersonaSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await noodle.patchViewerSettings(parsed.data.personaId, {
      subtree: "social",
      patch: { noodlerFeedSeenAt: new Date().toISOString() },
    });
    if (!viewer) return reply.code(404).send({ error: "Slurp viewer persona not found" });
    return viewer;
  });

  app.get("/noodler/viewer", async (req, reply) => {
    const parsed = noodlerViewerPersonaSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    return buildViewerShell(await buildViewerContext(viewer));
  });

  app.get("/noodler/viewer/feed", async (req, reply) => {
    const parsed = noodlerViewerFeedQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const context = await buildViewerContext(viewer);
    const accounts = context.visibleAccounts.filter(
      (account) => parsed.data.tab === "all" || context.followedIds.has(account.id),
    );
    const normalizedSearch = parsed.data.search.toLowerCase();
    const creatorSearchAccountIds = normalizedSearch
      ? accounts
          .filter((account) => {
            const profile = context.profileById.get(account.id);
            return Boolean(
              profile &&
              (profile.handle.toLowerCase().includes(normalizedSearch) ||
                profile.displayName.toLowerCase().includes(normalizedSearch)),
            );
          })
          .map((account) => account.id)
      : [];
    const page = await noodle.listNoodlerPostPage({
      accountIds: accounts.map((account) => account.id),
      creatorSearchAccountIds,
      readableContentAccountIds: accounts
        .filter((account) => creatorBelongsToViewer(account, viewer) || context.subscribedIds.has(account.id))
        .map((account) => account.id),
      unlockedPostIds: [...context.unlockedIds],
      search: parsed.data.search,
      cursor:
        parsed.data.cursorAt && parsed.data.cursorId
          ? { createdAt: parsed.data.cursorAt, id: parsed.data.cursorId }
          : null,
      limit: parsed.data.limit,
    });
    const projected = await projectViewerPosts(context, page.items);
    return {
      items: page.items.flatMap((post) => {
        const view = projected.get(post.id);
        return view ? [{ creatorAccountId: post.authorAccountId, post: view }] : [];
      }),
      total: page.total,
      nextCursor: page.nextCursor,
    };
  });

  app.get("/noodler/accounts/:id/posts", async (req, reply) => {
    const parsed = noodlerProfilePostsQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    if (!(await noodle.getNoodlerAccountById(id))) {
      return reply.code(404).send({ error: "Slurp stage profile not found" });
    }
    const viewer = parsed.data.personaId ? await resolveViewerPersona(parsed.data.personaId) : null;
    if (parsed.data.personaId && !viewer) {
      return reply.code(404).send({ error: "Slurp persona not found" });
    }
    const context = viewer ? await buildViewerContext(viewer) : null;
    const creatorVisible = Boolean(context?.accountById.has(id));
    if (context && !creatorVisible) {
      return { items: [], total: 0, nextCursor: null };
    }
    const viewerOwnsCreator = Boolean(
      context && creatorBelongsToViewer(context.accountById.get(id) ?? null, context.viewer),
    );
    const page = await noodle.listNoodlerPostPage({
      accountIds: [id],
      readableContentAccountIds:
        !context ||
        creatorBelongsToViewer(context.accountById.get(id) ?? null, context.viewer) ||
        context.subscribedIds.has(id)
          ? [id]
          : [],
      unlockedPostIds: context ? [...context.unlockedIds] : [],
      mediaOnly: parsed.data.filter === "media",
      cursor:
        parsed.data.cursorAt && parsed.data.cursorId
          ? { createdAt: parsed.data.cursorAt, id: parsed.data.cursorId }
          : null,
      limit: parsed.data.limit,
    });
    const projected = context ? await projectViewerPosts(context, page.items) : null;
    return {
      items:
        context && !viewerOwnsCreator
          ? page.items.flatMap((post) => {
              const viewerPost = projected!.get(post.id);
              return viewerPost ? [{ viewerPost }] : [];
            })
          : page.items.map((managed) => ({
              managed,
              viewerPost: projected?.get(managed.id) ?? null,
            })),
      total: page.total,
      nextCursor: page.nextCursor,
    };
  });
}
