import { createHash } from "node:crypto";
import {
  getLtmScopeChatIds,
  getLtmScopeGroupIds,
  getLtmScopePersonaIds,
  isGlobalLtmScope,
  isLtmSourceLikeNote,
  matchesLtmScope,
  type LtmEvidenceUnit,
  type LtmExtractionDroppedCandidate,
  type LtmIdentityMatchBasis,
  type LtmMode,
  type LtmNote,
  type LtmScope,
  type LtmSubject,
  type LtmSubjectReference,
} from "../../../../shared/src/features/agents/long-term-memory/index.js";
import {
  isLocalCharacterSubject,
  localCharacterScopeError,
  localCharacterFamilyFromKey,
  localCharacterSubjectFromKey,
  localCharacterSubjectForName,
  ltmScopeFamilyId,
  normalizeLtmChatCharacterIds,
} from "./chat-scope.js";
import type { LtmExtractionDiagnostic } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { noteIdForEvidenceUnit } from "./evidence-unit-validation.js";
import { safeSnippet, uniqueStrings } from "./ltm-utils.js";
import { LongTermMemoryStorage } from "./storage.js";
import { getPackagePersistence, getPackageResources } from "./package-runtime.js";

type RosterSubjectInput = {
  kind: LtmSubjectReference["kind"];
  id: string;
  name: string;
  aliases?: string[];
  provenance?: string;
  sourceScope?: "direct" | "group";
};

export type TrustedLtmSubjectCatalogEntry = {
  subject: LtmSubject;
  name: string;
  aliases: string[];
  canonicalSlug: string;
  familyId?: string;
  provenance?: string;
  sourceScope?: "direct" | "group" | "local_note" | "local_source";
};

export type TrustedLtmSubjectCatalog = {
  entries: TrustedLtmSubjectCatalogEntry[];
  notes: LtmNote[];
  ambiguousLocalNames?: string[];
  ambiguousLocalEntries?: Record<string, TrustedLtmSubjectCatalogEntry[]>;
};

export function trustedLtmCharacterAliasIdentifiers(catalog: TrustedLtmSubjectCatalog) {
  return new Set(
    catalog.entries
      .filter((entry) => entry.subject.ref?.kind === "character")
      .flatMap((entry) => [entry.name, ...entry.aliases].map((alias) => normalizeSubjectIdentifier(alias, "")))
      .filter(Boolean),
  );
}

export type LtmSubjectIdentityResolution = {
  units: LtmEvidenceUnit[];
  existingNotes: LtmNote[];
  diagnostics: LtmExtractionDiagnostic[];
  droppedCandidates: LtmExtractionDroppedCandidate[];
  legacyBindings: Map<string, LtmSubject[]>;
};

export type LtmSubjectIdentityCandidate = Pick<
  LtmEvidenceUnit,
  "bucket" | "subjectId" | "sectionKey" | "subjectNames" | "subjectKeys"
>;

export type LtmSubjectIdentityContext = {
  identityKeyForUnit(unit: LtmSubjectIdentityCandidate): string;
  resolve(input: {
    units: LtmEvidenceUnit[];
    existingNotes: LtmNote[];
    enforceTrustedSubjects?: boolean;
  }): LtmSubjectIdentityResolution;
};

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
};

export type CompetingSubjectRecord = {
  key: string;
  name: string;
  canonicalSlug: string;
  provenance?: string;
  sourceScope?: string;
  collisionKind?: "duplicate_local" | "group_catalog" | "alias_collision" | "mixed";
};

type CatalogIndex = {
  entries: TrustedLtmSubjectCatalogEntry[];
  byKey: Map<string, TrustedLtmSubjectCatalogEntry>;
  byRef: Map<string, TrustedLtmSubjectCatalogEntry>;
  exact: Map<string, TrustedLtmSubjectCatalogEntry[]>;
  aliases: Map<string, TrustedLtmSubjectCatalogEntry[]>;
  tokens: string[];
  ambiguousLocalNames: ReadonlySet<string>;
  ambiguousLocalEntries: Map<string, TrustedLtmSubjectCatalogEntry[]>;
};

type BatchSubjectNameResolution = {
  matches: Map<string, SubjectMatch>;
  provisionalKeys: Set<string>;
};

const SOURCE_BACKED_NPC_NAME_PATTERN = /\b[\p{Lu}][\p{L}\p{N}'-]*(?:\s+[\p{Lu}][\p{L}\p{N}'-]*){0,3}\b/gu;
const SOURCE_BACKED_PROPER_NAME_PATTERN = /^[\p{Lu}][\p{L}\p{N}'-]*(?:\s+[\p{Lu}][\p{L}\p{N}'-]*){0,3}$/u;
const SOURCE_BACKED_NAME_BOUNDARY_PATTERN = /[\p{L}\p{N}'-]/u;
const GENERIC_ROLE_SUFFIXES = ["arian", "eer", "ician", "ist", "keeper", "ologist", "ographer"];
const GENERIC_ROLE_QUALIFIERS = new Set([
  "a",
  "an",
  "assistant",
  "bass",
  "chief",
  "city",
  "court",
  "deputy",
  "head",
  "junior",
  "lead",
  "local",
  "master",
  "medical",
  "military",
  "night",
  "palace",
  "rhythm",
  "royal",
  "school",
  "senior",
  "session",
  "temple",
  "the",
  "town",
  "unknown",
  "unnamed",
  "village",
]);
const GENERIC_SUBJECT_NAMES = new Set([
  "accountant",
  "administrator",
  "adviser",
  "advisor",
  "agent",
  "actor",
  "ai",
  "ally",
  "alchemist",
  "ambassador",
  "apprentice",
  "archer",
  "architect",
  "archivist",
  "artist",
  "assistant",
  "author",
  "baker",
  "bandmate",
  "barber",
  "bard",
  "bartender",
  "blacksmith",
  "boy",
  "bot",
  "boss",
  "brewer",
  "butcher",
  "captain",
  "caretaker",
  "carpenter",
  "cartographer",
  "cashier",
  "character",
  "classmate",
  "chef",
  "chief",
  "clerk",
  "coach",
  "companion",
  "commander",
  "constable",
  "consultant",
  "courier",
  "customer",
  "dancer",
  "dentist",
  "developer",
  "detective",
  "diplomat",
  "director",
  "doctor",
  "driver",
  "drummer",
  "editor",
  "employee",
  "enemy",
  "engineer",
  "farmer",
  "fisherman",
  "friend",
  "girl",
  "game_master",
  "gamer",
  "guard",
  "guitarist",
  "guide",
  "gm",
  "he",
  "host",
  "human",
  "hunter",
  "journalist",
  "judge",
  "innkeeper",
  "king",
  "knight",
  "lady",
  "leader",
  "librarian",
  "lawyer",
  "lord",
  "man",
  "manager",
  "mage",
  "magician",
  "mayor",
  "mechanic",
  "merchant",
  "member",
  "miner",
  "minister",
  "monk",
  "musician",
  "narrator",
  "npc",
  "nurse",
  "officer",
  "owner",
  "oracle",
  "passenger",
  "patron",
  "persona",
  "person",
  "pilot",
  "pianist",
  "player",
  "partner",
  "priest",
  "prince",
  "princess",
  "professor",
  "programmer",
  "protagonist",
  "queen",
  "ranger",
  "receptionist",
  "reporter",
  "researcher",
  "scientist",
  "scout",
  "secretary",
  "sheriff",
  "she",
  "shopkeeper",
  "singer",
  "soldier",
  "someone",
  "speaker",
  "smith",
  "stranger",
  "student",
  "surgeon",
  "system",
  "teacher",
  "technician",
  "therapist",
  "they",
  "unknown",
  "unnamed",
  "user",
  "vendor",
  "veterinarian",
  "villain",
  "violinist",
  "waiter",
  "waitress",
  "warrior",
  "wizard",
  "worker",
  "woman",
]);

type SubjectMatch =
  | { status: "matched"; entries: TrustedLtmSubjectCatalogEntry[]; basis: string }
  | {
      status: "ambiguous";
      keys: string[];
      basis: string;
      competingRecords?: CompetingSubjectRecord[];
      collisionSource?: "duplicate_local" | "group_catalog" | "alias_collision" | "mixed";
    }
  | { status: "cardinality"; count: number; basis: string }
  | { status: "untrusted"; basis: string };

function diagnoseCollision(
  entries: TrustedLtmSubjectCatalogEntry[],
  basis?: string,
): {
  collisionSource: "duplicate_local" | "group_catalog" | "alias_collision" | "mixed";
  competingRecords: CompetingSubjectRecord[];
} {
  const hasGroup = entries.some((e) => e.sourceScope === "group");
  const allLocal = entries.every((e) => e.sourceScope === "local_note" || e.sourceScope === "local_source");
  const collisionSource = hasGroup
    ? "group_catalog"
    : basis === "alias"
      ? "alias_collision"
      : allLocal
        ? "duplicate_local"
        : entries.some((e) => e.sourceScope === "direct")
          ? "duplicate_local"
          : "mixed";

  const competingRecords: CompetingSubjectRecord[] = entries.slice(0, 10).map((entry) => ({
    key: entry.subject.key,
    name: entry.name,
    canonicalSlug: entry.canonicalSlug,
    provenance: entry.provenance ?? entry.subject.key,
    sourceScope: entry.sourceScope,
    collisionKind:
      entry.sourceScope === "group" ? "group_catalog" : basis === "alias" ? "alias_collision" : "duplicate_local",
  }));

  return { collisionSource, competingRecords };
}

type ResolvedUnit = {
  unit: LtmEvidenceUnit;
  originalNoteId: string;
  targetNoteId: string;
  candidateIndex: number;
};

type PreparedLtmSubjectIdentityContext = {
  catalog: TrustedLtmSubjectCatalog;
  index: CatalogIndex;
  legacyBindings: Map<string, LtmSubject[]>;
  batchNames: BatchSubjectNameResolution;
  establishedKeysBySubject: Map<string, string[]>;
  sourceBackedNpcSourceText?: string;
  sourceBackedNpcSourceTitle?: string;
  scope?: LtmScope;
  mode?: LtmMode;
};

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

  return buildTrustedLtmSubjectCatalog({
    roster,
    notes,
    localSourceNotes: notes.filter((note) => isLtmSourceLikeNote(note)),
  });
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
    const aliases = new Set(expandedAliases(item.name, item.aliases ?? []));
    mutable.set(key, {
      subject: { key, ref },
      name: item.name,
      aliases,
      canonicalSlug: normalizeSubjectIdentifier(item.name, "subject"),
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
        aliases: new Set(expandedAliases(name, [])),
        canonicalSlug: normalizeSubjectIdentifier(name, subjectSlugFromNote(note)),
        ...(localCharacterFamilyFromKey(normalizedSubject.key)
          ? { familyId: localCharacterFamilyFromKey(normalizedSubject.key)! }
          : {}),
        provenance: `note:${note.id}`,
        sourceScope: "local_note",
      });
    }
  }

  for (const note of localSourceNotes.filter(
    (candidate) => candidate.status !== "archived" && candidate.modes.includes("roleplay"),
  )) {
    const familyId = ltmScopeFamilyId(note.destinationScope ?? note.scope);
    if (!familyId) continue;
    const sources = [note.title, ...Object.values(note.sections).map((section) => section.text)];
    for (const name of sourceBackedNpcNames(sources).values()) {
      const subject = localCharacterSubjectForName(note.destinationScope ?? note.scope, name);
      if (!subject) continue;
      const key = subject.key;
      if (mutable.has(key)) continue;
      mutable.set(key, {
        subject,
        name,
        aliases: new Set(expandedAliases(name, [])),
        canonicalSlug: normalizeSubjectIdentifier(name, "subject"),
        familyId,
        provenance: `source_note:${note.id}`,
        sourceScope: "local_source",
      });
    }
  }

  const localNameEntries = new Map<string, TrustedLtmSubjectCatalogEntry[]>();
  for (const entry of mutable.values()) {
    if (!entry.familyId) continue;
    const key = `${entry.familyId}\u0000${entry.canonicalSlug}`;
    const list = localNameEntries.get(key) ?? [];
    list.push(entry as TrustedLtmSubjectCatalogEntry);
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
      (alias) => normalizeSubjectIdentifier(alias, "") !== normalizeSubjectIdentifier(entry.name, ""),
    ),
  }));
  const refBackedIdentityTokens = new Set(entries.filter((entry) => entry.subject.ref).flatMap(entryIdentityTokens));

  return {
    entries: entries
      .filter(
        (entry) =>
          !entry.familyId || (localNameEntries.get(`${entry.familyId}\u0000${entry.canonicalSlug}`)?.length ?? 0) === 1,
      )
      .filter((entry) => !isDominatedUnboundNpcEntry(entry, refBackedIdentityTokens))
      .sort((left, right) => left.subject.key.localeCompare(right.subject.key)),
    notes: notes.filter((note) => note.type === "character" || note.type === "relationship").sort(compareNoteAge),
    ambiguousLocalNames: [...localNameEntries.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([key]) => key)
      .sort(),
    ambiguousLocalEntries,
  };
}

