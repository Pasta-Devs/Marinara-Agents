import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api-client";

type CachedMedia = {
  objectUrl: string | null;
  promise: Promise<string | null>;
  users: number;
  releaseTimer: ReturnType<typeof setTimeout> | null;
};

const mediaCache = new Map<string, CachedMedia>();
const MEDIA_CACHE_RETENTION_MS = 2 * 60_000;

const ENGINE_AVATAR_PREFIX = "/api/avatars/file/";

function variantUrl(imageUrl: string, width?: number): string {
  // Engine avatars are card PNGs of 1-2.5 MB; the package serves a small copy of them (0.3.41).
  if (width && imageUrl.startsWith(ENGINE_AVATAR_PREFIX)) {
    const fileName = imageUrl.slice(ENGINE_AVATAR_PREFIX.length).split(/[?#]/u)[0];
    return `/api/slurp2/engine-avatars/${fileName}?width=${width}`;
  }
  if (!width || !imageUrl.startsWith("/api/slurp2/")) return imageUrl;
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
        if (!response.ok) {
          mediaCache.delete(imageUrl);
          return null;
        }
        entry.objectUrl = URL.createObjectURL(await response.blob());
        return entry.objectUrl;
      })
      .catch(() => {
        mediaCache.delete(imageUrl);
        return null;
      });
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
    mediaCache.delete(imageUrl);
    // Revoke through the promise: a fetch still in flight when the timer fires used to resolve into
    // an object URL on an entry nobody held any more, and that URL was never revoked.
    void cached.promise.then((objectUrl) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    });
  }, MEDIA_CACHE_RETENTION_MS);
}

/**
 * NoodleR images are served by the package's own access-checked media route, and every
 * capability-package route sits behind the Engine's X-Admin-Secret gate. A plain `<img src>`
 * cannot send that header, so the browser gets a 403 and the card falls back to showing the
 * bare image prompt. Fetch those URLs through the API client instead and hand the element an
 * object URL. Engine-native URLs (character galleries) are returned untouched; an Engine avatar asked for at a
 * width goes through the package's small-copy route instead.
 */
export function useSlurpMediaSrc(
  imageUrl: string | null | undefined,
  options: { enabled?: boolean; width?: number } = {},
): string | null {
  return useSlurpMediaResolution(imageUrl, options).src;
}

/**
 * The resolved source, and whether the fetch failed. A non-OK response resolves to no object URL;
 * without `failed` a post picture that could not load shimmered as "loading" forever (R1-060).
 */
function useSlurpMediaResolution(
  imageUrl: string | null | undefined,
  options: { enabled?: boolean; width?: number },
): { src: string | null; failed: boolean } {
  // `null` while the fetch is in flight; `objectUrl: null` once it failed.
  const [resolved, setResolved] = useState<{ objectUrl: string | null } | null>(null);
  const requestedUrl = imageUrl ? variantUrl(imageUrl, options.width) : imageUrl;
  const managed = requestedUrl?.startsWith("/api/slurp2/") === true;
  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!requestedUrl || !managed || !enabled) {
      setResolved(null);
      return;
    }
    let cancelled = false;
    const cached = retainMedia(requestedUrl);
    void cached.promise.then((objectUrl) => {
      if (!cancelled) setResolved({ objectUrl });
    });
    return () => {
      cancelled = true;
      releaseMedia(requestedUrl, cached);
      setResolved(null);
    };
  }, [enabled, managed, requestedUrl]);

  if (!imageUrl) return { src: null, failed: false };
  if (!managed) return { src: requestedUrl ?? null, failed: false };
  return { src: resolved?.objectUrl ?? null, failed: resolved !== null && resolved.objectUrl === null };
}

export function useNearViewportSlurpMediaSrc(
  imageUrl: string | null | undefined,
  options: { eager?: boolean; width?: number; rootMargin?: string } = {},
) {
  const [nearViewport, setNearViewport] = useState(options.eager ?? false);
  // About two phone screens ahead: at 600 px a fast flick outran the fetch and showed empty frames (0.3.6).
  const rootMargin = options.rootMargin ?? "1600px 0px";
  // React calls a ref callback with `null` when the node detaches. Returning early there left one
  // observer alive per card that unmounted before it ever entered the viewport.
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observe = useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
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
          if (observerRef.current === observer) observerRef.current = null;
        },
        { rootMargin },
      );
      observerRef.current = observer;
      observer.observe(node);
    },
    [nearViewport, rootMargin],
  );
  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    },
    [],
  );
  const { src, failed } = useSlurpMediaResolution(imageUrl, { enabled: nearViewport, width: options.width });
  // A failed fetch is not loading: the card drops the frame, as it does when the <img> errors.
  return { src, observe, loading: Boolean(imageUrl && !src && !failed), failed };
}
