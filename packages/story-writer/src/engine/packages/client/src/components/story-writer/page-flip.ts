// ──────────────────────────────────────────────
// Story Writer: the book's page-turn animation
// ──────────────────────────────────────────────
// The real track jumps to the new spread at once; this overlay hides the jump. It holds static copies of the pages
// involved and a leaf (front = the page being turned, back = the page it uncovers on the other side) that rotates around
// the spine. When the animation ends the overlay shows exactly what the real pages show, so removing it is seamless.

export type PageSide = "left" | "right" | "single";

export interface PageFaceParts {
  side: PageSide;
  header: string;
  number: string;
  /** The page's text window, from clonePageText. */
  content: HTMLElement | null;
}

/** A paper page with the same classes as the reader's own pages, so it looks identical. */
export function createPageFace({ side, header, number, content }: PageFaceParts): HTMLElement {
  const face = document.createElement("div");
  face.className = `sw-page sw-page--${side}`;
  if (header) face.append(createText(`sw-page-header sw-page-header--${side}`, header));
  if (number) face.append(createText(`sw-page-number sw-page-number--${side}`, number));
  if (content) face.append(content);
  return face;
}

/** The blank reverse of a single page while it turns away. */
export function createPageBack(): HTMLElement {
  const back = document.createElement("div");
  back.className = "sw-page sw-page--back";
  return back;
}

function createText(className: string, text: string) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

/** Copies a block's column box into a box-sized window that shows the column starting at `offsetX`. */
export function clonePageText(
  source: HTMLElement,
  offsetX: number,
  box: { left: number; top: number; width: number; height: number },
): HTMLElement {
  const clip = document.createElement("div");
  clip.className = "sw-flip-text";
  clip.style.left = `${box.left}px`;
  clip.style.top = `${box.top}px`;
  clip.style.width = `${box.width}px`;
  clip.style.height = `${box.height}px`;
  const copy = source.cloneNode(true) as HTMLElement;
  // A copy must never be focusable, editable or announced twice.
  for (const element of [copy, ...copy.querySelectorAll<HTMLElement>("[contenteditable],[id],[tabindex],[role]")]) {
    element.removeAttribute("contenteditable");
    element.removeAttribute("id");
    element.removeAttribute("tabindex");
    element.removeAttribute("role");
  }
  copy.style.position = "absolute";
  copy.style.left = `${-offsetX}px`;
  copy.style.top = "0";
  clip.append(copy);
  return clip;
}

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface PageFlipOptions {
  /** Positioned over the pages area (pagesPerSpread pages and the spine). */
  layer: HTMLElement;
  direction: "forward" | "backward";
  pagesPerSpread: 1 | 2;
  pageWidth: number;
  pageHeight: number;
  spine: number;
  /** The old page that stays put until the leaf covers it (two pages), or the old page under a returning leaf. */
  staticFace: HTMLElement | null;
  front: HTMLElement;
  back: HTMLElement | null;
  duration?: number;
}

export interface PageFlip {
  /** Ends the turn at once (a new navigation finishes the running one first). */
  finish(): void;
  readonly done: Promise<void>;
}

const EASING = "cubic-bezier(0.42, 0.05, 0.3, 1)";

export function runPageFlip(options: PageFlipOptions): PageFlip {
  const { layer, direction, pagesPerSpread, pageWidth, pageHeight, spine, staticFace, front, back } = options;
  const forward = direction === "forward";
  const spread = pagesPerSpread === 2;
  const duration = options.duration ?? (spread ? 650 : 520);
  const rightX = spread ? pageWidth + spine : 0;
  const root = document.createElement("div");
  root.className = "sw-flip";
  root.style.perspective = `${Math.round(pageWidth * 4.5)}px`;
  root.style.perspectiveOrigin = `${spread ? pageWidth + spine / 2 : pageWidth / 2}px 50%`;
  const place = (element: HTMLElement, left: number) => {
    element.style.position = "absolute";
    element.style.left = `${left}px`;
    element.style.top = "0";
    element.style.width = `${pageWidth}px`;
    element.style.height = `${pageHeight}px`;
  };
  const addShade = (face: HTMLElement) => {
    const shade = document.createElement("div");
    shade.className = "sw-flip-shade";
    face.append(shade);
    return shade;
  };

  let staticShade: HTMLElement | null = null;
  if (staticFace) {
    place(staticFace, spread && !forward ? rightX : 0);
    staticShade = addShade(staticFace);
    root.append(staticFace);
  }
  // The page the leaf uncovers starts in its shadow, which fades as the leaf lifts away.
  let reveal: HTMLElement | null = null;
  if (spread || forward) {
    reveal = document.createElement("div");
    reveal.className = `sw-flip-reveal sw-flip-reveal--${forward ? "right" : "left"}`;
    place(reveal, spread && forward ? rightX : 0);
    root.append(reveal);
  }

  const leaf = document.createElement("div");
  leaf.className = "sw-flip-leaf";
  place(leaf, spread && forward ? rightX : 0);
  // Around the middle of the spine, so the leaf lands exactly on the opposite page.
  leaf.style.transformOrigin = `${spread ? (forward ? -spine / 2 : pageWidth + spine / 2) : 0}px 50%`;
  place(front, 0);
  front.classList.add("sw-flip-front");
  const frontShade = addShade(front);
  leaf.append(front);
  let backShade: HTMLElement | null = null;
  if (back) {
    place(back, 0);
    back.classList.add("sw-flip-back");
    backShade = addShade(back);
    leaf.append(back);
  }
  root.append(leaf);
  layer.append(root);

  const animations: Animation[] = [];
  const timing: KeyframeAnimationOptions = { duration, easing: EASING, fill: "forwards" };
  const animate = (element: HTMLElement | null, keyframes: Keyframe[]) => {
    if (element && typeof element.animate === "function") animations.push(element.animate(keyframes, timing));
  };
  if (spread) {
    animate(leaf, [{ transform: "rotateY(0deg)" }, { transform: `rotateY(${forward ? -180 : 180}deg)` }]);
  } else if (forward) {
    // A single page turns away around its bound left edge and fades as it leaves the book.
    animate(leaf, [
      { transform: "rotateY(0deg)", opacity: 1 },
      { transform: "rotateY(-125deg)", opacity: 1, offset: 0.7 },
      { transform: "rotateY(-180deg)", opacity: 0 },
    ]);
  } else {
    animate(leaf, [
      { transform: "rotateY(-180deg)", opacity: 0 },
      { transform: "rotateY(-125deg)", opacity: 1, offset: 0.3 },
      { transform: "rotateY(0deg)", opacity: 1 },
    ]);
  }
  animate(frontShade, [{ opacity: 0 }, { opacity: 0.55, offset: 0.5 }, { opacity: 0.55 }]);
  animate(backShade, [{ opacity: 0.55 }, { opacity: 0.55, offset: 0.5 }, { opacity: 0 }]);
  animate(reveal, [{ opacity: 1 }, { opacity: 0 }]);
  animate(staticShade, [{ opacity: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 0.6, offset: 0.88 }, { opacity: 0 }]);

  let settled = false;
  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  const finish = () => {
    if (settled) return;
    settled = true;
    for (const animation of animations) animation.cancel();
    root.remove();
    resolveDone();
  };
  const main = animations[0];
  if (main) main.finished.then(finish, finish);
  else finish();
  return { finish, done };
}
