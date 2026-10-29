import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../lib/api-client";
import { findSpeakerSprite, speakerHasCutoutAlpha, speakerNameKey } from "../../lib/speaker-sprites";
import { FaceLayers } from "./FacePlate";

const DISPLAY_KEY = ["otome-forge", "speaker-display"] as const;
const DISPLAY_CACHE_MAX = 8;
const CACHE_MS = 30_000;

/** Images stay offstage until decoded; changing speakers aborts obsolete loads without retaining old pixels. */
function imageOf(url: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const finish = (error?: unknown) => {
      signal.removeEventListener("abort", abort);
      image.onload = null;
      image.onerror = null;
      if (error) reject(error);
      else resolve(image);
    };
    const abort = () => {
      finish(new DOMException("Sprite load cancelled", "AbortError"));
      image.src = "";
    };
    image.onload = () => finish();
    image.onerror = () => finish(new Error("Speaker sprite could not load"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    else image.src = url;
  });
}

/** Classify alpha without changing supplied pixels; failed cleanup has no display fallback. */
function rasterOf(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || !canvas.width || !canvas.height) throw new Error("Speaker sprite could not be decoded");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  return { transparent: speakerHasCutoutAlpha(pixels, canvas.width, canvas.height), canvas };
}

async function displaySprite(url: string, signal: AbortSignal): Promise<string> {
  const source = rasterOf(await imageOf(url, signal));
  if (source.transparent) return url;
  const status = await api
    .get<{ cleanupRevision?: number }>("/sprites/cleanup/status", { signal })
    .catch((error: unknown) => {
      if (signal.aborted) throw error;
      return null;
    });
  const cleaned = await api.post<{ cells?: Array<{ base64?: string }> }>(
    "/sprites/cleanup",
    {
      cells: [{ expression: "full_neutral", base64: source.canvas.toDataURL("image/png") }],
      cleanupStrength: 35,
      engine: status?.cleanupRevision !== undefined && status.cleanupRevision >= 2 ? "builtin" : "auto",
    },
    { signal },
  );
  const bytes = cleaned?.cells?.[0]?.base64;
  if (!bytes || !/^(?:data:image\/png;base64,)?[a-z0-9+/]+={0,2}$/iu.test(bytes))
    throw new Error("Sprite cleanup returned no PNG");
  const cutout = bytes.startsWith("data:") ? bytes : `data:image/png;base64,${bytes}`;
  if (!rasterOf(await imageOf(cutout, signal)).transparent) throw new Error("Speaker sprite cleanup stayed opaque");
  return cutout;
}

/** A fresh named line begins empty; no state or crossfade layer belongs to the previous speaker. */
export function SpeakerPlate({ name, lineKey }: { name: string; lineKey: string }) {
  const queryClient = useQueryClient();
  const selected = useQuery({
    queryKey: ["otome-forge", "speaker-card", speakerNameKey(name), lineKey],
    queryFn: ({ signal }) => findSpeakerSprite(name, (path) => api.get<unknown>(path, { signal })),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const source = selected.isSuccess && !selected.isFetching ? selected.data : null;
  const display = useQuery({
    queryKey: [...DISPLAY_KEY, source],
    queryFn: ({ signal }) => displaySprite(source!, signal),
    enabled: !!source,
    staleTime: CACHE_MS,
    gcTime: CACHE_MS,
    retry: false,
  });
  useEffect(() => {
    const idle = queryClient
      .getQueryCache()
      .findAll({ queryKey: DISPLAY_KEY })
      .filter((query) => query.queryKey.at(-1) !== null && !query.isActive() && query.state.fetchStatus === "idle")
      .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt);
    for (const query of idle.slice(DISPLAY_CACHE_MAX - 1))
      queryClient.removeQueries({ queryKey: query.queryKey, exact: true });
  }, [display.data, queryClient]);
  const [broken, setBroken] = useState<string | null>(null);
  const url = source && display.isSuccess && !display.isFetching ? display.data : null;
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
