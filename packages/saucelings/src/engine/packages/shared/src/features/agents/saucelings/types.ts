import type { Root } from "react-dom/client";

export const SAUCELING_SPECIES = [
  "rigamuffin",
  "fluttino",
  "lentino",
  "shellbini",
  "tortellump",
  "mossaboo",
  "puddlepip",
  "snufflump",
  "burrowl",
  "prismite",
  "thundrake",
  "clockrit",
  "wickwisp",
  "cauldrop",
  "webbit",
] as const;
export type SaucelingSpeciesId = (typeof SAUCELING_SPECIES)[number];

/** Any egg may be one of these, and only these are found while chatting or leaned to by a caretaker. */
export const ORDINARY_SPECIES = [
  "rigamuffin",
  "fluttino",
  "lentino",
  "shellbini",
  "tortellump",
  "mossaboo",
  "puddlepip",
  "snufflump",
  "burrowl",
] as const satisfies readonly SaucelingSpeciesId[];

/** Each is unlocked once, by one milestone (see `SaucelingUnlocks`), and stays unlocked. */
export const SPECIAL_SPECIES = ["prismite", "thundrake", "clockrit"] as const satisfies readonly SaucelingSpeciesId[];
export type SaucelingSpecialSpeciesId = (typeof SPECIAL_SPECIES)[number];

/** Adopted eggs may be one of these in October (UTC) only; one that hatched stays. */
export const SEASONAL_SPECIES = ["wickwisp", "cauldrop", "webbit"] as const satisfies readonly SaucelingSpeciesId[];

/** The built-in species made of pasta. Every other sauceling, and any with a design, is not pasta: it has a temperament
 *  of its own (see `SaucelingOwnTemperament`) instead of a sauce. */
export const PASTA_SPECIES = [
  "rigamuffin",
  "fluttino",
  "lentino",
  "shellbini",
  "tortellump",
] as const satisfies readonly SaucelingSpeciesId[];

export const SAUCELING_TEMPERAMENTS = [
  "marinara",
  "zesto",
  "carbonuzzle",
  "rabbratty",
  "seppy",
  "alfredoze",
  "truffoddity",
] as const;
export type SaucelingTemperamentId = (typeof SAUCELING_TEMPERAMENTS)[number];

export const SAUCELING_SCORED_TEMPERAMENTS = [
  "zesto",
  "carbonuzzle",
  "rabbratty",
  "seppy",
  "alfredoze",
  "truffoddity",
] as const;
export type SaucelingScoredTemperamentId = (typeof SAUCELING_SCORED_TEMPERAMENTS)[number];

export type SaucelingTemperamentVector = Record<SaucelingScoredTemperamentId, number>;

export const SAUCELING_STAGES = ["egg", "hatchling", "juvenile", "adult", "elder"] as const;
export type SaucelingStage = (typeof SAUCELING_STAGES)[number];

export const SAUCELING_POST_EGG_STAGES = ["hatchling", "juvenile", "adult", "elder"] as const;
export type SaucelingPostEggStage = (typeof SAUCELING_POST_EGG_STAGES)[number];

export const SAUCELING_MOODS = ["happy", "content", "grumpy"] as const;
export type SaucelingMood = (typeof SAUCELING_MOODS)[number];

/** What you can do for a hatched sauceling. */
export const SAUCELING_CREATURE_ACTIONS = ["feed", "play", "rest", "pet"] as const;
/** What you can do for an egg. */
export const SAUCELING_EGG_ACTIONS = ["warm", "talk", "listen"] as const;
export const SAUCELING_USER_ACTIONS = [...SAUCELING_CREATURE_ACTIONS, ...SAUCELING_EGG_ACTIONS] as const;
export type SaucelingUserAction = (typeof SAUCELING_USER_ACTIONS)[number];

