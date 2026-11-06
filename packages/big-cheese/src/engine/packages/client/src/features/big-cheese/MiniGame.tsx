// ──────────────────────────────────────────────
// Big Cheese: mini-games (modules.md section 4, M4 T17)
// ──────────────────────────────────────────────
// A short game that replaces a card. The server offers the options; the boss taps `need` of them in
// order and plays. T18 adds Seating and Inspection as new entries in KINDS and new screens below.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MiniGame } from "./api";
import { Face, nameOf, type Ctx } from "./parts";

// Literal keys, so the locale validator finds each one.
export const KINDS = {
  speech: {
    open: "ui.bigCheese.minigame.speech.open",
    title: "ui.bigCheese.minigame.speech.title",
    help: "ui.bigCheese.minigame.speech.help",
    go: "ui.bigCheese.minigame.speech.go",
  },
  interview: {
    open: "ui.bigCheese.minigame.interview.open",
    title: "ui.bigCheese.minigame.interview.title",
    help: "ui.bigCheese.minigame.interview.help",
    go: "ui.bigCheese.minigame.interview.go",
  },
  seating: {
    open: "ui.bigCheese.minigame.seating.open",
    title: "ui.bigCheese.minigame.seating.title",
    help: "ui.bigCheese.minigame.seating.help",
    go: "ui.bigCheese.minigame.seating.go",
  },
  inspection: {
    open: "ui.bigCheese.minigame.inspection.open",
    title: "ui.bigCheese.minigame.inspection.title",
    help: "ui.bigCheese.minigame.inspection.help",
    go: "ui.bigCheese.minigame.inspection.go",
  },
} as const;

const OUTCOMES = {
  great: "ui.bigCheese.minigame.outcome.great",
  good: "ui.bigCheese.minigame.outcome.good",
  flat: "ui.bigCheese.minigame.outcome.flat",
  bad: "ui.bigCheese.minigame.outcome.bad",
} as const;

/** True when the office should offer the game. */
export const miniOpen = (g: MiniGame | null | undefined): g is MiniGame =>
  !!g && !g.done && Object.hasOwn(KINDS, g.kind);

