import type { ImgHTMLAttributes, ReactNode } from "react";
import { useSpriteDisplay } from "../hooks/use-sprite-display";

/** A retained look stays blank until its free display cleanup succeeds. */
export function LookImage({
  src,
  fallback = null,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: string | null; fallback?: ReactNode }) {
  const url = useSpriteDisplay(src ?? null);
  return url ? <img {...props} src={url} /> : fallback;
}
