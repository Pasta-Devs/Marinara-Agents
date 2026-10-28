// ──────────────────────────────────────────────
// Otome Forge: the item prompts P19 (he noticed), P21 (a Memory's Character Story plan) and P24 (Show {{name}}), plan M4
// "Other prompts"
// ──────────────────────────────────────────────
// Each builder returns `messages` in the plan's order (§1.7): system (role, JSON shape, rules, the knowledge boundary
// and writing rules, then the content contract), then the user turn ending with the contract reminder.
// - P21 (structured, 0.8, `planner`) is P10 for one love interest's side story: his full bible as a planner for him
//   alone may see it (S/story/prompts.ts bibleBlock and ledgerBlock keep the knowledge boundary), recall for [li], and
//   the Memory's title and premise from P20. A premise is a situation; how close they are follows his stage on the day
//   it is first opened. It is private: only he is in it. The narrator writes its nodes with P6's Character Story
//   framing (P22, P23).
// - P19 (chat job, 0.9, `home`: SFW whatever the Heat) and P24 (chat job, 0.9, `chat` for that love interest) write
//   one line about the protagonist's look, from his scene card as his own reader sees it (S/story/prompts.ts ownView,
//   as M3's P16 and P17). Neither is a scene: nothing happens because of it.
// Prompts are English and never localized; every line is written in the world's language. Outfit lines are English
// image tags, so the prompt asks for the look in his own words. A love interest may be any gender, and so may the
// protagonist: prompts name them or use their pronouns, never a fixed "he" or "she".
import { forgeChoicePlanMessages } from "@forge-kit/player-choices-server.mjs";
import { z, type ZodType } from "zod";
import type { Player, RunState, Unit, World } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { stageRow } from "../../../../../client/src/features/otome-forge/shared/arcs.js";
import { FACES } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import {
  NOTICED_WORDS_MAX,
  SHOW_WORDS_MAX,
  lineWords,
} from "../../../../../client/src/features/otome-forge/shared/wardrobe.js";
import type { Item, ItemLook } from "../../../../../client/src/features/otome-forge/shared/wish.js";
import { otomeContentContract, otomeContractReminder } from "../content-contract.js";
import type { OtomeMessage } from "../generation.js";
import { defaultLiState } from "../schemas/state.js";
import {
  ANGST_TYPES,
  CHAPTER_TAGS,
  ChapterPlanSchema,
  bibleBlock,
  ledgerBlock,
  ownView,
  protagonistBlock,
  sceneCardBlock,
  type ChapterPlanReply,
} from "../story/prompts.js";
import { otomeWritingRules } from "../writing-rules.js";

export const STORY_NODES_MIN = 3;
export const STORY_NODES_MAX = 5;
export const STORY_PLAN_TEMPERATURE = 0.8;
export const STORY_PLAN_TOKENS = 3000;
export const LINE_TEMPERATURE = 0.9;
export const LINE_TOKENS = 300;
const LINE_MAX = 400;

const lineText = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
/** The line without the quotation marks a model may wrap it in. */
const quoteless = (value: string) => value.replace(/^["“”«»「『]+|["“”«»」』]+$/gu, "").trim();

/** One line of his, or what is wrong with it (the generation core's repair turn names it). */
export function checkLine(value: unknown, maxWords: number): { text: string } | string {
  const text = quoteless(lineText(value));
  if (!text) return "text is empty";
  if (text.length > LINE_MAX || lineWords(text) > maxWords) return `text must be one line of at most ${maxWords} words`;
  return { text };
}

// ── P21: a Memory's Character Story (structured, 0.8, planner contract) ──

/** P21's reply: a chapter plan (P5's shape) and the one line he says that the Memory card voices. */
export interface StoryPlanReply extends ChapterPlanReply {
  voicedLine: string;
}

// P5's fields, with the voiced line added (zod v3 and v4 both keep an object schema's fields on `.shape`).
const PLAN_FIELDS = (ChapterPlanSchema as unknown as { shape: Record<string, ZodType> }).shape;
export const StoryPlanSchema = z.object({
  ...PLAN_FIELDS,
  voicedLine: z.string().min(1).max(LINE_MAX),
}) as unknown as ZodType<StoryPlanReply>;

