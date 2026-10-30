// ──────────────────────────────────────────────
// Otome Hearth: the allow-list a love interest's model-drawn plush SVG must pass (#1954)
// ──────────────────────────────────────────────
// A model writes the SVG (S/minigames/plush.ts), so it never reaches a browser as written. sanitizePlushSvg rebuilds it
// from tokens: only the shapes in ELEMENTS, only the attributes in ATTRIBUTES, each value matching its pattern (numbers,
// path data, #rrggbb or a colour name, translate/rotate/scale), with no text, entities, URLs, ids, styles, scripts,
// links, images or comments, each attribute at most once per tag, and well nested under one <svg> root whose own
// attributes are ours. Only a leading XML declaration is skipped; the text is never rewritten. Anything else is refused
// with a reason the repair turn can send back, and what is kept fits PLUSH_SVG_MAX as rebuilt. The client shows the
// result as an <image> from a data URL, where a browser runs nothing (C/components/PlushShelf.tsx), and every read
// checks it again (S/schemas/unit.ts).
// No dependencies: the server bundle has no XML parser, and Node has no DOMParser.

/** The longest SVG kept, in characters. */
export const PLUSH_SVG_MAX = 12_000;
/** The most shapes and groups one plush may hold. */
export const PLUSH_ELEMENTS_MAX = 200;

/** The shapes a plush may use. */
export const PLUSH_ELEMENTS = ["svg", "g", "path", "circle", "ellipse", "rect", "polygon", "polyline", "line"] as const;

