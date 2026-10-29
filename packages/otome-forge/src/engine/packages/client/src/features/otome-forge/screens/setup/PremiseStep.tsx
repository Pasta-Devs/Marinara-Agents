// ──────────────────────────────────────────────
// Otome Forge setup, step 1: the premise, the story's language and an optional title. "Surprise me" asks the model
// for a premise (POST /premise/suggest) and can be undone.
// ──────────────────────────────────────────────
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dices, Undo2 } from "lucide-react";
import { useOtomeApi } from "../../api";
import { LANGUAGE_MAX, LANGUAGE_SUGGESTIONS, PREMISE_MAX, TITLE_MAX, type SetupDraft } from "./draft";
import { TextField } from "./parts";

interface PremiseStepProps {
  draft: SetupDraft;
  update: (change: (draft: SetupDraft) => SetupDraft) => void;
  /** The connection "Surprise me" asks: the draft's planning connection, else its story one. */
  connectionId: string;
}

export function PremiseStep({ draft, update, connectionId }: PremiseStepProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);
  const id = useId();
  // The premise as it is now, or null once this step has closed (the player moved on, or Start over remounted it), so a
  // suggestion that arrives late never replaces what the player wrote meanwhile.
  const livePremise = useRef<string | null>(draft.premise);
  useEffect(() => {
    livePremise.current = draft.premise;
  }, [draft.premise]);
  useEffect(
    () => () => {
      livePremise.current = null;
    },
    [],
  );

  const surprise = async () => {
    if (busy) return;
    if (!connectionId) {
      setError(t("ui.otomeForge.errors.noConnection"));
      return;
    }
    const before = draft.premise;
    setBusy(true);
    setError(null);
    try {
      const { premise } = await otome.post<{ premise: string }>("/premise/suggest", {
        language: draft.language.trim() || "English",
        connectionId,
      });
      if (livePremise.current !== before) return;
      setPrevious(before);
      update((current) => ({ ...current, premise: premise.slice(0, PREMISE_MAX) }));
    } catch (failure) {
      setError(otome.errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="of-step-body">
      <p className="of-hand of-step-note">{t("ui.otomeForge.setup.premiseNote")}</p>
      <TextField
        label={t("ui.otomeForge.setup.premiseLabel")}
        placeholder={t("ui.otomeForge.setup.premisePlaceholder")}
        rows={7}
        max={PREMISE_MAX}
        counter
        value={draft.premise}
        onChange={(premise) => update((current) => ({ ...current, premise }))}
      />
      <div className="of-inline-actions">
        <button
          type="button"
          className="of-button of-button--quiet of-glass of-button--small"
          aria-disabled={busy}
          aria-describedby={`${id}-surprise`}
          onClick={() => void surprise()}
        >
          <Dices className={busy ? "of-pulse" : undefined} size={16} strokeWidth={2} aria-hidden="true" />
          {busy ? t("ui.otomeForge.setup.surpriseBusy") : t("ui.otomeForge.setup.surprise")}
        </button>
        {previous !== null && !busy ? (
          <button
            type="button"
            className="of-button of-button--text of-button--small"
            onClick={() => {
              update((current) => ({ ...current, premise: previous }));
              setPrevious(null);
            }}
          >
            <Undo2 size={15} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.setup.surpriseUndo")}
          </button>
        ) : null}
      </div>
      <p id={`${id}-surprise`} className="of-hint">
        {t("ui.otomeForge.setup.surpriseHint")}
      </p>
      <div role="status" aria-live="polite" className="of-live">
        {error ? <p className="of-notice of-notice--error">{error}</p> : null}
      </div>
      <TextField
        label={t("ui.otomeForge.setup.languageLabel")}
        hint={t("ui.otomeForge.setup.languageHint")}
        list={`${id}-languages`}
        max={LANGUAGE_MAX}
        value={draft.language}
        onChange={(language) => update((current) => ({ ...current, language }))}
      />
      <datalist id={`${id}-languages`}>
        {LANGUAGE_SUGGESTIONS.map((language) => (
          <option key={language} value={language} />
        ))}
      </datalist>
      <TextField
        label={t("ui.otomeForge.setup.writingStyleLabel")}
        hint={t("ui.otomeForge.setup.writingStyleHint")}
        placeholder={t("ui.otomeForge.setup.writingStylePlaceholder")}
        rows={3}
        value={draft.writingStyle}
        onChange={(writingStyle) => update((current) => ({ ...current, writingStyle }))}
      />
      <TextField
        label={t("ui.otomeForge.setup.titleLabel")}
        hint={t("ui.otomeForge.setup.titleHint")}
        max={TITLE_MAX}
        value={draft.title}
        onChange={(title) => update((current) => ({ ...current, title }))}
      />
    </div>
  );
}
