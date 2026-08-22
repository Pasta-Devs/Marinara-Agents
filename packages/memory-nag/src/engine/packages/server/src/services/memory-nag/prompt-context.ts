import { getMemoryNagRuntime } from "./package-runtime.js";
import { readMemoryNagVault } from "./vault.js";

type PromptContextRequest = {
  chatId: string;
  chatMeta: Record<string, unknown>;
  mode: string;
  targetCharacterIds?: string[];
  personaId?: string | null;
  placedAgentTypes?: string[];
};

function metadataRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function recordName(data: unknown, fallback: string): string {
  const source = metadataRecord(data);
  return typeof source.name === "string" && source.name.trim() ? source.name.trim() : fallback;
}

export async function contributeMemoryNags(request: PromptContextRequest) {
  if (request.mode !== "roleplay") return null;
  const metadata = metadataRecord(request.chatMeta);
  if (
    metadata.enableAgents !== true ||
    !Array.isArray(metadata.activeAgentIds) ||
    !metadata.activeAgentIds.includes("memory-nag")
  ) {
    return null;
  }
  const vault = await readMemoryNagVault(request.chatId);
  if (!vault.lastRecall?.nags.length) return null;

  const runtime = getMemoryNagRuntime();
  const memoryById = new Map(vault.memories.map((memory) => [memory.id, memory]));
  const recalledCharacterIds = vault.lastRecall.memoryIds.flatMap(
    (memoryId) => memoryById.get(memoryId)?.characterIds ?? [],
  );
  const characterIds = [...new Set([...recalledCharacterIds, ...(request.targetCharacterIds ?? [])])];
  const characterRecords = characterIds.length > 0 ? await runtime.resources.listCharacters(characterIds) : [];
  const storedNames = new Map(vault.participants.map((participant) => [participant.id, participant.name]));
  const characterNames = new Map(
    characterRecords.map((record) => [record.id, recordName(record.data, storedNames.get(record.id) ?? record.id)]),
  );
  const personaRecords = request.personaId ? await runtime.resources.listPersonas([request.personaId]) : [];
  const personaName = recordName(personaRecords[0]?.data, "User");
  const lines = vault.lastRecall.nags.map((nag, index) => {
    const memory = memoryById.get(vault.lastRecall!.memoryIds[index] ?? "");
    const targetIds = memory?.characterIds.length ? memory.characterIds : (request.targetCharacterIds ?? []);
    const characterName =
      targetIds.map((id) => characterNames.get(id) ?? storedNames.get(id) ?? id).join(" and ") || "the character";
    const resolved = nag.replaceAll("{{char}}", characterName).replaceAll("{{user}}", personaName);
    return `- ${escapeXml(resolved)}`;
  });
  if (request.placedAgentTypes?.includes("memory-nag")) return lines.join("\n");
  return `<context>\n<memory_nags>\n${lines.join("\n")}\n</memory_nags>\n</context>`;
}
