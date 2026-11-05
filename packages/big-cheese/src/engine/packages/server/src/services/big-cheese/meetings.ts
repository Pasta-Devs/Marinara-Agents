// ──────────────────────────────────────────────
// Big Cheese: meeting routes (design.md section 7)
// ──────────────────────────────────────────────
// The code picks the people, the agenda and every number; the model writes the lines. A model call
// runs before the store's write, so a changed revision is a 409 and the client reloads.
import { z } from "zod";
import { runTask, type ModelCall } from "./ai/tasks.js";
import { withCast } from "./cast.js";
import { meetingChoice, meetingText, MEETINGS, startMeeting, type Run as Game } from "./core/index.js";
import { placeKitOf } from "./core/kits/index.js";
import type { PlaceKit } from "./core/kits/types.js";
import { BigCheeseError, type Run, type RunStore } from "./store.js";
import { view } from "./game.js";
import { HOURS } from "./core/clock.js";

const Body = z.object({ expectedRevision: z.number().int().min(0) });
const StartBody = Body.extend({ kind: z.string().max(40) });
const ChooseBody = Body.extend({
  stance: z.string().max(40).optional(),
  text: z.string().trim().min(1).max(300).optional(),
}).refine((b) => (b.stance === undefined) !== (b.text === undefined), "Send one of stance or text.");

export function createMeetings(store: RunStore, getModel: () => Promise<ModelCall | undefined>) {
  const kitOf = (run: Run): PlaceKit => withCast(placeKitOf(run), run.cast, run.game.clock);
  const modelFor = (run: { lite: boolean }) => (run.lite ? Promise.resolve(undefined) : getModel());

  async function open<S extends z.ZodType<{ expectedRevision: number }>>(id: unknown, body: unknown, schema: S) {
    const parsed = schema.safeParse(body ?? {});
    if (!parsed.success)
      throw new BigCheeseError(400, parsed.error.issues[0]?.message ?? "Invalid request.", "bad-request");
    const run = await store.get(id);
    if (parsed.data.expectedRevision !== run.revision)
      throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
    if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
    if (run.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
    return { run, b: parsed.data as z.infer<S> };
  }

  /** The model's words for the item that is up (the first one without an answer). */
  async function writeItem(run: Run, game: Game): Promise<Game> {
    const m = game.meeting;
    const item = m?.items.find((i) => i.chosen === undefined);
    if (!m || !item) return game;
    const h = { rng: game.rng };
    const out = (
      await runTask(
        "meeting.turn",
        {
          kit: kitOf(run),
          rng: h.rng,
          title: m.kind,
          item: item.title,
          first: m.items[0] === item,
          people: m.people.map((person) => ({
            person,
            side:
              item.base[person]! > 0
                ? ("for" as const)
                : item.base[person]! < 0
                  ? ("against" as const)
                  : ("open" as const),
          })),
          offer: item.offer.map((a) => a.stance),
        },
        { model: await modelFor(run) },
      )
    ).output;
    h.rng = (h.rng + 0x6d2b79f5) | 0; // the Lite path reads from `rng`; step it so the next turn differs
    return { ...meetingText(game, out.lines, out.suggestions), rng: h.rng };
  }

  const save = async (id: unknown, run: Run, game: Game) =>
    view(await store.update(id, run.revision, (r) => ({ ...r, game })));

  return {
    async start(id: unknown, body: unknown) {
      const { run, b } = await open(id, body, StartBody);
      if (!Object.hasOwn(MEETINGS, b.kind)) throw new BigCheeseError(400, "Not a meeting type.", "bad-request");
      if (run.game.meeting && !run.game.meeting.done)
        throw new BigCheeseError(409, "A meeting is already open.", "wrong-phase");
      if (run.game.clock.hoursLeft === HOURS && !run.game.inbox.some((c) => c.age === 0))
        throw new BigCheeseError(409, "The day has not started.", "wrong-phase");
      let game: Game;
      try {
        game = startMeeting(run.game, b.kind);
      } catch (e) {
        if (e instanceof Error && /Not enough hours/.test(e.message))
          throw new BigCheeseError(409, e.message, "no-hours");
        throw new BigCheeseError(400, e instanceof Error ? e.message : "Invalid request.", "bad-request");
      }
      return save(id, run, await writeItem(run, game));
    },

    async choose(id: unknown, body: unknown) {
      const { run, b } = await open(id, body, ChooseBody);
      const m = run.game.meeting;
      const item = m && !m.done ? m.items.find((i) => i.chosen === undefined) : undefined;
      if (!m || !item) throw new BigCheeseError(409, "No meeting is open.", "wrong-phase");
      const allowed = item.offer.map((a) => a.stance);
      let stance = b.stance;
      if (b.text) {
        // The tag only lands on an offered stance, because the core accepts nothing else.
        const model = await modelFor(run);
        stance = (await runTask("answer.tag", { kit: kitOf(run), text: b.text, allowed }, { model })).output.stance;
      }
      if (!stance || !allowed.includes(stance))
        throw new BigCheeseError(400, "That answer is not offered.", "bad-request");
      const game = meetingChoice(run.game, stance);
      return save(id, run, await writeItem(run, game));
    },
  };
}
