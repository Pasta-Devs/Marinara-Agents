// ============================================================================
// Big Cheese: "Call someone" (cast.md section 6 e, M4 T21)
// ============================================================================
// A short phone call with one person, played inside Big Cheese. Words only: nothing is saved,
// so hanging up or leaving the sheet ends the call. The server writes each reply.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { callSomeone, errorKey, type CallLine } from "./api";
import type { Ctx } from "./parts";

const MAX_ASKS = 5;
// Each key is a literal, so the locale validator finds it.
const TOPICS = [
  { id: "feeling", label: "ui.bigCheese.call.topic.feeling" },
  { id: "work", label: "ui.bigCheese.call.topic.work" },
  { id: "day", label: "ui.bigCheese.call.topic.day" },
] as const;

export function CallSomeone({ ctx, id }: { ctx: Ctx; id: string }) {
  const { t } = useTranslation();
  const { run, kit } = ctx;
  const name = kit.people.find((p) => p.id === id)?.name ?? id;
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<CallLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const asks = lines.filter((l) => l.who === "you").length;

  if (run.game.status !== "playing" || (run.game.people[id]?.status ?? "active") !== "active") return null;

  const ask = async (topic: (typeof TOPICS)[number]) => {
    if (busy || asks >= MAX_ASKS) return;
    setBusy(true);
    setError(null);
    const you: CallLine = { who: "you", text: t(topic.label) };
    try {
      const { line } = await callSomeone(run.id, id, {
        expectedRevision: run.revision,
        topic: topic.id,
        earlier: lines,
      });
      setLines([...lines, you, { who: "them", text: line }]);
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="bc-btn bc-btn-quiet" onClick={() => setOpen(true)}>
        {t("ui.bigCheese.call.start", { name })}
      </button>
    );
  }

  return (
    <section className="bc-section" aria-labelledby="bc-call-title">
      <h2 id="bc-call-title" className="bc-subhead">
        {t("ui.bigCheese.call.title", { name })}
      </h2>
      <p className="bc-muted">{t("ui.bigCheese.call.help")}</p>
      <ul className="bc-list bc-plain" aria-live="polite">
        {lines.map((line, index) => (
          <li key={index} className="bc-panel">
            <span className="bc-chip">{line.who === "you" ? t("ui.bigCheese.call.you") : name}</span> {line.text}
          </li>
        ))}
      </ul>
      {error && (
        <p role="status" className="bc-muted">
          {error}
        </p>
      )}
      {asks < MAX_ASKS ? (
        <div className="bc-row-meta" role="group" aria-label={t("ui.bigCheese.call.ask")}>
          {TOPICS.map((topic) => (
            <button
              key={topic.id}
              type="button"
              className="bc-btn bc-btn-quiet"
              disabled={busy}
              onClick={() => void ask(topic)}
            >
              {t(topic.label)}
            </button>
          ))}
        </div>
      ) : (
        <p className="bc-muted">{t("ui.bigCheese.call.long")}</p>
      )}
      <button
        type="button"
        className="bc-btn"
        onClick={() => {
          setOpen(false);
          setLines([]);
        }}
      >
        {t("ui.bigCheese.call.hangUp")}
      </button>
    </section>
  );
}
