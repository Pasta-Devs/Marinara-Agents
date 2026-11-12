// ──────────────────────────────────────────────
// Otome Forge: the `${R}:unit:${li}` document (a love interest, with his hidden bible)
// ──────────────────────────────────────────────
// BibleSchema is the structural check for a bible the model wrote or the player edited (age 18 or over, 3–5 mask
// tells). S/setup/bible.ts's checkBible adds what needs the whole bible (no school or student role, a secret revealed
// at stage 4); the bible step and POST .../bible both run it after the schema. The limits live in SH/bible.ts, which
// the bible editor checks too.
// A stored bible is read field by field (readFields), so one damaged field keeps its default and not the whole bible.
import { z, type ZodType } from "zod";
import type {
  BibleIntimacy,
  ArcStageKey,
  Bible,
  FixedLines,
  LinePacks,
  PlushArt,
  StageLines,
  StickerSet,
  Unit,
  BibleBond,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { STICKER_EMOTION, STICKERS_PER_LI } from "../../../../../client/src/features/otome-forge/shared/stickers.js";
import { FACES } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import {
  BIRTHDAY_PATTERN,
  MASK_TELLS_MAX,
  MASK_TELLS_MIN,
  MIN_AGE,
  SECRET_TELLS_MAX,
  SECRETS_MAX,
  SECRETS_MIN,
} from "../../../../../client/src/features/otome-forge/shared/bible.js";
import {
  OUTFITS_MAX,
  OutfitSchema,
  PaintSchema,
  PronounsSchema,
  defaultPronouns,
  field,
  isRecord,
  normalizePaints,
  normalizeCutouts,
  readFields,
  readWornOutfit,
  text,
  textList,
  validItems,
} from "./common.js";
import { sanitizePlushSvg } from "../art/plush-svg.js";

/** The longest animal name kept for a plush. */
export const PLUSH_ANIMAL_MAX = 40;

export const LI_NOTES_MAX = 500;
export const ACCENT_PATTERN = /^#[0-9a-f]{6}$/i;
/** Rose, until his portrait or a hash of his name gives him his own. */
export const DEFAULT_ACCENT = "#E7A6B8";

const ArcStepSchema = z.object({ wantsFromHer: text().optional(), seed: text().optional() });

/** How many preferences and attractions a bible's intimacy block holds: a handful, never an exhaustive list. */
export const INTIMACY_ITEMS_MAX = 6;
/** Bounded well above the handful, so a reply or edit that overshoots is trimmed by normalizeIntimacy, not refused. */
export const IntimacySchema: ZodType<BibleIntimacy> = z.object({
  preferences: textList(INTIMACY_ITEMS_MAX * 4),
  attractions: textList(INTIMACY_ITEMS_MAX * 4),
});

const INTIMACY_ITEM_MAX = 120;

/** A bond rank's reveal (0.23.0); the list holds one per rank 11-20. */
const BOND_LEVELS = 10;

export const BondSchema: ZodType<BibleBond> = z.object({ level: z.number().int().min(11).max(20), truth: text() });

/** His bond reveals, one per rank 11-20, trimmed, or undefined when none reads; a damaged list reads as none. */
export function normalizeBondReveals(data: unknown): BibleBond[] | undefined {
  if (!Array.isArray(data)) return undefined;
  const seen = new Set<number>();
  const entries: BibleBond[] = [];
  for (const row of data) {
    const parsed = BondSchema.safeParse(row);
    if (!parsed.success) continue;
    const truth = parsed.data.truth.replace(/\s+/g, " ").trim();
    if (!truth || seen.has(parsed.data.level)) continue;
    seen.add(parsed.data.level);
    entries.push({ level: parsed.data.level, truth });
  }
  return entries.length ? entries.sort((a, b) => a.level - b.level) : undefined;
}

/** The block trimmed to a handful of short labels, or the problem when nothing usable is left. */
export function normalizeIntimacy(value: BibleIntimacy): BibleIntimacy | string {
  const clean = (items: readonly string[]) =>
    items
      .map((item) => item.replace(/\s+/g, " ").trim().slice(0, INTIMACY_ITEM_MAX))
      .filter(Boolean)
      .slice(0, INTIMACY_ITEMS_MAX);
  const intimacy = { preferences: clean(value.preferences), attractions: clean(value.attractions) };
  return intimacy.preferences.length || intimacy.attractions.length
    ? intimacy
    : "intimacy needs at least one preference or attraction";
}

/** One zod schema per bible field: BibleSchema checks them all, normalizeBible falls back field by field. */
const BIBLE_FIELDS: { [K in keyof Bible]-?: ZodType<Bible[K]> } = {
  age: z.number().int().min(MIN_AGE),
  pronouns: PronounsSchema,
  birthday: z.string().regex(BIRTHDAY_PATTERN),
  role: text(300),
  publicFace: text(),
  archetype: text(200),
  subversion: text(),
  wound: text(),
  ghost: text(),
  lie: text(),
  want: text(),
  need: text(),
  fear: text(),
  mask: z.object({ presents: text(), tells: textList(MASK_TELLS_MAX).min(MASK_TELLS_MIN) }),
  trueSelf: z.object({ is: text(), showsWhen: textList() }),
  flaws: textList(),
  virtues: textList(),
  contradictions: textList(),
  moralCode: text(),
  redLines: textList(),
  darkness: z.object({ kinds: textList() }),
  voice: z.object({
    register: text(),
    tics: textList(),
    never: textList(),
    careLanguage: text(),
    angerStyle: text(),
    jealousyStyle: text(),
    samples: z.object({ guarded: text(), tender: text(), angry: text() }),
  }),
  likes: textList(),
  dislikes: textList(),
  web: z.record(z.string(), z.object({ history: text(), stance: text(200), debt: text(), secret: text().optional() })),
  secrets: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        truth: text(),
        tells: textList(SECRET_TELLS_MAX),
        revealAt: z.object({
          stage: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
        }),
      }),
    )
    .min(SECRETS_MIN)
    .max(SECRETS_MAX),
  arc: z.object({
    "1": ArcStepSchema,
    "2": ArcStepSchema,
    "3": ArcStepSchema,
    "4": ArcStepSchema,
    "5": ArcStepSchema,
    "6": ArcStepSchema,
  }),
  look: z.object({
    identityLine: text(600),
    outfitLine: text(600),
    presentation: z.enum(["man", "woman", "person"]),
  }),
  play: z.object({ style: text(300), cheat: z.enum(["steady", "nudge", "extra", "freeze", "calculate"]) }),
  intimacy: IntimacySchema.optional(),
  bond: z.array(BondSchema).max(BOND_LEVELS).optional(),
};

