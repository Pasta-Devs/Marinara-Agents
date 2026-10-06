// Opening day's answers as words: the label of one answer (a card, the player's reply), and every
// answer as a row with Change (the "Change something" sheet, "Your file" in the Support desk).
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SLP_GROUP_CLASS, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpButton } from "../../modules/chrome/SlpButton";
import { slpRailAnswers, type SlpRailContext, type SlpRailQuestion, type SlpRailState } from "./slp-site-welcome";

type T = ReturnType<typeof useUiTranslation>["t"];

/** What one answer reads as: a chip or the player's bubble ("answer"), or a file row ("row"). */
export function slpRailAnswerLabel(
  t: T,
  id: SlpRailQuestion,
  value: string | undefined,
  context: SlpRailContext,
  as: "answer" | "row" = "answer",
) {
  if (value === undefined) return t(id === "connection" ? "ui.slurp.site.value.none" : "ui.slurp.scene.page.empty");
  if (id === "who" && as === "row") return t(`ui.slurp.site.value.who.${value}`);
  if (id === "connection" || id === "imageConnection") {
    const list = id === "connection" ? context.textConnections : context.imageConnections;
    return list.find((connection) => connection.id === value)?.name ?? value;
  }
  return t(`ui.slurp.opening.a.${id}.${value}`);
}

/** Every answer as a row: the member file, "Your Slurp", and "Your file" in the Support desk. */
export function SlpRailFileRows({
  rows,
  state,
  context,
  recent,
  onChange,
}: {
  rows: readonly SlpRailQuestion[];
  state: SlpRailState;
  context: SlpRailContext;
  recent?: SlpRailQuestion | null;
  onChange?: (id: SlpRailQuestion) => void;
}) {
  const { t } = useUiTranslation();
  const answers = slpRailAnswers(state, context);
  return (
    <ul className={SLP_GROUP_CLASS}>
      {rows.map((id) => (
        <li
          key={id}
          className={cn(
            "flex min-h-12 items-center gap-2 px-4 py-2 transition-colors duration-[var(--slurp-motion-slow)] motion-reduce:transition-none",
            id === recent && "bg-[var(--slurp-tint)]",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t(`ui.slurp.site.label.${id}`)}</p>
            <p className={cn(SLP_TYPE.body, "break-words")}>
              {slpRailAnswerLabel(t, id, id === "fun" ? (answers.fun ?? "skip") : answers[id], context, "row")}
            </p>
          </div>
          {onChange && (
            <SlpButton
              variant="tertiary"
              className="min-h-11 shrink-0 px-3 text-xs"
              aria-label={`${t("ui.slurp.site.change")}: ${t(`ui.slurp.site.label.${id}`)}`}
              onClick={() => onChange(id)}
            >
              {t("ui.slurp.site.change")}
            </SlpButton>
          )}
        </li>
      ))}
    </ul>
  );
}
