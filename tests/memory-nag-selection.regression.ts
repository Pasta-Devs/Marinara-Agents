import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  emptyMemoryNagVault,
  MEMORY_NAG_DEFAULT_VAULT_PROMPT,
  normalizeMemoryNagSettings,
  type MemoryNagMemory,
} from "../packages/memory-nag/src/engine/packages/shared/src/features/agents/memory-nag/schema.ts";
import { shortlistMemoryNags } from "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/retrieval.ts";
import {
  buildMemoryNagScanMessages,
  memoryNagScanStart,
} from "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/scanner.ts";
import { memoryNagAgentRuntime } from "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/agent-runtime.ts";
import { configureMemoryNagRuntime } from "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/package-runtime.ts";
import { memoryNagRoutes } from "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/routes.ts";
import { selectMemoryNagRecall } from "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/selection.ts";
import { reconcileMemoryNagRecall } from "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/vault.ts";

const candidates = [
  { id: "promise", text: "Dottore promised Pierro to capture Columbina." },
  { id: "injury", text: "Dottore cut his finger the last time he used a scalpel." },
];

assert.equal(normalizeMemoryNagSettings({}).vaultPrompt, MEMORY_NAG_DEFAULT_VAULT_PROMPT);
assert.equal(
  normalizeMemoryNagSettings({
    vaultPrompt: `Read this roleplay batch and save only details worth nagging a character about later.
Keep each memory to one short sentence. Capture promises, meaningful actions, relationship changes, mistakes, debts, injuries, and memorable admissions.
A memory can belong to more than one character. Skip the user unless they explicitly asked a character to remember something.
You may quote a short dialogue line verbatim when its exact wording matters, then name the speaker and rough context.
Resolve an existing memory only when this batch clearly settles it. Never invent character IDs.`,
  }).vaultPrompt,
  MEMORY_NAG_DEFAULT_VAULT_PROMPT,
);
assert.equal(normalizeMemoryNagSettings({ vaultPrompt: "  Keep only promises.  " }).vaultPrompt, "Keep only promises.");
const customScanMessages = buildMemoryNagScanMessages({
  participants: [{ id: "dottore", name: "Dottore", current: true }],
  transcript: "Dottore promised to behave.",
  existing: [],
  perCharacter: 3,
  vaultPrompt: "Keep only promises.",
});
assert.match(customScanMessages[0]!.content, /^Keep only promises\./);
assert.match(customScanMessages[0]!.content, /Create at most 3 memories/);
assert.ok(
  customScanMessages[0]!.content.endsWith(
    'Return only JSON: {"memories":[{"text":"...","characterIds":["id"]}],"resolvedMemoryIds":["existing-id"]}',
  ),
);

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
assert.deepEqual(selectMemoryNagRecall({ nags_needed: true, memory_ids: ["promise"] }, candidates, 3), {
  nags_needed: true,
  memoryIds: ["promise"],
  nags: ["Dottore promised Pierro to capture Columbina."],
});
assert.deepEqual(selectMemoryNagRecall({ nags_needed: true, nags: [{ id: "injury" }] }, candidates, 3), {
  nags_needed: true,
  memoryIds: ["injury"],
  nags: ["Dottore cut his finger the last time he used a scalpel."],
});
assert.deepEqual(selectMemoryNagRecall({ nags_needed: true, nags: ["remember the promise"] }, candidates, 3), {
  nags_needed: false,
});

const emptyRecall = { memoryIds: [], nags: [], createdAt: "2026-08-24T12:00:00.000Z" };
assert.deepEqual(
  reconcileMemoryNagRecall(emptyMemoryNagVault("chat-empty"), {
    ...emptyMemoryNagVault("chat-empty"),
    lastRecall: emptyRecall,
  }).lastRecall,
  emptyRecall,
  "a successful empty recall must remain distinct from a tracker that has never run",
);

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
  0,
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

async function assertFailedRecallPreservesCompletedRecall(): Promise<void> {
  let storedVaultDocument: Record<string, unknown> | null = {
    id: "memory-nag-failed-recall",
    revision: 1,
    data: recalledVault,
  };
  function storedLastRecall(): unknown {
    assert.ok(storedVaultDocument);
    return (storedVaultDocument.data as { lastRecall: unknown }).lastRecall;
  }
  const releaseRuntime = configureMemoryNagRuntime({
    persistence: {
      documents: {
        getById: async () => storedVaultDocument,
        create: async (document: Record<string, unknown>) => {
          storedVaultDocument = { ...document, revision: 1 };
        },
        update: async (document: Record<string, unknown>) => {
          storedVaultDocument = { ...storedVaultDocument, ...document, revision: 2 };
          return storedVaultDocument;
        },
      },
      listMessages: async () => [],
    },
    logger: { warn: () => undefined },
  } as never);
  const recallContext = { chatId: "failed-recall", chatMode: "roleplay" } as never;
  const preparedRecall = {
    participants: [],
    currentCharacterIds: [],
    candidates: [{ id: recalledMemory.id, text: recalledMemory.text, characterIds: recalledMemory.characterIds }],
    maximumNags: 1,
  };
  try {
    await memoryNagAgentRuntime.finalizeResult({
      agent: {} as never,
      context: recallContext,
      preparedContext: preparedRecall,
      result: { success: true, data: { nags_needed: true, memoryIds: [recalledMemory.id] } } as never,
    });
    const completedRecall = structuredClone(storedLastRecall());
    await memoryNagAgentRuntime.finalizeResult({
      agent: {} as never,
      context: recallContext,
      preparedContext: preparedRecall,
      result: { success: false, error: "provider failed" } as never,
    });
    assert.deepEqual(
      storedLastRecall(),
      completedRecall,
      "a failed recall must preserve the last completed recall timestamp and nag data",
    );
  } finally {
    releaseRuntime();
  }
}
assert.equal(
  reconcileMemoryNagRecall(recalledVault, {
    ...recalledVault,
    memories: [{ ...recalledMemory, characterIds: ["dottore"] }],
  }).lastRecall,
  null,
);

