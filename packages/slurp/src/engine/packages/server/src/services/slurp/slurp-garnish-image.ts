import { basename } from "node:path";
import { NOODLER_MEDIA_PREFIX, resolveNoodlerMediaAbsolutePath, unlinkNoodlerMedia } from "./slurp-media.js";

/**
 * Ad artwork. Ads have no Slurp account, so their media lives in its own per-ad folder rather
 * than an account folder, and is served by the ad image route instead of the account routes.
 */
const NOODLER_AD_IMAGE_URL_PREFIX = "/api/slurp/noodler/ads/";

/** Staging namespace for one ad's generated images. */
export function garnishAdMediaNamespace(adId: string): string {
  return `${NOODLER_MEDIA_PREFIX}ads/${adId}`;
}

export function garnishAdImageUrl(adId: string, mediaPath: string): string {
  return `${NOODLER_AD_IMAGE_URL_PREFIX}${encodeURIComponent(adId)}/image/${encodeURIComponent(basename(mediaPath))}`;
}

/** The stored media path behind an ad image URL, or null when the URL is external or malformed. */
export function readGarnishAdMediaPath(adId: string, url: string | null | undefined): string | null {
  if (!url) return null;
  const prefix = `${NOODLER_AD_IMAGE_URL_PREFIX}${encodeURIComponent(adId)}/image/`;
  if (!url.startsWith(prefix)) return null;
  let fileName: string;
  try {
    fileName = decodeURIComponent(url.slice(prefix.length));
  } catch {
    return null;
  }
  // Reject anything that is not a bare file name: the path is joined against the media dir.
  if (!fileName || basename(fileName) !== fileName || /[\\/]/u.test(fileName)) return null;
  return `${garnishAdMediaNamespace(adId)}/${fileName}`;
}

export function resolveGarnishAdImageAbsolutePath(adId: string, url: string | null | undefined): string | null {
  const mediaPath = readGarnishAdMediaPath(adId, url);
  return mediaPath ? resolveNoodlerMediaAbsolutePath(mediaPath) : null;
}

/** Drop an ad's previous artwork once its replacement is stored. */
export function unlinkGarnishAdImage(adId: string, url: string | null | undefined): void {
  const mediaPath = readGarnishAdMediaPath(adId, url);
  if (mediaPath) unlinkNoodlerMedia(mediaPath);
}
