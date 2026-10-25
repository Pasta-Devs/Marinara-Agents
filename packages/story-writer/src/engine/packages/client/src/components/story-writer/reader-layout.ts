// ──────────────────────────────────────────────
// Story Writer: reader geometry (pure, unit-tested)
// ──────────────────────────────────────────────
// Every chapter is a CSS multi-column box whose overflowing columns are its pages, and all chapters sit in one
// horizontal track. Page p starts at x = p * (W + G), so the column grid lines up with the page grid only when every
// number here is a whole pixel and the gap between two text columns equals the paper between them: the inner margins
// of both pages plus the spine.

import type { StoryTheme } from "../../lib/story-writer/model";

export interface ReaderLayoutInput {
  theme: StoryTheme;
  /** The reader's own box (the shell already reserved room for the action bar and the sidebar handle). */
  width: number;
  height: number;
}

export interface ReaderLayout {
  theme: StoryTheme;
  pagesPerSpread: 1 | 2;
  /** The book (or the e-reader device) inside the reader box. */
  frameLeft: number;
  frameTop: number;
  frameWidth: number;
  frameHeight: number;
  /** The pages inside the frame: pagesPerSpread pages with the spine between them. */
  pagesLeft: number;
  pagesTop: number;
  pagesWidth: number;
  pageWidth: number;
  pageHeight: number;
  /** Visible gutter between the two pages of a book spread; 0 for a single page and for the e-book. */
  spine: number;
  /** Room for the page-stack edges beside the outer page edges (book only). */
  stack: number;
  padX: number;
  /** Vertical page margin; the running header and the page number sit inside padTop / padBottom. */
  padY: number;
  padTop: number;
  padBottom: number;
  /** W: one text column. */
  textWidth: number;
  /** H: the text column's height. */
  textHeight: number;
  /** G: the gap between two text columns. */
  gap: number;
  /** What the clip viewport shows: pagesPerSpread * W + (pagesPerSpread - 1) * G. */
  spreadWidth: number;
  /** How far one spread is from the next in the track: pagesPerSpread * (W + G). */
  spreadStride: number;
  /** False on narrow screens: the arrows sit over the page edges instead of beside the book. */
  arrowsOutside: boolean;
  footerTop: number;
  footerHeight: number;
}

const MARGIN = 8;
const ARROW_SPACE = 56;
const MIN_PAGE_WIDTH = 80;
const MIN_PAGE_HEIGHT = 100;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Book: two pages on a landscape-ish area (a portrait phone shows half the book). E-book: two only when very wide. */
export function choosePagesPerSpread(theme: StoryTheme, availWidth: number, availHeight: number): 1 | 2 {
  if (!(availWidth > 0) || !(availHeight > 0)) return 1;
  const ratio = availWidth / availHeight;
  if (theme === "book") return ratio >= 1.05 ? 2 : 1;
  return availWidth >= 1100 && ratio >= 1.35 ? 2 : 1;
}

interface PageGeometry {
  pageWidth: number;
  pageHeight: number;
  spine: number;
  stack: number;
  padX: number;
  padY: number;
  headerRoom: number;
  frameWidth: number;
  frameHeight: number;
  pagesLeft: number;
  pagesTop: number;
}

function bookGeometry(pps: 1 | 2, availW: number, availH: number): PageGeometry {
  const cover = clamp(Math.round(Math.min(availW, availH) * 0.012), 3, 10);
  const stack = clamp(Math.round(Math.min(availW / pps, availH) * 0.018), 3, 9);
  // A page is about 0.7 wide per 1 tall; short landscape screens (a phone on its side) trade the shape for longer lines.
  const maxAspect = availH < 420 ? 1.2 : availH < 560 ? 0.9 : 0.74;
  const minAspect = 0.5;
  let pageHeight = Math.max(MIN_PAGE_HEIGHT, Math.min(1100, availH - 2 * cover - stack));
  const spine = pps === 2 ? clamp(Math.round(pageHeight * 0.018), 6, 16) : 0;
  let pageWidth = Math.max(MIN_PAGE_WIDTH, Math.floor((availW - 2 * (cover + stack) - spine) / pps));
  if (pageWidth > pageHeight * maxAspect) pageWidth = Math.max(MIN_PAGE_WIDTH, Math.floor(pageHeight * maxAspect));
  else if (pageWidth < pageHeight * minAspect)
    pageHeight = Math.max(MIN_PAGE_HEIGHT, Math.floor(pageWidth / minAspect));
  return {
    pageWidth,
    pageHeight,
    spine,
    stack,
    padX: Math.max(12, Math.round(pageWidth * 0.09)),
    padY: Math.max(14, Math.round(pageHeight * 0.075)),
    headerRoom: clamp(Math.round(pageHeight * 0.025), 8, 22),
    frameWidth: pps * pageWidth + spine + 2 * (cover + stack),
    frameHeight: pageHeight + 2 * cover + stack,
    pagesLeft: cover + stack,
    pagesTop: cover,
  };
}

