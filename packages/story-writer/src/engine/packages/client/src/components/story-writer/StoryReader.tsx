import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { chapterTitle, type StoryChapter, type StoryTheme } from "../../lib/story-writer/model";
import { ChapterBlock } from "./ChapterBlock";
import {
  clonePageText,
  createPageBack,
  createPageFace,
  prefersReducedMotion,
  runPageFlip,
  type PageFlip,
  type PageSide,
} from "./page-flip";
import { caretRangeNear, focusEditableAt, selectionFocusRect } from "./reader-caret";
import {
  blockWidth,
  computeReaderLayout,
  countPages,
  pageAtTrackX,
  pageOffset,
  spreadOfPage,
  type ReaderLayout,
} from "./reader-layout";

export interface StoryReaderHandle {
  scrollToChapter(chapterId: string): void;
}

export interface StoryReaderProps {
  theme: StoryTheme;
  pageAnimation: boolean;
  /** Display title (fallback already applied). */
  storyTitle: string;
  /** Short line for the title page, e.g. "Fantasy · Teen · hurt/comfort". */
  storyDetails: string;
  chapters: StoryChapter[];
  generatingChapterId: string | null;
  /** Client id for the "start the next chapter" page; the shell makes a new one after each start. */
  ghostChapterId: string;
  /** False while any generation is running. */
  editable: boolean;
  mariImageUrl: string;
  onChapterChange(chapterId: string, markdown: string): void;
  onStartChapter(chapterId: string, markdown: string): void;
}

// Underscores are not allowed in chapter ids (CLIENT_ID_PATTERN), so this never collides with a chapter.
const TITLE_KEY = "__title";
const FONT_PROBE_TEXT = "Hamburgefonstiv 0123";

interface ReaderBlock {
  key: string;
  kind: "title" | "chapter" | "ghost";
  number: number;
  markdown: string;
  /** The chapter's own "# Title", for the running header. */
  title: string;
  /** First page in the track, and how many pages the block spans. */
  start: number;
  pages: number;
}

/** The page the reader was looking at, kept across re-pagination (new font size, resize, edits elsewhere). */
interface Anchor {
  key: string;
  page: number;
  pages: number;
  signature: string;
}

interface LiveState {
  layout: ReaderLayout | null;
  blocks: ReaderBlock[];
  totalSpreads: number;
  current: number;
  signature: string;
  pageCounts: Record<string, number>;
  props: StoryReaderProps;
  chapterLabel: (number: number) => string;
}

function blockAtPage(blocks: ReaderBlock[], page: number): ReaderBlock | null {
  if (page < 0) return null;
  for (const block of blocks) if (page < block.start + block.pages) return block;
  return null;
}

/** Running header and page number of a page, like a printed book's. */
function pageDecor(blocks: ReaderBlock[], page: number, storyTitle: string, chapterLabel: (number: number) => string) {
  const block = blockAtPage(blocks, page);
  if (!block || block.kind !== "chapter") return { header: "", number: "" };
  // No header on a chapter's opening page; the story title on even pages, the chapter's title on odd ones.
  const header = page === block.start ? "" : page % 2 === 0 ? storyTitle : block.title || chapterLabel(block.number);
  return { header, number: String(page) };
}

function isTypingTarget(target: Element): boolean {
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return !!target.closest(
    "input, textarea, select, [role='textbox'], [role='slider'], [role='spinbutton'], [role='listbox'], [role='combobox'], [role='menu'], [role='dialog']",
  );
}

