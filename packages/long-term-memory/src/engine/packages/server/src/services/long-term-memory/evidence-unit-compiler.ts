import { randomUUID } from "node:crypto";
import type {
  LtmDraftMutation,
  LtmDraftRisk,
  LtmEvidenceUnit,
  LtmExtractionResponse,
  LtmMode,
  LtmNote,
  LtmNoteType,
  LtmScope,
  LtmSection,
  LtmStatus,
  LtmSubject,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { QUEST_THREAD_SECTION_KEYS } from "../../../../shared/src/features/agents/long-term-memory/constants.js";
import { isLtmSourceLikeNote } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { uniqueLinks } from "../../../../shared/src/features/agents/long-term-memory/utils.js";
import { mergeKeywords } from "./keyword-extract.js";
import {
  noteIdForEvidenceUnit,
  riskForEvidenceUnit,
} from "./evidence-unit-validation.js";
import { uniqueStrings } from "./ltm-utils.js";
import { subjectsEqual } from "./subject-identity.js";

export interface CompileLtmEvidenceUnitsOptions {
  units: LtmEvidenceUnit[];
  existingNotes: LtmNote[];
  scope: LtmScope;
  modes: LtmMode[];
  mode?: LtmMode;
  createdAt?: string;
  summary?: string;
}

type UnitTarget = {
  noteId: string;
  noteType: LtmNoteType;
  sectionKey: string;
  status: LtmStatus;
  tags: string[];
};

type LtmCompilerLifecycle =
  | "cumulative"
  | "superseding"
  | "rolling_until_resolved";

export function compileLtmEvidenceUnits(
  options: CompileLtmEvidenceUnitsOptions,
): LtmExtractionResponse {
  const timestamp = options.createdAt ?? new Date().toISOString();
  const existingById = new Map(
    options.existingNotes.map((note) => [note.id, note]),
  );
  const mutations: LtmDraftMutation[] = [];
  const unitsByNote = new Map<string, LtmEvidenceUnit[]>();

  for (const unit of options.units) {
    const noteId = noteIdForEvidenceUnit(unit);
    const group = unitsByNote.get(noteId) ?? [];
    group.push(unit);
    unitsByNote.set(noteId, group);
  }

  for (const [noteId, units] of unitsByNote) {
    const target = targetForUnit(units[0]!, options.mode);
    const existing = existingById.get(noteId);
    const sections = sectionsForUnits(units, existing, timestamp);
    const links = uniqueLinks(
      units
        .flatMap((unit) => unit.links)
        .filter((link) => link.target !== noteId),
    );
    const evidence = uniqueStrings(
      units.flatMap((unit) => unit.evidence),
    ).slice(0, 20);
    const claimKind = claimKindForUnits(units);
    const confidence = Math.min(...units.map((unit) => unit.confidence));
    const unitKeywords = mergeKeywords(
      units
        .flatMap((unit) => unit.keywords)
        .map((keyword) => keyword.trim())
        .filter(Boolean),
      [],
      30,
    );
    const resolvedSubjects = units.find((unit) => unit.subjects)?.subjects;
    const resolvedSubjectNames = units.find(
      (unit) => unit.subjectNames?.length,
    )?.subjectNames;
    const subjects =
      resolvedSubjects ?? subjectsForNewNote(target.noteType, noteId);

    if (!existing) {
      const note = {
        id: noteId,
        title: titleForUnits(units, target.noteType, resolvedSubjectNames),
        type: target.noteType,
        status: target.status,
        modes: options.modes,
        scope: options.scope,
        tags: target.tags,
        keywords: unitKeywords,
        links,
        sections,
        ...(subjects ? { subjects } : {}),
      };
      mutations.push({
        id: randomUUID(),
        claimKind,
        kind: "create_note",
        risk: riskForCompiledMutation({
          units,
          confidence,
          note,
          creating: true,
        }),
        confidence,
        summary: `Create ${target.noteType} memory ${noteId}`,
        evidence,
        note,
      });
      continue;
    }

    if (resolvedSubjects && !existing.subjects) {
      mutations.push({
        id: randomUUID(),
        claimKind,
        kind: "set_subjects",
        risk: "low",
        confidence,
        summary: `Bind ${noteId} to canonical subjects`,
        evidence,
        noteId,
        subjects: resolvedSubjects,
      });
    } else if (
      resolvedSubjects &&
      existing.subjects &&
      !subjectsEqual(existing.subjects, resolvedSubjects)
    ) {
      throw new Error(
        `Long-term memory subject identity mismatch for ${noteId}.`,
      );
    }

    for (const [sectionKey, section] of Object.entries(sections)) {
      const lifecycle = lifecycleForSection(units, sectionKey);
      if (shouldAppend(lifecycle, sectionKey, existing)) {
        const sectionUnits = unitsForSection(units, sectionKey);
        mutations.push({
          id: randomUUID(),
          claimKind: claimKindForUnits(sectionUnits),
          kind: "append_section",
          risk: riskForCompiledMutation({
            units: sectionUnits,
            confidence,
            note: existing,
            sourceBacked: Boolean(section.evidence?.length),
          }),
          confidence,
          summary: `Append ${noteId}.${sectionKey}`,
          evidence: uniqueStrings(
            sectionUnits.flatMap((unit) => unit.evidence),
          ).slice(0, 20),
          noteId,
          sectionKey,
          text: section.text,
          salience: section.salience,
          importance: section.importance,
          dimensions: section.dimensions,
          dimensionChanges: section.dimensionChanges,
        });
      } else {
        const sectionUnits = unitsForSection(units, sectionKey);
        mutations.push({
          id: randomUUID(),
          claimKind: claimKindForUnits(sectionUnits),
          kind: "update_section",
          risk: riskForCompiledMutation({
            units: sectionUnits,
            confidence,
            note: existing,
            sourceBacked: Boolean(section.evidence?.length),
          }),
          confidence,
          summary: `Update ${noteId}.${sectionKey}`,
          evidence: uniqueStrings(
            sectionUnits.flatMap((unit) => unit.evidence),
          ).slice(0, 20),
          noteId,
          sectionKey,
          section,
        });
      }
    }

    const mergedKeywords = mergeKeywords(existing.keywords, unitKeywords, 30);
    if (mergedKeywords.length > existing.keywords.length) {
      mutations.push({
        id: randomUUID(),
        claimKind,
        kind: "set_keywords",
        risk: riskForCompiledMutation({
          units,
          confidence,
          note: existing,
        }),
        confidence,
        summary: `Update ${noteId} keywords`,
        evidence,
        noteId,
        keywords: mergedKeywords,
      });
    }

    const nextStatus = statusForUnits(units);
    if (
      nextStatus !== existing.status &&
      shouldSetStatus(units, existing.status, nextStatus)
    ) {
      mutations.push({
        id: randomUUID(),
        claimKind,
        kind: "set_status",
        risk: riskForCompiledMutation({
          units,
          confidence,
          note: existing,
        }),
        confidence,
        summary: `Set ${noteId} status to ${nextStatus}`,
        evidence,
        noteId,
        status: nextStatus,
      });
    }

    for (const link of links) {
      if (
        !existing.links.some(
          (candidate) =>
            candidate.target === link.target &&
            candidate.relation === link.relation &&
            candidate.aspect === link.aspect,
        )
      ) {
        mutations.push({
          id: randomUUID(),
          claimKind: claimKindForUnits(
            units.filter((unit) =>
              unit.links.some(
                (candidate) =>
                  candidate.target === link.target &&
                  candidate.relation === link.relation &&
                  candidate.aspect === link.aspect,
              ),
            ),
          ),
          kind: "add_link",
          risk: riskForCompiledMutation({
            units,
            confidence,
            note: existing,
          }),
          confidence,
          summary: `Link ${noteId} to ${link.target}`,
          evidence,
          noteId,
          link,
        });
      }
    }
  }

  return {
    summary:
      options.summary ??
      `Compiled ${options.units.length} evidence unit(s) into ${mutations.length} draft mutation(s).`,
    mutations,
  };
}

function claimKindForUnits(units: LtmEvidenceUnit[]) {
  return units.some((unit) => unit.claimKind === "change")
    ? ("change" as const)
    : ("static" as const);
}

function subjectsForNewNote(
  noteType: LtmNoteType,
  noteId: string,
): LtmSubject[] | undefined {
  if (noteType !== "character" && noteType !== "relationship") return undefined;
  if (noteType === "character") return [{ key: `legacy:${noteId}` }];
  return [{ key: `legacy:${noteId}:1` }, { key: `legacy:${noteId}:2` }];
}

function targetForUnit(unit: LtmEvidenceUnit, mode?: LtmMode): UnitTarget {
  const noteId = noteIdForEvidenceUnit(unit);
  const isQuest =
    mode === "game" &&
    unit.bucket === "thread" &&
    (QUEST_THREAD_SECTION_KEYS as readonly string[]).includes(unit.sectionKey);
  const base = {
    noteId,
    sectionKey: unit.sectionKey,
    status: statusForUnit(unit),
  };
  if (unit.bucket.startsWith("relationship_")) {
    return {
      ...base,
      noteType: "relationship",
      tags: ["typed_memory", "relationship_memory"],
    };
  }
  if (unit.bucket === "timeline_event") {
    return {
      ...base,
      noteType: "timeline_event",
      tags: ["typed_memory", "timeline_event"],
    };
  }
  if (unit.bucket === "thread")
    return {
      ...base,
      noteType: "thread",
      tags: isQuest ? ["typed_memory", "quest"] : ["typed_memory"],
    };
  if (unit.bucket === "world_fact")
    return { ...base, noteType: "world", tags: ["typed_memory"] };
  if (unit.bucket === "tone")
    return { ...base, noteType: "tone", tags: ["typed_memory"] };
  if (unit.bucket === "anchor") {
    const noteType: LtmNoteType = noteId.startsWith("tone_") ? "tone" : "world";
    return { ...base, noteType, tags: ["typed_memory", "anchor"] };
  }
  return { ...base, noteType: "character", tags: ["typed_memory"] };
}

function statusForUnit(unit: LtmEvidenceUnit): LtmStatus {
  if (isResolvedLoopUnit(unit)) return "resolved";
  if (unit.bucket !== "thread" && unit.status === "resolved") return "active";
  if (unit.status === "resolved") return "resolved";
  return "active";
}

function sectionsForUnits(
  units: LtmEvidenceUnit[],
  existing: LtmNote | undefined,
  timestamp: string,
) {
  const sections: Record<string, LtmSection> = {};
  for (const unit of units) {
    const sectionKey = sectionKeyForUnit(unit);
    const existingSection = existing?.sections[sectionKey];
    const lifecycle = lifecycleForUnit(unit);
    const mergeIncoming = shouldMergeIncomingSectionUnits(
      unit,
      units,
      sectionKey,
    );
    const text =
      lifecycle === "cumulative" || mergeIncoming
        ? cumulativeLine(unit)
        : unit.text.trim();
    if (
      lifecycle === "cumulative" &&
      isDuplicateCumulativeLine(existingSection?.text, text)
    ) {
      continue;
    }
    const baseText = sections[sectionKey]?.text;
    sections[sectionKey] = {
      text: mergeSectionText(
        baseText,
        text,
        lifecycle === "cumulative" || mergeIncoming,
      ),
      updatedAt: timestamp,
      salience: Math.max(sections[sectionKey]?.salience ?? 0, unit.salience),
      confidence: Math.max(
        sections[sectionKey]?.confidence ?? 0,
        unit.confidence,
      ),
      importance: highestImportance(
        sections[sectionKey]?.importance,
        unit.importance,
      ),
      dimensions: unit.dimensions ?? sections[sectionKey]?.dimensions,
      dimensionChanges:
        unit.dimensionChanges ?? sections[sectionKey]?.dimensionChanges,
      evidence: uniqueStrings([
        ...(sections[sectionKey]?.evidence ?? []),
        ...(existingSection?.evidence ?? []),
        ...unit.evidence,
      ]).slice(0, 100),
    };
  }

  const toneUnits = units.filter((unit) => unit.bucket === "tone");
  if (toneUnits.length > 0) {
    const existingObservations = examplesFromSection(
      existing?.sections.observations?.text,
    );
    const incomingObservations = toneUnits
      .map((unit) => unit.text.trim())
      .filter(Boolean);
    const allObservations = [...existingObservations];
    const seenNormalized = new Set<string>(
      existingObservations.map(normalizeForComparison),
    );
    for (const obs of incomingObservations) {
      const key = normalizeForComparison(obs);
      if (!key || seenNormalized.has(key)) continue;
      seenNormalized.add(key);
      allObservations.push(obs);
    }
    const observations = allObservations.slice(-8);
    const evidence = uniqueStrings([
      ...(existing?.sections.profile?.evidence ?? []),
      ...(existing?.sections.observations?.evidence ?? []),
      ...toneUnits.flatMap((unit) => unit.evidence),
    ]).slice(0, 100);
    sections.observations = {
      text: observations.map((observation) => `- ${observation}`).join("\n"),
      updatedAt: timestamp,
      salience: Math.max(
        existing?.sections.observations?.salience ?? 0,
        ...toneUnits.map((unit) => unit.salience),
      ),
      confidence: Math.max(
        existing?.sections.observations?.confidence ?? 0,
        ...toneUnits.map((unit) => unit.confidence),
      ),
      evidence,
    };
    sections.profile = {
      text: deriveToneProfile(observations),
      updatedAt: timestamp,
      salience: Math.max(
        existing?.sections.profile?.salience ?? 0,
        ...toneUnits.map((unit) => unit.salience),
      ),
      confidence: Math.max(
        existing?.sections.profile?.confidence ?? 0,
        ...toneUnits.map((unit) => unit.confidence),
      ),
      evidence,
    };
  }

  return sections;
}

function sectionKeyForUnit(unit: LtmEvidenceUnit) {
  if (unit.bucket === "timeline_event") return unit.sectionKey || "event";
  if (unit.bucket === "relationship_state") return "state";
  if (unit.bucket === "character_fact") return unit.sectionKey || "facts";
  if (unit.bucket === "tone") return "observations";
  if (unit.bucket === "thread" && unit.status === "resolved") return "summary";
  return unit.sectionKey;
}

function shouldMergeIncomingSectionUnits(
  unit: LtmEvidenceUnit,
  units: LtmEvidenceUnit[],
  sectionKey: string,
) {
  if (unit.bucket !== "character_fact") return false;
  const matchingUnits = units.filter(
    (candidate) =>
      candidate.bucket === unit.bucket &&
      noteIdForEvidenceUnit(candidate) === noteIdForEvidenceUnit(unit) &&
      sectionKeyForUnit(candidate) === sectionKey,
  );
  return matchingUnits.length > 1;
}

const IMPORTANCE_RANK: Record<NonNullable<LtmSection["importance"]>, number> = {
  critical: 4,
  major: 3,
  moderate: 2,
  minor: 1,
};

function highestImportance(
  existing: LtmSection["importance"] | undefined,
  incoming: LtmSection["importance"] | undefined,
) {
  if (!incoming) return existing;
  if (!existing) return incoming;
  return IMPORTANCE_RANK[incoming] > IMPORTANCE_RANK[existing]
    ? incoming
    : existing;
}

function cumulativeLine(unit: LtmEvidenceUnit) {
  return `- ${unit.text.trim()}`;
}

function mergeSectionText(
  existing: string | undefined,
  incoming: string,
  append: boolean,
) {
  if (!existing?.trim()) return incoming.trim();
  if (!append) return incoming.trim();
  if (isDuplicateCumulativeLine(existing, incoming)) return existing.trim();
  return `${existing.trim()}\n${incoming.trim()}`;
}

function isDuplicateCumulativeLine(
  existing: string | undefined,
  incoming: string,
) {
  const normalizedIncoming = normalizeCumulativeLine(incoming);
  if (!normalizedIncoming) return false;
  return cumulativeLines(existing).some(
    (line) => normalizeCumulativeLine(line) === normalizedIncoming,
  );
}

function cumulativeLines(text: string | undefined) {
  if (!text?.trim()) return [];
  return text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeCumulativeLine(text: string) {
  return text
    .trim()
    .replace(/^[-*]\s*/, "")
    .replace(/\s+/g, " ")
    .replace(/[.。]+$/u, "")
    .toLowerCase();
}

function examplesFromSection(text: string | undefined) {
  if (!text?.trim()) return [];
  return text
    .split(/\r?\n+/)
    .map((line) => line.trim().replace(/^-\s*/, ""))
    .filter(Boolean);
}

function normalizeForComparison(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveToneProfile(observations: string[]) {
  const sample = observations.slice(-3).map(compactProfileFragment).join("; ");
  return sample
    ? `Tone profile: ${sample}.`
    : "Tone profile: keep the established tone consistent.";
}

function compactProfileFragment(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/^["']|["']$/g, "")
    .trim()
    .slice(0, 180);
}

function lifecycleForSection(
  units: LtmEvidenceUnit[],
  sectionKey: string,
): LtmCompilerLifecycle {
  const lifecycles = units
    .filter((unit) => sectionKeyForUnit(unit) === sectionKey)
    .map(lifecycleForUnit);
  if (lifecycles.includes("cumulative")) return "cumulative";
  if (lifecycles.includes("rolling_until_resolved"))
    return "rolling_until_resolved";
  return "superseding";
}

function shouldAppend(
  lifecycle: LtmCompilerLifecycle,
  sectionKey: string,
  existing: LtmNote,
) {
  if (!existing.sections[sectionKey]) return false;
  return lifecycle === "cumulative";
}

function statusForUnits(units: LtmEvidenceUnit[]) {
  if (units.some((unit) => unit.status === "archived")) return "archived";
  if (units.some(isResolvedLoopUnit)) return "resolved";
  return "active";
}

function lifecycleForUnit(unit: LtmEvidenceUnit): LtmCompilerLifecycle {
  if (unit.bucket === "thread") return "rolling_until_resolved";
  if (unit.bucket === "relationship_state") return "superseding";
  if (
    unit.bucket === "character_fact" &&
    ["items", "progression"].includes(unit.sectionKey)
  )
    return "superseding";
  return "cumulative";
}

function titleForUnits(
  units: LtmEvidenceUnit[],
  noteType: LtmNoteType,
  subjectNames?: string[],
) {
  if (noteType === "character" && subjectNames?.[0])
    return subjectNames[0].slice(0, 240);
  if (noteType === "relationship" && subjectNames?.length)
    return subjectNames.join(" and ").slice(0, 240);
  const extractedTitle = units
    .map((unit) => unit.title?.trim())
    .find((title) => title?.length);
  if (extractedTitle) return extractedTitle.slice(0, 240);
  return fallbackTitleForUnits(units, noteType);
}

function fallbackTitleForUnits(units: LtmEvidenceUnit[], noteType: LtmNoteType) {
  const unit = units[0]!;
  const subject = humanizeSubjectId(unit.subjectId);
  if (noteType === "timeline_event") return subject;
  if (noteType === "thread") {
    return unit.sectionKey === "summary"
      ? subject
      : `${subject}: ${humanizeSubjectId(unit.sectionKey)}`.slice(0, 240);
  }
  if (noteType === "tone") return `Tone: ${subject}`.slice(0, 240);
  return subject;
}

function humanizeSubjectId(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .slice(0, 240);
}

function shouldSetStatus(
  units: LtmEvidenceUnit[],
  existingStatus: LtmStatus,
  _nextStatus: LtmStatus,
) {
  if (existingStatus === "archived") return false;
  return true;
}

function isResolvedLoopUnit(unit: LtmEvidenceUnit) {
  return unit.bucket === "thread" && unit.status === "resolved";
}

function unitsForSection(units: LtmEvidenceUnit[], sectionKey: string) {
  return units.filter(
    (unit) =>
      sectionKeyForUnit(unit) === sectionKey ||
      (unit.bucket === "tone" && sectionKey === "profile"),
  );
}

function isTypedMemoryNote(note: Pick<LtmNote, "type" | "tags">) {
  return !isLtmSourceLikeNote(note) && note.type !== "scene";
}

function hasSourceEvidence(units: LtmEvidenceUnit[]) {
  return units.every((unit) =>
    unit.evidence.some((evidence) => evidence.startsWith("source_note:")),
  );
}

function riskForCompiledMutation({
  units,
  confidence,
  note,
  sourceBacked = true,
  creating = false,
}: {
  units: LtmEvidenceUnit[];
  confidence: number;
  note: Pick<LtmNote, "type" | "tags" | "conflicts" | "subjects">;
  sourceBacked?: boolean;
  creating?: boolean;
}): LtmDraftRisk {
  const baseRisk = maxRisk(units.map(riskForEvidenceUnit));
  if (baseRisk !== "low") return baseRisk;
  if (
    creating &&
    note.type === "character" &&
    note.subjects?.some(
      (subject) => subject.key.startsWith("npc:") && !subject.ref,
    )
  ) {
    return "medium";
  }
  if (confidence < 0.85) return "medium";
  if (!isTypedMemoryNote(note)) return "medium";
  if (note.conflicts?.length) return "medium";
  if (!sourceBacked || !hasSourceEvidence(units)) return "medium";
  return "low";
}

function maxRisk(risks: LtmDraftRisk[]): LtmDraftRisk {
  if (risks.includes("high")) return "high";
  if (risks.includes("medium")) return "medium";
  return "low";
}
