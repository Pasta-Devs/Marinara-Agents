// ──────────────────────────────────────────────
// Big Cheese: the Cheese Board, M1 (cheese-board.md). A bottom sheet over the run:
// search the actions, Set meters, feelings, cards and time, preview, play, and the journal with rewind and revert.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { api } from "../../lib/api-client";
import { errorKey, type KitView, type Meter } from "./api";
import { dayKey, moodKey, nameOf, type Ctx } from "./parts";

const METERS: Meter[] = ["money", "output", "people", "standing"];
const MOODS = ["great", "fine", "low", "sick", "away"];
const MAX_ACTIONS = 8;

interface Action {
  verb: string;
  target?: { kind: string; id: string };
  input?: Record<string, unknown>;
}
interface Fact extends Action {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}
interface Preview {
  id: string;
  actions: Fact[];
}
interface Entry {
  id: string;
  at: { week: number; day: number };
  state: "done" | "rewound" | "reverted";
  actions: Fact[];
  later: number;
  days: number;
  canRewind: boolean;
  canRevert: boolean;
  changed: boolean;
}
interface Row {
  key: string;
  label: string;
  /** What the form asks for. */
  ask: "meter" | "trust" | "stress" | "mood" | "cardAdd" | "cardRemove" | "skip" | "hours" | "rewind";
  id?: string;
}

// Every key is a literal, so the locale validator finds it.
const ROW_KEYS = {
  meter: "ui.bigCheese.board.row.meter",
  trust: "ui.bigCheese.board.row.trust",
  stress: "ui.bigCheese.board.row.stress",
  mood: "ui.bigCheese.board.row.mood",
  cardAdd: "ui.bigCheese.board.row.cardAdd",
  cardRemove: "ui.bigCheese.board.row.cardRemove",
  skip: "ui.bigCheese.board.row.skip",
  hours: "ui.bigCheese.board.row.hours",
  rewind: "ui.bigCheese.board.row.rewind",
};
const SEVERITY_KEYS = [
  "ui.bigCheese.board.severity.small",
  "ui.bigCheese.board.severity.medium",
  "ui.bigCheese.board.severity.big",
];

/** The one-line name of an action, with the number it writes, as a button or list line would say it. */
function sentence(t: TFunction, kit: KitView, f: Action & { after?: Record<string, unknown> }): string[] {
  const after = f.after ?? {};
  const id = f.target?.id ?? "";
  switch (f.verb) {
    case "meter.set":
      return [
        t("ui.bigCheese.board.set.meter", {
          meter: kit.meters[id as Meter]?.label ?? id,
          value: after[`meters.${id}`] ?? f.input?.value,
        }),
      ];
    case "person.feelings": {
      const name = nameOf(kit, id);
      const out: string[] = [];
      const trust = after[`people.${id}.trust`] ?? f.input?.trust;
      const stress = after[`people.${id}.stress`] ?? f.input?.stress;
      const mood = after[`people.${id}.mood`] ?? f.input?.mood;
      if (trust !== undefined) out.push(t("ui.bigCheese.board.set.trust", { name, value: trust }));
      if (stress !== undefined) out.push(t("ui.bigCheese.board.set.stress", { name, value: stress }));
      if (mood !== undefined) out.push(t("ui.bigCheese.board.set.mood", { name, mood: t(moodKey(String(mood))) }));
      return out;
    }
    case "card.add":
      return [t("ui.bigCheese.board.set.cardAdd", { name: nameOf(kit, String(f.input?.asker)) })];
    case "card.remove": {
      const card = (
        Array.isArray((f as Fact).before?.inbox) ? ((f as Fact).before.inbox as { id: string; asker: string }[]) : []
      ).find((c) => c.id === id);
      return [t("ui.bigCheese.board.set.cardRemove", { name: card ? nameOf(kit, card.asker) : "" })];
    }
    case "time.skip":
      return [t("ui.bigCheese.board.set.skip", { count: Math.min(5, Number(f.input?.days) || 1) })];
    case "time.hours":
      return [t("ui.bigCheese.board.set.hours", { count: Number(after["clock.hoursLeft"] ?? f.input?.hours) })];
    case "time.rewind":
      return [
        t("ui.bigCheese.board.set.rewind", { day: t(dayKey(Number(after["clock.day"]))), week: after["clock.week"] }),
      ];
    default:
      return [t("ui.bigCheese.board.set.revert")];
  }
}

