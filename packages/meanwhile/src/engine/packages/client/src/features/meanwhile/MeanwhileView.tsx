import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import {
  acceptEvent,
  cancelFastForward,
  deleteCircle,
  editEvent,
  fastForward,
  createNudge,
  deleteNudge,
  getHome,
  getNudges,
  getPapers,
  getPhone,
  getPromises,
  getTimeline,
  listChats,
  listCharacters,
  listCircles,
  pickUp,
  pingTabOpened,
  previewFastForward,
  runCircle,
  vetoEvent,
  type Circle,
  type NamedItem,
  type Span,
} from "./api.js";
import { COPY } from "./copy.js";
import { Avatar, Icon, clockTime, errorText, friendlyDay, presence } from "./parts.js";
import { CircleSetup } from "./setup.js";

function when(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone });
}

/** Accept, veto and edit for one event. Edit is only for notable and major events. */
function EventActions({
  circleId,
  event,
}: {
  circleId: string;
  event: { id: string; text: string; status: string; weight: string };
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(event.text);
  const change = useMutation({
    mutationFn: (kind: "accept" | "veto" | "edit") =>
      kind === "accept"
        ? acceptEvent(circleId, event.id)
        : kind === "veto"
          ? vetoEvent(circleId, event.id)
          : editEvent(circleId, event.id, text),
    onSuccess: () => {
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["meanwhile"] });
    },
  });
  return (
    <div className="mw-field">
      {editing ? (
        <div className="mw-row">
          <input
            className="mw-input mw-grow"
            aria-label={COPY.editText}
            maxLength={140}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="button"
            className="mw-btn mw-btn-primary"
            disabled={change.isPending || !text.trim()}
            onClick={() => change.mutate("edit")}
          >
            {COPY.save}
          </button>
          <button type="button" className="mw-btn" onClick={() => setEditing(false)}>
            {COPY.cancel}
          </button>
        </div>
      ) : (
        <div className="mw-row">
          {event.status === "proposed" ? (
            <button
              type="button"
              className="mw-btn mw-btn-primary"
              disabled={change.isPending}
              onClick={() => change.mutate("accept")}
            >
              {COPY.accept}
            </button>
          ) : null}
          <button type="button" className="mw-btn" disabled={change.isPending} onClick={() => change.mutate("veto")}>
            {COPY.veto}
          </button>
          {event.weight === "notable" || event.weight === "major" ? (
            <button
              type="button"
              className="mw-btn"
              onClick={() => {
                setText(event.text);
                setEditing(true);
              }}
            >
              {COPY.edit}
            </button>
          ) : null}
        </div>
      )}
      {change.isError ? (
        <span role="alert" className="mw-warn">
          {errorText(change.error)}
        </span>
      ) : null}
    </div>
  );
}

/** Jump the Circle clock forward by days or hours. Shows the cost first, then progress. */
function FastForwardSheet({ circle }: { circle: Circle }) {
  const queryClient = useQueryClient();
  const [unit, setUnit] = useState<"days" | "hours">("days");
  const [amount, setAmount] = useState(1);
  const live = circle.status.fastForward;
  // Poll while a run is live, so the progress moves.
  useQuery({ queryKey: ["meanwhile", "circles"], queryFn: listCircles, refetchInterval: live.running ? 2000 : 15_000 });
  const span: Span = unit === "days" ? { days: amount } : { hours: amount };
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["meanwhile"] });
  const estimate = useMutation({ mutationFn: () => previewFastForward(circle.id, span) });
  const run = useMutation({
    mutationFn: (over: boolean) => fastForward(circle.id, span, over),
    onSuccess: () => {
      estimate.reset();
      refresh();
    },
  });
  const stop = useMutation({ mutationFn: () => cancelFastForward(circle.id), onSuccess: refresh });
  const max = unit === "days" ? 7 : 168;
  const edited = () => estimate.reset();
  const data = estimate.data;
  return (
    <div className="mw-field">
      <div className="mw-muted">{COPY.ffExplain}</div>
      <div className="mw-seg" role="group" aria-label={COPY.ffTitle}>
        {(["days", "hours"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`mw-btn ${unit === value ? "mw-btn-on" : ""}`}
            aria-pressed={unit === value}
            onClick={() => {
              setUnit(value);
              setAmount(1);
              edited();
            }}
          >
            {value === "days" ? COPY.ffDays : COPY.ffHours}
          </button>
        ))}
      </div>
      <input
        className="mw-input"
        type="number"
        min={1}
        max={max}
        aria-label={unit === "days" ? COPY.ffDays : COPY.ffHours}
        value={amount}
        onChange={(e) => {
          setAmount(Math.min(max, Math.max(1, Math.trunc(Number(e.target.value)) || 1)));
          edited();
        }}
      />
      {live.running ? (
        <div className="mw-row">
          <span className="mw-grow">{COPY.ffProgress(live.dayIndex, live.days)}</span>
          <button type="button" className="mw-btn" disabled={stop.isPending} onClick={() => stop.mutate()}>
            {COPY.ffStop}
          </button>
        </div>
      ) : data ? (
        <div className="mw-field">
          <div className={data.overBudget ? "mw-warn" : "mw-muted"}>
            {data.overBudget
              ? COPY.ffOver(data.calls, data.left)
              : COPY.ffEstimate(data.days, data.calls, data.left, data.missed)}
          </div>
          <button
            type="button"
            className="mw-btn mw-btn-primary"
            disabled={run.isPending || !circle.status.ready}
            onClick={() => run.mutate(data.overBudget)}
          >
            {data.overBudget ? COPY.ffGo : COPY.ffRun}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="mw-btn mw-btn-primary"
          disabled={estimate.isPending || !circle.status.ready}
          onClick={() => estimate.mutate()}
        >
          {COPY.ffCheck}
        </button>
      )}
      {!circle.status.ready ? <span className="mw-muted">{COPY.needModel}</span> : null}
      {estimate.isError || run.isError || stop.isError ? (
        <span role="alert" className="mw-warn">
          {errorText(estimate.error ?? run.error ?? stop.error)}
        </span>
      ) : null}
    </div>
  );
}

