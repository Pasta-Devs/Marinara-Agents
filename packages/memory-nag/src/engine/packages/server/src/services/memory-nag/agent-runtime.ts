import type { AgentContext, AgentResult } from "@marinara-engine/shared";
import { participantsFromAgentContext } from "./participants.js";
import { shortlistMemoryNags } from "./retrieval.js";
import { scanMemoryNagIfDue } from "./scanner.js";
import { selectMemoryNagRecall } from "./selection.js";
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
  const raw = agent.settings.contextSize;
  if (raw === null || raw === undefined || raw === "") return 5;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.min(200, Math.trunc(value))) : 5;
}

function sameParticipants(
  left: PreparedMemoryNagContext["participants"],
  right: PreparedMemoryNagContext["participants"],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (participant, index) =>
        participant.id === right[index]?.id &&
        participant.name === right[index]?.name &&
        participant.current === right[index]?.current,
    )
  );
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
    if (participants.length > 0 && !sameParticipants(vault.participants, participants)) {
      await updateMemoryNagVault(context.chatId, (current) => ({ ...current, participants }));
    }
    return {
      participants,
      currentCharacterIds: participants
        .filter((participant) => participant.current)
        .map((participant) => participant.id),
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
      const data = selectMemoryNagRecall(result.data, prepared.candidates, prepared.maximumNags);
      finalized = { ...result, data };
      try {
        await updateMemoryNagVault(context.chatId, (current) => ({
          ...current,
          lastRecall: data.nags_needed
            ? { memoryIds: data.memoryIds, nags: data.nags, createdAt: new Date().toISOString() }
            : null,
        }));
      } catch (error) {
        getMemoryNagRuntime().logger.warn(
          "[memory-nag] Recall state failed to save for chat %s: %s",
          context.chatId,
          error instanceof Error ? error.message : String(error),
        );
      }
    } else if (prepared) {
      try {
        await updateMemoryNagVault(context.chatId, (current) => ({ ...current, lastRecall: null }));
      } catch (error) {
        getMemoryNagRuntime().logger.warn(
          "[memory-nag] Recall state failed to clear for chat %s: %s",
          context.chatId,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
    if (prepared) {
      void scanMemoryNagIfDue(context.chatId).catch((error) => {
        getMemoryNagRuntime().logger.warn(
          "[memory-nag] Automatic vault scan failed for %s: %s",
          context.chatId,
          error instanceof Error ? error.message : String(error),
        );
      });
    }
    return finalized;
  },
};