/** The numbers an action changed, always shown, for the preview and the journal. */
function numbers(t: TFunction, kit: KitView, f: Fact): string[] {
  const out: string[] = [];
  const line = (label: string, before: unknown, after: unknown) =>
    t("ui.bigCheese.board.number", { label, before, after });
  const when = (week: unknown, day: unknown) => t("ui.bigCheese.run.when", { day: t(dayKey(Number(day))), week });
  for (const [path, after] of Object.entries(f.after)) {
    const before = f.before[path];
    const [a, b, c] = path.split(".");
    if (a === "meters") out.push(line(kit.meters[b as Meter]?.label ?? b, before, after));
    else if (a === "people" && c === "trust")
      out.push(line(t("ui.bigCheese.board.path.trust", { name: nameOf(kit, b) }), before, after));
    else if (a === "people" && c === "stress")
      out.push(line(t("ui.bigCheese.board.path.stress", { name: nameOf(kit, b) }), before, after));
    else if (a === "people" && c === "mood")
      out.push(
        line(
          t("ui.bigCheese.board.path.mood", { name: nameOf(kit, b) }),
          t(moodKey(String(before))),
          t(moodKey(String(after))),
        ),
      );
    else if (path === "clock.hoursLeft") out.push(line(t("ui.bigCheese.board.path.hours"), before, after));
    else if (path === "clock.day")
      out.push(
        line(
          t("ui.bigCheese.board.path.day"),
          when(f.before["clock.week"], before),
          when(f.after["clock.week"], after),
        ),
      );
    else if (path === "inbox")
      out.push(line(t("ui.bigCheese.board.path.inbox"), (before as unknown[]).length, (after as unknown[]).length));
  }
  return out;
}

const base = (run: Ctx["run"]) => `/big-cheese/runs/${encodeURIComponent(run.id)}/board`;