/** What the characters said they would do in chat, and whether a beat kept it. Read only. */
function PromisesList({ circle, people, today }: { circle: Circle; people: Map<string, NamedItem>; today: string }) {
  const list = useQuery({
    queryKey: ["meanwhile", "promises", circle.id],
    queryFn: () => getPromises(circle.id),
    refetchInterval: 15_000,
  });
  const items = list.data?.promises ?? [];
  return (
    <div className="mw-card">
      <span className="mw-label">{COPY.promises}</span>
      {list.isError ? (
        <span role="alert" className="mw-warn">
          {errorText(list.error)}
        </span>
      ) : null}
      {list.data && items.length === 0 ? <div className="mw-muted">{COPY.noPromises}</div> : null}
      {items.map((p) => (
        <div key={p.id} className="mw-row mw-muted">
          <span>{friendlyDay(p.due.slice(0, 10), today)}</span>
          <span className="mw-grow">
            {people.get(p.characterId)?.name ?? "Someone"}: {p.text}
          </span>
          <span className="mw-tag">{COPY.promiseState[p.status] ?? p.status}</span>
        </div>
      ))}
    </div>
  );
}

// Plain words for the kind ids the deck deals.
const KIND_LABELS: Record<string, string> = {
  conflict: "a conflict",
  luck: "a lucky break",
  hobbies: "a hobby",
  death: "a death",
  breakup: "a breakup",
  pregnancy: "a pregnancy",
  "job loss": "a job loss",
  "serious injury": "a serious injury",
};
const PLAIN_KINDS = ["work", "friends", "family", "romance", "conflict", "health", "luck", "hobbies"];

