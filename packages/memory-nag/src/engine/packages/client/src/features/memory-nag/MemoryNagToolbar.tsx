import { MessageSquareQuote } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import type { MemoryNagRecall } from "../../../../shared/src/features/agents/memory-nag/schema.js";
import { memoryNagRequest } from "./api";
import { useMemoryNagTranslation } from "./localization";
import type { CapabilityProps } from "./types";

function recallWords(nags: string[], empty: string): string[] {
  const words = nags
    .join(" ")
    .split(/[^\p{L}\p{N}'’-]+/u)
    .filter((word) => word.length > 2);
  return words.length > 0 ? words : empty.split(/\s+/);
}

export function MemoryNagToolbar({ props }: { props: CapabilityProps }) {
  const { t } = useMemoryNagTranslation();
  const chatId = props.chatId ?? "";
  const enabled = props.chatMode === "roleplay" && Boolean(chatId);
  const compact = props.mobileCompact === true;
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: -9999, left: -9999 });
  const [wordIndex, setWordIndex] = useState(0);
  const vault = useQuery({
    enabled,
    queryKey: ["memory-nag", "recall", chatId],
    queryFn: () => memoryNagRequest<MemoryNagRecall | null>(`/recall/${encodeURIComponent(chatId)}`),
    refetchInterval: 2500,
  });
  const nags = useMemo(() => vault.data?.nags ?? [], [vault.data?.nags]);
  const words = useMemo(() => recallWords(nags, t("memoryNag.toolbar.emptyWord")), [nags, t]);

  useEffect(() => {
    setWordIndex(nags.length > 0 ? Math.floor(Math.random() * words.length) : 0);
    const timer = window.setInterval(() => {
      setWordIndex((current) =>
        nags.length > 0 ? Math.floor(Math.random() * words.length) : (current + 1) % words.length,
      );
    }, 1500);
    return () => window.clearInterval(timer);
  }, [nags.length, words]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = buttonRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const width = popoverRef.current?.offsetWidth ?? 352;
      const height = popoverRef.current?.offsetHeight ?? 160;
      setPosition({
        top: Math.max(8, Math.min(anchor.bottom + 4, window.innerHeight - height - 8)),
        left: Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, nags.length]);

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
        className={`${props.toolbarButtonClass ?? "mari-chrome-control mari-chrome-control--small"} mn-toolbar-button${compact ? " mn-toolbar-button--compact" : ""}`}
        aria-expanded={open}
        aria-label={t("memoryNag.toolbar.label")}
        onClick={() => setOpen((value) => !value)}
      >
        <MessageSquareQuote className="mn-icon" aria-hidden="true" />
        <span className="mn-toolbar-word" aria-hidden="true">
          {words[wordIndex] ?? words[0]}
        </span>
      </button>
      {open
        ? createPortal(
            <div ref={popoverRef} className="mn-shell mn-popover" style={position}>
              <strong>{t("memoryNag.toolbar.label")}</strong>
              {nags.length > 0 ? (
                <ul>
                  {nags.map((nag, index) => (
                    <li key={`${index}-${nag}`}>{nag}</li>
                  ))}
                </ul>
              ) : (
                <p className="mn-muted">{t("memoryNag.toolbar.none")}</p>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
