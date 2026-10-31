import {
  type LtmEvidenceUnit,
  type LtmExtractionDroppedCandidate,
  type LtmMode,
  type LtmNote,
  type LtmScope,
  type LtmSubject,
  type LtmSubjectIdentityReview,
} from "../../../../../shared/src/features/agents/long-term-memory/index.js";
import {
  isLocalCharacterSubject,
  localCharacterFamilyFromKey,
  localCharacterSubjectForName,
  ltmScopeFamilyId,
} from "./chat-scope.js";
import type { LtmExtractionDiagnostic } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  noteIdForEvidenceUnit,
  recoveryCandidateForUnit,
  unprefixedSubjectId,
} from "../extraction/evidence-unit-validation.js";
import { subjectsEqual } from "./subject-equality.js";
import { safeSnippet, uniqueStrings, normalizeSubjectName } from "../ltm-utils.js";
import {
  isSourceBackedProperName,
  nameTokenCount,
  nameTokensRelated,
  normalizeSubjectIdentifier,
  sourceBackedNpcNames,
  stripNotePrefix,
  subjectLabelFromKey,
} from "./subject-names.js";
import {
  addCatalogEntry,
  buildCatalogIndex,
  canonicalNoteIdForEntries,
  type CatalogIndex,
  compareNoteAge,
  type CompetingSubjectRecord,
  localAmbiguousMatch,
  matchDirect,
  matchDirectName,
  matchLegacyCharacter,
  matchRelationship,
  matchTraitPrefix,
  matchTrustedNameRelation,
  partialNameCandidateEntries,
  partialNameReview,
  segmentSubjectIdentifier,
  sortSubjectEntries,
  sortSubjects,
  subjectEntryKey,
  type SubjectMatch,
  type TrustedLtmSubjectCatalog,
  type TrustedLtmSubjectCatalogEntry,
} from "./subject-matching.js";
import { analyzeTrustedLtmNoteSubjects, inferLegacyBindings, isExactIdentityNote } from "./subject-catalog.js";

export type LtmSubjectIdentityResolution = {
  units: LtmEvidenceUnit[];
  existingNotes: LtmNote[];
  diagnostics: LtmExtractionDiagnostic[];
  droppedCandidates: LtmExtractionDroppedCandidate[];
  legacyBindings: Map<string, LtmSubject[]>;
  aliasChoices: Map<string, { title: string; canonicalName: string }>;
  skippedUnits: number;
};

export type LtmSubjectIdentityCandidate = Pick<
  LtmEvidenceUnit,
  "bucket" | "subjectId" | "sectionKey" | "subjectNames" | "subjectKeys"
>;

export type LtmSubjectIdentityContext = {
  identityKeyForUnit(unit: LtmSubjectIdentityCandidate): string;
  reviewForUnit(unit: LtmSubjectIdentityCandidate): LtmSubjectIdentityReview[];
  resolve(input: {
    units: LtmEvidenceUnit[];
    existingNotes: LtmNote[];
    enforceTrustedSubjects?: boolean;
  }): LtmSubjectIdentityResolution;
};

