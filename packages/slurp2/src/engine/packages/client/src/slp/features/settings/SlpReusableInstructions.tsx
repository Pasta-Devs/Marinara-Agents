import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SlurpReusablePromptInstruction } from "../../base/state/slp-state-types";

export function SlpReusableInstructions({
  value,
  onChange,
}: {
  value: SlurpReusablePromptInstruction[];
  onChange: (value: SlurpReusablePromptInstruction[]) => void;
}) {
  const { t } = useTranslation();
  const [newName, setNewName] = useState("");

  return (
    <details open className="rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
      <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)]">
        {t("ui.slurp.settings.prompts.reusableTitle", { defaultValue: "Shared guidance" })}
        <span className="ms-2 text-xs font-normal text-[var(--slurp-muted)]">
          {t("ui.slurp.settings.prompts.reusableCount", {
            count: value.length,
            defaultValue: "{{count}} reusable instructions",
          })}
        </span>
      </summary>
      <div className="space-y-4 border-t border-[var(--slurp-outline)] p-4">
        <p className="max-w-2xl text-xs leading-5 text-[var(--slurp-muted)] text-pretty">
          {t("ui.slurp.settings.prompts.reusableDetail", {
            defaultValue: "Edit shared guidance once, then select it inside any editable prompt block.",
          })}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {value.map((instruction) => (
            <section
              key={instruction.id}
              aria-label={instruction.name}
              className="rounded-lg bg-[var(--slurp-canvas)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]"
            >
              <div className="flex items-start justify-between gap-3">
                <label
                  htmlFor={`slurp-instruction-${instruction.id}`}
                  className="min-w-0 text-sm font-bold break-words"
                >
                  {instruction.name}
                </label>
                {!instruction.builtin && (
                  <button
                    type="button"
                    aria-label={t("ui.slurp.settings.prompts.deleteInstructionAria", {
                      name: instruction.name,
                      defaultValue: "Delete {{name}}",
                    })}
                    onClick={() => onChange(value.filter((entry) => entry.id !== instruction.id))}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-[var(--destructive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
              {/* Edited in place; the Backstage draft bar saves or discards it with everything else. */}
              <textarea
                id={`slurp-instruction-${instruction.id}`}
                value={instruction.text}
                rows={Math.min(12, Math.max(3, Math.ceil(instruction.text.length / 60)))}
                onChange={(event) =>
                  onChange(
                    value.map((entry) =>
                      entry.id === instruction.id ? { ...entry, text: event.target.value } : entry,
                    ),
                  )
                }
                className="mt-2 w-full resize-y rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-surface)] p-3 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
              />
            </section>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-xs font-bold">
            {t("ui.slurp.settings.prompts.newInstructionLabel", { defaultValue: "New guidance name" })}
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={t("ui.slurp.settings.prompts.newInstructionPlaceholder", {
                defaultValue: "For example: Product launches",
              })}
              className="mt-1 min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
            />
          </label>
          <button
            type="button"
            disabled={!newName.trim()}
            onClick={() => {
              const id = `custom-${Date.now()}`;
              onChange([...value, { id, name: newName.trim(), text: "Add your instruction here.", builtin: false }]);
              setNewName("");
              window.requestAnimationFrame(() => document.getElementById(`slurp-instruction-${id}`)?.focus());
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold ring-1 ring-inset ring-[var(--slurp-outline)] disabled:opacity-45"
          >
            <Plus size={15} aria-hidden="true" />
            {t("ui.slurp.settings.prompts.addInstruction", { defaultValue: "Add guidance" })}
          </button>
        </div>
      </div>
    </details>
  );
}
