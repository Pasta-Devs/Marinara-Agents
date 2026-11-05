// ──────────────────────────────────────────────
// Otome Forge: a failed summary is never silent. On every screen of an open story (mounted once by OtomeForgeView), a
// banner says that a summary failed, with the provider's own words (Otome's, without "The connection said", when the
// memory model is too small), Retry, and the way to Settings → Connections at the Memory connection (More connections,
// focused), to give it a model with a larger context; or that no connection can write summaries, with only the way to
// Connections (the story's own connection is the one missing then). A Retry request that fails itself (no connection,
// the server unreachable) says so on a line of its own, never as the connection's words, until the status moves on.
// Ordinary catch-up shows nothing, and neither does a Retry while it is sent and runs: the banner comes back only when
// the summary fails again (lib/memory-notice.ts).
// ──────────────────────────────────────────────
// It sits in the stage's flow below the top bar (above the reader's own header, which then leaves the safe area to it),
// so it pushes the screen down and covers none of its controls; its height goes to --of-memory-banner-h for the
// reader's phone menu (styles.ts). When it goes (at Retry, or once memory is well) it gives the focus it held to the
// screen's heading; a status line says that the summary is being tried again, then that memory is working again.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleAlert, PlugZap, RotateCcw } from "lucide-react";
import { useMemoryStatus } from "../hooks/use-memory";
import type { MemoryNotice } from "../lib/memory-notice";

interface MemoryBannerProps {
  runKey: string;
  /** Opens Settings → Connections; `memory`: at the Memory connection (a failed summary). */
  onOpenConnections: (memory: boolean) => void;
  /** Where focus goes when the banner leaves while it held it (the screen's heading). */
  onLeave: () => void;
}

export function MemoryBanner({ runKey, onOpenConnections, onLeave }: MemoryBannerProps) {
  const { t } = useTranslation();
  const memory = useMemoryStatus(runKey);
  const { notice } = memory;
  // What the status line follows: the banner shown, else a retry while it is sent or runs (no banner then).
  const state = notice?.kind ?? (memory.busy || memory.status?.retrying ? "retrying" : null);
  // "Story memory is working again" once a retry ends with no banner; cleared when one shows.
  const [said, setSaid] = useState("");
  const before = useRef(state);
  useEffect(() => {
    if (state === before.current) return;
    setSaid(!state && before.current === "retrying" ? t("ui.otomeForge.memory.fixed") : "");
    before.current = state;
  }, [state, t]);
  return (
    <>
      {notice ? (
        <MemoryBannerBox
          notice={notice}
          error={memory.error}
          onRetry={() => void memory.retry()}
          onOpenConnections={onOpenConnections}
          onLeave={onLeave}
        />
      ) : null}
      <p className="of-visually-hidden" role="status">
        {state === "retrying" ? t("ui.otomeForge.memory.retrying") : said}
      </p>
    </>
  );
}

function MemoryBannerBox({
  notice,
  error,
  onRetry,
  onOpenConnections,
  onLeave,
}: {
  notice: NonNullable<MemoryNotice>;
  error: string | null;
  onRetry: () => void;
  onOpenConnections: (memory: boolean) => void;
  onLeave: () => void;
}) {
  const { t } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  const leave = useRef(onLeave);
  useLayoutEffect(() => {
    leave.current = onLeave;
  });
  useLayoutEffect(() => {
    const element = box.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    const measure = () => {
      const { marginTop, marginBottom } = getComputedStyle(element);
      const height = element.offsetHeight + parseFloat(marginTop) + parseFloat(marginBottom);
      parent.style.setProperty("--of-memory-banner-h", `${Math.ceil(height)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      parent.style.removeProperty("--of-memory-banner-h");
      // A layout cleanup runs before React removes the box, while its button still has focus.
      if (element.contains((element.getRootNode() as Document | ShadowRoot).activeElement)) leave.current();
    };
  }, []);
  const failed = notice.kind === "failed";
  const detail = failed ? notice.message : null;
  const own = failed && notice.own;
  return (
    <div ref={box} className="of-memory-banner of-glass" data-kind={notice.kind}>
      {/* A new element for each state, so a failure (again) is announced as it appears; a retry's progress is said by
          MemoryBanner's status line. */}
      <div key={notice.kind} className="of-memory-banner-text" role="alert">
        <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
        <p>
          <span>{t(failed ? "ui.otomeForge.memory.failed" : "ui.otomeForge.memory.noConnection")}</span>
          {detail ? (
            <span className="of-memory-banner-said">
              {" "}
              {own ? detail : t("ui.otomeForge.memory.failedSaid", { message: detail })}
            </span>
          ) : null}
        </p>
      </div>
      <div className="of-memory-banner-actions">
        {failed ? (
          <button type="button" className="of-button of-button--quiet of-glass of-button--small" onClick={onRetry}>
            <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.memory.retry")}
          </button>
        ) : null}
        <button
          type="button"
          className="of-button of-button--quiet of-glass of-button--small"
          onClick={() => onOpenConnections(notice.kind !== "no-connection")}
        >
          <PlugZap size={15} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.memory.connection")}
        </button>
      </div>
      {failed && error ? (
        <p className="of-memory-banner-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
