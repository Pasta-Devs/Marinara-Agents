// ──────────────────────────────────────────────
// Otome Forge: the setup prompts P1–P4 (plan M1 "Prompts") and the shapes their replies must take
// ──────────────────────────────────────────────
// P1 premise suggestion, P2 world plan, P3 one bible per love interest, P4 the protagonist's look. Each builder
// returns `messages` in the plan's order (§1.7): system (role, JSON shape, rules, then the content contract), then the
// user turn with the inputs, ending with the contract reminder. Card love interests carry their current card canon
// (forgeHydrateStoryCharacters + forgeFormatCharacterCardReference); archetype ones carry the archetype seed and the
// player's notes. The world plan and the bible author the hidden truth, so they never get the knowledge boundary
// (plan §1.7); P1 and P4 write no story. P1 and P2 write prose the player reads but no story, so of the writing rules
// they get only the banned-phrases line. Prompts are English and never localized; prose fields are written in the
// world's language, look tags always in English.
import {
  forgeFormatCharacterCardReference,
  forgeHydrateStoryCharacters,
  type ForgeCardCanon,
} from "@forge-kit/character-card-context.mjs";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import { z, type ZodType } from "zod";
import type {
  LiId,
  Player,
  Pronouns,
  Unit,
  WebRow,
  WebStance,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { ARCHETYPES, isArchetypeId } from "../../../../../client/src/features/otome-forge/shared/archetypes.js";
import { otomeContentContract, otomeContractReminder } from "../content-contract.js";
import type { OtomeMessage } from "../generation.js";
import { MIN_AGE } from "../../../../../client/src/features/otome-forge/shared/bible.js";
import { text } from "../schemas/common.js";
import { BANNED_PHRASES_RULE, otomeWritingRules } from "../writing-rules.js";

const PREMISE_MAX = 2000;
const LOOK_LINE_MAX = 600;
const PERSONA_TEXT_MAX = 1200;

// ── Engine cards and personas, read through api.runtime.resources ──

/** A card's authored fields, flattened the way the kit reads them. */
export interface CardFields {
  name: string;
  description: string;
  personality: string;
  backstory: string;
  appearance: string;
}

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

function parsed(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * The card's current fields, or null when it is gone. The Engine hands `data` over as the stored JSON text; Marinara
 * keeps backstory and appearance under `extensions`, and a V2 card nests everything under `data`.
 */
export async function readCard(
  runtime: Pick<CapabilityRuntimeHost, "resources">,
  cardId: string,
): Promise<CardFields | null> {
  const [record] = await runtime.resources.listCharacters([cardId]);
  const raw = parsed(record?.data);
  const data = isRecord(raw) && isRecord(raw.data) ? raw.data : raw;
  if (!isRecord(data)) return null;
  const extensions = isRecord(data.extensions) ? data.extensions : {};
  return {
    name: str(data.name),
    description: str(data.description),
    personality: str(data.personality),
    backstory: str(extensions.backstory) || str(data.backstory),
    appearance: str(extensions.appearance) || str(data.appearance),
  };
}

export interface PersonaFields {
  name: string;
  description: string;
  /** The image appearance when the persona turns it on, else the appearance, else an image appearance left off. */
  appearance: string;
}

export async function readPersona(
  runtime: Pick<CapabilityRuntimeHost, "resources">,
  personaId: string,
): Promise<PersonaFields | null> {
  if (!personaId) return null;
  const [record] = await runtime.resources.listPersonas([personaId]);
  const data = parsed(record?.data);
  if (!isRecord(data)) return null;
  const imageAppearance = str(data.imageAppearance);
  const imageFirst = data.imageAppearanceEnabled === true || data.imageAppearanceEnabled === "true";
  return {
    name: str(data.name),
    description: str(data.description),
    appearance: (imageFirst && imageAppearance) || str(data.appearance) || imageAppearance,
  };
}

// ── The cast as the prompts see it ──

/** A love interest and, for a card LI, the card's canon read for this request only. */
export interface CastMember {
  unit: Unit;
  canon?: ForgeCardCanon;
}

/** Each unit with its card's current canon (never saved: prompt input only). */
export async function castOf(
  runtime: Pick<CapabilityRuntimeHost, "resources" | "logger">,
  units: readonly Unit[],
): Promise<CastMember[]> {
  const hydrated = await forgeHydrateStoryCharacters([...units], (cardId) => readCard(runtime, cardId), runtime.logger);
  return hydrated.map(({ forgeCardCanon, ...unit }) => ({
    unit,
    ...(forgeCardCanon ? { canon: forgeCardCanon } : {}),
  }));
}

const pronounText = (pronouns: Pronouns) => `${pronouns.subject}/${pronouns.object}/${pronouns.possessive}`;

/** How the prompts introduce one love interest: id, name and pronouns, then the card or the archetype seed. */
function castEntry({ unit, canon }: CastMember): string {
  const head = `id ${unit.id}: ${unit.name} (${pronounText(unit.pronouns)})`;
  if (unit.source === "card") {
    return canon
      ? `${head}\n${forgeFormatCharacterCardReference(canon, unit.name)}`
      : `${head}\n(The linked character card could not be read; keep to the name and pronouns.)`;
  }
  const archetype = isArchetypeId(unit.archetype) ? ARCHETYPES[unit.archetype] : null;
  return [
    head,
    archetype ? `Archetype: ${archetype.name}. ${archetype.seed}` : "",
    unit.notes?.trim() ? `The player's notes: ${unit.notes.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function protagonistEntry(player: Player): string {
  return [
    `${player.name || "The protagonist"} (${pronounText(player.pronouns)})`,
    player.traits.length ? `Traits: ${player.traits.join("; ")}` : "",
    player.goal.trim() ? `Their own goal: ${player.goal.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const contractPeople = (cast: readonly CastMember[]) => cast.map(({ unit }) => ({ name: unit.name }));

// ── P1: premise suggestion (structured, 0.9, 600 tokens) ──

export interface PremiseReply {
  premise: string;
}
export const PremiseSchema: ZodType<PremiseReply> = z.object({ premise: z.string() });

export function normalizePremise(reply: PremiseReply): PremiseReply | string {
  const premise = reply.premise.trim();
  if (!premise) return "premise must not be empty";
  if (premise.length > PREMISE_MAX) return `premise must be at most ${PREMISE_MAX} characters`;
  return { premise };
}

export function premiseMessages(language: string): OtomeMessage[] {
  return [
    {
      role: "system",
      content: [
        "You write premises for an otome game: a romance mystery in which the player's protagonist meets several love interests, each hiding one piece of a central secret.",
        'Reply with ONLY a JSON object: {"premise": "..."}',
        "RULES",
        `- 3 to 5 sentences, written in ${language}.`,
        "- An original setting and situation with a romance-mystery hook: something is wrong, someone is hiding it, and the protagonist is about to be drawn in.",
        "- No real people, and no names, places or characters from existing books, films, games or other media.",
        "- Everyone in it is an adult. No school settings and no students.",
        "- Leave the love interests unnamed: the player brings the cast.",
        '- Never assume the protagonist\'s gender: address them as "you".',
        "- Keep it suitable for any content setting: nothing explicit.",
        BANNED_PHRASES_RULE,
      ].join("\n"),
    },
    { role: "user", content: `Write one new premise in ${language}.` },
  ];
}

// ── P2: world plan (structured, 0.8, planner contract) ──

export interface WorldPlanReply {
  title: string;
  setting: string;
  mystery: { question: string; truth: string };
  pieces: Array<{ li: string; piece: string; reasonToHide: string }>;
  web: Array<{ a: string; b: string; history: string; stance: WebStance; debt: string; secret?: string | null }>;
  openingSituation: string;
}

export const WorldPlanSchema: ZodType<WorldPlanReply> = z.object({
  title: z.string().min(1).max(200),
  setting: z.string().min(1).max(4000),
  mystery: z.object({ question: z.string().min(1).max(4000), truth: z.string().min(1).max(4000) }),
  // The world document's own limits (schemas/world.ts), so an over-long field gets the repair turn here instead of
  // emptying the stored mystery or dropping the row when the world is read back.
  pieces: z.array(z.object({ li: z.string(), piece: text().min(1), reasonToHide: text().min(1) })).max(20),
  web: z
    .array(
      z.object({
        a: z.string(),
        b: z.string(),
        history: text(),
        stance: z.enum(["allies", "uneasy", "rivals", "enemies"]),
        debt: text(),
        secret: text().nullable().optional(),
      }),
    )
    .max(30),
  openingSituation: z.string().min(1).max(4000),
});

/** What the world plan writes into the world document. */
export type WorldPlan = Pick<World, "title" | "setting" | "mystery" | "web" | "openingSituation">;

/** A love interest the model named by id or, failing that, by exact name. */
function resolveLi(cast: readonly CastMember[], value: string): LiId | null {
  const key = value.trim();
  const byId = cast.find(({ unit }) => unit.id === key);
  if (byId) return byId.unit.id;
  const byName = cast.filter(({ unit }) => unit.name.trim().toLowerCase() === key.toLowerCase());
  return byName.length === 1 ? byName[0].unit.id : null;
}

/** The plan in the world's shape, or the reason it is refused: every love interest holds exactly one piece. */
export function normalizeWorldPlan(reply: WorldPlanReply, cast: readonly CastMember[]): WorldPlan | string {
  const pieces: World["mystery"]["pieces"] = {};
  for (const entry of reply.pieces) {
    const li = resolveLi(cast, entry.li);
    if (li && !pieces[li]) pieces[li] = { piece: entry.piece.trim(), reasonToHide: entry.reasonToHide.trim() };
  }
  const missing = cast.filter(({ unit }) => !pieces[unit.id]).map(({ unit }) => unit.id);
  if (missing.length) return `every love interest needs exactly one piece; missing: ${missing.join(", ")}`;
  const web: WebRow[] = [];
  const pairs = new Set<string>();
  for (const row of reply.web) {
    const a = resolveLi(cast, row.a);
    const b = resolveLi(cast, row.b);
    const pair = [a, b].sort().join("|");
    if (!a || !b || a === b || pairs.has(pair)) continue;
    pairs.add(pair);
    const secret = row.secret?.trim();
    web.push({
      a,
      b,
      history: row.history.trim(),
      stance: row.stance,
      debt: row.debt.trim(),
      ...(secret ? { secret } : {}),
    });
  }
  return {
    title: reply.title.trim(),
    setting: reply.setting.trim(),
    mystery: { question: reply.mystery.question.trim(), truth: reply.mystery.truth.trim(), pieces },
    web,
    openingSituation: reply.openingSituation.trim(),
  };
}

export function worldPlanMessages({
  world,
  player,
  cast,
}: {
  world: World;
  player: Player;
  cast: readonly CastMember[];
}): OtomeMessage[] {
  const system = [
    "You are the story architect of an otome game: a romance mystery in which the protagonist grows close to several love interests, each of whom hides one piece of a central secret. You plan the hidden truth the story will reveal slowly. The player never sees this plan as written.",
    "Reply with ONLY a JSON object of this shape:",
    '{"title": "...", "setting": "...", "mystery": {"question": "...", "truth": "..."}, "pieces": [{"li": "<love interest id>", "piece": "...", "reasonToHide": "..."}], "web": [{"a": "<love interest id>", "b": "<love interest id>", "history": "...", "stance": "allies|uneasy|rivals|enemies", "debt": "...", "secret": "..."}], "openingSituation": "..."}',
    "FIELDS",
    "- title: the story's name, 2 to 6 words.",
    "- setting: 2 to 4 sentences: the place, its order, and what makes it strange or dangerous.",
    "- mystery.question: the question the protagonist will chase, one sentence. mystery.truth: the full hidden answer, 2 to 4 sentences.",
    "- pieces: exactly one per love interest, with that love interest's exact id. piece: the part of the truth that love interest holds. reasonToHide: that love interest's own reason to keep it from the protagonist.",
    "- web: one row for each pair of love interests: their shared history, their stance, what one owes the other, and optionally a secret between them the protagonist does not know (omit it when there is none).",
    "- openingSituation: 2 to 3 sentences: where the protagonist is when the story begins, and what has just happened.",
    "RULES",
    `- Write every text field in ${world.language}.`,
    "- Every love interest is an adult, written as an adult, in an adult role. No school or student roles.",
    "- Never contradict a love interest's CANONICAL CHARACTER CARD: the card wins over the premise and over this plan.",
    "- Rivals still respect, owe or need each other; nobody is simply a villain.",
    "- The love interests' goals compete with the protagonist's own goal.",
    "- Never assume the protagonist's gender: use their pronouns.",
    "- Omit an optional field rather than writing null.",
    BANNED_PHRASES_RULE,
    "",
    otomeContentContract({ world, lis: contractPeople(cast), kind: "planner" }),
  ].join("\n");
  const user = [
    "PREMISE",
    world.premise.trim() || "(none: invent one that fits the cast)",
    "",
    "PROTAGONIST",
    protagonistEntry(player),
    "",
    "LOVE INTERESTS",
    cast.map(castEntry).join("\n\n"),
    "",
    "Plan the world now.",
    otomeContractReminder("planner"),
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

// ── P3: one bible per love interest (structured, 0.8, planner contract) ──

const BIBLE_SHAPE = `{
  "age": 0, "pronouns": {"subject": "", "object": "", "possessive": ""}, "birthday": "MM-DD",
  "role": "", "publicFace": "", "archetype": "", "subversion": "",
  "wound": "", "ghost": "", "lie": "", "want": "", "need": "", "fear": "",
  "mask": {"presents": "", "tells": ["", "", ""]}, "trueSelf": {"is": "", "showsWhen": [""]},
  "flaws": [""], "virtues": [""], "contradictions": [""], "moralCode": "", "redLines": [""], "darkness": {"kinds": [""]},
  "voice": {"register": "", "tics": [""], "never": [""], "careLanguage": "", "angerStyle": "", "jealousyStyle": "",
            "samples": {"guarded": "", "tender": "", "angry": ""}},
  "likes": [""], "dislikes": [""],
  "web": {"<other love interest id>": {"history": "", "stance": "", "debt": "", "secret": ""}},
  "secrets": [{"id": "", "truth": "", "tells": [""], "revealAt": {"stage": 4}}],
  "arc": {"1": {"wantsFromHer": "", "seed": ""}, "2": {}, "3": {}, "4": {}, "5": {}, "6": {}},
  "look": {"identityLine": "", "outfitLine": "", "presentation": "man|woman|person"},
  "play": {"style": "", "cheat": "steady|nudge|extra|freeze|calculate"}
}`;

const GENTLE_DARKNESS =
  "Darkness is Gentle: darkness.kinds are interpersonal only (pride, coldness, jealousy, old hurts, secrecy); no violence or menace.";

export function bibleMessages({
  world,
  player,
  member,
  others,
}: {
  world: World;
  player: Player;
  member: CastMember;
  others: readonly CastMember[];
}): OtomeMessage[] {
  const { unit } = member;
  const fromCard = unit.source === "card";
  const system = [
    "You write the hidden character bible of one love interest in an otome game. It stays behind a spoiler gate; every scene with this character is written from it.",
    "Reply with ONLY a JSON object of this shape:",
    BIBLE_SHAPE,
    "FIELDS",
    "- publicFace: how the world sees them. archetype: their type in a few words. subversion: how they break it.",
    "- wound: the old hurt. ghost: the event behind it. lie: the false belief they live by. want: what they chase. need: what would heal them. fear: what they dread.",
    "- mask.presents: the face they show; mask.tells: 3 to 5 small behaviours that betray what is under it. trueSelf.is and showsWhen: who they are, and the moments it shows.",
    "- redLines: what they will never do, from their own integrity. moralCode: the rule they live by. darkness.kinds: the kinds of darkness in them.",
    "- voice.register: how they speak. tics: verbal habits. never: what they never say or do. careLanguage: how they show care. angerStyle, jealousyStyle: how anger and jealousy come out. samples: one line each, guarded, tender and angry, in their voice.",
    "- web: one entry for each other love interest, keyed by that love interest's exact id: shared history, stance, what is owed, and optionally a secret (omit it when there is none).",
    `- secrets: 2 to 4, each with a short unique id, the truth, 2 to 4 tells (behaviour that hints at it without stating it), and revealAt.stage from 2 to 6. At least one secret has revealAt.stage 4 (the Wound), and one of them carries the piece of the mystery they hold.`,
    '- arc: one entry for each stage "1" to "6" (Mask, Crack, Pull, Wound, Reckoning, Bond): wantsFromHer is what they want from the protagonist at that stage, whatever the protagonist\'s gender; seed is a story seed for that stage.',
    "- look: English only, visual-only comma-separated tags. identityLine: face, hair, eyes, build, skin, marks, with adult features. outfitLine: their everyday clothing in this world. presentation: how to draw them, man, woman or person.",
    "- play: how they would play a claw machine. style: one sentence. cheat: steady, nudge, extra, freeze or calculate.",
    "RULES",
    fromCard
      ? "- Derive everything from the CANONICAL CHARACTER CARD and never contradict it: the card wins over the premise and the plan."
      : "- Build the character from the archetype and the player's notes; subvert the archetype rather than repeat it.",
    `- age: a whole number, ${MIN_AGE} or older. They are an adult, always.`,
    "- role: an adult role in this world, never a school or student role (no student, pupil, schoolgirl, schoolboy, high school or teen).",
    `- pronouns: exactly ${JSON.stringify(unit.pronouns)}.`,
    "- birthday: month and day as MM-DD.",
    ...(world.content.darkness === "gentle" ? [`- ${GENTLE_DARKNESS}`] : []),
    `- Write every text field except look in ${world.language}.`,
    "- Omit an optional field rather than writing null.",
    "",
    otomeWritingRules({ story: false }),
    "",
    otomeContentContract({ world, lis: [{ name: unit.name }], kind: "planner" }),
  ].join("\n");
  const piece = world.mystery.pieces[unit.id];
  const web = world.web
    .filter((row) => row.a === unit.id || row.b === unit.id)
    .map((row) => {
      const id = row.a === unit.id ? row.b : row.a;
      const name = others.find((other) => other.unit.id === id)?.unit.name ?? id;
      return `- with ${name} (id ${id}): ${row.stance}. History: ${row.history} Debt: ${row.debt}${row.secret ? ` Secret: ${row.secret}` : ""}`;
    });
  const user = [
    "WORLD",
    world.setting.trim() || world.premise.trim(),
    world.mystery.question ? `The mystery: ${world.mystery.question}` : "",
    "",
    "THIS LOVE INTEREST",
    castEntry(member),
    piece ? `Their piece of the mystery: ${piece.piece}\nTheir reason to hide it: ${piece.reasonToHide}` : "",
    "",
    others.length ? "THE OTHER LOVE INTERESTS" : "",
    others.map(({ unit: other }) => `id ${other.id}: ${other.name} (${pronounText(other.pronouns)})`).join("\n"),
    web.length ? `Their ties:\n${web.join("\n")}` : "",
    "",
    "PROTAGONIST",
    protagonistEntry(player),
    "",
    `Write ${unit.name}'s bible now.`,
    otomeContractReminder("planner"),
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

// ── P4: the protagonist's look (structured, 0.3; only when the persona has no appearance) ──

export interface PlayerLookReply {
  identityLine: string;
  outfitLine: string;
}
export const PlayerLookSchema: ZodType<PlayerLookReply> = z.object({
  identityLine: z.string().min(1),
  outfitLine: z.string(),
});

export function normalizePlayerLook(reply: PlayerLookReply): PlayerLookReply | string {
  const identityLine = reply.identityLine.trim().slice(0, LOOK_LINE_MAX);
  if (!identityLine) return "identityLine must describe how they look";
  return { identityLine, outfitLine: reply.outfitLine.trim().slice(0, LOOK_LINE_MAX) };
}

export function playerLookMessages({
  world,
  player,
  persona,
}: {
  world: Pick<World, "setting" | "premise">;
  player: Player;
  persona: PersonaFields | null;
}): OtomeMessage[] {
  const description = persona?.description.slice(0, PERSONA_TEXT_MAX) ?? "";
  return [
    {
      role: "system",
      content: [
        "You describe how to draw the protagonist of an otome game for an image model.",
        'Reply with ONLY a JSON object: {"identityLine": "...", "outfitLine": "..."}',
        "RULES",
        "- English only: visual-only comma-separated tags, with no names and no story.",
        "- identityLine: face, hair, eyes, build, skin, marks. They are an adult (18 or older), with adult features.",
        "- outfitLine: everyday clothing that fits the setting.",
        "- Follow anything the persona says about their looks; otherwise choose plainly.",
        "- Never assume a gender the pronouns do not state.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Setting: ${world.setting.trim() || world.premise.trim() || "(unknown)"}`,
        `Protagonist: ${player.name || "the protagonist"} (${pronounText(player.pronouns)})`,
        description ? `Persona: ${description}` : "",
        player.traits.length ? `Traits: ${player.traits.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}
