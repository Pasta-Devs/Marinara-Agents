// Relationship Tracker and Memory Nag read a Roleplay message as Engine agents do: `agentContent` (capability API 1.71)
// when the Engine sends it, the public `content` on older Engines. Pasta-Devs/Marinara-Agents#1309.
import assert from "node:assert/strict";
import { configureMemoryNagRuntime } from "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/package-runtime.ts";
import { scanMemoryNagBatch } from "../packages/memory-nag/src/engine/packages/server/src/services/memory-nag/scanner.ts";
import { emptyMemoryNagVault } from "../packages/memory-nag/src/engine/packages/shared/src/features/agents/memory-nag/schema.ts";
import { buildHistoryModelMessages } from "../packages/relationship-tracker/history.mjs";
import { detectPresentCharacterIds } from "../packages/relationship-tracker/prompt.mjs";

const messages = [
  // A public line with a whisper at its saved offset.
  {
    id: "m1",
    role: "user",
    characterId: null,
    content: "Cora waves.",
    agentContent: "Cora waves. [Private whisper to Bram: WHISPER_A]",
    extra: "{}",
    createdAt: "2026-10-13T10:00:00Z",
  },
  // A whisper-only message: empty public content, the whisper as the agent view.
  {
    id: "m2",
    role: "assistant",
    characterId: "cora",
    content: "",
    agentContent: "[Private whisper to Dax: WHISPER_ONLY_B]",
    extra: "{}",
    createdAt: "2026-10-13T10:01:00Z",
  },
  // The agent view wins even where it is shorter: leftover private notes stay out.
  {
    id: "m3",
    role: "user",
    characterId: null,
    content: "Agreed. [notes: PRIVATE_NOTE]",
    agentContent: "Agreed.",
    extra: "{}",
    createdAt: "2026-10-13T10:02:00Z",
  },
  // An older Engine sends no agentContent.
  {
    id: "m4",
    role: "assistant",
    characterId: "bram",
    content: "OLD_ENGINE_C",
    extra: "{}",
    createdAt: "2026-10-13T10:03:00Z",
  },
];

function assertReadsAgentView(text: string, label: string) {
  assert.match(text, /Cora waves\. \[Private whisper to Bram: WHISPER_A\]/, `${label} reads a message's whisper`);
  assert.match(text, /\[Private whisper to Dax: WHISPER_ONLY_B\]/, `${label} keeps a whisper-only message`);
  assert.match(text, /OLD_ENGINE_C/, `${label} falls back to content without agentContent`);
  assert.doesNotMatch(text, /PRIVATE_NOTE/, `${label} prefers agentContent over content`);
}

async function main() {
  // Relationship Tracker: Update from History transcript.
  const characters = [
    { id: "cora", name: "Cora" },
    { id: "bram", name: "Bram" },
    { id: "dax", name: "Dax" },
  ];
  const history = buildHistoryModelMessages({ characters, state: { relationships: [] } }, messages);
  assertReadsAgentView(history.at(-1)!.content, "Relationship Tracker history");

  // Relationship Tracker: scene presence picks relationships for character responders' prompts, which never get
  // whispers, so it reads public content only. A name in a whisper must not add a character to the scene.
  const allowed = new Set(characters.map((character) => character.id));
  assert.deepEqual(detectPresentCharacterIds([messages[1]], allowed, 10, characters), ["cora"]);
  assert.deepEqual(detectPresentCharacterIds([messages[3]], allowed, 10, characters), ["bram"]);

  // Memory Nag: the vault scan transcript.
  let document = { id: "vault", revision: 1, data: emptyMemoryNagVault("chat") };
  const prompts: string[] = [];
  const release = configureMemoryNagRuntime({
    persistence: {
      getChat: async () => ({ id: "chat", mode: "roleplay", characterIds: ["cora", "bram"], connectionId: null }),
      listMessages: async () => messages,
      documents: {
        getById: async () => document,
        update: async (value: typeof document) => {
          document = { ...document, data: value.data, revision: document.revision + 1 };
          return document;
        },
      },
    },
    resources: { listCharacters: async (ids: string[]) => ids.map((id) => ({ id, data: { name: id } })) },
    getAgentConfig: async () => null,
    isDebugAgentsEnabled: () => false,
    logger: { debugOverride: () => undefined },
    json: { parseJsonish: JSON.parse },
    languageModels: {
      resolveForRequest: async () => ({
        fitContext: (prompt: unknown[]) => ({ messages: prompt }),
        chatComplete: async (prompt: unknown) => {
          prompts.push(JSON.stringify(prompt));
          return { content: '{"memories":[],"resolvedMemoryIds":[]}' };
        },
      }),
    },
  } as never);
  try {
    const progress = await scanMemoryNagBatch("chat");
    assert.equal(progress.processed, 4, "Memory Nag scans every message, including the whisper-only one");
    assert.equal(prompts.length, 1);
    assertReadsAgentView(JSON.parse(prompts[0]!).at(-1).content, "Memory Nag scan");
  } finally {
    release();
  }
  console.log("roleplay whisper regressions passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
