// ──────────────────────────────────────────────
// Big Cheese: your cast (cast.md, M1). The player's persona can be the boss and up to 3 Engine cards
// can replace staff when a run starts. Everything is read-only on Engine data. The run keeps a snapshot
// of what it read, so a changed or deleted card never breaks a run.
// ──────────────────────────────────────────────
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import { z } from "zod";
import { engineModel, runTask } from "./ai/tasks.js";
import type { PlaceKit } from "./core/kits/types.js";
import { dayIndex } from "./core/index.js";
import { HOME_ROLES, STORY_ROLES, openStoryRole } from "./core/storyteller.js";
import { dial } from "./core/layers.js";
import type { Clock, Person, Run as Game } from "./core/types.js";
import { TRAITS } from "./core/traits.js";
import { BigCheeseError, type Run, type RunStore } from "./store.js";
import { KITS, placeKitOf } from "./core/kits/index.js";

export interface CastPerson {
  engineId: string;
  /** Only when the card states it (cast.md §3); later layers that need an adult check read it. */
  age?: number;
  name: string;
  core: string;
  traits: string[];
  tone: string;
  lines: string[];
  avatar: string;
  /** A hired person or visitor: the role they were taken on for. */
  role?: string;
  /** A visitor: the day number (core dayIndex) they leave on. */
  until?: number;
}
export interface Cast {
  boss?: { engineId: string; name: string; about: string; avatar: string };
  people: Record<string, CastPerson>; // by the kit person they replace
  /** Edits to the kit's systems, by position: rename or remove. */
  systems?: SystemEdit[];
}

// ponytail: the Engine's PROFESSOR_MARI_ID. The server bundle may not import Engine modules, so update this if the Engine renames her.
const MARI_ID = "__professor_mari__";
const MAX_LIST = 200;

/** What the player may edit on the casting sheet. Every field is capped here, at the route boundary. */
const Sheet = z.object({
  role: z.string().trim().max(60),
  traits: z
    .array(z.enum(TRAITS))
    .min(1)
    .max(2)
    .refine((t) => new Set(t).size === t.length, "Pick two different traits."),
  tone: z.string().trim().max(40),
  lines: z.array(z.string().trim().min(1).max(160)).min(1).max(3),
  core: z.string().trim().max(500),
});

export const ReadBody = z.object({
  kitId: z.string().max(40),
  characterId: z.string().min(1).max(80),
  lite: z.boolean().optional(),
});

const SystemEdits = z
  .array(
    z
      .object({
        index: z.number().int().min(0).max(20),
        name: z.string().trim().min(1).max(40).optional(),
        remove: z.literal(true).optional(),
      })
      .refine((e) => e.name !== undefined || e.remove, "Rename or remove."),
  )
  .max(8);
export type SystemEdit = z.infer<typeof SystemEdits>[number];

/** The cast part of POST /runs. */
export const CastRequest = z.object({
  boss: z.string().min(1).max(80).optional(),
  staff: z
    .array(z.object({ characterId: z.string().min(1).max(80), replaces: z.string().max(40).optional(), sheet: Sheet }))
    .max(3)
    .optional(),
  systems: SystemEdits.optional(),
});

const bad = (message: string) => new BigCheeseError(400, message, "bad-request");
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
/** One trimmed line of text, cut to `max`. */
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
/** The Engine serves only its own paths, so a model or card cannot point the client at another site. */
const avatarOf = (v: unknown) => {
  const path = typeof v === "string" ? v.trim() : "";
  return path.length <= 300 && /^\/(?!\/)/.test(path) && !/[\\?#%]|\.\./.test(path) ? path : "";
};

/** A card's or persona's fields. The Engine stores a JSON string, and a V2 card nests them under `data`. */
function fields(raw: unknown): Record<string, unknown> {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return {};
    }
  }
  return isRecord(v) ? (isRecord(v.data) ? { ...v, ...v.data } : v) : {};
}

const placeKit = (kitId: string): PlaceKit => {
  if (!Object.hasOwn(KITS, kitId)) throw bad("Unknown place.");
  return placeKitOf({ kitId });
};

/** The lowest age the card states, from plain phrases like "34 years old", "age: 34" or "aged 34". */
export function statedAge(d: Record<string, unknown>): number | undefined {
  const ext = isRecord(d.extensions) ? d.extensions : {};
  const text = [d.description, d.personality, d.scenario, d.backstory, ext.backstory, d.first_mes]
    .map((v) => (typeof v === "string" ? v.slice(0, 5000) : ""))
    .join(" ");
  const ages = [
    ...text.matchAll(/\b(\d{1,3})[- ]?(?:years?[- ]old|y\/?o)\b/gi),
    ...text.matchAll(/\b(?:age[d:]?|aged)\s*:?\s*(\d{1,3})\b/gi),
  ].map((m) => Number(m[1]));
  return ages.length ? Math.min(...ages) : undefined;
}

