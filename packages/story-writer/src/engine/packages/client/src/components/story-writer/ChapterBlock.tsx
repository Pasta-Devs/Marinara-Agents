import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { htmlToMarkdown, markdownToHtml } from "../../lib/story-writer/markdown";
import { caretRangeAt, focusEditableAt } from "./reader-caret";

export interface ChapterBlockProps {
  blockKey: string;
  /** "ghost": the empty page after the last chapter; typing into it starts the next chapter. */
  kind: "chapter" | "ghost";
  label: string;
  bodyLabel: string;
  placeholder: string;
  markdown: string;
  /** The block's pages, so the next block starts on a new page. */
  width: number;
  editable: boolean;
  generating: boolean;
  onEdit(blockKey: string, markdown: string, start: boolean): void;
  /** The body's content changed; `now` measures in this frame (the caller is already in requestAnimationFrame). */
  onContentChange(now: boolean): void;
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

  useLayoutEffect(() => {
    latestRef.current = markdown;
    const body = bodyRef.current;
    if (!body || markdown === shownRef.current) return;
    cancelAnimationFrame(frameRef.current);
    if (generating) {
      // Streamed text: render at most once a frame and measure the pages in that same frame.
      frameRef.current = requestAnimationFrame(() => {
        renderBody(body, latestRef.current);
        shownRef.current = latestRef.current;
        onContentChange(true);
      });
      return;
    }
    // Never replace what the author is typing into; blur renders it again from Markdown.
    if (document.activeElement === body) return;
    const mounting = shownRef.current === null;
    renderBody(body, markdown);
    shownRef.current = markdown;
    // On mount the reader measures every block itself.
    if (!mounting) onContentChange(false);
  }, [markdown, generating, onContentChange]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  useEffect(() => {
    // A generation started: the caret must not stay in a page that is now read-only.
    const body = bodyRef.current;
    if (!canEdit && body && document.activeElement === body) body.blur();
  }, [canEdit]);

  const handleInput = () => {
    const body = bodyRef.current;
    if (!body) return;
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

  const handleBlur = () => {
    const body = bodyRef.current;
    // The window lost focus, not the page: keep the author's caret.
    if (!body || document.activeElement === body) return;
    // Typed *asterisks* become formatting once the author leaves the page.
    const next = htmlToMarkdown(body);
    renderBody(body, next);
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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Escape leaves the text, so the arrow keys turn pages again.
    if (event.key !== "Escape") return;
    event.preventDefault();
    bodyRef.current?.blur();
  };

  return (
    <div className={`sw-block sw-block--${kind}`} data-sw-block={blockKey} style={{ width }}>
      <div className="sw-columns sw-block-inner">
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
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
});
