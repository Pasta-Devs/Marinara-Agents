import { and, eq, isNull, like, or } from "../../../db/file-query.js";
import { SlpAuthorSnapshot, SlpInteraction } from "../../../../../shared/src/slp/slp-social.types.js";
import { isSlurpFileUniqueConstraintError } from "../../base/host/slp-file-errors.js";
import {
  NOODLE_FAN_ACTIVITY_MAX_ACTIVITIES_PER_CREATOR,
  parsePersistedSlpFanActivityDayPlan,
} from "../../modules/audience/slp-fan-activity-day-plan.js";
import { canViewCreatorPost } from "../../base/identity/slp-access.js";
import {
  slpAccounts,
  slpAccountSubscriptions,
  slpInteractions,
  slpPosts,
  slpPostUnlocks,
  slpCreatorFanActivityState,
  slurpPopulation,
} from "../../../db/schema/slurp.js";
import { newId, now } from "../../../utils/id-generator.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import { SLURP_SETTINGS_KEY } from "../host/slp-storage-constants.js";
import { isToggleInteractionType } from "../../modules/records/slp-storage-model.js";
import type { SlpCreatorCreateInteractionCommand } from "../../modules/records/slp-storage-model.js";
import { normalizeSlurpSettings } from "../../modules/settings/slp-settings.js";
import { mapAccount, snapshotForAccount, mapPost, mapInteraction } from "../host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../host/slp-storage-context.js";

