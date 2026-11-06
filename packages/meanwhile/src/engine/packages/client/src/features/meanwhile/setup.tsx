import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import {
  createCircle,
  deleteCircle,
  listCharacters,
  listChats,
  listTextConnections,
  setCircleSpeed,
  setCircleTime,
  updateCircle,
  type ChatItem,
  type Circle,
  type CircleFields,
  type NamedItem,
} from "./api.js";
import { BIG_KINDS, COPY, PLAIN_KINDS, kindLabel } from "./copy.js";
import { Avatar, Icon, errorText, friendlyDay } from "./parts.js";

// The setup, in three steps for a new Circle and as one scrollable page for an existing one.

const S = {
  newTitle: "New Circle",
  editTitle: "Edit Circle",
  step: (n: number) => `Step ${n} of 3`,
  s1: "Start from a chat",
  s1Hint: "Pick the chats whose world should keep going.",
  s2: "Who lives here?",
  s2Hint: "Filled in from your chat. Change what is wrong.",
  s3: "How should it run?",
  s3Hint: "You can change all of this later.",
  withoutChat: "Start without a chat",
  noChats: "You have no chats yet.",
  lastMessage: (when: string) => `last message ${when}`,
  noMessages: "no messages yet",
  pickChat: "Pick a chat, or start without one.",
  name: "Circle name",
  nameNeeded: "Give the Circle a name.",
  castNeeded: "Pick at least one character.",
  cast: "Cast",
  add: "Add",
  addTitle: "Add a character",
  search: "Search characters",
  nothingFound: "Nothing found.",
  castFull: "A Circle holds up to 12 characters.",
  done: "Done",
  noCast: "No characters yet. Add some.",
  setting: "Setting",
  world: "Chats and facts",
  shared: ["Shared world", "All linked chats share what happens."],
  separate: ["Separate chats", "Each chat only hears its own facts."],
  linked: "Linked chats",
  pace: "Pace",
  paces: {
    cozy: ["Cozy", "Quiet days, small things."],
    eventful: ["Eventful", "Something happens most days."],
    dramatic: ["Dramatic", "Big turns and surprises."],
  } as Record<string, [string, string]>,
  model: "Model",
  modelNeeded: "Choose a model to start.",
  noModels: "No text model found. Add one in the Engine connections first.",
  cheap: "cheap",
  big: "Big events",
  bigAsk: ["Ask me first", "Big events wait in Waiting for you."],
  bigAuto: ["Let them happen", "Big events count right away."],
  bigNever: ["Not at all", "No deaths, breakups or other big turns."],
  kinds: "What can happen",
  advanced: "Advanced",
  speed: "Speed",
  speedWords: ["Paused", "Real time", "x24"],
  timezone: "Time zone",
  background: "Also run every 6 hours in the background",
  budget: "Daily model calls",
  budgetBad: "Calls must be a whole number from 1 to 200.",
  back: "Back",
  next: "Next",
  start: "Start living",
  save: "Save",
  saving: "Saving",
  cancel: "Cancel",
  close: "Close",
  remove: "Delete Circle",
  confirmRemove: "Delete this Circle? This cannot be undone.",
  discard: "Throw away your changes?",
  speedFailed: "The Circle is made, but its speed could not be set. Set it in Edit.",
};

const PACES: Circle["pace"][] = ["cozy", "eventful", "dramatic"];
const MAX_CAST = 12;
const CHEAP = /mini|flash|haiku|lite|nano|small|deepseek/i;

type Draft = Required<CircleFields>;

function draftOf(circle: Circle | null): Draft {
  return {
    name: circle?.name ?? "",
    castIds: circle?.castIds ?? [],
    setting: circle?.setting ?? "",
    linkedChatIds: circle?.linkedChatIds ?? [],
    sharedWorld: circle?.sharedWorld ?? false,
    pace: circle?.pace ?? "cozy",
    backgroundTimer: circle?.backgroundTimer ?? false,
    writeStatus: circle?.writeStatus ?? false,
    surprise: circle?.surprise ?? false,
    connectionId: circle?.connectionId ?? "",
    timezone: circle?.clock.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    allowedKinds: circle?.allowedKinds ?? [],
    // Big events are off for a new Circle; "Ask me first" and "Let them happen" are opt-in.
    bigKindsAllowed: circle?.bigKindsAllowed ?? [],
    bigAuto: circle?.bigAuto ?? false,
    budgetCallsPerDay: circle?.budgetCallsPerDay ?? 12,
  };
}

