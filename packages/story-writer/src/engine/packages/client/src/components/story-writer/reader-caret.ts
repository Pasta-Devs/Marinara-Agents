// ──────────────────────────────────────────────
// Story Writer: caret helpers for the paginated, editable book
// ──────────────────────────────────────────────

type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

/** The collapsed caret position under a viewport point (Firefox and new Chromium have one API, WebKit the other). */
export function caretRangeAt(x: number, y: number): Range | null {
  const doc = document as CaretDocument;
  if (typeof doc.caretPositionFromPoint === "function") {
    const position = doc.caretPositionFromPoint(x, y);
    if (!position) return null;
    const range = document.createRange();
    try {
      range.setStart(position.offsetNode, position.offset);
    } catch {
      return null;
    }
    range.collapse(true);
    return range;
  }
  return typeof doc.caretRangeFromPoint === "function" ? doc.caretRangeFromPoint(x, y) : null;
}

/**
 * The caret position inside `editable` nearest to a point of one text column: the point itself, else the closest line
 * above or below it (a click under the last line lands at that line, a click on the chapter heading at the first one).
 */
export function caretRangeNear(editable: HTMLElement, x: number, y: number, top: number, bottom: number) {
  const inside = (atY: number) => {
    const range = caretRangeAt(x, atY);
    return range && editable.contains(range.startContainer) ? range : null;
  };
  const direct = inside(y);
  if (direct) return direct;
  const step = 8;
  for (let distance = step; distance <= bottom - top; distance += step) {
    const above = y - distance >= top ? inside(y - distance) : null;
    if (above) return above;
    const below = y + distance <= bottom ? inside(y + distance) : null;
    if (below) return below;
  }
  return null;
}

/** Focuses an editable chapter body and puts the caret at `range`, or at its start or end. */
export function focusEditableAt(editable: HTMLElement, range: Range | null, fallback: "start" | "end") {
  editable.focus({ preventScroll: true });
  const selection = document.getSelection();
  if (!selection) return;
  let target = range;
  if (!target) {
    target = document.createRange();
    // Inside the first/last paragraph, so typing never lands in a bare text node beside the paragraphs.
    const edge = fallback === "start" ? editable.firstElementChild : editable.lastElementChild;
    target.selectNodeContents(edge ?? editable);
    target.collapse(fallback === "start");
  }
  selection.removeAllRanges();
  selection.addRange(target);
}

/** Where the selection's focus (the moving end) is drawn, or null when it has no box yet. */
export function selectionFocusRect(selection: Selection): DOMRect | null {
  const node = selection.focusNode;
  if (!node) return null;
  const range = document.createRange();
  try {
    range.setStart(node, selection.focusOffset);
  } catch {
    return null;
  }
  range.collapse(true);
  const rects = range.getClientRects();
  if (rects.length > 0) return rects[rects.length - 1] ?? null;
  // A collapsed range in an empty paragraph has no box: use the child at the offset (the <br>) or the element.
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  if (!element) return null;
  const child = node === element ? element.childNodes[selection.focusOffset] : null;
  const target = child instanceof Element ? child : element;
  const boxes = target.getClientRects();
  return boxes[selection.focusOffset > 0 && node === element ? boxes.length - 1 : 0] ?? target.getBoundingClientRect();
}
