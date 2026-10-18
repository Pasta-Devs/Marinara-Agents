import { z } from "zod";
import { logger } from "../package-runtime.js";
import { rebuildLongTermMemoryIndexes } from "../recall/rebuild.js";
import type { LongTermMemoryDraftStore } from "../drafts/draft-store.js";
import type { LongTermMemoryStorage } from "../persistence/storage.js";
import { LtmServiceError, ltmErrorResponse } from "../service-error.js";

export const NOTE_BODY_LIMIT_BYTES = 512 * 1024;
export const DRAFT_BODY_LIMIT_BYTES = 512 * 1024;
export const SEARCH_BODY_LIMIT_BYTES = 128 * 1024;
export const MAINTENANCE_BODY_LIMIT_BYTES = 32 * 1024;
export const EXTRACTION_SETTINGS_BODY_LIMIT_BYTES = 1_100_000;
export const IDENTITY_REPAIR_BODY_LIMIT_BYTES = 512 * 1024;
export const BACKUP_BODY_LIMIT_BYTES = 25 * 1024 * 1024;
export const queryBoolean = z.preprocess(
  (value) => (value === "true" ? true : value === "false" ? false : value),
  z.boolean().optional(),
);
export function routeError(error: unknown, fallback: string) {
  if (error instanceof z.ZodError)
    return {
      statusCode: 400,
      body: { error: error.message, code: "ltm_invalid_request" },
    };
  if (
    error instanceof LtmServiceError ||
    (error && typeof error === "object" && "statusCode" in error && "code" in error)
  )
    return ltmErrorResponse(error, fallback);
  if (error instanceof AggregateError) {
    logger.error(error, "[ltm] Unexpected aggregate failure in route");
    return {
      statusCode: 500,
      body: { error: fallback, code: "ltm_unexpected_failure" },
    };
  }
  const message = error instanceof Error ? error.message : fallback;
  return {
    statusCode: 500,
    body: {
      error: message,
      code: "ltm_unexpected_failure",
    },
  };
}

export function vaultNoteValidationError(note: {
  title?: string;
  type: string;
  subjects?: unknown[];
  sections?: Record<string, { text?: string }>;
  links?: Array<{ target?: string; relation?: string }>;
  conflicts?: Array<{ resolution?: string }>;
}) {
  if (!note.title?.trim()) return "A memory title is required.";
  if (!note.sections || !Object.keys(note.sections).length) return "A memory must include at least one detail.";
  if (Object.values(note.sections).some((section) => !section.text?.trim())) return "Every memory detail needs text.";
  if (note.type === "character" && note.subjects?.length !== 1)
    return "Character memories must have exactly one subject.";
  if (note.type === "relationship" && note.subjects?.length !== 2)
    return "Relationship memories must have exactly two subjects.";
  if (note.links?.some((link) => !link.target || !link.relation))
    return "Every linked memory needs a memory and relationship.";
  return null;
}

export async function rebuildAfterMutation(root: string, ordinaryEditorMutation = false) {
  try {
    const result = await rebuildLongTermMemoryIndexes({ root });
    return { status: "complete" as const, ...result };
  } catch (error) {
    logger.warn(
      error,
      ordinaryEditorMutation
        ? "[ltm] Recall index rebuild failed after editor mutation"
        : "[ltm] Deferred index rebuild after maintenance mutation",
    );
    return {
      status: "deferred" as const,
      error: error instanceof Error ? error.message : "Index rebuild failed",
    };
  }
}

export type LtmRouteRuntime = {
  root: string;
  storage: LongTermMemoryStorage;
  draftStore: LongTermMemoryDraftStore;
};
