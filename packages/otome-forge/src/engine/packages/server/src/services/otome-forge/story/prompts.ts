// ──────────────────────────────────────────────
// Otome Forge: the story prompts P5 (chapter plan), P6 (beat narrator), P10 (route plan), P11 (repair plan) and P12
// (Confrontation), plan M2a "Prompts" and M2b "Arcs"
// ──────────────────────────────────────────────
// Each builder returns `messages` in the plan's order (§1.7): system (role, JSON shape, rules, the knowledge boundary
// and writing rules, then the content contract), then the user turn: full bibles (P5: the Lead's and every Foil
// candidate's, since the planner picks the Foil) or scene cards (P6) with what stands between each love interest and
// the protagonist, the ledgers, recalled memory, the story so far, and the task, ending with the contract reminder. Both get the kit's choice instructions (forgeChoicePlanMessages, forgeChoiceMessages) and
// both carry forgeKnowledgeBoundary. Prompts are English and never localized; prose is written in the world's
// language, place tags and image briefs in English.
// The planners keep recall's knowledge boundary (knownTo): P5 plans for its Lead and P10/P11 for their love interest,
// so another love interest's own chapter reaches them through neither recall nor the ledgers, grievances and
// disclosures it left behind. Only the rupture itself is named, since it is how that love interest is now.
// M2b: P10 and P11 are P5 for one love interest's own chapter (no Foil; the planner contract, his full bible); P12
// writes a whole Confrontation in one reply (the scene contract, scene cards). The game owns the stage: P10 is only told
// the chapter MAY move him, and the gate scene's read moves it. A love interest may be any gender: prompts name him or
// use the pronouns of his bible, never a fixed "he".
// M4: P6 also writes a Character Story's nodes (P22, and P23 for a one-scene Moment or first-wear beat) with
// storyFraming; its planner, P21, is S/items/prompts.ts, which reuses the blocks exported here.
// 0.0.6 (NSFW mode): under NSFW Heat the planners may give a first night together a key image, and P6 and P12 tell the
// cg brief what the image rating lets it show (content-contract.ts imageBriefRule); only under Explicit Heat and the
// Explicit rating does the brief's shape carry "explicit". A world that raised nothing gets the prompts it got before.
// 0.5.0 (Read Me, #1945): a love interest's notebook (knowsAboutYou) rides beside that love interest's own card only:
// P5's Lead, P10/P11's owner, P12's opponent, and in P6 each love interest present (main chapters too: they act on
// what they know in every scene they are in, and the others learn only what happens on the page). Never another's
// card in a planner (P5's others, othersBlock). An empty notebook adds nothing, so those prompts stay byte for byte.
// ponytail: a scene already written (the lookahead) keeps the notebook it was written with; an edit or delete reaches
// the next one written. The upgrade path is dropping an unread lookahead beat when a notebook it carried is edited.
// 0.5.1 (#1949): P5 plans no chapter on the template of the ones before it, and a chapter's closing decision (P5's
// plan, P6's last node) is a different kind from the recent ones; the Foil's rivalry is not always for the protagonist.
// 0.5.3 (#1955): P5 gives minor characters real parts and lets a node go without any love interest (never a moment or
// the climax, S/story/chapters.ts); P5, P10 and P11 let time pass, with rest or sleep after a night, a long day or an
// exhausting stretch (TIME_RULE).
import { forgeChoiceMessages, forgeChoicePlanMessages } from "@forge-kit/player-choices-server.mjs";
import { estimateTextTokens } from "@forge-kit/shared-token-estimator.mjs";
import { z, type ZodType } from "zod";
import type {
  Chapter,
  ChapterNode,
  LiId,
  LiState,
  NodeKind,
  Player,
  RunState,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  CONFRONTATION_ROUNDS,
  type ClimaxKind,
  LAST_STAGE,
  REPAIR_NODES_MAX,
  REPAIR_NODES_MIN,
  ROUTE_NODES_MAX,
  ROUTE_NODES_MIN,
  stageRow,
} from "../../../../../client/src/features/otome-forge/shared/arcs.js";
import { stillToMend } from "../../../../../client/src/features/otome-forge/shared/dates.js";
import { FACES, MUSIC_MOODS } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { LIMIT_IDS, intimacyOpen } from "../../../../../client/src/features/otome-forge/shared/content.js";
import {
  NOTEBOOK_CATEGORIES,
  type NotebookEntry,
} from "../../../../../client/src/features/otome-forge/shared/read-me.js";
import { explicitCgAllowed, imageBriefRule, otomeContentContract, otomeContractReminder } from "../content-contract.js";
import type { OtomeMessage } from "../generation.js";
import { chapterOwner, mainChapterNumber } from "../ids.js";
import { otomeSceneCard } from "../scene-card.js";
import { defaultLiState } from "../schemas/state.js";
import { STORY_PACING_INSTRUCTION, otomeWritingRules } from "../writing-rules.js";
import { prologueFraming } from "./prologue.js";
import { aboutLine } from "../schemas/player.js";
import { intimacyLine } from "../intimacy.js";

/**
 * P6's, P12's and P12c's line on the protagonist's inner life: they react to what happens to them, in thought, instead
 * of the scene moving straight on (the maintainer's playtest: after a first night together she never mulled it over).
 */
const PROTAGONIST_THOUGHTS =
  "They are a person, not a camera: when something that matters to them happens (a first kiss, sex, a quarrel, a secret learned), here or at the end of the node before, give them thought lines to sit with it before the story moves on, in their own voice, with their persona's doubts, insecurities and hopes showing through.";

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

/**
 * What a chapter's closing decision must be, for P5's plan and P6's last node (#1949): unlike the recent ones, which
 * story memory lists among the irrevocable player decisions, so chapters do not all end on whom the protagonist goes with.
 */
const VARIED_DECISION =
  "a different kind of decision from the recent chapters' (the irrevocable player decisions in story memory list them): not always whom the protagonist goes with, and never a choice between love interests two chapters running";

/** P5's, P10's and P11's line on time passing (#1955): the protagonist rests and sleeps, as people do. */
const TIME_RULE =
  "- Time passes as in a life: the protagonist eats, rests and sleeps. When a chapter runs through a night, a long day or an exhausting stretch, give a node, or part of one, to rest: settling down, sleep, waking up. It may be shared or interrupted.";

const TRUST_WORDS = ["cold", "wary", "uneasy", "neutral", "warm", "trusting", "devoted"] as const;
const TENSION_WORDS = ["calm", "charged", "strained", "breaking"] as const;

const pronounText = (pronouns: Unit["pronouns"]) => `${pronouns.subject}/${pronouns.object}/${pronouns.possessive}`;

/** Under NSFW Heat a planner may also give a first night together a key image (said only then: SFW stays as it was). */
const firstNightCg = (world: Pick<World, "content">) => world.content.heat !== "sfw";

/** P6's and P12's line on what the cg brief may show at this world's rating, when it has one. */
const briefRule = (world: Pick<World, "content" | "images">) => {
  const rule = imageBriefRule(world, "cg");
  return rule ? [`- ${rule}`] : [];
};

/** The cg field of P6's and P12's shape: "explicit" only when the world allows an explicit key image. */
const cgShape = (world: Pick<World, "content" | "images">) =>
  `, "cg": {"at": 0, "brief": "...", "cast": ["..."]${explicitCgAllowed(world) ? ', "explicit": false' : ""}}`;

const PLACE_REUSE_RULE =
  '- Reuse a saved background only for the same physical location: add optional "reuse":"<saved key>" to its places entry, with the name used by this scene. Omit reuse for a new location. Never invent a key or add a scene/chapter number to a returning location. Real numbered rooms, wings and floors are distinct unless the scene explicitly establishes that they are the same place. Saved backgrounds are visual lookup records, not evidence of events or character knowledge.';

/** No extra model lookup: the writer can select an existing background in its normal scene reply. */
function savedBackgrounds(world: Pick<World, "places">): string {
  const places = Object.entries(world.places).map(([key, place]) => ({ key, name: place.name, tags: place.tags }));
  return places.length ? `SAVED BACKGROUNDS\n${JSON.stringify(places)}` : "";
}

const liStateOf = (state: RunState, li: LiId): LiState => state.lis[li] ?? defaultLiState();
const stageOf = (state: RunState, li: LiId) => liStateOf(state, li).stage;

