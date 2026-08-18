import { randomUUID } from "node:crypto";
import { cp, mkdir, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  ltmIdentityRepairApplyRequestSchema,
  ltmIdentityRepairApplyResponseSchema,
  ltmIdentityRepairPreviewResponseSchema,
  ltmNoteSchema,
  type LtmConflict,
  type LtmIdentityMatchBasis,
  type LtmIdentityRepairApplyRequest,
  type LtmIdentityRepairApplyResponse,
  type LtmIdentityRepairCandidate,
  type LtmIdentityRepairPreviewResponse,
  type LtmIdentityRepairSelection,
  type LtmNote,
  type LtmScope,
  type LtmSection,
  type LtmSubject,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  getLtmScopeChatIds,
  getLtmScopeGroupIds,
  getLtmScopePersonaIds,
  withMergedLtmScopeLinks,
} from "../../../../shared/src/features/agents/long-term-memory/scope.js";
import { uniqueLinks } from "../../../../shared/src/features/agents/long-term-memory/utils.js";
import { writeJsonAtomic } from "./atomic-json.js";
import { stableJsonHash } from "./chunking.js";
import { isAdditiveLtmSection } from "./draft-projector.js";
import { nowIso, uniqueStrings } from "./ltm-utils.js";
import { checkLongTermMemoryIntegrity } from "./maintenance.js";
import { logger } from "./package-runtime.js";
import { getLongTermMemoryRoot } from "./paths.js";
import { rebuildLongTermMemoryIndexes } from "./rebuild.js";
import { LongTermMemoryStorage, type UpdateLtmNotePatch } from "./storage.js";
import {
  analyzeTrustedLtmNoteSubjects,
  type TrustedLtmNoteSubjectMatch,
  type TrustedLtmSubjectCatalog,
} from "./subject-identity.js";
import { withLtmVaultLock } from "./vault-lock.js";
import { LtmServiceError } from "./service-error.js";

type Group = {
  id: string;
  noteType: "character" | "relationship";
  subjects: LtmSubject[];
  subjectNames: string[];
  matches: TrustedLtmNoteSubjectMatch[];
  canonical: TrustedLtmNoteSubjectMatch;
};
type Prepared = {
  group: Group;
  canonical: TrustedLtmNoteSubjectMatch;
  archived: TrustedLtmNoteSubjectMatch[];
  excludedNoteIds: string[];
  patch: UpdateLtmNotePatch;
};
export type LtmIdentityRepairBackup = { id: string; createdAt: string; directory: string; snapshotRoot: string };
const locks = new Map<string, Promise<void>>();
export class LtmIdentityRepairError extends LtmServiceError {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
  ) {
    super(message, statusCode, code);
    this.name = "LtmIdentityRepairError";
  }
}

export function previewLtmIdentityRepairs(
  catalog: TrustedLtmSubjectCatalog,
  scope: LtmScope,
  generatedAt = nowIso(),
  canonicalNoteIds: Record<string, string> = {},
): LtmIdentityRepairPreviewResponse {
  const { groups, unresolved, analyzedNotes } = analyze(catalog),
    candidates = groups.map((group) => candidate(group, canonicalNoteIds[group.id]));
  return ltmIdentityRepairPreviewResponseSchema.parse({
    generatedAt,
    scope,
    counts: {
      analyzedNotes,
      candidateCount: candidates.length,
      bindableNotes: groups.reduce((n, g) => n + g.matches.filter((m) => !m.note.subjects).length, 0),
      duplicateNotes: groups.reduce((n, g) => n + Math.max(0, g.matches.length - 1), 0),
      unresolvedNotes: unresolved.length,
    },
    candidates,
    unresolved,
  });
}

