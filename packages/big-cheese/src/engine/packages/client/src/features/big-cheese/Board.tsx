// ──────────────────────────────────────────────
// Big Cheese: the Cheese Board, M1 and M2 (cheese-board.md). A bottom sheet over the run:
// search the actions, Set values, Spin a wish into a plan, preview, play, Coming up, and the journal with rewind and revert.
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
  when?: unknown;
}

interface Fact extends Action {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  state?: string;
}

interface Preview {
  id: string;
  actions: Fact[];
  summary?: string;
  question?: string | null;
  cant?: string[];
  dropped?: { beat: string; code: string }[];
  offline?: boolean;
}

interface Entry {
  id: string;
  at: { week: number; day: number };
  layer: string;
  text?: string;
  summary?: string;
  state: "done" | "scheduled" | "rewound" | "reverted";
  actions: Fact[];
  later: number;
  days: number;
  canRewind: boolean;
  canRevert: boolean;
  changed: boolean;
}

interface When {
  week: number;
  day: number;
}

interface ComingRow {
  id: string;
  type: "action" | "beat" | "clock";
  when: When;
  source: string;
  fact?: Fact;
  thread?: { id: string; title: string };
}

type Ask =
  | "meter"
  | "trust"
  | "stress"
  | "mood"
  | "cardAdd"
  | "cardRemove"
  | "skip"
  | "hours"
  | "rewind"
  | "ambition"
  | "room"
  | "relation"
  | "secret"
  | "threadOpen"
  | "thread";

interface Row {
  key: string;
  label: string;
  /** What the form asks for. */
  ask: Ask;
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
  ambition: "ui.bigCheese.board.row.ambition",
  room: "ui.bigCheese.board.row.room",
  relation: "ui.bigCheese.board.row.relation",
  secret: "ui.bigCheese.board.row.secret",
  threadOpen: "ui.bigCheese.board.row.threadOpen",
  thread: "ui.bigCheese.board.row.thread",
};

const TAB_KEYS = {
  set: "ui.bigCheese.board.tab.set",
  spin: "ui.bigCheese.board.tab.spin",
  coming: "ui.bigCheese.board.tab.coming",
  journal: "ui.bigCheese.board.tab.journal",
};

const SEVERITY_KEYS = [
  "ui.bigCheese.board.severity.small",
  "ui.bigCheese.board.severity.medium",
  "ui.bigCheese.board.severity.big",
];

const RELATION_KEYS: Record<string, string> = {
  friend: "ui.bigCheese.board.relation.friend",
  rival: "ui.bigCheese.board.relation.rival",
  crush: "ui.bigCheese.board.relation.crush",
  couple: "ui.bigCheese.board.relation.couple",
  mentor: "ui.bigCheese.board.relation.mentor",
  enemy: "ui.bigCheese.board.relation.enemy",
  family: "ui.bigCheese.board.relation.family",
  secret_affair: "ui.bigCheese.board.relation.secretAffair",
};

const KIND_KEYS: Record<string, string> = {
  wish: "ui.bigCheese.board.kind.wish",
  crisis: "ui.bigCheese.board.kind.crisis",
  personal_arc: "ui.bigCheese.board.kind.personalArc",
  mystery: "ui.bigCheese.board.kind.mystery",
  cover_up: "ui.bigCheese.board.kind.coverUp",
  project: "ui.bigCheese.board.kind.project",
};

const THREAD_ACT_KEYS: Record<string, string> = {
  won: "ui.bigCheese.board.threadAct.won",
  lost: "ui.bigCheese.board.threadAct.lost",
  dropped: "ui.bigCheese.board.threadAct.dropped",
  beat: "ui.bigCheese.board.threadAct.beat",
  followup: "ui.bigCheese.board.threadAct.followup",
};

