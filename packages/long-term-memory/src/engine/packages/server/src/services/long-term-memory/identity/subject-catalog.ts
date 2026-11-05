import { createHash } from "node:crypto";
import {
  getLtmScopeChatIds,
  getLtmScopeGroupIds,
  getLtmScopePersonaIds,
  isGlobalLtmScope,
  isLtmSourceLikeNote,
  matchesLtmScope,
  type LtmIdentityMatchBasis,
  type LtmMode,
  type LtmNote,
  type LtmScope,
  type LtmSubject,
  type LtmSubjectReference,
} from "../../../../../shared/src/features/agents/long-term-memory/index.js";
import {
  isLocalCharacterSubject,
  localCharacterScopeError,
  localCharacterFamilyFromKey,
  localCharacterSubjectFromKey,
  localCharacterSubjectForName,
  ltmScopeFamilyId,
  normalizeLtmChatCharacterIds,
} from "./chat-scope.js";
import { uniqueStrings, normalizeSubjectName } from "../ltm-utils.js";
import { LongTermMemoryStorage } from "../persistence/storage.js";
import { getPackagePersistence, getPackageResources } from "../package-runtime.js";
import { readSavedLtmSubjectIdentityChoices } from "../drafts/rejected-suggestions.js";
import {
  nameTokensRelated,
  partialNameTokensMatch,
  SOURCE_BACKED_NPC_NAME_PATTERN,
  sourceBackedNpcNames,
  stripNotePrefix,
  subjectLabelFromKey,
} from "./subject-names.js";
import {
  buildCatalogIndex,
  canonicalNoteIdForEntries,
  type CatalogIndex,
  compareNoteAge,
  entryIdentityTokens,
  identityBasisPriority,
  isDominatedUnboundNpcEntry,
  isTrustedCharacterOrPersonaSubject,
  matchDirect,
  matchLegacyCharacter,
  matchRelationship,
  publicIdentityMatchBasis,
  sortSubjects,
  subjectEntryKey,
  type SubjectMatch,
  subjectRefKey,
  type TrustedLtmSubjectCatalog,
  type TrustedLtmSubjectCatalogEntry,
  uniqueSubjectPairs,
} from "./subject-matching.js";

type RosterSubjectInput = {
  kind: LtmSubjectReference["kind"];
  id: string;
  name: string;
  aliases?: string[];
  provenance?: string;
  sourceScope?: "direct" | "group";
};

export function trustedLtmCharacterAliasIdentifiers(catalog: TrustedLtmSubjectCatalog) {
  return new Set(
    catalog.entries
      .filter((entry) => entry.subject.ref?.kind === "character")
      .flatMap((entry) => [entry.name, ...entry.aliases].map((alias) => normalizeSubjectName(alias)))
      .filter(Boolean),
  );
}

export type TrustedLtmNoteSubjectMatch = {
  note: LtmNote;
  subjects: LtmSubject[];
  entries: TrustedLtmSubjectCatalogEntry[];
  basis: LtmIdentityMatchBasis;
  exactFullName: boolean;
};

export type TrustedLtmNoteSubjectIssue = {
  note: LtmNote;
  reason: "ambiguous" | "untrusted" | "invalid_cardinality";
  basis: string;
  candidateSubjectKeys: string[];
  candidateSubjectPairs?: string[][];
};

function legacyNoteMatch(note: LtmNote, index: CatalogIndex) {
  const identifiers = uniqueStrings([note.title ? normalizeSubjectName(note.title) : "", stripNotePrefix(note.id)]);
  const attempts = identifiers.map((identifier) =>
    note.type === "character" ? matchLegacyCharacter(index, identifier) : matchRelationship(index, identifier),
  );
  const matchedBySubjects = new Map<string, Extract<SubjectMatch, { status: "matched" }>>();
  for (const attempt of attempts) {
    if (attempt.status !== "matched") continue;
    const identityKey = attempt.entries.map(subjectEntryKey).sort().join("\u0000");
    const current = matchedBySubjects.get(identityKey);
    if (!current || identityBasisPriority(attempt.basis) < identityBasisPriority(current.basis))
      matchedBySubjects.set(identityKey, attempt);
  }
  return { attempts, matchedBySubjects };
}

