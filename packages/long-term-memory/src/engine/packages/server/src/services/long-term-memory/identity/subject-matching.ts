import { createHash } from "node:crypto";
import {
  type LtmEvidenceUnit,
  type LtmIdentityMatchBasis,
  type LtmNote,
  type LtmSubject,
  type LtmSubjectReference,
  type LtmSavedSubjectIdentityChoice,
  type LtmSubjectIdentityReview,
} from "../../../../../shared/src/features/agents/long-term-memory/index.js";
import { isLocalCharacterSubject } from "./chat-scope.js";
import { uniqueStrings, normalizeSubjectName } from "../ltm-utils.js";
import { damerauLevenshtein, isHangulParticle, nameTokensRelated, partialNameTokensMatch } from "./subject-names.js";

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
  identityChoices?: Array<LtmSavedSubjectIdentityChoice & { familyId: string }>;
};

export type CompetingSubjectRecord = {
  key: string;
  name: string;
  canonicalSlug: string;
  provenance?: string;
  sourceScope?: string;
  collisionKind?: "duplicate_local" | "group_catalog" | "alias_collision" | "mixed";
};

export type CatalogIndex = {
  entries: TrustedLtmSubjectCatalogEntry[];
  byKey: Map<string, TrustedLtmSubjectCatalogEntry>;
  byRef: Map<string, TrustedLtmSubjectCatalogEntry>;
  exact: Map<string, TrustedLtmSubjectCatalogEntry[]>;
  aliases: Map<string, TrustedLtmSubjectCatalogEntry[]>;
  tokens: string[];
  ambiguousLocalNames: ReadonlySet<string>;
  ambiguousLocalEntries: Map<string, TrustedLtmSubjectCatalogEntry[]>;
};

