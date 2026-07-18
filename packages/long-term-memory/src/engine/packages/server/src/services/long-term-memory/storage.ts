import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import {
  ltmBulkNoteRequestSchema,
  ltmBulkNoteResultSchema,
  ltmDraftNoteInputSchema,
  ltmExtractionDraftSchema,
  ltmEventSchema,
  ltmGlobalSettingsSchema,
  ltmNoteIdSchema,
  ltmNoteSchema,
  ltmNoteTypeSchema,
  ltmPoliciesConfigSchema,
  ltmRetentionConfigSchema,
  ltmRetrievalConfigSchema,
  type LtmNote,
  type LtmBulkNoteResult,
  type LtmNoteType,
  type LtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  getLtmScopeChatIds,
  matchesLtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/scope.js";
import {
  DEFAULT_LTM_POLICIES,
  DEFAULT_LTM_RETENTION_CONFIG,
  DEFAULT_LTM_RETRIEVAL_CONFIG,
} from "./default-config.js";
import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import {
  commitLtmMutation,
  recoverLtmMutations,
} from "./mutation-transaction.js";
import { isEnoent, nowIso } from "./ltm-utils.js";
import {
  getLongTermMemoryDirectories,
  getLongTermMemoryRoot,
  LTM_VAULT_FOLDERS,
  notePathForId,
  safeJoin,
  vaultFolderForNoteType,
} from "./paths.js";
import { recoverInterruptedLtmBackupRestore } from "./restore-recovery.js";
import {
  longTermMemoryRetentionConfigPath,
  runLongTermMemoryRetention,
} from "./retention.js";
import { longTermMemoryUsagePath, readLongTermMemoryUsage } from "./usage.js";
import { parseStoredLtmNote } from "./stored-note.js";
import { withLtmVaultLock } from "./vault-lock.js";
import {
  extractionFingerprintForLtmSourceNote,
  sourceHashForLtmSourceNote,
} from "./source-hash.js";

export type UpdateLtmNotePatch = Partial<
  Omit<LtmNote, "id" | "createdAt" | "updatedAt" | "version">
>;

function rewriteDraftMutationNoteIds(
  mutation: unknown,
  fromId: string,
  toId: string,
) {
  if (!mutation || typeof mutation !== "object" || Array.isArray(mutation))
    return mutation;
  const next = { ...(mutation as Record<string, unknown>) };
  if (next.noteId === fromId) next.noteId = toId;
  if (
    next.kind === "create_note" &&
    next.note &&
    typeof next.note === "object" &&
    !Array.isArray(next.note)
  ) {
    const note = { ...(next.note as Record<string, unknown>) };
    if (note.id === fromId) note.id = toId;
    if (Array.isArray(note.links))
      note.links = note.links.map((link) =>
        link &&
        typeof link === "object" &&
        !Array.isArray(link) &&
        (link as Record<string, unknown>).target === fromId
          ? { ...(link as Record<string, unknown>), target: toId }
          : link,
      );
    next.note = note;
  }
  if (
    next.kind === "add_link" &&
    next.link &&
    typeof next.link === "object" &&
    !Array.isArray(next.link) &&
    (next.link as Record<string, unknown>).target === fromId
  )
    next.link = { ...(next.link as Record<string, unknown>), target: toId };
  return next;
}
const initialized = new Set<string>();
export class LongTermMemoryStorage {
  constructor(readonly root = getLongTermMemoryRoot()) {}
  async initializeLtmStore() {
    return withLtmVaultLock(this.root, async () => {
      if (initialized.has(this.root)) return;
      await recoverInterruptedLtmBackupRestore(this.root);
      const dirs = getLongTermMemoryDirectories(this.root);
      await Promise.all([
        mkdir(dirs.events, { recursive: true }),
        mkdir(dirs.indexes, { recursive: true }),
        mkdir(dirs.config, { recursive: true }),
        mkdir(dirs.drafts, { recursive: true }),
        mkdir(dirs.transactions, { recursive: true }),
        mkdir(dirs.receipts, { recursive: true }),
        ...LTM_VAULT_FOLDERS.map((f) =>
          mkdir(safeJoin(dirs.vault, f), { recursive: true }),
        ),
      ]);
      await recoverLtmMutations(this.root);
      const configs = [
        [
          safeJoin(dirs.config, "policies.json"),
          ltmPoliciesConfigSchema,
          DEFAULT_LTM_POLICIES,
        ],
        [
          safeJoin(dirs.config, "retrieval.json"),
          ltmRetrievalConfigSchema,
          DEFAULT_LTM_RETRIEVAL_CONFIG,
        ],
        [
          longTermMemoryRetentionConfigPath(this.root),
          ltmRetentionConfigSchema,
          DEFAULT_LTM_RETENTION_CONFIG,
        ],
        [
          safeJoin(dirs.config, "settings.json"),
          ltmGlobalSettingsSchema,
          { version: 1 },
        ],
      ] as const;
      for (const [path, schema, fallback] of configs) {
        const parsed = schema.parse(await readJsonFile(path, fallback));
        await writeJsonAtomic(path, parsed);
      }
      initialized.add(this.root);
      await runLongTermMemoryRetention({ root: this.root }).catch(() => {});
    });
  }
  async listNotes(
    filter: {
      type?: LtmNoteType;
      status?: LtmNote["status"];
      tag?: string;
      scope?: LtmScope;
      characterIds?: string[];
      includeGlobal?: boolean;
    } = {},
  ) {
    await this.initializeLtmStore();
    const notes: LtmNote[] = [];
    const dirs = getLongTermMemoryDirectories(this.root);
    const folders = filter.type
      ? [vaultFolderForNoteType(filter.type)]
      : LTM_VAULT_FOLDERS;
    for (const folder of folders)
      for (const entry of await readdir(safeJoin(dirs.vault, folder), {
        withFileTypes: true,
      }))
        if (entry.isFile() && entry.name.endsWith(".json")) {
          const note = parseStoredLtmNote(
            JSON.parse(
              await readFile(
                safeJoin(dirs.vault, `${folder}/${entry.name}`),
                "utf8",
              ),
            ),
          );
          if (vaultFolderForNoteType(note.type) !== folder)
            throw new Error(
              `Long-term memory note ${note.id} has type ${note.type} but is stored in ${folder}.`,
            );
          if (filter.status && note.status !== filter.status) continue;
          if (filter.tag && !note.tags.includes(filter.tag)) continue;
          if (
            (filter.scope ||
              filter.characterIds?.length ||
              filter.includeGlobal === false) &&
            !matchesLtmScope(note, {
              scope: filter.scope,
              characterIds: filter.characterIds,
              includeGlobal: filter.includeGlobal,
            })
          )
            continue;
          notes.push(note);
        }
    return notes.sort((a, b) => a.id.localeCompare(b.id));
  }
  async getNote(id: string) {
    const wanted = ltmNoteIdSchema.parse(id);
    return (await this.listNotes()).find((n) => n.id === wanted) ?? null;
  }
  async getNotesByIds(ids: string[]) {
    const wanted = new Set(ids.map((id) => ltmNoteIdSchema.parse(id)));
    if (!wanted.size) return new Map<string, LtmNote>();
    return new Map(
      (await this.listNotes())
        .filter((note) => wanted.has(note.id))
        .map((note) => [note.id, note]),
    );
  }
  async createNote(input: unknown) {
    await this.initializeLtmStore();
    const timestamp = nowIso();
    const draft = ltmDraftNoteInputSchema.parse(input);
    const note = ltmNoteSchema.parse({
      ...draft,
      createdAt: (draft as any).createdAt ?? timestamp,
      updatedAt: (draft as any).updatedAt ?? timestamp,
      version: (draft as any).version ?? 1,
    });
    return withLtmVaultLock(this.root, async () => {
      if (await this.getNote(note.id))
        throw new Error(`Long-term memory note already exists: ${note.id}`);
      const event = ltmEventSchema.parse({
        id: randomUUID(),
        ts: nowIso(),
        type: `${note.type}.created`,
        target: note.id,
        payload: { note },
      });
      await commitLtmMutation(this.root, {
        files: [
          {
            path: notePathForId(note.id, note.type, this.root),
            before: null,
            after: note,
          },
        ],
        events: [event],
      });
      return note;
    });
  }
  async projectNote(
    id: string,
    type: LtmNoteType,
    projector: (current: LtmNote | null) => LtmNote,
  ) {
    await this.initializeLtmStore();
    const noteId = ltmNoteIdSchema.parse(id);
    const noteType = ltmNoteTypeSchema.parse(type);
    const path = notePathForId(noteId, noteType, this.root);
    return withLtmVaultLock(this.root, async () => {
      let current: LtmNote | null = null;
      try {
        current = parseStoredLtmNote(JSON.parse(await readFile(path, "utf8")));
      } catch (error) {
        if (!isEnoent(error)) throw error;
      }
      const projected = projector(current);
      if (projected === current)
        return { note: current, created: false, changed: false };
      const timestamp = nowIso();
      const next = ltmNoteSchema.parse({
        ...projected,
        id: noteId,
        type: noteType,
        createdAt: current?.createdAt ?? projected.createdAt ?? timestamp,
        updatedAt: projected.updatedAt ?? timestamp,
        version: current ? current.version + 1 : (projected.version ?? 1),
      });
      const event = ltmEventSchema.parse({
        id: randomUUID(),
        ts: timestamp,
        type: `${noteType}.${current ? "updated" : "created"}`,
        target: noteId,
        payload: { note: next },
      });
      await commitLtmMutation(this.root, {
        files: [{ path, before: current, after: next }],
        events: [event],
      });
      return { note: next, created: !current, changed: true };
    });
  }
  async updateNote(id: string, patch: UpdateLtmNotePatch) {
    await this.initializeLtmStore();
    return withLtmVaultLock(this.root, async () => {
      const current = await this.getNote(id);
      if (!current) throw new Error(`Long-term memory note not found: ${id}`);
      if (patch.type && patch.type !== current.type)
        throw new Error(
          "Changing long-term memory note type is not supported by this package version.",
        );
      const next = ltmNoteSchema.parse({
        ...current,
        ...patch,
        id: current.id,
        type: current.type,
        createdAt: current.createdAt,
        updatedAt: nowIso(),
        version: current.version + 1,
      });
      const event = ltmEventSchema.parse({
        id: randomUUID(),
        ts: nowIso(),
        type: `${next.type}.updated`,
        target: next.id,
        payload: { note: next, patch },
      });
      await commitLtmMutation(this.root, {
        files: [
          {
            path: notePathForId(next.id, next.type, this.root),
            before: current,
            after: next,
          },
        ],
        events: [event],
      });
      return next;
    });
  }
  async bulkMutateNotes(input: unknown): Promise<LtmBulkNoteResult> {
    await this.initializeLtmStore();
    const request = ltmBulkNoteRequestSchema.parse(input);
    return withLtmVaultLock(this.root, async () => {
      const notes = await this.listNotes();
      const notesById = new Map(notes.map((note) => [note.id, note]));
      const failedNoteIds = request.noteIds.filter((id) => !notesById.has(id));
      const derivedIds =
        request.archive === "with_derived"
          ? notes
              .filter((note) =>
                note.links.some(
                  (link) =>
                    link.relation === "extracted_from" &&
                    request.noteIds.includes(link.target),
                ),
              )
              .map((note) => note.id)
              .filter((id) => !request.noteIds.includes(id))
              .sort((a, b) => a.localeCompare(b))
          : [];
      const targetIds = [
        ...request.noteIds.filter((id) => notesById.has(id)),
        ...derivedIds,
      ];
      if (targetIds.length > 100) {
        return ltmBulkNoteResultSchema.parse({
          status: "failed",
          requestedNoteIds: request.noteIds,
          updatedNoteIds: [],
          affectedNoteIds: [],
          skippedNoteIds: [],
          failedNoteIds: request.noteIds,
        });
      }
      const timestamp = nowIso();
      const changes: Array<{
        before: LtmNote;
        after: LtmNote;
        requested: boolean;
      }> = [];

      for (const id of targetIds) {
        const current = notesById.get(id)!;
        const archiveDerived = derivedIds.includes(id);
        const status =
          request.archive || archiveDerived
            ? "archived"
            : (request.status ?? current.status);
        const modes = archiveDerived
          ? current.modes
          : (request.modes ?? current.modes);
        const tags =
          archiveDerived ||
          (!request.addTags?.length && !request.removeTags?.length)
            ? current.tags
            : [
                ...new Set([
                  ...current.tags.filter(
                    (tag) => !request.removeTags?.includes(tag),
                  ),
                  ...(request.addTags ?? []),
                ]),
              ].sort((a, b) => a.localeCompare(b));
        if (
          status === current.status &&
          modes.length === current.modes.length &&
          modes.every((mode, index) => mode === current.modes[index]) &&
          tags.length === current.tags.length &&
          tags.every((tag, index) => tag === current.tags[index])
        )
          continue;
        changes.push({
          before: current,
          after: ltmNoteSchema.parse({
            ...current,
            status,
            modes,
            tags,
            updatedAt: timestamp,
            version: current.version + 1,
          }),
          requested: request.noteIds.includes(id),
        });
      }

      if (changes.length) {
        await commitLtmMutation(this.root, {
          files: changes.map(({ before, after }) => ({
            path: notePathForId(after.id, after.type, this.root),
            before,
            after,
          })),
          events: changes.map(({ before, after }) =>
            ltmEventSchema.parse({
              id: randomUUID(),
              ts: timestamp,
              type: `${after.type}.bulk_updated`,
              target: after.id,
              payload: {
                before,
                note: after,
                request: {
                  status: request.status,
                  modes: request.modes,
                  addTags: request.addTags,
                  removeTags: request.removeTags,
                  archive: request.archive,
                },
              },
            }),
          ),
        });
      }

      const updatedNoteIds = changes
        .filter((change) => change.requested)
        .map((change) => change.after.id);
      const updated = new Set(updatedNoteIds);
      const skippedNoteIds = request.noteIds.filter(
        (id) => !updated.has(id) && !failedNoteIds.includes(id),
      );
      const affectedNoteIds = changes.map((change) => change.after.id);
      const status = affectedNoteIds.length
        ? failedNoteIds.length || skippedNoteIds.length
          ? "partial"
          : "complete"
        : failedNoteIds.length
          ? "failed"
          : "no_changes";
      return ltmBulkNoteResultSchema.parse({
        status,
        requestedNoteIds: request.noteIds,
        updatedNoteIds,
        affectedNoteIds,
        skippedNoteIds,
        failedNoteIds,
      });
    });
  }
  async redirectReferences(fromId: string, toId: string) {
    await this.initializeLtmStore();
    const from = ltmNoteIdSchema.parse(fromId),
      to = ltmNoteIdSchema.parse(toId);
    if (from === to) return { rewrittenNoteCount: 0, rewrittenDraftCount: 0 };
    return withLtmVaultLock(this.root, async () => {
      if (!(await this.getNote(to)))
        throw new Error(
          `Long-term memory replacement note does not exist: ${to}`,
        );
      const timestamp = nowIso(),
        notes = await this.listNotes(),
        noteFiles = [] as Array<{
          path: string;
          before: unknown;
          after: unknown;
        }>;
      for (const note of notes) {
        const links = note.links.map((link) =>
          link.target === from ? { ...link, target: to } : link,
        );
        if (JSON.stringify(links) === JSON.stringify(note.links)) continue;
        const next = ltmNoteSchema.parse({
          ...note,
          links,
          updatedAt: timestamp,
          version: note.version + 1,
        });
        noteFiles.push({
          path: notePathForId(next.id, next.type, this.root),
          before: note,
          after: next,
        });
      }
      const drafts = getLongTermMemoryDirectories(this.root).drafts,
        draftFiles = [] as Array<{
          path: string;
          before: unknown;
          after: unknown;
        }>;
      for (const entry of await readdir(drafts, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const path = safeJoin(drafts, entry.name),
          before = JSON.parse(await readFile(path, "utf8")) as Record<
            string,
            unknown
          >,
          next = { ...before };
        let changed = false;
        if (
          next.source &&
          typeof next.source === "object" &&
          !Array.isArray(next.source)
        ) {
          const source = { ...(next.source as Record<string, unknown>) };
          if (source.sourceNoteId === from) {
            source.sourceNoteId = to;
            next.source = source;
            changed = true;
          }
        }
        if (Array.isArray(next.mutations)) {
          const mutations = next.mutations.map((mutation) =>
            rewriteDraftMutationNoteIds(mutation, from, to),
          );
          changed ||=
            JSON.stringify(mutations) !== JSON.stringify(next.mutations);
          next.mutations = mutations;
        }
        if (changed)
          draftFiles.push({
            path,
            before,
            after: ltmExtractionDraftSchema.parse({
              ...next,
              updatedAt: timestamp,
            }),
          });
      }
      if (noteFiles.length || draftFiles.length)
        await commitLtmMutation(this.root, {
          files: [...noteFiles, ...draftFiles],
          events: [],
        });
      return {
        rewrittenNoteCount: noteFiles.length,
        rewrittenDraftCount: draftFiles.length,
      };
    });
  }
  async renameNoteId(id: string, nextId: string) {
    await this.initializeLtmStore();
    const currentId = ltmNoteIdSchema.parse(id),
      targetId = ltmNoteIdSchema.parse(nextId);
    if (currentId === targetId) {
      const note = await this.getNote(currentId);
      if (!note)
        throw new Error(`Long-term memory note not found: ${currentId}`);
      return note;
    }
    return withLtmVaultLock(this.root, async () => {
      const notes = await this.listNotes(),
        current = notes.find((note) => note.id === currentId);
      if (!current)
        throw new Error(`Long-term memory note not found: ${currentId}`);
      if (notes.some((note) => note.id === targetId))
        throw new Error(`Long-term memory note already exists: ${targetId}`);
      const timestamp = nowIso(),
        renamed = ltmNoteSchema.parse({
          ...current,
          id: targetId,
          links: current.links.map((link) =>
            link.target === currentId ? { ...link, target: targetId } : link,
          ),
          updatedAt: timestamp,
          version: current.version + 1,
          extractionFingerprint: undefined,
        }),
        rewrites = notes
          .filter(
            (note) =>
              note.id !== currentId &&
              note.links.some((link) => link.target === currentId),
          )
          .map((note) =>
            ltmNoteSchema.parse({
              ...note,
              links: note.links.map((link) =>
                link.target === currentId
                  ? { ...link, target: targetId }
                  : link,
              ),
              updatedAt: timestamp,
              version: note.version + 1,
            }),
          ),
        draftFiles = [] as Array<{
          path: string;
          before: unknown;
          after: unknown;
        }>;
      for (const entry of await readdir(
        getLongTermMemoryDirectories(this.root).drafts,
        { withFileTypes: true },
      )) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const path = safeJoin(
            getLongTermMemoryDirectories(this.root).drafts,
            entry.name,
          ),
          before = JSON.parse(await readFile(path, "utf8")) as Record<
            string,
            unknown
          >,
          source =
            before.source &&
            typeof before.source === "object" &&
            !Array.isArray(before.source)
              ? { ...(before.source as Record<string, unknown>) }
              : null,
          mutations = Array.isArray(before.mutations)
            ? before.mutations.map((mutation) =>
                rewriteDraftMutationNoteIds(mutation, currentId, targetId),
              )
            : before.mutations;
        let changed =
          JSON.stringify(mutations) !== JSON.stringify(before.mutations);
        if (source?.sourceNoteId === currentId) {
          source.sourceNoteId = targetId;
          source.sourceHash = sourceHashForLtmSourceNote(renamed);
          const parsedBefore = ltmExtractionDraftSchema.parse(before);
          source.extractionFingerprint = extractionFingerprintForLtmSourceNote(
            renamed,
            {
              scope: parsedBefore.scope,
              modes: parsedBefore.modes,
              extractionMode:
                parsedBefore.source.extractionFingerprint?.extractionMode ??
                parsedBefore.modes[0],
            },
          );
          changed = true;
        }
        if (changed)
          draftFiles.push({
            path,
            before,
            after: ltmExtractionDraftSchema.parse({
              ...before,
              ...(source ? { source } : {}),
              mutations,
              updatedAt: timestamp,
            }),
          });
      }
      await commitLtmMutation(this.root, {
        files: [
          {
            path: notePathForId(current.id, current.type, this.root),
            before: current,
            after: null,
          },
          {
            path: notePathForId(renamed.id, renamed.type, this.root),
            before: null,
            after: renamed,
          },
          ...rewrites.map((note) => ({
            path: notePathForId(note.id, note.type, this.root),
            before: notes.find((item) => item.id === note.id)!,
            after: note,
          })),
          ...draftFiles,
        ],
        events: [
          ltmEventSchema.parse({
            id: randomUUID(),
            ts: timestamp,
            type: `${renamed.type}.renamed`,
            target: renamed.id,
            payload: { previousNoteId: currentId, note: renamed },
          }),
        ],
      });
      return renamed;
    });
  }
  async archiveSourceNoteWithDerived(id: string) {
    return withLtmVaultLock(this.root, async () => {
      const source = await this.getNote(id);
      if (!source) throw new Error(`Long-term memory note not found: ${id}`);
      const notes = await this.listNotes();
      const targets = [
        source,
        ...notes.filter(
          (note) =>
            note.id !== id &&
            note.links.some(
              (link) =>
                link.relation === "extracted_from" && link.target === id,
            ),
        ),
      ];
      const archived = [];
      for (const note of targets)
        archived.push(await this.updateNote(note.id, { status: "archived" }));
      return archived;
    });
  }
  async deleteNotesPermanently(ids: string[]) {
    await this.initializeLtmStore();
    const wanted = [...new Set(ids.map((id) => ltmNoteIdSchema.parse(id)))];
    return withLtmVaultLock(this.root, async () => {
      const notes = await this.listNotes();
      const lookup = new Map(notes.map((note) => [note.id, note]));
      const deletedNotes = wanted.flatMap((id) =>
        lookup.get(id) ? [lookup.get(id)!] : [],
      );
      const deletedIds = deletedNotes.map((note) => note.id);
      const failedIds = wanted.filter((id) => !lookup.has(id));
      if (!deletedNotes.length) return { deletedIds, failedIds, deletedNotes };
      const deleted = new Set(deletedIds);
      const repairs = notes
        .filter(
          (note) =>
            !deleted.has(note.id) &&
            note.links.some((link) => deleted.has(link.target)),
        )
        .map((note) =>
          ltmNoteSchema.parse({
            ...note,
            links: note.links.filter((link) => !deleted.has(link.target)),
            updatedAt: nowIso(),
            version: note.version + 1,
          }),
        );
      await commitLtmMutation(this.root, {
        files: [
          ...deletedNotes.map((note) => ({
            path: notePathForId(note.id, note.type, this.root),
            before: note,
            after: null,
          })),
          ...repairs.map((note) => ({
            path: notePathForId(note.id, note.type, this.root),
            before: lookup.get(note.id)!,
            after: note,
          })),
        ],
        events: deletedNotes.map((note) =>
          ltmEventSchema.parse({
            id: randomUUID(),
            ts: nowIso(),
            type: `${note.type}.deleted`,
            target: note.id,
            payload: { note },
          }),
        ),
      });
      try {
        const usage = await readLongTermMemoryUsage(this.root);
        let usageChanged = false;
        for (const [chatId, chat] of Object.entries(usage.chats)) {
          for (const chunkId of Object.keys(chat.chunks)) {
            if (deleted.has(chat.chunks[chunkId].noteId)) {
              delete chat.chunks[chunkId];
              usageChanged = true;
            }
          }
          if (Object.keys(chat.chunks).length === 0) delete usage.chats[chatId];
        }
        if (usageChanged)
          await writeJsonAtomic(longTermMemoryUsagePath(this.root), usage);
      } catch (e) {
        if (!isEnoent(e)) throw e;
      }
      const receiptsDir = getLongTermMemoryDirectories(this.root).receipts;
      for (const entry of await readdir(receiptsDir, {
        withFileTypes: true,
      }).catch((e) => {
        if (isEnoent(e)) return [];
        throw e;
      })) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const receiptPath = safeJoin(receiptsDir, entry.name);
        try {
          const receipt = await readJsonFile(receiptPath, null);
          if (!receipt || !Array.isArray(receipt.chunks)) continue;
          const filtered = receipt.chunks.filter(
            (chunk: any) => !deleted.has(chunk.noteId),
          );
          if (filtered.length !== receipt.chunks.length) {
            if (filtered.length === 0) await rm(receiptPath, { force: true });
            else
              await writeJsonAtomic(receiptPath, {
                ...receipt,
                chunks: filtered,
              });
          }
        } catch {}
      }
      return { deletedIds, failedIds, deletedNotes };
    });
  }
  async removeNoteFromScope(
    id: string,
    input: { chatIds?: string[]; groupId?: string; characterIds?: string[] },
  ) {
    const note = await this.getNote(id);
    if (!note) throw new Error(`Long-term memory note not found: ${id}`);
    const chatIds = getLtmScopeChatIds(note.scope).filter(
      (value) => !new Set(input.chatIds ?? []).has(value),
    );
    const characterIds = (note.scope.characterIds ?? []).filter(
      (value) => !new Set(input.characterIds ?? []).has(value),
    );
    const groupId =
      input.groupId && note.scope.groupId === input.groupId
        ? undefined
        : note.scope.groupId;
    const changed =
      chatIds.length !== getLtmScopeChatIds(note.scope).length ||
      characterIds.length !== (note.scope.characterIds ?? []).length ||
      groupId !== note.scope.groupId;
    if (!changed) return { note, deleted: false, changed: false };
    if (!chatIds.length && !characterIds.length && !groupId) {
      await this.deleteNotesPermanently([id]);
      return { note: null, deleted: true, changed: true };
    }
    const scope: LtmScope = {};
    if (chatIds.length) {
      scope.chatIds = chatIds;
      scope.chatId = chatIds[0];
    }
    if (characterIds.length) scope.characterIds = characterIds;
    if (groupId) scope.groupId = groupId;
    return {
      note: await this.updateNote(id, { scope }),
      deleted: false,
      changed: true,
    };
  }
  async cleanup() {
    initialized.delete(this.root);
  }
}