type BatchSubjectNameResolution = {
  matches: Map<string, SubjectMatch>;
  provisionalKeys: Set<string>;
  aliasChoices: Map<string, TrustedLtmSubjectCatalogEntry>;
  savedMatches: Map<string, SubjectMatch>;
  skippedNames: Set<string>;
};

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
  unresolvedBySubject: Map<string, string[]>;
  batchNames: BatchSubjectNameResolution;
  establishedKeysBySubject: Map<string, string[]>;
  namedDerivedKeysBySubject: Map<string, string[]>;
  sourceBackedNpcSourceText?: string;
  sourceBackedNpcSourceTitle?: string;
  scope?: LtmScope;
  mode?: LtmMode;
};

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
  const unresolvedBySubject = new Map<string, string[]>();
  for (const issue of analyzeTrustedLtmNoteSubjects(effectiveCatalog).unresolved) {
    const keys =
      issue.note.type === "relationship"
        ? (issue.candidateSubjectPairs ?? [])
        : issue.candidateSubjectKeys.map((key) => [key]);
    for (const pair of keys) {
      const key = pair.sort((left, right) => left.localeCompare(right)).join("\u0000");
      const compositeKey = `${issue.note.type}\0${key}`;
      const ids = unresolvedBySubject.get(compositeKey) ?? [];
      ids.push(issue.note.id);
      unresolvedBySubject.set(compositeKey, ids);
    }
  }
  const savedMatches = new Map<string, SubjectMatch>();
  const skippedNames = new Set<string>();
  // Saved decisions are keyed by the chat/group family, which exists independent of mode, so
  // a Conversation or Game family can reuse bind/skip choices. Creating a local "different"
  // identity stays gated to Roleplay through the mode-scoped `familyId` above.
  const savedFamilyId = scope ? ltmScopeFamilyId(scope) : null;
  for (const choice of catalog.identityChoices ?? []) {
    if (!savedFamilyId || choice.familyId !== savedFamilyId) continue;
    const token = normalizeSubjectName(choice.name);
    skippedNames.delete(token);
    if (choice.action === "skip") {
      skippedNames.add(token);
      savedMatches.set(token, { status: "untrusted", basis: "saved_skip" });
      continue;
    }
    if (choice.action === "different" && familyId) {
      const subject = scope && localCharacterSubjectForName(scope, choice.name);
      if (subject?.key === choice.subject.key && !index.byKey.has(subject.key)) {
        addCatalogEntry(index, {
          subject,
          name: choice.name,
          aliases: [],
          canonicalSlug: token,
          familyId,
          sourceScope: "local_note",
        });
      }
    }
    const entry = index.byKey.get(choice.subject.key);
    savedMatches.set(
      token,
      entry &&
        (choice.action !== "different" || entry.subject.key === localCharacterSubjectForName(scope!, choice.name)?.key)
        ? { status: "matched", entries: [entry], basis: "trusted_key" }
        : { status: "untrusted", basis: "saved_identity_unavailable" },
    );
  }
  const batchNames = preResolveBatchSubjectNames({
    units,
    index,
    scope,
    mode,
    sourceText: sourceBackedNpcSourceText,
    sourceTitle: sourceBackedNpcSourceTitle,
    savedMatches,
    skippedNames,
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

  // A valid explicit key or a reviewed subject-bound note can choose a scoped alias.
  const choices = new Map<string, TrustedLtmSubjectCatalogEntry | null>();
  for (const unit of units) {
    if (!unit.subjectKeys || !unit.subjectNames || unit.subjectNames.length !== unit.subjectKeys.length) continue;
    if (resolveUnitSubjects(unit, index).status !== "matched") continue;
    for (const [position, name] of unit.subjectNames.entries()) {
      const token = normalizeSubjectName(name);
      const entry = index.byKey.get(unit.subjectKeys[position]!);
      if (!entry) continue;
      const alias = matchDirect(index, token);
      let ambiguousKeys: string[] = [];
      if (alias.status === "ambiguous" && alias.basis === "alias") {
        ambiguousKeys = alias.keys;
      } else if (familyId) {
        ambiguousKeys = partialNameCandidateEntries(index, name, familyId).map(subjectEntryKey);
      }
      if (!ambiguousKeys.includes(entry.subject.key)) continue;
      const prior = choices.get(token);
      choices.set(token, prior === undefined ? entry : prior?.subject.key === entry.subject.key ? entry : null);
    }
  }
  if (familyId) {
    for (const note of effectiveCatalog.notes) {
      if (
        note.status === "archived" ||
        note.type !== "character" ||
        note.subjects?.length !== 1 ||
        ltmScopeFamilyId(note.destinationScope ?? note.scope) !== familyId
      )
        continue;
      const token = normalizeSubjectName(note.title ?? "");
      const alias = matchDirect(index, token);
      if (alias.status !== "ambiguous" || alias.basis !== "alias") continue;
      const entry = index.byKey.get(note.subjects[0]!.key);
      if (!entry || !alias.keys.includes(entry.subject.key)) continue;
      const prior = choices.get(token);
      choices.set(token, prior === undefined ? entry : prior?.subject.key === entry.subject.key ? entry : null);
    }
  }
  batchNames.aliasChoices = new Map([
    ...[...choices].filter((choice): choice is [string, TrustedLtmSubjectCatalogEntry] => choice[1] !== null),
    ...[...savedMatches].flatMap(([token, match]): Array<[string, TrustedLtmSubjectCatalogEntry]> =>
      match.status === "matched" ? [[token, match.entries[0]!]] : [],
    ),
  ]);

  // A nameless, keyless candidate may borrow the identity a named sibling in this
  // batch resolved for the same bucket + subjectId. Only solid name matches qualify,
  // and disagreeing siblings disqualify the key. Borrowed identities require review.
  const namedDerivedKeysBySubject = new Map<string, string[]>();
  {
    const derived = new Map<string, string[]>();
    const contested = new Set<string>();
    const sameKeys = (left: string[], right: string[]) => {
      if (left.length !== right.length) return false;
      const sortedRight = [...right].sort();
      return [...left].sort().every((key, index) => key === sortedRight[index]);
    };
    for (const unit of units) {
      if (unit.bucket !== "character_fact" && unit.bucket !== "relationship_state") continue;
      if (unit.subjectKeys !== undefined || !unit.subjectNames?.length) continue;
      if (unit.subjectNames.some((name) => batchNames.skippedNames.has(normalizeSubjectName(name)))) continue;
      const match = resolveNamedUnitSubjects(unit, batchNames, index, {
        scope,
        mode,
        sourceBackedNpcSourceText,
        sourceBackedNpcSourceTitle,
      });
      if (match.status !== "matched") continue;
      if (match.basis !== "trusted_key" && match.basis !== "exact_name" && match.basis !== "unique_alias") continue;
      const keys = match.entries.map((entry) => entry.subject.key);
      // Donor and lookup share the raw subjectId, deliberately: a prefix-stripped
      // match would let a differently named sibling borrow across IDs (fail-closed).
      const subjectKey = `${unit.bucket}\u0000${unit.subjectId}`;
      const prior = derived.get(subjectKey);
      if (prior === undefined) derived.set(subjectKey, keys);
      else if (!sameKeys(prior, keys)) contested.add(subjectKey);
      const establishedSubjectKey = `${unit.bucket}\u0000${stripNotePrefix(normalizeSubjectIdentifier(unit.subjectId, ""))}`;
      const established = establishedKeysBySubject.get(establishedSubjectKey);
      if (contestedSubjectKeys.has(establishedSubjectKey) || (established && !sameKeys(established, keys))) {
        contested.add(subjectKey);
      }
    }
    for (const [subjectKey, keys] of derived) {
      if (contested.has(subjectKey)) continue;
      namedDerivedKeysBySubject.set(subjectKey, keys);
    }
  }

  const context: PreparedLtmSubjectIdentityContext = {
    catalog: effectiveCatalog,
    index,
    legacyBindings,
    unresolvedBySubject,
    batchNames,
    establishedKeysBySubject,
    namedDerivedKeysBySubject,
    sourceBackedNpcSourceText,
    sourceBackedNpcSourceTitle,
    scope,
    mode,
  };
  return {
    reviewForUnit(unit) {
      return namedSubjectIdentityReview(unit, batchNames, index, context);
    },
    identityKeyForUnit(unit) {
      const hasSubjectNames = unit.subjectNames !== undefined && unit.subjectNames.length > 0;
      const established =
        unit.subjectKeys === undefined && !hasSubjectNames
          ? establishedKeysBySubject.get(
              `${unit.bucket}\u0000${stripNotePrefix(normalizeSubjectIdentifier(unit.subjectId, ""))}`,
            )
          : undefined;
      let effectiveUnit = established ? { ...unit, subjectKeys: established } : unit;
      let match =
        hasSubjectNames && effectiveUnit.subjectKeys === undefined
          ? resolveNamedUnitSubjects(unit, batchNames, index, context)
          : ((effectiveUnit.subjectKeys === undefined
              ? batchNames.savedMatches.get(stripNotePrefix(normalizeSubjectName(effectiveUnit.subjectId)))
              : undefined) ?? resolveUnitSubjects(effectiveUnit, index));
      if (
        match.status === "untrusted" &&
        match.basis !== "saved_skip" &&
        effectiveUnit.subjectKeys === undefined &&
        !hasSubjectNames
      ) {
        const borrowed = namedDerivedKeysBySubject.get(`${unit.bucket}\u0000${unit.subjectId}`);
        // Adopt the borrowed identity only when its keys resolve, mirroring the
        // resolution path so prediction cannot target an identity resolve rejects.
        const borrowedMatch = borrowed && resolveUnitSubjects({ ...effectiveUnit, subjectKeys: borrowed }, index);
        if (borrowed && borrowedMatch?.status === "matched") {
          effectiveUnit = { ...effectiveUnit, subjectKeys: borrowed };
          match = borrowedMatch;
        }
      }
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
          if (sourceBackedNpc && "entry" in sourceBackedNpc) {
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
    unresolvedBySubject,
    batchNames,
    establishedKeysBySubject,
    namedDerivedKeysBySubject,
    sourceBackedNpcSourceText,
    sourceBackedNpcSourceTitle,
    scope,
    mode,
  } = context;
  const diagnostics: LtmExtractionDiagnostic[] = [];
  const droppedCandidates: LtmExtractionDroppedCandidate[] = [];
  const resolved: ResolvedUnit[] = [];
  const aliasChoices = new Map<string, { title: string; canonicalName: string }>();
  let skippedUnits = 0;
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

    const names = unit.subjectNames?.length
      ? unit.subjectNames
      : unit.subjectKeys === undefined
        ? [stripNotePrefix(normalizeSubjectName(unit.subjectId))]
        : [];
    if (names.some((name) => batchNames.skippedNames.has(normalizeSubjectName(name)))) {
      skippedUnits += 1;
      diagnostics.push({
        severity: "warning",
        code: "subject_identity_skipped",
        candidateIndex,
        mutationId: unit.id,
        message: "Skipped this candidate using a saved subject-name decision for this chat or group.",
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
    let effectiveUnit = established ? { ...unit, subjectKeys: established } : unit;
    let match =
      hasSubjectNames && effectiveUnit.subjectKeys === undefined
        ? resolveNamedUnitSubjects(unit, batchNames, index, context)
        : ((effectiveUnit.subjectKeys === undefined
            ? batchNames.savedMatches.get(stripNotePrefix(normalizeSubjectName(effectiveUnit.subjectId)))
            : undefined) ?? resolveUnitSubjects(effectiveUnit, index));
    let borrowedIdentity = false;
    // Only an untrusted, nameless, keyless candidate may borrow from a named sibling
    // with the exact same bucket + subjectId; ambiguity/cardinality failures stay closed.
    if (
      match.status === "untrusted" &&
      match.basis !== "saved_skip" &&
      effectiveUnit.subjectKeys === undefined &&
      !hasSubjectNames
    ) {
      const borrowed = namedDerivedKeysBySubject.get(`${unit.bucket}\u0000${unit.subjectId}`);
      if (borrowed) {
        const borrowedMatch = resolveUnitSubjects({ ...effectiveUnit, subjectKeys: borrowed }, index);
        if (borrowedMatch.status === "matched") {
          effectiveUnit = { ...effectiveUnit, subjectKeys: borrowed };
          match = borrowedMatch;
          borrowedIdentity = true;
        }
      }
    }
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
      if (sourceBackedNpc && "ambiguous" in sourceBackedNpc) {
        const rejection = subjectRejection(effectiveUnit, sourceBackedNpc.ambiguous, candidateIndex);
        diagnostics.push(rejection.diagnostic);
        droppedCandidates.push(rejection.dropped);
        continue;
      }
      if (sourceBackedNpc && "entry" in sourceBackedNpc && match.status === "untrusted") {
        addCatalogEntry(index, sourceBackedNpc.entry);
        const subjects = [sourceBackedNpc.entry.subject];
        // Reuse an existing trusted/legacy note target for this identity, exactly like the
        // matched path below, so a keyless source-backed unit cannot fork a parallel note.
        const conflict = identityTargetConflict(
          catalog.notes,
          legacyBindings,
          unresolvedBySubject,
          [sourceBackedNpc.entry],
          effectiveUnit.bucket,
        );
        if (conflict) {
          const rejection = subjectRejection(effectiveUnit, conflict, candidateIndex);
          diagnostics.push(rejection.diagnostic);
          droppedCandidates.push(rejection.dropped);
          continue;
        }
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
      if (!enforceTrustedSubjects && !hasSubjectNames && effectiveUnit.subjectKeys === undefined) {
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
    const chosenName =
      effectiveUnit.bucket === "character_fact"
        ? effectiveUnit.subjectNames?.find(
            (name) =>
              !batchNames.savedMatches.has(normalizeSubjectName(name)) &&
              batchNames.aliasChoices.get(normalizeSubjectName(name))?.subject.key === subjects[0]?.key,
          )
        : undefined;
    if (chosenName) aliasChoices.set(unit.id, { title: chosenName, canonicalName: entries[0]!.name });
    const subjectNames = entries.map(
      (entry) =>
        effectiveUnit.subjectNames?.find(
          (name) => batchNames.aliasChoices.get(normalizeSubjectName(name))?.subject.key === entry.subject.key,
        ) ?? entry.name,
    );
    const subjectKeys = subjects.map((subject) => subject.key);
    const conflict = identityTargetConflict(
      catalog.notes,
      legacyBindings,
      unresolvedBySubject,
      entries,
      effectiveUnit.bucket,
    );
    if (conflict) {
      const rejection = subjectRejection(effectiveUnit, conflict, candidateIndex);
      diagnostics.push(rejection.diagnostic);
      droppedCandidates.push(rejection.dropped);
      continue;
    }
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

    if (borrowedIdentity) {
      diagnostics.push({
        severity: "warning",
        code: "borrowed_subject_identity",
        candidateIndex,
        mutationId: unit.id,
        noteId: canonicalNoteId,
        message: `Used ${subjectNames.join(" and ")} from a named memory with the same subjectId for this unnamed candidate. Review the character match before accepting.`,
        details: { subjectNames, subjectKeys, matchBasis: "borrowed_subject_identity" },
      });
    }

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
      if (candidates && candidates.size > 1) {
        const candidateTargetNoteIds = [...candidates].sort();
        diagnostics.push({
          severity: "warning",
          code: "ambiguous_subject_link_target",
          candidateIndex: item.candidateIndex,
          mutationId: item.unit.id,
          noteId: noteIdForEvidenceUnit(item.unit),
          message: `Link target '${link.target}' resolves to multiple canonical subject notes. Choose a scoped target by editing the draft link before accepting it.`,
          details: {
            linkTarget: link.target,
            linkRelation: link.relation,
            candidateTargetNoteIds,
          },
        });
        return link;
      }
      const match =
        link.relation === "affects_character"
          ? matchLegacyCharacter(index, stripNotePrefix(normalizeSubjectIdentifier(link.target, "")))
          : link.relation === "affects_relationship"
            ? matchRelationship(index, stripNotePrefix(normalizeSubjectIdentifier(link.target, "")))
            : null;
      const bucket = link.relation === "affects_character" ? "character_fact" : "relationship_state";
      const conflict =
        match?.status === "matched"
          ? identityTargetConflict(catalog.notes, legacyBindings, unresolvedBySubject, match.entries, bucket)
          : null;
      if (conflict) {
        diagnostics.push({
          severity: "warning",
          code: "ambiguous_subject_link_target",
          candidateIndex: item.candidateIndex,
          mutationId: item.unit.id,
          noteId: noteIdForEvidenceUnit(item.unit),
          message: `Link target '${link.target}' matches unresolved identity notes. Choose a scoped target by editing the draft link before accepting it.`,
          details: {
            linkTarget: link.target,
            linkRelation: link.relation,
            candidateTargetNoteIds: conflict.competingRecords.map((record) => record.key),
          },
        });
        return link;
      }
      const target = resolveIdentityLinkTarget(link.target, link.relation, index, catalog, legacyBindings);
      if (target?.note) targetNotes.set(target.note.id, target.note);
      if (target) return { ...link, target: target.noteId };
      return link;
    }),
  }));

  return {
    units: normalizedUnits,
    existingNotes: Array.from(targetNotes.values()).sort((left, right) => left.id.localeCompare(right.id)),
    diagnostics,
    droppedCandidates,
    legacyBindings,
    aliasChoices,
    skippedUnits,
  };
}

function preResolveBatchSubjectNames({
  units,
  index,
  scope,
  mode,
  sourceText,
  sourceTitle,
  savedMatches,
  skippedNames,
}: {
  units: LtmEvidenceUnit[];
  index: CatalogIndex;
  scope?: LtmScope;
  mode?: LtmMode;
  sourceText?: string;
  sourceTitle?: string;
  savedMatches: Map<string, SubjectMatch>;
  skippedNames: Set<string>;
}): BatchSubjectNameResolution {
  const matches = new Map<string, SubjectMatch>();
  const provisionalKeys = new Set<string>();
  const names = uniqueStrings(
    units.flatMap((unit) => {
      if (unit.bucket !== "character_fact" && unit.bucket !== "relationship_state") return [];
      const expected = unit.bucket === "character_fact" ? 1 : 2;
      return unit.subjectKeys === undefined && unit.subjectNames?.length === expected ? unit.subjectNames : [];
    }),
  );
  const admissibleUnknownNames: string[] = [];
  const familyId = (mode === undefined || mode === "roleplay") && scope ? ltmScopeFamilyId(scope) : null;

  for (const name of names) {
    const normalizedName = normalizeSubjectName(name);
    const saved = savedMatches.get(normalizedName);
    if (saved) {
      matches.set(name, saved);
      continue;
    }
    if (familyId && index.ambiguousLocalNames.has(`${familyId}\u0000${normalizedName}`)) {
      matches.set(name, localAmbiguousMatch(index, familyId, normalizedName));
      continue;
    }
    const direct = matchDirectName(index, name);
    const sourceVisible = isSourceBackedProperName(name, [sourceText, sourceTitle]);
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

  // Names related to a trusted catalog entry must canonicalize to that entry
  // instead of forking a provisional local-character identity from the surface
  // form. Ambiguous relations fail closed with the competing identities.
  const trustedRelationMatches = new Map<string, SubjectMatch>();
  for (const name of admissibleUnknownNames) {
    const relation = matchTrustedNameRelation(index, name, familyId);
    // A local binding waits until this batch's longer names exist, which can make it ambiguous.
    if (!relation || relation.basis === "local_name_relation") continue;
    matches.set(name, relation);
    trustedRelationMatches.set(name, relation);
  }

  const canonicalNames = uniqueStrings(admissibleUnknownNames.filter((name) => !trustedRelationMatches.has(name))).sort(
    (left, right) =>
      nameTokenCount(right) - nameTokenCount(left) || right.length - left.length || left.localeCompare(right),
  );
  const canonicalNamesBySlug = new Map<string, string[]>();
  for (const name of canonicalNames) {
    const slug = normalizeSubjectName(name);
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
    // Longest names come first, so a shorter form new in this batch relates to the full name
    // made just before it instead of forking its own character.
    const relation = matchTrustedNameRelation(index, name, familyId);
    if (relation) {
      matches.set(name, relation);
      trustedRelationMatches.set(name, relation);
      continue;
    }
    const key = subject.key;
    const existing = index.byKey.get(key);
    if (existing) continue;
    const entry: TrustedLtmSubjectCatalogEntry = {
      subject,
      name,
      aliases: [],
      canonicalSlug: slug,
      // A local subject exists only when scope is set.
      ...(ltmScopeFamilyId(scope!) ? { familyId: ltmScopeFamilyId(scope!)! } : {}),
    };
    addCatalogEntry(index, entry);
    provisionalKeys.add(key);
  }

  // Two unrelated names reaching one character ("Preston Farraday" and "Preston Hale" to a saved
  // "Preston") are different people, so neither binds.
  const localRelations = [...trustedRelationMatches].flatMap(([name, relation]) =>
    relation.status === "matched" && relation.basis === "local_name_relation"
      ? [{ name, entry: relation.entries[0]! }]
      : [],
  );
  for (const { name, entry } of localRelations) {
    if (
      localRelations.some(
        (other) =>
          other.entry.subject.key === entry.subject.key && other.name !== name && !nameTokensRelated(name, other.name),
      )
    ) {
      matches.set(name, partialNameReview(name, [entry], true));
    }
  }

  for (const name of admissibleUnknownNames) {
    if (trustedRelationMatches.has(name)) continue;
    matches.set(name, matchDirect(index, normalizeSubjectName(name)));
  }

  return { matches, provisionalKeys, aliasChoices: new Map(), savedMatches, skippedNames };
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
  const saved = batch.savedMatches.get(normalizeSubjectName(name));
  if (saved) return saved;
  const cached = batch.matches.get(name);
  if (cached) return cached;
  const normalizedName = normalizeSubjectName(name);
  const choice = batch.aliasChoices.get(normalizedName);
  if (choice) return { status: "matched", entries: [choice], basis: "trusted_key" };
  const familyId =
    (context?.mode === undefined || context?.mode === "roleplay") && context?.scope
      ? ltmScopeFamilyId(context.scope)
      : null;
  if (familyId && index.ambiguousLocalNames.has(`${familyId}\u0000${normalizedName}`)) {
    const match = localAmbiguousMatch(index, familyId, normalizedName);
    batch.matches.set(name, match);
    return match;
  }
  const direct = matchDirectName(index, name);
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
        aliases: [],
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
    const choice = batch.aliasChoices.get(normalizeSubjectName(trimmed));
    if (choice) return { status: "matched", entries: [choice], basis: "trusted_key" } as SubjectMatch;
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
      ...(ambiguous.some((match) => match.basis === "partial_name_requires_review") && index && context
        ? { identityReview: namedSubjectIdentityReview(unit, batch, index, context) }
        : {}),
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
      : matched.some((match) => match.basis === "local_name_relation")
        ? "local_name_relation"
        : matched.some((match) => match.basis === "unique_alias")
          ? "unique_alias"
          : "exact_name",
  };
}

function namedSubjectIdentityReview(
  unit: LtmSubjectIdentityCandidate,
  batch: BatchSubjectNameResolution,
  index: CatalogIndex,
  context: Pick<
    PreparedLtmSubjectIdentityContext,
    "scope" | "mode" | "sourceBackedNpcSourceText" | "sourceBackedNpcSourceTitle"
  >,
): LtmSubjectIdentityReview[] {
  return (unit.subjectNames ?? []).map((name) => {
    const choice = batch.aliasChoices.get(normalizeSubjectName(name));
    const match: SubjectMatch = choice
      ? { status: "matched", entries: [choice], basis: "trusted_key" }
      : resolveAndCacheSubjectName(batch, index, context, name);
    const entries =
      match.status === "matched"
        ? match.entries
        : match.status === "ambiguous"
          ? match.keys.flatMap((key) => (index.byKey.has(key) ? [index.byKey.get(key)!] : []))
          : [];
    return {
      name,
      candidates: entries.slice(0, 10).map((entry) => ({ name: entry.name, subject: entry.subject })),
      allowDifferent: Boolean(
        (context.mode === undefined || context.mode === "roleplay") &&
        context.scope &&
        ltmScopeFamilyId(context.scope) &&
        isSourceBackedProperName(name, [context.sourceBackedNpcSourceText, context.sourceBackedNpcSourceTitle]),
      ),
      ...(match.status === "matched" ? { matchedSubjectKey: match.entries[0]!.subject.key } : {}),
    };
  });
}

function sourceBackedNpcSubject(
  unit: LtmSubjectIdentityCandidate,
  index: CatalogIndex | undefined,
  scope: LtmScope | undefined,
  mode: LtmMode | undefined,
  sourceText: string | undefined,
  sourceTitle: string | undefined,
): { entry: TrustedLtmSubjectCatalogEntry } | { ambiguous: Extract<SubjectMatch, { status: "ambiguous" }> } | null {
  if (mode !== undefined && mode !== "roleplay") return null;
  if (unit.bucket !== "character_fact" || unit.subjectKeys !== undefined) return null;
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
      aliases: [],
      canonicalSlug: slug,
      ...(familyId ? { familyId } : {}),
    },
  };
}

function resolveUnitSubjects(unit: LtmSubjectIdentityCandidate, index: CatalogIndex): SubjectMatch {
  const expected = unit.bucket === "character_fact" ? 1 : 2;
  const subjectKeys = unit.subjectKeys ?? [];
  if (unit.subjectKeys !== undefined) {
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
    if (note.type !== type || note.status === "archived") return false;
    return subjectsEqual(note.subjects ?? legacyBindings.get(note.id), subjects);
  });
  if (candidates.length > 1) return undefined;
  return candidates.sort((left, right) => {
    const leftExact = isExactIdentityNote(left, entries, canonicalId) ? 0 : 1;
    const rightExact = isExactIdentityNote(right, entries, canonicalId) ? 0 : 1;
    return leftExact - rightExact || compareNoteAge(left, right);
  })[0];
}

