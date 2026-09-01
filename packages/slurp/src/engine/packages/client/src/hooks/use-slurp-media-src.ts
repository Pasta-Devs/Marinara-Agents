import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api-client";

type CachedMedia = {
  objectUrl: string | null;
  promise: Promise<string | null>;
  users: number;
  releaseTimer: ReturnType<typeof setTimeout> | null;
};

const mediaCache = new Map<string, CachedMedia>();

function variantUrl(imageUrl: string, width?: number): string {
  if (!width || !imageUrl.startsWith("/api/slurp/")) return imageUrl;
  const url = new URL(imageUrl, window.location.origin);
  url.searchParams.set("width", String(width));
  return `${url.pathname}${url.search}`;
}

function retainMedia(imageUrl: string): CachedMedia {
  let cached = mediaCache.get(imageUrl);
  if (!cached) {
    const entry: CachedMedia = {
      objectUrl: null,
      users: 0,
      releaseTimer: null,
      promise: Promise.resolve(null),
    };
    entry.promise = api
      .raw(imageUrl.slice("/api".length), { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) return null;
        entry.objectUrl = URL.createObjectURL(await response.blob());
        return entry.objectUrl;
      })
      .catch(() => null);
    cached = entry;
    mediaCache.set(imageUrl, cached);
  }
  if (cached.releaseTimer) {
    clearTimeout(cached.releaseTimer);
    cached.releaseTimer = null;
  }
  cached.users += 1;
  return cached;
}

function releaseMedia(imageUrl: string, cached: CachedMedia): void {
  cached.users = Math.max(0, cached.users - 1);
  if (cached.users > 0 || cached.releaseTimer) return;
  cached.releaseTimer = setTimeout(() => {
    if (cached.users > 0) return;
    if (cached.objectUrl) URL.revokeObjectURL(cached.objectUrl);
    mediaCache.delete(imageUrl);
  }, 30_000);
}

/**
 * NoodleR images are served by the package's own access-checked media route, and every
 * capability-package route sits behind the Engine's X-Admin-Secret gate. A plain `<img src>`
 * cannot send that header, so the browser gets a 403 and the card falls back to showing the
 * bare image prompt. Fetch those URLs through the API client instead and hand the element an
 * object URL. Engine-native URLs (character galleries, avatars) are returned untouched.
 */
export function useSlurpMediaSrc(
  imageUrl: string | null | undefined,
  options: { enabled?: boolean; width?: number } = {},
): string | null {
  const [resolved, setResolved] = useState<string | null>(null);
  const managed = imageUrl?.startsWith("/api/slurp/") === true;
  const enabled = options.enabled ?? true;
  const requestedUrl = imageUrl && managed ? variantUrl(imageUrl, options.width) : imageUrl;

  useEffect(() => {
    if (!requestedUrl || !managed || !enabled) {
      setResolved(null);
      return;
    }
    let cancelled = false;
    const cached = retainMedia(requestedUrl);
    void cached.promise.then((objectUrl) => {
      if (!cancelled && objectUrl) setResolved(objectUrl);
    });
    return () => {
      cancelled = true;
      releaseMedia(requestedUrl, cached);
      setResolved(null);
    };
  }, [enabled, managed, requestedUrl]);

  if (!imageUrl) return null;
  return managed ? resolved : requestedUrl;
}

export function useNearViewportSlurpMediaSrc(
  imageUrl: string | null | undefined,
  options: { eager?: boolean; width?: number; rootMargin?: string } = {},
) {
  const [nearViewport, setNearViewport] = useState(options.eager ?? false);
  const rootMargin = options.rootMargin ?? "600px 0px";
  const observe = useCallback(
    (node: HTMLElement | null) => {
      if (!node || nearViewport) return;
      if (typeof IntersectionObserver === "undefined") {
        setNearViewport(true);
        return;
      }
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;
          setNearViewport(true);
          observer.disconnect();
        },
        { rootMargin },
      );
      observer.observe(node);
    },
    [nearViewport, rootMargin],
  );
  const src = useSlurpMediaSrc(imageUrl, { enabled: nearViewport, width: options.width });
  return { src, observe, loading: Boolean(imageUrl && !src) };
}