/** Pick `need` options in order (or `min` to `need` for Inspection), then play. */
function PickGame({ ctx, g }: { ctx: Ctx; g: MiniGame }) {
  const { t } = useTranslation();
  const { run, kit, busy, act, go } = ctx;
  const [picks, setPicks] = useState<string[]>([]);
  const k = KINDS[g.kind as keyof typeof KINDS];
  const noHours = run.game.clock.hoursLeft === 0;
  const toggle = (id: string) =>
    setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < g.need ? [...p, id] : p));
  return (
    <>
      <h1 className="bc-heading" tabIndex={-1} data-focus>
        {t(k.title)}
      </h1>
      <p className="bc-muted">{t(k.help, { n: g.need })}</p>
      <ul className="bc-list">
        {g.people.slice(0, 6).map((id) => (
          <li key={id} className="bc-row bc-row-flat">
            <Face kit={kit} id={id} size="s" />
            <span className="bc-row-text">{nameOf(kit, id)}</span>
          </li>
        ))}
      </ul>
      <ul className="bc-list" aria-label={t(k.title)}>
        {g.options.map((o) => {
          const n = picks.indexOf(o.id) + 1;
          return (
            <li key={o.id} className="bc-row bc-row-flat">
              <button
                type="button"
                className="bc-btn"
                aria-pressed={n > 0}
                disabled={busy}
                onClick={() => toggle(o.id)}
              >
                {n > 0 && <span className="bc-chip">{n}</span>} {o.text}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="bc-muted" aria-live="polite">
        {t("ui.bigCheese.minigame.picked", { n: picks.length, total: g.need })}
      </p>
      {noHours && <p className="bc-note">{t("ui.bigCheese.card.noHours")}</p>}
      <button
        type="button"
        className="bc-btn bc-btn-primary"
        disabled={busy || noHours || picks.length < (g.min ?? g.need)}
        onClick={() => void act("minigame", { kind: g.kind, picks })}
      >
        {t(k.go)}
      </button>
      <button type="button" className="bc-btn bc-btn-quiet" onClick={() => go("office")}>
        {t("ui.bigCheese.minigame.later")}
      </button>
    </>
  );
}

/** Seating: tap a person, then tap a seat. Tap a taken seat to clear it. Picks are "person@seat". */
function SeatingGame({ ctx, g }: { ctx: Ctx; g: MiniGame }) {
  const { t } = useTranslation();
  const { run, kit, busy, act, go } = ctx;
  const [seats, setSeats] = useState<Record<string, string>>({}); // seat id -> person id
  const [who, setWho] = useState<string | null>(null);
  const k = KINDS.seating;
  const noHours = run.game.clock.hoursLeft === 0;
  const waiting = g.people.filter((p) => !Object.values(seats).includes(p));
  const tapSeat = (seat: string) => {
    if (Object.hasOwn(seats, seat))
      return setSeats((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== seat)));
    if (who) {
      setSeats((s) => ({ ...s, [seat]: who }));
      setWho(null);
    }
  };
  return (
    <>
      <h1 className="bc-heading" tabIndex={-1} data-focus>
        {t(k.title)}
      </h1>
      <p className="bc-muted">{t(k.help)}</p>
      <ul className="bc-list" aria-label={t("ui.bigCheese.minigame.seating.waiting")}>
        {waiting.map((id) => (
          <li key={id} className="bc-row bc-row-flat">
            <button
              type="button"
              className="bc-btn"
              aria-pressed={who === id}
              disabled={busy}
              onClick={() => setWho(id)}
            >
              <Face kit={kit} id={id} size="s" /> {nameOf(kit, id)}
            </button>
          </li>
        ))}
      </ul>
      <ul className="bc-list" aria-label={t(k.title)}>
        {g.options.map((o, i) => {
          const sitter = Object.hasOwn(seats, o.id) ? seats[o.id] : undefined;
          return (
            <li key={o.id} className="bc-row bc-row-flat">
              <button
                type="button"
                className="bc-btn"
                disabled={busy || (!sitter && !who)}
                onClick={() => tapSeat(o.id)}
              >
                {sitter
                  ? t("ui.bigCheese.minigame.seating.taken", { n: i + 1, who: nameOf(kit, sitter) })
                  : t("ui.bigCheese.minigame.seating.free", { n: i + 1 })}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="bc-muted" aria-live="polite">
        {t("ui.bigCheese.minigame.picked", { n: Object.keys(seats).length, total: g.need })}
      </p>
      {noHours && <p className="bc-note">{t("ui.bigCheese.card.noHours")}</p>}
      <button
        type="button"
        className="bc-btn bc-btn-primary"
        disabled={busy || noHours || Object.keys(seats).length !== g.need}
        onClick={() =>
          void act("minigame", { kind: g.kind, picks: Object.entries(seats).map(([seat, p]) => `${p}@${seat}`) })
        }
      >
        {t(k.go)}
      </button>
      <button type="button" className="bc-btn bc-btn-quiet" onClick={() => go("office")}>
        {t("ui.bigCheese.minigame.later")}
      </button>
    </>
  );
}

function Result({ ctx, g }: { ctx: Ctx; g: MiniGame }) {
  const { t } = useTranslation();
  const { kit, go } = ctx;
  const d = g.done!;
  const k = KINDS[g.kind as keyof typeof KINDS];
  return (
    <>
      <h1 className="bc-heading" tabIndex={-1} data-focus>
        {t(k.title)}
      </h1>
      <p className="bc-chip">{t(OUTCOMES[d.outcome])}</p>
      <ul className="bc-plain" aria-live="polite">
        {d.steps.map((x, i) => {
          const line = d.lines[i];
          return (
            <li key={x.id}>
              <span className="bc-muted">{x.text}</span>{" "}
              {line && (
                <span>
                  {line.who && <strong>{nameOf(kit, line.who)}: </strong>}
                  {line.text}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {d.revealed.length > 0 && (
        <p>{t("ui.bigCheese.minigame.revealed", { who: nameOf(kit, g.people[0]!), traits: d.revealed.join(", ") })}</p>
      )}
      <button type="button" className="bc-btn bc-btn-quiet" onClick={() => go("office")}>
        {t("ui.bigCheese.run.back")}
      </button>
    </>
  );
}

export function MiniGameScreen({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const g = ctx.run.game.minigame;
  if (!g || !Object.hasOwn(KINDS, g.kind)) return <p className="bc-muted">{t("ui.bigCheese.minigame.none")}</p>;
  if (g.done) return <Result ctx={ctx} g={g} />;
  const Game = g.kind === "seating" ? SeatingGame : PickGame;
  return <Game key={`${g.kind}${g.week}`} ctx={ctx} g={g} />;
}