function identityTargetConflict(
  notes: LtmNote[],
  bindings: Map<string, LtmSubject[]>,
  unresolved: Map<string, string[]>,
  entries: TrustedLtmSubjectCatalogEntry[],
  bucket: LtmEvidenceUnit["bucket"],
): (Extract<SubjectMatch, { status: "ambiguous" }> & { competingRecords: CompetingSubjectRecord[] }) | null {
  const subjects = sortSubjects(entries.map((entry) => entry.subject));
  const type = bucket === "character_fact" ? "character" : "relationship";
  const unresolvedIds = uniqueStrings(
    [unresolved.get(`${type}\0${subjects.map((subject) => subject.key).join("\u0000")}`) ?? []].flat(),
  );
  const ids = uniqueStrings([
    ...unresolvedIds,
    ...notes
      .filter(
        (note) =>
          note.status !== "archived" &&
          note.type === type &&
          subjectsEqual(note.subjects ?? bindings.get(note.id), subjects),
      )
      .map((note) => note.id),
  ]);
  if (ids.length < 2 && unresolvedIds.length === 0) return null;
  return {
    status: "ambiguous",
    basis: "legacy_note_conflict",
    keys: subjects.map((subject) => subject.key),
    competingRecords: ids.map((id) => ({ key: id, name: id, canonicalSlug: id, provenance: `note:${id}` })),
  };
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
  if (identityTargetCandidates(catalog.notes, legacyBindings, match.entries, bucket).length > 1) return null;
  const note = chooseIdentityTarget(catalog.notes, legacyBindings, match.entries, bucket);
  return { noteId: note?.id ?? canonicalNoteIdForEntries(match.entries, bucket), note };
}

