/**
 * Every missing Creator picture in backfill order: profile by profile, the avatar before the banner.
 * The backfill takes the first one that makes progress, so one gap that can never be filled does
 * not stall the Creators after it.
 */
export function slurpArtworkGaps<T extends { avatarUrl: string | null; bannerUrl?: string | null }>(
  profiles: readonly T[],
): { target: T; kind: "avatar" | "banner" }[] {
  return profiles.flatMap((target) => [
    ...(target.avatarUrl ? [] : [{ target, kind: "avatar" as const }]),
    ...(target.bannerUrl ? [] : [{ target, kind: "banner" as const }]),
  ]);
}
