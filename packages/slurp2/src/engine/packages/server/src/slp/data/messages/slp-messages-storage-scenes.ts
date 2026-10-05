/**
 * The scene lock on a DM thread (docs/SCENES.md).
 *
 * The Engine claims a thread when a roleplay scene starts from it and releases it when the scene
 * ends. The lock is the scene chat id itself, so a release only ever opens the lock its own scene
 * holds, and a retried release is a no-op.
 */
import { and, eq, isNotNull } from "../../../db/file-query.js";
import { slurpMessages, slurpThreads } from "../../../db/schema/slurp.js";
import { mapMessage, mapThread } from "./slp-messages-storage-helpers.js";
import type { SlurpMessagesContext } from "./slp-messages-storage-context.js";
import type { SlurpThread } from "./slp-messages-storage-types.js";
import type { SlpSceneLine } from "../../../../../shared/src/slp/slp-roleplay-scene.js";

export function createMessagesStorageScenes(context: SlurpMessagesContext) {
  const { db } = context;
  return {
    /** Lock an open thread for this scene. False when it is gone, closed, or already in a scene. */
    async claimThreadScene(threadId: string, sceneChatId: string): Promise<boolean> {
      return db.transaction(async (tx) => {
        const current = (await tx.select().from(slurpThreads).where(eq(slurpThreads.id, threadId)))[0];
        if (!current || current.state !== "active" || current.sceneChatId) return false;
        const timestamp = new Date().toISOString();
        await tx
          .update(slurpThreads)
          .set({ sceneChatId, sceneStartedAt: timestamp, updatedAt: timestamp })
          .where(eq(slurpThreads.id, threadId));
        return true;
      });
    },
    /** Open the lock this scene holds. False when the thread holds no lock, or another scene's. */
    async releaseThreadScene(threadId: string, sceneChatId: string): Promise<boolean> {
      return db.transaction(async (tx) => {
        const current = (await tx.select().from(slurpThreads).where(eq(slurpThreads.id, threadId)))[0];
        if (!current || current.sceneChatId !== sceneChatId) return false;
        await tx
          .update(slurpThreads)
          .set({ sceneChatId: null, sceneStartedAt: null, updatedAt: new Date().toISOString() })
          .where(eq(slurpThreads.id, threadId));
        return true;
      });
    },
    /** Replace the scene line on a message: a recap's reach, or an invite's answer. */
    async setSceneLine(messageId: string, scene: SlpSceneLine): Promise<void> {
      const row = (await db.select().from(slurpMessages).where(eq(slurpMessages.id, messageId)))[0];
      if (!row) return;
      await db
        .update(slurpMessages)
        .set({ metadata: JSON.stringify({ ...mapMessage(row).metadata, scene }) })
        .where(eq(slurpMessages.id, messageId));
    },
    /** Every thread of this Creator that is in a scene. Any one of them makes the Creator busy. */
    async listCreatorSceneThreads(creatorAccountId: string): Promise<SlurpThread[]> {
      const rows = await db
        .select()
        .from(slurpThreads)
        .where(and(eq(slurpThreads.creatorAccountId, creatorAccountId), isNotNull(slurpThreads.sceneChatId)));
      return rows.map(mapThread);
    },
    /** Every thread in a scene, for the scheduler passes that skip busy Creators. */
    async listSceneThreads(): Promise<SlurpThread[]> {
      return (await db.select().from(slurpThreads).where(isNotNull(slurpThreads.sceneChatId))).map(mapThread);
    },
  };
}
