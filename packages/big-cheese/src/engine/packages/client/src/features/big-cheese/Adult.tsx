// Big Cheese: the adult module switch (README Adult module). Off by default; turning it on needs the adult confirm.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Ctx } from "./parts";

const LEVELS = ["ui.bigCheese.adult.level0", "ui.bigCheese.adult.level1", "ui.bigCheese.adult.level2"] as const;
const THEME_KEYS: Record<string, string> = {
  romance: "ui.bigCheese.adult.theme.romance",
  workplace: "ui.bigCheese.adult.theme.workplace",
  love_life: "ui.bigCheese.adult.theme.love_life",
  rivals: "ui.bigCheese.adult.theme.rivals",
  cuckold: "ui.bigCheese.adult.theme.cuckold",
  open: "ui.bigCheese.adult.theme.open",
  power: "ui.bigCheese.adult.theme.power",
};

export function Adult({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { run, busy, act } = ctx;
  const cur = run.game.adult ?? null;
  const [confirm, setConfirm] = useState(false);
  const [level, setLevel] = useState(cur?.intensity ?? 1);
  const [themes, setThemes] = useState<string[]>(cur?.themes ?? []);
  const [own, setOwn] = useState("");
  const toggle = (id: string) => setThemes((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const words = own
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
  return (
    <section className="bc-section" aria-labelledby="bc-adult-title">
      <h2 id="bc-adult-title" className="bc-subhead">
        {t("ui.bigCheese.adult.title")}
      </h2>
      <p className="bc-muted">{t("ui.bigCheese.adult.help")}</p>
      <div role="group" aria-label={t("ui.bigCheese.adult.level")} className="bc-modes">
        {LEVELS.map((key, n) => (
          <button
            key={key}
            type="button"
            className="bc-btn bc-btn-quiet"
            aria-pressed={level === n}
            onClick={() => setLevel(n)}
          >
            {t(key)}
          </button>
        ))}
      </div>
      <div role="group" aria-label={t("ui.bigCheese.adult.themes")} className="bc-modes">
        {Object.entries(THEME_KEYS).map(([id, key]) => (
          <button
            key={id}
            type="button"
            className="bc-btn bc-btn-quiet"
            aria-pressed={themes.includes(id)}
            onClick={() => toggle(id)}
          >
            {t(key)}
          </button>
        ))}
      </div>
      <label className="bc-muted">
        {t("ui.bigCheese.adult.own")}
        <input value={own} maxLength={200} onChange={(e) => setOwn(e.target.value)} />
      </label>
      {!cur && (
        <label>
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />{" "}
          {t("ui.bigCheese.adult.confirm")}
        </label>
      )}
      <button
        type="button"
        className="bc-btn bc-btn-primary"
        disabled={busy || (!cur && !confirm)}
        onClick={() =>
          void act("adult", {
            on: true,
            confirmAdult: confirm || !!cur,
            intensity: level,
            themes: [...themes, ...words],
          })
        }
      >
        {t(cur ? "ui.bigCheese.adult.save" : "ui.bigCheese.adult.on")}
      </button>
      {cur && (
        <button type="button" className="bc-btn" disabled={busy} onClick={() => void act("adult", { on: false })}>
          {t("ui.bigCheese.adult.off")}
        </button>
      )}
    </section>
  );
}