export function createFeedInteractionStorage3(context: SlurpStorageContext) {
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
    async createNoodlerInteraction(
      postId: string,
      input: SlpCreatorCreateInteractionCommand,
    ): Promise<SlpInteraction | null> {
      const parentInteractionId = input.parentInteractionId ?? null;
      const viewer = await this.getViewer(input.viewerPersonaId);
      const actor = await this.getNoodlerAccountById(input.actorAccountId);
      if (
        !viewer ||
        !actor ||
        actor.kind !== "persona" ||
        actor.sourceKind !== "persona" ||
        actor.sourceEntityId !== input.viewerPersonaId
      ) {
        return null;
      }
      if (input.type === "vote") {
        if (parentInteractionId) return null;
        return upsertPollVote(postId, actor, input.viewerPersonaId, input.content?.trim() ?? "", "slurp", null);
      }
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
        if (actor.kind !== "persona") return null;
        const ownsAuthor = author.sourceKind === "persona" && author.sourceEntityId === input.viewerPersonaId;
        const subscribed =
          (
            await tx
              .select()
              .from(slpAccountSubscriptions)
              .where(
                and(
                  eq(slpAccountSubscriptions.viewerAccountId, input.viewerPersonaId),
                  eq(slpAccountSubscriptions.creatorAccountId, author.id),
                ),
              )
          ).length > 0;
        const unlocked = await tx
          .select()
          .from(slpPostUnlocks)
          .where(and(eq(slpPostUnlocks.viewerAccountId, input.viewerPersonaId), eq(slpPostUnlocks.postId, postId)));
        if (
          !ownsAuthor &&
          !canViewCreatorPost({
            post: mapPost(postRow),
            subscribed,
            unlockedPostIds: new Set(unlocked.map((row) => row.postId)),
          })
        )
          return null;
        if (isToggleInteractionType(input.type)) {
          await normalizeLegacyNoodlerToggleInteraction(tx, {
            postId,
            actorAccountId: actor.id,
            viewerPersonaId: input.viewerPersonaId,
            type: input.type,
            parentInteractionId,
            actor,
          });
          // Liking a post that is already liked used to reach the insert and fail the unique
          // constraint. The file store asserts uniqueness when the transaction settles rather than
          // at the insert call, so the catch below never saw it and a repeated tap returned a 500.
          // A toggle is idempotent by definition: hand back the row that already exists.
          const already = (
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
          if (already) return mapInteraction(already);
        }
        if (parentInteractionId) {
          const parent = (
            await tx.select().from(slpInteractions).where(eq(slpInteractions.id, parentInteractionId))
          )[0];
          if (!parent || parent.postId !== postId || parent.type !== "reply") return null;
        }
        const id = newId();
        try {
          await tx.insert(slpInteractions).values({
            id,
            postId,
            parentInteractionId,
            actorAccountId: actor.id,
            type: input.type,
            content: input.content?.trim() || null,
            imageUrl: null,
            actorSnapshot: JSON.stringify(snapshotForAccount(actor)),
            createdAt: now(),
          });
        } catch (error) {
          if (
            !isToggleInteractionType(input.type) ||
            !isSlurpFileUniqueConstraintError(error, "slurp2_interactions", [
              "postId",
              "actorAccountId",
              "type",
              "parentInteractionId",
            ])
          )
            throw error;
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
          return existing ? mapInteraction(existing) : null;
        }
        const stored = (await tx.select().from(slpInteractions).where(eq(slpInteractions.id, id)))[0];
        return stored ? mapInteraction(stored) : null;
      });
    },
    async createNoodlerFanInteraction(
      postId: string,
      input: {
        id: string;
        creatorAccountId: string;
        actorId: string;
        actorSnapshot: SlpAuthorSnapshot;
        runId: string;
        type: "like" | "reply" | "repost";
        content: string | null;
        /** The comment being answered. Null, or an unusable id, means answering the post. */
        parentInteractionId?: string | null;
      },
    ): Promise<{ interaction: SlpInteraction; created: boolean } | null> {
      return db.transaction(async (tx) => {
        const postRows = await tx.select().from(slpPosts).where(eq(slpPosts.id, postId));
        const postRow = postRows[0];
        if (
          !postRow ||
          (postRow.access !== "public" && postRow.access !== "locked") ||
          postRow.authorAccountId !== input.creatorAccountId
        ) {
          return null;
        }
        const creatorRows = await tx
          .select()
          .from(slpAccounts)
          .where(and(eq(slpAccounts.id, input.creatorAccountId), eq(slpAccounts.platform, "slurp")));
        if (!creatorRows[0]) return null;
        const settings = normalizeSlurpSettings(await createAppSettingsStorage(tx).get(SLURP_SETTINGS_KEY));
        const creator = mapAccount(creatorRows[0]);
        const override = creator.settings.scheduler.fanActivity;
        if (!settings.fanActivityEnabled || override?.enabled === false) return null;
        const actorAccountRow = (
          await tx
            .select()
            .from(slpAccounts)
            .where(and(eq(slpAccounts.id, input.actorId), eq(slpAccounts.platform, "slurp")))
        )[0];
        const actorPopulationRow = (
          await tx.select().from(slurpPopulation).where(eq(slurpPopulation.id, input.actorId))
        )[0];
        const canonicalSnapshot = actorAccountRow
          ? snapshotForAccount(mapAccount(actorAccountRow))
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
        if (
          !canonicalSnapshot ||
          canonicalSnapshot.kind !== "random_user" ||
          JSON.stringify(canonicalSnapshot) !== JSON.stringify(input.actorSnapshot)
        )
          return null;

        const stateRows = await tx.select().from(slpCreatorFanActivityState);
        const plan = stateRows
          .flatMap((row) => {
            try {
              const parsed = parsePersistedSlpFanActivityDayPlan(JSON.parse(row.plan));
              return parsed ? [parsed] : [];
            } catch {
              return [];
            }
          })
          .find((candidate) => candidate.runs.some((run) => run.id === input.runId));
        const run = plan?.runs.find((candidate) => candidate.id === input.runId);
        const creatorActivities =
          run?.acceptedActivities.filter((activity) => activity.creatorId === input.creatorAccountId) ?? [];
        if (
          run?.status !== "applying" ||
          creatorActivities.length > NOODLE_FAN_ACTIVITY_MAX_ACTIVITIES_PER_CREATOR ||
          !creatorActivities.some(
            (activity) =>
              activity.id === input.id &&
              activity.targetPostId === postId &&
              activity.actorId === input.actorId &&
              activity.type === input.type,
          )
        ) {
          return null;
        }

        const stableRows = await tx.select().from(slpInteractions).where(eq(slpInteractions.id, input.id));
        if (stableRows[0]) return { interaction: mapInteraction(stableRows[0]), created: false };

        const existingRows = await tx
          .select()
          .from(slpInteractions)
          .where(
            and(
              eq(slpInteractions.postId, postId),
              eq(slpInteractions.actorAccountId, input.actorId),
              eq(slpInteractions.type, input.type),
              isNull(slpInteractions.parentInteractionId),
            ),
          );
        const content = input.type === "reply" ? input.content?.trim() || null : null;
        const duplicate = existingRows[0];
        if (duplicate) return { interaction: mapInteraction(duplicate), created: false };
        if (input.type === "reply" && !content) return null;

        await tx.insert(slpInteractions).values({
          id: input.id,
          postId,
          parentInteractionId: null,
          actorAccountId: input.actorId,
          type: input.type,
          content,
          imageUrl: null,
          actorSnapshot: JSON.stringify(input.actorSnapshot),
          createdAt: now(),
        });
        const rows = await tx.select().from(slpInteractions).where(eq(slpInteractions.id, input.id));
        return rows[0] ? { interaction: mapInteraction(rows[0]), created: true } : null;
      });
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
