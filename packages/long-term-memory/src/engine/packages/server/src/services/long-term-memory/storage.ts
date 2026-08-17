import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
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
  ltmRejectedSuggestionSchema,
  ltmNoteTypeSchema,
  ltmRetentionConfigSchema,
  ltmSectionKeySchema,
  ltmScopeAliasConflict,
  type LtmNote,
  type LtmRejectedSuggestion,
  type LtmBulkNoteResult,
  type LtmNoteType,
  type LtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  getLtmScopeChatIds,
  getLtmScopeGroupIds,
  getLtmScopePersonaIds,
  isGlobalLtmScope,
  matchesLtmScope,
  normalizeLtmScope,
  validateLtmExplicitAvailability,
  withMergedLtmScopeLinks,
} from "../../../../shared/src/features/agents/long-term-memory/scope.js";
import { normalizeLtmKeywordIntent } from "../../../../shared/src/features/agents/long-term-memory/keywords.js";
import { DEFAULT_LTM_RETENTION_CONFIG } from "./default-config.js";
import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import { commitLtmMutation, recoverLtmMutations } from "./mutation-transaction.js";
import { isEnoent, nowIso } from "./ltm-utils.js";
import {
  getLongTermMemoryDirectories,
  getLongTermMemoryRoot,
  LTM_VAULT_FOLDERS,
  notePathForId,
  safeJoin,
  ltmRejectedSuggestionsPath,
  vaultFolderForNoteType,
} from "./paths.js";
import { isLtmBackupRestoreActive, recoverInterruptedLtmBackupRestore } from "./restore-recovery.js";
import { readLtmNoteSummary } from "./index-state.js";
import { longTermMemoryRetentionConfigPath, runLongTermMemoryRetention } from "./retention.js";
import { longTermMemoryUsagePath, readLongTermMemoryUsage } from "./usage.js";
import { parseStoredLtmNote } from "./stored-note.js";
import { withLtmVaultLock } from "./vault-lock.js";
import { LtmServiceError } from "./service-error.js";
import { quarantineLegacyCapturedTurnSources } from "./legacy-source-quarantine.js";
import { isAdditiveLtmSection } from "./draft-projector.js";
import { logger } from "./package-runtime.js";
import { ensureLtmActivityIndex } from "./activity-index.js";
import { manualContribution, renderSectionContributions, sectionContributions } from "./section-contributions.js";
import { extractionFingerprintForLtmSourceNote, sourceHashForLtmSourceNote } from "./source-hash.js";

export type UpdateLtmNotePatch = Partial<Omit<LtmNote, "id" | "createdAt" | "updatedAt" | "version">> & {
  removedSectionKeys?: string[];
};
export type ListLtmNotesOptions = {
  type?: LtmNoteType;
  status?: LtmNote["status"];
  tag?: string;
  scope?: LtmScope;
  characterIds?: string[];
  includeGlobal?: boolean;
  offset?: number;
  limit?: number;
};