/** An egg can hatch this long after it arrives, once it has had any care. */
export const SAUCELING_HATCH_WAIT_MS = 30 * 60 * 1000;
/** Warmth a new egg starts with, and what an egg saved before eggs had warmth reads as. */
export const SAUCELING_EGG_START_WARMTH = 70;
/** A hatched sauceling only grows up while its hunger is at least this. */
export const SAUCELING_GROWTH_MIN_HUNGER = 35;

export const SAUCELING_CARETAKER_OUTCOMES = [
  "fed-fine",
  "fed-badly",
  "overfed",
  "forgot",
  "played",
  "cuddled",
  "milestone-noticed",
  "kept-warm",
  "let-cool",
  "chatted",
] as const;
export type SaucelingCaretakerOutcome = (typeof SAUCELING_CARETAKER_OUTCOMES)[number];

export const SAUCELING_TENDENCIES = [
  "feedReliability",
  "overfeeding",
  "playfulness",
  "affection",
  "attentiveness",
  "consistency",
] as const;
export type SaucelingTendencyKey = (typeof SAUCELING_TENDENCIES)[number];

export type SaucelingCareTendencies = Record<SaucelingTendencyKey, number>;

/** The routine moments: the caretaker's first phrasebook call writes four lines for each, and their sign-offs. */
export const SAUCELING_ROUTINE_MOMENTS = [
  "feed",
  "fedBadly",
  "overfed",
  "forgot",
  "play",
  "cuddle",
  "milestone",
  "warmEgg",
  "letCool",
  "chatEgg",
  "hatch",
  "stageUp",
] as const;
/** The one-off moments: a second phrasebook call writes three lines for each. The model may still write a fresh line
 *  for any of them; these are what is said until it does, or when it cannot. */
export const SAUCELING_SCENE_MOMENTS = [
  "hello",
  "farewell",
  "checkInEgg",
  "checkInContent",
  "checkInHungry",
  "checkInSad",
  "backSoon",
  "backLong",
  "returnHome",
  "eggFound",
  "eggFoundTalking",
  "anotherEgg",
  "eggFoundByOther",
  "evolveOffer",
  "evolve",
  "temperamentShift",
  "takesAfter",
  "eggFarewell",
  "eggReturn",
] as const;
export const SAUCELING_PHRASE_MOMENTS = [...SAUCELING_ROUTINE_MOMENTS, ...SAUCELING_SCENE_MOMENTS] as const;
export type SaucelingPhraseMoment = (typeof SAUCELING_PHRASE_MOMENTS)[number];

/** Which sign-offs go after a line: how the caretaker feels about what they just said. */
export const SAUCELING_SIGNOFF_FEELINGS = ["pleased", "worried", "neutral"] as const;
export type SaucelingSignoffFeeling = (typeof SAUCELING_SIGNOFF_FEELINGS)[number];

export interface SaucelingCareVoice {
  petNickname: string;
  feedingStyle: string;
  /** Their own, up to three; the house voice has its own. */
  catchphrases: string[];
  voiceSample: string;
  worryLevel: 0 | 1 | 2 | 3;
  /** How they talk, read from their card; it steers the model's lines. Profiles made before it have none. */
  speechStyle?: string;
  /** Lines in their own voice per moment, with {pet} where the pet's name goes (and {nickname}, or what the moment
   *  fills in, where they fit). A moment with none uses the house phrasebook. */
  phrases?: Partial<Record<SaucelingPhraseMoment, string[]>>;
  /** Short tags they may add after a line, by feeling. Voices made before them sign off with their catchphrases. */
  signoffs?: Partial<Record<SaucelingSignoffFeeling, string[]>>;
}

export interface SaucelingCareProfile {
  characterId: string;
  characterName: string;
  cardDigest: string;
  generatedByModel: boolean;
  tendencies: SaucelingCareTendencies;
  voice: SaucelingCareVoice;
  speciesLean: SaucelingSpeciesId[];
  temperamentLean: SaucelingScoredTemperamentId[];
  updatedAt: string;
}

