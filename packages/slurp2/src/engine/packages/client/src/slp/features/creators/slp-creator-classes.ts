/** Shared control classes for the Backstage creator table and its editors. */
import { focusRing } from "../../base/chrome/slp-focus";
export { focusRing };
export const quietButton = `inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] hover:bg-[var(--slurp-canvas)] disabled:opacity-50 ${focusRing}`;
export const accentButton = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50 ${focusRing}`;
export const selectClass = `min-h-11 w-full rounded-lg bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] disabled:opacity-50 sm:text-sm ${focusRing}`;
export const noteClass =
  "rounded-lg bg-[var(--slurp-canvas)] p-3 text-xs leading-5 text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]";