function rewriteDraftMutationNoteIds(mutation: unknown, fromId: string, toId: string) {
  if (!mutation || typeof mutation !== "object" || Array.isArray(mutation)) return mutation;
  const next = { ...(mutation as Record<string, unknown>) };
  if (Array.isArray(next.evidence)) {
    next.evidence = next.evidence.map((evidence) =>
      evidence === `source_note:${fromId}` ? `source_note:${toId}` : evidence,
    );
  }
  if (next.noteId === fromId) next.noteId = toId;
  if (next.kind === "create_note" && next.note && typeof next.note === "object" && !Array.isArray(next.note)) {
    const note = { ...(next.note as Record<string, unknown>) };
    if (note.id === fromId) note.id = toId;
    if (Array.isArray(note.links))
      note.links = note.links.map((link) =>
        link && typeof link === "object" && !Array.isArray(link) && (link as Record<string, unknown>).target === fromId
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

function rewriteDraftMutationSectionKey(
  mutation: unknown,
  noteId: string,
  fromSectionKey: string,
  toSectionKey: string,
) {
  if (!mutation || typeof mutation !== "object" || Array.isArray(mutation)) return mutation;
  const next = { ...(mutation as Record<string, unknown>) };
  if (
    next.noteId === noteId &&
    (next.kind === "append_section" || next.kind === "update_section") &&
    next.sectionKey === fromSectionKey
  )
    next.sectionKey = toSectionKey;
  return next;
}

function extractedLineageIds(notes: LtmNote[], sourceNoteId: string) {
  const ids = new Set([sourceNoteId]);
  const childrenBySource = new Map<string, string[]>();
  for (const note of notes)
    for (const link of note.links)
      if (link.relation === "extracted_from")
        childrenBySource.set(link.target, [...(childrenBySource.get(link.target) ?? []), note.id]);
  const pending = [sourceNoteId];
  while (pending.length) {
    for (const child of childrenBySource.get(pending.pop()!) ?? [])
      if (!ids.has(child)) {
        ids.add(child);
        pending.push(child);
      }
  }
  return ids;
}

async function rewriteRejectedSuggestions(
  root: string,
  rewrite: (suggestion: LtmRejectedSuggestion) => LtmRejectedSuggestion,
) {
  const path = ltmRejectedSuggestionsPath(root);
  let before: unknown;
  try {
    before = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (isEnoent(error)) return null;
    throw error;
  }
  if (!Array.isArray(before)) throw new Error("Long-term memory rejected-suggestion ledger is not an array.");
  const after = before.map((item) => {
    const parsed = ltmRejectedSuggestionSchema.safeParse(item);
    return parsed.success ? rewrite(parsed.data) : item;
  });
  return JSON.stringify(before) === JSON.stringify(after) ? null : { path, before, after };
}

function rewriteSectionContributionSourceIds(note: LtmNote, fromId: string, toId: string) {
  return Object.fromEntries(
    Object.entries(note.sections).map(([key, section]) => [
      key,
      !section.contributions?.some((item) => item.owner === "source" && item.sourceNoteId === fromId)
        ? section
        : {
            ...section,
            contributions: section.contributions.map((item) =>
              item.owner === "source" && item.sourceNoteId === fromId ? { ...item, sourceNoteId: toId } : item,
            ),
          },
    ]),
  );
}

function assertWritableScope(scope: LtmScope | null | undefined) {
  const conflict = ltmScopeAliasConflict(scope);
  if (conflict) throw new LtmServiceError(conflict, 400, "ltm_scope_alias_conflict");
}

function assertWritableSections(sections: Record<string, { text?: string }> | null | undefined) {
  if (!sections || !Object.keys(sections).length)
    throw new LtmServiceError("A memory must include at least one detail.", 400, "ltm_empty_sections");
  if (Object.values(sections).some((section) => !section.text?.trim()))
    throw new LtmServiceError("Every memory detail needs text.", 400, "ltm_empty_section_text");
}

const initialized = new Set<string>();
export class LongTermMemoryStorage {
  constructor(readonly root = getLongTermMemoryRoot()) {}
  async initializeLtmStore() {
    return withLtmVaultLock(this.root, async () => {
      const rootKey = resolve(this.root);
      if (initialized.has(rootKey)) {
        await runLongTermMemoryRetention({ root: this.root }).catch((error) =>
          logger.warn(error, "[ltm] Deferred retention run failed"),
        );
        return;
      }
      if (!isLtmBackupRestoreActive(this.root)) await recoverInterruptedLtmBackupRestore(this.root);
      const dirs = getLongTermMemoryDirectories(this.root);
      await Promise.all([
        mkdir(dirs.events, { recursive: true }),
        mkdir(dirs.indexes, { recursive: true }),
        mkdir(dirs.config, { recursive: true }),
        mkdir(dirs.drafts, { recursive: true }),
        mkdir(dirs.transactions, { recursive: true }),
        mkdir(dirs.receipts, { recursive: true }),
        ...LTM_VAULT_FOLDERS.map((f) => mkdir(safeJoin(dirs.vault, f), { recursive: true })),
      ]);
      await recoverLtmMutations(this.root);
      await ensureLtmActivityIndex(this.root);
      await quarantineLegacyCapturedTurnSources(this.root);
      await readLtmNoteSummary(this.root);
      const configs = [
        [longTermMemoryRetentionConfigPath(this.root), ltmRetentionConfigSchema, DEFAULT_LTM_RETENTION_CONFIG],
        [safeJoin(dirs.config, "settings.json"), ltmGlobalSettingsSchema, { version: 1 }],
      ] as const;
      for (const [path, schema, fallback] of configs) {
        const parsed = schema.parse(await readJsonFile(path, fallback));
        await writeJsonAtomic(path, parsed);
      }
      initialized.add(rootKey);
      await runLongTermMemoryRetention({ root: this.root }).catch((error) =>
        logger.warn(error, "[ltm] Deferred retention run failed"),
      );
    });
  }
  async listNotes(filter: ListLtmNotesOptions = {}) {
    return withLtmVaultLock(this.root, async () => {
      await this.initializeLtmStore();
      const notes: LtmNote[] = [];
      const dirs = getLongTermMemoryDirectories(this.root);
      const folders = filter.type ? [vaultFolderForNoteType(filter.type)] : LTM_VAULT_FOLDERS;
      const files = (
        await Promise.all(
          folders.map(async (folder) =>
            (await readdir(safeJoin(dirs.vault, folder), { withFileTypes: true }))
              .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
              .map((entry) => ({ folder, name: entry.name })),
          ),
        )
      )
        .flat()
        .sort((left, right) => left.name.localeCompare(right.name) || left.folder.localeCompare(right.folder));
      const offset = filter.offset ?? 0;
      let matched = 0;
      for (const file of files) {
        const note = parseStoredLtmNote(
          JSON.parse(await readFile(safeJoin(dirs.vault, `${file.folder}/${file.name}`), "utf8")),
        );
        if (vaultFolderForNoteType(note.type) !== file.folder)
          throw new Error(`Long-term memory note ${note.id} has type ${note.type} but is stored in ${file.folder}.`);
        if (filter.status && note.status !== filter.status) continue;
        if (filter.tag && !note.tags.includes(filter.tag)) continue;
        if (
          (filter.scope || filter.characterIds?.length || filter.includeGlobal === false) &&
          !matchesLtmScope(note, {
            scope: filter.scope,
            characterIds: filter.characterIds,
            includeGlobal: filter.includeGlobal,
          })
        )
          continue;
        if (matched++ < offset) continue;
        notes.push(note);
        if (filter.limit !== undefined && notes.length >= filter.limit) break;
      }
      return filter.limit === undefined ? notes.sort((a, b) => a.id.localeCompare(b.id)) : notes;
    });
  }
  async getNote(id: string) {
    const wanted = ltmNoteIdSchema.parse(id);
    await this.initializeLtmStore();
    return withLtmVaultLock(this.root, async () => {
      return this.readNoteByIdUnlocked(wanted);
    });
  }
  async getNotesByIds(ids: string[]) {
    const wanted = new Set(ids.map((id) => ltmNoteIdSchema.parse(id)));
    if (!wanted.size) return new Map<string, LtmNote>();
    await this.initializeLtmStore();
    return withLtmVaultLock(this.root, async () => {
      const notes = new Map<string, LtmNote>();
      for (const id of wanted) {
        const note = await this.readNoteByIdUnlocked(id);
        if (note) notes.set(note.id, note);
      }
      return notes;
    });
  }
  private async readNoteByIdUnlocked(id: string) {
    const dirs = getLongTermMemoryDirectories(this.root);
    for (const folder of LTM_VAULT_FOLDERS) {
      const path = safeJoin(dirs.vault, `${folder}/${id}.json`);
      try {
        const note = parseStoredLtmNote(JSON.parse(await readFile(path, "utf8")));
        if (vaultFolderForNoteType(note.type) !== folder)
          throw new Error(`Long-term memory note ${note.id} has type ${note.type} but is stored in ${folder}.`);
        return note;
      } catch (error) {
        if (!isEnoent(error)) throw error;
      }
    }
    return null;
  }
  async createNote(input: unknown) {
    await this.initializeLtmStore();
    const timestamp = nowIso();
    const draft = ltmDraftNoteInputSchema.parse(input);
    assertWritableScope(draft.scope);
    const scope = normalizeLtmScope(draft.scope);
    if (draft.type !== "source") {
      const availabilityError = validateLtmExplicitAvailability(scope, draft.modes);
      if (availabilityError) throw new LtmServiceError(availabilityError, 400, "ltm_explicit_availability_required");
    }
    const sections =
      draft.type === "source"
        ? draft.sections
        : Object.fromEntries(
            Object.entries(draft.sections).map(([key, section]) => [
              key,
              renderSectionContributions([manualContribution(section)], isAdditiveLtmSection(draft, key))!,
            ]),
          );
    assertWritableSections(sections);
    const note = ltmNoteSchema.parse({
      ...draft,
      scope,
      ...normalizeLtmKeywordIntent({
        ...draft,
        manualKeywords: draft.manualKeywords ?? [],
      }),
      sections,
      createdAt: (draft as any).createdAt ?? timestamp,
      updatedAt: (draft as any).updatedAt ?? timestamp,
      version: (draft as any).version ?? 1,
    });
    return withLtmVaultLock(this.root, async () => {
      if (await this.getNote(note.id))
        throw new LtmServiceError(`Long-term memory note already exists: ${note.id}`, 409, "ltm_note_already_exists");
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
  async projectNote(id: string, type: LtmNoteType, projector: (current: LtmNote | null) => LtmNote) {
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
      if (projected === current) return { note: current, created: false, changed: false };
      assertWritableScope(projected.scope);
      assertWritableSections(projected.sections);
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
      if (!current) throw new LtmServiceError(`Long-term memory note not found: ${id}`, 404, "ltm_note_not_found");
      const { removedSectionKeys = [], ...notePatch } = patch;
      assertWritableScope(notePatch.scope);
      if (notePatch.type && notePatch.type !== current.type)
        throw new Error("Changing long-term memory note type is not supported by this package version.");
      if (notePatch.scope !== undefined && !isGlobalLtmScope(current.scope) && isGlobalLtmScope(notePatch.scope))
        throw new LtmServiceError(
          "Clearing every scope would make this memory global. Remove scope links with the scope-removal action instead; it safely deletes the memory when no explicit scope remains.",
          400,
          "ltm_scope_removal_unsafe",
        );
      if (removedSectionKeys.length && current.type === "source")
        throw new LtmServiceError("Imported source sections cannot be deleted.", 400, "ltm_source_section_immutable");
      const removed = new Set(removedSectionKeys.map((key) => ltmSectionKeySchema.parse(key)));
      if ([...removed].some((key) => !Object.hasOwn(current.sections, key)))
        throw new LtmServiceError("Long-term memory section not found.", 404, "ltm_section_not_found");
      if (Object.keys(current.sections).length - removed.size < 1)
        throw new LtmServiceError("A memory must keep at least one detail.", 400, "ltm_last_section");
      if (notePatch.sections && !Object.keys(notePatch.sections).length) assertWritableSections(notePatch.sections);
      const sectionInput =
        notePatch.sections !== undefined
          ? Object.fromEntries(
              Object.entries({ ...current.sections, ...notePatch.sections }).filter(([key]) => !removed.has(key)),
            )
          : removed.size
            ? Object.fromEntries(Object.entries(current.sections).filter(([key]) => !removed.has(key)))
            : undefined;
      const sections = sectionInput
        ? current.type === "source"
          ? sectionInput
          : Object.fromEntries(
              Object.entries(sectionInput).map(([key, section]) => {
                const previous = current.sections[key];
                const { contributions: _previousContributions, ...previousFields } = previous ?? {};
                const { contributions: _nextContributions, ...nextFields } = section;
                if (previous && JSON.stringify(previousFields) === JSON.stringify(nextFields)) return [key, previous];
                return [
                  key,
                  renderSectionContributions(
                    [...sectionContributions(previous), manualContribution(section)],
                    isAdditiveLtmSection(current, key),
                  )!,
                ];
              }),
            )
        : notePatch.sections;
      if (sections) assertWritableSections(sections);
      const next = ltmNoteSchema.parse({
        ...current,
        ...notePatch,
        ...(notePatch.scope ? { scope: normalizeLtmScope(notePatch.scope) } : {}),
        ...normalizeLtmKeywordIntent({ ...current, ...notePatch }),
        ...(sections ? { sections } : {}),
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
        payload: { note: next, patch: notePatch },
      });
      const draftFiles: Array<{ path: string; before: unknown; after: unknown }> = [];
      if (removed.size) {
        const timestamp = nowIso();
        for (const entry of await readdir(getLongTermMemoryDirectories(this.root).drafts, { withFileTypes: true })) {
          if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
          const path = safeJoin(getLongTermMemoryDirectories(this.root).drafts, entry.name);
          let before: unknown;
          try {
            before = JSON.parse(await readFile(path, "utf8"));
          } catch {
            continue;
          }
          const parsed = ltmExtractionDraftSchema.safeParse(before);
          if (
            !parsed.success ||
            parsed.data.status !== "pending" ||
            !parsed.data.mutations.some(
              (mutation) =>
                (mutation.kind === "append_section" || mutation.kind === "update_section") &&
                mutation.noteId === current.id &&
                removed.has(mutation.sectionKey),
            )
          )
            continue;
          draftFiles.push({
            path,
            before,
            after: ltmExtractionDraftSchema.parse({
              ...parsed.data,
              status: "invalidated",
              invalidatedAt: timestamp,
              invalidationReason: `A targeted detail was removed from memory ${current.id}.`,
              updatedAt: timestamp,
            }),
          });
        }
      }
      await commitLtmMutation(this.root, {
        files: [
          {
            path: notePathForId(next.id, next.type, this.root),
            before: current,
            after: next,
          },
          ...draftFiles,
        ],
        events: [event],
      });
      return next;
    });
  }
  async bulkMutateNotes(input: unknown): Promise<LtmBulkNoteResult> {
    await this.initializeLtmStore();
    const request = ltmBulkNoteRequestSchema.parse(input);
    assertWritableScope(request.addScope);
    assertWritableScope(request.removeScope);
    return withLtmVaultLock(this.root, async () => {
      const notes = await this.listNotes();
      const notesById = new Map(notes.map((note) => [note.id, note]));
      const failedNoteIds = request.noteIds.filter((id) => !notesById.has(id));
      const derivedIds =
        request.archive === "with_derived"
          ? notes
              .filter((note) =>
                note.links.some((link) => link.relation === "extracted_from" && request.noteIds.includes(link.target)),
              )
              .map((note) => note.id)
              .filter((id) => !request.noteIds.includes(id))
              .sort((a, b) => a.localeCompare(b))
          : [];
      const targetIds = [...request.noteIds.filter((id) => notesById.has(id)), ...derivedIds];
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
        const status = request.archive || archiveDerived ? "archived" : (request.status ?? current.status);
        const modes = archiveDerived
          ? current.modes
          : (request.modes ?? [
              ...new Set(
                [...current.modes, ...(request.enableModes ?? [])].filter(
                  (mode) => !request.disableModes?.includes(mode),
                ),
              ),
            ]);
        const addScope = request.addScope;
        const removeScope = request.removeScope;
        const currentChatIds = getLtmScopeChatIds(current.scope);
        const currentGroupIds = getLtmScopeGroupIds(current.scope);
        const currentPersonaIds = getLtmScopePersonaIds(current.scope);
        const removeChatIds = new Set(getLtmScopeChatIds(removeScope));
        const removeGroupIds = new Set(getLtmScopeGroupIds(removeScope));
        const removePersonaIds = new Set(getLtmScopePersonaIds(removeScope));
        const nextChatIds = currentChatIds.filter((chatId) => !removeChatIds.has(chatId));
        const nextScope = withMergedLtmScopeLinks(
          {
            chatIds: nextChatIds,
            groupIds: currentGroupIds.filter((id) => !removeGroupIds.has(id)),
            characterIds: current.scope.characterIds?.filter((id) => !removeScope?.characterIds?.includes(id)),
            personaIds: currentPersonaIds.filter((id) => !removePersonaIds.has(id)),
          },
          {
            chatIds: getLtmScopeChatIds(addScope),
            groupIds: getLtmScopeGroupIds(addScope),
            characterIds: addScope?.characterIds,
            personaIds: getLtmScopePersonaIds(addScope),
          },
        );
        const scope = addScope || removeScope ? nextScope : current.scope;
        if (!modes.length || (removeScope && isGlobalLtmScope(scope))) continue;
        const tags =
          archiveDerived || (!request.addTags?.length && !request.removeTags?.length)
            ? current.tags
            : [
                ...new Set([
                  ...current.tags.filter((tag) => !request.removeTags?.includes(tag)),
                  ...(request.addTags ?? []),
                ]),
              ].sort((a, b) => a.localeCompare(b));
        if (
          status === current.status &&
          modes.length === current.modes.length &&
          modes.every((mode, index) => mode === current.modes[index]) &&
          tags.length === current.tags.length &&
          tags.every((tag, index) => tag === current.tags[index]) &&
          JSON.stringify(scope) === JSON.stringify(current.scope)
        )
          continue;
        changes.push({
          before: current,
          after: ltmNoteSchema.parse({
            ...current,
            status,
            modes,
            scope,
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
                  enableModes: request.enableModes,
                  disableModes: request.disableModes,
                  addScope: request.addScope,
                  removeScope: request.removeScope,
                  addTags: request.addTags,
                  removeTags: request.removeTags,
                  archive: request.archive,
                },
              },
            }),
          ),
        });
      }

      const updatedNoteIds = changes.filter((change) => change.requested).map((change) => change.after.id);
      const updated = new Set(updatedNoteIds);
      const skippedNoteIds = request.noteIds.filter((id) => !updated.has(id) && !failedNoteIds.includes(id));
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
        throw new LtmServiceError(`Long-term memory replacement note does not exist: ${to}`, 404, "ltm_note_not_found");
      const timestamp = nowIso(),
        notes = await this.listNotes(),
        noteFiles = [] as Array<{
          path: string;
          before: unknown;
          after: unknown;
        }>;
      for (const note of notes) {
        const links = note.links.map((link) => (link.target === from ? { ...link, target: to } : link));
        const sections = rewriteSectionContributionSourceIds(note, from, to);
        if (
          JSON.stringify(links) === JSON.stringify(note.links) &&
          JSON.stringify(sections) === JSON.stringify(note.sections)
        )
          continue;
        const next = ltmNoteSchema.parse({
          ...note,
          links,
          sections,
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
          before = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>,
          next = { ...before };
        let changed = false;
        if (next.source && typeof next.source === "object" && !Array.isArray(next.source)) {
          const source = { ...(next.source as Record<string, unknown>) };
          if (source.sourceNoteId === from) {
            source.sourceNoteId = to;
            next.source = source;
            changed = true;
          }
        }
        if (Array.isArray(next.mutations)) {
          const mutations = next.mutations.map((mutation) => rewriteDraftMutationNoteIds(mutation, from, to));
          changed ||= JSON.stringify(mutations) !== JSON.stringify(next.mutations);
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
      if (!note) throw new Error(`Long-term memory note not found: ${currentId}`);
      return note;
    }
    return withLtmVaultLock(this.root, async () => {
      const notes = await this.listNotes(),
        current = notes.find((note) => note.id === currentId);
      if (!current)
        throw new LtmServiceError(`Long-term memory note not found: ${currentId}`, 404, "ltm_note_not_found");
      if (notes.some((note) => note.id === targetId))
        throw new LtmServiceError(`Long-term memory note already exists: ${targetId}`, 409, "ltm_note_already_exists");
      const timestamp = nowIso(),
        renamed = ltmNoteSchema.parse({
          ...current,
          id: targetId,
          links: current.links.map((link) => (link.target === currentId ? { ...link, target: targetId } : link)),
          updatedAt: timestamp,
          version: current.version + 1,
          extractionFingerprint: undefined,
        }),
        rewrites = notes
          .filter(
            (note) =>
              note.id !== currentId &&
              (note.links.some((link) => link.target === currentId) ||
                Object.values(note.sections).some((section) =>
                  section.contributions?.some((item) => item.owner === "source" && item.sourceNoteId === currentId),
                )),
          )
          .map((note) =>
            ltmNoteSchema.parse({
              ...note,
              links: note.links.map((link) => (link.target === currentId ? { ...link, target: targetId } : link)),
              sections: rewriteSectionContributionSourceIds(note, currentId, targetId),
              updatedAt: timestamp,
              version: note.version + 1,
            }),
          ),
        draftFiles = [] as Array<{
          path: string;
          before: unknown;
          after: unknown;
        }>;
      for (const entry of await readdir(getLongTermMemoryDirectories(this.root).drafts, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const path = safeJoin(getLongTermMemoryDirectories(this.root).drafts, entry.name),
          before = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>,
          source =
            before.source && typeof before.source === "object" && !Array.isArray(before.source)
              ? { ...(before.source as Record<string, unknown>) }
              : null,
          mutations = Array.isArray(before.mutations)
            ? before.mutations.map((mutation) => rewriteDraftMutationNoteIds(mutation, currentId, targetId))
            : before.mutations;
        let changed = JSON.stringify(mutations) !== JSON.stringify(before.mutations);
        if (source?.sourceNoteId === currentId) {
          source.sourceNoteId = targetId;
          source.sourceHash = sourceHashForLtmSourceNote(renamed);
          const parsedBefore = ltmExtractionDraftSchema.parse(before);
          source.extractionFingerprint = extractionFingerprintForLtmSourceNote(renamed, {
            scope: parsedBefore.scope,
            modes: parsedBefore.modes,
            extractionMode: parsedBefore.source.extractionFingerprint?.extractionMode ?? parsedBefore.modes[0],
          });
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
      const rejectedFile = await rewriteRejectedSuggestions(this.root, (suggestion) => {
        const source =
          suggestion.source.sourceNoteId === currentId
            ? { ...suggestion.source, sourceNoteId: targetId }
            : suggestion.source;
        const recovery = suggestion.candidate.recovery;
        return source === suggestion.source && recovery?.noteId !== currentId
          ? suggestion
          : {
              ...suggestion,
              source,
              ...(recovery?.noteId === currentId
                ? { candidate: { ...suggestion.candidate, recovery: { ...recovery, noteId: targetId } } }
                : {}),
            };
      });
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
          ...(rejectedFile ? [rejectedFile] : []),
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
  async renameNoteSection(id: string, fromSectionKey: string, toSectionKey: string) {
    await this.initializeLtmStore();
    const noteId = ltmNoteIdSchema.parse(id);
    const from = ltmSectionKeySchema.parse(fromSectionKey);
    const to = ltmSectionKeySchema.parse(toSectionKey);
    if (from === to) throw new LtmServiceError("Section keys must be different.", 400, "ltm_section_key_unchanged");
    return withLtmVaultLock(this.root, async () => {
      const current = await this.getNote(noteId);
      if (!current) throw new LtmServiceError(`Long-term memory note not found: ${noteId}`, 404, "ltm_note_not_found");
      if (current.type === "source")
        throw new LtmServiceError("Imported source sections cannot be renamed.", 400, "ltm_source_section_immutable");
      if (!Object.hasOwn(current.sections, from))
        throw new LtmServiceError(`Long-term memory section not found: ${from}`, 404, "ltm_section_not_found");
      if (Object.hasOwn(current.sections, to))
        throw new LtmServiceError(`Long-term memory section already exists: ${to}`, 409, "ltm_section_already_exists");

      const sections = Object.fromEntries(
        Object.entries(current.sections).map(([key, section]) => [key === from ? to : key, section]),
      );
      const timestamp = nowIso();
      const renamed = ltmNoteSchema.parse({
        ...current,
        sections,
        updatedAt: timestamp,
        version: current.version + 1,
      });
      const plan = await this.sectionRenamePlan(noteId, from, to, timestamp);
      await commitLtmMutation(this.root, {
        files: [
          { path: notePathForId(noteId, current.type, this.root), before: current, after: renamed },
          ...plan.draftFiles,
          ...(plan.rejectedFile ? [plan.rejectedFile] : []),
        ],
        events: [
          ltmEventSchema.parse({
            id: randomUUID(),
            ts: timestamp,
            type: `${current.type}.section_renamed`,
            target: noteId,
            payload: { note: renamed, fromSectionKey: from, toSectionKey: to },
          }),
        ],
      });
      return { note: renamed, rewrittenDraftCount: plan.draftFiles.length };
    });
  }
  async previewNoteSectionRename(id: string, fromSectionKey: string, toSectionKey: string) {
    await this.initializeLtmStore();
    const noteId = ltmNoteIdSchema.parse(id);
    const from = ltmSectionKeySchema.parse(fromSectionKey);
    const to = ltmSectionKeySchema.parse(toSectionKey);
    if (from === to) throw new LtmServiceError("Section keys must be different.", 400, "ltm_section_key_unchanged");
    const current = await this.getNote(noteId);
    if (!current) throw new LtmServiceError(`Long-term memory note not found: ${noteId}`, 404, "ltm_note_not_found");
    if (current.type === "source")
      throw new LtmServiceError("Imported source sections cannot be renamed.", 400, "ltm_source_section_immutable");
    if (!Object.hasOwn(current.sections, from))
      throw new LtmServiceError(`Long-term memory section not found: ${from}`, 404, "ltm_section_not_found");
    if (Object.hasOwn(current.sections, to))
      throw new LtmServiceError(`Long-term memory section already exists: ${to}`, 409, "ltm_section_already_exists");
    const plan = await this.sectionRenamePlan(noteId, from, to, nowIso());
    return {
      fromSectionKey: from,
      toSectionKey: to,
      rewrittenDraftCount: plan.draftFiles.length,
      rewrittenDraftIds: plan.draftFiles.map((file) => ltmExtractionDraftSchema.parse(file.before).id),
    };
  }
  private async sectionRenamePlan(noteId: string, from: string, to: string, timestamp: string) {
    const draftFiles: Array<{ path: string; before: unknown; after: unknown }> = [];
    const drafts = getLongTermMemoryDirectories(this.root).drafts;
    for (const entry of await readdir(drafts, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const path = safeJoin(drafts, entry.name);
      let before: Record<string, unknown>;
      try {
        before = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
      } catch {
        continue;
      }
      const parsed = ltmExtractionDraftSchema.safeParse(before);
      if (!parsed.success || parsed.data.status !== "pending") continue;
      const mutations = parsed.data.mutations.map((mutation) =>
        rewriteDraftMutationSectionKey(mutation, noteId, from, to),
      );
      if (JSON.stringify(mutations) === JSON.stringify(parsed.data.mutations)) continue;
      draftFiles.push({
        path,
        before,
        after: ltmExtractionDraftSchema.parse({
          ...parsed.data,
          mutations,
          updatedAt: timestamp,
        }),
      });
    }
    const rejectedFile = await rewriteRejectedSuggestions(this.root, (suggestion) => {
      const recovery = suggestion.candidate.recovery;
      return recovery?.noteId === noteId && recovery.sectionKey === from
        ? { ...suggestion, candidate: { ...suggestion.candidate, recovery: { ...recovery, sectionKey: to } } }
        : suggestion;
    });
    return { draftFiles, rejectedFile };
  }
  async archiveSourceNoteWithDerived(id: string) {
    return withLtmVaultLock(this.root, async () => {
      const source = await this.getNote(id);
      if (!source) throw new LtmServiceError(`Long-term memory note not found: ${id}`, 404, "ltm_note_not_found");
      const notes = await this.listNotes();
      const targets = [
        source,
        ...notes.filter(
          (note) =>
            note.id !== id && note.links.some((link) => link.relation === "extracted_from" && link.target === id),
        ),
      ];
      const archived = [];
      for (const note of targets) archived.push(await this.updateNote(note.id, { status: "archived" }));
      return archived;
    });
  }
  async deleteNotesPermanently(
    ids: string[],
    options: {
      retractExtracted?: boolean;
      excludedNoteIds?: string[];
      lineageSourceNoteId?: string;
      expectedLineageNoteIds?: string[];
    } = {},
  ) {
    await this.initializeLtmStore();
    const wanted = [...new Set(ids.map((id) => ltmNoteIdSchema.parse(id)))];
    const excludedNoteIds = new Set((options.excludedNoteIds ?? []).map((id) => ltmNoteIdSchema.parse(id)));
    return withLtmVaultLock(this.root, async () => {
      const notes = await this.listNotes();
      const lookup = new Map(notes.map((note) => [note.id, note]));
      const requestedSources = wanted.filter((id) => lookup.get(id)?.type === "source");
      if (requestedSources.length) {
        if (
          requestedSources.length !== 1 ||
          !options.retractExtracted ||
          !options.lineageSourceNoteId ||
          !options.expectedLineageNoteIds
        )
          throw new LtmServiceError(
            "Source deletion requires a current lineage preview and explicit selected memories.",
            400,
            "ltm_source_lineage_preview_required",
          );
      }
      if (options.lineageSourceNoteId || options.expectedLineageNoteIds) {
        if (!options.lineageSourceNoteId || !options.expectedLineageNoteIds)
          throw new LtmServiceError(
            "Source deletion preview is incomplete. Refresh the preview before deleting.",
            409,
            "ltm_source_lineage_stale",
          );
        const sourceId = ltmNoteIdSchema.parse(options.lineageSourceNoteId);
        if (lookup.get(sourceId)?.type !== "source" || !wanted.includes(sourceId))
          throw new LtmServiceError("Source deletion preview is invalid.", 400, "ltm_source_lineage_invalid");
        const expected = new Set(options.expectedLineageNoteIds.map((id) => ltmNoteIdSchema.parse(id)));
        if (wanted.some((id) => excludedNoteIds.has(id)))
          throw new LtmServiceError(
            "Source deletion selection contains overlapping selected and excluded memories.",
            400,
            "ltm_source_lineage_invalid",
          );
        const selectedAndExcluded = new Set([...wanted, ...excludedNoteIds]);
        const currentLineage = extractedLineageIds(notes, sourceId);
        const same = (left: Set<string>, right: Set<string>) =>
          left.size === right.size && [...left].every((id) => right.has(id));
        if (!same(expected, selectedAndExcluded) || !same(expected, currentLineage))
          throw new LtmServiceError(
            "Source lineage changed. Refresh the preview before deleting.",
            409,
            "ltm_source_lineage_stale",
          );
      }
      const requestedNotes = wanted.flatMap((id) => (lookup.get(id) ? [lookup.get(id)!] : []));
      const failedIds = wanted.filter((id) => !lookup.has(id));
      if (!requestedNotes.length) return { deletedIds: [], failedIds, deletedNotes: [], detachedNoteIds: [] };
      const deleted = new Set(requestedNotes.map((note) => note.id));
      const sourceIds = new Set(requestedNotes.filter((note) => note.type === "source").map((note) => note.id));
      const reprojected = new Map<string, LtmNote>();
      const detachedSourceIds = new Map<string, string[]>();
      if (options.retractExtracted && sourceIds.size)
        for (const note of notes) {
          if (deleted.has(note.id)) continue;
          const linkedSourceIds = note.links
            .filter((link) => link.relation === "extracted_from" && sourceIds.has(link.target))
            .map((link) => link.target);
          const excluded = excludedNoteIds.has(note.id) && linkedSourceIds.length > 0;
          let changed = false;
          const sections = Object.fromEntries(
            Object.entries(note.sections).flatMap(([key, section]) => {
              if (!section.contributions?.length && !excluded) return [[key, section]];
              const contributions = (section.contributions ?? [])
                .filter((contribution) => contribution.owner !== "source" || !sourceIds.has(contribution.sourceNoteId))
                .map((contribution) => {
                  const evidence = contribution.evidence?.filter(
                    (value) => ![...sourceIds].some((sourceId) => value === `source_note:${sourceId}`),
                  );
                  return evidence?.length === contribution.evidence?.length
                    ? contribution
                    : {
                        ...contribution,
                        evidence: evidence?.length ? evidence : undefined,
                      };
                });
              if (excluded && !contributions.some((item) => item.owner === "manual")) {
                const manual = manualContribution({
                  ...section,
                  evidence: section.evidence?.filter(
                    (value) => ![...sourceIds].some((sourceId) => value === `source_note:${sourceId}`),
                  ),
                });
                contributions.splice(
                  0,
                  contributions.length,
                  ...contributions.filter((item) => item.owner === "source"),
                  manual,
                );
              }
              if (JSON.stringify(contributions) === JSON.stringify(section.contributions)) return [[key, section]];
              changed = true;
              const rendered = renderSectionContributions(contributions, isAdditiveLtmSection(note, key));
              return rendered ? [[key, rendered]] : [];
            }),
          );
          if (!changed) continue;
          if (!Object.keys(sections).length && !excluded) deleted.add(note.id);
          else reprojected.set(note.id, { ...note, sections });
          if (excluded) detachedSourceIds.set(note.id, [...new Set(linkedSourceIds)]);
        }
      const deletedNotes = notes.filter((note) => deleted.has(note.id));
      const deletedIds = deletedNotes.map((note) => note.id);
      const timestamp = nowIso();
      const repairs = notes.flatMap((original) => {
        if (deleted.has(original.id)) return [];
        const note = reprojected.get(original.id) ?? original;
        const links = note.links.filter((link) => !deleted.has(link.target));
        if (note === original && links.length === original.links.length) return [];
        return [
          ltmNoteSchema.parse({
            ...note,
            links,
            updatedAt: timestamp,
            version: original.version + 1,
          }),
        ];
      });
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
        events: [
          ...deletedNotes.map((note) =>
            ltmEventSchema.parse({
              id: randomUUID(),
              ts: timestamp,
              type: `${note.type}.deleted`,
              target: note.id,
              payload: {
                note,
                detachedNoteIds: repairs
                  .filter((repair) => detachedSourceIds.get(repair.id)?.includes(note.id))
                  .map((repair) => repair.id),
              },
            }),
          ),
          ...repairs.map((note) =>
            ltmEventSchema.parse({
              id: randomUUID(),
              ts: timestamp,
              type: `${note.type}.${detachedSourceIds.has(note.id) ? "detached" : "updated"}`,
              target: note.id,
              payload: {
                note,
                previousNote: lookup.get(note.id),
                ...(detachedSourceIds.has(note.id) ? { detachedFrom: detachedSourceIds.get(note.id) } : {}),
              },
            }),
          ),
        ],
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
        if (usageChanged) await writeJsonAtomic(longTermMemoryUsagePath(this.root), usage);
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
          const filtered = receipt.chunks.filter((chunk: any) => !deleted.has(chunk.noteId));
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
      return {
        deletedIds,
        failedIds,
        deletedNotes,
        detachedNoteIds: [...detachedSourceIds.keys()],
      };
    });
  }
  async removeNoteFromScope(
    id: string,
    input: {
      chatIds?: string[];
      groupIds?: string[];
      groupId?: string;
      characterIds?: string[];
      personaIds?: string[];
    },
  ) {
    await this.initializeLtmStore();
    return withLtmVaultLock(this.root, async () => {
      const note = await this.getNote(id);
      if (!note) throw new LtmServiceError(`Long-term memory note not found: ${id}`, 404, "ltm_note_not_found");
      const removedChatIds = new Set(input.chatIds ?? []);
      const removedGroupIds = new Set([input.groupId, ...(input.groupIds ?? [])].filter(Boolean));
      const removedCharacterIds = new Set(input.characterIds ?? []);
      const removedPersonaIds = new Set(input.personaIds ?? []);
      const existingChatIds = getLtmScopeChatIds(note.scope);
      const existingGroupIds = getLtmScopeGroupIds(note.scope);
      const existingPersonaIds = getLtmScopePersonaIds(note.scope);
      const chatIds = existingChatIds.filter((value) => !removedChatIds.has(value));
      const characterIds = (note.scope.characterIds ?? []).filter((value) => !removedCharacterIds.has(value));
      const groupIds = existingGroupIds.filter((value) => !removedGroupIds.has(value));
      const personaIds = existingPersonaIds.filter((value) => !removedPersonaIds.has(value));
      const changed =
        chatIds.length !== existingChatIds.length ||
        characterIds.length !== (note.scope.characterIds ?? []).length ||
        groupIds.length !== existingGroupIds.length ||
        personaIds.length !== existingPersonaIds.length;
      if (!changed) return { note, deleted: false, changed: false };
      if (!chatIds.length && !characterIds.length && !groupIds.length && !personaIds.length) {
        await this.deleteNotesPermanently([id]);
        return { note: null, deleted: true, changed: true };
      }
      const scope: LtmScope = {};
      if (chatIds.length) {
        scope.chatIds = chatIds;
        scope.chatId = chatIds[0];
      }
      if (characterIds.length) scope.characterIds = characterIds;
      if (groupIds.length) scope.groupIds = groupIds;
      if (personaIds.length) scope.personaIds = personaIds;
      return {
        note: await this.updateNote(id, { scope }),
        deleted: false,
        changed: true,
      };
    });
  }
  async cleanup() {
    initialized.delete(resolve(this.root));
  }
}
