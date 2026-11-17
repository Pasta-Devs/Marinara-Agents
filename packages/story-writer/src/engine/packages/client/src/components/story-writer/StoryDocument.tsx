// ──────────────────────────────────────────────
// Story Writer: the Document theme, every chapter one under another in a column that scrolls down
// ──────────────────────────────────────────────
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ChevronsDown, ChevronsUp } from "lucide-react";
import { ChapterBlock } from "./ChapterBlock";
import { prefersReducedMotion } from "./page-flip";
import { caretRangeNear, focusEditableAt, selectionFocusRect } from "./reader-caret";
import {
  TITLE_KEY,
  TitlePage,
  blockPlaceholder,
  useReaderBlocks,
  type StoryReaderHandle,
  type StoryReaderProps,
} from "./StoryReader";

/** Room kept between the edge of the view and the caret, or the last line of the chapter it follows. */
const EDGE = 24;
const NO_PAGES: Record<string, number> = {};
function ignoreContentChange() {}

/**
 * The paperless reader: no pages, columns, page numbers or page turns, so text selects across what were pages and a
 * phone reads it by scrolling. It takes StoryReader's props and handle and ignores the paging ones (theme,
 * pageAnimation). A story opens at its end, and a chapter being written stays in view until the reader scrolls.
 * ponytail: any pointer, wheel or key input in the document stops the following, so a scrollbar drag a browser sends
 * no pointer event for is not noticed; and a new font size or width keeps the place only through the browser's own
 * scroll anchoring, which Safari lacks. Upgrade: compare the offset with the followed one in a scroll handler, and
 * keep the block at the top and its offset across a resize, as StoryReader's anchor does.
 */
