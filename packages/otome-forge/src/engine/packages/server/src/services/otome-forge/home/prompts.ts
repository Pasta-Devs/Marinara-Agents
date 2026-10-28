// ──────────────────────────────────────────────
// Otome Forge: the Home prompts P15 (line pack) and P16 (message of the day), plan M3 "Home server"
// ──────────────────────────────────────────────
// Both write a love interest's own words, so both carry the knowledge boundary and the writing rules, and both use the
// `home` content contract: SFW wording plus Lines and Veils whatever the Heat (in Dark, sharp or possessive about
// story events only). P15 also carries the comfort rule word for word, for the comfort lines, which are warmth only:
// Darkness never reaches them (plan §1.7 gives the comfort pool the `care` contract; P15 writes it in the same call as
// the rest of the pack, so its field says so). Neither may mention the protagonist's absence, how long it has been, or
// their real life, and neither asks a question that demands an answer (P15's lines carry no question mark at all,
// except an annoyed line's rhetorical one).
// Order (plan §1.7): system (role, JSON shape, rules, boundary and writing rules, contract), then the user turn
// (world, protagonist, his scene card, what he knows and remembers, the task, the contract reminder). Prompts are
// English and never localized; the lines and the note are written in the world's language.
import { z, type ZodType } from "zod";
import type {
  ClawCheat,
  LiState,
  Player,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { FACES } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import {
  LINE_COUNTS,
  LINE_WORDS_MAX,
  MOOD_REASON_WORDS_MAX,
  NOTE_CURT_WORDS_MAX,
  NOTE_WORDS_MAX,
  NOTE_TEXT_MAX,
  timeOfDayOf,
  type TimeOfDay,
} from "../../../../../client/src/features/otome-forge/shared/home.js";
import { COMFORT_RULE, otomeContentContract, otomeContractReminder } from "../content-contract.js";
import type { OtomeMessage } from "../generation.js";
import { otomeSceneCard } from "../scene-card.js";
import { betweenYou } from "../story/prompts.js";
import { otomeWritingRules } from "../writing-rules.js";

/** The rule both prompts carry: Home never speaks about the player's absence or life outside the story. */
export const NO_ABSENCE_RULE =
  "Never mention the protagonist being away, how long it has been since you last spoke, or their real life outside the story (no devices, apps, players or screens).";

/**
 * English wording that speaks about the protagonist's absence: a reply that uses it gets the repair turn. The prompt
 * rule covers every language; this catches the common English slips.
 */
const ABSENCE =
  /\b(?:where (?:have|were) you|welcome back|you(?:['’]re| are) back|(?:you )?came back|been (?:a while|ages|so long|too long|forever)|long time no|(?:have )?missed you|you(?:['’]ve| have) been (?:gone|away)|finally (?:here|back)|left me waiting)\b/i;

export function mentionsAbsence(text: string): boolean {
  return ABSENCE.test(text);
}

/** A question mark in any script P15 and P16 may write: neither the note nor a line asks one. */
export const QUESTION_MARK = /[?？¿؟]/u;

const pronounText = (pronouns: Unit["pronouns"]) => `${pronouns.subject}/${pronouns.object}/${pronouns.possessive}`;

function protagonistLine(player: Pick<Player, "name" | "pronouns">): string {
  return `${player.name || "The protagonist"} (${pronounText(player.pronouns)}), addressed as "you". Never assume a gender the pronouns do not state.`;
}

// ── P15: line pack (structured, 0.9, home contract, background lane) ──

const line = z.string().max(400);
const lines = z.array(line).max(16);
const times = z.object({ morning: lines, day: lines, night: lines });
const claw = z.object({ cheer: lines, cheat: lines, win: lines, miss: lines, plush: lines });

export interface LinePackReply {
  tap: { head: Record<TimeOfDay, string[]>; hand: Record<TimeOfDay, string[]>; heart: Record<TimeOfDay, string[]> };
  annoyed: string[];
  cold: string[];
  comfort?: string[] | null;
  claw?: { cheer: string[]; cheat: string[]; win: string[]; miss: string[]; plush: string[] } | null;
}

export const LinePackReplySchema: ZodType<LinePackReply> = z.object({
  tap: z.object({ head: times, hand: times, heart: times }),
  annoyed: lines,
  cold: lines,
  comfort: lines.nullable().optional(),
  claw: claw.nullable().optional(),
});

/** How each claw cheat style reads in the prompt (bible.play.cheat), without a pronoun. */
const CHEAT_TEXT: Record<ClawCheat, string> = {
  steady: "steadying the claw for the protagonist by hand",
  nudge: "nudging or bumping the machine at the right moment",
  extra: "slipping the protagonist an extra try",
  freeze: "making the claw stop dead over the prize",
  calculate: "working out the angle and saying exactly when to drop",
};

export interface LinePackInput {
  world: Pick<World, "content" | "images" | "language" | "setting" | "premise">;
  player: Pick<Player, "name" | "pronouns">;
  unit: Pick<Unit, "name" | "pronouns" | "bible">;
  stage: number;
  /** Write the lines written once as well: comfort and the Claw Machine's. */
  withFixed: boolean;
}

export function linePackMessages({ world, player, unit, stage, withFixed }: LinePackInput): OtomeMessage[] {
  const name = unit.name;
  const counts = LINE_COUNTS;
  const shape = withFixed
    ? '{"tap": {"head": {"morning": ["..."], "day": ["..."], "night": ["..."]}, "hand": {...}, "heart": {...}}, "annoyed": ["..."], "cold": ["..."], "comfort": ["..."], "claw": {"cheer": ["..."], "cheat": ["..."], "win": ["..."], "miss": ["..."], "plush": ["..."]}}'
    : '{"tap": {"head": {"morning": ["..."], "day": ["..."], "night": ["..."]}, "hand": {...}, "heart": {...}}, "annoyed": ["..."], "cold": ["..."]}';
  const cheat = CHEAT_TEXT[unit.bible?.play.cheat ?? "steady"];
  const system = [
    `You write the pre-written Home lines of ${name}, a love interest in an otome visual novel. On the Home screen the protagonist taps ${name} (head, hand or heart) and hears one of these lines at once, so each line must stand on its own.`,
    "Reply with ONLY a JSON object of this shape:",
    shape,
    "FIELDS",
    `- tap: for each place the protagonist touches (head: hair or head; hand: hand; heart: chest), ${counts.tap} lines for the morning, ${counts.tap} for the day and ${counts.tap} for the night, each fitting that time.`,
    `- annoyed: ${counts.annoyed} lines for when the protagonist pokes ${name} too many times in a row: exasperated and still in character, never cruel.`,
    `- cold: ${counts.cold} lines for while a rupture stands between them: distant and clipped, but within ${name}'s red lines; never cruel, threatening or contemptuous of the protagonist.`,
    ...(withFixed
      ? [
          `- comfort: ${counts.comfort} lines of generic comfort for a rough day, said in ${name}'s own register. ${COMFORT_RULE} Never guess why the day was hard. These lines are warmth only, whatever the stage and the rules below: no darkness, possessiveness, jealousy, sharpness, menace or cost.`,
          `- claw: lines for a claw machine the two of them play together: cheer (${counts.claw.cheer}, while the protagonist plays), cheat (${counts.claw.cheat}, when ${name} cheats for them by ${cheat}), win (${counts.claw.win}, when they win), miss (${counts.claw.miss}, when the claw misses), plush (${counts.claw.plush}, when a plush joins their shelf).`,
        ]
      : []),
    "RULES",
    `- Every line is ${LINE_WORDS_MAX} words or fewer, spoken by ${name} to the protagonist, in ${name}'s own voice: the register, tics and never-list on the scene card.`,
    `- Fit stage ${stage}: only what ${name} lets show at this stage.`,
    "- No question that demands an answer: no line has a question mark, except an annoyed line's rhetorical one.",
    `- ${NO_ABSENCE_RULE}`,
    "- No spoilers: never state a hidden secret; it may show only as a tell.",
    "- No two lines alike.",
    `- Write every line in ${world.language}.`,
    "",
    otomeWritingRules({ story: true }),
    "",
    otomeContentContract({ world, lis: [{ name }], kind: "home" }),
  ].join("\n");
  const samples = unit.bible?.voice.samples;
  const sampleLines = samples
    ? [
        samples.guarded && `Guarded: ${samples.guarded}`,
        samples.tender && `Tender: ${samples.tender}`,
        samples.angry && `Angry: ${samples.angry}`,
      ].filter(Boolean)
    : [];
  const tics = unit.bible?.voice.tics ?? [];
  const user = [
    "WORLD",
    world.setting.trim() || world.premise.trim(),
    "",
    "PROTAGONIST",
    protagonistLine(player),
    "",
    "LOVE INTEREST",
    otomeSceneCard(unit, { stage }),
    sampleLines.length ? `How ${name} sounds:\n${sampleLines.join("\n")}` : "",
    tics.length ? `Tics: ${tics.slice(0, 4).join("; ")}` : "",
    "",
    `Write ${name}'s Home lines for stage ${stage} now.`,
    otomeContractReminder("home"),
  ]
    .filter((text, index, all) => text !== "" || all[index - 1] !== "")
    .join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

// ── P16: message of the day (chat, 0.9, home contract, foreground lane) ──

export interface NoteReply {
  text: string;
  face?: string | null;
  mood: { word: string; reason: string };
}

export const NoteReplySchema: ZodType<NoteReply> = z.object({
  text: z.string().min(1).max(NOTE_TEXT_MAX),
  face: z.string().max(40).nullable().optional(),
  mood: z.object({ word: z.string().min(1).max(60), reason: z.string().max(120) }),
});

export interface NoteDay {
  /** "Wednesday". */
  weekday: string;
  /** The local hour, 0–23. */
  hour: number;
  /** "Today is Kai's birthday." and the like; [] on an ordinary day. */
  special: string[];
}

export interface NoteInput {
  world: Pick<World, "content" | "images" | "language" | "setting" | "premise">;
  player: Pick<Player, "name" | "pronouns">;
  unit: Pick<Unit, "name" | "pronouns" | "bible">;
  liState: LiState;
  today: NoteDay;
  /** One thing he may know, from his own recall (reader: him), or "". */
  recalled: string;
  /** His latest off-screen line from the ledgers, or "". */
  offscreen: string;
  /** His notes before today, newest first (at most RECENT_NOTES). */
  recent: readonly string[];
  /** A rupture stands between them: the note is curt. */
  curt: boolean;
}

const TIME_WORDS: Record<TimeOfDay, string> = { morning: "morning", day: "afternoon", night: "evening" };

/** The time of day in words: the small hours (0–4) are late night, not the evening of the day they open. */
const timeWords = (hour: number) => (hour < 5 ? "late night, after midnight" : TIME_WORDS[timeOfDayOf(hour)]);

export function noteMessages({
  world,
  player,
  unit,
  liState,
  today,
  recalled,
  offscreen,
  recent,
  curt,
}: NoteInput): OtomeMessage[] {
  const name = unit.name;
  const system = [
    `You write ${name}'s message of the day in an otome visual novel: a short handwritten note ${name} left for the protagonist today, in ${name}'s own voice. The player finds it on the Home screen.`,
    "Reply with ONLY a JSON object of this shape:",
    `{"text": "...", "face": "${FACES.join("|")}|", "mood": {"word": "...", "reason": "..."}}`,
    "FIELDS",
    curt
      ? `- text: the note, curt: one short, distant sentence of at most ${NOTE_CURT_WORDS_MAX} words. A rupture stands between them; ${name} keeps a cold distance, within ${name}'s red lines, and is never cruel.`
      : `- text: the note, at most ${NOTE_WORDS_MAX} words in one or two sentences, to "you". A note, not a scene: nothing happens in the story because of it.`,
    `- face: the face ${name} wears writing it, one of ${FACES.join(", ")}, or "" for a plain look. It may contradict the words.`,
    `- mood: ${name}'s mood today in one word (for example irritable, restless, fond), and its reason in at most ${MOOD_REASON_WORDS_MAX} words, from ${name}'s own life or the story so far.`,
    "RULES",
    `- ${NO_ABSENCE_RULE}`,
    "- No question that demands an answer; the note needs no reply.",
    "- No spoilers: no hidden secret, and nothing the protagonist has not seen or been told.",
    "- Let today show where it fits: the weekday, the time, a special day.",
    "- Never repeat or closely echo one of the recent notes listed.",
    `- Write the note and the mood in ${world.language}.`,
    "",
    otomeWritingRules({ story: true }),
    "",
    otomeContentContract({ world, lis: [{ name }], kind: "home" }),
  ].join("\n");
  const user = [
    "WORLD",
    world.setting.trim() || world.premise.trim(),
    "",
    "PROTAGONIST",
    protagonistLine(player),
    "",
    "LOVE INTEREST",
    otomeSceneCard(unit, liState),
    betweenYou(unit, liState),
    "",
    "TODAY",
    `${today.weekday} ${timeWords(today.hour)}.${today.special.length ? ` ${today.special.join(" ")}` : ""}`,
    // Shared canon reaches every reader (a main chapter he was off-screen for, too), so it is framed as P17 frames it.
    recalled.trim()
      ? `\nWhat ${name} may know of the story (${name} remembers only what ${name} was there for or was told; anything else reached ${name} only as news, so the note never claims ${name} was there):\n${recalled.trim()}`
      : "",
    offscreen.trim() ? `\nWhere ${name} has been lately: ${offscreen.trim()}` : "",
    recent.length
      ? `\nRECENT NOTES (newest first; do not repeat)\n${recent.map((text) => `- ${text}`).join("\n")}`
      : "",
    "",
    `Write ${name}'s note for today now.`,
    otomeContractReminder("home"),
  ]
    .filter((text, index, all) => text !== "" || all[index - 1] !== "")
    .join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
