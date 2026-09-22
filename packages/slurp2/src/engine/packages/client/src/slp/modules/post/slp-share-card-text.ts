/**
 * Greedy wrap on measured glyph widths, ellipsised when it runs past `maxLines`. Takes the
 * measure function rather than the canvas context so the wrapping can be tested without a DOM.
 */
export function wrapSlpShareCardText(
  measure: (value: string) => number,
  value: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let truncated = false;
  for (const paragraph of value.split(/\n+/u)) {
    let line = "";
    for (const word of paragraph.split(/\s+/u).filter(Boolean)) {
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = word;
    }
    if (line && lines.length < maxLines) lines.push(line);
    else if (line) truncated = true;
    if (lines.length >= maxLines) {
      truncated = truncated || paragraph !== value;
      break;
    }
  }
  if (truncated && lines.length) {
    let last = lines[lines.length - 1];
    while (last && measure(`${last}…`) > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}
