import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [newName, setNewName] = useState("");

  return (
    <details className="rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
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
          {value.map((instruction) => {
            const editing = editingId === instruction.id;
            return (
              <section
                key={instruction.id}
                aria-label={instruction.name}
                className="rounded-lg bg-[var(--slurp-canvas)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold break-words">{instruction.name}</h4>
                    {!editing && (
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-5 text-[var(--slurp-muted)]">
                        {instruction.text}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label={t("ui.slurp.settings.prompts.editInstructionAria", {
                        name: instruction.name,
                        defaultValue: "Edit {{name}}",
                      })}
                      onClick={() => {
                        setEditingId(instruction.id);
                        setText(instruction.text);
                      }}
                      className="inline-flex size-10 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                    >
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                    {!instruction.builtin && (
                      <button
                        type="button"
                        aria-label={t("ui.slurp.settings.prompts.deleteInstructionAria", {
                          name: instruction.name,
                          defaultValue: "Delete {{name}}",
                        })}
                        onClick={() => onChange(value.filter((entry) => entry.id !== instruction.id))}
                        className="inline-flex size-10 items-center justify-center rounded-lg text-[var(--destructive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
                {editing && (
                  <div className="mt-3 space-y-3">
                    <label className="block text-xs font-bold">
                      {t("ui.slurp.settings.prompts.blockInstruction", { defaultValue: "Instruction" })}
                      <textarea
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        className="mt-1 min-h-32 w-full resize-y rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-surface)] p-3 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
                      />
                    </label>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold ring-1 ring-inset ring-[var(--slurp-outline)]"
                      >
                        <X size={15} aria-hidden="true" /> {t("ui.slurp.actions.cancel")}
                      </button>
                      <button
                        type="button"
                        disabled={!text.trim()}
                        onClick={() => {
                          onChange(
                            value.map((entry) =>
                              entry.id === instruction.id ? { ...entry, text: text.trim() } : entry,
                            ),
                          );
                          setEditingId(null);
                        }}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-3 text-sm font-black text-zinc-950 disabled:opacity-45"
                      >
                        <Save size={15} aria-hidden="true" />
                        {t("ui.slurp.settings.prompts.applyDraft", { defaultValue: "Apply to draft" })}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
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
              setEditingId(id);
              setText("Add your instruction here.");
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
