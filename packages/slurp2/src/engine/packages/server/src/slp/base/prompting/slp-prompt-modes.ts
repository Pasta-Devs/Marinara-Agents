/**
 * Which prompt personality Slurp is running.
 *
 * ## Why there are two
 *
 * Slurp used to generate intimate moments and then photograph them. A creator
 * platform does not work that way: the person lives, decides what is postable,
 * produces it, and only then writes something to sell it. Skipping that middle
 * step is what made the feed read as artificial — every glass of water became a
 * finished post, and every photo was taken from a camera position nobody in the
 * scene could have reached.
 *
 * `produce` is the rebuilt model. `classic` is the old one, kept byte-identical
 * so the overhaul can be judged against the thing it replaces without a revert.
 *
 * The two modes keep separate prompt-block overrides. A player who tuned the
 * classic prompts for months must not lose that work by trying the new mode, and
 * must not find their classic edits silently reinterpreted against block ids that
 * only exist in produce mode.
 */
export const SLURP_PROMPT_MODES = ["classic", "produce"] as const;

export type SlurpPromptMode = (typeof SLURP_PROMPT_MODES)[number];

/** Produce mode ships on. Classic stays one switch away. */
export const SLURP_DEFAULT_PROMPT_MODE: SlurpPromptMode = "produce";

export function isSlurpPromptMode(value: unknown): value is SlurpPromptMode {
  return typeof value === "string" && (SLURP_PROMPT_MODES as readonly string[]).includes(value);
}

export function slurpPromptMode(value: unknown): SlurpPromptMode {
  return isSlurpPromptMode(value) ? value : SLURP_DEFAULT_PROMPT_MODE;
}
