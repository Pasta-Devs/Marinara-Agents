import { useCallback, useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  LtmExtractionDraft,
  LtmSubjectIdentityReview,
  LtmSubjectIdentityDecision,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { errorMessage, invalidateLtmQueries, queryKeys, request } from "../api";
import { Button, inputClass, lockedActionProps, StatusSurface } from "../shared-controls";
import { useLtmTranslation } from "../localization";

type Candidate = LtmSubjectIdentityReview["candidates"][number];
type IdentityChoice = { name: string; action: "" } | LtmSubjectIdentityDecision;

type Props = {
  suggestionId: string;
  review: LtmSubjectIdentityReview[];
  onDirtyChange: (suggestionId: string, dirty: boolean) => void;
  onRegisterSave: (suggestionId: string, save: (() => Promise<boolean>) | null) => void;
  onResolved: (skipped: boolean) => void;
};

export default function SubjectIdentityReview({
  suggestionId,
  review,
  onDirtyChange,
  onRegisterSave,
  onResolved,
}: Props) {
  const { t: localizeUi } = useLtmTranslation();
  const queryClient = useQueryClient();
  const id = useId();
  const initialChoices = (): IdentityChoice[] =>
    review.map((participant) => {
      const matched = participant.candidates.find(
        (candidate) => candidate.subject.key === participant.matchedSubjectKey,
      );
      return matched
        ? { name: participant.name, action: "bind", subjectKey: matched.subject.key }
        : { name: participant.name, action: "" };
    });
  const [choices, setChoices] = useState<IdentityChoice[]>(initialChoices);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const save = useCallback(async () => {
    const decisions = choices.flatMap((choice): LtmSubjectIdentityDecision[] => {
      if (choice.action === "bind" && choice.subjectKey)
        return [{ name: choice.name, action: "bind", subjectKey: choice.subjectKey }];
      if (choice.action === "different" || choice.action === "skip")
        return [{ name: choice.name, action: choice.action }];
      return [];
    });
    if (busy || decisions.length !== choices.length) return false;
    setBusy(true);
    setError("");
    try {
      await request<{ resolved: true; suggestionId: string; draft: LtmExtractionDraft | null }>(
        `/rejected-suggestions/${encodeURIComponent(suggestionId)}/resolve-identity`,
        "POST",
        { choices: decisions },
      );
      await invalidateLtmQueries(queryClient, [
        queryKeys.rejectedSuggestions,
        queryKeys.savedIdentityChoices,
        queryKeys.review,
        queryKeys.pendingDrafts,
        queryKeys.status,
        queryKeys.localCharactersRoot,
      ]);
      onDirtyChange(suggestionId, false);
      onRegisterSave(suggestionId, null);
      setDirty(false);
      setSaved(true);
      onResolved(decisions.some((choice) => choice.action === "skip"));
      return true;
    } catch (cause) {
      setError(errorMessage(cause, localizeUi("ui.longTermMemory.reviewqueue.requestFailed")));
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, choices, localizeUi, onDirtyChange, onRegisterSave, onResolved, queryClient, suggestionId]);

  useEffect(() => {
    onRegisterSave(suggestionId, dirty ? save : null);
    return () => onRegisterSave(suggestionId, null);
  }, [dirty, onRegisterSave, save, suggestionId]);

  useEffect(() => () => onDirtyChange(suggestionId, false), [onDirtyChange, suggestionId]);

  // A candidate reads as its name plus its kind. Two candidates with the same name and kind also show their id.
  const candidateLabel = (candidate: Candidate, siblings: Candidate[]) => {
    const { name, subject } = candidate;
    const kind = localizeUi(
      subject.ref?.kind === "character"
        ? "ui.longTermMemory.reviewqueue.identityKindCharacter"
        : subject.ref?.kind === "persona"
          ? "ui.longTermMemory.reviewqueue.identityKindPersona"
          : subject.ref?.kind === "local_character"
            ? "ui.longTermMemory.reviewqueue.identityKindLocalCharacter"
            : "ui.longTermMemory.reviewqueue.identityKindOther",
    );
    const sameLook = siblings.filter(
      (other) => other.name === name && (other.subject.ref?.kind ?? "") === (subject.ref?.kind ?? ""),
    );
    return sameLook.length > 1
      ? localizeUi("ui.longTermMemory.reviewqueue.identityOptionWithId", {
          name,
          kind,
          id: subject.ref?.id ?? subject.key,
        })
      : localizeUi("ui.longTermMemory.reviewqueue.identityOption", { name, kind });
  };

  const setChoice = (index: number, value: string) => {
    if (busy) return;
    const participant = review[index]!;
    const nextChoice: IdentityChoice = !value
      ? { name: participant.name, action: "" }
      : value === "different" || value === "skip"
        ? { name: participant.name, action: value }
        : { name: participant.name, action: "bind", subjectKey: value };
    setChoices((current) => current.map((choice, choiceIndex) => (choiceIndex === index ? nextChoice : choice)));
    setSaved(false);
    setError("");
    if (!dirty) {
      setDirty(true);
      onDirtyChange(suggestionId, true);
    }
  };

  return (
    <section className="space-y-3 border-t border-[var(--border)] pt-3" data-ltm-identity-review={suggestionId}>
      <p className="text-xs text-[var(--muted-foreground)]">
        {localizeUi("ui.longTermMemory.reviewqueue.identityReviewHelp")}
      </p>
      {review.map((participant, index) => {
        const fieldId = `${id}-${index}`;
        const choice = choices[index]!;
        const usedSubjectKeys = new Set(
          choices.flatMap((other, otherIndex) =>
            otherIndex !== index && other.action === "bind" && other.subjectKey ? [other.subjectKey] : [],
          ),
        );
        return (
          <div key={`${participant.name}-${index}`} className="space-y-1">
            <label htmlFor={fieldId} className="text-sm font-medium">
              {participant.name}
            </label>
            <select
              id={fieldId}
              className={`${inputClass}${busy ? " opacity-50" : ""}`}
              value={choice.action === "bind" ? (choice.subjectKey ?? "") : choice.action}
              aria-disabled={busy || undefined}
              onChange={(event) => setChoice(index, event.currentTarget.value)}
            >
              <option value="">{localizeUi("ui.longTermMemory.reviewqueue.chooseIdentity")}</option>
              {participant.candidates.map((candidate) => (
                <option
                  key={candidate.subject.key}
                  value={candidate.subject.key}
                  title={candidate.subject.key}
                  disabled={usedSubjectKeys.has(candidate.subject.key)}
                >
                  {candidateLabel(candidate, participant.candidates)}
                </option>
              ))}
              {participant.allowDifferent ? (
                <option value="different">{localizeUi("ui.longTermMemory.reviewqueue.differentIdentity")}</option>
              ) : null}
              <option value="skip">{localizeUi("ui.longTermMemory.reviewqueue.skipIdentityParticipant")}</option>
            </select>
          </div>
        );
      })}
      {error ? (
        <StatusSurface tone="danger" role="alert">
          {error}
        </StatusSurface>
      ) : null}
      {saved ? (
        <StatusSurface tone="success" role="status">
          {localizeUi(
            choices.some((choice) => choice.action === "skip")
              ? "ui.longTermMemory.reviewqueue.identitySkipSaved"
              : "ui.longTermMemory.reviewqueue.identityChoicesSaved",
          )}
        </StatusSurface>
      ) : null}
      <Button
        primary={!choices.some((choice) => choice.action === "skip")}
        disabled={choices.some((choice) => !choice.action || (choice.action === "bind" && !choice.subjectKey))}
        {...lockedActionProps(busy)}
        onClick={() => void save()}
      >
        {busy
          ? localizeUi("ui.longTermMemory.reviewqueue.savingIdentityChoices")
          : localizeUi(
              choices.some((choice) => choice.action === "skip")
                ? "ui.longTermMemory.reviewqueue.saveSkipChoice"
                : "ui.longTermMemory.reviewqueue.saveChoicesAndReviewMemory",
            )}
      </Button>
      {dirty ? (
        <Button
          {...lockedActionProps(busy)}
          onClick={() => {
            if (busy) return;
            setChoices(initialChoices());
            setDirty(false);
            setError("");
            onDirtyChange(suggestionId, false);
            onRegisterSave(suggestionId, null);
          }}
        >
          {localizeUi("ui.longTermMemory.reviewqueue.discardIdentityChoices")}
        </Button>
      ) : null}
    </section>
  );
}
