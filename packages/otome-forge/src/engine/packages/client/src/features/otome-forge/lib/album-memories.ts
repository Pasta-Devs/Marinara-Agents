import type { AlbumMemory } from "../shared/wardrobe";
import type { Rarity } from "../shared/wish";

export type MemoryRarityFilter = "all" | Rarity;

/** Snapshots have no playable story; unopened Memories and Moments have no chapter progress yet. */
export function isUnplayedMemory(item: AlbumMemory): boolean {
  return (item.kind === "memory5" || item.kind === "moment4") && (item.read === null || item.read === "unread");
}

/** Stable partition of the server's acquisition order, without changing its cached collection. */
export function albumMemories(memories: readonly AlbumMemory[], rarity: MemoryRarityFilter): AlbumMemory[] {
  return memories
    .filter((item) => rarity === "all" || item.rarity === rarity)
    .sort((a, b) => Number(isUnplayedMemory(b)) - Number(isUnplayedMemory(a)));
}
