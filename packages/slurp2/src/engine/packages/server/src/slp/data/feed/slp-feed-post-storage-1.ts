import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, ne, or } from "../../../db/file-query.js";
import { SlpCreatorManagedPost, SlpPost } from "../../../../../shared/src/slp/slp-social.types.js";
import { logger } from "../../../lib/logger.js";
import { slpInteractions, slpPosts } from "../../../db/schema/slurp.js";
import { newId, now } from "../../../utils/id-generator.js";
import {
  slpCreatorPostImageRetryAttempts,
  SLP_CREATOR_POST_IMAGE_RETRY_LIMIT,
} from "../../base/media/slp-image-retry.js";
import {
  addSlurpModifier,
  SLURP_ENERGY_COST,
  SLURP_EXPOSURE_PER_POST,
} from "../../modules/creators/slp-creator-state.js";
import { normalizeCreatorSeenAt } from "../../modules/feed/slp-viewer-unseen.js";
import { compareCreatorPostSortKeysDescending, isCreatorPostAfterCursor } from "../../modules/feed/slp-post-page.js";
import { IMAGE_RETRY_SCAN_LIMIT } from "../host/slp-storage-constants.js";
import { parseRecord } from "../../modules/records/slp-storage-model.js";
import { slpCreatorPostPageCondition } from "../host/slp-storage-queries.js";
import type {
  SlpCreatorPostPageOptions,
  SlpCreatorPostPersistenceInput,
  SlpCreatorStoryQueryOptions,
} from "../../modules/records/slp-storage-model.js";
import { snapshotForAccount, mapPost, mapManagedPost, imageClaimIsAvailable } from "../host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../host/slp-storage-context.js";

