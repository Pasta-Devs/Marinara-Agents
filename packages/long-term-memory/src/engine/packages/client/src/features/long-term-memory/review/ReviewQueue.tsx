import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, CircleAlert, Loader2, X } from "lucide-react";
import {
  type LtmDraftLinkChoice,
  type LtmDraftMutation,
  type LtmDraftPreflightResponse,
  type LtmDraftReviewDraft,
  type LtmDraftReviewResponse,
  type LtmExtractionDropReason,
  type LtmNote,
  type LtmRejectedSuggestionsClearResponse,
  type LtmRejectedSuggestion,
  type LtmRejectedSuggestionsResponse,
  type LtmSavedSubjectIdentityChoice,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { errorMessage, invalidateLtmQueries, queryKeys, request, requestNotesByIds } from "../api";
import { humanizeLabel, labelKeys, localizedLabel, rejectionReasonLabels, reviewCodeText } from "../display-labels";
import { Button, IconButton, StatusSurface, revealFocusUnderStickyBar } from "../shared-controls";
import type { LongTermMemoryDestinationProps } from "../types";
import { selectLtmPluralForm, useLtmTranslation } from "../localization";
import { LtmWorkspace, type LtmWorkspacePane } from "../LtmWorkspace";
import SubjectIdentityReview from "./SubjectIdentityReview";
import { ambiguousLinkDetails, type AmbiguousLinkDiagnostic } from "./review-queue-ambiguous-link";
import {
  acceptedMutationIds,
  buildPersistedReviewState,
  buildReviewRows,
  cleanupPersistedReviewStates,
  dispositionLabels,
  draftDisplayTitle,
  draftReviewContextFingerprint,
  draftReviewFingerprint,
  groupByDraft,
  humanizeReviewText,
  linkChoiceKey,
  mutationDisplayLabel,
  mutationFingerprint,
  mutationLabels,
  mutationHasOverlongText,
  mutationProposedText,
  noteBody,
  noteDisplayTitle,
  parsePersistedLinkChoice,
  parsePersistedMutation,
  readPersistedReviewState,
  reviewStateStorageKey,
  sameMutation,
  selectedEditIsValid,
  writePersistedReviewState,
} from "./review-state";
import type { ReviewRow } from "./review-state";
import { MutationEditor, importanceOptions } from "./MutationEditor";
import { AmbiguousLinkChoice, ConflictValue, ReviewProgress, SelectionCheckbox } from "./ReviewControls";
import { ExtractionDetails, hasExtractionDetails } from "./ExtractionDetails";

type ApplyDraftResponse = {
  appliedMutationIds: string[];
  skippedMutationIds: string[];
  autoIncludedMutationIds: string[];
  indexRebuild: { status: "not_requested" | "pending" | "succeeded" } | { status: "failed"; error: string };
};

type PreflightRow = LtmDraftPreflightResponse["rows"][number];
type AcceptRequest = {
  draftId: string;
  mutationIds: string[];
  editedMutations: LtmDraftMutation[];
  linkChoices: LtmDraftLinkChoice[];
};

type SkipDraftResponse = {
  mutationIds: string[];
};

type ReviewAction = "accept" | "skip";

type BatchResult = {
  action: "accepted" | "skipped";
  phase: "preflight" | "complete";
  ready: number;
  completed: number;
  failed: number;
  remaining: number;
  autoIncluded: number;
  indexRebuildFailures: string[];
  messages: string[];
  cascadeMutationLabels: string[];
  savedMemoryIds: string[];
  failedMutationIds: string[];
  failedDraftIds: string[];
  completedMutationIds: string[];
  blockedMutationIds: string[];
};

const CONFLICT_PREVIEW_LIMIT = 3;

// The page itself is never a control: a click that does not focus its button (Safari) leaves the body active.
const focusable = (element: HTMLElement | null): element is HTMLElement =>
  Boolean(
    element?.isConnected &&
    element !== document.body &&
    element !== document.documentElement &&
    !element.matches(":disabled") &&
    element.getClientRects().length,
  );

const freshnessLabel: Record<string, string> = {
  fresh: "ui.longTermMemory.reviewqueue.fresh",
  hashless: "ui.longTermMemory.reviewqueue.contextUnbound",
  stale: "ui.longTermMemory.reviewqueue.stale",
  missing: "ui.longTermMemory.reviewqueue.sourceMissing",
  invalid: "ui.longTermMemory.reviewqueue.sourceInvalid",
  superseded: "ui.longTermMemory.reviewqueue.superseded",
  invalidated: "ui.longTermMemory.reviewqueue.invalidated",
  not_pending: "ui.longTermMemory.reviewqueue.notPending",
};

// Fresh is the normal state, so it reads as plain text. A state that needs attention follows DESIGN.md: the warning
// border (no hue) for stale or replaced drafts, destructive for a missing or invalid source. The text stays at full
// strength, because the accent and muted tokens miss 4.5:1 at this size.
function freshnessClass(freshness: string) {
  if (freshness === "fresh") return "text-[var(--foreground)]";
  if (freshness === "missing" || freshness === "invalid" || freshness === "invalidated")
    return "border border-[var(--destructive)] text-[var(--foreground)]";
  if (freshness === "stale" || freshness === "superseded" || freshness === "not_pending")
    return "border border-[var(--marinara-editor-border-strong)] text-[var(--foreground)]";
  return "border border-[var(--border)] text-[var(--foreground)]";
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

// Every part is a whole sentence so a translator can reorder words and punctuation inside it.
function batchResultSentences(
  result: BatchResult,
  localizeUi: ReturnType<typeof useLtmTranslation>["t"],
  locale: string,
) {
  const pick = (count: number, one: string, other: string) =>
    selectLtmPluralForm(locale, count) === "one" ? one : other;
  const endSentence = (text: string) => (/[.!?…。！？]$/u.test(text.trim()) ? text.trim() : `${text.trim()}.`);
  const sentences = [
    result.phase === "preflight"
      ? localizeUi("ui.longTermMemory.reviewqueue.preflightSummary", {
          ready: result.ready,
          blocked: result.blockedMutationIds.length,
        })
      : localizeUi(
          result.action === "accepted"
            ? pick(
                result.completed,
                "ui.longTermMemory.reviewqueue.appliedSummaryOne",
                "ui.longTermMemory.reviewqueue.appliedSummary",
              )
            : pick(
                result.completed,
                "ui.longTermMemory.reviewqueue.discardedSummaryOne",
                "ui.longTermMemory.reviewqueue.discardedSummary",
              ),
          { completed: result.completed, failed: result.failed },
        ),
  ];
  if (result.blockedMutationIds.length)
    sentences.push(
      localizeUi("ui.longTermMemory.reviewqueue.blockedBeforeApply", { count: result.blockedMutationIds.length }),
    );
  if (result.remaining)
    sentences.push(
      localizeUi(
        pick(
          result.remaining,
          "ui.longTermMemory.reviewqueue.otherPendingOne",
          "ui.longTermMemory.reviewqueue.otherPending",
        ),
        { count: result.remaining },
      ),
    );
  if (result.autoIncluded)
    sentences.push(
      localizeUi(
        pick(
          result.autoIncluded,
          "ui.longTermMemory.reviewqueue.dependenciesIncludedAutomaticallyOne",
          "ui.longTermMemory.reviewqueue.dependenciesIncludedAutomatically",
        ),
        { count: result.autoIncluded },
      ),
    );
  if (result.indexRebuildFailures.length)
    sentences.push(
      endSentence(
        localizeUi("ui.longTermMemory.reviewqueue.changesWereSavedButTheIndexRebuildFailedValue1", {
          value1: result.indexRebuildFailures.join(" "),
        }),
      ),
    );
  sentences.push(...result.messages.map(endSentence));
  if (result.cascadeMutationLabels.length)
    sentences.push(
      localizeUi(
        pick(
          result.cascadeMutationLabels.length,
          "ui.longTermMemory.reviewqueue.cascadeSkippedMutationsOne",
          "ui.longTermMemory.reviewqueue.cascadeSkippedMutations",
        ),
        { count: result.cascadeMutationLabels.length, labels: result.cascadeMutationLabels.join(", ") },
      ),
    );
  return sentences;
}

function recoveryLabel(
  recovery: NonNullable<LtmDraftReviewDraft["candidateRejections"][number]["recovery"]>,
  localizeUi: ReturnType<typeof useLtmTranslation>["t"],
  noteById: ReadonlyMap<string, LtmNote>,
) {
  const hints = [
    recovery.noteType
      ? localizeUi("ui.longTermMemory.reviewqueue.recoveryMemoryType", {
          value: humanizeLabel(recovery.noteType),
        })
      : null,
    recovery.noteId
      ? localizeUi("ui.longTermMemory.reviewqueue.recoveryMemory", {
          value: noteDisplayTitle(noteById.get(recovery.noteId), humanizeLabel(recovery.noteId)),
        })
      : null,
    recovery.sectionKey
      ? localizeUi("ui.longTermMemory.reviewqueue.recoverySection", {
          value: humanizeLabel(recovery.sectionKey),
        })
      : null,
    recovery.status
      ? localizeUi("ui.longTermMemory.reviewqueue.recoveryStatus", {
          value: humanizeLabel(recovery.status),
        })
      : null,
  ].filter(Boolean);
  return hints.join(", ") || localizeUi("ui.longTermMemory.reviewqueue.reviewRejectedCandidate");
}

function savedIdentityChoiceLabel(
  choice: LtmSavedSubjectIdentityChoice,
  localizeUi: ReturnType<typeof useLtmTranslation>["t"],
) {
  if (choice.action === "skip") return localizeUi("ui.longTermMemory.reviewqueue.skipIdentityParticipant");
  if (choice.action === "different") return localizeUi("ui.longTermMemory.reviewqueue.differentIdentity");
  return choice.subject.ref?.id ?? choice.subject.key;
}

const rejectionRecommendedLabels: Partial<Record<LtmExtractionDropReason, string>> = {
  invalid_format: "ui.longTermMemory.reviewqueue.recommendedFixInvalidFormat",
  placeholder_output: "ui.longTermMemory.reviewqueue.recommendedFixPlaceholderOutput",
  quote_not_found_in_source: "ui.longTermMemory.reviewqueue.recommendedFixQuoteNotFound",
  missing_source_evidence: "ui.longTermMemory.reviewqueue.recommendedFixMissingEvidence",
  source_summary_payload: "ui.longTermMemory.reviewqueue.recommendedFixSourceSummary",
  unsupported_bucket: "ui.longTermMemory.reviewqueue.recommendedFixUnsupportedBucket",
  target_note_outside_scope: "ui.longTermMemory.reviewqueue.recommendedFixOutsideScope",
  ambiguous_subject: "ui.longTermMemory.reviewqueue.recommendedFixAmbiguousSubject",
  untrusted_subject: "ui.longTermMemory.reviewqueue.recommendedFixUntrustedSubject",
  invalid_subject_cardinality: "ui.longTermMemory.reviewqueue.recommendedFixInvalidSubjectCardinality",
  too_long_to_keep_safely: "ui.longTermMemory.reviewqueue.recommendedFixTooLong",
};

const rejectionRecommendedLabelsByCode: Record<string, string> = {
  invalid_evidence_unit_format: "ui.longTermMemory.reviewqueue.recommendedFixInvalidFormat",
  source_hash_mismatch: "ui.longTermMemory.reviewqueue.recommendedFixSourceHashMismatch",
  source_event_graph_open: "ui.longTermMemory.reviewqueue.recommendedFixSourceEventGraph",
  unsupported_source_extraction_bucket: "ui.longTermMemory.reviewqueue.recommendedFixSourceExtractionBucket",
  unsupported_mode_bucket: "ui.longTermMemory.reviewqueue.recommendedFixModeBucket",
  transient_character_state: "ui.longTermMemory.reviewqueue.recommendedFixTransientCharacterState",
  invalid_timeline_section: "ui.longTermMemory.reviewqueue.recommendedFixTimelineSection",
  relationship_state_without_history: "ui.longTermMemory.reviewqueue.recommendedFixRelationshipHistory",
  relationship_state_missing_caused_by: "ui.longTermMemory.reviewqueue.recommendedFixRelationshipCause",
  invalid_relationship_dimension: "ui.longTermMemory.reviewqueue.recommendedFixRelationshipDimension",
  invalid_relationship_dimension_change: "ui.longTermMemory.reviewqueue.recommendedFixRelationshipDimensionChange",
  static_relationship_dimension_change: "ui.longTermMemory.reviewqueue.recommendedFixStaticRelationshipChange",
  unknown_link_target: "ui.longTermMemory.reviewqueue.recommendedFixUnknownLinkTarget",
  event_shaped_character_fact: "ui.longTermMemory.reviewqueue.recommendedFixEventShapedCharacterFact",
  vague_thread: "ui.longTermMemory.reviewqueue.recommendedFixVagueThread",
  scene_only_tone_or_anchor: "ui.longTermMemory.reviewqueue.recommendedFixSceneOnlyToneOrAnchor",
  composite_character_subject: "ui.longTermMemory.reviewqueue.recommendedFixCompositeCharacterSubject",
  ambiguous_subject_identity: "ui.longTermMemory.reviewqueue.recommendedFixAmbiguousSubjectIdentity",
  untrusted_subject_identity: "ui.longTermMemory.reviewqueue.recommendedFixUntrustedSubjectIdentity",
};

export default function ReviewQueue({
  props,
  onDirtyChange,
  onSaveRequest,
  onOpenMemory,
  onOpenVault,
  onRecoverCandidate,
  reviewSourceNoteId,
}: LongTermMemoryDestinationProps) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const queryClient = useQueryClient();
  const [selectedSourceId, setSelectedSourceId] = useState(reviewSourceNoteId ?? null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<LtmWorkspacePane>("navigator");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sourceCollapsed, setSourceCollapsed] = useState(false);
  const [expandedMutationIds, setExpandedMutationIds] = useState<Set<string>>(new Set());
  const reviewRef = useRef<HTMLElement>(null);
  const batchBarRef = useRef<HTMLDivElement>(null);

  function setMobilePaneAndFocus(pane: LtmWorkspacePane) {
    setMobilePane(pane);
    requestAnimationFrame(() => {
      const workspace = reviewRef.current?.querySelector<HTMLElement>("[data-ltm-workspace]");
      const target = workspace?.querySelector<HTMLElement>(
        `[data-ltm-workspace-pane-tab="${pane}"], [data-ltm-workspace-pane="${pane}"] button, [data-ltm-workspace-pane="${pane}"] [tabindex]:not([tabindex="-1"]), [data-ltm-workspace-pane="${pane}"][tabindex]`,
      );
      target?.focus({ preventScroll: true });
    });
  }

  useEffect(() => {
    setSelectedSourceId(reviewSourceNoteId ?? null);
    setSourceCollapsed(false);
    setDetailsOpen(false);
  }, [reviewSourceNoteId]);
  const review = useQuery({
    queryKey: queryKeys.review,
    queryFn: () => request<LtmDraftReviewResponse>("/drafts/review?includeInvalidated=true"),
  });
  const rejectedSuggestions = useQuery({
    queryKey: queryKeys.rejectedSuggestions,
    queryFn: () => request<LtmRejectedSuggestionsResponse>("/rejected-suggestions"),
  });
  const savedIdentityChoices = useQuery({
    queryKey: queryKeys.savedIdentityChoices,
    queryFn: () => request<LtmRejectedSuggestionsResponse>("/rejected-suggestions?includeResolved=true"),
  });
  const contextNoteIds = useMemo(() => {
    const ids = new Set<string>();
    for (const source of review.data?.sources ?? []) {
      ids.add(source.sourceNoteId);
      source.targets.forEach((target) => {
        if (target.rows.some((row) => row.disposition !== "new")) ids.add(target.noteId);
      });
    }
    for (const suggestion of rejectedSuggestions.data?.suggestions ?? []) {
      ids.add(suggestion.source.sourceNoteId);
      if (suggestion.candidate.recovery?.noteId) ids.add(suggestion.candidate.recovery.noteId);
    }
    for (const suggestion of savedIdentityChoices.data?.suggestions ?? []) {
      ids.add(suggestion.source.sourceNoteId);
    }
    return [...ids].sort();
  }, [rejectedSuggestions.data?.suggestions, savedIdentityChoices.data?.suggestions, review.data?.sources]);
  const notes = useQuery({
    queryKey: [...queryKeys.notes, "review-context", contextNoteIds],
    queryFn: ({ signal }) => requestNotesByIds<LtmNote>(contextNoteIds, signal, true),
    enabled: review.isSuccess && rejectedSuggestions.isSuccess,
    // A changed id list keeps the last context on screen; Accept stays off until the new one loads.
    placeholderData: keepPreviousData,
  });
  const noteById = useMemo(() => new Map((notes.data ?? []).map((note) => [note.id, note])), [notes.data]);
  const reviewContextBusy =
    review.isSuccess && rejectedSuggestions.isSuccess && !notes.isError && (!notes.isSuccess || notes.isFetching);
  const reviewContextLoading = reviewContextBusy && !notes.isSuccess;
  const reviewContextRefreshing = reviewContextBusy && !reviewContextLoading;
  const reviewContextFailed = notes.isError;
  const reviewContextReady = notes.isSuccess && !notes.isFetching && !notes.isPlaceholderData;
  const missingContextTitle = reviewContextFailed
    ? localizeUi("ui.longTermMemory.reviewqueue.memoryContextUnavailable")
    : reviewContextBusy
      ? localizeUi("ui.longTermMemory.reviewqueue.loadingMemoryContext")
      : localizeUi("ui.longTermMemory.reviewqueue.untitledMemory");
  const sourceIds = useMemo(
    () => [
      ...new Set([
        ...(review.data?.sources ?? []).map((source) => source.sourceNoteId),
        ...(rejectedSuggestions.data?.suggestions ?? []).map((suggestion) => suggestion.source.sourceNoteId),
        ...(savedIdentityChoices.data?.suggestions ?? []).map((suggestion) => suggestion.source.sourceNoteId),
        ...(selectedSourceId ? [selectedSourceId] : []),
      ]),
    ],
    [
      rejectedSuggestions.data?.suggestions,
      savedIdentityChoices.data?.suggestions,
      review.data?.sources,
      selectedSourceId,
    ],
  );
  const selectedSourceIsLive =
    review.data?.sources.some((source) => source.sourceNoteId === selectedSourceId) ||
    rejectedSuggestions.data?.suggestions.some((suggestion) => suggestion.source.sourceNoteId === selectedSourceId) ||
    savedIdentityChoices.data?.suggestions.some((suggestion) => suggestion.source.sourceNoteId === selectedSourceId) ||
    false;
  useEffect(() => {
    if (!review.isSuccess || !rejectedSuggestions.isSuccess || !selectedSourceId || selectedSourceIsLive) {
      return;
    }
    setSelectedSourceId(null);
  }, [rejectedSuggestions.isSuccess, review.isSuccess, selectedSourceId, selectedSourceIsLive]);
  const effectiveSourceId =
    selectedSourceId && sourceIds.includes(selectedSourceId) ? selectedSourceId : (sourceIds[0] ?? null);
  const selectedSourceMissing = reviewContextReady && Boolean(effectiveSourceId && !noteById.has(effectiveSourceId));
  // "Deleted source" is a claim about the notes, so it waits for a loaded context that lacks the id.
  const sourceDisplayTitle = (id: string) =>
    noteById.has(id)
      ? noteDisplayTitle(noteById.get(id), missingContextTitle)
      : reviewContextReady
        ? localizeUi("ui.longTermMemory.reviewqueue.missingSourceTitle")
        : missingContextTitle;
  const sourceTitleHint = (id: string) => (noteById.has(id) ? undefined : id);
  const selectedReviewSource = review.data?.sources.find((source) => source.sourceNoteId === effectiveSourceId);
  const selectedDraft =
    selectedReviewSource?.drafts.find((item) => item.draft.id === selectedDraftId) ?? selectedReviewSource?.drafts[0];
  const sourceRejectedSuggestions =
    rejectedSuggestions.data?.suggestions.filter((item) => item.source.sourceNoteId === effectiveSourceId) ?? [];
  const sourceSavedIdentityChoices =
    savedIdentityChoices.data?.suggestions.filter(
      (item) => item.identityResolution && item.source.sourceNoteId === effectiveSourceId,
    ) ?? [];
  const needsSourceReextraction = Boolean(
    selectedReviewSource?.drafts.some(
      (item) =>
        item.blockReasons.length > 0 ||
        ["stale", "missing", "invalid", "superseded", "not_pending"].includes(item.freshness),
    ),
  );
  const selectedSourceIsExtractable = noteById.get(effectiveSourceId ?? "")?.type === "source";
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editedById, setEditedById] = useState<Map<string, LtmDraftMutation>>(new Map());
  const [linkChoicesById, setLinkChoicesById] = useState<Map<string, LtmDraftLinkChoice>>(new Map());
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [reviewStateHydrated, setReviewStateHydrated] = useState<string | null>(null);
  const [running, setRunning] = useState<"accept" | "skip" | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [preflightRows, setPreflightRows] = useState<Map<string, PreflightRow>>(new Map());
  const [preflightByDraftId, setPreflightByDraftId] = useState<Map<string, LtmDraftPreflightResponse>>(new Map());
  const [preflightKey, setPreflightKey] = useState<string | null>(null);
  const [acceptPhase, setAcceptPhase] = useState<"check" | "apply">("check");
  const [runMutationIds, setRunMutationIds] = useState<ReadonlySet<string>>(new Set());
  const [deleteSuggestionError, setDeleteSuggestionError] = useState("");
  const [identityDirtyIds, setIdentityDirtyIds] = useState<Set<string>>(new Set());
  const identitySaveRequestsRef = useRef(new Map<string, () => Promise<boolean>>());
  const [rejectedSuggestionsMessage, setRejectedSuggestionsMessage] = useState("");
  const [clearingSourceId, setClearingSourceId] = useState<string | null>(null);
  const [extractingSourceId, setExtractingSourceId] = useState<string | null>(null);
  const [extractionMessage, setExtractionMessage] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);
  const [reviewStateMessage, setReviewStateMessage] = useState<string | null>(null);
  const [reviewStatePersisted, setReviewStatePersisted] = useState(true);
  const [reviewStateMismatch, setReviewStateMismatch] = useState(false);
  const batchControllerRef = useRef<AbortController | null>(null);
  // A run keeps focus on the control that started it. When that control is gone (an applied or
  // discarded row, or an emptied selection) or disabled (a blocked row), focus moves to the row
  // now at the first acted row's place, else to the result. Acted rows stay on screen until the
  // queue reloads, so they are skipped. Focus the user moved elsewhere stays.
  const runFocusRef = useRef<{ trigger: HTMLElement | null; index: number; acted: ReadonlySet<string> } | null>(null);
  useEffect(() => {
    const pending = runFocusRef.current;
    const root = reviewRef.current;
    if (!pending || !root) return;
    const { trigger, index, acted } = pending;
    const active = document.activeElement;
    const focusLost = !active || active === document.body || active === trigger;
    if (focusable(trigger) && active !== trigger && running !== null && focusLost) {
      trigger.focus({ preventScroll: true });
      return;
    }
    if (focusable(trigger) && active === trigger) return;
    if (!focusLost || focusable(trigger)) {
      runFocusRef.current = null;
      return;
    }
    const toggles = [...root.querySelectorAll<HTMLElement>("[data-ltm-review-mutation-toggle]")].filter(
      (toggle) => focusable(toggle) && !acted.has(toggle.dataset.ltmReviewMutationToggle ?? ""),
    );
    const next =
      toggles[Math.min(index, toggles.length - 1)] ?? root.querySelector<HTMLElement>("[data-ltm-review-result]");
    // With every row acted on, a run that is still going has no result to land on yet.
    if (!next && running !== null) return;
    runFocusRef.current = null;
    next?.focus({ preventScroll: true });
  }, [running, reviewedIds, review.data]);
  const selectedIdsRef = useRef(selectedIds);
  const editedByIdRef = useRef(editedById);
  const linkChoicesByIdRef = useRef(linkChoicesById);
  const reviewDataRef = useRef(review.data);
  const reviewDataSignatureRef = useRef<string | null>(null);
  const reviewStateHydratedRef = useRef<string | null>(null);
  const persistenceTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const persistReviewStateSnapshotRef = useRef<(key: string, chatId: string | null | undefined) => boolean>(() => true);
  const flushReviewStateRef = useRef<() => boolean>(() => true);
  const reviewStateKey = reviewStateStorageKey(props.chatId);
  const onIdentityDirtyChange = useCallback((suggestionId: string, dirty: boolean) => {
    setIdentityDirtyIds((current) => {
      const next = new Set(current);
      if (dirty) next.add(suggestionId);
      else next.delete(suggestionId);
      return next;
    });
  }, []);
  const onIdentityRegisterSave = useCallback((suggestionId: string, save: (() => Promise<boolean>) | null) => {
    if (save) identitySaveRequestsRef.current.set(suggestionId, save);
    else identitySaveRequestsRef.current.delete(suggestionId);
  }, []);
  const onIdentityResolved = useCallback(
    (skipped: boolean) =>
      setRejectedSuggestionsMessage(
        localizeUi(
          skipped
            ? "ui.longTermMemory.reviewqueue.identitySuggestionSkipped"
            : "ui.longTermMemory.reviewqueue.identitySuggestionResolved",
        ),
      ),
    [localizeUi],
  );
  const reviewDataSignature = useMemo(
    () =>
      review.data
        ? JSON.stringify(
            review.data.sources.flatMap((source) =>
              source.drafts.map((item) => [item.draft.id, draftReviewFingerprint(item)]),
            ),
          )
        : null,
    [review.data],
  );
  selectedIdsRef.current = selectedIds;
  editedByIdRef.current = editedById;
  linkChoicesByIdRef.current = linkChoicesById;
  reviewDataRef.current = review.data;
  reviewDataSignatureRef.current = reviewDataSignature;
  reviewStateHydratedRef.current = reviewStateHydrated;

  const persistReviewStateSnapshot = (key: string, chatId: string | null | undefined) => {
    const state = buildPersistedReviewState(
      reviewDataRef.current,
      reviewDataSignatureRef.current,
      reviewStateHydratedRef.current,
      key,
      chatId,
      selectedIdsRef.current,
      editedByIdRef.current,
      linkChoicesByIdRef.current,
    );
    if (!state) return true;
    const persisted = writePersistedReviewState(key, state);
    if (mountedRef.current) {
      setReviewStatePersisted(persisted === "ok");
      if (persisted !== "ok")
        setReviewStateMessage(
          localizeUi(
            persisted === "unavailable"
              ? "ui.longTermMemory.reviewqueue.reviewStateUnavailable"
              : "ui.longTermMemory.reviewqueue.reviewStateSaveFailed",
          ),
        );
    }
    return persisted === "ok";
  };
  const flushReviewState = () => {
    if (persistenceTimerRef.current !== null) {
      window.clearTimeout(persistenceTimerRef.current);
      persistenceTimerRef.current = null;
    }
    return persistReviewStateSnapshot(reviewStateKey, props.chatId);
  };
  persistReviewStateSnapshotRef.current = persistReviewStateSnapshot;
  flushReviewStateRef.current = flushReviewState;

  useEffect(() => {
    setSelectedIds(new Set());
    setEditedById(new Map());
    setLinkChoicesById(new Map());
    setReviewedIds(new Set());
    setResult(null);
    setReviewStateHydrated(null);
    setReviewStateMessage(null);
    setReviewStateMismatch(false);
    setPreflightRows(new Map());
    setPreflightByDraftId(new Map());
    setPreflightKey(null);
    setDetailsOpen(false);
    setExpandedMutationIds(new Set());
  }, [props.chatId]);
  useEffect(() => {
    if (!review.isSuccess) return;
    cleanupPersistedReviewStates();
  }, [review.isSuccess]);
  useEffect(
    () => () => {
      batchControllerRef.current?.abort();
      batchControllerRef.current = null;
    },
    [],
  );
  useEffect(() => {
    const key = reviewStateKey;
    const chatId = props.chatId;
    return () => {
      if (persistenceTimerRef.current !== null) {
        window.clearTimeout(persistenceTimerRef.current);
        persistenceTimerRef.current = null;
      }
      persistReviewStateSnapshotRef.current(key, chatId);
    };
  }, [props.chatId, reviewStateKey]);
  useEffect(() => {
    const handlePageHide = () => flushReviewStateRef.current();
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []);
  useEffect(() => {
    if (!identityDirtyIds.size && (reviewStatePersisted || (!editedById.size && !linkChoicesById.size))) {
      onSaveRequest?.(null);
      return;
    }
    onSaveRequest?.(async () => {
      for (const save of identitySaveRequestsRef.current.values()) {
        if (!(await save())) return false;
      }
      return flushReviewStateRef.current();
    });
    return () => onSaveRequest?.(null);
  }, [editedById.size, identityDirtyIds.size, linkChoicesById.size, onSaveRequest, reviewStatePersisted]);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );
  useEffect(() => {
    setSourceCollapsed(false);
    setSelectedDraftId(null);
    setDetailsOpen(false);
    setExpandedMutationIds(new Set());
    setPreflightRows(new Map());
    setPreflightByDraftId(new Map());
    setPreflightKey(null);
  }, [effectiveSourceId, selectedReviewSource?.sourceNoteId]);
  useEffect(() => {
    setDetailsOpen(false);
    setExpandedMutationIds(new Set());
    setPreflightRows(new Map());
    setPreflightByDraftId(new Map());
    setPreflightKey(null);
  }, [selectedDraft?.draft.id]);
  useEffect(() => {
    setPreflightRows(new Map());
    setPreflightByDraftId(new Map());
    setPreflightKey(null);
  }, [contextNoteIds, notes.data, notes.isError, notes.isFetching, notes.isSuccess]);

  useEffect(() => {
    if (!review.isSuccess) return;
    if (!reviewDataSignature) {
      setReviewStatePersisted(writePersistedReviewState(reviewStateKey, null) === "ok");
      setReviewStateHydrated(`${reviewStateKey}:empty`);
      return;
    }
    const hydrationKey = `${reviewStateKey}:${reviewDataSignature}`;
    if (reviewStateHydrated === hydrationKey) return;
    if (selectedIds.size || editedById.size || linkChoicesById.size) {
      setSelectedIds(new Set());
      setEditedById(new Map());
      setLinkChoicesById(new Map());
      setReviewStateMismatch(true);
      setReviewStateMessage(localizeUi("ui.longTermMemory.reviewqueue.savedReviewStateDiscarded"));
      setReviewStateHydrated(hydrationKey);
      return;
    }
    const persistedResult = readPersistedReviewState(reviewStateKey, props.chatId ?? null);
    const persisted = persistedResult.state;
    const restoredSelectedIds = new Set<string>();
    const restoredEdits = new Map<string, LtmDraftMutation>();
    const restoredLinkChoices = new Map<string, LtmDraftLinkChoice>();
    let discardedState = false;
    const currentDrafts = new Map(
      review.data.sources.flatMap((source) => source.drafts.map((item) => [item.draft.id, item] as const)),
    );
    for (const [draftId, saved] of Object.entries(persisted?.drafts ?? {})) {
      const current = currentDrafts.get(draftId);
      if (
        !current ||
        current.draft.status !== "pending" ||
        saved.draftFingerprint !== draftReviewFingerprint(current) ||
        saved.contextFingerprint !== draftReviewContextFingerprint(current)
      ) {
        discardedState = true;
        continue;
      }
      const appliedMutationIds = new Set(current.draft.appliedMutationIds ?? []);
      const pendingMutations = current.draft.mutations.filter((mutation) => !appliedMutationIds.has(mutation.id));
      const currentMutationIds = new Set(pendingMutations.map((mutation) => mutation.id));
      const currentMutations = new Map(pendingMutations.map((mutation) => [mutation.id, mutation] as const));
      const savedMutationFingerprints = new Map(saved.mutationFingerprints);
      saved.selectedIds.forEach((id) => {
        if (!currentMutationIds.has(id)) return;
        if (savedMutationFingerprints.get(id) !== mutationFingerprint(currentMutations.get(id)!)) discardedState = true;
        else restoredSelectedIds.add(id);
      });
      for (const [id, mutation] of saved.editedMutations) {
        if (!currentMutationIds.has(id)) continue;
        if (savedMutationFingerprints.get(id) !== mutationFingerprint(currentMutations.get(id)!)) {
          discardedState = true;
          continue;
        }
        const parsed = parsePersistedMutation(mutation);
        if (parsed?.id === id) restoredEdits.set(id, parsed);
        else discardedState = true;
      }
      for (const [key, choice] of saved.linkChoices ?? []) {
        const parsed = parsePersistedLinkChoice(choice);
        if (!parsed || !currentMutationIds.has(parsed.mutationId)) {
          discardedState = true;
          continue;
        }
        if (
          savedMutationFingerprints.get(parsed.mutationId) !==
          mutationFingerprint(currentMutations.get(parsed.mutationId)!)
        ) {
          discardedState = true;
          continue;
        }
        if (parsed.mutationId === key.split("\u0000", 1)[0]) restoredLinkChoices.set(key, parsed);
        else discardedState = true;
      }
    }
    setSelectedIds(restoredSelectedIds);
    setEditedById(restoredEdits);
    setLinkChoicesById(restoredLinkChoices);
    setReviewStateMessage(
      persistedResult.error
        ? localizeUi(
            persistedResult.error === "unavailable"
              ? "ui.longTermMemory.reviewqueue.reviewStateUnavailable"
              : "ui.longTermMemory.reviewqueue.reviewStateSaveFailed",
          )
        : discardedState
          ? localizeUi("ui.longTermMemory.reviewqueue.savedReviewStateDiscarded")
          : null,
    );
    setReviewStatePersisted(!discardedState && !persistedResult.error);
    setReviewStateMismatch(discardedState);
    setReviewStateHydrated(hydrationKey);
  }, [
    localizeUi,
    props.chatId,
    review.isSuccess,
    review.data,
    reviewDataSignature,
    reviewStateHydrated,
    reviewStateKey,
    selectedIds.size,
    editedById.size,
    linkChoicesById.size,
  ]);

  useEffect(() => {
    if (!review.isSuccess || !reviewDataSignature || reviewStateHydrated !== `${reviewStateKey}:${reviewDataSignature}`)
      return;
    if (persistenceTimerRef.current !== null) window.clearTimeout(persistenceTimerRef.current);
    persistenceTimerRef.current = window.setTimeout(() => {
      persistenceTimerRef.current = null;
      flushReviewStateRef.current();
    }, 250);
    return () => {
      if (persistenceTimerRef.current !== null) {
        window.clearTimeout(persistenceTimerRef.current);
        persistenceTimerRef.current = null;
      }
    };
  }, [
    editedById,
    linkChoicesById,
    review.isSuccess,
    reviewDataSignature,
    reviewStateHydrated,
    reviewStateKey,
    selectedIds,
  ]);

  const { rowByMutationId, rows } = useMemo(() => buildReviewRows(review.data), [review.data]);
  const mutationDisplayLabels = useMemo(
    () =>
      new Map(
        rows.flatMap((row) => [
          [row.mutation.id, mutationDisplayLabel(row.mutation, noteById, localizeUi)] as const,
          ...(row.mutation.kind === "create_note"
            ? [
                [
                  row.mutation.note.id,
                  row.mutation.note.title || localizeUi("ui.longTermMemory.reviewqueue.thisMemory"),
                ] as const,
              ]
            : []),
        ]),
      ),
    [localizeUi, noteById, rows],
  );
  const replacementEntries = useMemo(() => {
    const replacements = new Map<string, string>([
      ...[...noteById].map(
        ([id, note]) =>
          [
            id,
            noteDisplayTitle(
              note,
              note.type === "source"
                ? localizeUi("ui.longTermMemory.reviewqueue.thisSource")
                : localizeUi("ui.longTermMemory.reviewqueue.thisMemory"),
            ),
          ] as const,
      ),
      ...mutationDisplayLabels,
    ]);
    const ids = [...replacements.keys()].sort((left, right) => right.length - left.length);
    return {
      replacements,
      pattern: ids.length
        ? new RegExp(ids.map((id) => id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|"), "gu")
        : undefined,
    };
  }, [localizeUi, mutationDisplayLabels, noteById]);
  const humanizeText = (text: string) =>
    humanizeReviewText(
      text,
      noteById,
      replacementEntries.pattern,
      replacementEntries.replacements,
      localizeUi("ui.longTermMemory.reviewqueue.sourcePrefix"),
      missingContextTitle,
    );
  // Row text depends on the mutation, the notes, the language and the row's projection state, not on the
  // keystroke being typed into another row, so a row keeps its text until one of those changes.
  const rowTextCache = useMemo(
    () => new Map<string, { mutation: LtmDraftMutation; variant: string; changeSummary: string; evidence: string }>(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- replacementEntries and missingContextTitle stand for humanizeText's inputs
    [localizeUi, noteById, replacementEntries, missingContextTitle, rows],
  );
  const reviewDraftTitle = (item: LtmDraftReviewDraft) => draftDisplayTitle(item, localizeUi);
  useEffect(
    () =>
      onDirtyChange?.(
        reviewStateMismatch ||
          identityDirtyIds.size > 0 ||
          (!reviewStatePersisted && (editedById.size > 0 || linkChoicesById.size > 0)),
      ),
    [
      editedById.size,
      identityDirtyIds.size,
      linkChoicesById.size,
      onDirtyChange,
      reviewStateMismatch,
      reviewStatePersisted,
    ],
  );
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const sourceRows = useMemo(
    () => rows.filter((row) => row.sourceNoteId === effectiveSourceId),
    [effectiveSourceId, rows],
  );
  const activeDraftRows = useMemo(
    () => sourceRows.filter((row) => row.draftId === selectedDraft?.draft.id),
    [selectedDraft?.draft.id, sourceRows],
  );
  const dependencyCounts = useMemo(
    () =>
      new Map(
        activeDraftRows.map((row) => [
          row.mutation.id,
          Math.max(0, acceptedMutationIds(activeDraftRows, [row.mutation.id]).size - 1),
        ]),
      ),
    [activeDraftRows],
  );
  const selectedRows = activeDraftRows.filter((row) => selectedIds.has(row.mutation.id));
  const eligibleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const source of review.data?.sources ?? []) {
      if (!noteById.has(source.sourceNoteId)) continue;
      for (const item of source.drafts) {
        if (item.freshness !== "fresh" || item.blockReasons.length) continue;
        for (const mutation of item.draft.mutations) {
          if (!item.draft.appliedMutationIds?.includes(mutation.id)) ids.add(mutation.id);
        }
      }
    }
    return ids;
  }, [noteById, review.data]);
  const eligibleSelectedRows = selectedRows.filter((row) => eligibleIds.has(row.mutation.id));
  const skippableDraftIds = useMemo(
    () =>
      new Set(
        (review.data?.sources ?? []).flatMap((source) =>
          source.drafts.filter((item) => item.draft.status === "pending").map((item) => item.draft.id),
        ),
      ),
    [review.data],
  );
  const skippableSelectedRows = selectedRows.filter((row) => skippableDraftIds.has(row.draftId));
  const invalidSelectedEdits = eligibleSelectedRows.filter((row) => {
    const edited = editedById.get(row.mutation.id);
    return edited ? !selectedEditIsValid(edited) : false;
  });
  // Why the batch Accept is off, when the bar itself does not already say so.
  const batchAcceptReason = invalidSelectedEdits.length
    ? localizeUi(
        selectLtmPluralForm(locale, invalidSelectedEdits.length) === "one"
          ? "ui.longTermMemory.reviewqueue.invalidEditedMutationOne"
          : "ui.longTermMemory.reviewqueue.invalidEditedMutationOther",
        {
          count: invalidSelectedEdits.length,
          labels: invalidSelectedEdits
            .map(
              (row) =>
                mutationDisplayLabels.get(row.mutation.id) ?? localizeUi("ui.longTermMemory.reviewqueue.editedChange"),
            )
            .join(", "),
        },
      )
    : selectedRows.length && !eligibleSelectedRows.length && reviewContextReady
      ? localizeUi("ui.longTermMemory.reviewqueue.acceptNoEligibleSelection")
      : null;
  const allSelected = activeDraftRows.length > 0 && selectedRows.length === activeDraftRows.length;
  const someSelected = selectedRows.length > 0 && !allSelected;
  const reviewMutationIds = useMemo(
    () =>
      new Set(
        review.data?.sources.flatMap((source) =>
          source.drafts.flatMap((item) =>
            item.draft.mutations
              .filter((mutation) => !item.draft.appliedMutationIds?.includes(mutation.id))
              .map((mutation) => mutation.id),
          ),
        ) ?? [],
      ),
    [review.data],
  );
  const reviewProgress = {
    sources: review.data?.counts.sources ?? 0,
    pending: reviewMutationIds.size,
    ready: eligibleIds.size,
    blocked:
      review.data?.sources.reduce(
        (count, source) =>
          count +
          source.drafts.filter(
            (item) => item.blockReasons.length || (reviewContextReady && !noteById.has(source.sourceNoteId)),
          ).length,
        0,
      ) ?? 0,
    reviewed: reviewedIds.size,
    remaining: Math.max(
      0,
      (review.data?.counts.mutations ?? 0) - [...reviewedIds].filter((id) => reviewMutationIds.has(id)).length,
    ),
  };
  const preflightApplyDisabled = result?.phase === "preflight" && result.ready === 0;
  const batchAcceptDisabled = !eligibleSelectedRows.length || invalidSelectedEdits.length > 0 || preflightApplyDisabled;
  const runBusy = !reviewContextReady || running !== null;

  const clearPreflight = () => {
    setPreflightRows(new Map());
    setPreflightByDraftId(new Map());
    setPreflightKey(null);
    // A preflight summary goes stale with the selection or an edit. A finished run's result, with its
    // failures and index-rebuild warning, stays until the next run.
    setResult((current) => (current?.phase === "preflight" ? null : current));
  };

  const toggleSelection = (id: string) => {
    clearPreflight();
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateMutation = (original: LtmDraftMutation, next: LtmDraftMutation, forceEdit = false) => {
    setEditedById((current) => {
      const updated = new Map(current);
      if (!forceEdit && sameMutation(original, next)) updated.delete(original.id);
      else updated.set(original.id, next);
      return updated;
    });
    clearPreflight();
  };

  const updateLinkChoice = (
    mutation: LtmDraftMutation,
    diagnostic: AmbiguousLinkDiagnostic,
    selectedTarget: string | null,
  ) => {
    const details = ambiguousLinkDetails(diagnostic);
    if (!details) return;
    const key = linkChoiceKey(mutation.id, details.linkTarget, details.linkRelation);
    setLinkChoicesById((current) => {
      const next = new Map(current);
      if (selectedTarget) {
        next.set(key, {
          mutationId: mutation.id,
          linkTarget: details.linkTarget,
          linkRelation: details.linkRelation as LtmDraftLinkChoice["linkRelation"],
          selectedTarget,
        });
      } else next.delete(key);
      return next;
    });
    clearPreflight();
  };

  const invalidClosureEditIds = (applicableRows: readonly ReviewRow[], allRows: readonly ReviewRow[] = rows) => {
    const invalidIds: string[] = [];
    for (const [draftId, selectedDraftRows] of groupByDraft(applicableRows)) {
      const draftRows = allRows
        .filter((row) => row.draftId === draftId)
        .map((row) => ({
          ...row,
          mutation: editedById.get(row.mutation.id) ?? row.mutation,
        }));
      const acceptedIds = acceptedMutationIds(
        draftRows,
        selectedDraftRows.map((row) => row.mutation.id),
      );
      for (const id of acceptedIds) {
        const edited = editedById.get(id);
        if (edited && !selectedEditIsValid(edited)) invalidIds.push(id);
      }
    }
    return invalidIds;
  };

  const buildAcceptRequests = (applicableRows: readonly ReviewRow[], allRows: readonly ReviewRow[]): AcceptRequest[] =>
    [...groupByDraft(applicableRows)].map(([draftId, selectedDraftRows]) => {
      const draftRows = allRows
        .filter((row) => row.draftId === draftId)
        .map((row) => ({ ...row, mutation: editedById.get(row.mutation.id) ?? row.mutation }));
      const mutationIds = [
        ...acceptedMutationIds(
          draftRows,
          selectedDraftRows.map((row) => row.mutation.id),
        ),
      ].sort();
      return {
        draftId,
        mutationIds,
        editedMutations: [...editedById].filter(([id]) => mutationIds.includes(id)).map(([, edited]) => edited),
        linkChoices: [...linkChoicesById]
          .filter(([, choice]) => mutationIds.includes(choice.mutationId))
          .map(([, choice]) => choice),
      };
    });

  const acceptRequestKey = (requests: AcceptRequest[]) =>
    JSON.stringify(
      requests.map((request) => ({
        draftId: request.draftId,
        mutationIds: request.mutationIds,
        editedMutations: request.editedMutations,
        linkChoices: request.linkChoices,
      })),
    );

  const confirmDiscard = async (applicableRows: readonly ReviewRow[]) => {
    const dependentCopy = localizeUi("ui.longTermMemory.reviewqueue.discardDependentWarning");
    const message = localizeUi(
      applicableRows.length === 1
        ? "ui.longTermMemory.reviewqueue.discardProposalDescription"
        : "ui.longTermMemory.reviewqueue.discardSelectedDescription",
      {
        count: applicableRows.length,
        title: mutationDisplayLabel(applicableRows[0]?.mutation, noteById, localizeUi),
        dependent: dependentCopy,
      },
    );
    return props.confirmAction
      ? props.confirmAction({
          title: localizeUi("ui.longTermMemory.reviewqueue.discardProposalTitle"),
          message,
          confirmLabel: localizeUi("ui.longTermMemory.reviewqueue.discard"),
          tone: "destructive",
        })
      : window.confirm(`${localizeUi("ui.longTermMemory.reviewqueue.discardProposalTitle")}\n\n${message}`);
  };

  const runBatch = async (
    action: ReviewAction,
    explicitRows?: ReviewRow[],
    allRows: readonly ReviewRow[] = rows,
    allRowByMutationId: ReadonlyMap<string, ReviewRow> = rowByMutationId,
    retrying = false,
  ) => {
    const applicableRows = explicitRows ?? (action === "accept" ? eligibleSelectedRows : skippableSelectedRows);
    // The run controls use `aria-disabled` so they keep focus; this blocks a second run that
    // starts before React re-renders them.
    if (!applicableRows.length || batchControllerRef.current) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const actedIds = new Set(applicableRows.map((row) => row.mutation.id));
    const rowToggles = [
      ...(reviewRef.current?.querySelectorAll<HTMLElement>("[data-ltm-review-mutation-toggle]") ?? []),
    ].filter(focusable);
    const focusIndex = Math.max(
      0,
      rowToggles.findIndex((toggle) => actedIds.has(toggle.dataset.ltmReviewMutationToggle ?? "")),
    );
    if (action === "accept" && (!reviewContextReady || applicableRows.some((row) => !noteById.has(row.sourceNoteId))))
      return;
    const invalidEditIds = action === "accept" ? invalidClosureEditIds(applicableRows, allRows) : [];
    if (invalidEditIds.length) {
      setResult({
        action: "accepted",
        phase: "preflight",
        ready: 0,
        completed: 0,
        failed: invalidEditIds.length,
        remaining: applicableRows.length,
        autoIncluded: 0,
        indexRebuildFailures: [],
        messages: [
          localizeUi(
            selectLtmPluralForm(locale, invalidEditIds.length) === "one"
              ? "ui.longTermMemory.reviewqueue.invalidEditedMutationOne"
              : "ui.longTermMemory.reviewqueue.invalidEditedMutationOther",
            {
              count: invalidEditIds.length,
              labels: invalidEditIds
                .map((id) => mutationDisplayLabels.get(id) ?? localizeUi("ui.longTermMemory.reviewqueue.editedChange"))
                .join(", "),
            },
          ),
        ],
        cascadeMutationLabels: [],
        savedMemoryIds: [],
        failedMutationIds: invalidEditIds,
        failedDraftIds: [...new Set(applicableRows.map((row) => row.draftId))],
        completedMutationIds: [],
        blockedMutationIds: [],
      });
      return;
    }
    if (action === "skip" && !(await confirmDiscard(applicableRows))) return;
    // A second Skip can confirm while the first run already started.
    if (batchControllerRef.current) return;
    runFocusRef.current = { trigger, index: focusIndex, acted: actedIds };
    const acceptRequests = action === "accept" ? buildAcceptRequests(applicableRows, allRows) : [];
    const requestKey = action === "accept" ? acceptRequestKey(acceptRequests) : null;
    const controller = new AbortController();
    batchControllerRef.current = controller;
    if (action === "accept" && preflightKey !== requestKey) {
      setRunning("accept");
      setAcceptPhase("check");
      setRunMutationIds(actedIds);
      setResult(null);
      const preflights = new Map<string, LtmDraftPreflightResponse>();
      const nextRows = new Map<string, PreflightRow>();
      const blockedMutationIds = new Set<string>();
      const messages: string[] = [];
      const failedMutationIds = new Set<string>();
      try {
        for (const requestBody of acceptRequests) {
          try {
            const response = await request<LtmDraftPreflightResponse>(
              `/drafts/${requestBody.draftId}/preflight`,
              "POST",
              {
                mutationIds: requestBody.mutationIds,
                ...(requestBody.editedMutations.length ? { editedMutations: requestBody.editedMutations } : {}),
                ...(requestBody.linkChoices.length ? { linkChoices: requestBody.linkChoices } : {}),
                bulk: requestBody.mutationIds.length > 1,
              },
              controller.signal,
            );
            preflights.set(requestBody.draftId, response);
            response.rows.forEach((row) => nextRows.set(row.mutationId, row));
            response.blockedMutationIds.forEach((id) => blockedMutationIds.add(id));
          } catch (error) {
            if (isAbortError(error)) return;
            requestBody.mutationIds.forEach((id) => failedMutationIds.add(id));
            messages.push(
              localizeUi("ui.longTermMemory.reviewqueue.draftActionFailed", {
                message: errorMessage(error, localizeUi("ui.longTermMemory.reviewqueue.requestFailed")),
              }),
            );
          }
          if (controller.signal.aborted) return;
        }
        setPreflightByDraftId(preflights);
        setPreflightRows(nextRows);
        setPreflightKey(messages.length ? null : requestKey);
        setExpandedMutationIds(
          new Set([...nextRows.values()].filter((row) => row.status === "blocked").map((row) => row.mutationId)),
        );
        setResult({
          action: "accepted",
          phase: "preflight",
          ready: [...preflights.values()].reduce((sum, response) => sum + response.readyMutationIds.length, 0),
          completed: 0,
          failed: failedMutationIds.size,
          remaining: applicableRows.length,
          autoIncluded: [...preflights.values()].reduce(
            (sum, response) => sum + response.autoIncludedMutationIds.length,
            0,
          ),
          indexRebuildFailures: [],
          messages: retrying
            ? [localizeUi("ui.longTermMemory.reviewqueue.retryPreflightReady"), ...messages]
            : messages,
          cascadeMutationLabels: [],
          savedMemoryIds: [],
          failedMutationIds: [...failedMutationIds],
          failedDraftIds: [],
          completedMutationIds: [],
          blockedMutationIds: [...blockedMutationIds],
        });
      } finally {
        if (!controller.signal.aborted && batchControllerRef.current === controller) {
          batchControllerRef.current = null;
          setRunning(null);
        }
      }
      return;
    }
    setRunning(action);
    setAcceptPhase("apply");
    setRunMutationIds(actedIds);
    setResult(null);
    const completedIds = new Set<string>();
    const remainingIds = new Set<string>();
    const failedIds = new Set<string>();
    const failedDraftIds = new Set<string>();
    const autoIncludedIds = new Set<string>();
    const indexRebuildFailures: string[] = [];
    const messages: string[] = [];
    const cascadeMutationLabels = new Set<string>();
    const blockedMutationIds = new Set<string>();
    try {
      for (const [draftId, draftRows] of groupByDraft(applicableRows)) {
        const mutationIds = draftRows.map((row) => row.mutation.id);
        try {
          if (action === "accept") {
            const preflight = preflightByDraftId.get(draftId);
            if (!preflight) throw new Error(localizeUi("ui.longTermMemory.reviewqueue.preflightMissing"));
            preflight.blockedMutationIds.forEach((id) => blockedMutationIds.add(id));
            const readyIds = new Set(preflight.readyMutationIds);
            if (!readyIds.size) continue;
            const requestBody = acceptRequests.find((request) => request.draftId === draftId)!;
            const response = await request<ApplyDraftResponse>(
              `/drafts/${draftId}/accept`,
              "POST",
              {
                mutationIds: [...readyIds],
                ...(requestBody.editedMutations.length
                  ? { editedMutations: requestBody.editedMutations.filter((mutation) => readyIds.has(mutation.id)) }
                  : {}),
                ...(requestBody.linkChoices.length
                  ? { linkChoices: requestBody.linkChoices.filter((choice) => readyIds.has(choice.mutationId)) }
                  : {}),
              },
              controller.signal,
            );
            const applied = new Set(response.appliedMutationIds);
            const skipped = new Set(response.skippedMutationIds);
            response.skippedMutationIds.forEach((id) => remainingIds.add(id));
            readyIds.forEach((id) => {
              if (applied.has(id)) completedIds.add(id);
              else if (skipped.has(id)) return;
              else failedIds.add(id);
            });
            response.autoIncludedMutationIds.forEach((id) => autoIncludedIds.add(id));
            response.autoIncludedMutationIds.forEach((id) => {
              if (applied.has(id)) completedIds.add(id);
            });
            if (response.indexRebuild.status === "failed") indexRebuildFailures.push(response.indexRebuild.error);
          } else {
            const response = await request<SkipDraftResponse>(
              `/drafts/${draftId}/skip`,
              "POST",
              { mutationIds },
              controller.signal,
            );
            const deleted = new Set(response.mutationIds);
            response.mutationIds.forEach((id) => {
              completedIds.add(id);
              if (!mutationIds.includes(id)) {
                cascadeMutationLabels.add(
                  mutationDisplayLabels.get(id) ?? localizeUi("ui.longTermMemory.reviewqueue.dependentChange"),
                );
              }
            });
            mutationIds.forEach((id) => {
              if (!deleted.has(id)) failedIds.add(id);
            });
          }
          if (mutationIds.some((id) => failedIds.has(id))) failedDraftIds.add(draftId);
        } catch (error) {
          if (isAbortError(error)) return;
          const failedRequestIds =
            action === "accept"
              ? new Set(preflightByDraftId.get(draftId)?.readyMutationIds ?? [])
              : new Set(mutationIds);
          failedRequestIds.forEach((id) => failedIds.add(id));
          if (failedRequestIds.size) failedDraftIds.add(draftId);
          messages.push(
            localizeUi("ui.longTermMemory.reviewqueue.draftActionFailed", {
              message: errorMessage(error, localizeUi("ui.longTermMemory.reviewqueue.requestFailed")),
            }),
          );
        }
        if (controller.signal.aborted) return;
      }
      setSelectedIds((current) => {
        const next = new Set(current);
        completedIds.forEach((id) => next.delete(id));
        return next;
      });
      setEditedById((current) => {
        const next = new Map(current);
        completedIds.forEach((id) => next.delete(id));
        return next;
      });
      setReviewedIds((current) => new Set([...current, ...completedIds]));
      setPreflightKey(null);
      setResult({
        action: action === "accept" ? "accepted" : "skipped",
        phase: "complete",
        ready: 0,
        completed: completedIds.size,
        failed: failedIds.size,
        remaining: remainingIds.size,
        autoIncluded: autoIncludedIds.size,
        indexRebuildFailures,
        messages,
        cascadeMutationLabels: [...cascadeMutationLabels],
        failedMutationIds: [...failedIds],
        failedDraftIds: [...failedDraftIds],
        completedMutationIds: [...completedIds],
        savedMemoryIds:
          action === "accept"
            ? [
                ...new Set(
                  [...completedIds].flatMap((id) => {
                    const currentRow = allRowByMutationId.get(id);
                    return currentRow ? [currentRow.targetId] : [];
                  }),
                ),
              ]
            : [],
        blockedMutationIds: [...blockedMutationIds],
      });
      if (completedIds.size) {
        await invalidateLtmQueries(queryClient, [
          queryKeys.review,
          queryKeys.pendingDrafts,
          queryKeys.scopeTargetsRoot,
          queryKeys.localCharactersRoot,
          ...(action === "accept" ? [queryKeys.notes, queryKeys.status, queryKeys.integrity, queryKeys.preview] : []),
        ]);
      }
    } finally {
      if (!controller.signal.aborted && batchControllerRef.current === controller) {
        batchControllerRef.current = null;
        setRunning(null);
      }
    }
  };

  const retryInFlightRef = useRef(false);
  const retryFailed = async () => {
    if (!result?.failedMutationIds.length || running !== null || retryInFlightRef.current) return;
    const action = result.action === "accepted" ? "accept" : "skip";
    retryInFlightRef.current = true;
    try {
      const refreshed = await review.refetch();
      if (refreshed.error) throw refreshed.error;
      const refreshedRows = buildReviewRows(refreshed.data);
      const pendingMutationIds = new Set(
        refreshed.data?.sources.flatMap((source) =>
          source.drafts
            .filter((item) => item.draft.status === "pending")
            .flatMap((item) =>
              item.draft.mutations
                .filter((mutation) => !item.draft.appliedMutationIds?.includes(mutation.id))
                .map((mutation) => mutation.id),
            ),
        ) ?? [],
      );
      const failedRows = result.failedMutationIds
        .filter((id) => pendingMutationIds.has(id))
        .map((id) => refreshedRows.rowByMutationId.get(id))
        .filter((row): row is ReviewRow => Boolean(row));
      if (!failedRows.length) {
        setResult((current) =>
          current
            ? {
                ...current,
                messages: [...current.messages, localizeUi("ui.longTermMemory.reviewqueue.retryNoLongerNeeded")],
              }
            : current,
        );
        return;
      }
      setSelectedIds((current) => new Set([...current, ...failedRows.map((row) => row.mutation.id)]));
      const pendingRows = refreshedRows.rows.filter((row) => pendingMutationIds.has(row.mutation.id));
      await runBatch(action, failedRows, pendingRows, refreshedRows.rowByMutationId, true);
    } catch (error) {
      setResult((current) =>
        current
          ? {
              ...current,
              messages: [
                ...current.messages,
                localizeUi("ui.longTermMemory.reviewqueue.draftActionFailed", {
                  message: errorMessage(error, localizeUi("ui.longTermMemory.reviewqueue.requestFailed")),
                }),
              ],
            }
          : current,
      );
    } finally {
      retryInFlightRef.current = false;
    }
  };

  const reviewFailed = () => {
    if (!result?.failedDraftIds.length || running !== null) return;
    const row = rows.find((candidate) => result.failedDraftIds.includes(candidate.draftId));
    if (!row) return;
    setSelectedSourceId(row.sourceNoteId);
    setSelectedDraftId(row.draftId);
    setSourceCollapsed(false);
    setMobilePaneAndFocus("workbench");
  };

  const dismissReport = async (item: LtmDraftReviewDraft) => {
    if (dismissingId !== null || running !== null) return;
    const draftId = item.draft.id;
    const invalidated = item.draft.status === "invalidated";
    setDismissingId(draftId);
    try {
      if (invalidated) {
        const title = localizeUi("ui.longTermMemory.reviewqueue.discardInvalidatedDraft");
        const message = localizeUi("ui.longTermMemory.reviewqueue.discardInvalidatedDraftDescription", {
          title: reviewDraftTitle(item),
        });
        const confirmed = props.confirmAction
          ? await props.confirmAction({ title, message, confirmLabel: title, tone: "destructive" })
          : window.confirm(message);
        if (!confirmed) return;
      }
      setResult(null);
      await request(`/drafts/${draftId}`, "DELETE");
      await invalidateLtmQueries(queryClient, [queryKeys.review, queryKeys.pendingDrafts]);
    } catch (error) {
      setResult({
        action: "skipped",
        phase: "complete",
        ready: 0,
        completed: 0,
        failed: 1,
        remaining: 0,
        autoIncluded: 0,
        indexRebuildFailures: [],
        messages: [
          localizeUi(
            invalidated
              ? "ui.longTermMemory.reviewqueue.draftDiscardFailed"
              : "ui.longTermMemory.reviewqueue.reportDismissalFailed",
            {
              message: errorMessage(error, localizeUi("ui.longTermMemory.reviewqueue.requestFailed")),
            },
          ),
        ],
        cascadeMutationLabels: [],
        savedMemoryIds: [],
        failedMutationIds: [],
        failedDraftIds: [],
        completedMutationIds: [],
        blockedMutationIds: [],
      });
    } finally {
      setDismissingId(null);
    }
  };

  const deleteRejectedSuggestion = async (suggestion: LtmRejectedSuggestion) => {
    const title = noteById.get(suggestion.source.sourceNoteId)?.title ?? missingContextTitle;
    const confirmed = props.confirmAction
      ? await props.confirmAction({
          title: localizeUi("ui.longTermMemory.reviewqueue.deleteRejectedSuggestion"),
          message: localizeUi("ui.longTermMemory.reviewqueue.deleteRejectedSuggestionDescription", { title }),
          confirmLabel: localizeUi("ui.longTermMemory.reviewqueue.delete"),
          tone: "destructive",
        })
      : window.confirm(localizeUi("ui.longTermMemory.reviewqueue.deleteRejectedSuggestionDescription", { title }));
    if (!confirmed) return;
    setDismissingId(suggestion.id);
    setDeleteSuggestionError("");
    try {
      await request(`/rejected-suggestions/${encodeURIComponent(suggestion.id)}`, "DELETE");
      // A saved identity choice also drops its pending recovery draft on delete.
      await invalidateLtmQueries(queryClient, [
        queryKeys.rejectedSuggestions,
        ...(suggestion.identityResolution
          ? [queryKeys.savedIdentityChoices, queryKeys.review, queryKeys.pendingDrafts]
          : []),
      ]);
    } catch (error) {
      setDeleteSuggestionError(errorMessage(error, localizeUi("ui.longTermMemory.reviewqueue.requestFailed")));
    } finally {
      setDismissingId(null);
    }
  };

  const clearRejectedSuggestions = async () => {
    const sourceId = effectiveSourceId;
    const count = sourceRejectedSuggestions.length;
    if (!sourceId || !count || clearingSourceId) return;
    const title = noteDisplayTitle(noteById.get(sourceId), humanizeLabel(sourceId));
    const message = localizeUi("ui.longTermMemory.reviewqueue.clearRejectedSuggestionsDescription", {
      title,
      count,
    });
    const confirmed = props.confirmAction
      ? await props.confirmAction({
          title: localizeUi("ui.longTermMemory.reviewqueue.clearRejectedSuggestions"),
          message,
          confirmLabel: localizeUi("ui.longTermMemory.reviewqueue.clearRejectedSuggestions"),
          tone: "destructive",
        })
      : window.confirm(message);
    if (!confirmed) return;
    setClearingSourceId(sourceId);
    setDeleteSuggestionError("");
    setRejectedSuggestionsMessage("");
    try {
      const result = await request<LtmRejectedSuggestionsClearResponse>(
        `/rejected-suggestions?sourceNoteId=${encodeURIComponent(sourceId)}`,
        "DELETE",
      );
      await invalidateLtmQueries(queryClient, [queryKeys.rejectedSuggestions]);
      setRejectedSuggestionsMessage(
        localizeUi(
          selectLtmPluralForm(locale, result.deletedCount) === "one"
            ? "ui.longTermMemory.reviewqueue.rejectedSuggestionsClearedOne"
            : "ui.longTermMemory.reviewqueue.rejectedSuggestionsClearedOther",
          { count: result.deletedCount, title },
        ),
      );
    } catch (error) {
      setDeleteSuggestionError(errorMessage(error, localizeUi("ui.longTermMemory.reviewqueue.requestFailed")));
    } finally {
      setClearingSourceId(null);
    }
  };

  const reextractSource = async () => {
    if (!effectiveSourceId || extractingSourceId) return;
    const sourceId = effectiveSourceId;
    const editedSourceMutationIds = new Set(
      [...editedById.keys()].filter((id) => rowByMutationId.get(id)?.sourceNoteId === sourceId),
    );
    const sourceMutationIds = new Set(
      rows.filter((row) => row.sourceNoteId === sourceId).map((row) => row.mutation.id),
    );
    if (editedSourceMutationIds.size) {
      const action = localizeUi("ui.longTermMemory.reviewqueue.reExtractSource");
      const options = {
        title: localizeUi("ui.longTermMemory.longtermmemorydetail.discardUnsavedChanges"),
        message: localizeUi("ui.longTermMemory.memoryvault.changesLostBeforeAction", { action }),
        confirmLabel: localizeUi("ui.longTermMemory.longtermmemorydetail.discardChanges"),
        tone: "destructive" as const,
      };
      const confirmed = props.confirmAction
        ? await props.confirmAction(options)
        : window.confirm(
            localizeUi("ui.longTermMemory.longtermmemorydetail.confirmationWithMessage", {
              title: options.title,
              message: options.message,
            }),
          );
      if (!confirmed) return;
    }
    setExtractingSourceId(sourceId);
    setExtractionMessage(null);
    try {
      await request(`/notes/${encodeURIComponent(sourceId)}/extract`, "POST", {});
      await invalidateLtmQueries(queryClient, [
        queryKeys.review,
        queryKeys.pendingDrafts,
        queryKeys.rejectedSuggestions,
      ]);
      if (editedSourceMutationIds.size) {
        setEditedById((current) => {
          const next = new Map(current);
          editedSourceMutationIds.forEach((id) => next.delete(id));
          return next;
        });
      }
      setSelectedIds((current) => {
        const next = new Set(current);
        sourceMutationIds.forEach((id) => next.delete(id));
        return next;
      });
      setExtractionMessage({
        tone: "success",
        text: localizeUi("ui.longTermMemory.reviewqueue.sourceReextracted"),
      });
    } catch (error) {
      setExtractionMessage({
        tone: "danger",
        text: errorMessage(error, localizeUi("ui.longTermMemory.reviewqueue.sourceReextractionFailed")),
      });
    } finally {
      setExtractingSourceId(null);
    }
  };

  const renderRow = (row: ReviewRow, projectionStale = false) => {
    const mutation = editedById.get(row.mutation.id) ?? row.mutation;
    const targetExists = noteById.has(row.targetId);
    const canEditTitle =
      mutation.kind === "create_note" &&
      (row.disposition === "new" || (targetExists && !noteById.get(row.targetId)?.title));
    const edited = editedById.has(row.mutation.id);
    const hideProjection = edited || projectionStale;
    const valid = selectedEditIsValid(mutation);
    // Shown on the row itself, so a collapsed row still says why its Accept is off.
    const acceptReason = valid
      ? null
      : localizeUi(
          mutationHasOverlongText(mutation)
            ? "ui.longTermMemory.reviewqueue.acceptNeedsShorterText"
            : "ui.longTermMemory.reviewqueue.acceptNeedsText",
        );
    const acceptReasonId = `ltm-review-accept-reason-${row.mutation.id}`;
    const previewChanges = hideProjection ? [] : row.changes;
    const expanded = expandedMutationIds.has(row.mutation.id);
    const preflight = preflightRows.get(row.mutation.id);
    const rowPreflight = preflightByDraftId.get(row.draftId)?.selectedMutationIds.includes(row.mutation.id)
      ? preflight
      : undefined;
    const preflightBlocked = rowPreflight?.status === "blocked";
    const acceptDisabled = !eligibleIds.has(row.mutation.id) || !valid || preflightBlocked;
    // The request key walks every row and serialises the edits, so it is built only for a row whose preflight
    // came back ready, not for every row on every keystroke.
    // ponytail: rows with a ready preflight still cost rows x rows per render; past a few hundred ready rows,
    // build one key map per draft per render and look each row up in it.
    const preflightReady =
      rowPreflight?.status === "ready" &&
      preflightKey !== null &&
      preflightKey === acceptRequestKey(buildAcceptRequests([row], rows));
    const dependencyCount = dependencyCounts.get(row.mutation.id) ?? 0;
    const mutationLabel = localizeUi(mutationLabels[mutation.kind]);
    const dispositionLabel = localizeUi(dispositionLabels[row.disposition]);
    const targetNote = mutation.kind === "create_note" ? mutation.note : noteById.get(row.targetId);
    const targetTitle = noteDisplayTitle(targetNote, row.targetTitle ?? missingContextTitle);
    const targetBody = noteBody(targetNote);
    const targetType =
      noteById.get(row.targetId)?.type ??
      row.targetType ??
      (mutation.kind === "create_note" ? mutation.note.type : undefined);
    const displayTitle =
      mutation.kind === "create_note" && targetType === "character"
        ? localizeUi("ui.longTermMemory.reviewqueue.proposedCharacterMemory", {
            title: targetTitle,
          })
        : targetTitle;
    const previewChange = previewChanges[0];
    const proposedText = mutationProposedText(mutation, noteById);
    const collapsedBody = edited || projectionStale ? proposedText : targetBody;
    const variant = `${edited}:${projectionStale}`;
    let rowText = rowTextCache.get(row.mutation.id);
    if (rowText?.mutation !== mutation || rowText.variant !== variant) {
      const changeSummary = edited
        ? localizeUi("ui.longTermMemory.reviewqueue.editedProposalSummary", {
            value: proposedText || localizeUi("ui.longTermMemory.reviewqueue.editedChange"),
          })
        : projectionStale
          ? localizeUi("ui.longTermMemory.reviewqueue.editedProjectionSummary")
          : previewChange
            ? localizeUi("ui.longTermMemory.reviewqueue.changeSummary", {
                before: previewChange.before || localizeUi("ui.longTermMemory.reviewqueue.newValue"),
                after: previewChange.after,
              })
            : localizeUi("ui.longTermMemory.reviewqueue.proposedSummary", {
                value: proposedText || mutation.summary,
              });
      const evidence = `${humanizeText(row.mutation.evidence[0] ?? localizeUi("ui.longTermMemory.reviewqueue.noEvidence"))}${
        row.mutation.evidence.length > 1
          ? ` ${localizeUi("ui.longTermMemory.reviewqueue.moreEvidence", { count: row.mutation.evidence.length - 1 })}`
          : ""
      }`;
      rowText = { mutation, variant, changeSummary, evidence };
      rowTextCache.set(row.mutation.id, rowText);
    }
    const { changeSummary } = rowText;
    // Only the rows the run covers change their verb, and the run's phase names it.
    const rowRunning = running === "accept" && runMutationIds.has(row.mutation.id);
    const rowActionLabel = rowRunning
      ? localizeUi(
          acceptPhase === "apply"
            ? "ui.longTermMemory.reviewqueue.applyingChange"
            : "ui.longTermMemory.reviewqueue.checkingChange",
          { title: targetTitle },
        )
      : preflightBlocked
        ? localizeUi("ui.longTermMemory.reviewqueue.applyBlockedForTitle", { title: targetTitle })
        : preflightReady
          ? localizeUi("ui.longTermMemory.reviewqueue.applyChangeForTitle", { title: targetTitle })
          : localizeUi("ui.longTermMemory.reviewqueue.reviewChangeForTitle", { title: targetTitle });
    const rowActionText = localizeUi(
      rowRunning
        ? acceptPhase === "apply"
          ? "ui.longTermMemory.reviewqueue.rowApplying"
          : "ui.longTermMemory.reviewqueue.rowChecking"
        : preflightBlocked
          ? "ui.longTermMemory.reviewqueue.rowBlocked"
          : preflightReady
            ? "ui.longTermMemory.reviewqueue.rowApply"
            : "ui.longTermMemory.reviewqueue.rowCheck",
    );
    const importance =
      mutation.kind === "create_note"
        ? importanceOptions.find((value) =>
            Object.values(mutation.note.sections).some((section) => section.importance === value),
          )
        : mutation.kind === "append_section"
          ? mutation.importance
          : mutation.kind === "update_section"
            ? mutation.section.importance
            : undefined;
    return (
      <article
        key={row.mutation.id}
        data-ltm-review-mutation={row.mutation.id}
        className={`rounded-md border border-[var(--border)] px-1 py-3 ${selectedIds.has(row.mutation.id) ? "bg-[var(--accent)]/50" : ""}`}
      >
        <div className="flex min-w-0 items-start gap-2">
          <SelectionCheckbox
            checked={selectedIds.has(row.mutation.id)}
            compact
            label={`${localizeUi("ui.longTermMemory.memoryvault.selectValue1", {
              value1: mutationLabel,
            })}: ${displayTitle}`}
            onChange={() => toggleSelection(row.mutation.id)}
          />
          <button
            type="button"
            data-ltm-review-mutation-toggle={row.mutation.id}
            aria-expanded={expanded}
            onClick={() =>
              setExpandedMutationIds((current) => {
                const next = new Set(current);
                if (next.has(row.mutation.id)) next.delete(row.mutation.id);
                else next.add(row.mutation.id);
                return next;
              })
            }
            aria-controls={expanded ? `ltm-review-mutation-details-${row.mutation.id}` : undefined}
            className="relative min-w-0 flex-1 rounded-md px-2 py-1 pr-8 text-left hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 [--ring:var(--marinara-editor-focus-ring)] focus-visible:ring-[var(--ring)]"
            data-ltm-risk={row.mutation.risk}
            data-ltm-disposition={row.disposition}
          >
            <span className="block text-sm font-semibold">{displayTitle}</span>
            {collapsedBody ? (
              <span className="mt-1 block truncate text-xs text-[var(--foreground)]">{collapsedBody}</span>
            ) : null}
            <span className="mt-1 flex flex-wrap gap-1 text-[0.6875rem]">
              {targetType ? (
                <span
                  data-ltm-review-type={targetType}
                  className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5"
                >
                  {localizedLabel(targetType, localizeUi, labelKeys.noteType)}
                </span>
              ) : null}
              <span
                data-ltm-review-disposition={row.disposition}
                className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5"
              >
                {dispositionLabel}
              </span>
              {mutation.kind !== "create_note" ? (
                <span
                  data-ltm-review-operation={mutation.kind}
                  className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5"
                >
                  {mutationLabel}
                </span>
              ) : null}
              {importance ? (
                <span
                  data-ltm-review-importance={importance}
                  className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5"
                >
                  {localizedLabel(importance, localizeUi, labelKeys.importance)}
                </span>
              ) : null}
              <span className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5">
                {localizedLabel(row.mutation.risk, localizeUi, labelKeys.risk)} /{" "}
                {Math.round(row.mutation.confidence * 100)}
                {localizeUi("ui.longTermMemory.reviewqueue.confidence")}
              </span>
              {dependencyCount ? (
                <span className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5">
                  {localizeUi("ui.longTermMemory.reviewqueue.dependencyHint", {
                    count: dependencyCount,
                    dependency:
                      dependencyCount === 1
                        ? localizeUi("ui.longTermMemory.reviewqueue.dependency")
                        : localizeUi("ui.longTermMemory.reviewqueue.dependencies"),
                  })}
                </span>
              ) : null}
            </span>
            <span data-ltm-review-summary className="mt-3 block space-y-1 text-xs">
              <span className="block font-semibold text-[var(--foreground)]">
                {localizeUi("ui.longTermMemory.reviewqueue.changeLabel")}
              </span>
              <span className="block line-clamp-2 break-words text-[var(--foreground)]">{changeSummary}</span>
            </span>
            <span data-ltm-review-evidence-summary className="mt-2 block space-y-1 text-xs">
              <span className="block font-semibold text-[var(--foreground)]">
                {localizeUi("ui.longTermMemory.reviewqueue.evidenceLabel")}
              </span>
              <span className="block line-clamp-2 break-words text-[var(--foreground)]">{rowText.evidence}</span>
            </span>
            <ChevronRight
              aria-hidden="true"
              size="0.875rem"
              className={`absolute right-2 top-3 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </button>
          <div
            role="group"
            aria-label={localizeUi("ui.longTermMemory.reviewqueue.mutationActions")}
            className="flex shrink-0 flex-col items-end gap-1 pt-1"
          >
            <div className="flex gap-1">
              <button
                type="button"
                data-ltm-control="button"
                data-ltm-review-action={preflightReady ? "apply" : preflightBlocked ? "blocked" : "review"}
                aria-label={rowActionLabel}
                title={rowActionLabel}
                className={`mari-editor-action ${preflightReady ? "mari-editor-action--primary" : ""} ${acceptDisabled || runBusy ? "opacity-50" : ""}`}
                style={{ minHeight: 44, minWidth: 44 }}
                aria-disabled={acceptDisabled || runBusy || undefined}
                aria-describedby={acceptReason ? acceptReasonId : undefined}
                onClick={() => {
                  if (!runBusy && !acceptDisabled) void runBatch("accept", [row]);
                }}
              >
                <Check data-ltm-review-action-icon aria-hidden="true" size="1rem" />
                <span data-ltm-review-action-text>{rowActionText}</span>
              </button>
              <IconButton
                icon={X}
                label={localizeUi("ui.longTermMemory.reviewqueue.discardProposalNamed", {
                  title: targetTitle,
                })}
                iconSize="1rem"
                style={{ height: 44, minHeight: 44, width: 44, minWidth: 44 }}
                className={running !== null ? "opacity-50" : ""}
                disabled={!skippableDraftIds.has(row.draftId)}
                aria-disabled={running !== null || undefined}
                onClick={() => {
                  if (running === null) void runBatch("skip", [row]);
                }}
              />
            </div>
            {running === null && (preflightReady || preflightBlocked) ? (
              <span
                aria-hidden="true"
                data-ltm-review-state-chip={preflightBlocked ? "blocked" : "ready"}
                className={`rounded-full border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5 text-[0.6875rem] font-medium ${
                  preflightBlocked ? "text-[var(--destructive)]" : "text-[var(--foreground)]"
                }`}
              >
                {localizeUi(
                  preflightBlocked
                    ? "ui.longTermMemory.reviewqueue.chipBlocked"
                    : "ui.longTermMemory.reviewqueue.chipReady",
                )}
              </span>
            ) : null}
          </div>
        </div>
        {acceptReason ? (
          <p
            id={acceptReasonId}
            data-ltm-review-accept-reason
            className="mt-2 flex items-start gap-1.5 px-2 text-xs text-[var(--destructive)]"
          >
            <CircleAlert aria-hidden="true" size="0.875rem" className="mt-0.5 shrink-0" />
            {acceptReason}
          </p>
        ) : null}
        {expanded ? (
          <div
            id={`ltm-review-mutation-details-${row.mutation.id}`}
            data-ltm-review-mutation-details
            className="space-y-3 border-t border-[var(--border)]/70 pt-3 text-xs"
          >
            {onOpenMemory && targetExists ? (
              <Button onClick={() => onOpenMemory(row.targetId)}>
                {localizeUi("ui.longTermMemory.reviewqueue.openMemory")}
              </Button>
            ) : null}
            <details data-ltm-review-preview className="text-xs">
              <summary className="min-h-11 cursor-pointer py-3 font-medium">
                {localizeUi("ui.longTermMemory.reviewqueue.evidenceAndPreview")} {row.mutation.evidence.length}{" "}
                {localizeUi("ui.longTermMemory.reviewqueue.evidence")}
                {previewChanges.length
                  ? localizeUi("ui.longTermMemory.reviewqueue.value1Changes", {
                      value1: previewChanges.length,
                    })
                  : ""}
              </summary>
              <div className="mt-2 space-y-2">
                <div data-ltm-review-evidence className="space-y-1">
                  <span className="font-medium">{localizeUi("ui.longTermMemory.reviewqueue.evidence_3ef3540")}</span>
                  {row.mutation.evidence.map((evidence, index) => (
                    <blockquote
                      key={`${evidence}-${index}`}
                      className="break-words border-l border-[var(--border)] py-0.5 pl-3 leading-5 text-[var(--foreground)]"
                    >
                      {humanizeText(evidence)}
                    </blockquote>
                  ))}
                </div>
                {previewChanges.length ? (
                  <div data-ltm-review-changes className="space-y-1">
                    {previewChanges.map((change) => (
                      <p key={`${change.kind}-${change.key}`}>
                        <span className="font-medium">
                          {humanizeLabel(change.kind)} {humanizeLabel(change.key)}:
                        </span>{" "}
                        {change.before
                          ? localizeUi("ui.longTermMemory.reviewqueue.value1", {
                              value1: change.before,
                            })
                          : ""}
                        {change.after}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </details>
            {row.diagnostics.length ? (
              <div
                data-ltm-review-diagnostics
                className="mari-editor-panel mari-editor-panel--soft space-y-1 border-[var(--destructive)]/35 p-3 text-xs text-[var(--destructive)]"
              >
                {row.diagnostics.map((diagnostic, index) => (
                  <p key={`${diagnostic.code}-${index}`} title={humanizeText(diagnostic.message)}>
                    {reviewCodeText(diagnostic.code, diagnostic.message, localizeUi, humanizeText)}
                  </p>
                ))}
              </div>
            ) : null}
            {row.diagnostics.map((diagnostic, index) => (
              <AmbiguousLinkChoice
                key={`${diagnostic.code}-choice-${index}`}
                mutation={mutation}
                diagnostic={diagnostic}
                noteById={noteById}
                explicitTarget={(() => {
                  const details = ambiguousLinkDetails(diagnostic);
                  return details
                    ? linkChoicesById.get(linkChoiceKey(row.mutation.id, details.linkTarget, details.linkRelation))
                        ?.selectedTarget
                    : undefined;
                })()}
                onChange={(next, selectedTarget) => {
                  updateMutation(row.mutation, next);
                  updateLinkChoice(row.mutation, diagnostic, selectedTarget);
                }}
              />
            ))}
            {preflight ? (
              <div
                data-ltm-review-preflight
                role={preflightBlocked ? "alert" : "status"}
                className={`mari-editor-panel mari-editor-panel--soft space-y-2 p-3 text-xs ${
                  preflightBlocked ? "border-[var(--destructive)]/35 text-[var(--destructive)]" : ""
                }`}
              >
                <p className="font-semibold">
                  {preflightBlocked
                    ? localizeUi("ui.longTermMemory.reviewqueue.preflightBlocked")
                    : localizeUi("ui.longTermMemory.reviewqueue.preflightReady")}
                </p>
                {preflight.blockers.map((blocker) => (
                  <p key={`${blocker.code}-${blocker.message}`} title={humanizeText(blocker.message)}>
                    {reviewCodeText(blocker.code, blocker.message, localizeUi, humanizeText)}
                  </p>
                ))}
                {preflight.conflicts.length ? (
                  <details data-ltm-review-conflicts>
                    <summary className="min-h-11 cursor-pointer py-3 font-medium">
                      {localizeUi(
                        selectLtmPluralForm(locale, preflight.conflicts.length) === "one"
                          ? "ui.longTermMemory.reviewqueue.conflictsFoundOne"
                          : "ui.longTermMemory.reviewqueue.conflictsFoundOther",
                        { count: preflight.conflicts.length },
                      )}
                    </summary>
                    <div className="mt-2 space-y-2">
                      {preflight.conflicts.slice(0, CONFLICT_PREVIEW_LIMIT).map((conflict, index) => (
                        <div key={`${conflict.field}-${index}`} className="space-y-1">
                          <p className="font-medium">{humanizeLabel(conflict.field)}</p>
                          <div>
                            <ConflictValue
                              label={localizeUi("ui.longTermMemory.reviewqueue.existingValue", { value: "{{value}}" })}
                              value={conflict.existing}
                            />
                          </div>
                          <div>
                            <ConflictValue
                              label={localizeUi("ui.longTermMemory.reviewqueue.proposedValue", { value: "{{value}}" })}
                              value={conflict.proposed}
                            />
                          </div>
                          <p>
                            {localizeUi("ui.longTermMemory.reviewqueue.conflictPolicy", { value: conflict.policy })}
                          </p>
                        </div>
                      ))}
                      {preflight.conflicts.length > CONFLICT_PREVIEW_LIMIT ? (
                        <details>
                          <summary className="min-h-11 cursor-pointer py-3 text-[var(--muted-foreground)]">
                            {localizeUi(
                              selectLtmPluralForm(locale, preflight.conflicts.length - CONFLICT_PREVIEW_LIMIT) === "one"
                                ? "ui.longTermMemory.reviewqueue.moreConflictsOne"
                                : "ui.longTermMemory.reviewqueue.moreConflictsOther",
                              {
                                count: preflight.conflicts.length - CONFLICT_PREVIEW_LIMIT,
                              },
                            )}
                          </summary>
                          <div className="mt-2 space-y-2">
                            {preflight.conflicts.slice(CONFLICT_PREVIEW_LIMIT).map((conflict, index) => (
                              <div key={`${conflict.field}-${index + CONFLICT_PREVIEW_LIMIT}`} className="space-y-1">
                                <p className="font-medium">{humanizeLabel(conflict.field)}</p>
                                <div>
                                  <ConflictValue
                                    label={localizeUi("ui.longTermMemory.reviewqueue.existingValue", {
                                      value: "{{value}}",
                                    })}
                                    value={conflict.existing}
                                  />
                                </div>
                                <div>
                                  <ConflictValue
                                    label={localizeUi("ui.longTermMemory.reviewqueue.proposedValue", {
                                      value: "{{value}}",
                                    })}
                                    value={conflict.proposed}
                                  />
                                </div>
                                <p>
                                  {localizeUi("ui.longTermMemory.reviewqueue.conflictPolicy", {
                                    value: conflict.policy,
                                  })}
                                </p>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}
            {hideProjection ? (
              <p data-ltm-review-preview-stale role="status" className="text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.longTermMemory.reviewqueue.projectionPreviewIsStaleBecauseThisTargetHasEdited")}
              </p>
            ) : null}
            {targetType === "character" &&
            ((mutation.kind === "create_note" &&
              Object.prototype.hasOwnProperty.call(mutation.note.sections, "appearance")) ||
              ((mutation.kind === "append_section" || mutation.kind === "update_section") &&
                mutation.sectionKey === "appearance")) ? (
              <p className="text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.longTermMemory.reviewqueue.appearanceProposalHelp")}
              </p>
            ) : null}
            <p className="text-[var(--muted-foreground)]">
              {localizeUi(
                row.disposition === "new"
                  ? "ui.longTermMemory.reviewqueue.acceptCreatesSavedMemory"
                  : row.disposition === "merge"
                    ? "ui.longTermMemory.reviewqueue.acceptAddsToSavedMemory"
                    : "ui.longTermMemory.reviewqueue.acceptReplacesSavedMemory",
              )}
            </p>
            <MutationEditor
              mutation={mutation}
              canEditTitle={canEditTitle}
              onChange={(next) => updateMutation(row.mutation, next)}
              onBlur={() => queueMicrotask(() => flushReviewStateRef.current())}
            />
          </div>
        ) : null}
      </article>
    );
  };

  const reviewQueueEmpty =
    !review.isLoading &&
    !review.isError &&
    !rejectedSuggestions.isLoading &&
    !rejectedSuggestions.isError &&
    !review.data?.sources.length &&
    !rejectedSuggestions.data?.suggestions.length &&
    !savedIdentityChoices.data?.suggestions.some((suggestion) => suggestion.identityResolution);
  const workspaceUnavailable = reviewQueueEmpty || reviewContextLoading || reviewContextFailed;
  const reviewDataUnavailable =
    review.isLoading || review.isError || rejectedSuggestions.isLoading || rejectedSuggestions.isError;

  const workspaceShown = !workspaceUnavailable && !reviewDataUnavailable;
  // The run summary sits above the rows it describes. With the workspace hidden (an emptied queue) it stays above it.
  const resultSurface = result ? (
    <StatusSurface
      data-ltm-review-result
      tabIndex={-1}
      tone={
        result.failed || result.indexRebuildFailures.length
          ? "danger"
          : result.phase === "preflight" && result.ready > 0
            ? "warning"
            : result.blockedMutationIds.length
              ? "danger"
              : "success"
      }
    >
      {batchResultSentences(result, localizeUi, locale).join(" ")}
      {result.failedMutationIds.length ? (
        <Button disabled={running !== null} onClick={retryFailed}>
          {localizeUi("ui.longTermMemory.reviewqueue.retryFailed")}
        </Button>
      ) : null}
      {result.failedDraftIds.length ? (
        <Button disabled={running !== null} onClick={reviewFailed}>
          {localizeUi("ui.longTermMemory.reviewqueue.reviewFailed")}
        </Button>
      ) : null}
      {result.action === "accepted" && result.completed && onOpenVault ? (
        <Button
          onClick={() => {
            const noteId = result.savedMemoryIds.length === 1 ? result.savedMemoryIds[0] : undefined;
            if (noteId && onOpenMemory) onOpenMemory(noteId);
            else onOpenVault();
          }}
        >
          {localizeUi("ui.longTermMemory.reviewqueue.viewSavedMemories")}
        </Button>
      ) : null}
    </StatusSurface>
  ) : null;

  return (
    <section
      ref={reviewRef}
      data-ltm-surface="review-queue"
      aria-label={localizeUi("ui.longTermMemory.reviewqueue.reviewQueue")}
      className="space-y-4"
    >
      <style>{`
        [data-ltm-surface="review-queue"] [data-ltm-review-action] {
          padding: 0;
          gap: 0.375rem;
        }
        [data-ltm-surface="review-queue"] [data-ltm-review-action-text] {
          display: none;
        }
        [data-ltm-surface="review-queue"] [data-ltm-review-progress-band="workbench"] {
          display: none;
        }
        @container ltm-workspace (min-width: 40rem) {
          [data-ltm-surface="review-queue"] [data-ltm-review-action] {
            padding: 0 0.75rem;
          }
          [data-ltm-surface="review-queue"] [data-ltm-review-action-icon],
          [data-ltm-surface="review-queue"] [data-ltm-review-state-chip] {
            display: none;
          }
          [data-ltm-surface="review-queue"] [data-ltm-review-action-text] {
            display: inline;
          }
          [data-ltm-review-field-grid] {
            grid-template-columns: minmax(0, 1fr) 10rem;
          }
          [data-ltm-review-mutation-details] {
            margin-left: 4.25rem;
          }
          [data-ltm-review-workbench] {
            padding: 1rem;
          }
        }
        @container ltm-workspace (min-width: 48rem) {
          [data-ltm-surface="review-queue"] [data-ltm-review-progress-band="navigator"] {
            display: none;
          }
          [data-ltm-surface="review-queue"] [data-ltm-review-progress-band="workbench"] {
            display: block;
          }
          [data-ltm-review-batch-actions] {
            position: static;
            z-index: auto;
            border-width: 0;
            background-color: transparent;
            padding: 0;
            box-shadow: none;
          }
        }
      `}</style>
      {extractionMessage ? <StatusSurface tone={extractionMessage.tone}>{extractionMessage.text}</StatusSurface> : null}
      {reviewStateMessage ? (
        <StatusSurface tone="warning" data-ltm-review-state-warning>
          {reviewStateMessage}
        </StatusSurface>
      ) : null}
      {review.isLoading ? (
        <StatusSurface busy>{localizeUi("ui.longTermMemory.reviewqueue.loadingPendingReviewDrafts")}</StatusSurface>
      ) : null}
      {review.isError ? (
        <StatusSurface tone="danger">
          {errorMessage(review.error, localizeUi("ui.longTermMemory.reviewqueue.pendingReviewDraftsCouldNotLoad"))}{" "}
          <Button className="shrink-0" disabled={review.isFetching} onClick={() => void review.refetch()}>
            {localizeUi("ui.longTermMemory.activityview.retry")}
          </Button>
        </StatusSurface>
      ) : null}
      {workspaceShown ? null : resultSurface}
      {deleteSuggestionError ? <StatusSurface tone="danger">{deleteSuggestionError}</StatusSurface> : null}
      {rejectedSuggestionsMessage ? (
        <StatusSurface tone="success">
          <span aria-live="polite">{rejectedSuggestionsMessage}</span>
        </StatusSurface>
      ) : null}
      {rejectedSuggestions.isLoading ? (
        <StatusSurface busy>{localizeUi("ui.longTermMemory.reviewqueue.loadingRejectedSuggestions")}</StatusSurface>
      ) : null}
      {reviewQueueEmpty ? (
        <StatusSurface>
          {localizeUi("ui.longTermMemory.reviewqueue.noProposedMemoriesNeedReviewYetImportASource")}
        </StatusSurface>
      ) : null}
      {rejectedSuggestions.isError ? (
        <StatusSurface tone="danger">
          {localizeUi("ui.longTermMemory.reviewqueue.rejectedSuggestionsCouldNotLoad")}{" "}
          <Button
            className="shrink-0"
            disabled={rejectedSuggestions.isFetching}
            onClick={() => void rejectedSuggestions.refetch()}
          >
            {localizeUi("ui.longTermMemory.activityview.retry")}
          </Button>
        </StatusSurface>
      ) : null}
      {reviewContextLoading ? (
        <StatusSurface busy>{localizeUi("ui.longTermMemory.reviewqueue.loadingMemoryContext")}</StatusSurface>
      ) : null}
      {reviewContextFailed ? (
        <StatusSurface tone="danger">
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">
            {localizeUi("ui.longTermMemory.reviewqueue.memoryContextCouldNotLoad")} {errorMessage(notes.error, "")}
          </span>
          <Button className="shrink-0" disabled={notes.isFetching} onClick={() => void notes.refetch()}>
            {localizeUi("ui.longTermMemory.activityview.retry")}
          </Button>
        </StatusSurface>
      ) : null}
      {/* Always mounted, so screen readers hear a refresh while the queue stays on screen. */}
      <span data-ltm-review-context-status role="status" aria-live="polite" className="sr-only">
        {reviewContextRefreshing ? localizeUi("ui.longTermMemory.reviewqueue.loadingMemoryContext") : null}
      </span>
      <LtmWorkspace
        className={workspaceUnavailable || reviewDataUnavailable ? "hidden" : ""}
        activeMobilePane={mobilePane}
        onMobilePaneChange={setMobilePane}
        switcherLabel={localizeUi("ui.longTermMemory.longtermmemorynavigation.workspacePanes")}
        navigator={{
          label: localizeUi("ui.longTermMemory.reviewqueue.sourcesPane"),
          content: (
            <div data-ltm-review-navigator className="space-y-3">
              <header className="space-y-1 px-1">
                <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                  {localizeUi("ui.longTermMemory.reviewqueue.reviewQueue")}
                  {reviewContextRefreshing ? (
                    <Loader2
                      aria-hidden="true"
                      data-ltm-review-context-refreshing
                      size="0.875rem"
                      className="animate-spin text-[var(--muted-foreground)] motion-reduce:animate-none"
                    />
                  ) : null}
                </h2>
                <div data-ltm-review-progress-band="navigator">
                  <ReviewProgress {...reviewProgress} />
                </div>
              </header>
              <div className="mari-editor-panel overflow-hidden">
                {sourceIds.map((id) => {
                  const source = review.data?.sources.find((item) => item.sourceNoteId === id);
                  const rejectedCount =
                    rejectedSuggestions.data?.suggestions.filter((item) => item.source.sourceNoteId === id).length ?? 0;
                  const active = effectiveSourceId === id;
                  const expanded = active && !sourceCollapsed;
                  const panelId = `ltm-review-source-panel-${id}`;
                  return (
                    <div key={id} className="group">
                      <div
                        className={`flex min-h-12 items-stretch border-b border-[var(--border)] text-sm ${active ? "bg-[var(--accent)]/50" : ""}`}
                      >
                        <button
                          type="button"
                          data-ltm-review-source-select={id}
                          disabled={identityDirtyIds.size > 0}
                          aria-current={active || undefined}
                          aria-expanded={expanded}
                          aria-controls={panelId}
                          onClick={() => {
                            setSelectedSourceId(id);
                            setSelectedDraftId(null);
                            setSourceCollapsed((current) => (active ? !current : false));
                            setMobilePaneAndFocus("workbench");
                          }}
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
                        >
                          <ChevronRight
                            aria-hidden="true"
                            size="0.875rem"
                            className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                          />
                          <span className="min-w-0 flex-1 truncate font-semibold" title={sourceTitleHint(id)}>
                            {sourceDisplayTitle(id)}
                          </span>
                          <span className="shrink-0 text-xs text-[var(--foreground)]">
                            {(source?.drafts.length ?? 0) + rejectedCount}
                          </span>
                        </button>
                        {rejectedCount ? (
                          <Button
                            data-ltm-review-rejected-count={rejectedCount}
                            disabled={identityDirtyIds.size > 0}
                            className="shrink-0 rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold underline underline-offset-2"
                            style={{ minHeight: 44, minWidth: 44 }}
                            onClick={() => {
                              setSelectedSourceId(id);
                              setSelectedDraftId(null);
                              setSourceCollapsed(false);
                              setMobilePaneAndFocus("workbench");
                              requestAnimationFrame(() => {
                                const details = document.querySelector<HTMLDetailsElement>(
                                  `details[data-ltm-rejected-source="${CSS.escape(id)}"]`,
                                );
                                if (details) details.open = true;
                              });
                            }}
                          >
                            {localizeUi("ui.longTermMemory.reviewqueue.rejectedCount", { count: rejectedCount })}
                          </Button>
                        ) : null}
                      </div>
                      <div id={panelId} hidden={!expanded}>
                        {source?.drafts.map((item) => (
                          <button
                            key={item.draft.id}
                            type="button"
                            data-ltm-review-draft-select={item.draft.id}
                            aria-current={selectedDraft?.draft.id === item.draft.id || undefined}
                            onClick={() => {
                              setSelectedDraftId(item.draft.id);
                              setMobilePaneAndFocus("workbench");
                            }}
                            className={`flex min-h-14 w-full items-start gap-3 border-b border-[var(--border)]/70 px-8 py-3 text-left last:border-b-0 hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] ${selectedDraft?.draft.id === item.draft.id ? "bg-[var(--primary)]/10" : ""}`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="flex min-w-0 items-center justify-between gap-2 text-xs font-semibold">
                                <span className="min-w-0 truncate" title={reviewDraftTitle(item)}>
                                  {reviewDraftTitle(item)}
                                </span>
                                <span className="text-[var(--foreground)]">{item.draft.mutations.length}</span>
                              </span>
                            </span>
                            <span
                              data-ltm-freshness={noteById.has(id) ? item.freshness : "missing"}
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${freshnessClass(noteById.has(id) ? item.freshness : "missing")}`}
                            >
                              {localizeUi(freshnessLabel[noteById.has(id) ? item.freshness : "missing"])}
                            </span>
                          </button>
                        ))}
                        {source?.drafts.length || rejectedCount ? null : (
                          <p className="px-8 py-3 text-xs text-[var(--muted-foreground)]">
                            {localizeUi("ui.longTermMemory.reviewqueue.noProposedMemoriesAwaitReviewForSource")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ),
        }}
        workbench={{
          label: localizeUi("ui.longTermMemory.reviewqueue.reviewPane"),
          content: (
            <div
              data-ltm-review-workbench
              className="mari-editor-panel min-w-0 space-y-4 p-3"
              onFocus={(event) => revealFocusUnderStickyBar(event, batchBarRef.current)}
            >
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
                <div className="min-w-0">
                  <h2
                    data-ltm-review-draft-title
                    className="break-words text-base font-semibold tracking-tight"
                    title={selectedDraft ? undefined : sourceTitleHint(effectiveSourceId ?? "")}
                  >
                    {selectedDraft
                      ? reviewDraftTitle(selectedDraft)
                      : localizeUi("ui.longTermMemory.reviewqueue.sourceNote", {
                          title: sourceDisplayTitle(effectiveSourceId ?? ""),
                        })}
                  </h2>
                  {selectedDraft ? (
                    <p
                      className="mt-1 text-xs text-[var(--foreground)]"
                      title={sourceTitleHint(effectiveSourceId ?? "")}
                    >
                      {localizeUi("ui.longTermMemory.reviewqueue.sourceNote", {
                        title: sourceDisplayTitle(effectiveSourceId ?? ""),
                      })}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-[var(--foreground)]">
                    {selectedDraft
                      ? `${selectedDraft.draft.mutations.length} ${localizeUi("ui.longTermMemory.reviewqueue.mutations")}`
                      : localizeUi("ui.longTermMemory.reviewqueue.noProposedMemoriesAwaitReviewForSource")}
                  </p>
                  {selectedReviewSource ? (
                    <p className="text-xs text-[var(--foreground)]">
                      {localizeUi("ui.longTermMemory.reviewqueue.modes")}{" "}
                      {selectedReviewSource.modes
                        .map((mode) => localizedLabel(mode, localizeUi, labelKeys.mode))
                        .join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedDraft && hasExtractionDetails(selectedDraft) ? (
                    <Button
                      aria-pressed={detailsOpen}
                      data-ltm-details-toggle
                      onClick={() => {
                        const next = !detailsOpen;
                        setDetailsOpen(next);
                        setMobilePaneAndFocus(next ? "inspector" : "workbench");
                      }}
                      className={detailsOpen ? "bg-[var(--accent)]" : undefined}
                    >
                      {localizeUi("ui.longTermMemory.reviewqueue.details")}
                    </Button>
                  ) : null}
                  {onOpenMemory && effectiveSourceId && !selectedSourceMissing ? (
                    <Button onClick={() => onOpenMemory(effectiveSourceId)}>
                      {localizeUi("ui.longTermMemory.reviewqueue.openSource")}
                    </Button>
                  ) : null}
                  {effectiveSourceId && selectedSourceIsExtractable && needsSourceReextraction ? (
                    <Button
                      disabled={extractingSourceId !== null || identityDirtyIds.size > 0}
                      onClick={() => void reextractSource()}
                    >
                      {extractingSourceId === effectiveSourceId ? (
                        <Loader2
                          aria-hidden="true"
                          size="0.875rem"
                          className="animate-spin motion-reduce:animate-none"
                        />
                      ) : null}
                      {localizeUi("ui.longTermMemory.reviewqueue.reExtractSource")}
                    </Button>
                  ) : null}
                </div>
              </header>
              {workspaceShown ? resultSurface : null}
              {selectedSourceMissing ? (
                <StatusSurface tone="danger" data-ltm-review-source-missing>
                  {localizeUi("ui.longTermMemory.reviewqueue.missingSourceHelp")}
                </StatusSurface>
              ) : null}
              {sourceRejectedSuggestions.length ? (
                <details
                  data-ltm-rejected-suggestions
                  data-ltm-rejected-source={effectiveSourceId ?? undefined}
                  aria-label={localizeUi("ui.longTermMemory.reviewqueue.suggestionsThatWerentSaved")}
                  className="group rounded-lg border border-[var(--border)] bg-[var(--secondary)]/20"
                >
                  <summary className="flex min-h-14 cursor-pointer list-none items-start gap-2 rounded-lg p-3 hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]">
                    <ChevronRight
                      aria-hidden="true"
                      size="0.875rem"
                      className="mt-1 shrink-0 transition-transform group-open:rotate-90"
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        {localizeUi("ui.longTermMemory.reviewqueue.suggestionsThatWerentSaved")}
                      </span>
                      <span className="block text-xs text-[var(--foreground)]">
                        {localizeUi("ui.longTermMemory.reviewqueue.rejectedSuggestionsRemainUntilAction")}
                      </span>
                    </span>
                  </summary>
                  {(effectiveSourceId ? [effectiveSourceId] : []).map((sourceNoteId) => {
                    const items = sourceRejectedSuggestions;
                    return (
                      <article
                        key={sourceNoteId}
                        data-ltm-rejected-source={sourceNoteId}
                        className="space-y-3 border-t border-[var(--border)] p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {localizeUi("ui.longTermMemory.reviewqueue.rejectedCount", { count: items.length })}
                          </p>
                          <Button
                            destructive
                            data-ltm-clear-rejected-suggestions
                            disabled={dismissingId !== null || clearingSourceId !== null || identityDirtyIds.size > 0}
                            onClick={() => void clearRejectedSuggestions()}
                          >
                            {clearingSourceId === sourceNoteId ? (
                              <Loader2
                                aria-hidden="true"
                                size="0.875rem"
                                className="animate-spin motion-reduce:animate-none"
                              />
                            ) : null}
                            {localizeUi("ui.longTermMemory.reviewqueue.clearRejectedSuggestions")}
                          </Button>
                        </div>
                        {items.map((item) => (
                          <article
                            key={item.id}
                            data-ltm-rejected-suggestion={item.id}
                            className="space-y-3 rounded-md border border-[var(--border)] p-3"
                          >
                            <div>
                              <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                                {localizeUi("ui.longTermMemory.reviewqueue.proposedContent")}
                              </p>
                              <p className="mt-1 text-sm font-semibold leading-6">
                                {item.candidate.snippet || item.candidate.message}
                              </p>
                            </div>
                            <div className="space-y-1 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted-foreground)]">
                              <p>
                                <span className="font-medium text-[var(--foreground)]">
                                  {localizeUi("ui.longTermMemory.reviewqueue.whyItWasntSaved")}:
                                </span>{" "}
                                {item.candidate.message?.trim() ||
                                  localizeUi(
                                    rejectionReasonLabels[item.candidate.reason] ??
                                      "ui.longTermMemory.reviewqueue.rejectionReasonOther",
                                  )}
                              </p>
                              <p>
                                <span className="font-medium text-[var(--foreground)]">
                                  {localizeUi("ui.longTermMemory.reviewqueue.suggestedDestination")}:
                                </span>{" "}
                                {item.candidate.recovery
                                  ? recoveryLabel(item.candidate.recovery, localizeUi, noteById)
                                  : localizeUi("ui.longTermMemory.reviewqueue.reviewAndCorrectSuggestion")}
                              </p>
                              <p>
                                <span className="font-medium text-[var(--foreground)]">
                                  {localizeUi("ui.longTermMemory.reviewqueue.recommendedFix")}:
                                </span>{" "}
                                {localizeUi(
                                  (item.candidate.validatorCode
                                    ? rejectionRecommendedLabelsByCode[item.candidate.validatorCode]
                                    : undefined) ??
                                    rejectionRecommendedLabels[item.candidate.reason] ??
                                    "ui.longTermMemory.reviewqueue.recommendedFixOther",
                                )}
                              </p>
                              {item.candidate.issues?.length ? (
                                <details>
                                  <summary className="min-h-11 cursor-pointer py-3 font-medium text-[var(--foreground)]">
                                    {localizeUi("ui.longTermMemory.reviewqueue.parserIssues", {
                                      count: item.candidate.issues.length,
                                    })}
                                  </summary>
                                  <ul className="mt-1 list-disc space-y-1 pl-5">
                                    {item.candidate.issues.map((issue) => (
                                      <li key={issue}>{issue}</li>
                                    ))}
                                  </ul>
                                </details>
                              ) : null}
                            </div>
                            {item.candidate.identityReview?.length ? (
                              <SubjectIdentityReview
                                suggestionId={item.id}
                                review={item.candidate.identityReview}
                                onDirtyChange={onIdentityDirtyChange}
                                onRegisterSave={onIdentityRegisterSave}
                                onResolved={onIdentityResolved}
                              />
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              {onRecoverCandidate ? (
                                <Button
                                  aria-label={localizeUi("ui.longTermMemory.reviewqueue.recoverSuggestionNamed", {
                                    value1: item.candidate.message,
                                  })}
                                  onClick={() => onRecoverCandidate(item.candidate, item.scope, item.modes, item.id)}
                                >
                                  {localizeUi("ui.longTermMemory.reviewqueue.recoverManually")}
                                </Button>
                              ) : null}
                              <Button
                                destructive
                                aria-label={localizeUi("ui.longTermMemory.reviewqueue.deleteSuggestionNamed", {
                                  value1: item.candidate.message,
                                })}
                                disabled={dismissingId !== null || clearingSourceId !== null}
                                onClick={() => void deleteRejectedSuggestion(item)}
                              >
                                {localizeUi("ui.longTermMemory.reviewqueue.delete")}
                              </Button>
                            </div>
                          </article>
                        ))}
                      </article>
                    );
                  })}
                </details>
              ) : null}
              {sourceSavedIdentityChoices.length ? (
                <details
                  data-ltm-saved-identity-choices
                  aria-label={localizeUi("ui.longTermMemory.reviewqueue.savedIdentityChoices")}
                  className="group rounded-lg border border-[var(--border)] bg-[var(--secondary)]/20"
                >
                  <summary className="flex min-h-14 cursor-pointer list-none items-start gap-2 rounded-lg p-3 hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]">
                    <ChevronRight
                      aria-hidden="true"
                      size="0.875rem"
                      className="mt-1 shrink-0 transition-transform group-open:rotate-90"
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        {localizeUi("ui.longTermMemory.reviewqueue.savedIdentityChoices")}
                      </span>
                      <span className="block text-xs text-[var(--foreground)]">
                        {localizeUi("ui.longTermMemory.reviewqueue.savedIdentityChoicesDescription")}
                      </span>
                    </span>
                  </summary>
                  <div className="space-y-3 border-t border-[var(--border)] p-3">
                    {sourceSavedIdentityChoices.map((item) => (
                      <article
                        key={item.id}
                        data-ltm-saved-identity-choice={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] p-3"
                      >
                        <p className="text-sm font-medium">
                          {(item.identityResolution?.choices ?? [])
                            .map((choice) => `${choice.name}: ${savedIdentityChoiceLabel(choice, localizeUi)}`)
                            .join(" · ")}
                        </p>
                        <Button
                          destructive
                          disabled={dismissingId !== null || clearingSourceId !== null}
                          aria-label={localizeUi("ui.longTermMemory.reviewqueue.deleteSuggestionNamed", {
                            value1: item.candidate.message,
                          })}
                          onClick={() => void deleteRejectedSuggestion(item)}
                        >
                          {dismissingId === item.id ? (
                            <Loader2
                              aria-hidden="true"
                              size="0.875rem"
                              className="animate-spin motion-reduce:animate-none"
                            />
                          ) : null}
                          {localizeUi("ui.longTermMemory.reviewqueue.delete")}
                        </Button>
                      </article>
                    ))}
                  </div>
                </details>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SelectionCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  label={localizeUi("ui.longTermMemory.reviewqueue.selectAll")}
                  onChange={() => {
                    clearPreflight();
                    return allSelected
                      ? setSelectedIds((current) => {
                          const next = new Set(current);
                          activeDraftRows.forEach((row) => next.delete(row.mutation.id));
                          return next;
                        })
                      : setSelectedIds(
                          (current) => new Set([...current, ...activeDraftRows.map((row) => row.mutation.id)]),
                        );
                  }}
                />
                <div data-ltm-review-progress-band="workbench">
                  <ReviewProgress {...reviewProgress} />
                </div>
              </div>
              {selectedRows.length ? (
                <div
                  ref={batchBarRef}
                  data-ltm-review-batch-actions
                  role="group"
                  aria-label={localizeUi("ui.longTermMemory.reviewqueue.batchActions")}
                  className="sticky top-1 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 shadow-md"
                >
                  <Button
                    primary
                    className={batchAcceptDisabled || runBusy ? "opacity-50" : ""}
                    aria-disabled={batchAcceptDisabled || runBusy || undefined}
                    aria-describedby={batchAcceptReason ? "ltm-review-batch-accept-reason" : undefined}
                    onClick={() => {
                      if (!runBusy && !batchAcceptDisabled) void runBatch("accept");
                    }}
                  >
                    {running === "accept"
                      ? localizeUi(
                          acceptPhase === "apply"
                            ? "ui.longTermMemory.reviewqueue.applyingBatch"
                            : "ui.longTermMemory.reviewqueue.accepting",
                        )
                      : result?.phase === "preflight"
                        ? localizeUi("ui.longTermMemory.reviewqueue.applyPreflighted", {
                            count: result.ready,
                          })
                        : localizeUi("ui.longTermMemory.reviewqueue.acceptEligibleValue1", {
                            value1: eligibleSelectedRows.length,
                          })}
                  </Button>
                  <Button
                    destructive
                    className={running !== null ? "opacity-50" : ""}
                    disabled={!skippableSelectedRows.length}
                    aria-disabled={running !== null || undefined}
                    onClick={() => {
                      if (running === null) void runBatch("skip");
                    }}
                  >
                    {running === "skip"
                      ? localizeUi("ui.longTermMemory.reviewqueue.skipping")
                      : localizeUi("ui.longTermMemory.reviewqueue.skipSelectedValue1", {
                          value1: skippableSelectedRows.length,
                        })}
                  </Button>
                  <Button
                    disabled={running !== null}
                    onClick={() => {
                      clearPreflight();
                      setSelectedIds(new Set());
                    }}
                  >
                    {localizeUi("ui.longTermMemory.activityview.clear")}
                  </Button>
                  {batchAcceptReason ? (
                    <p
                      id="ltm-review-batch-accept-reason"
                      data-ltm-review-batch-accept-reason
                      className="flex basis-full items-start gap-1.5 text-xs text-[var(--destructive)]"
                    >
                      <CircleAlert aria-hidden="true" size="0.875rem" className="mt-0.5 shrink-0" />
                      {batchAcceptReason}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {review.data?.sources
                .filter((source) => source.sourceNoteId === effectiveSourceId)
                .map((source) => {
                  return (
                    <article
                      key={source.sourceNoteId}
                      data-ltm-review-source={source.sourceNoteId}
                      className="space-y-3"
                    >
                      <div className="space-y-2">
                        {source.drafts
                          .filter((item) => item.draft.id === selectedDraft?.draft.id)
                          .map((item) => {
                            const projectedIds = new Set(
                              source.targets.flatMap((target) =>
                                target.rows
                                  .filter((row) => row.draftId === item.draft.id)
                                  .map((row) => row.mutation.id),
                              ),
                            );
                            const fallbackTargets = new Map<string, ReviewRow[]>();
                            for (const mutation of item.draft.mutations) {
                              if (projectedIds.has(mutation.id)) continue;
                              const row = rowByMutationId.get(mutation.id)!;
                              fallbackTargets.set(row.targetId, [...(fallbackTargets.get(row.targetId) ?? []), row]);
                            }
                            const diagnosticsOnly = item.draft.mutations.length === 0;
                            return (
                              <section key={item.draft.id} data-ltm-review-draft={item.draft.id} className="space-y-3">
                                {item.blockReasons.length ? (
                                  <div
                                    data-ltm-review-blocks
                                    className="mari-editor-panel mari-editor-panel--soft space-y-1 border-[var(--destructive)]/35 p-3 text-xs text-[var(--destructive)]"
                                  >
                                    {item.blockReasons.map((reason) => (
                                      <p key={reason.code} title={humanizeText(reason.message)}>
                                        {reviewCodeText(reason.code, reason.message, localizeUi, humanizeText)}
                                      </p>
                                    ))}
                                  </div>
                                ) : null}
                                {diagnosticsOnly || item.draft.status === "invalidated" ? (
                                  <Button
                                    destructive
                                    disabled={dismissingId !== null || running !== null}
                                    onClick={() => void dismissReport(item)}
                                  >
                                    {dismissingId === item.draft.id
                                      ? localizeUi("ui.longTermMemory.reviewqueue.dismissing")
                                      : item.draft.status === "invalidated"
                                        ? localizeUi("ui.longTermMemory.reviewqueue.discardInvalidatedDraft")
                                        : localizeUi("ui.longTermMemory.reviewqueue.dismissReport")}
                                  </Button>
                                ) : null}
                                <div className="space-y-3 pt-1">
                                  {source.targets.map((target) => {
                                    const targetRows = target.rows.filter((row) => row.draftId === item.draft.id);
                                    if (!targetRows.length) return null;
                                    const projectionEdited = targetRows.some((row) => editedById.has(row.mutation.id));
                                    return (
                                      <div
                                        key={target.noteId}
                                        data-ltm-review-target={target.noteId}
                                        className="space-y-2"
                                      >
                                        {targetRows.map((projectedRow) =>
                                          renderRow(rowByMutationId.get(projectedRow.mutation.id)!, projectionEdited),
                                        )}
                                      </div>
                                    );
                                  })}
                                  {[...fallbackTargets].map(([targetId, targetRows]) => {
                                    return (
                                      <div
                                        key={`fallback-${targetId}`}
                                        data-ltm-review-target={targetId}
                                        data-ltm-unprojected-target
                                        className="space-y-2"
                                      >
                                        {targetRows.map((row) => renderRow(row))}
                                      </div>
                                    );
                                  })}
                                </div>
                              </section>
                            );
                          })}
                      </div>
                    </article>
                  );
                })}
              {effectiveSourceId && !selectedReviewSource ? (
                <StatusSurface>
                  {localizeUi("ui.longTermMemory.reviewqueue.noProposedMemoriesAwaitReviewForSource")}
                </StatusSurface>
              ) : null}
            </div>
          ),
        }}
        inspector={
          selectedDraft && detailsOpen
            ? {
                label: localizeUi("ui.longTermMemory.reviewqueue.details"),
                content: <ExtractionDetails item={selectedDraft} humanizeText={humanizeText} />,
              }
            : undefined
        }
      />
    </section>
  );
}
