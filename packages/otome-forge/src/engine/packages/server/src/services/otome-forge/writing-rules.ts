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
  "All characters, player included, can change; for better, or worse.",
  "Character change must be earned and consistent with established identity and canonical character cards; it is not automatic redemption or a replacement personality.",
] as const;

export const STORY_PACING_INSTRUCTION =
  'If everything is special, nothing is. Depth, real or fake, is a "sometimes" ingredient. Introduce emotional payoffs only if they have proper build-ups between more mundane scenes.';

/** The banned-phrases line on its own, for prompts that write prose but no story (premise, world plan). */
export const BANNED_PHRASES_RULE = `- Never use these overused phrases or patterns: ${BANNED_PHRASES.join("; ")}.`;

/**
 * The WRITING RULES block. `story: true` (every prompt that writes story or a character's words) puts the kit's
 * knowledge boundary first; planners pass false. `style` is the player's own instructions for how the story is
 * written (setup's first step, Settings → Content), given whole after the rules.
 */
export function otomeWritingRules({ story, style }: { story: boolean; style?: string }): string {
  const own = style?.trim();
  const block = [
    "WRITING RULES",
    ...WRITING_RULES.map((rule) => `- ${rule}`),
    BANNED_PHRASES_RULE,
    ...(own
      ? [
          "",
          "HOW THE PLAYER WANTS IT WRITTEN (follow it in every line you write; the content contract still holds):",
          own,
        ]
      : []),
  ].join("\n");
  return story ? `${forgeKnowledgeBoundary}\n\n${block}` : block;
}
