import { MessageSquareQuote } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

  if (!enabled) return null;
  return (
    <div className="mn-shell mn-toolbar">
      <button
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
      {open ? (
        <div className="mn-popover">
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
        </div>
      ) : null}
    </div>
  );
}
