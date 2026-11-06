// Big Cheese: the floor map, room visits and the grapevine (design.md sections 6 and 8.2, ui.md 5.11).
// The model writes the lines. The code picks who is where, who the boss overhears and what he learns.
import { z } from "zod";
import { runTask, withCallLog, type ModelCall } from "./ai/tasks.js";
import { withCast } from "./cast.js";
import { dayIndex, isLocked, pick, roll, slot, spendHours, type Run as Game } from "./core/index.js";
import { dayFacts, isKnown, knownMap, movePeople, overheard, relKey } from "./core/people.js";
import { newId } from "./core/run.js";
import { placeKitOf } from "./core/kits/index.js";
import type { PlaceKit } from "./core/kits/types.js";
import { BigCheeseError, type PlaceText, type Run, type RunStore } from "./store.js";
import { view } from "./game.js";

const MORNING_ROOMS = 6; // rooms with a line in the morning batch
const MAX_RUMOURS = 60; // the oldest rumours drop off
const PAGE = 20;

const Body = z.object({ expectedRevision: z.number().int().min(0) });
const Query = z.object({ page: z.coerce.number().int().min(0).catch(0) });

export function createPlace(store: RunStore, getModel: () => Promise<ModelCall | undefined>) {
  const kitOf = (run: Run) => withCast(placeKitOf(run), run.cast, run.game.clock);
  const modelFor = async (run: Run, id: unknown) => (run.lite ? undefined : withCallLog(await getModel(), String(id)));
  const nameOf = (kit: PlaceKit, id: string) => kit.rooms.find((r) => r.id === id)?.name ?? id;

  /** Reads the run for a write: the revision must be the one the player has, and nothing else is open. */
  async function open(id: unknown, body: unknown) {
    const parsed = Body.safeParse(body ?? {});
    if (!parsed.success) throw new BigCheeseError(400, "Invalid request.", "bad-request");
    const run = await store.get(id);
    if (parsed.data.expectedRevision !== run.revision)
      throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
    if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
    if (run.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
    if (run.game.meeting && !run.game.meeting.done)
      throw new BigCheeseError(409, "Finish the meeting first.", "wrong-phase");
    return run;
  }

  const save = async (run: Run & { id: string }, game: Game, place: PlaceText) =>
    view(await store.update(run.id, run.revision, (r) => ({ ...r, game, text: { ...r.text, place } })));

  const empty = (): PlaceText => ({ day: -1, evening: -1, morning: [], known: [], grapevine: {} });

  /** Reason seeds are used once: the batch that read them drops them (cheese-board.md section 6). */
  const spend = (game: Game, people: { person: string }[]) => {
    game.reasons = game.reasons?.filter((r) => !people.some((p) => p.person === r.person));
  };

  /** One person as the ambient batch reads them: only relations the boss knows go in. */
  const ambient = (game: Game, kit: PlaceKit, place: PlaceText, id: string, room: string) => ({
    person: id,
    room: nameOf(kit, room),
    mood: game.people[id].mood,
    reasons: (game.reasons ?? []).filter((r) => r.person === id).map((r) => r.text),
    with: game.relations
      .filter((r) => (r.a === id || r.b === id) && isKnown(r, place.known))
      .map((r) => ({ person: r.a === id ? r.b : r.a, kind: r.kind })),
  });

  return {
    /** The floor map: each room with its condition, the people there and this morning's line. */
    async rooms(id: unknown) {
      const run = await store.get(id);
      const kit = kitOf(run);
      const lines = run.text.place?.morning ?? [];
      return {
        rooms: kit.rooms.map((r) => ({
          id: r.id,
          name: r.name,
          condition: run.game.rooms[r.id]?.condition ?? r.condition,
          locked: isLocked(run.game, kit, r.id), // T2
          people: run.game.rooms[r.id]?.people ?? [],
          line: lines.find((l) => l.room === r.id)?.text ?? null,
        })),
      };
    },

    /** T19: the relation map. Relations the boss does not know never leave the server. */
    async relations(id: unknown) {
      const run = await store.get(id);
      return { relations: knownMap(run.game, run.text.place?.known ?? []) };
    },

    /** Rumour lines, newest first, one page at a time. */
    async grapevine(id: unknown, query: unknown) {
      const { page } = Query.parse(query ?? {});
      const run = await store.get(id);
      const lines = run.text.place?.grapevine ?? {};
      const ids = [...run.game.grapevine].reverse().slice(page * PAGE, (page + 1) * PAGE);
      return { lines: ids.filter((x) => lines[x]).map((x) => ({ id: x, ...lines[x] })) };
    },

    /** Brings people to this slot's rooms, writes today's morning lines once, and the evening rumours once. */
    async refresh(id: unknown, body: unknown) {
      const run = await open(id, body);
      const kit = kitOf(run);
      const game = structuredClone(run.game);
      const place = structuredClone(run.text.place ?? empty());
      const model = await modelFor(run, id);
      const today = dayIndex(game.clock);
      const h = { rng: game.rng };
      movePeople(game, kit);

      if (place.day !== today) {
        const rooms = kit.rooms.filter((r) => game.rooms[r.id]?.people.length).slice(0, MORNING_ROOMS);
        const people = rooms.map((r) => ambient(game, kit, place, pick(h, game.rooms[r.id].people), r.id));
        const lines = people.length
          ? (await runTask("ambient.batch", { kit, rng: h.rng, people }, { model })).output.lines
          : [];
        place.morning = lines.map((l, n) => ({ room: rooms[n].id, person: l.person, text: l.line }));
        spend(game, people);
        place.day = today;
        roll(h);
      }

      if ((slot(game.clock) === "evening" || slot(game.clock) === "night") && place.evening !== today) {
        const facts = dayFacts(game, kit, place.known);
        if (facts.length) {
          const { output } = await runTask("grapevine.batch", { kit, rng: h.rng, facts }, { model });
          for (const l of output.lines) {
            const line = newId(game, "g");
            place.grapevine[line] = { source: l.source, text: l.line };
            game.grapevine.push(line);
          }
          while (game.grapevine.length > MAX_RUMOURS) delete place.grapevine[game.grapevine.shift()!];
          roll(h);
        }
        place.evening = today;
      }

      game.rng = h.rng;
      return save(run, game, place);
    },

    /** A visit costs 1 hour. The boss overhears up to 2 pairs, and the relations between them stop being secret. */
    async visit(id: unknown, room: string, body: unknown) {
      const run = await open(id, body);
      const kit = kitOf(run);
      if (!kit.rooms.some((r) => r.id === room)) throw new BigCheeseError(404, "No such room.", "not-found");
      if (isLocked(run.game, kit, room))
        throw new BigCheeseError(400, "That room is locked. Find its key first.", "bad-request");
      if (run.game.clock.hoursLeft < 1) throw new BigCheeseError(409, "No hours left today.", "no-hours");
      const game = structuredClone(run.game);
      const place = structuredClone(run.text.place ?? empty());
      movePeople(game, kit);
      const heard = overheard(game, room);
      if (!heard.people.length) throw new BigCheeseError(409, "Nobody is there.", "wrong-phase");
      const model = await modelFor(run, id);
      place.known = [...new Set([...place.known, ...heard.pairs.map(relKey)])];
      const h = { rng: game.rng };
      const { output } = await runTask(
        "ambient.batch",
        { kit, rng: h.rng, people: heard.people.map((p) => ambient(game, kit, place, p, room)) },
        { model },
      );
      roll(h);
      game.rng = h.rng;
      game.clock = spendHours(game.clock, 1);
      spend(game, output.lines);
      place.visit = { room, lines: output.lines.map((l) => ({ person: l.person, text: l.line })) };
      return save(run, game, place);
    },
  };
}