/** Big Cheese casts adults only: a card that states an age under 18 is refused. */
const UNDER_AGE = /\b(minor|underage|under-age|loli|shota)\b/i;
function checkAge(d: Record<string, unknown>) {
  const age = statedAge(d);
  const tags = Array.isArray(d.tags) ? d.tags.filter((x): x is string => typeof x === "string") : [];
  if ((age !== undefined && age < 18) || tags.some((x) => UNDER_AGE.test(x))) {
    throw new BigCheeseError(400, "This card is under 18. Big Cheese casts adults only.", "under-age");
  }
  return age;
}

/** One card or persona, read only when the player picks it. Professor Mari is never cast. */
async function readOne(runtime: CapabilityRuntimeHost, kind: "character" | "persona", id: string) {
  if (id === MARI_ID) throw bad("Professor Mari cannot join the cast.");
  const { resources } = runtime;
  const [record] = await (kind === "persona" ? resources.listPersonas([id]) : resources.listCharacters([id]));
  if (!record) throw new BigCheeseError(404, "No such card.", "not-found");
  return fields(record.data);
}

/** The picker lists: id, name, a short line and an avatar path. No full cards reach the client. */
export async function listCast(runtime: CapabilityRuntimeHost) {
  const { resources } = runtime;
  const [cards, personas] = await Promise.all([resources.listCharacters(), resources.listPersonas()]);
  const items = (records: { id: string; data: unknown }[]) =>
    records
      .filter((r) => r.id !== MARI_ID)
      .map((r) => {
        const d = fields(r.data);
        return {
          id: r.id,
          name: str(d.name, 80),
          line: str(d.description || d.personality, 120),
          avatar: avatarOf(d.avatarPath),
        };
      })
      .filter((item) => item.name)
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, MAX_LIST);
  return { characters: items(cards), personas: items(personas), traits: TRAITS };
}

/** cast.read for one picked card: the casting sheet plus the roles the player can fill. */
export async function castRead(runtime: CapabilityRuntimeHost, body: z.infer<typeof ReadBody>) {
  const kit = placeKit(body.kitId);
  const d = await readOne(runtime, "character", body.characterId);
  checkAge(d);
  const slots = kit.people.filter((p) => !p.deputy).map((p) => ({ id: p.id, role: p.role, name: p.name }));
  const model = body.lite ? undefined : await engineModel(runtime, null).catch(() => undefined);
  // ponytail: each card field is cut to 1500 characters, not summarized. Summarize first when long cards cost too much.
  const cut = (v: unknown) => str(v, 1500);
  const ext = isRecord(d.extensions) ? d.extensions : {};
  const { output } = await runTask(
    "cast.read",
    {
      kit,
      roles: slots.map((s) => s.role),
      card: {
        name: str(d.name, 80),
        description: cut(d.description),
        personality: cut(d.personality),
        scenario: cut(d.scenario),
        backstory: cut(ext.backstory || d.backstory),
        tags: Array.isArray(d.tags)
          ? d.tags
              .slice(0, 10)
              .map((t) => str(t, 30))
              .filter(Boolean)
          : [],
      },
    },
    { model },
  );
  const { roleFit, ...rest } = output;
  return {
    card: { id: body.characterId, name: str(d.name, 80), avatar: avatarOf(d.avatarPath) },
    slots,
    sheet: { ...rest, role: roleFit[0] ?? slots[0]?.role ?? "" },
  };
}

/** Reads the picked cards again and builds the run's cast. The names come from the Engine, never from the client. */
export async function resolveCast(runtime: CapabilityRuntimeHost, kitId: string, req: z.infer<typeof CastRequest>) {
  if (!req.boss && !req.staff?.length && !req.systems?.length) return undefined;
  const kit = placeKit(kitId);
  const cast: Cast = { people: {} };
  if (req.boss) {
    const d = await readOne(runtime, "persona", req.boss);
    checkAge(d);
    const name = str(d.name, 80);
    if (!name) throw bad("This persona has no name.");
    // ponytail: the boss text is the first 400 characters of the description, not a summary. Summarize when it reads badly.
    cast.boss = { engineId: req.boss, name, about: str(d.description, 400), avatar: avatarOf(d.avatarPath) };
  }
  const used = new Set<string>();
  for (const { characterId, replaces, sheet } of req.staff ?? []) {
    const slot = kit.people.find((p) => (replaces ? p.id === replaces : p.role === sheet.role));
    if (!slot || slot.deputy) throw bad("This role cannot be filled from your library.");
    if (cast.people[slot.id] || used.has(characterId)) throw bad("Each role and each card can be used once.");
    used.add(characterId);
    const d = await readOne(runtime, "character", characterId);
    const age = checkAge(d);
    const name = str(d.name, 80);
    if (!name) throw bad("This card has no name.");
    const { traits, tone, lines, core } = sheet;
    cast.people[slot.id] = {
      engineId: characterId,
      name,
      core,
      traits,
      tone,
      lines,
      avatar: avatarOf(d.avatarPath),
      age,
    };
  }
  if (req.systems) {
    const seen = new Set<number>();
    for (const e of req.systems) {
      if (e.index >= kit.systems.length || seen.has(e.index)) throw bad("No such system.");
      seen.add(e.index);
    }
    cast.systems = req.systems;
  }
  return cast;
}

