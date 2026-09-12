/**
 * The single vocabulary for how busy NoodleR is.
 *
 * `postsPerDay` is a global ceiling across the whole Creator cast, not a per-Creator rate, so
 * adding Creators never speeds the feed up. It used to be described three different ways — named
 * presets in onboarding, a raw number in settings, and a one-way "quieter" button on the feed —
 * with nothing telling a player they were the same value. Every surface reads this table now.
 *
 * Manual is the absence of automatic posting rather than a rate, so it carries no number; callers
 * turn auto-posting off instead.
 */

export type SlurpActivityPreset = "manual" | "occasional" | "lively" | "veryActive";

/** Ordered quietest-first, which is also the order the onboarding wizard offers them in. */
export const SLURP_ACTIVITY_PRESETS: readonly SlurpActivityPreset[] = [
  "manual",
  "occasional",
  "lively",
  "veryActive",
] as const;

/** Posts per day for each preset. `manual` has none: it disables automatic posting. */
export const SLURP_ACTIVITY_PRESET_POSTS_PER_DAY: Record<Exclude<SlurpActivityPreset, "manual">, number> = {
  occasional: 2,
  lively: 4,
  veryActive: 8,
};

/** The shipped pace. Confirmed product decision: at most four posts a day across all Creators. */
export const SLURP_DEFAULT_ACTIVITY_PRESET: SlurpActivityPreset = "lively";

/** One step quieter than the default, used by the one-click calm-down action. */
export const SLURP_QUIETER_ACTIVITY_PRESET: Exclude<SlurpActivityPreset, "manual"> = "occasional";

export function slurpPostsPerDayForPreset(preset: Exclude<SlurpActivityPreset, "manual">): number {
  return SLURP_ACTIVITY_PRESET_POSTS_PER_DAY[preset];
}

/**
 * Which preset a stored pace corresponds to, or null when the number sits between presets.
 * A player who typed an exact number keeps it: the settings UI shows no preset as selected
 * rather than silently rounding their choice to the nearest one.
 */
export function slurpActivityPresetForSettings(input: {
  autoPostingScheduleEnabled: boolean;
  postsPerDay: number;
}): SlurpActivityPreset | null {
  if (!input.autoPostingScheduleEnabled) return "manual";
  const match = (
    Object.keys(SLURP_ACTIVITY_PRESET_POSTS_PER_DAY) as Array<Exclude<SlurpActivityPreset, "manual">>
  ).find((preset) => SLURP_ACTIVITY_PRESET_POSTS_PER_DAY[preset] === input.postsPerDay);
  return match ?? null;
}

/** The settings patch a preset implies. Manual turns the scheduler off and leaves the rate alone. */
export function slurpActivityPresetPatch(preset: SlurpActivityPreset): {
  autoPostingScheduleEnabled: boolean;
  postsPerDay?: number;
} {
  if (preset === "manual") return { autoPostingScheduleEnabled: false };
  return {
    autoPostingScheduleEnabled: true,
    postsPerDay: slurpPostsPerDayForPreset(preset),
  };
}