export interface SaucelingNudge {
  tendency: SaucelingTendencyKey;
  delta: number;
  expiresAt: string;
  label: string;
}

export type SaucelingAbsenceBucket = "day" | "days" | "week" | "long";

export type SaucelingEventKind =
  | "egg-found"
  | "hatch"
  | "caretaker-care"
  | "user-care"
  | "nudge"
  | "absence"
  | "stage-up"
  | "temperament-shift"
  | "farewell"
  // The Menagerie was once called the Album; the id stays because journals store it.
  | "return-from-album"
  | "check-in"
  | "evolve"
  // The caretaker says it is ready to evolve; the Nook then shows Evolve….
  | "evolve-offer"
  // A new caretaker took over and says hello.
  | "caretaker-change";

export interface SaucelingEvent {
  id: string;
  kind: SaucelingEventKind;
  createdAt: string;
  text: string;
  generated: boolean;
  /** The caretaker's name when the line is their speech; lines written before speech had none. */
  speaker?: string;
  outcome?: SaucelingCaretakerOutcome;
  action?: SaucelingUserAction;
  stage?: SaucelingStage;
  temperament?: SaucelingTemperamentId;
  absenceBucket?: SaucelingAbsenceBucket;
  windowsElapsed?: number;
  tallies?: Partial<Record<SaucelingCaretakerOutcome, number>>;
  /** Who found the egg, on a caretaker's line about an egg another character found while chatting. */
  finder?: string;
}

/** One UTC day of a caretaker's meal turns: `given` meals of `total` turns. */
export interface SaucelingMealDay {
  day: number;
  given: number;
  total: number;
}

export interface SaucelingMeters {
  hunger: number;
  mood: number;
  bond: number;
  /** Eggs only; an egg saved before eggs had warmth reads as SAUCELING_EGG_START_WARMTH. A warm egg hatches happier. */
  warmth?: number;
}

/** What one painting is of: one stage's form, or every stage at once from a life sheet. */
export type SaucelingPaintKey = SaucelingStage | "sheet";

/** A page painting a form, so another open page does not pay for the same picture. */
export interface SaucelingPaintClaim {
  token: string;
  at: string;
}

/** A sauceling its caretaker invented from their card: one they found while chatting, or what an adult evolved
 *  into. Only the descriptions live here; its pictures are forms (`SaucelingPet.forms`). */
export interface SaucelingDesign {
  /** What kind of creature it is, shown where a built-in sauceling shows its species name. */
  kind: string;
  /** Its body, shape and features in a sentence or two. */
  look: string;
  colours: [string, string, string];
  traits: [string, string, string];
  quirk: string;
  /** A picture description per stage: every stage for a found one, adult and elder for an evolved one. */
  stages: Partial<Record<SaucelingStage, string>>;
  origin: "found" | "evolved";
}

/** What an evolution recolours the whole sprite to; ids are never shown, only the names in en.json. */
export const SAUCELING_EVOLVE_COLOURS = [
  "ember",
  "frost",
  "moss",
  "dusk",
  "gilded",
  "shade",
  "bloom",
  "storm",
  "tide",
] as const;
export type SaucelingEvolveColour = (typeof SAUCELING_EVOLVE_COLOURS)[number];
/** The little pixel drawing that floats above its head, in the row order of sprites/fx-extras.webp. */
export const SAUCELING_EVOLVE_EXTRAS = [
  "halo",
  "crown",
  "star",
  "flame",
  "moon",
  "leaf",
  "gem",
  "snowflake",
  "cloud",
  "bolt",
  "feather",
  "heart",
  "mushroom",
  "orb",
  "bow",
  "flower",
  "shell",
] as const;
export type SaucelingEvolveExtra = (typeof SAUCELING_EVOLVE_EXTRAS)[number];
/** The particles drifting around it, in the row order of sprites/fx-auras.webp. */
export const SAUCELING_EVOLVE_AURAS = [
  "embers",
  "snow",
  "leaves",
  "petals",
  "stars",
  "glints",
  "wisps",
  "sparks",
  "bubbles",
] as const;
export type SaucelingEvolveAura = (typeof SAUCELING_EVOLVE_AURAS)[number];
/** Its signature move, done now and then on the stage. The first five came before paths; a saved look keeps its move
 *  even off its colour's path. */
