import { z } from "zod";
import { SLP_EXPLICIT_LEVELS, type SlpExplicitLevelName } from "./slp-spice.js";
import { slurpMemberActivityWeight } from "./slp-population.js";

/**
 * Live shows (docs: ~/.cache/slurp-audit/LIVE-V3-PLAN.md). A show runs in the world whether or not the
 * player watches: while nobody watches, code moves it forward one minute at a time with no model call.
 * Everything here is pure and seeded, so the same show replays the same way.
 */

export const slpLiveSettingsSchema = z.object({
  /** How often an active Creator goes live, in days between shows. */
  everyDays: z.number().min(0.25).max(14).default(1.5),
  minMinutes: z.number().int().min(10).max(240).default(30),
  maxMinutes: z.number().int().min(10).max(240).default(60),
  /** How much show one model call writes while the player watches. */
  beatLength: z.enum(["short", "normal", "long"]).default("normal"),
  pictureSeconds: z.number().int().min(20).max(600).default(60),
  pictureMax: z.number().int().min(0).max(60).default(20),
  privateMinutes: z.number().int().min(5).max(30).default(10),
  privatePrice: z.number().int().min(10).max(99_999).default(300),
  connectionId: z.string().nullable().default(null),
});
export type SlpLiveSettings = z.infer<typeof slpLiveSettingsSchema>;
export const SLP_DEFAULT_LIVE_SETTINGS: SlpLiveSettings = slpLiveSettingsSchema.parse({});

export function normalizeSlpLiveSettings(raw: unknown): SlpLiveSettings {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(slpLiveSettingsSchema.shape)) {
    const parsed = (field as z.ZodTypeAny).safeParse(value[key]);
    out[key] = parsed.success ? parsed.data : (SLP_DEFAULT_LIVE_SETTINGS as Record<string, unknown>)[key];
  }
  const settings = out as SlpLiveSettings;
  return settings.maxMinutes < settings.minMinutes ? { ...settings, maxMinutes: settings.minMinutes } : settings;
}

/** The settings field: a bad or older value keeps the default for each field it gets wrong. */
export const slpLiveSettingsField = z.preprocess(normalizeSlpLiveSettings, slpLiveSettingsSchema);

/** What a viewer can tip for. `strip` items take one layer off; `level` is the least spice the Creator must allow. */
export const SLP_LIVE_MENU = [
  { id: "shoutout", price: 15, level: "none" },
  { id: "song", price: 25, level: "none" },
  { id: "dance", price: 40, level: "none" },
  { id: "pose", price: 50, level: "none" },
  { id: "outfit", price: 80, level: "none" },
  { id: "closeUp", price: 60, level: "suggestive" },
  { id: "layer", price: 120, level: "suggestive", strip: true },
  { id: "flash", price: 200, level: "nudity" },
  { id: "toy", price: 350, level: "explicit" },
] as const satisfies ReadonlyArray<{ id: string; price: number; level: SlpExplicitLevelName; strip?: boolean }>;
export type SlpLiveMenuId = (typeof SLP_LIVE_MENU)[number]["id"];

/** Layers a show can take off at each spice level: dressed, down to underwear, nude. */
const STRIP_MAX: Record<SlpExplicitLevelName, number> = { none: 0, suggestive: 2, nudity: 3, explicit: 3 };

