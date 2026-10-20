import {
  ltmLorebookPreviewRequestSchema,
  ltmLorebookPreviewResponseSchema,
  ltmImportSourceNotesRequestSchema,
  ltmImportSourceNotesResponseSchema,
  ltmInteropPreviewRequestSchema,
  ltmInteropPreviewResponseSchema,
  ltmSourceDetailsRequestSchema,
  ltmSourceDetailsResponseSchema,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  importPackageInterop,
  previewPackageInterop,
  previewPackageLorebooks,
  sourcePackageDetails,
} from "../sources/interop.js";
import type { FastifyInstance } from "fastify";
import { DRAFT_BODY_LIMIT_BYTES, MAINTENANCE_BODY_LIMIT_BYTES, routeError, type LtmRouteRuntime } from "./shared.js";

export function registerImportRoutes(app: FastifyInstance, runtime: LtmRouteRuntime) {
  const { root } = runtime;
  app.post<{ Body: unknown }>(
    "/import/preview",
    { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES },
    async (request, reply) => {
      try {
        return ltmInteropPreviewResponseSchema.parse(
          await previewPackageInterop(ltmInteropPreviewRequestSchema.parse(request.body ?? {}), root),
        );
      } catch (error) {
        const result = routeError(error, "Could not load long-term memory source previews.");
        return reply.status(result.statusCode).send(result.body);
      }
    },
  );
  app.post<{ Body: unknown }>(
    "/import/source-details",
    { bodyLimit: DRAFT_BODY_LIMIT_BYTES },
    async (request, reply) => {
      try {
        return ltmSourceDetailsResponseSchema.parse(
          await sourcePackageDetails(ltmSourceDetailsRequestSchema.parse(request.body ?? {}), root),
        );
      } catch (error) {
        const result = routeError(error, "Could not load long-term memory source details.");
        return reply.status(result.statusCode).send(result.body);
      }
    },
  );
  app.post<{ Body: unknown }>(
    "/import/lorebooks/preview",
    { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES },
    async (request, reply) => {
      try {
        return ltmLorebookPreviewResponseSchema.parse(
          await previewPackageLorebooks(ltmLorebookPreviewRequestSchema.parse(request.body ?? {}), root),
        );
      } catch (error) {
        const result = routeError(error, "Could not load long-term memory lorebook previews.");
        return reply.status(result.statusCode).send(result.body);
      }
    },
  );
  app.post<{ Body: unknown }>("/import/source-notes", { bodyLimit: DRAFT_BODY_LIMIT_BYTES }, async (request, reply) => {
    const controller = new AbortController(),
      abort = () => controller.abort(),
      close = () => {
        if (request.raw.aborted) abort();
      };
    const body = ltmImportSourceNotesRequestSchema.parse(request.body ?? {});
    request.raw.once("aborted", abort);
    request.raw.once("close", close);
    try {
      return ltmImportSourceNotesResponseSchema.parse(await importPackageInterop(body, root, controller.signal));
    } catch (error) {
      const result = routeError(error, "Failed to import long-term memory sources");
      return reply.status(result.statusCode).send(result.body);
    } finally {
      request.raw.off("aborted", abort);
      request.raw.off("close", close);
    }
  });
}
