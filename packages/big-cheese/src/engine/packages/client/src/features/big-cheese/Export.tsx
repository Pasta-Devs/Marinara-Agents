// ──────────────────────────────────────────────
// Big Cheese: "Save to your library" (cast.md section 8, Export sheet)
// ──────────────────────────────────────────────
// Each item has its own Preview and Save button. Nothing goes to the Engine without a tap.
// Adult scenes stay out unless the player ticks the box (only shown when the run has the module).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorKey, exportLorebook, exportNote } from "./api";
import type { Ctx } from "./parts";

type Item = "memories" | "place" | "note";
// Each key is a literal, so the locale validator finds it.
const ITEMS: { id: Item; title: string; save: string }[] = [
  { id: "memories", title: "ui.bigCheese.export.item.memories", save: "ui.bigCheese.export.save.memories" },
  { id: "place", title: "ui.bigCheese.export.item.place", save: "ui.bigCheese.export.save.place" },
  { id: "note", title: "ui.bigCheese.export.item.note", save: "ui.bigCheese.export.save.note" },
];

export function Export({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { run, kit, go } = ctx;
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<{ item: Item; text: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const call = async (item: Item, preview: boolean) => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const body = { adult, preview };
      if (item === "note") {
        const r = await exportNote(run.id, body);
        if (preview) setShown({ item, text: r.description ?? "" });
        else setStatus(t("ui.bigCheese.export.saved"));
      } else {
        const r = await exportLorebook(run.id, item, body);
        if (preview) setShown({ item, text: (r.entries ?? []).map((e) => `${e.name}\n${e.content}`).join("\n\n") });
        else setStatus(t("ui.bigCheese.export.savedBook", { name: r.name, count: r.count }));
      }
    } catch (error) {
      setStatus(t(errorKey(error)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bc-section" aria-labelledby="bc-export-title">
      <h1 className="bc-heading" id="bc-export-title" tabIndex={-1} data-focus>
        {t("ui.bigCheese.export.title")}
      </h1>
      <p className="bc-muted">{t("ui.bigCheese.export.help")}</p>
      {run.game.adult && (
        <label className="bc-muted">
          <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />{" "}
          {t("ui.bigCheese.export.adult")}
        </label>
      )}
      <ul className="bc-list bc-plain">
        {ITEMS.filter((item) => item.id !== "note" || kit.boss).map((item) => (
          <li key={item.id} className="bc-panel">
            <p className="bc-row-title">{t(item.title)}</p>
            <div className="bc-row-meta" role="group" aria-label={t(item.title)}>
              <button
                type="button"
                className="bc-btn bc-btn-quiet"
                disabled={busy}
                onClick={() => void call(item.id, true)}
              >
                {t("ui.bigCheese.export.preview")}
              </button>
              <button type="button" className="bc-btn" disabled={busy} onClick={() => void call(item.id, false)}>
                {t(item.save)}
              </button>
            </div>
            {shown?.item === item.id && (
              <pre className="bc-muted" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {shown.text}
              </pre>
            )}
          </li>
        ))}
      </ul>
      {status && (
        <p role="status" className="bc-muted">
          {status}
        </p>
      )}
      <button type="button" className="bc-btn bc-btn-quiet" onClick={() => go("office")}>
        {t("ui.bigCheese.export.back")}
      </button>
    </section>
  );
}
