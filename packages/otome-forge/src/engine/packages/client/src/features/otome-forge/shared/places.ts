/** The existing world.places key: preserve digits and letters in every script. */
export function placeKey(name: string): string {
  return (
    name
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/, "") || "place"
  );
}
