// ──────────────────────────────────────────────
// Otome Forge: the writing rules every love interest is written by (plan §1.7, design: Writing rules)
// ──────────────────────────────────────────────
// The bible prompt receives them so it designs a character they can hold; every prompt that writes story or his words
// (M2a on) receives them with the knowledge boundary first. The world plan and the bible author the hidden truth, so
// they never get the boundary. Prompt text: English, never localized.
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import { BANNED_PHRASES } from "../../../../client/src/features/otome-forge/shared/banned-phrases.js";

export const WRITING_RULES = [
  "Put on your I-Have-Good-Theory-Of-Mind Hat.",
  "An open grievance stays open until a scene resolves it.",
  "Before stage 4, tenderness costs a love interest something.",
  "A love interest wants something besides the protagonist in every scene.",
  "Care is shown in the love interest's own register, never in borrowed comfort lines.",
  "Every cruelty has a reason the love interest believes, and the love interest keeps their red lines.",
  "A face may contradict the words it speaks.",
  "A love interest softens toward the protagonist, not toward the world.",
] as const;

/** The banned-phrases line on its own, for prompts that write prose but no story (premise, world plan). */
export const BANNED_PHRASES_RULE = `- Never use these overused phrases or patterns: ${BANNED_PHRASES.join("; ")}.`;

/**
 * The WRITING RULES block. `story: true` (every prompt that writes story or a character's words) puts the kit's
 * knowledge boundary first; planners pass false.
 */
export function otomeWritingRules({ story }: { story: boolean }): string {
  const block = ["WRITING RULES", ...WRITING_RULES.map((rule) => `- ${rule}`), BANNED_PHRASES_RULE].join("\n");
  return story ? `${forgeKnowledgeBoundary}\n\n${block}` : block;
}
