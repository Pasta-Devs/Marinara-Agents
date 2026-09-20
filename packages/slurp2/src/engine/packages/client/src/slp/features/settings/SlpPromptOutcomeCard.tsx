import { Check, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function SlpPromptOutcomeCard({
  icon,
  title,
  summary,
  customized,
  selected,
  onSelect,
}: {
  icon: ReactNode;
  title: string;
  summary: string;
  customized: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`group min-h-36 rounded-xl p-4 text-start shadow-[0_18px_42px_-38px_rgba(0,0,0,0.9)] ring-1 ring-inset transition-[background-color,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 ${selected ? "bg-[color-mix(in_srgb,var(--noodle-accent)_10%,var(--slurp-surface-raised))] ring-[var(--noodle-accent)]/55" : "bg-[var(--slurp-surface-raised)] ring-[var(--slurp-outline)] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_6%,var(--slurp-surface-raised))]"}`}
    >
      <span className="flex h-full flex-col">
        <span className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--slurp-canvas)] text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--slurp-outline)]">
            {icon}
          </span>
          <span className="min-w-0 flex-1 text-sm font-black text-balance">{title}</span>
          {selected ? (
            <Check size={17} className="shrink-0 text-[var(--noodle-accent)]" aria-hidden="true" />
          ) : (
            <ChevronRight
              size={17}
              className="shrink-0 text-[var(--slurp-muted)] transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5 motion-reduce:transition-none"
              aria-hidden="true"
            />
          )}
        </span>
        <span className="mt-3 block text-xs leading-5 text-[var(--slurp-muted)] text-pretty">{summary}</span>
        <span className="mt-auto flex items-center gap-1.5 pt-4 text-xs font-bold">
          <span
            className={`size-1.5 rounded-full ${customized ? "bg-[var(--noodle-accent)]" : "bg-[var(--slurp-muted)]"}`}
            aria-hidden="true"
          />
          {customized
            ? t("ui.slurp.settings.prompts.custom", { defaultValue: "Custom" })
            : t("ui.slurp.settings.prompts.default", { defaultValue: "Default" })}
        </span>
      </span>
    </button>
  );
}
