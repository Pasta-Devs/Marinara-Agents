import {
  hasLtmSourceSummarySceneTag,
  isLtmSourceLikeNote,
  ltmDraftMutationSchema,
  type LtmDraftMutation,
  type LtmDraftPreflightResponse,
  type LtmExtractionDraft,
  type LtmNote,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { recordLtmDebugEvent, withLtmDebugOperation } from "./debug-log.js";
import {
  groupLtmDraftMutationsByNote,
  LtmDraftProjectionError,
  isAdditiveLtmSection,
  projectLtmDraftMutationGroup,
  projectLtmDraftOntoNotes,
} from "./draft-projector.js";
import { LongTermMemoryDraftStore } from "./draft-store.js";
import { nowIso } from "./ltm-utils.js";
import { logger } from "./package-runtime.js";
import { rebuildLongTermMemoryIndexes } from "./rebuild.js";
import { canUpdateLtmScopedTarget } from "./scoped-targets.js";
import { isLtmSourceExtractionFingerprintCurrent } from "./source-hash.js";
import { LongTermMemoryStorage } from "./storage.js";
import { LtmServiceError } from "./service-error.js";

export interface ApplyLtmDraftOptions {
  root?: string;
  actor?: string;
  rebuildIndexes?: boolean;
  autoApplyLowRiskOnly?: boolean;
  mutationIds?: string[];
  editedMutations?: Array<{ id: string } & Record<string, unknown>>;
  operationId?: string;
}
export interface ApplyLtmDraftResult {
  draft: LtmExtractionDraft;
  appliedMutationIds: string[];
  skippedMutationIds: string[];
  autoIncludedMutationIds: string[];
  indexRebuild: { status: "not_requested" } | { status: "succeeded" } | { status: "failed"; error: string };
}
export class LtmDraftApplyError extends LtmServiceError {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
  ) {
    super(message, statusCode, code);
    this.name = "LtmDraftApplyError";
  }
}

const DESTRUCTIVE_DISPOSITION_MESSAGE =
  "Rewrite and other destructive changes must be reviewed and applied one at a time.";

function applyEdits(mutations: LtmDraftMutation[], edits: NonNullable<ApplyLtmDraftOptions["editedMutations"]>) {
  const originals = new Map(mutations.map((mutation) => [mutation.id, mutation]));
  const edited = new Map<string, LtmDraftMutation>();
  for (const edit of edits) {
    const original = originals.get(edit.id);
    if (!original) throw new Error(`Long-term memory edited mutation not found: ${edit.id}`);
    if (edited.has(edit.id)) throw new Error(`Long-term memory edited mutation appears more than once: ${edit.id}`);
    if (edit.kind !== undefined && edit.kind !== original.kind)
      throw new Error(`Long-term memory edited mutation cannot change kind: ${edit.id}`);
    if (edit.claimKind !== undefined && edit.claimKind !== original.claimKind)
      throw new Error(`Long-term memory edited mutation cannot change claimKind: ${edit.id}`);
    const { id: _id, kind: _kind, claimKind: _claimKind, ...patch } = edit;
    const parsed = ltmDraftMutationSchema.safeParse({
      ...original,
      ...patch,
      id: original.id,
      kind: original.kind,
      claimKind: original.claimKind,
    });
    if (!parsed.success)
      throw new Error(
        `Long-term memory edited mutation is invalid (${edit.id}): ${parsed.error.issues[0]?.message ?? "schema validation failed"}`,
      );
    edited.set(edit.id, parsed.data);
  }
  return mutations.map((mutation) => edited.get(mutation.id) ?? mutation);
}

function mutationTargetId(mutation: LtmDraftMutation) {
  return mutation.kind === "create_note" ? mutation.note.id : mutation.noteId;
}

function fallbackDisposition(mutation: LtmDraftMutation, existing: ReadonlyMap<string, LtmNote>) {
  if (mutation.kind === "create_note") return existing.has(mutation.note.id) ? "merge" : "new";
  if (mutation.kind === "append_section" || mutation.kind === "update_section") {
    const note = existing.get(mutation.noteId);
    return note && isAdditiveLtmSection(note, mutation.sectionKey) ? "merge" : "rewrite";
  }
  return mutation.kind === "add_link" || mutation.kind === "set_keywords" ? "merge" : "rewrite";
}

