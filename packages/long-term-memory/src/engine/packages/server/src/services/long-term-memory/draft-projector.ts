import {
  ltmNoteSchema,
  type LtmConflict,
  type LtmDraftMutation,
  type LtmDraftSource,
  type LtmLink,
  type LtmMode,
  type LtmNote,
  type LtmScope,
  type LtmSection,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { getLtmScopeChatIds, withMergedLtmScopeLinks } from "../../../../shared/src/features/agents/long-term-memory/scope.js";
import { uniqueLinks } from "../../../../shared/src/features/agents/long-term-memory/utils.js";
import { stableStringify } from "./chunking.js";
import { uniqueStrings } from "./ltm-utils.js";
import { canUpdateLtmScopedTarget } from "./scoped-targets.js";
import { subjectsEqual } from "./subject-identity.js";
import { LtmServiceError } from "./service-error.js";
import {
  renderSectionContributions,
  sectionContributions,
  sourceContribution,
} from "./section-contributions.js";

export type LtmMutationDisposition = "new" | "merge" | "rewrite";
export type LtmDraftProjectionContext = { source: LtmDraftSource; scope: LtmScope; modes: LtmMode[] };
export type LtmProjectedChange = { kind: "section" | "link" | "keywords" | "status" | "subjects"; key: string; before?: string; after: string };
export type LtmMutationProjection = { mutationId: string; noteId: string; disposition: LtmMutationDisposition; changes: LtmProjectedChange[] };
export type LtmProjectedNoteMutationGroup = { noteId: string; before: LtmNote | null; after: LtmNote; changed: boolean; mutations: LtmMutationProjection[] };

export class LtmDraftProjectionError extends LtmServiceError {
  constructor(message: string, readonly code: string) {
    super(message, 409, code);
    this.name = "LtmDraftProjectionError";
  }
}

export function noteIdForLtmDraftMutation(mutation: LtmDraftMutation) {
  return mutation.kind === "create_note" ? mutation.note.id : mutation.noteId;
}

export function groupLtmDraftMutationsByNote(mutations: LtmDraftMutation[]) {
  const groups = new Map<string, LtmDraftMutation[]>();
  for (const mutation of mutations) {
    const id = noteIdForLtmDraftMutation(mutation);
    groups.set(id, [...(groups.get(id) ?? []), mutation]);
  }
  return [...groups.entries()].map(([noteId, group]) => ({
    noteId,
    mutations: [...group.filter((item) => item.kind === "create_note"), ...group.filter((item) => item.kind !== "create_note")],
  }));
}

export function projectLtmDraftMutationGroup(options: { existing: LtmNote | null; mutations: LtmDraftMutation[]; context: LtmDraftProjectionContext; timestamp: string }): LtmProjectedNoteMutationGroup {
  if (!options.mutations.length) throw new LtmDraftProjectionError("Cannot project an empty mutation group.", "empty_mutation_group");
  const noteId = noteIdForLtmDraftMutation(options.mutations[0]!);
  if (options.mutations.some((mutation) => noteIdForLtmDraftMutation(mutation) !== noteId)) {
    throw new LtmDraftProjectionError("A projected mutation group must target one note.", "mixed_mutation_targets");
  }
  let working = options.existing ? structuredClone(options.existing) : null;
  const projections: LtmMutationProjection[] = [];
  for (const mutation of options.mutations) {
    const before = working;
    working = projectMutation(before, mutation, options.context, options.timestamp);
    projections.push({ mutationId: mutation.id, noteId, disposition: dispositionForMutation(before, mutation), changes: changesForMutation(before, working, mutation) });
  }
  if (!working) throw new LtmDraftProjectionError(`Long-term memory mutation target not found: ${noteId}`, "missing_target");
  working = { ...working, links: withSourceLink(noteId, working.links, options.context.source.sourceNoteId) };
  const changed = !options.existing || stableStringify(semanticNote(options.existing)) !== stableStringify(semanticNote(working));
  if (!changed && options.existing) return { noteId, before: options.existing, after: options.existing, changed: false, mutations: projections };
  try {
    const after = ltmNoteSchema.parse(options.existing ? { ...working, id: options.existing.id, type: options.existing.type, createdAt: options.existing.createdAt, updatedAt: options.timestamp, version: options.existing.version + 1 } : working);
    return { noteId, before: options.existing, after, changed: true, mutations: projections };
  } catch (error) {
    throw new LtmDraftProjectionError(`Long-term memory projection for ${noteId} exceeds its storage contract: ${error instanceof Error ? error.message : "validation failed"}`, "projection_limit_exceeded");
  }
}

export function projectLtmDraftOntoNotes(options: { notes: ReadonlyMap<string, LtmNote>; mutations: LtmDraftMutation[]; context: LtmDraftProjectionContext; timestamp: string }) {
  const notes = new Map(options.notes);
  const projections: LtmProjectedNoteMutationGroup[] = [];
  for (const group of groupLtmDraftMutationsByNote(options.mutations)) {
    const projection = projectLtmDraftMutationGroup({ ...options, existing: notes.get(group.noteId) ?? null, mutations: group.mutations });
    notes.set(group.noteId, projection.after);
    projections.push(projection);
  }
  return { notes, projections };
}

export function isAdditiveLtmSection(note: Pick<LtmNote, "type" | "tags">, key: string) {
  if (note.type === "timeline_event") return true;
  if (note.type === "character") return !["items", "progression"].includes(key);
  if (note.type === "relationship" && key === "history") return true;
  if (note.type === "world") return true;
  if (note.type === "tone" && key === "observations") return true;
  return note.tags.includes("anchor") || key === "anchors";
}

function projectMutation(current: LtmNote | null, mutation: LtmDraftMutation, context: LtmDraftProjectionContext, timestamp: string): LtmNote {
  if (mutation.kind === "create_note") {
    if (!canUpdateLtmScopedTarget(mutation.note.scope, context.scope)) throw new LtmDraftProjectionError(`Long-term memory draft cannot create ${mutation.note.id} because its scope does not match the draft.`, "scope_mismatch");
    const sections = Object.fromEntries(
      Object.entries(mutation.note.sections).map(([key, section]) => [
        key,
        renderSectionContributions([sourceContribution({
          ...section,
          evidence: uniqueStrings([...mutation.evidence, ...(section.evidence ?? [])]).slice(0, 100),
        }, context.source)], isAdditiveLtmSection(mutation.note, key))!,
      ]),
    );
    const incoming = ltmNoteSchema.parse({ ...mutation.note, sections, createdAt: mutation.note.createdAt ?? timestamp, updatedAt: mutation.note.updatedAt ?? timestamp, version: mutation.note.version ?? 1 });
    if (!current) return incoming;
    assertCompatibleCreate(current, incoming);
    const mergedSections = { ...current.sections };
    for (const [key, section] of Object.entries(incoming.sections)) mergedSections[key] = mergeSection(current.sections[key], section, isAdditiveLtmSection(current, key), mutation.confidence, timestamp, context.source);
    return { ...current, title: current.title ?? incoming.title, status: current.status === "archived" ? current.status : incoming.status, modes: uniqueStrings([...current.modes, ...incoming.modes]) as LtmMode[], scope: mergeScopes(current.scope, incoming.scope), tags: uniqueStrings([...current.tags, ...incoming.tags]), keywords: uniqueCaseInsensitive([...current.keywords, ...incoming.keywords]), links: uniqueLinks([...current.links, ...incoming.links]), sections: mergedSections, conflicts: optionalConflicts(uniqueConflicts([...(current.conflicts ?? []), ...(incoming.conflicts ?? [])])), subjects: current.subjects ?? incoming.subjects };
  }
  if (!current) throw new LtmDraftProjectionError(`Long-term memory mutation target not found: ${mutation.noteId}`, "missing_target");
  if (!canUpdateLtmScopedTarget(current.scope, context.scope)) throw new LtmDraftProjectionError(`Long-term memory draft cannot mutate ${current.id} because it belongs to another scope.`, "scope_mismatch");
  if (mutation.kind === "append_section") {
    const section: LtmSection = { text: mutation.text, updatedAt: timestamp, salience: mutation.salience, confidence: mutation.confidence, importance: mutation.importance, dimensions: mutation.dimensions, dimensionChanges: mutation.dimensionChanges, evidence: mutation.evidence };
    return { ...current, sections: { ...current.sections, [mutation.sectionKey]: mergeSection(current.sections[mutation.sectionKey], section, isAdditiveLtmSection(current, mutation.sectionKey), mutation.confidence, timestamp, context.source) } };
  }
  if (mutation.kind === "update_section") return { ...current, sections: { ...current.sections, [mutation.sectionKey]: mergeSection(current.sections[mutation.sectionKey], { ...mutation.section, evidence: uniqueStrings([...(mutation.section.evidence ?? []), ...mutation.evidence]) }, isAdditiveLtmSection(current, mutation.sectionKey), mutation.confidence, timestamp, context.source) } };
  if (mutation.kind === "add_link") return { ...current, links: uniqueLinks([...current.links, mutation.link]) };
  if (mutation.kind === "set_keywords") return { ...current, keywords: uniqueCaseInsensitive([...current.keywords, ...mutation.keywords]) };
  if (mutation.kind === "set_status") return { ...current, status: mutation.status };
  if (current.type !== "character" && current.type !== "relationship") throw new LtmDraftProjectionError(`Long-term memory subjects cannot be assigned to ${current.type} note ${current.id}.`, "invalid_subject_target");
  if (current.subjects && !subjectsEqual(current.subjects, mutation.subjects)) throw new LtmDraftProjectionError(`Long-term memory subject identity is already bound for ${current.id}.`, "subject_identity_mismatch");
  return { ...current, subjects: current.subjects ?? mutation.subjects };
}

function assertCompatibleCreate(existing: LtmNote, incoming: LtmNote) {
  if (existing.type !== incoming.type) throw new LtmDraftProjectionError(`Long-term memory draft cannot merge ${incoming.type} note ${incoming.id} into ${existing.type}.`, "note_type_mismatch");
  if (!canUpdateLtmScopedTarget(existing.scope, incoming.scope)) throw new LtmDraftProjectionError(`Long-term memory draft cannot merge scoped create ${incoming.id} into an existing note from another scope.`, "scope_mismatch");
  if (existing.subjects && incoming.subjects && !subjectsEqual(existing.subjects, incoming.subjects)) throw new LtmDraftProjectionError(`Long-term memory draft cannot merge a different subject identity into ${existing.id}.`, "subject_identity_mismatch");
}

function mergeSection(existing: LtmSection | undefined, incoming: LtmSection, additive: boolean, confidence: number, timestamp: string, source: LtmDraftSource): LtmSection {
  if (!source.sourceNoteId || !source.sourceHash)
    throw new Error("Source-backed sections require source identity and hash.");
  const existingContributions = existing ? sectionContributions(existing) : [];
  const sameExtraction = existingContributions.filter(
    (item) =>
      item.owner === "source" &&
      item.sourceNoteId === source.sourceNoteId &&
      item.sourceHash === source.sourceHash,
  );
  const sourceSection = sameExtraction.length
    ? {
        ...incoming,
        text: additive
          ? mergeNormalizedSectionLines(
              sameExtraction.map((item) => item.text).join("\n\n"),
              incoming.text,
            )
          : incoming.text,
        evidence: uniqueStrings([
          ...sameExtraction.flatMap((item) => item.evidence ?? []),
          ...(incoming.evidence ?? []),
        ]),
      }
    : incoming;
  const contribution = sourceContribution(
    { ...sourceSection, confidence: Math.max(sourceSection.confidence ?? 0, confidence), updatedAt: timestamp },
    source,
  );
  const contributions = [
    ...existingContributions.filter(
      (item) =>
        item.owner !== "source" || item.sourceNoteId !== source.sourceNoteId,
    ),
    contribution,
  ];
  if (contributions.length > 100) throw new LtmDraftProjectionError("A projected section exceeds the 100-contribution limit.", "projection_limit_exceeded");
  const rendered = renderSectionContributions(contributions, additive)!;
  if (rendered.text.length > 20_000) throw new LtmDraftProjectionError("A projected section exceeds the 20,000-character text limit.", "projection_limit_exceeded");
  return rendered;
}

export function mergeNormalizedSectionLines(existing: string | undefined, incoming: string) {
  const original = existing?.trim() ?? "";
  const seen = new Set(lines(original).map(normalizedLine));
  const novel = lines(incoming).filter((line) => { const key = normalizedLine(line); if (!key || seen.has(key)) return false; seen.add(key); return true; });
  return !original ? novel.join("\n") : novel.length ? `${original}\n\n${novel.join("\n")}` : original;
}

function dispositionForMutation(current: LtmNote | null, mutation: LtmDraftMutation): LtmMutationDisposition {
  if (mutation.kind === "create_note") return current ? "merge" : "new";
  if (mutation.kind === "append_section" || mutation.kind === "update_section") return current && isAdditiveLtmSection(current, mutation.sectionKey) ? "merge" : "rewrite";
  return mutation.kind === "add_link" || mutation.kind === "set_keywords" ? "merge" : "rewrite";
}

function changesForMutation(before: LtmNote | null, after: LtmNote, mutation: LtmDraftMutation): LtmProjectedChange[] {
  if (mutation.kind === "append_section" || mutation.kind === "update_section") return sectionChange(before, after, mutation.sectionKey);
  if (mutation.kind === "add_link") return before?.links.some((link) => linksEqual(link, mutation.link)) ? [] : [{ kind: "link", key: `${mutation.link.relation}:${mutation.link.target}`, after: `${mutation.link.relation} ${mutation.link.target}${mutation.link.aspect ? ` (${mutation.link.aspect})` : ""}` }];
  if (mutation.kind === "set_keywords") return textChange("keywords", before?.keywords.join(", "), after.keywords.join(", "));
  if (mutation.kind === "set_status") return textChange("status", before?.status, after.status);
  if (mutation.kind === "set_subjects") return before?.subjects && subjectsEqual(before.subjects, after.subjects) ? [] : textChange("subjects", before?.subjects?.map((item) => item.key).join(", "), (after.subjects ?? mutation.subjects).map((item) => item.key).join(", "));
  const changes = Object.keys(mutation.note.sections).flatMap((key) => sectionChange(before, after, key));
  if (mutation.note.keywords.length) changes.push(...textChange("keywords", before?.keywords.join(", "), after.keywords.join(", ")));
  for (const link of mutation.note.links) if (!before?.links.some((item) => linksEqual(item, link))) changes.push({ kind: "link", key: `${link.relation}:${link.target}`, after: `${link.relation} ${link.target}${link.aspect ? ` (${link.aspect})` : ""}` });
  if (before && before.status !== after.status) changes.push(...textChange("status", before.status, after.status));
  if (mutation.note.subjects && !before?.subjects) changes.push(...textChange("subjects", undefined, mutation.note.subjects.map((item) => item.key).join(", ")));
  return changes;
}

function sectionChange(before: LtmNote | null, after: LtmNote, key: string): LtmProjectedChange[] { return textChange("section", before?.sections[key]?.text, after.sections[key]!.text, key); }
function textChange(kind: LtmProjectedChange["kind"], before: string | undefined, after: string, key = kind): LtmProjectedChange[] { return before === after ? [] : [{ kind, key, ...(before ? { before } : {}), after }]; }
function linksEqual(left: LtmLink, right: LtmLink) { return left.target === right.target && left.relation === right.relation && left.aspect === right.aspect; }
function withSourceLink(noteId: string, links: LtmLink[], sourceId: string | undefined) { return !sourceId || sourceId === noteId ? uniqueLinks(links) : uniqueLinks([...links, { target: sourceId, relation: "extracted_from" }]); }
function mergeScopes(existing: LtmScope, incoming: LtmScope) { return { ...withMergedLtmScopeLinks(existing, { chatIds: getLtmScopeChatIds(incoming), characterIds: incoming.characterIds ?? [] }), groupId: existing.groupId ?? incoming.groupId }; }
function uniqueCaseInsensitive(values: string[]) { const seen = new Set<string>(); return values.filter((value) => { const key = value.trim().toLocaleLowerCase(); if (!key || seen.has(key)) return false; seen.add(key); return true; }).map((value) => value.trim()); }
function uniqueConflicts(values: LtmConflict[]) { const seen = new Set<string>(); return values.filter((value) => { const key = stableStringify(value); if (seen.has(key)) return false; seen.add(key); return true; }); }
function optionalConflicts(values: LtmConflict[]) { return values.length ? values : undefined; }
function lines(text: string) { return text.split(/\r?\n/g).map((line) => line.trim()).filter(Boolean); }
function normalizedLine(line: string) { return line.trim().replace(/^[-*+]\s+/, "").replace(/\s+/g, " ").toLocaleLowerCase(); }
function semanticNote(note: LtmNote) { return { ...note, updatedAt: undefined, version: undefined, sections: Object.fromEntries(Object.entries(note.sections).map(([key, section]) => [key, { ...section, updatedAt: undefined }])) }; }
