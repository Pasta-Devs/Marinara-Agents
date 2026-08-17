import {
  isLtmSourceLikeNote,
  ltmDraftReviewResponseSchema,
  type LtmDraftBlockReason,
  type LtmDraftFreshness,
  type LtmDraftReviewDraft,
  type LtmDraftReviewMutation,
  type LtmDraftReviewResponse,
  type LtmDraftReviewSource,
  type LtmDraftReviewTarget,
  type LtmDraftStatus,
  type LtmExtractionDiagnostic,
  type LtmNote,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { noteIdForLtmDraftMutation, projectLtmDraftOntoNotes } from "./draft-projector.js";
import { LongTermMemoryDraftStore } from "./draft-store.js";
import { nowIso, uniqueStrings } from "./ltm-utils.js";
import { isLtmSourceExtractionFingerprintCurrent } from "./source-hash.js";
import { LongTermMemoryStorage } from "./storage.js";

export type ProjectLtmDraftReviewOptions = {
  root?: string;
  sourceNoteId?: string;
  chatId?: string;
  status?: LtmDraftStatus;
  includeInvalidated?: boolean;
};
type MutableSource = {
  sourceNoteId: string;
  modes: Set<LtmNote["modes"][number]>;
  drafts: LtmDraftReviewDraft[];
  targets: Map<string, LtmDraftReviewTarget>;
};

export async function projectLongTermMemoryDraftReview(
  options: ProjectLtmDraftReviewOptions = {},
): Promise<LtmDraftReviewResponse> {
  const store = new LongTermMemoryDraftStore(options.root);
  const storage = new LongTermMemoryStorage(options.root);
  const drafts = (await store.listDrafts({ chatId: options.chatId }))
    .filter((draft) =>
      options.status
        ? draft.status === options.status
        : draft.status === "pending" || (options.includeInvalidated && draft.status === "invalidated"),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const overlay = await storage.getNotesByIds(
    uniqueStrings(drafts.flatMap((draft) => draft.mutations.map(noteIdForLtmDraftMutation))),
  );
  const sourceNotes = await storage.getNotesByIds(uniqueStrings(drafts.map((draft) => draft.source.sourceNoteId)));
  const sources = new Map<string, MutableSource>();
  for (const draft of drafts) {
    const sourceNoteId = draft.source.sourceNoteId;
    if (!sourceNoteId) continue;
    const included = !options.sourceNoteId || sourceNoteId === options.sourceNoteId;
    const source = included
      ? (sources.get(sourceNoteId) ?? { sourceNoteId, modes: new Set(), drafts: [], targets: new Map() })
      : null;
    if (source) {
      sources.set(sourceNoteId, source);
      for (const mode of draft.modes) source.modes.add(mode);
    }
    const freshness = draftFreshness(draft, sourceNotes.get(sourceNoteId) ?? null);
    const blockReasons = blockReasonsForDraft(draft, freshness);
    const mutationIds = new Set(draft.mutations.map((mutation) => mutation.id));
    const rowDiagnostics = new Map<string, LtmExtractionDiagnostic[]>();
    const deduplications: LtmExtractionDiagnostic[] = [];
    const diagnostics: LtmExtractionDiagnostic[] = [];
    for (const diagnostic of draft.diagnostics ?? []) {
      if (diagnostic.code === "deduplicated_evidence_unit") deduplications.push(diagnostic);
      else if (diagnostic.mutationId && mutationIds.has(diagnostic.mutationId))
        rowDiagnostics.set(diagnostic.mutationId, [...(rowDiagnostics.get(diagnostic.mutationId) ?? []), diagnostic]);
      else diagnostics.push(diagnostic);
    }
    if (draft.mutations.length) {
      try {
        const projection = projectLtmDraftOntoNotes({
          notes: overlay,
          mutations: draft.mutations,
          context: { source: draft.source, scope: draft.scope, modes: draft.modes },
          timestamp: nowIso(),
        });
        const mutations = new Map(draft.mutations.map((mutation) => [mutation.id, mutation]));
        for (const note of projection.projections) {
          const rows: LtmDraftReviewMutation[] = note.mutations.map((item) => ({
            draftId: draft.id,
            mutation: mutations.get(item.mutationId)!,
            disposition: item.disposition,
            diagnostics: rowDiagnostics.get(item.mutationId) ?? [],
            changes: item.changes,
          }));
          if (source) {
            const target = source.targets.get(note.noteId);
            if (target) {
              target.rows.push(...rows);
              target.title ??= note.after.title;
            } else
              source.targets.set(note.noteId, {
                noteId: note.noteId,
                title: note.after.title,
                noteType: note.after.type,
                rows,
              });
          }
        }
        if (!blockReasons.length) for (const note of projection.projections) overlay.set(note.noteId, note.after);
      } catch (error) {
        blockReasons.push({
          code: "projection_failed",
          message: error instanceof Error ? error.message : "Draft projection failed.",
        });
      }
    }
    if (source)
      source.drafts.push({
        draft,
        freshness,
        blockReasons,
        diagnostics,
        candidateRejections: draft.extractionOutcome?.droppedCandidates ?? [],
        deduplications,
      });
  }
  const projectedSources: LtmDraftReviewSource[] = [...sources.values()].map((source) => ({
    sourceNoteId: source.sourceNoteId,
    modes: [...source.modes],
    drafts: source.drafts,
    targets: [...source.targets.values()],
  }));
  return ltmDraftReviewResponseSchema.parse({
    generatedAt: nowIso(),
    sources: projectedSources,
    counts: {
      sources: projectedSources.length,
      drafts: projectedSources.reduce((sum, source) => sum + source.drafts.length, 0),
      mutations: projectedSources.reduce(
        (sum, source) =>
          sum +
          source.drafts.reduce(
            (draftSum, item) => draftSum + (item.draft.status === "pending" ? item.draft.mutations.length : 0),
            0,
          ),
        0,
      ),
      blockedDrafts: projectedSources.reduce(
        (sum, source) => sum + source.drafts.filter((item) => item.blockReasons.length).length,
        0,
      ),
      candidateRejections: projectedSources.reduce(
        (sum, source) => sum + source.drafts.reduce((draftSum, item) => draftSum + item.candidateRejections.length, 0),
        0,
      ),
      deduplications: projectedSources.reduce(
        (sum, source) => sum + source.drafts.reduce((draftSum, item) => draftSum + item.deduplications.length, 0),
        0,
      ),
    },
  });
}

function draftFreshness(draft: LtmDraftReviewDraft["draft"], source: LtmNote | null): LtmDraftFreshness {
  if (draft.status === "superseded") return "superseded";
  if (draft.status === "invalidated") return "invalidated";
  if (draft.status !== "pending") return "not_pending";
  if (!source) return "missing";
  if (!isLtmSourceLikeNote(source)) return "invalid";
  if (!draft.source.extractionFingerprint) return "hashless";
  return isLtmSourceExtractionFingerprintCurrent(source, draft.source.extractionFingerprint) ? "fresh" : "stale";
}

function blockReasonsForDraft(
  draft: LtmDraftReviewDraft["draft"],
  freshness: LtmDraftFreshness,
): LtmDraftBlockReason[] {
  const reasons: LtmDraftBlockReason[] = [];
  const reason =
    freshness === "missing"
      ? { code: "source_missing" as const, message: "The source note no longer exists." }
      : freshness === "invalid"
        ? { code: "source_invalid" as const, message: "The source is no longer a source note." }
        : freshness === "hashless"
          ? {
              code: "source_context_unbound" as const,
              message:
                "This legacy draft is not bound to its extraction context. Extract the source again before applying it.",
            }
          : freshness === "stale"
            ? {
                code: "source_stale" as const,
                message: "The source or extraction context changed after this extraction.",
              }
            : freshness === "superseded"
              ? { code: "draft_superseded" as const, message: "A newer extraction superseded this draft." }
              : freshness === "invalidated"
                ? {
                    code: "draft_invalidated" as const,
                    message: draft.invalidationReason ?? "A targeted memory detail was deleted.",
                  }
                : freshness === "not_pending"
                  ? { code: "draft_not_pending" as const, message: "This draft is no longer pending review." }
                  : null;
  if (reason) reasons.push(reason);
  if (!draft.mutations.length) reasons.push({ code: "no_mutations", message: "No mutation survived extraction." });
  return reasons;
}
