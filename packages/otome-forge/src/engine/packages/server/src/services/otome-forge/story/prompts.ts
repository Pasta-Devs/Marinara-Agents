// ──────────────────────────────────────────────
// Otome Forge: the story prompts P5 (chapter plan) and P6 (beat narrator), plan M2a "Prompts"
// ──────────────────────────────────────────────
// Each builder returns `messages` in the plan's order (§1.7): system (role, JSON shape, rules, the knowledge boundary
// and writing rules, then the content contract), then the user turn: full bibles (P5: the Lead's and every Foil
// candidate's, since the planner picks the Foil) or scene cards (P6) with what stands between each love interest and
// the protagonist, the ledgers, recalled memory, the story so far, and the task, ending with the contract reminder. Both get the kit's choice instructions (forgeChoicePlanMessages, forgeChoiceMessages) and
// both carry forgeKnowledgeBoundary. Prompts are English and never localized; prose is written in the world's
// language, place tags and image briefs in English.
import { forgeChoiceMessages, forgeChoicePlanMessages } from "@forge-kit/player-choices-server.mjs";
import { z, type ZodType } from "zod";
import type {
  Chapter,
  ChapterNode,
  LiId,
  LiState,
  Player,
  RunState,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { FACES, MUSIC_MOODS } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { LIMIT_IDS } from "../../../../../client/src/features/otome-forge/shared/content.js";
import { otomeContentContract, otomeContractReminder } from "../content-contract.js";
import type { OtomeMessage } from "../generation.js";
import { otomeSceneCard } from "../scene-card.js";
import { defaultLiState } from "../schemas/state.js";
import { otomeWritingRules } from "../writing-rules.js";

/** The sentence forgeChoiceMessages replaces when choices are on; P6's system text must contain it exactly. */
export const NO_CHOICES_SENTENCE =
  "NEVER offer choices; the player only advances. Do not ask the player to pick anything.";

/** The kinds of angst a conflict seed may be; a new seed never repeats one of that love interest's last two. */
export const ANGST_TYPES = [
  "misunderstanding",
  "jealousy",
  "secret",
  "betrayal",
  "duty",
  "pride",
  "ideals",
  "past",
  "rivalry",
  "danger",
] as const;
export type AngstType = (typeof ANGST_TYPES)[number];

/** Story tags beyond the content LimitIds (plan M2a P5). */
export const STORY_TAGS = ["jealousy", "grief", "possessiveness", "betrayal", "violence"] as const;
export const CHAPTER_TAGS: readonly string[] = [...LIMIT_IDS, ...STORY_TAGS];

export const NODES_MIN = 6;
export const NODES_MAX = 9;
const RECENT_LEDGER = 8;

const TRUST_WORDS = ["cold", "wary", "uneasy", "neutral", "warm", "trusting", "devoted"] as const;
const TENSION_WORDS = ["calm", "charged", "strained", "breaking"] as const;

const pronounText = (pronouns: Unit["pronouns"]) => `${pronouns.subject}/${pronouns.object}/${pronouns.possessive}`;
const liStateOf = (state: RunState, li: LiId): LiState => state.lis[li] ?? defaultLiState();
const stageOf = (state: RunState, li: LiId) => liStateOf(state, li).stage;

/**
 * What stands between them and the protagonist: trust and tension in words, open grievances (with their ids, so a
 * node can resolve them), a rupture, and what the protagonist has told them. The grievances shown are the newest
 * three, the rupture's and those `also` names (the ones a node may resolve), or every one with "all" (the planner).
 * ponytail: written beside the scene card rather than on it, so the card keeps M1's 250-token budget; fold it into
 * otomeSceneCard once its budget is re-measured with these lines.
 */
export function betweenYou(unit: Pick<Unit, "name">, liState: LiState, also: readonly string[] | "all" = []): string {
  const trust = TRUST_WORDS[Math.max(0, Math.min(6, liState.trust + 3))];
  const tension = TENSION_WORDS[Math.max(0, Math.min(3, liState.tension))];
  const open = liState.grievances.filter(
    (grievance) => grievance.status === "open" || grievance.status === "festering",
  );
  const ruptureId = liState.rupture?.grievanceId;
  const shown =
    also === "all"
      ? open
      : open.filter(
          (grievance, index) => index >= open.length - 3 || grievance.id === ruptureId || also.includes(grievance.id),
        );
  const lines = [`Between ${unit.name} and the protagonist: trust ${trust}, tension ${tension}.`];
  for (const grievance of shown) {
    const holder = grievance.by === "li" ? unit.name : "the protagonist";
    lines.push(`Open grievance ${grievance.id} (${grievance.severity}, held by ${holder}): ${grievance.text}`);
  }
  const rupture = liState.rupture && liState.grievances.find((item) => item.id === liState.rupture?.grievanceId);
  if (rupture) {
    lines.push(
      `A rupture stands between them (${rupture.id}): ${unit.name} keeps a cold distance until a scene repairs it.`,
    );
  }
  const told = liState.disclosures.slice(-3).map((item) => item.text);
  if (told.length) lines.push(`The protagonist has told ${unit.name}: ${told.join(" ")}`);
  return lines.join("\n");
}

function protagonistBlock(player: Player): string {
  return [
    `${player.name || "The protagonist"} (${pronounText(player.pronouns)}). Never assume a gender the pronouns do not state.`,
    player.traits.length ? `Traits: ${player.traits.join("; ")}` : "",
    player.goal.trim() ? `Their own goal: ${player.goal.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function ledgerBlock(state: RunState, units: readonly Unit[]): string {
  const name = (li: LiId) => units.find((unit) => unit.id === li)?.name ?? li;
  const { relationship, conflicts, offscreen } = state.ledgers;
  const lines: string[] = [];
  for (const row of relationship.slice(-RECENT_LEDGER)) lines.push(`- ${row.key}, ${name(row.li)}: ${row.line}`);
  const open = conflicts.filter((row) => row.status === "open");
  const conflictLines = open.map((row) => `- ${row.id} (${row.type}, ${name(row.li)}, since chapter ${row.chapter})`);
  const angst = units
    .map((unit) => ({ unit, recent: liStateOf(state, unit.id).angst.slice(-2) }))
    .filter(({ recent }) => recent.length)
    .map(({ unit, recent }) => `- ${unit.name}'s last kinds of angst: ${recent.join(", ")}`);
  const latestOffscreen = units
    .map((unit) => [...offscreen].reverse().find((row) => row.li === unit.id))
    .filter((row) => !!row)
    .map((row) => `- ${name(row.li)} (${row.key}): ${row.line}`);
  return [
    lines.length ? `Relationship lines so far:\n${lines.join("\n")}` : "",
    conflictLines.length ? `Open conflicts:\n${conflictLines.join("\n")}` : "",
    angst.length ? angst.join("\n") : "",
    latestOffscreen.length ? `Where the absent were, last time:\n${latestOffscreen.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** A love interest's full bible for the planner (it authors the hidden truth), without the drawing and claw fields. */
function bibleBlock(unit: Unit, liState: LiState): string {
  const { look: _look, play: _play, ...bible } = unit.bible ?? ({} as NonNullable<Unit["bible"]>);
  return [
    `id ${unit.id}: ${unit.name} (${pronounText(unit.pronouns)}), stage ${liState.stage}.`,
    `BIBLE: ${JSON.stringify(bible)}`,
    // Every unresolved grievance, so a node may resolve any of them. ponytail: the ceiling is GRIEVANCES_MAX (60) at
    // up to 300 characters each; the upgrade path is clipping those older than the newest three to an id and excerpt.
    betweenYou(unit, liState, "all"),
  ].join("\n");
}

/** The ties between love interests (the planner may see their secrets). */
function webBlock(world: World, units: readonly Unit[]): string {
  const name = (li: LiId) => units.find((unit) => unit.id === li)?.name ?? li;
  return world.web
    .map(
      (row) =>
        `- ${name(row.a)} and ${name(row.b)}: ${row.stance}. ${row.history} Debt: ${row.debt}${row.secret ? ` Secret: ${row.secret}` : ""}`,
    )
    .join("\n");
}

function sceneCardBlock(unit: Unit, liState: LiState, resolves: readonly string[]): string {
  return [`id ${unit.id}:`, otomeSceneCard(unit, liState), betweenYou(unit, liState, resolves)].join("\n");
}

// ── P5: chapter plan (structured, 0.8, planner contract) ──

export interface ChapterPlanReply {
  title: string;
  tags: string[];
  foil: string;
  summary: string;
  nodes: Array<{
    kind: "beat" | "moment" | "confrontation";
    moment?: "read-him" | "call" | "date" | null;
    guide: string;
    cast: string[];
    place?: string | null;
    cg?: boolean | null;
    resolves?: string[] | null;
  }>;
  ledger: {
    relationship: Array<{ li: string; line: string }>;
    conflict: Array<{
      id?: string | null;
      li: string;
      type: string;
      action: "plant" | "escalate" | "complicate" | "resolve";
    }>;
    offscreen: Array<{ li: string; line: string }>;
  };
}

const text = (max: number) => z.string().max(max);

export const ChapterPlanSchema: ZodType<ChapterPlanReply> = z.object({
  title: text(200).min(1),
  tags: z.array(text(40)).max(12),
  foil: text(120),
  summary: text(1200).min(1),
  nodes: z
    .array(
      z.object({
        kind: z.enum(["beat", "moment", "confrontation"]),
        moment: z.enum(["read-him", "call", "date"]).nullable().optional(),
        guide: text(4000).min(1),
        cast: z.array(text(120)).max(6),
        place: text(120).nullable().optional(),
        cg: z.boolean().nullable().optional(),
        resolves: z.array(text(80)).max(6).nullable().optional(),
      }),
    )
    .min(1)
    .max(12),
  ledger: z.object({
    relationship: z.array(z.object({ li: text(120), line: text(600) })).max(12),
    conflict: z
      .array(
        z.object({
          id: text(80).nullable().optional(),
          li: text(120),
          type: text(80),
          action: z.enum(["plant", "escalate", "complicate", "resolve"]),
        }),
      )
      .max(8),
    offscreen: z.array(z.object({ li: text(120), line: text(600) })).max(8),
  }),
});

export interface ChapterPlanInput {
  world: World;
  player: Player;
  /** Every love interest, in cast order. */
  units: readonly Unit[];
  state: RunState;
  number: number;
  lead: LiId;
  /** Recalled memory (the kit's text), or "". */
  memory: string;
}

export function chapterPlanMessages({
  world,
  player,
  units,
  state,
  number,
  lead,
  memory,
}: ChapterPlanInput): OtomeMessage[] {
  const leadUnit = units.find((unit) => unit.id === lead);
  const others = units.filter((unit) => unit.id !== lead);
  const system = [
    "You are the chapter planner of an otome visual novel: a character-driven romance mystery. The love interests are flawed and dynamic, with real conflicts and angst; each is a human inside a monster, who softens toward the protagonist and not toward the world.",
    `Plan main chapter ${number}: one Lead love interest (given) and one Foil you pick from the others. The chapter is told as ${NODES_MIN} to ${NODES_MAX} nodes in play order; a narrator writes each node later as one scene the player reads.`,
    "Reply with ONLY a JSON object of this shape:",
    '{"title": "...", "tags": ["..."], "foil": "<love interest id>", "summary": "...", "nodes": [{"kind": "beat|moment|confrontation", "moment": "read-him|call|date", "guide": "...", "cast": ["<love interest id>"], "place": "...", "cg": true, "resolves": ["<grievance id>"]}], "ledger": {"relationship": [{"li": "<id>", "line": "..."}], "conflict": [{"id": "<conflict id>", "li": "<id>", "type": "...", "action": "plant|escalate|complicate|resolve"}], "offscreen": [{"li": "<id>", "line": "..."}]}}',
    "FIELDS",
    "- title: the chapter's name, 2 to 6 words. summary: one or two lines on what the chapter is about, without giving away its turns (the player reads it).",
    `- tags: content tags a reader should see before it starts, from: ${CHAPTER_TAGS.join(", ")}. Only what the chapter really holds; [] when none apply.`,
    "- nodes: kind beat is an ordinary scene. kind moment is a scene with a special framing, set by moment: read-him (the protagonist reads one love interest's face to see what they really feel), call (a phone call), date (a date that goes wrong). kind confrontation is the climax: an argument in which something true comes out.",
    "- guide: what happens in that node, 2 to 4 sentences, for the narrator: who wants what, what changes, where it leaves things. cast: the ids of the love interests present. place: where it opens (optional). cg: true only for a node holding a story-defining image (a confession, a revelation, a rescue). resolves: ids of open grievances this node may resolve.",
    "- ledger.relationship: one line per love interest present on what moved between them and the protagonist. ledger.conflict: conflict seeds: plant a new one (type from: " +
      ANGST_TYPES.join(", ") +
      "), or escalate, complicate or resolve an open one by its id. ledger.offscreen: one line for every love interest NOT in this chapter: what they were doing meanwhile.",
    "RULES",
    `- ${NODES_MIN} to ${NODES_MAX} nodes; 1 or 2 moment nodes; exactly one confrontation, as the second-to-last or last node; at most 2 nodes with cg.`,
    "- The Lead is in most nodes and in the confrontation; the Foil appears in at least one node. The Foil's goal competes with the protagonist's or the Lead's.",
    number === 1
      ? "- This is the first chapter: every love interest appears in at least one node, and it opens on the opening situation."
      : "- Continue from the story so far; everything already played is canon and is never undone or staged again.",
    "- The chapter does not move any love interest's stage: it may deepen the bond, but the stage moves only through a route chapter's gate scene.",
    "- A new conflict seed never repeats one of that love interest's last two kinds of angst (listed below), and a love interest has at most one open misunderstanding, resolved within two chapters.",
    "- An open grievance stays open until a node that lists it in resolves; never resolve one in passing.",
    "- Let at most one piece of the mystery surface in a chapter; never reveal a secret before its stage.",
    `- Write every text field in ${world.language}.`,
    "- Omit an optional field rather than writing null.",
    "",
    otomeWritingRules({ story: true }),
    "",
    otomeContentContract({ world, lis: units.map((unit) => ({ name: unit.name })), kind: "planner" }),
  ].join("\n");
  const user = [
    "WORLD",
    world.setting.trim() || world.premise.trim(),
    world.mystery.question ? `The mystery: ${world.mystery.question}` : "",
    world.mystery.truth ? `The hidden truth (never stated outright): ${world.mystery.truth}` : "",
    number === 1 && world.openingSituation ? `Opening situation: ${world.openingSituation}` : "",
    "",
    "PROTAGONIST",
    protagonistBlock(player),
    "",
    leadUnit
      ? `THE LEAD (stage ${stageOf(state, lead)}; this chapter does not move the stage)\n${bibleBlock(leadUnit, liStateOf(state, lead))}`
      : "",
    "",
    "THE OTHERS (full bibles; pick the Foil from these)",
    others.map((unit) => bibleBlock(unit, liStateOf(state, unit.id))).join("\n\n"),
    world.web.length ? `\nTHE WEB BETWEEN THEM\n${webBlock(world, units)}` : "",
    "",
    "LEDGERS",
    ledgerBlock(state, units) || "(none yet)",
    "",
    memory.trim() ? `STORY MEMORY\n${memory.trim()}` : "",
    "",
    `Plan main chapter ${number} now, led by ${leadUnit?.name ?? lead} (id ${lead}).`,
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

// ── P6: beat narrator (narration, 0.9, scene contract) ──

export const BEAT_WORDS = 650;
export const BEAT_WORDS_MAX = 950;
export const BEAT_SEGMENTS_MAX = 40;
export const BEAT_PLACES_MAX = 4;

/** The reply's top level, kept whole for the kit's choice normalizer (zod drops keys a schema does not name). */
export interface BeatReply {
  segments: unknown[];
  places?: unknown;
  choices?: unknown;
  musicMood?: unknown;
  cg?: unknown;
  voices?: unknown;
}

export const BeatReplySchema: ZodType<BeatReply> = z.object({
  segments: z.array(z.unknown()).min(1),
  places: z.unknown().optional(),
  choices: z.unknown().optional(),
  musicMood: z.unknown().optional(),
  cg: z.unknown().optional(),
  voices: z.unknown().optional(),
});

const MOMENT_FRAMING: Record<NonNullable<ChapterNode["moment"]>, string> = {
  "read-him":
    "This node is a READ HIM moment: the protagonist studies one love interest's face and body to work out what they really feel. Linger on their tells; let their face contradict their words; leave the truth readable but unsaid.",
  call: "This node is a PHONE CALL: only voices. Narrate what the protagonist hears and imagines; nobody else is in the room with the caller.",
  date: "This node is a DATE THAT GOES WRONG: it starts as time together and turns on something real between them.",
};

const CONFRONTATION_FRAMING =
  "This node is the CONFRONTATION, the chapter's climax: an argument that comes to a head. Both sides press; something true comes out; it does not resolve neatly, and no one apologizes on the spot.";

export const CHOICE_EFFECTS_INSTRUCTION = `

CHOICE EFFECTS (extend each option above with an optional "effects" array):
- What picking that option changes between the protagonist and a love interest who is present: "effects":[{"li":"<love interest id>","trust":1,"tension":-1,"grievance":{"by":"li|protagonist","text":"...","severity":"minor|major|rupture"},"disclose":"...","resolve":{"id":"<grievance id>","status":"addressed|forgiven|festering"}}]. Every field but li is optional.
- trust: 1 when the option earns that love interest's trust, -1 when it costs it. tension: 1 when it charges things between them, -1 when it eases them.
- grievance: when the option wrongs one of them; by is who holds it. Use rupture only for a betrayal that would break them apart.
- disclose: something the protagonist tells that love interest outright in that option, as one short third-person sentence ("The protagonist said their brother drowned here.").
- resolve: only for a grievance id this node lists as resolvable.
- Omit "effects" when nothing changes between them. Effects never change the story: every branch still reconverges.`;

const VOICES_INSTRUCTION = `

SPEAKER VOICES (extend the JSON shape above with an optional top-level "voices" object):
- Map the exact "speaker" name of every minor character who speaks aloud (not a love interest, not the protagonist) to "male" or "female"; leave out anyone whose voice is unclear.`;

export interface BeatMessagesInput {
  world: World;
  player: Player;
  /** Every love interest; the cast present is `node.cast`. */
  units: readonly Unit[];
  state: RunState;
  chapter: Pick<Chapter, "kind" | "number" | "title" | "lead" | "foil" | "nodes">;
  node: ChapterNode;
  /** The canonical story so far in this chapter, rendered (earlier beats), or "" for its first node. */
  storySoFar: string;
  /** Recalled memory (the kit's text), or "". */
  memory: string;
}

export function beatMessages({
  world,
  player,
  units,
  state,
  chapter,
  node,
  storySoFar,
  memory,
}: BeatMessagesInput): OtomeMessage[] {
  const present = units.filter((unit) => node.cast.includes(unit.id));
  const thinkers = present.filter((unit) => stageOf(state, unit.id) >= 2).map((unit) => unit.name);
  const last = node.i === chapter.nodes.length - 1;
  const system = [
    "You are the narrator of an otome visual novel: a character-driven romance mystery. Narrate ONE node of the chapter as a scene the player taps through, a short segment at a time.",
    NO_CHOICES_SENTENCE,
    `Write about ${BEAT_WORDS} words in total across the segments, and NEVER more than ${BEAT_WORDS_MAX}; use at most ${BEAT_SEGMENTS_MAX} segments.`,
    "Respond with ONLY a JSON object, no markdown, in this exact shape:",
    `{"musicMood": "${MUSIC_MOODS.join("|")}", "places": [{"name": "...", "tags": "..."}], "segments": [{"speaker": "", "text": "...", "thought": false, "expression": "", "place": "..."}]${node.cg ? ', "cg": {"at": 0, "brief": "...", "cast": ["..."]}' : ""}}`,
    '- speaker: who speaks the segment, written as their exact name every time; "" for narration. When the protagonist speaks, write their exact name; the prose still addresses them as "you".',
    "- Each segment is one speaker's line or one piece of narration: a sentence or a few. Never put dialogue inside narration, and never mark it with dashes or quotes as prose.",
    `- thought: true for an inner line, in the thinker's own words, with "speaker" set to the thinker. The protagonist may think freely. A love interest gets at most ONE thought line in this node, and only ${thinkers.length ? `these, who are far enough along: ${thinkers.join(", ")}` : "none of those present: they are still behind their masks"}.`,
    `- expression: on a love interest's dialogue or thought line only: ${FACES.join(", ")}, when the face shows it. A face may contradict the words. Omit it for a neutral line and for narration.`,
    `- musicMood: the soundtrack cue for this node, one of ${MUSIC_MOODS.join(", ")}.`,
    `- places: every place the node happens in, in order (at most ${BEAT_PLACES_MAX}). A place is a room, a street, a garden: never the time of day or the mood. tags: the same place as 4-8 short comma-separated English tags for an image model, with "no humans". place on a segment: which place it happens in; omit it while the scene has not moved.`,
    ...(node.cg
      ? [
          '- cg: this node MAY carry one key image, only when it holds a story-defining moment. at: the index of the segment it opens on. brief: one or two plain English sentences on where and how the moment is shot (place, light, framing, what the bodies do), never anyone\'s looks. cast: the exact names of at most 3 people in the frame. Omit "cg" when the node has no such moment.',
        ]
      : []),
    "- Honour the story so far: keep established names, facts and open threads; never contradict them, and never undo a choice already made.",
    "- Stay within this node's guide; do not skip ahead to later nodes.",
    `- Write every segment's text and every place name in ${world.language}; tags${node.cg ? " and the cg brief" : ""} in English.`,
    "",
    otomeWritingRules({ story: true }),
    "",
    otomeContentContract({ world, lis: present.map((unit) => ({ name: unit.name })), kind: "scene" }),
  ].join("\n");
  const framing =
    node.kind === "confrontation"
      ? CONFRONTATION_FRAMING
      : node.kind === "moment" && node.moment
        ? MOMENT_FRAMING[node.moment]
        : "";
  const user = [
    "WORLD",
    world.setting.trim() || world.premise.trim(),
    "",
    "PROTAGONIST",
    protagonistBlock(player),
    "",
    present.length ? "LOVE INTERESTS IN THIS NODE" : "No love interest is in this node.",
    present.map((unit) => sceneCardBlock(unit, liStateOf(state, unit.id), node.resolves ?? [])).join("\n\n"),
    "",
    memory.trim() ? `STORY MEMORY\n${memory.trim()}` : "",
    "",
    `CHAPTER: ${chapter.title} (${chapter.kind === "main" ? `main chapter ${chapter.number ?? ""}`.trim() : `${chapter.kind} chapter`})`,
    storySoFar.trim()
      ? `The chapter so far:\n${storySoFar.trim()}`
      : chapter.number === 1 && world.openingSituation
        ? `The story opens here: ${world.openingSituation}`
        : "(This is the chapter's first node.)",
    "",
    `Narrate node ${node.i + 1} of ${chapter.nodes.length}${last ? ", the chapter's last" : ""}:`,
    `What happens: ${node.guide}`,
    node.place ? `It opens here: ${node.place}` : "",
    framing,
    node.resolves?.length ? `Grievances this node may resolve: ${node.resolves.join(", ")}.` : "",
    otomeContractReminder("scene"),
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
  const messages = forgeChoiceMessages(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { enabled: true, terminal: last },
  );
  return [
    { ...messages[0], content: messages[0].content + CHOICE_EFFECTS_INSTRUCTION + VOICES_INSTRUCTION },
    ...messages.slice(1),
  ];
}
