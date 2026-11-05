// ──────────────────────────────────────────────
// Big Cheese: the Inbox and one card (ui.md §5.5)
// ──────────────────────────────────────────────
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Card } from "./api";
import { Face, nameOf, person, stanceKey, type Ctx } from "./parts";

function Waited({ card }: { card: Card }) {
  const { t } = useTranslation();
  return (
    <span className="bc-muted">
      {card.age === 0 ? t("ui.bigCheese.card.today") : t("ui.bigCheese.card.waited", { count: card.age })}
    </span>
  );
}

function NeedChip({ ctx, card }: { ctx: Ctx; card: Card }) {
  const { t } = useTranslation();
  return (
    <span className="bc-chip bc-chip-warn">
      {t("ui.bigCheese.card.need", { meter: ctx.kit.meters[card.need]?.label ?? card.need })}
    </span>
  );
}

export function Inbox({ ctx, canStart, remembered }: { ctx: Ctx; canStart: boolean; remembered?: string }) {
  const { t } = useTranslation();
  const { run, kit, busy, act, go } = ctx;
  const cards = run.game.inbox;
  return (
    <>
      <h1 className="bc-heading" tabIndex={-1} data-focus>
        {t("ui.bigCheese.inbox.title")}
      </h1>
      <p role="status" className={remembered ? "bc-stamp" : "bc-sr"}>
        {remembered ? t("ui.bigCheese.card.remember", { name: nameOf(kit, remembered) }) : ""}
      </p>
      {cards.length === 0 && (
        <div className="bc-empty">
          <p>{t("ui.bigCheese.inbox.empty")}</p>
          {canStart ? (
            <button
              type="button"
              className="bc-btn bc-btn-primary"
              disabled={busy}
              onClick={() => void act("day/start")}
            >
              {t("ui.bigCheese.office.startDay")}
            </button>
          ) : (
            <button type="button" className="bc-btn" onClick={() => go("place")}>
              {t("ui.bigCheese.inbox.walk")}
            </button>
          )}
        </div>
      )}
      <ul className="bc-list">
        {cards.map((card) => (
          <li key={card.id}>
            <button type="button" className="bc-row" onClick={() => go(`card:${card.id}`)}>
              <Face kit={kit} id={card.asker} />
              <span className="bc-row-text">
                <span className="bc-row-title">{nameOf(kit, card.asker)}</span>
                <span className="bc-clamp">{run.text.cards[card.id]?.line}</span>
                <span className="bc-row-meta">
                  <NeedChip ctx={ctx} card={card} />
                  <Waited card={card} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function CardScreen({ ctx, id }: { ctx: Ctx; id: string }) {
  const { t } = useTranslation();
  const { run, kit, busy, act, go } = ctx;
  const card = run.game.inbox.find((entry) => entry.id === id)!;
  const text = run.text.cards[id];
  const asker = person(kit, card.asker);
  const name = asker?.name ?? card.asker;
  const [own, setOwn] = useState("");
  const [promise, setPromise] = useState("");
  const [promiseOpen, setPromiseOpen] = useState(false);
  const noHours = run.game.clock.hoursLeft === 0;
  const reply = (stance: string) => text?.answers.find((a) => a.stance === stance)?.text;
  const position = run.game.inbox.indexOf(card) + 1;
  // The server takes a promise of 3-120 characters.
  const promiseShort = promise.trim().length > 0 && promise.trim().length < 3;
  const blocked = busy || noHours || promiseShort;

  async function answer(body: object) {
    const what = promise.trim();
    if (await act(`cards/${encodeURIComponent(id)}/answer`, what ? { ...body, promise: { what } } : body)) {
      go(`inbox:${card.asker}`);
    }
  }

  function onOwn(event: FormEvent) {
    event.preventDefault();
    if (own.trim()) void answer({ text: own.trim() });
  }

  // Keyboard 1-3 picks an answer (ui.md §9).
  function onKey(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const pick = card.answers[Number(event.key) - 1];
    if (pick && !blocked) void answer({ stance: pick.stance });
  }

  return (
    <section className="bc-card-screen" onKeyDown={onKey}>
      <p className="bc-muted">{t("ui.bigCheese.card.position", { n: position, total: run.game.inbox.length })}</p>
      <div className="bc-row bc-row-flat">
        <Face kit={kit} id={card.asker} size="l" />
        <span className="bc-row-text">
          <h1 className="bc-heading bc-heading-s" tabIndex={-1} data-focus>
            {name}
          </h1>
          <span className="bc-muted">{asker?.role}</span>
        </span>
      </div>
      <p className="bc-row-meta">
        <NeedChip ctx={ctx} card={card} />
        <Waited card={card} />
      </p>
      {text?.line && <blockquote className="bc-quote bc-said">{text.line}</blockquote>}

      {noHours && <p className="bc-note">{t("ui.bigCheese.card.noHours")}</p>}
      {promiseOpen ? (
        <div className="bc-form">
          <label htmlFor="bc-promise">{t("ui.bigCheese.card.promise")}</label>
          <input
            id="bc-promise"
            aria-describedby="bc-promise-help"
            aria-invalid={promiseShort}
            maxLength={120}
            value={promise}
            onChange={(event) => setPromise(event.target.value)}
            placeholder={t("ui.bigCheese.card.promiseExample")}
          />
          <p id="bc-promise-help" className="bc-muted">
            {promiseShort ? t("ui.bigCheese.card.promiseShort") : t("ui.bigCheese.card.promiseHelp", { name })}
          </p>
        </div>
      ) : (
        <button type="button" className="bc-btn bc-btn-quiet" onClick={() => setPromiseOpen(true)}>
          {t("ui.bigCheese.card.addPromise")}
        </button>
      )}
      <ul className="bc-list" aria-label={t("ui.bigCheese.card.answers")}>
        {card.answers.map((entry, index) => (
          <li key={entry.stance}>
            <button
              type="button"
              className="bc-answer"
              disabled={blocked}
              onClick={() => void answer({ stance: entry.stance })}
            >
              <span className="bc-pill">{t(stanceKey(entry.stance))}</span>
              {reply(entry.stance) ? (
                <span className="bc-said">{reply(entry.stance)}</span>
              ) : (
                <span>{t(stanceKey(entry.stance))}</span>
              )}
              <kbd className="bc-key" aria-hidden="true">
                {index + 1}
              </kbd>
            </button>
          </li>
        ))}
      </ul>

      <form className="bc-form" onSubmit={onOwn}>
        <label htmlFor="bc-own">{t("ui.bigCheese.card.own")}</label>
        <textarea
          id="bc-own"
          rows={2}
          value={own}
          onChange={(event) => setOwn(event.target.value)}
          placeholder={t("ui.bigCheese.card.ownExample")}
        />
        <button type="submit" className="bc-btn" disabled={blocked || !own.trim()}>
          {busy ? t("ui.bigCheese.card.listening", { name }) : t("ui.bigCheese.card.sayIt")}
        </button>
      </form>
    </section>
  );
}