function identityTargetCandidates(
  notes: LtmNote[],
  legacyBindings: Map<string, LtmSubject[]>,
  entries: TrustedLtmSubjectCatalogEntry[],
  bucket: LtmEvidenceUnit["bucket"],
) {
  const type = bucket === "character_fact" ? "character" : "relationship";
  const subjects = sortSubjects(entries.map((entry) => entry.subject));
  return notes.filter(
    (note) =>
      note.type === type &&
      note.status !== "archived" &&
      subjectsEqual(note.subjects ?? legacyBindings.get(note.id), subjects),
  );
}

function subjectIdForTarget(noteId: string, bucket: LtmEvidenceUnit["bucket"]) {
  return unprefixedSubjectId(bucket === "character_fact" ? "char" : "rel", noteId);
}

function subjectRejection(unit: LtmEvidenceUnit, match: Exclude<SubjectMatch, { status: "matched" }>, index: number) {
  const noteId = noteIdForEvidenceUnit(unit);
  const isCompositeCharacter = unit.bucket === "character_fact" && match.status === "cardinality" && match.count > 1;
  const isAmbiguous = match.status === "ambiguous";
  const isSuggestion = isAmbiguous && match.basis === "spelling_variation";
  const isPartialName = isAmbiguous && match.basis === "partial_name_requires_review";
  const code = isCompositeCharacter
    ? "composite_character_subject"
    : isAmbiguous && !isSuggestion
      ? "ambiguous_subject_identity"
      : match.status === "cardinality"
        ? "invalid_subject_cardinality"
        : "untrusted_subject_identity";
  const reason: LtmExtractionDroppedCandidate["reason"] =
    isAmbiguous && !isSuggestion
      ? "ambiguous_subject"
      : isSuggestion || match.status === "untrusted"
        ? "untrusted_subject"
        : "invalid_subject_cardinality";
  const message = isCompositeCharacter
    ? "Dropped a character fact that combined multiple character subjects."
    : isPartialName
      ? "Dropped a candidate whose short subject name needs an explicit identity choice."
      : isSuggestion
        ? "Dropped a fuzzy subject match that needs an explicit identity choice."
        : isAmbiguous
          ? "Dropped a candidate whose subject matches more than one trusted roster identity."
          : match.status === "cardinality"
            ? `Dropped a ${unit.bucket} candidate with ${match.count} resolved subjects.`
            : "Dropped a candidate whose subject is not in the trusted chat roster or bound memories.";
  return {
    diagnostic: {
      severity: isPartialName ? ("warning" as const) : ("error" as const),
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
      ...(isAmbiguous && match.identityReview ? { identityReview: match.identityReview } : {}),
      recoveryCandidate: recoveryCandidateForUnit(
        !unit.subjectNames?.length && isAmbiguous && match.identityReview
          ? { ...unit, subjectNames: match.identityReview.map((participant) => participant.name) }
          : unit,
      ),
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
