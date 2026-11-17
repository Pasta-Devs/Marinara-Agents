// ──────────────────────────────────────────────
// Story Writer: Peek at the prompt (what the Write button would send, as the Engine would send it)
// ──────────────────────────────────────────────
// An in-tree dialog with the drawer's scrim and Escape handling; the view makes everything behind it inert. A prompt
// can run to megabytes, so a long message starts folded and its text is only rendered once it is opened.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, X } from "lucide-react";
import type { PromptPeek } from "../../hooks/use-story-generation";
import { getApiErrorMessage } from "../../lib/api-client";
import { useNumberFormat } from "./sidebar/fields";

/** Messages longer than a short paragraph (the system prompt, chapters) start folded; requests and notes stay open. */
const FOLD_CHARS = 500;
const ROLES = new Set(["system", "user", "assistant"]);

type PeekState =
  | { status: "loading" }
  | { status: "noConnection" }
  | { status: "failed"; message: string }
  | { status: "ready"; peek: PromptPeek };

export function PromptPeekDialog(props: { load(signal: AbortSignal): Promise<PromptPeek | null>; onClose(): void }) {
  const { t } = useTranslation();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const formatNumber = useNumberFormat();
  const [state, setState] = useState<PeekState>({ status: "loading" });
  const { load, onClose } = props;

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (peek) => {
        if (!controller.signal.aborted) setState(peek ? { status: "ready", peek } : { status: "noConnection" });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: "failed", message: getApiErrorMessage(error, t("peek.failed")) });
        }
      },
    );
    return () => controller.abort();
  }, [load, t]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    // aria-modal: Tab and Shift+Tab wrap inside the dialog. Only Story Writer behind it is inert, so without this focus
    // would leave for the Engine's tabs, where Escape no longer reaches the dialog. Its stops change as the prompt loads.
    if (event.key === "Tab") {
      const stops = Array.from(
        (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>("button, summary, [href], [tabindex='0']"),
      );
      const active = document.activeElement;
      if (!active || !stops.length) return;
      const order = (stop: HTMLElement) => active.compareDocumentPosition(stop);
      // Past the last stop (or before the first), go round; anywhere else the browser moves on as usual.
      const more = event.shiftKey
        ? stops.some((stop) => order(stop) & Node.DOCUMENT_POSITION_PRECEDING)
        : stops.some((stop) => order(stop) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (!more) {
        event.preventDefault();
        (event.shiftKey ? stops[stops.length - 1] : stops[0])?.focus();
      }
      return;
    }
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  let body;
  if (state.status === "loading") {
    body = (
      <p className="sw-peek-status" role="status">
        <Loader2 className="sw-spin" size={16} aria-hidden="true" />
        {t("peek.loading")}
      </p>
    );
  } else if (state.status === "noConnection") {
    body = (
      <p className="sw-peek-status" role="status">
        {t("actions.noConnection")}
      </p>
    );
  } else if (state.status === "failed") {
    body = (
      <p className="sw-peek-status" role="alert" data-variant="danger">
        {state.message}
      </p>
    );
  } else {
    const { peek } = state;
    body = (
      <>
        <p className="sw-hint">
          {t(peek.mode === "next" ? "peek.next" : "peek.continue", { number: peek.chapterNumber })}
        </p>
        <dl className="sw-peek-meta">
          <dt>{t("peek.model")}</dt>
          <dd>{peek.model || t("peek.notSet")}</dd>
          <dt>{t("peek.maxTokens")}</dt>
          <dd>{peek.maxTokens === null ? t("peek.notSet") : formatNumber(peek.maxTokens)}</dd>
        </dl>
        <ol className="sw-peek-messages" aria-label={t("peek.messages")}>
          {peek.messages.map((message, index) => (
            <li key={index}>
              <PeekMessage role={message.role} content={message.content} />
            </li>
          ))}
        </ol>
      </>
    );
  }

  return (
    <>
      <div className="sw-scrim sw-peek-scrim" data-open="true" aria-hidden="true" onClick={onClose} />
      {/* A click on the text keeps focus in the dialog (on its body, which the keys then scroll), never on the page,
          where Escape would not reach this handler and the book behind would turn its pages. */}
      <div
        className="sw-peek"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="sw-peek-head">
          <h2 id={titleId}>{t("peek.title")}</h2>
          <button
            ref={closeRef}
            type="button"
            className="sw-icon-button"
            aria-label={t("peek.close")}
            title={t("peek.close")}
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="sw-peek-body" tabIndex={-1}>
          {body}
        </div>
      </div>
    </>
  );
}

function PeekMessage(props: { role: string; content: string }) {
  const { t } = useTranslation();
  const formatNumber = useNumberFormat();
  const length = props.content.length;
  const [open, setOpen] = useState(length <= FOLD_CHARS);
  return (
    <details className="sw-peek-message" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span className="sw-peek-role">{ROLES.has(props.role) ? t(`peek.roles.${props.role}`) : props.role}</span>
        <span className="sw-peek-size">{t("peek.characters", { count: length, formatted: formatNumber(length) })}</span>
      </summary>
      {open ? <pre className="sw-peek-text">{props.content}</pre> : null}
    </details>
  );
}