export type SlpLiveMenuItem = {
  id: string;
  price: number;
  strip?: boolean;
  /** Model-made items only. */ label?: string;
};
export type SlpLiveGoal = { reward: string; target: number; hitAt: number | null };
export type SlpLiveOrder = { id: string; itemId: string; by: string; name: string; at: number; doneAt: number | null };
export type SlpLiveEvent = {
  /** Milliseconds since the show started. */
  at: number;
  kind: "join" | "leave" | "tip" | "order" | "goal" | "done" | "strip" | "say" | "chat" | "you" | "private" | "cam";
  by?: string;
  name?: string;
  amount?: number;
  itemId?: string;
  /** Talk (`say` the Creator, `chat` a fan, `you` the player): the words, and the Creator's action. `cam`: what the webcam shows. */
  text?: string;
  action?: string;
};
export type SlpLiveFan = {
  id: string;
  name: string;
  activeHour: number;
  tipChance: number;
  /** Biggest single tip. */ maxTip: number;
};
export type SlpLiveState = {
  raised: number;
  /** 0–100: how hot the room is. Tips and time raise it. */
  heat: number;
  strip: number;
  stripMax: number;
  goals: SlpLiveGoal[];
  menu: SlpLiveMenuItem[];
  queue: SlpLiveOrder[];
  /** Named fans in the room now. */
  room: string[];
  names: Record<string, string>;
  tippers: Record<string, number>;
  /** Minutes before this (in ms since start) are simulated. */
  simulatedTo: number;
  log: SlpLiveEvent[];
  /** Request ids of the player's paid tips already booked, so a retry never books twice. */
  receipts: string[];
  /** Where the show happens now, set by a beat ("on the bed"). */
  place?: string;
  /** Milliseconds since the start where the last written beat runs out. */
  beatTo?: number;
  /** Live pictures, oldest first: when each one landed and its staged media path (never sent to clients). */
  pictures?: { at: number; path: string }[];
  /** When the last picture was asked for. */
  pictureAt?: number;
  /** When the picture being made now was asked for; null when none is. */
  shooting?: number | null;
  /** The paid private block (ms since start): only the payer and the Creator, the room waits outside. */
  private?: { by: string; name: string; from: number; to: number } | null;
  /** The player's persona that hosts this show (hostKind "player"): it writes the host's lines. */
  hostPersona?: string;
  /** Three moves the model suggests to the hosting player for what to say or do next. */
  next?: string[];
};

/** A private block runs at `at`. */
export const slpLivePrivateOn = (state: SlpLiveState, at: number) =>
  !!state.private && state.private.from <= at && at < state.private.to;
export type SlpLiveTip = { by: string; name: string; amount: number; itemId?: string };

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const LOG_MAX = 400;
const ROOM_MAX = 60;
/** An order on stage takes this long before the next one starts. */
export const SLP_LIVE_ORDER_MS = 2 * MINUTE;

export function slpLiveUnit(seed: string): number {
  let out = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    out ^= seed.charCodeAt(index);
    out = Math.imul(out, 0x01000193);
  }
  return (out >>> 0) / 0x100000000;
}

const levelRank = (level: SlpExplicitLevelName) => SLP_EXPLICIT_LEVELS.indexOf(level);

export function slpLiveMenuFor(level: SlpExplicitLevelName, priceScale = 1): SlpLiveMenuItem[] {
  return SLP_LIVE_MENU.filter((item) => levelRank(item.level) <= levelRank(level)).map((item) => ({
    id: item.id,
    price: Math.max(5, Math.round(item.price * priceScale)),
    ...("strip" in item ? { strip: true } : {}),
  }));
}

/** A fresh show: the menu the Creator allows, and three goals that grow, each rewarding a menu item for free. */
export function slpLiveStart(input: { level: SlpExplicitLevelName; fans: number; priceScale?: number }): SlpLiveState {
  const menu = slpLiveMenuFor(input.level, input.priceScale);
  const base = Math.round((200 + Math.min(input.fans, 200) * 4) * (input.priceScale ?? 1));
  const pricey = [...menu].sort((a, b) => b.price - a.price);
  const rewards = [pricey[Math.min(2, pricey.length - 1)], pricey[Math.min(1, pricey.length - 1)], pricey[0]];
  return {
    raised: 0,
    heat: 10,
    strip: 0,
    stripMax: STRIP_MAX[input.level],
    goals: rewards.map((item, index) => ({
      reward: item.id,
      target: Math.round(base * [1, 2.2, 4][index]),
      hitAt: null,
    })),
    menu,
    queue: [],
    room: [],
    names: {},
    tippers: {},
    simulatedTo: 0,
    log: [],
    receipts: [],
  };
}

export function slpLiveLog(state: SlpLiveState, event: SlpLiveEvent) {
  state.log.push(event);
  if (state.log.length > LOG_MAX) state.log.splice(0, state.log.length - LOG_MAX);
}

/** The goal being worked on now, or null when all three are hit. */
export function slpLiveCurrentGoal(state: SlpLiveState): SlpLiveGoal | null {
  return state.goals.find((goal) => goal.hitAt === null) ?? null;
}

