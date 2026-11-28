// ──────────────────────────────────────────────
// Otome Hearth: Write your own… (#2146). A chapter's closing decision (its big choice, after which nothing is written)
// answered in the player's own words instead of an offered option: something they say or something they do. Choose
// this saves it as that choice's first-play pick (S/story/beats.ts chooseOption), as lasting as any, and the next
// chapter follows from it. The reader keeps the draft, so Not now, Escape or a stray tap on the backdrop loses no
// words. Enter starts a new line, and only Choose this sends, as in Your thoughts…. The arc's riddle (`riddle`, its
// question) asks for one word, said, in the same dialog.
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { Dialog } from "../../components/Dialog";
import type { ChoiceOption } from "../../shared/api-types";
import { OWN_ANSWER_MAX, RIDDLE_ANSWER_MAX } from "../../shared/arcs";
import { Pills, TextField } from "../setup/parts";

/** The player's own words, and whether they say them or do them. */
export type OwnAnswer = ChoiceOption["selection"];

interface OwnAnswerDialogProps {
  draft: OwnAnswer;
  onDraft: (draft: OwnAnswer) => void;
  /** While the pick is being saved. */
  busy: boolean;
  /** Why the last pick was not saved. */
  error: string | null;
  onSend: (answer: OwnAnswer) => void;
  onClose: () => void;
  /** The arc's riddle's question, when this answers it. */
  riddle?: string;
}

export function OwnAnswerDialog({ draft, onDraft, busy, error, onSend, onClose, riddle }: OwnAnswerDialogProps) {
  const { t } = useTranslation();
  const text = draft.text.trim();
  const sendable = !busy && !!text;
  return (
    <Dialog
      title={t(riddle ? "ui.otomeForge.reader.riddleTitle" : "ui.otomeForge.reader.ownAnswerTitle")}
      onClose={busy ? undefined : onClose}
      actions={
        <>
          <button
            type="button"
            className="of-button of-button--quiet of-button--small of-glass"
            aria-disabled={busy}
            onClick={() => {
              if (!busy) onClose();
            }}
          >
            {t("ui.otomeForge.reader.notNow")}
          </button>
          <button
            type="button"
            className="of-button of-button--primary of-button--small"
            aria-disabled={!sendable}
            onClick={() => {
              if (sendable) onSend({ kind: riddle ? "dialogue" : draft.kind, text });
            }}
          >
            {t("ui.otomeForge.reader.ownAnswerSend")}
          </button>
        </>
      }
    >
      {/* First, so focus starts in it. */}
      <TextField
        label={riddle ?? t("ui.otomeForge.reader.ownAnswerLabel")}
        value={draft.text}
        onChange={(next) => onDraft({ ...draft, text: next })}
        max={riddle ? RIDDLE_ANSWER_MAX : OWN_ANSWER_MAX}
        rows={riddle ? 1 : 3}
        hint={t(riddle ? "ui.otomeForge.reader.riddleHint" : "ui.otomeForge.reader.ownAnswerHint")}
        counter
      />
      {riddle ? null : (
        <Pills
          legend={t("ui.otomeForge.reader.ownAnswerKind")}
          value={draft.kind}
          options={[
            { value: "dialogue", label: t("ui.otomeForge.reader.ownAnswerSay") },
            { value: "action", label: t("ui.otomeForge.reader.ownAnswerDo") },
          ]}
          onChange={(kind) => onDraft({ ...draft, kind })}
          disabled={busy}
          small
        />
      )}
      <p className="of-hint" role="status">
        {busy ? t("ui.otomeForge.reader.choiceSaving") : ""}
      </p>
      {error && !busy ? (
        <p className="of-notice of-notice--error" role="alert">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