const DROP_KEYS: Record<string, string> = {
  "unknown-person": "ui.bigCheese.board.drop.unknownPerson",
  "unknown-room": "ui.bigCheese.board.drop.unknownRoom",
  "bad-size": "ui.bigCheese.board.drop.badSize",
  "bad-when": "ui.bigCheese.board.drop.badWhen",
  "bad-touch": "ui.bigCheese.board.drop.badTouch",
  "unknown-verb": "ui.bigCheese.board.drop.badTouch",
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
/** A value or a delta as the player reads it: "70" or "+6". */
const amount = (i: Record<string, unknown> = {}) =>
  i.value !== undefined ? String(i.value) : `${num(i.delta) >= 0 ? "+" : ""}${i.delta}`;

/** Where an action happens: "Happens now" or a day and week. */
function whenText(t: TFunction, w: unknown) {
  if (typeof w === "object" && w !== null) {
    const { week, day } = w as When;
    return t("ui.bigCheese.run.when", { day: t(dayKey(day)), week });
  }
  return t("ui.bigCheese.board.when");
}

/** The one-line name of an action, with the number it writes, as a button or list line would say it. */
function sentence(
  t: TFunction,
  kit: KitView,
  f: Action & { after?: Record<string, unknown> },
  title: (id: string) => string,
): string[] {
  const after = f.after ?? {};
  const id = f.target?.id ?? "";
  const i = f.input ?? {};
  const name = nameOf(kit, id);
  switch (f.verb) {
    case "meter.set":
      return [
        t("ui.bigCheese.board.set.meter", {
          meter: kit.meters[id as Meter]?.label ?? id,
          value: after[`meters.${id}`] ?? amount(i),
        }),
      ];
    case "person.feelings": {
      const out: string[] = [];
      const trust =
        after[`people.${id}.trust`] ?? i.trust ?? (i.trustBy !== undefined ? amount({ delta: i.trustBy }) : undefined);
      const stress =
        after[`people.${id}.stress`] ??
        i.stress ??
        (i.stressBy !== undefined ? amount({ delta: i.stressBy }) : undefined);
      const mood = after[`people.${id}.mood`] ?? i.mood;
      if (trust !== undefined) out.push(t("ui.bigCheese.board.set.trust", { name, value: trust }));
      if (stress !== undefined) out.push(t("ui.bigCheese.board.set.stress", { name, value: stress }));
      if (mood !== undefined) out.push(t("ui.bigCheese.board.set.mood", { name, mood: t(moodKey(String(mood))) }));
      return out;
    }
    case "card.add":
      return [t("ui.bigCheese.board.set.cardAdd", { name: nameOf(kit, String(i.asker ?? "")) })];
    case "card.remove": {
      const card = (
        Array.isArray((f as Fact).before?.inbox) ? ((f as Fact).before.inbox as { id: string; asker: string }[]) : []
      ).find((c) => c.id === id);
      return [t("ui.bigCheese.board.set.cardRemove", { name: card ? nameOf(kit, card.asker) : "" })];
    }
    case "time.skip":
      return [t("ui.bigCheese.board.set.skip", { count: Math.min(5, Number(i.days) || 1) })];
    case "time.hours":
      return [t("ui.bigCheese.board.set.hours", { count: Number(after["clock.hoursLeft"] ?? i.hours) })];
    case "time.rewind":
      return [
        t("ui.bigCheese.board.set.rewind", {
          day: t(dayKey(Number(after["clock.day"]))),
          week: after["clock.week"],
        }),
      ];
    case "ambition.set":
      return [t("ui.bigCheese.board.set.ambition", { name, value: amount(i) })];
    case "room.condition":
      return [
        t("ui.bigCheese.board.set.room", {
          name: kit.rooms.find((r) => r.id === id)?.name ?? id,
          value: after[`rooms.${id}.condition`] ?? amount(i),
        }),
      ];
    case "relation.shift":
      return [
        t("ui.bigCheese.board.set.relation", {
          a: nameOf(kit, String(i.a)),
          b: nameOf(kit, String(i.b)),
          kind: i.kind ? t(RELATION_KEYS[String(i.kind)] ?? RELATION_KEYS.friend) : "",
          value: amount(i),
        }),
      ];
    case "secret.add":
      return [t("ui.bigCheese.board.set.secret", { name: nameOf(kit, String(i.about)), text: String(i.text) })];
    case "thread.open":
      return [t("ui.bigCheese.board.set.threadOpen", { title: String(i.title) })];
    case "thread.change":
      return [t("ui.bigCheese.board.set.threadChange", { title: title(id) })];
    case "thread.close":
      return [
        t("ui.bigCheese.board.set.threadClose", { title: title(id), state: t(THREAD_ACT_KEYS[String(i.state)]) }),
      ];
    case "thread.beat":
      return [t("ui.bigCheese.board.set.threadBeat", { title: title(id) })];
    case "thread.followup":
      return [t("ui.bigCheese.board.set.threadFollowup", { title: title(id) })];
    default:
      return [t(f.verb.startsWith("coming.") ? "ui.bigCheese.board.set.coming" : "ui.bigCheese.board.set.revert")];
  }
}

/** The numbers an action changed, always shown, for the preview and the journal. */
function numbers(t: TFunction, kit: KitView, f: Fact): string[] {
  const out: string[] = [];
  const line = (label: string, before: unknown, after: unknown) =>
    t("ui.bigCheese.board.number", { label, before, after });
  const when = (day: unknown, week: unknown) => t("ui.bigCheese.run.when", { day: t(dayKey(Number(day))), week });
  for (const [path, after] of Object.entries(f.after)) {
    const before = f.before[path];
    const [a, b, c] = path.split(".");
    if (a === "meters") out.push(line(kit.meters[b as Meter]?.label ?? b, before, after));
    else if (a === "people" && c === "trust")
      out.push(line(t("ui.bigCheese.board.path.trust", { name: nameOf(kit, b) }), before, after));
    else if (a === "people" && c === "stress")
      out.push(line(t("ui.bigCheese.board.path.stress", { name: nameOf(kit, b) }), before, after));
    else if (a === "people" && c === "ambition")
      out.push(line(t("ui.bigCheese.board.path.ambition", { name: nameOf(kit, b) }), before, after));
    else if (a === "deputyAmbition") out.push(line(t("ui.bigCheese.board.path.deputy"), before, after));
    else if (a === "rooms" && c === "condition")
      out.push(
        line(t("ui.bigCheese.board.path.room", { name: kit.rooms.find((r) => r.id === b)?.name ?? b }), before, after),
      );
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
          when(before, f.before["clock.week"]),
          when(after, f.after["clock.week"]),
        ),
      );
    else if (path === "inbox")
      out.push(line(t("ui.bigCheese.board.path.inbox"), (before as unknown[]).length, (after as unknown[]).length));
  }
  return out;
}

