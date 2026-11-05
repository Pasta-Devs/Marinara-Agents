// ──────────────────────────────────────────────
// Big Cheese: house rule routes (design.md section 16, content.md section 11)
// ──────────────────────────────────────────────
// GET lists the rules and the absolute meters. POST changes one rule for 1 hour: a Manager
// proposes it for the next meeting, a Strong leader sets it, an absolute ruler decrees it.
import { z } from "zod";
import { enforcerIn, plotChance, ruleOption, setRule } from "./core/index.js";
import { withCast } from "./cast.js";
import { placeKitOf } from "./core/kits/index.js";
import { HOURS } from "./core/clock.js";
import { BigCheeseError, type RunStore } from "./store.js";
import { view } from "./game.js";

const Body = z.object({
  expectedRevision: z.number().int().min(0),
  rule: z.string().max(60),
  option: z.string().max(60),
});

export function createRules(store: RunStore) {
  return {
    async list(id: unknown) {
      const run = await store.get(id);
      const game = run.game;
      const kit = withCast(placeKitOf(run), run.cast, game.clock);
      return {
        authority: game.authority,
        power: game.power,
        legitimacy: game.extras.find((e) => e.id === "legitimacy")?.value ?? null,
        plotChance: plotChance(game.power),
        enforcer: enforcerIn(game, kit),
        rules: kit.houseRules.map((r) => ({
          id: r.id,
          text: r.text,
          options: r.options,
          decree: !!r.decree,
          current: ruleOption(game, r),
        })),
        proposals: Object.values(game.threads).flatMap((t) => (t.rule ? [`rule:${t.rule.id}:${t.rule.option}`] : [])),
      };
    },

    async set(id: unknown, body: unknown) {
      const parsed = Body.safeParse(body ?? {});
      if (!parsed.success)
        throw new BigCheeseError(400, parsed.error.issues[0]?.message ?? "Invalid request.", "bad-request");
      const run = await store.get(id);
      if (parsed.data.expectedRevision !== run.revision)
        throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
      if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
      if (run.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
      if (run.game.meeting && !run.game.meeting.done)
        throw new BigCheeseError(409, "A meeting is open.", "wrong-phase");
      if (run.game.clock.hoursLeft === HOURS && !run.game.inbox.some((c) => c.age === 0))
        throw new BigCheeseError(409, "The day has not started.", "wrong-phase");
      let game;
      try {
        game = setRule(
          run.game,
          withCast(placeKitOf(run), run.cast, run.game.clock),
          parsed.data.rule,
          parsed.data.option,
        );
      } catch (e) {
        if (e instanceof Error && /Not enough hours/.test(e.message))
          throw new BigCheeseError(409, e.message, "no-hours");
        throw new BigCheeseError(400, e instanceof Error ? e.message : "Invalid request.", "bad-request");
      }
      return view(await store.update(id, run.revision, (r) => ({ ...r, game })));
    },
  };
}
