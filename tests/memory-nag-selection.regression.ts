import assert from "node:assert/strict";
import { shortlistMemoryNags } from "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/retrieval.ts";
import { selectMemoryNagRecall } from "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/selection.ts";

const candidates = [
  { id: "promise", text: "Dottore promised Pierro to capture Columbina." },
  { id: "injury", text: "Dottore cut his finger the last time he used a scalpel." },
];

assert.deepEqual(selectMemoryNagRecall({ nags_needed: false, memoryIds: ["promise"] }, candidates, 3), {
  nags_needed: false,
});
assert.deepEqual(
  selectMemoryNagRecall({ nags_needed: true, memoryIds: ["invented", "promise", "injury"] }, candidates, 1),
  {
    nags_needed: true,
    memoryIds: ["promise"],
    nags: ["Dottore promised Pierro to capture Columbina."],
  },
);
assert.deepEqual(selectMemoryNagRecall({ nags_needed: true, memoryIds: ["invented"] }, candidates, 3), {
  nags_needed: false,
});

const shortlisted = shortlistMemoryNags({
  memories: [
    {
      id: "promise",
      text: "Dottore promised Pierro to capture Columbina.",
      characterIds: ["dottore", "pierro"],
      status: "active",
      sourceMessageIds: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "resolved",
      text: "Dottore already paid Pierro.",
      characterIds: ["dottore", "pierro"],
      status: "resolved",
      sourceMessageIds: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ],
  participants: [
    { id: "dottore", name: "Dottore", current: true },
    { id: "pierro", name: "Pierro", current: true },
  ],
  context: {
    chatId: "chat",
    chatMode: "roleplay",
    recentMessages: [{ role: "user", content: "Pierro asks Dottore about Columbina.", characterId: "pierro" }],
    mainResponse: "Dottore changes the subject.",
    gameState: null,
    characters: [],
    memory: {},
  },
  perCharacter: 1,
});
assert.deepEqual(
  shortlisted.map((memory) => memory.id),
  ["promise"],
);

console.info("Memory Nag selection regression passed");
