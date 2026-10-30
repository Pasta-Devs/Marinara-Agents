import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../lib/api-client";
import { findSpeakerSprite, speakerNameKey } from "../../lib/speaker-sprites";
import { useSpriteDisplay } from "../../hooks/use-sprite-display";
import { FaceLayers } from "./FacePlate";

/** One line owns its speaker's selection, displayed image and load failures. */
export function useSpeakerSprite(name: string | null, lineKey: string) {
  const selected = useQuery({
    queryKey: ["otome-forge", "speaker-card", speakerNameKey(name ?? ""), lineKey],
    queryFn: ({ signal }) => findSpeakerSprite(name!, (path) => api.get<unknown>(path, { signal })),
    enabled: !!name,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const source = selected.isSuccess && !selected.isFetching ? selected.data : null;
  const url = useSpriteDisplay(source);
  const [broken, setBroken] = useState<{ lineKey: string; url: string } | null>(null);
  return {
    url: broken?.lineKey === lineKey && broken.url === url ? null : url,
    onError: () => {
      if (url) setBroken({ lineKey, url });
    },
  };
}

/** A fresh named line begins empty; no state or crossfade layer belongs to the previous speaker. */
export function SpeakerPlate({ name, url, onError }: { name: string; url: string | null; onError: () => void }) {
  if (!url) return null;
  return (
    <figure
      className="of-face"
      data-face="plain"
      data-speaking="true"
      data-art="portrait"
      role="img"
      aria-label={name}
      onErrorCapture={onError}
    >
      <FaceLayers url={url} cut={[url]} />
    </figure>
  );
}