async function assertFresh(storage: LongTermMemoryStorage, draft: LtmExtractionDraft) {
  const id = draft.source.sourceNoteId;
  const source = id ? await storage.getNote(id) : null;
  if (!source)
    throw new LtmDraftApplyError(
      `Long-term memory draft source note not found: ${id ?? "unknown"}`,
      409,
      "ltm_draft_source_missing",
    );
  if (!isLtmSourceLikeNote(source))
    throw new LtmDraftApplyError(
      `Long-term memory draft source is not a source note: ${source.id}`,
      409,
      "ltm_draft_source_invalid",
    );
  if (!draft.source.extractionFingerprint)
    throw new LtmDraftApplyError(
      "This long-term memory draft was created before context-bound extraction. Extract the source again before applying it.",
      409,
      "ltm_draft_source_context_unbound",
    );
  if (!isLtmSourceExtractionFingerprintCurrent(source, draft.source.extractionFingerprint))
    throw new LtmDraftApplyError(
      "The long-term memory draft source or extraction context changed. Extract it again before applying this draft.",
      409,
      "ltm_draft_source_stale",
    );
}

async function preflight(storage: LongTermMemoryStorage, draft: LtmExtractionDraft, mutations: LtmDraftMutation[]) {
  const createIds = new Set<string>();
  const required = new Set<string>();
  const links = new Set<string>();
  const sourceEvidence = `source_note:${draft.source.sourceNoteId}`;
  for (const mutation of mutations) {
    if (!mutation.evidence.includes(sourceEvidence))
      throw new Error(`Long-term memory draft mutation ${mutation.id} must reference ${sourceEvidence}.`);
    if (mutation.kind === "create_note") {
      if (isLtmSourceLikeNote(mutation.note) || mutation.note.type === "scene")
        throw new Error(
          `Long-term memory source extraction draft cannot create scene/source notes: ${mutation.note.id}`,
        );
      if (createIds.has(mutation.note.id))
        throw new Error(`Long-term memory draft creates the same note more than once: ${mutation.note.id}`);
      createIds.add(mutation.note.id);
      for (const link of mutation.note.links) links.add(link.target);
    } else {
      required.add(mutation.noteId);
      if (mutation.kind === "add_link") links.add(mutation.link.target);
    }
  }
  const ids = [...new Set([...links, ...required, ...createIds])];
  let existing = await storage.getNotesByIds(ids);
  const storedLinkTargets = [...required].flatMap((id) => existing.get(id)?.links.map((link) => link.target) ?? []);
  for (const target of storedLinkTargets) links.add(target);
  if (storedLinkTargets.length) {
    existing = new Map([...existing, ...(await storage.getNotesByIds(storedLinkTargets))]);
  }
  for (const id of links)
    if (!createIds.has(id) && !existing.has(id)) throw new Error(`Long-term memory draft link target not found: ${id}`);
  for (const id of required)
    if (!createIds.has(id)) {
      const note = existing.get(id);
      if (!note) throw new Error(`Long-term memory draft mutation target not found: ${id}`);
      if (isLtmSourceLikeNote(note) || note.type === "scene")
        throw new Error(`Long-term memory source extraction draft cannot mutate scene/source notes: ${id}`);
      if (!canUpdateLtmScopedTarget(note.scope, draft.scope))
        throw new Error(`Long-term memory draft cannot mutate ${id} because it belongs to another scope.`);
    }
  for (const mutation of mutations)
    if (mutation.kind === "create_note") {
      if (!canUpdateLtmScopedTarget(mutation.note.scope, draft.scope))
        throw new Error(
          `Long-term memory draft cannot create ${mutation.note.id} because its scope does not match the draft.`,
        );
      const note = existing.get(mutation.note.id);
      if (note && !canUpdateLtmScopedTarget(note.scope, mutation.note.scope))
        throw new Error(
          `Long-term memory draft cannot merge scoped create ${mutation.note.id} into an existing note from another scope.`,
        );
    }
  const pendingConflicts = mutations.flatMap((mutation) => {
    const note =
      mutation.kind === "create_note"
        ? (existing.get(mutation.note.id) ?? mutation.note)
        : existing.get(mutation.noteId);
    return (note?.conflicts ?? []).filter((conflict) => conflict.resolution === "pending");
  });
  if (pendingConflicts.length)
    throw new LtmDraftProjectionError(
      "This change has unresolved conflicts. Choose a resolution before applying it.",
      "unresolved_conflict",
    );
  const baseNotes = new Map(existing);
  const projected = projectLtmDraftOntoNotes({
    notes: baseNotes,
    mutations,
    context: { source: draft.source, scope: draft.scope, modes: draft.modes },
    timestamp: nowIso(),
  });
  const eventIds = new Set(
    [...projected.notes.values()].flatMap((note) =>
      note.type === "timeline_event" &&
      note.links.some((link) => link.relation === "extracted_from" && link.target === draft.source.sourceNoteId)
        ? [note.id]
        : [],
    ),
  );
  const affectedIds = new Set(
    mutations.map((mutation) => (mutation.kind === "create_note" ? mutation.note.id : mutation.noteId)),
  );
  const changedIds = new Set(
    mutations.flatMap((mutation) =>
      mutation.claimKind === "change" ? [mutation.kind === "create_note" ? mutation.note.id : mutation.noteId] : [],
    ),
  );
  for (const noteId of affectedIds) {
    const note = projected.notes.get(noteId);
    if (!note) continue;
    if (note.type === "timeline_event") {
      if (!eventIds.has(note.id))
        throw new LtmDraftProjectionError(
          `Timeline event ${note.id} must link to draft source ${draft.source.sourceNoteId}.`,
          "missing_timeline_grounding",
        );
    } else if (changedIds.has(noteId) && !note.links.some((link) => eventIds.has(link.target))) {
      throw new LtmDraftProjectionError(
        `Long-term memory ${note.id} must link to a timeline event grounded in the same source.`,
        "missing_timeline_grounding",
      );
    }
  }
  return projected;
}

