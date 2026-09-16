/** Shared Backstage building blocks: page header, summary rows, fine-tune disclosure, search anchors, wizard. */
import { ArrowLeft, ArrowRight, Check, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { SlurpSettings } from "../../hooks/use-slurp";
import { cn } from "../../lib/utils";
import { SlurpBackstageScopeBadge } from "./SlurpBackstageChrome";
import type { SlurpBackstageScope } from "./slurp-backstage";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]";

export function BackstagePageHeader({
  title,
  detail,
  scope,
}: {
  title: string;
  detail: string;
  scope?: SlurpBackstageScope;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-black tracking-tight text-balance">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--slurp-muted)] text-pretty">{detail}</p>
      </div>
      {scope && <SlurpBackstageScopeBadge scope={scope} />}
    </header>
  );
}

export type SummaryTone = "ok" | "warning" | "off" | "info";

const toneClass: Record<SummaryTone, string> = {
  ok: "text-[var(--slurp-success)] ring-[var(--slurp-success)]/30",
  warning: "text-[var(--slurp-warning)] ring-[var(--slurp-warning)]/30",
  off: "text-[var(--slurp-muted)] ring-[var(--slurp-outline)]",
  info: "text-[var(--slurp-violet)] ring-[var(--slurp-violet)]/30",
};

export function SummaryRow({
  icon,
  title,
  status,
  tone,
  value,
  action,
  onAction,
  onOpen,
}: {
  icon: ReactNode;
  title: string;
  status: string;
  tone: SummaryTone;
  value: string;
  action?: string;
  onAction?: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--slurp-surface-raised)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)] sm:flex-nowrap sm:p-4">
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[var(--slurp-canvas)] text-[var(--noodle-accent)]"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          <span
            className={cn(
              "inline-flex min-h-6 items-center rounded-full px-2 text-xs font-semibold ring-1 ring-inset",
              toneClass[tone],
            )}
          >
            {status}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-[var(--slurp-muted)]">{value}</p>
      </div>
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className={cn(
            "inline-flex min-h-11 items-center rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-bold text-zinc-950 hover:brightness-105",
            focusRing,
          )}
        >
          {action}
        </button>
      )}
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] hover:bg-[var(--slurp-canvas)]",
          focusRing,
        )}
      >
        {t("ui.slurp.settings.backstage.kit.fineTune", { defaultValue: "Fine-tune" })}
        <ChevronRight size={16} className="rtl:rotate-180" aria-hidden="true" />
      </button>
    </div>
  );
}

export function FineTune({
  summary,
  count,
  icon,
  children,
}: {
  summary: string;
  count?: number;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
      <summary
        className={cn(
          "flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2 text-sm font-bold focus-visible:ring-inset [&::-webkit-details-marker]:hidden",
          focusRing,
        )}
      >
        {icon}
        <span className="min-w-0 flex-1">{summary}</span>
        {count !== undefined && (
          <span className="rounded-full bg-[var(--slurp-canvas)] px-2 text-xs font-semibold text-[var(--slurp-muted)] tabular-nums">
            {count}
          </span>
        )}
        <ChevronRight
          size={17}
          className="transition-transform group-open:rotate-90 rtl:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-5 border-t border-[var(--slurp-outline)] p-4 sm:p-5">{children}</div>
    </details>
  );
}

/** Marks where a setting renders, so Backstage search can scroll to it and focus it. */
export function SettingAnchor({ settingKey, children }: { settingKey: keyof SlurpSettings; children: ReactNode }) {
  return (
    <div data-setting-key={settingKey} tabIndex={-1} className="scroll-mt-24 rounded-lg outline-none">
      {children}
    </div>
  );
}