export async function applyLtmIdentityRepairs(
  request: LtmIdentityRepairApplyRequest,
  options: { root?: string; loadCatalog: () => Promise<TrustedLtmSubjectCatalog> },
): Promise<LtmIdentityRepairApplyResponse> {
  const parsed = ltmIdentityRepairApplyRequestSchema.parse(request),
    root = options.root ?? getLongTermMemoryRoot();
  return withRepairLock(root, () =>
    withLtmVaultLock(root, async () => {
      const storage = new LongTermMemoryStorage(root);
      await storage.initializeLtmStore();
      const groups = new Map(analyze(await options.loadCatalog()).groups.map((group) => [group.id, group])),
        prepared = parsed.repairs.map((selection) => prepare(groups, selection));
      assertDisjoint(prepared);
      const backup = await createLtmIdentityRepairBackup(root);
      try {
        const results: LtmIdentityRepairApplyResponse["repairs"] = [];
        for (const repair of prepared) {
          await storage.updateNote(repair.canonical.note.id, repair.patch);
          let rewrittenNoteCount = 0,
            rewrittenDraftCount = 0;
          for (const duplicate of repair.archived) {
            const rewritten = await storage.redirectReferences(duplicate.note.id, repair.canonical.note.id);
            rewrittenNoteCount += rewritten.rewrittenNoteCount;
            rewrittenDraftCount += rewritten.rewrittenDraftCount;
            await storage.updateNote(duplicate.note.id, { status: "archived", subjects: repair.group.subjects });
          }
          results.push({
            candidateId: repair.group.id,
            canonicalNoteId: repair.canonical.note.id,
            archivedNoteIds: repair.archived.map((match) => match.note.id),
            excludedNoteIds: repair.excludedNoteIds,
            rewrittenNoteCount,
            rewrittenDraftCount,
          });
        }
        const rebuild = await rebuildLongTermMemoryIndexes({ root }),
          integrity = await checkLongTermMemoryIntegrity(root);
        return ltmIdentityRepairApplyResponseSchema.parse({
          repairedAt: nowIso(),
          backup: { id: backup.id, createdAt: backup.createdAt },
          repairs: results,
          rebuild: {
            generatedAt: rebuild.generatedAt,
            noteCount: rebuild.noteCount,
            chunkCount: rebuild.chunkCount,
            embeddedChunkCount: rebuild.embeddedChunkCount,
            embeddingsAvailable: rebuild.embeddingsAvailable,
          },
          integrity,
        });
      } catch (error) {
        try {
          await restoreLtmIdentityRepairBackup(root, backup);
        } catch (restoreError) {
          logger.error(restoreError, "[ltm] Failed to restore identity-repair backup %s", backup.id);
          throw new LtmIdentityRepairError(
            `Identity repair failed and its backup could not be restored: ${message(error)}`,
            500,
            "identity_repair_restore_failed",
          );
        }
        throw error;
      }
    }),
  );
}

