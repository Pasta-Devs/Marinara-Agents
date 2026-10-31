// ──────────────────────────────────────────────
// Otome Forge: the writing rules every love interest is written by (plan §1.7, design: Writing rules)
// ──────────────────────────────────────────────
// The bible prompt receives them so it designs a character they can hold; every prompt that writes story or his words
// (M2a on) receives them with the knowledge boundary first. The world plan and the bible author the hidden truth, so
// they never get the boundary. Prompt text: English, never localized.
// 0.5.3 (#1955): what the protagonist knows is only what the story has shown them, never a card or a bible, and an
// existing world's canon holds (the world plan names that world, setup/prompts.ts P2).
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import {
  BANNED_PHRASES,
  parseBannedPhrases,
} from "../../../../client/src/features/otome-forge/shared/banned-phrases.js";

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
  "The protagonist knows only what the story has shown them and what their own persona would know. A newcomer to this world knows none of its people, places, customs or terms yet.",
  "A card or bible is for writing a character, never what the protagonist knows: a love interest's past, body, habits, powers and words for their world reach the protagonist only on the page, when they are told, see it or find it out. Until then the protagonist does not understand them, and nobody talks to the protagonist as if they do.",
  "When the story is set in an existing world from a game, book, film or show (such as Teyvat from Genshin Impact), keep to its canon: its places, peoples, powers, history and terms. Never rename, replace or reinvent them.",
] as const;

export const STORY_PACING_INSTRUCTION =
  'If everything is special, nothing is. Depth, real or fake, is a "sometimes" ingredient. Introduce emotional payoffs only if they have proper build-ups between more mundane scenes.';

/**
 * The banned-phrases line: the built-in list, then the player's own (Settings → Content), each quoted as typed. With no
 * list of their own it is the line every prompt carried before, byte for byte.
 */
export function bannedPhrasesRule(own?: string): string {
  const theirs = parseBannedPhrases(own).map((phrase) => JSON.stringify(phrase));
  return `- Never use these overused phrases or patterns: ${[...BANNED_PHRASES, ...theirs].join("; ")}.`;
}

/** The banned-phrases line on its own, for prompts that write prose but no story (premise, world plan). */
export const BANNED_PHRASES_RULE = bannedPhrasesRule();

/**
 * The WRITING RULES block. `story: true` (every prompt that writes story or a character's words) puts the kit's
 * knowledge boundary first; planners pass false. `style` is the player's own instructions for how the story is
 * written (setup's first step, Settings → Content), given whole after the rules.
 */
export function otomeWritingRules({
  story,
  style,
  banned,
}: {
  story: boolean;
  style?: string;
  /** The player's own banned phrases as typed (Settings → Content), added to the built-in list. */
  banned?: string;
}): string {
  const own = style?.trim();
  const block = [
    "WRITING RULES",
    ...WRITING_RULES.map((rule) => `- ${rule}`),
    bannedPhrasesRule(banned),
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
