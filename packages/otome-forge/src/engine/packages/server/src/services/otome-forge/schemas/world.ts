// ──────────────────────────────────────────────
// Otome Forge: the `${R}:world` document (premise, mystery, web, content, images, connections, forge steps)
// ──────────────────────────────────────────────
// The mystery's truth and pieces and the web's secrets are the hidden story: toWorldView strips them before anything
// reaches the client. `audio` and `places` (M2b) are read here so every normalized write keeps them; S/art and
// S/audio write them.
import { normalizeOtomeAudio } from "../../../../../client/src/features/otome-forge/shared/audio.js";
import { z, type ZodType } from "zod";
import type {
  Connections,
  ForgeStatus,
  ForgeStep,
  ImageSettings,
  PlaceArt,
  SoundtrackTrack,
  WebRow,
  World,
  WorldAudio,
  WorldView,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  CUSTOM_LIMIT_TEXT_MAX,
  CUSTOM_LIMITS_MAX,
  DARKNESSES,
  DEFAULT_IMAGE_RATING,
  HEATS,
  IMAGE_STYLE_MAX,
  LIMIT_IDS,
  LIMIT_LEVELS,
  MC_ROLES,
  defaultContent,
  normalizeContent,
  normalizeImageRating,
  type ContentSettings,
  type LimitId,
} from "../../../../../client/src/features/otome-forge/shared/content.js";
import { PaintSchema, field, isRecord, readFields, text, validItems } from "./common.js";

export const DEFAULT_LANGUAGE = "English";
export const LANGUAGE_MAX = 60;
const CONNECTION_ID_MAX = 200;

// ── Request input (POST /runs, POST /runs/:run/settings): strict, a bad value is a 400 ──

const LimitLevelSchema = z.enum(LIMIT_LEVELS);
const limitsShape = {} as Record<LimitId, typeof LimitLevelSchema>;
for (const id of LIMIT_IDS) limitsShape[id] = LimitLevelSchema;

/** Content settings as the client sends them: every limit named. The routes then apply enforceContent. */
export const ContentSchema: ZodType<ContentSettings> = z.object({
  heat: z.enum(HEATS),
  darkness: z.enum(DARKNESSES),
  limits: z.object(limitsShape),
  custom: z
    .array(z.object({ text: z.string().max(CUSTOM_LIMIT_TEXT_MAX), level: z.enum(["veil", "line"]) }))
    .max(CUSTOM_LIMITS_MAX),
  mcRole: z.enum(MC_ROLES).optional(),
});

/** The world's connections: narration is required; an empty job falls back to narration (normalizeConnections). */
export const ConnectionsSchema: ZodType<Connections> = z.object({
  narration: z.string().min(1).max(CONNECTION_ID_MAX),
  structured: z.string().max(CONNECTION_ID_MAX).optional(),
  chat: z.string().max(CONNECTION_ID_MAX).optional(),
  compress: z.string().max(CONNECTION_ID_MAX).optional(),
});

export const WebRowSchema: ZodType<WebRow> = z.object({
  a: z.string(),
  b: z.string(),
  history: text(),
  stance: z.enum(["allies", "uneasy", "rivals", "enemies"]),
  debt: text(),
  secret: text().optional(),
});

const MysterySchema: ZodType<World["mystery"]> = z.object({
  question: text(),
  truth: text(),
  pieces: z.record(z.string(), z.object({ piece: text(), reasonToHide: text() })),
});

const ForgeStepSchema: ZodType<ForgeStep> = z.object({
  id: z.string().min(1).max(80),
  state: z.enum(["pending", "running", "done", "failed", "waiting-consent"]),
  error: z.string().optional(),
  paid: z.boolean().optional(),
});

export function normalizeForge(data: unknown): ForgeStatus {
  return {
    phase: field(data, "phase") === "ready" ? "ready" : "forging",
    steps: validItems(ForgeStepSchema, field(data, "steps")),
  };
}