export const BibleSchema: ZodType<Bible> = z.object(BIBLE_FIELDS);

const defaultBible = (): Bible => ({
  age: MIN_AGE,
  pronouns: defaultPronouns(),
  birthday: "01-01",
  role: "",
  publicFace: "",
  archetype: "",
  subversion: "",
  wound: "",
  ghost: "",
  lie: "",
  want: "",
  need: "",
  fear: "",
  mask: { presents: "", tells: [] },
  trueSelf: { is: "", showsWhen: [] },
  flaws: [],
  virtues: [],
  contradictions: [],
  moralCode: "",
  redLines: [],
  darkness: { kinds: [] },
  voice: {
    register: "",
    tics: [],
    never: [],
    careLanguage: "",
    angerStyle: "",
    jealousyStyle: "",
    samples: { guarded: "", tender: "", angry: "" },
  },
  likes: [],
  dislikes: [],
  web: {},
  secrets: [],
  arc: { "1": {}, "2": {}, "3": {}, "4": {}, "5": {}, "6": {} },
  look: { identityLine: "", outfitLine: "", presentation: "person" },
  play: { style: "", cheat: "steady" },
});

/** A stored bible in its full shape, or null when there is none yet. */
export function normalizeBible(data: unknown): Bible | null {
  return isRecord(data) ? readFields<Bible>(BIBLE_FIELDS, defaultBible, data) : null;
}

// ── Home lines and cut-outs (M3) ──

/** A stored line: what P15's checks let through, with room for a hand edit. */
const LineList = z.array(z.string().min(1).max(300)).max(12);

const TimesSchema = z.object({ morning: LineList, day: LineList, night: LineList });
const ZoneFace = z.enum(FACES).optional();

// #2152: cheek, crotch, the contract and faces are optional, so a pack written before 0.14.0 still reads.
export const StageLinesSchema: ZodType<StageLines> = z.object({
  stage: z.number().int().min(1).max(6),
  tap: z.object({
    head: TimesSchema,
    cheek: TimesSchema.optional(),
    heart: TimesSchema,
    hand: TimesSchema,
    crotch: TimesSchema.optional(),
  }),
  annoyed: LineList,
  cold: LineList,
  at: z.string(),
  contract: z.string().max(40).optional(),
  faces: z.object({ head: ZoneFace, cheek: ZoneFace, heart: ZoneFace, hand: ZoneFace, crotch: ZoneFace }).optional(),
});

export const FixedLinesSchema: ZodType<FixedLines> = z.object({
  comfort: LineList,
  claw: z.object({ cheer: LineList, cheat: LineList, win: LineList, miss: LineList, plush: LineList }),
  at: z.string(),
  contract: z.string().max(40).optional(),
});

const STAGE_KEYS: readonly ArcStageKey[] = ["1", "2", "3", "4", "5", "6"];