/**
 * Whether a planner for the love interests `knows` (its recall's cast) may see what came of `ref`: a chapter key, or
 * `${key}/${i}` as a grievance's `opened` and a disclosure's `ref` are. A main chapter is everyone's; a love interest's
 * own chapter only theirs, as recall keeps it (S/story/canon.ts mayKnow), so its ledger lines, conflicts, grievances
 * and disclosures never reach another love interest's plan. ponytail: a ref that does not name its love interest (a
 * story or date chapter, a phone session) is taken as private to `about`, the one it concerns. M4's Character Stories
 * keep only their owner's rows and cast (S/items/character-story.ts), so for them `about` is the owner; the upgrade
 * path is a ref that names its owner when the date chapters (M5) write ledgers.
 */
function knownTo(knows: readonly LiId[], ref: string, about: LiId): boolean {
  const key = ref.split("/")[0] ?? "";
  return mainChapterNumber(key) !== null || knows.includes(chapterOwner(key) ?? about);
}

/** The ledger rows a planner for `knows` may see (a conflict saved before this rule has no key, and is everyone's). */
export function knownRows<T extends { key?: string; li: LiId }>(rows: readonly T[], knows: readonly LiId[]): T[] {
  return rows.filter((row) => !row.key || knownTo(knows, row.key, row.li));
}

/** His state as a planner for `knows` may see it: the grievances and disclosures of others' own chapters left out. */
function seenBy(liState: LiState, li: LiId, knows: readonly LiId[]): LiState {
  return {
    ...liState,
    grievances: liState.grievances.filter((grievance) => knownTo(knows, grievance.opened, li)),
    disclosures: liState.disclosures.filter((disclosure) => knownTo(knows, disclosure.ref, li)),
  };
}

/**
 * What a love interest's own reader (M3's note P16 and chat reply P17) may know of the state, as a planner for them
 * sees it: their state without another love interest's own chapter (seenBy), and their latest relationship and
 * off-screen lines among the rows they may see (knownRows), "" for none.
 */
export function ownView(state: RunState, li: LiId): { liState: LiState; relationship: string; offscreen: string } {
  const latest = (rows: RunState["ledgers"]["offscreen"]) =>
    [...knownRows(rows, [li])].reverse().find((row) => row.li === li)?.line ?? "";
  return {
    liState: seenBy(liStateOf(state, li), li, [li]),
    relationship: latest(state.ledgers.relationship),
    offscreen: latest(state.ledgers.offscreen),
  };
}

/**
 * Where the romance stands, by stage (#1960, the maintainer's calls): a slow burn through stage 2, where neither names
 * what they feel; from stage 3 a confession may come when a scene has earned it, and by the finale at the latest. Desire
 * is not feeling: the content contract alone decides what bodies may do, at any stage.
 */
function romanceLine(name: string, stage: number): string {
  if (stage <= 2) {
    return `Slow burn: ${name} never says what they feel for the protagonist, and neither does the protagonist. It shows in tension, glances, deflections and near misses, with no confession and no becoming a couple yet. Desire is not feeling: they may still act on desire, out of lust or to get what they want, as far as the content contract allows, and feelings may grow from it later.`;
  }
  if (stage < LAST_STAGE) {
    return `The slow burn may break: when a scene has earned it, ${name} may confess what they feel, if they have not yet; by the finale of their route at the latest, they say it.`;
  }
  // The finale asks for the words, but Ease off can end it first, so the story so far says whether they were spoken.
  return `${name} has chosen the protagonist. If the story has not yet shown ${name} saying what they feel, they may say it whenever a scene calls for it; once said, it is no longer hidden between them.`;
}

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
  const lines = [
    `Between ${unit.name} and the protagonist: trust ${trust}, tension ${tension}.`,
    romanceLine(unit.name, liState.stage),
  ];
  for (const grievance of shown) {
    const holder = grievance.by === "li" ? unit.name : "the protagonist";
    lines.push(`Open grievance ${grievance.id} (${grievance.severity}, held by ${holder}): ${grievance.text}`);
  }
  // Named even when its grievance is not shown (it opened in their own chapter): it is how they are with the
  // protagonist now.
  if (liState.rupture) {
    lines.push(
      `A rupture stands between them (${liState.rupture.grievanceId}): ${unit.name} keeps a cold distance until a scene repairs it.`,
    );
  }
  const told = liState.disclosures.slice(-3).map((item) => item.text);
  if (told.length) lines.push(`The protagonist has told ${unit.name}: ${told.join(" ")}`);
  return lines.join("\n");
}

/** The newest notebook entries a prompt may carry, and the line's budget. */
const KNOWN_SHOWN = 8;
export const KNOWN_TOKENS = 500;

/**
 * What this love interest has come to know about the protagonist: their notebook (Read Me, #1945), theirs alone. Only
 * prompts about them carry it, beside their own card: never another love interest's card, a planner's view of the
 * others, a banner or a care note. "" for an empty notebook, so a prompt without one is unchanged byte for byte. Told as
 * context to use where it fits, never a checklist; the player's own words are quoted as data.
 * Within KNOWN_TOKENS it keeps the newest entries whole, so the budget leaves out the oldest, never whichever category
 * is listed last, and never cuts the quoted words open.
 * ponytail: the newest entry is always kept whole. At the notebook's limits (a 300-character guess and 200 characters
 * of words) it is about 375 tokens even in Han, so it fits unless the name runs past about 90 characters; the upgrade
 * path is shortening that entry's words.
 */
export function knowsAboutYou(unit: Pick<Unit, "name">, liState: Pick<LiState, "known">): string {
  const known = (liState.known ?? []).slice(-KNOWN_SHOWN);
  if (!known.length) return "";
  const item = (entry: NotebookEntry) => {
    // JSON-quoted, so a quote mark the player typed cannot end their words early.
    const words = entry.words ? ` (in the protagonist's own words: ${JSON.stringify(entry.words)})` : "";
    const guess =
      entry.verdict === "right" ? entry.text : `${entry.verdict === "close" ? "nearly" : "not so"}: ${entry.text}`;
    return `${guess}${words}`;
  };
  const line = (entries: readonly NotebookEntry[]) => {
    const sections = NOTEBOOK_CATEGORIES.flatMap((category) => {
      const items = entries.filter((entry) => entry.category === category).map(item);
      return items.length ? [`${category}: ${items.join("; ")}`] : [];
    });
    return `What ${unit.name} has come to know about the protagonist (${unit.name}'s alone; let it show where it fits, never recite it): ${sections.join(" | ")}`;
  };
  let count = 1;
  while (count < known.length && estimateTextTokens(line(known.slice(-(count + 1)))) <= KNOWN_TOKENS) count += 1;
  return line(known.slice(-count));
}

/** Who the protagonist is (name, pronouns, traits, goal), for every story prompt. */
export function protagonistBlock(player: Player): string {
  return [
    `${player.name || "The protagonist"} (${pronounText(player.pronouns)}). Never assume a gender the pronouns do not state.`,
    player.traits.length ? `Traits: ${player.traits.join("; ")}` : "",
    player.goal.trim() ? `Their own goal: ${player.goal.trim()}` : "",
    aboutLine(player),
  ]
    .filter(Boolean)
    .join("\n");
}

