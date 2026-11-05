// Big Cheese: the place draft (design.md section 13). A wish becomes a kit draft in two model calls
// (the place, then its people). The code normalizes the result, retries once with the reasons
// when the check refuses it, and falls back to the family's built-in kit.
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { routineOf, runTask, type ModelCall, type PlaceDraftOutput, type PlacePeopleOutput } from "./ai/tasks.js";
import { METERS } from "./core/types.js";
import { normalizeKit } from "./core/kits/normalize.js";
import { PLACES } from "./core/kits/places.js";
import type { PlaceKit } from "./core/kits/types.js";
import { kitView } from "./game.js";
import { BigCheeseError } from "./store.js";

const SIZES = { small: 8, medium: 12, large: 16 } as const;

const Wish = z.object({
  wish: z.string().max(400).default(""),
  size: z.enum(["small", "medium", "large"]).default("medium"),
  storyteller: z.enum(["calm", "classic", "chaos"]).default("classic"),
  authority: z.enum(["manager", "strong_leader", "absolute"]).default("manager"),
  fixed: z.array(z.string().trim().min(1).max(80)).max(3).default([]),
  part: z.enum(["all", "people", "rooms", "name"]).default("all"),
  kit: z.unknown().optional(), // the draft that is being rerolled
});

const familyKit = (family?: string): PlaceKit =>
  Object.values(PLACES).find((k) => k.family === family) ?? PLACES.hafenkai;

const slugOf = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "place";

const SCREENS = ["inbox", "calendar", "staff", "people", "report"] as const;

/**
 * Puts the drafted parts on the kit under them, then fixes everything that names a person or a room,
 * because a new list of people or rooms leaves the old names in the other parts pointing at nothing.
 */
export function applyDraft(
  under: PlaceKit,
  d: PlaceDraftOutput,
  details: PlacePeopleOutput["people"] | undefined,
  first: boolean,
): PlaceKit {
  const k = structuredClone(under);
  if (d.name) k.name = d.name;
  if (d.premise) k.premise = d.premise;
  if (d.bossTitle) k.bossTitle = d.bossTitle;
  if (d.family) k.family = d.family;
  for (const m of METERS) {
    const start = k.meters[m].start;
    k.meters[m] = {
      label: d.meters?.[m] || k.meters[m].label,
      start: first ? Math.min(70, Math.max(35, start)) : start,
    };
  }
  if (d.rooms) k.rooms = d.rooms;
  if (d.people) k.people = d.people;
  if (d.roles?.length) k.roles = d.roles;
  if (d.groups) k.groups = d.groups;
  if (d.relations) k.relations = d.relations;
  if (d.traditions?.length) k.traditions = d.traditions;
  if (d.surprises?.length) k.surprises = d.surprises;
  if (d.crisisDeck?.length) k.crisisDeck = d.crisisDeck;
  if (d.hearing) k.hearing = { ...k.hearing, ...d.hearing };
  for (const x of details ?? []) {
    const p = k.people.find((q) => q.id === x.id);
    if (p)
      Object.assign(p, { core: x.core, ambition: x.ambition, secret: x.secret, voice: x.voice, routine: x.routine });
  }
  k.people.forEach((p, n) => (p.routine = routineOf(p.routine, k.rooms, n)));

  const ids = new Set(k.people.map((p) => p.id));
  const crew = k.people.filter((p) => !p.deputy);
  const pool = (crew.length ? crew : k.people).map((p) => p.id);
  k.groups = k.groups.filter((g) => !g.spokesperson || ids.has(g.spokesperson));
  k.relations = k.relations.filter((r) => ids.has(r.a) && ids.has(r.b));
  k.meetings = k.meetings.map((m, n) =>
    m.attendees === "all" || ids.has(m.attendees) ? m : { ...m, attendees: pool[n % pool.length]! },
  );
  const members = k.hearing.members.filter((id) => ids.has(id));
  k.hearing = { ...k.hearing, members: members.length >= 2 ? members : pool.slice(0, 3) };
  const note = (p: PlaceKit["people"][number]) =>
    p.ambition || p.core || `${p.name}, ${p.role}, has something on their mind.`;
  k.openingThreads = k.openingThreads.filter((t) => t.people.every((id) => ids.has(id)));
  for (const id of pool) {
    if (k.openingThreads.length >= 2) break;
    const p = k.people.find((q) => q.id === id)!;
    k.openingThreads.push({
      title: `${p.name} has a problem`,
      kind: "personal",
      people: [p.id],
      need: "people",
      text: note(p),
    });
  }
  if (!k.guidedLetters.length || k.guidedLetters.some((l) => !ids.has(l.person)))
    k.guidedLetters = [-1, 0, 2, 3, 4].map((day, n) => {
      const p = k.people.find((q) => q.id === pool[n % pool.length])!;
      return { day, person: p.id, text: `${p.name}: ${note(p)}`, screen: SCREENS[n]! };
    });
  return k;
}

