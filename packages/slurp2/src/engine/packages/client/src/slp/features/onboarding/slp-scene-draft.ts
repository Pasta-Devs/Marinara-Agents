/**
 * The live page draft of the role-play sign-up: patches, locks and undo.
 *
 * Every exchange may propose a patch. A patch never touches a field the player locked (editing a
 * field by hand locks it), every applied patch becomes a chip, and undoing a chip puts back only
 * the fields that still hold that chip's values, so a later patch or edit is never thrown away.
 *
 * Pure, so the rules run in tests.
 */
import { slpSpiceChips } from "../../../../../shared/src/slp/slp-spice.js";
import {
  SLP_SCENE_ACTIONS,
  SLP_SCENE_FIELDS,
  SLP_SCENE_MOMENTS,
  SLP_SCENE_TRANSCRIPT_MAX,
  type SlpSceneActionId,
  type SlpSceneMoment,
  type SlpScenePreset,
  type SlpSceneLine,
  type SlpSceneDraft,
  type SlpSceneField,
  type SlpScenePatch,
} from "../../../../../shared/src/slp/slp-scene.js";
import type { SlpIdentityDisclosure } from "../../../../../shared/src/slp/slp-social.types.js";

export type SlpSceneChip = {
  id: string;
  fields: SlpSceneField[];
  before: SlpScenePatch;
  after: SlpScenePatch;
  undone: boolean;
};

export type SlpSceneDraftState = {
  draft: SlpSceneDraft;
  locked: SlpSceneField[];
  chips: SlpSceneChip[];
};

export const SLP_SCENE_EMPTY_DRAFT: SlpSceneDraft = {
  displayName: "",
  handle: "",
  bio: "",
  stagePersonality: "",
  appearance: "",
  wardrobe: "",
  locations: "",
  turnOns: "",
  hardNoes: "",
  gender: null,
  tags: [],
  spice: null,
};

/** A page needs these before it can be saved; the create route refuses it otherwise. */
export const SLP_SCENE_MIN_TAGS = 3;

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export function slpSceneInitialState(seed: SlpScenePatch = {}, locked: SlpSceneField[] = []): SlpSceneDraftState {
  return { draft: { ...SLP_SCENE_EMPTY_DRAFT, ...seed }, locked: [...new Set(locked)], chips: [] };
}

/** Apply a patch to the unlocked fields that it really changes. No change, no chip. */
export function applySlpScenePatch(
  state: SlpSceneDraftState,
  patch: SlpScenePatch,
  id: string,
): { state: SlpSceneDraftState; chip: SlpSceneChip | null } {
  const before: SlpScenePatch = {};
  const after: SlpScenePatch = {};
  const fields: SlpSceneField[] = [];
  for (const field of SLP_SCENE_FIELDS) {
    if (!(field in patch) || state.locked.includes(field)) continue;
    const value = patch[field];
    if (value === undefined || same(state.draft[field], value)) continue;
    fields.push(field);
    Object.assign(before, { [field]: state.draft[field] });
    Object.assign(after, { [field]: value });
  }
  if (!fields.length) return { state, chip: null };
  const chip: SlpSceneChip = { id, fields, before, after, undone: false };
  return {
    state: { ...state, draft: { ...state.draft, ...after }, chips: [...state.chips, chip] },
    chip,
  };
}

/** Put back what one chip changed, field by field, only where nothing changed it since. */
export function undoSlpSceneChip(state: SlpSceneDraftState, chipId: string): SlpSceneDraftState {
  const chip = state.chips.find((entry) => entry.id === chipId);
  if (!chip || chip.undone) return state;
  const restore: SlpScenePatch = {};
  for (const field of chip.fields) {
    // A newer live chip owns the field now, even when it set the same value again.
    const newest = [...state.chips].reverse().find((entry) => !entry.undone && entry.fields.includes(field));
    if (newest?.id !== chip.id) continue;
    if (state.locked.includes(field) || !same(state.draft[field], chip.after[field])) continue;
    Object.assign(restore, { [field]: chip.before[field] });
  }
  return {
    ...state,
    draft: { ...state.draft, ...restore },
    chips: state.chips.map((entry) => (entry.id === chipId ? { ...entry, undone: true } : entry)),
  };
}

/** A hand edit wins: it sets the value and locks the field against later patches. */
export function editSlpSceneField<F extends SlpSceneField>(
  state: SlpSceneDraftState,
  field: F,
  value: SlpSceneDraft[F],
): SlpSceneDraftState {
  return {
    ...state,
    draft: { ...state.draft, [field]: value },
    locked: state.locked.includes(field) ? state.locked : [...state.locked, field],
  };
}

