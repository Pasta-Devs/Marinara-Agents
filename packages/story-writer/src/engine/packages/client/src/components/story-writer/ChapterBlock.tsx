import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  type ClipboardEvent,
  type DragEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { anchorIndex, htmlToMarkdown, markdownToHtml } from "../../lib/story-writer/markdown";
import type { StoryIllustration } from "../../lib/story-writer/model";
import { caretRangeAt, focusEditableAt } from "./reader-caret";
import { illustrationBox, type IllustrationBox, type ReaderLayout } from "./reader-layout";

/** What a picture's own buttons do: paint it again, or take it out of the chapter. */
export type PictureAction = "again" | "remove";

export interface PictureLabels {
  again: string;
  remove: string;
}

/** The page a picture is measured against (Book and E-book); the Document theme sizes pictures in CSS. */
export interface PicturePage extends Pick<ReaderLayout, "textWidth" | "textHeight"> {
  fontSize: number;
}

export interface ChapterBlockProps {
  blockKey: string;
  /** "ghost": the empty page after the last chapter; typing into it starts the next chapter. */
  kind: "chapter" | "ghost";
  label: string;
  bodyLabel: string;
  placeholder: string;
  markdown: string;
  /** The block's pages, so the next block starts on a new page. None in the Document theme, which has no pages. */
  width?: number;
  editable: boolean;
  generating: boolean;
  /** The chapter's pictures, each placed before the block it illustrates. */
  illustrations?: StoryIllustration[];
  picturePage?: PicturePage;
  pictureLabels?: PictureLabels;
  onPictureAction?(blockKey: string, illustrationId: string, action: PictureAction): void;
  onEdit(blockKey: string, markdown: string, start: boolean): void;
  /** The body's content changed; `now` measures in this frame (the caller is already in requestAnimationFrame). */
  onContentChange(now: boolean): void;
}

const NO_PICTURES: StoryIllustration[] = [];
const FIGURE = "sw-illustration";
// Lucide's RefreshCw and Trash2, as static markup: the body is managed outside React.
const ICONS: Record<PictureAction, string> = {
  again:
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  remove:
    '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
};

interface PictureOptions {
  illustrations: StoryIllustration[];
  page?: PicturePage;
  labels?: PictureLabels;
  enabled: boolean;
}