function deviceGeometry(pps: 1 | 2, availW: number, availH: number): PageGeometry {
  // A portrait reader for one page, a landscape tablet for two; the screen fills the device inside its bezel.
  const deviceWidth = Math.min(availW, Math.round(availH * (pps === 2 ? 1.6 : 0.8)), pps === 2 ? 1800 : 900);
  const deviceHeight = Math.min(availH, 1150);
  const bezel = clamp(Math.round(Math.min(deviceWidth, deviceHeight) * 0.035), 10, 26);
  const chin = Math.round(bezel * 1.5);
  const pageWidth = Math.max(MIN_PAGE_WIDTH, Math.floor((deviceWidth - 2 * bezel) / pps));
  const pageHeight = Math.max(MIN_PAGE_HEIGHT, deviceHeight - bezel - chin);
  return {
    pageWidth,
    pageHeight,
    spine: 0,
    stack: 0,
    padX: clamp(Math.round(pageWidth * 0.075), 18, 60),
    padY: clamp(Math.round(pageHeight * 0.035), 10, 28),
    headerRoom: clamp(Math.round(pageHeight * 0.03), 18, 26),
    frameWidth: pps * pageWidth + 2 * bezel,
    frameHeight: pageHeight + bezel + chin,
    pagesLeft: bezel,
    pagesTop: bezel,
  };
}

export function computeReaderLayout({ theme, width, height }: ReaderLayoutInput): ReaderLayout {
  const areaWidth = Math.max(0, Math.round(width));
  const areaHeight = Math.max(0, Math.round(height));
  const arrowsOutside = areaWidth >= 640;
  const footerHeight = areaHeight < 460 ? 44 : 48;
  const availW = Math.max(1, areaWidth - 2 * ((arrowsOutside ? ARROW_SPACE : 0) + MARGIN));
  const availH = Math.max(1, areaHeight - footerHeight - 2 * MARGIN);
  const pagesPerSpread = choosePagesPerSpread(theme, availW, availH);
  const geometry =
    theme === "book" ? bookGeometry(pagesPerSpread, availW, availH) : deviceGeometry(pagesPerSpread, availW, availH);
  const { pageWidth, pageHeight, spine, padX, padY, headerRoom } = geometry;
  const padTop = padY + headerRoom;
  const padBottom = padY + headerRoom;
  const textWidth = pageWidth - 2 * padX;
  const textHeight = pageHeight - padTop - padBottom;
  // The paper between two text columns of a spread: both inner margins and the spine.
  const gap = 2 * padX + spine;
  const frameTop = Math.max(0, Math.round((areaHeight - geometry.frameHeight - footerHeight) / 2));
  return {
    theme,
    pagesPerSpread,
    frameLeft: Math.round((areaWidth - geometry.frameWidth) / 2),
    frameTop,
    frameWidth: geometry.frameWidth,
    frameHeight: geometry.frameHeight,
    pagesLeft: geometry.pagesLeft,
    pagesTop: geometry.pagesTop,
    pagesWidth: pagesPerSpread * pageWidth + spine,
    pageWidth,
    pageHeight,
    spine,
    stack: geometry.stack,
    padX,
    padY,
    padTop,
    padBottom,
    textWidth,
    textHeight,
    gap,
    spreadWidth: pagesPerSpread * textWidth + (pagesPerSpread - 1) * gap,
    spreadStride: pagesPerSpread * (textWidth + gap),
    arrowsOutside,
    footerTop: frameTop + geometry.frameHeight,
    footerHeight,
  };
}

/** Where page `page` starts in the track. */
export function pageOffset(layout: Pick<ReaderLayout, "textWidth" | "gap">, page: number): number {
  return page * (layout.textWidth + layout.gap);
}

/** Pages a column box spans, from its scrollWidth (k columns are k * W + (k - 1) * G wide). */
export function countPages(scrollWidth: number, textWidth: number, gap: number): number {
  const pages = Math.round((scrollWidth + gap) / (textWidth + gap));
  return Number.isFinite(pages) ? Math.max(1, pages) : 1;
}

/** The outer width of a block spanning `pages` pages, so the next block starts on the next page. */
export function blockWidth(pages: number, textWidth: number, gap: number): number {
  return pages * (textWidth + gap) - gap;
}

export function spreadOfPage(page: number, pagesPerSpread: number): number {
  return Math.floor(Math.max(0, page) / Math.max(1, pagesPerSpread));
}

/** The page under track x; the gap belongs half to each neighbour. */
export function pageAtTrackX(x: number, textWidth: number, gap: number): number {
  return Math.max(0, Math.floor((x + gap / 2) / (textWidth + gap)));
}
