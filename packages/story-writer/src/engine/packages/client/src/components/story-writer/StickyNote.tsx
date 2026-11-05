// ──────────────────────────────────────────────
// Story Writer: the sticky note in the top corner (the author's note for the next chapter)
// ──────────────────────────────────────────────
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { StickyNote as StickyNoteIcon, X } from "lucide-react";
import { LIMITS, type StorySide } from "../../lib/story-writer/model";
import { useDraftText } from "./sidebar/fields";

const PREVIEW_LENGTH = 140;

export function StickyNote(props: {
  side: StorySide;
  text: string;
  clearAfterChapter: boolean;
  /** Where the note goes in the messages, like Roleplay's Author's Notes (0 = right before the continue message). */
  depth: number;
  open: boolean;
  onOpenChange(open: boolean): void;
  onChange(text: string): void;
  onDepthChange(depth: number): void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const reduceMotion = useReducedMotion();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [draft, update] = useDraftText(props.text, props.onChange);
  const { open, onOpenChange } = props;

  // Rolled out: type straight away. Rolled up from inside: focus goes back to the small note.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) textRef.current?.focus({ preventScroll: true });
    if (!open && wasOpen.current && document.activeElement === document.body) {
      toggleRef.current?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open]);

  const close = () => {
    onOpenChange(false);
    // The open note unmounts with focus inside it; hand focus to the small note before that happens.
    requestAnimationFrame(() => toggleRef.current?.focus({ preventScroll: true }));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };
  const preview = draft.trim().replace(/\s+/g, " ").slice(0, PREVIEW_LENGTH);
  const rollOut = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        // The note unrolls downwards from its tape; the negative insets leave room for the tape and the shadow.
        initial: { opacity: 0.4, clipPath: "inset(-20% -20% 100% -20%)", rotateX: -38, y: -6 },
        animate: { opacity: 1, clipPath: "inset(-20% -20% -20% -20%)", rotateX: 0, y: 0 },
        exit: { opacity: 0, clipPath: "inset(-20% -20% 100% -20%)", rotateX: -30, y: -4 },
      };

  return (
    <div className="sw-note-anchor" data-side={props.side}>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.section
            key="open"
            id={`${id}-note`}
            className="sw-note sw-note-open"
            aria-labelledby={`${id}-title`}
            onKeyDown={onKeyDown}
            style={{ transformPerspective: 900 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.42, ease: [0.22, 1, 0.36, 1] }}
            {...rollOut}
          >
            <span className="sw-note-tape" aria-hidden="true" />
            <div className="sw-note-head">
              <h2 id={`${id}-title`}>{t("note.title")}</h2>
              <button
                type="button"
                className="sw-icon-button"
                aria-expanded="true"
                aria-controls={`${id}-note`}
                aria-label={t("note.close")}
                title={t("note.close")}
                onClick={close}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p id={`${id}-explain`} className="sw-note-explain">
              {t("note.explanation")}
              {props.clearAfterChapter ? ` ${t("note.clearedAfter")}` : ""}
            </p>
            <textarea
              ref={textRef}
              className="sw-note-text"
              value={draft}
              placeholder={t("note.placeholder")}
              aria-label={t("note.label")}
              aria-describedby={`${id}-explain`}
              onChange={(event) => update(event.target.value)}
            />
            <NoteDepth id={`${id}-depth`} value={props.depth} onCommit={props.onDepthChange} />
            <p className="sw-note-foot">{t("note.autosave")}</p>
          </motion.section>
        ) : (
          <motion.button
            key="closed"
            ref={toggleRef}
            type="button"
            className="sw-note sw-note-collapsed"
            aria-expanded="false"
            aria-controls={`${id}-note`}
            aria-label={preview ? `${t("note.open")}: ${preview}` : t("note.open")}
            title={t("note.open")}
            onClick={() => onOpenChange(true)}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: reduceMotion ? 0.12 : 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="sw-note-tape" aria-hidden="true" />
            <StickyNoteIcon className="sw-note-icon" size={24} aria-hidden="true" />
            <span className="sw-note-title">{t("note.title")}</span>
            <span className="sw-note-preview">{preview || t("note.empty")}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A small depth field on the note itself: valid values save as they are typed, anything else is clamped on blur. */
function NoteDepth(props: { id: string; value: number; onCommit(depth: number): void }) {
  const { t } = useTranslation();
  const { min, max } = LIMITS.authorNoteDepth;
  const [draft, setDraft] = useState(String(props.value));
  const [seen, setSeen] = useState(props.value);
  if (props.value !== seen) {
    setSeen(props.value);
    setDraft(String(props.value));
  }
  const parse = (text: string) => (text.trim() === "" ? Number.NaN : Math.round(Number(text)));
  return (
    <div className="sw-note-depth">
      <label htmlFor={props.id}>{t("note.depth")}</label>
      <input
        id={props.id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={draft}
        aria-describedby={`${props.id}-hint`}
        onChange={(event) => {
          setDraft(event.target.value);
          const next = parse(event.target.value);
          if (Number.isFinite(next) && next >= min && next <= max && next !== props.value) props.onCommit(next);
        }}
        onBlur={() => {
          const parsed = parse(draft);
          const next = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : props.value;
          if (next !== props.value) props.onCommit(next);
          setDraft(String(next));
        }}
      />
      <span id={`${props.id}-hint`}>{t("note.depthHint")}</span>
    </div>
  );
}
