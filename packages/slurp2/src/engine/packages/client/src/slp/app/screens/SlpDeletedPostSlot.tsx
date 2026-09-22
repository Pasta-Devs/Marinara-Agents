import { useEffect, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SlurpSparkleVeil } from "../../base/chrome/SlpSparkleVeil";

/**
 * The slot a deleted post leaves behind while its undo window is open.
 *
 * Its own component because the countdown needs a ticking clock, and putting that in the feed
 * screen re-rendered the whole timeline once a second for one line of text.
 */
export function SlpDeletedPostSlot({
  deleting,
  restoring,
  expiresAt,
  onRestore,
}: {
  deleting: boolean;
  restoring: boolean;
  expiresAt: number | undefined;
  onRestore: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [, tick] = useState(0);
  useEffect(() => {
    if (deleting || restoring || expiresAt === undefined) return;
    const timer = window.setInterval(() => tick((value) => value + 1), 1_000);
    return () => window.clearInterval(timer);
  }, [deleting, restoring, expiresAt]);
  const seconds = Math.max(0, Math.ceil(((expiresAt ?? Date.now()) - Date.now()) / 1000));
  return (
    <div className="relative overflow-hidden rounded-xl bg-[var(--slurp-surface)] px-4 py-5 text-center ring-1 ring-inset ring-[var(--noodle-accent)]/25">
      <SlurpSparkleVeil className="rounded-xl opacity-45" />
      <div className="relative z-10">
        <p className="text-sm font-bold text-[var(--foreground)]">
          {deleting
            ? localizeUi("ui.slurp.feed.deletingPost", { defaultValue: "Deleting post…" })
            : localizeUi("ui.slurp.feed.postDeleted", { defaultValue: "Post deleted" })}
        </p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]" aria-live="polite">
          {deleting
            ? localizeUi("ui.slurp.feed.deleteInProgress", {
                defaultValue: "The post is being removed…",
              })
            : restoring
              ? localizeUi("ui.slurp.feed.restoreInProgress", {
                  defaultValue: "The sparkles are bringing this post back…",
                })
              : localizeUi("ui.slurp.feed.postDeletedCountdown", {
                  defaultValue: "This post will disappear permanently in {{seconds}}s.",
                  seconds,
                })}
        </p>
        {!deleting && (
          <button
            type="button"
            disabled={restoring}
            className="relative mt-3 min-h-10 rounded-lg px-4 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/35 transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-wait disabled:opacity-70"
            onClick={onRestore}
          >
            {restoring
              ? localizeUi("ui.slurp.feed.restoringPost", { defaultValue: "Restoring…" })
              : localizeUi("ui.slurp.feed.restorePost", { defaultValue: "Restore" })}
            {restoring && <RestoreSparkleFlight />}
          </button>
        )}
      </div>
    </div>
  );
}

function RestoreSparkleFlight() {
  return (
    <span className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
      {Array.from({ length: 12 }, (_, index) => (
        <span
          key={index}
          className="slurp-restore-spark"
          style={{ "--slurp-restore-angle": `${index * 30}deg` } as React.CSSProperties}
        />
      ))}
      <style>{`
        .slurp-restore-spark {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 0.28rem;
          height: 0.28rem;
          border-radius: 999px;
          background: var(--noodle-accent);
          box-shadow: 0 0 0.5rem var(--noodle-accent);
          animation: slurp-restore-flight 0.9s cubic-bezier(.2,.8,.2,1) infinite;
          animation-delay: calc(var(--slurp-restore-angle) * -0.004);
        }
        @keyframes slurp-restore-flight {
          from { opacity: 0; transform: translate(-50%, -50%) rotate(var(--slurp-restore-angle)) translateY(1.8rem) scale(.4); }
          28% { opacity: 1; }
          to { opacity: 0; transform: translate(-50%, -50%) rotate(var(--slurp-restore-angle)) translateY(-1.4rem) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .slurp-restore-spark { animation: none; opacity: .55; }
        }
      `}</style>
    </span>
  );
}