export function slpLiveTopTipper(state: SlpLiveState): { by: string; name: string; amount: number } | null {
  const [by, amount] = Object.entries(state.tippers).sort((a, b) => b[1] - a[1])[0] ?? [];
  return by ? { by, name: state.names[by] ?? by, amount: amount! } : null;
}

/** Book one paid tip (a fan's or the player's) into the show. Mutates `state`; false when `receipt` was booked before. */
export function slpLiveApplyTip(state: SlpLiveState, tip: SlpLiveTip, at: number, receipt?: string): boolean {
  if (receipt) {
    if (state.receipts.includes(receipt)) return false;
    state.receipts = [...state.receipts, receipt].slice(-200);
  }
  state.raised += tip.amount;
  state.names[tip.by] = tip.name;
  state.tippers[tip.by] = (state.tippers[tip.by] ?? 0) + tip.amount;
  const goal = slpLiveCurrentGoal(state);
  state.heat = Math.min(
    100,
    state.heat + Math.max(1, Math.round((tip.amount / Math.max(1, goal?.target ?? 500)) * 30)),
  );
  const item = tip.itemId ? state.menu.find((entry) => entry.id === tip.itemId) : undefined;
  if (item && tip.amount >= item.price) {
    state.queue.push({ id: `${tip.by}:${at}`, itemId: item.id, by: tip.by, name: tip.name, at, doneAt: null });
    slpLiveLog(state, { at, kind: "order", by: tip.by, name: tip.name, amount: tip.amount, itemId: item.id });
  } else slpLiveLog(state, { at, kind: "tip", by: tip.by, name: tip.name, amount: tip.amount });
  for (const next of state.goals) {
    if (next.hitAt !== null || state.raised < next.target) continue;
    next.hitAt = at;
    state.heat = Math.min(100, state.heat + 10);
    state.queue.push({ id: `goal:${next.target}`, itemId: next.reward, by: "goal", name: "", at, doneAt: null });
    slpLiveLog(state, { at, kind: "goal", amount: next.target, itemId: next.reward });
  }
  return true;
}

/** Finish the order on stage once it has had its time, then start the next. Mutates `state`. */
export function slpLiveWorkQueue(state: SlpLiveState, at: number): void {
  const open = state.queue.filter((order) => order.doneAt === null);
  const lastDone = Math.max(0, ...state.queue.map((order) => order.doneAt ?? 0));
  const first = open[0];
  if (!first || at - Math.max(first.at, lastDone) < SLP_LIVE_ORDER_MS) return;
  first.doneAt = at;
  slpLiveLog(state, { at, kind: "done", by: first.by, name: first.name, itemId: first.itemId });
  const item = state.menu.find((entry) => entry.id === first.itemId);
  if (item?.strip && state.strip < state.stripMax) {
    state.strip += 1;
    state.heat = Math.min(100, state.heat + 8);
    slpLiveLog(state, { at, kind: "strip", amount: state.strip });
  }
  if (state.queue.length > 40)
    state.queue = state.queue.filter((order) => order.doneAt === null || at - order.doneAt < 30 * MINUTE);
}

/**
 * One world minute of the room: fans join and leave by their active hour and the heat, and those in the room
 * may tip. Returns the tips the fans want to make; the caller books each one only if the fan's weekly budget
 * allows it (`slpLiveApplyTip`). Mutates the room in `state`.
 */
