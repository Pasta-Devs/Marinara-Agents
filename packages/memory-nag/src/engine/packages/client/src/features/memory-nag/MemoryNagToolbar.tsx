import { Lock, MessageSquareQuote, RefreshCw, Unlock } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import type { MemoryNagRecall } from "../../../../shared/src/features/agents/memory-nag/schema.js";
import { memoryNagRequest } from "./api";
import { useMemoryNagTranslation } from "./localization";
import type { CapabilityProps } from "./types";

function recallWords(nags: string[], empty: string): string[] {
  const splitWords = (value: string, minimumLength: number) =>
    value.split(/[^\p{L}\p{N}\p{M}'’-]+/u).filter((word) => word.length >= minimumLength && /[\p{L}\p{N}]/u.test(word));
  const words = splitWords(nags.join(" "), 3);
  return words.length > 0 ? words : splitWords(empty, 1);
}

export function MemoryNagToolbar({ props }: { props: CapabilityProps }) {
  const { t } = useMemoryNagTranslation();
  const chatId = props.chatId ?? "";
  const enabled = props.chatMode === "roleplay" && Boolean(chatId);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [wordIndex, setWordIndex] = useState(0);
  const vault = useQuery({
    enabled,
    queryKey: ["memory-nag", "recall", chatId],
    queryFn: () => memoryNagRequest<MemoryNagRecall | null>(`/recall/${encodeURIComponent(chatId)}`),
    refetchInterval: 2500,
  });
  const hasCompletedRecall = vault.data !== undefined && vault.data !== null;
  const nags = useMemo(() => vault.data?.nags ?? [], [vault.data?.nags]);
  const words = useMemo(() => recallWords(nags, t("memoryNag.toolbar.emptyWord")), [nags, t]);

  useEffect(() => {
    if (!hasCompletedRecall || words.length === 0) return;
    setWordIndex(nags.length > 0 ? Math.floor(Math.random() * words.length) : 0);
    const timer = window.setInterval(() => {
      setWordIndex((current) =>
        nags.length > 0 ? Math.floor(Math.random() * words.length) : (current + 1) % words.length,
      );
    }, 3000);
    return () => window.clearInterval(timer);
  }, [hasCompletedRecall, nags.length, words]);

  const computePosition = useCallback(() => {
    const anchor = buttonRef.current?.getBoundingClientRect();
    if (!anchor) return null;
    const width = popoverRef.current?.offsetWidth ?? 288;
    const height = popoverRef.current?.offsetHeight ?? 160;
    const left =
      window.innerWidth < 768
        ? Math.round((window.innerWidth - width) / 2)
        : Math.min(anchor.left, window.innerWidth - width - 8);
    return {
      top: Math.max(8, Math.min(anchor.bottom + 4, window.innerHeight - height - 8)),
      left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
    };
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    setPosition(computePosition());
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    const update = () => setPosition(computePosition());
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const observer = new ResizeObserver(update);
    if (popoverRef.current) observer.observe(popoverRef.current);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      observer.disconnect();
    };
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!enabled) return null;
  return (
    <div className="mn-shell mn-toolbar">
      <button
        ref={buttonRef}
        type="button"
        className={`${props.toolbarButtonClass ?? "mari-chrome-control mari-chrome-control--small mn-toolbar-button--fallback"} mn-toolbar-button`}
        aria-expanded={open}
        aria-label={t("memoryNag.toolbar.label")}
        onClick={() => setOpen((value) => !value)}
      >
        {hasCompletedRecall ? (
          <span className="mn-toolbar-word" aria-hidden="true">
            {words[wordIndex] ?? words[0]}
          </span>
        ) : (
          <MessageSquareQuote className="mn-toolbar-initial-icon" aria-hidden="true" />
        )}
      </button>
      {open
        ? createPortal(
            <div
              ref={popoverRef}
              data-chat-floating-panel
              className="mn-shell mn-popover"
              style={
                position
                  ? { position: "fixed", top: position.top, left: position.left }
                  : { position: "fixed", top: -9999, left: -9999 }
              }
            >
              <div className="mn-popover-header">
                <strong className="mn-popover-title">
                  <MessageSquareQuote className="mn-popover-title-icon" aria-hidden="true" />
                  {t("memoryNag.toolbar.label")}
                </strong>
                <div className="mn-popover-actions">
                  {props.onRerunTracker ? (
                    <button
                      type="button"
                      className="mn-popover-action"
                      disabled={props.trackerRetryBusy}
                      title={t("memoryNag.toolbar.regenerate")}
                      aria-label={t("memoryNag.toolbar.regenerate")}
                      onClick={props.onRerunTracker}
                    >
                      <RefreshCw
                        className={`mn-popover-action-icon${props.trackerRetryBusy ? " mn-spin" : ""}`}
                        aria-hidden="true"
                      />
                    </button>
                  ) : null}
                  {props.onToggleLockMode ? (
                    <button
                      type="button"
                      className={`mn-popover-action${props.lockMode ? " mn-popover-action--active" : ""}`}
                      title={t(props.lockMode ? "memoryNag.toolbar.unlock" : "memoryNag.toolbar.lock")}
                      aria-label={t(props.lockMode ? "memoryNag.toolbar.unlock" : "memoryNag.toolbar.lock")}
                      aria-pressed={props.lockMode === true}
                      onClick={props.onToggleLockMode}
                    >
                      {props.lockMode ? (
                        <Lock className="mn-popover-action-icon" aria-hidden="true" />
                      ) : (
                        <Unlock className="mn-popover-action-icon" aria-hidden="true" />
                      )}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mn-popover-body">
                {nags.length > 0 ? (
                  <ul className="mn-popover-list">
                    {nags.map((nag, index) => (
                      <li key={`${index}-${nag}`}>{nag}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mn-popover-empty">{t("memoryNag.toolbar.none")}</p>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