export async function preflightLongTermMemoryDraft(
  id: string,
  options: {
    root?: string;
    mutationIds: string[];
    editedMutations?: Array<{ id: string } & Record<string, unknown>>;
    bulk?: boolean;
  },
): Promise<LtmDraftPreflightResponse> {
  const store = new LongTermMemoryDraftStore(options.root);
  const draft = await store.getDraft(id);
  if (!draft) throw new LtmDraftApplyError(`Long-term memory draft not found: ${id}`, 404, "ltm_draft_not_found");
  if (draft.status !== "pending")
    throw new LtmDraftApplyError(`Long-term memory draft is not pending: ${id}`, 409, "ltm_draft_not_pending");
  const selectedIds = new Set(options.mutationIds);
  const unknown = options.mutationIds.filter(
    (mutationId) => !draft.mutations.some((mutation) => mutation.id === mutationId),
  );
  if (unknown.length)
    throw new LtmDraftApplyError(
      `Long-term memory draft mutation not found: ${unknown.join(", ")}`,
      409,
      "ltm_draft_mutation_missing",
    );
  const storage = new LongTermMemoryStorage(options.root);
  try {
    await assertFresh(storage, draft);
  } catch (error) {
    if (!(error instanceof LtmDraftApplyError)) throw error;
    const selectedMutations = draft.mutations.filter((mutation) => selectedIds.has(mutation.id));
    return {
      draftId: id,
      selectedMutationIds: [...selectedIds],
      readyMutationIds: [],
      blockedMutationIds: selectedMutations.map((mutation) => mutation.id),
      autoIncludedMutationIds: [],
      rows: selectedMutations.map((mutation) => ({
        mutationId: mutation.id,
        targetId: mutationTargetId(mutation),
        disposition: "rewrite" as const,
        status: "blocked" as const,
        autoIncluded: false,
        blockers: [{ code: error.code, message: error.message }],
        conflicts: mutation.kind === "create_note" ? (mutation.note.conflicts ?? []) : [],
      })),
    };
  }
  const previouslyApplied = new Set(draft.appliedMutationIds ?? []);
  const edited = applyEdits(draft.mutations, options.editedMutations ?? []);
  const mutations = edited.filter((mutation) => selectedIds.has(mutation.id) && !previouslyApplied.has(mutation.id));
  if (!mutations.length)
    throw new LtmDraftApplyError(
      "Long-term memory draft has no pending mutations selected for preflight.",
      409,
      "ltm_draft_no_pending_mutations",
    );

  const blockers = new Map<string, { code: string; message: string }[]>();
  const addBlocker = (mutationIds: string[], error: unknown) => {
    const message = error instanceof Error ? error.message : "Long-term memory preflight failed.";
    const code = error instanceof LtmDraftProjectionError ? error.code : "preflight_blocked";
    for (const mutationId of mutationIds)
      blockers.set(mutationId, [...(blockers.get(mutationId) ?? []), { code, message }]);
  };

  const selected = [...mutations];
  let existing = await storage.getNotesByIds([
    ...new Set(
      edited.flatMap((mutation) => [
        mutationTargetId(mutation),
        ...(mutation.kind === "create_note"
          ? mutation.note.links.map((link) => link.target)
          : mutation.kind === "add_link"
            ? [mutation.link.target]
            : []),
      ]),
    ),
  ]);
  const eventCreateByNoteId = new Map(
    edited.flatMap((mutation) =>
      mutation.kind === "create_note" && mutation.note.type === "timeline_event"
        ? [[mutation.note.id, mutation] as const]
        : [],
    ),
  );
  let preflightMutations = [...selected];
  let expanded = true;
  while (expanded) {
    expanded = false;
    const selectedNoteIds = new Set(preflightMutations.map((mutation) => mutationTargetId(mutation)));
    const changedNoteIds = new Set(
      preflightMutations
        .filter((mutation) => mutation.claimKind === "change")
        .map((mutation) => mutationTargetId(mutation)),
    );
    const dependencies = edited.filter((mutation) => {
      if (preflightMutations.some((item) => item.id === mutation.id)) return false;
      if (mutation.kind === "create_note" && selectedNoteIds.has(mutation.note.id) && !existing.has(mutation.note.id))
        return true;
      if (
        mutation.kind === "add_link" &&
        changedNoteIds.has(mutation.noteId) &&
        eventCreateByNoteId.has(mutation.link.target)
      )
        return true;
      return preflightMutations.some((item) => {
        const links =
          item.kind === "create_note"
            ? item.note.links
            : item.kind === "add_link"
              ? [item.link]
              : (existing.get(item.noteId)?.links ?? []);
        return links.some((link) => eventCreateByNoteId.has(link.target) && mutationTargetId(mutation) === link.target);
      });
    });
    if (dependencies.length) {
      preflightMutations = [...dependencies, ...preflightMutations];
      expanded = true;
    }
  }
  const autoIncludedIds = preflightMutations
    .filter((mutation) => !selectedIds.has(mutation.id))
    .map((mutation) => mutation.id);
  const targetIds = new Set(preflightMutations.map(mutationTargetId));
  const bulkApply = selected.length > 1;
  const projectionRows = new Map<string, { disposition: "new" | "merge" | "rewrite" }>();
  try {
    const projection = await preflight(storage, draft, preflightMutations);
    for (const item of projection.projections)
      for (const row of item.mutations) projectionRows.set(row.mutationId, row);
  } catch (error) {
    const mutationsByTarget = new Map<string, LtmDraftMutation[]>();
    for (const mutation of preflightMutations) {
      const targetId = mutationTargetId(mutation);
      mutationsByTarget.set(targetId, [...(mutationsByTarget.get(targetId) ?? []), mutation]);
    }
    let failedGroup = false;
    for (const mutationsForTarget of mutationsByTarget.values()) {
      try {
        const projection = await preflight(storage, draft, mutationsForTarget);
        for (const item of projection.projections)
          for (const row of item.mutations) projectionRows.set(row.mutationId, row);
      } catch (singleError) {
        failedGroup = true;
        addBlocker(
          mutationsForTarget.map((mutation) => mutation.id),
          singleError,
        );
      }
    }
    if (!failedGroup)
      addBlocker(
        preflightMutations.map((mutation) => mutation.id),
        error,
      );
  }

  existing = new Map([...existing, ...(await storage.getNotesByIds([...targetIds]))]);
  const rows = preflightMutations.map((mutation) => {
    const projectedRow = projectionRows.get(mutation.id);
    const disposition = projectedRow?.disposition ?? fallbackDisposition(mutation, existing);
    const mutationBlockers = [...(blockers.get(mutation.id) ?? [])];
    if (bulkApply && disposition === "rewrite")
      mutationBlockers.push({
        code: "destructive_disposition_requires_explicit_review",
        message: DESTRUCTIVE_DISPOSITION_MESSAGE,
      });
    const noteConflicts = mutation.kind === "create_note" ? (mutation.note.conflicts ?? []) : [];
    const storedConflicts = existing.get(mutationTargetId(mutation))?.conflicts ?? [];
    const conflicts = [
      ...new Map(
        [...storedConflicts, ...noteConflicts].map((conflict) => [JSON.stringify(conflict), conflict]),
      ).values(),
    ];
    return {
      mutationId: mutation.id,
      targetId: mutationTargetId(mutation),
      disposition,
      status: mutationBlockers.length ? "blocked" : "ready",
      autoIncluded: autoIncludedIds.includes(mutation.id),
      blockers: mutationBlockers,
      conflicts,
    };
  });
  const blockedMutationIds = rows.filter((row) => row.status === "blocked").map((row) => row.mutationId);
  return {
    draftId: id,
    selectedMutationIds: [...selectedIds],
    readyMutationIds: rows.filter((row) => row.status === "ready").map((row) => row.mutationId),
    blockedMutationIds,
    autoIncludedMutationIds: autoIncludedIds,
    rows,
  };
}

