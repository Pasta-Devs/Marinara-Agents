// ──────────────────────────────────────────────
// Otome Hearth: Before this chapter (#2503). A main chapter's plan may ask the player up to two questions about the
// protagonist; they come before its first scene is written, each with its own field, and Continue sends them only once
// every one is answered (POST .../chapters/:key/answers, no model call). Each answer reaches only the scene it was asked
// for. It must be answered: Escape and the backdrop do nothing, and Not now leaves the chapter. Enter starts a new
// line, and only Continue sends, as in Your thoughts….
// ──────────────────────────────────────────────
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOtomeApi } from "../../api";
import { Dialog } from "../../components/Dialog";
import type { ChapterView } from "../../shared/api-types";
import { QUESTION_ANSWER_MAX } from "../../shared/arcs";
import { TextField } from "../setup/parts";

interface QuestionsDialogProps {
  questions: NonNullable<ChapterView["questions"]>;
  /** Saves the answers, one per question in order; rejects when they were not saved. */
  onAnswer: (answers: string[]) => Promise<void>;
  onLeave: () => void;
}

export function QuestionsDialog({ questions, onAnswer, onLeave }: QuestionsDialogProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const [drafts, setDrafts] = useState(() => questions.map(() => ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const introId = useId();
  const answers = drafts.map((draft) => draft.trim());
  const sendable = !busy && answers.every(Boolean);
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await onAnswer(answers);
    } catch (failure) {
      setError(otome.errorMessage(failure, "ui.otomeForge.reader.questionsFailed"));
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={t("ui.otomeForge.reader.questionsTitle")}
      describedBy={introId}
      actions={
        <>
          <button
            type="button"
            className="of-button of-button--quiet of-button--small of-glass"
            aria-disabled={busy}
            onClick={() => {
              if (!busy) onLeave();
            }}
          >
            {t("ui.otomeForge.reader.notNow")}
          </button>
          <button
            type="button"
            className="of-button of-button--primary of-button--small"
            aria-disabled={!sendable}
            onClick={() => {
              if (sendable) void send();
            }}
          >
            {t("ui.otomeForge.reader.questionsSend")}
          </button>
        </>
      }
    >
      <p id={introId} className="of-body">
        {t("ui.otomeForge.reader.questionsIntro")}
      </p>
      {questions.map((entry, n) => (
        <TextField
          key={n}
          label={entry.question}
          value={drafts[n] ?? ""}
          onChange={(next) => setDrafts((current) => current.map((draft, at) => (at === n ? next : draft)))}
          max={QUESTION_ANSWER_MAX}
          rows={3}
        />
      ))}
      {error ? (
        <p className="of-notice of-notice--error" role="alert">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