const NUMBER = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
const NUMBER_LIST = /^[-+\d.,\s]{1,600}$/;
const PATH = /^[MmLlHhVvCcSsQqTtAaZz\d\s,.+-]{1,6000}$/;
const PAINT = /^(?:#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|none|[a-z]{3,20})$/;
const TRANSFORM = /^(?:\s*(?:translate|rotate|scale)\([-\d.,\s]{1,60}\))+\s*$/;
const VIEW_BOX = /^\s*-?[\d.]+(?:[\s,]+-?[\d.]+){3}\s*$/;

/** The attributes a shape may carry, and what each value must look like. */
export const PLUSH_ATTRIBUTES: Readonly<Record<string, RegExp>> = {
  d: PATH,
  cx: NUMBER,
  cy: NUMBER,
  r: NUMBER,
  rx: NUMBER,
  ry: NUMBER,
  x: NUMBER,
  y: NUMBER,
  width: NUMBER,
  height: NUMBER,
  x1: NUMBER,
  y1: NUMBER,
  x2: NUMBER,
  y2: NUMBER,
  points: NUMBER_LIST,
  fill: PAINT,
  stroke: PAINT,
  "stroke-width": NUMBER,
  "stroke-linecap": /^(?:butt|round|square)$/,
  "stroke-linejoin": /^(?:miter|round|bevel)$/,
  "stroke-dasharray": NUMBER_LIST,
  opacity: NUMBER,
  "fill-opacity": NUMBER,
  "stroke-opacity": NUMBER,
  "fill-rule": /^(?:nonzero|evenodd)$/,
  transform: TRANSFORM,
};

const ELEMENT_SET: ReadonlySet<string> = new Set(PLUSH_ELEMENTS);
/** An attribute name: a letter, then letters, digits, `:` or `-` (so `x1` and `stroke-width` read as names). */
const NAME = "[a-zA-Z][a-zA-Z0-9:-]*";
/**
 * A closing tag, an opening or self-closing tag with quoted attributes (no `<`, `>` or `&` inside), or text. Anything
 * else, a comment included, matches nothing and is refused: the text is never rewritten.
 */
const TOKEN = new RegExp(
  `<\\/([a-zA-Z]+)\\s*>|<([a-zA-Z]+)((?:\\s+${NAME}\\s*=\\s*(?:"[^"<>&]*"|'[^'<>&]*'))*)\\s*(\\/?)>|([^<]+)`,
  "y",
);
/** An XML declaration, allowed only at the very start. */
const DECLARATION = /<\?xml[^<>]*\?>/y;
const ATTRIBUTE = new RegExp(`(${NAME})\\s*=\\s*(?:"([^"<>&]*)"|'([^'<>&]*)')`, "g");

/** The plush SVG rebuilt from the allow-list, or why it was refused. */
export function sanitizePlushSvg(raw: string): { svg: string } | { error: string } {
  // A leading XML declaration carries nothing a plush needs, so it is skipped; anything else outside the grammar is
  // refused. The text itself is never rewritten.
  const source = raw.trim();
  if (!source) return { error: "svg is empty" };
  if (source.length > PLUSH_SVG_MAX) return { error: `svg is longer than ${PLUSH_SVG_MAX} characters` };
  if (source.includes("<!")) return { error: "svg has a comment, CDATA or doctype; leave them out" };
  const out: string[] = [];
  const open: string[] = [];
  let elements = 0;
  let done = false;
  DECLARATION.lastIndex = 0;
  TOKEN.lastIndex = DECLARATION.test(source) ? DECLARATION.lastIndex : 0;
  while (TOKEN.lastIndex < source.length) {
    const at = TOKEN.lastIndex;
    const match = TOKEN.exec(source);
    if (!match) return { error: `svg has markup that is not allowed near "${source.slice(at, at + 24)}"` };
    const [, closing, name, attributes = "", selfClosing, text] = match;
    if (text !== undefined) {
      if (text.trim()) return { error: "svg holds text; draw with shapes only" };
      continue;
    }
    if (closing !== undefined) {
      if (open.pop() !== closing) return { error: `svg closes </${closing}> out of order` };
      out.push(`</${closing}>`);
      if (!open.length) done = true;
      continue;
    }
    if (done) return { error: "svg has content after its closing </svg>" };
    if (!ELEMENT_SET.has(name!)) {
      return { error: `svg uses <${name}>, which is not allowed (use only ${PLUSH_ELEMENTS.join(", ")})` };
    }
    if ((name === "svg") !== (open.length === 0)) {
      return { error: open.length ? "svg nests another <svg>" : "svg must start with one <svg> root" };
    }
    if (++elements > PLUSH_ELEMENTS_MAX) return { error: `svg has more than ${PLUSH_ELEMENTS_MAX} shapes` };
    const kept: string[] = [];
    const seen = new Set<string>();
    let viewBox = "0 0 64 64";
    for (const [, attribute, double, single] of attributes.matchAll(ATTRIBUTE)) {
      // XML allows each attribute once on a tag: a repeat would make the whole picture fail to load.
      if (seen.has(attribute!)) return { error: `svg repeats the attribute ${attribute} on one <${name}>` };
      seen.add(attribute!);
      const value = (double ?? single ?? "").trim();
      // The root's own attributes are ours: the namespace and its box (the model's box, when it gives a sound one).
      if (name === "svg") {
        if (attribute === "viewBox" && VIEW_BOX.test(value)) viewBox = value.replace(/[\s,]+/gu, " ");
        continue;
      }
      // An own key only: a name like `constructor` must be refused, not read off Object.prototype.
      const pattern = Object.prototype.hasOwnProperty.call(PLUSH_ATTRIBUTES, attribute!)
        ? PLUSH_ATTRIBUTES[attribute!]
        : undefined;
      if (!pattern) return { error: `svg uses the attribute ${attribute}, which is not allowed` };
      if (!pattern.test(value))
        return { error: `svg has a ${attribute} value that is not allowed: "${value.slice(0, 24)}"` };
      kept.push(`${attribute}="${value.replace(/\s+/gu, " ")}"`);
    }
    if (name === "svg") {
      if (selfClosing) return { error: "svg is empty" };
      kept.push('xmlns="http://www.w3.org/2000/svg"', `viewBox="${viewBox}"`);
    }
    out.push(`<${name}${kept.length ? ` ${kept.join(" ")}` : ""}${selfClosing ? "/" : ""}>`);
    if (!selfClosing) open.push(name!);
  }
  if (!done || open.length) return { error: "svg is not closed with </svg>" };
  // The rebuilt plush carries our own root attributes, so it is measured again: what is kept must pass every read.
  if (out.join("").length > PLUSH_SVG_MAX) return { error: `svg is longer than ${PLUSH_SVG_MAX} characters` };
  if (elements < 2) return { error: "svg has no shapes" };
  return { svg: out.join("") };
}

/** The plush as a picture the client can show (a data URL: an <image> from one runs nothing), or undefined. */
export function plushSvgUrl(svg: string | undefined): string | undefined {
  if (!svg) return undefined;
  const clean = sanitizePlushSvg(svg);
  return "svg" in clean ? `data:image/svg+xml,${encodeURIComponent(clean.svg)}` : undefined;
}