export const SAUCELING_EVOLVE_MOVES = [
  "twirl",
  "float",
  "shine",
  "roar",
  "sparkle",
  "firepuff",
  "icicles",
  "leafwhirl",
  "wiggle",
  "petalshower",
  "triplehop",
  "starburst",
  "coinshower",
  "shockwave",
  "vanish",
  "zap",
  "dash",
  "bubbleblow",
  "splash",
] as const;
export type SaucelingEvolveMove = (typeof SAUCELING_EVOLVE_MOVES)[number];

/** Each colour's path: the aura it always brings and the extras and moves a new look picks from (a saved look keeps
 *  whatever extra and move it has). The first move is the one its evolution moment shows off. */
export const SAUCELING_EVOLVE_PATHS: Record<
  SaucelingEvolveColour,
  { aura: SaucelingEvolveAura; extras: readonly SaucelingEvolveExtra[]; moves: readonly SaucelingEvolveMove[] }
> = {
  ember: { aura: "embers", extras: ["flame", "star", "crown"], moves: ["firepuff", "roar"] },
  frost: { aura: "snow", extras: ["snowflake", "gem", "moon"], moves: ["icicles", "twirl"] },
  moss: { aura: "leaves", extras: ["leaf", "mushroom", "feather"], moves: ["leafwhirl", "wiggle"] },
  dusk: { aura: "stars", extras: ["moon", "star", "orb"], moves: ["starburst", "float"] },
  gilded: { aura: "glints", extras: ["crown", "halo", "gem"], moves: ["coinshower", "sparkle", "shine"] },
  shade: { aura: "wisps", extras: ["moon", "orb", "feather"], moves: ["shockwave", "vanish"] },
  bloom: { aura: "petals", extras: ["flower", "heart", "bow"], moves: ["petalshower", "triplehop"] },
  storm: { aura: "sparks", extras: ["bolt", "cloud", "orb"], moves: ["zap", "dash"] },
  tide: { aura: "bubbles", extras: ["shell", "gem", "orb"], moves: ["bubbleblow", "splash"] },
};

/** One look a sauceling can evolve into: drawn by the client on its own sprite, never painted. */
export interface SaucelingEvolution {
  /** What it becomes, e.g. "Ember Lentino". */
  form: string;
  description: string;
  /** "From: …", what in its life led here. */
  from: string;
  colour: SaucelingEvolveColour;
  extra: SaucelingEvolveExtra;
  move: SaucelingEvolveMove;
}

/** Hours of a UTC day it spent happy and close to its caretaker. */
export interface SaucelingGoodHours {
  day: number;
  good: number;
}

/** Its one evolution in life: offered by its caretaker after a few good days, then chosen, kept, undone or declined. */
export interface SaucelingEvolveState {
  /** "offered" shows Evolve… until it evolves; "declined" (Not interested) never offers again. */
  offer: "offered" | "declined" | null;
  /** The two looks it was offered, written once; Undo brings back the same two. */
  choices: [SaucelingEvolution, SaucelingEvolution] | null;
  /** The look it took, or null; an old-style evolved pet has `at` with no look, so it has nothing to undo. */
  look: SaucelingEvolution | null;
  /** When it evolved, or null. */
  at: string | null;
  /** Good hours (bond at least 70, mood at least 50) for the last three UTC days. */
  goodHours: SaucelingGoodHours[];
  /** The UTC days (ms / day) its caretaker replied in a chat, up to three; each makes the offer likelier. */
  chatDays: number[];
}