/** "This week Lily gets a job offer": the deck turns the nudge into one planned event inside its window. */
function NudgesPanel({ circle, people, today }: { circle: Circle; people: Map<string, NamedItem>; today: string }) {
  const queryClient = useQueryClient();
  const [who, setWho] = useState("");
  const [also, setAlso] = useState("");
  const [text, setText] = useState("");
  const [kind, setKind] = useState("");
  const [days, setDays] = useState(7);
  const list = useQuery({
    queryKey: ["meanwhile", "nudges", circle.id],
    queryFn: () => getNudges(circle.id),
    refetchInterval: 15_000,
  });
  const kinds = [...(circle.allowedKinds.length ? circle.allowedKinds : PLAIN_KINDS), ...circle.bigKindsAllowed];
  const name = (id: string) => people.get(id)?.name ?? "Someone";
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["meanwhile", "nudges", circle.id] });
  const add = useMutation({
    mutationFn: () =>
      createNudge(circle.id, {
        cast: [who || circle.castIds[0], also].filter((id): id is string => typeof id === "string" && !!id),
        text,
        kind: kind || kinds[0],
        withinDays: days,
      }),
    onSuccess: () => {
      setText("");
      void refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteNudge(circle.id, id),
    onSuccess: () => void refresh(),
  });
  const items = list.data?.nudges ?? [];
  const cast = (
    <>
      {circle.castIds.map((id) => (
        <option key={id} value={id}>
          {name(id)}
        </option>
      ))}
    </>
  );
  return (
    <div className="mw-card">
      <span className="mw-label">{COPY.nudge}</span>
      <details className="mw-details">
        <summary className="mw-btn">{COPY.nudgeAdd}</summary>
        <div className="mw-field">
          <label className="mw-field">
            <span className="mw-label">{COPY.nudgeWho}</span>
            <select className="mw-input" value={who || circle.castIds[0]} onChange={(e) => setWho(e.target.value)}>
              {cast}
            </select>
          </label>
          <label className="mw-field">
            <span className="mw-label">{COPY.nudgeAlso}</span>
            <select className="mw-input" value={also} onChange={(e) => setAlso(e.target.value)}>
              <option value="" />
              {cast}
            </select>
          </label>
          <label className="mw-field">
            <span className="mw-label">{COPY.nudgeText}</span>
            <input
              className="mw-input"
              maxLength={140}
              placeholder={COPY.nudgePlaceholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <label className="mw-field">
            <span className="mw-label">{COPY.nudgeKind}</span>
            <select className="mw-input" value={kind || kinds[0]} onChange={(e) => setKind(e.target.value)}>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k] ?? k}
                </option>
              ))}
            </select>
          </label>
          <label className="mw-field">
            <span className="mw-label">{COPY.nudgeDays}</span>
            <select className="mw-input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="mw-row">
            <button
              type="button"
              className="mw-btn mw-btn-primary"
              disabled={add.isPending || !text.trim() || circle.castIds.length === 0}
              onClick={() => add.mutate()}
            >
              {COPY.nudgeAdd}
            </button>
          </div>
          {add.isError ? (
            <span role="alert" className="mw-warn">
              {errorText(add.error)}
            </span>
          ) : null}
        </div>
      </details>
      {list.data && items.length === 0 ? <div className="mw-muted">{COPY.noNudges}</div> : null}
      {items.map((n) => (
        <div key={n.id} className="mw-row mw-muted">
          <span>{n.cast.map(name).join(" + ")}:</span>
          <span>{n.text}</span>
          <span className="mw-tag">{COPY.nudgeState[n.status] ?? n.status}</span>
          {n.event ? (
            <span>
              {friendlyDay(n.event.day, today)}: {n.event.text}
            </span>
          ) : null}
          {n.status === "open" ? (
            <button
              type="button"
              className="mw-btn"
              aria-label={`${COPY.nudgeRemove} ${n.text}`}
              disabled={remove.isPending}
              onClick={() => remove.mutate(n.id)}
            >
              {COPY.nudgeRemove}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ---- Circle home ------------------------------------------------------------

const TABS = ["today", "diary", "phone", "paper", "plans", "timeline"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  today: "Today",
  diary: "Diary",
  phone: "Phone",
  paper: "Paper",
  plans: "Plans",
  timeline: "Timeline",
};
const STORE_CIRCLE = "meanwhile.circle";
const STORE_TAB = "meanwhile.tab";

function recall(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function remember(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode: the choice just is not kept */
  }
}

function useWide(): boolean {
  const query = "(min-width: 900px)";
  const [wide, setWide] = useState(() => typeof matchMedia === "function" && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const media = matchMedia(query);
    const sync = () => setWide(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return wide;
}

function Tabs({ tabs, value, onChange }: { tabs: readonly Tab[]; value: Tab; onChange: (tab: Tab) => void }) {
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: React.KeyboardEvent, index: number) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? tabs.length - 1
          : (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[next]!);
    buttons.current[tabs[next]!]?.focus();
  };
  useEffect(() => {
    buttons.current[value]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [value]);
  return (
    <div className="mw-tabs" role="tablist" aria-label={COPY.tabsLabel}>
      {tabs.map((tab, index) => (
        <button
          key={tab}
          ref={(el) => {
            buttons.current[tab] = el;
          }}
          type="button"
          role="tab"
          id={`mw-tab-${tab}`}
          aria-selected={value === tab}
          aria-controls="mw-panel"
          tabIndex={value === tab ? 0 : -1}
          className={`mw-tab ${value === tab ? "mw-tab-on" : ""}`}
          onClick={() => onChange(tab)}
          onKeyDown={(e) => onKey(e, index)}
        >
          {TAB_LABEL[tab]}
        </button>
      ))}
    </div>
  );
}

/** The Circle menu: arrow keys move, Escape and a click outside close it. */
function CircleMenu({ items }: { items: { label: string; danger?: boolean; onSelect: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const entries = () => [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  useEffect(() => {
    if (!open) return;
    entries()[0]?.focus();
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  const onKey = (e: React.KeyboardEvent) => {
    const all = entries();
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      setOpen(false);
      button.current?.focus();
    } else if (e.key === "Tab") setOpen(false);
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      all[(at + (e.key === "ArrowDown" ? 1 : -1) + all.length) % all.length]?.focus();
    }
  };
  return (
    <div className="mw-menu" ref={root} onKeyDown={onKey}>
      <button
        ref={button}
        type="button"
        className="mw-icon"
        aria-label={COPY.settings}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="more" />
      </button>
      {open ? (
        <div className="mw-pop" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`mw-item ${item.danger ? "mw-warn" : ""}`}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ponytail: no focus trap in the sheet, Escape and the close button are the ways out; add a trap if more dialogs appear.
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.focus();
    return () => before?.focus?.();
  }, []);
  return (
    <div
      className="mw-scrim"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={box}
        className="mw-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="mw-row">
          <b className="mw-grow">{title}</b>
          <button type="button" className="mw-btn" onClick={onClose}>
            {COPY.close}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

type People = Map<string, NamedItem>;
type HomeData = Awaited<ReturnType<typeof getHome>>;
type PaperData = Awaited<ReturnType<typeof getPapers>>["papers"];

function personAvatar(
  people: People,
  id: string,
  size: number,
  extra?: { ring?: boolean; status?: "online" | "busy" | "offline" },
) {
  const person = people.get(id);
  return <Avatar id={id} name={person?.name ?? "?"} url={person?.avatarUrl} size={size} {...extra} />;
}

function HookCard({
  circle,
  hook,
  people,
  today,
  openChat,
  onDismiss,
}: {
  circle: Circle;
  hook: HomeData["hooks"][number];
  people: People;
  today: string;
  openChat?: OpenChat;
  onDismiss: () => void;
}) {
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState(hook.chats[0]?.id ?? "");
  const [note, setNote] = useState("");
  const chat = hook.chats.find((c) => c.id === chosen) ?? hook.chats[0];
  const pick = useMutation({
    mutationFn: (target: NamedItem) => pickUp(circle.id, hook.eventId, target.id).then(() => target),
    onSuccess: (target) => {
      void queryClient.invalidateQueries({ queryKey: ["meanwhile"] });
      if (openChat) openChat(target.id);
      else setNote(COPY.openToContinue(target.name));
    },
  });
  const name = people.get(hook.characterId)?.name ?? "Someone";
  return (
    <div className="mw-card mw-hookcard">
      {personAvatar(people, hook.characterId, 40)}
      <div className="mw-stack">
        <div className="mw-who">
          {name} <small>{friendlyDay(hook.day, today, hook.time)}</small>
          {hook.told ? <span className="mw-tag">{COPY.told}</span> : null}
        </div>
        <p className="mw-hooktext">{hook.text}</p>
        {hook.chats.length > 1 ? (
          <select
            className="mw-input"
            aria-label={COPY.pickUp}
            value={chat?.id ?? ""}
            onChange={(e) => setChosen(e.target.value)}
          >
            {hook.chats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
        {chat ? (
          <div className="mw-row">
            <button
              type="button"
              className="mw-btn mw-btn-sm mw-btn-primary"
              disabled={pick.isPending}
              onClick={() => pick.mutate(chat)}
            >
              {COPY.bringUp(chat.name)}
            </button>
            <button type="button" className="mw-btn mw-btn-sm" onClick={onDismiss}>
              {COPY.notNow}
            </button>
          </div>
        ) : (
          <div className="mw-muted">{COPY.noChat}</div>
        )}
        {note ? <div className="mw-muted">{note}</div> : null}
        {pick.isError ? (
          <span role="alert" className="mw-warn">
            {errorText(pick.error)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function monthDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { month: "long", day: "numeric", timeZone: "UTC" });
}

function TodayTab({
  circle,
  home,
  papers,
  people,
  today,
  dismissed,
  dismiss,
  openChat,
  openPaper,
}: {
  circle: Circle;
  home: HomeData | undefined;
  papers: PaperData | undefined;
  people: People;
  today: string;
  dismissed: Set<string>;
  dismiss: (key: string) => void;
  openChat?: OpenChat;
  openPaper: () => void;
}) {
  const hooks = (home?.hooks ?? []).filter((h) => !dismissed.has(`${h.eventId}:${h.characterId}`));
  const waiting = home?.waiting ?? [];
  const fresh = hooks.filter((h) => !h.told).length;
  const paper = papers?.[0];
  const empty = home && waiting.length === 0 && hooks.length === 0 && circle.toHear === 0 && !paper;
  return (
    <div className="mw-stack">
      {waiting.map((w) => (
        <div key={w.id} className="mw-card mw-wait">
          <div className="mw-waittag">{COPY.waiting}</div>
          <div>{w.text}</div>
          <div className="mw-muted">
            {w.cast.map((id) => people.get(id)?.name ?? "Someone").join(" and ")} · {friendlyDay(w.day, today, w.time)}
          </div>
          <EventActions circleId={circle.id} event={{ id: w.id, text: w.text, status: "proposed", weight: "major" }} />
        </div>
      ))}
      {hooks.length > 0 ? (
        <>
          <div className="mw-labelrow">
            <span>{COPY.hooks}</span>
            {fresh > 0 ? <span>{COPY.newCount(fresh)}</span> : null}
          </div>
          {hooks.map((hook) => (
            <HookCard
              key={`${hook.eventId}:${hook.characterId}`}
              circle={circle}
              hook={hook}
              people={people}
              today={today}
              openChat={openChat}
              onDismiss={() => dismiss(`${hook.eventId}:${hook.characterId}`)}
            />
          ))}
        </>
      ) : null}
      {circle.toHear > 0 ? (
        <div className="mw-card mw-teaser">
          <div>
            <b>{COPY.toHear(circle.toHear)}</b>
            <small>{COPY.toHearHint}</small>
          </div>
        </div>
      ) : null}
      {paper ? (
        <button type="button" className="mw-card mw-teaser mw-teaserbtn" onClick={openPaper}>
          <span className="mw-ico">
            <Icon name="paper" />
          </span>
          <span>
            <b>{COPY.newPaper(paper.title)}</b>
            <small>{COPY.paperTeaser(monthDay(paper.weekStart), paper.items.length)}</small>
          </span>
        </button>
      ) : null}
      {empty ? <div className="mw-empty">{COPY.todayEmpty}</div> : null}
    </div>
  );
}

function PersonChips({
  circle,
  people,
  value,
  onChange,
  lead,
}: {
  circle: Circle;
  people: People;
  value: string;
  onChange: (id: string) => void;
  lead: { id: string; label: string }[];
}) {
  return (
    <div className="mw-chips" role="group" aria-label={COPY.person}>
      {lead.map((chip) => (
        <button
          key={chip.id || "all"}
          type="button"
          className={`mw-chip ${value === chip.id ? "mw-chip-on" : ""}`}
          aria-pressed={value === chip.id}
          onClick={() => onChange(chip.id)}
        >
          {chip.label}
        </button>
      ))}
      {circle.castIds.map((id) => (
        <button
          key={id}
          type="button"
          className={`mw-chip ${value === id ? "mw-chip-on" : ""}`}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          {personAvatar(people, id, 22)}
          {people.get(id)?.name ?? "Someone"}
        </button>
      ))}
    </div>
  );
}

function DiaryTab({
  circle,
  home,
  people,
  today,
}: {
  circle: Circle;
  home: HomeData | undefined;
  people: People;
  today: string;
}) {
  const [who, setWho] = useState("");
  const lines = circle.castIds
    .filter((id) => !who || id === who)
    .flatMap((id) => (home?.diary[id] ?? []).map((line) => ({ ...line, id: `${id}:${line.id}`, who: id })))
    .sort((a, b) => `${b.day} ${b.time}`.localeCompare(`${a.day} ${a.time}`));
  return (
    <div className="mw-stack">
      <PersonChips
        circle={circle}
        people={people}
        value={who}
        onChange={setWho}
        lead={[{ id: "", label: COPY.everyone }]}
      />
      {lines.length === 0 ? <div className="mw-empty">{COPY.noDiary}</div> : null}
      <div className="mw-diary">
        {lines.map((line) => (
          <div key={line.id} className="mw-entry">
            <div className="mw-when">
              {who ? "" : `${people.get(line.who)?.name ?? "Someone"} · `}
              {friendlyDay(line.day, today, line.time)}
            </div>
            <div className="mw-line">{line.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhoneTab({ circle, people, today }: { circle: Circle; people: People; today: string }) {
  const [picked, setPicked] = useState<string | null>(null);
  const phone = useQuery({
    queryKey: ["meanwhile", "phone", circle.id],
    queryFn: () => getPhone(circle.id),
    refetchInterval: 15_000,
  });
  const tz = circle.clock.timezone;
  const name = (id: string) => people.get(id)?.name ?? "Someone";
  const threads = phone.data?.threads ?? [];
  const thread = threads.find((t) => `${t.a}|${t.b}` === picked);
  if (phone.isError)
    return (
      <span role="alert" className="mw-warn">
        {errorText(phone.error)}
      </span>
    );
  if (thread) {
    let lastDay = "";
    return (
      <div className="mw-stack">
        <div className="mw-threadhead">
          <button type="button" className="mw-icon" aria-label={COPY.backToThreads} onClick={() => setPicked(null)}>
            <Icon name="back" />
          </button>
          <span className="mw-pair">
            {personAvatar(people, thread.a, 34)}
            {personAvatar(people, thread.b, 34)}
          </span>
          <b>
            {name(thread.a)} and {name(thread.b)}
          </b>
        </div>
        {thread.texts.map((t) => {
          const when = new Date(t.time);
          const day = when.toLocaleDateString("en-CA", { timeZone: tz });
          const separator = day !== lastDay ? <div className="mw-day">{friendlyDay(day, today)}</div> : null;
          lastDay = day;
          return (
            <React.Fragment key={`${t.from}${t.time}${t.text}`}>
              {separator}
              <div className={`mw-bubble ${t.from === thread.b ? "mw-bubble-right" : ""}`}>
                <small>{name(t.from)}</small>
                <div>{t.text}</div>
                <time>{when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: tz })}</time>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  }
  return (
    <div className="mw-stack">
      {phone.data && threads.length === 0 ? <div className="mw-empty">{COPY.noTexts}</div> : null}
      {threads.map((t) => (
        <button
          key={`${t.a}|${t.b}`}
          type="button"
          className="mw-card mw-thread"
          onClick={() => setPicked(`${t.a}|${t.b}`)}
        >
          <span className="mw-pair">
            {personAvatar(people, t.a, 40)}
            {personAvatar(people, t.b, 40)}
          </span>
          <span className="mw-stack">
            <b>
              {name(t.a)} and {name(t.b)}
            </b>
            <span className="mw-muted mw-clip">{t.texts.at(-1)?.text}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function PaperTab({ papers }: { papers: PaperData | undefined }) {
  const [index, setIndex] = useState(0);
  const list = papers ?? [];
  const paper = list[Math.min(index, Math.max(0, list.length - 1))];
  if (!paper) return papers ? <div className="mw-empty">{COPY.noPaper}</div> : null;
  const [lead, ...rest] = paper.items;
  return (
    <div className="mw-stack mw-papercol">
      <article className="mw-paper">
        <div className="mw-mast">{paper.title}</div>
        <div className="mw-ed">
          <span>{COPY.paperWeek(monthDay(paper.weekStart))}</span>
          <span>{COPY.issue(list.length - list.indexOf(paper))}</span>
        </div>
        {lead ? (
          <>
            <h4>{lead.headline}</h4>
            <p>{lead.text}</p>
          </>
        ) : null}
        {rest.length > 0 ? (
          <div className="mw-cols">
            {rest.map((item) => (
              <div key={item.headline}>
                <h5>{item.headline}</h5>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        ) : null}
      </article>
      <div className="mw-row">
        <button
          type="button"
          className="mw-btn"
          disabled={index >= list.length - 1}
          onClick={() => setIndex(index + 1)}
        >
          {COPY.older}
        </button>
        <span className="mw-muted mw-grow mw-center">{COPY.paperOf(list.indexOf(paper) + 1, list.length)}</span>
        <button type="button" className="mw-btn" disabled={index <= 0} onClick={() => setIndex(index - 1)}>
          {COPY.newer}
        </button>
      </div>
    </div>
  );
}

function PlansTab({ circle, people, today }: { circle: Circle; people: People; today: string }) {
  return (
    <div className="mw-stack">
      <PromisesList circle={circle} people={people} today={today} />
      <NudgesPanel circle={circle} people={people} today={today} />
    </div>
  );
}

function TimelineTab({
  circle,
  timeline,
  people,
  today,
}: {
  circle: Circle;
  timeline: Awaited<ReturnType<typeof getTimeline>> | undefined;
  people: People;
  today: string;
}) {
  const [who, setWho] = useState("notable");
  const [menu, setMenu] = useState<string | null>(null);
  const chats = useQuery({ queryKey: ["meanwhile", "chats"], queryFn: listChats });
  const name = (id: string) => people.get(id)?.name ?? "Someone";
  const events = (timeline?.events ?? []).filter((e) =>
    who === "notable" ? e.weight !== "routine" : who === "all" ? true : e.cast.includes(who),
  );
  const days = [...new Set(events.map((e) => e.day))].reverse();
  return (
    <div className="mw-stack">
      <PersonChips
        circle={circle}
        people={people}
        value={who}
        onChange={setWho}
        lead={[
          { id: "notable", label: COPY.notable },
          { id: "all", label: COPY.all },
        ]}
      />
      {timeline && who === "notable" ? (
        <div className="mw-card">
          <span className="mw-label">{COPY.now}</span>
          {circle.castIds.map((id) => {
            const now = timeline.now[id];
            const sent = timeline.statusSent[id];
            return (
              <div key={id} className="mw-muted">
                {name(id)}:{" "}
                {now
                  ? [
                      now.activity,
                      now.place && !now.activity.includes(now.place) ? now.place : "",
                      now.until ? `until ${clockTime(now.until)}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : COPY.nothingYet}
                {sent
                  ? ` · ${COPY.statusSent(chats.data?.find((c) => c.id === sent.chatId)?.name ?? "chat", new Date(sent.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }))}`
                  : ""}
              </div>
            );
          })}
          {timeline.dealt.length > 0 ? (
            <>
              <span className="mw-label">{COPY.dealt}</span>
              {timeline.dealt.map((seed) => (
                <div key={seed.id} className="mw-muted">
                  {COPY.planned} {seed.cast.map(name).join(" and ")}, {KIND_LABELS[seed.kind] ?? seed.kind},{" "}
                  {seed.place}, {clockTime(seed.time)}
                  {seed.time < timeline.nowTime ? ` (${COPY.earlier})` : ""}
                </div>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
      {timeline && days.length === 0 ? <div className="mw-empty">{COPY.noEvents}</div> : null}
      {days.map((day) => (
        <div key={day}>
          <div className="mw-tlday">{friendlyDay(day, today)}</div>
          {events
            .filter((e) => e.day === day)
            .map((e) => {
              const actionable = e.weight === "notable" || e.weight === "major";
              return (
                <div key={e.id} className={`mw-ev ${e.weight === "routine" ? "mw-ev-routine" : ""}`}>
                  <time>{clockTime(e.time)}</time>
                  <div>
                    {e.text}
                    {e.kind ? <span className="mw-tag">{e.kind}</span> : null}
                    {e.status === "proposed" ? <span className="mw-tag">{COPY.waiting}</span> : null}
                  </div>
                  {actionable ? (
                    <button
                      type="button"
                      className="mw-more"
                      aria-label={COPY.vetoOrEdit}
                      aria-expanded={menu === e.id}
                      onClick={() => setMenu(menu === e.id ? null : e.id)}
                    >
                      <Icon name="more" />
                    </button>
                  ) : (
                    <span />
                  )}
                  {actionable && menu === e.id ? (
                    <div className="mw-evacts">
                      <EventActions circleId={circle.id} event={e} />
                    </div>
                  ) : null}
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}

function CircleHome({
  circle,
  people,
  openChat,
  wide,
  tab,
  setTab,
  onEdit,
  onDeleted,
  dismissed,
  dismiss,
}: {
  circle: Circle;
  people: People;
  openChat?: OpenChat;
  wide: boolean;
  tab: Tab;
  setTab: (tab: Tab) => void;
  onEdit: () => void;
  onDeleted: () => void;
  dismissed: Set<string>;
  dismiss: (key: string) => void;
}) {
  const queryClient = useQueryClient();
  const [forward, setForward] = useState(false);
  const home = useQuery({
    queryKey: ["meanwhile", "home", circle.id],
    queryFn: () => getHome(circle.id),
    refetchInterval: 15_000,
  });
  const timeline = useQuery({
    queryKey: ["meanwhile", "timeline", circle.id],
    queryFn: () => getTimeline(circle.id),
    refetchInterval: 15_000,
  });
  const papers = useQuery({ queryKey: ["meanwhile", "papers", circle.id], queryFn: () => getPapers(circle.id) });
  const run = useMutation({
    mutationFn: () => runCircle(circle.id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["meanwhile", "circles"] }),
  });
  const remove = useMutation({
    mutationFn: () => deleteCircle(circle.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["meanwhile"] });
      onDeleted();
    },
  });
  const { status, clock } = circle;
  const today = status.nowWall.slice(0, 10);
  const weekday = new Date(`${today}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" });
  const meta = [
    `${weekday}, ${clockTime(status.nowWall.slice(11, 16))}`,
    clock.speed === 0 ? COPY.speedPaused : clock.speed === 1 ? COPY.speedReal : `x${clock.speed}`,
    circle.pace,
  ].join(" · ");
  const hookFor = new Set((home.data?.hooks ?? []).filter((h) => !h.told).map((h) => h.characterId));
  const today_ = (
    <TodayTab
      circle={circle}
      home={home.data}
      papers={papers.data?.papers}
      people={people}
      today={today}
      dismissed={dismissed}
      dismiss={dismiss}
      openChat={openChat}
      openPaper={() => setTab("paper")}
    />
  );
  const tabs = wide ? TABS.slice(1) : TABS;
  const active: Tab = wide && tab === "today" ? "diary" : tab;
  const panel =
    active === "today" ? (
      today_
    ) : active === "diary" ? (
      <DiaryTab circle={circle} home={home.data} people={people} today={today} />
    ) : active === "phone" ? (
      <PhoneTab circle={circle} people={people} today={today} />
    ) : active === "paper" ? (
      <PaperTab papers={papers.data?.papers} />
    ) : active === "plans" ? (
      <PlansTab circle={circle} people={people} today={today} />
    ) : (
      <TimelineTab circle={circle} timeline={timeline.data} people={people} today={today} />
    );
  const left = (
    <div className="mw-col">
      <div className="mw-head">
        <div className="mw-grow">
          <h2 className="mw-title">{circle.name}</h2>
          <div className="mw-meta">{meta}</div>
          <div className="mw-meta">
            {[`caught up to ${when(status.lastRunCircle, clock.timezone)}`, status.paused ? COPY.paused : ""]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <CircleMenu
          items={[
            { label: COPY.edit, onSelect: onEdit },
            { label: COPY.runNow, onSelect: () => run.mutate() },
            { label: COPY.promises, onSelect: () => setTab("plans") },
            {
              label: COPY.remove,
              danger: true,
              onSelect: () => {
                if (window.confirm(COPY.confirmRemove)) remove.mutate();
              },
            },
          ]}
        />
      </div>
      <div className="mw-cast">
        {circle.castIds.map((id) => {
          const now = timeline.data?.now[id];
          return (
            <div key={id} className="mw-person">
              {personAvatar(people, id, 56, { ring: hookFor.has(id), status: presence(now) })}
              <b>{people.get(id)?.name ?? "Someone"}</b>
              <span>
                {now
                  ? `${now.activity}${now.until ? ` until ${clockTime(now.until)}` : ""}`
                  : timeline.data
                    ? COPY.nothingYet
                    : ""}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mw-cta">
        <button
          type="button"
          className="mw-btn mw-btn-primary"
          disabled={!status.ready}
          onClick={() => setForward(true)}
        >
          <Icon name="forward" />
          {COPY.letTimePass}
        </button>
        <button
          type="button"
          className="mw-btn"
          disabled={run.isPending || status.leaseUntil !== null || !status.ready}
          onClick={() => run.mutate()}
        >
          {COPY.runNow}
        </button>
      </div>
      {!status.ready ? (
        <button type="button" className="mw-btn mw-btn-primary" onClick={onEdit}>
          {COPY.needModel}
        </button>
      ) : null}
      {status.nextDueAt ? (
        <div className="mw-muted">Next background run {new Date(status.nextDueAt).toLocaleTimeString()}</div>
      ) : null}
      {status.retryAt ? (
        <span className="mw-warn">Last run failed. Next try {new Date(status.retryAt).toLocaleTimeString()}.</span>
      ) : null}
      {run.isError || remove.isError ? (
        <span role="alert" className="mw-warn">
          {errorText(run.error ?? remove.error)}
        </span>
      ) : null}
      {wide ? today_ : null}
    </div>
  );
  const right = (
    <div className="mw-col">
      <Tabs tabs={tabs} value={active} onChange={setTab} />
      <div role="tabpanel" id="mw-panel" aria-labelledby={`mw-tab-${active}`} className="mw-stack">
        {panel}
      </div>
    </div>
  );
  return (
    <>
      {wide ? (
        <div className="mw-desk">
          {left}
          {right}
        </div>
      ) : (
        <>
          {left}
          {right}
        </>
      )}
      {forward ? (
        <Sheet title={COPY.ffTitle} onClose={() => setForward(false)}>
          <FastForwardSheet circle={circle} />
        </Sheet>
      ) : null}
    </>
  );
}

type OpenChat = (chatId: string) => void;

export function MeanwhileView({ openChat }: { openChat?: OpenChat }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [selected, setSelected] = useState<string | null>(() => recall(STORE_CIRCLE));
  const [tab, setTabState] = useState<Tab>(() => {
    const saved = recall(STORE_TAB);
    return (TABS as readonly string[]).includes(saved ?? "") ? (saved as Tab) : "today";
  });
  const [notice, setNotice] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const wide = useWide();
  const queryClient = useQueryClient();
  const circles = useQuery({ queryKey: ["meanwhile", "circles"], queryFn: listCircles, refetchInterval: 15_000 });
  const characters = useQuery({ queryKey: ["meanwhile", "characters"], queryFn: listCharacters });

  // Opening the tab lets every Circle with a model catch up.
  useEffect(() => {
    pingTabOpened()
      .then(() => new Promise((resolve) => setTimeout(resolve, 1500)))
      .then(() => queryClient.invalidateQueries({ queryKey: ["meanwhile", "circles"] }))
      .catch(() => undefined);
  }, [queryClient]);

  const list = circles.data?.circles ?? [];
  const circle = list.find((c) => c.id === selected) ?? list[0];
  const people: People = new Map((characters.data ?? []).map((c) => [c.id, c]));
  const choose = (id: string) => {
    setSelected(id);
    remember(STORE_CIRCLE, id);
  };
  const setTab = (next: Tab) => {
    setTabState(next);
    remember(STORE_TAB, next);
  };
  const done = (id?: string, note?: string) => {
    if (id) choose(id);
    setNotice(note ?? "");
    setEditing(null);
  };

  return (
    <div className="mw-shell">
      <div className="mw-top">
        <div className="mw-circles">
          {list.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`mw-chip ${c.id === circle?.id ? "mw-chip-on" : ""}`}
              aria-pressed={c.id === circle?.id}
              onClick={() => {
                choose(c.id);
                setEditing(null);
              }}
            >
              {c.name}
              {c.newHooks > 0 ? <span className="mw-n">{c.newHooks}</span> : null}
            </button>
          ))}
        </div>
        <button type="button" className="mw-icon" aria-label={COPY.newCircle} onClick={() => setEditing("new")}>
          <Icon name="plus" />
        </button>
      </div>
      {notice ? (
        <span role="status" className="mw-warn">
          {notice}
        </span>
      ) : null}
      {circles.isError ? (
        <span role="alert" className="mw-warn">
          {COPY.loadFailed} {errorText(circles.error)}
        </span>
      ) : null}
      {circle ? (
        <CircleHome
          key={circle.id}
          circle={circle}
          people={people}
          openChat={openChat}
          wide={wide}
          tab={tab}
          setTab={setTab}
          onEdit={() => setEditing(circle.id)}
          onDeleted={done}
          dismissed={dismissed}
          dismiss={(key) => setDismissed(new Set(dismissed).add(key))}
        />
      ) : null}
      {editing === "new" ? <CircleSetup circle={null} onDone={done} /> : null}
      {editing !== null && editing !== "new" && circle?.id === editing ? (
        <CircleSetup key={`setup-${circle.id}`} circle={circle} onDone={done} />
      ) : null}
      {!circles.isLoading && list.length === 0 ? <div className="mw-empty">{COPY.empty}</div> : null}
    </div>
  );
}
