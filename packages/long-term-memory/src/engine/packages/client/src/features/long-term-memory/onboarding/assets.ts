// The archivist pictures the package ships in assets/onboarding/ for setup and the tour.
export const LTM_ONBOARDING_SPRITES = [
  "activity-log",
  "activity-log-small",
  "archive-working",
  "archive-working-mini",
  "archivist-modes",
  "chibi",
  "done-filed",
  "done-fresh",
  "graph-model",
  "graph-model-small",
  "headstart-ladder",
  "hello-drawer",
  "inchat-bubble",
  "inchat-bubble-small",
  "reading-tape",
  "reading-tape-small",
  "review-stamp",
  "review-stamp-small",
  "settings-dials",
  "settings-dials-small",
  "sources-crate",
  "sources-crate-small",
  "vault-browse",
  "vault-browse-small",
  "vault-idle",
  "welcome-bell",
  "welcome-bell-small",
  "whats-new-cabinet",
] as const;

export type LtmOnboardingSprite = (typeof LTM_ONBOARDING_SPRITES)[number];

/** The Engine serves package assets here; the version busts the browser cache after an update. */
export function ltmOnboardingSpriteUrl(sprite: LtmOnboardingSprite, packageVersion?: string | null): string {
  const url = `/api/capability-packages/long-term-memory/assets/assets/onboarding/${sprite}.webp`;
  return packageVersion ? `${url}?v=${encodeURIComponent(packageVersion)}` : url;
}
