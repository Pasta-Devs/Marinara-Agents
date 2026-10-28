import type { AgentContext, CapabilityMessageRecord } from "@marinara-engine/shared";
import type { MemoryNagParticipant } from "../../../../shared/src/features/agents/memory-nag/schema.js";
import { getMemoryNagRuntime } from "./package-runtime.js";

function parseName(data: unknown, fallback: string): string {
  let value = data;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return fallback;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const name = (value as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name.trim() : fallback;
}

export async function loadMemoryNagParticipants(
  chatId: string,
  messages?: CapabilityMessageRecord[],
): Promise<MemoryNagParticipant[]> {
  const runtime = getMemoryNagRuntime();
  const chat = await runtime.persistence.getChat(chatId);
  if (!chat) throw new Error("Chat not found");
  const history = messages ?? (await runtime.persistence.listMessages(chatId));
  const currentIds = new Set(chat.characterIds);
  const participantIds = [
    ...new Set([...chat.characterIds, ...history.flatMap((message) => message.characterId ?? [])]),
  ];
  const records = await runtime.resources.listCharacters(participantIds);
  const nameById = new Map(records.map((record) => [record.id, parseName(record.data, record.comment || record.id)]));
  return participantIds.map((id) => ({ id, name: nameById.get(id) ?? id, current: currentIds.has(id) }));
}

export function participantsFromAgentContext(context: AgentContext): MemoryNagParticipant[] {
  const currentIds = new Set(context.chatCharacters?.filter((entry) => entry.active).map((entry) => entry.id) ?? []);
  const byId = new Map<string, MemoryNagParticipant>();
  for (const character of context.chatCharacters ?? context.characters) {
    byId.set(character.id, {
      id: character.id,
      name: character.name,
      current: currentIds.size > 0 ? currentIds.has(character.id) : true,
    });
  }
  for (const message of context.recentMessages) {
    if (!message.characterId || byId.has(message.characterId)) continue;
    byId.set(message.characterId, { id: message.characterId, name: message.characterId, current: false });
  }
  return [...byId.values()];
}
