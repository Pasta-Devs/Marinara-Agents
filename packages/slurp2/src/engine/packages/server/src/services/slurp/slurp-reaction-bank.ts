import { SLURP_SHIPPED_REACTIONS } from "./slurp-world-copy.js";

/**
 * Rules for the free comment bank.
 *
 * Pure and dependency-free, like the other Slurp rule modules, so the normalisation can be tested
 * without an Engine checkout. The model call that feeds it lives in
 * `slurp-reaction-bank.operation.ts`.
 *
 * ## Why a bank at all
 *
 * The free tier writes more text than everything else on the platform combined, and it must never
 * call the model to do it — a three-word comment is the worst trade a generation can make. So it
 * draws from a fixed bank. A fixed bank of any size eventually repeats, and the body is the part a
 * reader notices: the opener and the tail only dress it. The shipped bodies are the floor; this is
 * how the bank grows past them for the price of one generation every few hours.
 */

/** Stop asking once the stored bank is this large. Bodies, not rendered lines. */
export const SLURP_REACTION_BANK_TARGET = 160;

/** Matches the stored setting's per-item cap, so nothing generated can fail validation. */
export const SLURP_REACTION_BANK_MAX_BODY_LENGTH = 120;

/**
 * Compare bodies the way a reader does.
 *
 * Case and punctuation are stripped: a model asked for fan comments returns "Obsessed!" for a bank
 * that already holds "obsessed", and storing both buys nothing but a duplicate.
 */
function comparisonKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Fold new lines into the stored bank.
 *
 * The model is the one input here that cannot be trusted to return short, clean, distinct strings,
 * so everything it sends is normalised, bounded, and deduplicated against both banks before it is
 * kept. Returns the stored bank unchanged when nothing survives.
 */
export function mergeSlurpReactionBank(
  stored: readonly string[],
  incoming: readonly unknown[],
  limit = SLURP_REACTION_BANK_TARGET,
): string[] {
  const seen = new Set([...SLURP_SHIPPED_REACTIONS, ...stored].map(comparisonKey));
  const out = [...stored];
  for (const candidate of incoming) {
    if (out.length >= limit) break;
    if (typeof candidate !== "string") continue;
    // Strip the quoting and the trailing punctuation a model adds by habit. The tail bank supplies
    // the "!!" and the emoji, so a body that arrives pre-decorated renders as "obsessed!! 🔥".
    const body = candidate
      .trim()
      .replace(/^["'\s]+|["'\s]+$/gu, "")
      .replace(/[!.…]+$/u, "")
      .trim();
    if (!body || body.length > SLURP_REACTION_BANK_MAX_BODY_LENGTH) continue;
    const key = comparisonKey(body);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(body);
  }
  return out;
}
