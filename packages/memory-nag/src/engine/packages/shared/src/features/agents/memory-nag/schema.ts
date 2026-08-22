export const MEMORY_NAG_DEFAULTS = Object.freeze({
  scanConnectionId: null as string | null,
  messagesPerBatch: 20,
  memoriesPerCharacter: 10,
  memoriesToConsider: 5,
  memoriesToInject: 3,
});

export type MemoryNagStatus = "active" | "resolved";

export interface MemoryNagSettings {
  scanConnectionId: string | null;
  messagesPerBatch: number;
  memoriesPerCharacter: number;
  memoriesToConsider: number;
  memoriesToInject: number;
}

export interface MemoryNagParticipant {
  id: string;
  name: string;
  current: boolean;
}

export interface MemoryNagMemory {
  id: string;
  text: string;
  characterIds: string[];
  status: MemoryNagStatus;
  sourceMessageIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MemoryNagRecall {
  memoryIds: string[];
  nags: string[];
  createdAt: string;
}

export interface MemoryNagVault {
  version: 1;
  chatId: string;
  settings: MemoryNagSettings;
  checkpointMessageId: string | null;
  participants: MemoryNagParticipant[];
  memories: MemoryNagMemory[];
  lastRecall: MemoryNagRecall | null;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.trunc(number))) : fallback;
}

export function normalizeMemoryNagSettings(value: unknown): MemoryNagSettings {
  const source = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const scanConnectionId =
    typeof source.scanConnectionId === "string" && source.scanConnectionId.trim()
      ? source.scanConnectionId.trim()
      : null;
  return {
    scanConnectionId,
    messagesPerBatch: boundedInteger(source.messagesPerBatch, MEMORY_NAG_DEFAULTS.messagesPerBatch, 5, 200),
    memoriesPerCharacter: boundedInteger(source.memoriesPerCharacter, MEMORY_NAG_DEFAULTS.memoriesPerCharacter, 1, 50),
    memoriesToConsider: boundedInteger(source.memoriesToConsider, MEMORY_NAG_DEFAULTS.memoriesToConsider, 1, 50),
    memoriesToInject: boundedInteger(source.memoriesToInject, MEMORY_NAG_DEFAULTS.memoriesToInject, 1, 20),
  };
}

export function emptyMemoryNagVault(chatId: string): MemoryNagVault {
  return {
    version: 1,
    chatId,
    settings: { ...MEMORY_NAG_DEFAULTS },
    checkpointMessageId: null,
    participants: [],
    memories: [],
    lastRecall: null,
  };
}
