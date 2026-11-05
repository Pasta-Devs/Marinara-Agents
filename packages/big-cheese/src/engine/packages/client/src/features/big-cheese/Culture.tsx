// Big Cheese: culture tags and traditions on the Place screen (content.md 7.1, 7.2).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Ctx } from "./parts";

// Opposite tags cancel (mirror of server core/culture.ts).
const OPP: Record<string, string> = {
  family: "cutthroat",
  cutthroat: "family",
  chaotic: "scholarly",
  scholarly: "chaotic",
  strict: "free",
  free: "strict",
  festive: "frugal",
  frugal: "festive",
  secretive: "honour_bound",
  honour_bound: "secretive",
};

export function Culture({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { run, busy, act } = ctx;
  const [confirm, setConfirm] = useState<string | null>(null);
  const top = Object.entries(run.game.culture ?? {})
    .filter(([tag, points]) => tag in OPP && points >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);
  const tags = top.filter((tag) => !top.includes(OPP[tag]!));
  const active = (run.game.traditions ?? []).filter((x) => x.active);
  return (
    <section className="bc-section" aria-labelledby="bc-culture-title">
      <h2 id="bc-culture-title" className="bc-subhead">
        {t("ui.bigCheese.culture.title")}
      </h2>
      <p className="bc-muted">{t("ui.bigCheese.culture.help")}</p>
      {tags.length === 0 ? (
        <p>{t("ui.bigCheese.culture.none")}</p>
      ) : (
        <p className="bc-row-meta">
          {tags.map((tag) => (
            <span key={tag} className="bc-chip">
              {t(`ui.bigCheese.culture.tag.${tag}`)}
            </span>
          ))}
        </p>
      )}
      <h3 className="bc-subhead">{t("ui.bigCheese.culture.traditions")}</h3>
      {active.length === 0 ? (
        <p>{t("ui.bigCheese.culture.noTraditions")}</p>
      ) : (
        <ul className="bc-plain">
          {active.map((x) => (
            <li key={x.id} className="bc-row bc-row-flat">
              <span className="bc-row-text">
                <span className="bc-row-title">{x.text}</span>
                {confirm === x.id && (
                  <span className="bc-muted">{t("ui.bigCheese.culture.confirm", { text: x.text })}</span>
                )}
              </span>
              {confirm === x.id ? (
                <>
                  <button
                    type="button"
                    className="bc-btn bc-btn-primary"
                    disabled={busy || run.game.clock.hoursLeft < 1}
                    onClick={() => void act("traditions", { id: x.id, action: "stop" }).then(() => setConfirm(null))}
                  >
                    {t("ui.bigCheese.culture.confirmYes")}
                  </button>
                  <button type="button" className="bc-btn bc-btn-quiet" onClick={() => setConfirm(null)}>
                    {t("ui.bigCheese.culture.confirmNo")}
                  </button>
                </>
              ) : (
                <button type="button" className="bc-btn" disabled={busy} onClick={() => setConfirm(x.id)}>
                  {t("ui.bigCheese.culture.stop")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
