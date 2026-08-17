import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  ltmBulkNoteRequestSchema,
  ltmBulkNoteResultSchema,
  ltmConflictSchema,
  ltmDraftMutationSchema,
  ltmDraftReviewResponseSchema,
  ltmDraftStatusSchema,
  ltmDebugPhaseSchema,
  ltmDebugStatusSchema,
  ltmExtractSourceNoteRequestSchema,
  ltmExtractSourceNoteResponseSchema,
  ltmGlobalSettingsSchema,
  ltmIsoTimestampSchema,
  ltmLinkSchema,
  ltmLorebookPreviewRequestSchema,
  ltmLorebookPreviewResponseSchema,
  ltmModeSchema,
  ltmNoteIdSchema,
  ltmNoteTitleSchema,
  ltmNoteTypeSchema,
  ltmNoteTransferApplyResponseSchema,
  ltmNoteTransferApplyRequestSchema,
  ltmNoteTransferPreviewRequestSchema,
  ltmNoteTransferPreviewResponseSchema,
  ltmIntegrityResponseSchema,
  ltmImportSourceNotesRequestSchema,
  ltmImportSourceNotesResponseSchema,
  ltmIdentityRepairApplyRequestSchema,
  ltmIdentityRepairApplyResponseSchema,
  ltmIdentityRepairPreviewRequestSchema,
  ltmIdentityRepairPreviewResponseSchema,
  ltmInteropPreviewRequestSchema,
  ltmInteropPreviewResponseSchema,
  ltmRepairRequestSchema,
  ltmRepairResponseSchema,
  ltmRenameNoteSectionRequestSchema,
  ltmRenameNoteSectionPreviewResponseSchema,
  ltmRenameNoteSectionResponseSchema,
  ltmStatusResponseSchema,
  ltmWriteScopeSchema,
  ltmScopeSchema,
  ltmSectionKeySchema,
  ltmSectionSchema,
  ltmStatusSchema,
  ltmSourceDerivedMemoriesResponseSchema,
  ltmSubjectsSchema,
  ltmRejectedSuggestionsResponseSchema,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { clearLtmDebugLog, exportLtmDebugLog, readLtmDebugLog } from "./debug-log.js";
import { projectLongTermMemoryDraftReview } from "./draft-review.js";
import { getLtmExtractionConfig, updateLtmExtractionConfig } from "./extraction-config.js";
import { isEnoent } from "./ltm-utils.js";
import { checkLongTermMemoryIntegrity, repairLongTermMemory } from "./maintenance.js";
import { applyLtmNoteTransfer, previewLtmNoteTransfer } from "./note-transfer.js";
import { getPackageLanguageModels, getPackagePersistence, getPackageResources, logger } from "./package-runtime.js";
import { getLongTermMemoryDirectories, LTM_DIR_NAME } from "./paths.js";
import { longTermMemoryRecallIndexPath, parseLtmRecallIndex, rebuildLongTermMemoryIndexes } from "./rebuild.js";
import { readLtmIndexState, readLtmNoteSummary } from "./index-state.js";
import { readLtmActivityEvents } from "./activity-index.js";
import { CURRENT_LTM_CHUNK_FORMAT_VERSION } from "./chunking.js";
import { retrieveLongTermMemory } from "./retrieval.js";
import { applyLongTermMemoryDraft } from "./reconciliation.js";
import { applyLtmScopeLinksToDerivedNotes } from "./scope-links.js";
import { getLtmGlobalSettings, updateLtmGlobalSettings } from "./settings.js";
import type { LongTermMemoryDraftStore } from "./draft-store.js";
import type { LongTermMemoryStorage } from "./storage.js";
import { readLongTermMemoryInjectionReceipt } from "./usage.js";
import { ltmModeForChatMode, normalizeLtmChatCharacterIds, resolveChatLtmScope } from "./chat-scope.js";
import { isLtmSourceNote } from "./source-extraction.js";
import { processLongTermMemorySource } from "./source-processing.js";
import {
  importPackageInterop,
  PROFESSOR_MARI_CHARACTER_ID,
  previewPackageInterop,
  previewPackageLorebooks,
} from "./interop.js";
import {
  getLtmScopeChatIds,
  getLtmScopeGroupIds,
  getLtmScopePersonaIds,
  isGlobalLtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/scope.js";
import { applyLtmIdentityRepairs, LtmIdentityRepairError, previewLtmIdentityRepairs } from "./identity-repair.js";
import { loadTrustedLtmSubjectCatalog } from "./subject-identity.js";
import { LtmServiceError, ltmErrorResponse } from "./service-error.js";
import {
  deleteAllLongTermMemoryData,
  exportLongTermMemoryData,
  parseLongTermMemoryBackup,
  previewLongTermMemoryBackup,
  replaceLongTermMemoryData,
  resetLongTermMemorySettings,
} from "./backup-restore.js";
import { deleteRejectedSuggestion, listRejectedSuggestions } from "./rejected-suggestions.js";

const NOTE_BODY_LIMIT_BYTES = 512 * 1024;
const DRAFT_BODY_LIMIT_BYTES = 512 * 1024;
const SEARCH_BODY_LIMIT_BYTES = 128 * 1024;
const MAINTENANCE_BODY_LIMIT_BYTES = 32 * 1024;
const EXTRACTION_SETTINGS_BODY_LIMIT_BYTES = 1_100_000;
const IDENTITY_REPAIR_BODY_LIMIT_BYTES = 512 * 1024;
const BACKUP_BODY_LIMIT_BYTES = 25 * 1024 * 1024;
const ltmIdentifierSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);
const scopedIds = z.preprocess(
  (value) => {
    const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
    return values
      .map(String)
      .map((item) => item.trim())
      .filter(Boolean);
  },
  z.array(z.string().min(1).max(120)).max(100).optional(),
);
const queryBoolean = z.preprocess(
  (value) => (value === "true" ? true : value === "false" ? false : value),
  z.boolean().optional(),
);
const listNotesQuery = z
  .object({
    type: ltmNoteTypeSchema.optional(),
    status: ltmStatusSchema.optional(),
    tag: ltmIdentifierSchema.optional(),
    scopeChatIds: scopedIds,
    scopeGroupId: z.string().min(1).max(120).optional(),
    scopeGroupIds: scopedIds,
    scopeCharacterIds: scopedIds,
    scopePersonaId: z.string().min(1).max(120).optional(),
    scopePersonaIds: scopedIds,
    includeGlobal: queryBoolean,
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(500).default(100),
  })
  .strict();
