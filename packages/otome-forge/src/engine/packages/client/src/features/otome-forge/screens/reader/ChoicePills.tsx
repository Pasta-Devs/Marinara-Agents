// ──────────────────────────────────────────────
// Otome Forge: a choice as pill cards (intent labels, never numbers). First play is canon: the pick is saved, and
// when it changes something between them "{name} will remember that." rises over the scene ("They'll remember that."
// when it touched more than one). A big choice says it lasts. A side-with choice (#2046) says so, in the group's name
// too (focus lands on an option, so a screen reader would skip the note), and each option names whom it backs. On a
// replay the first pick is marked, and any option shows its branch with nothing changed.
// ──────────────────────────────────────────────
import { forwardRef, useId } from "react";
import { useTranslation } from "react-i18next";
import { Heart, HeartHandshake, Lock, Scale } from "lucide-react";
import type { ChoiceOption, ForgeChoice } from "../../shared/api-types";

interface ChoicePillsProps {
  choice: ForgeChoice;
  /** The option first play made canon, when this read is a replay of it. */
  firstChoice: ChoiceOption | null;
  busy: boolean;
  error: string | null;
  /** #2046: a side-with choice, with the name of the love interest each option backs (optionId → name). */
  backs?: Record<string, string>;
  onChoose: (option: ChoiceOption) => void;
}

/** The ref is the first option's, so focus can land there when the choice appears. */
export const ChoicePills = forwardRef<HTMLButtonElement, ChoicePillsProps>(function ChoicePills(
  { choice, firstChoice, busy, error, backs, onChoose },
  firstRef,
) {
  const { t } = useTranslation();
  const id = useId();
  const big = choice.kind === "big";
  return (
    <section
      className="of-choices-panel"
      data-kind={choice.kind}
      data-side={backs ? "true" : undefined}
      role="group"
      aria-labelledby={backs ? `${id}-heading ${id}-side` : `${id}-heading`}
    >
      <h2 id={`${id}-heading`} className="of-choices-heading">
        {big ? t("ui.otomeForge.reader.choiceBig") : t("ui.otomeForge.reader.choicePrompt")}
      </h2>
      {big && !firstChoice ? (
        <p className="of-choices-note">
          <Lock size={13} strokeWidth={2.2} aria-hidden="true" />
          {t("ui.otomeForge.reader.choiceBigWarning")}
        </p>
      ) : null}
      {backs ? (
        <p id={`${id}-side`} className="of-choices-note">
          <Scale size={13} strokeWidth={2.2} aria-hidden="true" />
          {t("ui.otomeForge.reader.sideWith")}
        </p>
      ) : null}
      {firstChoice ? <p className="of-choices-note">{t("ui.otomeForge.reader.choiceReplay")}</p> : null}
      <ul className="of-choice-pills">
        {choice.options.map((option, index) => (
          <li key={option.id}>
            <button
              ref={index === 0 ? firstRef : undefined}
              type="button"
              className="of-choice-pill"
              data-first={firstChoice?.id === option.id}
              aria-disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                if (!busy) onChoose(option);
              }}
            >
              <Heart className="of-choice-pill-mark" size={13} strokeWidth={2} aria-hidden="true" />
              <span className="of-choice-pill-text">{option.text}</span>
              {backs?.[option.id] ? <span className="of-choice-backs">{backs[option.id]}</span> : null}
              {firstChoice?.id === option.id ? (
                <span className="of-choice-first">{t("ui.otomeForge.reader.choiceFirst")}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      <p className="of-choices-status" role="status" aria-live="polite">
        {busy ? t("ui.otomeForge.reader.choiceSaving") : (error ?? "")}
      </p>
    </section>
  );
});

/** "{{name}} will remember that.": a first-play choice that changed something between them. */
export function RememberToast({ name }: { name: string | null }) {
  const { t } = useTranslation();
  return (
    <p className="of-toast of-toast--remember">
      <HeartHandshake size={18} strokeWidth={1.8} aria-hidden="true" />
      <span>{name ? t("ui.otomeForge.reader.remembered", { name }) : t("ui.otomeForge.reader.rememberedSomeone")}</span>
    </p>
  );
}
