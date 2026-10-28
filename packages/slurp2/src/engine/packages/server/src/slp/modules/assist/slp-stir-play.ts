// Stir's plays, the pure half (W): which steps are plays at all, and "Do it" as a loop over exactly the
// steps the player saw. The runner is passed in, so the rule runs in tests; the service passes the
// action layer's one runner.
import { isSlpActionName, SLP_ACTION_META, type SlpActionName } from "../../../../../shared/src/slp/slp-actions.js";
import type { SlpStirPlay, SlpStirStep } from "../../../../../shared/src/slp/slp-stir.js";

/** Levers on Stir's own rows ("End it") that are not deck cards: without them "End it" did nothing. */
const SLP_STIR_ROW_LEVERS: ReadonlySet<string> = new Set(["end-drama", "end-bond"]);

/**
 * A step Stir may run: a deck lever, a row lever, or a Support desk tool (the desk opens its tools in
 * the same play sheet). Writing help and pictures stay in their own fields.
 */
export const isSlpStirPlayAction = (name: string): name is SlpActionName =>
  isSlpActionName(name) &&
  (SLP_ACTION_META[name].deck || SLP_ACTION_META[name].category === "desk" || SLP_STIR_ROW_LEVERS.has(name));

/**
 * The input a play runs with: never a dry run. `preview` belongs to outside helpers (Mari, the brand
 * picker); a Stir step that carried it would say "done" and change nothing (0.3.1).
 */
export const slpStirPlayInput = (input: Record<string, unknown>): Record<string, unknown> => {
  const { preview: _preview, ...rest } = input;
  return rest;
};

/**
 * A "cannot" line the app words itself (0.3.1), so it reads in the player's language: a step that is
 * no play at all, or one whose input the preview refused. The planner's own lines stay as written.
 */
export const SLP_STIR_CANT_UNKNOWN = "slp-stir:unknown:";
export const SLP_STIR_CANT_INVALID = "slp-stir:invalid";

/**
 * Split steps into plays and the plain-words reasons the rest cannot happen. An unknown name is said,
 * never dropped in silence.
 */
export function slpSortStirSteps(steps: readonly SlpStirStep[]): {
  plays: { action: SlpActionName; input: Record<string, unknown> }[];
  cant: string[];
} {
  const plays: { action: SlpActionName; input: Record<string, unknown> }[] = [];
  const cant: string[] = [];
  for (const step of steps) {
    if (isSlpStirPlayAction(step.action)) plays.push({ action: step.action, input: slpStirPlayInput(step.input) });
    else cant.push(`${SLP_STIR_CANT_UNKNOWN}${step.action}`);
  }
  return { plays, cant };
}

export type SlpStirRan<Undo> = { ok: true; value: unknown; undo: Undo | null } | { ok: false; error: string };

/**
 * Do it: run exactly these steps, in this order, each once, with the input the player saw. A step
 * that fails does not stop the others (each is its own beat); a step that is not a play never runs.
 */
export async function slpRunStirSteps<Undo>(
  steps: readonly SlpStirStep[],
  run: (action: SlpActionName, input: Record<string, unknown>) => Promise<SlpStirRan<Undo>>,
): Promise<{
  steps: SlpStirPlay["steps"];
  results: { ok: boolean; value: unknown; error: string | null }[];
  undo: Undo[];
}> {
  const out: SlpStirPlay["steps"] = [];
  const results: { ok: boolean; value: unknown; error: string | null }[] = [];
  const undo: Undo[] = [];
  for (const step of steps) {
    const ran: SlpStirRan<Undo> = isSlpStirPlayAction(step.action)
      ? await run(step.action, slpStirPlayInput(step.input))
      : { ok: false, error: `Slurp cannot do "${step.action}" yet.` };
    if (ran.ok && ran.undo) undo.push(ran.undo);
    results.push(ran.ok ? { ok: true, value: ran.value, error: null } : { ok: false, value: null, error: ran.error });
    out.push({ action: step.action, input: step.input, ok: ran.ok, error: ran.ok ? null : ran.error });
  }
  return { steps: out, results, undo };
}

/**
 * A Support plan plays once (0.3.0 review): a second "Do it" (a double tap, a card not yet refreshed,
 * a second tab) gets null instead of playing it again. The id is held from the check until the play
 * is marked, so two requests at the same time cannot both pass.
 * ponytail: in-process lock, the Engine is one process; a claim column if it ever runs as several.
 */
export function slpSupportPlayOnce() {
  const running = new Set<string>();
  return async <T>(
    messageId: string | undefined,
    playedAlready: (messageId: string) => Promise<boolean>,
    play: () => Promise<T>,
  ): Promise<T | null> => {
    if (!messageId) return play();
    if (running.has(messageId)) return null;
    running.add(messageId);
    try {
      return (await playedAlready(messageId)) ? null : await play();
    } finally {
      running.delete(messageId);
    }
  };
}

/**
 * What an Undo may put back (0.3.1): only the keys that still hold what the play set. A later change
 * by the player, a Support talk or another play is kept. An entry from before `set` was kept puts
 * everything back, as it did then.
 */
export function slpUndoPatch<T extends Record<string, unknown>>(
  current: Readonly<Record<string, unknown>>,
  before: T,
  set: Partial<T> | undefined,
): Partial<T> {
  if (!set) return before;
  const same = (left: unknown, right: unknown) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  return Object.fromEntries(
    Object.entries(before).filter(([key]) => key in set && same(current[key], set[key])),
  ) as Partial<T>;
}