const scopeTargetsQuery = z
  .object({
    chatId: z.string().min(1).max(120).optional(),
    includeAllChats: queryBoolean,
  })
  .strict();
const noteEventsQuery = z
  .object({
    noteId: ltmNoteIdSchema,
    limit: z.coerce.number().int().min(1).max(20).default(5),
  })
  .strict();

function numberDuplicateLabels<T extends { id: string; label: string; comment?: string }>(items: T[]) {
  const totals = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const item of items) {
    const key = `${item.label}\u0000${item.comment ?? ""}`;
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  return items.map((item) => {
    const key = `${item.label}\u0000${item.comment ?? ""}`;
    if ((totals.get(key) ?? 0) < 2) return item;
    const number = seen.get(key) ?? 0;
    seen.set(key, number + 1);
    return {
      ...item,
      label: number ? `${item.label} (${number})` : item.label,
    };
  });
}

function resourceDisplay(resource: { id: string; data: unknown; comment?: unknown }) {
  const data =
    typeof resource.data === "string"
      ? (() => {
          try {
            const parsed: unknown = JSON.parse(resource.data);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? (parsed as Record<string, unknown>)
              : null;
          } catch {
            return null;
          }
        })()
      : resource.data && typeof resource.data === "object" && !Array.isArray(resource.data)
        ? (resource.data as Record<string, unknown>)
        : null;
  return {
    id: resource.id,
    label: typeof data?.name === "string" && data.name.trim() ? data.name.trim() : "",
    comment:
      typeof resource.comment === "string"
        ? resource.comment.trim()
        : typeof data?.comment === "string"
          ? data.comment.trim()
          : "",
  };
}
const createNoteBody = z
  .object({
    id: ltmNoteIdSchema,
    title: ltmNoteTitleSchema.optional(),
    type: ltmNoteTypeSchema.exclude(["source"]),
    status: ltmStatusSchema,
    modes: z.array(ltmModeSchema).min(1).max(8),
    scope: ltmWriteScopeSchema.default({}),
    tags: z.array(ltmIdentifierSchema).max(100).default([]),
    keywords: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    manualKeywords: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    suppressedKeywords: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    createdAt: ltmIsoTimestampSchema.optional(),
    updatedAt: ltmIsoTimestampSchema.optional(),
    links: z.array(ltmLinkSchema).max(250).default([]),
    sections: z.record(ltmSectionKeySchema, ltmSectionSchema),
    conflicts: z.array(ltmConflictSchema).max(250).optional(),
    subjects: ltmSubjectsSchema.optional(),
    version: z.number().int().min(1).optional(),
  })
  .strict()
  .superRefine((note, ctx) => {
    if (
      note.scope.chatId ||
      note.scope.chatIds?.length ||
      note.scope.groupId ||
      note.scope.groupIds?.length ||
      note.scope.characterIds?.length ||
      note.scope.personaId ||
      note.scope.personaIds?.length
    )
      return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scope"],
      message: "Choose at least one place where this memory is available.",
    });
  });
const updateNoteBody = z
  .object({
    title: ltmNoteTitleSchema.optional(),
    status: ltmStatusSchema.optional(),
    modes: z.array(ltmModeSchema).min(1).max(8).optional(),
    scope: ltmWriteScopeSchema.optional(),
    tags: z.array(ltmIdentifierSchema).max(100).optional(),
    keywords: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    manualKeywords: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    suppressedKeywords: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    links: z.array(ltmLinkSchema).max(250).optional(),
    sections: z.record(ltmSectionKeySchema, ltmSectionSchema).optional(),
    conflicts: z.array(ltmConflictSchema).max(250).optional(),
    subjects: ltmSubjectsSchema.optional(),
    removedSectionKeys: z
      .array(ltmSectionKeySchema)
      .max(100)
      .refine((keys) => new Set(keys).size === keys.length, "Removed section keys must be unique.")
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Patch body must include at least one updatable field.");
const removeScopeBody = z
  .object({
    chatIds: z.array(z.string().min(1).max(120)).max(100).optional(),
    groupId: z.string().min(1).max(120).optional(),
    groupIds: z.array(z.string().min(1).max(120)).max(100).optional(),
    characterIds: z.array(z.string().min(1).max(120)).max(100).optional(),
    personaIds: z.array(z.string().min(1).max(120)).max(100).optional(),
  })
  .strict()
  .refine(
    (value) =>
      Boolean(
        value.chatIds?.length ||
        value.groupId ||
        value.groupIds?.length ||
        value.characterIds?.length ||
        value.personaIds?.length,
      ),
    "At least one scope link is required.",
  );
const removeCurrentChatBody = z.object({ chatId: z.string().min(1).max(120) }).strict();
const applyDerivedBody = z
  .object({
    chatIds: z.array(z.string().min(1).max(120)).max(100).optional(),
    groupIds: z.array(z.string().min(1).max(120)).max(100).optional(),
    characterIds: z.array(z.string().min(1).max(120)).max(100).optional(),
    personaIds: z.array(z.string().min(1).max(120)).max(100).optional(),
  })
  .strict()
  .refine(
    (value) =>
      Boolean(
        value.chatIds?.length || value.groupIds?.length || value.characterIds?.length || value.personaIds?.length,
      ),
    "Provide at least one scope link to apply.",
  );
const searchBody = z
  .object({
    queryText: z.string().max(20_000),
    mode: ltmModeSchema.optional(),
    scope: ltmScopeSchema.optional(),
    characterIds: z.array(z.string().min(1).max(120)).max(100).optional(),
    includeResolved: z.boolean().optional(),
    maxChunks: z.number().int().min(1).max(100).optional(),
    maxTokens: z.number().int().min(128).max(16_384).optional(),
    minScore: z.number().finite().min(0).max(1).optional(),
    semanticWeight: z.number().finite().min(0).max(1).optional(),
    lexicalWeight: z.number().finite().min(0).max(1).optional(),
    graphWeight: z.number().finite().min(0).max(1).optional(),
    keywordWeight: z.number().finite().min(0).max(1).optional(),
    explain: z.boolean().optional(),
    rejectedLimit: z.number().int().min(0).max(80).optional(),
  })
  .strict();
const draftQuery = z
  .object({
    status: ltmDraftStatusSchema.optional(),
    chatId: z.string().min(1).max(120).optional(),
  })
  .strict();
const draftReviewQuery = z
  .object({
    sourceNoteId: ltmNoteIdSchema.optional(),
    chatId: z.string().min(1).max(120).optional(),
    status: ltmDraftStatusSchema.optional(),
    includeInvalidated: queryBoolean,
  })
  .strict();
const rejectedSuggestionsQuery = z
  .object({
    sourceNoteId: ltmNoteIdSchema.optional(),
    chatId: z.string().min(1).max(120).optional(),
  })
  .strict();
const acceptDraftBody = z
  .object({
    mutationIds: z.array(z.string().uuid()).min(1).optional(),
    lowRiskOnly: z.boolean().optional(),
    editedMutations: z.array(ltmDraftMutationSchema).optional(),
  })
  .strict()
  .default({});
const debugQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(1000).default(200),
    operationId: z.string().uuid().optional(),
    sourceNoteId: ltmNoteIdSchema.optional(),
    draftId: z.string().uuid().optional(),
    status: ltmDebugStatusSchema.optional(),
    phase: ltmDebugPhaseSchema.optional(),
  })
  .strict();