export function toggleSlpSceneLock(state: SlpSceneDraftState, field: SlpSceneField): SlpSceneDraftState {
  return {
    ...state,
    locked: state.locked.includes(field) ? state.locked.filter((entry) => entry !== field) : [...state.locked, field],
  };
}

/** What the page still needs before it can be registered. Empty = ready. */
export function slpSceneMissing(draft: SlpSceneDraft): ("displayName" | "handle" | "gender" | "tags")[] {
  const missing: ("displayName" | "handle" | "gender" | "tags")[] = [];
  if (!draft.displayName.trim()) missing.push("displayName");
  if (!draft.handle.trim()) missing.push("handle");
  if (!draft.gender) missing.push("gender");
  if (draft.tags.length < SLP_SCENE_MIN_TAGS) missing.push("tags");
  return missing;
}

/** The page parts the player sees ticking off, in the order the chat usually reaches them. */
export const SLP_SCENE_PROGRESS = ["name", "look", "bio", "voice", "tags", "limits"] as const;
export type SlpSceneProgressPart = (typeof SLP_SCENE_PROGRESS)[number];

/**
 * How far the page is, in the player's words: which parts are done, and whether the page has
 * what it needs to go live (the same rule Finish checks).
 */
export function slpSceneProgress(draft: SlpSceneDraft, hasPhoto = false) {
  const done: Record<SlpSceneProgressPart, boolean> = {
    name: Boolean(draft.displayName.trim() && draft.handle.trim()),
    look: hasPhoto || Boolean(draft.appearance.trim()),
    bio: Boolean(draft.bio.trim()),
    voice: Boolean(draft.stagePersonality.trim()),
    tags: Boolean(draft.gender) && draft.tags.length >= SLP_SCENE_MIN_TAGS,
    limits: Boolean(draft.spice || draft.turnOns.trim() || draft.hardNoes.trim()),
  };
  const parts = SLP_SCENE_PROGRESS.map((id) => ({ id, done: done[id] }));
  return {
    parts,
    done: parts.filter((part) => part.done).length,
    total: parts.length,
    ready: slpSceneMissing(draft).length === 0,
  };
}

/**
 * The one field a change note names with the value the patch set ("Name set: Velvet Moth"), or null
 * when the note just lists the fields. The name wins; otherwise only a lone short value is quoted.
 */
export function slpScenePatchHeadline(
  fields: readonly SlpSceneField[],
  values: SlpScenePatch,
): { field: SlpSceneField; value: string } | null {
  const text = (field: SlpSceneField) => {
    const value = values[field];
    return typeof value === "string" ? value.trim() : "";
  };
  if (fields.includes("displayName") && text("displayName"))
    return { field: "displayName", value: text("displayName") };
  const field = fields.length === 1 ? fields[0] : undefined;
  if (!field || field === "gender" || field === "spice") return null;
  const value = text(field);
  return value && value.length <= 40 ? { field, value } : null;
}

/**
 * The chapters the player sees on the way to a live page. Each moment works on one of them; the
 * last one ("live") is the finale: the page goes up and the first post follows.
 */
export const SLP_SCENE_CHAPTERS = ["name", "photo", "bio", "limits", "live"] as const;
export type SlpSceneChapter = (typeof SLP_SCENE_CHAPTERS)[number];

/** Which chapter each moment works on. */
export const SLP_SCENE_MOMENT_CHAPTER: Record<SlpSceneMoment, SlpSceneChapter> = {
  arrival: "name",
  name: "name",
  about: "bio",
  look: "photo",
  voice: "bio",
  shoot: "photo",
  bio: "bio",
  limits: "limits",
  review: "live",
  firstPost: "live",
};

/**
 * The chapters and which are done. The friend and the seat shoot a real photo; Support takes the
 * look for the profile photo instead. "live" is done once the page is registered.
 */
export function slpSceneChapters(
  preset: SlpScenePreset,
  draft: SlpSceneDraft,
  { photo = false, live = false }: { photo?: boolean; live?: boolean } = {},
) {
  const done: Record<SlpSceneChapter, boolean> = {
    name: Boolean(draft.displayName.trim() && draft.handle.trim()),
    photo: preset === "support" ? photo || Boolean(draft.appearance.trim()) : photo,
    bio: Boolean(draft.bio.trim()),
    limits: Boolean(draft.spice || draft.turnOns.trim() || draft.hardNoes.trim()),
    live,
  };
  const chapters = SLP_SCENE_CHAPTERS.map((id) => ({ id, done: done[id] }));
  return { chapters, done: chapters.filter((chapter) => chapter.done).length, total: chapters.length };
}

