// ──────────────────────────────────────────────
// Otome Forge: the setup wizard's draft, kept on this device in `otome-forge:setup-draft:v1` until the world is made
// ──────────────────────────────────────────────
// Browser storage may be missing, full or throw (private windows, blocked site data), so every access is guarded: the
// wizard still works, the draft just isn't kept. A stored draft is read field by field, so a damaged or older one
// keeps what it can. Nothing here is trusted by the server, which checks every limit again.
import {
  enforceContent,
  normalizeContent,
  normalizeImageRating,
  type ContentSettings,
  type ImageRating,
} from "../../shared/content";
import type { Pronouns, SetupInput } from "../../shared/api-types";
import { ARCHETYPE_IDS, type ArchetypeId } from "../../shared/archetypes";

export const SETUP_DRAFT_KEY = "otome-forge:setup-draft:v1";

export const PREMISE_MAX = 2000;
export const TITLE_MAX = 120;
export const TRAITS_MAX = 5;
export const TRAIT_MAX = 40;
export const GOAL_MAX = 300;
export const NOTES_MAX = 500;
export const LI_NAME_MAX = 60;
export const PRONOUN_MAX = 40;
export const LANGUAGE_MAX = 60;
/** Offered beside the language field; the value goes into prompts as written, so the names stay in English. */
export const LANGUAGE_SUGGESTIONS = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Polish",
  "Russian",
  "Ukrainian",
  "Japanese",
  "Korean",
  "Chinese",
  "Vietnamese",
  "Thai",
  "Indonesian",
  "Turkish",
  "Dutch",
  "Swedish",
  "Arabic",
  "Hebrew",
] as const;
export const LIS_MIN = 2;
export const LIS_MAX = 5;
/** Expressions are painted for love interests only in this release: five faces per look. */
export const FACES_PER_LOOK = 5;

