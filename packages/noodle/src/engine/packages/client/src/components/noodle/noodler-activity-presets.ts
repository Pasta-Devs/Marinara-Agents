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

export type NoodlerActivityPreset =
  | "manual"
  | "occasional"
  | "lively"
  | "veryActive";

/** Ordered quietest-first, which is also the order the onboarding wizard offers them in. */
export const NOODLER_ACTIVITY_PRESETS: readonly NoodlerActivityPreset[] = [
  "manual",
  "occasional",
  "lively",
  "veryActive",
] as const;

/** Posts per day for each preset. `manual` has none: it disables automatic posting. */
export const NOODLER_ACTIVITY_PRESET_POSTS_PER_DAY: Record<
  Exclude<NoodlerActivityPreset, "manual">,
  number
> = {
  occasional: 2,
  lively: 4,
  veryActive: 8,
};

/** The shipped pace. Confirmed product decision: at most four posts a day across all Creators. */
export const NOODLER_DEFAULT_ACTIVITY_PRESET: NoodlerActivityPreset = "lively";

/** One step quieter than the default, used by the one-click calm-down action. */
export const NOODLER_QUIETER_ACTIVITY_PRESET: Exclude<
  NoodlerActivityPreset,
  "manual"
> = "occasional";

export function noodlerPostsPerDayForPreset(
  preset: Exclude<NoodlerActivityPreset, "manual">,
): number {
  return NOODLER_ACTIVITY_PRESET_POSTS_PER_DAY[preset];
}

/**
 * Which preset a stored pace corresponds to, or null when the number sits between presets.
 * A player who typed an exact number keeps it: the settings UI shows no preset as selected
 * rather than silently rounding their choice to the nearest one.
 */
export function noodlerActivityPresetForSettings(input: {
  autoPostingScheduleEnabled: boolean;
  postsPerDay: number;
}): NoodlerActivityPreset | null {
  if (!input.autoPostingScheduleEnabled) return "manual";
  const match = (
    Object.keys(NOODLER_ACTIVITY_PRESET_POSTS_PER_DAY) as Array<
      Exclude<NoodlerActivityPreset, "manual">
    >
  ).find(
    (preset) =>
      NOODLER_ACTIVITY_PRESET_POSTS_PER_DAY[preset] === input.postsPerDay,
  );
  return match ?? null;
}

/** The settings patch a preset implies. Manual turns the scheduler off and leaves the rate alone. */
export function noodlerActivityPresetPatch(preset: NoodlerActivityPreset): {
  autoPostingScheduleEnabled: boolean;
  postsPerDay?: number;
} {
  if (preset === "manual") return { autoPostingScheduleEnabled: false };
  return {
    autoPostingScheduleEnabled: true,
    postsPerDay: noodlerPostsPerDayForPreset(preset),
  };
}
