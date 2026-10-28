// ──────────────────────────────────────────────
// Otome Forge: route plumbing under /api/otome-forge
// ──────────────────────────────────────────────
// Errors go out as { error, code? }. The client shows `code`, localized as ui.otomeForge.errors.<code>; `error` is
// English for logs and Debug only. Anything that is not an OtomeForgeError is logged here and hidden behind a 500.
// Request bodies are never logged.
import type { ZodType } from "zod";
import type { OtomeErrorCode } from "../../../../client/src/features/otome-forge/shared/api-types.js";

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

export interface OtomeRouter {
  get(path: string, handler: RouteHandler): void;
  post(path: string, handler: RouteHandler): void;
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