const unique = (ids: string[]) => [...new Set(ids)];
const idsOf = (value: unknown): string[] => {
  if (typeof value === "string") {
    try {
      return idsOf(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
};
const localDay = (value: Date) => value.toLocaleDateString("en-CA");

/** A group of options, one picked. Each option has a title and one plain line. */
function Choices({
  label,
  options,
  value,
  onChange,
  columns,
}: {
  label: string;
  options: { value: string; title: string; hint?: string; badge?: string }[];
  value: string;
  onChange: (value: string) => void;
  columns?: number;
}) {
  return (
    <div className="mw-field">
      <span className="mw-label" id={`mw-ch-${label}`}>
        {label}
      </span>
      <div
        className="mw-choices"
        role="group"
        aria-labelledby={`mw-ch-${label}`}
        style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`mw-choice ${value === option.value ? "mw-choice-on" : ""}`}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <b>
              {option.title}
              {option.badge ? <span className="mw-tag">{option.badge}</span> : null}
            </b>
            {option.hint ? <span>{option.hint}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function Faces({ ids, people, size = 28 }: { ids: string[]; people: Map<string, NamedItem>; size?: number }) {
  return (
    <span className="mw-faces">
      {ids.slice(0, 4).map((id) => (
        <Avatar key={id} id={id} name={people.get(id)?.name ?? "?"} url={people.get(id)?.avatarUrl} size={size} />
      ))}
      {ids.length > 4 ? <span className="mw-more-faces">+{ids.length - 4}</span> : null}
    </span>
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

export function CircleSetup({
  circle,
  onDone,
}: {
  circle: Circle | null;
  onDone: (id?: string, notice?: string) => void;
}) {
  const editing = circle !== null;
  const queryClient = useQueryClient();
  const characters = useQuery({ queryKey: ["meanwhile", "characters"], queryFn: listCharacters });
  const chats = useQuery({ queryKey: ["meanwhile", "chats"], queryFn: listChats });
  const connections = useQuery({ queryKey: ["meanwhile", "connections"], queryFn: listTextConnections });
  const [draft, setDraft] = useState<Draft>(() => draftOf(circle));
  const initial = useRef(JSON.stringify(draft));
  const [step, setStep] = useState(0);
  // Until the user edits a field, picking chats fills it in. An existing Circle is never overwritten.
  const [touched, setTouched] = useState({ name: editing, cast: editing, setting: editing, shared: editing });
  const [pool, setPool] = useState<string[]>(draft.castIds);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [speed, setSpeed] = useState(1);
  const heading = useRef<HTMLHeadingElement>(null);
  const box = useRef<HTMLDivElement>(null);

  const people = new Map((characters.data ?? []).map((c) => [c.id, c]));
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const shared = touched.shared ? draft.sharedWorld : draft.linkedChatIds.length === 1;
  const dirty = JSON.stringify(draft) !== initial.current || speed !== 1;

  // Focus moves to the heading when the step changes, so a screen reader starts at the new step.
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    return () => before?.focus?.();
  }, []);

  const close = () => {
    if (dirty && !window.confirm(S.discard)) return;
    onDone();
  };

  const save = useMutation({
    mutationFn: async () => {
      const fields = { ...draft, name: draft.name.trim(), sharedWorld: shared };
      if (circle) return updateCircle(circle.id, fields);
      const made = await createCircle(fields);
      // The Circle exists now. A speed failure must not leave the form open for a second create.
      const speedFailed =
        speed !== 1 &&
        (await setCircleSpeed(made.id, speed).then(
          () => false,
          () => true,
        ));
      return { ...made, speedFailed };
    },
    onSuccess: async (made) => {
      await queryClient.invalidateQueries({ queryKey: ["meanwhile"] });
      onDone(made.id, "speedFailed" in made && made.speedFailed ? S.speedFailed : undefined);
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteCircle(circle!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["meanwhile"] });
      onDone();
    },
  });

  const pickChat = (chat: ChatItem) => {
    const ids = draft.linkedChatIds.includes(chat.id)
      ? draft.linkedChatIds.filter((id) => id !== chat.id)
      : [...draft.linkedChatIds, chat.id].slice(0, 20);
    const patch: Partial<Draft> = { linkedChatIds: ids };
    const picked = (chats.data ?? []).filter((c) => ids.includes(c.id));
    const known = new Set(people.keys());
    const cast = unique(picked.flatMap((c) => idsOf(c.characterIds)))
      .filter((id) => known.size === 0 || known.has(id))
      .slice(0, MAX_CAST);
    if (!touched.cast) {
      patch.castIds = cast;
      setPool(cast);
    }
    if (!touched.name) patch.name = (picked[0]?.name ?? "").slice(0, 80);
    // Only text that already exists: the first card scenario in the cast. No model call.
    if (!touched.setting) patch.setting = cast.map((id) => people.get(id)?.scenario).find(Boolean) ?? "";
    set(patch);
  };

  const toggleCast = (id: string) => {
    setTouched((t) => ({ ...t, cast: true }));
    if (draft.castIds.includes(id)) set({ castIds: draft.castIds.filter((c) => c !== id) });
    else if (draft.castIds.length < MAX_CAST) {
      set({ castIds: [...draft.castIds, id] });
      setPool((p) => unique([...p, id]));
    }
  };

  const kinds = draft.allowedKinds.length ? draft.allowedKinds : PLAIN_KINDS;
  const toggleKind = (kind: string) => {
    const next = kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind];
    if (next.length === 0) return;
    // Empty means every plain kind, so choosing all of them stores the short form.
    const plain = PLAIN_KINDS.every((k) => next.includes(k)) && !next.includes("spicy");
    set({ allowedKinds: plain ? [] : next });
  };

  const big = draft.bigKindsAllowed.length === 0 ? "never" : draft.bigAuto ? "auto" : "ask";
  const setBig = (value: string) =>
    set({
      bigKindsAllowed: value === "never" ? [] : draft.bigKindsAllowed.length ? draft.bigKindsAllowed : BIG_KINDS,
      bigAuto: value === "auto",
    });

  const budgetOk =
    Number.isInteger(draft.budgetCallsPerDay) && draft.budgetCallsPerDay >= 1 && draft.budgetCallsPerDay <= 200;
  const reasons = [
    !editing && draft.linkedChatIds.length === 0 ? S.pickChat : "",
    !draft.name.trim() ? S.nameNeeded : !editing && draft.castIds.length === 0 ? S.castNeeded : "",
    !draft.connectionId ? S.modelNeeded : !budgetOk ? S.budgetBad : "",
  ];
  const reason = editing ? reasons[1] || reasons[2] : (reasons[step] ?? "");
  const last = editing || step === 2;

  const stepOne = (
    <section className="mw-section" aria-labelledby="mw-s1">
      {editing ? (
        <h3 className="mw-sh" id="mw-s1">
          {S.linked}
        </h3>
      ) : null}
      {!editing ? <p className="mw-muted">{S.s1Hint}</p> : null}
      {chats.data && chats.data.length === 0 ? <div className="mw-empty">{S.noChats}</div> : null}
      <div className="mw-stack">
        {(chats.data ?? []).map((chat) => {
          const on = draft.linkedChatIds.includes(chat.id);
          const ids = idsOf(chat.characterIds).filter((id) => people.has(id));
          const stamp = chat.lastMessageAt ?? chat.updatedAt;
          const when = stamp ? friendlyDay(localDay(new Date(stamp)), localDay(new Date())) : "";
          return (
            <button
              key={chat.id}
              type="button"
              className={`mw-card mw-chatcard ${on ? "mw-picked" : ""}`}
              aria-pressed={on}
              onClick={() => pickChat(chat)}
            >
              <Faces ids={ids} people={people} />
              <span className="mw-stack mw-grow">
                <b>{chat.name}</b>
                <span className="mw-muted">
                  {ids
                    .map((id) => people.get(id)!.name)
                    .slice(0, 3)
                    .join(", ")}
                  {ids.length > 3 ? `, ${ids.length - 3} more` : ""}
                  {ids.length ? " · " : ""}
                  {when ? S.lastMessage(/^(today|yesterday)$/i.test(when) ? when.toLowerCase() : when) : S.noMessages}
                </span>
              </span>
              <span className="mw-tick" aria-hidden="true">
                {on ? <Icon name="check" /> : null}
              </span>
            </button>
          );
        })}
      </div>
      {!editing ? (
        <button type="button" className="mw-linkbtn" onClick={() => setStep(1)}>
          {S.withoutChat}
        </button>
      ) : null}
    </section>
  );

  const stepTwo = (
    <section className="mw-section" aria-labelledby="mw-s2">
      {editing ? (
        <h3 className="mw-sh" id="mw-s2">
          {S.cast}
        </h3>
      ) : (
        <p className="mw-muted">{S.s2Hint}</p>
      )}
      <label className="mw-field">
        <span className="mw-label">{S.name}</span>
        <input
          className="mw-input"
          required
          maxLength={80}
          value={draft.name}
          aria-invalid={!draft.name.trim()}
          onChange={(e) => {
            setTouched((t) => ({ ...t, name: true }));
            set({ name: e.target.value });
          }}
        />
      </label>
      <div className="mw-field">
        <span className="mw-label">{S.cast}</span>
        <div className="mw-tiles">
          {pool.map((id) => {
            const on = draft.castIds.includes(id);
            return (
              <button
                key={id}
                type="button"
                className={`mw-tile ${on ? "" : "mw-tile-off"}`}
                aria-pressed={on}
                onClick={() => toggleCast(id)}
              >
                <Avatar id={id} name={people.get(id)?.name ?? "?"} url={people.get(id)?.avatarUrl} size={52} />
                <b>{people.get(id)?.name ?? "Someone"}</b>
              </button>
            );
          })}
          <button
            type="button"
            className="mw-tile mw-tile-add"
            aria-expanded={adding}
            onClick={() => setAdding(!adding)}
          >
            <span className="mw-plus">
              <Icon name="plus" />
            </span>
            <b>{S.add}</b>
          </button>
        </div>
        {pool.length === 0 ? <span className="mw-muted">{S.noCast}</span> : null}
      </div>
      {adding ? (
        <div className="mw-card">
          <b>{S.addTitle}</b>
          <input
            className="mw-input"
            type="search"
            placeholder={S.search}
            aria-label={S.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mw-picklist">
            {(characters.data ?? [])
              .filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
              .map((c) => {
                const on = draft.castIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="mw-pickrow"
                    aria-pressed={on}
                    disabled={!on && draft.castIds.length >= MAX_CAST}
                    onClick={() => toggleCast(c.id)}
                  >
                    <Avatar id={c.id} name={c.name} url={c.avatarUrl} size={32} />
                    <span className="mw-grow">{c.name}</span>
                    <span className="mw-tick" aria-hidden="true">
                      {on ? <Icon name="check" /> : null}
                    </span>
                  </button>
                );
              })}
            {characters.data &&
            !characters.data.some((c) => c.name.toLowerCase().includes(search.trim().toLowerCase())) ? (
              <div className="mw-muted">{S.nothingFound}</div>
            ) : null}
          </div>
          {draft.castIds.length >= MAX_CAST ? <span className="mw-muted">{S.castFull}</span> : null}
          <button type="button" className="mw-btn" onClick={() => setAdding(false)}>
            {S.done}
          </button>
        </div>
      ) : null}
      <label className="mw-field">
        <span className="mw-label">{S.setting}</span>
        <textarea
          className="mw-input"
          rows={4}
          maxLength={600}
          placeholder={COPY.settingPlaceholder}
          value={draft.setting}
          onChange={(e) => {
            setTouched((t) => ({ ...t, setting: true }));
            set({ setting: e.target.value });
          }}
        />
      </label>
      <Choices
        label={S.world}
        value={shared ? "shared" : "separate"}
        onChange={(value) => {
          setTouched((t) => ({ ...t, shared: true }));
          set({ sharedWorld: value === "shared" });
        }}
        options={[
          { value: "shared", title: S.shared[0]!, hint: S.shared[1] },
          { value: "separate", title: S.separate[0]!, hint: S.separate[1] },
        ]}
        columns={2}
      />
    </section>
  );

  const stepThree = (
    <section className="mw-section" aria-labelledby="mw-s3">
      {editing ? (
        <h3 className="mw-sh" id="mw-s3">
          {S.s3}
        </h3>
      ) : (
        <p className="mw-muted">{S.s3Hint}</p>
      )}
      <Choices
        label={S.pace}
        value={draft.pace}
        onChange={(value) => set({ pace: value as Circle["pace"] })}
        options={PACES.map((pace) => ({ value: pace, title: S.paces[pace]![0], hint: S.paces[pace]![1] }))}
        columns={3}
      />
      <div className="mw-field">
        <span className="mw-label">{S.model}</span>
        <div className="mw-stack" role="group" aria-label={S.model}>
          {(connections.data ?? []).map((c) => {
            const on = draft.connectionId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                className={`mw-card mw-modelcard ${on ? "mw-picked" : ""}`}
                aria-pressed={on}
                onClick={() => set({ connectionId: c.id })}
              >
                <b className="mw-grow">{c.name}</b>
                {CHEAP.test(`${c.name} ${c.model ?? ""}`) ? <span className="mw-tag">{S.cheap}</span> : null}
                <span className="mw-tick" aria-hidden="true">
                  {on ? <Icon name="check" /> : null}
                </span>
              </button>
            );
          })}
        </div>
        {connections.data && connections.data.length === 0 ? <span className="mw-warn">{S.noModels}</span> : null}
        {draft.connectionId && connections.data && !connections.data.some((c) => c.id === draft.connectionId) ? (
          <span className="mw-warn">{S.modelNeeded}</span>
        ) : null}
      </div>
      <Choices
        label={S.big}
        value={big}
        onChange={setBig}
        options={[
          { value: "ask", title: S.bigAsk[0]!, hint: S.bigAsk[1] },
          { value: "auto", title: S.bigAuto[0]!, hint: S.bigAuto[1] },
          { value: "never", title: S.bigNever[0]!, hint: S.bigNever[1] },
        ]}
      />
      <div className="mw-field">
        <span className="mw-label">{S.kinds}</span>
        <div className="mw-chips mw-wrapchips" role="group" aria-label={S.kinds}>
          {/* ponytail: the Engine has no adult setting this package can read, so spicy is only listed for a Circle that already has it on, to turn it off. */}
          {[...PLAIN_KINDS, ...(draft.allowedKinds.includes("spicy") ? ["spicy"] : [])].map((kind) => (
            <button
              key={kind}
              type="button"
              className={`mw-chip ${kinds.includes(kind) ? "mw-chip-on" : ""}`}
              aria-pressed={kinds.includes(kind)}
              onClick={() => toggleKind(kind)}
            >
              {kindLabel(kind)}
            </button>
          ))}
        </div>
      </div>
      <details className="mw-details mw-card">
        <summary className="mw-sh">{S.advanced}</summary>
        <div className="mw-field">
          {circle ? (
            <ClockControls
              circle={circle}
              onChanged={() => void queryClient.invalidateQueries({ queryKey: ["meanwhile"] })}
            />
          ) : (
            <Choices
              label={S.speed}
              value={String(speed)}
              onChange={(value) => setSpeed(Number(value))}
              options={[0, 1, 24].map((value, index) => ({ value: String(value), title: S.speedWords[index]! }))}
              columns={3}
            />
          )}
          <label className="mw-field">
            <span className="mw-label">{S.timezone}</span>
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
          <label className="mw-field">
            <span className="mw-label">{S.budget}</span>
            <input
              className="mw-input"
              type="number"
              min={1}
              max={200}
              step={1}
              value={draft.budgetCallsPerDay}
              aria-invalid={!budgetOk}
              onChange={(e) => set({ budgetCallsPerDay: Number(e.target.value) })}
            />
          </label>
          <label className="mw-check">
            <input
              type="checkbox"
              checked={draft.backgroundTimer}
              onChange={(e) => set({ backgroundTimer: e.target.checked })}
            />
            <span>{S.background}</span>
          </label>
          <label className="mw-check">
            <input
              type="checkbox"
              aria-describedby="mw-status-explain"
              checked={draft.writeStatus}
              onChange={(e) => set({ writeStatus: e.target.checked })}
            />
            <span>{COPY.statusSwitch}</span>
          </label>
          <div id="mw-status-explain" className="mw-muted">
            {COPY.statusExplain}
          </div>
          <label className="mw-check">
            <input
              type="checkbox"
              aria-describedby="mw-surprise-explain"
              checked={draft.surprise}
              onChange={(e) => set({ surprise: e.target.checked })}
            />
            <span>{COPY.surpriseSwitch}</span>
          </label>
          <div id="mw-surprise-explain" className="mw-muted">
            {COPY.surpriseExplain}
          </div>
          {circle?.statusElsewhere.map((s) => (
            <div key={s.characterId} className="mw-warn">
              {COPY.statusElsewhere(people.get(s.characterId)?.name ?? "Someone", s.circle, s.note)}
            </div>
          ))}
        </div>
      </details>
    </section>
  );

  const title = editing ? S.editTitle : [S.s1, S.s2, S.s3][step]!;
  return (
    <div
      className="mw-setup"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={box}
        className="mw-setup-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mw-setup-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
      >
        <div className="mw-setup-head">
          {!editing ? (
            <div className="mw-steps" role="img" aria-label={S.step(step + 1)}>
              {[0, 1, 2].map((n) => (
                <span key={n} className={n <= step ? "mw-step-on" : ""} />
              ))}
            </div>
          ) : null}
          <div className="mw-row">
            <h2 className="mw-title mw-grow" id="mw-setup-title" tabIndex={-1} ref={heading}>
              {title}
            </h2>
            <button type="button" className="mw-btn mw-btn-sm" onClick={close}>
              {S.close}
            </button>
          </div>
        </div>
        <form
          className="mw-setup-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (last && !reason) save.mutate();
          }}
        >
          <div className="mw-setup-body">
            {editing ? (
              <>
                {stepOne}
                {stepTwo}
                {stepThree}
                <div className="mw-section">
                  <button
                    type="button"
                    className="mw-btn mw-warn"
                    disabled={remove.isPending}
                    onClick={() => window.confirm(S.confirmRemove) && remove.mutate()}
                  >
                    {S.remove}
                  </button>
                </div>
              </>
            ) : step === 0 ? (
              stepOne
            ) : step === 1 ? (
              stepTwo
            ) : (
              stepThree
            )}
          </div>
          <div className="mw-setup-foot">
            {reason ? (
              <p className="mw-reason" id="mw-reason" role="status">
                {reason}
              </p>
            ) : null}
            {save.isError || remove.isError ? (
              <span role="alert" className="mw-warn">
                {errorText(save.error ?? remove.error)}
              </span>
            ) : null}
            <div className="mw-row mw-foot-row">
              {editing ? (
                <button type="button" className="mw-btn" onClick={close}>
                  {S.cancel}
                </button>
              ) : (
                <button type="button" className="mw-btn" onClick={() => (step === 0 ? close() : setStep(step - 1))}>
                  {step === 0 ? S.cancel : S.back}
                </button>
              )}
              {last ? (
                <button
                  type="submit"
                  className="mw-btn mw-btn-primary mw-grow"
                  disabled={save.isPending || !!reason}
                  aria-describedby={reason ? "mw-reason" : undefined}
                >
                  {save.isPending ? S.saving : editing ? S.save : S.start}
                </button>
              ) : (
                <button
                  type="button"
                  className="mw-btn mw-btn-primary mw-grow"
                  disabled={!!reason}
                  aria-describedby={reason ? "mw-reason" : undefined}
                  onClick={() => setStep(step + 1)}
                >
                  {S.next}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
