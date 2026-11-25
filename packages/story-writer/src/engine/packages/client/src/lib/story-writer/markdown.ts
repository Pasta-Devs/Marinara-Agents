// ──────────────────────────────────────────────
// Story Writer: the small Markdown dialect the book renders and edits
// ──────────────────────────────────────────────
// No Markdown library may be bundled, and chapter text is model output: every piece of text is escaped before any tag
// is added, so the only HTML that reaches the page is the handful of tags written here.

/** The part of a DOM node the serializer reads, so tests can pass plain objects. */
export interface MarkdownNode {
  nodeType: number;
  nodeName: string;
  childNodes: ArrayLike<MarkdownNode>;
  textContent: string | null;
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const HEADING = /^\s{0,3}(#{1,3})\s+(.+?)(?:\s+#+)?\s*$/;
const HR = /^\s{0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;

// [pattern, HTML replacement, plain-text replacement]. Order matters: the longer markers go first. Emphasis never starts
// or ends on an asterisk, so a censored "f***" stays literal instead of becoming an empty emphasis.
const INLINE_RULES: Array<[RegExp, string, string]> = [
  [/\*\*\*(?![\s*])(.+?)(?<![\s*])\*\*\*/g, "<strong><em>$1</em></strong>", "$1"],
  [/\*\*(?![\s*])(.+?)(?<![\s*])\*\*/g, "<strong>$1</strong>", "$1"],
  [/(^|[^\p{L}\p{N}_])__(?!\s)(.+?)(?<!\s)__(?![\p{L}\p{N}_])/gu, "$1<u>$2</u>", "$1$2"],
  [/\*(?![\s*])(.+?)(?<![\s*])\*/g, "<em>$1</em>", "$1"],
  [/(^|[^\p{L}\p{N}_])_(?!\s)(.+?)(?<!\s)_(?![\p{L}\p{N}_])/gu, "$1<em>$2</em>", "$1$2"],
  [/~~(?!\s)(.+?)(?<!\s)~~/g, "<s>$1</s>", "$1"],
];

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

function inlineHtml(text: string): string {
  return INLINE_RULES.reduce((html, [pattern, replacement]) => html.replace(pattern, replacement), escapeHtml(text));
}

function inlinePlain(text: string): string {
  return INLINE_RULES.reduce((plain, [pattern, , replacement]) => plain.replace(pattern, replacement), text);
}

// Deeper "> > >" nesting renders as text: each level recurses, and thousands of them would overflow the stack.
const MAX_QUOTE_DEPTH = 8;

/** One top-level block of a chapter as the book renders it: a paragraph, a heading, a scene break or a quote. */
export interface MarkdownBlock {
  html: string;
  /** The Markdown lines it was rendered from. */
  source: string;
}

/** Splits chapter Markdown into the blocks markdownToHtml renders, in order: the chapter body's children. */
export function markdownBlocks(markdown: string, depth = 0): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let quote: string[] = [];
  let quoted: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ html: `<p>${paragraph.map(inlineHtml).join("<br>")}</p>`, source: paragraph.join("\n") });
    }
    paragraph = [];
  };
  const flushQuote = () => {
    if (quoted.length) {
      blocks.push({
        html: `<blockquote>${markdownToHtml(quote.join("\n"), depth + 1)}</blockquote>`,
        source: quoted.join("\n"),
      });
    }
    quote = [];
    quoted = [];
  };

  for (const line of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const inQuote = depth < MAX_QUOTE_DEPTH ? QUOTE.exec(line) : null;
    if (inQuote) {
      flushParagraph();
      quote.push(inQuote[1] ?? "");
      quoted.push(line);
      continue;
    }
    flushQuote();
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    if (HR.test(line)) {
      flushParagraph();
      blocks.push({ html: "<hr>", source: line });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading?.[1] && heading[2]) {
      flushParagraph();
      const level = heading[1].length;
      blocks.push({ html: `<h${level}>${inlineHtml(heading[2])}</h${level}>`, source: line });
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  flushQuote();
  return blocks;
}

/** Renders chapter Markdown as HTML: paragraphs, h1–h3, scene breaks, blockquotes and inline emphasis. */
export function markdownToHtml(markdown: string, depth = 0): string {
  return markdownBlocks(markdown, depth)
    .map((block) => block.html)
    .join("");
}

/** Plain text for the .txt export: markers are removed, scene breaks become "* * *". */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      if (HR.test(line)) return "* * *";
      const heading = HEADING.exec(line);
      if (heading?.[2]) return inlinePlain(heading[2]);
      return inlinePlain(line.replace(QUOTE, "$1"));
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Where a picture sits ──

/** A block's text as a key: whitespace (and so a line break inside a paragraph) never matters. */
const textKey = (text: string) => text.replace(/\s+/g, "");

/** The opening words of a block, which find it again later (anchorIndex). */
export function anchorText(blockText: string): string {
  return blockText.replace(/\s+/g, " ").trim().slice(0, 80);
}

/**
 * The block a picture sits beside, among a chapter's blocks (their plain text, from the DOM or markdownBlocks): the
 * block nearest its stored index that still opens with its anchor, else the stored index within the chapter. -1 for a
 * chapter with no block yet.
 */
export function anchorIndex(blockTexts: string[], paragraph: number, anchor: string): number {
  if (blockTexts.length === 0) return -1;
  const fallback = Math.min(Math.max(0, paragraph), blockTexts.length - 1);
  const key = textKey(anchor);
  if (!key) return fallback;
  let found = -1;
  blockTexts.forEach((text, index) => {
    if (!textKey(text).startsWith(key)) return;
    if (found < 0 || Math.abs(index - paragraph) < Math.abs(found - paragraph)) found = index;
  });
  return found >= 0 ? found : fallback;
}

/** The plain text of each block of chapter Markdown, as anchorIndex reads them. */
export function markdownBlockTexts(markdown: string): string[] {
  return markdownBlocks(markdown).map((block) => markdownToPlainText(block.source));
}

// ── Editable DOM → Markdown ──

const BLOCK_ELEMENTS = new Set([
  "p",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "hr",
  "ul",
  "ol",
  "li",
  "pre",
  "section",
  "article",
]);

const INLINE_MARKERS: Record<string, string> = {
  em: "*",
  i: "*",
  strong: "**",
  b: "**",
  u: "__",
  s: "~~",
  strike: "~~",
  del: "~~",
};

/** Wraps each line separately, with edge spaces outside the markers, so the result parses back the same way. */
function wrap(text: string, marker: string): string {
  return text
    .split("\n")
    .map((line) => {
      const [, lead = "", core = "", trail = ""] = /^(\s*)([\s\S]*?)(\s*)$/.exec(line) ?? [];
      return core ? `${lead}${marker}${core}${marker}${trail}` : line;
    })
    .join("\n");
}

function inlineMarkdown(node: MarkdownNode): string {
  if (node.nodeType === TEXT_NODE) return (node.textContent ?? "").replace(/ /g, " ");
  if (node.nodeType !== ELEMENT_NODE) return "";
  const name = node.nodeName.toLowerCase();
  if (name === "br") return "\n";
  if (name === "figure") return "";
  const inner = Array.from(node.childNodes, inlineMarkdown).join("");
  const marker = INLINE_MARKERS[name];
  return marker ? wrap(inner, marker) : inner;
}

function blockMarkdown(node: MarkdownNode): string[] {
  const blocks: string[] = [];
  let line = "";
  const flush = () => {
    const text = line.replace(/^\n+/, "").replace(/\s+$/, "");
    if (text.trim()) blocks.push(text);
    line = "";
  };
  for (const child of Array.from(node.childNodes)) {
    const name = child.nodeName.toLowerCase();
    // A picture beside the text belongs to the chapter, not to its Markdown, and never splits the text around it.
    if (child.nodeType === ELEMENT_NODE && name === "figure") continue;
    if (child.nodeType !== ELEMENT_NODE || !BLOCK_ELEMENTS.has(name)) {
      line += inlineMarkdown(child);
      continue;
    }
    flush();
    if (name === "hr") {
      blocks.push("***");
    } else if (/^h[1-6]$/.test(name)) {
      const text = inlineMarkdown(child).replace(/\s+/g, " ").trim();
      if (text) blocks.push(`${"#".repeat(Math.min(3, Number(name[1])))} ${text}`);
    } else if (name === "blockquote") {
      const inner = blockMarkdown(child).join("\n\n");
      if (inner) blocks.push(inner.replace(/^/gm, "> ").replace(/^> $/gm, ">"));
    } else {
      blocks.push(...blockMarkdown(child));
    }
  }
  flush();
  return blocks;
}

/** Serializes an edited chapter body back to Markdown; empty paragraphs disappear and trailing space is trimmed. */
export function htmlToMarkdown(root: MarkdownNode): string {
  return blockMarkdown(root).join("\n\n").trimEnd();
}