/** The kit as this run plays it: cast people replace the kit people with the same id, and the boss is named. */
export function withCast(kit: PlaceKit, cast?: Cast, clock?: Clock): PlaceKit {
  if (!cast) return kit;
  // The kit's own text names the people it ships with, so their names become the cast person's names.
  // ponytail: plain text replace. Pronouns in the kit text stay as written; rewrite per person when a kit needs it.
  const esc = (s: string) => JSON.stringify(s).slice(1, -1);
  const first = (name: string) => name.split(" ")[0];
  // One pass with word boundaries, so a new name is never renamed again and "Mira" does not match "Miranda".
  const names = new Map<string, string>();
  for (const [id, c] of Object.entries(cast.people)) {
    const old = kit.people.find((p) => p.id === id);
    if (!old) continue;
    names.set(esc(old.name), esc(c.name));
    if (first(old.name).length >= 3) names.set(esc(first(old.name)), esc(first(c.name)));
  }
  let json = JSON.stringify(kit);
  if (names.size) {
    const keys = [...names.keys()].sort((x, y) => y.length - x.length);
    const re = new RegExp(
      `(?<![\\p{L}\\p{N}])(?:${keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}\\p{N}])`,
      "gu",
    );
    json = json.replace(re, (m) => names.get(m)!);
  }
  const out: PlaceKit = JSON.parse(json);
  out.people = out.people.map((p) => {
    const c = cast.people[p.id];
    // A cast person starts without the old person's ambition and secret.
    return c
      ? {
          ...p,
          name: c.name,
          traits: c.traits,
          ambition: "",
          secret: "",
          core: c.core,
          voice: { style: c.tone || "natural", phrases: c.lines },
        }
      : p;
  });
  const edits = cast.systems;
  if (edits) {
    out.systems = out.systems.flatMap((s, i) => {
      const e = edits.find((x) => x.index === i);
      return e?.remove ? [] : [e?.name ? { ...s, name: e.name } : s];
    });
  }
  // Hired people and visitors are not in the kit. A visitor is gone once their last day has passed.
  for (const [id, c] of Object.entries(cast.people)) {
    if (kit.people.some((p) => p.id === id) || (clock && c.until !== undefined && dayIndex(clock) >= c.until)) continue;
    out.people.push({
      id,
      name: c.name,
      role: c.role ?? "",
      colour: "#8a8f98",
      deputy: false,
      traits: c.traits,
      ambition: "",
      secret: "",
      routine: {} as PlaceKit["people"][number]["routine"],
      voice: { style: c.tone || "natural", phrases: c.lines },
      core: c.core,
    });
  }
  if (cast.boss) out.boss = { name: cast.boss.name, about: cast.boss.about };
  return out;
}

/** The kit's systems as the Preview screen shows them: with the player's renames and removals applied. */
export const systemsOf = (kitId: string, cast?: Cast) => withCast(placeKit(kitId), cast).systems;

/** One card joins a run that is already playing (cast.md section 9). Story roles come with the story engine. */
export const MidBody = z.object({
  expectedRevision: z.number().int().min(0),
  engineId: z.string().min(1).max(80),
  mode: z.enum(["swap", "hire", "visitor", "story"]),
  storyRole: z.enum(STORY_ROLES).optional(),
  replaces: z.string().max(40).optional(),
  days: z.number().int().min(1).max(10).optional(),
  sheet: Sheet,
});

const MAX_EXTRA = 6;

