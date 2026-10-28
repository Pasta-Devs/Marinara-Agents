// Public shared helper captured from Engine b9cc386e868d8ab9cdb4826939323a67d464e7bf.
// Package-owned capture: do not place this in the common vendored Engine snapshot.
function estimateTextTokens(text) {
  let hundredthTokens = 0;
  for (const character of text) {
    hundredthTokens += codePointTokenHundredths(character.codePointAt(0));
  }
  return Math.ceil(hundredthTokens / 100);
}
function sliceTextToTokenBudget(text, tokenBudget, fromEnd = false) {
  if (!(tokenBudget > 0)) return "";
  const budget = Math.floor(tokenBudget) * 100;
  let used = 0;
  let index = fromEnd ? text.length : 0;
  while (fromEnd ? index > 0 : index < text.length) {
    let pointIndex = fromEnd ? index - 1 : index;
    if (
      fromEnd &&
      pointIndex > 0 &&
      text.charCodeAt(pointIndex) >= 56320 &&
      text.charCodeAt(pointIndex) <= 57343 &&
      text.charCodeAt(pointIndex - 1) >= 55296 &&
      text.charCodeAt(pointIndex - 1) <= 56319
    )
      pointIndex -= 1;
    const codePoint = text.codePointAt(pointIndex);
    const next = used + codePointTokenHundredths(codePoint);
    if (next > budget) break;
    used = next;
    index = fromEnd ? pointIndex : pointIndex + (codePoint > 65535 ? 2 : 1);
  }
  return fromEnd ? text.slice(index) : text.slice(0, index);
}
function codePointTokenHundredths(codePoint) {
  if (isHangul(codePoint)) return 50;
  if (isHan(codePoint) || isKana(codePoint)) return 67;
  return 25;
}
function isHangul(codePoint) {
  return (
    (codePoint >= 4352 && codePoint <= 4607) ||
    (codePoint >= 12592 && codePoint <= 12687) ||
    (codePoint >= 43360 && codePoint <= 43391) ||
    (codePoint >= 44032 && codePoint <= 55215) ||
    (codePoint >= 55216 && codePoint <= 55295)
  );
}
function isHan(codePoint) {
  return (
    (codePoint >= 13312 && codePoint <= 19903) ||
    (codePoint >= 19968 && codePoint <= 40959) ||
    (codePoint >= 63744 && codePoint <= 64255) ||
    (codePoint >= 131072 && codePoint <= 205743)
  );
}
function isKana(codePoint) {
  return (
    (codePoint >= 12352 && codePoint <= 12447) ||
    (codePoint >= 12448 && codePoint <= 12543) ||
    (codePoint >= 12784 && codePoint <= 12799) ||
    (codePoint >= 65382 && codePoint <= 65439) ||
    (codePoint >= 110592 && codePoint <= 110959)
  );
}
function getSerializedTextTokenEstimator() {
  return `(() => {
    const isHangul = ${isHangul.toString()};
    const isHan = ${isHan.toString()};
    const isKana = ${isKana.toString()};
    const codePointTokenHundredths = ${codePointTokenHundredths.toString()};
    return ${estimateTextTokens.toString()};
  })()`;
}
export { estimateTextTokens, getSerializedTextTokenEstimator, sliceTextToTokenBudget };
