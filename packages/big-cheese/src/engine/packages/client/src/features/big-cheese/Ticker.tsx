// ──────────────────────────────────────────────
// Big Cheese: the ticker, a few lines of floor talk and rumour (ui.md §5.11)
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { PlantRumour } from "./Eyes"; // T13
import { Face, nameOf, type Ctx } from "./parts";

const LINES = 3;

/** This morning's room lines, then the newest rumour. Renders nothing before the first batch. */
export function Ticker({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { run, kit } = ctx;
  const place = run.text.place;
  const newest = run.game.grapevine[run.game.grapevine.length - 1];
  const rumour = newest ? place?.grapevine[newest] : undefined;
  const lines = [
    ...(place?.morning ?? []).map((l) => ({ who: l.person, text: l.text })),
    ...(rumour ? [{ who: rumour.source, text: rumour.text }] : []),
  ].slice(0, LINES);
  if (lines.length === 0) return <PlantRumour ctx={ctx} />;
  return (
    <>
      <ul className="bc-plain" aria-label={t("ui.bigCheese.ticker.label")}>
        {lines.map((line, index) => (
          <li key={index} className="bc-row bc-row-flat">
            <Face kit={kit} id={line.who} size="s" />
            <span className="bc-row-text">
              <span className="bc-muted">{nameOf(kit, line.who)}</span>
              <span>{line.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <PlantRumour ctx={ctx} />
    </>
  );
}
