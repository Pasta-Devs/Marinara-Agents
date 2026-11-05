import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import {
  acceptEvent,
  cancelFastForward,
  createCircle,
  deleteCircle,
  editEvent,
  fastForward,
  getHome,
  getPromises,
  getTimeline,
  listChats,
  listCharacters,
  listCircles,
  listTextConnections,
  pickUp,
  pingTabOpened,
  previewFastForward,
  runCircle,
  setCircleSpeed,
  setCircleTime,
  updateCircle,
  vetoEvent,
  type Circle,
  type CircleFields,
  type NamedItem,
  type Span,
} from "./api.js";

// One place for the copy, so it can move to a locale file later.
const COPY = {
  title: "Meanwhile",
  new: "New Circle",
  empty: "No Circles yet. Make one to start.",
  showTimeline: "Timeline",
  planned: "Planned:",
  earlier: "earlier today",
  hideTimeline: "Hide timeline",
  now: "Now",
  nothingYet: "nothing yet",
  dealt: "Dealt for today",
  person: "Person",
  everyone: "Everyone",
  noEvents: "Nothing yet. Press Run now to fill the days.",
  needModel: "Choose a model to start",
  edit: "Edit",
  runNow: "Run now",
  save: "Save",
  cancel: "Cancel",
  remove: "Delete Circle",
  hooks: "While you were away",
  told: "told in a chat",
  pickUp: "Pick up this thread",
  noChat: "No linked chat has this character.",
  openToContinue: (chat: string) => `Open ${chat} to continue.`,
  showDiary: "Diary",
  hideDiary: "Hide diary",
  noDiary: "Nothing written yet.",
  waiting: "Waiting for you",
  paused: "Paused: daily limit reached",
  confirmRemove: "Delete this Circle? This cannot be undone.",
  accept: "Accept",
  veto: "Veto",
  editText: "Edit text",
  ffTitle: "Fast forward",
  ffHide: "Hide fast forward",
  ffDays: "Days",
  ffHours: "Hours",
  ffExplain: "Time moves forward now. Each day gets one model call that writes what happened.",
  ffCheck: "Check cost",
  ffRun: "Run",
  ffGo: "Go on anyway",
  ffStop: "Stop after this day",
  ffEstimate: (days: number, calls: number, left: number) =>
    `${days} ${days === 1 ? "day" : "days"} with events. ${calls} model ${calls === 1 ? "call" : "calls"}. ${Math.max(0, left)} left today.`,
  ffOver: (calls: number, left: number) => `This uses ${calls} of ${Math.max(0, left)} calls left today. Go on?`,
  ffProgress: (done: number, total: number) => `Running: ${done} of ${total} days done.`,
  promises: "Promises",
  showPromises: "Show promises",
  hidePromises: "Hide promises",
  noPromises: "No promises yet.",
  promiseState: { open: "waiting", kept: "kept", dropped: "dropped", stale: "out of date" } as Record<string, string>,
  loadFailed: "Could not load Circles.",
};

const PACES: Circle["pace"][] = ["cozy", "eventful", "dramatic"];

function people(n: number) {
  return `${n} ${n === 1 ? "person" : "people"}`;
}

function when(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone });
}

