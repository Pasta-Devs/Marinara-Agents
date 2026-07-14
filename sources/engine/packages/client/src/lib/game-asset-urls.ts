// ──────────────────────────────────────────────
// Game asset URL helpers
// ──────────────────────────────────────────────

export const GAME_ASSET_FILE_URL_PREFIX = "/api/game-assets/file/";

export function encodeGameAssetPath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function gameAssetFileUrl(path: string | null | undefined): string | null {
  const cleanPath = path?.trim();
  if (!cleanPath) return null;
  if (cleanPath.startsWith("__user_bg__/")) {
    const filename = cleanPath.replace("__user_bg__/", "");
    return filename ? `/api/backgrounds/file/${encodeURIComponent(filename)}` : null;
  }
  return `${GAME_ASSET_FILE_URL_PREFIX}${encodeGameAssetPath(cleanPath)}`;
}

export async function resolveGameAssetFileUrl(path: string | null | undefined): Promise<string | null> {
  return gameAssetFileUrl(path);
}
