import { randomUUID } from "node:crypto";
import { readdir, readFile, unlink } from "node:fs/promises";
import { logger } from "./package-runtime.js";
import { isEnoent, nowIso } from "./ltm-utils.js";
import {
  isLtmSourceLikeNote,
  ltmExtractionDraftSchema,
  ltmDraftStatusSchema,
  type LtmExtractionDraft,
  type LtmExtractionAccounting,
  type LtmExtractionDiagnostic,
  type LtmExtractionOutcome,
  type LtmExtractionResponse,
  type LtmMode,
  type LtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import { getLongTermMemoryDirectories, getLongTermMemoryRoot, safeJoin } from "./paths.js";
import { LongTermMemoryStorage } from "./storage.js";
import { extractionFingerprintForLtmSourceNote, sourceHashForLtmSourceNote } from "./source-hash.js";
import { withLtmVaultLock } from "./vault-lock.js";

export interface CreateLtmExtractionDraftInput {
  scope?: LtmScope;
  modes: LtmMode[];
  source: LtmExtractionDraft["source"];
}

export interface StoreLtmDraftOptions extends CreateLtmExtractionDraftInput {
  root?: string;
  summary?: string;
  response: LtmExtractionResponse;
  operationId?: string;
  diagnostics?: LtmExtractionDiagnostic[];
  outcome?: LtmExtractionOutcome;
  accounting?: LtmExtractionAccounting;
  reviewRequired?: boolean;
  afterWrite?: (draft: LtmExtractionDraft) => Promise<void>;
}

class LtmSupersessionError extends Error {
  constructor(
    cause: unknown,
    readonly superseded: LtmExtractionDraft[],
  ) {
    super("Long-Term Memory draft supersession failed", { cause });
  }
}

export type LtmDraftListFilter = {
  status?: LtmExtractionDraft["status"];
  chatId?: string;
};

function draftPathForId(id: string, root = getLongTermMemoryRoot()) {
  return safeJoin(getLongTermMemoryDirectories(root).drafts, `${id}.json`);
}

function sourceDraftLockKey(root: string, sourceNoteId: string) {
  return `${root}\0source:${sourceNoteId}`;
}

const draftWriteLocks = new Map<string, Promise<void>>();

async function withDraftWriteLock<T>(path: string, operation: () => Promise<T>): Promise<T> {
  const previous = draftWriteLocks.get(path) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(
    () => current,
    () => current,
  );
  draftWriteLocks.set(path, tail);

  try {
    await previous.catch(() => {});
    return await operation();
  } finally {
    release();
    if (draftWriteLocks.get(path) === tail) draftWriteLocks.delete(path);
  }
}

export class LongTermMemoryDraftStore {
  readonly root: string;
  private readonly storage: LongTermMemoryStorage;

  constructor(root = getLongTermMemoryRoot()) {
    this.root = root;
    this.storage = new LongTermMemoryStorage(root);
  }

  private get dirs() {
    return getLongTermMemoryDirectories(this.root);
  }

  async initialize() {
    await this.storage.initializeLtmStore();
  }

  async withDraftLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
    await this.initialize();
    return withLtmVaultLock(this.root, () => withDraftWriteLock(draftPathForId(id, this.root), operation));
  }

  async createDraft(options: StoreLtmDraftOptions) {
    await this.initialize();
    if (!options.source?.sourceNoteId) {
      throw new Error("Long-term memory drafts must be tied to a source note.");
    }
    const sourceNoteId = options.source.sourceNoteId;
    const { draft, afterWrite } = await withLtmVaultLock(this.root, () =>
      withDraftWriteLock(sourceDraftLockKey(this.root, sourceNoteId), async () => {
        const sourceNote = await this.storage.getNote(sourceNoteId);
        const source = {
          ...options.source,
          ...(!options.source.sourceHash && sourceNote && isLtmSourceLikeNote(sourceNote)
            ? { sourceHash: sourceHashForLtmSourceNote(sourceNote) }
            : {}),
          ...(!options.source.extractionFingerprint && sourceNote && isLtmSourceLikeNote(sourceNote)
            ? {
                extractionFingerprint: extractionFingerprintForLtmSourceNote(sourceNote, {
                  extractionMode: options.modes.find((mode) => sourceNote.modes.includes(mode)) ?? sourceNote.modes[0],
                }),
              }
            : {}),
        };
        const timestamp = nowIso();
        const candidateCount = options.response.mutations.length;
        const draft = ltmExtractionDraftSchema.parse({
          id: randomUUID(),
          status: "pending",
          createdAt: timestamp,
          updatedAt: timestamp,
          operationId: options.operationId ?? randomUUID(),
          reviewRequired: options.reviewRequired ?? false,
          source,
          scope: options.scope ?? {},
          modes: options.modes,
          summary: options.summary ?? options.response.summary ?? "",
          mutations: options.response.mutations,
          diagnostics: options.diagnostics ?? [],
          extractionOutcome: options.outcome ?? {
            state: candidateCount > 0 ? "success" : "no_suggestions_created",
            totalCandidates: candidateCount,
            keptUnits: candidateCount,
            droppedUnits: 0,
            droppedCandidates: [],
            droppedCandidateDetailsTruncated: false,
          },
          accounting: options.accounting ?? {
            providerCandidates: candidateCount,
            normalizedAdditions: 0,
            parserRejections: 0,
            validationRejections: 0,
            deduplications: 0,
            keptUnits: candidateCount,
          },
        });
        await writeJsonAtomic(draftPathForId(draft.id, this.root), draft);
        let superseded: LtmExtractionDraft[] = [];
        try {
          superseded = await this.supersedeOlderPendingDrafts(draft);
        } catch (error) {
          if (error instanceof LtmSupersessionError) superseded = error.superseded;
          const rollback = await Promise.allSettled([
            unlink(draftPathForId(draft.id, this.root)),
            ...superseded.map((previous) =>
              writeJsonAtomic(draftPathForId(previous.id, this.root), previous),
            ),
          ]);
          const failures = rollback.flatMap((result) =>
            result.status === "rejected" ? [result.reason] : [],
          );
          if (failures.length)
            throw new AggregateError([error, ...failures], "Long-Term Memory draft creation and rollback both failed.");
          throw error;
        }
        return { draft, afterWrite: options.afterWrite };
      }),
    );
    if (afterWrite) await afterWrite(draft);
    return draft;
  }

  private async supersedeOlderPendingDrafts(replacement: LtmExtractionDraft) {
    const pending = (await this.listDrafts({ status: "pending" })).filter(
      (draft) => draft.id !== replacement.id && draft.source.sourceNoteId === replacement.source.sourceNoteId,
    );
    const updated: LtmExtractionDraft[] = [];
    try {
      for (const older of pending) {
        await this.withDraftLock(older.id, async () => {
          const current = await this.getDraft(older.id);
          if (!current || current.status !== "pending") return;
          const next = ltmExtractionDraftSchema.parse({
            ...current,
            status: "superseded",
            updatedAt: nowIso(),
            supersededAt: nowIso(),
            supersededByDraftId: replacement.id,
          });
          await writeJsonAtomic(draftPathForId(current.id, this.root), next);
          updated.push(current);
        });
      }
      return updated;
    } catch (error) {
      throw new LtmSupersessionError(error, updated);
    }
  }

  async listDrafts(filter: LtmDraftListFilter = {}) {
    await this.initialize();
    const entries = await readdir(this.dirs.drafts, { withFileTypes: true });
    const drafts: LtmExtractionDraft[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      let raw: unknown;
      try {
        raw = JSON.parse(await readFile(safeJoin(this.dirs.drafts, entry.name), "utf8"));
      } catch {
        continue;
      }
      const parsed = ltmExtractionDraftSchema.safeParse(raw);
      if (!parsed.success) {
        continue;
      }
      const draft = parsed.data;
      if (filter.status && draft.status !== filter.status) continue;
      if (filter.chatId && draft.source.chatId !== filter.chatId) continue;
      drafts.push(draft);
    }
    return drafts.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  }

  async getDraft(id: string) {
    await this.initialize();
    return readJsonFile(draftPathForId(id, this.root), null).then((value) =>
      value ? ltmExtractionDraftSchema.parse(value) : null,
    );
  }

  async updateDraftStatus(id: string, status: LtmExtractionDraft["status"], patch: Partial<LtmExtractionDraft> = {}) {
    const parsedStatus = ltmDraftStatusSchema.parse(status);
    return withLtmVaultLock(this.root, () => this.updateDraftStatusUnlocked(id, parsedStatus, patch));
  }

  async updateDraftStatusUnlocked(id: string, status: LtmExtractionDraft["status"], patch: Partial<LtmExtractionDraft> = {}) {
    return this.updateDraftUnlocked(id, { ...patch, status: ltmDraftStatusSchema.parse(status) });
  }

  async updateDraft(id: string, patch: Partial<Omit<LtmExtractionDraft, "id" | "createdAt" | "updatedAt">>) {
    return withLtmVaultLock(this.root, () => this.updateDraftUnlocked(id, patch));
  }

  async updateDraftUnlocked(id: string, patch: Partial<Omit<LtmExtractionDraft, "id" | "createdAt" | "updatedAt">>) {
    const draft = await this.getDraft(id);
    if (!draft) return null;
    const next = ltmExtractionDraftSchema.parse({
      ...draft,
      ...patch,
      id: draft.id,
      createdAt: draft.createdAt,
      updatedAt: nowIso(),
      appliedAt: patch.appliedAt ?? draft.appliedAt,
      appliedMutationIds: patch.appliedMutationIds ?? draft.appliedMutationIds,
      skippedMutationIds: patch.skippedMutationIds ?? draft.skippedMutationIds,
    });
    await writeJsonAtomic(draftPathForId(id, this.root), next);
    return next;
  }

  async deleteDraft(id: string) {
    await this.initialize();
    return withLtmVaultLock(this.root, async () => {
      try {
        await unlink(draftPathForId(id, this.root));
        return true;
      } catch (err) {
        if (isEnoent(err)) return false;
        logger.warn(err, "[ltm] Failed to delete draft %s", id);
        throw err;
      }
    });
  }

  async deleteDraftMutation(id: string, mutationId: string) {
    const result = await this.deleteDraftMutations(id, [mutationId]);
    if (!result.deleted) return result;
    return { draft: result.draft, deleted: true as const };
  }

  async deleteDraftMutations(id: string, mutationIds: string[]) {
    return withLtmVaultLock(this.root, async () => {
      const draft = await this.getDraft(id);
      if (!draft) return { draft: null, deleted: false as const, reason: "not_found" as const };
      if (draft.status !== "pending") return { draft, deleted: false as const, reason: "not_pending" as const };
      const uniqueMutationIds = Array.from(new Set(mutationIds));
      const draftMutationIds = new Set(draft.mutations.map((mutation) => mutation.id));
      if (uniqueMutationIds.some((mutationId) => !draftMutationIds.has(mutationId))) {
        return { draft, deleted: false as const, reason: "not_found" as const };
      }

      const mutationIdSet = new Set(uniqueMutationIds);
      const eventNoteIds = new Set(
        draft.mutations.flatMap((mutation) =>
          mutation.kind === "create_note" && mutation.note.type === "timeline_event"
            ? [mutation.note.id]
            : [],
        ),
      );
      let expanded = true;
      while (expanded) {
        expanded = false;
        const removedNoteIds = new Set(
          draft.mutations.flatMap((mutation) =>
            mutationIdSet.has(mutation.id) && mutation.kind === "create_note"
              ? [mutation.note.id]
              : [],
          ),
        );
        const invalidatedNoteIds = new Set(
          draft.mutations.flatMap((mutation) =>
            mutationIdSet.has(mutation.id) &&
            mutation.kind === "add_link" &&
            eventNoteIds.has(mutation.link.target)
              ? [mutation.noteId]
              : [],
          ),
        );
        for (const mutation of draft.mutations) {
          if (mutationIdSet.has(mutation.id)) continue;
          const dependsOnRemoved =
            mutation.kind === "create_note"
              ? mutation.note.links.some((link) => removedNoteIds.has(link.target))
              : mutation.kind === "add_link"
                ? invalidatedNoteIds.has(mutation.noteId) || removedNoteIds.has(mutation.noteId) || removedNoteIds.has(mutation.link.target)
                : removedNoteIds.has(mutation.noteId) ||
                  (mutation.claimKind === "change" && invalidatedNoteIds.has(mutation.noteId));
          if (dependsOnRemoved) {
            mutationIdSet.add(mutation.id);
            expanded = true;
          }
        }
      }
      const nextMutations = draft.mutations.filter((mutation) => !mutationIdSet.has(mutation.id));
      if (nextMutations.length === 0) {
        await this.deleteDraft(id);
        return { draft: null, deleted: true as const, mutationIds: [...mutationIdSet] };
      }
      const next = await this.updateDraft(id, { mutations: nextMutations });
      return { draft: next, deleted: true as const, mutationIds: [...mutationIdSet] };
    });
  }
}