function legacyIdentifiersConflict(result: ReturnType<typeof legacyNoteMatch>) {
  if (result.matchedBySubjects.size > 1) return true;
  const matchedKeys = new Set(
    [...result.matchedBySubjects.values()].flatMap((match) => match.entries.map(subjectEntryKey)),
  );
  return result.attempts.some(
    (attempt) =>
      attempt.status === "ambiguous" &&
      attempt.keys.some((key) => key.split("\u0000").some((subjectKey) => !matchedKeys.has(subjectKey))),
  );
}

export async function loadTrustedLtmSubjectCatalog(
  scope: LtmScope,
  root?: string,
  preloadedNotes?: readonly LtmNote[],
): Promise<TrustedLtmSubjectCatalog> {
  const persistence = getPackagePersistence();
  const resources = getPackageResources();
  const chatIds = getLtmScopeChatIds(scope);
  const groupIds = getLtmScopeGroupIds(scope);
  const [explicitChats, allChats] = await Promise.all([
    Promise.all(chatIds.map((id) => persistence.getChat(id))),
    groupIds.length ? persistence.listChats() : Promise.resolve([]),
  ]);
  const chats = [
    ...new Map(
      [
        ...explicitChats.filter((chat): chat is NonNullable<typeof chat> => Boolean(chat)),
        ...allChats.filter((chat) => chat.groupId && groupIds.includes(chat.groupId)),
      ].map((chat) => [chat.id, chat]),
    ).values(),
  ];
  const explicitCharacterIds = new Set([
    ...(scope.characterIds ?? []),
    ...explicitChats.filter(Boolean).flatMap((chat) => normalizeLtmChatCharacterIds(chat!.characterIds)),
  ]);
  const explicitPersonaIds = new Set([
    ...getLtmScopePersonaIds(scope),
    ...explicitChats
      .filter(Boolean)
      .map((chat) => chat!.personaId ?? undefined)
      .filter((id): id is string => Boolean(id)),
  ]);
  const characterIds = uniqueStrings([
    ...(scope.characterIds ?? []),
    ...chats.flatMap((chat) => normalizeLtmChatCharacterIds(chat.characterIds)),
  ]);
  const personaIds = uniqueStrings([
    ...getLtmScopePersonaIds(scope),
    ...chats.map((chat) => chat.personaId ?? undefined),
  ]);
  const [characterRows, personaRows, notes] = await Promise.all([
    resources.listCharacters(characterIds),
    resources.listPersonas(personaIds),
    preloadedNotes
      ? preloadedNotes.filter((note) =>
          matchesLtmScope(note, {
            scope,
            includeGlobal: isGlobalLtmScope(scope),
          }),
        )
      : new LongTermMemoryStorage(root).listNotes({
          scope,
          includeGlobal: isGlobalLtmScope(scope),
        }),
  ]);

  const roster: RosterSubjectInput[] = [];
  for (const row of characterRows) {
    if (!row) continue;
    const data = readObject(row.data);
    const name = readName(data.name);
    if (!name) continue;
    const isDirect = explicitCharacterIds.has(row.id);
    roster.push({
      kind: "character",
      id: row.id,
      name,
      aliases: extractAliases(data),
      provenance: isDirect ? `roster:character:${row.id}` : `group_roster:character:${row.id}`,
      sourceScope: isDirect ? "direct" : "group",
    });
  }
  for (const row of personaRows) {
    if (!row) continue;
    const record = readObject(row.data);
    const name = readName(record.name);
    if (!name) continue;
    const isDirect = explicitPersonaIds.has(row.id);
    roster.push({
      kind: "persona",
      id: row.id,
      name,
      aliases: extractAliases(record),
      provenance: isDirect ? `roster:persona:${row.id}` : `group_roster:persona:${row.id}`,
      sourceScope: isDirect ? "direct" : "group",
    });
  }

  return {
    ...buildTrustedLtmSubjectCatalog({
      roster,
      notes,
      localSourceNotes: notes.filter((note) => isLtmSourceLikeNote(note)),
    }),
    identityChoices: await readSavedLtmSubjectIdentityChoices(scope, root),
  };
}