export function slpLiveMinute(
  state: SlpLiveState,
  fans: readonly SlpLiveFan[],
  input: { showId: string; minute: number; hour: number },
): SlpLiveTip[] {
  const at = input.minute * MINUTE;
  const seed = `${input.showId}:${input.minute}`;
  const inRoom = new Set(state.room);
  const pull = 0.5 + state.heat / 100;
  // The go-live notice pulls the room in during the first two minutes.
  const opening = input.minute < 2 ? 4 : 1;
  // While the show is private the room only sees "in private": nobody joins or tips, and fans drift off.
  const away = slpLivePrivateOn(state, at);
  // A fan who is no longer in the population (lapsed, removed) must not stay in the room for good.
  const known = new Set(fans.map((fan) => fan.id));
  for (const id of [...inRoom]) {
    if (known.has(id)) continue;
    inRoom.delete(id);
    slpLiveLog(state, { at, kind: "leave", by: id, name: state.names[id] ?? "" });
  }
  for (const fan of fans) {
    const roll = slpLiveUnit(`${seed}:${fan.id}:room`);
    if (inRoom.has(fan.id)) {
      if (roll < (away ? 0.2 : 0.06 / pull)) {
        inRoom.delete(fan.id);
        slpLiveLog(state, { at, kind: "leave", by: fan.id, name: fan.name });
      }
    } else if (
      !away &&
      inRoom.size < ROOM_MAX &&
      roll < slurpMemberActivityWeight(fan.activeHour, input.hour) * 0.12 * pull * opening
    ) {
      inRoom.add(fan.id);
      state.names[fan.id] = fan.name;
      slpLiveLog(state, { at, kind: "join", by: fan.id, name: fan.name });
    }
  }
  // Somebody always answers the go-live notice, so the model never writes for an empty room.
  const first = fans[0];
  if (!away && inRoom.size === 0 && first) {
    inRoom.add(first.id);
    state.names[first.id] = first.name;
    slpLiveLog(state, { at, kind: "join", by: first.id, name: first.name });
  }
  state.room = [...inRoom];
  state.heat = Math.min(100, state.heat + 0.5);
  const tips: SlpLiveTip[] = [];
  if (away) return tips;
  for (const fan of fans) {
    if (!inRoom.has(fan.id) || slpLiveUnit(`${seed}:${fan.id}:tip`) >= fan.tipChance * 0.3 * pull) continue;
    const size = slpLiveUnit(`${seed}:${fan.id}:amount`);
    const amount = Math.max(5, Math.round((fan.maxTip * size * size) / 5) * 5);
    const affordable = state.menu.filter((item) => item.price <= amount);
    const item =
      affordable.length && slpLiveUnit(`${seed}:${fan.id}:order`) < 0.4
        ? affordable[Math.floor(slpLiveUnit(`${seed}:${fan.id}:pick`) * affordable.length)]
        : undefined;
    tips.push({ by: fan.id, name: fan.name, amount, ...(item ? { itemId: item.id } : {}) });
  }
  return tips;
}

/** Viewer count shown in the room: the named fans plus the lurkers who never type. */
export function slpLiveViewers(state: SlpLiveState, showId: string): number {
  return state.room.length * 3 + Math.round(slpLiveUnit(`${showId}:lurkers`) * 12) + (state.room.length ? 2 : 0);
}

/** Where a Creator's shows fall: one per `everyDays` slot, at a seeded time inside the slot. */
export function slurpLiveSlot(hostId: string, live: SlpLiveSettings, at: number) {
  const slotMs = live.everyDays * DAY;
  const slot = Math.floor(at / slotMs);
  const startAt = Math.floor(slot * slotMs + slpLiveUnit(`${hostId}:${slot}:start`) * slotMs);
  const minutes = Math.round(
    live.minMinutes + slpLiveUnit(`${hostId}:${slot}:length`) * (live.maxMinutes - live.minMinutes),
  );
  return { id: `live:${hostId}:${slot}`, startAt, endsAt: startAt + minutes * MINUTE };
}

/** A picture is being made; after 3 minutes it counts as lost (a failed or restarted server). */
export const slpLiveShooting = (state: SlpLiveState, at: number) =>
  state.shooting !== undefined && state.shooting !== null && at - state.shooting < 3 * 60_000;

function slpLivePrivateView(state: SlpLiveState, elapsed: number, me: string | null) {
  return state.private && slpLivePrivateOn(state, elapsed)
    ? { mine: state.private.by === me, to: state.private.to }
    : null;
}

function slpLivePictureView(state: SlpLiveState, elapsed: number) {
  const pictures = state.pictures ?? [];
  const n = pictures.findLastIndex((picture) => picture.at <= elapsed);
  return n < 0 ? null : { n, at: pictures[n]!.at };
}