function routeError(error: unknown, fallback: string) {
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
  const message = error instanceof Error ? error.message : fallback;
  return {
    statusCode: 500,
    body: {
      error: message,
      code: "ltm_unexpected_failure",
    },
  };
}

function vaultNoteValidationError(note: {
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

export function createLongTermMemoryRoutes(runtime: {
  root: string;
  storage: LongTermMemoryStorage;
  draftStore: LongTermMemoryDraftStore;
}): FastifyPluginAsync {
  return async (app) => {
    const { root, storage, draftStore } = runtime;
    const rebuildAfterMutation = async (ordinaryEditorMutation = false) => {
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
    };
    app.get("/status", async () => {
      await storage.initializeLtmStore();
      const dirs = getLongTermMemoryDirectories(root);
      const events = await stat(dirs.eventLog).then(
        (info) => ({ logAvailable: true, bytes: info.size }),
        () => ({ logAvailable: false, bytes: 0 }),
      );
      const [summary, pendingDrafts, state, indexResult] = await Promise.all([
        readLtmNoteSummary(root),
        draftStore.listDrafts({ status: "pending" }),
        readLtmIndexState(root),
        readFile(longTermMemoryRecallIndexPath(root), "utf8")
          .then((value) => ({
            index: parseLtmRecallIndex(JSON.parse(value)),
            corrupt: false,
          }))
          .catch((error) => ({ index: null, corrupt: !isEnoent(error) })),
      ]);
      const { index } = indexResult;
      const chunks = index ? Object.values(index.metadata.chunks) : [];
      return ltmStatusResponseSchema.parse({
        initialized: true,
        directory: LTM_DIR_NAME,
        notes: {
          total: summary.total,
          sourceNotes: summary.sourceNotes,
          savedMemories: summary.savedMemories,
          pendingDrafts: pendingDrafts.length,
          byType: summary.byType,
          byStatus: summary.byStatus,
        },
        events,
        indexes: {
          health: indexResult.corrupt
            ? "corrupt"
            : state.rebuildState === "failed"
              ? "stale"
              : state.rebuildState === "building"
                ? "degraded"
                : index
                  ? state.dirty
                    ? "stale"
                    : "healthy"
                  : "not_built",
          dirty: state.dirty,
          rebuildState: state.rebuildState,
          errors: indexResult.corrupt
            ? [{ index: "recall", code: "recall_index_unreadable" }]
            : state.rebuildState === "failed"
              ? [{ index: "recall", code: "index_rebuild_failed" }]
              : [],
          warnings: state.error ? [state.error] : [],
          generatedAt: index?.generatedAt ?? null,
          sourceHash: index?.sourceHash ?? null,
          noteCount: index ? summary.savedMemories : null,
          chunkCount: index ? chunks.length : null,
          chunkFormatVersion: index ? CURRENT_LTM_CHUNK_FORMAT_VERSION : null,
          embeddingsAvailable: Boolean(index?.embeddings.embeddedChunkCount),
          embeddedChunkCount: index?.embeddings.embeddedChunkCount ?? 0,
        },
      });
    });
    app.get<{ Querystring: unknown }>("/debug-log", async (request, reply) => {
      const parsed = debugQuery.safeParse(request.query);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
      return { events: await readLtmDebugLog(parsed.data, root) };
    });
    app.get<{ Querystring: unknown }>("/events", async (request, reply) => {
      const parsed = noteEventsQuery.safeParse(request.query);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
      return {
        events: await readLtmActivityEvents(root, parsed.data.noteId, parsed.data.limit),
      };
    });
    app.get("/debug-log/export", async (_request, reply) =>
      reply
        .header("content-type", "application/x-ndjson; charset=utf-8")
        .header("content-disposition", `attachment; filename=\"ltm-debug-log-${Date.now()}.jsonl\"`)
        .send(await exportLtmDebugLog(root)),
    );
    app.delete("/debug-log", async () => clearLtmDebugLog(root));
    app.get<{ Params: { chatId: string } }>("/last-injection/:chatId", async (request) => {
      const receipt = await readLongTermMemoryInjectionReceipt(request.params.chatId, root);
      if (!receipt)
        return { memoryCount: 0, tokenCount: 0, memories: [], state: "not_recorded" as const, dispatchedAt: null };
      const notesById = new Map((await storage.listNotes()).map((note) => [note.id, note]));
      const memories = new Map<
        string,
        {
          noteId: string;
          title: string;
          tokenCount: number;
          sectionKey?: string;
          sourceNoteId?: string;
          sourceTitle?: string;
        }
      >();
      for (const chunk of receipt.chunks) {
        const current = memories.get(chunk.noteId);
        if (current) current.tokenCount += chunk.tokenCount;
        else {
          const note = notesById.get(chunk.noteId);
          const linkedSourceId = note?.links.find((link) => link.relation === "extracted_from")?.target;
          const sourceNote = linkedSourceId ? notesById.get(linkedSourceId) : undefined;
          const sourceNoteId = sourceNote?.id;
          memories.set(chunk.noteId, {
            noteId: chunk.noteId,
            title: note?.title?.trim() || chunk.noteId,
            tokenCount: chunk.tokenCount,
            sectionKey: chunk.sectionKey,
            ...(sourceNoteId ? { sourceNoteId } : {}),
            ...(sourceNote?.title?.trim() ? { sourceTitle: sourceNote.title.trim() } : {}),
          });
        }
      }
      return {
        memoryCount: memories.size,
        tokenCount: receipt.serializedTokenCount,
        memories: [...memories.values()],
        state: memories.size ? ("injected" as const) : ("no_matches" as const),
        dispatchedAt: receipt.dispatchedAt,
      };
    });
    app.get("/settings", async () => getLtmGlobalSettings(root));
    app.get("/backup/export", async (_request, reply) =>
      reply
        .header("content-type", "application/json; charset=utf-8")
        .header("content-disposition", `attachment; filename=\"long-term-memory-${Date.now()}.json\"`)
        .send(await exportLongTermMemoryData(root)),
    );
    app.post<{ Body: unknown }>("/backup/preview", { bodyLimit: BACKUP_BODY_LIMIT_BYTES }, async (request, reply) => {
      try {
        return await previewLongTermMemoryBackup(request.body, root);
      } catch (error) {
        const result = routeError(error, "Could not preview backup.");
        return reply.status(result.statusCode).send(result.body);
      }
    });
    app.post<{ Body: unknown }>("/backup/import", { bodyLimit: BACKUP_BODY_LIMIT_BYTES }, async (request, reply) => {
      try {
        return await replaceLongTermMemoryData(parseLongTermMemoryBackup(request.body), root);
      } catch (error) {
        const result = routeError(error, "Could not import backup.");
        return reply.status(result.statusCode).send(result.body);
      }
    });
    app.delete("/data", async () => deleteAllLongTermMemoryData(root));
    app.post("/settings/reset", async () => resetLongTermMemorySettings(root));
    app.put<{ Body: unknown }>("/settings", { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES }, async (request) =>
      updateLtmGlobalSettings(ltmGlobalSettingsSchema.parse(request.body ?? {}), root),
    );
    app.get("/extraction-settings", async () => getLtmExtractionConfig(root));
    app.put<{ Body: unknown }>(
      "/extraction-settings",
      { bodyLimit: EXTRACTION_SETTINGS_BODY_LIMIT_BYTES },
      async (request, reply) => {
        try {
          return await updateLtmExtractionConfig(request.body ?? {}, root);
        } catch (error) {
          if (error instanceof z.ZodError) return reply.status(400).send({ error: error.message });
          throw error;
        }
      },
    );
    app.get<{ Querystring: unknown }>("/notes", async (request, reply) => {
      const query = listNotesQuery.parse(request.query);
      const scope =
        query.scopeChatIds?.length ||
        query.scopeGroupId ||
        query.scopeGroupIds?.length ||
        query.scopeCharacterIds?.length ||
        query.scopePersonaId ||
        query.scopePersonaIds?.length
          ? {
              ...(query.scopeChatIds?.length ? { chatIds: query.scopeChatIds, chatId: query.scopeChatIds[0] } : {}),
              ...(query.scopeGroupId ? { groupId: query.scopeGroupId } : {}),
              ...(query.scopeGroupIds?.length ? { groupIds: query.scopeGroupIds } : {}),
              ...(query.scopeCharacterIds?.length ? { characterIds: query.scopeCharacterIds } : {}),
              ...(query.scopePersonaId ? { personaId: query.scopePersonaId } : {}),
              ...(query.scopePersonaIds?.length ? { personaIds: query.scopePersonaIds } : {}),
            }
          : undefined;
      const notes = await storage.listNotes({
        type: query.type,
        status: query.status,
        tag: query.tag,
        scope,
        characterIds: query.scopeCharacterIds,
        includeGlobal: query.includeGlobal,
        offset: query.offset,
        limit: query.limit + 1,
      });
      const hasMore = notes.length > query.limit;
      reply.header("x-ltm-has-more", String(hasMore));
      if (hasMore) reply.header("x-ltm-next-offset", String(query.offset + query.limit));
      return notes.slice(0, query.limit);
    });
    app.get<{ Querystring: unknown }>("/scope-targets", async (request) => {
      const { chatId, includeAllChats } = scopeTargetsQuery.parse(request.query);
      const [notes, chats, resources, personas] = await Promise.all([
        storage.listNotes(),
        getPackagePersistence().listChats(),
        getPackageResources().listCharacters(),
        getPackageResources().listPersonas(),
      ]);
      const eligibleChats = chats.filter(
        (chat) => !normalizeLtmChatCharacterIds(chat.characterIds).includes(PROFESSOR_MARI_CHARACTER_ID),
      );
      const eligibleResources = resources.filter((resource) => resource.id !== PROFESSOR_MARI_CHARACTER_ID);
      const chatById = new Map(eligibleChats.map((chat) => [chat.id, chat]));
      const currentChat = chatId ? (chatById.get(chatId) ?? null) : null;
      const chatIds = new Set<string>();
      const groupIds = new Set<string>();
      const characterIds = new Set<string>();
      const personaIds = new Set<string>();
      if (currentChat?.personaId) personaIds.add(currentChat.personaId);
      if (currentChat) {
        chatIds.add(currentChat.id);
        if (currentChat.groupId) groupIds.add(currentChat.groupId);
        normalizeLtmChatCharacterIds(currentChat.characterIds).forEach((characterId) => characterIds.add(characterId));
      }
      if (includeAllChats) {
        for (const chat of eligibleChats) {
          chatIds.add(chat.id);
          if (chat.groupId) groupIds.add(chat.groupId);
          if (chat.personaId) personaIds.add(chat.personaId);
        }
      }
      for (const note of notes) {
        for (const id of getLtmScopeChatIds(note.scope)) {
          chatIds.add(id);
          const chat = chatById.get(id);
          if (chat?.groupId) groupIds.add(chat.groupId);
          normalizeLtmChatCharacterIds(chat?.characterIds).forEach((characterId) => characterIds.add(characterId));
        }
        for (const groupId of getLtmScopeGroupIds(note.scope)) {
          if (eligibleChats.some((chat) => chat.groupId === groupId)) groupIds.add(groupId);
        }
        note.scope.characterIds
          ?.filter((id) => id !== PROFESSOR_MARI_CHARACTER_ID)
          .forEach((id) => characterIds.add(id));
        for (const personaId of getLtmScopePersonaIds(note.scope)) personaIds.add(personaId);
        for (const subject of note.subjects ?? []) {
          if (subject.ref?.kind === "character") characterIds.add(subject.ref.id);
          if (subject.ref?.kind === "persona") personaIds.add(subject.ref.id);
        }
      }
      const namedChats = numberDuplicateLabels(
        [...chatIds]
          .map((id) => chatById.get(id))
          .filter((chat): chat is NonNullable<typeof chat> => Boolean(chat))
          .map((chat) => ({
            id: chat.id,
            label: chat.name?.trim() || "Untitled chat",
            mode: ltmModeForChatMode(chat.mode),
            groupId: chat.groupId,
            personaId: chat.personaId,
            characterIds: normalizeLtmChatCharacterIds(chat.characterIds),
          }))
          .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)),
      );
      const resourceById = new Map(eligibleResources.map((resource) => [resource.id, resource]));
      const visibleCharacterIds = includeAllChats
        ? new Set(eligibleResources.map((resource) => resource.id))
        : characterIds;
      const namedCharacters = numberDuplicateLabels(
        [...visibleCharacterIds]
          .map((id) => {
            const display = resourceById.get(id)
              ? resourceDisplay(resourceById.get(id)!)
              : { id, label: "", comment: "" };
            return {
              id,
              label: display.label || "Untitled character",
              ...(display.comment ? { comment: display.comment } : {}),
            };
          })
          .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)),
      );
      return {
        currentScope: currentChat ? resolveChatLtmScope(currentChat) : null,
        chats: namedChats,
        groups: numberDuplicateLabels(
          [...groupIds]
            .map((id) => {
              const members = eligibleChats.filter(
                (chat) => chat.groupId === id && (includeAllChats || chatIds.has(chat.id)),
              );
              return {
                id,
                chatIds: members.map((chat) => chat.id),
                label: namedChats.find((chat) => chat.id === members[0]?.id)?.label?.trim() || "Untitled group",
              };
            })
            .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)),
        ),
        characters: namedCharacters,
        personas: numberDuplicateLabels(
          [...(includeAllChats ? personas : personas.filter((persona) => personaIds.has(persona.id)))]
            .filter((persona) => persona.id !== PROFESSOR_MARI_CHARACTER_ID)
            .map((persona) => {
              const display = resourceDisplay(persona);
              return {
                id: persona.id,
                label: display.label || "Untitled persona",
                ...(display.comment ? { comment: display.comment } : {}),
              };
            })
            .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)),
        ),
      };
    });
    app.get<{ Params: { id: string } }>("/notes/:id/derived", async (request, reply) => {
      const sourceNoteId = ltmNoteIdSchema.parse(request.params.id);
      const notes = await storage.listNotes();
      const source = notes.find((note) => note.id === sourceNoteId);
      if (!source || !isLtmSourceNote(source))
        return reply.status(404).send({ error: "Long-term memory source note not found" });
      const linkedIds = new Set([sourceNoteId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const note of notes) {
          if (
            linkedIds.has(note.id) ||
            !note.links.some((link) => link.relation === "extracted_from" && linkedIds.has(link.target))
          )
            continue;
          linkedIds.add(note.id);
          changed = true;
        }
      }
      const incomingLinkCounts = new Map<string, number>();
      const outgoingLinkCounts = new Map(notes.map((note) => [note.id, note.links.length]));
      for (const note of notes)
        for (const link of note.links)
          incomingLinkCounts.set(link.target, (incomingLinkCounts.get(link.target) ?? 0) + 1);
      const related = notes
        .filter((note) => note.id !== sourceNoteId && linkedIds.has(note.id))
        .sort((left, right) => (left.title ?? left.id).localeCompare(right.title ?? right.id))
        .map(({ id, title, type, status, scope, sections }) => ({
          id,
          ...(title ? { title } : {}),
          type,
          status,
          scope,
          previewText: Object.values(sections)[0]?.text.replace(/\s+/g, " ").trim().slice(0, 600) ?? "",
          incomingLinkCount: incomingLinkCounts.get(id) ?? 0,
          outgoingLinkCount: outgoingLinkCounts.get(id) ?? 0,
        }));
      return ltmSourceDerivedMemoriesResponseSchema.parse({
        sourceNoteId,
        sourceIncomingLinkCount: incomingLinkCounts.get(sourceNoteId) ?? 0,
        sourceOutgoingLinkCount: outgoingLinkCounts.get(sourceNoteId) ?? 0,
        memories: related,
      });
    });
    app.get<{ Params: { id: string } }>("/notes/:id", async (request, reply) => {
      const note = await storage.getNote(ltmNoteIdSchema.parse(request.params.id));
      return note ?? reply.status(404).send({ error: "Long-term memory note not found" });
    });
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/notes/:id/extract",
      { bodyLimit: DRAFT_BODY_LIMIT_BYTES },
      async (request, reply) => {
        const id = ltmNoteIdSchema.parse(request.params.id);
        const body = ltmExtractSourceNoteRequestSchema.parse(request.body ?? {});
        const sourceNote = await storage.getNote(id);
        if (!sourceNote) return reply.status(404).send({ error: "Long-term memory note not found" });
        if (!isLtmSourceNote(sourceNote))
          return reply.status(400).send({ error: "Long-term memory note is not a source note" });
        const explicitChatId = body.chatId;
        const chatId =
          body.chatId ?? (sourceNote.provenance?.kind === "chat_summary" ? sourceNote.provenance.sourceId : undefined);
        const chat = chatId ? await getPackagePersistence().getChat(chatId) : null;
        if (explicitChatId && !chat) return reply.status(404).send({ error: "Chat not found" });
        const operationId = randomUUID();
        try {
          let languageModel;
          try {
            const extractionConfig = await getLtmExtractionConfig(root, body.mode);
            languageModel = await getPackageLanguageModels().resolveForRequest({
              connectionId: body.connectionId ?? extractionConfig.connectionId,
              chatConnectionId: chat?.connectionId ?? null,
              model: body.model,
            });
          } catch (error) {
            throw new LtmServiceError(
              error instanceof Error ? error.message : "Language model configuration is invalid",
              400,
              "ltm_model_configuration",
            );
          }
          return ltmExtractSourceNoteResponseSchema.parse(
            await processLongTermMemorySource({
              sourceNote,
              languageModel,
              scope: chat ? resolveChatLtmScope(chat) : sourceNote.scope,
              modes: chat ? [ltmModeForChatMode(chat.mode)] : body.mode ? [body.mode] : undefined,
              mode: body.mode,
              instruction: body.instruction,
              operationId,
              applyLowRisk: body.applyLowRisk,
              root,
              chatId: chat?.id,
            }),
          );
        } catch (error) {
          logger.error(error, "[ltm] Source note extraction route failed");
          const result = routeError(error, "Failed to extract long-term memory from source note");
          return reply.status(result.statusCode).send(result.body);
        }
      },
    );
    app.post<{ Body: unknown }>("/import/preview", { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES }, async (request) =>
      ltmInteropPreviewResponseSchema.parse(
        await previewPackageInterop(ltmInteropPreviewRequestSchema.parse(request.body ?? {}), root),
      ),
    );
    app.post<{ Body: unknown }>(
      "/import/lorebooks/preview",
      { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES },
      async (request) =>
        ltmLorebookPreviewResponseSchema.parse(
          await previewPackageLorebooks(ltmLorebookPreviewRequestSchema.parse(request.body ?? {}), root),
        ),
    );
    app.post<{ Body: unknown }>(
      "/import/source-notes",
      { bodyLimit: DRAFT_BODY_LIMIT_BYTES },
      async (request, reply) => {
        const controller = new AbortController(),
          abort = () => controller.abort();
        const body = ltmImportSourceNotesRequestSchema.parse(request.body ?? {});
        request.raw.once("aborted", abort);
        request.raw.once("close", () => {
          if (request.raw.aborted) abort();
        });
        try {
          return ltmImportSourceNotesResponseSchema.parse(await importPackageInterop(body, root, controller.signal));
        } catch (error) {
          const result = routeError(error, "Failed to import long-term memory sources");
          return reply.status(result.statusCode).send(result.body);
        } finally {
          request.raw.off("aborted", abort);
        }
      },
    );
    app.post<{ Body: unknown }>(
      "/notes/transfer-preview",
      { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES },
      async (request, reply) => {
        const body = ltmNoteTransferPreviewRequestSchema.parse(request.body ?? {});
        const chat = await getPackagePersistence().getChat(body.destinationChatId);
        if (!chat) return reply.status(404).send({ error: "Destination chat not found" });
        try {
          return ltmNoteTransferPreviewResponseSchema.parse(
            await previewLtmNoteTransfer(body, chat, { root, storage }),
          );
        } catch (error) {
          const result = routeError(error, "Failed to preview long-term memory transfer");
          return reply.status(result.statusCode).send(result.body);
        }
      },
    );
    app.post<{ Body: unknown }>(
      "/notes/transfer",
      { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES },
      async (request, reply) => {
        const body = ltmNoteTransferApplyRequestSchema.parse(request.body ?? {});
        const chat = await getPackagePersistence().getChat(body.destinationChatId);
        if (!chat) return reply.status(404).send({ error: "Destination chat not found" });
        try {
          return ltmNoteTransferApplyResponseSchema.parse(
            await applyLtmNoteTransfer(body, chat, {
              root,
              storage,
              rebuild: async () => {
                const result = await rebuildAfterMutation();
                return result.status === "complete"
                  ? {
                      generatedAt: result.generatedAt,
                      noteCount: result.noteCount,
                      chunkCount: result.chunkCount,
                      embeddedChunkCount: result.embeddedChunkCount,
                      embeddingsAvailable: result.embeddingsAvailable,
                    }
                  : null;
              },
            }),
          );
        } catch (error) {
          const result = routeError(error, "Failed to transfer long-term memory notes");
          return reply.status(result.statusCode).send(result.body);
        }
      },
    );
    app.post<{ Body: unknown }>("/notes/batch", { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES }, async (request, reply) => {
      const parsed = ltmBulkNoteRequestSchema.safeParse(request.body ?? {});
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
      const result = ltmBulkNoteResultSchema.parse(await storage.bulkMutateNotes(parsed.data));
      return {
        ...result,
        rebuild: result.affectedNoteIds.length ? await rebuildAfterMutation() : null,
      };
    });
    app.post<{ Body: unknown }>("/notes", { bodyLimit: NOTE_BODY_LIMIT_BYTES }, async (request, reply) => {
      const parsed = createNoteBody.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
      const validationError = vaultNoteValidationError(parsed.data);
      if (validationError) return reply.status(400).send({ error: validationError });
      try {
        const note = await storage.createNote(parsed.data);
        const rebuild = await rebuildAfterMutation(true);
        return reply.status(201).send({ note, rebuild });
      } catch (error) {
        if (error instanceof LtmServiceError)
          return reply.status(error.statusCode).send({ error: error.message, code: error.code });
        throw error;
      }
    });
    app.patch<{ Params: { id: string }; Body: unknown }>(
      "/notes/:id",
      { bodyLimit: NOTE_BODY_LIMIT_BYTES },
      async (request, reply) => {
        const parsedId = ltmNoteIdSchema.safeParse(request.params.id);
        const parsedBody = updateNoteBody.safeParse(request.body);
        if (!parsedId.success || !parsedBody.success) {
          const result = routeError(!parsedId.success ? parsedId.error : parsedBody.error, "Invalid note update.");
          return reply.status(result.statusCode).send(result.body);
        }
        const id = parsedId.data;
        const existing = await storage.getNote(id);
        if (!existing) return reply.status(404).send({ error: "Long-term memory note not found" });
        const patch = parsedBody.data;
        const validationError = vaultNoteValidationError({ ...existing, ...patch });
        if (validationError) return reply.status(400).send({ error: validationError });
        if (existing.type === "source" && patch.sections !== undefined)
          return reply.status(400).send({
            error: "Imported source content can only be updated by refreshing its source.",
          });
        if (patch.scope !== undefined && !isGlobalLtmScope(existing.scope) && isGlobalLtmScope(patch.scope))
          return reply.status(400).send({
            error:
              "Clearing every scope would make this memory global. Remove scope links with the scope-removal action instead; it safely deletes the memory when no explicit scope remains.",
          });
        let note;
        try {
          note = await storage.updateNote(id, patch);
        } catch (error) {
          const result = routeError(error, "Could not update note.");
          return reply.status(result.statusCode).send(result.body);
        }
        const rebuild = await rebuildAfterMutation(true);
        return { note, rebuild };
      },
    );
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/notes/:id/sections/rename-preview",
      { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES },
      async (request, reply) => {
        const parsedId = ltmNoteIdSchema.safeParse(request.params.id);
        const parsedBody = ltmRenameNoteSectionRequestSchema.safeParse(request.body);
        if (!parsedId.success || !parsedBody.success) {
          const result = routeError(!parsedId.success ? parsedId.error : parsedBody.error, "Invalid section rename.");
          return reply.status(result.statusCode).send(result.body);
        }
        try {
          return ltmRenameNoteSectionPreviewResponseSchema.parse(
            await storage.previewNoteSectionRename(
              parsedId.data,
              parsedBody.data.fromSectionKey,
              parsedBody.data.toSectionKey,
            ),
          );
        } catch (error) {
          const result = routeError(error, "Could not preview note section rename.");
          return reply.status(result.statusCode).send(result.body);
        }
      },
    );
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/notes/:id/sections/rename",
      { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES },
      async (request, reply) => {
        const parsedId = ltmNoteIdSchema.safeParse(request.params.id);
        const parsedBody = ltmRenameNoteSectionRequestSchema.safeParse(request.body);
        if (!parsedId.success || !parsedBody.success) {
          const result = routeError(!parsedId.success ? parsedId.error : parsedBody.error, "Invalid section rename.");
          return reply.status(result.statusCode).send(result.body);
        }
        try {
          const renamed = await storage.renameNoteSection(
            parsedId.data,
            parsedBody.data.fromSectionKey,
            parsedBody.data.toSectionKey,
          );
          const rebuildResult = await rebuildAfterMutation(true);
          return ltmRenameNoteSectionResponseSchema.parse({
            ...renamed,
            rebuild:
              rebuildResult.status === "complete"
                ? {
                    status: rebuildResult.status,
                    generatedAt: rebuildResult.generatedAt,
                    noteCount: rebuildResult.noteCount,
                    chunkCount: rebuildResult.chunkCount,
                    embeddedChunkCount: rebuildResult.embeddedChunkCount,
                    embeddingsAvailable: rebuildResult.embeddingsAvailable,
                  }
                : rebuildResult,
          });
        } catch (error) {
          const result = routeError(error, "Could not rename note section.");
          return reply.status(result.statusCode).send(result.body);
        }
      },
    );
    app.post<{ Params: { id: string }; Body: unknown }>("/notes/:id/scope/apply-to-derived", async (request, reply) => {
      const result = await applyLtmScopeLinksToDerivedNotes(
        ltmNoteIdSchema.parse(request.params.id),
        applyDerivedBody.parse(request.body ?? {}),
        { root },
      );
      return result ?? reply.status(404).send({ error: "Long-term memory note not found" });
    });
    app.delete<{ Params: { id: string } }>("/notes/:id", async (request, reply) => {
      const id = ltmNoteIdSchema.parse(request.params.id);
      if (!(await storage.getNote(id))) return reply.status(404).send({ error: "Long-term memory note not found" });
      const notes = await storage.archiveSourceNoteWithDerived(id);
      const rebuild = await rebuildAfterMutation();
      return { archived: true, note: notes[0], notes, rebuild };
    });
    app.post<{ Body: unknown }>("/notes/permanent-delete", async (request, reply) => {
      const body = z
        .object({
          ids: z.array(ltmNoteIdSchema).min(1).max(500),
          retractExtracted: z.boolean().optional().default(false),
          excludedNoteIds: z.array(ltmNoteIdSchema).max(500).optional(),
          lineageSourceNoteId: ltmNoteIdSchema.optional(),
          expectedLineageNoteIds: z.array(ltmNoteIdSchema).max(1_000).optional(),
        })
        .strict()
        .parse(request.body ?? {});
      try {
        const result = await storage.deleteNotesPermanently(body.ids, {
          retractExtracted: body.retractExtracted,
          excludedNoteIds: body.excludedNoteIds,
          lineageSourceNoteId: body.lineageSourceNoteId,
          expectedLineageNoteIds: body.expectedLineageNoteIds,
        });
        const rebuild = result.deletedIds.length ? await rebuildAfterMutation() : null;
        return {
          deletedIds: result.deletedIds,
          failedIds: result.failedIds,
          detachedNoteIds: result.detachedNoteIds,
          rebuild,
        };
      } catch (error) {
        const result = routeError(error, "Could not permanently delete memories.");
        return reply.status(result.statusCode).send(result.body);
      }
    });
    app.delete<{ Params: { id: string }; Body: unknown }>("/notes/:id/scope/current-chat", async (request, reply) => {
      const id = ltmNoteIdSchema.parse(request.params.id);
      const { chatId } = removeCurrentChatBody.parse(request.body ?? {});
      if (!(await getPackagePersistence().getChat(chatId))) return reply.status(404).send({ error: "Chat not found" });
      let result;
      try {
        result = await storage.removeNoteFromScope(id, {
          chatIds: [chatId],
        });
      } catch (error) {
        const result = routeError(error, "Could not remove memory from scope");
        return reply.status(result.statusCode).send(result.body);
      }
      const rebuild = result.changed ? await rebuildAfterMutation() : null;
      return result.deleted
        ? { deleted: true, unscoped: false, id, rebuild }
        : {
            deleted: false,
            unscoped: result.changed,
            id,
            note: result.note,
            rebuild,
          };
    });
    app.delete<{ Params: { id: string }; Body: unknown }>("/notes/:id/scope", async (request, reply) => {
      const id = ltmNoteIdSchema.parse(request.params.id);
      let result;
      try {
        result = await storage.removeNoteFromScope(id, removeScopeBody.parse(request.body ?? {}));
      } catch (error) {
        const result = routeError(error, "Could not remove memory from scope");
        return reply.status(result.statusCode).send(result.body);
      }
      const rebuild = result.changed ? await rebuildAfterMutation() : null;
      return result.deleted
        ? { deleted: true, unscoped: false, id, rebuild }
        : {
            deleted: false,
            unscoped: result.changed,
            id,
            note: result.note,
            rebuild,
          };
    });
    app.post("/rebuild", async () => rebuildLongTermMemoryIndexes({ root }));
    app.get("/integrity", async () => ltmIntegrityResponseSchema.parse(await checkLongTermMemoryIntegrity(root)));
    app.post<{ Body: unknown }>("/repair", { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES }, async (request) => {
      const body = ltmRepairRequestSchema.parse(request.body);
      return ltmRepairResponseSchema.parse(await repairLongTermMemory(body.actions, root));
    });
    app.post<{ Body: unknown }>(
      "/identity-repair/preview",
      { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES },
      async (request, reply) => {
        try {
          const body = ltmIdentityRepairPreviewRequestSchema.parse(request.body ?? {}),
            catalog = await loadTrustedLtmSubjectCatalog(body.scope, root);
          return ltmIdentityRepairPreviewResponseSchema.parse(
            previewLtmIdentityRepairs(catalog, body.scope, undefined, body.canonicalNoteIds),
          );
        } catch (error) {
          if (error instanceof LtmIdentityRepairError)
            return reply.status(error.statusCode).send({
              error: error.message,
              code: error.code,
            });
          throw error;
        }
      },
    );
    app.post<{ Body: unknown }>(
      "/identity-repair/apply",
      { bodyLimit: IDENTITY_REPAIR_BODY_LIMIT_BYTES },
      async (request, reply) => {
        const body = ltmIdentityRepairApplyRequestSchema.parse(request.body ?? {});
        try {
          return ltmIdentityRepairApplyResponseSchema.parse(
            await applyLtmIdentityRepairs(body, {
              root,
              loadCatalog: () => loadTrustedLtmSubjectCatalog(body.scope, root),
            }),
          );
        } catch (error) {
          return reply.status(error instanceof LtmIdentityRepairError ? error.statusCode : 500).send({
            error: error instanceof Error ? error.message : "Failed to repair long-term memory identities",
            code: error instanceof LtmIdentityRepairError ? error.code : "identity_repair_failed",
          });
        }
      },
    );
    app.post<{ Body: unknown }>("/search", { bodyLimit: SEARCH_BODY_LIMIT_BYTES }, async (request) =>
      retrieveLongTermMemory({ ...searchBody.parse(request.body), root }),
    );
    app.get<{ Querystring: unknown }>("/drafts", async (request) =>
      draftStore.listDrafts(draftQuery.parse(request.query)),
    );
    app.get<{ Querystring: unknown }>("/drafts/pending-count", async (request) => ({
      count: (
        await draftStore.listDrafts({
          ...draftQuery.parse(request.query),
          status: "pending",
        })
      ).length,
    }));
    app.get<{ Querystring: unknown }>("/drafts/review", async (request) => {
      const query = draftReviewQuery.parse(request.query);
      return ltmDraftReviewResponseSchema.parse(
        await projectLongTermMemoryDraftReview({
          root,
          sourceNoteId: query.sourceNoteId,
          chatId: query.chatId,
          status: query.status,
          includeInvalidated: query.includeInvalidated,
        }),
      );
    });
    app.get<{ Querystring: unknown }>("/rejected-suggestions", async (request) => {
      const query = rejectedSuggestionsQuery.parse(request.query);
      const suggestions = await listRejectedSuggestions(query, root);
      return ltmRejectedSuggestionsResponseSchema.parse({ suggestions, total: suggestions.length });
    });
    app.delete<{ Params: { id: string } }>("/rejected-suggestions/:id", async (request, reply) => {
      const parsed = z.string().uuid().safeParse(request.params.id);
      if (!parsed.success)
        return reply.status(400).send({ error: "Invalid rejected-suggestion ID", code: "ltm_invalid_request" });
      return deleteRejectedSuggestion(parsed.data, root);
    });
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/drafts/:id/accept",
      { bodyLimit: DRAFT_BODY_LIMIT_BYTES },
      async (request, reply) => {
        const id = z.string().uuid().parse(request.params.id);
        const body = acceptDraftBody.parse(request.body ?? {});
        try {
          return await applyLongTermMemoryDraft(id, {
            root,
            actor: "maintenance_api",
            mutationIds: body.mutationIds,
            editedMutations: body.editedMutations,
            autoApplyLowRiskOnly: body.lowRiskOnly,
            operationId: randomUUID(),
          });
        } catch (error) {
          const result = routeError(error, "Failed to apply long-term memory draft");
          return reply.status(result.statusCode).send(result.body);
        }
      },
    );
    app.post<{ Params: { id: string }; Body: unknown }>("/drafts/:id/skip", async (request, reply) => {
      const id = z.string().uuid().parse(request.params.id);
      const body = z
        .object({ mutationIds: z.array(z.string().uuid()).min(1) })
        .strict()
        .parse(request.body ?? {});
      const result = await draftStore.deleteDraftMutations(id, body.mutationIds);
      if (!result.deleted)
        return reply.status(result.reason === "not_pending" ? 409 : 404).send({
          error:
            result.reason === "not_pending"
              ? "Long-term memory draft is not pending"
              : "Long-term memory draft mutation not found",
        });
      return {
        deleted: true,
        draftId: id,
        mutationIds: result.mutationIds,
        draft: result.draft,
      };
    });
    app.delete<{ Params: { id: string } }>("/drafts/:id", async (request, reply) => {
      const id = z.string().uuid().parse(request.params.id);
      if (!(await draftStore.deleteDraft(id)))
        return reply.status(404).send({ error: "Long-term memory draft not found" });
      return { deleted: true, id };
    });
  };
}