export function buildTrustedLtmSubjectCatalog({
  roster,
  notes,
  localSourceNotes = [],
}: {
  roster: RosterSubjectInput[];
  notes: LtmNote[];
  localSourceNotes?: LtmNote[];
}): TrustedLtmSubjectCatalog {
  notes = notes.filter((note) => !localCharacterScopeError(note.subjects, note.destinationScope ?? note.scope));
  const preferredKeyByRef = new Map<string, string>();
  for (const note of [...notes].sort(compareNoteAge)) {
    for (const subject of note.subjects ?? []) {
      if (!subject.ref) continue;
      const refKey = subjectRefKey(subject.ref);
      if (!preferredKeyByRef.has(refKey)) preferredKeyByRef.set(refKey, subject.key);
    }
  }

  const mutable = new Map<
    string,
    {
      subject: LtmSubject;
      name: string;
      aliases: Set<string>;
      canonicalSlug: string;
      familyId?: string;
      provenance?: string;
      sourceScope?: "direct" | "group" | "local_note" | "local_source";
    }
  >();
  for (const item of roster) {
    const ref = { kind: item.kind, id: item.id } satisfies LtmSubjectReference;
    const key = preferredKeyByRef.get(subjectRefKey(ref)) ?? `${item.kind}:${item.id}`;
    const aliases = new Set(uniqueStrings(item.aliases ?? []));
    mutable.set(key, {
      subject: { key, ref },
      name: item.name,
      aliases,
      canonicalSlug: normalizeSubjectName(item.name) || "subject",
      provenance: item.provenance ?? `${item.kind}:${item.id}`,
      sourceScope: item.sourceScope ?? "direct",
    });
  }

  for (const note of notes.filter((candidate) => candidate.status !== "archived")) {
    const subjects = note.subjects ?? [];
    for (const subject of subjects) {
      if (isLocalCharacterSubject(subject) && localCharacterScopeError([subject], note.destinationScope ?? note.scope))
        continue;
      const normalizedSubject = localCharacterSubjectFromKey(subject) ?? subject;
      const existing =
        mutable.get(normalizedSubject.key) ??
        (normalizedSubject.ref
          ? [...mutable.values()].find(
              (entry) =>
                entry.subject.ref && subjectRefKey(entry.subject.ref) === subjectRefKey(normalizedSubject.ref!),
            )
          : undefined);
      const noteName = note.type === "character" && subjects.length === 1 ? subjectNameFromNote(note) : "";
      if (existing) {
        if (noteName) existing.aliases.add(noteName);
        continue;
      }
      const name = noteName || subjectLabelFromKey(normalizedSubject.key);
      mutable.set(normalizedSubject.key, {
        subject: normalizedSubject,
        name,
        aliases: new Set(),
        canonicalSlug: normalizeSubjectName(name) || subjectSlugFromNote(note),
        ...(localCharacterFamilyFromKey(normalizedSubject.key)
          ? { familyId: localCharacterFamilyFromKey(normalizedSubject.key)! }
          : {}),
        provenance: `note:${note.id}`,
        sourceScope: "local_note",
      });
    }
  }

  const sourceNamesByFamily = new Map<string, { scope: LtmScope; names: Map<string, string>; noteIds: string[] }>();
  for (const note of localSourceNotes.filter(
    (candidate) => candidate.status !== "archived" && candidate.modes.includes("roleplay"),
  )) {
    const scope = note.destinationScope ?? note.scope;
    const familyId = ltmScopeFamilyId(scope);
    if (!familyId) continue;
    const bucket = sourceNamesByFamily.get(familyId) ?? { scope, names: new Map<string, string>(), noteIds: [] };
    const sources = [note.title, ...Object.values(note.sections).map((section) => section.text)];
    for (const [slug, name] of sourceBackedNpcNames(sources)) {
      if (!bucket.names.has(slug)) bucket.names.set(slug, name);
    }
    bucket.noteIds.push(note.id);
    sourceNamesByFamily.set(familyId, bucket);
  }

  // Canonicalize each family's source names as a whole so the retained identity and memory
  // target do not depend on which note was visited first. Variants of one name (short form,
  // first name, full name) collapse to a single canonical source identity instead of each
  // forking its own local character and target.
  for (const familyId of [...sourceNamesByFamily.keys()].sort()) {
    const { scope, names, noteIds } = sourceNamesByFamily.get(familyId)!;
    for (const name of uniqueStrings([...names.values()])) {
      // A name already covered by a trusted roster, note, or earlier source identity must not
      // create a competing duplicate. Resolution canonicalizes it to that identity, or fails
      // closed with the competing records when more than one trusted identity matches.
      if (mutableHasRelatedIdentity(mutable, name, familyId)) continue;
      const subject = localCharacterSubjectForName(scope, name);
      if (!subject) continue;
      const key = subject.key;
      if (mutable.has(key)) continue;
      mutable.set(key, {
        subject,
        name,
        aliases: new Set(),
        canonicalSlug: normalizeSubjectName(name) || "subject",
        familyId,
        provenance: `source_note:${[...noteIds].sort()[0]}`,
        sourceScope: "local_source",
      });
    }
  }

  const localNameEntries = new Map<string, TrustedLtmSubjectCatalogEntry[]>();
  for (const entry of mutable.values()) {
    if (!entry.familyId) continue;
    const key = `${entry.familyId}\u0000${entry.canonicalSlug}`;
    const list = localNameEntries.get(key) ?? [];
    list.push({ ...entry, aliases: [...entry.aliases] });
    localNameEntries.set(key, list);
  }
  const ambiguousLocalEntries: Record<string, TrustedLtmSubjectCatalogEntry[]> = {};
  for (const [key, list] of localNameEntries.entries()) {
    if (list.length > 1) {
      ambiguousLocalEntries[key] = list;
    }
  }
  const entries = Array.from(mutable.values()).map((entry) => ({
    ...entry,
    aliases: uniqueStrings(Array.from(entry.aliases)).filter(
      (alias) => normalizeSubjectName(alias) !== normalizeSubjectName(entry.name),
    ),
  }));
  const refBackedIdentityTokens = new Set(entries.filter((entry) => entry.subject.ref).flatMap(entryIdentityTokens));
  const visibleEntries = entries
    .filter(
      (entry) =>
        !entry.familyId || (localNameEntries.get(`${entry.familyId}\u0000${entry.canonicalSlug}`)?.length ?? 0) === 1,
    )
    .filter((entry) => !isDominatedUnboundNpcEntry(entry, refBackedIdentityTokens))
    .sort((left, right) => left.subject.key.localeCompare(right.subject.key));
  const slugCounts = new Map<string, number>();
  for (const entry of visibleEntries) {
    if (isLocalCharacterSubject(entry.subject)) continue;
    slugCounts.set(entry.canonicalSlug, (slugCounts.get(entry.canonicalSlug) ?? 0) + 1);
  }
  for (const entry of visibleEntries) {
    if (isLocalCharacterSubject(entry.subject) || (slugCounts.get(entry.canonicalSlug) ?? 0) < 2) continue;
    const suffix = createHash("sha256").update(entry.subject.key).digest("hex").slice(0, 10);
    entry.canonicalSlug = `${entry.canonicalSlug.slice(0, 109).replace(/_+$/g, "")}_${suffix}`;
  }

  return {
    entries: visibleEntries,
    notes: notes.filter((note) => note.type === "character" || note.type === "relationship").sort(compareNoteAge),
    ambiguousLocalNames: [...localNameEntries.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([key]) => key)
      .sort(),
    ambiguousLocalEntries,
  };
}

