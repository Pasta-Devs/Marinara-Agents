// ──────────────────────────────────────────────
// Wordle — model-facing move tool
// ──────────────────────────────────────────────
// NOT registered in the global tool registry. The runner injects this only on
// a bot seat's turn (scoped per active game). The human never uses it — the
// board UI posts guesses to the REST endpoint directly.

import type { ToolDefinition } from "../../function-calls/tool-definitions.js";

export const wordleGuessToolManifest = {
  name: "wordle_guess",
  description:
    "Guess today's five-letter word. The guess must be a real English word of exactly five letters. " +
    "Use what your earlier clues told you: keep letters marked correct in their spot, move letters marked present " +
    "to a different spot, and leave out letters marked absent.",
  parameters: {
    type: "object",
    properties: {
      word: {
        type: "string",
        description: "Your five-letter guess, letters only (for example: crane).",
      },
    },
    required: ["word"],
  },
} satisfies ToolDefinition;

/** All Wordle tools. */
export const WORDLE_TOOL_MANIFESTS: readonly ToolDefinition[] = [wordleGuessToolManifest];