const TitlePage = memo(function TitlePage({
  width,
  title,
  details,
  showStart,
  canStart,
  mariImageUrl,
  startHere,
  startWriting,
  onStart,
}: {
  width: number;
  title: string;
  details: string;
  showStart: boolean;
  canStart: boolean;
  mariImageUrl: string;
  startHere: string;
  startWriting: string;
  onStart(): void;
}) {
  return (
    <div className="sw-block sw-block--title" data-sw-block={TITLE_KEY} style={{ width }}>
      <div className="sw-block-inner sw-title-page">
        <h2 className="sw-title-text">{title}</h2>
        <div className="sw-ornament" aria-hidden="true">
          <span>❦</span>
        </div>
        {details ? <p className="sw-title-details">{details}</p> : null}
        {showStart ? (
          <div className="sw-title-start">
            {mariImageUrl ? <img className="sw-title-mari" src={mariImageUrl} alt="" draggable={false} /> : null}
            <p className="sw-title-hint">{startHere}</p>
            {canStart ? (
              <button type="button" className="sw-title-start-button" onClick={onStart}>
                {startWriting}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
});

/**
 * The open book (or e-reader): every chapter is a multi-column box whose columns are its pages, all in one horizontal
 * track behind a clip viewport that shows one spread. Navigation sets the viewport's scrollLeft, so the browser's own
 * caret scrolling keeps working; the scroll handler snaps whatever the browser did back onto a spread.
 */
export const StoryReader = forwardRef<StoryReaderHandle, StoryReaderProps>(function StoryReader(props, ref) {
  // pageAnimation is read at navigation time through `live`.
  const { theme, storyTitle, storyDetails, chapters, generatingChapterId, ghostChapterId, editable, mariImageUrl } =
    props;
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const flipLayerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [fontSignature, setFontSignature] = useState("");
  const [pageCounts, setPageCounts] = useState<Record<string, number>>({});
  const [spread, setSpread] = useState(0);
  // The chapter the author just started on the ghost page, until the shell's chapter list has it.
  const [pendingStart, setPendingStart] = useState<{ id: string; markdown: string } | null>(null);

  const layout = useMemo(
    () => (size.width > 0 && size.height > 0 ? computeReaderLayout({ theme, ...size }) : null),
    [theme, size],
  );
  const pps = layout?.pagesPerSpread ?? 1;
  const chapterLabel = useCallback((number: number) => t("reader.chapterLabel", { number }), [t]);

  const { blocks, totalPages } = useMemo(() => {
    const list: ReaderBlock[] = [];
    let start = 0;
    const push = (block: Omit<ReaderBlock, "start" | "pages">) => {
      const pages = block.kind === "title" ? 1 : Math.max(1, pageCounts[block.key] ?? 1);
      list.push({ ...block, start, pages });
      start += pages;
    };
    push({ key: TITLE_KEY, kind: "title", number: 0, markdown: "", title: "" });
    chapters.forEach((chapter, index) =>
      push({
        key: chapter.id,
        kind: "chapter",
        number: index + 1,
        markdown: chapter.text,
        title: chapterTitle(chapter.text),
      }),
    );
    // The shell may send the new ghost id a render before its chapter list has the started chapter (a query cache
    // notifies later): keep that block, with the same key, so the author's caret survives.
    const started = pendingStart?.id;
    if (pendingStart && started !== ghostChapterId && !chapters.some((chapter) => chapter.id === started)) {
      push({ key: pendingStart.id, kind: "chapter", number: list.length, markdown: pendingStart.markdown, title: "" });
    }
    // Right after the author starts the ghost page, its id is already a chapter; the shell sends a new ghost id.
    if (!chapters.some((chapter) => chapter.id === ghostChapterId)) {
      push({ key: ghostChapterId, kind: "ghost", number: list.length, markdown: "", title: "" });
    }
    return { blocks: list, totalPages: start };
  }, [chapters, ghostChapterId, pageCounts, pendingStart]);

  const totalSpreads = Math.max(1, Math.ceil(totalPages / pps));
  const current = Math.min(spread, totalSpreads - 1);
  const signature = layout ? `${layout.textWidth}x${layout.textHeight}+${layout.gap}/${pps}/${fontSignature}` : "";
  const structureKey = blocks.map((block) => block.key).join("|");
  const pagesSignature = blocks.map((block) => `${block.key}:${block.pages}`).join("|");
  const storyKey = chapters[0]?.storyId ?? "";

  // Handlers and imperative code read the latest render through this; it is synced before any other effect runs.
  const live = useRef<LiveState>({
    layout,
    blocks,
    totalSpreads,
    current,
    signature,
    pageCounts,
    props,
    chapterLabel,
  });
  useLayoutEffect(() => {
    live.current = { layout, blocks, totalSpreads, current, signature, pageCounts, props, chapterLabel };
  });

  const flipRef = useRef<PageFlip | null>(null);
  const smoothRef = useRef<{ left: number; stride: number; until: number; pending: boolean } | null>(null);
  const anchorRef = useRef<Anchor | null>(null);
  const followRef = useRef({ userNavigated: false });
  const pendingCountsRef = useRef<Record<string, number> | null>(null);
  const measureFrameRef = useRef(0);
  const placedStoryRef = useRef<string | null>(null);
  const marginPressRef = useRef(false);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const wheelRef = useRef({ total: 0, last: 0, quietUntil: 0 });

  const isEditingHere = useCallback(() => {
    const active = document.activeElement;
    return active instanceof HTMLElement && active.isContentEditable && !!trackRef.current?.contains(active);
  }, []);

  const caretPage = useCallback((): number | null => {
    const { layout: current } = live.current;
    const track = trackRef.current;
    const selection = document.getSelection();
    if (!current || !track || !selection?.focusNode || !track.contains(selection.focusNode)) return null;
    const rect = selectionFocusRect(selection);
    if (!rect) return null;
    return pageAtTrackX(rect.left - track.getBoundingClientRect().left, current.textWidth, current.gap);
  }, []);

  const blockBody = useCallback(
    (key: string) =>
      trackRef.current?.querySelector<HTMLElement>(`[data-sw-block="${CSS.escape(key)}"] .sw-body`) ?? null,
    [],
  );

  const anchorFor = useCallback((spreadIndex: number): Anchor | null => {
    const state = live.current;
    if (!state.layout) return null;
    const page = spreadIndex * state.layout.pagesPerSpread;
    const block = blockAtPage(state.blocks, page);
    return block ? { key: block.key, page: page - block.start, pages: block.pages, signature: state.signature } : null;
  }, []);

  /** A DOM copy of one page (paper, header, number and its text column) for the flip overlay. */
  const buildFace = useCallback((page: number, side: PageSide): HTMLElement => {
    const { layout: current, blocks: list, props: latest, chapterLabel: label } = live.current;
    const decor = pageDecor(list, page, latest.storyTitle, label);
    const block = blockAtPage(list, page);
    const inner =
      block && current
        ? trackRef.current?.querySelector<HTMLElement>(`[data-sw-block="${CSS.escape(block.key)}"] > .sw-block-inner`)
        : null;
    const content =
      inner && block && current
        ? clonePageText(inner, pageOffset(current, page - block.start), {
            left: current.padX,
            top: current.padTop,
            width: current.textWidth,
            height: current.textHeight,
          })
        : null;
    return createPageFace({ side, header: decor.header, number: decor.number, content });
  }, []);

  const startFlip = useCallback(
    (from: number, to: number): PageFlip | null => {
      const current = live.current.layout;
      const layer = flipLayerRef.current;
      if (!current || !layer) return null;
      const forward = to > from;
      const two = current.pagesPerSpread === 2;
      const oldFirst = from * current.pagesPerSpread;
      const newFirst = to * current.pagesPerSpread;
      return runPageFlip({
        layer,
        direction: forward ? "forward" : "backward",
        pagesPerSpread: current.pagesPerSpread,
        pageWidth: current.pageWidth,
        pageHeight: current.pageHeight,
        spine: current.spine,
        // Forward on a spread: the old left page stays, the old right page turns over onto the new left page.
        staticFace: two
          ? buildFace(forward ? oldFirst : oldFirst + 1, forward ? "left" : "right")
          : forward
            ? null
            : buildFace(oldFirst, "single"),
        front: two
          ? buildFace(forward ? oldFirst + 1 : oldFirst, forward ? "right" : "left")
          : buildFace(forward ? oldFirst : newFirst, "single"),
        back: two ? buildFace(forward ? newFirst : newFirst + 1, forward ? "left" : "right") : createPageBack(),
      });
    },
    [buildFace],
  );

  const navigate = useCallback(
    (target: number, options: { user: boolean; animate?: boolean }) => {
      const state = live.current;
      if (!state.layout) return;
      const to = Math.max(0, Math.min(state.totalSpreads - 1, Math.round(target)));
      flipRef.current?.finish();
      flipRef.current = null;
      if (options.user && state.props.generatingChapterId) followRef.current.userNavigated = true;
      anchorRef.current = anchorFor(to);
      if (to === state.current) return;
      const animate = options.animate !== false && !prefersReducedMotion();
      smoothRef.current = null;
      if (animate && state.props.theme === "book" && state.props.pageAnimation) {
        flipRef.current = startFlip(state.current, to);
      } else if (animate && state.props.theme === "ebook") {
        const stride = state.layout.spreadStride;
        smoothRef.current = { left: to * stride, stride, until: performance.now() + 900, pending: true };
      }
      state.current = to;
      setSpread(to);
    },
    [anchorFor, startFlip],
  );

  // ── Measuring ──

  const measureBlocks = useCallback((): Record<string, number> | null => {
    const { layout: current, pageCounts: known } = live.current;
    const track = trackRef.current;
    if (!current || !track) return null;
    const counts: Record<string, number> = {};
    let changed = false;
    for (const element of track.querySelectorAll<HTMLElement>("[data-sw-block]")) {
      const key = element.dataset.swBlock;
      if (!key || key === TITLE_KEY) continue;
      const inner = element.firstElementChild as HTMLElement | null;
      const pages = inner ? countPages(inner.scrollWidth, current.textWidth, current.gap) : 1;
      counts[key] = pages;
      if (known[key] !== pages) changed = true;
    }
    return changed || Object.keys(counts).length !== Object.keys(known).length ? counts : null;
  }, []);

  const applyCounts = useCallback((counts: Record<string, number> | null, sync: boolean) => {
    if (!counts) return;
    pendingCountsRef.current = counts;
    if (sync) flushSync(() => setPageCounts(counts));
    else setPageCounts(counts);
  }, []);

  /** Content changed inside a block: re-measure in the next frame (or now, from a block's own frame). */
  const handleContentChange = useCallback(
    (now: boolean) => {
      if (now) {
        cancelAnimationFrame(measureFrameRef.current);
        measureFrameRef.current = 0;
        applyCounts(measureBlocks(), true);
        return;
      }
      if (measureFrameRef.current) return;
      measureFrameRef.current = requestAnimationFrame(() => {
        measureFrameRef.current = 0;
        applyCounts(measureBlocks(), true);
      });
    },
    [applyCounts, measureBlocks],
  );

  const handleEdit = useCallback((key: string, markdown: string, start: boolean) => {
    const { props: latest } = live.current;
    if (start) {
      setPendingStart({ id: key, markdown });
      latest.onStartChapter(key, markdown);
    } else {
      latest.onChapterChange(key, markdown);
    }
  }, []);

  useEffect(() => {
    if (!pendingStart) return;
    if (chapters.some((chapter) => chapter.id === pendingStart.id)) {
      setPendingStart(null);
      return;
    }
    // The shell never added it (the start failed): stop holding the block.
    const timer = window.setTimeout(() => setPendingStart(null), 3000);
    return () => window.clearTimeout(timer);
  }, [chapters, pendingStart]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const probe = probeRef.current;
    if (!root || !probe) return;
    const readSize = () => {
      const box = root.getBoundingClientRect();
      const width = Math.round(box.width);
      const height = Math.round(box.height);
      setSize((previous) => (previous.width === width && previous.height === height ? previous : { width, height }));
    };
    // The probe is set in the reading font: its size changes with the font, its size and when a web font loads.
    const readFont = () => {
      const box = probe.getBoundingClientRect();
      setFontSignature(`${box.width.toFixed(1)}x${box.height.toFixed(1)}`);
    };
    readSize();
    readFont();
    const observer = new ResizeObserver((entries) => {
      if (entries.some((entry) => entry.target === root)) readSize();
      if (entries.some((entry) => entry.target === probe)) readFont();
    });
    observer.observe(root);
    observer.observe(probe);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    followRef.current = { userNavigated: false };
  }, [generatingChapterId]);

  // New blocks, a new size or a new font: measure every block before the browser paints.
  useLayoutEffect(() => {
    if (!layout) return;
    flipRef.current?.finish();
    applyCounts(measureBlocks(), false);
  }, [layout, structureKey, signature, applyCounts, measureBlocks]);

  // Pages moved: keep the caret, the opened story or the page being read in view, then follow the stream.
  useLayoutEffect(() => {
    if (!layout) return;
    const pending = pendingCountsRef.current;
    if (pending && pending !== pageCounts) return;
    pendingCountsRef.current = null;
    const state = live.current;
    const placing = placedStoryRef.current !== storyKey;
    placedStoryRef.current = storyKey;
    let target = state.current;
    let restored: Anchor | null = null;
    if (isEditingHere()) {
      const page = caretPage();
      if (page !== null) target = spreadOfPage(page, pps);
    } else if (placing) {
      // A story opens where it ends: the last page of its last chapter.
      const last = [...state.blocks].reverse().find((block) => block.kind === "chapter");
      target = last ? spreadOfPage(last.start + last.pages - 1, pps) : 0;
    } else if (anchorRef.current) {
      const anchor = anchorRef.current;
      const block = state.blocks.find((candidate) => candidate.key === anchor.key);
      if (block) {
        // Same pagination: the same page. A new size or font: the same place in the chapter (from the middle of the
        // page, so a round trip comes back to where it started).
        const page =
          anchor.signature === signature
            ? Math.min(anchor.page, block.pages - 1)
            : Math.min(block.pages - 1, Math.floor(((anchor.page + 0.5) / anchor.pages) * block.pages));
        target = spreadOfPage(block.start + page, pps);
        restored = { key: block.key, page, pages: block.pages, signature };
      }
    }
    if (target !== state.current) navigate(target, { user: false, animate: false });
    // Keep the exact page rather than the spread's first page, so repeated re-pagination does not drift.
    anchorRef.current = restored ?? anchorFor(target);
    const generating = generatingChapterId
      ? state.blocks.find((block) => block.key === generatingChapterId)
      : undefined;
    if (generating && !followRef.current.userNavigated) {
      const followTarget = spreadOfPage(generating.start + generating.pages - 1, pps);
      if (followTarget !== live.current.current) navigate(followTarget, { user: false });
    }
  }, [
    layout,
    pagesSignature,
    pageCounts,
    signature,
    storyKey,
    generatingChapterId,
    pps,
    navigate,
    anchorFor,
    caretPage,
    isEditingHere,
  ]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !layout) return;
    const left = current * layout.spreadStride;
    const smooth = smoothRef.current;
    if (smooth?.pending) {
      smooth.pending = false;
      viewport.scrollTo({ left, behavior: "smooth" });
      return;
    }
    if (smooth && smooth.stride === layout.spreadStride && performance.now() < smooth.until) return;
    smoothRef.current = null;
    if (Math.abs(viewport.scrollLeft - left) >= 1) viewport.scrollLeft = left;
  }, [current, layout, totalSpreads]);

  // The browser scrolls the clip viewport on its own (caret, find in page): snap that onto a spread.
  const hasLayout = layout !== null;
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let frame = 0;
    const settle = () => {
      frame = 0;
      const { layout: current, current: active } = live.current;
      if (!current) return;
      const smooth = smoothRef.current;
      if (smooth && performance.now() < smooth.until && Math.abs(viewport.scrollLeft - smooth.left) > 1) return;
      smoothRef.current = null;
      const expected = active * current.spreadStride;
      if (Math.abs(viewport.scrollLeft - expected) < 1) return;
      const page = isEditingHere() ? caretPage() : null;
      const target =
        page !== null
          ? spreadOfPage(page, current.pagesPerSpread)
          : Math.round(viewport.scrollLeft / current.spreadStride);
      if (target !== active) navigate(target, { user: true, animate: false });
      else viewport.scrollLeft = expected;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(settle);
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("scroll", onScroll);
    };
  }, [hasLayout, navigate, caretPage, isEditingHere]);

  // The caret is always on a visible page: typing past the last line turns the page.
  useEffect(() => {
    let frame = 0;
    const follow = () => {
      frame = 0;
      const { layout: current, current: active } = live.current;
      if (!current || !isEditingHere()) return;
      const page = caretPage();
      if (page === null) return;
      const target = spreadOfPage(page, current.pagesPerSpread);
      if (target !== active) navigate(target, { user: true, animate: false });
    };
    const onSelectionChange = () => {
      if (!frame) frame = requestAnimationFrame(follow);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [navigate, caretPage, isEditingHere]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const root = rootRef.current;
      if (!root?.isConnected || root.getClientRects().length === 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target && isTypingTarget(target)) return;
      // Only when focus is in Story Writer (or nowhere), never in the Engine's own chrome.
      const scope = root.closest("marinara-capability-story-writer") ?? root;
      if (target && target !== document.body && !scope.contains(target)) return;
      // The drawer and the note scroll with these keys; they turn pages only from the book itself.
      if (target?.closest(".sw-drawer, .sw-note-anchor")) return;
      const { current: active, totalSpreads: total } = live.current;
      const next =
        event.key === "ArrowRight" || event.key === "PageDown"
          ? active + 1
          : event.key === "ArrowLeft" || event.key === "PageUp"
            ? active - 1
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? total - 1
                : null;
      if (next === null) return;
      event.preventDefault();
      navigate(next, { user: true });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  useEffect(
    () => () => {
      flipRef.current?.finish();
      cancelAnimationFrame(measureFrameRef.current);
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      scrollToChapter(chapterId: string) {
        const { blocks: list, layout: current } = live.current;
        const block = list.find((candidate) => candidate.key === chapterId);
        if (block && current) navigate(spreadOfPage(block.start, current.pagesPerSpread), { user: true });
      },
    }),
    [navigate],
  );

  // ── Pointer input ──

  /** Puts the caret where the author clicked a page, even below the last line or in the margins. */
  const placeCaretAt = (x: number, y: number) => {
    const { layout: current, blocks: list, current: active, props: latest } = live.current;
    const viewport = viewportRef.current;
    if (!current || !viewport || !latest.editable) return;
    const box = viewport.getBoundingClientRect();
    const index = current.pagesPerSpread === 2 && x - box.left > current.textWidth + current.gap / 2 ? 1 : 0;
    const page = active * current.pagesPerSpread + index;
    const block = blockAtPage(list, page);
    // The blank page after the end of the book continues the last block (the ghost page).
    const target = block ?? list[list.length - 1];
    if (!target || target.kind === "title") return;
    const body = blockBody(target.key);
    if (!body?.isContentEditable) return;
    const left = box.left + index * (current.textWidth + current.gap);
    const clampedX = Math.min(left + current.textWidth - 2, Math.max(left + 2, x));
    const clampedY = Math.min(box.top + current.textHeight - 2, Math.max(box.top + 2, y));
    const range = block ? caretRangeNear(body, clampedX, clampedY, box.top, box.top + current.textHeight) : null;
    focusEditableAt(body, range, page >= target.start + target.pages - 1 ? "end" : "start");
  };

  const isOwnControl = (target: Element) => !!target.closest("button, a, input, textarea, select");
  const isEditableBody = (target: Element) => !!(target.closest(".sw-body") as HTMLElement | null)?.isContentEditable;

  const handleBookMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    marginPressRef.current = false;
    const target = event.target as Element;
    if (event.button !== 0 || !editable || isOwnControl(target) || isEditableBody(target)) return;
    // Keep the current caret until the click places the new one (no blur and re-render in between).
    event.preventDefault();
    marginPressRef.current = true;
  };

  const handleBookClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const fromMargin = marginPressRef.current;
    marginPressRef.current = false;
    const target = event.target as Element;
    if (isOwnControl(target) || isEditableBody(target)) return;
    // A selection dragged out of the text onto the margin stays selected.
    if (!fromMargin && !(document.getSelection()?.isCollapsed ?? true)) return;
    placeCaretAt(event.clientX, event.clientY);
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchRef.current =
      event.touches.length === 1 && touch && !isEditingHere() ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchRef.current;
    touchRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 40) navigate(live.current.current + (dx < 0 ? 1 : -1), { user: true });
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    const wheel = wheelRef.current;
    const now = performance.now();
    // One page per horizontal swipe: a trackpad keeps sending momentum after the fingers lift.
    if (now < wheel.quietUntil) {
      wheel.quietUntil = now + 250;
      return;
    }
    wheel.total = now - wheel.last > 300 ? event.deltaX : wheel.total + event.deltaX;
    wheel.last = now;
    if (Math.abs(wheel.total) < 60) return;
    navigate(live.current.current + (wheel.total > 0 ? 1 : -1), { user: true });
    wheel.total = 0;
    wheel.quietUntil = now + 450;
  };

  const startWriting = useCallback(() => {
    const { blocks: list, layout: current } = live.current;
    const ghost = list.find((block) => block.kind === "ghost");
    if (!ghost || !current) return;
    navigate(spreadOfPage(ghost.start, current.pagesPerSpread), { user: true });
    const body = blockBody(ghost.key);
    if (body?.isContentEditable) focusEditableAt(body, null, "start");
  }, [blockBody, navigate]);

  // ── Render ──

  const rootStyle = layout
    ? ({
        "--sw-text-w": `${layout.textWidth}px`,
        "--sw-text-h": `${layout.textHeight}px`,
        "--sw-gap": `${layout.gap}px`,
        "--sw-pad-x": `${layout.padX}px`,
        "--sw-pad-y": `${layout.padY}px`,
        "--sw-page-w": `${layout.pageWidth}px`,
        "--sw-page-h": `${layout.pageHeight}px`,
      } as CSSProperties)
    : undefined;

  let content = null;
  if (layout) {
    const sides: PageSide[] = pps === 2 ? ["left", "right"] : ["single"];
    const first = current * pps;
    const progress = totalSpreads > 1 ? current / (totalSpreads - 1) : 0;
    // The stack of read pages grows on the left as the story goes on; the unread stack on the right shrinks.
    const leftStack = Math.max(1, Math.round(layout.stack * (0.25 + 0.75 * progress)));
    const rightStack = Math.max(1, Math.round(layout.stack * (1 - 0.75 * progress)));
    const lastChapter = [...blocks].reverse().find((block) => block.kind === "chapter");
    const numberedPages = lastChapter ? lastChapter.start + lastChapter.pages - 1 : 0;
    const visible = sides.map((_, index) => blockAtPage(blocks, first + index));
    const shownChapterIndex = visible.findIndex((block) => block?.kind === "chapter");
    const shownChapter = shownChapterIndex >= 0 ? visible[shownChapterIndex] : null;
    const indicator = shownChapter
      ? t("reader.indicator", { chapter: shownChapter.number, page: first + shownChapterIndex, total: numberedPages })
      : visible[0]?.kind === "ghost"
        ? t("reader.indicatorNext", { chapter: chapters.length + 1 })
        : t("reader.indicatorTitle");
    let previousChapterSpread: number | null = null;
    let nextChapterSpread: number | null = null;
    for (const block of blocks) {
      const blockSpread = spreadOfPage(block.start, pps);
      if (blockSpread < current) previousChapterSpread = blockSpread;
      else if (blockSpread > current && nextChapterSpread === null) nextChapterSpread = blockSpread;
    }
    // Beside the book; on narrow screens, tabs over the page edges that stop short of the text.
    const arrowWidth = layout.arrowsOutside ? 44 : 40;
    const arrowTop = Math.round(layout.frameTop + layout.frameHeight / 2 - (layout.arrowsOutside ? 22 : 28));
    const arrowInset = layout.arrowsOutside
      ? -52
      : Math.max(-layout.frameLeft - 10, Math.min(-6, layout.pagesLeft + layout.padX - arrowWidth - 2));

    content = (
      <>
        <div
          className="sw-book"
          style={{ left: layout.frameLeft, top: layout.frameTop, width: layout.frameWidth, height: layout.frameHeight }}
          onMouseDown={handleBookMouseDown}
          onClick={handleBookClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          {theme === "book" ? (
            <>
              <div
                className="sw-stack sw-stack--right"
                style={{
                  left: layout.pagesLeft + layout.pagesWidth,
                  top: layout.pagesTop + 2,
                  width: rightStack,
                  height: layout.pageHeight - 3,
                }}
              />
              {pps === 2 ? (
                <div
                  className="sw-stack sw-stack--left"
                  style={{
                    left: layout.pagesLeft - leftStack,
                    top: layout.pagesTop + 2,
                    width: leftStack,
                    height: layout.pageHeight - 3,
                  }}
                />
              ) : null}
              <div
                className="sw-stack sw-stack--bottom"
                style={{
                  left: layout.pagesLeft + 3,
                  top: layout.pagesTop + layout.pageHeight,
                  width: layout.pagesWidth - 6,
                  height: Math.max(2, Math.round(layout.stack * 0.6)),
                }}
              />
            </>
          ) : null}
          <div
            className="sw-pages"
            style={{
              left: layout.pagesLeft,
              top: layout.pagesTop,
              width: layout.pagesWidth,
              height: layout.pageHeight,
            }}
          >
            {sides.map((side, index) => {
              const decor = pageDecor(blocks, first + index, storyTitle, chapterLabel);
              return (
                <div
                  key={side}
                  className={`sw-page sw-page--${side}`}
                  style={{
                    left: index * (layout.pageWidth + layout.spine),
                    width: layout.pageWidth,
                    height: layout.pageHeight,
                  }}
                  aria-hidden="true"
                >
                  {decor.header ? (
                    <span className={`sw-page-header sw-page-header--${side}`}>{decor.header}</span>
                  ) : null}
                  {decor.number ? (
                    <span className={`sw-page-number sw-page-number--${side}`}>{decor.number}</span>
                  ) : null}
                </div>
              );
            })}
            {pps === 2 && layout.spine > 0 ? (
              <div className="sw-spine" style={{ left: layout.pageWidth, width: layout.spine }} aria-hidden="true" />
            ) : null}
            <div
              ref={viewportRef}
              className="sw-viewport"
              style={{ left: layout.padX, top: layout.padTop, width: layout.spreadWidth, height: layout.textHeight }}
            >
              <div
                ref={trackRef}
                className="sw-track"
                style={{ width: totalSpreads * layout.spreadStride, gap: layout.gap }}
              >
                {blocks.map((block) =>
                  block.kind === "title" ? (
                    <TitlePage
                      key={block.key}
                      width={layout.textWidth}
                      title={storyTitle}
                      details={storyDetails}
                      showStart={chapters.length === 0}
                      canStart={editable}
                      mariImageUrl={mariImageUrl}
                      startHere={t("reader.startHere")}
                      startWriting={t("reader.startWriting")}
                      onStart={startWriting}
                    />
                  ) : (
                    <ChapterBlock
                      key={block.key}
                      blockKey={block.key}
                      kind={block.kind}
                      label={chapterLabel(block.number)}
                      bodyLabel={t("reader.chapterBody", { number: block.number })}
                      placeholder={
                        block.key === generatingChapterId
                          ? t("reader.generatingPlaceholder")
                          : block.kind === "ghost"
                            ? editable
                              ? t("reader.ghostPlaceholder")
                              : t("reader.ghostWaiting")
                            : t("reader.emptyChapterPlaceholder")
                      }
                      markdown={block.markdown}
                      width={blockWidth(block.pages, layout.textWidth, layout.gap)}
                      editable={editable}
                      generating={block.key === generatingChapterId}
                      onEdit={handleEdit}
                      onContentChange={handleContentChange}
                    />
                  ),
                )}
              </div>
            </div>
            {theme === "ebook" ? (
              <div className="sw-progress" style={{ left: layout.padX, right: layout.padX }} aria-hidden="true">
                <span style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            ) : null}
            <div ref={flipLayerRef} className="sw-flip-layer" aria-hidden="true" />
          </div>
        </div>
        <button
          type="button"
          className="sw-nav-arrow sw-nav-arrow--previous"
          style={{ left: layout.frameLeft + arrowInset, top: arrowTop }}
          disabled={current <= 0}
          aria-label={t("reader.previousPage")}
          title={t("reader.previousPage")}
          onClick={() => navigate(current - 1, { user: true })}
        >
          <ChevronLeft aria-hidden="true" size={24} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="sw-nav-arrow sw-nav-arrow--next"
          style={{ left: layout.frameLeft + layout.frameWidth - arrowWidth - arrowInset, top: arrowTop }}
          disabled={current >= totalSpreads - 1}
          aria-label={t("reader.nextPage")}
          title={t("reader.nextPage")}
          onClick={() => navigate(current + 1, { user: true })}
        >
          <ChevronRight aria-hidden="true" size={24} strokeWidth={1.75} />
        </button>
        <div className="sw-reader-footer" style={{ top: layout.footerTop, height: layout.footerHeight }}>
          <div className="sw-reader-footer-bar">
            <button
              type="button"
              disabled={previousChapterSpread === null}
              aria-label={t("reader.previousChapter")}
              title={t("reader.previousChapter")}
              onClick={() => previousChapterSpread !== null && navigate(previousChapterSpread, { user: true })}
            >
              <ChevronsLeft aria-hidden="true" size={18} />
            </button>
            <span className="sw-indicator" aria-live="polite">
              {indicator}
            </span>
            <button
              type="button"
              disabled={nextChapterSpread === null}
              aria-label={t("reader.nextChapter")}
              title={t("reader.nextChapter")}
              onClick={() => nextChapterSpread !== null && navigate(nextChapterSpread, { user: true })}
            >
              <ChevronsRight aria-hidden="true" size={18} />
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      ref={rootRef}
      className="sw-reader"
      data-theme={theme}
      data-pps={pps}
      data-arrows={layout?.arrowsOutside === false ? "inside" : "outside"}
      data-editable={editable ? "true" : "false"}
      role="region"
      aria-label={t("reader.region")}
      style={rootStyle}
    >
      <span ref={probeRef} className="sw-probe" aria-hidden="true">
        {FONT_PROBE_TEXT}
      </span>
      {content}
    </div>
  );
});