export function trustedLtmSubjectPromptCatalog(catalog: TrustedLtmSubjectCatalog) {
  const index = buildCatalogIndex(catalog);
  // The model copies names only; subject keys stay server-side so a provider cannot choose a character by key.
  return index.entries.map((entry) => ({
    name: entry.name,
    aliases: entry.aliases.filter((alias) => {
      const match = matchDirect(index, normalizeSubjectName(alias));
      return match.status === "matched" && match.entries[0]?.subject.key === entry.subject.key;
    }),
  }));
}

export function analyzeTrustedLtmNoteSubjects(catalog: TrustedLtmSubjectCatalog): {
  matches: TrustedLtmNoteSubjectMatch[];
  unresolved: TrustedLtmNoteSubjectIssue[];
} {
  const index = buildCatalogIndex(catalog);
  const matches: TrustedLtmNoteSubjectMatch[] = [];
  const unresolved: TrustedLtmNoteSubjectIssue[] = [];

  for (const note of catalog.notes.filter((candidate) => candidate.status !== "archived")) {
    const expectedSubjects = note.type === "character" ? 1 : 2;
    if (note.subjects) {
      const entries = note.subjects.map(
        (subject) =>
          index.byKey.get(subject.key) ?? (subject.ref ? index.byRef.get(subjectRefKey(subject.ref)) : undefined),
      );
      if (
        note.subjects.length !== expectedSubjects ||
        new Set(note.subjects.map((subject) => subject.key)).size !== expectedSubjects ||
        entries.some((entry) => !entry)
      ) {
        unresolved.push({
          note,
          reason: "invalid_cardinality",
          basis: "bound_subjects",
          candidateSubjectKeys: note.subjects.map((subject) => subject.key),
          candidateSubjectPairs: [sortSubjects(note.subjects).map((subject) => subject.key)],
        });
        continue;
      }
      const resolvedEntries = entries as TrustedLtmSubjectCatalogEntry[];
      matches.push({
        note,
        subjects: sortSubjects(resolvedEntries.map((entry) => entry.subject)),
        entries: resolvedEntries,
        basis: "bound_subjects",
        exactFullName: isExactRepairIdentityNote(
          note,
          resolvedEntries,
          canonicalNoteIdForEntries(
            resolvedEntries,
            note.type === "character" ? "character_fact" : "relationship_state",
          ),
        ),
      });
      continue;
    }

    const result = legacyNoteMatch(note, index);
    const { attempts, matchedBySubjects } = result;

    if (matchedBySubjects.size === 1 && !legacyIdentifiersConflict(result)) {
      const match = [...matchedBySubjects.values()][0]!;
      const bucket = note.type === "character" ? "character_fact" : "relationship_state";
      matches.push({
        note,
        subjects: sortSubjects(match.entries.map((entry) => entry.subject)),
        entries: match.entries,
        basis: publicIdentityMatchBasis(match.basis),
        exactFullName: isExactRepairIdentityNote(note, match.entries, canonicalNoteIdForEntries(match.entries, bucket)),
      });
      continue;
    }

    const ambiguous = attempts.filter(
      (attempt): attempt is Extract<SubjectMatch, { status: "ambiguous" }> => attempt.status === "ambiguous",
    );
    const cardinality = attempts.filter(
      (attempt): attempt is Extract<SubjectMatch, { status: "cardinality" }> => attempt.status === "cardinality",
    );
    unresolved.push({
      note,
      reason:
        legacyIdentifiersConflict(result) || ambiguous.length > 0
          ? "ambiguous"
          : cardinality.length > 0
            ? "invalid_cardinality"
            : "untrusted",
      basis:
        legacyIdentifiersConflict(result) && matchedBySubjects.size > 0
          ? "conflicting_identifiers"
          : (ambiguous[0]?.basis ?? cardinality[0]?.basis ?? attempts[0]?.basis ?? "name"),
      candidateSubjectKeys: uniqueStrings([
        ...ambiguous.flatMap((attempt) => attempt.keys.flatMap((key) => key.split("\u0000"))),
        ...[...matchedBySubjects.values()].flatMap((attempt) => attempt.entries.map(subjectEntryKey)),
      ]),
      candidateSubjectPairs: uniqueSubjectPairs([
        ...ambiguous.flatMap((attempt) => attempt.keys.map((key) => key.split("\u0000"))),
        ...[...matchedBySubjects.values()].map((attempt) => attempt.entries.map(subjectEntryKey)),
      ]),
    });
  }

  return { matches, unresolved };
}