export function getLtmIdentityRepairBackupsRoot(root = getLongTermMemoryRoot()) {
  return join(dirname(root), "backups", "long-term-memory-identity-repairs");
}
export async function createLtmIdentityRepairBackup(root = getLongTermMemoryRoot()): Promise<LtmIdentityRepairBackup> {
  return withLtmVaultLock(root, async () => {
    const id = randomUUID(),
      createdAt = nowIso(),
      directory = join(getLtmIdentityRepairBackupsRoot(root), id),
      snapshotRoot = join(directory, basename(root));
    await mkdir(directory, { recursive: true });
    try {
      await cp(root, snapshotRoot, { recursive: true, errorOnExist: true, force: false });
      await writeJsonAtomic(join(directory, "manifest.json"), {
        version: 1,
        id,
        createdAt,
        sourceDirectory: basename(root),
        purpose: "long-term-memory-identity-repair",
      });
    } catch (error) {
      await rm(directory, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
    return { id, createdAt, directory, snapshotRoot };
  });
}
export async function restoreLtmIdentityRepairBackup(root: string, backup: LtmIdentityRepairBackup) {
  return withLtmVaultLock(root, async () => {
    const parent = dirname(root),
      id = randomUUID(),
      staging = join(parent, `.${basename(root)}-identity-restore-${id}`),
      failed = join(parent, `.${basename(root)}-identity-failed-${id}`);
    await rm(staging, { recursive: true, force: true });
    await rm(failed, { recursive: true, force: true });
    await cp(backup.snapshotRoot, staging, { recursive: true, errorOnExist: true, force: false });
    await rename(root, failed);
    try {
      await rename(staging, root);
    } catch (error) {
      await rename(failed, root).catch(() => {});
      throw error;
    }
    await rm(failed, { recursive: true, force: true });
  });
}

function analyze(catalog: TrustedLtmSubjectCatalog) {
  const analysis = analyzeTrustedLtmNoteSubjects(catalog),
    grouped = new Map<string, TrustedLtmNoteSubjectMatch[]>();
  for (const match of analysis.matches) {
    const key = `${match.note.type}\0${match.subjects.map((subject) => subject.key).join("\0")}`,
      current = grouped.get(key) ?? [];
    current.push(match);
    grouped.set(key, current);
  }
  const entries = new Map(catalog.entries.map((entry) => [entry.subject.key, entry])),
    groups: Group[] = [];
  for (const matches of grouped.values()) {
    if (matches.length === 1 && matches[0]!.note.subjects) continue;
    const ordered = [...matches].sort(compare),
      canonical = ordered[0]!,
      subjects = [...canonical.subjects].sort((a, b) => a.key.localeCompare(b.key)),
      noteType = canonical.note.type as "character" | "relationship";
    groups.push({
      id: stableJsonHash({
        noteType,
        subjects,
        notes: [...matches]
          .sort((a, b) => a.note.id.localeCompare(b.note.id))
          .map((match) => ({ note: match.note, basis: match.basis, exactFullName: match.exactFullName })),
      }),
      noteType,
      subjects,
      subjectNames: subjects.map((subject) => entries.get(subject.key)?.name ?? subject.key),
      matches: ordered,
      canonical,
    });
  }
  groups.sort((a, b) => a.canonical.note.id.localeCompare(b.canonical.note.id));
  return {
    groups,
    analyzedNotes: analysis.matches.length + analysis.unresolved.length,
    unresolved: analysis.unresolved.map((issue) => ({
      noteId: issue.note.id,
      noteType: issue.note.type as "character" | "relationship",
      title: issue.note.title?.trim() || issue.note.id,
      reason: issue.reason,
      basis: issue.basis,
      candidateSubjectKeys: issue.candidateSubjectKeys,
    })),
  };
}
function candidate(group: Group, canonicalId = group.canonical.note.id): LtmIdentityRepairCandidate {
  const canonical = group.matches.find((match) => match.note.id === canonicalId);
  if (!canonical)
    throw new LtmIdentityRepairError(
      "The identity repair canonical choice is stale. Refresh the preview before applying changes.",
      409,
      "identity_repair_stale",
    );
  const sectionPreview = previewSections(group.matches, canonical.note.id);
  return {
    id: group.id,
    noteType: group.noteType,
    subjects: group.subjects,
    subjectNames: group.subjectNames,
    canonicalNoteId: canonical.note.id,
    duplicateNoteIds: group.matches.map((m) => m.note.id).filter((id) => id !== canonical.note.id),
    notes: group.matches.map((m) => ({
      noteId: m.note.id,
      title: m.note.title?.trim() || m.note.id,
      createdAt: m.note.createdAt,
      basis: m.basis,
      alreadyBound: Boolean(m.note.subjects),
      exactFullName: m.exactFullName,
    })),
    matchBasis: uniqueBases(group.matches.map((m) => m.basis)),
    ...sectionPreview,
    blockingReasons: blockers(group.matches, canonical.note.id),
  };
}
function prepare(groups: Map<string, Group>, selection: LtmIdentityRepairSelection): Prepared {
  const group = groups.get(selection.candidateId);
  if (!group)
    throw new LtmIdentityRepairError(
      "The identity repair preview is stale. Refresh the preview before applying changes.",
      409,
      "identity_repair_stale",
    );
  const ids = new Set(group.matches.map((m) => m.note.id));
  if (!ids.has(selection.canonicalNoteId) || selection.excludedNoteIds.some((id) => !ids.has(id)))
    throw new LtmIdentityRepairError(
      "The identity repair selection is invalid.",
      400,
      "identity_repair_invalid_selection",
    );
  const excluded = new Set(selection.excludedNoteIds),
    included = group.matches.filter((m) => !excluded.has(m.note.id)),
    canonical = included.find((m) => m.note.id === selection.canonicalNoteId)!;
  if (included.length === 1)
    throw new LtmIdentityRepairError(
      "Include at least one duplicate note before applying this identity repair.",
      400,
      "identity_repair_noop",
    );
  const blocking = blockers(included, canonical.note.id);
  if (blocking.length) throw new LtmIdentityRepairError(blocking.join(" "), 409, "identity_repair_blocked");
  const patch = projectRepair(included, canonical, group.subjects, selection.sectionChoices);
  return {
    group,
    canonical,
    archived: included.filter((m) => m.note.id !== canonical.note.id),
    excludedNoteIds: selection.excludedNoteIds,
    patch,
  };
}
function projectRepair(
  matches: TrustedLtmNoteSubjectMatch[],
  canonical: TrustedLtmNoteSubjectMatch,
  subjects: LtmSubject[],
  choices: LtmIdentityRepairSelection["sectionChoices"],
): UpdateLtmNotePatch {
  const patch = project(matches, canonical, subjects, choices),
    scopes = matches.map((match) => match.note.scope),
    scope = withMergedLtmScopeLinks(
      {},
      {
        chatIds: uniqueStrings(scopes.flatMap(getLtmScopeChatIds)),
        groupIds: uniqueStrings(scopes.flatMap(getLtmScopeGroupIds)),
        characterIds: uniqueStrings(scopes.flatMap((value) => value.characterIds ?? [])),
        personaIds: uniqueStrings(scopes.flatMap(getLtmScopePersonaIds)),
      },
    ),
    validated = ltmNoteSchema.parse({ ...canonical.note, ...patch, scope });
  return { ...patch, scope: validated.scope };
}
function project(
  matches: TrustedLtmNoteSubjectMatch[],
  canonical: TrustedLtmNoteSubjectMatch,
  subjects: LtmSubject[],
  choices: LtmIdentityRepairSelection["sectionChoices"],
): UpdateLtmNotePatch {
  const ordered = canonicalFirst(matches, canonical.note.id),
    archived = new Set(ordered.slice(1).map((m) => m.note.id)),
    choiceByKey = new Map(choices.map((choice) => [choice.sectionKey, choice.noteId])),
    sections: LtmNote["sections"] = {};
  for (const key of uniqueStrings(ordered.flatMap((m) => Object.keys(m.note.sections))).sort()) {
    const entries = ordered.flatMap((m) =>
      m.note.sections[key] ? [{ noteId: m.note.id, section: m.note.sections[key]! }] : [],
    );
    if (isAdditiveLtmSection(canonical.note, key)) {
      sections[key] = mergeAdditive(entries.map((entry) => entry.section));
      continue;
    }
    const options = superseding(entries);
    let selected = options[0]!;
    if (options.length > 1) {
      const selectedId = choiceByKey.get(key);
      if (!selectedId)
        throw new LtmIdentityRepairError(
          `Choose which ${key.replace(/_/g, " ")} value to keep.`,
          400,
          "identity_repair_conflict_unresolved",
        );
      const found = options.find((option) => option.noteIds.includes(selectedId));
      if (!found)
        throw new LtmIdentityRepairError(
          `The selected ${key.replace(/_/g, " ")} value is no longer available.`,
          409,
          "identity_repair_stale",
        );
      selected = found;
    }
    sections[key] = mergeSuperseding(
      entries.find((entry) => selected.noteIds.includes(entry.noteId))!.section,
      entries.map((entry) => entry.section),
    );
  }
  const scopes = ordered.map((m) => m.note.scope),
    groupIds = uniqueStrings(scopes.map((scope) => scope.groupId)),
    scope = withMergedLtmScopeLinks(groupIds[0] ? { groupId: groupIds[0] } : {}, {
      chatIds: uniqueStrings(scopes.flatMap(getLtmScopeChatIds)),
      characterIds: uniqueStrings(scopes.flatMap((scope) => scope.characterIds ?? [])),
    }),
    links = uniqueLinks(
      ordered
        .flatMap((m) => m.note.links)
        .map((link) => (archived.has(link.target) ? { ...link, target: canonical.note.id } : link))
        .filter((link) => link.target !== canonical.note.id),
    ),
    conflicts = uniqueConflicts(ordered.flatMap((m) => m.note.conflicts ?? [])),
    patch: UpdateLtmNotePatch = {
      modes: uniqueStrings(ordered.flatMap((m) => m.note.modes)) as LtmNote["modes"],
      scope,
      tags: uniqueStrings(ordered.flatMap((m) => m.note.tags)),
      keywords: uniqueInsensitive(ordered.flatMap((m) => m.note.keywords)),
      links,
      sections,
      conflicts: conflicts.length ? conflicts : undefined,
      subjects,
    };
  ltmNoteSchema.parse({ ...canonical.note, ...patch, updatedAt: nowIso(), version: canonical.note.version + 1 });
  return patch;
}
function previewSections(matches: TrustedLtmNoteSubjectMatch[], canonicalId: string) {
  const ordered = canonicalFirst(matches, canonicalId),
    canonical = ordered[0]!.note,
    additiveContent: LtmIdentityRepairCandidate["additiveContent"] = [],
    supersedingConflicts: LtmIdentityRepairCandidate["supersedingConflicts"] = [];
  for (const key of uniqueStrings(ordered.flatMap((m) => Object.keys(m.note.sections))).sort()) {
    const entries = ordered.flatMap((m) =>
      m.note.sections[key] ? [{ noteId: m.note.id, section: m.note.sections[key]! }] : [],
    );
    if (isAdditiveLtmSection(canonical, key)) {
      const seen = new Set(lines(canonical.sections[key]?.text ?? "").map(normalizeLine)),
        addedLines: string[] = [],
        sourceNoteIds = new Set<string>();
      for (const entry of entries.filter((item) => item.noteId !== canonicalId))
        for (const line of lines(entry.section.text)) {
          const normalized = normalizeLine(line);
          if (!normalized || seen.has(normalized)) continue;
          seen.add(normalized);
          addedLines.push(line);
          sourceNoteIds.add(entry.noteId);
        }
      if (addedLines.length) additiveContent.push({ sectionKey: key, addedLines, sourceNoteIds: [...sourceNoteIds] });
    } else {
      const options = superseding(entries);
      if (options.length > 1) supersedingConflicts.push({ sectionKey: key, options });
    }
  }
  return { additiveContent, supersedingConflicts };
}
function blockers(matches: TrustedLtmNoteSubjectMatch[], canonicalId: string) {
  const ordered = canonicalFirst(matches, canonicalId),
    result: string[] = [];
  if (uniqueStrings(ordered.map((m) => m.note.scope.groupId)).length > 1)
    result.push("The selected notes belong to different groups and cannot be merged safely.");
  if (new Set(ordered.map((m) => m.note.scope.personaId ?? "")).size > 1)
    result.push("The selected notes belong to different personas and cannot be merged safely.");
  if (uniqueStrings(ordered.flatMap((m) => m.note.tags)).length > 100)
    result.push("Combined tags exceed the 100-tag note limit.");
  if (uniqueInsensitive(ordered.flatMap((m) => m.note.keywords)).length > 30)
    result.push("Combined keywords exceed the 30-keyword note limit.");
  if (uniqueLinks(ordered.flatMap((m) => m.note.links)).length > 250)
    result.push("Combined links exceed the 250-link note limit.");
  if (uniqueConflicts(ordered.flatMap((m) => m.note.conflicts ?? [])).length > 250)
    result.push("Combined note conflicts exceed the 250-conflict note limit.");
  const canonical = ordered[0]!.note;
  for (const key of uniqueStrings(ordered.flatMap((m) => Object.keys(m.note.sections)))) {
    const sections = ordered.flatMap((m) => (m.note.sections[key] ? [m.note.sections[key]!] : []));
    if (uniqueStrings(sections.flatMap((section) => section.evidence ?? [])).length > 100)
      result.push(`${key} has more than 100 combined evidence references.`);
    if (isAdditiveLtmSection(canonical, key) && mergeLines(sections.map((section) => section.text)).length > 20_000)
      result.push(`${key} exceeds the 20,000-character section limit.`);
  }
  return uniqueStrings(result);
}
function mergeAdditive(sections: LtmSection[]): LtmSection {
  return {
    text: mergeLines(sections.map((section) => section.text)),
    updatedAt: nowIso(),
    salience: max(sections.map((section) => section.salience)),
    confidence: max(sections.map((section) => section.confidence)),
    importance: (["critical", "major", "moderate", "minor"] as const).find((value) =>
      sections.some((section) => section.importance === value),
    ),
    dimensions: sections.find((section) => section.dimensions)?.dimensions,
    dimensionChanges: sections.find((section) => section.dimensionChanges)?.dimensionChanges,
    evidence: optional(uniqueStrings(sections.flatMap((section) => section.evidence ?? []))),
  };
}
function mergeSuperseding(selected: LtmSection, all: LtmSection[]): LtmSection {
  return {
    ...selected,
    text: selected.text.trim(),
    updatedAt: nowIso(),
    evidence: optional(uniqueStrings(all.flatMap((section) => section.evidence ?? []))),
  };
}
function superseding(entries: Array<{ noteId: string; section: LtmSection }>) {
  const map = new Map<string, { noteIds: string[]; text: string }>();
  for (const entry of entries) {
    const key = entry.section.text.trim().replace(/\s+/g, " ").toLocaleLowerCase(),
      current = map.get(key);
    if (current) current.noteIds.push(entry.noteId);
    else map.set(key, { noteIds: [entry.noteId], text: entry.section.text.trim() });
  }
  return [...map.values()];
}
function mergeLines(texts: string[]) {
  const result: string[] = [],
    seen = new Set<string>();
  for (const text of texts)
    for (const line of lines(text)) {
      const key = normalizeLine(line);
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(line);
      }
    }
  return result.join("\n");
}
function lines(text: string) {
  return text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
}
function normalizeLine(line: string) {
  return line
    .trim()
    .replace(/^[-*+]\s+/, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}
function uniqueInsensitive(values: string[]) {
  const seen = new Set<string>();
  return values
    .filter((value) => {
      const key = value.trim().toLocaleLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((value) => value.trim());
}
function uniqueConflicts(values: LtmConflict[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = stableJsonHash(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function optional(values: string[]) {
  return values.length ? values : undefined;
}
function max(values: Array<number | undefined>) {
  const present = values.filter((value): value is number => value !== undefined);
  return present.length ? Math.max(...present) : undefined;
}
function uniqueBases(values: LtmIdentityMatchBasis[]) {
  const order: LtmIdentityMatchBasis[] = [
      "bound_subjects",
      "exact_name",
      "unique_alias",
      "trait_or_qualified_alias",
      "spelling_variation",
      "unordered_pair",
    ],
    set = new Set(values);
  return order.filter((value) => set.has(value));
}
function canonicalFirst(matches: TrustedLtmNoteSubjectMatch[], id: string) {
  return [...matches].sort((a, b) => (a.note.id === id ? 0 : 1) - (b.note.id === id ? 0 : 1) || compare(a, b));
}
function compare(a: TrustedLtmNoteSubjectMatch, b: TrustedLtmNoteSubjectMatch) {
  return (
    (a.exactFullName ? 0 : 1) - (b.exactFullName ? 0 : 1) ||
    a.note.createdAt.localeCompare(b.note.createdAt) ||
    a.note.id.localeCompare(b.note.id)
  );
}
function assertDisjoint(repairs: Prepared[]) {
  const ids = new Set<string>();
  for (const repair of repairs)
    for (const match of repair.group.matches) {
      if (ids.has(match.note.id))
        throw new LtmIdentityRepairError(
          `Note ${match.note.id} appears in more than one selected repair.`,
          400,
          "identity_repair_invalid_selection",
        );
      ids.add(match.note.id);
    }
}
async function withRepairLock<T>(root: string, operation: () => Promise<T>) {
  const previous = locks.get(root) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
      release = resolve;
    }),
    tail = previous.then(
      () => current,
      () => current,
    );
  locks.set(root, tail);
  try {
    await previous.catch(() => {});
    return await operation();
  } finally {
    release();
    if (locks.get(root) === tail) locks.delete(root);
  }
}
function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
