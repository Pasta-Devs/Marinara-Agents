// ──────────────────────────────────────────────
// Otome Forge: the `${R}:world` document (premise, mystery, web, content, images, connections, forge steps)
// ──────────────────────────────────────────────
// The mystery's truth and pieces and the web's secrets are the hidden story: toWorldView strips them before anything
// reaches the client.
import { z, type ZodType } from "zod";
import type {
  Connections,
  ForgeStatus,
  ForgeStep,
  ImageSettings,
  WebRow,
  World,
  WorldView,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  CUSTOM_LIMIT_TEXT_MAX,
  CUSTOM_LIMITS_MAX,
  DARKNESSES,
  DEFAULT_IMAGE_RATING,
  HEATS,
  LIMIT_IDS,
  LIMIT_LEVELS,
  defaultContent,
  normalizeContent,
  normalizeImageRating,
  type ContentSettings,
  type LimitId,
} from "../../../../../client/src/features/otome-forge/shared/content.js";
import { field, isRecord, readFields, text, validItems } from "./common.js";

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
      content: normalizeContent,
      images: normalizeImages,
      connections: normalizeConnections,
      forge: normalizeForge,
    },
    defaultWorld,
    isRecord(data) ? data : undefined,
  );
}

/** The world without its hidden story: no mystery truth or pieces, no web secrets. */
export function toWorldView(world: World): WorldView {
  const { mystery, web, ...rest } = world;
  return {
    ...rest,
    mystery: { question: mystery.question },
    web: web.map(({ secret: _secret, ...row }) => row),
  };
}
