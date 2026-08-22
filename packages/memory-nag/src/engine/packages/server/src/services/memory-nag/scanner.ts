import { randomUUID } from "node:crypto";
import type { CapabilityMessageRecord } from "@marinara-engine/shared";
import type {
  MemoryNagMemory,
  MemoryNagParticipant,
  MemoryNagVault,
} from "../../../../shared/src/features/agents/memory-nag/schema.js";
import { getMemoryNagRuntime } from "./package-runtime.js";
import { loadMemoryNagParticipants } from "./participants.js";
import { shortlistMemoriesForScan } from "./retrieval.js";
import { readMemoryNagVault, updateMemoryNagVault } from "./vault.js";

const scanQueues = new Map<string, Promise<void>>();

async function withScanLock<T>(chatId: string, task: () => Promise<T>): Promise<T> {
  const previous = scanQueues.get(chatId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(task);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  scanQueues.set(chatId, tail);
  try {
    return await run;
  } finally {
    if (scanQueues.get(chatId) === tail) scanQueues.delete(chatId);
  }
}

export interface MemoryNagScanProgress {
  processed: number;
  total: number;
  created: number;
  resolved: number;
  done: boolean;
  checkpointMessageId: string | null;
}

function transcriptLine(message: CapabilityMessageRecord, participants: MemoryNagParticipant[]): string {
  const name =
    message.role === "user"
      ? "User"
      : (participants.find((participant) => participant.id === message.characterId)?.name ?? "Assistant");
  return `[${message.createdAt}] ${name} (${message.characterId ?? message.role}): ${message.content}`;
}

function parseScanOutput(value: unknown): { memories: unknown[]; resolvedMemoryIds: string[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { memories: [], resolvedMemoryIds: [] };
  const source = value as Record<string, unknown>;
  return {
    memories: Array.isArray(source.memories) ? source.memories : [],
    resolvedMemoryIds: Array.isArray(source.resolvedMemoryIds)
      ? source.resolvedMemoryIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}

function normalizeCreatedMemories(input: {
  raw: unknown[];
  participants: MemoryNagParticipant[];
  existing: MemoryNagMemory[];
  sourceMessageIds: string[];
  perCharacter: number;
}): MemoryNagMemory[] {
  const participantIds = new Set(input.participants.map((participant) => participant.id));
  const idByName = new Map(input.participants.map((participant) => [participant.name.toLowerCase(), participant.id]));
  const existingText = new Set(input.existing.map((memory) => memory.text.trim().toLowerCase()));
  const perCharacter = new Map<string, number>();
  const created: MemoryNagMemory[] = [];
  const now = new Date().toISOString();

  for (const value of input.raw) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const source = value as Record<string, unknown>;
    const text = typeof source.text === "string" ? source.text.trim().replace(/\s+/g, " ").slice(0, 500) : "";
    if (!text || existingText.has(text.toLowerCase())) continue;
    const rawIds = Array.isArray(source.characterIds) ? source.characterIds : [];
    const characterIds = [
      ...new Set(
        rawIds.flatMap((value) => {
          if (typeof value !== "string") return [];
          const cleaned = value.trim();
          const id = participantIds.has(cleaned) ? cleaned : idByName.get(cleaned.toLowerCase());
          return id ? [id] : [];
        }),
      ),
    ];
    if (characterIds.length === 0) continue;
    if (characterIds.some((id) => (perCharacter.get(id) ?? 0) >= input.perCharacter)) continue;
    for (const id of characterIds) perCharacter.set(id, (perCharacter.get(id) ?? 0) + 1);
    existingText.add(text.toLowerCase());
    created.push({
      id: randomUUID(),
      text,
      characterIds,
      status: "active",
      sourceMessageIds: input.sourceMessageIds,
      createdAt: now,
      updatedAt: now,
    });
  }
  return created;
}

function buildScanMessages(input: {
  participants: MemoryNagParticipant[];
  transcript: string;
  existing: MemoryNagMemory[];
  perCharacter: number;
}) {
  const characterList = input.participants.map((participant) => `- ${participant.name}: ${participant.id}`).join("\n");
  const memories = input.existing.map((memory) => `- ${memory.id}: ${memory.text}`).join("\n") || "(none)";
  return [
    {
      role: "system" as const,
      content: [
        "Read this roleplay batch and save only details worth nagging a character about later.",
        "The user message is JSON with the character list, active vault memories, and chat batch.",
        "Keep each memory to one short sentence. Record promises, meaningful actions, relationship changes, mistakes, debts, injuries, and memorable admissions.",
        "A memory may belong to more than one character. Do not create memories about the user unless the user explicitly asked a character to remember something.",
        'You may preserve a short dialogue line verbatim when its exact wording matters, then add the speaker and rough context, for example: "I eat glue," Dottore admitted while drinking one night.',
        "Resolve an existing memory only when this batch clearly settles it. Never invent character IDs.",
        `Create at most ${input.perCharacter} memories for any one character. Fewer or none is fine.`,
        'Return only JSON: {"memories":[{"text":"...","characterIds":["id"]}],"resolvedMemoryIds":["existing-id"]}',
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        characters: characterList,
        activeMemories: memories,
        chatBatch: input.transcript,
      }),
    },
  ];
}

export function memoryNagScanStart(
  vault: Pick<MemoryNagVault, "checkpointMessageId" | "checkpointMessageCount">,
  messages: Array<{ id: string }>,
): number {
  if (vault.checkpointMessageId) {
    const checkpointIndex = messages.findIndex((message) => message.id === vault.checkpointMessageId);
    if (checkpointIndex >= 0) return checkpointIndex + 1;
  }
  return Math.min(vault.checkpointMessageCount, messages.length);
}

function memoryMatchesScan(current: MemoryNagMemory, scanned: MemoryNagMemory | undefined): boolean {
  return Boolean(
    scanned &&
    current.status === "active" &&
    scanned.status === "active" &&
    current.updatedAt === scanned.updatedAt &&
    current.text === scanned.text &&
    current.characterIds.join("\0") === scanned.characterIds.join("\0"),
  );
}

async function scanMemoryNagBatchUnlocked(chatId: string): Promise<MemoryNagScanProgress> {
  const runtime = getMemoryNagRuntime();
  const chat = await runtime.persistence.getChat(chatId);
  if (!chat || chat.mode !== "roleplay") throw new Error("Memory Nag is available only in Roleplay chats.");
  const messages = (await runtime.persistence.listMessages(chatId)).filter(
    (message) => message.role === "user" || message.role === "assistant",
  );
  const vault = await readMemoryNagVault(chatId);
  const start = memoryNagScanStart(vault, messages);
  const batch = messages.slice(start, start + vault.settings.messagesPerBatch);
  if (batch.length === 0) {
    return {
      processed: start,
      total: messages.length,
      created: 0,
      resolved: 0,
      done: true,
      checkpointMessageId: vault.checkpointMessageId,
    };
  }

  const participants = await loadMemoryNagParticipants(chatId, messages);
  const transcript = batch.map((message) => transcriptLine(message, participants)).join("\n\n");
  const relevantExisting = shortlistMemoriesForScan(vault.memories, participants, transcript);
  const agentConfig = await runtime.getAgentConfig();
  const scanConnectionId = vault.settings.scanConnectionId ?? agentConfig?.connectionId ?? null;
  const model = await runtime.languageModels.resolveForRequest({
    connectionId: scanConnectionId,
    chatConnectionId: chat.connectionId,
  });
  const prompt = buildScanMessages({
    participants,
    transcript,
    existing: relevantExisting,
    perCharacter: vault.settings.memoriesPerCharacter,
  });
  const fitted = model.fitContext(prompt, { maxTokens: 2400 });
  runtime.logger.debugOverride(
    runtime.isDebugAgentsEnabled(),
    "[memory-nag] Vault scan prompt for chat %s: %s",
    chatId,
    JSON.stringify(fitted.messages),
  );
  const completion = await model.chatComplete(fitted.messages, {
    maxTokens: fitted.maxTokens ?? 2400,
    temperature: 0.2,
    reasoningEffort: "none",
    debugMode: runtime.isDebugAgentsEnabled(),
    responseFormat: { type: "json_object" },
  });
  const parsed = parseScanOutput(runtime.json.parseJsonish(completion.content ?? ""));
  const created = normalizeCreatedMemories({
    raw: parsed.memories,
    participants,
    existing: vault.memories,
    sourceMessageIds: batch.map((message) => message.id),
    perCharacter: vault.settings.memoriesPerCharacter,
  });
  const activeIds = new Set(vault.memories.filter((memory) => memory.status === "active").map((memory) => memory.id));
  const resolvedIds = new Set(parsed.resolvedMemoryIds.filter((id) => activeIds.has(id)));
  const checkpointMessageId = batch.at(-1)!.id;
  let createdCount = 0;
  let resolvedCount = 0;
  const scannedById = new Map(vault.memories.map((memory) => [memory.id, memory]));
  const saved = await updateMemoryNagVault(chatId, (current) => {
    const currentTexts = new Set(current.memories.map((memory) => memory.text.trim().toLowerCase()));
    const newMemories = created.filter((memory) => !currentTexts.has(memory.text.trim().toLowerCase()));
    createdCount = newMemories.length;
    resolvedCount = current.memories.filter(
      (memory) => resolvedIds.has(memory.id) && memoryMatchesScan(memory, scannedById.get(memory.id)),
    ).length;
    const checkpointAdvanced = memoryNagScanStart(current, messages) > start + batch.length;
    return {
      ...current,
      participants,
      checkpointMessageId: checkpointAdvanced ? current.checkpointMessageId : checkpointMessageId,
      checkpointMessageCount: Math.max(current.checkpointMessageCount, start + batch.length),
      memories: [
        ...current.memories.map((memory) =>
          resolvedIds.has(memory.id) && memoryMatchesScan(memory, scannedById.get(memory.id))
            ? { ...memory, status: "resolved" as const, updatedAt: new Date().toISOString() }
            : memory,
        ),
        ...newMemories,
      ],
    };
  });
  return {
    processed: Math.min(saved.checkpointMessageCount, messages.length),
    total: messages.length,
    created: createdCount,
    resolved: resolvedCount,
    done: saved.checkpointMessageCount >= messages.length,
    checkpointMessageId: saved.checkpointMessageId,
  };
}

export async function scanMemoryNagBatch(chatId: string): Promise<MemoryNagScanProgress> {
  return withScanLock(chatId, () => scanMemoryNagBatchUnlocked(chatId));
}

export async function scanMemoryNagIfDue(chatId: string): Promise<void> {
  const runtime = getMemoryNagRuntime();
  const [vault, messages] = await Promise.all([readMemoryNagVault(chatId), runtime.persistence.listMessages(chatId)]);
  const relevant = messages.filter((message) => message.role === "user" || message.role === "assistant");
  if (relevant.length - memoryNagScanStart(vault, relevant) < vault.settings.messagesPerBatch) return;
  await scanMemoryNagBatch(chatId);
}
