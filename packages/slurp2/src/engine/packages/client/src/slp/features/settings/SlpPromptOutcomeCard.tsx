import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function SlpPromptOutcomeSection({
  icon,
  title,
  summary,
  customized,
  children,
}: {
  icon: ReactNode;
  title: string;
  summary: string;
  customized: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className="space-y-4 rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--slurp-canvas)] text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--slurp-outline)]">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-black text-balance">{title}</h2>
            <span className="inline-flex min-h-6 items-center gap-1.5 rounded-full bg-[var(--slurp-canvas)] px-2 py-0.5 text-[0.7rem] font-bold ring-1 ring-inset ring-[var(--slurp-outline)]">
              <span
                className={`size-1.5 rounded-full ${customized ? "bg-[var(--noodle-accent)]" : "bg-[var(--slurp-muted)]"}`}
                aria-hidden="true"
              />
              {customized
                ? t("ui.slurp.settings.prompts.custom", { defaultValue: "Custom" })
                : t("ui.slurp.settings.prompts.default", { defaultValue: "Default" })}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)] text-pretty">{summary}</p>
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}
