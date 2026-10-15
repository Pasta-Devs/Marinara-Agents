/** Index a tab rail moves to for an arrow, Home or End key; null for any other key or an empty rail. */
export function nextTabIndex(key: string, index: number, length: number): number | null {
  if (length <= 0) return null;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  if (key === "ArrowRight") return (index + 1) % length;
  if (key === "ArrowLeft") return (index - 1 + length) % length;
  return null;
}
