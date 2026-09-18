import { and, eq, isNull, like } from "../../../db/file-query.js";
import { NoodleInteraction } from "@marinara-engine/shared";
import { isSlurpFileUniqueConstraintError } from "../../base/host/slp-file-errors.js";
import { canViewNoodlerPost, isNoodlerHiddenFromViewer } from "../../base/identity/slp-access.js";
import {
  noodleAccounts,
  noodleAccountSubscriptions,
  noodleInteractions,
  noodlePosts,
  noodlePostUnlocks,
  slurpPopulation,
} from "../../../db/schema/slurp.js";
import { newId, now } from "../../../utils/id-generator.js";
import type {
  NoodlerRemoveInteractionCommand,
  NoodlerWorldInteractionInput,
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
      input: NoodlerWorldInteractionInput,
    ): Promise<{ interaction: NoodleInteraction; created: boolean } | null> {
      return db.transaction(async (tx) => {
        const postRow = (await tx.select().from(noodlePosts).where(eq(noodlePosts.id, postId)))[0];
        if (
          !postRow ||
          (postRow.access !== "public" && postRow.access !== "locked") ||
          postRow.authorAccountId !== input.creatorAccountId
        )
          return null;
        const creatorRow = (
          await tx
            .select()
            .from(noodleAccounts)
            .where(and(eq(noodleAccounts.id, input.creatorAccountId), eq(noodleAccounts.platform, "slurp")))
        )[0];
        if (!creatorRow) return null;

        const actorAccountRow = (
          await tx
            .select()
            .from(noodleAccounts)
            .where(and(eq(noodleAccounts.id, input.actorId), eq(noodleAccounts.platform, "slurp")))
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
            await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, input.parentInteractionId))
          )[0];
          const parent = parentRow ? mapInteraction(parentRow) : null;
          if (parent && parent.postId === postId && parent.type === "reply" && parent.actorAccountId !== input.actorId)
            parentInteractionId = parent.id;
        }
        const matchesParent = parentInteractionId
          ? eq(noodleInteractions.parentInteractionId, parentInteractionId)
          : isNull(noodleInteractions.parentInteractionId);
        const existing = await tx
          .select()
          .from(noodleInteractions)
          .where(
            and(
              eq(noodleInteractions.postId, postId),
              eq(noodleInteractions.actorAccountId, input.actorId),
              eq(noodleInteractions.type, input.type),
              matchesParent,
            ),
          );
        if (existing[0]) return { interaction: mapInteraction(existing[0]), created: false };
        const id = newId();
        try {
          await tx.insert(noodleInteractions).values({
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
              .from(noodleInteractions)
              .where(
                and(
                  eq(noodleInteractions.postId, postId),
                  eq(noodleInteractions.actorAccountId, input.actorId),
                  eq(noodleInteractions.type, input.type),
                  matchesParent,
                ),
              )
          )[0];
          return duplicate ? { interaction: mapInteraction(duplicate), created: false } : null;
        }
        const rows = await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, id));
        return rows[0] ? { interaction: mapInteraction(rows[0]), created: true } : null;
      });
    },
    async deleteNoodlerInteraction(
      postId: string,
      input: NoodlerRemoveInteractionCommand,
    ): Promise<NoodleInteraction | null> {
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
        const postRow = (await tx.select().from(noodlePosts).where(eq(noodlePosts.id, postId)))[0];
        if (!postRow) return null;
        const authorRow = (
          await tx
            .select()
            .from(noodleAccounts)
            .where(and(eq(noodleAccounts.id, postRow.authorAccountId), eq(noodleAccounts.platform, "slurp")))
        )[0];
        if (!authorRow) return null;
        const author = mapAccount(authorRow);
        if (isNoodlerHiddenFromViewer(author, input.viewerPersonaId)) return null;
        const ownsAuthor = author.sourceKind === "persona" && author.sourceEntityId === input.viewerPersonaId;
        const subscriptions = await tx
          .select()
          .from(noodleAccountSubscriptions)
          .where(
            and(
              eq(noodleAccountSubscriptions.viewerAccountId, input.viewerPersonaId),
              eq(noodleAccountSubscriptions.creatorAccountId, author.id),
            ),
          );
        const unlocks = await tx
          .select()
          .from(noodlePostUnlocks)
          .where(
            and(eq(noodlePostUnlocks.viewerAccountId, input.viewerPersonaId), eq(noodlePostUnlocks.postId, postId)),
          );
        if (
          !ownsAuthor &&
          !canViewNoodlerPost({
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
            .from(noodleInteractions)
            .where(
              and(
                eq(noodleInteractions.postId, postId),
                eq(noodleInteractions.actorAccountId, actor.id),
                eq(noodleInteractions.type, input.type),
                parentInteractionId
                  ? eq(noodleInteractions.parentInteractionId, parentInteractionId)
                  : isNull(noodleInteractions.parentInteractionId),
              ),
            )
        )[0];
        if (!existing) return null;
        await deleteInteractionChildren(tx, existing.id);
        await tx.delete(noodleInteractions).where(eq(noodleInteractions.id, existing.id));
        return mapInteraction(existing);
      });
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