export function Board({ ctx, note, onClose }: { ctx: Ctx; note: ReactNode; onClose: () => void }) {
  const { t } = useTranslation();
  const { run, kit, busy, act } = ctx;
  const game = run.game;
  const [tab, setTab] = useState<"set" | "journal">("set");
  const [query, setQuery] = useState("");
  const [row, setRow] = useState<Row | null>(null);
  const [draft, setDraft] = useState({ value: "", asker: "", need: "money", severity: "2" });
  const [plan, setPlan] = useState<Action[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [played, setPlayed] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<{ id: string; mode: "rewind" | "revert" } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  const people = Object.keys(game.people);
  const rows: Row[] = [
    ...METERS.map((m) => ({
      key: `meter.${m}`,
      ask: "meter" as const,
      id: m,
      label: t(ROW_KEYS.meter, { meter: kit.meters[m].label }),
    })),
    ...people.flatMap((p) =>
      (["trust", "stress", "mood"] as const).map((ask) => ({
        key: `${ask}.${p}`,
        ask,
        id: p,
        label: t(ROW_KEYS[ask], { name: nameOf(kit, p) }),
      })),
    ),
    { key: "cardAdd", ask: "cardAdd", label: t(ROW_KEYS.cardAdd) },
    ...game.inbox.map((c) => ({
      key: `cardRemove.${c.id}`,
      ask: "cardRemove" as const,
      id: c.id,
      label: t(ROW_KEYS.cardRemove, { name: nameOf(kit, c.asker) }),
    })),
    { key: "skip", ask: "skip", label: t(ROW_KEYS.skip) },
    { key: "hours", ask: "hours", label: t(ROW_KEYS.hours) },
    { key: "rewind", ask: "rewind", label: t(ROW_KEYS.rewind) },
  ];
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) => r.label.toLowerCase().includes(q));

  // Journal: newest page first, reloaded after every play.
  const loadJournal = async (page: number) => {
    try {
      const r = await api.get<{ entries: Entry[]; more: boolean }>(`${base(run)}/journal?page=${page}`);
      setEntries((old) => (page === 0 ? r.entries : [...old, ...r.entries]));
      setMore(r.more);
      setPage(page);
    } catch (e) {
      setError(errorKey(e));
    }
  };
  useEffect(() => {
    if (tab === "journal") void loadJournal(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, run.revision]);

  /** Asks the server for the numbers. The plan only changes when the server accepts it. */
  const stage = async (next: Action[]) => {
    setError(null);
    setPlayed(false);
    if (next.length === 0) {
      setPlan([]);
      setPreview(null);
      return true;
    }
    setChecking(true);
    try {
      setPreview(await api.post<Preview>(`${base(run)}/preview`, { actions: next }));
      setPlan(next);
      return true;
    } catch (e) {
      setError(errorKey(e));
      return false;
    } finally {
      setChecking(false);
    }
  };

  const pick = (r: Row) => {
    const person = r.id && game.people[r.id];
    const value =
      r.ask === "meter"
        ? game.meters[r.id as Meter]
        : r.ask === "trust"
          ? person && person.trust
          : r.ask === "stress"
            ? person && person.stress
            : r.ask === "hours"
              ? game.clock.hoursLeft
              : r.ask === "mood"
                ? person && person.mood
                : 1;
    setDraft({ value: String(value ?? 1), asker: people[0] ?? "", need: "money", severity: "2" });
    setRow(r);
  };

  const num = Number(draft.value);
  const valid = draft.value.trim() !== "" && Number.isFinite(num);
  const built = (r: Row): Action | null => {
    const id = r.id ?? "";
    switch (r.ask) {
      case "meter":
        return valid ? { verb: "meter.set", target: { kind: "meter", id }, input: { value: num } } : null;
      case "trust":
      case "stress":
        return valid ? { verb: "person.feelings", target: { kind: "person", id }, input: { [r.ask]: num } } : null;
      case "mood":
        return { verb: "person.feelings", target: { kind: "person", id }, input: { mood: draft.value } };
      case "cardAdd":
        return { verb: "card.add", input: { asker: draft.asker, need: draft.need, severity: Number(draft.severity) } };
      case "cardRemove":
        return { verb: "card.remove", target: { kind: "card", id } };
      case "skip":
        return valid ? { verb: "time.skip", input: { days: Math.round(num) } } : null;
      case "hours":
        return valid ? { verb: "time.hours", input: { hours: Math.round(num) } } : null;
      case "rewind":
        return valid ? { verb: "time.rewind", input: { days: Math.round(num) } } : null;
    }
  };

  const addLabel = (r: Row) => {
    const a = built(r);
    if (!a) return t("ui.bigCheese.board.addNothing");
    return sentence(t, kit, { ...a, after: previewAfter(a) })[0];
  };
  // The button names the value the player typed, before the server has clamped it.
  const previewAfter = (a: Action): Record<string, unknown> => {
    const id = a.target?.id ?? "";
    if (a.verb === "meter.set") return { [`meters.${id}`]: a.input?.value };
    if (a.verb === "person.feelings")
      return Object.fromEntries(Object.entries(a.input ?? {}).map(([k, v]) => [`people.${id}.${k}`, v]));
    if (a.verb === "time.hours") return { "clock.hoursLeft": a.input?.hours };
    if (a.verb === "time.rewind") {
      const index = (game.clock.week - 1) * 5 + game.clock.day - Math.min(7, Number(a.input?.days));
      return { "clock.day": ((index % 5) + 5) % 5, "clock.week": Math.floor(index / 5) + 1 };
    }
    return {};
  };

  const add = async (r: Row) => {
    const a = built(r);
    if (!a) return;
    // Rewind a day is a play of its own.
    const rest = plan.filter((x) => x.verb !== "time.rewind");
    const next = a.verb === "time.rewind" ? [a] : [...rest, a];
    if (await stage(next)) setRow(null);
  };

  const playIt = async () => {
    if (!preview) return;
    const ok = await act("board/play", { previewId: preview.id });
    if (ok) {
      setPlan([]);
      setPreview(null);
      setPlayed(true);
    } else void stage(plan); // The place moved on: show the new numbers.
  };

  const journalAct = async (e: Entry, mode: "rewind" | "revert", confirmLater = false) => {
    if (await act("board/rewind", { playId: e.id, mode, confirmLater })) setConfirm(null);
  };

  const stateKey = {
    done: "ui.bigCheese.board.journal.done",
    rewound: "ui.bigCheese.board.journal.rewound",
    reverted: "ui.bigCheese.board.journal.reverted",
  };

  const form = row && (
    <form
      className="bc-form"
      onSubmit={(event) => {
        event.preventDefault();
        void add(row);
      }}
    >
      <h3 className="bc-subhead">{row.label}</h3>
      {(row.ask === "meter" || row.ask === "trust" || row.ask === "stress") && (
        <label>
          {t("ui.bigCheese.board.field.value")}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={draft.value}
            onChange={(e) => setDraft({ ...draft, value: e.target.value })}
          />
        </label>
      )}
      {row.ask === "mood" && (
        <label>
          {t("ui.bigCheese.board.field.mood")}
          <select value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })}>
            {MOODS.map((m) => (
              <option key={m} value={m}>
                {t(moodKey(m))}
              </option>
            ))}
          </select>
        </label>
      )}
      {row.ask === "cardAdd" && (
        <>
          <label>
            {t("ui.bigCheese.board.field.asker")}
            <select value={draft.asker} onChange={(e) => setDraft({ ...draft, asker: e.target.value })}>
              {people.map((p) => (
                <option key={p} value={p}>
                  {nameOf(kit, p)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("ui.bigCheese.board.field.need")}
            <select value={draft.need} onChange={(e) => setDraft({ ...draft, need: e.target.value })}>
              {METERS.map((m) => (
                <option key={m} value={m}>
                  {kit.meters[m].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("ui.bigCheese.board.field.severity")}
            <select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value })}>
              {SEVERITY_KEYS.map((key, i) => (
                <option key={key} value={i + 1}>
                  {t(key)}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {(row.ask === "skip" || row.ask === "hours" || row.ask === "rewind") && (
        <label>
          {t(row.ask === "hours" ? "ui.bigCheese.board.field.hours" : "ui.bigCheese.board.field.days")}
          <input
            type="number"
            inputMode="numeric"
            min={row.ask === "hours" ? 0 : 1}
            max={row.ask === "hours" ? 5 : row.ask === "skip" ? 5 : 7}
            value={draft.value}
            onChange={(e) => setDraft({ ...draft, value: e.target.value })}
          />
        </label>
      )}
      {plan.length >= MAX_ACTIONS && <p className="bc-note">{t("ui.bigCheese.board.full")}</p>}
      <button
        type="submit"
        className="bc-btn bc-btn-primary"
        disabled={checking || plan.length >= MAX_ACTIONS || !built(row)}
      >
        {addLabel(row)}
      </button>
      <button type="button" className="bc-btn bc-btn-quiet" onClick={() => setRow(null)}>
        {t("ui.bigCheese.board.pickOther")}
      </button>
    </form>
  );

  return (
    <div className="bc-veil" onKeyDown={(event) => event.key === "Escape" && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bc-board-title"
        className="bc-sheet bc-sheet-tall"
        aria-busy={busy || checking}
      >
        <h2 id="bc-board-title" ref={heading} tabIndex={-1}>
          {t("ui.bigCheese.board.title")}
        </h2>
        {note}
        {error && (
          <p role="alert" className="bc-note">
            {t(error)}
          </p>
        )}
        <div className="bc-row-meta" role="group" aria-label={t("ui.bigCheese.board.tabs")}>
          <button
            type="button"
            className="bc-btn bc-btn-quiet"
            aria-pressed={tab === "set"}
            onClick={() => setTab("set")}
          >
            {t("ui.bigCheese.board.tab.set")}
          </button>
          <button
            type="button"
            className="bc-btn bc-btn-quiet"
            aria-pressed={tab === "journal"}
            onClick={() => setTab("journal")}
          >
            {t("ui.bigCheese.board.tab.journal")}
          </button>
        </div>

        {tab === "set" && (
          <>
            {played && (
              <p role="status" className="bc-stamp">
                {t("ui.bigCheese.board.played")}
              </p>
            )}
            {preview && (
              <section className="bc-section" aria-labelledby="bc-board-plan">
                <h3 id="bc-board-plan" className="bc-subhead">
                  {t("ui.bigCheese.board.preview")}
                </h3>
                <ul className="bc-list">
                  {preview.actions.map((f, i) => (
                    <li key={i} className="bc-panel">
                      <strong>{sentence(t, kit, f).join(" ")}</strong>
                      <span className="bc-muted">{t("ui.bigCheese.board.when")}</span>
                      {numbers(t, kit, f).map((n) => (
                        <span key={n}>{n}</span>
                      ))}
                      <button
                        type="button"
                        className="bc-btn bc-btn-quiet"
                        disabled={checking}
                        onClick={() => void stage(plan.filter((_, j) => j !== i))}
                      >
                        {t("ui.bigCheese.board.remove")}
                        <span className="bc-sr"> {sentence(t, kit, f).join(" ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="bc-muted">{t("ui.bigCheese.board.rewindNote")}</p>
                <button
                  type="button"
                  className="bc-btn bc-btn-primary"
                  disabled={busy || checking}
                  onClick={() => void playIt()}
                >
                  {t("ui.bigCheese.board.play")}
                </button>
                <button type="button" className="bc-btn bc-btn-quiet" onClick={() => void stage([])}>
                  {t("ui.bigCheese.board.cancel")}
                </button>
              </section>
            )}
            {form || (
              <section className="bc-section">
                <label className="bc-form">
                  <span>{t("ui.bigCheese.board.search")}</span>
                  <input
                    type="search"
                    value={query}
                    placeholder={t("ui.bigCheese.board.searchHint")}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                {shown.length === 0 && <p className="bc-muted">{t("ui.bigCheese.board.noMatch")}</p>}
                <ul className="bc-list">
                  {shown.map((r) => (
                    <li key={r.key}>
                      <button type="button" className="bc-row" onClick={() => pick(r)}>
                        <span className="bc-row-text bc-row-title">{r.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {tab === "journal" && (
          <section className="bc-section" aria-labelledby="bc-board-journal">
            <h3 id="bc-board-journal" className="bc-subhead">
              {t("ui.bigCheese.board.tab.journal")}
            </h3>
            {entries.length === 0 && <p className="bc-muted">{t("ui.bigCheese.board.journal.empty")}</p>}
            <ul className="bc-list">
              {entries.map((e) => (
                <li key={e.id} className="bc-panel" style={e.state === "done" ? undefined : { opacity: 0.6 }}>
                  <span className="bc-muted">
                    {t("ui.bigCheese.run.when", { day: t(dayKey(e.at.day)), week: e.at.week })} · {t(stateKey[e.state])}
                  </span>
                  {e.actions
                    .flatMap((f) => [...sentence(t, kit, f), ...numbers(t, kit, f)])
                    .map((line, i) => (
                      <span key={i}>{line}</span>
                    ))}
                  {confirm?.id === e.id ? (
                    <>
                      <p className="bc-note">
                        {confirm.mode === "rewind" ? (
                          <>
                            {t("ui.bigCheese.board.journal.laterPlays", { count: e.later })}
                            {e.days > 0 && ` ${t("ui.bigCheese.board.journal.laterDays", { count: e.days })}`}
                          </>
                        ) : (
                          t("ui.bigCheese.board.journal.changed")
                        )}
                      </p>
                      <button
                        type="button"
                        className="bc-btn bc-btn-danger"
                        disabled={busy}
                        onClick={() => void journalAct(e, confirm.mode, true)}
                      >
                        {t(
                          confirm.mode === "rewind"
                            ? "ui.bigCheese.board.journal.rewindAnyway"
                            : "ui.bigCheese.board.journal.revertAnyway",
                        )}
                      </button>
                      <button type="button" className="bc-btn bc-btn-quiet" onClick={() => setConfirm(null)}>
                        {t("ui.bigCheese.confirm.keep")}
                      </button>
                    </>
                  ) : (
                    <>
                      {e.canRewind && (
                        <button
                          type="button"
                          className="bc-btn"
                          disabled={busy}
                          onClick={() =>
                            e.later > 0 ? setConfirm({ id: e.id, mode: "rewind" }) : void journalAct(e, "rewind")
                          }
                        >
                          {t("ui.bigCheese.board.journal.rewind")}
                        </button>
                      )}
                      {e.canRevert && (
                        <button
                          type="button"
                          className="bc-btn"
                          disabled={busy}
                          onClick={() =>
                            e.changed ? setConfirm({ id: e.id, mode: "revert" }) : void journalAct(e, "revert")
                          }
                        >
                          {t("ui.bigCheese.board.journal.revert")}
                        </button>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
            {more && (
              <button type="button" className="bc-btn" onClick={() => void loadJournal(page + 1)}>
                {t("ui.bigCheese.board.journal.more")}
              </button>
            )}
          </section>
        )}

        <button type="button" className="bc-btn bc-btn-quiet" onClick={onClose}>
          {t("ui.bigCheese.board.close")}
        </button>
      </div>
    </div>
  );
}