export function trustedLtmIdentityNotesForSource({
  sourceText,
  sourceTitle,
  catalog,
  mode,
}: {
  sourceText: string;
  sourceTitle?: string;
  catalog: TrustedLtmSubjectCatalog;
  mode?: LtmMode;
}) {
  const effectiveCatalog =
    mode && mode !== "roleplay"
      ? {
          ...catalog,
          entries: catalog.entries.filter((entry) => !isLocalCharacterSubject(entry.subject)),
          notes: catalog.notes.filter((note) => !note.subjects?.some(isLocalCharacterSubject)),
        }
      : catalog;
  if (effectiveCatalog.entries.length === 0 || effectiveCatalog.notes.length === 0) return [];
  const index = buildCatalogIndex(effectiveCatalog);
  const detected = new Set<string>();
  for (const value of [sourceText, sourceTitle ?? ""]) {
    for (const name of value.matchAll(SOURCE_BACKED_NPC_NAME_PATTERN)) {
      const match = matchLegacyCharacter(index, normalizeSubjectName(name[0]));
      if (match.status === "matched") for (const entry of match.entries) detected.add(entry.subject.key);
    }
  }
  if (detected.size === 0) return [];

  const analysis = analyzeTrustedLtmNoteSubjects(effectiveCatalog);
  const unresolvedKeys = new Set(
    analysis.unresolved.flatMap((issue) =>
      issue.candidateSubjectKeys.map((subjectKey) => `${issue.note.type}\0${subjectKey}`),
    ),
  );
  const selected = new Map<string, TrustedLtmNoteSubjectMatch[]>();
  for (const match of analysis.matches) {
    if (!match.subjects.every((subject) => detected.has(subject.key))) continue;
    const key = `${match.note.type}\0${match.subjects.map((subject) => subject.key).join("\0")}`;
    selected.set(key, [...(selected.get(key) ?? []), match]);
  }
  return [...selected.values()]
    .filter(
      (matches) =>
        matches.length === 1 &&
        !matches[0]!.subjects.some((subject) => unresolvedKeys.has(`${matches[0]!.note.type}\0${subject.key}`)),
    )
    .map((matches) => matches[0]!.note)
    .sort((left, right) => left.id.localeCompare(right.id));
}

