import type {
  CapabilityPersistenceSession,
  CapabilitySpatialSnapshotWrite,
  SpatialContextSnapshot,
  SpatialSnapshotSource,
} from "@marinara-engine/shared";
import { getPackagePersistence, newTimeSortableId, now } from "../spatial-context/package-runtime.js";

type SpatialSnapshotPersistence = Pick<CapabilityPersistenceSession, "spatialSnapshots">;

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

function snapshotWrite(input: CreateSpatialSnapshotInput): CapabilitySpatialSnapshotWrite {
  return {
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
}

export function createSpatialContextStorage(
  persistence: SpatialSnapshotPersistence = getPackagePersistence(),
) {
  const snapshots = persistence.spatialSnapshots;
  return {
    getById(id: string): Promise<SpatialContextSnapshot | null> {
      return snapshots.getById(id);
    },

    getByAnchor(chatId: string, messageId: string, swipeIndex: number): Promise<SpatialContextSnapshot | null> {
      return snapshots.getByAnchor(chatId, messageId, swipeIndex);
    },

    getByCommand(chatId: string, commandId: string): Promise<SpatialContextSnapshot | null> {
      return snapshots.getByCommand(chatId, commandId);
    },

    listByAnchors(
      chatId: string,
      anchors: Array<{ messageId: string; swipeIndex: number }>,
    ): Promise<SpatialContextSnapshot[]> {
      return snapshots.listByAnchors(chatId, anchors);
    },

    listForChat(chatId: string): Promise<SpatialContextSnapshot[]> {
      return snapshots.listForChat(chatId);
    },

    hasMessageSnapshots(chatId: string): Promise<boolean> {
      return snapshots.hasMessageSnapshots(chatId);
    },

    getLatest(chatId: string): Promise<SpatialContextSnapshot | null> {
      return snapshots.getLatest(chatId);
    },

    getBootstrap(chatId: string): Promise<SpatialContextSnapshot | null> {
      return snapshots.getBootstrap(chatId);
    },

    create(input: CreateSpatialSnapshotInput): Promise<SpatialContextSnapshot> {
      return snapshots.create(snapshotWrite(input));
    },

    replaceBootstrap(
      input: Omit<CreateSpatialSnapshotInput, "messageId" | "swipeIndex">,
    ): Promise<SpatialContextSnapshot> {
      return snapshots.replaceBootstrap(snapshotWrite({ ...input, messageId: "", swipeIndex: 0 }));
    },

    replaceAtAnchor(input: CreateSpatialSnapshotInput): Promise<SpatialContextSnapshot> {
      return snapshots.replaceAtAnchor(snapshotWrite(input));
    },
  };
}
