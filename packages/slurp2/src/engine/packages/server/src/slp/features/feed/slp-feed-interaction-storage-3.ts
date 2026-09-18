import { and, eq, isNull, like, or } from "../../../db/file-query.js";
import { NoodleAuthorSnapshot, NoodleInteraction } from "@marinara-engine/shared";
import { isSlurpFileUniqueConstraintError } from "../../base/host/slp-file-errors.js";
import {
  NOODLE_FAN_ACTIVITY_MAX_ACTIVITIES_PER_CREATOR,
  parsePersistedNoodleFanActivityDayPlan,
} from "../../../services/slurp/slurp-fan-activity-day-plan.js";
import { canViewNoodlerPost, isNoodlerHiddenFromViewer } from "../../../services/slurp/slurp-access.js";
import {
  noodleAccounts,
  noodleAccountSubscriptions,
  noodleInteractions,
  noodlePosts,
  noodlePostUnlocks,
  noodlerFanActivityState,
  slurpPopulation,
} from "../../../db/schema/slurp.js";
import { newId, now } from "../../../utils/id-generator.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import { SLURP_SETTINGS_KEY } from "../../base/host/slp-storage-constants.js";
import { isToggleInteractionType } from "../../base/host/slp-storage-model.js";
import type { NoodlerCreateInteractionCommand } from "../../base/host/slp-storage-model.js";
import { normalizeSlurpSettings } from "../../base/settings/slp-settings.js";
import { mapAccount, snapshotForAccount, mapPost, mapInteraction } from "../../base/host/slp-storage-mappers.js";
import type { SlurpStorageContext } from "../../base/host/slp-storage-context.js";

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
      input: NoodlerCreateInteractionCommand,
    ): Promise<NoodleInteraction | null> {
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
        if (actor.kind !== "persona" || isNoodlerHiddenFromViewer(author, input.viewerPersonaId)) return null;
        const ownsAuthor = author.sourceKind === "persona" && author.sourceEntityId === input.viewerPersonaId;
        const subscribed =
          (
            await tx
              .select()
              .from(noodleAccountSubscriptions)
              .where(
                and(
                  eq(noodleAccountSubscriptions.viewerAccountId, input.viewerPersonaId),
                  eq(noodleAccountSubscriptions.creatorAccountId, author.id),
                ),
              )
          ).length > 0;
        const unlocked = await tx
          .select()
          .from(noodlePostUnlocks)
          .where(
            and(eq(noodlePostUnlocks.viewerAccountId, input.viewerPersonaId), eq(noodlePostUnlocks.postId, postId)),
          );
        if (
          !ownsAuthor &&
          !canViewNoodlerPost({
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
          if (already) return mapInteraction(already);
        }
        if (parentInteractionId) {
          const parent = (
            await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, parentInteractionId))
          )[0];
          if (!parent || parent.postId !== postId || parent.type !== "reply") return null;
        }
        const id = newId();
        try {
          await tx.insert(noodleInteractions).values({
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
          return existing ? mapInteraction(existing) : null;
        }
        const stored = (await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, id)))[0];
        return stored ? mapInteraction(stored) : null;
      });
    },
    async createNoodlerFanInteraction(
      postId: string,
      input: {
        id: string;
        creatorAccountId: string;
        actorId: string;
        actorSnapshot: NoodleAuthorSnapshot;
        runId: string;
        type: "like" | "reply" | "repost";
        content: string | null;
        /** The comment being answered. Null, or an unusable id, means answering the post. */
        parentInteractionId?: string | null;
      },
    ): Promise<{ interaction: NoodleInteraction; created: boolean } | null> {
      return db.transaction(async (tx) => {
        const postRows = await tx.select().from(noodlePosts).where(eq(noodlePosts.id, postId));
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
          .from(noodleAccounts)
          .where(and(eq(noodleAccounts.id, input.creatorAccountId), eq(noodleAccounts.platform, "slurp")));
        if (!creatorRows[0]) return null;
        const settings = normalizeSlurpSettings(await createAppSettingsStorage(tx).get(SLURP_SETTINGS_KEY));
        const creator = mapAccount(creatorRows[0]);
        const override = creator.settings.scheduler.fanActivity;
        if (!settings.fanActivityEnabled || override?.enabled === false) return null;
        const actorAccountRow = (
          await tx
            .select()
            .from(noodleAccounts)
            .where(and(eq(noodleAccounts.id, input.actorId), eq(noodleAccounts.platform, "slurp")))
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

        const stateRows = await tx.select().from(noodlerFanActivityState);
        const plan = stateRows
          .flatMap((row) => {
            try {
              const parsed = parsePersistedNoodleFanActivityDayPlan(JSON.parse(row.plan));
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

        const stableRows = await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, input.id));
        if (stableRows[0]) return { interaction: mapInteraction(stableRows[0]), created: false };

        const existingRows = await tx
          .select()
          .from(noodleInteractions)
          .where(
            and(
              eq(noodleInteractions.postId, postId),
              eq(noodleInteractions.actorAccountId, input.actorId),
              eq(noodleInteractions.type, input.type),
              isNull(noodleInteractions.parentInteractionId),
            ),
          );
        const content = input.type === "reply" ? input.content?.trim() || null : null;
        const duplicate = existingRows[0];
        if (duplicate) return { interaction: mapInteraction(duplicate), created: false };
        if (input.type === "reply" && !content) return null;

        await tx.insert(noodleInteractions).values({
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
        const rows = await tx.select().from(noodleInteractions).where(eq(noodleInteractions.id, input.id));
        return rows[0] ? { interaction: mapInteraction(rows[0]), created: true } : null;
      });
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
