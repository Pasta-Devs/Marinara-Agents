import { and, eq, isNull, like } from "../../../db/file-query.js";
import { SlpInteraction } from "../../../../../shared/src/slp/slp-social.types.js";
import { isSlurpFileUniqueConstraintError } from "../../base/host/slp-file-errors.js";
import { canViewCreatorPost } from "../../base/identity/slp-access.js";
import {
  slpAccounts,
  slpAccountSubscriptions,
  slpInteractions,
  slpPosts,
  slpPostUnlocks,
  slurpPopulation,
} from "../../../db/schema/slurp.js";
import { newId, now } from "../../../utils/id-generator.js";
import type {
  SlpCreatorRemoveInteractionCommand,
  SlpCreatorWorldInteractionInput,
} from "../../modules/records/slp-storage-model.js";
import { mapAccount, snapshotForAccount, mapPost, mapInteraction } from "../host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../host/slp-storage-context.js";

export function createFeedInteractionStorage4(context: SlurpStorageContext) {
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
    async createNoodlerWorldInteraction(
      postId: string,
      input: SlpCreatorWorldInteractionInput,
    ): Promise<{ interaction: SlpInteraction; created: boolean } | null> {
      return db.transaction(async (tx) => {
        const postRow = (await tx.select().from(slpPosts).where(eq(slpPosts.id, postId)))[0];
        if (
          !postRow ||
          (postRow.access !== "public" && postRow.access !== "locked") ||
          postRow.authorAccountId !== input.creatorAccountId
        )
          return null;
        const creatorRow = (
          await tx
            .select()
            .from(slpAccounts)
            .where(and(eq(slpAccounts.id, input.creatorAccountId), eq(slpAccounts.platform, "slurp")))
        )[0];
        if (!creatorRow) return null;

        const actorAccountRow = (
          await tx
            .select()
            .from(slpAccounts)
            .where(and(eq(slpAccounts.id, input.actorId), eq(slpAccounts.platform, "slurp")))
        )[0];
        const actorPopulationRow = (
          await tx.select().from(slurpPopulation).where(eq(slurpPopulation.id, input.actorId))
        )[0];
        const actor = actorAccountRow ? mapAccount(actorAccountRow) : null;
        const actorSnapshot = actor
          ? snapshotForAccount(actor)
          : actorPopulationRow
            ? {
                id: actorPopulationRow.id,
                kind: "random_user" as const,
                entityId: actorPopulationRow.id,
                handle: actorPopulationRow.handle,
                displayName: actorPopulationRow.displayName,
                avatarUrl: null,
                avatarCrop: null,
              }
            : null;
        if (!actorSnapshot || (actor && actor.kind !== "random_user")) return null;
        const content = input.type === "reply" ? input.content?.trim() || null : null;
        if (input.type === "reply" && !content) return null;
        // A parent must be a real comment on this post, and nobody answers themselves. Only a
        // reply may have one: a like on a comment is not a thing this schema models.
        let parentInteractionId: string | null = null;
        if (input.type === "reply" && input.parentInteractionId) {
          const parentRow = (
            await tx.select().from(slpInteractions).where(eq(slpInteractions.id, input.parentInteractionId))
          )[0];
          const parent = parentRow ? mapInteraction(parentRow) : null;
          if (parent && parent.postId === postId && parent.type === "reply" && parent.actorAccountId !== input.actorId)
            parentInteractionId = parent.id;
        }
        const matchesParent = parentInteractionId
          ? eq(slpInteractions.parentInteractionId, parentInteractionId)
          : isNull(slpInteractions.parentInteractionId);
        const existing = await tx
          .select()
          .from(slpInteractions)
          .where(
            and(
              eq(slpInteractions.postId, postId),
              eq(slpInteractions.actorAccountId, input.actorId),
              eq(slpInteractions.type, input.type),
              matchesParent,
            ),
          );
        if (existing[0]) return { interaction: mapInteraction(existing[0]), created: false };
        const id = newId();
        try {
          await tx.insert(slpInteractions).values({
            id,
            postId,
            parentInteractionId,
            actorAccountId: input.actorId,
            type: input.type,
            content,
            imageUrl: null,
            actorSnapshot: JSON.stringify(actorSnapshot),
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
          const duplicate = (
            await tx
              .select()
              .from(slpInteractions)
              .where(
                and(
                  eq(slpInteractions.postId, postId),
                  eq(slpInteractions.actorAccountId, input.actorId),
                  eq(slpInteractions.type, input.type),
                  matchesParent,
                ),
              )
          )[0];
          return duplicate ? { interaction: mapInteraction(duplicate), created: false } : null;
        }
        const rows = await tx.select().from(slpInteractions).where(eq(slpInteractions.id, id));
        return rows[0] ? { interaction: mapInteraction(rows[0]), created: true } : null;
      });
    },
    async deleteNoodlerInteraction(
      postId: string,
      input: SlpCreatorRemoveInteractionCommand,
    ): Promise<SlpInteraction | null> {
      const viewer = await this.getViewer(input.viewerPersonaId);
      const actor = await this.getNoodlerAccountById(input.actorAccountId);
      if (
        !viewer ||
        !actor ||
        actor.kind !== "persona" ||
        actor.sourceKind !== "persona" ||
        actor.sourceEntityId !== input.viewerPersonaId
      )
        return null;
      const parentInteractionId = input.parentInteractionId ?? null;
      return db.transaction(async (tx) => {
        const postRow = (await tx.select().from(slpPosts).where(eq(slpPosts.id, postId)))[0];
        if (!postRow) return null;
        const authorRow = (
          await tx
            .select()
            .from(slpAccounts)
            .where(and(eq(slpAccounts.id, postRow.authorAccountId), eq(slpAccounts.platform, "slurp")))
        )[0];
        if (!authorRow) return null;
        const author = mapAccount(authorRow);
        const ownsAuthor = author.sourceKind === "persona" && author.sourceEntityId === input.viewerPersonaId;
        const subscriptions = await tx
          .select()
          .from(slpAccountSubscriptions)
          .where(
            and(
              eq(slpAccountSubscriptions.viewerAccountId, input.viewerPersonaId),
              eq(slpAccountSubscriptions.creatorAccountId, author.id),
            ),
          );
        const unlocks = await tx
          .select()
          .from(slpPostUnlocks)
          .where(and(eq(slpPostUnlocks.viewerAccountId, input.viewerPersonaId), eq(slpPostUnlocks.postId, postId)));
        if (
          !ownsAuthor &&
          !canViewCreatorPost({
            post: mapPost(postRow),
            subscribed: subscriptions.length > 0,
            unlockedPostIds: new Set(unlocks.map((row) => row.postId)),
          })
        )
          return null;
        await normalizeLegacyNoodlerToggleInteraction(tx, {
          postId,
          actorAccountId: actor.id,
          viewerPersonaId: input.viewerPersonaId,
          type: input.type,
          parentInteractionId,
          actor,
        });
        const existing = (
          await tx
            .select()
            .from(slpInteractions)
            .where(
              and(
                eq(slpInteractions.postId, postId),
                eq(slpInteractions.actorAccountId, actor.id),
                eq(slpInteractions.type, input.type),
                parentInteractionId
                  ? eq(slpInteractions.parentInteractionId, parentInteractionId)
                  : isNull(slpInteractions.parentInteractionId),
              ),
            )
        )[0];
        if (!existing) return null;
        await deleteInteractionChildren(tx, existing.id);
        await tx.delete(slpInteractions).where(eq(slpInteractions.id, existing.id));
        return mapInteraction(existing);
      });
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
