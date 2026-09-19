import { existsSync } from "node:fs";
import { and, desc, eq, inArray } from "../../../../db/file-query.js";
import {
  noodlerPostMediaUrl,
  resolveNoodlerMediaAbsolutePath,
  unlinkNoodlerMedia,
} from "../../../base/media/slp-media.js";
import {
  noodleAccounts,
  noodlePosts,
  noodlerAutomaticAttempts,
  noodlerPreparedPosts,
} from "../../../../db/schema/slurp.js";
import { newId } from "../../../../utils/id-generator.js";
import { resolveNoodlerSourceSnapshot } from "../../creators/slp-source-resolve.js";
import { slurpCreatorPostingIntervalMs } from "../../../modules/feed/slp-posting-interval.js";
import {
  ROLLING_DAY_MS,
  elapsedPreparedSlotMs,
  TERMINAL_PREPARED_POST_RETENTION_MS,
} from "../../host/slp-storage-constants.js";
import { noodlerReservePolicyFingerprint, parseRecord } from "../../../modules/records/slp-storage-model.js";
import type { NoodlerPreparedPostPayload, SlurpReserveStatus } from "../../../modules/records/slp-storage-model.js";
import { mapAccount, snapshotForAccount } from "../../host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../../host/slp-storage-context.js";