/** Cast changes only while the run is playing and no scene is open, like every other action. */
function open(r: Run) {
  if (r.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
  if (r.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
  if (r.game.meeting && !r.game.meeting.done) throw new BigCheeseError(409, "Finish the meeting first.", "wrong-phase");
}

/** Partner, child and parent need the Romance, Adult or Family layer. */
export const homeRoleOk = (g: Game, role: string) =>
  !HOME_ROLES.includes(role) || dial(g, "romance") > 0 || dial(g, "family") > 0 || !!g.adult;

/** Reads the picked card, then writes through the run queue. A changed run is a 409, as for every action. */
export async function midCast(
  runtime: CapabilityRuntimeHost,
  store: RunStore,
  id: unknown,
  body: unknown,
): Promise<Run> {
  const b = MidBody.safeParse(body ?? {});
  if (!b.success) throw bad("Invalid request.");
  const { engineId, mode, replaces, days = 3, sheet, expectedRevision, storyRole } = b.data;
  if ((mode === "story") !== !!storyRole) throw bad("Pick a story role for a story card.");
  const run = await store.get(id);
  if (storyRole && !homeRoleOk(run.game, storyRole))
    throw bad("Turn on the Romance, Adult or Family layer for this role.");
  const kit = placeKitOf(run);
  const d = await readOne(runtime, "character", engineId);
  const age = checkAge(d);
  const name = str(d.name, 80);
  if (!name) throw bad("This card has no name.");
  const person: CastPerson = {
    engineId,
    age,
    name,
    core: sheet.core,
    traits: sheet.traits,
    tone: sheet.tone,
    lines: sheet.lines,
    avatar: avatarOf(d.avatarPath),
  };
  const deputy = kit.people.find((p) => p.deputy);
  return store.update(id, expectedRevision, (r) => {
    open(r);
    const cast: Cast = { ...r.cast, people: { ...r.cast?.people } };
    if (Object.values(cast.people).some((p) => p.engineId === engineId)) throw bad("Each card can be used once.");
    if (mode === "swap") {
      const slot = kit.people.find((p) => (replaces ? p.id === replaces : p.role === sheet.role));
      if (!slot || slot.deputy) throw bad("This role cannot be filled from your library.");
      cast.people[slot.id] = person;
      const people = { ...r.game.people, [slot.id]: { ...r.game.people[slot.id], name } };
      return { ...r, cast, game: { ...r.game, people } };
    }
    if (deputy && sheet.role.toLowerCase() === deputy.role.toLowerCase()) {
      throw bad("This role cannot be filled from your library.");
    }
    const extras = Object.keys(cast.people).filter((k) => !kit.people.some((p) => p.id === k));
    if (extras.filter((k) => r.game.people[k]?.status === "active").length >= MAX_EXTRA) {
      throw bad("The place has no room for more people.");
    }
    let n = 1;
    while (cast.people[`${mode[0]}${n}`] || r.game.people[`${mode[0]}${n}`]) n++;
    const key = `${mode[0]}${n}`;
    cast.people[key] = {
      ...person,
      role: sheet.role,
      ...(mode === "visitor" && { until: dayIndex(r.game.clock) + days }),
    };
    const fresh: Person = {
      trust: 50,
      stress: 20,
      mood: "fine",
      memories: [],
      room: "home",
      ambition: 0,
      status: "active",
      name,
      // Extras work the routine of a kit person in the same role, or of the first non-deputy.
      routine: (
        kit.people.find((p) => p.role.toLowerCase() === sheet.role.toLowerCase()) ??
        kit.people.find((p) => !p.deputy) ??
        kit.people[0]
      ).routine,
      ...(mode === "visitor" && { until: dayIndex(r.game.clock) + days }),
    };
    const game = structuredClone(r.game);
    game.people[key] = fresh;
    if (storyRole) openStoryRole(game, key, storyRole);
    return { ...r, cast, game };
  });
}

/** Reads one cast person's card again: name, age and picture follow the card. The sheet and the run state stay. */
export async function refreshCast(
  runtime: CapabilityRuntimeHost,
  store: RunStore,
  id: unknown,
  pid: string,
  body: unknown,
): Promise<Run> {
  const b = z.object({ expectedRevision: z.number().int().min(0) }).safeParse(body ?? {});
  if (!b.success) throw bad("Invalid request.");
  const missing = () => new BigCheeseError(404, "No such cast person.", "not-found");
  const before = (await store.get(id)).cast;
  if (!before || !Object.hasOwn(before.people, pid)) throw missing();
  const old = before.people[pid];
  const d = await readOne(runtime, "character", old.engineId);
  const age = checkAge(d);
  const name = str(d.name, 80);
  if (!name) throw bad("This card has no name.");
  return store.update(id, b.data.expectedRevision, (r) => {
    open(r);
    const cur = r.cast?.people[pid];
    if (!r.cast || !cur) throw missing();
    const person = r.game.people[pid];
    return {
      ...r,
      cast: { ...r.cast, people: { ...r.cast.people, [pid]: { ...cur, age, name, avatar: avatarOf(d.avatarPath) } } },
      ...(person && { game: { ...r.game, people: { ...r.game.people, [pid]: { ...person, name } } } }),
    };
  });
}
