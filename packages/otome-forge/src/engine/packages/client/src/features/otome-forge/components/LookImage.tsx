import type { ImgHTMLAttributes, ReactNode } from "react";
import { useSpriteDisplay } from "../hooks/use-sprite-display";

/**
 * A retained look stays blank until its free display cleanup succeeds; a server cut-out (`cut`) has no backdrop and is
 * shown as it is.
 */
export function LookImage({
  src,
  cut = false,
  fallback = null,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: string | null; cut?: boolean; fallback?: ReactNode }) {
  const url = useSpriteDisplay(src ?? null, !cut);
  return url ? <img {...props} src={url} /> : fallback;
}
