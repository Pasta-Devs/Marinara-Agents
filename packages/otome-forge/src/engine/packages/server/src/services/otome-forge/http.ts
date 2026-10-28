// ──────────────────────────────────────────────
// Otome Forge: route plumbing under /api/otome-forge
// ──────────────────────────────────────────────
// Errors go out as { error, code? }. The client shows `code`, localized as ui.otomeForge.errors.<code>; `error` is
// English for logs and Debug only. Anything that is not an OtomeForgeError is logged here and hidden behind a 500.
// Request bodies are never logged.
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import type { ZodType } from "zod";
import type { OtomeErrorCode } from "../../../../client/src/features/otome-forge/shared/api-types.js";
import type { ForgeStoryCancellation } from "@forge-kit/story-cancel-server.mjs";
import type { OtomeArt } from "./art/expressions.js";
import type { ImageClient } from "./art/image-client.js";
import type { BackgroundQueue } from "./background-queue.js";
import type { OtomeMemory } from "./memory/memory.js";
import { isLiId, isRunKey, runIdOf } from "./ids.js";
import type { OtomeStore } from "./store.js";

export class OtomeForgeError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly code?: OtomeErrorCode,
  ) {
    super(message);
    this.name = "OtomeForgeError";
  }
}

// Structural slices of Fastify: the host hands privileged routes a collector, and Otome uses only GET and POST
// (the kit's forgeTimeZoneRoutes wraps those two).
export interface OtomeRequest {
  params?: unknown;
  query?: unknown;
  body?: unknown;
  method?: string;
  url?: string;
}

export interface OtomeReply {
  status(code: number): OtomeReply;
  send(payload: unknown): OtomeReply;
}

export type RouteHandler = (request: OtomeRequest, reply: OtomeReply) => Promise<unknown>;

/**
 * Fastify route options, which the Engine's collector hands to app.route as they are. `logLevel: "silent"` drops the
 * Engine's own lines for the request (incoming request, request completed, an aborted client, Fastify's error line).
 */
export interface OtomeRouteOptions {
  logLevel: "silent";
}

export interface OtomeRouter {
  get(path: string, handler: RouteHandler): void;
  post(path: string, handler: RouteHandler): void;
  post(path: string, options: OtomeRouteOptions, handler: RouteHandler): void;
}

export interface OtomeLogger {
  error(error: unknown, message: string, ...args: unknown[]): void;
}

export type Handle = (run: (request: OtomeRequest) => Promise<unknown>) => RouteHandler;

/** Wraps route bodies so known failures reach the client as { error, code } and the rest are logged once. */
export function createHandle(logger: OtomeLogger): Handle {
  return (run) => async (request, reply) => {
    try {
      return await run(request);
    } catch (error) {
      if (error instanceof OtomeForgeError) {
        return reply
          .status(error.statusCode)
          .send(error.code ? { error: error.message, code: error.code } : { error: error.message });
      }
      logger.error(error, "Otome Forge request failed: %s %s", request.method ?? "", request.url ?? "");
      return reply.status(500).send({ error: "Otome Forge could not complete the request." });
    }
  };
}

/** The request body read through `schema` (unknown keys such as timeZone and debugMode are dropped), or a 400. */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body ?? {});
  if (parsed.success) return parsed.data;
  const issues = parsed.error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
    .join("; ");
  throw new OtomeForgeError(400, `Invalid request: ${issues}`, "bad-request");
}

/** What every route module's register function receives: `registerXRoutes(router, deps)`. */
export interface RouteDeps {
  runtime: CapabilityRuntimeHost;
  store: OtomeStore;
  handle: Handle;
  /** The loopback image client by default (art/paint.ts imagesOf); tests pass a fake. */
  images?: ImageClient;
  /** Private story memory (S/memory/memory.ts); without it prompts carry no recall. */
  memory?: OtomeMemory;
  /** The run-scoped Cancel for story writes (forge-kit story-cancel-server). */
  cancellation?: ForgeStoryCancellation;
  /** The package's background lane (line packs, M3); without it nothing is written in the background. */
  background?: BackgroundQueue;
  /**
   * The story's art (M2b, S/art/expressions.ts createOtomeArt): faces for each beat served, places and the CG for each
   * beat written, a replaced beat's CG released. Without it nothing is painted.
   */
  art?: OtomeArt;
}

export type RegisterRoutes = (router: OtomeRouter, deps: RouteDeps) => void;

function param(request: OtomeRequest, name: string): unknown {
  const params = request.params;
  return params && typeof params === "object" ? (params as Record<string, unknown>)[name] : undefined;
}

/** The `:run` param as its run key and run id R, or a 404 (a malformed key names no run). */
export function runParam(request: OtomeRequest): { runKey: string; runId: string } {
  const runKey = param(request, "run");
  if (!isRunKey(runKey)) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
  return { runKey, runId: runIdOf(runKey) };
}

/** The `:li` param, or a 404. Whether the run has that LI is the route's check. */
export function liParam(request: OtomeRequest): string {
  const li = param(request, "li");
  if (!isLiId(li)) throw new OtomeForgeError(404, "No such love interest.", "not-found");
  return li;
}

/**
 * `reviewImagePrompts` from the body (POST) or the query (GET): the player reviews image prompts before they are sent
 * (the Engine's reviewImagePromptsBeforeSend), so an automatic paint waits for the tap as with Ask before painting.
 */
export function reviewModeOf(request: OtomeRequest): boolean {
  const from = (source: unknown) =>
    source && typeof source === "object" ? (source as Record<string, unknown>).reviewImagePrompts : undefined;
  const value = from(request.body) ?? from(request.query);
  return value === true || value === "true";
}

/** `debugMode` from the body (POST) or the query (GET), as the client sends it on every request. */
export function debugModeOf(request: OtomeRequest): boolean {
  const from = (source: unknown) =>
    source && typeof source === "object" ? (source as Record<string, unknown>).debugMode : undefined;
  const value = from(request.body) ?? from(request.query);
  return value === true || value === "true";
}