/**
 * Whether a moment already has what it needs from the page itself, whatever the model said. The
 * two closing moments only end when the model says so (they fill nothing of their own).
 */
export function slpSceneMomentFilled(moment: SlpSceneMoment, draft: SlpSceneDraft, photo = false): boolean {
  switch (moment) {
    case "arrival":
      return Boolean(draft.gender) && draft.tags.length >= SLP_SCENE_MIN_TAGS;
    case "name":
      return Boolean(draft.displayName.trim() && draft.handle.trim());
    case "about":
    case "bio":
      return Boolean(draft.bio.trim());
    case "look":
      return Boolean(draft.appearance.trim());
    case "voice":
      return Boolean(draft.stagePersonality.trim());
    case "shoot":
      return photo;
    case "limits":
      return Boolean(draft.spice || draft.turnOns.trim() || draft.hardNoes.trim());
    default:
      return false;
  }
}

/**
 * Where the scene goes after an exchange: the next moment that still needs something, once this
 * one is done (the model said so, or the page already has it). The photo shoot waits for the
 * photos, whatever the chat says. Null = stay.
 */
export function slpSceneNextMoment(
  preset: SlpScenePreset,
  moment: SlpSceneMoment,
  { modelDone, draft, photo = false }: { modelDone: boolean; draft: SlpSceneDraft; photo?: boolean },
): SlpSceneMoment | null {
  const moments = SLP_SCENE_MOMENTS[preset] as readonly SlpSceneMoment[];
  const done = moment === "shoot" ? photo : modelDone || slpSceneMomentFilled(moment, draft, photo);
  if (!done) return null;
  const rest = moments.slice(moments.indexOf(moment) + 1);
  return rest.find((entry) => !slpSceneMomentFilled(entry, draft, photo)) ?? null;
}

/** The suggestion that moves each moment on; it goes first and is the highlighted one. */
const SLP_SCENE_MOMENT_LEAD: Record<SlpSceneMoment, readonly SlpSceneActionId[]> = {
  arrival: ["hypeUp"],
  name: ["askName", "suggestName", "bolder"],
  about: ["askAbout"],
  look: ["askLook"],
  voice: ["askVoice"],
  shoot: ["askOutfit"],
  bio: ["helpBio"],
  limits: ["askLimits"],
  review: ["stamp"],
  firstPost: ["pickFirstPost"],
};
/** Replies that fit any moment: they follow the lead, before the other moments' questions. */
const SLP_SCENE_ANY_MOMENT: readonly SlpSceneActionId[] = ["joke", "hypeUp", "tease", "lookTogether", "bolder"];

/** The preset's suggestions for this moment: the lead, then the any-moment ones, then the rest. */
export function slpSceneSuggestions(preset: SlpScenePreset, moment: SlpSceneMoment): SlpSceneActionId[] {
  const all = SLP_SCENE_ACTIONS[preset] as readonly SlpSceneActionId[];
  const lead = all.find((id) => SLP_SCENE_MOMENT_LEAD[moment].includes(id));
  const rest = all.filter((id) => id !== lead);
  return [
    ...(lead ? [lead] : []),
    ...rest.filter((id) => SLP_SCENE_ANY_MOMENT.includes(id)),
    ...rest.filter((id) => !SLP_SCENE_ANY_MOMENT.includes(id)),
  ];
}

/** The stage profile the create route takes. The limits go to the strategy, not the page. */
export function slpSceneStageProfile(draft: SlpSceneDraft, disclosureMode: SlpIdentityDisclosure) {
  return {
    displayName: draft.displayName.trim(),
    handle: draft.handle.trim().replace(/^@+/u, ""),
    bio: draft.bio.trim(),
    stagePersonality: draft.stagePersonality.trim(),
    appearance: draft.appearance.trim(),
    wardrobe: draft.wardrobe.trim(),
    locations: draft.locations.trim(),
    // The sign-up scene does not ask; the profile editor sets it later.
    clothingStyle: "auto" as const,
    disclosureMode,
    gender: draft.gender,
    tags: draft.tags,
  };
}

