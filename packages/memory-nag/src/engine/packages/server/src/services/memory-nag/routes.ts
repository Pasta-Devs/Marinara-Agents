import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { normalizeMemoryNagSettings } from "../../../../shared/src/features/agents/memory-nag/schema.js";
import { loadMemoryNagParticipants } from "./participants.js";
import { getMemoryNagRuntime } from "./package-runtime.js";
import { scanMemoryNagBatch } from "./scanner.js";
import { readMemoryNagVault, updateMemoryNagVault } from "./vault.js";

function requiredId(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 160) {
    throw Object.assign(new Error(`${label} is required.`), { statusCode: 400 });
  }
  return value.trim();
}

function memoryText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw Object.assign(new Error("Memory text is required."), { statusCode: 400 });
  }
  return value.trim().replace(/\s+/g, " ").slice(0, 500);
}

export const memoryNagRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request) => {
    const params = request.params as { chatId?: unknown };
    const chatId = requiredId(params.chatId, "Chat ID");
    const chat = await getMemoryNagRuntime().persistence.getChat(chatId);
    if (!chat || chat.mode !== "roleplay") {
      throw Object.assign(new Error("Memory Nag is available only in Roleplay chats."), { statusCode: 400 });
    }
  });

  app.get<{ Params: { chatId: string } }>("/vault/:chatId", async (request) => {
    const chatId = requiredId(request.params.chatId, "Chat ID");
    return readMemoryNagVault(chatId);
  });

  app.get<{ Params: { chatId: string } }>("/recall/:chatId", async (request) => {
    const vault = await readMemoryNagVault(requiredId(request.params.chatId, "Chat ID"));
    return vault.lastRecall;
  });

  app.get<{ Params: { chatId: string } }>("/participants/:chatId", async (request) => {
    return loadMemoryNagParticipants(requiredId(request.params.chatId, "Chat ID"));
  });

  app.patch<{ Params: { chatId: string }; Body: unknown }>("/settings/:chatId", async (request) => {
    const chatId = requiredId(request.params.chatId, "Chat ID");
    return updateMemoryNagVault(chatId, (current) => ({
      ...current,
      settings: normalizeMemoryNagSettings({ ...current.settings, ...(request.body as Record<string, unknown>) }),
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
        ? [
            ...new Set(
              request.body.characterIds.filter((id): id is string => typeof id === "string" && allowedIds.has(id)),
            ),
          ]
        : [];
      if (characterIds.length === 0) {
        throw Object.assign(new Error("Choose at least one character."), { statusCode: 400 });
      }
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
          ? [
              ...new Set(
                request.body.characterIds.filter((id): id is string => typeof id === "string" && allowedIds.has(id)),
              ),
            ]
          : memory.characterIds;
        return {
          ...memory,
          text: request.body?.text === undefined ? memory.text : memoryText(request.body.text),
          characterIds: characterIds.length > 0 ? characterIds : memory.characterIds,
          status:
            request.body?.status === "resolved"
              ? "resolved"
              : request.body?.status === "active"
                ? "active"
                : memory.status,
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
