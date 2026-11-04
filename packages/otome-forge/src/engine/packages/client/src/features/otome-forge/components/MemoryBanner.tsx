// ──────────────────────────────────────────────
// Otome Forge: a failed summary is never silent. On every screen of an open story (mounted once by OtomeForgeView), a
// banner says that a summary failed, with the provider's own words, Retry, and the way to Settings → Connections at
// the Memory connection (More connections, focused), to give it a model with a larger context; or that no connection
// can write summaries, with only the way to Connections (the story's own connection is the one missing then).
// Ordinary catch-up shows nothing (lib/memory-notice.ts).
// ──────────────────────────────────────────────
// It sits in the stage's flow below the top bar (above the reader's own header, which then leaves the safe area to it),
// so it pushes the screen down and covers none of its controls; its height goes to --of-memory-banner-h for the
// reader's phone menu (styles.ts). Retry stays mounted (aria-disabled) while it runs, so focus never falls to the
// page; once memory is well again the banner goes, gives the focus it held to the screen's heading, and a status line
// says so.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleAlert, PlugZap, RotateCcw } from "lucide-react";
import { useMemoryStatus } from "../hooks/use-memory";
import { retryAction, type MemoryNotice } from "../lib/memory-notice";

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
  const kind = notice?.kind ?? null;
  // "Story memory is working again" once a retry's banner goes; cleared when another shows.
  const [said, setSaid] = useState("");
  const before = useRef(kind);
  useEffect(() => {
    if (kind === before.current) return;
    setSaid(!kind && before.current === "retrying" ? t("ui.otomeForge.memory.fixed") : "");
    before.current = kind;
  }, [kind, t]);
  return (
    <>
      {notice ? (
        <MemoryBannerBox
          notice={notice}
          error={memory.error}
          busy={memory.busy}
          onRetry={() => void memory.retry()}
          onOpenConnections={onOpenConnections}
          onLeave={onLeave}
        />
      ) : null}
      <p className="of-visually-hidden" role="status">
        {kind === "retrying" ? t("ui.otomeForge.memory.retrying") : said}
      </p>
    </>
  );
}

function MemoryBannerBox({
  notice,
  error,
  busy,
  onRetry,
  onOpenConnections,
  onLeave,
}: {
  notice: NonNullable<MemoryNotice>;
  error: string | null;
  busy: boolean;
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
  const retrying = notice.kind === "retrying";
  const retry = retryAction(notice, busy);
  const detail = notice.kind === "failed" ? (error ?? notice.message) : null;
  return (
    <div ref={box} className="of-memory-banner of-glass" data-kind={notice.kind}>
      {/* A new element for each state, so a failure (again) is announced as it appears; a retry's progress is said by
          MemoryBanner's status line. */}
      <div key={notice.kind} className="of-memory-banner-text" role={retrying ? undefined : "alert"}>
        {retrying ? (
          <RotateCcw className="of-pulse" size={16} strokeWidth={2} aria-hidden="true" />
        ) : (
          <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
        )}
        <p>
          <span>
            {t(
              retrying
                ? "ui.otomeForge.memory.retrying"
                : notice.kind === "failed"
                  ? "ui.otomeForge.memory.failed"
                  : "ui.otomeForge.memory.noConnection",
            )}
          </span>
          {detail ? (
            <span className="of-memory-banner-said"> {t("ui.otomeForge.memory.failedSaid", { message: detail })}</span>
          ) : null}
        </p>
      </div>
      <div className="of-memory-banner-actions">
        {retry ? (
          <button
            type="button"
            className="of-button of-button--quiet of-glass of-button--small"
            aria-disabled={retry === "running" || undefined}
            onClick={() => {
              if (retry === "offered") onRetry();
            }}
          >
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
    </div>
  );
}