const registeredRoutes: Array<{ method: string; options: Record<string, unknown> }> = [];
const routeCollector = Object.fromEntries(
  ["delete", "get", "patch", "post", "put"].map((method) => [
    method,
    (_path: string, options: unknown, handler?: unknown) => {
      registeredRoutes.push({
        method,
        options: typeof handler === "function" && options && typeof options === "object" ? options : {},
      });
    },
  ]),
);
void memoryNagRoutes(routeCollector as never, {});
assert.equal(registeredRoutes.length, 8);
assert.ok(
  registeredRoutes.every((route) => typeof route.options.preHandler === "function"),
  "every Memory Nag route must carry its Roleplay-only guard without relying on package-level Fastify hooks",
);

const memoryNagToolbarSource = readFileSync(
  new URL(
    "../packages/memory-nag/src/engine/packages/client/src/features/memory-nag/MemoryNagToolbar.tsx",
    import.meta.url,
  ),
  "utf8",
);
const memoryNagStyles = readFileSync(
  new URL("../packages/memory-nag/src/engine/packages/client/src/features/memory-nag/styles.ts", import.meta.url),
  "utf8",
);
const memoryNagTrackerSource = readFileSync(
  new URL(
    "../packages/memory-nag/src/engine/packages/client/src/features/memory-nag/MemoryNagTrackerPanel.tsx",
    import.meta.url,
  ),
  "utf8",
);
const memoryNagRuntimeSource = readFileSync(
  new URL(
    "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/agent-runtime.ts",
    import.meta.url,
  ),
  "utf8",
);
const memoryNagVaultSource = readFileSync(
  new URL("../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/vault.ts", import.meta.url),
  "utf8",
);
assert.doesNotMatch(
  memoryNagToolbarSource,
  /!enabled\s*\|\|\s*props\.mobileCompact/u,
  "compact Roleplay layouts must retain the Memory Nag toolbar control",
);
assert.match(memoryNagToolbarSource, /toolbarButtonClass/u, "Memory Nag must reuse the host toolbar button class");
assert.match(memoryNagToolbarSource, /\}, 3000\);/u, "Memory Nag toolbar words must cycle at the slower interval");
assert.match(
  memoryNagToolbarSource,
  /return words\.length > 0 \? words : splitWords\(empty, 1\);/u,
  "Memory Nag idle words must keep the full localized phrase, including short words",
);
assert.match(
  memoryNagToolbarSource,
  /word\.length >= minimumLength && \/\[\\p\{L\}\\p\{N\}\]\/u\.test\(word\)/u,
  "Memory Nag toolbar words must contain a letter or number",
);
assert.match(
  memoryNagToolbarSource,
  /\\p\{L\}\\p\{N\}\\p\{M\}/u,
  "Memory Nag toolbar words must preserve Unicode combining marks",
);
assert.match(memoryNagToolbarSource, /data-chat-floating-panel/u, "Memory Nag must portal a floating tracker panel");
assert.match(
  memoryNagToolbarSource,
  /hasCompletedRecall \? \([\s\S]*mn-toolbar-word[\s\S]*<MessageSquareQuote className="mn-toolbar-initial-icon"/u,
  "Memory Nag must show its dialogue icon until the tracker completes its first successful recall",
);
assert.match(
  memoryNagRuntimeSource,
  /: \{ memoryIds: \[\], nags: \[\], createdAt: new Date\(\)\.toISOString\(\) \}/u,
  "a successful no-nag result must persist an empty recall record",
);
assert.match(
  memoryNagVaultSource,
  /if \(nags\.length === 0 && !createdAt\) return null;/u,
  "persisted empty recall records must survive vault normalization only when they are timestamped",
);
assert.doesNotMatch(
  memoryNagStyles,
  /\.mn-toolbar-button\s*\{[^}]*(?:width|height|min-width):/su,
  "Memory Nag must not override the host tracker button dimensions",
);
assert.match(
  memoryNagStyles,
  /--tracker-panel-section-background/u,
  "Memory Nag must reuse the native Tracker Panel section surface",
);
assert.match(memoryNagTrackerSource, /setCollapsed/u, "Memory Nag Tracker Panel section must be collapsible");
assert.match(memoryNagTrackerSource, /mn-tracker-veil/u, "Memory Nag must reuse the Tracker Panel readability veil");
assert.match(
  memoryNagStyles,
  /--tracker-profile-icon, var\(--muted-foreground\)/u,
  "Memory Nag section icons must inherit the neutral Tracker Panel header color",
);
assert.doesNotMatch(memoryNagStyles, /--mn-chroma:[^;]*--primary/u, "Memory Nag must not fall back to primary pink");

void assertFailedRecallPreservesCompletedRecall().then(
  () => console.info("Memory Nag regressions passed"),
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