/** The ledgers a planner for `knows` may see (knownTo): no line or conflict of another love interest's own chapter. */
export function ledgerBlock(state: RunState, units: readonly Unit[], knows: readonly LiId[]): string {
  const name = (li: LiId) => units.find((unit) => unit.id === li)?.name ?? li;
  const relationship = knownRows(state.ledgers.relationship, knows);
  const offscreen = knownRows(state.ledgers.offscreen, knows);
  const lines: string[] = [];
  for (const row of relationship.slice(-RECENT_LEDGER)) lines.push(`- ${row.key}, ${name(row.li)}: ${row.line}`);
  const open = knownRows(state.ledgers.conflicts, knows).filter((row) => row.status === "open");
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

/**
 * A love interest's full bible for the planner (it authors the hidden truth), without the drawing and claw fields, and
 * what stands between them as a planner for `knows` may see it (seenBy).
 */
export function bibleBlock(unit: Unit, state: RunState, knows: readonly LiId[], world: Pick<World, "content">): string {
  const liState = seenBy(liStateOf(state, unit.id), unit.id, knows);
  // Intimacy (#1936) never rides in the bible's JSON: only an NSFW story gets it, as its own guarded line.
  const { look: _look, play: _play, intimacy: _intimacy, ...bible } = unit.bible ?? ({} as NonNullable<Unit["bible"]>);
  return [
    `id ${unit.id}: ${unit.name} (${pronounText(unit.pronouns)}), stage ${liState.stage}.`,
    `BIBLE: ${JSON.stringify(bible)}`,
    ...[intimacyLine(world, unit)].filter(Boolean),
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

/** A love interest's scene card and what stands between them and the protagonist (every prompt but the planners'). */
export function sceneCardBlock(unit: Unit, liState: LiState, resolves: readonly string[] = []): string {
  return [`id ${unit.id}:`, otomeSceneCard(unit, liState), betweenYou(unit, liState, resolves)].join("\n");
}

// ── P5: chapter plan (structured, 0.8, planner contract) ──

export interface ChapterPlanReply {
  title: string;
  tags: string[];
  /** P5 names one; P10 and P11 have none. */
  foil?: string;
  summary: string;
  nodes: Array<{
    kind: NodeKind;
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
  foil: text(120).optional(),
  summary: text(1200).min(1),
  nodes: z
    .array(
      z.object({
        kind: z.enum(["beat", "moment", "confrontation", "closer"]),
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
  /** The climax this chapter must use (S/story/chapters.ts requiredClimax), or null when the planner picks. */
  climax?: ClimaxKind | null;
  /** The last main chapter's climax, for a free pick. */
  lastClimax?: ClimaxKind | null;
}

export function chapterPlanMessages({
  world,
  player,
  units,
  state,
  number,
  lead,
  memory,
  climax = null,
  lastClimax = null,
}: ChapterPlanInput): OtomeMessage[] {
  const leadUnit = units.find((unit) => unit.id === lead);
  const others = units.filter((unit) => unit.id !== lead);
  const system = [
    "You are the chapter planner of an otome visual novel: a character-driven romance mystery. The love interests are flawed and dynamic, with real conflicts and angst; each is a human, even if inside a monster, capable of earned, character-consistent change.",
    `Plan main chapter ${number}: one Lead love interest (given) and one Foil you pick from the others. The chapter is told as ${NODES_MIN} to ${NODES_MAX} nodes in play order; a narrator writes each node later as one scene the player reads.`,
    "Reply with ONLY a JSON object of this shape:",
    '{"title": "...", "tags": ["..."], "foil": "<love interest id>", "summary": "...", "nodes": [{"kind": "beat|moment|confrontation|closer", "moment": "read-him|call|date", "guide": "...", "cast": ["<love interest id>"], "place": "...", "cg": true, "resolves": ["<grievance id>"]}], "ledger": {"relationship": [{"li": "<id>", "line": "..."}], "conflict": [{"id": "<conflict id>", "li": "<id>", "type": "...", "action": "plant|escalate|complicate|resolve"}], "offscreen": [{"li": "<id>", "line": "..."}]}}',
    "FIELDS",
    "- title: the chapter's name, 2 to 6 words. summary: one or two lines on what the chapter is about, without giving away its turns (the player reads it).",
    `- tags: content tags a reader should see before it starts, from: ${CHAPTER_TAGS.join(", ")}. Only what the chapter really holds; [] when none apply.`,
    "- nodes: kind beat is an ordinary scene. Kind moment is a scene with a special framing, set by moment: read-him (the protagonist reads one love interest's face to see what they really feel), call (a call from afar, only voices), date (time together that may go as hoped, or stumble on something real when the story gives it a reason). Kind confrontation is a climax: an argument in which something true comes out. Kind closer is a warm climax: a quiet moment in which the Lead offers something of themselves and lets the protagonist close, or almost does; it can end well, or go wrong.",
    `- guide: what happens in that node, 2 to 4 sentences, for the narrator: who wants what, what changes, where it leaves things. cast: the ids of the love interests present. place: where it opens (optional). cg: true only for a node holding a story-defining image (a confession, a revelation, a rescue${firstNightCg(world) ? ", or under this Heat a first night together" : ""}). resolves: ids of open grievances this node may resolve.`,
    "- ledger.relationship: one line per love interest present on what moved between them and the protagonist. ledger.conflict: conflict seeds: plant a new one (type from: " +
      ANGST_TYPES.join(", ") +
      "), or escalate, complicate or resolve an open one by its id. ledger.offscreen: one line for every love interest NOT in this chapter: what they were doing meanwhile.",
    "RULES",
    `- ${NODES_MIN} to ${NODES_MAX} nodes; 1 or 2 moment nodes; exactly one climax node, a confrontation or a closer, as the second-to-last or last node; at most 2 nodes with cg.`,
    climax
      ? `- This chapter's climax is a ${climax}: the last two main chapters both ended with a ${climax === "closer" ? "confrontation" : "closer"}.`
      : `- Choose the climax the story calls for: open grievances and strain lean toward a confrontation, trust and calm toward a closer.${lastClimax ? ` The last main chapter ended with a ${lastClimax}.` : ""}`,
    "- The Lead is in most nodes and in the climax; the Foil appears in at least one node. The Foil's goal competes with the protagonist's or the Lead's, and not always for the protagonist: a rivalry over a goal, a secret, a duty or the mystery counts too.",
    `- Never plan a chapter on the template of the ones before it: vary what drives it and where its turn falls. When its last node leaves a lasting decision open, make it ${VARIED_DECISION}.`,
    "- The world has other people: give named minor characters (friends, family, rivals, officials, locals) real parts where the story calls for them; they speak and can matter. Not every node needs a love interest: the protagonist has a life of their own, and a node may be theirs alone or with others (cast []). A moment node and the climax always have their love interest in cast.",
    TIME_RULE,
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
    STORY_PACING_INSTRUCTION,
    otomeWritingRules({ story: true, style: world.writingStyle, banned: world.bannedPhrases }),
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
      ? [
          `THE LEAD (stage ${stageOf(state, lead)}; this chapter does not move the stage)`,
          bibleBlock(leadUnit, state, [lead], world),
          // The Lead's notebook only: never the Foil's or the others' (their bibles below are a planner's view).
          knowsAboutYou(leadUnit, liStateOf(state, lead)),
        ]
          .filter(Boolean)
          .join("\n")
      : "",
    "",
    "THE OTHERS (full bibles; pick the Foil from these)",
    others.map((unit) => bibleBlock(unit, state, [lead], world)).join("\n\n"),
    world.web.length ? `\nTHE WEB BETWEEN THEM\n${webBlock(world, units)}` : "",
    "",
    "LEDGERS",
    // As recall's cast [lead] (S/story/chapters.ts): the Foil's and everyone else's own chapters never reach the plan.
    ledgerBlock(state, units, [lead]) || "(none yet)",
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
// Under NSFW: Explicit, sex is never rushed (content-contract.ts HEAT_TEXT), so a node or a Closer's opened ending that
// reaches it gets more room. Each fits the reply's budget (generation.ts outputBudget: 8192 tokens at least, plus
// reasoning headroom) and the segments normalizeBeatReply keeps (twice BEAT_SEGMENTS_MAX).
/** The words a node that reaches sex may run to. */
export const INTIMATE_BEAT_WORDS_MAX = 1500;
/** The segments a node that reaches sex may hold. */
export const INTIMATE_BEAT_SEGMENTS_MAX = 60;
/** The segments a Closer's opened ending that reaches sex may hold (its other endings keep CONFRONTATION_ENDING_MAX). */
export const CLOSER_INTIMATE_ENDING_MAX = 20;

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
  call: "This node is a CALL FROM AFAR: only voices, carried by a phone where the world has them and otherwise by whatever carries voices there. Narrate what the protagonist hears and imagines; nobody else is in the room with the caller.",
  date: "This node is a DATE: time together. It goes as hoped unless the chapter's guide or the story so far gives a reason for it to turn on something real between them.",
};

const CONFRONTATION_FRAMING =
  "This node is the CONFRONTATION, the chapter's climax: an argument that comes to a head. Both sides press; something true comes out; it does not resolve neatly, and no one apologizes on the spot.";

const CLOSER_FRAMING =
  "This node is the CLOSER, the chapter's warm climax: a quiet moment in which a love interest lets the protagonist close, or almost does. Something true is offered; it may be taken or missed.";

export const CHOICE_EFFECTS_INSTRUCTION = `

CHOICE EFFECTS (extend each option above with an optional "effects" array):
- What picking that option changes between the protagonist and a love interest who is present: "effects":[{"li":"<love interest id>","trust":1,"tension":-1,"grievance":{"by":"li|protagonist","text":"...","severity":"minor|major|rupture"},"disclose":"...","resolve":{"id":"<grievance id>","status":"addressed|forgiven|festering"}}]. Every field but li is optional.
- trust: 1 when the option earns that love interest's trust, -1 when it costs it. tension: 1 when it charges things between them, -1 when it eases them.
- grievance: when the option wrongs one of them; by is who holds it. Use rupture only for a betrayal that would break them apart.
- disclose: something the protagonist tells that love interest outright in that option, as one short third-person sentence ("The protagonist said their brother drowned here.").
- resolve: only for a grievance id this node lists as resolvable.
- Omit "effects" when nothing changes between them. Effects never change the story: every branch still reconverges.`;

/**
 * P6 on a date's beat (M5): exactly one small choice whose options carry a hidden score against the date's love
 * interest's likes and dislikes (S/story/beats.ts checks it and reads it as `beat.scores`).
 */
export function dateChoiceInstruction(unit: Pick<Unit, "name" | "bible">, goesWrong: boolean): string {
  const likes = unit.bible?.likes.filter((like) => like.trim()).slice(0, 6) ?? [];
  const dislikes = unit.bible?.dislikes.filter((dislike) => dislike.trim()).slice(0, 6) ?? [];
  return `

DATE CHOICE (this node is one scene of a date with ${unit.name}):
- Offer exactly ONE small choice in this node (2 to 4 options), at the moment where what the protagonist does matters to ${unit.name}. Never a big choice.
- Give every option a "score" field beside its "text" and "selection" ("score": 1): 1 when ${unit.name} would love it, 0 when it passes without much, -1 when it grates against them. At least one option scores 1; let the options differ.
- Judge by who ${unit.name} is, never by what is "nice" in general.${likes.length ? ` ${unit.name} likes: ${likes.join("; ")}.` : ""}${dislikes.length ? ` ${unit.name} dislikes: ${dislikes.join("; ")}.` : ""}
- The labels, selections and prose never name or hint at a score; a good pick should feel right, not marked.
- ${goesWrong ? `This evening is planned to stumble: an option may open a grievance, and on a date it is at most "minor".` : "Nothing on this date opens a grievance: leave grievance out of every option's effects."}`;
}

const VOICES_INSTRUCTION = `

SPEAKER VOICES (extend the JSON shape above with an optional top-level "voices" object):
- Map the exact "speaker" name of every minor character who speaks aloud (not a love interest, not the protagonist) to "male" or "female"; leave out anyone whose voice is unclear.`;

export interface BeatMessagesInput {
  world: World;
  player: Player;
  /** Every love interest; the cast present is `node.cast`. */
  units: readonly Unit[];
  state: RunState;
  chapter: Pick<
    Chapter,
    "kind" | "number" | "title" | "lead" | "foil" | "nodes" | "li" | "stage" | "grievance" | "date"
  >;
  node: ChapterNode;
  /** The canonical story so far in this chapter, rendered (earlier beats), or "" for its first node. */
  storySoFar: string;
  /** Chapter 1's first node only: the prologue's last lines (S/story/prologue.ts), or "" without one. */
  prologue?: string;
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
  prologue = "",
}: BeatMessagesInput): OtomeMessage[] {
  const backgrounds = savedBackgrounds(world);
  const present = units.filter((unit) => node.cast.includes(unit.id));
  const thinkers = present.filter((unit) => stageOf(state, unit.id) >= 2).map((unit) => unit.name);
  const last = node.i === chapter.nodes.length - 1;
  // A date (M5) is the protagonist and one love interest; it never ends on a big choice. It is their own evening, so
  // their card holds only what they may know (ownView), as the date's plan did.
  const date = chapter.kind === "date" ? chapter.date : undefined;
  const partner = date ? units.find((unit) => unit.id === date.li) : undefined;
  const cardState = (li: LiId) => (date ? ownView(state, li).liState : liStateOf(state, li));
  const system = [
    "You are the narrator of an otome visual novel: a character-driven romance mystery. Narrate ONE node of the chapter as a scene the player taps through, a short segment at a time.",
    NO_CHOICES_SENTENCE,
    `Write about ${BEAT_WORDS} words in total across the segments, and NEVER more than ${BEAT_WORDS_MAX}; use at most ${BEAT_SEGMENTS_MAX} segments.${world.content.heat === "explicit" ? ` A node that reaches sex is the exception: give it the room it needs, up to ${INTIMATE_BEAT_WORDS_MAX} words and ${INTIMATE_BEAT_SEGMENTS_MAX} segments, so it is never rushed.` : ""}`,
    "Respond with ONLY a JSON object, no markdown, in this exact shape:",
    `{"musicMood": "${MUSIC_MOODS.join("|")}", "places": [{"name": "...", "tags": "..."}], "segments": [{"speaker": "", "text": "...", "thought": false, "expression": "", "place": "..."}]${node.cg ? cgShape(world) : ""}}`,
    '- speaker: who speaks the segment, written as their exact name every time; "" for narration. When the protagonist speaks, write their exact name; the prose still addresses them as "you".',
    "- Each segment is one speaker's line or one piece of narration: a sentence or a few. Never put dialogue inside narration, and never mark it with dashes or quotes as prose.",
    `- thought: true for an inner line, in the thinker's own words, with "speaker" set to the thinker. The protagonist may think freely. ${PROTAGONIST_THOUGHTS} A love interest gets at most ONE thought line in this node, and only ${thinkers.length ? `these, who are far enough along: ${thinkers.join(", ")}` : "none of those present: they are still behind their masks"}.`,
    `- expression: on a love interest's dialogue or thought line only: ${FACES.join(", ")}, when the face shows it. A face may contradict the words. Omit it for a neutral line and for narration.`,
    `- musicMood: the soundtrack cue for this node, one of ${MUSIC_MOODS.join(", ")}.`,
    `- places: every place the node happens in, in order (at most ${BEAT_PLACES_MAX}). A place is a room, a street, a garden: never the time of day or the mood. tags: the same place as 4-8 short comma-separated English tags for an image model, with "no humans". place on a segment: which place it happens in; omit it while the scene has not moved.`,
    ...(backgrounds ? [PLACE_REUSE_RULE] : []),
    ...(node.cg
      ? [
          '- cg: this node MAY carry one key image, only when it holds a story-defining moment. at: the index of the segment it opens on. brief: one or two plain English sentences on where and how the moment is shot (place, light, framing, what the bodies do), never anyone\'s looks. cast: the exact names of at most 3 people in the frame. Omit "cg" when the node has no such moment.',
          ...briefRule(world),
        ]
      : []),
    "- Honour the story so far: keep established names, facts and open threads; never contradict them, and never undo a choice already made.",
    "- Stay within this node's guide; do not skip ahead to later nodes.",
    // A planned chapter's last node; the prologue offers its own choices, and a date never ends on a big one.
    ...(last && !date && chapter.kind !== "prologue"
      ? [`- This is the chapter's last node: if it ends on a big choice, make it ${VARIED_DECISION}.`]
      : []),
    `- Write every segment's text and every place name in ${world.language}; tags${node.cg ? " and the cg brief" : ""} in English.`,
    "",
    STORY_PACING_INSTRUCTION,
    otomeWritingRules({ story: true, style: world.writingStyle, banned: world.bannedPhrases }),
    "",
    otomeContentContract({ world, lis: present.map((unit) => ({ name: unit.name })), kind: "scene" }),
  ].join("\n");
  const framing =
    node.kind === "confrontation"
      ? CONFRONTATION_FRAMING
      : node.kind === "closer"
        ? CLOSER_FRAMING
        : node.kind === "moment" && node.moment
          ? MOMENT_FRAMING[node.moment]
          : "";
  const arc =
    chapter.kind === "prologue"
      ? prologueFraming(world.openingSituation, units)
      : arcFraming({ chapter, node, units, state });
  const dateFraming = date && partner ? dateFramingText(date, partner, state) : "";
  const user = [
    "WORLD",
    world.setting.trim() || world.premise.trim(),
    "",
    ...(backgrounds ? [backgrounds, ""] : []),
    "PROTAGONIST",
    protagonistBlock(player),
    "",
    present.length ? "LOVE INTERESTS IN THIS NODE" : "No love interest is in this node.",
    // Each one's own notebook beside their own card, named as theirs (knowsAboutYou), in a main chapter too.
    present
      .map((unit) =>
        [
          sceneCardBlock(unit, cardState(unit.id), node.resolves ?? []),
          knowsAboutYou(unit, cardState(unit.id)),
          intimacyLine(world, unit),
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n\n"),
    "",
    memory.trim() ? `STORY MEMORY\n${memory.trim()}` : "",
    "",
    `CHAPTER: ${chapter.title} (${chapterLabel(chapter, units)})`,
    storySoFar.trim()
      ? `The chapter so far:\n${storySoFar.trim()}`
      : chapter.number === 1 && world.openingSituation
        ? `The story opens here: ${world.openingSituation}`
        : "(This is the chapter's first node.)",
    ...(prologue.trim()
      ? [
          `The prologue, the protagonist alone before they meet anyone in this story, ended like this. Pick up from it; never tell it again:\n${prologue.trim()}`,
        ]
      : []),
    "",
    `Narrate node ${node.i + 1} of ${chapter.nodes.length}${last ? ", the chapter's last" : ""}:`,
    `What happens: ${node.guide}`,
    node.place ? `It opens here: ${node.place}` : "",
    framing,
    ...arc,
    dateFraming,
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
    { enabled: true, terminal: last && !date },
  );
  const dateChoice = date && partner ? dateChoiceInstruction(partner, date.goesWrong) : "";
  return [
    { ...messages[0], content: messages[0].content + CHOICE_EFFECTS_INSTRUCTION + dateChoice + VOICES_INSTRUCTION },
    ...messages.slice(1),
  ];
}

/**
 * The user turn's framing for a date's node: where they are, and what a Make it right date is for while its rupture
 * still stands (stillToMend; mended elsewhere since, the scene is an ordinary date's), with who holds it. The rupture's
 * grievance is named only when it came from what they may know (ownView), as on their card.
 */
function dateFramingText(date: NonNullable<Chapter["date"]>, partner: Unit, state: RunState): string {
  const mending = stillToMend(date, state.lis);
  const grievance = mending
    ? ownView(state, partner.id).liState.grievances.find((item) => item.id === mending.id)
    : undefined;
  const named = grievance ? ` (${grievance.text})` : "";
  return [
    `This chapter is a DATE: an evening the protagonist and ${partner.name} spend together${date.placeName ? ` at ${date.placeName}` : ""}. Keep it to the two of them; anyone else passes at the edges.`,
    !mending
      ? ""
      : mending.by === "protagonist"
        ? `It is a MAKE IT RIGHT date: a rupture stands between them${named}. The protagonist is the one hurt, and ${partner.name} is trying to earn back the protagonist's trust. The protagonist's hurt is honest and does not melt for nothing; nothing in this scene resolves the rupture, and how the evening ends is decided by the protagonist's choices.`
        : `It is a MAKE IT RIGHT date: a rupture stands between them${named}. The protagonist is trying to mend it. ${partner.name}'s hurt is honest and does not melt for nothing; nothing in this scene resolves the rupture, and how the evening ends is decided by the protagonist's choices.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ── M2b: arcs. What each stage's route chapter is for, and the framing P6 adds to route and repair chapters ──

const stageTitle = (stage: number) => {
  const { name } = stageRow(stage);
  return `${name[0]!.toUpperCase()}${name.slice(1)}`;
};

/** What a route chapter for `stage` is for (P10's "MAY move" line, and P6 on its gate). Uses only his name. */
export function stageGoal(stage: number, name: string): string {
  switch (stageRow(stage).name) {
    case "crack":
      return `the mask cracks: in one unguarded moment the protagonist sees what ${name}'s mask hides, and ${name} knows it was seen.`;
    case "pull":
      return `${name} is pulled toward the protagonist against their own want: they begin to choose the protagonist in small ways that cost them, and resent it.`;
    case "wound":
      return `the mask breaks: ${name}'s stage-4 secret comes out, and the wound beneath it with it.`;
    case "reckoning":
      return `${name} reckons with what they have done and what they want: a confrontation brings it to a head, and the protagonist makes a choice that cannot be undone.`;
    case "bond":
      return `the finale of ${name}'s route: ${name} chooses the protagonist and, if they never have, says in words what they feel; any change must be earned and character-consistent, without automatic redemption or a replacement personality.`;
    default:
      return `${name} keeps the mask on.`;
  }
}

/** The secrets of `unit` named by `ids` (a gate's `reveals`). */
const secretsOf = (unit: Unit | undefined, ids: readonly string[] = []) =>
  (unit?.bible?.secrets ?? []).filter((secret) => ids.includes(secret.id));

function chapterLabel(chapter: BeatMessagesInput["chapter"], units: readonly Unit[]): string {
  const owner = units.find((unit) => unit.id === (chapter.li ?? chapter.lead))?.name ?? "";
  if (chapter.kind === "prologue") return "the prologue, before chapter 1";
  if (chapter.kind === "main") return `main chapter ${chapter.number ?? ""}`.trim();
  if (chapter.kind === "route" && chapter.stage) {
    return `${owner}'s route chapter, toward stage ${chapter.stage} (${stageTitle(chapter.stage)})`;
  }
  if (chapter.kind === "repair") return `a repair chapter with ${owner}`;
  if (chapter.kind === "story") return `${owner}'s Character Story`;
  return `${chapter.kind} chapter`;
}

/**
 * P22 and P23 (M4): what P6 adds to a node of a Character Story (`story-<itemId>`, S/items/character-story.ts): a side
 * story of one love interest's, written against the canon of the day it was first opened. One node is a Moment or a
 * first-wear beat, whose guide says which; more is a Memory's 3–5 scene story. Private to him, like his route.
 */
function storyFraming(name: string, nodes: number): string[] {
  return [
    nodes > 1
      ? `This is ${name}'s CHARACTER STORY: a ${nodes}-scene side story between ${name} and the protagonist, outside the main plot. Each node is one of its scenes; it has its own small arc and ends on its last.`
      : `This is a ONE-SCENE side story of ${name}'s: one complete scene between ${name} and the protagonist, outside the main plot, with its own small beginning and end.`,
    `It is private: no other love interest appears in it or learns of it. It does not move ${name}'s stage: how close they are follows the scene card. It never resolves the mystery or reveals a secret before its stage, and it never contradicts the story so far.`,
  ];
}

/** The lines P6 adds to a node of a route, repair or story chapter: its gate, what it reveals, the repair's rule. */
function arcFraming({
  chapter,
  node,
  units,
  state,
}: Pick<BeatMessagesInput, "chapter" | "node" | "units" | "state">): string[] {
  const owner = units.find((unit) => unit.id === (chapter.li ?? chapter.lead));
  const name = owner?.name ?? "the love interest";
  const lines: string[] = [];
  if (chapter.kind === "route" && chapter.stage && node.gate) {
    lines.push(
      `This node is the GATE of ${name}'s route: the scene that completes stage ${chapter.stage} (${stageTitle(chapter.stage)}): ${stageGoal(chapter.stage, name)} Write it as the scene that earns it.`,
    );
    if (stageRow(chapter.stage).gate === "confrontation") {
      lines.push("End this node on ONE BIG choice the protagonist makes, one that cannot be undone.");
    }
  }
  for (const secret of secretsOf(owner, node.reveals)) {
    lines.push(
      `In this node the protagonist learns this secret of ${name}, and the scene card's Hidden line no longer applies to it: ${secret.truth} Let it come out in the scene, in ${name}'s own way.`,
    );
  }
  if (chapter.kind === "repair") {
    const grievance =
      owner && chapter.grievance
        ? liStateOf(state, owner.id).grievances.find((item) => item.id === chapter.grievance)
        : undefined;
    lines.push(
      `This is a REPAIR chapter: a rupture stands between ${name} and the protagonist${grievance ? ` (${grievance.text})` : ""}. The repair costs ${name} something; it does not erase what happened, and nobody apologizes on the spot.`,
    );
  }
  if (chapter.kind === "story") lines.push(...storyFraming(name, chapter.nodes.length));
  return lines;
}

// ── P10: route plan (structured, 0.8, planner contract) and P11: repair plan (structured, 0.7, planner contract) ──

export interface ArcPlanInput {
  world: World;
  player: Player;
  /** Every love interest, in cast order. */
  units: readonly Unit[];
  state: RunState;
  /** Whose chapter it is. */
  li: LiId;
  /** Recalled memory (the kit's text), or "". */
  memory: string;
}

const PLAN_SHAPE =
  '{"title": "...", "tags": ["..."], "summary": "...", "nodes": [{"kind": "beat|moment|confrontation", "moment": "read-him|call|date", "guide": "...", "cast": ["<love interest id>"], "place": "...", "cg": true, "resolves": ["<grievance id>"]}], "ledger": {"relationship": [{"li": "<id>", "line": "..."}], "conflict": [{"id": "<conflict id>", "li": "<id>", "type": "...", "action": "plant|escalate|complicate|resolve"}], "offscreen": [{"li": "<id>", "line": "..."}]}}';

function arcPlanFields(world: Pick<World, "content">): string[] {
  return [
    "FIELDS",
    "- title: the chapter's name, 2 to 6 words. summary: one or two lines on what the chapter is about, without giving away its turns (the player reads it).",
    `- tags: content tags a reader should see before it starts, from: ${CHAPTER_TAGS.join(", ")}. Only what the chapter really holds; [] when none apply.`,
    "- nodes: kind beat is an ordinary scene. Kind moment is a scene with a special framing, set by moment: read-him (the protagonist reads their face to see what they really feel), call (a call from afar, only voices), date (time together that may go as hoped, or stumble on something real when the story gives it a reason). Kind confrontation is an argument that comes to a head, played as three rounds of stances.",
    `- guide: what happens in that node, 2 to 4 sentences, for the narrator: who wants what, what changes, where it leaves things. cast: the ids of the love interests present. place: where it opens (optional). cg: true only for a node holding a story-defining image${firstNightCg(world) ? " (under this Heat, a first night together counts)" : ""}. resolves: ids of open grievances this node may resolve.`,
    `- ledger.relationship: one line on what moved between them and the protagonist. ledger.conflict: plant a new conflict seed (type from: ${ANGST_TYPES.join(", ")}), or escalate, complicate or resolve an open one by its id. ledger.offscreen: optional lines for love interests not in this chapter.`,
  ];
}

function othersBlock(units: readonly Unit[], state: RunState, li: LiId): string {
  return units
    .filter((unit) => unit.id !== li)
    .map((unit) => sceneCardBlock(unit, seenBy(liStateOf(state, unit.id), unit.id, [li]), []))
    .join("\n\n");
}

function arcPlanUser(input: ArcPlanInput, heading: string, task: string[]): string {
  const { world, player, units, state, li, memory } = input;
  const unit = units.find((item) => item.id === li);
  return [
    "WORLD",
    world.setting.trim() || world.premise.trim(),
    world.mystery.question ? `The mystery: ${world.mystery.question}` : "",
    world.mystery.truth ? `The hidden truth (never stated outright): ${world.mystery.truth}` : "",
    "",
    "PROTAGONIST",
    protagonistBlock(player),
    "",
    unit
      ? [heading, bibleBlock(unit, state, [li], input.world), knowsAboutYou(unit, liStateOf(state, li))]
          .filter(Boolean)
          .join("\n")
      : "",
    "",
    units.length > 1 ? "THE OTHERS (scene cards; they may appear, but this chapter is not theirs)" : "",
    // Their cards only: an other's notebook never reaches a plan that is not theirs.
    othersBlock(units, state, li),
    "",
    "LEDGERS",
    // As recall's cast [li] (S/story/routes-plan.ts): no other love interest's own chapter reaches the plan.
    ledgerBlock(state, units, [li]) || "(none yet)",
    "",
    memory.trim() ? `STORY MEMORY\n${memory.trim()}` : "",
    "",
    ...task,
    otomeContractReminder("planner"),
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
}

export interface RoutePlanInput extends ArcPlanInput {
  /** The stage the chapter's gate may move him to (2–6). */
  stage: number;
}

/** P10: one route chapter of his own story, 4–6 nodes, its gate last (S/story/routes-plan.ts checks the reply). */
export function routePlanMessages(input: RoutePlanInput): OtomeMessage[] {
  const { world, units, state, li, stage } = input;
  const unit = units.find((item) => item.id === li);
  const name = unit?.name ?? li;
  const from = liStateOf(state, li).stage;
  const kind = stageRow(stage).gate;
  const arcStep = unit?.bible?.arc[String(stage) as keyof NonNullable<Unit["bible"]>["arc"]];
  const reveal = secretsOf(
    unit,
    (unit?.bible?.secrets ?? []).filter((secret) => secret.revealAt.stage === stage).map((secret) => secret.id),
  );
  const system = [
    "You are the route planner of an otome visual novel: a character-driven romance mystery. The love interests are flawed and dynamic, with real conflicts and angst; each is a human, even if inside a monster, capable of earned, character-consistent change.",
    `Plan one ROUTE CHAPTER of ${name}'s own story: a chapter for ${name} and the protagonist, told as ${ROUTE_NODES_MIN} to ${ROUTE_NODES_MAX} nodes in play order; a narrator writes each node later as one scene the player reads.`,
    "Reply with ONLY a JSON object of this shape:",
    PLAN_SHAPE,
    ...arcPlanFields(world),
    "RULES",
    `- This chapter MAY move ${name} from stage ${from} (${stageTitle(from)}) to stage ${stage} (${stageTitle(stage)}): ${stageGoal(stage, name)} The game moves the stage only when the player reads the gate scene; plan toward it, never assume it.`,
    `- ${ROUTE_NODES_MIN} to ${ROUTE_NODES_MAX} nodes. The LAST node is the gate: the scene that completes the stage. ${name} is in every node, and nothing in it is anyone else's chapter.`,
    kind === "confrontation"
      ? "- Exactly one confrontation node, before the gate (never the gate itself). The gate ends on one big choice the protagonist makes that cannot be undone; plan the gate's guide toward it."
      : "- At most one confrontation node, and never the gate.",
    kind === "finale"
      ? `- This is the finale of ${name}'s route: everything between them comes due, and the gate is where ${name} chooses the protagonist.`
      : "",
    "- 0 to 2 moment nodes; at most 2 nodes with cg.",
    TIME_RULE,
    "- A new conflict seed never repeats one of that love interest's last two kinds of angst (listed below), and a love interest has at most one open misunderstanding.",
    "- An open grievance stays open until a node that lists it in resolves; never resolve one in passing.",
    "- Never reveal a secret before its stage.",
    `- Write every text field in ${world.language}.`,
    "- Omit an optional field rather than writing null.",
    "",
    STORY_PACING_INSTRUCTION,
    otomeWritingRules({ story: true, style: world.writingStyle, banned: world.bannedPhrases }),
    "",
    otomeContentContract({ world, lis: units.map((item) => ({ name: item.name })), kind: "planner" }),
  ]
    .filter(Boolean)
    .join("\n");
  const user = arcPlanUser(input, `${name.toUpperCase()} (stage ${from}; whose chapter this is)`, [
    arcStep?.wantsFromHer ? `At stage ${stage}, ${name} wants from the protagonist: ${arcStep.wantsFromHer}` : "",
    arcStep?.seed ? `The seed planted for stage ${stage}: ${arcStep.seed}` : "",
    ...reveal.map(
      (secret) =>
        `The gate reveals this secret of ${name} to the protagonist (it must not surface before the gate): ${secret.truth}`,
    ),
    `Plan ${name}'s route chapter toward stage ${stage} now (id ${li}).`,
  ]);
  return forgeChoicePlanMessages(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    true,
  );
}

export interface RepairPlanInput extends ArcPlanInput {
  /** The rupture grievance the repair's last node resolves. */
  grievance: Pick<LiState["grievances"][number], "id" | "text" | "by">;
}

/** P11: a 2–3 node repair after a rupture; its last node resolves the grievance (S/story/routes-plan.ts checks it). */
export function repairPlanMessages(input: RepairPlanInput): OtomeMessage[] {
  const { world, units, li, grievance } = input;
  const name = units.find((item) => item.id === li)?.name ?? li;
  const holder = grievance.by === "li" ? name : "the protagonist";
  const system = [
    "You are the repair planner of an otome visual novel: a character-driven romance mystery. The love interests are flawed and dynamic, with real conflicts and angst; each is a human, even if inside a monster, capable of earned, character-consistent change.",
    `Plan one REPAIR chapter between ${name} and the protagonist after a rupture, told as ${REPAIR_NODES_MIN} to ${REPAIR_NODES_MAX} nodes in play order; a narrator writes each node later as one scene the player reads.`,
    "Reply with ONLY a JSON object of this shape:",
    PLAN_SHAPE,
    ...arcPlanFields(world),
    "RULES",
    `- ${REPAIR_NODES_MIN} to ${REPAIR_NODES_MAX} nodes of kind beat or moment (no confrontation). ${name} is in every node.`,
    `- The last node resolves the rupture: its resolves is ["${grievance.id}"].`,
    `- The repair costs ${name} something; it doesn't erase what happened. No instant apologies, no speeches that make it all right.`,
    "- This chapter does not move any love interest's stage.",
    "- A new conflict seed never repeats one of that love interest's last two kinds of angst (listed below).",
    TIME_RULE,
    `- Write every text field in ${world.language}.`,
    "- Omit an optional field rather than writing null.",
    "",
    STORY_PACING_INSTRUCTION,
    otomeWritingRules({ story: true, style: world.writingStyle, banned: world.bannedPhrases }),
    "",
    otomeContentContract({ world, lis: units.map((item) => ({ name: item.name })), kind: "planner" }),
  ].join("\n");
  const user = arcPlanUser(input, `${name.toUpperCase()} (whose repair this is)`, [
    `The rupture (grievance ${grievance.id}, held by ${holder}): ${grievance.text}`,
    `Plan the repair between ${name} and the protagonist now (id ${li}).`,
  ]);
  return forgeChoicePlanMessages(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    true,
  );
}

// ── P12: the Confrontation (narration, 0.9, scene contract, one call) ──

export const CONFRONTATION_OPENING_MAX = 10;
export const CONFRONTATION_HIS_MAX = 4;
export const CONFRONTATION_ANSWER_MAX = 3;
export const CONFRONTATION_ENDING_MAX = 6;

/** The reply's top level, kept whole: S/story/confrontation.ts normalizes every list the way P6's segments are. */
export interface ConfrontationReply {
  opening: unknown[];
  rounds: unknown[];
  endings: Record<string, unknown>;
  grievance?: unknown;
  disclosure?: unknown;
  places?: unknown;
  musicMood?: unknown;
  cg?: unknown;
  voices?: unknown;
}

export const ConfrontationReplySchema: ZodType<ConfrontationReply> = z.object({
  opening: z.array(z.unknown()).min(1),
  rounds: z.array(z.unknown()).min(1),
  endings: z.record(z.string(), z.unknown()),
  grievance: z.unknown().optional(),
  disclosure: z.unknown().optional(),
  places: z.unknown().optional(),
  musicMood: z.unknown().optional(),
  cg: z.unknown().optional(),
  voices: z.unknown().optional(),
});

export interface ConfrontationMessagesInput extends Omit<BeatMessagesInput, "node"> {
  node: ChapterNode;
  /** Whom the protagonist confronts. */
  li: LiId;
}

const SEGMENT_SHAPE = '{"speaker": "", "text": "...", "thought": false, "expression": "", "place": "..."}';

/** P12: the opening, three rounds of four stances each, and the three endings, in one reply. */
export function confrontationMessages(input: ConfrontationMessagesInput): OtomeMessage[] {
  const { world, player, units, state, chapter, node, storySoFar, memory, li } = input;
  const backgrounds = savedBackgrounds(world);
  const present = units.filter((unit) => node.cast.includes(unit.id) || unit.id === li);
  const him = units.find((unit) => unit.id === li);
  const name = him?.name ?? "the love interest";
  const protagonist = player.name || "the protagonist";
  const thinkers = present.filter((unit) => stageOf(state, unit.id) >= 2).map((unit) => unit.name);
  const option = `{"label": "...", "selection": {"kind": "dialogue|action", "text": "..."}, "segments": [${SEGMENT_SHAPE}], "composure": 0}`;
  const system = [
    `You are the narrator of an otome visual novel's confrontation: the stance game at a chapter's climax, an argument between the protagonist and ${name} that comes to a head. Write the whole confrontation in ONE reply: an opening, ${CONFRONTATION_ROUNDS} rounds, and three endings.`,
    "Respond with ONLY a JSON object, no markdown, in this exact shape:",
    `{"musicMood": "tense|angst", "places": [{"name": "...", "tags": "..."}], "opening": [${SEGMENT_SHAPE}], "rounds": [{"lines": [${SEGMENT_SHAPE}], "options": {"press": ${option}, "hold": ${option}, "yield": ${option}, "reveal": ${option}}}], "endings": {"truth": [${SEGMENT_SHAPE}], "walkout": [${SEGMENT_SHAPE}], "standoff": [${SEGMENT_SHAPE}]}, "grievance": {"text": "...", "severity": "major"}, "disclosure": "..."${node.cg ? cgShape(world) : ""}}`,
    `- opening: up to ${CONFRONTATION_OPENING_MAX} segments that bring the argument to a head.`,
    `- rounds: exactly ${CONFRONTATION_ROUNDS}. lines: 1 to ${CONFRONTATION_HIS_MAX} segments of ${name} pressing the argument on. Round k's lines must follow naturally from ANY of the four stances the protagonist could have taken in round k-1.`,
    `- options: the four stances the protagonist may take, every round: press (push ${name}, accuse, demand), hold (stand firm without attacking), yield (give ground, soften), reveal (tell ${name} something true about the protagonist themselves). label: the pill's short intent, 2 to 6 words. selection: what ${protagonist} says (kind dialogue) or does (kind action), one or two sentences. segments: 1 to ${CONFRONTATION_ANSWER_MAX} segments of ${name}'s answer to that stance.`,
    `- composure: how that stance moves ${name}'s guard, from ${name}'s own character and what stands between them: -1 when it gets through and the guard drops, 1 when it makes ${name} close off, 0 when it does neither. Not every press is 1 and not every yield is -1.`,
    `- endings: truth (${name}'s guard is down and something true comes out), walkout (${name} leaves; it leaves a hurt between them), standoff (neither gives; it ends charged). Each 1 to ${CONFRONTATION_ENDING_MAX} segments that close the scene.`,
    `- grievance.text: what a walkout leaves ${name} holding against the protagonist, one short sentence. disclosure: what the protagonist tells ${name} in reveal, as one short third-person sentence ("The protagonist said their brother drowned here.").`,
    `- musicMood: tense or angst.`,
    '- speaker: who speaks the segment, written as their exact name every time; "" for narration. Each segment is one speaker\'s line or one piece of narration.',
    `- thought: true for an inner line, with "speaker" set to the thinker. The protagonist may think freely. ${PROTAGONIST_THOUGHTS} A love interest gets at most ONE thought line in the whole confrontation, on any path a player can take through it (the opening, the rounds' lines, the answers to the stances taken and the ending together), and only ${thinkers.length ? `these, who are far enough along: ${thinkers.join(", ")}` : "none of those present: they are still behind their masks"}.`,
    `- expression: on a love interest's dialogue or thought line only: ${FACES.join(", ")}. A face may contradict the words. Omit it for a neutral line and for narration.`,
    `- places: where it happens (at most ${BEAT_PLACES_MAX}); tags: 4-8 short comma-separated English tags for an image model, with "no humans".`,
    ...(backgrounds ? [PLACE_REUSE_RULE] : []),
    ...(node.cg
      ? [
          '- cg: one key image of the opening, only when it holds a story-defining moment. at: the index of the opening segment it opens on. brief: one or two plain English sentences on where and how the moment is shot, never anyone\'s looks. cast: the exact names of at most 3 people in the frame. Omit "cg" otherwise.',
          ...briefRule(world),
        ]
      : []),
    `- ${name}'s red lines hold whatever the protagonist does; every cruelty has a reason ${name} believes. Nobody apologizes on the spot.`,
    world.content.darkness === "dark"
      ? `- Dark romance: in every round at least one stance lets the protagonist refuse ${name} outright, and the story honours it.`
      : "",
    "- Honour the story so far; never contradict it or undo a choice already made. Stay within this node's guide.",
    `- Write every segment's text, label, selection, grievance and disclosure in ${world.language}; tags${node.cg ? " and the cg brief" : ""} in English.`,
    "",
    STORY_PACING_INSTRUCTION,
    otomeWritingRules({ story: true, style: world.writingStyle, banned: world.bannedPhrases }),
    "",
    otomeContentContract({ world, lis: present.map((unit) => ({ name: unit.name })), kind: "scene" }),
  ]
    .filter(Boolean)
    .join("\n");
  const user = [
    "WORLD",
    world.setting.trim() || world.premise.trim(),
    "",
    ...(backgrounds ? [backgrounds, ""] : []),
    "PROTAGONIST",
    protagonistBlock(player),
    "",
    "LOVE INTERESTS IN THIS NODE",
    // The argument is theirs: only the opponent's notebook rides beside their card, never a bystander's.
    present
      .map((unit) =>
        [
          sceneCardBlock(unit, liStateOf(state, unit.id), node.resolves ?? []),
          unit.id === li ? knowsAboutYou(unit, liStateOf(state, li)) : "",
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n\n"),
    "",
    memory.trim() ? `STORY MEMORY\n${memory.trim()}` : "",
    "",
    `CHAPTER: ${chapter.title} (${chapterLabel(chapter, units)})`,
    storySoFar.trim() ? `The chapter so far:\n${storySoFar.trim()}` : "(This is the chapter's first node.)",
    "",
    `Write the confrontation of node ${node.i + 1} of ${chapter.nodes.length}, between ${protagonist} and ${name} (id ${li}):`,
    `What happens: ${node.guide}`,
    node.place ? `It opens here: ${node.place}` : "",
    ...arcFraming({ chapter, node, units, state }),
    otomeContractReminder("scene"),
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
  return [
    { role: "system", content: system + VOICES_INSTRUCTION },
    { role: "user", content: user },
  ];
}

// ── P12c: the Closer (#1938; narration, 0.9, scene contract, one call) ──

/**
 * P12c: the Closer, the warm climax: an opening, three rounds of four answers each (reassure, tease, mirror, ask) and
 * the three endings (opened, almost, shut), in one reply shaped as P12's. In an NSFW story the partner's card carries
 * their tastes (#1936), and Opened up may turn intimate; the content contract decides how far.
 */
export function closerMessages(input: ConfrontationMessagesInput): OtomeMessage[] {
  const { world, player, units, state, chapter, node, storySoFar, memory, li } = input;
  const backgrounds = savedBackgrounds(world);
  const present = units.filter((unit) => node.cast.includes(unit.id) || unit.id === li);
  const partner = units.find((unit) => unit.id === li);
  const name = partner?.name ?? "the love interest";
  const protagonist = player.name || "the protagonist";
  const thinkers = present.filter((unit) => stageOf(state, unit.id) >= 2).map((unit) => unit.name);
  const option = `{"label": "...", "selection": {"kind": "dialogue|action", "text": "..."}, "segments": [${SEGMENT_SHAPE}], "guard": 0}`;
  const system = [
    `You are the narrator of an otome visual novel's closer: the warm climax of a chapter, a quiet moment in which ${name} lets the protagonist come close, or almost does. Write the whole closer in ONE reply: an opening, ${CONFRONTATION_ROUNDS} rounds, and three endings.`,
    "Respond with ONLY a JSON object, no markdown, in this exact shape:",
    `{"musicMood": "tender|confession", "places": [{"name": "...", "tags": "..."}], "opening": [${SEGMENT_SHAPE}], "rounds": [{"lines": [${SEGMENT_SHAPE}], "options": {"reassure": ${option}, "tease": ${option}, "mirror": ${option}, "ask": ${option}}}], "endings": {"opened": [${SEGMENT_SHAPE}], "almost": [${SEGMENT_SHAPE}], "shut": [${SEGMENT_SHAPE}]}, "grievance": {"text": "...", "severity": "minor"}, "disclosure": "..."${node.cg ? cgShape(world) : ""}}`,
    `- opening: up to ${CONFRONTATION_OPENING_MAX} segments that bring the two of them somewhere they could let their guard down.`,
    `- rounds: exactly ${CONFRONTATION_ROUNDS}. lines: 1 to ${CONFRONTATION_HIS_MAX} segments in which ${name} offers something of themselves: a memory, a fear, a wish, a touch. Round k's lines must follow naturally from ANY of the four answers the protagonist could have given in round k-1.`,
    `- options: the four answers the protagonist may give, every round: reassure (steady warmth), tease (playful; it may lighten the moment or slip past it), mirror (the protagonist opens up in return and tells ${name} something true about themselves), ask (a gentle question that may push). label: the pill's short intent, 2 to 6 words. selection: what ${protagonist} says (kind dialogue) or does (kind action), one or two sentences. segments: 1 to ${CONFRONTATION_ANSWER_MAX} segments of ${name}'s answer to it.`,
    `- guard: how that answer moves ${name}'s guard, from ${name}'s own character, wound and what stands between them: -1 when it reaches ${name} and the guard lowers, 1 when it lands wrong and ${name} closes off, 0 when it does neither. Not every reassure is -1 and not every ask is 1: a tease can be exactly right, and warmth at the wrong moment can feel like pity.`,
    `- endings: opened (${name}'s guard comes down and they let the protagonist in, the closest the two have been), almost (warm, but ${name} pulls back at the last second and something stays unsaid), shut (it went wrong: the mask goes back on and ${name} withdraws, hurt). Each 1 to ${CONFRONTATION_ENDING_MAX} segments that close the scene.`,
    intimacyOpen(world.content)
      ? `- opened may turn intimate when the moment and where they stand call for it, written at the Heat the content contract sets.${world.content.heat === "explicit" ? ` When it reaches sex, opened may run to ${CLOSER_INTIMATE_ENDING_MAX} segments, so it is never rushed.` : ""}`
      : "",
    `- grievance.text: what being shut out leaves ${name} holding against the protagonist, one short sentence. disclosure: what the protagonist tells ${name} in mirror, as one short third-person sentence ("The protagonist said they still sleep with a light on.").`,
    "- musicMood: tender or confession.",
    '- speaker: who speaks the segment, written as their exact name every time; "" for narration. Each segment is one speaker\'s line or one piece of narration.',
    `- thought: true for an inner line, with "speaker" set to the thinker. The protagonist may think freely. ${PROTAGONIST_THOUGHTS} A love interest gets at most ONE thought line in the whole closer, on any path a player can take through it (the opening, the rounds' lines, the answers given and the ending together), and only ${thinkers.length ? `these, who are far enough along: ${thinkers.join(", ")}` : "none of those present: they are still behind their masks"}.`,
    `- expression: on a love interest's dialogue or thought line only: ${FACES.join(", ")}. A face may contradict the words. Omit it for a neutral line and for narration.`,
    `- places: where it happens (at most ${BEAT_PLACES_MAX}); tags: 4-8 short comma-separated English tags for an image model, with "no humans".`,
    ...(backgrounds ? [PLACE_REUSE_RULE] : []),
    ...(node.cg
      ? [
          '- cg: one key image of the opening, only when it holds a story-defining moment. at: the index of the opening segment it opens on. brief: one or two plain English sentences on where and how the moment is shot, never anyone\'s looks. cast: the exact names of at most 3 people in the frame. Omit "cg" otherwise.',
          ...briefRule(world),
        ]
      : []),
    `- ${name} keeps their own voice, red lines and mask; letting someone in costs ${name} something, and nothing is fixed in one night.`,
    "- Honour the story so far; never contradict it or undo a choice already made. Stay within this node's guide.",
    `- Write every segment's text, label, selection, grievance and disclosure in ${world.language}; tags${node.cg ? " and the cg brief" : ""} in English.`,
    "",
    STORY_PACING_INSTRUCTION,
    otomeWritingRules({ story: true, style: world.writingStyle, banned: world.bannedPhrases }),
    "",
    otomeContentContract({ world, lis: present.map((unit) => ({ name: unit.name })), kind: "scene" }),
  ]
    .filter(Boolean)
    .join("\n");
  const user = [
    "WORLD",
    world.setting.trim() || world.premise.trim(),
    "",
    ...(backgrounds ? [backgrounds, ""] : []),
    "PROTAGONIST",
    protagonistBlock(player),
    "",
    "LOVE INTERESTS IN THIS NODE",
    present
      .map((unit) =>
        [
          sceneCardBlock(unit, liStateOf(state, unit.id), node.resolves ?? []),
          // The partner's notebook (#1945), as P12 gives the opponent theirs; a bystander's is never here.
          unit.id === li ? knowsAboutYou(unit, liStateOf(state, li)) : "",
          intimacyLine(world, unit),
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n\n"),
    "",
    memory.trim() ? `STORY MEMORY\n${memory.trim()}` : "",
    "",
    `CHAPTER: ${chapter.title} (${chapterLabel(chapter, units)})`,
    storySoFar.trim() ? `The chapter so far:\n${storySoFar.trim()}` : "(This is the chapter's first node.)",
    "",
    `Write the closer of node ${node.i + 1} of ${chapter.nodes.length}, between ${protagonist} and ${name} (id ${li}):`,
    `What happens: ${node.guide}`,
    node.place ? `It opens here: ${node.place}` : "",
    ...arcFraming({ chapter, node, units, state }),
    otomeContractReminder("scene"),
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
  return [
    { role: "system", content: system + VOICES_INSTRUCTION },
    { role: "user", content: user },
  ];
}