export function filterDominatedLtmSubjectNotesForPrompt(notes: LtmNote[], catalog: TrustedLtmSubjectCatalog) {
  const visibleSubjectKeys = new Set(catalog.entries.map((entry) => entry.subject.key));
  const suppressedSubjectKeys = new Set(
    catalog.notes.flatMap((note) =>
      (note.subjects ?? []).flatMap((subject) =>
        !subject.ref && isLocalCharacterSubject(subject) && !visibleSubjectKeys.has(subject.key) ? [subject.key] : [],
      ),
    ),
  );
  if (suppressedSubjectKeys.size === 0) return notes;
  return notes.filter((note) => {
    if (note.type !== "character" && note.type !== "relationship") return true;
    return !(note.subjects ?? []).some((subject) => suppressedSubjectKeys.has(subject.key));
  });
}

export function trustedLtmSubjectPromptCatalog(catalog: TrustedLtmSubjectCatalog) {
  const index = buildCatalogIndex(catalog);
  return index.entries.map((entry) => ({
    key: entry.subject.key,
    name: entry.name,
    aliases: entry.aliases.filter((alias) => {
      const match = matchDirect(index, normalizeSubjectIdentifier(alias, ""));
      return match.status === "matched" && match.entries[0]?.subject.key === entry.subject.key;
    }),
    ...(entry.subject.ref ? { ref: entry.subject.ref } : {}),
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

    const identifiers = uniqueStrings([
      note.title ? normalizeSubjectIdentifier(note.title, "") : "",
      stripNotePrefix(note.id),
    ]);
    const attempts = identifiers.map((identifier) =>
      note.type === "character" ? matchLegacyCharacter(index, identifier) : matchRelationship(index, identifier),
    );
    const matchedBySubjects = new Map<string, Extract<SubjectMatch, { status: "matched" }>>();
    for (const attempt of attempts) {
      if (attempt.status !== "matched") continue;
      const identityKey = attempt.entries.map(subjectEntryKey).sort().join("\u0000");
      const current = matchedBySubjects.get(identityKey);
      if (!current || identityBasisPriority(attempt.basis) < identityBasisPriority(current.basis)) {
        matchedBySubjects.set(identityKey, attempt);
      }
    }

    if (matchedBySubjects.size === 1) {
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
        matchedBySubjects.size > 1 || ambiguous.length > 0
          ? "ambiguous"
          : cardinality.length > 0
            ? "invalid_cardinality"
            : "untrusted",
      basis:
        matchedBySubjects.size > 1
          ? "conflicting_identifiers"
          : (ambiguous[0]?.basis ?? cardinality[0]?.basis ?? attempts[0]?.basis ?? "name"),
      candidateSubjectKeys: uniqueStrings([
        ...ambiguous.flatMap((attempt) => attempt.keys.flatMap((key) => key.split("\u0000"))),
        ...[...matchedBySubjects.values()].flatMap((attempt) => attempt.entries.map(subjectEntryKey)),
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
      const match = matchLegacyCharacter(index, normalizeSubjectIdentifier(name[0], ""));
      if (match.status === "matched") for (const entry of match.entries) detected.add(entry.subject.key);
    }
  }
  if (detected.size === 0) return [];

  const selected = new Map<string, TrustedLtmNoteSubjectMatch>();
  for (const match of analyzeTrustedLtmNoteSubjects(effectiveCatalog).matches) {
    if (!match.subjects.every((subject) => detected.has(subject.key))) continue;
    const key = `${match.note.type}\0${match.subjects.map((subject) => subject.key).join("\0")}`;
    const current = selected.get(key);
    if (!current || compareTrustedIdentityNotes(match, current) < 0) selected.set(key, match);
  }
  return [...selected.values()].map((match) => match.note).sort((left, right) => left.id.localeCompare(right.id));
}

export function prepareLtmSubjectIdentityContext({
  units,
  catalog,
  scope,
  mode,
  sourceBackedNpcSourceText,
  sourceBackedNpcSourceTitle,
}: {
  units: LtmEvidenceUnit[];
  catalog: TrustedLtmSubjectCatalog;
  scope?: LtmScope;
  mode?: LtmMode;
  sourceBackedNpcSourceText?: string;
  sourceBackedNpcSourceTitle?: string;
}): LtmSubjectIdentityContext {
  const familyId = (mode === undefined || mode === "roleplay") && scope ? ltmScopeFamilyId(scope) : null;
  const effectiveCatalog: TrustedLtmSubjectCatalog = {
    ...catalog,
    entries: catalog.entries.filter((entry) => {
      if (mode && mode !== "roleplay" && isLocalCharacterSubject(entry.subject)) return false;
      if (familyId && entry.familyId && entry.familyId !== familyId) return false;
      if (familyId && isLocalCharacterSubject(entry.subject)) {
        const subjectFamily =
          localCharacterFamilyFromKey(entry.subject.key) ??
          (entry.subject.ref?.kind === "local_character"
            ? localCharacterFamilyFromKey(`local_character:${entry.subject.ref.id}`)
            : null);
        if (subjectFamily !== familyId) return false;
      }
      return true;
    }),
    notes: catalog.notes.filter((note) => {
      if (mode && mode !== "roleplay" && note.subjects?.some(isLocalCharacterSubject)) return false;
      if (familyId) {
        const noteFamily = ltmScopeFamilyId(note.destinationScope ?? note.scope);
        if (noteFamily && noteFamily !== familyId) return false;
        if (
          note.subjects?.some((subject) => {
            if (!isLocalCharacterSubject(subject)) return false;
            const subjectFamily =
              localCharacterFamilyFromKey(subject.key) ??
              (subject.ref?.kind === "local_character"
                ? localCharacterFamilyFromKey(`local_character:${subject.ref.id}`)
                : null);
            return subjectFamily !== familyId;
          })
        )
          return false;
      }
      return true;
    }),
    ambiguousLocalNames: catalog.ambiguousLocalNames
      ? catalog.ambiguousLocalNames.filter((name) => !familyId || name.startsWith(`${familyId}\u0000`))
      : [],
    ambiguousLocalEntries: Object.fromEntries(
      Object.entries(catalog.ambiguousLocalEntries ?? {}).filter(
        ([key]) => !familyId || key.startsWith(`${familyId}\u0000`),
      ),
    ),
  };
  const index = buildCatalogIndex(effectiveCatalog);
  const legacyBindings = inferLegacyBindings(effectiveCatalog, index);
  const batchNames = preResolveBatchSubjectNames({
    units,
    index,
    scope,
    mode,
    sourceText: sourceBackedNpcSourceText,
    sourceTitle: sourceBackedNpcSourceTitle,
  });

  const establishedKeysBySubject = new Map<string, string[]>();
  const contestedSubjectKeys = new Set<string>();
  for (const unit of units) {
    if (unit.subjectKeys?.length) {
      const key = `${unit.bucket}\u0000${stripNotePrefix(normalizeSubjectIdentifier(unit.subjectId, ""))}`;
      const current = establishedKeysBySubject.get(key);
      if (current === undefined) {
        establishedKeysBySubject.set(key, [...unit.subjectKeys]);
      } else {
        const sortedCurrent = [...current].sort();
        const sortedIncoming = [...unit.subjectKeys].sort();
        if (sortedCurrent.length !== sortedIncoming.length || sortedCurrent.some((k, i) => k !== sortedIncoming[i])) {
          contestedSubjectKeys.add(key);
        }
      }
    }
  }
  for (const contested of contestedSubjectKeys) {
    establishedKeysBySubject.delete(contested);
  }

  const context: PreparedLtmSubjectIdentityContext = {
    catalog: effectiveCatalog,
    index,
    legacyBindings,
    batchNames,
    establishedKeysBySubject,
    sourceBackedNpcSourceText,
    sourceBackedNpcSourceTitle,
    scope,
    mode,
  };
  return {
    identityKeyForUnit(unit) {
      const hasSubjectNames = unit.subjectNames !== undefined && unit.subjectNames.length > 0;
      const established =
        unit.subjectKeys === undefined && !hasSubjectNames
          ? establishedKeysBySubject.get(
              `${unit.bucket}\u0000${stripNotePrefix(normalizeSubjectIdentifier(unit.subjectId, ""))}`,
            )
          : undefined;
      const effectiveUnit = established ? { ...unit, subjectKeys: established } : unit;
      const match =
        hasSubjectNames && !effectiveUnit.subjectKeys?.length
          ? resolveNamedUnitSubjects(unit, batchNames, index, context)
          : resolveUnitSubjects(effectiveUnit, index);
      if (match.status !== "matched") {
        // Mirror the resolution path so this pre-resolution key predicts the same target
        // for keyless source-backed units instead of deriving a short-form identity.
        if (match.status === "untrusted" && !hasSubjectNames) {
          const sourceBackedNpc = sourceBackedNpcSubject(
            effectiveUnit,
            index,
            scope,
            mode,
            sourceBackedNpcSourceText,
            sourceBackedNpcSourceTitle,
          );
          if (sourceBackedNpc?.entry) {
            return (
              chooseIdentityTarget(
                effectiveCatalog.notes,
                legacyBindings,
                [sourceBackedNpc.entry],
                effectiveUnit.bucket,
              )?.id ?? canonicalNoteIdForEntries([sourceBackedNpc.entry], effectiveUnit.bucket)
            );
          }
        }
        return noteIdForEvidenceUnit(effectiveUnit);
      }
      const entries = sortSubjectEntries(match.entries);
      return (
        chooseIdentityTarget(effectiveCatalog.notes, legacyBindings, entries, effectiveUnit.bucket)?.id ??
        canonicalNoteIdForEntries(entries, effectiveUnit.bucket)
      );
    },
    resolve({ units: nextUnits, existingNotes, enforceTrustedSubjects = true }) {
      return resolveLtmSubjectIdentitiesWithContext({
        units: nextUnits,
        existingNotes,
        enforceTrustedSubjects,
        context,
      });
    },
  };
}

export function resolveLtmSubjectIdentities({
  units,
  catalog,
  existingNotes,
  scope,
  mode,
  enforceTrustedSubjects = true,
  sourceBackedNpcSourceText,
  sourceBackedNpcSourceTitle,
}: {
  units: LtmEvidenceUnit[];
  catalog: TrustedLtmSubjectCatalog;
  existingNotes: LtmNote[];
  scope?: LtmScope;
  mode?: LtmMode;
  enforceTrustedSubjects?: boolean;
  sourceBackedNpcSourceText?: string;
  sourceBackedNpcSourceTitle?: string;
}): LtmSubjectIdentityResolution {
  return prepareLtmSubjectIdentityContext({
    units,
    catalog,
    scope,
    mode,
    sourceBackedNpcSourceText,
    sourceBackedNpcSourceTitle,
  }).resolve({ units, existingNotes, enforceTrustedSubjects });
}

function resolveLtmSubjectIdentitiesWithContext({
  units,
  existingNotes,
  enforceTrustedSubjects,
  context,
}: {
  units: LtmEvidenceUnit[];
  existingNotes: LtmNote[];
  enforceTrustedSubjects: boolean;
  context: PreparedLtmSubjectIdentityContext;
}): LtmSubjectIdentityResolution {
  const {
    catalog,
    index,
    legacyBindings,
    batchNames,
    establishedKeysBySubject,
    sourceBackedNpcSourceText,
    sourceBackedNpcSourceTitle,
    scope,
    mode,
  } = context;
  const diagnostics: LtmExtractionDiagnostic[] = [];
  const droppedCandidates: LtmExtractionDroppedCandidate[] = [];
  const resolved: ResolvedUnit[] = [];
  const targetNotes = new Map(existingNotes.map((note) => [note.id, note]));

  for (const [candidateIndex, unit] of units.entries()) {
    if (unit.bucket !== "character_fact" && unit.bucket !== "relationship_state") {
      const nextUnit = withoutSubjectIdentity(unit);
      resolved.push({
        unit: nextUnit,
        originalNoteId: noteIdForEvidenceUnit(nextUnit),
        targetNoteId: noteIdForEvidenceUnit(nextUnit),
        candidateIndex,
      });
      continue;
    }

    const hasSubjectNames = unit.subjectNames !== undefined && unit.subjectNames.length > 0;
    // Keyless, nameless backfill units adopt the trusted keys another unit in this
    // batch already established for the same bucket + subjectId. Units with explicit
    // names or explicit keys (even invalid ones) still resolve or fail on their own.
    const established =
      unit.subjectKeys === undefined && !hasSubjectNames
        ? establishedKeysBySubject.get(
            `${unit.bucket}\u0000${stripNotePrefix(normalizeSubjectIdentifier(unit.subjectId, ""))}`,
          )
        : undefined;
    const effectiveUnit = established ? { ...unit, subjectKeys: established } : unit;
    const match =
      hasSubjectNames && !effectiveUnit.subjectKeys?.length
        ? resolveNamedUnitSubjects(unit, batchNames, index, context)
        : resolveUnitSubjects(effectiveUnit, index);
    if (match.status !== "matched") {
      const sourceBackedNpc = hasSubjectNames
        ? null
        : sourceBackedNpcSubject(
            effectiveUnit,
            index,
            scope,
            mode,
            sourceBackedNpcSourceText,
            sourceBackedNpcSourceTitle,
          );
      if (sourceBackedNpc?.ambiguous) {
        const rejection = subjectRejection(effectiveUnit, sourceBackedNpc.ambiguous, candidateIndex);
        diagnostics.push(rejection.diagnostic);
        droppedCandidates.push(rejection.dropped);
        continue;
      }
      if (sourceBackedNpc?.entry && match.status === "untrusted") {
        addCatalogEntry(index, sourceBackedNpc.entry);
        const subjects = [sourceBackedNpc.entry.subject];
        // Reuse an existing trusted/legacy note target for this identity, exactly like the
        // matched path below, so a keyless source-backed unit cannot fork a parallel note.
        const target = chooseIdentityTarget(
          catalog.notes,
          legacyBindings,
          [sourceBackedNpc.entry],
          effectiveUnit.bucket,
        );
        const canonicalNoteId = target?.id ?? canonicalNoteIdForEntries([sourceBackedNpc.entry], effectiveUnit.bucket);
        if (target) targetNotes.set(target.id, target);
        const originalNoteId = noteIdForEvidenceUnit(effectiveUnit);
        const nextUnit: LtmEvidenceUnit = {
          ...effectiveUnit,
          subjectId: subjectIdForTarget(canonicalNoteId, effectiveUnit.bucket),
          subjectNames: [sourceBackedNpc.entry.name],
          subjectKeys: subjects.map((subject) => subject.key),
          subjects,
        };
        resolved.push({ unit: nextUnit, originalNoteId, targetNoteId: canonicalNoteId, candidateIndex });
        diagnostics.push({
          severity: "warning",
          code: "source_backed_npc_identity",
          candidateIndex,
          mutationId: effectiveUnit.id,
          noteId: canonicalNoteId,
          message: `Accepted ${sourceBackedNpc.entry.name} as a scoped local character from the source.`,
          details: {
            subjectNames: nextUnit.subjectNames,
            subjectKeys: nextUnit.subjectKeys,
            matchBasis: "source_backed_npc",
          },
        });
        continue;
      }
      if (!enforceTrustedSubjects && !hasSubjectNames && !effectiveUnit.subjectKeys?.length) {
        const fallbackSubjects = fallbackSubjectsForUnit(effectiveUnit);
        const targetNoteId = noteIdForEvidenceUnit(effectiveUnit);
        resolved.push({
          unit: {
            ...effectiveUnit,
            subjectKeys: fallbackSubjects.map((subject) => subject.key),
            subjects: fallbackSubjects,
          },
          originalNoteId: targetNoteId,
          targetNoteId,
          candidateIndex,
        });
        continue;
      }
      const rejection = subjectRejection(effectiveUnit, match, candidateIndex);
      diagnostics.push(rejection.diagnostic);
      droppedCandidates.push(rejection.dropped);
      continue;
    }

    const entries = sortSubjectEntries(match.entries);
    const subjects = entries.map((entry) => entry.subject);
    const subjectNames = entries.map((entry) => entry.name);
    const subjectKeys = subjects.map((subject) => subject.key);
    const target = chooseIdentityTarget(catalog.notes, legacyBindings, entries, effectiveUnit.bucket);
    const canonicalNoteId = target?.id ?? canonicalNoteIdForEntries(entries, effectiveUnit.bucket);
    if (target) targetNotes.set(target.id, target);
    const originalNoteId = noteIdForEvidenceUnit(effectiveUnit);
    const subjectId = subjectIdForTarget(canonicalNoteId, effectiveUnit.bucket);
    const nextUnit: LtmEvidenceUnit = {
      ...effectiveUnit,
      subjectId,
      subjectNames,
      subjectKeys,
      subjects,
    };
    resolved.push({ unit: nextUnit, originalNoteId, targetNoteId: canonicalNoteId, candidateIndex });

    if (entries.some((entry) => batchNames.provisionalKeys.has(entry.subject.key))) {
      diagnostics.push({
        severity: "warning",
        code: "source_backed_npc_identity",
        candidateIndex,
        mutationId: unit.id,
        noteId: canonicalNoteId,
        message: `Accepted ${subjectNames.join(" and ")} as scoped local characters from the source.`,
        details: { subjectNames, subjectKeys, matchBasis: match.basis },
      });
    }

    if (originalNoteId !== canonicalNoteId || match.basis !== "trusted_key") {
      diagnostics.push({
        severity: "warning",
        code: "subject_identity_normalized",
        candidateIndex,
        mutationId: unit.id,
        noteId: canonicalNoteId,
        message: `Resolved ${originalNoteId} to canonical subject target ${canonicalNoteId}.`,
        details: {
          originalNoteId,
          targetNoteId: canonicalNoteId,
          subjectNames,
          subjectKeys,
          matchBasis: match.basis,
        },
      });
    }
  }

  const remapTargets = new Map<string, Set<string>>();
  for (const item of resolved) {
    const targets = remapTargets.get(item.originalNoteId) ?? new Set<string>();
    targets.add(item.targetNoteId);
    remapTargets.set(item.originalNoteId, targets);
  }
  const normalizedUnits = resolved.map((item) => ({
    ...item.unit,
    links: item.unit.links.map((link) => {
      const candidates = remapTargets.get(link.target);
      if (candidates?.size === 1) return { ...link, target: [...candidates][0]! };
      const target = resolveIdentityLinkTarget(link.target, link.relation, index, catalog, legacyBindings);
      if (target?.note) targetNotes.set(target.note.id, target.note);
      if (target) return { ...link, target: target.noteId };
      if (candidates && candidates.size > 1) {
        const candidateTargetNoteIds = [...candidates].sort();
        diagnostics.push({
          severity: "warning",
          code: "ambiguous_subject_link_target",
          candidateIndex: item.candidateIndex,
          mutationId: item.unit.id,
          noteId: noteIdForEvidenceUnit(item.unit),
          message: `Link target '${link.target}' resolves to multiple canonical subject notes and was not remapped.`,
          details: {
            linkTarget: link.target,
            linkRelation: link.relation,
            candidateTargetNoteIds,
          },
        });
      }
      return link;
    }),
  }));

  return {
    units: normalizedUnits,
    existingNotes: Array.from(targetNotes.values()).sort((left, right) => left.id.localeCompare(right.id)),
    diagnostics,
    droppedCandidates,
    legacyBindings,
  };
}

function preResolveBatchSubjectNames({
  units,
  index,
  scope,
  mode,
  sourceText,
  sourceTitle,
}: {
  units: LtmEvidenceUnit[];
  index: CatalogIndex;
  scope?: LtmScope;
  mode?: LtmMode;
  sourceText?: string;
  sourceTitle?: string;
}): BatchSubjectNameResolution {
  const matches = new Map<string, SubjectMatch>();
  const provisionalKeys = new Set<string>();
  const names = uniqueStrings(
    units.flatMap((unit) => {
      if (unit.bucket !== "character_fact" && unit.bucket !== "relationship_state") return [];
      const expected = unit.bucket === "character_fact" ? 1 : 2;
      return unit.subjectNames?.length === expected ? unit.subjectNames : [];
    }),
  );
  const admissibleUnknownNames: string[] = [];
  const sourceVisibleNames: string[] = [];
  const familyId = (mode === undefined || mode === "roleplay") && scope ? ltmScopeFamilyId(scope) : null;

  for (const name of names) {
    const normalizedName = normalizeSubjectIdentifier(name, "");
    if (familyId && index.ambiguousLocalNames.has(`${familyId}\u0000${normalizedName}`)) {
      matches.set(name, localAmbiguousMatch(index, familyId, normalizedName));
      continue;
    }
    const direct = matchDirect(index, normalizedName);
    const sourceVisible = isSourceBackedProperName(name, [sourceText, sourceTitle]);
    if (sourceVisible) sourceVisibleNames.push(name);
    if (direct.status !== "untrusted") {
      matches.set(name, direct);
      continue;
    }
    if (!sourceVisible) {
      matches.set(name, { status: "untrusted", basis: "source_visible_name" });
      continue;
    }
    admissibleUnknownNames.push(name);
  }

  const longerNames = new Map<string, string[]>();
  for (const name of admissibleUnknownNames) {
    longerNames.set(
      name,
      admissibleUnknownNames.filter((candidate) => isLongerVersionOfName(name, candidate)),
    );
  }

  // Names related to a trusted catalog entry must canonicalize to that entry
  // instead of forking a provisional local-character identity from the surface
  // form. Ambiguous relations fail closed with the competing identities.
  const trustedRelationMatches = new Map<string, SubjectMatch>();
  for (const name of admissibleUnknownNames) {
    const relation = matchTrustedNameRelation(index, name, familyId);
    if (!relation) continue;
    matches.set(name, relation);
    trustedRelationMatches.set(name, relation);
  }

  const canonicalNames = uniqueStrings(
    admissibleUnknownNames.filter(
      (name) => !trustedRelationMatches.has(name) && (longerNames.get(name)?.length ?? 0) === 0,
    ),
  ).sort((left, right) => nameTokenCount(right) - nameTokenCount(left) || left.localeCompare(right));
  const canonicalNamesBySlug = new Map<string, string[]>();
  for (const name of canonicalNames) {
    const slug = normalizeSubjectIdentifier(name, "");
    if (!slug) continue;
    const current = canonicalNamesBySlug.get(slug) ?? [];
    current.push(name);
    canonicalNamesBySlug.set(slug, current);
  }

  for (const [slug, candidates] of canonicalNamesBySlug) {
    if (new Set(candidates).size !== 1) continue;
    const name = candidates[0]!;
    const subject =
      (mode === undefined || mode === "roleplay") && scope ? localCharacterSubjectForName(scope, name) : null;
    if (!subject) continue;
    const key = subject.key;
    const existing = index.byKey.get(key);
    if (existing) continue;
    const entry: TrustedLtmSubjectCatalogEntry = {
      subject,
      name,
      aliases: expandedAliases(name, []).filter((alias) => normalizeSubjectIdentifier(alias, "") !== slug),
      canonicalSlug: slug,
      ...(ltmScopeFamilyId(scope) ? { familyId: ltmScopeFamilyId(scope)! } : {}),
    };
    addCatalogEntry(index, entry);
    provisionalKeys.add(key);
  }

  for (const name of admissibleUnknownNames) {
    if (trustedRelationMatches.has(name)) continue;
    const longer = longerNames.get(name) ?? [];
    if (longer.length > 1) {
      matches.set(name, {
        status: "ambiguous",
        keys: uniqueStrings(
          longer.flatMap((candidate) => {
            const subject =
              (mode === undefined || mode === "roleplay") && scope
                ? localCharacterSubjectForName(scope, candidate)
                : null;
            return subject ? [subject.key] : [];
          }),
        ),
        basis: "batch_name_alias",
      });
      continue;
    }
    const direct = matchDirect(index, normalizeSubjectIdentifier(name, ""));
    matches.set(
      name,
      direct.status === "matched" && longer.length === 1 ? { ...direct, basis: "batch_name_alias" } : direct,
    );
  }

  for (const name of sourceVisibleNames) {
    const current = matches.get(name);
    if (
      current?.status !== "matched" ||
      current.entries.some(
        (entry) => !provisionalKeys.has(entry.subject.key) || !isLocalCharacterSubject(entry.subject),
      )
    ) {
      continue;
    }
    const longer = sourceVisibleNames.filter((candidate) => isLongerVersionOfName(name, candidate));
    if (longer.length > 1) {
      matches.set(name, {
        status: "ambiguous",
        keys: uniqueStrings(
          longer.flatMap((candidate) => {
            const subject =
              (mode === undefined || mode === "roleplay") && scope
                ? localCharacterSubjectForName(scope, candidate)
                : null;
            return subject ? [subject.key] : [];
          }),
        ),
        basis: "batch_name_alias",
      });
      continue;
    }
    if (longer.length !== 1) continue;
    const longerMatch = matches.get(longer[0]!) ?? matchDirect(index, normalizeSubjectIdentifier(longer[0], ""));
    if (longerMatch.status === "matched") {
      matches.set(name, { ...longerMatch, basis: "batch_name_alias" });
    } else if (longerMatch.status === "ambiguous") {
      matches.set(name, longerMatch);
    }
  }

  return { matches, provisionalKeys };
}

function resolveAndCacheSubjectName(
  batch: BatchSubjectNameResolution,
  index?: CatalogIndex,
  context?: Pick<
    PreparedLtmSubjectIdentityContext,
    "scope" | "mode" | "sourceBackedNpcSourceText" | "sourceBackedNpcSourceTitle"
  >,
  name?: string,
): SubjectMatch {
  if (!name || !index) return { status: "untrusted", basis: "source_visible_name" };
  const cached = batch.matches.get(name);
  if (cached) return cached;
  const normalizedName = normalizeSubjectIdentifier(name, "");
  const familyId =
    (context?.mode === undefined || context?.mode === "roleplay") && context?.scope
      ? ltmScopeFamilyId(context.scope)
      : null;
  if (familyId && index.ambiguousLocalNames.has(`${familyId}\u0000${normalizedName}`)) {
    const match = localAmbiguousMatch(index, familyId, normalizedName);
    batch.matches.set(name, match);
    return match;
  }
  const direct = matchDirect(index, normalizedName);
  if (direct.status !== "untrusted") {
    batch.matches.set(name, direct);
    return direct;
  }
  const sourceVisible = isSourceBackedProperName(name, [
    context?.sourceBackedNpcSourceText,
    context?.sourceBackedNpcSourceTitle,
  ]);
  if (!sourceVisible) {
    const match: SubjectMatch = { status: "untrusted", basis: "source_visible_name" };
    batch.matches.set(name, match);
    return match;
  }
  if (familyId && context?.scope) {
    const subject = localCharacterSubjectForName(context.scope, name);
    if (subject && batch.provisionalKeys.has(subject.key)) {
      const match: SubjectMatch = { status: "ambiguous", keys: [], basis: "batch_provisional_duplicate" };
      batch.matches.set(name, match);
      return match;
    }
    if (subject) {
      const relation = matchTrustedNameRelation(index, name, familyId);
      if (relation) {
        batch.matches.set(name, relation);
        return relation;
      }
      const entry: TrustedLtmSubjectCatalogEntry = {
        subject,
        name,
        aliases: expandedAliases(name, []),
        canonicalSlug: normalizedName,
        familyId,
      };
      addCatalogEntry(index, entry);
      batch.provisionalKeys.add(subject.key);
      const match: SubjectMatch = {
        status: "matched",
        entries: [entry],
        basis: "source_visible_name",
      };
      batch.matches.set(name, match);
      return match;
    }
  }
  const untrusted: SubjectMatch = { status: "untrusted", basis: "source_visible_name" };
  batch.matches.set(name, untrusted);
  return untrusted;
}

function localAmbiguousMatch(index: CatalogIndex, familyId: string, normalizedName: string): SubjectMatch {
  const entries = index.ambiguousLocalEntries.get(`${familyId}\u0000${normalizedName}`) ?? [];
  const { competingRecords } = diagnoseCollision(entries, "local_family_duplicate");
  return {
    status: "ambiguous",
    keys: entries.map(subjectEntryKey),
    basis: "local_family_duplicate",
    competingRecords,
    collisionSource: "duplicate_local",
  };
}

function resolveNamedUnitSubjects(
  unit: LtmSubjectIdentityCandidate,
  batch: BatchSubjectNameResolution,
  index?: CatalogIndex,
  context?: Pick<
    PreparedLtmSubjectIdentityContext,
    "scope" | "mode" | "sourceBackedNpcSourceText" | "sourceBackedNpcSourceTitle"
  >,
): SubjectMatch {
  const expected = unit.bucket === "character_fact" ? 1 : 2;
  const subjectNames = unit.subjectNames ?? [];
  if (subjectNames.length !== expected) {
    return { status: "cardinality", count: subjectNames.length, basis: "subject_names" };
  }
  const nameMatches = subjectNames.map((name) => {
    const trimmed = name.trim();
    return batch.matches.get(trimmed) ?? resolveAndCacheSubjectName(batch, index, context, trimmed);
  });
  const ambiguous = nameMatches.filter(
    (match): match is Extract<SubjectMatch, { status: "ambiguous" }> => match.status === "ambiguous",
  );
  if (ambiguous.length > 0) {
    const competingRecords = ambiguous.flatMap((m) => m.competingRecords ?? []);
    return {
      status: "ambiguous",
      keys: uniqueStrings(ambiguous.flatMap((match) => match.keys)),
      basis: ambiguous[0]!.basis,
      competingRecords: competingRecords.length > 0 ? competingRecords : undefined,
      collisionSource: ambiguous[0]!.collisionSource,
    };
  }
  const unmatched = nameMatches.find((match) => match.status !== "matched");
  if (unmatched) return unmatched;

  const matched = nameMatches as Array<Extract<SubjectMatch, { status: "matched" }>>;
  const entries = matched.flatMap((match) => match.entries);
  const uniqueEntries = new Map(entries.map((entry) => [entry.subject.key, entry]));
  if (uniqueEntries.size !== expected) {
    return { status: "cardinality", count: uniqueEntries.size, basis: "subject_names" };
  }
  return {
    status: "matched",
    entries: [...uniqueEntries.values()],
    basis: matched.some((match) => match.basis === "batch_name_alias")
      ? "batch_name_alias"
      : matched.some((match) => match.basis === "unique_alias")
        ? "unique_alias"
        : "exact_name",
  };
}

function sourceBackedNpcSubject(
  unit: LtmSubjectIdentityCandidate,
  index: CatalogIndex | undefined,
  scope: LtmScope | undefined,
  mode: LtmMode | undefined,
  sourceText: string | undefined,
  sourceTitle: string | undefined,
): { entry: TrustedLtmSubjectCatalogEntry } | { ambiguous: SubjectMatch } | null {
  if (mode !== undefined && mode !== "roleplay") return null;
  if (unit.bucket !== "character_fact" || (unit.subjectKeys?.length ?? 0) > 0) return null;
  const slug = stripNotePrefix(normalizeSubjectIdentifier(unit.subjectId, ""));
  const sourceNames = sourceBackedNpcNames([sourceText, sourceTitle]);
  const name = sourceNames.get(slug);
  if (!name || !scope) return null;
  const subject = localCharacterSubjectForName(scope, name);
  if (!subject) return null;
  const familyId = ltmScopeFamilyId(scope);
  if (index) {
    const relation = matchTrustedNameRelation(index, name, familyId);
    if (relation?.status === "matched") return { entry: relation.entries[0]! };
    if (relation?.status === "ambiguous") return { ambiguous: relation };
  }
  return {
    entry: {
      subject,
      name,
      aliases: expandedAliases(name, []).filter((alias) => normalizeSubjectIdentifier(alias, "") !== slug),
      canonicalSlug: slug,
      ...(familyId ? { familyId } : {}),
    },
  };
}

function sourceBackedNpcNames(sources: Array<string | undefined>) {
  const names = new Map<string, string>();
  for (const source of sources) {
    if (!source) continue;
    for (const match of source.matchAll(SOURCE_BACKED_NPC_NAME_PATTERN)) {
      const words = match[0]!.trim().split(/\s+/g);
      for (let start = 0; start < words.length; start += 1) {
        for (let length = 1; length <= Math.min(4, words.length - start); length += 1) {
          const name = words.slice(start, start + length).join(" ");
          if (!isSourceBackedProperName(name, [source])) continue;
          const slug = normalizeSubjectIdentifier(name, "");
          if (slug && !names.has(slug)) names.set(slug, name);
        }
      }
    }
  }
  return names;
}

function isSourceBackedProperName(name: string, sources: Array<string | undefined>) {
  const trimmed = name.trim();
  if (!SOURCE_BACKED_PROPER_NAME_PATTERN.test(trimmed)) return false;
  if (isGenericSubjectName(trimmed)) return false;
  return sources.some((source) => sourceContainsWholeName(source, trimmed));
}

function isGenericSubjectName(name: string) {
  const slug = normalizeSubjectIdentifier(name, "");
  const withoutArticle = slug.startsWith("the_") ? slug.slice(4) : slug;
  if (GENERIC_SUBJECT_NAMES.has(slug) || GENERIC_SUBJECT_NAMES.has(withoutArticle)) return true;

  const tokens = withoutArticle.split("_").filter(Boolean);
  const finalToken = tokens.at(-1) ?? "";
  const explicitGenericFinalToken = GENERIC_SUBJECT_NAMES.has(finalToken);
  if (tokens.length <= 1) return explicitGenericFinalToken;
  const genericFinalToken =
    explicitGenericFinalToken ||
    GENERIC_ROLE_SUFFIXES.some((suffix) => finalToken.length > suffix.length + 2 && finalToken.endsWith(suffix));
  return genericFinalToken && tokens.slice(0, -1).every((token) => GENERIC_ROLE_QUALIFIERS.has(token));
}

function sourceContainsWholeName(source: string | undefined, name: string) {
  if (!source) return false;
  let offset = source.indexOf(name);
  while (offset >= 0) {
    const before = offset > 0 ? source[offset - 1]! : "";
    const afterIndex = offset + name.length;
    const after = source[afterIndex] ?? "";
    const possessiveEnd =
      (after === "'" || after === "\u2019") &&
      /s/i.test(source[afterIndex + 1] ?? "") &&
      !SOURCE_BACKED_NAME_BOUNDARY_PATTERN.test(source[afterIndex + 2] ?? "");
    if (
      (!before || !SOURCE_BACKED_NAME_BOUNDARY_PATTERN.test(before)) &&
      (!after || !SOURCE_BACKED_NAME_BOUNDARY_PATTERN.test(after) || possessiveEnd)
    ) {
      return true;
    }
    offset = source.indexOf(name, offset + 1);
  }
  return false;
}

function isLongerVersionOfName(shortName: string, candidate: string, aliases: readonly string[] = []) {
  if (nameTokenCount(candidate) <= nameTokenCount(shortName)) return false;
  const shortSlug = normalizeSubjectIdentifier(shortName, "");
  const candidateSlug = normalizeSubjectIdentifier(candidate, "");
  if (!shortSlug || !candidateSlug) return false;
  const firstName = candidateSlug.split("_")[0] ?? "";
  return (
    candidateSlug.startsWith(`${shortSlug}_`) ||
    candidateSlug.endsWith(`_${shortSlug}`) ||
    (firstName.length > shortSlug.length && firstName.startsWith(shortSlug) && shortSlug.length >= 3) ||
    expandedAliases(candidate, [...aliases]).some((alias) => normalizeSubjectIdentifier(alias, "") === shortSlug)
  );
}

// Canonicalize a surface name against trusted catalog entries related by the
// conservative shorter/longer name heuristic before any provisional local
// character is created. Returns matched/ambiguous, or null when no trusted
// relation exists (the caller may then create a provisional identity).
function matchTrustedNameRelation(index: CatalogIndex, name: string, familyId: string | null): SubjectMatch | null {
  if (!familyId) return null;
  const related = index.entries.filter(
    (entry) =>
      (!entry.familyId || entry.familyId === familyId) &&
      (isLongerVersionOfName(entry.name, name, entry.aliases) ||
        isLongerVersionOfName(name, entry.name, entry.aliases)),
  );
  const uniqueSubjects = new Map(related.map((entry) => [entry.subject.key, entry]));
  if (uniqueSubjects.size === 0) return null;
  if (uniqueSubjects.size === 1) {
    return { status: "matched", entries: [[...uniqueSubjects.values()][0]!], basis: "batch_name_alias" };
  }
  const competing = [...uniqueSubjects.values()];
  const { collisionSource, competingRecords } = diagnoseCollision(competing);
  return {
    status: "ambiguous",
    keys: competing.map(subjectEntryKey),
    basis: "batch_name_alias",
    competingRecords,
    collisionSource,
  };
}

function nameTokenCount(name: string) {
  return name.trim().split(/\s+/g).filter(Boolean).length;
}

function addCatalogEntry(index: CatalogIndex, entry: TrustedLtmSubjectCatalogEntry) {
  if (index.byKey.has(entry.subject.key)) return;
  index.entries.push(entry);
  index.byKey.set(entry.subject.key, entry);
  addIndexEntry(index.exact, normalizeSubjectIdentifier(entry.name, ""), entry);
  for (const alias of entry.aliases) addIndexEntry(index.aliases, normalizeSubjectIdentifier(alias, ""), entry);
  index.tokens = uniqueStrings([...index.tokens, normalizeSubjectIdentifier(entry.name, ""), entry.canonicalSlug]).sort(
    (left, right) => right.length - left.length || left.localeCompare(right),
  );
}

function entryIdentityTokens(entry: TrustedLtmSubjectCatalogEntry) {
  return uniqueStrings([
    normalizeSubjectIdentifier(entry.name, ""),
    entry.canonicalSlug,
    ...entry.aliases.map((alias) => normalizeSubjectIdentifier(alias, "")),
  ]);
}

function isDominatedUnboundNpcEntry(
  entry: TrustedLtmSubjectCatalogEntry,
  refBackedIdentityTokens: ReadonlySet<string>,
) {
  if (entry.subject.ref || !isLocalCharacterSubject(entry.subject)) return false;
  const primaryTokens = uniqueStrings([normalizeSubjectIdentifier(entry.name, ""), entry.canonicalSlug]);
  return primaryTokens.some((token) => refBackedIdentityTokens.has(token));
}

export function subjectsEqual(left: readonly LtmSubject[] | undefined, right: readonly LtmSubject[] | undefined) {
  if (!left || !right || left.length !== right.length) return false;
  return left.every((subject, index) => subject.key === right[index]?.key);
}

function buildCatalogIndex(catalog: TrustedLtmSubjectCatalog): CatalogIndex {
  const exact = new Map<string, TrustedLtmSubjectCatalogEntry[]>();
  const aliases = new Map<string, TrustedLtmSubjectCatalogEntry[]>();
  for (const entry of catalog.entries) {
    addIndexEntry(exact, normalizeSubjectIdentifier(entry.name, ""), entry);
    for (const alias of entry.aliases) addIndexEntry(aliases, normalizeSubjectIdentifier(alias, ""), entry);
    addIndexEntry(aliases, entry.canonicalSlug, entry);
  }
  return {
    entries: [...catalog.entries],
    byKey: new Map(catalog.entries.map((entry) => [entry.subject.key, entry])),
    byRef: new Map(
      catalog.entries.flatMap((entry) =>
        entry.subject.ref ? [[subjectRefKey(entry.subject.ref), entry] as const] : [],
      ),
    ),
    exact,
    aliases,
    tokens: uniqueStrings([...exact.keys(), ...aliases.keys()]).sort(
      (left, right) => right.length - left.length || left.localeCompare(right),
    ),
    ambiguousLocalNames: new Set(catalog.ambiguousLocalNames ?? []),
    ambiguousLocalEntries: new Map(Object.entries(catalog.ambiguousLocalEntries ?? {})),
  };
}

function addIndexEntry(
  map: Map<string, TrustedLtmSubjectCatalogEntry[]>,
  token: string,
  entry: TrustedLtmSubjectCatalogEntry,
) {
  if (!token) return;
  const current = map.get(token) ?? [];
  if (!current.some((candidate) => candidate.subject.key === entry.subject.key)) current.push(entry);
  map.set(token, current);
}

function resolveUnitSubjects(unit: LtmSubjectIdentityCandidate, index: CatalogIndex): SubjectMatch {
  const expected = unit.bucket === "character_fact" ? 1 : 2;
  const subjectKeys = unit.subjectKeys ?? [];
  if (subjectKeys.length > 0) {
    if (subjectKeys.length !== expected) {
      return { status: "cardinality", count: subjectKeys.length, basis: "trusted_key" };
    }
    const entries = subjectKeys.map((key) => index.byKey.get(key));
    if (entries.some((entry) => !entry)) return { status: "untrusted", basis: "trusted_key" };
    const resolved = entries as TrustedLtmSubjectCatalogEntry[];
    if (new Set(resolved.map((entry) => entry.subject.key)).size !== resolved.length) {
      return { status: "cardinality", count: 1, basis: "trusted_key" };
    }
    return { status: "matched", entries: resolved, basis: "trusted_key" };
  }

  const raw = stripNotePrefix(normalizeSubjectIdentifier(unit.subjectId, ""));
  if (unit.bucket === "character_fact") {
    const direct = matchDirect(index, raw);
    if (direct.status !== "untrusted") return direct;

    const traitMatch = matchTraitPrefix(index, raw);
    const hasCompositeConnector = /\b(?:and|with|plus)\b|_and_|_with_|_plus_|_&_/i.test(raw);
    if (traitMatch.status === "matched" && !hasCompositeConnector) {
      return traitMatch;
    }

    const composite = segmentSubjectIdentifier(raw, index).filter(
      (sequence) => new Set(sequence.map(subjectEntryKey)).size > 1,
    );
    if (composite.length > 0) {
      return {
        status: "cardinality",
        count: Math.max(...composite.map((sequence) => new Set(sequence.map(subjectEntryKey)).size)),
        basis: "composite",
      };
    }
    return traitMatch;
  }
  return matchRelationship(index, raw);
}

function matchDirect(index: CatalogIndex, token: string): SubjectMatch {
  if (!token) return { status: "untrusted", basis: "name" };
  const exact = index.exact.get(token) ?? [];
  if (exact.length === 1) return { status: "matched", entries: exact, basis: "exact_name" };
  if (exact.length > 1) {
    const { collisionSource, competingRecords } = diagnoseCollision(exact);
    return {
      status: "ambiguous",
      keys: exact.map(subjectEntryKey),
      basis: "exact_name",
      competingRecords,
      collisionSource,
    };
  }
  const aliases = index.aliases.get(token) ?? [];
  if (aliases.length === 1) return { status: "matched", entries: aliases, basis: "unique_alias" };
  if (aliases.length > 1) {
    const { collisionSource, competingRecords } = diagnoseCollision(aliases, "alias");
    return {
      status: "ambiguous",
      keys: aliases.map(subjectEntryKey),
      basis: "alias",
      competingRecords,
      collisionSource,
    };
  }
  const fuzzy = fuzzyMatches(index, token);
  if (fuzzy.length === 1) return { status: "matched", entries: [fuzzy[0]!.entry], basis: "spelling_variation" };
  if (fuzzy.length > 1) {
    const fuzzyEntries = fuzzy.map(({ entry }) => entry);
    const { collisionSource, competingRecords } = diagnoseCollision(fuzzyEntries);
    return {
      status: "ambiguous",
      keys: fuzzy.map(({ entry }) => subjectEntryKey(entry)),
      basis: "spelling_variation",
      competingRecords,
      collisionSource,
    };
  }
  for (const [key, entries] of index.ambiguousLocalEntries.entries()) {
    if (key.endsWith(`\u0000${token}`)) {
      const { collisionSource, competingRecords } = diagnoseCollision(entries);
      return {
        status: "ambiguous",
        keys: entries.map(subjectEntryKey),
        basis: "local_family_duplicate",
        competingRecords,
        collisionSource,
      };
    }
  }
  return { status: "untrusted", basis: "name" };
}

function fuzzyMatches(index: CatalogIndex, token: string) {
  if (token.length < 5 || token.split("_").length > 3) return [];
  const matches = new Map<string, { entry: TrustedLtmSubjectCatalogEntry; distance: number }>();
  for (const entry of index.entries) {
    for (const candidate of entryIdentityTokens(entry)) {
      if (candidate.split("_").length !== token.split("_").length) continue;
      const distance = damerauLevenshtein(token, candidate);
      const maximum = candidate.length >= 8 ? 2 : 1;
      if (distance > maximum) continue;
      const current = matches.get(entry.subject.key);
      if (!current || distance < current.distance) matches.set(entry.subject.key, { entry, distance });
    }
  }
  const ranked = [...matches.values()].sort(
    (left, right) => left.distance - right.distance || left.entry.subject.key.localeCompare(right.entry.subject.key),
  );
  if (ranked.length < 2 || ranked[0]!.distance < ranked[1]!.distance) return ranked.slice(0, 1);
  return ranked.filter((candidate) => candidate.distance === ranked[0]!.distance);
}

function damerauLevenshtein(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, (_, row) =>
    Array.from({ length: right.length + 1 }, (_, column) => row + column),
  );
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      rows[row]![column] = Math.min(
        rows[row - 1]![column]! + 1,
        rows[row]![column - 1]! + 1,
        rows[row - 1]![column - 1]! + (left[row - 1] === right[column - 1] ? 0 : 1),
        ...(row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1]
          ? [rows[row - 2]![column - 2]! + 1]
          : []),
      );
    }
  }
  return rows[left.length]![right.length]!;
}