function statusLine(circle: Circle) {
  const { status, clock } = circle;
  const parts = [people(circle.castIds.length), `caught up to ${when(status.lastRunCircle, clock.timezone)}`];
  if (clock.speed === 0) parts.push("Paused");
  else if (clock.speed !== 1) parts.push(`x${clock.speed}`);
  if (circle.status.paused) parts.push(COPY.paused);
  return parts.join(" · ");
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function Picker({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: NamedItem[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const shown = items.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <div className="mw-field">
      <span className="mw-label">
        {label} ({value.length})
      </span>
      <input
        className="mw-input"
        type="search"
        placeholder="Search"
        aria-label={`Search ${label.toLowerCase()}`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="mw-list" role="group" aria-label={label}>
        {shown.map((item) => (
          <label key={item.id} className="mw-check">
            <input
              type="checkbox"
              checked={value.includes(item.id)}
              onChange={(e) => onChange(e.target.checked ? [...value, item.id] : value.filter((id) => id !== item.id))}
            />
            <span>{item.name}</span>
          </label>
        ))}
        {shown.length === 0 ? (
          <span className="mw-muted" style={{ padding: "0.6rem" }}>
            Nothing found.
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ClockControls({ circle, onChanged }: { circle: Circle; onChanged: () => void }) {
  const [custom, setCustom] = useState(String(circle.clock.speed));
  const [wall, setWall] = useState("");
  // Until the field is edited it shows the Circle's current time, so Set time cannot move a running clock back.
  const [wallEdited, setWallEdited] = useState(false);
  const speed = useMutation({ mutationFn: (value: number) => setCircleSpeed(circle.id, value), onSuccess: onChanged });
  const time = useMutation({
    mutationFn: () => setCircleTime(circle.id, wall),
    onSuccess: () => {
      setWallEdited(false);
      onChanged();
    },
  });
  const current = circle.clock.speed;
  const customSpeed = Number(custom);
  const customValid = custom.trim() !== "" && Number.isFinite(customSpeed) && customSpeed >= 0 && customSpeed <= 1440;
  return (
    <div className="mw-field">
      <span className="mw-label">Clock</span>
      <div className="mw-seg" role="group" aria-label="Speed">
        {[0, 1, 24].map((value) => (
          <button
            key={value}
            type="button"
            className={`mw-btn ${current === value ? "mw-btn-on" : ""}`}
            aria-pressed={current === value}
            onClick={() => speed.mutate(value)}
          >
            {value === 0 ? "Paused" : `x${value}`}
          </button>
        ))}
      </div>
      <div className="mw-row">
        <input
          className="mw-input mw-grow"
          type="number"
          min={0}
          max={1440}
          step="any"
          aria-label="Custom speed"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <button type="button" className="mw-btn" disabled={!customValid} onClick={() => speed.mutate(customSpeed)}>
          Set speed
        </button>
      </div>
      <div className="mw-row">
        <input
          className="mw-input mw-grow"
          type="datetime-local"
          aria-label="Circle date and time"
          value={wallEdited ? wall : circle.status.nowWall}
          onChange={(e) => {
            setWall(e.target.value);
            setWallEdited(true);
          }}
        />
        <button
          type="button"
          className="mw-btn"
          disabled={!wallEdited || !wall || time.isPending}
          onClick={() => time.mutate()}
        >
          Set time
        </button>
      </div>
      {speed.isError || time.isError ? (
        <span role="alert" className="mw-warn">
          {errorText(speed.error ?? time.error)}
        </span>
      ) : null}
    </div>
  );
}

function CircleForm({ circle, onDone }: { circle: Circle | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const characters = useQuery({ queryKey: ["meanwhile", "characters"], queryFn: listCharacters });
  const chats = useQuery({ queryKey: ["meanwhile", "chats"], queryFn: listChats });
  const connections = useQuery({ queryKey: ["meanwhile", "connections"], queryFn: listTextConnections });
  const [draft, setDraft] = useState<Required<CircleFields>>({
    name: circle?.name ?? "",
    castIds: circle?.castIds ?? [],
    setting: circle?.setting ?? "",
    linkedChatIds: circle?.linkedChatIds ?? [],
    sharedWorld: circle?.sharedWorld ?? false,
    pace: circle?.pace ?? "cozy",
    backgroundTimer: circle?.backgroundTimer ?? false,
    connectionId: circle?.connectionId ?? "",
    timezone: circle?.clock.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  // Until the user touches the switch, it follows the rule: on when exactly one chat is linked.
  const [sharedTouched, setSharedTouched] = useState(circle !== null);
  const shared = sharedTouched ? draft.sharedWorld : draft.linkedChatIds.length === 1;
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["meanwhile", "circles"] });
  const save = useMutation({
    mutationFn: () => {
      const fields = { ...draft, sharedWorld: shared };
      return circle ? updateCircle(circle.id, fields) : createCircle(fields);
    },
    onSuccess: async () => {
      await refresh();
      onDone();
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteCircle(circle!.id),
    onSuccess: async () => {
      await refresh();
      onDone();
    },
  });

  return (
    <form
      className="mw-card"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <label className="mw-field">
        <span className="mw-label">Name</span>
        <input
          className="mw-input"
          required
          maxLength={80}
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </label>
      <Picker
        label="Cast"
        items={characters.data ?? []}
        value={draft.castIds}
        onChange={(castIds) => set({ castIds })}
      />
      <label className="mw-field">
        <span className="mw-label">Setting</span>
        <textarea
          className="mw-input"
          rows={3}
          maxLength={600}
          value={draft.setting}
          onChange={(e) => set({ setting: e.target.value })}
        />
      </label>
      <Picker
        label="Linked chats"
        items={chats.data ?? []}
        value={draft.linkedChatIds}
        onChange={(linkedChatIds) => set({ linkedChatIds })}
      />
      <label className="mw-check">
        <input
          type="checkbox"
          checked={shared}
          onChange={(e) => {
            setSharedTouched(true);
            set({ sharedWorld: e.target.checked });
          }}
        />
        <span>
          Shared world
          <span className="mw-muted" style={{ display: "block" }}>
            On: all linked chats share what happens. Off: each chat only hears its own facts.
          </span>
        </span>
      </label>
      <div className="mw-field">
        <span className="mw-label">Pace</span>
        <div className="mw-seg" role="group" aria-label="Pace">
          {PACES.map((pace) => (
            <button
              key={pace}
              type="button"
              className={`mw-btn ${draft.pace === pace ? "mw-btn-on" : ""}`}
              aria-pressed={draft.pace === pace}
              onClick={() => set({ pace })}
            >
              {pace[0]!.toUpperCase() + pace.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <label className="mw-check">
        <input
          type="checkbox"
          checked={draft.backgroundTimer}
          onChange={(e) => set({ backgroundTimer: e.target.checked })}
        />
        <span>Also run every 6 hours in the background</span>
      </label>
      <label className="mw-field">
        <span className="mw-label">Model</span>
        <select
          className="mw-input"
          required
          value={draft.connectionId}
          onChange={(e) => set({ connectionId: e.target.value })}
        >
          <option value="">{COPY.needModel}</option>
          {(connections.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="mw-field">
        <span className="mw-label">Time zone</span>
        <input
          className="mw-input"
          list="mw-zones"
          value={draft.timezone}
          onChange={(e) => set({ timezone: e.target.value })}
        />
        <datalist id="mw-zones">
          {(Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
            .supportedValuesOf?.("timeZone")
            .map((z) => (
              <option key={z} value={z} />
            ))}
        </datalist>
      </label>
      {circle ? <ClockControls circle={circle} onChanged={() => void refresh()} /> : null}
      {save.isError ? (
        <span role="alert" className="mw-warn">
          {errorText(save.error)}
        </span>
      ) : null}
      <div className="mw-row">
        <button type="submit" className="mw-btn mw-btn-primary" disabled={save.isPending || !draft.name.trim()}>
          {COPY.save}
        </button>
        <button type="button" className="mw-btn" onClick={onDone}>
          {COPY.cancel}
        </button>
        {circle ? (
          <button
            type="button"
            className="mw-btn mw-warn"
            style={{ marginInlineStart: "auto" }}
            disabled={remove.isPending}
            onClick={() => window.confirm(COPY.confirmRemove) && remove.mutate()}
          >
            {COPY.remove}
          </button>
        ) : null}
      </div>
    </form>
  );
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
function FastForwardPanel({ circle }: { circle: Circle }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<"days" | "hours">("days");
  const [amount, setAmount] = useState(1);
  const live = circle.status.fastForward;
  // Poll faster while a run is live, so the progress moves.
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
      <button type="button" className="mw-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? COPY.ffHide : COPY.ffTitle}
      </button>
      {open ? (
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
          </div>
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
                  : COPY.ffEstimate(data.days, data.calls, data.left)}
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
      ) : null}
    </div>
  );
}

/** What the characters said they would do in chat, and whether a beat kept it. Read only. */
function PromisesPanel({ circle }: { circle: Circle }) {
  const [open, setOpen] = useState(false);
  const characters = useQuery({ queryKey: ["meanwhile", "characters"], queryFn: listCharacters });
  const list = useQuery({
    queryKey: ["meanwhile", "promises", circle.id],
    queryFn: () => getPromises(circle.id),
    enabled: open,
    refetchInterval: 15_000,
  });
  const name = (id: string) => characters.data?.find((c) => c.id === id)?.name ?? "Someone";
  const items = list.data?.promises ?? [];
  return (
    <div className="mw-field">
      <button type="button" className="mw-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? COPY.hidePromises : COPY.showPromises}
      </button>
      {open && list.isError ? (
        <span role="alert" className="mw-warn">
          {errorText(list.error)}
        </span>
      ) : null}
      {open && list.data && items.length === 0 ? <div className="mw-muted">{COPY.noPromises}</div> : null}
      {open
        ? items.map((p) => (
            <div key={p.id} className="mw-row mw-muted">
              <span>{p.due}</span>
              <span>
                {name(p.characterId)}: {p.text}
              </span>
              <span className="mw-tag">{COPY.promiseState[p.status] ?? p.status}</span>
            </div>
          ))
        : null}
    </div>
  );
}

/** Opens a chat in the Engine. The host passes it to the element; older hosts pass nothing. */
type OpenChat = () => ((chatId: string) => void) | undefined;

function HomePanel({ circle, openChat }: { circle: Circle; openChat?: OpenChat }) {
  const queryClient = useQueryClient();
  const [diary, setDiary] = useState(false);
  const [note, setNote] = useState("");
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const characters = useQuery({ queryKey: ["meanwhile", "characters"], queryFn: listCharacters });
  const home = useQuery({
    queryKey: ["meanwhile", "home", circle.id],
    queryFn: () => getHome(circle.id),
    refetchInterval: 15_000,
  });
  const name = (id: string) => characters.data?.find((c) => c.id === id)?.name ?? "Someone";
  const pick = useMutation({
    mutationFn: (v: { eventId: string; chat: NamedItem }) => pickUp(circle.id, v.eventId, v.chat.id).then(() => v.chat),
    onSuccess: (chat) => {
      void queryClient.invalidateQueries({ queryKey: ["meanwhile", "home", circle.id] });
      const open = openChat?.();
      if (open) open(chat.id);
      else setNote(COPY.openToContinue(chat.name));
    },
  });
  const hooks = home.data?.hooks ?? [];
  const waiting = home.data?.waiting ?? [];
  return (
    <>
      {waiting.length > 0 ? (
        <div className="mw-field">
          <span className="mw-label">{COPY.waiting}</span>
          {waiting.map((w) => (
            <div key={w.id} className="mw-field">
              <div>{w.text}</div>
              <div className="mw-muted">
                {w.cast.map(name).join(" and ")} · {w.day}
              </div>
              <EventActions
                circleId={circle.id}
                event={{ id: w.id, text: w.text, status: "proposed", weight: "major" }}
              />
            </div>
          ))}
        </div>
      ) : null}
      {hooks.length > 0 ? (
        <div className="mw-field">
          <span className="mw-label">{COPY.hooks}</span>
          {hooks.map((hook) => {
            const key = `${hook.eventId}:${hook.characterId}`;
            const chat = hook.chats.find((c) => c.id === chosen[key]) ?? hook.chats[0];
            return (
              <div key={key} className="mw-row">
                <div className="mw-grow">
                  <div>
                    {name(hook.characterId)}: {hook.text}
                  </div>
                  <div className="mw-muted">
                    {hook.day}
                    {hook.told ? ` · ${COPY.told}` : ""}
                  </div>
                </div>
                {hook.chats.length > 1 ? (
                  <select
                    className="mw-input"
                    aria-label={COPY.pickUp}
                    value={chat?.id}
                    onChange={(e) => setChosen({ ...chosen, [key]: e.target.value })}
                  >
                    {hook.chats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                {chat ? (
                  <button
                    type="button"
                    className="mw-btn"
                    disabled={pick.isPending}
                    onClick={() => pick.mutate({ eventId: hook.eventId, chat })}
                  >
                    {COPY.pickUp}
                  </button>
                ) : (
                  <span className="mw-muted">{COPY.noChat}</span>
                )}
              </div>
            );
          })}
          {note ? <div className="mw-muted">{note}</div> : null}
          {pick.isError ? (
            <span role="alert" className="mw-warn">
              {errorText(pick.error)}
            </span>
          ) : null}
        </div>
      ) : null}
      <button type="button" className="mw-btn" aria-expanded={diary} onClick={() => setDiary(!diary)}>
        {diary ? COPY.hideDiary : COPY.showDiary}
      </button>
      {diary
        ? circle.castIds.map((id) => {
            const lines = home.data?.diary[id] ?? [];
            return (
              <div key={id} className="mw-field">
                <span className="mw-label">{name(id)}</span>
                {lines.length === 0 ? <div className="mw-muted">{COPY.noDiary}</div> : null}
                {lines.map((line) => (
                  <div key={line.id} className="mw-row mw-muted">
                    <span>{line.day}</span>
                    <span>{line.text}</span>
                  </div>
                ))}
              </div>
            );
          })
        : null}
    </>
  );
}

function CircleCard({ circle, onEdit, openChat }: { circle: Circle; onEdit: () => void; openChat?: OpenChat }) {
  const queryClient = useQueryClient();
  const run = useMutation({
    mutationFn: () => runCircle(circle.id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["meanwhile", "circles"] }),
  });
  const { status } = circle;
  return (
    <div className="mw-card">
      <div className="mw-row">
        <div className="mw-grow">
          <div className="mw-name">
            {circle.name}{" "}
            {circle.waiting > 0 ? (
              <span className="mw-tag">
                {COPY.waiting} ({circle.waiting})
              </span>
            ) : null}
          </div>
          <div className="mw-muted">{statusLine(circle)}</div>
          {circle.status.nextDueAt ? (
            <div className="mw-muted">
              Next background run about {new Date(circle.status.nextDueAt).toLocaleTimeString()}
            </div>
          ) : null}
        </div>
        <button type="button" className="mw-btn" onClick={onEdit}>
          {COPY.edit}
        </button>
      </div>
      {!status.ready ? (
        <button type="button" className="mw-btn mw-btn-primary" onClick={onEdit}>
          {COPY.needModel}
        </button>
      ) : (
        <div className="mw-row">
          <button
            type="button"
            className="mw-btn"
            disabled={run.isPending || status.leaseUntil !== null}
            onClick={() => run.mutate()}
          >
            {COPY.runNow}
          </button>
          {status.retryAt ? (
            <span className="mw-warn">Last run failed. Next try {new Date(status.retryAt).toLocaleTimeString()}.</span>
          ) : null}
        </div>
      )}
      {run.isError ? (
        <span role="alert" className="mw-warn">
          {errorText(run.error)}
        </span>
      ) : null}
      <HomePanel circle={circle} openChat={openChat} />
      <FastForwardPanel circle={circle} />
      <PromisesPanel circle={circle} />
      <TimelinePanel circle={circle} />
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

function TimelinePanel({ circle }: { circle: Circle }) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState("");
  const characters = useQuery({ queryKey: ["meanwhile", "characters"], queryFn: listCharacters });
  const timeline = useQuery({
    queryKey: ["meanwhile", "timeline", circle.id],
    queryFn: () => getTimeline(circle.id),
    enabled: open,
    refetchInterval: 15_000,
  });
  const name = (id: string) => characters.data?.find((c) => c.id === id)?.name ?? "Someone";
  const names = (ids: string[]) => ids.map(name).join(" and ");
  const data = timeline.data;
  const shown = (data?.events ?? []).filter((e) => !who || e.cast.includes(who));
  const days = [...new Set(shown.map((e) => e.day))].reverse();
  return (
    <>
      <button type="button" className="mw-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? COPY.hideTimeline : COPY.showTimeline}
      </button>
      {open && timeline.isError ? (
        <span role="alert" className="mw-warn">
          {errorText(timeline.error)}
        </span>
      ) : null}
      {open && data ? (
        <>
          <div className="mw-field">
            <span className="mw-label">{COPY.now}</span>
            {circle.castIds.map((id) => {
              const now = data.now[id];
              return (
                <div key={id} className="mw-muted">
                  {name(id)}:{" "}
                  {now ? [now.activity, now.place, `until ${now.until}`].filter(Boolean).join(" · ") : COPY.nothingYet}
                </div>
              );
            })}
          </div>
          {data.dealt.length > 0 ? (
            <div className="mw-field">
              <span className="mw-label">{COPY.dealt}</span>
              {data.dealt.map((seed) => (
                <div key={seed.id} className="mw-muted">
                  {COPY.planned} {names(seed.cast)}, {KIND_LABELS[seed.kind] ?? seed.kind}, {seed.place}, {seed.time}
                  {seed.time < data.nowTime ? ` (${COPY.earlier})` : ""}
                </div>
              ))}
            </div>
          ) : null}
          <select className="mw-input" aria-label={COPY.person} value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">{COPY.everyone}</option>
            {circle.castIds.map((id) => (
              <option key={id} value={id}>
                {name(id)}
              </option>
            ))}
          </select>
          {days.length === 0 ? <div className="mw-muted">{COPY.noEvents}</div> : null}
          {days.map((day) => {
            const events = shown.filter((e) => e.day === day);
            return (
              <div key={day} className="mw-field">
                <span className="mw-name">{day}</span>
                {events
                  .filter((e) => e.weight === "summary")
                  .map((e) => (
                    <div key={e.id} className="mw-muted">
                      {e.text}
                    </div>
                  ))}
                {events
                  .filter((e) => (e.weight === "notable" || e.weight === "major") && (!who || e.cast.includes(who)))
                  .map((e) => (
                    <div key={e.id} className="mw-row">
                      <span>{e.time}</span>
                      <span>{e.text}</span>
                      {e.status === "proposed" ? <span className="mw-tag">{COPY.waiting}</span> : null}
                      <EventActions circleId={circle.id} event={e} />
                    </div>
                  ))}
                {circle.castIds
                  .filter((id) => !who || id === who)
                  .map((id) => {
                    const lines = events.filter((e) => e.weight === "routine" && e.cast.includes(id));
                    return lines.length ? (
                      <div key={id} className="mw-field">
                        <span className="mw-label">{name(id)}</span>
                        {lines.map((e) => (
                          <div key={e.id} className="mw-row mw-muted">
                            <span>{e.time}</span>
                            <span>{e.text}</span>
                            {e.place ? <span className="mw-tag">{e.place}</span> : null}
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })}
              </div>
            );
          })}
        </>
      ) : null}
    </>
  );
}

export function MeanwhileView({ openChat }: { openChat?: OpenChat }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const queryClient = useQueryClient();
  const circles = useQuery({ queryKey: ["meanwhile", "circles"], queryFn: listCircles, refetchInterval: 15_000 });

  // Opening the tab lets every Circle with a model catch up.
  useEffect(() => {
    pingTabOpened()
      .then(() => new Promise((resolve) => setTimeout(resolve, 1500)))
      .then(() => queryClient.invalidateQueries({ queryKey: ["meanwhile", "circles"] }))
      .catch(() => undefined);
  }, [queryClient]);

  const list = circles.data?.circles ?? [];
  const done = () => setEditing(null);
  return (
    <div className="mw-shell">
      <div className="mw-head">
        <span className="mw-title">{COPY.title}</span>
        {editing === null ? (
          <button type="button" className="mw-btn mw-btn-primary" onClick={() => setEditing("new")}>
            {COPY.new}
          </button>
        ) : null}
      </div>
      {circles.isError ? (
        <span role="alert" className="mw-warn">
          {COPY.loadFailed} {errorText(circles.error)}
        </span>
      ) : null}
      {editing === "new" ? <CircleForm circle={null} onDone={done} /> : null}
      {list.map((circle) =>
        editing === circle.id ? (
          <CircleForm key={circle.id} circle={circle} onDone={done} />
        ) : (
          <CircleCard key={circle.id} circle={circle} onEdit={() => setEditing(circle.id)} openChat={openChat} />
        ),
      )}
      {!circles.isLoading && list.length === 0 && editing === null ? (
        <div className="mw-empty">{COPY.empty}</div>
      ) : null}
    </div>
  );
}
