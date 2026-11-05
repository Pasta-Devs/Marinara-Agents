// Big Cheese: out of the office routes (modules.md section 4, M4 plan T14).
// An after-work invitation is a free evening scene, a walk costs 1 hour and a trip 2 hours, one a week.
// All three open a scene on the run; the choices go through the normal scene route.
import { z } from "zod";
import { withCallLog, type ModelCall } from "./ai/tasks.js";
import { withCast } from "./cast.js";
import { HOURS, isLocked, spendHours, type Run as Game } from "./core/index.js";
import { placeKitOf } from "./core/kits/index.js";
import { TRIP_HOURS, WALK_HOURS, afterId, invitation, stage, tripId, walkId } from "./core/outside.js";
import { BigCheeseError, type Run, type RunStore } from "./store.js";
import { view, type createGame } from "./game.js";

const Base = z.object({ expectedRevision: z.number().int().min(0) });
const Walk = Base.extend({ room: z.string().max(80), person: z.string().max(80) });
const Trip = Base.extend({ room: z.string().max(80), people: z.array(z.string().max(80)).min(1).max(4) });

type OpenScene = ReturnType<typeof createGame>["openScene"];

export function createOutside(store: RunStore, getModel: () => Promise<ModelCall | undefined>, openScene: OpenScene) {
  const kitOf = (run: Run) => withCast(placeKitOf(run), run.cast, run.game.clock);
  const wrong = (m: string) => new BigCheeseError(409, m, "wrong-phase");

  /** Reads the run for a write: the revision must be the player's and nothing else open. */
  async function open<S extends z.ZodType<{ expectedRevision: number }>>(id: unknown, body: unknown, schema: S) {
    const parsed = schema.safeParse(body ?? {});
    if (!parsed.success)
      throw new BigCheeseError(400, parsed.error.issues[0]?.message ?? "Invalid request.", "bad-request");
    const run = await store.get(id);
    if (parsed.data.expectedRevision !== run.revision)
      throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
    const g = run.game;
    if (g.status !== "playing") throw wrong("This run is over.");
    if (run.scene) throw wrong("Finish the scene first.");
    if (g.meeting && !g.meeting.done) throw wrong("Finish the meeting first.");
    if (g.clock.hoursLeft === HOURS && !g.inbox.some((c) => c.age === 0)) throw wrong("The day has not started.");
    return { run, b: parsed.data as z.infer<S> };
  }

  /** Opens a scene with the stage thread, spends the hours and saves. */
  async function start(
    id: unknown,
    run: Run,
    sceneId: string,
    blueprint: string,
    people: string[],
    room: string,
    hours: number,
  ) {
    if (run.game.clock.hoursLeft < hours) throw wrong("No hours left today.");
    const model = run.lite ? undefined : withCallLog(await getModel(), String(id));
    const game: Game = structuredClone(run.game);
    const h = { rng: game.rng };
    const scene = await openScene(kitOf(run), h, game, blueprint, model, stage(people, room));
    game.rng = h.rng;
    if (blueprint !== "walk") game.tally[sceneId] = 1; // the booking lives in game state, so a Board rewind frees it
    game.clock = spendHours(game.clock, hours);
    return view(
      await store.update(id, run.revision, (r) => ({
        ...r,
        game,
        text: { ...r.text, scenes: { ...r.text.scenes, [sceneId]: scene } },
        scene: sceneId,
      })),
    );
  }

  const roomName = (run: Run, id: string, kind?: string) => {
    const r = kitOf(run).rooms.find((x) => x.id === id && (!kind || x.kind === kind));
    if (!r) throw new BigCheeseError(404, "No such room.", "not-found");
    if (isLocked(run.game, kitOf(run), id)) throw new BigCheeseError(400, "That room is locked.", "bad-request");
    return r.name;
  };
  const known = (run: Run, ids: string[]) => {
    if (new Set(ids).size !== ids.length || ids.some((p) => run.game.people[p]?.status !== "active"))
      throw new BigCheeseError(404, "No such person.", "not-found");
  };

  return {
    /** What the Office and the Place screens offer now. */
    async state(id: unknown) {
      const run = await store.get(id);
      const g = run.game;
      const inv = invitation(g, g.tally);
      return {
        invitation: g.status === "playing" && !run.scene ? inv : null,
        tripUsed: Object.hasOwn(g.tally, tripId(g.clock)),
        tripRooms: kitOf(run)
          .rooms.filter((r) => r.kind === "outside")
          .map((r) => ({ id: r.id, name: r.name })),
      };
    },
    /** The evening invitation: free, and declining costs nothing. */
    async afterWork(id: unknown, body: unknown) {
      const { run } = await open(id, body, Base);
      const inv = invitation(run.game, run.text.scenes);
      if (!inv) throw wrong("Nobody has asked you out tonight.");
      const kit = kitOf(run);
      const room = kit.rooms.find((r) => r.kind === "social" || r.kind === "outside")?.name ?? kit.name;
      return start(id, run, afterId(run.game.clock), "after_work", inv.people, room, 0);
    },
    /** A walk: 1 hour, one person along, a talk scene in that room. */
    async walk(id: unknown, body: unknown) {
      const { run, b } = await open(id, body, Walk);
      known(run, [b.person]);
      const c = run.game.clock;
      return start(id, run, walkId(c), "walk", [b.person], roomName(run, b.room), WALK_HOURS);
    },
    /** A trip: 2 hours, up to 4 people, an outside room, one a week. */
    async trip(id: unknown, body: unknown) {
      const { run, b } = await open(id, body, Trip);
      known(run, b.people);
      const room = roomName(run, b.room, "outside");
      if (Object.hasOwn(run.game.tally, tripId(run.game.clock))) throw wrong("You already took a trip this week.");
      return start(id, run, tripId(run.game.clock), "trip", b.people, room, TRIP_HOURS);
    },
  };
}