export const StoryDocument = forwardRef<StoryReaderHandle, StoryReaderProps>(function StoryDocument(props, ref) {
  const { storyTitle, storyDetails, chapters, generatingChapterId, editable, mariImageUrl, chapterBarHost } = props;
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const { blocks, handleEdit } = useReaderBlocks(props, NO_PAGES);
  const blocksRef = useRef(blocks);
  useLayoutEffect(() => {
    blocksRef.current = blocks;
  });
  // The block whose end stays in view: the last chapter when the story opens, then the chapter being written.
  const pinRef = useRef<string | null>(chapters[chapters.length - 1]?.id ?? null);
  const [currentKey, setCurrentKey] = useState(TITLE_KEY);
  const structureKey = blocks.map((block) => block.key).join("|");

  const blockElement = useCallback(
    (key: string) => columnRef.current?.querySelector<HTMLElement>(`[data-sw-block="${CSS.escape(key)}"]`) ?? null,
    [],
  );

  const isEditingHere = useCallback(() => {
    const active = document.activeElement;
    return active instanceof HTMLElement && active.isContentEditable && !!columnRef.current?.contains(active);
  }, []);

  const keepPinnedInView = useCallback(() => {
    const root = rootRef.current;
    const block = pinRef.current ? blockElement(pinRef.current) : null;
    if (!root || !block) return;
    const top = Math.max(0, block.offsetTop + block.offsetHeight + EDGE - root.clientHeight);
    if (Math.abs(root.scrollTop - top) >= 1) root.scrollTop = top;
  }, [blockElement]);

  /** Scrolls the caret into the part of the document left visible (above the on-screen keyboard too). */
  const revealCaret = useCallback(() => {
    const root = rootRef.current;
    const selection = document.getSelection();
    if (!root || !selection?.focusNode || !root.contains(selection.focusNode)) return;
    const caret = selectionFocusRect(selection);
    if (!caret) return;
    const box = root.getBoundingClientRect();
    const screen = window.visualViewport;
    const top = box.top + EDGE;
    const bottom = Math.min(box.bottom, screen ? screen.offsetTop + screen.height : box.bottom) - EDGE;
    if (caret.top < top) root.scrollTop += caret.top - top;
    else if (caret.bottom > bottom) root.scrollTop += caret.bottom - bottom;
  }, []);

  // ResizeObserver reports after the browser's own layout, so following a streamed chapter never forces one.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const column = columnRef.current;
    if (!root || !column) return;
    const observer = new ResizeObserver(() => {
      if (pinRef.current) keepPinnedInView();
      // A new size (the on-screen keyboard, a bar coming or going) keeps the caret in view.
      else if (isEditingHere()) revealCaret();
    });
    observer.observe(root);
    observer.observe(column);
    return () => observer.disconnect();
  }, [keepPinnedInView, revealCaret, isEditingHere]);

  // Every new run is followed, wherever the reader was.
  useLayoutEffect(() => {
    if (!generatingChapterId) return;
    pinRef.current = generatingChapterId;
    keepPinnedInView();
  }, [generatingChapterId, keepPinnedInView]);

  // The chapter being read is the one crossing a line a third of the way down.
  useEffect(() => {
    const root = rootRef.current;
    const column = columnRef.current;
    if (!root || !column) return;
    const crossing = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = (entry.target as HTMLElement).dataset.swBlock ?? "";
          if (entry.isIntersecting) crossing.add(key);
          else crossing.delete(key);
        }
        const first = blocksRef.current.find((block) => crossing.has(block.key));
        if (first) setCurrentKey(first.key);
      },
      { root, rootMargin: "-33% 0px -66% 0px" },
    );
    for (const element of column.querySelectorAll("[data-sw-block]")) observer.observe(element);
    return () => observer.disconnect();
  }, [structureKey]);

  const scrollToBlock = useCallback(
    (key: string) => {
      const root = rootRef.current;
      const element = blockElement(key);
      if (!root || !element) return;
      pinRef.current = null;
      root.scrollTo({ top: element.offsetTop, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    },
    [blockElement],
  );

  useImperativeHandle(ref, () => ({ scrollToChapter: scrollToBlock }), [scrollToBlock]);

  /** The previous chapter head above the top edge (this chapter's own from inside it), or the next one below it. */
  const scrollToChapterHead = (direction: -1 | 1) => {
    const root = rootRef.current;
    if (!root) return;
    const top = root.scrollTop;
    const heads = Array.from(columnRef.current?.querySelectorAll<HTMLElement>("[data-sw-block]") ?? []);
    const above = heads.filter((element) => element.offsetTop < top - 1);
    const target = direction < 0 ? above[above.length - 1] : heads.find((element) => element.offsetTop > top + 1);
    if (target?.dataset.swBlock) scrollToBlock(target.dataset.swBlock);
  };

  const startWriting = useCallback(() => {
    const ghost = blocksRef.current.find((block) => block.kind === "ghost");
    const body = ghost ? blockElement(ghost.key)?.querySelector<HTMLElement>(".sw-body") : null;
    if (!body?.isContentEditable) return;
    focusEditableAt(body, null, "start");
    revealCaret();
  }, [blockElement, revealCaret]);

  // Scrolling, clicking or typing in the document lets go of the end it was keeping in view.
  const letGo = () => {
    pinRef.current = null;
  };

  /** A click beside the text, on a chapter heading or below its last line puts the caret in that chapter. */
  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (!editable || event.button !== 0 || target.closest("button, a, input, textarea, select")) return;
    if ((target.closest(".sw-body") as HTMLElement | null)?.isContentEditable) return;
    // A selection dragged out of the text stays selected.
    if (!(document.getSelection()?.isCollapsed ?? true)) return;
    const elements = Array.from(columnRef.current?.querySelectorAll<HTMLElement>("[data-sw-block]") ?? []);
    const element =
      elements.find((candidate) => event.clientY < candidate.getBoundingClientRect().bottom) ??
      elements[elements.length - 1];
    const body = element?.querySelector<HTMLElement>(".sw-body");
    if (!body?.isContentEditable) return;
    const box = body.getBoundingClientRect();
    const x = Math.min(box.right - 2, Math.max(box.left + 2, event.clientX));
    const y = Math.min(box.bottom - 2, Math.max(box.top + 2, event.clientY));
    focusEditableAt(
      body,
      caretRangeNear(body, x, y, box.top, box.bottom),
      event.clientY > box.bottom ? "end" : "start",
    );
    revealCaret();
  };

  const currentIndex = Math.max(
    0,
    blocks.findIndex((block) => block.key === currentKey),
  );
  const shown = blocks[currentIndex]!;
  const total = blocks.filter((block) => block.kind === "chapter").length;
  const [indicator, indicatorShort] =
    shown.kind === "chapter"
      ? [
          t("reader.indicatorChapter", { chapter: shown.number, total }),
          t("reader.indicatorChapterShort", { chapter: shown.number, total }),
        ]
      : shown.kind === "ghost"
        ? [
            t("reader.indicatorNextChapter", { chapter: shown.number }),
            t("reader.indicatorNextChapterShort", { chapter: shown.number }),
          ]
        : [t("reader.indicatorTitle"), t("reader.indicatorTitle")];

  return (
    <div
      ref={rootRef}
      className="sw-reader sw-document"
      data-theme="document"
      data-editable={editable ? "true" : "false"}
      role="region"
      aria-label={t("reader.region")}
      tabIndex={0}
      onPointerDown={letGo}
      onWheel={letGo}
      onKeyDown={letGo}
      onClick={handleClick}
    >
      <div ref={columnRef} className="sw-document-column">
        {blocks.map((block) =>
          block.kind === "title" ? (
            <TitlePage
              key={block.key}
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
              label={t("reader.chapterLabel", { number: block.number })}
              bodyLabel={t("reader.chapterBody", { number: block.number })}
              placeholder={blockPlaceholder(t, block, generatingChapterId, editable)}
              markdown={block.markdown}
              editable={editable}
              generating={block.key === generatingChapterId}
              onEdit={handleEdit}
              onContentChange={ignoreContentChange}
            />
          ),
        )}
      </div>
      {chapterBarHost
        ? createPortal(
            <nav className="sw-chapterbar-pill" aria-label={t("tools.chapters")}>
              <button
                type="button"
                disabled={currentIndex === 0}
                aria-label={t("reader.previousChapter")}
                title={t("reader.previousChapter")}
                onClick={() => scrollToChapterHead(-1)}
              >
                <ChevronsUp aria-hidden="true" size={18} />
              </button>
              <span className="sw-indicator" aria-live="polite">
                <span className="sw-indicator-long">{indicator}</span>
                <span className="sw-indicator-short" aria-hidden="true">
                  {indicatorShort}
                </span>
              </span>
              <button
                type="button"
                disabled={currentIndex === blocks.length - 1}
                aria-label={t("reader.nextChapter")}
                title={t("reader.nextChapter")}
                onClick={() => scrollToChapterHead(1)}
              >
                <ChevronsDown aria-hidden="true" size={18} />
              </button>
            </nav>,
            chapterBarHost,
          )
        : null}
    </div>
  );
});
