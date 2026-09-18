import { SLURP_SHIPPED_REACTIONS } from "./slp-world-copy.js";

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

/**
 * The stored bank, keyed by Fan Type.
 *
 * `shared` is the old flat list — every legacy array normalises straight into it, which is why the
 * setting kept its name. `byType` holds what a single Fan Type says and nobody else does.
 */
export type SlurpReactionBanks = { shared: string[]; byType: Record<string, string[]> };

/** Below this many bodies of its own, a type also draws from the shared bank. */
export const SLURP_TYPE_BANK_THIN = 12;

const bodies = (value: unknown, limit: number): string[] => {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (out.length >= limit) break;
    if (typeof entry !== "string") continue;
    const body = entry.trim();
    if (body && body.length <= SLURP_REACTION_BANK_MAX_BODY_LENGTH) out.push(body);
  }
  return out;
};

/**
 * Read whatever is stored as banks.
 *
 * Takes the legacy array, the object, or rubbish, and always returns a usable pair. Nothing is
 * dropped on the way: an install that grew 300 shared bodies keeps all of them under `shared`.
 */
export function slurpNormalizeReactionBanks(raw: unknown): SlurpReactionBanks {
  if (Array.isArray(raw)) return { shared: bodies(raw, 400), byType: {} };
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const byType: Record<string, string[]> = {};
  const rawByType =
    record.byType && typeof record.byType === "object" ? (record.byType as Record<string, unknown>) : {};
  for (const [id, value] of Object.entries(rawByType)) {
    const list = bodies(value, 500);
    if (list.length > 0) byType[id] = list;
  }
  return { shared: bodies(record.shared, 400), byType };
}

/**
 * The pool one fan draws from.
 *
 * Its own bodies first — the three shipped starters plus whatever the growth run added — and the
 * shared bank underneath only while the type is still thin. A Troll with a full bank never says
 * what a Lurker says; a brand-new custom type still has something to say on its first tick.
 */
export function slurpReactionBodiesForType(
  banks: SlurpReactionBanks,
  fanTypeId: string | null | undefined,
  starters: readonly string[] = [],
): string[] {
  const own = fanTypeId ? [...starters, ...(banks.byType[fanTypeId] ?? [])] : [];
  if (own.length >= SLURP_TYPE_BANK_THIN) return own;
  return [...own, ...SLURP_SHIPPED_REACTIONS, ...banks.shared];
}

/**
 * Fold one batched growth response into the banks.
 *
 * The response is a map of bank id to lines: the fan type ids that were under target, plus
 * `shared`. Anything not asked for is ignored, every bank is clamped to its own target, and a
 * response that is malformed, refused, or all duplicates returns the banks unchanged — the growth
 * run is a nicety and must never damage what already works.
 */
export function mergeSlurpReactionBankBatch(
  banks: SlurpReactionBanks,
  parsed: unknown,
  targets: Readonly<Record<string, number>>,
): SlurpReactionBanks {
  const record =
    parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  let changed = false;
  const next: SlurpReactionBanks = { shared: banks.shared, byType: { ...banks.byType } };
  for (const [id, target] of Object.entries(targets)) {
    const incoming = record[id];
    if (!Array.isArray(incoming)) continue;
    const stored = id === "shared" ? banks.shared : (banks.byType[id] ?? []);
    const merged = mergeSlurpReactionBank(stored, incoming, target);
    if (merged.length === stored.length) continue;
    changed = true;
    if (id === "shared") next.shared = merged;
    else next.byType[id] = merged;
  }
  return changed ? next : banks;
}
