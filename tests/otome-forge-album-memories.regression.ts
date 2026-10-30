import assert from "node:assert/strict";
import test from "node:test";
import {
  albumMemories,
  isUnplayedMemory,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/album-memories.ts";
import type { AlbumMemory } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/wardrobe.ts";

function memory(id: string, rarity: 3 | 4 | 5, read: AlbumMemory["read"]): AlbumMemory {
  return {
    id,
    kind: rarity === 3 ? "snapshot3" : rarity === 4 ? "moment4" : "memory5",
    rarity,
    read,
    banner: "memories-1",
    li: null,
    title: id,
    owned: true,
    art: null,
    story: read ? { key: `story-${id}` } : null,
  };
}

const memories = [
  memory("done-a", 5, "done"),
  memory("snapshot", 3, null),
  memory("unread-a", 4, "unread"),
  memory("reading", 5, "in-progress"),
  memory("unopened", 5, null),
  memory("unread-b", 4, "unread"),
  memory("done-b", 4, "done"),
  memory("unread-c", 5, "unread"),
];

test("Album partitions unplayed stories stably without mistaking missing art or Snapshots for progress", () => {
  const before = structuredClone(memories);
  assert.deepEqual(
    albumMemories(memories, "all").map((item) => item.id),
    ["unread-a", "unopened", "unread-b", "unread-c", "done-a", "snapshot", "reading", "done-b"],
  );
  assert.equal(isUnplayedMemory(memories[0]!), false, "a completed story without art stays played");
  assert.equal(isUnplayedMemory(memories[1]!), false, "a Snapshot has no playable story");
  assert.equal(isUnplayedMemory(memories[3]!), false, "a story already started has been played");
  assert.deepEqual(memories, before, "sorting never mutates the query's acquisition order or progress");
});

test("each Album rarity filter retains the same stable partition and empty filters stay empty", () => {
  assert.deepEqual(
    albumMemories(memories, 3).map((item) => item.id),
    ["snapshot"],
  );
  assert.deepEqual(
    albumMemories(memories, 4).map((item) => item.id),
    ["unread-a", "unread-b", "done-b"],
  );
  assert.deepEqual(
    albumMemories(memories, 5).map((item) => item.id),
    ["unopened", "unread-c", "done-a", "reading"],
  );
  assert.deepEqual(albumMemories([], "all"), []);
  assert.deepEqual(albumMemories([memories[0]!], 3), []);
});