export function createReserveStorage2(context: SlurpStorageContext) {
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
    async publishDueNoodlerPreparedPosts(at = new Date()): Promise<number> {
      const settings = await this.getSettings();
      if (!settings.autoPostingScheduleEnabled) return 0;
      const due = (await this.listNoodlerPreparedPosts()).filter(
        (item) => item.state === "prepared" && Date.parse(item.publishAt) <= at.getTime(),
      );
      if (due.length === 0) return 0;
      // One pass over posts for the whole batch: the crash-recovery lookup below only needs
      // to know which prepared items already published, not to rescan every post per item.
      const publishedPreparedIds = new Map<string, { id: string }>();
      for (const post of await db.select().from(noodlePosts)) {
        const preparedId = parseRecord(post.metadata).noodlerPreparedPostId;
        if (typeof preparedId === "string" && !publishedPreparedIds.has(preparedId)) {
          publishedPreparedIds.set(preparedId, { id: post.id });
        }
      }
      let published = 0;
      const discardedMediaPaths: Array<string | null> = [];
      for (const item of due) {
        const didPublish = await db.transaction(async (tx) => {
          const current = (await tx.select().from(noodlerPreparedPosts).where(eq(noodlerPreparedPosts.id, item.id)))[0];
          if (!current || current.state !== "prepared" || Date.parse(current.publishAt) > at.getTime()) return false;
          const existingPost = publishedPreparedIds.get(current.id);
          if (
            !existingPost &&
            Date.parse(current.publishAt) < at.getTime() - elapsedPreparedSlotMs(settings.postsPerDay)
          ) {
            await tx
              .update(noodlerPreparedPosts)
              .set({ state: "discarded", updatedAt: at.toISOString() })
              .where(eq(noodlerPreparedPosts.id, current.id));
            // Unlinked only after the discard commits, so a crash here leaks a file rather than
            // leaving a publishable row whose image is already gone.
            discardedMediaPaths.push(
              String(parseRecord(parseRecord(current.payload).metadata).noodlerMediaPath ?? "") || null,
            );
            return false;
          }
          if (existingPost) {
            await tx
              .update(noodlerPreparedPosts)
              .set({ state: "published", publishedPostId: existingPost.id, updatedAt: at.toISOString() })
              .where(eq(noodlerPreparedPosts.id, current.id));
            return false;
          }
          const accountRow = (
            await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, current.creatorAccountId))
          )[0];
          if (!accountRow || accountRow.platform !== "slurp") {
            await tx
              .update(noodlerPreparedPosts)
              .set({ state: "discarded", updatedAt: at.toISOString() })
              .where(eq(noodlerPreparedPosts.id, current.id));
            return false;
          }
          const account = mapAccount(accountRow);
          const source = await this.resolveAccountSource(account);
          const sourceSnapshot = source ? await resolveNoodlerSourceSnapshot(db, source) : null;
          if (
            !account.settings.scheduler.autoPosting?.enabled ||
            !source ||
            !sourceSnapshot ||
            current.policyFingerprint !== noodlerReservePolicyFingerprint(account, settings, source.updatedAt)
          ) {
            await tx
              .update(noodlerPreparedPosts)
              .set({ state: "discarded", updatedAt: at.toISOString() })
              .where(eq(noodlerPreparedPosts.id, current.id));
            return false;
          }
          const latestCreatorPost = (
            await tx
              .select()
              .from(noodlePosts)
              .where(eq(noodlePosts.authorAccountId, account.id))
              .orderBy(desc(noodlePosts.createdAt))
          )[0];
          if (
            latestCreatorPost &&
            Date.parse(latestCreatorPost.createdAt) + slurpCreatorPostingIntervalMs(settings.postsPerDay) > at.getTime()
          ) {
            discardedMediaPaths.push(
              String(parseRecord(parseRecord(current.payload).metadata).noodlerMediaPath ?? "") || null,
            );
            await tx
              .update(noodlerPreparedPosts)
              .set({ state: "discarded", updatedAt: at.toISOString() })
              .where(eq(noodlerPreparedPosts.id, current.id));
            return false;
          }
          const payload = parseRecord(current.payload) as NoodlerPreparedPostPayload;
          if (typeof payload.content !== "string" || !payload.content.trim()) {
            await tx
              .update(noodlerPreparedPosts)
              .set({ state: "discarded", updatedAt: at.toISOString() })
              .where(eq(noodlerPreparedPosts.id, current.id));
            return false;
          }
          const postId = newId();
          const imageState = current.imageState === "attached" ? "attached" : "closed";
          const preparedMetadata = parseRecord(payload.metadata);
          const hasMedia = typeof preparedMetadata.noodlerMediaPath === "string";
          // A post with no generated picture may carry an existing gallery image instead.
          const galleryImageUrl =
            typeof preparedMetadata.galleryAttachmentImageUrl === "string"
              ? preparedMetadata.galleryAttachmentImageUrl
              : null;
          // A Story is a picture with a line under it. The prepared payload carries the story
          // intent, but a run whose image never attached publishes as an ordinary post.
          if (!hasMedia) delete preparedMetadata.noodlerPostType;
          await tx.insert(noodlePosts).values({
            id: postId,
            authorAccountId: account.id,
            title: typeof payload.title === "string" ? payload.title : null,
            content: payload.content,
            imageUrl: hasMedia ? noodlerPostMediaUrl(postId) : galleryImageUrl,
            imagePrompt: typeof payload.imagePrompt === "string" ? payload.imagePrompt : null,
            parentPostId: null,
            quotePostId: null,
            source: "generated",
            projectId: typeof payload.projectId === "string" ? payload.projectId : null,
            projectChapter: typeof payload.projectChapter === "string" ? payload.projectChapter : null,
            access: payload.access === "public" ? "public" : "locked",
            metadata: JSON.stringify({ ...preparedMetadata, noodlerPreparedPostId: current.id }),
            authorSnapshot: JSON.stringify(snapshotForAccount(account)),
            // A late publish is stamped with the moment it actually happened. Using publishAt
            // would file the post behind whatever the feed received during the delay.
            createdAt: Date.parse(current.publishAt) < at.getTime() ? at.toISOString() : current.publishAt,
            updatedAt: at.toISOString(),
          });
          await tx
            .update(noodlerPreparedPosts)
            .set({
              state: "published",
              publishedPostId: postId,
              imageState,
              imageClaimToken: null,
              imageClaimLeaseUntil: null,
              updatedAt: at.toISOString(),
            })
            .where(eq(noodlerPreparedPosts.id, current.id));
          return postId;
        });
        if (!didPublish) continue;
        published += 1;
        // Outside the transaction on purpose. Advancing is bookkeeping, not part of publishing:
        // a project that failed to advance must not roll back a post the audience can already see.
        if (typeof item.payload.projectId === "string" && item.payload.projectId) {
          await this.advanceProject(item.creatorAccountId, item.payload.projectId, didPublish);
        }
      }
      for (const path of discardedMediaPaths) unlinkNoodlerMedia(path);
      return published;
    },
    async reconcileNoodlerPreparedPosts(at = new Date()): Promise<number> {
      const settings = await this.getSettings();
      const repaired = await db.transaction(async (tx) => {
        const [items, posts] = await Promise.all([
          tx.select().from(noodlerPreparedPosts),
          tx.select().from(noodlePosts),
        ]);
        const postsByPreparedId = new Map<string, typeof posts>();
        for (const post of posts) {
          const preparedId = parseRecord(post.metadata).noodlerPreparedPostId;
          if (typeof preparedId !== "string") continue;
          const existing = postsByPreparedId.get(preparedId) ?? [];
          existing.push(post);
          postsByPreparedId.set(preparedId, existing);
        }
        let count = 0;
        for (const item of items) {
          const linkedPosts = (postsByPreparedId.get(item.id) ?? []).sort((left, right) =>
            left.id.localeCompare(right.id),
          );
          const linkedPost = linkedPosts[0];
          if (linkedPost) {
            if (item.state !== "published" || item.publishedPostId !== linkedPost.id) {
              await tx
                .update(noodlerPreparedPosts)
                .set({ state: "published", publishedPostId: linkedPost.id, updatedAt: at.toISOString() })
                .where(eq(noodlerPreparedPosts.id, item.id));
              count += 1;
            }
          } else if (item.state === "published") {
            // The linked post is gone. Re-preparing is only right while the slot is still in the
            // future; a row whose publishAt has passed would be republished by the very next poll,
            // so a user who deletes an automatic post would watch it come back. Discard those.
            const slotStillAhead = Date.parse(item.publishAt) > at.getTime();
            await tx
              .update(noodlerPreparedPosts)
              .set(
                slotStillAhead
                  ? { state: "prepared", publishedPostId: null, updatedAt: at.toISOString() }
                  : { state: "discarded", updatedAt: at.toISOString() },
              )
              .where(eq(noodlerPreparedPosts.id, item.id));
            count += 1;
          }
        }
        return count;
      });
      const items = await this.listNoodlerPreparedPosts();
      const active = items.filter((item) => item.state === "scheduled" || item.state === "prepared");
      const accounts = new Map((await this.listNoodlerAccounts()).map((account) => [account.id, account]));
      const sources = new Map(
        await Promise.all(
          [...accounts.values()].map(
            async (account) => [account.id, await this.resolveAccountSource(account)] as const,
          ),
        ),
      );
      const missingSourceAccountIds = new Set(
        (
          await Promise.all(
            [...accounts.values()].map(async (account) => {
              const source = sources.get(account.id) ?? null;
              return !source || !(await resolveNoodlerSourceSnapshot(db, source)) ? account.id : null;
            }),
          )
        ).filter((id): id is string => id !== null),
      );
      const invalidIds = active
        .filter((item) => {
          const account = accounts.get(item.creatorAccountId);
          const source = account ? (sources.get(account.id) ?? null) : null;
          return (
            // A row whose timestamps do not parse can never become due and would otherwise make
            // every status read and publish pass fail until someone edited storage by hand.
            Number.isNaN(Date.parse(item.publishAt)) ||
            Number.isNaN(Date.parse(item.generatedAt)) ||
            Date.parse(item.publishAt) < at.getTime() - elapsedPreparedSlotMs(settings.postsPerDay) ||
            !account ||
            !source ||
            missingSourceAccountIds.has(item.creatorAccountId) ||
            !account.settings.scheduler.autoPosting?.enabled ||
            item.policyFingerprint !== noodlerReservePolicyFingerprint(account, settings, source.updatedAt)
          );
        })
        .map((item) => item.id);
      const invalidIdSet = new Set(invalidIds);
      // Soonest first, so lowering postsPerDay discards the latest excess items and leaves
      // the imminent ones intact.
      const validFuture = active
        .filter((item) => !invalidIdSet.has(item.id) && Date.parse(item.publishAt) > at.getTime())
        .sort((a, b) => Date.parse(a.publishAt) - Date.parse(b.publishAt));
      const excessIds = validFuture.slice(settings.postsPerDay).map((item) => item.id);
      const discardedSet = new Set([...invalidIds, ...excessIds]);
      const discarded = [...discardedSet];
      if (discarded.length > 0) {
        await db.transaction(async (tx) =>
          tx
            .update(noodlerPreparedPosts)
            .set({ state: "discarded", updatedAt: at.toISOString() })
            .where(inArray(noodlerPreparedPosts.id, discarded)),
        );
        for (const item of active.filter(
          (candidate) => candidate.state === "prepared" && discardedSet.has(candidate.id),
        )) {
          unlinkNoodlerMedia(String(parseRecord(item.payload.metadata).noodlerMediaPath ?? "") || null);
        }
      }
      // A crash between the durable row write and the media promotion leaves a row pointing at a
      // file that is not there; publishing it would give the post a 404 image route. Drop the
      // reference instead, so the post publishes as text.
      for (const item of items) {
        if (item.state !== "prepared" || discardedSet.has(item.id)) continue;
        const mediaPath = item.payload.metadata.noodlerMediaPath;
        if (typeof mediaPath !== "string" || !mediaPath) continue;
        const absolute = resolveNoodlerMediaAbsolutePath(mediaPath);
        if (absolute && existsSync(absolute)) continue;
        const { noodlerMediaPath: _missing, ...metadata } = item.payload.metadata;
        await db.transaction(async (tx) =>
          tx
            .update(noodlerPreparedPosts)
            .set({
              payload: JSON.stringify({ ...item.payload, metadata }),
              imageState: "closed",
              updatedAt: at.toISOString(),
            })
            .where(eq(noodlerPreparedPosts.id, item.id)),
        );
      }
      // Published and discarded rows only exist for crash recovery, and this table is read whole
      // on every poll, so aged terminal rows are dropped instead of accumulating forever.
      const pruneBefore = at.getTime() - TERMINAL_PREPARED_POST_RETENTION_MS;
      const prunable = items
        .filter(
          (item) =>
            item.state !== "scheduled" &&
            item.state !== "prepared" &&
            !discardedSet.has(item.id) &&
            !(Date.parse(item.updatedAt) > pruneBefore),
        )
        .map((item) => item.id);
      if (prunable.length > 0) {
        await db.delete(noodlerPreparedPosts).where(inArray(noodlerPreparedPosts.id, prunable));
      }
      return repaired + discarded.length;
    },
    async getNoodlerReserveStatus(at = new Date()): Promise<SlurpReserveStatus> {
      const settings = await this.getSettings();
      const state = await this.ensureNoodlerReserveState(at);
      const effectiveMs = Date.parse(state.lastObservedBudgetTime);
      const cutoff = effectiveMs - ROLLING_DAY_MS;
      const [items, attempts, creators] = await Promise.all([
        this.listNoodlerPreparedPosts(),
        db.select().from(noodlerAutomaticAttempts),
        this.listAutoPostEnabledAccounts(),
      ]);
      const prepared = items.filter((item) => item.state === "prepared");
      const upcoming = items.filter(
        (item) =>
          (item.state === "scheduled" || item.state === "prepared") && Date.parse(item.publishAt) > at.getTime(),
      );
      return {
        preparedCount: prepared.length,
        preparedThrough: prepared.reduce<string | null>(
          (latest, item) => (!latest || item.publishAt > latest ? item.publishAt : latest),
          null,
        ),
        textAttemptsUsed: attempts.filter(
          (row) => row.kind === "text" && row.outcome !== "failed" && Date.parse(row.claimedAt) > cutoff,
        ).length,
        imageAttemptsUsed: attempts.filter(
          (row) => row.kind === "image" && row.outcome !== "failed" && Date.parse(row.claimedAt) > cutoff,
        ).length,
        postsPerDay: settings.postsPerDay,
        preparationNotBefore: state.preparationNotBefore,
        creators: creators.map((account) => ({
          accountId: account.id,
          nextPreparedAt: prepared.find((item) => item.creatorAccountId === account.id)?.publishAt ?? null,
          // Settings shows who is holding reserve and how many, so the count travels with the row.
          preparedCount: prepared.filter((item) => item.creatorAccountId === account.id).length,
          slots: upcoming
            .filter((item) => item.creatorAccountId === account.id)
            .map((item) => ({ id: item.id, publishAt: item.publishAt, state: item.state })),
        })),
      };
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
