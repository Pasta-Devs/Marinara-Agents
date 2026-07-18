import { useState } from "react";
import type { LtmExtractionSettingsPatch } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { Button, StatusSurface, inputClass } from "./shared-controls";

type ExtractionForm = Omit<
  Required<LtmExtractionSettingsPatch>,
  "systemPrompt" | "activePromptTemplateId"
>;
type Mode = "conversation" | "roleplay" | "game";
const modes: Mode[] = ["conversation", "roleplay", "game"];

function newId(templates: ExtractionForm["promptTemplates"]) {
  let id = `template_${Date.now().toString(36)}`;
  let suffix = 2;
  while (templates.some((template) => template.id === id))
    id = `template_${Date.now().toString(36)}_${suffix++}`;
  return id;
}

export function ExtractionPromptTemplates({
  value,
  onChange,
  confirmAction,
}: {
  value: ExtractionForm;
  onChange: (value: ExtractionForm) => void;
  confirmAction: (
    title: string,
    message: string,
    confirmLabel: string,
  ) => Promise<boolean>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    value.promptTemplates[0]?.id ?? null,
  );
  const selected =
    value.promptTemplates.find((template) => template.id === selectedId) ??
    null;
  const updateTemplate = (patch: Partial<NonNullable<typeof selected>>) => {
    if (!selected) return;
    onChange({
      ...value,
      promptTemplates: value.promptTemplates.map((template) =>
        template.id === selected.id ? { ...template, ...patch } : template,
      ),
    });
  };
  const create = () => {
    if (value.promptTemplates.length >= 50) return;
    const template = {
      id: newId(value.promptTemplates),
      name: "New template",
      prompt: "Describe only durable information that should be retained.",
    };
    onChange({
      ...value,
      promptTemplates: [...value.promptTemplates, template],
    });
    setSelectedId(template.id);
  };
  const duplicate = () => {
    if (!selected || value.promptTemplates.length >= 50) return;
    const template = {
      ...selected,
      id: newId(value.promptTemplates),
      name: `${selected.name} copy`,
    };
    onChange({
      ...value,
      promptTemplates: [...value.promptTemplates, template],
    });
    setSelectedId(template.id);
  };
  const remove = async () => {
    if (
      !selected ||
      !(await confirmAction(
        "Delete template?",
        `Delete ${selected.name}? Modes using it will return to the built-in prompt.`,
        "Delete template",
      ))
    )
      return;
    onChange({
      ...value,
      promptTemplates: value.promptTemplates.filter(
        (template) => template.id !== selected.id,
      ),
      activePromptTemplateIdsByMode: Object.fromEntries(
        Object.entries(value.activePromptTemplateIdsByMode).map(
          ([mode, id]) => [mode, id === selected.id ? null : id],
        ),
      ),
    });
    setSelectedId(
      value.promptTemplates.find((template) => template.id !== selected.id)
        ?.id ?? null,
    );
  };
  const setActive = (mode: Mode, id: string | null) =>
    onChange({
      ...value,
      activePromptTemplateIdsByMode: {
        ...value.activePromptTemplateIdsByMode,
        [mode]: id,
      },
    });

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-semibold">Prompt templates</h4>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Custom templates can be activated independently for Conversation,
            Roleplay, and Game.
          </p>
        </div>
        <Button disabled={value.promptTemplates.length >= 50} onClick={create}>
          Create template
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {modes.map((mode) => (
          <label
            key={mode}
            className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]"
          >
            <span>
              {mode[0]!.toUpperCase() + mode.slice(1)} active template
            </span>
            <select
              className={inputClass}
              value={value.activePromptTemplateIdsByMode[mode] ?? ""}
              onChange={(event) => setActive(mode, event.target.value || null)}
            >
              <option value="">Built-in default</option>
              {value.promptTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="text-[0.6875rem] underline"
              onClick={() => setActive(mode, null)}
            >
              Reset to built-in
            </button>
          </label>
        ))}
      </div>
      {value.promptTemplates.length === 0 ? (
        <StatusSurface>
          No custom templates. Built-in prompts remain active.
        </StatusSurface>
      ) : (
        <div className="grid gap-3 md:grid-cols-[12rem_1fr]">
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {value.promptTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                className={`block w-full rounded px-2 py-2 text-left text-xs ${template.id === selectedId ? "bg-[var(--primary)]/15 font-semibold" : "hover:bg-[var(--accent)]"}`}
                onClick={() => setSelectedId(template.id)}
              >
                {template.name}
              </button>
            ))}
          </div>
          {selected ? (
            <div className="space-y-2">
              <label className="block space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
                <span>Name</span>
                <input
                  className={inputClass}
                  maxLength={120}
                  value={selected.name}
                  onChange={(event) =>
                    updateTemplate({ name: event.target.value })
                  }
                />
              </label>
              <label className="block space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
                <span>Template prompt</span>
                <textarea
                  className={`${inputClass} min-h-48 py-2`}
                  maxLength={20000}
                  value={selected.prompt}
                  onChange={(event) =>
                    updateTemplate({ prompt: event.target.value })
                  }
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={value.promptTemplates.length >= 50}
                  onClick={duplicate}
                >
                  Duplicate
                </Button>
                <Button destructive onClick={() => void remove()}>
                  Delete
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
