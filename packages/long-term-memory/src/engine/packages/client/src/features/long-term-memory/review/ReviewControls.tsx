import { useEffect, useRef } from "react";
import {
  type LtmDraftMutation,
  type LtmNote,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { inputClass } from "../shared-controls";
import { selectLtmPluralForm, useLtmTranslation } from "../localization";
import {
  ambiguousLinkChoiceTarget,
  ambiguousLinkUnresolvedChoiceValue,
  ambiguousLinkDetails,
  replaceAmbiguousLinkTarget,
  type AmbiguousLinkDiagnostic,
} from "./review-queue-ambiguous-link";

const CONFLICT_TEXT_PREVIEW_LENGTH = 280;

function previewConflictText(value: string) {
  return value.length > CONFLICT_TEXT_PREVIEW_LENGTH ? `${value.slice(0, CONFLICT_TEXT_PREVIEW_LENGTH)}...` : value;
}

export function ConflictValue({ label, value }: { label: string; value: string }) {
  const labelParts = label.split("{{value}}", 2);
  const renderedLabel = (
    <>
      {labelParts[0]}
      <span className="font-normal">
        {value.length <= CONFLICT_TEXT_PREVIEW_LENGTH ? value : previewConflictText(value)}
      </span>
      {labelParts[1]}
    </>
  );
  if (value.length <= CONFLICT_TEXT_PREVIEW_LENGTH) return renderedLabel;
  return (
    <details>
      <summary className="cursor-pointer">{renderedLabel}</summary>
      <p className="mt-1 break-words">{value}</p>
    </details>
  );
}

export function ReviewProgress({
  sources,
  pending,
  ready,
  blocked,
  reviewed,
  remaining,
}: {
  sources: number;
  pending: number;
  ready: number;
  blocked: number;
  reviewed: number;
  remaining: number;
}) {
  const { t: localizeUi, locale } = useLtmTranslation();
  return (
    <span data-ltm-review-summary data-ltm-review-progress className="text-xs text-[var(--muted-foreground)]">
      {localizeUi("ui.longTermMemory.reviewqueue.reviewSummary", {
        sources,
        source:
          selectLtmPluralForm(locale, sources) === "one"
            ? localizeUi("ui.longTermMemory.reviewqueue.source")
            : localizeUi("ui.longTermMemory.reviewqueue.sources"),
        pending,
        ready,
        blocked,
      })}
      {localizeUi("ui.longTermMemory.reviewqueue.reviewProgress", { reviewed, remaining })}
    </span>
  );
}

export function SelectionCheckbox({
  checked,
  indeterminate = false,
  label,
  compact = false,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  compact?: boolean;
  onChange: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-[var(--foreground)]">
      <input
        ref={inputRef}
        type="checkbox"
        data-ltm-control="review-select"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded accent-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
      />
      <span className={compact ? "sr-only" : undefined}>{label}</span>
    </label>
  );
}

export function AmbiguousLinkChoice({
  mutation,
  diagnostic,
  noteById,
  explicitTarget,
  onChange,
}: {
  mutation: LtmDraftMutation;
  diagnostic: AmbiguousLinkDiagnostic;
  noteById: ReadonlyMap<string, LtmNote>;
  explicitTarget?: string;
  onChange: (mutation: LtmDraftMutation, selectedTarget: string | null) => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const details = ambiguousLinkDetails(diagnostic);
  if (!details) return null;
  const selectedTarget = ambiguousLinkChoiceTarget(mutation, diagnostic, explicitTarget);
  if (selectedTarget === null) return null;
  return (
    <div data-ltm-review-link-choice className="mari-editor-panel mari-editor-panel--soft space-y-2 p-3 text-xs">
      <p className="font-semibold">{localizeUi("ui.longTermMemory.reviewqueue.ambiguousLinkChoiceTitle")}</p>
      <p className="text-[var(--muted-foreground)]">
        {localizeUi("ui.longTermMemory.reviewqueue.ambiguousLinkChoiceDescription", {
          target: details.linkTarget,
        })}
      </p>
      <label className="block space-y-1 font-medium">
        <span>{localizeUi("ui.longTermMemory.reviewqueue.ambiguousLinkChoiceLabel")}</span>
        <select
          data-ltm-review-link-choice-select
          aria-label={localizeUi("ui.longTermMemory.reviewqueue.ambiguousLinkChoiceLabel")}
          className={inputClass}
          value={selectedTarget}
          onChange={(event) => {
            const selected =
              event.target.value === ambiguousLinkUnresolvedChoiceValue(details) ? null : event.target.value;
            onChange(replaceAmbiguousLinkTarget(mutation, details, event.target.value), selected);
          }}
        >
          <option value={ambiguousLinkUnresolvedChoiceValue(details)}>
            {localizeUi("ui.longTermMemory.reviewqueue.ambiguousLinkChoiceUnresolved")}
          </option>
          {details.candidateTargetNoteIds.map((candidateId) => (
            <option key={candidateId} value={candidateId}>
              {noteById.get(candidateId)?.title?.trim() || candidateId}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