export function createFeedPostStorage1(context: SlurpStorageContext) {
  const {
    db,
    settingsStore,
    characters,
    readProjectEntries,
    isProjectEntry,
    loadProjects,
    writeProjects,
    readCreatorPrices,
    economyFrom,
    compensate,
    writeWallet,
    restoreSetting,
    restoreWallet,
    enqueueFinancial,
    writeEarnings,
    mutateCreatorStateNow,
    creditEarningsNow,
    getWalletNow,
    pruneFinishedRefreshRuns,
    reconcilePublicHandles,
    insertInteraction,
    normalizeLegacyNoodlerToggleInteraction,
    upsertPollVote,
    deleteInteractionChildren,
    deleteStoredInteraction,
  } = context;
  const storage = {
    async listPosts(options: { limit?: number; since?: string } = {}): Promise<SlpPost[]> {
      const limit = Math.max(1, Math.min(300, Math.floor(options.limit ?? 120)));
      const slurpSourceAccountIds = (await this.listAccounts()).map((account) => account.id);
      if (slurpSourceAccountIds.length === 0) return [];
      const rows = options.since
        ? await db
            .select()
            .from(slpPosts)
            .where(and(gt(slpPosts.createdAt, options.since), inArray(slpPosts.authorAccountId, slurpSourceAccountIds)))
            .orderBy(desc(slpPosts.createdAt))
            .limit(limit)
        : await db
            .select()
            .from(slpPosts)
            .where(inArray(slpPosts.authorAccountId, slurpSourceAccountIds))
            .orderBy(desc(slpPosts.createdAt))
            .limit(limit);
      return rows.map((row) => mapPost(row));
    },
    async listPostsBefore(before: string): Promise<SlpPost[]> {
      const slurpSourceAccountIds = (await this.listAccounts()).map((account) => account.id);
      if (slurpSourceAccountIds.length === 0) return [];
      const rows = await db
        .select()
        .from(slpPosts)
        .where(and(lt(slpPosts.createdAt, before), inArray(slpPosts.authorAccountId, slurpSourceAccountIds)))
        .orderBy(desc(slpPosts.createdAt));
      return rows.map((row) => mapPost(row));
    },
    async listNoodlerPostsByAccount(accountId: string, limit = 8): Promise<SlpCreatorManagedPost[]> {
      const account = await this.getNoodlerAccountById(accountId);
      if (!account) return [];
      const rows = await db
        .select()
        .from(slpPosts)
        .where(eq(slpPosts.authorAccountId, accountId))
        .orderBy(desc(slpPosts.createdAt))
        .limit(Math.max(1, Math.min(50, Math.floor(limit))));
      return rows.map(mapManagedPost);
    },
    /**
     * Slurp creator posts that published without their picture and still have a prompt to draw
     * from. The pending-review marker is excluded: those wait for the user, not for a retry.
     */
    async listNoodlerPostsAwaitingImageRetry(limit = 1, at = now()): Promise<SlpCreatorManagedPost[]> {
      const accountIds = new Set((await this.listNoodlerAccounts()).map((account) => account.id));
      if (accountIds.size === 0) return [];
      // Bounded: the metadata filters below live in a JSON column, so they cannot be pushed into
      // the query, and posts awaiting the user's prompt review keep a null imageUrl indefinitely —
      // an unbounded scan would grow without limit on a once-a-minute poll.
      // ponytail: newest page only; page through older rows if a long-idle post must self-heal.
      const rows = await db
        .select()
        .from(slpPosts)
        .where(and(isNull(slpPosts.imageUrl), isNotNull(slpPosts.imagePrompt)))
        .orderBy(desc(slpPosts.createdAt))
        .limit(IMAGE_RETRY_SCAN_LIMIT);
      const eligible: SlpCreatorManagedPost[] = [];
      for (const row of rows) {
        if (!accountIds.has(row.authorAccountId) || !imageClaimIsAvailable(row, at)) continue;
        const metadata = parseRecord(row.metadata);
        if (metadata.imagePendingReview === true || metadata.imageGenerationFailed !== true) continue;
        if (slpCreatorPostImageRetryAttempts(metadata) >= SLP_CREATOR_POST_IMAGE_RETRY_LIMIT) continue;
        eligible.push(mapManagedPost(row));
        if (eligible.length >= Math.max(1, Math.floor(limit))) break;
      }
      return eligible;
    },
    // Unbounded — used by the disclosure-downgrade review, which must inspect every
    // published post (the clamped list above would undercount and let old
    // identifying posts slip through a privacy downgrade).
    async listAllNoodlerPostsByAccount(accountId: string): Promise<SlpCreatorManagedPost[]> {
      const account = await this.getNoodlerAccountById(accountId);
      if (!account) return [];
      const rows = await db
        .select()
        .from(slpPosts)
        .where(eq(slpPosts.authorAccountId, accountId))
        .orderBy(desc(slpPosts.createdAt));
      return rows.map(mapManagedPost);
    },
    /**
     * The newest post the audience can actually see, which is what "is this Creator active right
     * now" means. Drafts are excluded in the query, not by the caller: filtering a `limit 1` result
     * afterwards returns nothing when the newest post happens to be a draft, which reads as a
     * Creator who has never posted.
     */
    async getNoodlerLatestPublishedPost(accountId: string): Promise<SlpCreatorManagedPost | null> {
      const rows = await db
        .select()
        .from(slpPosts)
        .where(and(eq(slpPosts.authorAccountId, accountId), ne(slpPosts.access, "draft")))
        .orderBy(desc(slpPosts.createdAt))
        .limit(1);
      return rows[0] ? mapManagedPost(rows[0]) : null;
    },
    async listNoodlerPostsByAccounts(
      accountIds: string[],
      limit = 8,
      /**
       * `since` keeps only posts created after that ISO time. `maxRows` caps the newest posts read
       * across all accounts, in the query rather than after it.
       */
      options: { since?: string; maxRows?: number } = {},
    ): Promise<Map<string, SlpCreatorManagedPost[]>> {
      const boundedLimit = Math.max(1, Math.min(50, Math.floor(limit)));
      const result = new Map<string, SlpCreatorManagedPost[]>();
      if (accountIds.length === 0) return result;
      const byAuthor = inArray(slpPosts.authorAccountId, accountIds);
      const withSince = options.since ? and(byAuthor, gt(slpPosts.createdAt, options.since)) : byAuthor;
      // A capped read skips drafts in the query, so the cap counts only posts that can be returned.
      const query = db
        .select()
        .from(slpPosts)
        .where(options.maxRows ? and(withSince, ne(slpPosts.access, "draft")) : withSince)
        .orderBy(desc(slpPosts.createdAt));
      const rows = options.maxRows ? await query.limit(options.maxRows) : await query;
      for (const row of rows) {
        if (row.access === "draft") continue;
        const post = mapManagedPost(row);
        const existing = result.get(post.authorAccountId);
        if (existing) {
          if (existing.length < boundedLimit) existing.push(post);
        } else {
          result.set(post.authorAccountId, [post]);
        }
      }
      return result;
    },
    async listNoodlerStories(options: SlpCreatorStoryQueryOptions): Promise<SlpCreatorManagedPost[]> {
      if (options.accountIds.length === 0) return [];
      const search = options.search?.trim().toLowerCase() ?? "";
      const creatorMatches = new Set(options.creatorSearchAccountIds ?? []);
      const stories: SlpCreatorManagedPost[] = [];
      const batchSize = 200;
      let cursor: { createdAt: string; id: string } | null = null;
      while (true) {
        const rows = await db
          .select()
          .from(slpPosts)
          .where(
            and(
              inArray(slpPosts.authorAccountId, options.accountIds),
              gt(slpPosts.createdAt, options.since),
              ne(slpPosts.access, "draft"),
              cursor
                ? or(
                    lt(slpPosts.createdAt, cursor.createdAt),
                    and(eq(slpPosts.createdAt, cursor.createdAt), lt(slpPosts.id, cursor.id)),
                  )
                : undefined,
            ),
          )
          .orderBy(desc(slpPosts.createdAt), desc(slpPosts.id))
          .limit(batchSize);
        const posts = rows.map(mapManagedPost);
        stories.push(
          ...posts
            .filter((post) => post.metadata.noodlerPostType === "story")
            .filter((post) => {
              if (!search) return true;
              return (
                creatorMatches.has(post.authorAccountId) ||
                (post.title ?? "").toLowerCase().includes(search) ||
                post.content.toLowerCase().includes(search)
              );
            }),
        );
        const last = rows.at(-1);
        if (!last || rows.length < batchSize) break;
        cursor = { createdAt: last.createdAt, id: last.id };
      }
      return stories;
    },
    async listNoodlerPostPage(options: SlpCreatorPostPageOptions) {
      const limit = Math.max(1, Math.min(20, Math.floor(options.limit)));
      if (options.accountIds.length === 0) {
        return { items: [], total: 0, nextCursor: null };
      }
      const search = options.search?.trim().toLowerCase() ?? "";
      if (search) {
        const creatorMatches = new Set(options.creatorSearchAccountIds ?? []);
        const readableAccounts = new Set(options.readableContentAccountIds ?? []);
        const unlockedPosts = new Set(options.unlockedPostIds ?? []);
        const matchingRows = (
          await db
            .select()
            .from(slpPosts)
            .where(slpCreatorPostPageCondition(options, false))
            .orderBy(desc(slpPosts.createdAt), desc(slpPosts.id))
        ).filter((row) => {
          const readable =
            row.access === "public" || readableAccounts.has(row.authorAccountId) || unlockedPosts.has(row.id);
          return (
            creatorMatches.has(row.authorAccountId) ||
            (row.title ?? "").toLowerCase().includes(search) ||
            (readable && row.content.toLowerCase().includes(search))
          );
        });
        const cursorRows = options.cursor
          ? matchingRows.filter((row) => isCreatorPostAfterCursor(row, options.cursor!))
          : matchingRows;
        const pageRows = cursorRows.slice(0, limit);
        const last = pageRows.at(-1);
        return {
          items: pageRows.map(mapManagedPost),
          total: matchingRows.length,
          nextCursor: cursorRows.length > limit && last ? { createdAt: last.createdAt, id: last.id } : null,
        };
      }
      const total = db.count(slpPosts, slpCreatorPostPageCondition(options, false));
      const rows = await db
        .select()
        .from(slpPosts)
        .where(slpCreatorPostPageCondition(options, true))
        .orderBy(desc(slpPosts.createdAt), desc(slpPosts.id))
        .limit(limit + 1);
      const pageRows = rows.slice(0, limit);
      const last = pageRows.at(-1);
      return {
        items: pageRows.map(mapManagedPost),
        total,
        nextCursor: rows.length > limit && last ? { createdAt: last.createdAt, id: last.id } : null,
      };
    },
    async getNoodlerViewerSignal(
      visibleAccountIds: string[],
      unseenAccountIds: string[],
      seenAt: string | null | undefined,
    ) {
      const unseen = new Set(unseenAccountIds);
      const normalizedSeenAt = normalizeCreatorSeenAt(seenAt);
      if (visibleAccountIds.length === 0) {
        return {
          count: 0,
          latestPost: null,
          latestPostId: null,
          latestPostAccountId: null,
          latestPostUpdate: null,
          updatedPostId: null,
          updatedPostAccountId: null,
          latestInteraction: null,
          interactionPostId: null,
        };
      }
      const posts = await db
        .select({
          id: slpPosts.id,
          authorAccountId: slpPosts.authorAccountId,
          createdAt: slpPosts.createdAt,
          updatedAt: slpPosts.updatedAt,
        })
        .from(slpPosts)
        .where(and(inArray(slpPosts.authorAccountId, visibleAccountIds), ne(slpPosts.access, "draft")));
      const latestPost = [...posts].sort(compareCreatorPostSortKeysDescending)[0];
      const latestUpdate = [...posts].sort((left, right) =>
        compareCreatorPostSortKeysDescending(
          { createdAt: left.updatedAt, id: left.id },
          { createdAt: right.updatedAt, id: right.id },
        ),
      )[0];
      const latestInteractionRows = await db
        .select({
          id: slpInteractions.id,
          postId: slpInteractions.postId,
          createdAt: slpInteractions.createdAt,
        })
        .from(slpInteractions)
        .where(
          inArray(
            slpInteractions.postId,
            posts.map((row) => row.id),
          ),
        )
        .orderBy(desc(slpInteractions.createdAt), desc(slpInteractions.id))
        .limit(1);
      const latestInteraction = latestInteractionRows[0];
      return {
        count: normalizedSeenAt
          ? posts.filter((row) => unseen.has(row.authorAccountId) && row.createdAt > normalizedSeenAt).length
          : 0,
        latestPost: latestPost ? `${latestPost.createdAt}:${latestPost.id}` : null,
        latestPostId: latestPost?.id ?? null,
        latestPostAccountId: latestPost?.authorAccountId ?? null,
        latestPostUpdate: latestUpdate ? `${latestUpdate.updatedAt}:${latestUpdate.id}` : null,
        updatedPostId: latestUpdate?.id ?? null,
        updatedPostAccountId: latestUpdate?.authorAccountId ?? null,
        latestInteraction: latestInteraction ? `${latestInteraction.createdAt}:${latestInteraction.id}` : null,
        interactionPostId: latestInteraction?.postId ?? null,
      };
    },
    /**
     * How many posts this Creator has made, ever.
     *
     * Used as the rotation index for the post variation, so consecutive posts land on different angles.
     * Counting rather than sampling matters: a random draw can repeat, and repetition is the whole
     * failure being fixed.
     */
    async countNoodlerPostsByAccount(accountId: string): Promise<number> {
      const rows = await db.select().from(slpPosts).where(eq(slpPosts.authorAccountId, accountId));
      return rows.length;
    },
    countNoodlerPostsByAccountsSince(accountIds: string[], since: string): number {
      if (accountIds.length === 0) return 0;
      return db.count(slpPosts, and(inArray(slpPosts.authorAccountId, accountIds), gt(slpPosts.createdAt, since)));
    },
    async getNoodlerPostById(id: string, includeDeleted = false): Promise<SlpCreatorManagedPost | null> {
      const rows = await db.select().from(slpPosts).where(eq(slpPosts.id, id));
      const row = rows[0];
      if (!row || !(await this.getNoodlerAccountById(row.authorAccountId))) return null;
      if (!includeDeleted && parseRecord(row.metadata).slurpDeletedAt) return null;
      return mapManagedPost(row);
    },
    async getNoodlerPostByWizardExecution(
      accountId: string,
      executionId: string,
    ): Promise<SlpCreatorManagedPost | null> {
      const account = await this.getNoodlerAccountById(accountId);
      if (!account) return null;
      const rows = await db.select().from(slpPosts).where(eq(slpPosts.authorAccountId, accountId));
      const row = rows.find((candidate) => parseRecord(candidate.metadata).noodlerWizardExecutionId === executionId);
      return row ? mapManagedPost(row) : null;
    },
    async createNoodlerPost(input: SlpCreatorPostPersistenceInput): Promise<SlpCreatorManagedPost | null> {
      const posts = await this.createNoodlerPosts([input]);
      return posts?.[0] ?? null;
    },
    // One transaction for the whole batch: a post and its linked follow-up are
    // either both stored or neither is, with no compensating delete to get wrong.
    async createNoodlerPosts(inputs: SlpCreatorPostPersistenceInput[]): Promise<SlpCreatorManagedPost[] | null> {
      const accounts = await Promise.all(inputs.map((input) => this.getNoodlerAccountById(input.authorAccountId)));
      if (accounts.some((account) => !account)) return null;
      const timestamp = now();
      const rows = inputs.map((input, index) => ({
        id: input.id ?? newId(),
        authorAccountId: input.authorAccountId,
        title: input.title?.trim() || null,
        content: input.content,
        imageUrl: input.imageUrl ?? null,
        imagePrompt: input.imagePrompt ?? null,
        parentPostId: null,
        quotePostId: null,
        source: input.source ?? "manual",
        projectId: input.projectId ?? null,
        projectChapter: input.projectChapter ?? null,
        access: input.access ?? "public",
        metadata: JSON.stringify(input.metadata ?? {}),
        authorSnapshot: JSON.stringify(snapshotForAccount(accounts[index]!)),
        createdAt: timestamp,
        updatedAt: timestamp,
      }));
      const created = await db.transaction(async (tx) => {
        for (const row of rows) await tx.insert(slpPosts).values(row);
        const stored = await tx
          .select()
          .from(slpPosts)
          .where(
            inArray(
              slpPosts.id,
              rows.map((row) => row.id),
            ),
          );
        const byId = new Map(stored.map((row) => [row.id, mapManagedPost(row)]));
        const managed = rows.map((row) => byId.get(row.id));
        return managed.every((post) => post) ? (managed as SlpCreatorManagedPost[]) : null;
      });
      // Outside the transaction and never able to fail it: a post that is already stored must not
      // be reported as an error because a settings write for a mood number did not land.
      if (created) {
        for (const post of created) {
          try {
            await this.adjustCreatorState(post.authorAccountId, {
              energy: -SLURP_ENERGY_COST.post,
              exposure: post.access === "locked" ? SLURP_EXPOSURE_PER_POST.locked : SLURP_EXPOSURE_PER_POST.public,
            });
            await mutateCreatorStateNow(post.authorAccountId, (state) =>
              addSlurpModifier(state, "just_posted", post.id),
            );
          } catch (error) {
            logger.warn(error, "[slurp] Could not record the cost of a post for %s", post.authorAccountId);
          }
        }
      }
      return created;
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
