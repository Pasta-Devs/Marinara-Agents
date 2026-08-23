import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
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

function requestBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw Object.assign(new Error("A JSON request body is required."), { statusCode: 400 });
  }
  return value as Record<string, unknown>;
}

function requestedCharacterIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((id) => typeof id !== "string" || !id.trim())) {
    throw Object.assign(new Error("Choose at least one character."), { statusCode: 400 });
  }
  return [...new Set(value.map((id) => (id as string).trim()))];
}

function validateCharacterIds(characterIds: string[], allowedIds: Set<string>): string[] {
  if (characterIds.some((id) => !allowedIds.has(id))) {
    throw Object.assign(new Error("Choose only characters from this chat."), { statusCode: 400 });
  }
  return characterIds;
}

function memoryNotFound(): Error & { statusCode: number } {
  return Object.assign(new Error("Memory not found."), { statusCode: 404 });
}

async function requireRoleplayChat(request: FastifyRequest) {
  const params = request.params as { chatId?: unknown };
  const chatId = requiredId(params.chatId, "Chat ID");
  const chat = await getMemoryNagRuntime().persistence.getChat(chatId);
  if (!chat || chat.mode !== "roleplay") {
    throw Object.assign(new Error("Memory Nag is available only in Roleplay chats."), { statusCode: 400 });
  }
}

const roleplayOnly = { preHandler: requireRoleplayChat };

export const memoryNagRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { chatId: string } }>("/vault/:chatId", roleplayOnly, async (request) => {
    const chatId = requiredId(request.params.chatId, "Chat ID");
    return readMemoryNagVault(chatId);
  });

  app.get<{ Params: { chatId: string } }>("/recall/:chatId", roleplayOnly, async (request) => {
    const vault = await readMemoryNagVault(requiredId(request.params.chatId, "Chat ID"));
    return vault.lastRecall;
  });

  app.get<{ Params: { chatId: string } }>("/participants/:chatId", roleplayOnly, async (request) => {
    return loadMemoryNagParticipants(requiredId(request.params.chatId, "Chat ID"));
  });

  app.patch<{ Params: { chatId: string }; Body: unknown }>("/settings/:chatId", roleplayOnly, async (request) => {
    const chatId = requiredId(request.params.chatId, "Chat ID");
    return updateMemoryNagVault(chatId, (current) => ({
      ...current,
      settings: normalizeMemoryNagSettings({ ...current.settings, ...(request.body as Record<string, unknown>) }),
    }));
  });

  app.post<{ Params: { chatId: string } }>("/scan/:chatId", roleplayOnly, async (request) => {
    return scanMemoryNagBatch(requiredId(request.params.chatId, "Chat ID"));
  });

  app.post<{ Params: { chatId: string }; Body: { text?: unknown; characterIds?: unknown } }>(
    "/memories/:chatId",
    roleplayOnly,
    async (request) => {
      const chatId = requiredId(request.params.chatId, "Chat ID");
      const body = requestBody(request.body);
      const text = memoryText(body.text);
      const requestedIds = requestedCharacterIds(body.characterIds);
      const participants = await loadMemoryNagParticipants(chatId);
      const allowedIds = new Set(participants.map((participant) => participant.id));
      const characterIds = validateCharacterIds(requestedIds, allowedIds);
      const now = new Date().toISOString();
      return updateMemoryNagVault(chatId, (current) => ({
        ...current,
        participants,
        memories: [
          ...current.memories,
          {
            id: randomUUID(),
            text,
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
  }>("/memories/:chatId/:memoryId", roleplayOnly, async (request) => {
    const chatId = requiredId(request.params.chatId, "Chat ID");
    const memoryId = requiredId(request.params.memoryId, "Memory ID");
    const body = requestBody(request.body);
    const text = body.text === undefined ? undefined : memoryText(body.text);
    const requestedIds = body.characterIds === undefined ? undefined : requestedCharacterIds(body.characterIds);
    const status = body.status === undefined ? undefined : body.status;
    if (status !== undefined && status !== "active" && status !== "resolved") {
      throw Object.assign(new Error("Memory status must be active or resolved."), { statusCode: 400 });
    }
    if (text === undefined && requestedIds === undefined && status === undefined) {
      throw Object.assign(new Error("Provide a memory field to update."), { statusCode: 400 });
    }
    const vault = await readMemoryNagVault(chatId);
    if (!vault.memories.some((memory) => memory.id === memoryId)) throw memoryNotFound();
    const participants = await loadMemoryNagParticipants(chatId);
    const allowedIds = new Set(participants.map((participant) => participant.id));
    const characterIds = requestedIds ? validateCharacterIds(requestedIds, allowedIds) : undefined;
    return updateMemoryNagVault(chatId, (current) => {
      if (!current.memories.some((memory) => memory.id === memoryId)) throw memoryNotFound();
      return {
        ...current,
        participants,
        memories: current.memories.map((memory) =>
          memory.id === memoryId
            ? {
                ...memory,
                text: text ?? memory.text,
                characterIds: characterIds ?? memory.characterIds,
                status: status ?? memory.status,
                updatedAt: new Date().toISOString(),
              }
            : memory,
        ),
      };
    });
  });

  app.delete<{ Params: { chatId: string; memoryId: string } }>(
    "/memories/:chatId/:memoryId",
    roleplayOnly,
    async (request) => {
      const chatId = requiredId(request.params.chatId, "Chat ID");
      const memoryId = requiredId(request.params.memoryId, "Memory ID");
      const vault = await readMemoryNagVault(chatId);
      if (!vault.memories.some((memory) => memory.id === memoryId)) throw memoryNotFound();
      return updateMemoryNagVault(chatId, (current) => {
        if (!current.memories.some((memory) => memory.id === memoryId)) throw memoryNotFound();
        return {
          ...current,
          memories: current.memories.filter((memory) => memory.id !== memoryId),
          lastRecall: current.lastRecall?.memoryIds.includes(memoryId) ? null : current.lastRecall,
        };
      });
    },
  );
};
