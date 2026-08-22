import type { AgentContext } from "@marinara-engine/shared";
import type {
  MemoryNagMemory,
  MemoryNagParticipant,
} from "../../../../shared/src/features/agents/memory-nag/schema.js";

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "been",
  "before",
  "could",
  "from",
  "have",
  "into",
  "just",
  "like",
  "more",
  "said",
  "that",
  "their",
  "them",
  "then",
  "there",
  "they",
  "this",
  "with",
  "would",
  "your",
]);

function normalized(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(
    normalized(value)
      .split(/\s+/)
      .filter((token) => token.length >= 4 && !STOP_WORDS.has(token)),
  );
}

function tokenOverlap(left: Set<string>, right: Set<string>): number {
  let score = 0;
  for (const token of left) {
    if (right.has(token)) score += 3;
    else if ([...right].some((candidate) => candidate.startsWith(token) || token.startsWith(candidate))) score += 1;
  }
  return score;
}

function contextText(context: AgentContext): string {
  return [
    ...context.recentMessages.map((message) => message.content),
    context.mainResponse ?? "",
    ...(context.mainResponseSegments?.map((segment) => `${segment.characterName}: ${segment.content}`) ?? []),
  ].join("\n");
}

export function shortlistMemoryNags(input: {
  memories: MemoryNagMemory[];
  participants: MemoryNagParticipant[];
  context: AgentContext;
  perCharacter: number;
}): MemoryNagMemory[] {
  const text = contextText(input.context);
  const normalizedText = normalized(text);
  const contextTokens = tokens(text);
  const relevantIds = new Set<string>();
  for (const message of input.context.recentMessages) {
    if (message.characterId) relevantIds.add(message.characterId);
  }
  for (const segment of input.context.mainResponseSegments ?? []) {
    if (segment.characterId) relevantIds.add(segment.characterId);
  }
  for (const participant of input.participants) {
    if (normalizedText.includes(normalized(participant.name))) relevantIds.add(participant.id);
  }
  if (relevantIds.size === 0) {
    input.participants.filter((participant) => participant.current).forEach((participant) => relevantIds.add(participant.id));
  }

  const scored = input.memories
    .filter((memory) => memory.status === "active")
    .map((memory) => ({
      memory,
      score:
        tokenOverlap(tokens(memory.text), contextTokens) +
        memory.characterIds.filter((id) => relevantIds.has(id)).length * 6,
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        Date.parse(right.memory.updatedAt) - Date.parse(left.memory.updatedAt) ||
        left.memory.id.localeCompare(right.memory.id),
    );

  const selected = new Map<string, MemoryNagMemory>();
  for (const characterId of relevantIds) {
    let count = 0;
    for (const entry of scored) {
      if (!entry.memory.characterIds.includes(characterId)) continue;
      selected.set(entry.memory.id, entry.memory);
      count++;
      if (count >= input.perCharacter) break;
    }
  }
  return [...selected.values()];
}

export function shortlistMemoriesForScan(
  memories: MemoryNagMemory[],
  participants: MemoryNagParticipant[],
  transcript: string,
  limit = 80,
): MemoryNagMemory[] {
  const transcriptTokens = tokens(transcript);
  const normalizedTranscript = normalized(transcript);
  const mentionedIds = new Set(
    participants
      .filter((participant) => normalizedTranscript.includes(normalized(participant.name)))
      .map((participant) => participant.id),
  );
  return memories
    .filter((memory) => memory.status === "active")
    .map((memory) => ({
      memory,
      score:
        tokenOverlap(tokens(memory.text), transcriptTokens) +
        memory.characterIds.filter((id) => mentionedIds.has(id)).length * 6,
    }))
    .sort((left, right) => right.score - left.score || Date.parse(right.memory.updatedAt) - Date.parse(left.memory.updatedAt))
    .slice(0, limit)
    .map((entry) => entry.memory);
}