/** Whoever found a sauceling's egg: the caretaker who brought it, or the character who found it while chatting. */
export interface SaucelingFinder {
  id: string;
  /** Their name when they found it; it stays when they are renamed. */
  name: string;
}

/** The temperament of a sauceling that is not pasta, written from a character's card instead of a sauce. */
export interface SaucelingOwnTemperament {
  name: string;
  readsAs: string;
  /** The character it takes after: its finder at first, then a caretaker who has had it two weeks in a row. */
  takesAfter: SaucelingFinder;
  /** How far it takes after them: 3 is fully. Each shift toward someone new starts at 1, and each two weeks more with
   *  them adds one. */
  steps: 1 | 2 | 3;
  /** When it was written. */
  at: string;
}

/** Where the player put the egg, as shares of its background picture's width and height (the spot its base rests
 *  on), and the background it was put on; another background shows the egg in its usual place. */
export interface SaucelingEggSpot {
  x: number;
  y: number;
  backgroundId: string | null;
}

export interface SaucelingPet {
  id: string;
  name: string;
  species: SaucelingSpeciesId;
  stage: SaucelingStage;
  lockedStage: SaucelingPostEggStage | null;
  temperament: SaucelingTemperamentId;
  temperamentVector: SaucelingTemperamentVector;
  lastTemperamentShiftAt: string;
  traits: string[];
  quirk: string;
  meters: SaucelingMeters;
  caretakerId: string;
  careProfile: SaucelingCareProfile;
  nudges: SaucelingNudge[];
  actionCooldowns: Partial<Record<SaucelingUserAction, string>>;
  careActionCount: number;
  createdAt: string;
  /** How long it has spent growing since it hatched; time spent too hungry does not count. */
  growthMs: number;
  hatchedAt: string | null;
  elderSinceAt: string | null;
  retireReady: boolean;
  /** The saved background it shows (see `SaucelingWorldDocument.backgrounds`), or null for its species' built-in one. */
  backgroundId: string | null;
  /** What its caretaker invented for it, or null for a built-in species. */
  design: SaucelingDesign | null;
  /** The id of the painted picture (a form document) for each stage it has one for. */
  forms: Partial<Record<SaucelingStage, string>>;
  /** The pictures the last repaint replaced, one set back; Undo repaint swaps them with `forms`. */
  savedForms: Partial<Record<SaucelingStage, string>>;
  /** It walks the other way: the stage reverses its facing, whatever its art; one switch for the whole sauceling. */
  flipped: boolean;
  /** Paintings started of each stage, or of its whole sheet, since one was last saved; painting by itself stops
   *  after two. */
  paintTries: Partial<Record<SaucelingPaintKey, number>>;
  /** The character who found it while chatting, or null when it came from Adopt. */
  foundBy: string | null;
  foundAt: string | null;
  /** Whoever found its egg; it never changes. */
  finder: SaucelingFinder;
  /** Its own temperament once written, when it is not pasta (see `isPasta`); null for pasta, and before it hatches. */
  ownTemperament: SaucelingOwnTemperament | null;
  /** When its caretaker took it on, or when it came back from the Menagerie. */
  caretakerSince: string;
  /** Where the player put the egg; null leaves it in the nest, or on the floor of a custom background. */
  eggSpot: SaucelingEggSpot | null;
  /** The caretaker's meal turns per UTC day, kept for 7 days; it starts over at hatching. */
  mealRecord: SaucelingMealDay[];
  evolution: SaucelingEvolveState;
  lastTickAt: string;
  rngState: number;
  journal: SaucelingEvent[];
}

