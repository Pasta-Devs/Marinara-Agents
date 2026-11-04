import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import {
  createCircle,
  deleteCircle,
  listChats,
  listCharacters,
  listCircles,
  listTextConnections,
  pingTabOpened,
  runCircle,
  setCircleSpeed,
  setCircleTime,
  updateCircle,
  type Circle,
  type CircleFields,
  type NamedItem,
} from "./api.js";

// One place for the copy, so it can move to a locale file later.
const COPY = {
  title: "Meanwhile",
  new: "New Circle",
  empty: "No Circles yet. Make one to start.",
  needModel: "Choose a model to start",
  edit: "Edit",
  runNow: "Run now",
  save: "Save",
  cancel: "Cancel",
  remove: "Delete Circle",
  confirmRemove: "Delete this Circle? This cannot be undone.",
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
  if (clock.speed === 0) parts.push("paused");
  else if (clock.speed !== 1) parts.push(`x${clock.speed}`);
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
  const [wall, setWall] = useState(circle.status.nowWall);
  const speed = useMutation({ mutationFn: (value: number) => setCircleSpeed(circle.id, value), onSuccess: onChanged });
  const time = useMutation({ mutationFn: () => setCircleTime(circle.id, wall), onSuccess: onChanged });
  const current = circle.clock.speed;
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
        <button type="button" className="mw-btn" onClick={() => speed.mutate(Number(custom))}>
          Set speed
        </button>
      </div>
      <div className="mw-row">
        <input
          className="mw-input mw-grow"
          type="datetime-local"
          aria-label="Circle date and time"
          value={wall}
          onChange={(e) => setWall(e.target.value)}
        />
        <button type="button" className="mw-btn" disabled={!wall} onClick={() => time.mutate()}>
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

function CircleCard({ circle, onEdit }: { circle: Circle; onEdit: () => void }) {
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
          <div className="mw-name">{circle.name}</div>
          <div className="mw-muted">{statusLine(circle)}</div>
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
    </div>
  );
}

export function MeanwhileView() {
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
          <CircleCard key={circle.id} circle={circle} onEdit={() => setEditing(circle.id)} />
        ),
      )}
      {!circles.isLoading && list.length === 0 && editing === null ? (
        <div className="mw-empty">{COPY.empty}</div>
      ) : null}
    </div>
  );
}
