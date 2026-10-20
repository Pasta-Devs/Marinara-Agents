import {
  ltmDraftLinkChoiceSchema,
  ltmDraftMutationSchema,
  type LtmDraftLinkChoice,
  type LtmDraftMutation,
  type LtmDraftReviewDraft,
  type LtmDraftReviewMutation,
  type LtmDraftReviewResponse,
  type LtmNote,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { humanizeLabel } from "../display-labels";
import { useLtmTranslation } from "../localization";

export type ReviewRow = {
  sourceNoteId: string;
  draftId: string;
  mutation: LtmDraftMutation;
  disposition: LtmDraftReviewMutation["disposition"] | "unavailable";
  diagnostics: LtmDraftReviewMutation["diagnostics"];
  changes: LtmDraftReviewMutation["changes"];
  targetId: string;
  targetTitle?: string;
  targetType?: string;
};

export function linkChoiceKey(mutationId: string, linkTarget: string, linkRelation: string) {
  return `${mutationId}\u0000${linkRelation}\u0000${linkTarget}`;
}

type PersistedReviewState = {
  version: 3;
  chatId: string | null;
  drafts: Record<
    string,
    {
      savedAt: number;
      draftFingerprint: string;
      contextFingerprint: string;
      mutationFingerprints: Array<[string, string]>;
      selectedIds: string[];
      editedMutations: Array<[string, LtmDraftMutation]>;
      linkChoices?: Array<[string, LtmDraftLinkChoice]>;
    }
  >;
};

type PersistedDraftState = PersistedReviewState["drafts"][string];

const REVIEW_STATE_STORAGE_KEY = "marinara_ltm_review_state";
const REVIEW_STATE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_APPEND_TEXT_LENGTH = 20_000;
export const MAX_SECTION_TEXT_LENGTH = 24_000;

export const mutationLabels: Record<LtmDraftMutation["kind"], string> = {
  create_note: "ui.longTermMemory.reviewqueue.createMemory",
  append_section: "ui.longTermMemory.reviewqueue.addToSection",
  update_section: "ui.longTermMemory.reviewqueue.updateSection",
  add_link: "ui.longTermMemory.reviewqueue.addLink",
  set_keywords: "ui.longTermMemory.reviewqueue.replaceKeywords",
  set_status: "ui.longTermMemory.reviewqueue.changeStatus",
  set_title: "ui.longTermMemory.reviewqueue.updateTitle",
  set_subjects: "ui.longTermMemory.reviewqueue.updateSubjects",
};

export const dispositionLabels: Record<ReviewRow["disposition"], string> = {
  new: "ui.longTermMemory.reviewqueue.newMemory",
  merge: "ui.longTermMemory.reviewqueue.mergeIntoMemory",
  rewrite: "ui.longTermMemory.reviewqueue.rewriteMemory",
  unavailable: "ui.longTermMemory.reviewqueue.previewUnavailable",
};

function mutationTarget(mutation: LtmDraftMutation) {
  return mutation.kind === "create_note" ? mutation.note.id : mutation.noteId;
}

export function noteDisplayTitle(note: Pick<LtmNote, "title"> | undefined, fallback: string) {
  return note?.title?.trim() || fallback;
}

export function noteBody(note: Pick<LtmNote, "sections"> | undefined) {
  return note
    ? Object.values(note.sections)
        .map((section) => section.text.trim())
        .filter(Boolean)
        .join(" ")
    : "";
}

export function mutationDisplayLabel(
  mutation: LtmDraftMutation | undefined,
  noteById: ReadonlyMap<string, LtmNote>,
  localizeUi: ReturnType<typeof useLtmTranslation>["t"],
) {
  if (!mutation) return localizeUi("ui.longTermMemory.reviewqueue.dependentChange");
  if (mutation.summary.trim()) return `"${mutation.summary.trim()}"`;
  const target = mutation.kind === "create_note" ? mutation.note : noteById.get(mutationTarget(mutation));
  const title = target && "title" in target ? target.title : undefined;
  const label = mutationLabels[mutation.kind]
    ? localizeUi(mutationLabels[mutation.kind])
    : humanizeLabel(mutation.kind);
  return title
    ? localizeUi("ui.longTermMemory.reviewqueue.mutationWithTitle", {
        mutation: label,
        title,
      })
    : label;
}

export function draftDisplayTitle(item: LtmDraftReviewDraft, localizeUi: ReturnType<typeof useLtmTranslation>["t"]) {
  const firstMutation = item.draft.mutations[0];
  if (firstMutation?.kind === "create_note") {
    return noteDisplayTitle(firstMutation.note, localizeUi("ui.longTermMemory.reviewqueue.untitledMemory"));
  }
  return item.draft.summary.trim() || localizeUi("ui.longTermMemory.reviewqueue.noDraftSummary");
}

export function humanizeReviewText(
  text: string,
  noteById: ReadonlyMap<string, LtmNote>,
  replacementPattern: RegExp | undefined,
  replacements: ReadonlyMap<string, string>,
  sourcePrefix: string,
  sourceFallback: string,
) {
  const display = text.replace(
    /source_note:([A-Za-z0-9_-]+)/gu,
    (_, id: string) => `${sourcePrefix} ${noteDisplayTitle(noteById.get(id), sourceFallback)}`,
  );
  return replacementPattern ? display.replace(replacementPattern, (id) => replacements.get(id) ?? id) : display;
}

export function groupByDraft(rows: readonly ReviewRow[]) {
  const grouped = new Map<string, ReviewRow[]>();
  for (const row of rows) {
    grouped.set(row.draftId, [...(grouped.get(row.draftId) ?? []), row]);
  }
  return grouped;
}

export function buildReviewRows(reviewData: LtmDraftReviewResponse | undefined) {
  const rowByMutationId = new Map<string, ReviewRow>();
  for (const source of reviewData?.sources ?? []) {
    for (const target of source.targets) {
      for (const row of target.rows) {
        rowByMutationId.set(row.mutation.id, {
          sourceNoteId: source.sourceNoteId,
          ...row,
          targetId: target.noteId,
          targetTitle: target.title,
          targetType: target.noteType,
        });
      }
    }
    for (const item of source.drafts) {
      for (const mutation of item.draft.mutations) {
        if (!rowByMutationId.has(mutation.id)) {
          rowByMutationId.set(mutation.id, {
            sourceNoteId: source.sourceNoteId,
            draftId: item.draft.id,
            mutation,
            disposition: "unavailable",
            diagnostics: [],
            changes: [],
            targetId: mutationTarget(mutation),
            targetTitle: mutation.kind === "create_note" ? mutation.note.title : undefined,
            targetType: mutation.kind === "create_note" ? mutation.note.type : undefined,
          });
        }
      }
    }
  }
  return { rowByMutationId, rows: [...rowByMutationId.values()] };
}

export function acceptedMutationIds(draftRows: readonly ReviewRow[], selectedIds: readonly string[]) {
  const selected = new Set(selectedIds);
  const rowsById = new Map(draftRows.map((row) => [row.mutation.id, row] as const));
  const eventCreates = new Map(
    draftRows.flatMap((row) =>
      row.mutation.kind === "create_note" && row.mutation.note.type === "timeline_event" && row.disposition === "new"
        ? [[row.mutation.note.id, row.mutation.id] as const]
        : [],
    ),
  );

  let changed = true;
  while (changed) {
    changed = false;
    const selectedRows = [...selected].flatMap((id) => {
      const row = rowsById.get(id);
      return row ? [row] : [];
    });
    const selectedTargetIds = new Set(selectedRows.map((row) => mutationTarget(row.mutation)));

    for (const row of draftRows) {
      if (
        row.mutation.kind === "create_note" &&
        row.disposition === "new" &&
        selectedTargetIds.has(row.mutation.note.id) &&
        !selected.has(row.mutation.id)
      ) {
        selected.add(row.mutation.id);
        changed = true;
      }
    }

    const selectedNoteIds = new Set(
      [...selected].flatMap((id) => {
        const row = rowsById.get(id);
        return row ? [mutationTarget(row.mutation)] : [];
      }),
    );
    for (const row of draftRows) {
      if (
        row.mutation.kind !== "add_link" ||
        !selectedNoteIds.has(row.mutation.noteId) ||
        !eventCreates.has(row.mutation.link.target)
      )
        continue;
      if (!selected.has(row.mutation.id)) {
        selected.add(row.mutation.id);
        changed = true;
      }
      const createId = eventCreates.get(row.mutation.link.target)!;
      if (!selected.has(createId)) {
        selected.add(createId);
        changed = true;
      }
    }

    for (const row of selectedRows) {
      const eventTargetIds =
        row.mutation.kind === "create_note"
          ? row.mutation.note.links.map((link) => link.target)
          : row.mutation.kind === "add_link"
            ? [row.mutation.link.target]
            : [];
      for (const targetId of eventTargetIds) {
        const createId = eventCreates.get(targetId);
        if (createId && !selected.has(createId)) {
          selected.add(createId);
          changed = true;
        }
      }
    }
  }

  return selected;
}

export function sameMutation(left: LtmDraftMutation, right: LtmDraftMutation) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function selectedEditIsValid(mutation: LtmDraftMutation) {
  if (mutation.kind === "append_section") return !mutationHasOverlongText(mutation) && Boolean(mutation.text.trim());
  if (mutation.kind === "update_section")
    return !mutationHasOverlongText(mutation) && Boolean(mutation.section.text.trim());
  if (mutation.kind === "create_note")
    return (
      !mutationHasOverlongText(mutation) &&
      Object.values(mutation.note.sections).every((section) => Boolean(section.text.trim()))
    );
  return true;
}

export function parsePersistedMutation(value: unknown): LtmDraftMutation | null {
  const parsed = ltmDraftMutationSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parsePersistedLinkChoice(value: unknown): LtmDraftLinkChoice | null {
  const parsed = ltmDraftLinkChoiceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function mutationHasOverlongText(mutation: LtmDraftMutation) {
  return mutation.kind === "append_section"
    ? mutation.text.length > MAX_APPEND_TEXT_LENGTH
    : mutation.kind === "update_section"
      ? mutation.section.text.length > MAX_SECTION_TEXT_LENGTH
      : mutation.kind === "create_note"
        ? Object.values(mutation.note.sections).some((section) => section.text.length > MAX_SECTION_TEXT_LENGTH)
        : false;
}

export function mutationProposedText(mutation: LtmDraftMutation, noteById: ReadonlyMap<string, LtmNote>) {
  if (mutation.kind === "create_note")
    return Object.values(mutation.note.sections)
      .map((section) => section.text.trim())
      .filter(Boolean)
      .join(" ");
  if (mutation.kind === "append_section") return mutation.text.trim();
  if (mutation.kind === "update_section") return mutation.section.text.trim();
  if (mutation.kind === "set_keywords") return mutation.keywords.join(", ");
  if (mutation.kind === "set_status") return mutation.status;
  if (mutation.kind === "set_title") return mutation.title;
  if (mutation.kind === "set_subjects") return mutation.subjects.map((subject) => subject.key).join(", ");
  if (mutation.kind === "add_link") return noteById.get(mutation.link.target)?.title?.trim() || mutation.link.target;
  return "";
}

export function reviewStateStorageKey(chatId: string | null | undefined) {
  return `${REVIEW_STATE_STORAGE_KEY}:${chatId ?? "no-chat"}`;
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function getReviewStateStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isPersistedReviewState(value: unknown, chatId: string | null): value is PersistedReviewState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const parsed = value as Partial<PersistedReviewState>;
  if (
    parsed.version !== 3 ||
    parsed.chatId !== chatId ||
    !parsed.drafts ||
    typeof parsed.drafts !== "object" ||
    Array.isArray(parsed.drafts)
  )
    return false;
  return Object.values(parsed.drafts).every((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const draft = value as Partial<PersistedDraftState>;
    return (
      typeof draft.savedAt === "number" &&
      Number.isFinite(draft.savedAt) &&
      draft.savedAt <= Date.now() &&
      Date.now() - draft.savedAt <= REVIEW_STATE_MAX_AGE_MS &&
      typeof draft.draftFingerprint === "string" &&
      typeof draft.contextFingerprint === "string" &&
      Array.isArray(draft.mutationFingerprints) &&
      draft.mutationFingerprints.every(
        (entry) =>
          Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string" && typeof entry[1] === "string",
      ) &&
      Array.isArray(draft.selectedIds) &&
      draft.selectedIds.every((id) => typeof id === "string") &&
      Array.isArray(draft.editedMutations) &&
      draft.editedMutations.every(
        (entry) =>
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === "string" &&
          entry[1] &&
          typeof entry[1] === "object",
      ) &&
      (!draft.linkChoices ||
        (Array.isArray(draft.linkChoices) &&
          draft.linkChoices.every(
            (entry) =>
              Array.isArray(entry) &&
              entry.length === 2 &&
              typeof entry[0] === "string" &&
              entry[1] &&
              typeof entry[1] === "object",
          )))
    );
  });
}

export function readPersistedReviewState(key: string, chatId: string | null) {
  const storage = getReviewStateStorage();
  if (!storage) return { state: null, error: "unavailable" as const };
  try {
    const raw = storage.getItem(key);
    if (!raw) return { state: null, error: null };
    const parsed = safeParse(raw);
    if (!isPersistedReviewState(parsed, chatId)) {
      storage.removeItem(key);
      return { state: null, error: null };
    }
    return { state: parsed, error: null };
  } catch {
    return { state: null, error: "failed" as const };
  }
}

export function writePersistedReviewState(key: string, state: PersistedReviewState | null) {
  const storage = getReviewStateStorage();
  if (!storage) return "unavailable" as const;
  try {
    if (!state || !Object.keys(state.drafts).length) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(state));
    return "ok" as const;
  } catch {
    return "failed" as const;
  }
}

export function cleanupPersistedReviewStates() {
  const storage = getReviewStateStorage();
  if (!storage) return;
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (!key?.startsWith(`${REVIEW_STATE_STORAGE_KEY}:`)) continue;
      const value = safeParse(storage.getItem(key) ?? "");
      if (!value || typeof value !== "object") {
        storage.removeItem(key);
        continue;
      }
      const state = value as { drafts?: Record<string, { savedAt?: unknown }> };
      if (
        !state.drafts ||
        Object.values(state.drafts).some(
          (draft) => typeof draft.savedAt !== "number" || Date.now() - draft.savedAt > REVIEW_STATE_MAX_AGE_MS,
        )
      ) {
        storage.removeItem(key);
      }
    }
  } catch {
    // Local storage is optional; callers surface the failure when their own read/write fails.
  }
}