/** A retired sauceling in the Menagerie, which can come back to the nook. */
export interface SaucelingMenagerieEntry {
  id: string;
  name: string;
  species: SaucelingSpeciesId;
  stageAtRetirement: SaucelingStage;
  reachedElder: boolean;
  lockedStage: SaucelingPostEggStage | null;
  temperament: SaucelingTemperamentId;
  temperamentVector: SaucelingTemperamentVector;
  traits: string[];
  quirk: string;
  meters: SaucelingMeters;
  caretakerId: string;
  careProfile: SaucelingCareProfile;
  createdAt: string;
  growthMs: number;
  hatchedAt: string | null;
  retiredAt: string;
  /** The custom Nook background it had, kept so it is still there when it comes back. */
  backgroundId: string | null;
  design: SaucelingDesign | null;
  forms: Partial<Record<SaucelingStage, string>>;
  savedForms: Partial<Record<SaucelingStage, string>>;
  flipped: boolean;
  paintTries: Partial<Record<SaucelingPaintKey, number>>;
  foundBy: string | null;
  foundAt: string | null;
  finder: SaucelingFinder;
  ownTemperament: SaucelingOwnTemperament | null;
  evolution: SaucelingEvolveState;
  farewellScene: string;
  journal: SaucelingEvent[];
}

/** The most characters of the player's own instructions a painting takes, on the client and the server alike. */
export const PAINT_INSTRUCTIONS_CHARS = 200;

/** A painting in the Album. The image is its own document, found by `id`; this is only its label. */
export interface SaucelingPortrait {
  id: string;
  petId: string;
  /** The name when it was painted, shown once the pet has been released. */
  petName: string;
  species: SaucelingSpeciesId;
  stage: SaucelingStage;
  savedAt: string;
  /** What the player asked the painting to show, if anything; shown as its caption. */
  instructions?: string;
}

/** The most backgrounds the library keeps; one must be deleted before another is saved. */
export const SAUCELING_BACKGROUND_LIMIT = 24;

/** The most paintings the Album keeps; one must be deleted before another is painted. */
export const SAUCELING_PORTRAIT_LIMIT = 24;

/** A saved Nook background any sauceling can show. The image is its own document, found by `id`. */
export interface SaucelingBackground {
  id: string;
  /** The uploaded file's name or the start of the prompt; empty for one saved before the library. */
  label: string;
  source: "upload" | "generated";
  savedAt: string;
}

export interface SaucelingSettings {
  careWindowHours: number;
  dailyGenerationBudget: number;
  portraitEnabled: boolean;
  connectionId: string | null;
  /** The user's image-generation connection, used for paintings, forms and Nook backgrounds. */
  portraitConnectionId: string | null;
  /** The caretaker may find an egg when they reply in a chat. */
  eggHunting: boolean;
  /** Every caretaker line is asked of the model, outside the daily limit, instead of coming from the phrasebook. */
  writeEveryLine: boolean;
  /** A caretaker's figure that does not read is asked for once more as just three drawings in one row, which a
   *  weaker image model can manage; it costs an extra image call. */
  threeDrawingFallback: boolean;
}

export interface SaucelingBudgetUsage {
  day: string;
  used: number;
}

export interface SaucelingWorldDocument {
  schemaVersion: 1;
  settings: SaucelingSettings;
  budget: SaucelingBudgetUsage;
  activePet: SaucelingPet | null;
  menagerie: SaucelingMenagerieEntry[];
  /** Newest first. */
  portraits: SaucelingPortrait[];
  /** Newest first, shared by every sauceling. */
  backgrounds: SaucelingBackground[];
  /** The day (see `currentDayKey`) a caretaker last found an egg while chatting; one a day at most. */
  lastEggFindDay: string | null;
  /** The day (see `currentDayKey`) the player last brought in a new egg; one a day at most. */
  lastNewEggDay: string | null;
  profileCache: Record<string, SaucelingCareProfile>;
  /** Each painted caretaker's pixel figure for the Nook, by character id: the id of its figure document. */
  caretakerFigures: Record<string, string>;
  /** The figure a caretaker's last repaint replaced, by character id; Undo repaint swaps it with their figure. */
  savedFigures: Record<string, string>;
  /** The ids of the caretakers the Nook shows facing the other way, whatever their art. */
  flippedCaretakers: string[];
  /** Paintings in progress, by "<pet id>:<paint key>"; never sent to the client, since it holds the tokens. */
  painting: Record<string, SaucelingPaintClaim>;
  /** What unlocks a special egg: care actions the player gave, and the UTC days they gave one on. */
  milestones: SaucelingMilestones;
  /** Special species whose milestone was met; never removed, so releasing an elder cannot lock one again. */
  unlocked: SaucelingSpecialSpeciesId[];
}