export const SETUP_STEPS = ["premise", "protagonist", "cast", "content", "connections", "review"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export const PRONOUN_PRESETS = {
  she: { subject: "she", object: "her", possessive: "her" },
  he: { subject: "he", object: "him", possessive: "his" },
  they: { subject: "they", object: "them", possessive: "their" },
} as const satisfies Record<string, Pronouns>;
export type PronounPreset = keyof typeof PRONOUN_PRESETS;

/** Pronouns are always chosen, never assumed: `preset` is null until the player picks. */
export interface PronounChoice {
  preset: PronounPreset | "custom" | null;
  custom: Pronouns;
}

export interface DraftLi {
  /** Local key for React lists; never sent. */
  key: string;
  source: "card" | "archetype";
  cardId: string;
  archetype: ArchetypeId | "";
  /** The card's name (shown only), or the name the player gives an archetype. */
  name: string;
  avatarUrl: string | null;
  notes: string;
  pronouns: PronounChoice;
}

export interface DraftImages {
  connectionId: string | null;
  rating: ImageRating;
  ask: boolean;
  expressions: boolean;
}

/** "" means "the same as the story connection" for every job but narration. */
export interface DraftConnections {
  narration: string;
  structured: string;
  chat: string;
  compress: string;
}

export interface SetupDraft {
  version: 1;
  step: SetupStep;
  /** The furthest step the player has opened; the stepper marks only steps up to it as done. */
  reached: SetupStep;
  title: string;
  premise: string;
  language: string;
  protagonist: { personaId: string; name: string; pronouns: PronounChoice; traits: string[]; goal: string };
  lis: DraftLi[];
  content: ContentSettings;
  images: DraftImages;
  connections: DraftConnections;
}

const emptyPronouns = (): PronounChoice => ({ preset: null, custom: { subject: "", object: "", possessive: "" } });

export function emptyDraft(): SetupDraft {
  return {
    version: 1,
    step: "premise",
    reached: "premise",
    title: "",
    premise: "",
    language: "English",
    protagonist: { personaId: "", name: "", pronouns: emptyPronouns(), traits: [], goal: "" },
    lis: [],
    content: normalizeContent(undefined),
    images: { connectionId: null, rating: normalizeImageRating(undefined), ask: false, expressions: true },
    connections: { narration: "", structured: "", chat: "", compress: "" },
  };
}

export function newLiKey(): string {
  return `li-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Reading a stored draft ──

type Row = Record<string, unknown>;
const isRecord = (value: unknown): value is Row => !!value && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown, max: number, fallback = "") =>
  typeof value === "string" ? value.slice(0, max) : fallback;
const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
const oneOf = <T extends string>(values: readonly T[], value: unknown, fallback: T): T =>
  typeof value === "string" && (values as readonly string[]).includes(value) ? (value as T) : fallback;

function readPronouns(value: unknown): PronounChoice {
  const row = isRecord(value) ? value : {};
  const custom = isRecord(row.custom) ? row.custom : {};
  const preset = row.preset;
  return {
    preset: preset === "she" || preset === "he" || preset === "they" || preset === "custom" ? preset : null,
    custom: {
      subject: str(custom.subject, PRONOUN_MAX),
      object: str(custom.object, PRONOUN_MAX),
      possessive: str(custom.possessive, PRONOUN_MAX),
    },
  };
}

function readLi(value: unknown): DraftLi[] {
  if (!isRecord(value)) return [];
  const source = value.source === "card" ? "card" : value.source === "archetype" ? "archetype" : null;
  if (!source) return [];
  const li: DraftLi = {
    key: str(value.key, 80) || newLiKey(),
    source,
    cardId: str(value.cardId, 200),
    archetype: oneOf<ArchetypeId | "">(ARCHETYPE_IDS, value.archetype, ""),
    name: str(value.name, LI_NAME_MAX),
    avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl : null,
    notes: str(value.notes, NOTES_MAX),
    pronouns: readPronouns(value.pronouns),
  };
  if (source === "card" ? !li.cardId : !li.archetype) return [];
  return [li];
}

/** A stored draft in its full shape: each damaged field takes its default. */
export function readDraft(value: unknown): SetupDraft {
  const draft = emptyDraft();
  if (!isRecord(value) || value.version !== 1) return draft;
  const protagonist = isRecord(value.protagonist) ? value.protagonist : {};
  const images = isRecord(value.images) ? value.images : {};
  const connections = isRecord(value.connections) ? value.connections : {};
  const step = oneOf(SETUP_STEPS, value.step, draft.step);
  return {
    version: 1,
    step,
    reached:
      SETUP_STEPS[Math.max(SETUP_STEPS.indexOf(step), SETUP_STEPS.indexOf(oneOf(SETUP_STEPS, value.reached, step)))]!,
    title: str(value.title, TITLE_MAX),
    premise: str(value.premise, PREMISE_MAX),
    language: str(value.language, LANGUAGE_MAX, draft.language),
    protagonist: {
      personaId: str(protagonist.personaId, 200),
      name: str(protagonist.name, 200),
      pronouns: readPronouns(protagonist.pronouns),
      traits: (Array.isArray(protagonist.traits) ? protagonist.traits : [])
        .filter((trait): trait is string => typeof trait === "string" && !!trait.trim())
        .map((trait) => trait.slice(0, TRAIT_MAX))
        .slice(0, TRAITS_MAX),
      goal: str(protagonist.goal, GOAL_MAX),
    },
    lis: (Array.isArray(value.lis) ? value.lis : []).flatMap(readLi).slice(0, LIS_MAX),
    content: normalizeContent(value.content),
    images: {
      connectionId: typeof images.connectionId === "string" && images.connectionId ? images.connectionId : null,
      rating: normalizeImageRating(images.rating),
      ask: bool(images.ask, draft.images.ask),
      expressions: bool(images.expressions, draft.images.expressions),
    },
    connections: {
      narration: str(connections.narration, 200),
      structured: str(connections.structured, 200),
      chat: str(connections.chat, 200),
      compress: str(connections.compress, 200),
    },
  };
}

export function loadDraft(): SetupDraft | null {
  try {
    const stored = window.localStorage.getItem(SETUP_DRAFT_KEY);
    return stored ? readDraft(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: SetupDraft) {
  try {
    window.localStorage.setItem(SETUP_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Not kept; the wizard still works until the tab closes.
  }
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(SETUP_DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * True for a draft the player has not touched: nothing set but the step and the Engine's default story connection.
 * The wizard keeps none of these, so opening it and leaving leaves no draft behind.
 */
export function isBlankDraft(draft: SetupDraft): boolean {
  const blank = emptyDraft();
  const comparable = (value: SetupDraft) =>
    JSON.stringify({
      ...value,
      step: blank.step,
      reached: blank.reached,
      connections: { ...value.connections, narration: "" },
    });
  return comparable(draft) === comparable(blank);
}

export function hasDraft(): boolean {
  try {
    return window.localStorage.getItem(SETUP_DRAFT_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * The draft without the persona or card love interests the Engine no longer has (deleted since the draft was kept), so
 * their steps ask again. A list that is null (loading, failed, or cut off) changes nothing; nothing missing returns the
 * same draft.
 */
export function dropMissingPicks(
  draft: SetupDraft,
  personas: readonly { id: string }[] | null,
  cards: readonly { id: string }[] | null,
): SetupDraft {
  const { personaId } = draft.protagonist;
  const personaGone = !!personas && !!personaId && !personas.some((persona) => persona.id === personaId);
  const lis = cards
    ? draft.lis.filter((li) => li.source !== "card" || cards.some((card) => card.id === li.cardId))
    : draft.lis;
  if (!personaGone && lis.length === draft.lis.length) return draft;
  return {
    ...draft,
    protagonist: personaGone ? { ...draft.protagonist, personaId: "", name: "" } : draft.protagonist,
    lis,
  };
}

// ── Checks and the request ──

/** The chosen pronouns, or null while none are chosen or a custom set is incomplete. */
export function resolvePronouns(choice: PronounChoice): Pronouns | null {
  if (!choice.preset) return null;
  if (choice.preset !== "custom") return { ...PRONOUN_PRESETS[choice.preset] };
  const custom = {
    subject: choice.custom.subject.trim(),
    object: choice.custom.object.trim(),
    possessive: choice.custom.possessive.trim(),
  };
  return custom.subject && custom.object && custom.possessive ? custom : null;
}

/** What still blocks a step, as one catalog key, or null when the step is complete. */
export function stepProblem(draft: SetupDraft, step: SetupStep, textConnections: number): string | null {
  switch (step) {
    case "premise":
      if (!draft.premise.trim()) return "ui.otomeForge.setup.needPremise";
      if (!draft.language.trim()) return "ui.otomeForge.setup.needLanguage";
      return null;
    case "protagonist":
      if (!draft.protagonist.personaId) return "ui.otomeForge.setup.needPersona";
      if (!resolvePronouns(draft.protagonist.pronouns)) return "ui.otomeForge.setup.needPronouns";
      return null;
    case "cast":
      if (draft.lis.length < LIS_MIN) return "ui.otomeForge.setup.needCast";
      if (draft.lis.some((li) => li.source === "archetype" && !li.name.trim())) return "ui.otomeForge.setup.needLiName";
      if (draft.lis.some((li) => !resolvePronouns(li.pronouns))) return "ui.otomeForge.setup.needLiPronouns";
      return null;
    case "content":
      return null;
    case "connections":
      if (textConnections === 0) return "ui.otomeForge.setup.needTextConnection";
      if (!draft.connections.narration) return "ui.otomeForge.setup.needNarration";
      return null;
    case "review":
      for (const earlier of SETUP_STEPS) {
        if (earlier === "review") return null;
        const problem = stepProblem(draft, earlier, textConnections);
        if (problem) return problem;
      }
      return null;
  }
}

/**
 * The POST /runs body. Call only once stepProblem(draft, "review") is null. Content and the image rating are sent as
 * chosen (custom limits trimmed, fixed limits as Lines), never quietly lowered: without the 18+ gate the server refuses
 * gated settings (403 `age-gate`) and the wizard says so, so the world made is the one the Review step showed.
 */
export function toSetupInput(draft: SetupDraft): SetupInput {
  const pronouns = (choice: PronounChoice) => resolvePronouns(choice) ?? { ...PRONOUN_PRESETS.they };
  const optional = (id: string) => (id && id !== draft.connections.narration ? id : undefined);
  return {
    ...(draft.title.trim() ? { title: draft.title.trim() } : {}),
    premise: draft.premise.trim(),
    language: draft.language.trim(),
    protagonist: {
      personaId: draft.protagonist.personaId,
      pronouns: pronouns(draft.protagonist.pronouns),
      traits: draft.protagonist.traits.map((trait) => trait.trim()).filter(Boolean),
      goal: draft.protagonist.goal.trim(),
    },
    lis: draft.lis.map((li) =>
      li.source === "card"
        ? { source: "card", cardId: li.cardId, pronouns: pronouns(li.pronouns) }
        : {
            source: "archetype",
            archetype: li.archetype,
            name: li.name.trim(),
            pronouns: pronouns(li.pronouns),
            ...(li.notes.trim() ? { notes: li.notes.trim() } : {}),
          },
    ),
    content: enforceContent(draft.content, true),
    images: { ...draft.images },
    connections: {
      narration: draft.connections.narration,
      ...(optional(draft.connections.structured) ? { structured: draft.connections.structured } : {}),
      ...(optional(draft.connections.chat) ? { chat: draft.connections.chat } : {}),
      ...(optional(draft.connections.compress) ? { compress: draft.connections.compress } : {}),
    },
  };
}
