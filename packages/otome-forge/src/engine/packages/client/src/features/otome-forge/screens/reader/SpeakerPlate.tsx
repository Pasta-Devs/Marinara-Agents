import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../lib/api-client";
import { findSpeakerSprite, speakerNameKey } from "../../lib/speaker-sprites";
import { useSpriteDisplay } from "../../hooks/use-sprite-display";
import { FaceLayers } from "./FacePlate";

/** The reader shares this selection so descriptions and the stage follow the same speaker. */
export function useSpeakerSprite(name: string | null, lineKey: string) {
  return useQuery({
    queryKey: ["otome-forge", "speaker-card", speakerNameKey(name ?? ""), lineKey],
    queryFn: ({ signal }) => findSpeakerSprite(name!, (path) => api.get<unknown>(path, { signal })),
    enabled: !!name,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

/** A fresh named line begins empty; no state or crossfade layer belongs to the previous speaker. */
export function SpeakerPlate({ name, source }: { name: string; source: string | null }) {
  const url = useSpriteDisplay(source);
  const [broken, setBroken] = useState<string | null>(null);
  if (!url || broken === url) return null;
  return (
    <figure
      className="of-face"
      data-face="plain"
      data-speaking="true"
      data-art="portrait"
      role="img"
      aria-label={name}
      onErrorCapture={() => setBroken(url)}
    >
      <FaceLayers url={url} cut={[url]} />
    </figure>
  );
}
