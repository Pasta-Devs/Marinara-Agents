import type { SaucelingStage } from "../../../../shared/src/features/agents/saucelings/types.js";

export type StageForms = Partial<Record<SaucelingStage, string>>;

/** A sauceling's pictures after `incoming` is saved over `forms`. A repaint keeps the pictures it replaces as the one
 *  set back (`saved`), and the set kept before goes; a stage with no picture yet leaves `saved` alone. `dropped`
 *  lists the documents nothing keeps any more. */
export function paintForms(
  forms: StageForms,
  saved: StageForms,
  incoming: StageForms,
): { forms: StageForms; saved: StageForms; dropped: string[] } {
  const replaced = (Object.keys(incoming) as SaucelingStage[]).flatMap((stage) =>
    forms[stage] ? ([[stage, forms[stage]]] as const) : [],
  );
  const next = { forms: { ...forms, ...incoming } };
  if (replaced.length === 0) return { ...next, saved, dropped: [] };
  return { ...next, saved: Object.fromEntries(replaced), dropped: Object.values(saved) };
}

/** Undo repaint: the saved pictures take the place of the ones they stand for, and those are saved in their turn, so
 *  a second press brings the repaint back. Null when nothing is saved. */
export function swapForms(forms: StageForms, saved: StageForms): { forms: StageForms; saved: StageForms } | null {
  const stages = Object.keys(saved) as SaucelingStage[];
  if (stages.length === 0) return null;
  const swapped = { forms: { ...forms }, saved: {} as StageForms };
  for (const stage of stages) {
    swapped.forms[stage] = saved[stage];
    if (forms[stage]) swapped.saved[stage] = forms[stage];
  }
  return swapped;
}