export type SubjectMatch =
  | { status: "matched"; entries: TrustedLtmSubjectCatalogEntry[]; basis: string }
  | {
      status: "ambiguous";
      keys: string[];
      basis: string;
      competingRecords?: CompetingSubjectRecord[];
      collisionSource?: "duplicate_local" | "group_catalog" | "alias_collision" | "mixed";
      identityReview?: LtmSubjectIdentityReview[];
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

export function localAmbiguousMatch(index: CatalogIndex, familyId: string, normalizedName: string): SubjectMatch {
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

export function isTrustedCharacterOrPersonaSubject(subject: LtmSubject | undefined) {
  if (!subject) return false;
  const kind = subject.ref?.kind;
  if (kind === "character" || kind === "persona") return true;
  if (kind) return false;
  return subject.key.startsWith("character:") || subject.key.startsWith("persona:");
}

export function partialNameCandidateEntries(index: CatalogIndex, name: string, familyId: string) {
  const token = normalizeSubjectName(name);
  return index.entries.filter(
    (entry) =>
      (!entry.familyId || entry.familyId === familyId) &&
      isTrustedCharacterOrPersonaSubject(entry.subject) &&
      normalizeSubjectName(entry.name) !== token &&
      !entry.aliases.some((alias) => normalizeSubjectName(alias) === token) &&
      partialNameTokensMatch(name, entry.name),
  );
}

// A returned Hangul name may carry its particle ("서무진은"). The full name always wins; the stripped
// stem binds only to a known exact name or alias and never creates a character.
export function matchDirectName(index: CatalogIndex, name: string): SubjectMatch {
  const direct = matchDirect(index, normalizeSubjectName(name));
  if (direct.status !== "untrusted") return direct;
  const value = name.trim().normalize("NFC");
  for (let length = 1; length <= 4 && value.length - length >= 2; length += 1) {
    if (!isHangulParticle(value.slice(0, -length), value.slice(-length))) continue;
    const token = normalizeSubjectName(value.slice(0, -length));
    if (index.exact.has(token) || index.aliases.has(token)) return matchDirect(index, token);
  }
  return direct;
}

// Canonicalize a surface name against trusted catalog entries related by the
// conservative shorter/longer name heuristic before any provisional local
// character is created. Exact names and explicit aliases bind; a short or partial
// form of one trusted character/persona is routed to review instead of binding by
// first name alone, and an ambiguous relation fails closed with the competing
// identities. Without a trusted relation, a name sharing whole name parts with exactly one of
// LTM's own characters in the same chat binds to it; several go to review.
export function matchTrustedNameRelation(
  index: CatalogIndex,
  name: string,
  familyId: string | null,
): SubjectMatch | null {
  const token = normalizeSubjectName(name);
  const isExactOrAlias = (entry: TrustedLtmSubjectCatalogEntry) =>
    normalizeSubjectName(entry.name) === token || entry.aliases.some((alias) => normalizeSubjectName(alias) === token);
  // No local family outside Roleplay: family-scoped local entries drop out, but trusted
  // character/persona partial names must still reach review.
  const related = index.entries.filter(
    (entry) =>
      (!entry.familyId || entry.familyId === familyId) &&
      (isExactOrAlias(entry) ||
        (isTrustedCharacterOrPersonaSubject(entry.subject) && partialNameTokensMatch(name, entry.name))),
  );
  const uniqueSubjects = new Map(related.map((entry) => [entry.subject.key, entry]));
  const allowDifferent = familyId !== null;
  if (uniqueSubjects.size === 1) {
    const entry = [...uniqueSubjects.values()][0]!;
    if (isExactOrAlias(entry)) return { status: "matched", entries: [entry], basis: "batch_name_alias" };
    return {
      status: "ambiguous",
      keys: [entry.subject.key],
      basis: "partial_name_requires_review",
      identityReview: [{ name, candidates: [{ name: entry.name, subject: entry.subject }], allowDifferent }],
      competingRecords: [
        {
          key: entry.subject.key,
          name: entry.name,
          canonicalSlug: entry.canonicalSlug,
          provenance: entry.provenance ?? entry.subject.key,
          sourceScope: entry.sourceScope,
        },
      ],
    };
  }
  if (uniqueSubjects.size > 1) return partialNameReview(name, [...uniqueSubjects.values()], allowDifferent);
  if (familyId === null) return null;
  const local = new Map(
    index.entries
      .filter(
        // Names seen in a source are its capitalized runs, not saved characters, and match exactly.
        (entry) =>
          entry.sourceScope !== "local_source" &&
          entry.familyId === familyId &&
          isLocalCharacterSubject(entry.subject) &&
          nameTokensRelated(name, entry.name),
      )
      .map((entry) => [entry.subject.key, entry]),
  );
  if (local.size === 0) return null;
  if (local.size === 1) return { status: "matched", entries: [...local.values()], basis: "local_name_relation" };
  return partialNameReview(name, [...local.values()], allowDifferent);
}

export function partialNameReview(
  name: string,
  competing: TrustedLtmSubjectCatalogEntry[],
  allowDifferent: boolean,
): SubjectMatch {
  const { collisionSource, competingRecords } = diagnoseCollision(competing, "partial_name");
  return {
    status: "ambiguous",
    keys: competing.map(subjectEntryKey),
    basis: "partial_name_requires_review",
    identityReview: [
      {
        name,
        candidates: competing.slice(0, 10).map((entry) => ({ name: entry.name, subject: entry.subject })),
        allowDifferent,
      },
    ],
    competingRecords,
    collisionSource,
  };
}

export function addCatalogEntry(index: CatalogIndex, entry: TrustedLtmSubjectCatalogEntry) {
  if (index.byKey.has(entry.subject.key)) return;
  index.entries.push(entry);
  index.byKey.set(entry.subject.key, entry);
  addIndexEntry(index.exact, normalizeSubjectName(entry.name), entry);
  for (const alias of entry.aliases) addIndexEntry(index.aliases, normalizeSubjectName(alias), entry);
  index.tokens = uniqueStrings([...index.tokens, normalizeSubjectName(entry.name), entry.canonicalSlug]).sort(
    (left, right) => right.length - left.length || left.localeCompare(right),
  );
}

export function entryIdentityTokens(entry: TrustedLtmSubjectCatalogEntry) {
  return uniqueStrings([
    normalizeSubjectName(entry.name),
    entry.canonicalSlug,
    ...entry.aliases.map((alias) => normalizeSubjectName(alias)),
  ]);
}

export function isDominatedUnboundNpcEntry(
  entry: TrustedLtmSubjectCatalogEntry,
  refBackedIdentityTokens: ReadonlySet<string>,
) {
  if (entry.subject.ref || !isLocalCharacterSubject(entry.subject)) return false;
  const primaryTokens = uniqueStrings([normalizeSubjectName(entry.name), entry.canonicalSlug]);
  return primaryTokens.some((token) => refBackedIdentityTokens.has(token));
}

export function buildCatalogIndex(catalog: TrustedLtmSubjectCatalog): CatalogIndex {
  const exact = new Map<string, TrustedLtmSubjectCatalogEntry[]>();
  const aliases = new Map<string, TrustedLtmSubjectCatalogEntry[]>();
  for (const entry of catalog.entries) {
    addIndexEntry(exact, normalizeSubjectName(entry.name), entry);
    for (const alias of entry.aliases) addIndexEntry(aliases, normalizeSubjectName(alias), entry);
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

export function matchDirect(index: CatalogIndex, token: string): SubjectMatch {
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
  if (aliases.length === 1) return { status: "matched", entries: aliases, basis: "unique_alias" };
  for (const [key, entries] of index.ambiguousLocalEntries) {
    if (!key.endsWith(`\u0000${token}`)) continue;
    const { collisionSource, competingRecords } = diagnoseCollision(entries, "local_family_duplicate");
    return {
      status: "ambiguous",
      keys: entries.map(subjectEntryKey),
      basis: "local_family_duplicate",
      competingRecords,
      collisionSource,
    };
  }
  const fuzzy = fuzzyMatches(index, token);
  if (fuzzy.length > 0) {
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

export function matchTraitPrefix(index: CatalogIndex, raw: string): SubjectMatch {
  for (const token of index.tokens) {
    if (!raw.startsWith(`${token}_`)) continue;
    const match = matchDirect(index, token);
    if (match.status === "matched") return { ...match, basis: "trait_or_qualified_alias" };
    if (match.status === "ambiguous") return match;
  }
  return { status: "untrusted", basis: "trait_or_qualified_alias" };
}

export function matchRelationship(index: CatalogIndex, raw: string): SubjectMatch {
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

export function segmentSubjectIdentifier(raw: string, index: CatalogIndex) {
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

export function matchLegacyCharacter(index: CatalogIndex, identifier: string) {
  const direct = matchDirect(index, identifier);
  return direct.status === "untrusted" ? matchTraitPrefix(index, identifier) : direct;
}

export function publicIdentityMatchBasis(basis: string): LtmIdentityMatchBasis {
  if (basis === "exact_name") return "exact_name";
  if (basis === "unique_alias") return "unique_alias";
  if (basis === "trait_or_qualified_alias") return "trait_or_qualified_alias";
  if (basis === "spelling_variation") return "spelling_variation";
  return "unordered_pair";
}

export function identityBasisPriority(basis: string) {
  if (basis === "exact_name") return 0;
  if (basis === "unique_alias") return 1;
  if (basis === "trait_or_qualified_alias") return 2;
  if (basis === "spelling_variation") return 3;
  return 4;
}

export function uniqueSubjectPairs(pairs: string[][]) {
  const unique = new Map<string, string[]>();
  for (const pair of pairs) {
    const sorted = [...pair].sort((left, right) => left.localeCompare(right));
    if (sorted.length) unique.set(sorted.join("\u0000"), sorted);
  }
  return [...unique.values()];
}

export function canonicalNoteIdForEntries(entries: TrustedLtmSubjectCatalogEntry[], bucket: LtmEvidenceUnit["bucket"]) {
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

export function sortSubjects(subjects: LtmSubject[]) {
  return [...subjects].sort((left, right) => left.key.localeCompare(right.key));
}

export function sortSubjectEntries(entries: TrustedLtmSubjectCatalogEntry[]) {
  return [...entries].sort((left, right) => left.subject.key.localeCompare(right.subject.key));
}

export function subjectEntryKey(entry: TrustedLtmSubjectCatalogEntry) {
  return entry.subject.key;
}

export function subjectRefKey(ref: LtmSubjectReference) {
  return `${ref.kind}\u0000${ref.id}`;
}

export function compareNoteAge(left: LtmNote, right: LtmNote) {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}
