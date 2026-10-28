/**
 * `accept` for a picture file input. On Android, Chrome answers an image-only `accept` with the
 * system photo picker, which lists only a few albums (Camera, Screenshots, Downloads). Without
 * `accept` Android offers its full file browser too, so every folder is reachable. Callers check
 * `file.type` themselves, so a non-image pick still gets a clear error.
 */
export function slpImageFileAccept(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent) {
  return /Android/u.test(userAgent) ? undefined : "image/*";
}
