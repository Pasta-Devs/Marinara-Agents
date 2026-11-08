// ──────────────────────────────────────────────
// Otome Hearth: a portrait circle's face framing (#2178), for every circle that shows a love interest's image
// (components/Avatar.tsx, the top bar's chip, the Wardrobe's). Once the image loads, a full-body look
// (lib/avatar-frame.ts) takes `.of-avatar-face`, which zooms it to the head and shoulders; a square or bust image, or
// one carrying its own crop, never does.
// ──────────────────────────────────────────────
import { useState, type SyntheticEvent } from "react";
import { isFullBody } from "./avatar-frame";

export function useFaceFrame(url: string | null | undefined, cropped = false) {
  // The image this circle knows is a full-body look; keyed by its url, so a new image starts unzoomed.
  const [fullBody, setFullBody] = useState<string | null>(null);
  if (cropped || !url) return { className: undefined, onLoad: undefined };
  return {
    className: fullBody === url ? "of-avatar-face" : undefined,
    onLoad: (event: SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = event.currentTarget;
      if (isFullBody(naturalWidth, naturalHeight)) setFullBody(url);
    },
  };
}
