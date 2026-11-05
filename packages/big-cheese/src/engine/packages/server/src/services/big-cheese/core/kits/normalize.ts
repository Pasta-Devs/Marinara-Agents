// Big Cheese: the validity rules for a Place Kit (design.md section 14). Pure.
// A kit from outside is untrusted: it is size-capped, walked for dangerous keys, rebuilt field by
// field (unknown keys are dropped) and fixed where a fix is safe. Else it is refused with reasons.
import { z } from "zod";
import { METERS, type Meter } from "../types.js";
import { HAFENKAI_PLACE } from "./hafenkai.js";
import { PLACES } from "./places.js";
import type { PlaceKit } from "./types.js";

export const KIT_MAX_BYTES = 200_000;
const MAX_ROOMS = 24;
const MAX_PEOPLE = 24;
const MIN_ROOMS = 6;
const MIN_PEOPLE = 8;
const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const ROOM_KINDS = ["work", "social", "outside", "private", "hidden"] as const;

export type KitResult =
  { ok: true; kit: PlaceKit; fixes: string[] } | { ok: false; reasons: string[]; fatal?: boolean }; // fatal: no repair can help (not an object, bad key, too big)

const hasBadKey = (v: unknown, depth = 0): boolean =>
  depth > 12 ||
  (typeof v === "object" &&
    v !== null &&
    Object.entries(v).some(([k, x]) => BAD_KEYS.has(k) || hasBadKey(x, depth + 1)));

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");

// Each field falls back to a safe value, and the fix is counted by the caller.
const clamp100 = z
  .number()
  .catch(50)
  .transform((n) => Math.min(100, Math.max(0, Math.round(n))));
const Str = (d = "") => z.string().max(2000).catch(d);
const Room = z.object({
  id: Str(),
  name: Str("A room"),
  kind: z.enum(ROOM_KINDS).catch("work"),
  condition: clamp100,
  feeds: z.enum(METERS).nullable().catch(null),
  text: Str(),
});
const Person = z.object({
  id: Str(),
  name: Str("Someone"),
  role: Str("Staff"),
  colour: Str("#888888"),
  deputy: z.boolean().catch(false),
  traits: z.array(Str()).max(6).catch([]),
  ambition: Str(),
  secret: Str(),
  routine: z.record(z.string(), Str()).catch({}),
  voice: z.object({ style: Str(), phrases: z.array(Str()).max(8).catch([]) }).catch({ style: "", phrases: [] }),
  core: Str(),
});
const Meters = z.record(z.string(), z.object({ label: Str(), start: clamp100 }).catch({ label: "", start: 50 }));

/** A later id that repeats an earlier one gets a numbered one. */
function uniqueIds<T extends { id: string }>(list: T[], fallback: string, fixes: string[]): T[] {
  const seen = new Set<string>();
  return list.map((x, i) => {
    let id = slug(x.id) || `${fallback}-${i + 1}`;
    for (let n = 2; seen.has(id); n++) id = `${slug(x.id) || fallback}-${n}`;
    seen.add(id);
    if (id !== x.id) fixes.push(`id "${x.id}" is now "${id}"`);
    return { ...x, id };
  });
}

/**
 * Validates and repairs one kit. `ok: false` carries the reasons a person (or the kit.fix model
 * task) can act on. The family's built-in kit supplies defaults for missing parts.
 */
