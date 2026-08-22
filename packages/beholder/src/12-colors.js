// Beholder color normalization.
//
// `color` is free-text in the schema: the prose's own color word is kept.
// Normalization only (a) lowercases, (b) folds hyphens/underscores/whitespace to
// single spaces, (c) maps a small set of well-known synonyms to the 16-color base
// palette. Everything else passes through verbatim — distinct-but-related shades
// are deliberately NOT collapsed (cream != beige; gunmetal stays gunmetal).
//
// Used for canonical color comparison (e.g. worn-item grouping) with
// compare-after-normalize semantics. The synonym map must stay in sync with the
// server-side color normalizer the extractor was trained against.

const COLOR_PALETTE = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "brown",
  "black",
  "white",
  "gray",
  "beige",
  "gold",
  "silver",
  "navy",
  "tan",
];

// Conservative: only true synonyms (same color, different word) + the grey/gray
// spelling variant. Distinct shades (cream, gunmetal, maroon, teal, …) are absent.
const COLOR_SYNONYMS = new Map([
  ["grey", "gray"],
  ["crimson", "red"],
  ["scarlet", "red"],
  ["cobalt", "blue"],
  ["azure", "blue"],
  ["emerald", "green"],
  ["violet", "purple"],
  ["golden", "gold"],
  ["ebony", "black"],
  ["ivory", "white"],
  ["charcoal", "gray"],
]);

/**
 * Normalize a color string for comparison/display.
 * Lowercase; collapse internal hyphens/underscores/whitespace to single spaces;
 * trim; then map known palette synonyms to their canonical form. Non-strings and
 * empties return "". Unknown colors pass through (folded).
 */
function normalizeColor(value) {
  if (typeof value !== "string") return "";
  const norm = value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
  if (!norm) return "";
  return COLOR_SYNONYMS.get(norm) ?? norm;
}
