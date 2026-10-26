// Expression portraits, shared by both bundles. The plate's normal image is the neutral face; a
// dialogue or thought line may name one of these four, and an untagged line stays neutral.
export const forgeStoryExpressionNames = ["anger", "fear", "sadness", "joy"];

export function normalizeForgeStoryExpression(value) {
  return forgeStoryExpressionNames.includes(value) ? value : "";
}

// The plate's character for one line: its expression image when the cast carries a ready set,
// otherwise the cast entry unchanged (its art is the neutral face).
export function forgeStoryExpressionArt(character, segment) {
  const expression = normalizeForgeStoryExpression(segment?.expression);
  const art = expression ? character?.expressions?.[expression] : "";
  return art && typeof art === "string" ? { ...character, art, neutral: character.art || "" } : character;
}