function matchTraitPrefix(index: CatalogIndex, raw: string): SubjectMatch {
  for (const token of index.tokens) {
    if (!raw.startsWith(`${token}_`)) continue;
    const match = matchDirect(index, token);
    if (match.status === "matched") return { ...match, basis: "trait_or_qualified_alias" };
    if (match.status === "ambiguous") return match;
  }
  return { status: "untrusted", basis: "trait_or_qualified_alias" };
}

function matchRelationship(index: CatalogIndex, raw: string): SubjectMatch {
  const sequences = segmentSubjectIdentifier(raw, index);
  const pairs = sequences.filter(
    (sequence) => sequence.length === 2 && sequence[0]!.subject.key !== sequence[1]!.subject.key,
  );
  const pairByIdentity = new Map<string, TrustedLtmSubjectCatalogEntry[]>();
  for (const pair of pairs) {
    const key = pair.map(subjectEntryKey).sort().join("\u0000");
    if (!pairByIdentity.has(key)) pairByIdentity.set(key, pair);
  }
  if (pairByIdentity.size === 1) {
    return { status: "matched", entries: [...pairByIdentity.values()][0]!, basis: "unordered_pair" };
  }
  if (pairByIdentity.size > 1) {
    const candidateEntries = [...pairByIdentity.values()].flat();
    const { collisionSource, competingRecords } = diagnoseCollision(candidateEntries);
    return {
      status: "ambiguous",
      keys: [...pairByIdentity.keys()],
      basis: "unordered_pair",
      competingRecords,
      collisionSource,
    };
  }
  if (sequences.length > 0) {
    return {
      status: "cardinality",
      count: Math.max(...sequences.map((sequence) => new Set(sequence.map(subjectEntryKey)).size)),
      basis: "unordered_pair",
    };
  }
  return { status: "untrusted", basis: "unordered_pair" };
}

