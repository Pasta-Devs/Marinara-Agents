import type { AgentContext, AgentResult } from "@marinara-engine/shared";
import { participantsFromAgentContext } from "./participants.js";
import { shortlistMemoryNags } from "./retrieval.js";
import { scanMemoryNagIfDue } from "./scanner.js";
import { readMemoryNagVault, updateMemoryNagVault } from "./vault.js";
import { getMemoryNagRuntime } from "./package-runtime.js";

type AgentConfig = {
  id: string;
  type: string;
  name: string;
  connectionId: string | null;
  settings: Record<string, unknown>;
};

type PreparedMemoryNagContext = {
  participants: ReturnType<typeof participantsFromAgentContext>;
  currentCharacterIds: string[];
  candidates: Array<{ id: string; text: string; characterIds: string[] }>;
  maximumNags: number;
};

function mergeParticipants(
  stored: PreparedMemoryNagContext["participants"],
  current: PreparedMemoryNagContext["participants"],
): PreparedMemoryNagContext["participants"] {
  const currentById = new Map(current.map((participant) => [participant.id, participant]));
  const merged = stored.map((participant) => currentById.get(participant.id) ?? { ...participant, current: false });
  const storedIds = new Set(stored.map((participant) => participant.id));
  return [...merged, ...current.filter((participant) => !storedIds.has(participant.id))];
}

function contextSize(agent: AgentConfig): number {
  const value = Number(agent.settings.contextSize);
  return Number.isFinite(value) ? Math.max(1, Math.min(200, Math.trunc(value))) : 5;
}

function selectedMemoryIds(data: unknown): string[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const source = data as Record<string, unknown>;
  const values = source.memoryIds ?? source.memory_ids ?? source.nags;
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values.flatMap((value) => {
        if (typeof value === "string") return [value];
        if (!value || typeof value !== "object" || Array.isArray(value)) return [];
        const id = (value as Record<string, unknown>).id;
        return typeof id === "string" ? [id] : [];
      }),
    ),
  ];
}

export const memoryNagAgentRuntime = {
  async prepareContext({ agent, context }: { agent: AgentConfig; context: AgentContext }) {
    if (context.chatMode !== "roleplay") return null;
    const vault = await readMemoryNagVault(context.chatId);
    const participants = mergeParticipants(vault.participants, participantsFromAgentContext(context));
    const recentContext: AgentContext = {
      ...context,
      recentMessages: context.recentMessages.slice(-contextSize(agent)),
    };
    const candidates = shortlistMemoryNags({
      memories: vault.memories,
      participants,
      context: recentContext,
      perCharacter: vault.settings.memoriesToConsider,
    });
    if (participants.length > 0) {
      await updateMemoryNagVault(context.chatId, (current) => ({ ...current, participants }));
    }
    return {
      participants: vault.participants.length > 0 ? vault.participants : participants,
      currentCharacterIds: participants.filter((participant) => participant.current).map((participant) => participant.id),
      candidates: candidates.map((memory) => ({
        id: memory.id,
        text: memory.text,
        characterIds: memory.characterIds,
      })),
      maximumNags: vault.settings.memoriesToInject,
    } satisfies PreparedMemoryNagContext;
  },

  async finalizeResult({
    context,
    preparedContext,
    result,
  }: {
    agent: AgentConfig;
    context: AgentContext;
    preparedContext: unknown;
    result: AgentResult;
  }): Promise<AgentResult> {
    const prepared = preparedContext as PreparedMemoryNagContext | null;
    let finalized = result;
    if (result.success && prepared) {
      const source = result.data as { nags_needed?: unknown } | null;
      const candidateById = new Map(prepared.candidates.map((candidate) => [candidate.id, candidate]));
      const ids =
        source?.nags_needed === true
          ? selectedMemoryIds(result.data)
              .filter((id) => candidateById.has(id))
              .slice(0, prepared.maximumNags)
          : [];
      const nags = ids.flatMap((id) => candidateById.get(id)?.text ?? []);
      const data =
        nags.length > 0
          ? { nags_needed: true, memoryIds: ids, nags }
          : { nags_needed: false };
      await updateMemoryNagVault(context.chatId, (current) => ({
        ...current,
        lastRecall:
          nags.length > 0
            ? { memoryIds: ids, nags, createdAt: new Date().toISOString() }
            : null,
      }));
      finalized = { ...result, data };
    } else if (prepared) {
      await updateMemoryNagVault(context.chatId, (current) => ({ ...current, lastRecall: null }));
    }
    try {
      await scanMemoryNagIfDue(context.chatId);
    } catch (error) {
      getMemoryNagRuntime().logger.warn(
        "[memory-nag] Automatic vault scan failed for %s: %s",
        context.chatId,
        error instanceof Error ? error.message : String(error),
      );
    }
    return finalized;
  },
};