export function createDraft(getModel: () => Promise<ModelCall | undefined>) {
  /** One try: the place call, then the people call. */
  async function attempt(
    b: z.infer<typeof Wish>,
    cur: PlaceKit | null,
    model: ModelCall | undefined,
    problems: string[] | undefined,
    note: { lite: boolean },
  ) {
    const first = b.part === "all";
    const rng = randomBytes(4).readUInt32BE();
    const size = SIZES[b.size];
    const start = cur ?? PLACES.hafenkai;
    const frame = await runTask(
      "place.draft",
      { kit: start, rng, wish: b.wish, size, storyteller: b.storyteller, part: b.part, fixed: b.fixed, problems },
      { model },
    );
    if (frame.source === "lite") note.lite = true;
    const under = first ? familyKit(frame.output.family) : start;
    let details: PlacePeopleOutput["people"] | undefined;
    if (frame.output.people) {
      const rooms = frame.output.rooms ?? under.rooms;
      const named = applyDraft(under, { ...frame.output, people: undefined }, undefined, first);
      const pass = await runTask(
        "place.people",
        {
          kit: { ...under, name: named.name, premise: named.premise },
          rng,
          rooms,
          people: frame.output.people,
          problems,
        },
        { model },
      );
      details = pass.output.people;
      if (pass.source === "lite") note.lite = true;
    }
    const kit = applyDraft(under, frame.output, details, first);
    kit.authority = first ? b.authority : kit.authority;
    kit.storyteller = first ? b.storyteller : kit.storyteller;
    if (first) kit.id = `${slugOf(kit.name)}-${randomBytes(2).toString("hex")}`;
    return normalizeKit(kit);
  }

  return {
    /** Makes a draft, or rerolls one part of the draft that comes in `kit`. */
    async make(body: unknown) {
      const parsed = Wish.safeParse(body ?? {});
      if (!parsed.success) throw new BigCheeseError(400, "Invalid request.", "bad-request");
      const b = parsed.data;
      if (b.part !== "all" && b.kit === undefined)
        throw new BigCheeseError(400, "A reroll needs the draft.", "bad-request");
      let cur: PlaceKit | null = null;
      if (b.part !== "all" || b.kit !== undefined) {
        const r = normalizeKit(b.kit);
        if (!r.ok) throw new BigCheeseError(400, "That draft is not a kit.", "bad-kit");
        cur = r.kit;
      }
      const model = await getModel();
      const note = { lite: false };
      let result = await attempt(b, cur, model, undefined, note);
      // One fix-up retry with the reasons, then the built-in kit (a model-less try never fails).
      if (!result.ok && model) result = await attempt(b, cur, model, result.reasons, note);
      if (!result.ok) {
        note.lite = true;
        result = await attempt(b, cur, undefined, undefined, note);
      }
      if (!result.ok) throw new BigCheeseError(500, "The draft failed.", "bad-kit");
      const kit = result.kit;
      return { kit, view: { ...kitView({ kitId: "hafenkai", kit }), systems: kit.systems }, lite: note.lite };
    },
  };
}
