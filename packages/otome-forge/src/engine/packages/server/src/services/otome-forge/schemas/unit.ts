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
  ArcStageKey,
  Bible,
  FixedLines,
  LinePacks,
  Paint,
  StageLines,
  Unit,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
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
  readFields,
  readWornOutfit,
  text,
  textList,
  validItems,
} from "./common.js";

export const LI_NOTES_MAX = 500;
export const ACCENT_PATTERN = /^#[0-9a-f]{6}$/i;
/** Rose, until his portrait or a hash of his name gives him his own. */
export const DEFAULT_ACCENT = "#E7A6B8";

const ArcStepSchema = z.object({ wantsFromHer: text().optional(), seed: text().optional() });

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

export const StageLinesSchema: ZodType<StageLines> = z.object({
  stage: z.number().int().min(1).max(6),
  tap: z.object({ head: TimesSchema, hand: TimesSchema, heart: TimesSchema }),
  annoyed: LineList,
  cold: LineList,
  at: z.string(),
});

export const FixedLinesSchema: ZodType<FixedLines> = z.object({
  comfort: LineList,
  claw: z.object({ cheer: LineList, cheat: LineList, win: LineList, miss: LineList, plush: LineList }),
  at: z.string(),
});

const STAGE_KEYS: readonly ArcStageKey[] = ["1", "2", "3", "4", "5", "6"];

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

/** Stored cut-out records, keyed by the look's URL; a bad record is dropped (the cut-out is made again). */
function normalizeCutouts(value: unknown): Record<string, Paint> {
  const cutouts: Record<string, Paint> = {};
  if (!isRecord(value)) return cutouts;
  for (const [url, record] of Object.entries(value)) {
    const parsed = PaintSchema.safeParse(record);
    if (url && parsed.success) cutouts[url] = parsed.data;
  }
  return cutouts;
}

const defaultUnit = (): Unit => ({
  kind: "character",
  id: "",
  name: "",
  pronouns: defaultPronouns(),
  source: "archetype",
  accent: DEFAULT_ACCENT,
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
    },
    defaultUnit,
    isRecord(data) ? data : undefined,
  );
  // An LI with no pack yet has no `lines` key at all, as before M3.
  if (!unit.lines) delete unit.lines;
  // A worn look that is not one of theirs (a damaged document) wears the base portrait.
  const { wornOutfit: _worn, ...rest } = unit;
  const worn = readWornOutfit(unit.outfits, field(data, "wornOutfit"));
  return worn ? { ...rest, wornOutfit: worn } : rest;
}
