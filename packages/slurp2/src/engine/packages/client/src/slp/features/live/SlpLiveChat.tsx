import { useEffect, useRef, useState } from "react";
import type { SlpLiveShow } from "./slp-live-contract";

type ChatItem = { at: number; kind: "host" | "crowd" | "tip" | "menu"; name: string; text: string };

export function SlpLiveChat({
  show,
  creatorName,
  elapsed,
  t,
}: {
  show: SlpLiveShow;
  creatorName: string;
  elapsed: number;
  t: (key: string, values?: Record<string, unknown>) => string;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [newCount, setNewCount] = useState(0);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const lines: ChatItem[] = [
    ...show.script
      .filter((line) => line.at <= elapsed)
      .map((line): ChatItem => ({
        at: line.at,
        kind: line.kind === "narration" ? "host" : "crowd",
        name: line.name ?? creatorName,
        text: line.text,
      })),
    ...show.events
      .filter((event) => event.at <= elapsed)
      .map((event): ChatItem => ({
        at: event.at,
        kind: event.kind === "tip" ? "tip" : "crowd",
        name: event.name,
        text: event.kind === "tip" ? String(event.amount ?? 0) : event.text,
      })),
    ...show.queue
      .filter((order) => order.at <= elapsed)
      .map((order): ChatItem => ({ at: order.at, kind: "menu", name: order.name, text: order.label })),
  ].sort((a, b) => a.at - b.at);
  const countKey = lines.length;
  const latestKey = lines.map((line) => `${line.at}:${line.kind}:${line.name}:${line.text}`).join("|");
  useEffect(() => {
    const node = scroll.current;
    if (!node) return;
    if (atBottom.current) node.scrollTop = node.scrollHeight;
    else setNewCount((count) => count + 1);
  }, [countKey, latestKey]);
  const jumpDown = () => {
    const node = scroll.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    atBottom.current = true;
    setNewCount(0);
  };
  return (
    <section
      ref={scroll}
      onScroll={(event) => {
        const node = event.currentTarget;
        atBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 32;
        if (atBottom.current) setNewCount(0);
      }}
      className="relative min-h-0 flex-1 space-y-2 overflow-y-auto p-3"
      aria-live="polite"
    >
      {show.missedSummary && show.missedSummary.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] p-3">
          <button
            type="button"
            className="min-h-9 font-semibold"
            aria-expanded={summaryOpen}
            onClick={() => setSummaryOpen((open) => !open)}
          >
            {t("ui.slurp.live.missed")}
          </button>
          {summaryOpen && (
            <ul className="list-inside list-disc text-sm text-[var(--muted-foreground)]">
              {show.missedSummary.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {lines.map((line, index) =>
        line.kind === "host" ? (
          <article key={`${line.at}-${index}`} className="rounded-lg bg-[var(--card)] p-3 text-sm">
            <strong className="mb-1 block text-xs">{creatorName}</strong>
            {line.text}
          </article>
        ) : line.kind === "tip" || line.kind === "menu" ? (
          <div
            key={`${line.at}-${index}`}
            className="mx-auto w-fit rounded-full bg-amber-500/15 px-3 py-1.5 text-sm font-semibold text-amber-700"
          >
            {line.kind === "tip"
              ? t("ui.slurp.live.tipEvent", { name: line.name, amount: line.text })
              : t("ui.slurp.live.menuEvent", { name: line.name, item: line.text })}
          </div>
        ) : (
          <p key={`${line.at}-${index}`} className="text-sm">
            <b>{line.name}</b> <span>{line.text}</span>
          </p>
        ),
      )}
      {newCount > 0 && (
        <button
          type="button"
          onClick={jumpDown}
          className="sticky bottom-1 mx-auto flex min-h-10 rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-md"
        >
          {t("ui.slurp.live.newMessages", { count: newCount })}
        </button>
      )}
    </section>
  );
}