export function normalizeImages(data: unknown): ImageSettings {
  return readFields<ImageSettings>(
    {
      connectionId: z.string().nullable(),
      rating: normalizeImageRating,
      ask: z.boolean(),
      expressions: z.boolean(),
      expressionsSince: z.string().optional(),
      styleProfileId: z.string().optional(),
      style: z.string().max(IMAGE_STYLE_MAX).optional(),
    },
    () => ({ connectionId: null, rating: DEFAULT_IMAGE_RATING, ask: false, expressions: true }),
    data,
  );
}

export function normalizeConnections(data: unknown): Connections {
  const connections: Connections = { narration: "" };
  for (const job of ["narration", "structured", "chat", "compress"] as const) {
    const value = field(data, job);
    if (typeof value === "string" && value) connections[job] = value;
  }
  return connections;
}

const BRIEFS_MAX = 40;
/** The world keeps at most this many generated tracks (the newest) and places (art/places.ts paints no more). */
export const TRACKS_MAX = 120;
export const PLACES_MAX = 400;

const BriefSchema = z.object({ fingerprint: z.string().max(200), prompt: z.string().min(1).max(1000) });
export const TrackSchema: ZodType<SoundtrackTrack> = z.object({
  cue: z.string().max(80),
  connectionId: z.string().max(200),
  tag: z.string().max(1000),
  path: z.string().max(1000),
});
const PlaceSchema: ZodType<PlaceArt> = z.object({
  name: z.string().min(1).max(120),
  tags: z.string().max(600),
  art: PaintSchema.optional(),
});

/** The kit's audio settings, each cue's brief and the generated tracks; a bad entry is dropped, the rest kept. */
export function normalizeWorldAudio(data: unknown): WorldAudio {
  const briefs: WorldAudio["briefs"] = {};
  const rawBriefs = field(data, "briefs");
  for (const [cue, raw] of Object.entries(isRecord(rawBriefs) ? rawBriefs : {}).slice(0, BRIEFS_MAX)) {
    const parsed = BriefSchema.safeParse(raw);
    if (parsed.success) briefs[cue] = parsed.data;
  }
  return {
    ...normalizeOtomeAudio(data),
    briefs,
    tracks: validItems(TrackSchema, field(data, "tracks"), TRACKS_MAX),
  };
}

function normalizePlaces(data: unknown): World["places"] {
  const places: World["places"] = {};
  for (const [slug, raw] of Object.entries(isRecord(data) ? data : {}).slice(0, PLACES_MAX)) {
    const parsed = PlaceSchema.safeParse(raw);
    if (parsed.success) places[slug] = parsed.data;
  }
  return places;
}

const defaultWorld = (): World => ({
  version: 1,
  title: "",
  premise: "",
  language: DEFAULT_LANGUAGE,
  createdAt: "",
  setting: "",
  mystery: { question: "", truth: "", pieces: {} },
  web: [],
  openingSituation: "",
  content: defaultContent(),
  images: normalizeImages(undefined),
  connections: { narration: "" },
  forge: { phase: "forging", steps: [] },
  audio: normalizeWorldAudio(undefined),
  places: {},
});

/** The world in its full shape; `undefined` gives the defaults (mutateDoc creates from it). */
export function normalizeWorld(data: unknown): World {
  return readFields<World>(
    {
      version: () => 1,
      title: z.string(),
      premise: z.string(),
      language: z.string().min(1),
      createdAt: z.string(),
      setting: z.string(),
      mystery: MysterySchema,
      web: (value) => validItems(WebRowSchema, value),
      openingSituation: z.string(),
      writingStyle: z.string().optional(),
      bannedPhrases: z.string().optional(),
      content: normalizeContent,
      images: normalizeImages,
      connections: normalizeConnections,
      forge: normalizeForge,
      audio: normalizeWorldAudio,
      places: normalizePlaces,
    },
    defaultWorld,
    isRecord(data) ? data : undefined,
  );
}

/** The world without its hidden story (no mystery truth or pieces, no web secrets), and without the music briefs. */
export function toWorldView(world: World): WorldView {
  const { mystery, web, audio, ...rest } = world;
  const { briefs: _briefs, ...shownAudio } = audio;
  return {
    ...rest,
    mystery: { question: mystery.question },
    web: web.map(({ secret: _secret, ...row }) => row),
    audio: shownAudio,
  };
}