type MutableCatalogIdentity = {
  name: string;
  aliases: Set<string>;
  familyId?: string;
  subject?: LtmSubject;
  sourceScope?: "direct" | "group" | "local_note" | "local_source";
};

function mutableHasRelatedIdentity(mutable: Map<string, MutableCatalogIdentity>, name: string, familyId: string) {
  const slug = normalizeSubjectName(name);
  if (!slug) return false;
  return [...mutable.values()].some((entry) => {
    if (entry.familyId && entry.familyId !== familyId) return false;
    if ([...entry.aliases].some((alias) => normalizeSubjectName(alias) === slug)) return true;
    if (normalizeSubjectName(entry.name) === slug) return true;
    // A short source form must not seed a local identity when a trusted character/persona
    // with a longer name covers it. Resolution then routes the name to review instead.
    if (
      entry.subject &&
      isTrustedCharacterOrPersonaSubject(entry.subject) &&
      partialNameTokensMatch(name, entry.name)
    ) {
      return true;
    }
    // A saved note of LTM's own character in this chat relates the same way extracted names do.
    // Other source names don't: every capitalized run is one ("When Preston Farraday").
    return Boolean(
      entry.sourceScope === "local_note" &&
      entry.familyId === familyId &&
      entry.subject &&
      isLocalCharacterSubject(entry.subject) &&
      nameTokensRelated(name, entry.name),
    );
  });
}

export function inferLegacyBindings(catalog: TrustedLtmSubjectCatalog, index: CatalogIndex) {
  const bindings = new Map<string, LtmSubject[]>();
  for (const note of catalog.notes) {
    if (note.subjects) continue;
    const result = legacyNoteMatch(note, index);
    const { matchedBySubjects } = result;
    if (matchedBySubjects.size !== 1 || legacyIdentifiersConflict(result)) continue;
    for (const match of matchedBySubjects.values()) {
      if (
        localCharacterScopeError(
          match.entries.map((entry) => entry.subject),
          note.destinationScope ?? note.scope,
        )
      )
        continue;
      bindings.set(note.id, sortSubjects(match.entries.map((entry) => entry.subject)));
      break;
    }
  }
  return bindings;
}

export function isExactIdentityNote(note: LtmNote, entries: TrustedLtmSubjectCatalogEntry[], canonicalId: string) {
  if (note.id === canonicalId) return true;
  if (entries.length !== 1 || !note.title) return false;
  return normalizeSubjectName(note.title) === normalizeSubjectName(entries[0]!.name);
}

function isExactRepairIdentityNote(note: LtmNote, entries: TrustedLtmSubjectCatalogEntry[], canonicalId: string) {
  if (note.type === "character") {
    return Boolean(
      entries.length === 1 && note.title && normalizeSubjectName(note.title) === normalizeSubjectName(entries[0]!.name),
    );
  }
  return note.id === canonicalId;
}

function subjectNameFromNote(note: LtmNote) {
  return note.title?.trim() || subjectSlugFromNote(note).replace(/_/g, " ");
}

function subjectSlugFromNote(note: LtmNote) {
  return stripNotePrefix(note.id) || "subject";
}

function readObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function readName(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 240) : "";
}

function extractAliases(record: Record<string, unknown>) {
  const extensions = readObject(record.extensions);
  return uniqueStrings([
    ...readStringArray(record.aliases),
    ...readStringArray(record.alias),
    ...readStringArray(record.nicknames),
    ...readStringArray(record.alternateNames),
    ...readStringArray(record.alternate_names),
    ...readStringArray(extensions.aliases),
    ...readStringArray(extensions.nicknames),
  ]);
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" ? value.split(/[,;\n]/g) : [];
}
