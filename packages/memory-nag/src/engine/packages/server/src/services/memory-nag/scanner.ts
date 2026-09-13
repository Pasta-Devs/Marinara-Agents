import { randomUUID } from "node:crypto";
import type { CapabilityMessageRecord } from "@marinara-engine/shared";
import {
  MEMORY_NAG_DEFAULT_VAULT_PROMPT,
  type MemoryNagMemory,
  type MemoryNagParticipant,
  type MemoryNagVault,
} from "../../../../shared/src/features/agents/memory-nag/schema.js";
import { getMemoryNagRuntime } from "./package-runtime.js";
import { loadMemoryNagParticipants } from "./participants.js";
import { shortlistMemoriesForScan } from "./retrieval.js";
import { readMemoryNagVault, updateMemoryNagVault } from "./vault.js";

const scanQueues = new Map<string, Promise<void>>();
const MEMORY_NAG_SCAN_MAX_TOKENS = 4096;
const MANUAL_SCAN_IDLE_MS = 60_000;
const manualScans = new Map<
  string,
  {
    id: string;
    startMessageId: string;
    endMessageId: string;
    expiresAt: number;
  }
>();

function manualScan(chatId: string) {
  const session = manualScans.get(chatId);
  // ponytail: sessions only bridge client requests; an abandoned idle session
  // expires on the next scan attempt. Durable resumable jobs are unnecessary here.
  if (session && session.expiresAt <= Date.now()) {
    manualScans.delete(chatId);
    return undefined;
  }
  return session;
}

function scanConflict(): Error & { statusCode: number } {
  return Object.assign(new Error("This message-range scan is no longer active, or another scan is running."), {
    statusCode: 409,
  });
}

export function endMemoryNagRangeScan(chatId: string, scanId: string): boolean {
  if (manualScans.get(chatId)?.id !== scanId) return false;
  manualScans.delete(chatId);
  return true;
}

export async function startMemoryNagRangeScan(chatId: string, range: unknown): Promise<{ scanId: string }> {
  return withScanLock(chatId, async () => {
    if (manualScan(chatId)) throw scanConflict();
    const runtime = getMemoryNagRuntime();
    const chat = await runtime.persistence.getChat(chatId);
    if (!chat || chat.mode !== "roleplay") throw new Error("Memory Nag is available only in Roleplay chats.");
    const messages = (await runtime.persistence.listMessages(chatId)).filter(
      (message) => message.role === "user" || message.role === "assistant",
    );
    const window = memoryNagScanWindow(messages, range);
    if (!window || window.after !== window.start) {
      throw Object.assign(new Error("Choose a valid message range from this chat."), { statusCode: 400 });
    }
    const id = randomUUID();
    manualScans.set(chatId, {
      id,
      startMessageId: messages[window.start]!.id,
      endMessageId: messages[window.end - 1]!.id,
      expiresAt: Date.now() + MANUAL_SCAN_IDLE_MS,
    });
    return { scanId: id };
  });
}

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

export function buildMemoryNagScanMessages(input: {
  participants: MemoryNagParticipant[];
  transcript: string;
  existing: MemoryNagMemory[];
  perCharacter: number;
  vaultPrompt: string;
}) {
  const characterList = input.participants.map((participant) => `- ${participant.name}: ${participant.id}`).join("\n");
  const memories = input.existing.map((memory) => `- ${memory.id}: ${memory.text}`).join("\n") || "(none)";
  return [
    {
      role: "system" as const,
      content: [
        input.vaultPrompt.trim() || MEMORY_NAG_DEFAULT_VAULT_PROMPT,
        "The user message is JSON with the character list, active vault memories, and chat batch.",
        `Create at most ${input.perCharacter} memories for any one character. Fewer or none is fine.`,
        'Return only JSON: {"memories":[{"text":"...","characterIds":["id"]}],"resolvedMemoryIds":["existing-id"]}',
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        outputFormat: "json",
        characters: characterList,
        activeMemories: memories,
        chatBatch: input.transcript,
      }),
    },
  ];
}

