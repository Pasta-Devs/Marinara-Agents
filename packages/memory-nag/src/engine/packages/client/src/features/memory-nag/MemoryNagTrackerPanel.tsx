import { Brain } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MemoryNagRecall } from "../../../../shared/src/features/agents/memory-nag/schema.js";
import { memoryNagRequest } from "./api";
import { useMemoryNagTranslation } from "./localization";
import type { CapabilityProps } from "./types";

export function MemoryNagTrackerPanel({ props }: { props: CapabilityProps }) {
  const { t } = useMemoryNagTranslation();
  const chatId = props.chatId ?? "";
  const [index, setIndex] = useState(0);
  const vault = useQuery({
    enabled: Boolean(chatId),
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

  if (!chatId) return null;
  return (
    <section className="mn-shell mn-tracker">
      <div className="mn-row">
        <Brain className="mn-icon" aria-hidden="true" />
        <strong>{t("memoryNag.tracker.title")}</strong>
      </div>
      <div className="mn-tracker-value">{nags[index] ?? t("memoryNag.tracker.none")}</div>
    </section>
  );
}
