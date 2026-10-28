// Avatar initials (pure, so the regression can run it).

/** First and last word's first letter ("Jonas \"Jojo\" Brandtner" → "JB"); quotes and brackets never count (B29). */
export function initials(name: string) {
  const words = name
    .split(/\s+/u)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  const first = Array.from(words[0] ?? "")[0] ?? "";
  const last = words.length > 1 ? (Array.from(words[words.length - 1]!)[0] ?? "") : "";
  return (first + last).toLocaleUpperCase() || "N";
}
