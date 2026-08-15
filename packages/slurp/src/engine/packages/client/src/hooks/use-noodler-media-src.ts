import { useEffect, useState } from "react";
import { api } from "../lib/api-client";

/**
 * NoodleR images are served by the package's own access-checked media route, and every
 * capability-package route sits behind the Engine's X-Admin-Secret gate. A plain `<img src>`
 * cannot send that header, so the browser gets a 403 and the card falls back to showing the
 * bare image prompt. Fetch those URLs through the API client instead and hand the element an
 * object URL. Engine-native URLs (character galleries, avatars) are returned untouched.
 */
export function useNoodlerMediaSrc(
  imageUrl: string | null | undefined,
): string | null {
  const [resolved, setResolved] = useState<string | null>(null);
  const managed = imageUrl?.startsWith("/api/slurp/") === true;

  useEffect(() => {
    if (!imageUrl || !managed) {
      setResolved(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const response = await api.raw(imageUrl.slice("/api".length));
        if (!response.ok) return;
        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setResolved(objectUrl);
      } catch {
        // A failed load leaves the card in its no-image state, same as a broken <img>.
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setResolved(null);
    };
  }, [imageUrl, managed]);

  if (!imageUrl) return null;
  return managed ? resolved : imageUrl;
}