const STORY_PLAN_SHAPE =
  '{"title": "...", "tags": ["..."], "summary": "...", "voicedLine": "...", "nodes": [{"kind": "beat|moment", "moment": "read-him|call|date", "guide": "...", "cast": ["<love interest id>"], "place": "..."}], "ledger": {"relationship": [{"li": "<id>", "line": "..."}], "conflict": [{"id": "<conflict id>", "li": "<id>", "type": "...", "action": "plant|escalate|complicate|resolve"}], "offscreen": []}}';

export interface StoryPlanInput {
  world: World;
  player: Player;
  /** Whose Memory it is. */
  unit: Unit;
  state: RunState;
  item: Pick<Item, "title" | "premise">;
  /** Recalled memory for [li] (the kit's text), or "". */
  memory: string;
}

/** P21: a 3–5 node Character Story of one love interest's, from the Memory's premise (S/items/character-story.ts). */
export function storyPlanMessages({ world, player, unit, state, item, memory }: StoryPlanInput): OtomeMessage[] {
  const name = unit.name;
  const li = unit.id;
  const stage = (state.lis[li] ?? defaultLiState()).stage;
  const row = stageRow(stage);
  const system = [
    "You are the Character Story planner of an otome visual novel: a character-driven romance mystery. The love interests are flawed and dynamic, with real conflicts and angst; each is a human inside a monster, who softens toward the protagonist and not toward the world.",
    `Plan ${name}'s CHARACTER STORY "${item.title}": a private side story between ${name} and the protagonist, outside the main plot, told as ${STORY_NODES_MIN} to ${STORY_NODES_MAX} nodes in play order; a narrator writes each node later as one scene the player reads.`,
    "Reply with ONLY a JSON object of this shape:",
    STORY_PLAN_SHAPE,
    "FIELDS",
    "- title: the Memory's title, exactly as given. summary: one or two lines on what the story is about, without giving away its turns (the player reads it).",
    `- tags: content tags a reader should see before it starts, from: ${CHAPTER_TAGS.join(", ")}. Only what the story really holds; [] when none apply.`,
    `- voicedLine: the one line ${name} says aloud in this story that holds its heart, in ${name}'s own voice, at most ${NOTICED_WORDS_MAX} words; it is voiced on the Memory's card. Not a question that demands an answer.`,
    "- nodes: kind beat is an ordinary scene; kind moment is a scene with a special framing, set by moment: read-him (the protagonist reads their face to see what they really feel), call (a phone call), date (time together that turns on something real).",
    `- guide: what happens in that node, 2 to 4 sentences, for the narrator: who wants what, what changes, where it leaves things. cast: exactly ["${li}"]. place: where it opens (optional).`,
    `- ledger.relationship: one line on what moved between ${name} and the protagonist. ledger.conflict: optional: complicate or escalate an open conflict by its id, or plant a new seed (type from: ${ANGST_TYPES.join(", ")}). ledger.offscreen: [].`,
    "RULES",
    `- ${STORY_NODES_MIN} to ${STORY_NODES_MAX} nodes of kind beat or moment (no confrontation, no gate). ${name} is in every node, and no other love interest appears: the story is private to ${name} and the protagonist.`,
    `- The Memory's premise is a situation, never a plot turn. How close they are follows where ${name} is now, stage ${stage} (${row.name}, ${row.balance}): it may deepen the bond, but it does not move the stage.`,
    "- Continue from the story so far: everything already played is canon and is never undone, contradicted or staged again.",
    "- Never reveal a secret before its stage, and never resolve the mystery. An open grievance stays open.",
    `- A new conflict seed never repeats one of ${name}'s last two kinds of angst (listed below).`,
    `- Write every text field in ${world.language}.`,
    "- Omit an optional field rather than writing null.",
    "",
    otomeWritingRules({ story: true }),
    "",
    otomeContentContract({ world, lis: [{ name }], kind: "planner" }),
  ].join("\n");
  const user = [
    "WORLD",
    world.setting.trim() || world.premise.trim(),
    world.mystery.question ? `The mystery: ${world.mystery.question}` : "",
    "",
    "PROTAGONIST",
    protagonistBlock(player),
    "",
    `${name.toUpperCase()} (stage ${stage}; whose Character Story this is)`,
    bibleBlock(unit, state, [li]),
    "",
    "LEDGERS",
    // As recall's cast [li]: no other love interest's own chapter reaches the plan.
    ledgerBlock(state, [unit], [li]) || "(none yet)",
    "",
    memory.trim() ? `STORY MEMORY\n${memory.trim()}` : "",
    "",
    "THE MEMORY",
    `Title: ${item.title}`,
    item.premise?.trim() ? `Premise: ${item.premise.trim()}` : "",
    "",
    `Plan ${name}'s Character Story now (id ${li}).`,
    otomeContractReminder("planner"),
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
  return forgeChoicePlanMessages(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    true,
  );
}

// ── P19 (he noticed) and P24 (Show {{name}}): one line about the protagonist's look ──

export interface LookLineInput {
  world: World;
  player: Player;
  /** The love interest who speaks. */
  unit: Unit;
  state: RunState;
  look: ItemLook;
}

export const LineReplySchema: ZodType<{ text: string }> = z.object({ text: z.string().min(1).max(LINE_MAX) });

export interface ShowReply {
  text: string;
  face?: string | null;
}

export const ShowReplySchema: ZodType<ShowReply> = z.object({
  text: z.string().min(1).max(LINE_MAX),
  face: z.string().max(20).nullable().optional(),
});

function lookBlock(look: ItemLook): string {
  return [
    `THE LOOK: "${look.name}".`,
    look.outfitLine.trim()
      ? `What it looks like (English image tags; say it in your own words, never quote them): ${look.outfitLine.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function lineRules(name: string, world: World, words: number): string[] {
  return [
    `- One line ${name} says, at most ${words} words, in ${name}'s own voice and register, in ${world.language}.`,
    `- What ${name} notices is the look itself; care shows in ${name}'s own register, and before stage 4 tenderness costs ${name} something.`,
    "- It is a line, not a scene: nothing happens in the story because of it, and nobody else is there.",
    "- Never a question that demands an answer. Never mention time apart, waiting, or the protagonist's real life.",
    "- Nothing about the protagonist's body beyond what they wear.",
  ];
}

function lookUser({ player, unit, state, look }: LookLineInput, task: string, kind: "home" | "chat"): string {
  return [
    "LOVE INTEREST",
    // As their own reader sees it (M3's ownView, as P16 and P17): nothing of another love interest's own chapters.
    sceneCardBlock(unit, ownView(state, unit.id).liState),
    "",
    "PROTAGONIST",
    protagonistBlock(player),
    "",
    lookBlock(look),
    "",
    task,
    otomeContractReminder(kind),
  ].join("\n");
}

/** P19: the line he says on noticing the look the protagonist now wears at home (the `home` contract: SFW). */
export function noticedMessages(input: LookLineInput): OtomeMessage[] {
  const { world, unit } = input;
  const name = unit.name;
  const system = [
    `You write the one line ${name}, a love interest in an otome visual novel, says on noticing that the protagonist is wearing a new look at home.`,
    'Reply with ONLY a JSON object: {"text": "..."}',
    "RULES",
    ...lineRules(name, world, NOTICED_WORDS_MAX),
    "",
    otomeWritingRules({ story: true }),
    "",
    otomeContentContract({ world, lis: [{ name }], kind: "home" }),
  ].join("\n");
  return [
    { role: "system", content: system },
    {
      role: "user",
      content: lookUser(input, `Write the line ${name} says on noticing this look now (id ${unit.id}).`, "home"),
    },
  ];
}

/** P24: his one in-character line when the protagonist shows him one of their looks (the `chat` contract for him). */
export function showMessages(input: LookLineInput): OtomeMessage[] {
  const { world, unit } = input;
  const name = unit.name;
  const system = [
    `You write the one line ${name}, a love interest in an otome visual novel, says when the protagonist holds up one of their looks to show ${name}.`,
    `Reply with ONLY a JSON object: {"text": "...", "face": "${FACES.join("|")}"}`,
    "RULES",
    ...lineRules(name, world, SHOW_WORDS_MAX),
    `- face: the face ${name} makes, one of ${FACES.join(", ")}; it may contradict the words. Omit it for a neutral line.`,
    "",
    otomeWritingRules({ story: true }),
    "",
    otomeContentContract({ world, lis: [{ name }], kind: "chat" }),
  ].join("\n");
  return [
    { role: "system", content: system },
    {
      role: "user",
      content: lookUser(input, `Write ${name}'s line now, as the protagonist shows this look (id ${unit.id}).`, "chat"),
    },
  ];
}