const base = (run: Ctx["run"]) => `/big-cheese/runs/${encodeURIComponent(run.id)}/board`;

/** An action without the numbers the server added, as the server wants it back. */
const strip = ({ verb, target, input, when }: Fact): Action => ({ verb, target, input, when });

export function Board({ ctx, note, onClose }: { ctx: Ctx; note: ReactNode; onClose: () => void }) {
  const { t } = useTranslation();
  const { run, kit, busy, act } = ctx;
  const game = run.game;
  const [tab, setTab] = useState<"set" | "spin" | "coming" | "journal">("set");
  const [query, setQuery] = useState("");
  const [row, setRow] = useState<Row | null>(null);
  const [draft, setDraft] = useState({
    value: "",
    asker: "",
    other: "",
    need: "money",
    severity: "2",
    text: "",
    kind: "",
  });
  const [plan, setPlan] = useState<Action[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [played, setPlayed] = useState(false);
  const [silent, setSilent] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<{ id: string; mode: "rewind" | "revert" } | null>(null);
  const [spinText, setSpinText] = useState("");
  const [spinTarget, setSpinTarget] = useState("");
  const [spin, setSpin] = useState<Preview | null>(null);
  const [skip, setSkip] = useState<number[]>([]);
  const [coming, setComing] = useState<ComingRow[]>([]);
  const [moving, setMoving] = useState<{ id: string; week: string; day: string } | null>(null);

  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  const people = Object.keys(game.people);
  const titleOf = (id: string) => game.threads[id]?.title ?? game.closed.find((c) => c.id === id)?.title ?? id;
  const roomName = (id: string) => kit.rooms.find((r) => r.id === id)?.name ?? id;
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
    ...people.map((p) => ({
      key: `ambition.${p}`,
      ask: "ambition" as const,
      id: p,
      label: t(ROW_KEYS.ambition, { name: nameOf(kit, p) }),
    })),
    ...people.map((p) => ({
      key: `secret.${p}`,
      ask: "secret" as const,
      id: p,
      label: t(ROW_KEYS.secret, { name: nameOf(kit, p) }),
    })),
    { key: "relation", ask: "relation" as const, label: t(ROW_KEYS.relation) },
    ...Object.keys(game.rooms).map((r) => ({
      key: `room.${r}`,
      ask: "room" as const,
      id: r,
      label: t(ROW_KEYS.room, { name: roomName(r) }),
    })),
    { key: "cardAdd", ask: "cardAdd" as const, label: t(ROW_KEYS.cardAdd) },
    ...game.inbox.map((c) => ({
      key: `cardRemove.${c.id}`,
      ask: "cardRemove" as const,
      id: c.id,
      label: t(ROW_KEYS.cardRemove, { name: nameOf(kit, c.asker) }),
    })),
    { key: "threadOpen", ask: "threadOpen" as const, label: t(ROW_KEYS.threadOpen) },
    ...Object.values(game.threads).map((th) => ({
      key: `thread.${th.id}`,
      ask: "thread" as const,
      id: th.id,
      label: t(ROW_KEYS.thread, { title: th.title }),
    })),
    { key: "skip", ask: "skip" as const, label: t(ROW_KEYS.skip) },
    { key: "hours", ask: "hours" as const, label: t(ROW_KEYS.hours) },
    { key: "rewind", ask: "rewind" as const, label: t(ROW_KEYS.rewind) },
  ];
  const q = query.toLowerCase();
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

  const loadComing = async () => {
    try {
      setComing((await api.get<{ rows: ComingRow[] }>(`${base(run)}/coming-up`)).rows);
    } catch (e) {
      setError(errorKey(e));
    }
  };
  useEffect(() => {
    if (tab === "coming") void loadComing();
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
            : r.ask === "room"
              ? game.rooms[r.id ?? ""]?.condition
              : r.ask === "hours"
                ? game.clock.hoursLeft
                : r.ask === "ambition" || r.ask === "relation"
                  ? 50
                  : r.ask === "mood"
                    ? person && person.mood
                    : 1;
    setDraft({
      value: String(value ?? 1),
      asker: people[0] ?? "",
      other: people[1] ?? people[0] ?? "",
      need: "money",
      severity: "2",
      text: "",
      kind:
        r.ask === "relation"
          ? "friend"
          : r.ask === "secret"
            ? "boss"
            : r.ask === "threadOpen"
              ? "wish"
              : r.ask === "thread"
                ? "won"
                : "",
    });
    setRow(r);
  };

  const built = (r: Row): Action | null => {
    const n = Number(draft.value);
    const valid = draft.value.trim() !== "" && Number.isFinite(n);
    const id = r.id ?? "";
    switch (r.ask) {
      case "meter":
        return valid ? { verb: "meter.set", target: { kind: "meter", id }, input: { value: n } } : null;
      case "trust":
      case "stress":
        return valid ? { verb: "person.feelings", target: { kind: "person", id }, input: { [r.ask]: n } } : null;
      case "mood":
        return { verb: "person.feelings", target: { kind: "person", id }, input: { mood: draft.value } };
      case "cardAdd":
        return { verb: "card.add", input: { asker: draft.asker, need: draft.need, severity: Number(draft.severity) } };
      case "cardRemove":
        return { verb: "card.remove", target: { kind: "card", id } };
      case "skip":
        return valid ? { verb: "time.skip", input: { days: Math.round(n) } } : null;
      case "hours":
        return valid ? { verb: "time.hours", input: { hours: Math.round(n) } } : null;
      case "rewind":
        return valid ? { verb: "time.rewind", input: { days: Math.round(n) } } : null;
      case "ambition":
        return valid ? { verb: "ambition.set", target: { kind: "person", id }, input: { value: n } } : null;
      case "room":
        return valid ? { verb: "room.condition", target: { kind: "room", id }, input: { value: n } } : null;
      case "relation":
        return valid && draft.asker !== draft.other
          ? { verb: "relation.shift", input: { a: draft.asker, b: draft.other, kind: draft.kind, value: n } }
          : null;
      case "secret":
        return draft.text.trim().length >= 3
          ? {
              verb: "secret.add",
              input: { about: id, text: draft.text.trim(), knownBy: draft.kind === "boss" ? ["boss"] : [] },
            }
          : null;
      case "threadOpen":
        return draft.text.trim()
          ? {
              verb: "thread.open",
              input: {
                kind: draft.kind,
                title: draft.text.trim(),
                people: draft.asker ? [draft.asker] : [],
                need: draft.need,
              },
            }
          : null;
      case "thread": {
        const target = { kind: "thread", id };
        if (draft.kind === "beat") return { verb: "thread.beat", target };
        if (draft.kind === "followup")
          return valid ? { verb: "thread.followup", target, input: { weeks: Math.round(n) } } : null;
        return { verb: "thread.close", target, input: { state: draft.kind } };
      }
    }
  };

  const addLabel = (r: Row) => {
    const a = built(r);
    if (!a) return t("ui.bigCheese.board.addNothing");
    return sentence(t, kit, { ...a, after: previewAfter(a) }, titleOf)[0] ?? t("ui.bigCheese.board.addNothing");
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
    const ok = await act("board/play", { previewId: preview.id, silent });
    if (ok) {
      setPlan([]);
      setPreview(null);
      setPlayed(true);
    } else void stage(plan); // The place moved on: show the new numbers.
  };

  const planIt = async () => {
    setError(null);
    setPlayed(false);
    setSkip([]);
    setChecking(true);
    try {
      setSpin(
        await api.post<Preview>(`${base(run)}/preview`, { text: spinText.trim(), target: spinTarget || undefined }),
      );
    } catch (e) {
      setSpin(null);
      setError(errorKey(e));
    } finally {
      setChecking(false);
    }
  };

  const playSpin = async () => {
    if (!spin) return;
    const kept = spin.actions.filter((_, i) => !skip.includes(i));
    const ok = await act("board/play", {
      previewId: spin.id,
      silent,
      ...(skip.length ? { edits: kept.map(strip) } : {}),
    });
    if (ok) {
      setSpin(null);
      setSpinText("");
      setPlayed(true);
    }
  };

  const journalAct = async (e: Entry, mode: "rewind" | "revert", confirmLater = false) => {
    if (await act("board/rewind", { playId: e.id, mode, confirmLater })) setConfirm(null);
  };

  const comingAct = async (id: string, op: string, when?: When) => {
    if (await act("board/coming-up", { id, op, ...(when ? { when } : {}) })) setMoving(null);
  };

  const stateKey = {
    done: "ui.bigCheese.board.journal.done",
    scheduled: "ui.bigCheese.board.journal.scheduled",
    rewound: "ui.bigCheese.board.journal.rewound",
    reverted: "ui.bigCheese.board.journal.reverted",
  };

  const personSelect = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {people.map((p) => (
        <option key={p} value={p}>
          {nameOf(kit, p)}
        </option>
      ))}
    </select>
  );

  const cardList = (facts: Fact[], remove: (i: number) => void, removed: number[] = []) => (
    <ul className="bc-list">
      {facts.map((f, i) => (
        <li key={i} className="bc-panel" style={removed.includes(i) ? { opacity: 0.4 } : undefined}>
          <strong>{sentence(t, kit, f, titleOf).join(" ")}</strong>
          <span className="bc-muted">{whenText(t, f.when)}</span>
          {numbers(t, kit, f).map((n, j) => (
            <span key={j}>{n}</span>
          ))}
          <button
            type="button"
            className="bc-btn bc-btn-quiet"
            disabled={checking || removed.includes(i)}
            onClick={() => remove(i)}
          >
            {t("ui.bigCheese.board.remove")}
            <span className="bc-sr"> {sentence(t, kit, f, titleOf).join(" ")}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  const silentSwitch = (
    <button type="button" className="bc-btn bc-btn-quiet" aria-pressed={silent} onClick={() => setSilent((v) => !v)}>
      {t("ui.bigCheese.board.silent")}
    </button>
  );

  const form = row && (
    <form
      className="bc-form"
      onSubmit={(event) => {
        event.preventDefault();
        void add(row);
      }}
    >
      <h3 className="bc-subhead">{row.label}</h3>
      {(row.ask === "meter" ||
        row.ask === "trust" ||
        row.ask === "stress" ||
        row.ask === "ambition" ||
        row.ask === "room" ||
        row.ask === "relation") && (
        <>
          {row.ask === "relation" && (
            <>
              <label>
                <span>{t("ui.bigCheese.board.field.person")}</span>
                {personSelect(draft.asker, (v) => setDraft({ ...draft, asker: v }))}
              </label>
              <label>
                <span>{t("ui.bigCheese.board.field.other")}</span>
                {personSelect(draft.other, (v) => setDraft({ ...draft, other: v }))}
              </label>
              <label>
                <span>{t("ui.bigCheese.board.field.relationKind")}</span>
                <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
                  {Object.entries(RELATION_KEYS).map(([k, key]) => (
                    <option key={k} value={k}>
                      {t(key)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label>
            <span>
              {t(row.ask === "relation" ? "ui.bigCheese.board.field.level" : "ui.bigCheese.board.field.value")}
            </span>
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={draft.value}
              onChange={(e) => setDraft({ ...draft, value: e.target.value })}
            />
          </label>
        </>
      )}
      {row.ask === "mood" && (
        <label>
          <span>{t("ui.bigCheese.board.field.mood")}</span>
          <select value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })}>
            {MOODS.map((m) => (
              <option key={m} value={m}>
                {t(moodKey(m))}
              </option>
            ))}
          </select>
        </label>
      )}
      {(row.ask === "cardAdd" || row.ask === "threadOpen") && (
        <>
          {row.ask === "threadOpen" && (
            <>
              <label>
                <span>{t("ui.bigCheese.board.field.title")}</span>
                <input
                  autoFocus
                  type="text"
                  maxLength={80}
                  value={draft.text}
                  onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                />
              </label>
              <label>
                <span>{t("ui.bigCheese.board.field.threadKind")}</span>
                <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
                  {Object.entries(KIND_KEYS).map(([k, key]) => (
                    <option key={k} value={k}>
                      {t(key)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label>
            <span>
              {t(row.ask === "cardAdd" ? "ui.bigCheese.board.field.asker" : "ui.bigCheese.board.field.person")}
            </span>
            {personSelect(draft.asker, (v) => setDraft({ ...draft, asker: v }))}
          </label>
          <label>
            <span>{t("ui.bigCheese.board.field.need")}</span>
            <select value={draft.need} onChange={(e) => setDraft({ ...draft, need: e.target.value })}>
              {METERS.map((m) => (
                <option key={m} value={m}>
                  {kit.meters[m].label}
                </option>
              ))}
            </select>
          </label>
          {row.ask === "cardAdd" && (
            <label>
              <span>{t("ui.bigCheese.board.field.severity")}</span>
              <select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value })}>
                {SEVERITY_KEYS.map((key, i) => (
                  <option key={key} value={i + 1}>
                    {t(key)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
      {row.ask === "secret" && (
        <>
          <label>
            <span>{t("ui.bigCheese.board.field.secret")}</span>
            <input
              autoFocus
              type="text"
              maxLength={200}
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            />
          </label>
          <label>
            <span>{t("ui.bigCheese.board.field.bossKnows")}</span>
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
              <option value="boss">{t("ui.bigCheese.board.yes")}</option>
              <option value="">{t("ui.bigCheese.board.no")}</option>
            </select>
          </label>
        </>
      )}
      {row.ask === "thread" && (
        <>
          <label>
            <span>{t("ui.bigCheese.board.field.threadAct")}</span>
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
              {Object.entries(THREAD_ACT_KEYS).map(([k, key]) => (
                <option key={k} value={k}>
                  {t(key)}
                </option>
              ))}
            </select>
          </label>
          {draft.kind === "followup" && (
            <label>
              <span>{t("ui.bigCheese.board.field.weeks")}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={3}
                value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: e.target.value })}
              />
            </label>
          )}
        </>
      )}
      {(row.ask === "skip" || row.ask === "hours" || row.ask === "rewind") && (
        <label>
          <span>{t(row.ask === "hours" ? "ui.bigCheese.board.field.hours" : "ui.bigCheese.board.field.days")}</span>
          <input
            autoFocus
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

  const byDay = coming.reduce<Record<string, ComingRow[]>>((acc, r) => {
    (acc[`${r.when.week}:${r.when.day}`] ??= []).push(r);
    return acc;
  }, {});

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
          {(["set", "spin", "coming", "journal"] as const).map((id) => (
            <button
              key={id}
              type="button"
              className="bc-btn bc-btn-quiet"
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              {t(TAB_KEYS[id])}
            </button>
          ))}
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
                {cardList(preview.actions, (i) => void stage(plan.filter((_, j) => j !== i)))}
                <p className="bc-muted">{t("ui.bigCheese.board.rewindNote")}</p>
                {silentSwitch}
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

        {tab === "spin" && (
          <section className="bc-section" aria-labelledby="bc-board-spin">
            <h3 id="bc-board-spin" className="bc-subhead">
              {t(TAB_KEYS.spin)}
            </h3>
            {played && (
              <p role="status" className="bc-stamp">
                {t("ui.bigCheese.board.played")}
              </p>
            )}
            <form
              className="bc-form"
              onSubmit={(event) => {
                event.preventDefault();
                void planIt();
              }}
            >
              <label>
                <span>{t("ui.bigCheese.board.spin.hint")}</span>
                <textarea
                  rows={3}
                  maxLength={600}
                  value={spinText}
                  placeholder={t("ui.bigCheese.board.spin.placeholder")}
                  onChange={(e) => setSpinText(e.target.value)}
                />
              </label>
              <label>
                <span>{t("ui.bigCheese.board.spin.target")}</span>
                <select value={spinTarget} onChange={(e) => setSpinTarget(e.target.value)}>
                  <option value="">{t("ui.bigCheese.board.spin.noTarget")}</option>
                  {people.map((p) => (
                    <option key={p} value={p}>
                      {nameOf(kit, p)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="bc-muted">{t("ui.bigCheese.board.spin.cost")}</p>
              <button type="submit" className="bc-btn bc-btn-primary" disabled={checking || !spinText.trim()}>
                {t(checking ? "ui.bigCheese.board.spin.planning" : "ui.bigCheese.board.spin.plan")}
              </button>
            </form>
            {spin && (
              <>
                {spin.question && (
                  <p role="status" className="bc-note">
                    {spin.question}
                  </p>
                )}
                {spin.actions.length === 0 && !spin.question && (
                  <p role="status" className="bc-note">
                    {t(spin.offline ? "ui.bigCheese.board.spin.offline" : "ui.bigCheese.board.spin.nothing")}
                  </p>
                )}
                {spin.summary && spin.actions.length > 0 && <p>{spin.summary}</p>}
                {spin.cant?.map((c) => (
                  <p key={c} className="bc-muted">
                    {t("ui.bigCheese.board.spin.cant", { what: c })}
                  </p>
                ))}
                {spin.dropped?.map((d) => (
                  <p key={d.beat} className="bc-muted">
                    {t("ui.bigCheese.board.spin.dropped", {
                      what: t(DROP_KEYS[d.code] ?? DROP_KEYS["bad-touch"]),
                    })}
                  </p>
                ))}
                {spin.actions.length > 0 && (
                  <>
                    {cardList(spin.actions, (i) => setSkip((s) => [...s, i]), skip)}
                    <p className="bc-muted">{t("ui.bigCheese.board.spin.rewindNote")}</p>
                    {silentSwitch}
                    <button
                      type="button"
                      className="bc-btn bc-btn-primary"
                      disabled={busy || checking || skip.length >= spin.actions.length}
                      onClick={() => void playSpin()}
                    >
                      {t("ui.bigCheese.board.play")}
                    </button>
                    <button type="button" className="bc-btn bc-btn-quiet" onClick={() => setSpin(null)}>
                      {t("ui.bigCheese.board.cancel")}
                    </button>
                  </>
                )}
              </>
            )}
          </section>
        )}

        {tab === "coming" && (
          <section className="bc-section" aria-labelledby="bc-board-coming">
            <h3 id="bc-board-coming" className="bc-subhead">
              {t(TAB_KEYS.coming)}
            </h3>
            {coming.length === 0 && <p className="bc-muted">{t("ui.bigCheese.board.coming.empty")}</p>}
            {Object.entries(byDay).map(([key, list]) => (
              <div key={key}>
                <h4 className="bc-subhead">{whenText(t, list[0]!.when)}</h4>
                <ul className="bc-list">
                  {list.map((r) => (
                    <li key={r.id} className="bc-panel">
                      <span>
                        {r.type === "action" && r.fact
                          ? sentence(t, kit, r.fact, titleOf).join(" ")
                          : t(
                              r.type === "beat" ? "ui.bigCheese.board.coming.beat" : "ui.bigCheese.board.coming.clock",
                              {
                                title: r.thread?.title,
                              },
                            )}
                      </span>
                      {r.source === "storyteller" && (
                        <span className="bc-muted">{t("ui.bigCheese.board.coming.storyteller")}</span>
                      )}
                      {moving?.id === r.id ? (
                        <form
                          className="bc-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void comingAct(r.id, "move", { week: Number(moving.week), day: Number(moving.day) });
                          }}
                        >
                          <label>
                            <span>{t("ui.bigCheese.board.coming.week")}</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={24}
                              value={moving.week}
                              onChange={(e) => setMoving({ ...moving, week: e.target.value })}
                            />
                          </label>
                          <label>
                            <span>{t("ui.bigCheese.board.coming.day")}</span>
                            <select value={moving.day} onChange={(e) => setMoving({ ...moving, day: e.target.value })}>
                              {[0, 1, 2, 3, 4].map((d) => (
                                <option key={d} value={d}>
                                  {t(dayKey(d))}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button type="submit" className="bc-btn bc-btn-primary" disabled={busy}>
                            {t("ui.bigCheese.board.coming.apply")}
                          </button>
                          <button type="button" className="bc-btn bc-btn-quiet" onClick={() => setMoving(null)}>
                            {t("ui.bigCheese.board.pickOther")}
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="bc-btn"
                            disabled={busy}
                            onClick={() => setMoving({ id: r.id, week: String(r.when.week), day: String(r.when.day) })}
                          >
                            {t("ui.bigCheese.board.coming.move")}
                          </button>
                          <button
                            type="button"
                            className="bc-btn"
                            disabled={busy}
                            onClick={() => void comingAct(r.id, "cancel")}
                          >
                            {t("ui.bigCheese.board.coming.cancel")}
                          </button>
                          {r.type !== "clock" && (
                            <button
                              type="button"
                              className="bc-btn"
                              disabled={busy}
                              onClick={() => void comingAct(r.id, "run")}
                            >
                              {t("ui.bigCheese.board.coming.run")}
                            </button>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {tab === "journal" && (
          <section className="bc-section" aria-labelledby="bc-board-journal">
            <h3 id="bc-board-journal" className="bc-subhead">
              {t(TAB_KEYS.journal)}
            </h3>
            {entries.length === 0 && <p className="bc-muted">{t("ui.bigCheese.board.journal.empty")}</p>}
            <ul className="bc-list">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="bc-panel"
                  style={e.state === "done" || e.state === "scheduled" ? undefined : { opacity: 0.6 }}
                >
                  <span className="bc-muted">
                    {t("ui.bigCheese.run.when", { day: t(dayKey(e.at.day)), week: e.at.week })} · {t(stateKey[e.state])}
                  </span>
                  {e.layer === "spin" && e.summary && <strong>{e.summary}</strong>}
                  {e.actions
                    .flatMap((f) => [...sentence(t, kit, f, titleOf), ...numbers(t, kit, f)])
                    .map((line, i) => (
                      <span key={i}>{line}</span>
                    ))}
                  {confirm?.id === e.id ? (
                    <div>
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
                    </div>
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