function lowRisk(mutation: LtmDraftMutation) {
  if (mutation.risk !== "low") return false;
  const scene =
    mutation.kind === "create_note"
      ? mutation.note.id.startsWith("scene_")
      : mutation.noteId.startsWith("scene_") ||
        (mutation.kind === "add_link" && mutation.link.target.startsWith("scene_"));
  return (
    !scene &&
    !(
      mutation.kind === "create_note" &&
      (hasLtmSourceSummarySceneTag(mutation.note.tags) || mutation.note.conflicts?.length)
    )
  );
}

async function filterAutoApplyDependencies(storage: LongTermMemoryStorage, mutations: LtmDraftMutation[]) {
  const createIds = new Set(
    mutations.flatMap((mutation) => (mutation.kind === "create_note" ? [mutation.note.id] : [])),
  );
  const targets = [
    ...new Set(
      mutations.flatMap((mutation) =>
        mutation.kind === "add_link"
          ? [mutation.link.target]
          : mutation.kind === "create_note"
            ? mutation.note.links.map((link) => link.target)
            : [],
      ),
    ),
  ];
  if (!targets.length) return mutations;
  const existing = await storage.getNotesByIds(targets.filter((target) => !createIds.has(target)));
  let selected = mutations;
  while (true) {
    const selectedCreates = new Set(
      selected.flatMap((mutation) => (mutation.kind === "create_note" ? [mutation.note.id] : [])),
    );
    const next = selected.filter((mutation) => {
      const available = (target: string) => existing.has(target) || selectedCreates.has(target);
      if (mutation.kind === "add_link") return available(mutation.link.target);
      if (mutation.kind === "create_note") return mutation.note.links.every((link) => available(link.target));
      return true;
    });
    if (next.length === selected.length) return selected;
    selected = next;
  }
}

