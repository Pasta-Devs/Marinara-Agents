// ──────────────────────────────────────────────
// Big Cheese M4 T15: the ledger routes (detailed money)
// ──────────────────────────────────────────────
// GET shows the books. POST /loan takes a loan, POST /budget splits the quarter's 100 points.
// Neither costs an hour. Both need the depth option `money`.
import { z } from "zod";
import { EVEN, LOAN_AMOUNTS, LOAN_WEEKS, budgetOf, ledgerLines, owed, setBudget, takeLoan } from "./core/ledger.js";
import { METERS } from "./core/types.js";
import { BigCheeseError, type RunStore } from "./store.js";
import { view } from "./game.js";
import type { Run } from "./core/types.js";

const Rev = z.number().int().min(0);
const LoanBody = z.object({ expectedRevision: Rev, amount: z.number().int(), weeks: z.number().int() });
const BudgetBody = z.object({
  expectedRevision: Rev,
  budget: z.object(Object.fromEntries(METERS.map((m) => [m, z.number()]))),
});

export function createLedger(store: RunStore) {
  const open = async (id: unknown, body: unknown, schema: typeof LoanBody | typeof BudgetBody) => {
    const parsed = schema.safeParse(body ?? {});
    if (!parsed.success)
      throw new BigCheeseError(400, parsed.error.issues[0]?.message ?? "Invalid request.", "bad-request");
    const run = await store.get(id);
    if (parsed.data.expectedRevision !== run.revision)
      throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
    if (run.game.status !== "playing") throw new BigCheeseError(409, "This run is over.", "wrong-phase");
    if (run.scene) throw new BigCheeseError(409, "Finish the scene first.", "wrong-phase");
    if (run.game.meeting && !run.game.meeting.done) throw new BigCheeseError(409, "A meeting is open.", "wrong-phase");
    return { run, data: parsed.data };
  };
  const change = async (id: unknown, run: Awaited<ReturnType<RunStore["get"]>>, fn: (g: Run) => void) => {
    const game = structuredClone(run.game);
    try {
      fn(game);
    } catch (e) {
      throw new BigCheeseError(400, e instanceof Error ? e.message : "Invalid request.", "bad-request");
    }
    return view(await store.update(id, run.revision, (r) => ({ ...r, game })));
  };

  return {
    async list(id: unknown) {
      const g = (await store.get(id)).game;
      const lines = ledgerLines(g);
      return {
        on: !!g.depth?.money,
        week: g.clock.week,
        quarter: g.ledger.quarter || 1,
        ...lines,
        // the audit week stays hidden; `audit` is the score of the last audit
        audit: g.ledger.audit ?? null,
        loans: g.ledger.loans.map((l) => ({ ...l, owed: owed(l) })),
        budget: budgetOf(g),
        even: EVEN,
        offers: { amounts: LOAN_AMOUNTS, weeks: LOAN_WEEKS },
      };
    },

    async loan(id: unknown, body: unknown) {
      const { run, data } = await open(id, body, LoanBody);
      const d = data as z.infer<typeof LoanBody>;
      return change(id, run, (g) => takeLoan(g, d.amount, d.weeks));
    },

    async budget(id: unknown, body: unknown) {
      const { run, data } = await open(id, body, BudgetBody);
      return change(id, run, (g) => setBudget(g, (data as z.infer<typeof BudgetBody>).budget));
    },
  };
}
