import { and, desc, eq, ne, or } from "drizzle-orm";
import type { SpatialContextSnapshot, SpatialSnapshotSource } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { spatialContextSnapshots } from "../../db/schema/index.js";
import { newTimeSortableId, now } from "../../utils/id-generator.js";

type SpatialSnapshotConnection = Pick<DB, "select" | "insert" | "delete" | "update">;

export interface CreateSpatialSnapshotInput {
  chatId: string;
  messageId?: string;
  swipeIndex?: number;
  currentLocationId: string | null;
  definitionRevision: number;
  source: SpatialSnapshotSource;
  transitionCommandId?: string | null;
  transitionPayloadHash?: string | null;
}

function mapSnapshot(row: typeof spatialContextSnapshots.$inferSelect): SpatialContextSnapshot {
  return {
    id: row.id,
    chatId: row.chatId,
    messageId: row.messageId,
    swipeIndex: row.swipeIndex,
    currentLocationId: row.currentLocationId,
    definitionRevision: row.definitionRevision,
    source: row.source as SpatialSnapshotSource,
    transitionCommandId: row.transitionCommandId,
    transitionPayloadHash: row.transitionPayloadHash,
    createdAt: row.createdAt,
  };
}

export function createSpatialContextStorage(db: SpatialSnapshotConnection) {
  return {
    async getById(id: string): Promise<SpatialContextSnapshot | null> {
      const rows = await db.select().from(spatialContextSnapshots).where(eq(spatialContextSnapshots.id, id)).limit(1);
      return rows[0] ? mapSnapshot(rows[0]) : null;
    },

    async getByAnchor(chatId: string, messageId: string, swipeIndex: number): Promise<SpatialContextSnapshot | null> {
      const rows = await db
        .select()
        .from(spatialContextSnapshots)
        .where(
          and(
            eq(spatialContextSnapshots.chatId, chatId),
            eq(spatialContextSnapshots.messageId, messageId),
            eq(spatialContextSnapshots.swipeIndex, swipeIndex),
          ),
        )
        .limit(1);
      return rows[0] ? mapSnapshot(rows[0]) : null;
    },

    async getByCommand(chatId: string, commandId: string): Promise<SpatialContextSnapshot | null> {
      const rows = await db
        .select()
        .from(spatialContextSnapshots)
        .where(
          and(eq(spatialContextSnapshots.chatId, chatId), eq(spatialContextSnapshots.transitionCommandId, commandId)),
        )
        .limit(1);
      return rows[0] ? mapSnapshot(rows[0]) : null;
    },

    async listByAnchors(
      chatId: string,
      anchors: Array<{ messageId: string; swipeIndex: number }>,
    ): Promise<SpatialContextSnapshot[]> {
      if (anchors.length === 0) return [];
      const rows = await db
        .select()
        .from(spatialContextSnapshots)
        .where(
          and(
            eq(spatialContextSnapshots.chatId, chatId),
            or(
              ...anchors.map((anchor) =>
                and(
                  eq(spatialContextSnapshots.messageId, anchor.messageId),
                  eq(spatialContextSnapshots.swipeIndex, anchor.swipeIndex),
                ),
              ),
            ),
          ),
        );
      return rows.map(mapSnapshot);
    },

    async listForChat(chatId: string): Promise<SpatialContextSnapshot[]> {
      const rows = await db.select().from(spatialContextSnapshots).where(eq(spatialContextSnapshots.chatId, chatId));
      return rows.map(mapSnapshot);
    },

    async hasMessageSnapshots(chatId: string): Promise<boolean> {
      const rows = await db
        .select({ id: spatialContextSnapshots.id })
        .from(spatialContextSnapshots)
        .where(and(eq(spatialContextSnapshots.chatId, chatId), ne(spatialContextSnapshots.messageId, "")))
        .limit(1);
      return rows.length > 0;
    },

    async getLatest(chatId: string): Promise<SpatialContextSnapshot | null> {
      const rows = await db
        .select()
        .from(spatialContextSnapshots)
        .where(eq(spatialContextSnapshots.chatId, chatId))
        .orderBy(desc(spatialContextSnapshots.createdAt), desc(spatialContextSnapshots.id))
        .limit(1);
      return rows[0] ? mapSnapshot(rows[0]) : null;
    },

    async getBootstrap(chatId: string): Promise<SpatialContextSnapshot | null> {
      const rows = await db
        .select()
        .from(spatialContextSnapshots)
        .where(and(eq(spatialContextSnapshots.chatId, chatId), eq(spatialContextSnapshots.messageId, "")))
        .orderBy(desc(spatialContextSnapshots.createdAt), desc(spatialContextSnapshots.id))
        .limit(1);
      return rows[0] ? mapSnapshot(rows[0]) : null;
    },

    async create(input: CreateSpatialSnapshotInput): Promise<SpatialContextSnapshot> {
      const row: typeof spatialContextSnapshots.$inferInsert = {
        id: newTimeSortableId(),
        chatId: input.chatId,
        messageId: input.messageId ?? "",
        swipeIndex: input.swipeIndex ?? 0,
        currentLocationId: input.currentLocationId,
        definitionRevision: input.definitionRevision,
        source: input.source,
        transitionCommandId: input.transitionCommandId ?? null,
        transitionPayloadHash: input.transitionPayloadHash ?? null,
        createdAt: now(),
      };
      await db.insert(spatialContextSnapshots).values(row);
      return mapSnapshot(row as typeof spatialContextSnapshots.$inferSelect);
    },

    async replaceBootstrap(input: Omit<CreateSpatialSnapshotInput, "messageId" | "swipeIndex">) {
      await db
        .delete(spatialContextSnapshots)
        .where(and(eq(spatialContextSnapshots.chatId, input.chatId), eq(spatialContextSnapshots.messageId, "")));
      return this.create({ ...input, messageId: "", swipeIndex: 0 });
    },
    async replaceAtAnchor(input: CreateSpatialSnapshotInput) {
      const messageId = input.messageId ?? "";
      const swipeIndex = input.swipeIndex ?? 0;
      await db
        .delete(spatialContextSnapshots)
        .where(
          and(
            eq(spatialContextSnapshots.chatId, input.chatId),
            eq(spatialContextSnapshots.messageId, messageId),
            eq(spatialContextSnapshots.swipeIndex, swipeIndex),
          ),
        );
      return this.create({ ...input, messageId, swipeIndex });
    },
  };
}
