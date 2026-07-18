import type { LtmBudgetedChunk } from "./budget.js";
import { formatLtmChunkPromptText } from "./prompt-text.js";

export type LtmSerializedPromptArtifact = {
  kind: "long_term_memory";
  chunks: LtmBudgetedChunk[];
  content: string;
  estimatedTokens: number;
};

const LABELS: Record<string, string> = {
  character: "CHARACTERS",
  relationship: "RELATIONSHIPS",
  world: "WORLD",
  timeline_event: "TIMELINE",
  thread: "THREADS",
  tone: "TONE",
};

function escapeXml(text: string) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function serializeLongTermMemoryPrompt(
  chunks: LtmBudgetedChunk[],
  options: { preamble?: string; maxTokens: number },
): LtmSerializedPromptArtifact | null {
  const selected: LtmBudgetedChunk[] = [];
  let estimatedTokens = 6;
  for (const item of chunks) {
    const text = formatLtmChunkPromptText(item.chunk).trim();
    if (!text || estimatedTokens + item.estimatedTokens > options.maxTokens) continue;
    estimatedTokens += item.estimatedTokens;
    selected.push(item);
  }
  if (!selected.length) return null;

  while (selected.length > 0) {
    const groups = new Map<string, string[]>();
    for (const item of selected) {
      const text = formatLtmChunkPromptText(item.chunk).trim();
      const label = LABELS[item.chunk.noteType] ?? item.chunk.noteType.toUpperCase();
      groups.set(label, [...(groups.get(label) ?? []), escapeXml(text)]);
    }
    const body = Array.from(groups, ([label, items]) => `[${label}]\n${items.join("\n")}`).join("\n\n");
    const preamble = options.preamble?.trim();
    const content = preamble ? `${escapeXml(preamble)}\n\n${body}` : body;
    const finalTokens = Math.ceil(content.length / 4) + 6;
    if (finalTokens <= options.maxTokens) {
      return { kind: "long_term_memory", chunks: selected, content, estimatedTokens: finalTokens };
    }
    selected.pop();
  }
  return null;
}

export function isLongTermMemoryPromptPresent(messages: ReadonlyArray<{ content: string }>, content: string) {
  return Boolean(content) && messages.some((message) => message.content.includes(content));
}
