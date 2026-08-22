import { randomUUID } from "node:crypto";
import type { CapabilityDocumentRecord } from "@marinara-engine/shared";
import {
  emptyMemoryNagVault,
  normalizeMemoryNagSettings,
  type MemoryNagMemory,
  type MemoryNagParticipant,
  type MemoryNagRecall,
  type MemoryNagVault,
} from "../../../../shared/src/features/agents/memory-nag/schema.js";
import { getMemoryNagRuntime } from "./package-runtime.js";

const PACKAGE_ID = "memory-nag";
const DOCUMENT_KIND = "chat-vault";

function normalizeMemory(value: unknown): MemoryNagMemory | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const id = typeof source.id === "string" ? source.id.trim() : "";
  const text = typeof source.text === "string" ? source.text.trim().slice(0, 500) : "";
  if (!id || !text) return null;
  const characterIds = Array.isArray(source.characterIds)
    ? [...new Set(source.characterIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))]
    : [];
  if (characterIds.length === 0) return null;
  const createdAt = typeof source.createdAt === "string" ? source.createdAt : new Date().toISOString();
  return {
    id,
    text,
    characterIds,
    status: source.status === "resolved" ? "resolved" : "active",
    sourceMessageIds: Array.isArray(source.sourceMessageIds)
      ? source.sourceMessageIds.filter((messageId): messageId is string => typeof messageId === "string")
      : [],
    createdAt,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : createdAt,
  };
}

function normalizeParticipant(value: unknown): MemoryNagParticipant | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const id = typeof source.id === "string" ? source.id.trim() : "";
  const name = typeof source.name === "string" ? source.name.trim() : "";
  return id && name ? { id, name, current: source.current === true } : null;
}

function normalizeRecall(value: unknown): MemoryNagRecall | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const nags = Array.isArray(source.nags)
    ? source.nags.filter((nag): nag is string => typeof nag === "string" && nag.trim().length > 0)
    : [];
  const memoryIds = Array.isArray(source.memoryIds)
    ? source.memoryIds.filter((id): id is string => typeof id === "string")
    : [];
  if (nags.length === 0 || memoryIds.length === 0) return null;
  return {
    nags,
    memoryIds,
    createdAt: typeof source.createdAt === "string" ? source.createdAt : new Date().toISOString(),
  };
}

export function normalizeMemoryNagVault(chatId: string, value: unknown): MemoryNagVault {
  const source = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    ...emptyMemoryNagVault(chatId),
    settings: normalizeMemoryNagSettings(source.settings),
    checkpointMessageId:
      typeof source.checkpointMessageId === "string" && source.checkpointMessageId.trim()
        ? source.checkpointMessageId
        : null,
    participants: Array.isArray(source.participants)
      ? source.participants.flatMap((entry) => normalizeParticipant(entry) ?? [])
      : [],
    memories: Array.isArray(source.memories) ? source.memories.flatMap((entry) => normalizeMemory(entry) ?? []) : [],
    lastRecall: normalizeRecall(source.lastRecall),
  };
}

async function findDocument(chatId: string): Promise<CapabilityDocumentRecord | null> {
  const documents = await getMemoryNagRuntime().persistence.documents.list(PACKAGE_ID, DOCUMENT_KIND);
  return documents.find((document) => document.name === chatId) ?? null;
}

export async function readMemoryNagVault(chatId: string): Promise<MemoryNagVault> {
  const document = await findDocument(chatId);
  return normalizeMemoryNagVault(chatId, document?.data);
}

export async function updateMemoryNagVault(
  chatId: string,
  update: (current: MemoryNagVault) => MemoryNagVault | Promise<MemoryNagVault>,
): Promise<MemoryNagVault> {
  const runtime = getMemoryNagRuntime();
  for (let attempt = 0; attempt < 3; attempt++) {
    const document = await findDocument(chatId);
    const current = normalizeMemoryNagVault(chatId, document?.data);
    const next = normalizeMemoryNagVault(chatId, await update(current));
    const now = new Date().toISOString();
    if (!document) {
      try {
        await runtime.persistence.documents.create({
          id: randomUUID(),
          packageId: PACKAGE_ID,
          kind: DOCUMENT_KIND,
          name: chatId,
          description: "Per-chat Memory Nag vault",
          data: next,
          createdAt: now,
          updatedAt: now,
        });
        return next;
      } catch {
        continue;
      }
    }
    const saved = await runtime.persistence.documents.update({
      id: document.id,
      packageId: PACKAGE_ID,
      expectedRevision: document.revision,
      name: chatId,
      description: document.description,
      data: next,
      updatedAt: now,
    });
    if (saved) return next;
  }
  throw new Error("Memory Nag vault changed while it was being saved. Try again.");
}
