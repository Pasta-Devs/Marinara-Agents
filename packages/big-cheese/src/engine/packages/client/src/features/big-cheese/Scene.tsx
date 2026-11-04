// ──────────────────────────────────────────────
// Big Cheese: the big scene stage, part by part (ui.md §5.7, design.md §3.8)
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { ScenePart } from "./api";
import { Face, nameOf, person, stanceKey, tint, type Ctx } from "./parts";

interface Props {
  ctx: Ctx;
  id: string;
  onLeave: () => void;
  onClose: () => void;
}

export function Scene({ ctx, id, onLeave, onClose }: Props) {
  const [receipt, setReceipt] = useState(false);
  const n = ctx.run.text.scenes[id].parts.length;
  // A new part remounts PartView, so its line index starts at 0 again.
  return receipt ? (
    <SceneReceipt ctx={ctx} id={id} onClose={onClose} />
  ) : (
    <PartView
      key={n}
      ctx={ctx}
      id={id}
      part={ctx.run.text.scenes[id].parts[n - 1]}
      onLeave={onLeave}
      onClose={() => setReceipt(true)}
    />
  );
}

function PartView({ ctx, id, part, onLeave, onClose }: Props & { part: ScenePart | undefined }) {
  const { t } = useTranslation();
  const { run, kit, busy, act } = ctx;
  const scene = run.text.scenes[id];
  const n = scene.parts.length;
  const [line, setLine] = useState(0);
  const [own, setOwn] = useState("");
  const [askSkip, setAskSkip] = useState(false);
  const current = part?.lines[line];
  const atChoice = !part || line >= part.lines.length;
  const speaker = current && person(kit, current.who);
  const choose = (body: object) => void act(`scenes/${encodeURIComponent(id)}/choose`, body);

  function onOwn(event: FormEvent) {
    event.preventDefault();
    if (own.trim()) choose({ text: own.trim() });
  }

  return (
    <div className="bc-scene">
      <header className="bc-scene-top">
        <p className="bc-scene-where">
          <span className="bc-dots" aria-hidden="true">
            {Array.from({ length: scene.total }, (_, i) => (
              <span key={i} className={i === n - 1 ? "bc-dot bc-dot-now" : i < n ? "bc-dot bc-dot-done" : "bc-dot"} />
            ))}
          </span>
          {t("ui.bigCheese.scene.part", { n, total: scene.total })}
        </p>
        <button type="button" className="bc-btn bc-btn-quiet" onClick={onLeave}>
          {t("ui.bigCheese.scene.leave")}
        </button>
      </header>
      <h1 className="bc-scene-title" tabIndex={-1} data-focus>
        {scene.title}
        <span className="bc-muted"> · {scene.room}</span>
      </h1>

      <ul className="bc-stage" aria-label={t("ui.bigCheese.scene.onStage")}>
        {scene.people.map((who) => (
          <li key={who} className={current?.who === who ? "bc-on-stage bc-speaking" : "bc-on-stage"}>
            <Face kit={kit} id={who} size="l" />
            <span>{nameOf(kit, who)}</span>
          </li>
        ))}
      </ul>

      <div className="bc-slot">
        {!atChoice && current ? (
          <div className="bc-line" style={tint(speaker?.hue)}>
            {speaker && (
              <p className="bc-plate">
                {speaker.name} <span className="bc-muted">{speaker.role}</span>
              </p>
            )}
            <p className="bc-line-text" aria-live="polite">
              {current.text}
            </p>
            <button type="button" className="bc-btn bc-btn-next" onClick={() => setLine(line + 1)}>
              {t("ui.bigCheese.scene.next")}
            </button>
          </div>
        ) : scene.done ? (
          <button type="button" className="bc-btn bc-btn-primary" onClick={onClose}>
            {t("ui.bigCheese.scene.result")}
          </button>
        ) : part && part.suggestions.length > 0 ? (
          <div className="bc-choice">
            <h2 className="bc-subhead">{t("ui.bigCheese.scene.choose")}</h2>
            <ul className="bc-list">
              {part.suggestions.map((entry) => (
                <li key={entry.stance}>
                  <button
                    type="button"
                    className="bc-answer"
                    disabled={busy}
                    onClick={() => choose({ stance: entry.stance })}
                  >
                    <span className="bc-pill">{t(stanceKey(entry.stance))}</span>
                    <span>{entry.text}</span>
                  </button>
                </li>
              ))}
            </ul>
            <form className="bc-form" onSubmit={onOwn}>
              <label htmlFor="bc-scene-own">{t("ui.bigCheese.card.own")}</label>
              <textarea id="bc-scene-own" rows={2} value={own} onChange={(event) => setOwn(event.target.value)} />
              <button type="submit" className="bc-btn" disabled={busy || !own.trim()}>
                {t("ui.bigCheese.card.sayIt")}
              </button>
            </form>
          </div>
        ) : (
          // shortcut: a part with no suggestions (a `check`) has no choose body in the contract, so it moves on with skip
          <button
            type="button"
            className="bc-btn bc-btn-primary"
            disabled={busy}
            onClick={() => choose({ skip: true })}
          >
            {t("ui.bigCheese.scene.goOn")}
          </button>
        )}
        {busy && <p className="bc-muted">{t("ui.bigCheese.scene.writing")}</p>}
        {!scene.done &&
          (askSkip ? (
            <div className="bc-note" role="alertdialog" aria-label={t("ui.bigCheese.scene.skip")}>
              <p>{t("ui.bigCheese.scene.skipConfirm")}</p>
              <button type="button" className="bc-btn" disabled={busy} onClick={() => choose({ skip: true })}>
                {t("ui.bigCheese.scene.skip")}
              </button>
              <button type="button" className="bc-btn bc-btn-quiet" autoFocus onClick={() => setAskSkip(false)}>
                {t("ui.bigCheese.scene.keepPlaying")}
              </button>
            </div>
          ) : (
            <button type="button" className="bc-btn bc-btn-quiet" onClick={() => setAskSkip(true)}>
              {t("ui.bigCheese.scene.skip")}
            </button>
          ))}
      </div>
    </div>
  );
}

function SceneReceipt({ ctx, id, onClose }: { ctx: Ctx; id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const scene = ctx.run.text.scenes[id];
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <main className="bc-main">
      <article className="bc-receipt">
        <h1 className="bc-receipt-title" tabIndex={-1} ref={heading}>
          {scene.title}
        </h1>
        <p className="bc-receipt-sub">{scene.room}</p>
        {scene.outcome && <p>{scene.outcome}</p>}
        <ol className="bc-plain">
          {scene.parts.map((part, index) => part.summary && <li key={index}>{part.summary}</li>)}
        </ol>
      </article>
      <button type="button" className="bc-btn bc-btn-primary" onClick={onClose}>
        {t("ui.bigCheese.scene.back")}
      </button>
    </main>
  );
}