export function memoryNagScanStart(
  vault: Pick<MemoryNagVault, "checkpointMessageId">,
  messages: Array<{ id: string }>,
): number {
  if (!vault.checkpointMessageId) return 0;
  const checkpointIndex = messages.findIndex((message) => message.id === vault.checkpointMessageId);
  return checkpointIndex >= 0 ? checkpointIndex + 1 : 0;
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

/** A manual range keeps stable message IDs across batches, even if earlier history is deleted. */
export function memoryNagScanWindow(
  messages: Array<{ id: string }>,
  value: unknown,
): { start: number; end: number; after: number } | null {
  if (value === undefined || value === null) return null;
  const fail = () => {
    throw Object.assign(new Error("Choose a valid message range from this chat."), { statusCode: 400 });
  };
  if (typeof value !== "object" || Array.isArray(value)) return fail();
  const range = value as Record<string, unknown>;
  const index = (id: unknown) =>
    typeof id === "string" && id.length <= 160 ? messages.findIndex((message) => message.id === id) : -1;
  const start = index(range.startMessageId);
  const end = index(range.endMessageId);
  const after = range.afterMessageId === undefined ? start - 1 : index(range.afterMessageId);
  if (
    start < 0 ||
    end < start ||
    after < start - 1 ||
    after > end ||
    (range.afterMessageId !== undefined && after < start)
  )
    return fail();
  return { start, end: end + 1, after: after + 1 };
}

async function scanMemoryNagBatchUnlocked(chatId: string, range?: unknown): Promise<MemoryNagScanProgress> {
  const runtime = getMemoryNagRuntime();
  const chat = await runtime.persistence.getChat(chatId);
  if (!chat || chat.mode !== "roleplay") throw new Error("Memory Nag is available only in Roleplay chats.");
  const messages = (await runtime.persistence.listMessages(chatId)).filter(
    (message) => message.role === "user" || message.role === "assistant",
  );
  const vault = await readMemoryNagVault(chatId);
  const window = memoryNagScanWindow(messages, range);
  const start = window ? window.after : memoryNagScanStart(vault, messages);
  const end = window?.end ?? messages.length;
  const offset = window?.start ?? 0;
  const batch = messages.slice(start, Math.min(end, start + vault.settings.messagesPerBatch));
  if (batch.length === 0) {
    return {
      processed: start - offset,
      total: end - offset,
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
  const prompt = buildMemoryNagScanMessages({
    participants,
    transcript,
    existing: relevantExisting,
    perCharacter: vault.settings.memoriesPerCharacter,
    vaultPrompt: vault.settings.vaultPrompt,
  });
  const fitted = model.fitContext(prompt, { maxTokens: MEMORY_NAG_SCAN_MAX_TOKENS });
  runtime.logger.debugOverride(
    runtime.isDebugAgentsEnabled(),
    "[memory-nag] Vault scan prompt for chat %s: %s",
    chatId,
    JSON.stringify(fitted.messages),
  );
  const completion = await model.chatComplete(fitted.messages, {
    maxTokens: fitted.maxTokens ?? MEMORY_NAG_SCAN_MAX_TOKENS,
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
    const currentStart = memoryNagScanStart(current, messages);
    const processed = start + batch.length;
    const checkpointAdvanced = currentStart > processed;
    return {
      ...current,
      participants,
      checkpointMessageId: checkpointAdvanced ? current.checkpointMessageId : checkpointMessageId,
      checkpointMessageCount: checkpointAdvanced ? currentStart : processed,
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
  const processed = window ? start + batch.length : memoryNagScanStart(saved, messages);
  return {
    processed: processed - offset,
    total: end - offset,
    created: createdCount,
    resolved: resolvedCount,
    done: processed >= end,
    checkpointMessageId: window ? checkpointMessageId : saved.checkpointMessageId,
  };
}

export async function scanMemoryNagBatch(chatId: string, range?: unknown): Promise<MemoryNagScanProgress> {
  return withScanLock(chatId, async () => {
    const session = manualScan(chatId);
    const requested = range && typeof range === "object" ? (range as Record<string, unknown>) : undefined;
    if (session || requested?.scanId !== undefined) {
      if (
        !session ||
        requested?.scanId !== session.id ||
        requested.startMessageId !== session.startMessageId ||
        requested.endMessageId !== session.endMessageId
      ) {
        throw scanConflict();
      }
    }
    try {
      const result = await scanMemoryNagBatchUnlocked(chatId, range);
      if (session && manualScans.get(chatId) === session) {
        if (result.done) endMemoryNagRangeScan(chatId, session.id);
        else {
          session.expiresAt = Date.now() + MANUAL_SCAN_IDLE_MS;
        }
      }
      return result;
    } catch (error) {
      if (session) endMemoryNagRangeScan(chatId, session.id);
      throw error;
    }
  });
}

export async function scanMemoryNagIfDue(chatId: string): Promise<void> {
  await withScanLock(chatId, async () => {
    if (manualScan(chatId)) return;
    const runtime = getMemoryNagRuntime();
    const [vault, messages] = await Promise.all([readMemoryNagVault(chatId), runtime.persistence.listMessages(chatId)]);
    const relevant = messages.filter((message) => message.role === "user" || message.role === "assistant");
    if (relevant.length - memoryNagScanStart(vault, relevant) < vault.settings.messagesPerBatch) return;
    await scanMemoryNagBatchUnlocked(chatId);
  });
}
