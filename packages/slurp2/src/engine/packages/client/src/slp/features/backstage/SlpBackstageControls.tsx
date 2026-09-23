import { Check, X } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { showConfirmDialog } from "../../../lib/app-dialogs";

export function SlurpBackstageApplyBar({
  count,
  pending,
  onDiscard,
  onApply,
}: {
  count: number;
  pending: boolean;
  onDiscard: () => void;
  onApply: () => void;
}) {
  const { t } = useTranslation();
  if (count === 0) return null;
  return (
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-[var(--slurp-surface-raised)] p-3 text-[var(--slurp-text)] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--slurp-outline)] backdrop-blur-xl sm:bottom-3">
      <div className="me-auto min-w-0">
        <h2 className="text-sm font-bold">
          {t("ui.slurp.settings.backstage.apply.title", { defaultValue: "Review and apply" })}
        </h2>
        <p className="text-xs opacity-75" role="status" aria-live="polite">
          {t("ui.slurp.settings.backstage.apply.staged", {
            defaultValue: "{{count}} setting changes staged",
            count,
          })}
        </p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={onDiscard}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--slurp-muted)] hover:bg-[var(--slurp-canvas)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50"
      >
        <X size={16} aria-hidden="true" /> {t("ui.slurp.settings.backstage.apply.discard", { defaultValue: "Discard" })}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={onApply}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--noodle-accent)] px-4 text-sm font-black text-zinc-950 [&_svg]:!text-zinc-950 shadow-sm hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50"
      >
        <Check size={16} aria-hidden="true" />{" "}
        {t("ui.slurp.settings.backstage.apply.apply", { defaultValue: "Apply changes" })}
      </button>
    </div>
  );
}

// ponytail: one module-level count, since only one Backstage is ever mounted.
let stagedBackstageChanges = 0;

/** Publish the staged-change count so exits outside Backstage can ask first, and guard a reload. */
export function useSlurpBackstageDraftGuard(count: number) {
  useEffect(() => {
    stagedBackstageChanges = count;
    if (count === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      stagedBackstageChanges = 0;
    };
  }, [count]);
}

/** Resolves true when there is nothing staged or the user chooses to discard it. */
export function confirmLeaveSlurpBackstage(
  t: (key: string, options: Record<string, unknown>) => string,
): Promise<boolean> {
  if (stagedBackstageChanges === 0) return Promise.resolve(true);
  return showConfirmDialog({
    title: t("ui.slurp.settings.backstage.leave.title", { defaultValue: "Discard staged changes?" }),
    message: t("ui.slurp.settings.backstage.leave.detail", {
      defaultValue: "You have {{count}} setting changes that are not applied yet.",
      count: stagedBackstageChanges,
    }),
    confirmLabel: t("ui.slurp.settings.backstage.leave.discard", { defaultValue: "Discard" }),
    cancelLabel: t("ui.slurp.settings.backstage.leave.stay", { defaultValue: "Stay" }),
    tone: "destructive",
  });
}