/** What a viewer's screen gets: the show without the bookkeeping. `me` is the viewer's tipper key. */
export function slpLiveView(
  show: {
    id: string;
    hostId: string;
    hostKind: string;
    startedAt: string;
    endsAt: string;
    endedAt: string | null;
    state: SlpLiveState;
  },
  now: number,
  me: string | null,
  /** Backstage live settings, for the private offer (price and minutes). */
  live?: Pick<SlpLiveSettings, "privatePrice" | "privateMinutes">,
) {
  const { state } = show;
  return {
    id: show.id,
    hostId: show.hostId,
    hostKind: show.hostKind,
    startedAt: show.startedAt,
    endsAt: show.endsAt,
    endedAt: show.endedAt,
    elapsed: Math.max(0, now - Date.parse(show.startedAt)),
    viewers: slpLiveViewers(state, show.id),
    raised: state.raised,
    heat: Math.round(state.heat),
    strip: state.strip,
    stripMax: state.stripMax,
    goals: state.goals,
    menu: state.menu,
    queue: state.queue
      .filter((order) => order.doneAt === null || state.simulatedTo - order.doneAt < 10 * MINUTE)
      .slice(-12),
    // A beat's lines are stored ahead of time; the room hears each one when its moment comes.
    log: state.log
      .filter((event) => event.at <= Math.max(0, now - Date.parse(show.startedAt)))
      .sort((a, b) => a.at - b.at)
      .slice(-80),
    beatTo: state.beatTo ?? 0,
    // Only the newest landed picture, by number; the media path stays on the server.
    picture: slpLivePictureView(state, Math.max(0, now - Date.parse(show.startedAt))),
    // The hosting player gets the suggestions; viewers never see them.
    hosting: !!state.hostPersona && me === `persona:${state.hostPersona}`,
    next: state.hostPersona && me === `persona:${state.hostPersona}` ? (state.next ?? []) : [],
    offer: live ? { price: live.privatePrice, minutes: live.privateMinutes } : null,
    private: slpLivePrivateView(state, Math.max(0, now - Date.parse(show.startedAt)), me),
    shooting: slpLiveShooting(state, Math.max(0, now - Date.parse(show.startedAt))),
    top: slpLiveTopTipper(state),
    mine: me ? (state.tippers[me] ?? 0) : 0,
  };
}
export type SlpLiveView = ReturnType<typeof slpLiveView>;

const LIVE_DONE_WORDS: Record<string, string> = {
  shoutout: "shoutouts",
  song: "a song",
  dance: "a dance",
  pose: "poses",
  outfit: "an outfit change",
  closeUp: "close-ups",
  layer: "layers coming off",
  flash: "a flash",
  toy: "the toy",
};

/** The Creator's thank-you post after a show, written by code from the show's own numbers. */
export function slpLiveSummaryText(showId: string, state: SlpLiveState): string {
  // Built from what happened in this show, so two shows never post the same recap (prod: two
  // Creators posted one identical line).
  const seed = [...showId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const pick = <T>(list: readonly T[], salt: number) => list[(seed + salt) % list.length]!;
  const place = state.place ? ` from ${state.place}` : "";
  const done = [...new Set(state.queue.filter((order) => order.doneAt !== null).map((order) => order.itemId))]
    .map((id) => LIVE_DONE_WORDS[id])
    .filter(Boolean)
    .slice(0, 3);
  const tippers = Object.keys(state.tippers).length;
  const goals = state.goals.filter((goal) => goal.hitAt !== null).length;
  const top = slpLiveTopTipper(state);
  return [
    pick(
      ["Live" + place + " is over.", "That's a wrap on tonight's live" + place + ".", "Back offline" + place + "."],
      0,
    ),
    done.length ? `You got ${done.join(", ")}.` : "",
    goals ? `${goals} of ${state.goals.length} goals hit.` : "",
    state.raised ? `${state.raised} coins from ${tippers} ${tippers === 1 ? "tipper" : "tippers"}.` : "",
    top
      ? pick([`${top.name}, you spoiled me.`, `Biggest tips from ${top.name} 👑`, `${top.name} carried the room.`], 1)
      : "",
    pick(["See you next time 💋", "Same time again? 👀", "Thank you, chat ✨"], 2),
  ]
    .filter(Boolean)
    .join(" ");
}
