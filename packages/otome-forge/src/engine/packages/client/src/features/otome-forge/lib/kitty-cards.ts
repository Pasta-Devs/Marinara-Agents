// ──────────────────────────────────────────────
// Otome Hearth: Kitty Cards' pre-made cards (0.35.0): each card's kitten art and its breed
// ──────────────────────────────────────────────
// Each of the 20 cards is a transparent WebP kitten of its own breed, shipped in the package
// (packages/otome-forge/kitty/<card>.webp) and served by the Engine as a package asset (scripts/build-feature-packages.mjs
// `contributions.assets.paths`). The breed is the card's accessible name; a card a painted kitten takes
// (SH/kitty.ts kittenCards) is named for its owner instead ("ui.otomeForge.kitty.asKitten").
import type { KittyCard } from "../shared/kitty";

/** Each card's breed, as a literal catalog key (C/locales/en.json). */
export const KITTY_BREED_KEYS: Readonly<Record<KittyCard, string>> = {
  "rose-1": "ui.otomeForge.kitty.breedRose1",
  "rose-2": "ui.otomeForge.kitty.breedRose2",
  "rose-3": "ui.otomeForge.kitty.breedRose3",
  "rose-4": "ui.otomeForge.kitty.breedRose4",
  "rose-5": "ui.otomeForge.kitty.breedRose5",
  "sky-1": "ui.otomeForge.kitty.breedSky1",
  "sky-2": "ui.otomeForge.kitty.breedSky2",
  "sky-3": "ui.otomeForge.kitty.breedSky3",
  "sky-4": "ui.otomeForge.kitty.breedSky4",
  "sky-5": "ui.otomeForge.kitty.breedSky5",
  "lemon-1": "ui.otomeForge.kitty.breedLemon1",
  "lemon-2": "ui.otomeForge.kitty.breedLemon2",
  "lemon-3": "ui.otomeForge.kitty.breedLemon3",
  "lemon-4": "ui.otomeForge.kitty.breedLemon4",
  "lemon-5": "ui.otomeForge.kitty.breedLemon5",
  "mint-1": "ui.otomeForge.kitty.breedMint1",
  "mint-2": "ui.otomeForge.kitty.breedMint2",
  "mint-3": "ui.otomeForge.kitty.breedMint3",
  "mint-4": "ui.otomeForge.kitty.breedMint4",
  "mint-5": "ui.otomeForge.kitty.breedMint5",
};

/**
 * Where the Engine serves a card's kitten. `packageVersion` (the host's `capabilityProps.packageVersion`) makes an
 * update's art a new URL, so the browser never keeps an old one.
 */
export function kittyCardUrl(card: KittyCard, packageVersion?: string | null): string {
  const url = `/api/capability-packages/otome-forge/assets/kitty/${card}.webp`;
  return packageVersion ? `${url}?v=${encodeURIComponent(packageVersion)}` : url;
}