export async function applyLongTermMemoryDraft(
  id: string,
  options: ApplyLtmDraftOptions = {},
): Promise<ApplyLtmDraftResult> {
  return withLtmDebugOperation(
    {
      root: options.root,
      operationId: options.operationId,
      phase: "apply",
      action: "apply_draft",
      draftId: id,
      details: {
        actor: options.actor,
        mutationIds: options.mutationIds,
        autoApplyLowRiskOnly: options.autoApplyLowRiskOnly,
      },
    },
    (operationId) => applyInner(id, { ...options, operationId }),
  );
}

async function applyInner(
  id: string,
  options: ApplyLtmDraftOptions & { operationId: string },
): Promise<ApplyLtmDraftResult> {
  const store = new LongTermMemoryDraftStore(options.root);
  return store.withDraftLock(id, async () => {
    let draft = await store.getDraft(id);
    if (!draft) throw new LtmDraftApplyError(`Long-term memory draft not found: ${id}`, 404, "ltm_draft_not_found");
    if (draft.status !== "pending")
      throw new LtmDraftApplyError(
        `Long-term memory draft is not pending: ${id}`,
        409,
        draft.status === "superseded"
          ? "ltm_draft_superseded"
          : draft.status === "invalidated"
            ? "ltm_draft_invalidated"
            : "ltm_draft_not_pending",
      );
    if (draft.reviewRequired && options.autoApplyLowRiskOnly)
      return {
        draft,
        appliedMutationIds: [],
        skippedMutationIds: draft.mutations.map((mutation) => mutation.id),
        autoIncludedMutationIds: [],
        indexRebuild: { status: "not_requested" },
      };
    const duplicateIds = draft.mutations
      .map((mutation) => mutation.id)
      .filter((item, index, all) => all.indexOf(item) !== index);
    if (duplicateIds.length) throw new Error(`Long-term memory draft has duplicate mutation id: ${duplicateIds[0]}`);
    const storage = new LongTermMemoryStorage(options.root);
    await assertFresh(storage, draft);
    const selectedIds = options.mutationIds ? new Set(options.mutationIds) : null;
    const unknown = options.mutationIds?.filter(
      (mutationId) => !draft.mutations.some((mutation) => mutation.id === mutationId),
    );
    if (unknown?.length) throw new Error(`Long-term memory draft mutation not found: ${unknown.join(", ")}`);
    const previouslyApplied = new Set(draft.appliedMutationIds ?? []);
    if (options.editedMutations?.length) {
      for (const edit of options.editedMutations) {
        if (previouslyApplied.has(edit.id))
          throw new Error(`Long-term memory edited mutation was already applied: ${edit.id}`);
      }
      draft = {
        ...draft,
        mutations: applyEdits(draft.mutations, options.editedMutations),
      };
    }
    let selected = draft.mutations.filter(
      (mutation) =>
        (!selectedIds || selectedIds.has(mutation.id)) && (!options.autoApplyLowRiskOnly || lowRisk(mutation)),
    );
    if (options.autoApplyLowRiskOnly) selected = await filterAutoApplyDependencies(storage, selected);
    const autoIncludedMutationIds: string[] = [];
    if (selectedIds && !options.autoApplyLowRiskOnly) {
      const targets = new Set(
        selected
          .filter((mutation) => mutation.kind !== "create_note")
          .map((mutation) => (mutation as Exclude<LtmDraftMutation, { kind: "create_note" }>).noteId),
      );
      const dependencies = draft.mutations.filter(
        (mutation): mutation is Extract<LtmDraftMutation, { kind: "create_note" }> =>
          mutation.kind === "create_note" && !selectedIds.has(mutation.id) && targets.has(mutation.note.id),
      );
      const existing = await storage.getNotesByIds([
        ...dependencies.map((mutation) => mutation.note.id),
        ...draft.mutations.flatMap((mutation) => (mutation.kind === "create_note" ? [] : [mutation.noteId])),
      ]);
      const included = dependencies.filter((mutation) => !existing.has(mutation.note.id));
      autoIncludedMutationIds.push(...included.map((mutation) => mutation.id));
      selected = [...included, ...selected];
      let added = true;
      while (added) {
        added = false;
        const eventCreateByNoteId = new Map(
          draft.mutations.flatMap((mutation) =>
            mutation.kind === "create_note" && mutation.note.type === "timeline_event"
              ? [[mutation.note.id, mutation] as const]
              : [],
          ),
        );
        const eventMutationsByNoteId = new Map<string, LtmDraftMutation[]>();
        for (const mutation of draft.mutations) {
          const note =
            mutation.kind === "create_note"
              ? (existing.get(mutation.note.id) ?? mutation.note)
              : existing.get(mutation.noteId);
          if (note?.type !== "timeline_event") continue;
          eventMutationsByNoteId.set(mutation.kind === "create_note" ? mutation.note.id : mutation.noteId, [
            ...(eventMutationsByNoteId.get(mutation.kind === "create_note" ? mutation.note.id : mutation.noteId) ?? []),
            mutation,
          ]);
        }
        const selectedChangedNoteIds = new Set(
          selected.flatMap((mutation) =>
            mutation.claimKind === "change"
              ? [mutation.kind === "create_note" ? mutation.note.id : mutation.noteId]
              : [],
          ),
        );
        const selectedEventTargets = new Set(
          selected.flatMap((mutation) =>
            (mutation.kind === "create_note"
              ? mutation.note.links
              : mutation.kind === "add_link"
                ? [mutation.link]
                : (existing.get(mutation.noteId)?.links ?? [])
            )
              .filter((link) => eventMutationsByNoteId.has(link.target))
              .map((link) => link.target),
          ),
        );
        const eventLinks = draft.mutations.filter(
          (mutation): mutation is Extract<LtmDraftMutation, { kind: "add_link" }> =>
            mutation.kind === "add_link" &&
            selectedChangedNoteIds.has(mutation.noteId) &&
            eventCreateByNoteId.has(mutation.link.target),
        );
        for (const link of eventLinks) {
          if (!selected.some((mutation) => mutation.id === link.id)) {
            selected.push(link);
            autoIncludedMutationIds.push(link.id);
            added = true;
          }
          const create = eventCreateByNoteId.get(link.link.target);
          if (create && !selected.some((mutation) => mutation.id === create.id)) {
            selected.unshift(create);
            autoIncludedMutationIds.push(create.id);
            added = true;
          }
        }
        for (const target of selectedEventTargets) {
          const event = existing.get(target);
          if (
            event?.links.some((link) => link.relation === "extracted_from" && link.target === draft.source.sourceNoteId)
          )
            continue;
          for (const mutation of eventMutationsByNoteId.get(target) ?? []) {
            if (!selected.some((item) => item.id === mutation.id)) {
              selected.unshift(mutation);
              autoIncludedMutationIds.push(mutation.id);
              added = true;
            }
          }
        }
      }
    }
    if (options.editedMutations?.length) {
      const includedIds = new Set(selected.map((mutation) => mutation.id));
      for (const edit of options.editedMutations) {
        if (!includedIds.has(edit.id))
          throw new LtmDraftApplyError(
            `Edited mutation ${edit.id} is not selected and cannot be auto-included. Select it or discard its edit before accepting this batch.`,
            409,
            "ltm_draft_edit_not_included",
          );
      }
    }
    selected = selected.filter((mutation) => !previouslyApplied.has(mutation.id));
    const skippedMutationIds = draft.mutations
      .filter((mutation) => !previouslyApplied.has(mutation.id) && !selected.some((item) => item.id === mutation.id))
      .map((mutation) => mutation.id);
    await recordLtmDebugEvent({
      root: options.root,
      operationId: options.operationId,
      phase: "apply",
      action: "mutations_selected",
      status: selected.length ? "ok" : options.autoApplyLowRiskOnly ? "skipped" : "warning",
      draftId: id,
      sourceNoteId: draft.source.sourceNoteId,
      mutationIds: selected.map((mutation) => mutation.id),
      details: { skippedMutationIds },
    });
    if (!selected.length) {
      if (options.autoApplyLowRiskOnly)
        return {
          draft,
          appliedMutationIds: [],
          skippedMutationIds,
          autoIncludedMutationIds,
          indexRebuild: { status: "not_requested" },
        };
      throw new LtmDraftApplyError(
        `Long-term memory draft has no mutations selected for apply: ${id}`,
        409,
        "ltm_draft_no_pending_mutations",
      );
    }
    const projection = await preflight(storage, draft, selected);
    const userSelectedCount = selectedIds
      ? selected.filter((mutation) => selectedIds.has(mutation.id)).length
      : selected.length;
    if (
      userSelectedCount > 1 &&
      projection.projections.some((group) => group.mutations.some((mutation) => mutation.disposition === "rewrite"))
    )
      throw new LtmDraftApplyError(
        DESTRUCTIVE_DISPOSITION_MESSAGE,
        409,
        "destructive_disposition_requires_explicit_review",
      );
    let progress = await store.updateDraftUnlocked(id, {
      applyState: "applying",
      mutations: draft.mutations,
    });
    if (!progress) throw new Error(`Long-term memory draft disappeared during apply: ${id}`);
    const appliedMutationIds: string[] = [];
    for (const group of groupLtmDraftMutationsByNote(selected)) {
      const create = group.mutations.find(
        (mutation): mutation is Extract<LtmDraftMutation, { kind: "create_note" }> => mutation.kind === "create_note",
      );
      const existing = await storage.getNote(group.noteId);
      const type = existing?.type ?? create?.note.type;
      if (!type)
        throw new LtmDraftProjectionError(
          `Long-term memory mutation target not found: ${group.noteId}`,
          "missing_target",
        );
      await storage.projectNote(
        group.noteId,
        type,
        (current) =>
          projectLtmDraftMutationGroup({
            existing: current,
            mutations: group.mutations,
            context: {
              source: draft.source,
              scope: draft.scope,
              modes: draft.modes,
            },
            timestamp: nowIso(),
          }).after,
      );
      const groupIds = group.mutations.map((mutation) => mutation.id);
      appliedMutationIds.push(...groupIds);
      progress = (await store.updateDraftUnlocked(id, {
        applyState: "applying",
        appliedAt: progress.appliedAt ?? nowIso(),
        appliedMutationIds: [...new Set([...(progress.appliedMutationIds ?? []), ...groupIds])],
      }))!;
    }
    const partial = skippedMutationIds.length > 0;
    const shouldRebuild = options.rebuildIndexes !== false && appliedMutationIds.length > 0;
    let final = await store.updateDraftStatusUnlocked(
      id,
      options.autoApplyLowRiskOnly && !partial ? "auto_applied" : partial ? "pending" : "accepted",
      {
        appliedAt: progress.appliedAt,
        applyState: partial ? "not_started" : "complete",
        indexRebuildStatus: shouldRebuild ? "pending" : "not_requested",
        indexRebuildAt: shouldRebuild ? nowIso() : undefined,
        indexRebuildError: undefined,
        mutations: partial
          ? draft.mutations.filter((mutation) => skippedMutationIds.includes(mutation.id))
          : draft.mutations,
        appliedMutationIds: [...new Set([...(progress.appliedMutationIds ?? []), ...appliedMutationIds])],
        skippedMutationIds,
      },
    );
    if (!final) throw new Error(`Long-term memory draft disappeared during apply: ${id}`);
    let indexRebuild: ApplyLtmDraftResult["indexRebuild"] = {
      status: "not_requested",
    };
    if (shouldRebuild) {
      try {
        await rebuildLongTermMemoryIndexes({ root: options.root });
        final =
          (await store.updateDraftUnlocked(id, {
            indexRebuildStatus: "succeeded",
            indexRebuildAt: nowIso(),
            indexRebuildError: undefined,
          })) ?? final;
        indexRebuild = { status: "succeeded" };
      } catch (error) {
        const message =
          (error instanceof Error ? error.message : String(error)).slice(0, 2_000) ||
          "Long-term memory index rebuild failed";
        final =
          (await store.updateDraftUnlocked(id, {
            indexRebuildStatus: "failed",
            indexRebuildAt: nowIso(),
            indexRebuildError: message,
          })) ?? final;
        indexRebuild = { status: "failed", error: message };
        logger.error(error, "[ltm] Index rebuild failed after committing draft %s", id);
      }
    }
    return {
      draft: final,
      appliedMutationIds,
      skippedMutationIds,
      autoIncludedMutationIds,
      indexRebuild,
    };
  });
}