function segmentSubjectIdentifier(raw: string, index: CatalogIndex) {
  const results: TrustedLtmSubjectCatalogEntry[][] = [];
  const visit = (remaining: string, sequence: TrustedLtmSubjectCatalogEntry[]) => {
    if (!remaining) {
      results.push(sequence);
      return;
    }
    if (sequence.length >= 4) return;
    for (const token of index.tokens) {
      if (remaining !== token && !remaining.startsWith(`${token}_`)) continue;
      const match = matchDirect(index, token);
      if (match.status !== "matched") continue;
      const rest = remaining === token ? "" : remaining.slice(token.length + 1);
      for (const entry of match.entries) {
        const nameTokens = entry.canonicalSlug.split("_");
        if (nameTokens.length > 1 && token === nameTokens.at(-1) && sequence.length > 0) {
          continue;
        }
        visit(rest, [...sequence, entry]);
      }
    }
  };
  visit(raw, []);
  const unique = new Map<string, TrustedLtmSubjectCatalogEntry[]>();
  for (const sequence of results) {
    const key = sequence.map(subjectEntryKey).join("\u0000");
    if (!unique.has(key)) unique.set(key, sequence);
  }
  return [...unique.values()];
}

function inferLegacyBindings(catalog: TrustedLtmSubjectCatalog, index: CatalogIndex) {
  const bindings = new Map<string, LtmSubject[]>();
  for (const note of catalog.notes) {
    if (note.subjects) continue;
    const identifiers = uniqueStrings([
      note.title ? normalizeSubjectIdentifier(note.title, "") : "",
      stripNotePrefix(note.id),
    ]);
    for (const identifier of identifiers) {
      const match =
        note.type === "character" ? matchLegacyCharacter(index, identifier) : matchRelationship(index, identifier);
      if (match.status !== "matched") continue;
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

function matchLegacyCharacter(index: CatalogIndex, identifier: string) {
  const direct = matchDirect(index, identifier);
  return direct.status === "untrusted" ? matchTraitPrefix(index, identifier) : direct;
}

function publicIdentityMatchBasis(basis: string): LtmIdentityMatchBasis {
  if (basis === "exact_name") return "exact_name";
  if (basis === "unique_alias") return "unique_alias";
  if (basis === "trait_or_qualified_alias") return "trait_or_qualified_alias";
  if (basis === "spelling_variation") return "spelling_variation";
  return "unordered_pair";
}

function identityBasisPriority(basis: string) {
  if (basis === "exact_name") return 0;
  if (basis === "unique_alias") return 1;
  if (basis === "trait_or_qualified_alias") return 2;
  if (basis === "spelling_variation") return 3;
  return 4;
}

function compareTrustedIdentityNotes(left: TrustedLtmNoteSubjectMatch, right: TrustedLtmNoteSubjectMatch) {
  return (
    (left.exactFullName ? 0 : 1) - (right.exactFullName ? 0 : 1) ||
    identityBasisPriority(left.basis) - identityBasisPriority(right.basis) ||
    compareNoteAge(left.note, right.note)
  );
}

function chooseIdentityTarget(
  notes: LtmNote[],
  legacyBindings: Map<string, LtmSubject[]>,
  entries: TrustedLtmSubjectCatalogEntry[],
  bucket: LtmEvidenceUnit["bucket"],
) {
  const type = bucket === "character_fact" ? "character" : "relationship";
  const subjects = sortSubjects(entries.map((entry) => entry.subject));
  const canonicalId = canonicalNoteIdForEntries(entries, bucket);
  const candidates = notes.filter((note) => {
    if (note.type !== type) return false;
    return subjectsEqual(note.subjects ?? legacyBindings.get(note.id), subjects);
  });
  return candidates.sort((left, right) => {
    const leftExact = isExactIdentityNote(left, entries, canonicalId) ? 0 : 1;
    const rightExact = isExactIdentityNote(right, entries, canonicalId) ? 0 : 1;
    return leftExact - rightExact || compareNoteAge(left, right);
  })[0];
}

function isExactIdentityNote(note: LtmNote, entries: TrustedLtmSubjectCatalogEntry[], canonicalId: string) {
  if (note.id === canonicalId) return true;
  if (entries.length !== 1 || !note.title) return false;
  return normalizeSubjectIdentifier(note.title, "") === normalizeSubjectIdentifier(entries[0]!.name, "");
}

function isExactRepairIdentityNote(note: LtmNote, entries: TrustedLtmSubjectCatalogEntry[], canonicalId: string) {
  if (note.type === "character") {
    return Boolean(
      entries.length === 1 &&
      note.title &&
      normalizeSubjectIdentifier(note.title, "") === normalizeSubjectIdentifier(entries[0]!.name, ""),
    );
  }
  return note.id === canonicalId;
}

function resolveIdentityLinkTarget(
  target: string,
  relation: LtmEvidenceUnit["links"][number]["relation"],
  index: CatalogIndex,
  catalog: TrustedLtmSubjectCatalog,
  legacyBindings: Map<string, LtmSubject[]>,
) {
  const raw = stripNotePrefix(normalizeSubjectIdentifier(target, ""));
  const match =
    relation === "affects_character"
      ? matchLegacyCharacter(index, raw)
      : relation === "affects_relationship"
        ? matchRelationship(index, raw)
        : null;
  if (!match || match.status !== "matched") return null;
  const bucket = relation === "affects_character" ? "character_fact" : "relationship_state";
  const note = chooseIdentityTarget(catalog.notes, legacyBindings, match.entries, bucket);
  return { noteId: note?.id ?? canonicalNoteIdForEntries(match.entries, bucket), note };
}

function canonicalNoteIdForEntries(entries: TrustedLtmSubjectCatalogEntry[], bucket: LtmEvidenceUnit["bucket"]) {
  const prefix = bucket === "character_fact" ? "char" : "rel";
  const slugs = entries.map((entry) => entry.canonicalSlug).sort();
  const base = `${prefix}_${slugs.join("_")}`;
  const hasLocalCharacter = entries.some((entry) => isLocalCharacterSubject(entry.subject));
  if (base.length <= 120 && !hasLocalCharacter) return base;
  const suffix = createHash("sha256")
    .update(entries.map(subjectEntryKey).sort().join("\u0000"))
    .digest("hex")
    .slice(0, 10);
  return `${base.slice(0, 109).replace(/_+$/g, "")}_${suffix}`;
}

function subjectIdForTarget(noteId: string, bucket: LtmEvidenceUnit["bucket"]) {
  const prefix = bucket === "character_fact" ? "char_" : "rel_";
  return noteId.startsWith(prefix) ? noteId.slice(prefix.length) : noteId;
}

function subjectRejection(unit: LtmEvidenceUnit, match: Exclude<SubjectMatch, { status: "matched" }>, index: number) {
  const noteId = noteIdForEvidenceUnit(unit);
  const isCompositeCharacter = unit.bucket === "character_fact" && match.status === "cardinality" && match.count > 1;
  const isAmbiguous = match.status === "ambiguous";
  const code = isCompositeCharacter
    ? "composite_character_subject"
    : isAmbiguous
      ? "ambiguous_subject_identity"
      : match.status === "cardinality"
        ? "invalid_subject_cardinality"
        : "untrusted_subject_identity";
  const reason: LtmExtractionDroppedCandidate["reason"] = isAmbiguous
    ? "ambiguous_subject"
    : match.status === "untrusted"
      ? "untrusted_subject"
      : "invalid_subject_cardinality";
  const message = isCompositeCharacter
    ? "Dropped a character fact that combined multiple character subjects."
    : isAmbiguous
      ? "Dropped a candidate whose subject matches more than one trusted roster identity."
      : match.status === "cardinality"
        ? `Dropped a ${unit.bucket} candidate with ${match.count} resolved subjects.`
        : "Dropped a candidate whose subject is not in the trusted chat roster or bound memories.";
  return {
    diagnostic: {
      severity: "error" as const,
      code,
      candidateIndex: index,
      mutationId: unit.id,
      noteId,
      message,
      details: {
        subjectId: unit.subjectId,
        subjectNames: unit.subjectNames ?? [],
        subjectKeys: unit.subjectKeys ?? [],
        matchBasis: match.basis,
        ...(isAmbiguous
          ? {
              competingSubjectKeys: match.keys,
              competingRecords:
                match.competingRecords ??
                match.keys.map((key) => ({
                  key,
                  name: subjectLabelFromKey(key),
                  canonicalSlug: normalizeSubjectIdentifier(subjectLabelFromKey(key), ""),
                  provenance: key,
                })),
              ...(match.collisionSource ? { collisionSource: match.collisionSource } : {}),
            }
          : {}),
      },
    },
    dropped: {
      index,
      reason,
      validatorCode: code,
      message,
      snippet: safeSnippet(unit.text),
      recoveryCandidate: unit,
      recovery: {
        noteType: unit.bucket === "character_fact" ? ("character" as const) : ("relationship" as const),
        noteId,
        sectionKey: unit.sectionKey,
        status: unit.status === "archived" ? ("archived" as const) : ("active" as const),
      },
    },
  };
}

function fallbackSubjectsForUnit(unit: LtmEvidenceUnit) {
  if (unit.bucket === "character_fact") return [{ key: `legacy:${unit.subjectId}` }];
  return sortSubjects([{ key: `legacy:${unit.subjectId}:1` }, { key: `legacy:${unit.subjectId}:2` }]);
}

function withoutSubjectIdentity(unit: LtmEvidenceUnit): LtmEvidenceUnit {
  const { subjectNames: _subjectNames, subjectKeys: _subjectKeys, subjects: _subjects, ...withoutIdentity } = unit;
  return withoutIdentity;
}

function sortSubjects(subjects: LtmSubject[]) {
  return [...subjects].sort((left, right) => left.key.localeCompare(right.key));
}

function sortSubjectEntries(entries: TrustedLtmSubjectCatalogEntry[]) {
  return [...entries].sort((left, right) => left.subject.key.localeCompare(right.subject.key));
}

function subjectEntryKey(entry: TrustedLtmSubjectCatalogEntry) {
  return entry.subject.key;
}

function subjectRefKey(ref: LtmSubjectReference) {
  return `${ref.kind}\u0000${ref.id}`;
}

function compareNoteAge(left: LtmNote, right: LtmNote) {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

function subjectNameFromNote(note: LtmNote) {
  return note.title?.trim() || subjectSlugFromNote(note).replace(/_/g, " ");
}

function subjectSlugFromNote(note: LtmNote) {
  return stripNotePrefix(note.id) || "subject";
}

function subjectLabelFromKey(key: string) {
  if (key.startsWith("local_character:")) {
    const name = key.slice("local_character:".length).split(":").at(-1) ?? key;
    return name.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  const suffix = key.includes(":") ? key.slice(key.indexOf(":") + 1) : key;
  return normalizeSubjectIdentifier(suffix, "subject").replace(/_/g, " ");
}

function stripNotePrefix(identifier: string) {
  return identifier.replace(/^(?:char|rel)_/, "");
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

function expandedAliases(name: string, aliases: string[]) {
  const words = name.trim().split(/\s+/g).filter(Boolean);
  return uniqueStrings([...aliases, ...(words.length > 1 ? [words[0]] : [])]);
}

export function normalizeSubjectIdentifier(value: unknown, fallback = "subject") {
  if (typeof value !== "string") return fallback;
  const normalized = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 120)
    .replace(/_+$/g, "");
  return /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(normalized) ? normalized : fallback;
}