export function draftReviewFingerprint(item: LtmDraftReviewDraft) {
  return JSON.stringify({
    status: item.draft.status,
    freshness: item.freshness,
    source: item.draft.source,
    scope: item.draft.scope,
    modes: item.draft.modes,
    updatedAt: item.draft.updatedAt,
    mutations: item.draft.mutations,
  });
}

export function draftReviewContextFingerprint(item: LtmDraftReviewDraft) {
  return JSON.stringify({
    freshness: item.freshness,
    source: item.draft.source,
    scope: item.draft.scope,
    modes: item.draft.modes,
  });
}

export function mutationFingerprint(mutation: LtmDraftMutation) {
  return JSON.stringify(mutation);
}

export function buildPersistedReviewState(
  reviewData: LtmDraftReviewResponse | undefined,
  reviewDataSignature: string | null,
  reviewStateHydrated: string | null,
  reviewStateKey: string,
  chatId: string | null | undefined,
  selectedIds: ReadonlySet<string>,
  editedById: ReadonlyMap<string, LtmDraftMutation>,
  linkChoicesById: ReadonlyMap<string, LtmDraftLinkChoice>,
) {
  if (!reviewData || !reviewDataSignature || reviewStateHydrated !== `${reviewStateKey}:${reviewDataSignature}`)
    return null;
  const drafts: PersistedReviewState["drafts"] = {};
  const currentDrafts = new Map(
    reviewData.sources.flatMap((source) => source.drafts.map((item) => [item.draft.id, item] as const)),
  );
  for (const [draftId, item] of currentDrafts) {
    if (item.draft.status !== "pending") continue;
    const appliedMutationIds = new Set(item.draft.appliedMutationIds ?? []);
    const pendingMutations = item.draft.mutations.filter((mutation) => !appliedMutationIds.has(mutation.id));
    const mutationIds = new Set(pendingMutations.map((mutation) => mutation.id));
    const selected = [...selectedIds].filter((id) => mutationIds.has(id));
    const editedMutations = [...editedById].filter(([id]) => mutationIds.has(id));
    const linkChoices = [...linkChoicesById].filter(([, choice]) => mutationIds.has(choice.mutationId));
    if (selected.length || editedMutations.length || linkChoices.length) {
      drafts[draftId] = {
        savedAt: Date.now(),
        draftFingerprint: draftReviewFingerprint(item),
        contextFingerprint: draftReviewContextFingerprint(item),
        mutationFingerprints: pendingMutations.map((mutation) => [mutation.id, mutationFingerprint(mutation)]),
        selectedIds: selected,
        editedMutations,
        linkChoices,
      };
    }
  }
  return {
    version: 3 as const,
    chatId: chatId ?? null,
    drafts,
  };
}
