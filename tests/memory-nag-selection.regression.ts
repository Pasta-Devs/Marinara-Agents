import assert from "node:assert/strict";
import {
  emptyMemoryNagVault,
  type MemoryNagMemory,
} from "../packages/memory-nag/src/engine/packages/shared/src/features/agents/memory-nag/schema.ts";
import { shortlistMemoryNags } from "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/retrieval.ts";
import { memoryNagScanStart } from "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/scanner.ts";
import { selectMemoryNagRecall } from "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/selection.ts";
import { reconcileMemoryNagRecall } from "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/vault.ts";

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
      text: "A promise remains unsettled.",
      characterIds: ["dottore", "pierro"],
      status: "active",
      sourceMessageIds: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "dottore-note",
      text: "Dottore mentioned Columbina.",
      characterIds: ["dottore"],
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
    recentMessages: [{ role: "user", content: "Pierro asks Dottore about Columbina." }],
    mainResponse: "Dottore changes the subject.",
    gameState: null,
    characters: [],
    memory: {},
  },
  perCharacter: 1,
});
assert.deepEqual(
  shortlisted.map((memory) => memory.id),
  ["dottore-note", "promise"],
);

const checkpointVault = { checkpointMessageId: "deleted-message", checkpointMessageCount: 20 };
assert.equal(
  memoryNagScanStart(
    checkpointVault,
    Array.from({ length: 25 }, (_, index) => ({ id: `m-${index}` })),
  ),
  20,
);
assert.equal(
  memoryNagScanStart({ ...checkpointVault, checkpointMessageId: "m-9" }, [{ id: "m-9" }, { id: "m-10" }]),
  1,
);

const recalledMemory: MemoryNagMemory = {
  id: "promise",
  text: "Dottore promised Pierro to capture Columbina.",
  characterIds: ["dottore", "pierro"],
  status: "active",
  sourceMessageIds: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const recalledVault = {
  ...emptyMemoryNagVault("chat"),
  memories: [recalledMemory],
  lastRecall: {
    memoryIds: [recalledMemory.id],
    nags: [recalledMemory.text],
    createdAt: "2026-01-01T00:01:00.000Z",
  },
};
assert.ok(reconcileMemoryNagRecall(recalledVault, recalledVault).lastRecall);
assert.equal(
  reconcileMemoryNagRecall(recalledVault, {
    ...recalledVault,
    memories: [{ ...recalledMemory, status: "resolved" }],
  }).lastRecall,
  null,
);
assert.equal(
  reconcileMemoryNagRecall(recalledVault, {
    ...recalledVault,
    memories: [{ ...recalledMemory, characterIds: ["dottore"] }],
  }).lastRecall,
  null,
);

console.info("Memory Nag regressions passed");
