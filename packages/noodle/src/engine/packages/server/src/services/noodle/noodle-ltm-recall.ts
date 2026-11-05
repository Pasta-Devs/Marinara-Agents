// Noodle reads Long-Term Memory only through its published recall capability, so it never touches LTM's tables.
import { getCapabilityService } from "../capability-packages/capability-service-registry.service.js";

export type NoodleMemoryStatus = "ok" | "missing" | "off" | "error";

type RecallSection = { title?: string; text?: string };
type RecallService = {
  recall?: (input: Record<string, unknown>) => Promise<{ sections?: RecallSection[] } | null>;
};

const QUERY_TEXT_MAX = 8_000;
const RECALL_CHARACTER_MAX = 20;
const RECALL_MAX_TOKENS = 1_200;

let lastStatus: NoodleMemoryStatus | null = null;

/** The outcome of the latest memory read this server run, or null before the first one. */
export function getNoodleMemoryStatus(): NoodleMemoryStatus | null {
  return lastStatus;
}

/** Recent post text is the best hint of what the next posts are about; names are the fallback. */
export function noodleMemoryQueryText(postTexts: readonly string[], names: readonly string[]): string {
  const posts = postTexts
    .map((text) => text.trim())
    .filter(Boolean)
    .join("\n");
  return (posts || names.filter(Boolean).join(", ")).slice(0, QUERY_TEXT_MAX);
}

export async function recallNoodleMemories(input: {
  settings: { useLtmMemories?: boolean; ltmMemoryRecall?: string };
  characterIds: readonly string[];
  personaId?: string | null;
  queryText: string;
  signal?: AbortSignal;
}): Promise<{ lines: string[]; status: NoodleMemoryStatus | null }> {
  const queryText = input.queryText.trim();
  if (!input.settings.useLtmMemories || !queryText || (input.characterIds.length === 0 && !input.personaId)) {
    lastStatus = null;
    return { lines: [], status: null };
  }
  try {
    const service = getCapabilityService<RecallService>("long-term-memory:recall");
    if (typeof service?.recall !== "function") return { lines: [], status: (lastStatus = "missing") };
    const answer = await service.recall({
      caller: "noodle",
      queryText: queryText.slice(0, QUERY_TEXT_MAX),
      characterIds: input.characterIds.slice(0, RECALL_CHARACTER_MAX),
      ...(input.personaId ? { personaId: input.personaId } : {}),
      mode: "roleplay",
      maxTokens: RECALL_MAX_TOKENS,
      whole: input.settings.ltmMemoryRecall !== "relevant",
      ...(input.signal ? { signal: input.signal } : {}),
    });
    if (!answer) return { lines: [], status: (lastStatus = "off") };
    const lines = (answer.sections ?? [])
      .filter((section) => section.text?.trim())
      .map((section) => (section.title ? `${section.title}: ${section.text}` : String(section.text)));
    return { lines, status: (lastStatus = "ok") };
  } catch {
    return { lines: [], status: (lastStatus = "error") };
  }
}
