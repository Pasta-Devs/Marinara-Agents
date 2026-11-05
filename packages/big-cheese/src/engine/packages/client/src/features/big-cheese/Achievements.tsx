// ──────────────────────────────────────────────
// Big Cheese: the achievements a run unlocked (content.md 10.2), shown on its ending card
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import type { EndCard } from "./api";

export function Achievements({ list }: { list: EndCard["achievements"] }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="bc-ach-title">
      <h2 id="bc-ach-title" className="bc-receipt-head">
        {t("ui.bigCheese.ending.achievements")}
      </h2>
      {list.length === 0 ? (
        <p className="bc-muted">{t("ui.bigCheese.ending.noAchievements")}</p>
      ) : (
        <ul className="bc-plain">
          {list.map((a) => (
            <li key={a.id}>{a.name}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
