import { ChevronDown, MessageSquareQuote } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MemoryNagRecall } from "../../../../shared/src/features/agents/memory-nag/schema.js";
import { memoryNagRequest } from "./api";
import { useMemoryNagTranslation } from "./localization";
import type { CapabilityProps } from "./types";

export function MemoryNagTrackerPanel({ props }: { props: CapabilityProps }) {
  const { t } = useMemoryNagTranslation();
  const chatId = props.chatId ?? "";
  const enabled = props.chatMode === "roleplay" && Boolean(chatId);
  const mobileCompact = props.mobileCompact === true;
  const [index, setIndex] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const vault = useQuery({
    enabled,
    queryKey: ["memory-nag", "recall", chatId],
    queryFn: () => memoryNagRequest<MemoryNagRecall | null>(`/recall/${encodeURIComponent(chatId)}`),
    refetchInterval: 2500,
  });
  const nags = vault.data?.nags ?? [];

  useEffect(() => {
    setIndex(0);
    if (nags.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % nags.length), 4000);
    return () => window.clearInterval(timer);
  }, [nags.length]);

  if (!enabled) return null;
  const heading = (
    <>
      {!mobileCompact ? (
        <span className="mn-tracker-chevron-frame" aria-hidden="true">
          <ChevronDown className={`mn-tracker-chevron${collapsed ? " mn-tracker-chevron--collapsed" : ""}`} />
        </span>
      ) : null}
      <span className="mn-tracker-icon" aria-hidden="true">
        <MessageSquareQuote className="mn-tracker-panel-icon" />
      </span>
      <strong className="mn-tracker-title">{t("memoryNag.tracker.title")}</strong>
    </>
  );
  return (
    <section className={`mn-shell mn-tracker${mobileCompact ? " mn-tracker--mobile-compact" : ""}`}>
      {!mobileCompact ? <div className="mn-tracker-veil" aria-hidden="true" /> : null}
      <div className="mn-tracker-content">
        <div className="mn-tracker-header">
          {mobileCompact ? (
            <div className="mn-tracker-toggle mn-tracker-toggle--static">{heading}</div>
          ) : (
            <button
              type="button"
              className="mn-tracker-toggle"
              aria-expanded={!collapsed}
              aria-label={t("memoryNag.tracker.title")}
              onClick={() => setCollapsed((value) => !value)}
            >
              {heading}
            </button>
          )}
        </div>
        {mobileCompact || !collapsed ? (
          <div className={`mn-tracker-value${nags.length === 0 ? " mn-tracker-value--empty" : ""}`}>
            {nags[index] ?? t("memoryNag.tracker.none")}
          </div>
        ) : null}
      </div>
    </section>
  );
}
