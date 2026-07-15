export const CATALOG_ARTWORK_DIRECTORY = "artwork/agent-covers";
export const CATALOG_ARTWORK_SIZE = 512;

export function catalogArtworkRelativePath(packageId) {
  return `${CATALOG_ARTWORK_DIRECTORY}/${packageId}.png`;
}

export function catalogArtworkUrl(packageId) {
  return `https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/${catalogArtworkRelativePath(packageId)}`;
}
