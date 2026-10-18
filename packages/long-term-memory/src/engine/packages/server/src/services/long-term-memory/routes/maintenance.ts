import { readFile, stat } from "node:fs/promises";
import { z } from "zod";
import {
  ltmDebugPhaseSchema,
  ltmDebugStatusSchema,
  ltmNoteIdSchema,
  ltmIntegrityResponseSchema,
  ltmIdentityRepairApplyRequestSchema,
  ltmIdentityRepairApplyResponseSchema,
  ltmIdentityRepairPreviewRequestSchema,
  ltmIdentityRepairPreviewResponseSchema,
  ltmNoteForkApplyRequestSchema,
  ltmNoteForkApplyResponseSchema,
  ltmNoteForkPreviewRequestSchema,
  ltmNoteForkPreviewResponseSchema,
  ltmRepairRequestSchema,
  ltmRepairResponseSchema,
  ltmStatusResponseSchema,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { clearLtmDebugLog, exportLtmDebugLog, readLtmDebugLog } from "../maintenance/debug-log.js";
import { isEnoent } from "../ltm-utils.js";
import { checkLongTermMemoryIntegrity, repairLongTermMemory } from "../maintenance/maintenance.js";
import { applyLtmNoteForkRepair, previewLtmNoteForkRepair } from "../identity/note-fork-repair.js";
import { resolvePackageEmbeddingAdapter } from "../package-runtime.js";
import { getLongTermMemoryDirectories, LTM_DIR_NAME } from "../persistence/paths.js";
import { longTermMemoryRecallIndexPath, parseLtmRecallIndex, rebuildLongTermMemoryIndexes } from "../recall/rebuild.js";
import { readLtmIndexState, readLtmNoteSummary } from "../persistence/index-state.js";
import { readLtmActivityEvents } from "../persistence/activity-index.js";
import { CURRENT_LTM_CHUNK_FORMAT_VERSION } from "../recall/chunking.js";
import { readLongTermMemoryAttempt, readLongTermMemoryInjectionReceipt } from "../recall/usage.js";
import {
  applyLtmIdentityRepairs,
  LtmIdentityRepairError,
  previewLtmIdentityRepairs,
} from "../identity/identity-repair.js";
import { loadTrustedLtmSubjectCatalog } from "../identity/subject-identity.js";
import {
  deleteAllLongTermMemoryData,
  exportLongTermMemoryData,
  parseLongTermMemoryBackup,
  previewLongTermMemoryBackup,
  replaceLongTermMemoryData,
} from "../persistence/backup-restore.js";
import type { FastifyInstance } from "fastify";
import {
  MAINTENANCE_BODY_LIMIT_BYTES,
  IDENTITY_REPAIR_BODY_LIMIT_BYTES,
  BACKUP_BODY_LIMIT_BYTES,
  routeError,
  type LtmRouteRuntime,
} from "./shared.js";

const noteEventsQuery = z
  .object({
    noteId: ltmNoteIdSchema,
    limit: z.coerce.number().int().min(1).max(20).default(5),
  })
  .strict();
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

export function registerMaintenanceRoutes(app: FastifyInstance, runtime: LtmRouteRuntime) {
  const { root, storage, draftStore } = runtime;
  app.get("/status", async () => {
    await storage.initializeLtmStore();
    const dirs = getLongTermMemoryDirectories(root);
    const events = await stat(dirs.eventLog).then(
      (info) => ({ logAvailable: true, bytes: info.size }),
      () => ({ logAvailable: false, bytes: 0 }),
    );
    const [summary, pendingDrafts, state, indexResult, embeddingAdapter] = await Promise.all([
      readLtmNoteSummary(root),
      draftStore.listDrafts({ status: "pending" }),
      readLtmIndexState(root),
      readFile(longTermMemoryRecallIndexPath(root), "utf8")
        .then((value) => ({
          index: parseLtmRecallIndex(JSON.parse(value)),
          corrupt: false,
        }))
        .catch((error) => ({ index: null, corrupt: !isEnoent(error) })),
      // A host that cannot resolve embeddings means recall cannot use vectors either.
      resolvePackageEmbeddingAdapter().catch(() => null),
    ]);
    const { index } = indexResult;
    const chunks = index ? Object.values(index.metadata.chunks) : [];
    const hasVectors = Boolean(index?.embeddings.embeddedChunkCount);
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
        // Vectors only count while they belong to the source recall would embed with now.
        embeddingsAvailable:
          hasVectors && Boolean(embeddingAdapter) && index?.embeddings.spaceId === embeddingAdapter?.spaceId,
        embeddedChunkCount: index?.embeddings.embeddedChunkCount ?? 0,
        embeddingSource: embeddingAdapter?.label.slice(0, 240) || null,
        indexedEmbeddingSource: hasVectors ? (index?.embeddings.model ?? null) : null,
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
    const [receipt, observedAttempt] = await Promise.all([
      readLongTermMemoryInjectionReceipt(request.params.chatId, root),
      readLongTermMemoryAttempt(request.params.chatId, root),
    ]);
    const attempt = observedAttempt
      ? { ...observedAttempt, confirmed: receipt?.attemptId === observedAttempt.attemptId }
      : null;
    if (!receipt)
      return {
        memoryCount: 0,
        tokenCount: 0,
        memories: [],
        state: "not_recorded" as const,
        dispatchedAt: null,
        attempt,
      };
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
      attempt,
    };
  });
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
  app.post<{ Body: unknown }>(
    "/fork-repair/preview",
    { bodyLimit: MAINTENANCE_BODY_LIMIT_BYTES },
    async (request, reply) => {
      try {
        return ltmNoteForkPreviewResponseSchema.parse(
          await previewLtmNoteForkRepair(ltmNoteForkPreviewRequestSchema.parse(request.body ?? {}), { root }),
        );
      } catch (error) {
        const result = routeError(error, "Could not preview long-term memory fork repair");
        return reply.status(result.statusCode).send(result.body);
      }
    },
  );
  app.post<{ Body: unknown }>(
    "/fork-repair/apply",
    { bodyLimit: IDENTITY_REPAIR_BODY_LIMIT_BYTES },
    async (request, reply) => {
      try {
        return ltmNoteForkApplyResponseSchema.parse(
          await applyLtmNoteForkRepair(ltmNoteForkApplyRequestSchema.parse(request.body ?? {}), { root }),
        );
      } catch (error) {
        const result = routeError(error, "Could not apply long-term memory fork repair");
        return reply.status(result.statusCode).send(result.body);
      }
    },
  );
}
