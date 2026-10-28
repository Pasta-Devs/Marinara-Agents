import type { CSSProperties } from "react";

/**
 * Adaptive post frames (V, user: "each post shows its picture in its own ratio, like Instagram"). A
 * frame takes its picture's own shape, clamped between 4:5 (tall) and 1.91:1 (wide); a picture
 * outside that range fills the nearest end and is cut at the edges, like Instagram.
 */
export const SLP_POST_RATIO_TALL = 4 / 5;
export const SLP_POST_RATIO_WIDE = 1.91;
/** A picture with no known size: Slurp's default post picture (1024 × 1280). */
export const SLP_POST_RATIO_DEFAULT = 4 / 5;

export function slpPostMediaRatio(size?: { width?: number | null; height?: number | null } | null): number {
  const width = size?.width ?? 0;
  const height = size?.height ?? 0;
  if (!(width > 0 && height > 0)) return SLP_POST_RATIO_DEFAULT;
  return Math.min(SLP_POST_RATIO_WIDE, Math.max(SLP_POST_RATIO_TALL, width / height));
}

/**
 * The frame, reserved before its picture loads: full width in the ratio, and never taller than the
 * screen allows (a tall picture on a wide screen gets narrower, centred, instead of being cut).
 * Inline style: an arbitrary Tailwind ratio class does not exist in the Engine's build.
 */
export function slpPostFrameStyle(ratio: number): CSSProperties {
  return { aspectRatio: ratio, width: "100%", maxWidth: `calc(min(36rem, 72dvh) * ${ratio.toFixed(4)})` };
}

/** The loaded picture's ratio when it differs from the reserved one (a post with no stored size). */
export function slpPostLoadedRatio(reserved: number, natural: { width: number; height: number }): number | null {
  const ratio = slpPostMediaRatio(natural);
  return natural.width > 0 && Math.abs(Math.log(ratio / reserved)) > 0.02 ? ratio : null;
}
