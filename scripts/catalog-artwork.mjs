export const CATALOG_ARTWORK_DIRECTORY = "artwork/agent-covers";
export const CATALOG_ARTWORK_SIZE = 512;

export function catalogArtworkRelativePath(packageId) {
  return `${CATALOG_ARTWORK_DIRECTORY}/${packageId}.png`;
}

export function catalogArtworkUrl(packageId) {
  const baseUrl =
    packageId === "long-term-memory"
      ? (process.env.MARINARA_AGENTS_LTM_CATALOG_BASE_URL ?? "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main")
      : "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main";
  return `${baseUrl.replace(/\/$/, "")}/${catalogArtworkRelativePath(packageId)}`;
}