/** Opens closed disclosures around a setting, scrolls to it, and focuses its first control. */
export function focusSettingAnchor(settingKey: string): boolean {
  const anchor = document.querySelector<HTMLElement>(`[data-setting-key="${CSS.escape(settingKey)}"]`);
  if (!anchor) return false;
  for (let node = anchor.parentElement; node; node = node.parentElement) {
    if (node instanceof HTMLDetailsElement) node.open = true;
  }
  anchor.scrollIntoView({
    block: "center",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
  const control = anchor.querySelector<HTMLElement>(
    "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex='-1'])",
  );
  (control ?? anchor).focus({ preventScroll: true });
  return true;
}

export type BackstageWizardStep = { id: string; title: string; content: ReactNode };

export function BackstageWizard<P extends string>({
  title,
  steps,
  patch,
  current,
  proposed,
  preset,
  presetLabel,
  preview,
  pending = false,
  onApply,
  onCancel,
}: {
  title: string;
  steps: readonly BackstageWizardStep[];
  /** The one patch the wizard writes. */
  patch: Partial<SlurpSettings>;
  current: SlurpSettings;
  proposed: SlurpSettings;
  /** Preset matcher result for the proposed values; null shows "Custom" and the values stay as they are. */
  preset: P | null;
  presetLabel?: (preset: P) => string;
  preview?: ReactNode;
  pending?: boolean;
  onApply: (patch: Partial<SlurpSettings>) => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const reviewing = index >= steps.length;
  const changed = (Object.keys(patch) as Array<keyof SlurpSettings>).filter(
    (key) => JSON.stringify(current[key]) !== JSON.stringify(proposed[key]),
  );
  const heading = reviewing
    ? t("ui.slurp.settings.backstage.apply.title", { defaultValue: "Review and apply" })
    : steps[index]!.title;
  return (
    <section
      aria-label={title}
      className="space-y-4 rounded-xl bg-[var(--slurp-surface)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)] sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--noodle-accent)]">{title}</p>
          <h2 className="text-lg font-bold">{heading}</h2>
        </div>
        <span className="rounded-full bg-[var(--slurp-canvas)] px-3 py-1 text-xs font-semibold ring-1 ring-inset ring-[var(--slurp-outline)]">
          {preset === null
            ? t("ui.slurp.settings.presets.custom", { defaultValue: "Custom" })
            : (presetLabel?.(preset) ?? preset)}
        </span>
      </div>
      <ol className="flex gap-1.5" aria-hidden="true">
        {[...steps, null].map((step, stepIndex) => (
          <li
            key={step?.id ?? "review"}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              stepIndex <= index ? "bg-[var(--noodle-accent)]" : "bg-[var(--slurp-outline)]",
            )}
          />
        ))}
      </ol>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.7fr)]">
        <div className="min-w-0">
          {reviewing ? (
            changed.length ? (
              <dl className="text-xs">
                {changed.map((key) => (
                  <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-1.5">
                    <dt className="truncate text-[var(--slurp-muted)]">{key}</dt>
                    <dd className="max-w-52 truncate font-semibold text-[var(--noodle-accent)]">
                      {typeof proposed[key] === "object"
                        ? t("ui.slurp.settings.backstage.preview.updated", { defaultValue: "Updated" })
                        : `${String(current[key])} → ${String(proposed[key])}`}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-[var(--slurp-muted)]">
                {t("ui.slurp.settings.backstage.preview.noChanges", { defaultValue: "No changes" })}
              </p>
            )
          ) : (
            steps[index]!.content
          )}
        </div>
        {preview && <div className="min-w-0">{preview}</div>}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel && index === 0 && (
          <button
            type="button"
            onClick={onCancel}
            className={cn("me-auto min-h-11 rounded-lg px-3 text-sm font-semibold", focusRing)}
          >
            {t("ui.slurp.settings.backstage.leave.discard", { defaultValue: "Discard" })}
          </button>
        )}
        {index > 0 && (
          <button
            type="button"
            onClick={() => setIndex((value) => value - 1)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold ring-1 ring-inset ring-[var(--slurp-outline)]",
              focusRing,
            )}
          >
            <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" />
            {t("ui.slurp.settings.backstage.kit.back", { defaultValue: "Back" })}
          </button>
        )}
        {reviewing ? (
          <button
            type="button"
            disabled={pending || changed.length === 0}
            onClick={() => onApply(patch)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-black text-zinc-950 disabled:opacity-50",
              focusRing,
            )}
          >
            <Check size={16} aria-hidden="true" />
            {t("ui.slurp.settings.backstage.apply.apply", { defaultValue: "Apply changes" })}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIndex((value) => value + 1)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--slurp-text)] px-4 text-sm font-bold text-[var(--slurp-canvas)]",
              focusRing,
            )}
          >
            {t("ui.slurp.settings.backstage.kit.next", { defaultValue: "Next" })}
            <ArrowRight size={16} className="rtl:rotate-180" aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