function pictureFigure(illustration: StoryIllustration, options: PictureOptions, box: IllustrationBox | null) {
  const figure = document.createElement("figure");
  figure.className = FIGURE;
  figure.contentEditable = "false";
  figure.dataset.swIllustration = illustration.id;
  if (box) {
    // Whole pixels set before the picture loads: the page is laid out once and never shifts.
    figure.dataset.float = box.float ? "true" : "false";
    figure.style.width = `${box.width}px`;
    figure.style.height = `${box.height}px`;
  }
  const image = document.createElement("img");
  image.src = illustration.url;
  image.alt = illustration.prompt;
  image.width = illustration.width;
  image.height = illustration.height;
  image.decoding = "async";
  image.draggable = false;
  figure.append(image);
  if (options.labels) {
    const tools = document.createElement("span");
    tools.className = "sw-illustration-tools";
    for (const action of ["again", "remove"] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sw-illustration-button";
      button.dataset.swPictureAction = action;
      button.disabled = !options.enabled;
      button.setAttribute("aria-label", options.labels[action]);
      button.title = options.labels[action];
      button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[action]}</svg>`;
      tools.append(button);
    }
    figure.append(tools);
  }
  return figure;
}

/** Each body's figures by picture id, so a text render (every frame of a stream) puts the same loaded image back. */
const placedFigures = new WeakMap<HTMLElement, Map<string, { key: string; figure: HTMLElement }>>();

/** Puts each picture before the block it illustrates (found again by its opening words), in the order painted. */
function placePictures(body: HTMLElement, options: PictureOptions) {
  for (const figure of body.querySelectorAll(`figure.${FIGURE}`)) figure.remove();
  const previous = placedFigures.get(body);
  const placed = new Map<string, { key: string; figure: HTMLElement }>();
  placedFigures.set(body, placed);
  if (options.illustrations.length === 0) return;
  const blocks = Array.from(body.children);
  const texts = blocks.map((block) => block.textContent ?? "");
  for (const illustration of options.illustrations) {
    const box = options.page ? illustrationBox(options.page, options.page.fontSize, illustration) : null;
    const key = JSON.stringify([illustration, box, options.enabled, options.labels]);
    const kept = previous?.get(illustration.id);
    const figure = kept?.key === key ? kept.figure : pictureFigure(illustration, options, box);
    placed.set(illustration.id, { key, figure });
    const block = blocks[anchorIndex(texts, illustration.paragraph, illustration.anchor)];
    if (block) body.insertBefore(figure, block);
    else body.append(figure);
  }
}

// A paragraph to put the caret in, so Enter splits paragraphs and typing never lands in a bare text node.
const EMPTY_BODY = "<p><br></p>";
// Set while the author drags a selection out of a chapter, so a move inside the book stays a native move.
let draggingFromBook = false;

function renderBody(body: HTMLElement, markdown: string) {
  body.innerHTML = (markdown.trim() && markdownToHtml(markdown)) || EMPTY_BODY;
  body.dataset.empty = markdown.trim() ? "false" : "true";
}

function insertPlainText(text: string) {
  // execCommand keeps the browser's undo stack; the text is plain, so no markup comes in with it.
  document.execCommand("insertText", false, text.replace(/\r\n?/g, "\n"));
}

/** One chapter (or the ghost page): a non-editable heading and an imperatively managed contentEditable body. */
export const ChapterBlock = memo(function ChapterBlock({
  blockKey,
  kind,
  label,
  bodyLabel,
  placeholder,
  markdown,
  width,
  editable,
  generating,
  illustrations = NO_PICTURES,
  picturePage,
  pictureLabels,
  onPictureAction,
  onEdit,
  onContentChange,
}: ChapterBlockProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  // The Markdown the body shows right now (rendered, or serialized from what the author typed).
  const shownRef = useRef<string | null>(null);
  const latestRef = useRef(markdown);
  const frameRef = useRef(0);
  const startedRef = useRef(false);
  const canEdit = editable && !generating;
  // Every text render replaces the body's children, pictures included, and puts the pictures back at once.
  const picturesRef = useRef<PictureOptions>({ illustrations, enabled: canEdit });

  // First, so the renders below place the pictures of this render.
  useLayoutEffect(() => {
    picturesRef.current = { illustrations, page: picturePage, labels: pictureLabels, enabled: canEdit };
  });

  useLayoutEffect(() => {
    latestRef.current = markdown;
    const body = bodyRef.current;
    if (!body || markdown === shownRef.current) return;
    cancelAnimationFrame(frameRef.current);
    if (generating) {
      // Streamed text: render at most once a frame and measure the pages in that same frame.
      frameRef.current = requestAnimationFrame(() => {
        renderBody(body, latestRef.current);
        placePictures(body, picturesRef.current);
        shownRef.current = latestRef.current;
        onContentChange(true);
      });
      return;
    }
    // Never replace what the author is typing into; blur renders it again from Markdown.
    if (document.activeElement === body) return;
    const mounting = shownRef.current === null;
    renderBody(body, markdown);
    placePictures(body, picturesRef.current);
    shownRef.current = markdown;
    // On mount the reader measures every block itself.
    if (!mounting) onContentChange(false);
  }, [markdown, generating, onContentChange]);

  // New or removed pictures, a new page size or font: only the pictures move, even while the author types.
  const placedRef = useRef(false);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body || shownRef.current === null) return;
    placePictures(body, picturesRef.current);
    // The first run after mount changes nothing the reader has not measured.
    if (placedRef.current) onContentChange(false);
    placedRef.current = true;
  }, [illustrations, picturePage, pictureLabels, canEdit, onContentChange]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  useEffect(() => {
    // A generation started: the caret must not stay in a page that is now read-only.
    const body = bodyRef.current;
    if (!canEdit && body && document.activeElement === body) body.blur();
  }, [canEdit]);

  const handleInput = () => {
    const body = bodyRef.current;
    if (!body) return;
    // The browser deletes a picture with the text around it (Backspace after it joins the paragraphs and takes the
    // picture too). A picture belongs to the chapter, not to its text: the edit stays and the picture comes back.
    const pictures = picturesRef.current;
    if (body.querySelectorAll(`figure.${FIGURE}`).length < pictures.illustrations.length) placePictures(body, pictures);
    const next = htmlToMarkdown(body);
    shownRef.current = next;
    body.dataset.empty = next.trim() ? "false" : "true";
    if (kind === "ghost" && !startedRef.current) {
      // The first real character on the ghost page starts the next chapter (same id, so this element stays).
      if (!next.trim()) return;
      startedRef.current = true;
      onEdit(blockKey, next, true);
    } else {
      onEdit(blockKey, next, false);
    }
    onContentChange(false);
  };

  const handleFocus = () => {
    document.execCommand("defaultParagraphSeparator", false, "p");
    const body = bodyRef.current;
    if (body && !body.firstElementChild && !body.textContent) body.innerHTML = EMPTY_BODY;
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const body = bodyRef.current;
    // The window lost focus, not the page: keep the author's caret. A picture's own button losing focus (it is taken
    // out while the pictures are placed again) is not the author leaving the text either.
    if (!body || event.target !== body || document.activeElement === body) return;
    // Typed *asterisks* become formatting once the author leaves the page.
    const next = htmlToMarkdown(body);
    renderBody(body, next);
    placePictures(body, picturesRef.current);
    shownRef.current = next;
    onContentChange(false);
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    if (text) insertPlainText(text);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const types = Array.from(event.dataTransfer.types);
    if (draggingFromBook || (!types.includes("text/html") && !types.includes("Files"))) return;
    // Rich content from elsewhere comes in as plain text at the drop point.
    event.preventDefault();
    const text = event.dataTransfer.getData("text/plain");
    const body = bodyRef.current;
    const range = caretRangeAt(event.clientX, event.clientY);
    if (!text || !body || !range || !body.contains(range.startContainer)) return;
    focusEditableAt(body, range, "end");
    insertPlainText(text);
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const button = (event.target as Element).closest?.<HTMLButtonElement>("[data-sw-picture-action]");
    const id = button?.closest<HTMLElement>(`figure.${FIGURE}`)?.dataset.swIllustration;
    if (!button || !id || button.disabled) return;
    event.preventDefault();
    onPictureAction?.(blockKey, id, button.dataset.swPictureAction === "remove" ? "remove" : "again");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Escape leaves the text, so the arrow keys turn pages again.
    if (event.key !== "Escape") return;
    event.preventDefault();
    bodyRef.current?.blur();
  };

  return (
    <div className={`sw-block sw-block--${kind}`} data-sw-block={blockKey} style={{ width }}>
      <div className={width === undefined ? "sw-block-inner" : "sw-columns sw-block-inner"}>
        <div className="sw-chapter-head">
          <div className="sw-chapter-label">{label}</div>
          <div className="sw-ornament" aria-hidden="true">
            <span>❦</span>
          </div>
        </div>
        <div
          ref={bodyRef}
          className="sw-body"
          role="textbox"
          aria-multiline="true"
          aria-label={bodyLabel}
          aria-readonly={!canEdit}
          contentEditable={canEdit}
          suppressContentEditableWarning
          dir="auto"
          data-placeholder={placeholder}
          data-generating={generating ? "true" : undefined}
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onPaste={handlePaste}
          onDragStart={() => {
            draggingFromBook = true;
          }}
          onDragEnd={() => {
            draggingFromBook = false;
          }}
          onDrop={handleDrop}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
});
