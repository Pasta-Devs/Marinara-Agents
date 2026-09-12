/**
 * The two dials that decide how loud and how large the world is.
 *
 * Pure, like the other Slurp rule modules.
 *
 * A review counted thirty-two hardcoded constants across the world machinery and one setting. Most
 * of those should stay hardcoded — name banks, curve shapes, weight tables are tuning, not
 * preferences. But three were decisions made on the player's behalf: how often the world asks
 * things of them, how big the platform feels, and whether reactions land while they read.
 *
 * These are deliberately two dials and not eight toggles. Surface sprawl was itself one of the
 * review's findings, and a settings page nobody can hold in their head is worse than a default
 * somebody occasionally disagrees with. Activity covers the world rates and the in-session pulse
 * together, because a player who wants a quiet world wants both quiet.
 */

export const SLURP_WORLD_ACTIVITY = ["off", "quiet", "normal", "busy"] as const;
export type SlurpWorldActivity = (typeof SLURP_WORLD_ACTIVITY)[number];
export const SLURP_DEFAULT_WORLD_ACTIVITY: SlurpWorldActivity = "normal";

export const SLURP_PLATFORM_SCALE = ["intimate", "normal", "large"] as const;
export type SlurpPlatformScale = (typeof SLURP_PLATFORM_SCALE)[number];
export const SLURP_DEFAULT_PLATFORM_SCALE: SlurpPlatformScale = "normal";

/**
 * Multiplier on how often the world acts, and on the in-session pulse.
 *
 * `off` is a real off switch and returns zero: no commissions, no questions, no unprompted
 * messages, no reactions arriving while you read. Somebody who wants to write undisturbed should
 * get exactly that, not a quieter version of being interrupted.
 *
 * `busy` stops well short of doubling twice over. The per-tick action ceiling and the unanswered
 * queue limit still apply above this, so the dial changes the rhythm rather than defeating the
 * readable-handful rule.
 */
export function slurpWorldActivityMultiplier(level: SlurpWorldActivity | undefined): number {
  switch (level ?? SLURP_DEFAULT_WORLD_ACTIVITY) {
    case "off":
      return 0;
    case "quiet":
      return 0.4;
    case "busy":
      return 2.2;
    default:
      return 1;
  }
}

/**
 * Multiplier on synthetic reach.
 *
 * Applies to the invented audience only. Real followers — people actually in the funnel — are
 * never scaled, because they are a count of things that happened and multiplying them would be a
 * lie rather than a setting.
 */
export function slurpPlatformScaleMultiplier(level: SlurpPlatformScale | undefined): number {
  switch (level ?? SLURP_DEFAULT_PLATFORM_SCALE) {
    case "intimate":
      return 0.25;
    case "large":
      return 4;
    default:
      return 1;
  }
}

const inList = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  list.includes(value as T) ? (value as T) : fallback;

/** Read stored values back, falling back rather than throwing on anything unexpected. */
export function readSlurpWorldActivity(value: unknown): SlurpWorldActivity {
  return inList(SLURP_WORLD_ACTIVITY, value, SLURP_DEFAULT_WORLD_ACTIVITY);
}

export function readSlurpPlatformScale(value: unknown): SlurpPlatformScale {
  return inList(SLURP_PLATFORM_SCALE, value, SLURP_DEFAULT_PLATFORM_SCALE);
}
