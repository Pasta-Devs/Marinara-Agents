// ──────────────────────────────────────────────
// Otome Forge: the care line, and what P27, the Caring message, sends back (plan M6 "Server", design: Calendar and
// period tracker)
// ──────────────────────────────────────────────
// The tracker lives only in the player's browser. On a tracked day the client may send ONE line about today, built
// from the protagonist's own name and possessive pronoun, in exactly one of three templates (careLineFor). The server
// accepts nothing else (allowedCareLines), so free text and the cycle's history can never reach a prompt.
// careLineFor mirrors the client's careLine (C/lib/cycle.ts), so its wording changes only together with it. P27 itself
// (the care card and careNoteMessages) is in S/prompts.ts; its checks are S/care/care-note.ts.
import { z, type ZodType } from "zod";
import type { Player } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { NOTE_TEXT_MAX } from "../../../../../client/src/features/otome-forge/shared/home.js";

// ── The care line ──

/** The longest period the tracker allows (periodLength 2–8), so the last "day n" a line may name. */
export const CARE_DAY_MAX = 8;
/** "Due in n days" is said only this close (cycleToday's `due` has inDays ≤ 3). */
export const CARE_DUE_MAX = 3;

/** Today's state as the client's cycleToday works it out. "Late" does not exist. */
export type CareToday = { kind: "day"; n: number } | { kind: "due"; inDays: number } | { kind: "due-today" };

/** The protagonist as the care line names them: the run's player, "The protagonist" and "their" when unset. */
function careSpeaker(player: Pick<Player, "name" | "pronouns">): { name: string; their: string } {
  return { name: player.name.trim() || "The protagonist", their: player.pronouns.possessive.trim() || "their" };
}

/**
 * The one line a Caring message may carry, mirroring the client's careLine (C/lib/cycle.ts): the player's
 * `name` (trimmed; "The protagonist" when empty) and `pronouns.possessive` (trimmed; "their" when empty).
 *   day        "{Name} has told you: today is day {n} of {their} period."
 *   due        "{Name} has told you: {their} period is due in {n} days."  (n = 1: "in 1 day")
 *   due-today  "{Name} has told you: {their} period is due around today."
 */
export function careLineFor(player: Pick<Player, "name" | "pronouns">, today: CareToday): string {
  const { name, their } = careSpeaker(player);
  if (today.kind === "day") return `${name} has told you: today is day ${today.n} of ${their} period.`;
  if (today.kind === "due") {
    return `${name} has told you: ${their} period is due in ${today.inDays} ${today.inDays === 1 ? "day" : "days"}.`;
  }
  return `${name} has told you: ${their} period is due around today.`;
}

/**
 * Every line the server accepts for this protagonist: day 1–8, due in 1–3 days, due around today. The set is built
 * from the stored name and pronoun rather than matched with a pattern, so nothing in a name needs escaping and only
 * these exact strings pass.
 */
export function allowedCareLines(player: Pick<Player, "name" | "pronouns">): Set<string> {
  const lines = new Set<string>([careLineFor(player, { kind: "due-today" })]);
  for (let n = 1; n <= CARE_DAY_MAX; n += 1) lines.add(careLineFor(player, { kind: "day", n }));
  for (let n = 1; n <= CARE_DUE_MAX; n += 1) lines.add(careLineFor(player, { kind: "due", inDays: n }));
  return lines;
}

// ── P27's reply: the care note (the prompt: S/prompts.ts careNoteMessages) ──

export const CARE_NOTE_WORDS_MAX = 40;
export const CARE_NOTE_SENTENCES_MAX = 3;

export interface CareNoteReply {
  note: string;
}

export const CareNoteReplySchema: ZodType<CareNoteReply> = z.object({ note: z.string().min(1).max(NOTE_TEXT_MAX) });

/** A reply that diagnoses, prescribes or guesses about the body gets the repair turn (SH/home.ts, shared with the client). */
export { soundsMedical } from "../../../../../client/src/features/otome-forge/shared/home.js";