/**
 * The limits moment as the strategy lines sign-ups wrote before 7b, or "" when nothing was said.
 * Kept as the one statement of that old format: the server moves such lines into the Creator's
 * spice (`slpSpiceFromStrategyText`). New sign-ups write `slpSceneSpicePatch` instead.
 */
export function slpSceneLimitsText(draft: SlpSceneDraft): string {
  return [
    draft.spice ? `How far the page goes: ${draft.spice}.` : "",
    draft.turnOns.trim() ? `Happy to show: ${draft.turnOns.trim()}` : "",
    draft.hardNoes.trim() ? `Hard noes: ${draft.hardNoes.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The limits moment as the Creator's spice (level, turn-ons, hard noes), or null when nothing was said. */
export function slpSceneSpicePatch(
  draft: SlpSceneDraft,
): { spiceLevel?: NonNullable<SlpSceneDraft["spice"]>; turnOns?: string[]; hardNoes?: string[] } | null {
  const patch = {
    ...(draft.spice ? { spiceLevel: draft.spice } : {}),
    ...(draft.turnOns.trim() ? { turnOns: slpSpiceChips(draft.turnOns) } : {}),
    ...(draft.hardNoes.trim() ? { hardNoes: slpSpiceChips(draft.hardNoes) } : {}),
  };
  return Object.keys(patch).length ? patch : null;
}

/** A full redraft (the "Update page" button) as a patch: only the fields a stage draft carries. */
export function slpSceneRedraftPatch(result: {
  displayName?: string;
  handle?: string;
  bio?: string;
  stagePersonality?: string;
  appearance?: string;
  wardrobe?: string;
  locations?: string;
  gender?: "male" | "female" | "other" | null;
  tags?: string[];
}): SlpScenePatch {
  const patch: SlpScenePatch = {};
  for (const field of [
    "displayName",
    "handle",
    "bio",
    "stagePersonality",
    "appearance",
    "wardrobe",
    "locations",
  ] as const) {
    const value = result[field];
    if (typeof value === "string" && value.trim()) patch[field] = value.trim();
  }
  if (result.gender) patch.gender = result.gender;
  if (result.tags?.length) patch.tags = result.tags;
  return patch;
}

export type SlpSceneItem =
  | { id: string; kind: "line"; speaker: SlpSceneLine["speaker"]; text: string }
  | { id: string; kind: "patch"; chipId: string; fields: SlpSceneField[]; redraft: boolean }
  | { id: string; kind: "note"; text: string }
  /** The player's steer in the creator seat: shown to the player, never sent back as a line. */
  | { id: string; kind: "whisper"; text: string }
  | { id: string; kind: "photo"; photo: "avatar" | "banner"; imageUrl: string }
  /** A chapter just got done: a small celebration in the chat, and what comes next. */
  | { id: string; kind: "chapter"; chapters: SlpSceneChapter[]; next: SlpSceneChapter | null };

/** What the transcript sends back: the lines only, newest last, capped. */
export function slpSceneTranscript(items: readonly SlpSceneItem[], max = SLP_SCENE_TRANSCRIPT_MAX): SlpSceneLine[] {
  return items
    .flatMap((item) => (item.kind === "line" ? [{ speaker: item.speaker, text: item.text }] : []))
    .slice(-max);
}

/** The chat as guidance for a full redraft: newest lines first win the 2000 characters. */
export function slpSceneGuidance(items: readonly SlpSceneItem[], hostLabel: string, direction: string): string {
  const lines = slpSceneTranscript(items).map(
    (line) => `${line.speaker === "host" ? hostLabel : "Newcomer"}: ${line.text}`,
  );
  const head = [
    "Build the page from what the newcomer said in this sign-up chat. Keep their words and taste.",
    direction ? `Direction: ${direction}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const kept: string[] = [];
  let length = head.length;
  for (const line of lines.reverse()) {
    if (length + line.length + 1 > 1990) break;
    kept.unshift(line);
    length += line.length + 1;
  }
  return [head, ...kept].join("\n");
}

/** What the image pipeline is asked for at the first photo shoot. */
export function slpSceneShootGuidance(kind: "avatar" | "banner", outfit: string, place: string): string {
  return [
    kind === "avatar"
      ? "The first profile photo from their first photo shoot."
      : "The cover photo from the same first photo shoot, a wide shot of the place.",
    outfit.trim() ? `Outfit: ${outfit.trim().slice(0, 400)}.` : "",
    place.trim() ? `Place: ${place.trim().slice(0, 400)}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