export function normalizeKit(raw: unknown): KitResult {
  const reasons: string[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return { ok: false, reasons: ["The kit must be an object."], fatal: true };
  if (hasBadKey(raw)) return { ok: false, reasons: ["The kit has a key that is not allowed."], fatal: true };
  if (JSON.stringify(raw).length > KIT_MAX_BYTES) return { ok: false, reasons: ["The kit is too large."], fatal: true };
  const r = raw as Record<string, unknown>;
  const fixes: string[] = [];
  const text = (k: string, d: string) => {
    if (typeof r[k] === "string" && r[k]) return (r[k] as string).slice(0, 2000);
    fixes.push(`${k} was empty`);
    return d;
  };
  const family = typeof r.family === "string" && r.family ? r.family.slice(0, 40) : "warehouse";
  const base = Object.values(PLACES).find((k) => k.family === family) ?? HAFENKAI_PLACE;

  const roomList = z.array(Room).safeParse(r.rooms);
  const peopleList = z.array(Person).safeParse(r.people);
  if (!roomList.success || roomList.data.length < MIN_ROOMS) reasons.push(`A kit needs at least ${MIN_ROOMS} rooms.`);
  if (!peopleList.success || peopleList.data.length < MIN_PEOPLE)
    reasons.push(`A kit needs at least ${MIN_PEOPLE} people.`);
  const meetings = Array.isArray(r.meetings) ? r.meetings.filter((m) => typeof m === "object" && m !== null) : [];
  if (!meetings.length) reasons.push("A kit needs at least one meeting type.");
  if (reasons.length || !roomList.success || !peopleList.success) return { ok: false, reasons };

  if (roomList.data.length > MAX_ROOMS || peopleList.data.length > MAX_PEOPLE)
    fixes.push("extra rooms or people were cut");
  const rooms = uniqueIds(roomList.data.slice(0, MAX_ROOMS), "room", fixes).map((x) => {
    // A room that does work needs a meter to feed, or its condition means nothing.
    const feeds =
      x.feeds ?? (x.kind === "work" ? "output" : x.kind === "private" || x.kind === "hidden" ? null : "people");
    if (feeds !== x.feeds) fixes.push(`room "${x.id}" now feeds ${feeds}`);
    return { ...x, feeds, text: x.text || x.name };
  });
  const roomIds = new Set(rooms.map((x) => x.id));
  let people = uniqueIds(peopleList.data.slice(0, MAX_PEOPLE), "person", fixes).map((p) => ({
    ...p,
    // A routine that points to a room that does not exist would strand the person.
    routine: Object.fromEntries(Object.entries(p.routine).filter(([, id]) => id === "home" || roomIds.has(id))),
  })) as PlaceKit["people"];
  if (people.filter((p) => p.deputy).length !== 1) {
    const keep = people.find((p) => p.deputy) ?? people[0]!;
    people = people.map((p) => ({ ...p, deputy: p === keep }));
    fixes.push(`${keep.name} is now the deputy`);
  }

  const m = Meters.safeParse(r.meters);
  const meters = Object.fromEntries(
    METERS.map((k: Meter) => {
      const have = m.success ? m.data[k] : undefined;
      if (!have?.label) fixes.push(`meter ${k} was filled in`);
      return [k, have?.label ? have : base.meters[k]];
    }),
  ) as PlaceKit["meters"];

  const id = slug(text("id", "")) || slug(text("name", "my-place")) || "my-place";
  const kit = {
    ...base, // missing parts come from the family's built-in kit
    ...pick(r, base),
    kitVersion: 1,
    id,
    name: text("name", "My place"),
    family,
    premise: text("premise", base.premise),
    meters,
    rooms,
    people,
    meetings: meetings as PlaceKit["meetings"],
  } as PlaceKit;
  if (!["manager", "strong_leader", "absolute"].includes(kit.authority)) kit.authority = base.authority;
  if (!["calm", "classic", "chaos"].includes(kit.storyteller)) kit.storyteller = base.storyteller;
  // An absolute place needs Legitimacy to lose; the content.md numbers apply when the kit gives none.
  if (kit.authority === "absolute" && !kit.authorityStart) kit.authorityStart = { fear: 50, love: 40, legitimacy: 60 };
  // ponytail: systems, houseRules, authorityStart, hearing and templates are deep-checked in pick(); the other optional lists are kept by top-level type only.
  return { ok: true, kit, fixes };
}

/** The raw fields that have the same shape as the base kit's field; any other field falls back to the base. */
function pick(r: Record<string, unknown>, base: PlaceKit): Partial<PlaceKit> {
  const out: Record<string, unknown> = {};
  for (const [k, d] of Object.entries(base)) {
    if (["id", "name", "family", "premise", "meters", "rooms", "people", "meetings", "kitVersion"].includes(k))
      continue;
    if (typeof r[k] === typeof d && Array.isArray(r[k]) === Array.isArray(d) && r[k] !== null) out[k] = r[k];
  }
  for (const k of ["layers", "extras", "scenario", "adult", "officeHours", "authorityStart", "court", "roles"])
    if (typeof r[k] === "object" && r[k] !== null) out[k] = r[k];
  for (const [k, check] of Object.entries(DEEP)) if (k in out) out[k] = check(out[k]);
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out as Partial<PlaceKit>;
}

// Per-field checks for the optional kit parts that code walks by key. A bad list item is dropped; a bad object is dropped whole.
const Strs = z.array(z.string()).min(1);
const Card = z.object({ ask: z.string(), strong: z.string(), middle: z.string(), weak: z.string() });
const Sev = z.object({ "1": z.array(Card).min(1), "2": z.array(Card).min(1), "3": z.array(Card).min(1) });
const Templates = z.object({
  cards: z.object(Object.fromEntries(METERS.map((m) => [m, Sev]))),
  feeling: z.object(Object.fromEntries(["cold", "wary", "neutral", "warm", "loyal"].map((b) => [b, Strs]))),
  arrival: Strs,
});
const Hearing = z.object({ body: z.string(), members: Strs, ending: z.string() });
const Block = z.object({ kind: z.enum(["project", "event", "season"]), name: z.string(), text: z.string() });
const Rule = z.object({
  id: z.string().transform(slug).pipe(z.string().min(1)),
  text: z.string(),
  options: Strs,
  touches: Strs,
  decree: z.boolean().optional(),
});
const Pct = z.number().transform((n) => Math.min(100, Math.max(0, Math.round(n))));
const Start = z.object({ fear: Pct, love: Pct, legitimacy: Pct });
const list = (sch: z.ZodType) => (v: unknown) =>
  (v as unknown[]).flatMap((x) => {
    const p = sch.safeParse(x);
    return p.success ? [p.data] : [];
  });
const one = (sch: z.ZodType) => (v: unknown) => {
  const p = sch.safeParse(v);
  return p.success ? p.data : undefined;
};
const Extra = z.object({
  id: z.string().transform(slug).pipe(z.string().min(1)),
  label: z.string().transform((s) => s.slice(0, 40)),
  main: z.enum(METERS),
  value: Pct,
});
const DEEP: Record<string, (v: unknown) => unknown> = {
  systems: list(Block),
  houseRules: list(Rule),
  authorityStart: one(Start),
  scenario: one(z.object({ goal: z.string() })),
  // T2: at most 2 extra meters; reserved and repeated ids are dropped
  extras: (v) => {
    const seen = new Set<string>();
    const ok = (id: string) =>
      id !== "legitimacy" && !(METERS as readonly string[]).includes(id) && !seen.has(id) && !!seen.add(id);
    return list(Extra)(v)
      .filter((e) => ok(e.id))
      .slice(0, 2);
  },
  hearing: one(Hearing),
  templates: one(Templates),
};
