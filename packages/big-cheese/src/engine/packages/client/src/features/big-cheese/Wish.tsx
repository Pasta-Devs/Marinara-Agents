// ──────────────────────────────────────────────
// Big Cheese: an in-run wish (design.md section 3.7)
// ──────────────────────────────────────────────
// One line, 1-3 points. The wish arrives as cards in the next weeks, never as an instant change.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Ctx } from "./parts";

export function Wish({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { run, busy, act, go } = ctx;
  const [text, setText] = useState("");
  const [cost, setCost] = useState(1);
  const sandbox = run.game.mode === "sandbox";
  const left = run.game.wishPoints?.left ?? 0;
  const ok = !!text.trim() && (sandbox || cost <= left);

  const send = async () => {
    if (await act("wish", { text: text.trim(), cost })) go("office");
  };
  return (
    <>
      <h1 className="bc-heading" tabIndex={-1} data-focus>
        {t("ui.bigCheese.wish.title")}
      </h1>
      <p className="bc-muted">
        {sandbox ? t("ui.bigCheese.wish.unlimited") : t("ui.bigCheese.wish.left", { n: left })}
      </p>
      <label htmlFor="bc-wish-text">{t("ui.bigCheese.wish.label")}</label>
      <textarea
        id="bc-wish-text"
        maxLength={200}
        rows={3}
        value={text}
        disabled={busy}
        placeholder={t("ui.bigCheese.wish.hint")}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="bc-row-meta" role="group" aria-label={t("ui.bigCheese.wish.cost")}>
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            className="bc-btn bc-btn-quiet"
            aria-pressed={cost === n}
            disabled={busy || (!sandbox && n > left)}
            onClick={() => setCost(n)}
          >
            {t("ui.bigCheese.wish.points", { count: n })}
          </button>
        ))}
      </div>
      <button type="button" className="bc-btn" disabled={busy || !ok} onClick={() => void send()}>
        {busy ? t("ui.bigCheese.wish.busy") : t("ui.bigCheese.wish.send")}
      </button>
    </>
  );
}
