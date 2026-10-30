// ──────────────────────────────────────────────
// Otome Forge: the Confrontation, a three-round argument at a chapter's climax (plan M2b). Each round she answers
// with a stance, Press, Hold, Yield or Reveal, each carrying the line she would say; his face swaps with his answer.
// Composure decides the ending and is never shown: the round ends on his lines, and the ending on its own card.
// The Closer (#1938), the warm climax, plays on the same pills and card with its own answers (Reassure, Tease, Mirror,
// Ask) and endings (Opened up, Almost, Shut out); its guard is never shown either.
// ──────────────────────────────────────────────
// The reader plays it as a beat (lib/reader-state.ts confrontationBeat), so typing, Auto, the backlog, voices and Ease
// off work as in any scene; this file draws the stance pills that stand in for the choice, and the ending's card.
import { forwardRef, useId, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import {
  DoorClosed,
  DoorOpen,
  Hand,
  HandHeart,
  HeartHandshake,
  Hourglass,
  KeyRound,
  Laugh,
  MessageCircleHeart,
  MessageCircleQuestionMark,
  Scale,
  Shield,
  Sparkles,
  Sunrise,
  Swords,
  type LucideIcon,
} from "lucide-react";
import { accentOf } from "../../lib/accent";
import type { ChoiceOption, ForgeChoice, RunLiView } from "../../shared/api-types";
import { ALL_CLIMAX_MOVES, CONFRONTATION_ROUNDS, type ClimaxEnding, type ClimaxMove } from "../../shared/arcs";

const STANCE_META: Record<ClimaxMove, { nameKey: string; hintKey: string; Icon: LucideIcon }> = {
  press: {
    nameKey: "ui.otomeForge.confrontation.press",
    hintKey: "ui.otomeForge.confrontation.pressHint",
    Icon: Swords,
  },
  hold: { nameKey: "ui.otomeForge.confrontation.hold", hintKey: "ui.otomeForge.confrontation.holdHint", Icon: Shield },
  yield: { nameKey: "ui.otomeForge.confrontation.yield", hintKey: "ui.otomeForge.confrontation.yieldHint", Icon: Hand },
  reveal: {
    nameKey: "ui.otomeForge.confrontation.reveal",
    hintKey: "ui.otomeForge.confrontation.revealHint",
    Icon: KeyRound,
  },
  reassure: {
    nameKey: "ui.otomeForge.closer.reassure",
    hintKey: "ui.otomeForge.closer.reassureHint",
    Icon: HeartHandshake,
  },
  tease: { nameKey: "ui.otomeForge.closer.tease", hintKey: "ui.otomeForge.closer.teaseHint", Icon: Laugh },
  mirror: {
    nameKey: "ui.otomeForge.closer.mirror",
    hintKey: "ui.otomeForge.closer.mirrorHint",
    Icon: MessageCircleHeart,
  },
  ask: {
    nameKey: "ui.otomeForge.closer.ask",
    hintKey: "ui.otomeForge.closer.askHint",
    Icon: MessageCircleQuestionMark,
  },
};

const OUTCOME_META: Record<ClimaxEnding, { titleKey: string; textKey: string; endedKey: string; Icon: LucideIcon }> = {
  truth: {
    titleKey: "ui.otomeForge.confrontation.truthTitle",
    textKey: "ui.otomeForge.confrontation.truthText",
    endedKey: "ui.otomeForge.confrontation.ended",
    Icon: HandHeart,
  },
  walkout: {
    titleKey: "ui.otomeForge.confrontation.walkoutTitle",
    textKey: "ui.otomeForge.confrontation.walkoutText",
    endedKey: "ui.otomeForge.confrontation.ended",
    Icon: DoorOpen,
  },
  standoff: {
    titleKey: "ui.otomeForge.confrontation.standoffTitle",
    textKey: "ui.otomeForge.confrontation.standoffText",
    endedKey: "ui.otomeForge.confrontation.ended",
    Icon: Scale,
  },
  opened: {
    titleKey: "ui.otomeForge.closer.openedTitle",
    textKey: "ui.otomeForge.closer.openedText",
    endedKey: "ui.otomeForge.closer.ended",
    Icon: Sunrise,
  },
  almost: {
    titleKey: "ui.otomeForge.closer.almostTitle",
    textKey: "ui.otomeForge.closer.almostText",
    endedKey: "ui.otomeForge.closer.ended",
    Icon: Hourglass,
  },
  shut: {
    titleKey: "ui.otomeForge.closer.shutTitle",
    textKey: "ui.otomeForge.closer.shutText",
    endedKey: "ui.otomeForge.closer.ended",
    Icon: DoorClosed,
  },
};

/** The round a stance choice belongs to (`round-<n>`). */
const roundOf = (choice: ForgeChoice) => Number(/^round-(\d+)$/u.exec(choice.id)?.[1] ?? 1) || 1;

interface StancePillsProps {
  choice: ForgeChoice;
  /** The love interest she is facing, for his colour. */
  li: RunLiView | null;
  busy: boolean;
  error: string | null;
  onChoose: (option: ChoiceOption) => void;
}

/** The ref is the first stance's, so focus lands there when the round asks for one. */
export const StancePills = forwardRef<HTMLButtonElement, StancePillsProps>(function StancePills(
  { choice, li, busy, error, onChoose },
  firstRef,
) {
  const { t } = useTranslation();
  const id = useId();
  const round = roundOf(choice);
  const options = ALL_CLIMAX_MOVES.flatMap((stance) => {
    const option = choice.options.find((item) => item.id === stance);
    return option ? [{ stance, option }] : [];
  });
  const style = li ? ({ "--of-li-accent": accentOf(li) } as CSSProperties) : undefined;
  return (
    <section className="of-stances" role="group" aria-labelledby={`${id}-heading`} style={style}>
      <p className="of-stances-round" aria-hidden="true">
        <Sparkles size={12} strokeWidth={2.2} />
        {t("ui.otomeForge.confrontation.round", { round, total: CONFRONTATION_ROUNDS })}
      </p>
      <h2 id={`${id}-heading`} className="of-choices-heading">
        <span className="of-visually-hidden">
          {t("ui.otomeForge.confrontation.round", { round, total: CONFRONTATION_ROUNDS })}{" "}
        </span>
        {t("ui.otomeForge.confrontation.prompt")}
      </h2>
      <ul className="of-stance-list">
        {options.map(({ stance, option }, index) => {
          const { nameKey, hintKey, Icon } = STANCE_META[stance];
          return (
            <li key={stance}>
              <button
                ref={index === 0 ? firstRef : undefined}
                type="button"
                className="of-stance"
                data-stance={stance}
                aria-disabled={busy}
                aria-describedby={`${id}-${stance}-hint`}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!busy) onChoose(option);
                }}
              >
                <span className="of-stance-mark" aria-hidden="true">
                  <Icon size={16} strokeWidth={2} />
                </span>
                <span className="of-stance-body">
                  <span className="of-stance-name">{t(nameKey)}</span>
                  <span className="of-stance-line">{option.text}</span>
                </span>
                <span id={`${id}-${stance}-hint`} className="of-visually-hidden">
                  {t(hintKey)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="of-choices-status" role="status" aria-live="polite">
        {busy ? t("ui.otomeForge.confrontation.answering") : (error ?? "")}
      </p>
    </section>
  );
});

interface ConfrontationEndProps {
  outcome: ClimaxEnding;
  /** The love interest she faced; the card names him. */
  li: RunLiView | null;
  onGoOn: () => void;
}

/** How the argument ended, in words, never numbers. Go on moves to the next scene. */
export function ConfrontationEnd({ outcome, li, onGoOn }: ConfrontationEndProps) {
  const { t } = useTranslation();
  const id = useId();
  const { titleKey, textKey, endedKey, Icon } = OUTCOME_META[outcome];
  const name = li?.name ?? t("ui.otomeForge.confrontation.someone");
  const style = li ? ({ "--of-li-accent": accentOf(li) } as CSSProperties) : undefined;
  return (
    <section
      className="of-reader-panel of-outcome of-glass of-glass--strong"
      data-outcome={outcome}
      aria-labelledby={id}
      style={style}
    >
      <span className="of-outcome-mark" aria-hidden="true">
        <Icon size={22} strokeWidth={1.7} />
      </span>
      <p className="of-eyebrow">{t(endedKey)}</p>
      <h2 id={id} className="of-outcome-title" tabIndex={-1} data-autofocus="">
        {t(titleKey, { name })}
      </h2>
      <p className="of-body">{t(textKey, { name })}</p>
      <button
        type="button"
        className="of-button of-button--primary of-button--small"
        onClick={(event) => {
          event.stopPropagation();
          onGoOn();
        }}
      >
        {t("ui.otomeForge.confrontation.goOn")}
      </button>
    </section>
  );
}