/** A stored plush, its SVG checked again on every read (S/art/plush-svg.ts); a damaged one is dropped and drawn again. */
export function normalizePlushArt(value: unknown): PlushArt | undefined {
  if (!isRecord(value) || typeof value.svg !== "string" || typeof value.animal !== "string") return undefined;
  const clean = sanitizePlushSvg(value.svg);
  const animal = value.animal.trim().slice(0, PLUSH_ANIMAL_MAX);
  if (!("svg" in clean) || !animal) return undefined;
  return { animal, svg: clean.svg, at: typeof value.at === "string" ? value.at : "" };
}

/** His sticker set's design, at most STICKERS_PER_LI. A label counts characters (code points), as the reply's check does. */
export const STICKER_LABEL_MAX = 24;
export const STICKER_LOOK_MAX = 160;
const StickerDesignSchema = z.object({
  emotion: z.string().regex(STICKER_EMOTION),
  label: z
    .string()
    .min(1)
    .refine((label) => [...label].length <= STICKER_LABEL_MAX),
  look: z.string().min(1).max(STICKER_LOOK_MAX),
});

/** A stored sticker set (#2044): its valid designs in order, and the paints of the emotions it holds. */
export function normalizeStickerSet(value: unknown): StickerSet | undefined {
  if (!isRecord(value)) return undefined;
  const set = validItems(StickerDesignSchema, value.set, STICKERS_PER_LI);
  if (!set.length) return undefined;
  const emotions = new Set(set.map((entry) => entry.emotion));
  return {
    set,
    at: typeof value.at === "string" ? value.at : "",
    art: normalizePaints(value.art, (emotion) => emotions.has(emotion)),
  };
}

/** Stored line packs, each stage on its own: one damaged pack is dropped (and written again), the others kept. */
export function normalizeLinePacks(value: unknown): LinePacks | undefined {
  if (!isRecord(value)) return undefined;
  const stages: LinePacks["stages"] = {};
  const raw = isRecord(value.stages) ? value.stages : {};
  for (const key of STAGE_KEYS) {
    const parsed = StageLinesSchema.safeParse(raw[key]);
    if (parsed.success && String(parsed.data.stage) === key) stages[key] = parsed.data;
  }
  const fixed = FixedLinesSchema.safeParse(value.fixed);
  return { stages, fixed: fixed.success ? fixed.data : null };
}

const defaultUnit = (): Unit => ({
  kind: "character",
  id: "",
  name: "",
  pronouns: defaultPronouns(),
  source: "archetype",
  accent: DEFAULT_ACCENT,
  accentSampler: 0,
  voiceGender: "",
  identityLine: "",
  outfitLine: "",
  outfits: [],
  expressions: {},
  bible: null,
  bibleEdited: false,
  createdAt: "",
  cutouts: {},
});

export function normalizeUnit(data: unknown): Unit {
  const unit = readFields<Unit>(
    {
      kind: () => "character",
      id: z.string(),
      name: z.string(),
      pronouns: PronounsSchema,
      source: z.enum(["card", "archetype"]),
      cardId: z.string().optional(),
      archetype: z.string().optional(),
      notes: z.string().max(LI_NOTES_MAX).optional(),
      accent: z.string().regex(ACCENT_PATTERN),
      accentSampler: z.number().int().min(0),
      voiceGender: z.enum(["male", "female", ""]),
      portrait: z.string().optional(),
      portraitRef: z.string().optional(),
      art: PaintSchema.optional(),
      identityLine: z.string(),
      outfitLine: z.string(),
      outfits: (value) => validItems(OutfitSchema, value, OUTFITS_MAX),
      wornOutfit: z.string().optional(),
      expressions: z.record(z.string(), z.unknown()),
      bible: normalizeBible,
      bibleEdited: z.boolean(),
      createdAt: z.string(),
      lines: normalizeLinePacks,
      cutouts: normalizeCutouts,
      plushArt: normalizePlushArt,
      figurine: PaintSchema.optional(),
      stickers: normalizeStickerSet,
    },
    defaultUnit,
    isRecord(data) ? data : undefined,
  );
  // An LI with no pack yet has no `lines` key at all, as before M3; one with no plush drawn, no `plushArt`; one whose
  // figurine was never set to paint, no `figurine` (#2138; a 0.9.0 SVG `figurineArt` is not read, so it is dropped).
  if (!unit.lines) delete unit.lines;
  if (!unit.plushArt) delete unit.plushArt;
  if (!unit.figurine) delete unit.figurine;
  if (!unit.stickers) delete unit.stickers;
  // A worn look that is not one of theirs (a damaged document) wears the base portrait.
  const { wornOutfit: _worn, ...rest } = unit;
  const worn = readWornOutfit(unit.outfits, field(data, "wornOutfit"));
  return worn ? { ...rest, wornOutfit: worn } : rest;
}
