import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { normalizeMemoryNagSettings } from "../../../../shared/src/features/agents/memory-nag/schema.js";
import { loadMemoryNagParticipants } from "./participants.js";
import { scanMemoryNagBatch } from "./scanner.js";
import { readMemoryNagVault, updateMemoryNagVault } from "./vault.js";

function requiredId(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 160) throw new Error(`${label} is required.`);
  return value.trim();
}

function memoryText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Memory text is required.");
  return value.trim().replace(/\s+/g, " ").slice(0, 500);
}

export const memoryNagRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { chatId: string } }>("/vault/:chatId", async (request) => {
    const chatId = requiredId(request.params.chatId, "Chat ID");
    return readMemoryNagVault(chatId);
  });

  app.patch<{ Params: { chatId: string }; Body: unknown }>("/settings/:chatId", async (request) => {
    const chatId = requiredId(request.params.chatId, "Chat ID");
    return updateMemoryNagVault(chatId, (current) => ({
      ...current,
      settings: normalizeMemoryNagSettings(request.body),
    }));
  });

  app.post<{ Params: { chatId: string } }>("/scan/:chatId", async (request) => {
    return scanMemoryNagBatch(requiredId(request.params.chatId, "Chat ID"));
  });

  app.post<{ Params: { chatId: string }; Body: { text?: unknown; characterIds?: unknown } }>(
    "/memories/:chatId",
    async (request) => {
      const chatId = requiredId(request.params.chatId, "Chat ID");
      const participants = await loadMemoryNagParticipants(chatId);
      const allowedIds = new Set(participants.map((participant) => participant.id));
      const characterIds = Array.isArray(request.body?.characterIds)
        ? [...new Set(request.body.characterIds.filter((id): id is string => typeof id === "string" && allowedIds.has(id)))]
        : [];
      if (characterIds.length === 0) throw new Error("Choose at least one character.");
      const now = new Date().toISOString();
      return updateMemoryNagVault(chatId, (current) => ({
        ...current,
        participants,
        memories: [
          ...current.memories,
          {
            id: randomUUID(),
            text: memoryText(request.body?.text),
            characterIds,
            status: "active",
            sourceMessageIds: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
      }));
    },
  );

  app.patch<{
    Params: { chatId: string; memoryId: string };
    Body: { text?: unknown; characterIds?: unknown; status?: unknown };
  }>("/memories/:chatId/:memoryId", async (request) => {
    const chatId = requiredId(request.params.chatId, "Chat ID");
    const memoryId = requiredId(request.params.memoryId, "Memory ID");
    const participants = await loadMemoryNagParticipants(chatId);
    const allowedIds = new Set(participants.map((participant) => participant.id));
    return updateMemoryNagVault(chatId, (current) => ({
      ...current,
      participants,
      memories: current.memories.map((memory) => {
        if (memory.id !== memoryId) return memory;
        const characterIds = Array.isArray(request.body?.characterIds)
          ? [...new Set(request.body.characterIds.filter((id): id is string => typeof id === "string" && allowedIds.has(id)))]
          : memory.characterIds;
        return {
          ...memory,
          text: request.body?.text === undefined ? memory.text : memoryText(request.body.text),
          characterIds: characterIds.length > 0 ? characterIds : memory.characterIds,
          status: request.body?.status === "resolved" ? "resolved" : request.body?.status === "active" ? "active" : memory.status,
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  });

  app.delete<{ Params: { chatId: string; memoryId: string } }>("/memories/:chatId/:memoryId", async (request) => {
    const chatId = requiredId(request.params.chatId, "Chat ID");
    const memoryId = requiredId(request.params.memoryId, "Memory ID");
    return updateMemoryNagVault(chatId, (current) => ({
      ...current,
      memories: current.memories.filter((memory) => memory.id !== memoryId),
      lastRecall: current.lastRecall?.memoryIds.includes(memoryId) ? null : current.lastRecall,
    }));
  });
};
