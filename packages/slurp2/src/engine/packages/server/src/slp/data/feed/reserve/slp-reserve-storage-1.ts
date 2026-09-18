import { and, eq, inArray, lt, or } from "../../../../db/file-query.js";
import { unlinkNoodlerMedia } from "../../../base/media/slp-media.js";
import {
  noodleAccounts,
  noodlePosts,
  noodlerAutomaticAttempts,
  noodlerPreparedPosts,
  noodlerReserveState,
} from "../../../../db/schema/slurp.js";
import { newId, now } from "../../../../utils/id-generator.js";
import {
  hasSlurpCreatorPostingIntervalConflict,
  slurpCreatorPostingIntervalMs,
} from "../../../modules/feed/slp-posting-interval.js";
import { NOODLER_RESERVE_STATE_ID, ROLLING_DAY_MS } from "../../host/slp-storage-constants.js";
import { noodlerReservePolicyFingerprint, parseRecord } from "../../../modules/records/slp-storage-model.js";
import type {
  NoodlerPreparedPostPayload,
  NoodlerPreparedPostState,
  NoodlerPreparedImageState,
} from "../../../modules/records/slp-storage-model.js";
import { mapAccount } from "../../host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../../host/slp-storage-context.js";

export function createReserveStorage1(context: SlurpStorageContext) {
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
    async ensureNoodlerReserveState(at = new Date()): Promise<{
      lastObservedBudgetTime: string;
      preparationNotBefore: string;
    }> {
      return db.transaction(async (tx) => {
        const existing = (
          await tx.select().from(noodlerReserveState).where(eq(noodlerReserveState.id, NOODLER_RESERVE_STATE_ID))
        )[0];
        // Imported or hand-edited state can carry timestamps that do not parse. NaN would
        // propagate into every budget and hold comparison, so an unreadable value resets to now.
        const parsed = existing ? Date.parse(existing.lastObservedBudgetTime) : 0;
        const observedMs = Math.max(at.getTime(), Number.isNaN(parsed) ? 0 : parsed);
        if (existing) {
          const observed = new Date(observedMs).toISOString();
          const storedPreparationMs = Date.parse(existing.preparationNotBefore);
          // Repair the startup hold written by the first reserve-state version. It blocked the
          // first scheduled post for a full day after the package started.
          const preparationNotBefore =
            Number.isNaN(storedPreparationMs) || storedPreparationMs > observedMs
              ? observed
              : existing.preparationNotBefore;
          if (observed !== existing.lastObservedBudgetTime || preparationNotBefore !== existing.preparationNotBefore) {
            await tx
              .update(noodlerReserveState)
              .set({ lastObservedBudgetTime: observed, preparationNotBefore, updatedAt: at.toISOString() })
              .where(eq(noodlerReserveState.id, NOODLER_RESERVE_STATE_ID));
          }
          return { lastObservedBudgetTime: observed, preparationNotBefore };
        }
        const timestamp = at.toISOString();
        await tx.insert(noodlerReserveState).values({
          id: NOODLER_RESERVE_STATE_ID,
          lastObservedBudgetTime: timestamp,
          preparationNotBefore: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        return { lastObservedBudgetTime: timestamp, preparationNotBefore: timestamp };
      });
    },
    async claimNoodlerAutomaticAttempt(
      kind: "text" | "image",
      limit: number,
      at = new Date(),
    ): Promise<{ status: "claimed"; claimId: string; claimedAt: string } | { status: "exhausted" | "holding" }> {
      return db.transaction(async (tx) => {
        let state = (
          await tx.select().from(noodlerReserveState).where(eq(noodlerReserveState.id, NOODLER_RESERVE_STATE_ID))
        )[0];
        if (!state) {
          const timestamp = at.toISOString();
          await tx.insert(noodlerReserveState).values({
            id: NOODLER_RESERVE_STATE_ID,
            lastObservedBudgetTime: timestamp,
            preparationNotBefore: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
          return { status: "holding" };
        }
        // Same NaN handling as ensureNoodlerReserveState: an unreadable stored timestamp resets
        // to now instead of poisoning the comparison (and toISOString) with NaN.
        const observed = Date.parse(state.lastObservedBudgetTime);
        const effectiveMs = Math.max(at.getTime(), Number.isNaN(observed) ? 0 : observed);
        const effectiveIso = new Date(effectiveMs).toISOString();
        if (effectiveIso !== state.lastObservedBudgetTime) {
          await tx
            .update(noodlerReserveState)
            .set({ lastObservedBudgetTime: effectiveIso, updatedAt: at.toISOString() })
            .where(eq(noodlerReserveState.id, NOODLER_RESERVE_STATE_ID));
          state = { ...state, lastObservedBudgetTime: effectiveIso };
        }
        const notBefore = Date.parse(state.preparationNotBefore);
        // An unparseable hold must not read as "hold expired"; hold until it is repaired.
        if (Number.isNaN(notBefore) || effectiveMs < notBefore) return { status: "holding" };
        const cutoff = effectiveMs - ROLLING_DAY_MS;
        // Prune claims that have left the rolling window, in the same transaction that
        // counts them: they can never affect the budget again, and the ledger is scanned
        // on every claim.
        const cutoffIso = new Date(cutoff).toISOString();
        await tx.delete(noodlerAutomaticAttempts).where(lt(noodlerAutomaticAttempts.claimedAt, cutoffIso));
        const attempts = (await tx.select().from(noodlerAutomaticAttempts)).filter(
          // A failed attempt (provider error, moderation reject, timeout) never produced a
          // post, so it must not permanently burn a slot out of the rolling-day budget: image
          // generation fails far more often than text, and without this a handful of image
          // failures locks out image posting for the rest of the day while text keeps going.
          (row) => row.kind === kind && row.outcome !== "failed" && Date.parse(row.claimedAt) > cutoff,
        );
        if (attempts.length >= limit) return { status: "exhausted" };
        const claimId = newId();
        await tx.insert(noodlerAutomaticAttempts).values({
          id: claimId,
          kind,
          claimedAt: effectiveIso,
          outcome: "claimed",
        });
        return { status: "claimed", claimId, claimedAt: effectiveIso };
      });
    },
    async completeNoodlerAutomaticAttempt(claimId: string, outcome: "completed" | "failed"): Promise<void> {
      await db.update(noodlerAutomaticAttempts).set({ outcome }).where(eq(noodlerAutomaticAttempts.id, claimId));
    },
    async createNoodlerPreparedPost(input: {
      creatorAccountId: string;
      generatedAt: string;
      publishAt: string;
      payload: NoodlerPreparedPostPayload;
      policyFingerprint: string;
    }): Promise<string> {
      const id = newId();
      // In a transaction so the row lands durably on commit (slurp2_prepared_posts is a
      // durable-on-commit table): a direct insert rides the batched flush, and a crash inside
      // that window loses the row while its promoted media file stays on disk.
      await db.transaction(async (tx) =>
        tx.insert(noodlerPreparedPosts).values({
          id,
          creatorAccountId: input.creatorAccountId,
          generatedAt: input.generatedAt,
          publishAt: input.publishAt,
          payload: JSON.stringify(input.payload),
          policyFingerprint: input.policyFingerprint,
          state: "prepared",
          publishedPostId: null,
          imageState: input.payload.metadata.noodlerMediaPath ? "attached" : "none",
          imageClaimToken: null,
          imageClaimLeaseUntil: null,
          updatedAt: input.generatedAt,
        }),
      );
      return id;
    },
    async createNoodlerScheduledPost(input: {
      creatorAccountId: string;
      publishAt: string;
      policyFingerprint: string;
      createdAt: string;
    }): Promise<string | null> {
      const id = newId();
      return db.transaction(async (tx) => {
        const settings = await this.getSettings();
        const publishMs = Date.parse(input.publishAt);
        const posts = await tx
          .select()
          .from(noodlePosts)
          .where(eq(noodlePosts.authorAccountId, input.creatorAccountId));
        const prepared = await tx
          .select()
          .from(noodlerPreparedPosts)
          .where(eq(noodlerPreparedPosts.creatorAccountId, input.creatorAccountId));
        const activityTimes = [
          ...posts.map((post) => Date.parse(post.createdAt)),
          ...prepared
            .filter((item) => item.state === "scheduled" || item.state === "prepared")
            .map((item) => Date.parse(item.publishAt)),
        ];
        if (hasSlurpCreatorPostingIntervalConflict(activityTimes, publishMs, settings.postsPerDay)) return null;
        await tx.insert(noodlerPreparedPosts).values({
          id,
          creatorAccountId: input.creatorAccountId,
          generatedAt: input.createdAt,
          publishAt: input.publishAt,
          payload: "{}",
          policyFingerprint: input.policyFingerprint,
          state: "scheduled",
          publishedPostId: null,
          imageState: "none",
          imageClaimToken: null,
          imageClaimLeaseUntil: null,
          updatedAt: input.createdAt,
        });
        return id;
      });
    },
    async fillNoodlerScheduledPost(
      id: string,
      input: {
        generatedAt: string;
        expectedPublishAt: string;
        payload: NoodlerPreparedPostPayload;
        policyFingerprint: string;
      },
    ): Promise<boolean> {
      return db.transaction(async (tx) => {
        const current = (await tx.select().from(noodlerPreparedPosts).where(eq(noodlerPreparedPosts.id, id)))[0];
        if (!current || current.state !== "scheduled" || current.publishAt !== input.expectedPublishAt) return false;
        await tx
          .update(noodlerPreparedPosts)
          .set({
            generatedAt: input.generatedAt,
            payload: JSON.stringify(input.payload),
            policyFingerprint: input.policyFingerprint,
            state: "prepared",
            imageState: input.payload.metadata.noodlerMediaPath ? "attached" : "none",
            imageClaimToken: null,
            imageClaimLeaseUntil: null,
            updatedAt: input.generatedAt,
          })
          .where(eq(noodlerPreparedPosts.id, id));
        return true;
      });
    },
    async rescheduleNoodlerPost(
      id: string,
      publishAt: string,
      at = new Date(),
    ): Promise<"updated" | "not_found" | "not_future" | "not_editable" | "conflict"> {
      const publishMs = Date.parse(publishAt);
      if (Number.isNaN(publishMs) || publishMs <= at.getTime()) return "not_future";
      const settings = await this.getSettings();
      let mediaPath: string | null = null;
      const result = await db.transaction(async (tx) => {
        const current = (await tx.select().from(noodlerPreparedPosts).where(eq(noodlerPreparedPosts.id, id)))[0];
        if (!current) return "not_found" as const;
        if (current.state !== "scheduled" && current.state !== "prepared") return "not_editable" as const;
        const [posts, activeSlots] = await Promise.all([
          tx.select().from(noodlePosts).where(eq(noodlePosts.authorAccountId, current.creatorAccountId)),
          tx
            .select()
            .from(noodlerPreparedPosts)
            .where(eq(noodlerPreparedPosts.creatorAccountId, current.creatorAccountId)),
        ]);
        const activityTimes = [
          ...posts.map((post) => Date.parse(post.createdAt)),
          ...activeSlots
            .filter((item) => item.id !== current.id && (item.state === "scheduled" || item.state === "prepared"))
            .map((item) => Date.parse(item.publishAt)),
        ];
        if (hasSlurpCreatorPostingIntervalConflict(activityTimes, publishMs, settings.postsPerDay)) {
          return "conflict" as const;
        }
        if (current.state === "prepared") {
          mediaPath = String(parseRecord(parseRecord(current.payload).metadata).noodlerMediaPath ?? "") || null;
        }
        const accountRow = (
          await tx.select().from(noodleAccounts).where(eq(noodleAccounts.id, current.creatorAccountId))
        )[0];
        if (!accountRow || accountRow.platform !== "slurp") return "not_found" as const;
        const account = mapAccount(accountRow);
        const source = await this.resolveAccountSource(account);
        const timestamp = at.toISOString();
        await tx
          .update(noodlerPreparedPosts)
          .set({
            publishAt: new Date(publishMs).toISOString(),
            generatedAt: timestamp,
            payload: "{}",
            policyFingerprint: noodlerReservePolicyFingerprint(account, settings, source?.updatedAt ?? null),
            state: "scheduled",
            publishedPostId: null,
            imageState: "none",
            imageClaimToken: null,
            imageClaimLeaseUntil: null,
            updatedAt: timestamp,
          })
          .where(eq(noodlerPreparedPosts.id, id));
        return "updated" as const;
      });
      if (result === "updated") unlinkNoodlerMedia(mediaPath);
      return result;
    },
    async listNoodlerPreparedPosts(): Promise<
      Array<{
        id: string;
        creatorAccountId: string;
        generatedAt: string;
        publishAt: string;
        payload: NoodlerPreparedPostPayload;
        policyFingerprint: string;
        state: NoodlerPreparedPostState;
        publishedPostId: string | null;
        imageState: NoodlerPreparedImageState;
        imageClaimToken: string | null;
        imageClaimLeaseUntil: string | null;
        updatedAt: string;
      }>
    > {
      const rows = await db.select().from(noodlerPreparedPosts).orderBy(noodlerPreparedPosts.publishAt);
      return rows.map((row) => ({
        ...row,
        state: (row.state === "scheduled" || row.state === "prepared" || row.state === "published"
          ? row.state
          : "discarded") as NoodlerPreparedPostState,
        imageState: (row.imageState === "pending" ||
        row.imageState === "generating" ||
        row.imageState === "attached" ||
        row.imageState === "rejected" ||
        row.imageState === "closed"
          ? row.imageState
          : "none") as NoodlerPreparedImageState,
        payload: parseRecord(row.payload) as NoodlerPreparedPostPayload,
      }));
    },
    /** Existence check for the idle scheduler poll, so it never materializes or parses rows. */
    async hasNoodlerPreparedPosts(): Promise<boolean> {
      const rows = await db.select({ id: noodlerPreparedPosts.id }).from(noodlerPreparedPosts).limit(1);
      return rows.length > 0;
    },
    /**
     * Unlinking media before the discard is durable can leave a still-publishable row whose
     * image bytes are gone, so the state is committed first and the file removed afterwards.
     * A crash between the two leaks a file, which `sweepOrphanedNoodlerMedia` reclaims.
     */
    async discardNoodlerPreparedPost(id: string, at = new Date()): Promise<void> {
      const current = (await db.select().from(noodlerPreparedPosts).where(eq(noodlerPreparedPosts.id, id)))[0];
      await db.transaction(async (tx) =>
        tx
          .update(noodlerPreparedPosts)
          .set({ state: "discarded", updatedAt: at.toISOString() })
          .where(eq(noodlerPreparedPosts.id, id)),
      );
      if (current)
        unlinkNoodlerMedia(String(parseRecord(parseRecord(current.payload).metadata).noodlerMediaPath ?? "") || null);
    },
    async discardPreparedPostsAfterManualPost(creatorAccountId: string, manualCreatedAt: string): Promise<number> {
      const start = Date.parse(manualCreatedAt);
      const settings = await this.getSettings();
      const end = start + slurpCreatorPostingIntervalMs(settings.postsPerDay);
      const rows = await db
        .select()
        .from(noodlerPreparedPosts)
        .where(eq(noodlerPreparedPosts.creatorAccountId, creatorAccountId));
      const ids = rows
        .filter(
          (row) => row.state === "prepared" && Date.parse(row.publishAt) > start && Date.parse(row.publishAt) <= end,
        )
        .map((row) => row.id);
      if (ids.length > 0) {
        await db.transaction(async (tx) =>
          tx
            .update(noodlerPreparedPosts)
            .set({ state: "discarded", updatedAt: now() })
            .where(inArray(noodlerPreparedPosts.id, ids)),
        );
        for (const row of rows.filter((candidate) => ids.includes(candidate.id))) {
          unlinkNoodlerMedia(String(parseRecord(parseRecord(row.payload).metadata).noodlerMediaPath ?? "") || null);
        }
      }
      return ids.length;
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