export interface SaucelingMilestones {
  careActions: number;
  careDays: number;
  /** The UTC day key (see `currentDayKey`) of the last care action, so each day counts once. */
  lastCareDay: string | null;
}

/** How near each special egg is: `have` of `need` (elders raised, care actions, days of care). */
export interface SaucelingUnlockProgress {
  done: boolean;
  have: number;
  need: number;
}

export type SaucelingUnlocks = Record<SaucelingSpecialSpeciesId, SaucelingUnlockProgress> & {
  /** October (UTC): Halloween eggs can be adopted. */
  halloween: boolean;
};

export interface SaucelingCharacterSummary {
  id: string;
  name: string;
  description: string;
  /** The writing connection has made their own voice from their card (POST /voice). */
  hasVoice: boolean;
}

/** The world as GET /state sends it; the Menagerie, the Album and the backgrounds have their own routes so polls
 *  stay small. */
export type SaucelingWorldView = Omit<
  SaucelingWorldDocument,
  "menagerie" | "portraits" | "backgrounds" | "profileCache" | "painting"
>;

export interface SaucelingStateResponse {
  world: SaucelingWorldView;
  menagerieCount: number;
  portraitCount: number;
  unlocks: SaucelingUnlocks;
  characters: SaucelingCharacterSummary[];
  gaps: {
    hunger: boolean;
    mood: boolean;
    warmth: boolean;
    missedMealsRecent: number;
    /** Meals the caretaker gave of those they were due to give over the last 7 days (an egg: times kept warm). */
    meals: { given: number; total: number };
  };
  latestRemark: string;
  /** Journal event ids whose model lines are still being written; they show their template text until then. */
  writing: string[];
}

export interface SaucelingMenagerieResponse {
  menagerie: SaucelingMenagerieEntry[];
}

/** Where the painted pet is now: in the nook, in the Menagerie, or released for good. */
export type SaucelingPortraitHome = "nook" | "menagerie" | "released";

export interface SaucelingPortraitsResponse {
  portraits: Array<SaucelingPortrait & { home: SaucelingPortraitHome }>;
}

export interface SaucelingBackgroundsResponse {
  backgrounds: SaucelingBackground[];
}

/** One form's pictures, PNG data URLs of the same width: `image` is the front (content) strip, whose first frame
 *  is the plain picture; `side` is the walking view, and `happy` and `grumpy` replace `image` in those moods. */
export interface SaucelingFormStrips {
  image: string;
  side?: string;
  happy?: string;
  grumpy?: string;
}

/** GET /form/:id: the strips and how many frames each has (1 for a form painted before strips, else 3). */
export type SaucelingFormResponse = SaucelingFormStrips & { frames: 1 | 3 };

export type SaucelingLocalizationContext = {
  locale?: string;
  direction?: "ltr" | "rtl";
};

export type CapabilityProps = {
  packageId?: string;
  packageVersion?: string | null;
  localization?: SaucelingLocalizationContext;
  widgetId?: string;
  widgetLabel?: string;
  widgetDescription?: string;
  widgetAccent?: string;
  active?: boolean;
  focusPostId?: string | null;
  onFocusPostHandled?: () => void;
  onOpenNoodle?: () => void;
  onOpenPost?: (id: string) => void;
};

export type CapabilityElement = HTMLElement & {
  capabilityProps?: CapabilityProps;
  capabilityRuntimeError?: string | null;
  __root?: Root | null;
};
