import { useState } from "react";
import { cn } from "../../../lib/utils";
import { SLP_IMG_FRAME_CLASS, slpImgFade } from "../../base/chrome/SlpChrome";
import { slpPostFrameStyle, slpPostLoadedRatio, slpPostMediaRatio } from "./slp-post-ratio";

/**
 * A post's picture in its own frame (V): reserved from the stored size before the picture arrives,
 * so nothing jumps; shimmer until it has loaded, then the fade. Only a post without a stored size
 * (an old gallery link) adjusts the frame, once, to its first picture. Like Instagram, the other
 * pictures of a carousel keep the first one's frame.
 */
export function SlpPostMediaFrame({
  src,
  size,
  alt,
  className,
  onError,
}: {
  src: string | null;
  size?: { width?: number | null; height?: number | null } | null;
  alt: string;
  className?: string;
  onError?: () => void;
}) {
  const [loaded, setLoaded] = useState<number | null>(null);
  const ratio = loaded ?? slpPostMediaRatio(size);
  const style = slpPostFrameStyle(ratio);
  if (!src) return <span className={cn("block", SLP_IMG_FRAME_CLASS, className)} style={style} aria-hidden="true" />;
  return (
    <div
      className={cn("relative overflow-hidden bg-[var(--slurp-media-stage,#17131a)]", SLP_IMG_FRAME_CLASS, className)}
      style={style}
      data-slp-ratio={ratio.toFixed(3)}
    >
      <img
        key={src}
        src={src}
        {...slpImgFade}
        onLoad={(event) => {
          slpImgFade.onLoad(event);
          const image = event.currentTarget;
          if (loaded !== null || (size?.width && size?.height)) return;
          const next = slpPostLoadedRatio(ratio, { width: image.naturalWidth, height: image.naturalHeight });
          if (!next) return;
          setLoaded(next);
          // The cut mark was measured in the reserved frame; the new one fits unless the ratio was clamped.
          image.toggleAttribute(
            "data-slp-cut",
            Math.abs(Math.log(next / (image.naturalWidth / image.naturalHeight))) > 0.04,
          );
        }}
        onError={onError}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="slp-crop h-full w-full object-cover"
      />
    </div>
  );
}
