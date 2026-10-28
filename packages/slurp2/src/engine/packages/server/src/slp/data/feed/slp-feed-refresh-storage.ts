import { and, desc, eq, gt, inArray, or } from "../../../db/file-query.js";
import { SlpDigestEntry, SlpRefreshAttempt, SlpRefreshRun } from "../../../../../shared/src/slp/slp-social.types.js";
import { slpActivityDigests, slpInteractions, slpPosts, slpRefreshRuns } from "../../../db/schema/slurp.js";
import { newId, now } from "../../../utils/id-generator.js";
import { parseRecord, parseRefreshAttempts, parseStringArray } from "../../modules/records/slp-storage-model.js";
import { mapDigest, mapRefreshRun } from "../host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../host/slp-storage-context.js";

export function createFeedRefreshStorage1(context: SlurpStorageContext) {
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
    async createDigest(input: {
      accountIds: string[];
      content: string;
      sourceRunId?: string | null;
      sourcePostId?: string | null;
      sourceInteractionId?: string | null;
    }): Promise<SlpDigestEntry> {
      const id = newId();
      const uniqueAccountIds = Array.from(new Set(input.accountIds.filter(Boolean)));
      const slurpSourceAccountIds = new Set(
        (await this.listAccounts({ includeHidden: true })).map((account) => account.id),
      );
      if (!uniqueAccountIds.every((accountId) => slurpSourceAccountIds.has(accountId))) {
        throw new Error("Slurp digests cannot reference accounts outside Slurp.");
      }
      await db.transaction(async (tx) => {
        if (input.sourceInteractionId) {
          const existingDigests = await tx
            .select()
            .from(slpActivityDigests)
            .where(eq(slpActivityDigests.sourceInteractionId, input.sourceInteractionId));
          const publicDigestIds = existingDigests
            .filter((digest) =>
              parseStringArray(digest.accountIds).every((accountId) => slurpSourceAccountIds.has(accountId)),
            )
            .map((digest) => digest.id);
          if (publicDigestIds.length > 0) {
            await tx.delete(slpActivityDigests).where(inArray(slpActivityDigests.id, publicDigestIds));
          }
        }
        await tx.insert(slpActivityDigests).values({
          id,
          accountIds: JSON.stringify(uniqueAccountIds),
          content: input.content.trim().slice(0, 1200),
          sourceRunId: input.sourceRunId ?? null,
          sourcePostId: input.sourcePostId ?? null,
          sourceInteractionId: input.sourceInteractionId ?? null,
          createdAt: now(),
        });
      });
      const rows = await db.select().from(slpActivityDigests).where(eq(slpActivityDigests.id, id));
      return mapDigest(rows[0]!);
    },
    async updateDigest(id: string, input: { accountIds: string[]; content: string }): Promise<SlpDigestEntry | null> {
      const uniqueAccountIds = Array.from(new Set(input.accountIds.filter(Boolean)));
      const existingRows = await db.select().from(slpActivityDigests).where(eq(slpActivityDigests.id, id));
      const existing = existingRows[0];
      if (!existing) return null;
      const slurpSourceAccountIds = new Set(
        (await this.listAccounts({ includeHidden: true })).map((account) => account.id),
      );
      if (
        !parseStringArray(existing.accountIds).every((accountId) => slurpSourceAccountIds.has(accountId)) ||
        !uniqueAccountIds.every((accountId) => slurpSourceAccountIds.has(accountId))
      ) {
        return null;
      }
      await db
        .update(slpActivityDigests)
        .set({
          accountIds: JSON.stringify(uniqueAccountIds),
          content: input.content.trim().slice(0, 1200),
        })
        .where(eq(slpActivityDigests.id, id));
      const rows = await db.select().from(slpActivityDigests).where(eq(slpActivityDigests.id, id));
      return rows[0] ? mapDigest(rows[0]) : null;
    },
    async listDigests(options: { limit?: number; since?: string } = {}): Promise<SlpDigestEntry[]> {
      const limit = Math.max(1, Math.min(200, Math.floor(options.limit ?? 80)));
      const fetchLimit = 200;
      const rows = options.since
        ? await db
            .select()
            .from(slpActivityDigests)
            .where(gt(slpActivityDigests.createdAt, options.since))
            .orderBy(desc(slpActivityDigests.createdAt))
            .limit(fetchLimit)
        : await db.select().from(slpActivityDigests).orderBy(desc(slpActivityDigests.createdAt)).limit(fetchLimit);

      const sourcePostIds = Array.from(new Set(rows.flatMap((row) => (row.sourcePostId ? [row.sourcePostId] : []))));
      const sourceInteractionIds = Array.from(
        new Set(rows.flatMap((row) => (row.sourceInteractionId ? [row.sourceInteractionId] : []))),
      );
      const [sourcePosts, sourceInteractions] = await Promise.all([
        sourcePostIds.length > 0
          ? db.select().from(slpPosts).where(inArray(slpPosts.id, sourcePostIds))
          : Promise.resolve([]),
        sourceInteractionIds.length > 0
          ? db.select().from(slpInteractions).where(inArray(slpInteractions.id, sourceInteractionIds))
          : Promise.resolve([]),
      ]);
      const sourcePostById = new Map(sourcePosts.map((post) => [post.id, post]));
      const sourceInteractionById = new Map(sourceInteractions.map((interaction) => [interaction.id, interaction]));
      const slurpSourceAccountIds = new Set((await this.listAccounts()).map((account) => account.id));

      return rows
        .filter((row) => {
          const digest = mapDigest(row);
          if (!digest.accountIds.every((accountId) => slurpSourceAccountIds.has(accountId))) return false;
          if (row.sourceInteractionId) {
            const interaction = sourceInteractionById.get(row.sourceInteractionId);
            if (!interaction || !slurpSourceAccountIds.has(interaction.actorAccountId)) return false;
            const sourcePost = sourcePostById.get(interaction.postId);
            return Boolean(sourcePost && slurpSourceAccountIds.has(sourcePost.authorAccountId));
          }
          // Older model-authored summaries had only a refresh-run reference,
          // so there is no way to invalidate them when their source post or
          // comment is deleted. Deterministic event digests supersede them.
          if (row.sourceRunId && !row.sourcePostId) return false;
          if (!row.sourcePostId) return true;
          const sourcePost = sourcePostById.get(row.sourcePostId);
          if (!sourcePost || !slurpSourceAccountIds.has(sourcePost.authorAccountId)) return false;
          // Digests created before source_interaction_id existed cannot be tied
          // safely to a still-live comment. Keep only the post's canonical digest;
          // stale legacy comment digests must never re-enter generation context.
          return parseRecord(sourcePost.metadata).activityDigestId === row.id;
        })
        .slice(0, limit)
        .map(mapDigest);
    },
    async createRefreshRun(input: { activeAccountIds: string[]; prompt: string }): Promise<SlpRefreshRun> {
      const timestamp = now();
      const id = newId();
      await db.insert(slpRefreshRuns).values({
        id,
        status: "running",
        activeAccountIds: JSON.stringify(input.activeAccountIds),
        prompt: input.prompt,
        result: null,
        error: null,
        attempts: "[]",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      const rows = await db.select().from(slpRefreshRuns).where(eq(slpRefreshRuns.id, id));
      return mapRefreshRun(rows[0]!);
    },
    async listRefreshRuns(options: { limit?: number; status?: SlpRefreshRun["status"] } = {}) {
      const limit = Math.max(1, Math.min(20, Math.floor(options.limit ?? 5)));
      const baseQuery = db.select().from(slpRefreshRuns);
      const rows = options.status
        ? await baseQuery
            .where(eq(slpRefreshRuns.status, options.status))
            .orderBy(desc(slpRefreshRuns.createdAt))
            .limit(limit)
        : await baseQuery.orderBy(desc(slpRefreshRuns.createdAt)).limit(limit);
      return rows.map(mapRefreshRun);
    },
    async recordRefreshAttempt(id: string, attempt: SlpRefreshAttempt): Promise<SlpRefreshRun | null> {
      const rows = await db.select().from(slpRefreshRuns).where(eq(slpRefreshRuns.id, id));
      const current = rows[0];
      if (!current) return null;
      await db
        .update(slpRefreshRuns)
        .set({
          attempts: JSON.stringify([...parseRefreshAttempts(current.attempts), attempt]),
          updatedAt: now(),
        })
        .where(eq(slpRefreshRuns.id, id));
      const updatedRows = await db.select().from(slpRefreshRuns).where(eq(slpRefreshRuns.id, id));
      return updatedRows[0] ? mapRefreshRun(updatedRows[0]) : null;
    },
    async finishRefreshRun(
      id: string,
      patch: { status: "completed" | "failed"; result?: string | null; error?: string | null },
    ): Promise<SlpRefreshRun | null> {
      await db
        .update(slpRefreshRuns)
        .set({
          status: patch.status,
          result: patch.result ?? null,
          error: patch.error ?? null,
          updatedAt: now(),
        })
        .where(eq(slpRefreshRuns.id, id));
      const rows = await db.select().from(slpRefreshRuns).where(eq(slpRefreshRuns.id, id));
      const finished = rows[0] ? mapRefreshRun(rows[0]) : null;
      // Retention cleanup is best-effort: never let a pruning failure make the
      // caller treat already-completed generation work as failed and retry it.
      try {
        await pruneFinishedRefreshRuns();
      } catch (error) {
        console.error("Slurp refresh-run retention cleanup failed", error);
      }
      return finished;
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
