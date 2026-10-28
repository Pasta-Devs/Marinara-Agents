// ──────────────────────────────────────────────
// Otome Forge: the care line and P27, the Caring message (plan M6 "Server", design: Calendar and period tracker)
// ──────────────────────────────────────────────
// The tracker lives only in the player's browser. On a tracked day the client may send ONE line about today, built
// from the protagonist's own name and possessive pronoun, in exactly one of three templates (careLineFor). The server
// accepts nothing else (allowedCareLines), so free text and the cycle's history can never reach a prompt.
//
// P27 writes his caring note around that line: the `care` content contract (SFW plus the comfort rule; Heat and
// Darkness never apply), the knowledge boundary (the protagonist told him, so he may know it), and his care card, the
// scene card without darkness: voice, never-list, how he cares, his tics and how he sounds tender. Anger, jealousy,
// red lines, his mask's tells, hidden secrets and what stands between them stay out: the note is warmth only, whatever
// the story is doing. Order (plan §1.7): system (role, JSON shape, rules, boundary, contract), then the user turn
// (world, protagonist, his care card, the line, the task, the contract reminder). Prompts are English and never
// localized; the note is written in the world's language.
import { sliceTextToTokenBudget } from "@forge-kit/shared-token-estimator.mjs";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import { z, type ZodType } from "zod";
import type { Player, Unit, World } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { NOTE_TEXT_MAX } from "../../../../../client/src/features/otome-forge/shared/home.js";
import { COMFORT_RULE, otomeContentContract, otomeContractReminder } from "../content-contract.js";
import type { OtomeMessage } from "../generation.js";
import { NO_ABSENCE_RULE } from "../home/prompts.js";
import { BANNED_PHRASES_RULE } from "../writing-rules.js";

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

// ── P27: care note (chat, care contract, foreground lane) ──

export const CARE_NOTE_WORDS_MAX = 40;
export const CARE_NOTE_SENTENCES_MAX = 3;
/** The care card's budget: smaller than the scene card, since it carries only his voice. */
const CARE_CARD_MAX_TOKENS = 160;

export interface CareNoteReply {
  note: string;
}

export const CareNoteReplySchema: ZodType<CareNoteReply> = z.object({ note: z.string().min(1).max(NOTE_TEXT_MAX) });

/** A reply that diagnoses, prescribes or guesses about the body gets the repair turn (SH/home.ts, shared with the client). */
export { soundsMedical } from "../../../../../client/src/features/otome-forge/shared/home.js";

const items = (values: readonly string[], count: number) =>
  values
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, count)
    .join("; ");

/** His scene card without darkness: who he is, how he speaks and how he cares. Never his anger, secrets or red lines. */
export function careCard(unit: Pick<Unit, "name" | "pronouns" | "bible">): string {
  const { name, pronouns, bible } = unit;
  const header = `${name} (${pronouns.subject}/${pronouns.object}).`;
  if (!bible) return header;
  const voice = bible.voice;
  const card = [
    header,
    [
      voice.register.trim() && `Voice: ${voice.register.trim()}.`,
      items(voice.never, 3) && `Never: ${items(voice.never, 3)}.`,
      voice.careLanguage.trim() && `Care: ${voice.careLanguage.trim()}.`,
    ]
      .filter(Boolean)
      .join(" "),
    items(voice.tics, 3) && `Tics: ${items(voice.tics, 3)}.`,
    voice.samples.tender.trim() && `How ${name} sounds when tender: ${voice.samples.tender.trim()}`,
  ]
    .filter(Boolean)
    .join("\n");
  return sliceTextToTokenBudget(card, CARE_CARD_MAX_TOKENS);
}

export interface CareNoteInput {
  world: Pick<World, "content" | "images" | "language" | "setting" | "premise">;
  player: Pick<Player, "name" | "pronouns">;
  unit: Pick<Unit, "name" | "pronouns" | "bible">;
  /** One of allowedCareLines(player), exactly. The caller redacts it from the logged prompt. */
  careLine: string;
}

export function careNoteMessages({ world, player, unit, careLine }: CareNoteInput): OtomeMessage[] {
  const name = unit.name;
  const protagonist = player.name.trim() || "The protagonist";
  const system = [
    `You write a short caring note from ${name} to the protagonist in an otome visual novel, in ${name}'s own voice. The protagonist has just told ${name} one thing about today, quoted under TOLD TODAY as ${name} heard it ("you" there is ${name}), and ${name} answers with comfort. The player reads it on the Home screen.`,
    "Reply with ONLY a JSON object of this shape:",
    '{"note": "..."}',
    "FIELDS",
    `- note: at most ${CARE_NOTE_WORDS_MAX} words in one to ${CARE_NOTE_SENTENCES_MAX} sentences, to "you".`,
    "RULES",
    `- ${COMFORT_RULE}`,
    "- Warmth only, whatever is happening in the story: no darkness, possessiveness, jealousy, sharpness, teasing, menace or cost.",
    "- Answer only what the protagonist told you. Never guess how their body feels, name a symptom, or mention dates, cycles or predictions beyond it.",
    `- Care is shown in ${name}'s own register (the voice and care on the card), never in borrowed comfort lines.`,
    "- No question that demands an answer; the note needs no reply.",
    `- ${NO_ABSENCE_RULE}`,
    "- A note, not a scene: nothing happens in the story because of it.",
    BANNED_PHRASES_RULE,
    `- Write the note in ${world.language}.`,
    "",
    forgeKnowledgeBoundary,
    "",
    otomeContentContract({ world, lis: [{ name }], kind: "care" }),
  ].join("\n");
  const user = [
    "WORLD",
    world.setting.trim() || world.premise.trim(),
    "",
    "PROTAGONIST",
    `${protagonist} (${player.pronouns.subject}/${player.pronouns.object}/${player.pronouns.possessive}), addressed as "you". Never assume a gender the pronouns do not state.`,
    "",
    "LOVE INTEREST",
    careCard(unit),
    "",
    "TOLD TODAY",
    careLine,
    "",
    `Write ${name}'s caring note now.`,
    otomeContractReminder("care"),
  ]
    .filter((text, index, all) => text !== "" || all[index - 1] !== "")
    .join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
