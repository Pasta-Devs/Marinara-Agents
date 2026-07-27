import { useEffect, useState } from "react";
import {
  DEFAULT_LTM_EXTRACTION_PROMPTS_BY_MODE,
  type LtmMode,
} from "../../../../shared/src/features/agents/long-term-memory/constants.js";
import type { LtmExtractionSettingsPatch } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  Button,
  InfoPopover,
  StatusSurface,
  inputClass,
} from "./shared-controls";

type ExtractionForm = Omit<
  Required<LtmExtractionSettingsPatch>,
  "systemPrompt" | "activePromptTemplateId"
>;
type Mode = LtmMode;
const modes: Mode[] = ["conversation", "roleplay", "visual_novel", "game"];
const modeLabels: Record<Mode, string> = {
  conversation: "Conversation",
  roleplay: "Roleplay",
  visual_novel: "Visual Novel",
  game: "Game",
};
type PromptSelection =
  | { kind: "default"; mode: Mode }
  | { kind: "custom"; id: string };

function newId(templates: ExtractionForm["promptTemplates"]) {
  let id = `template_${Date.now().toString(36)}`;
  let suffix = 2;
  while (templates.some((template) => template.id === id))
    id = `template_${Date.now().toString(36)}_${suffix++}`;
  return id;
}

function selectionKey(selection: PromptSelection) {
  return selection.kind === "default"
    ? `default:${selection.mode}`
    : `custom:${selection.id}`;
}

function selectionLabel(selection: PromptSelection, templateName?: string) {
  if (selection.kind === "default") {
    return `Built-in Default (${modeLabels[selection.mode]})`;
  }
  return templateName ?? "Template";
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
  const [selected, setSelected] = useState<PromptSelection>(
    value.promptTemplates[0]
      ? { kind: "custom", id: value.promptTemplates[0].id }
      : { kind: "default", mode: "conversation" },
  );
  const selectedTemplate =
    selected.kind === "custom"
      ? (value.promptTemplates.find(
          (template) => template.id === selected.id,
        ) ?? null)
       : null;
  useEffect(() => {
    if (selected.kind === "custom" && !selectedTemplate) {
      setSelected(
        value.promptTemplates[0]
          ? { kind: "custom", id: value.promptTemplates[0].id }
          : { kind: "default", mode: "conversation" },
      );
    }
  }, [selected, selectedTemplate, value.promptTemplates]);
  const selectedBuiltInPrompt =
    selected.kind === "default"
      ? DEFAULT_LTM_EXTRACTION_PROMPTS_BY_MODE[selected.mode]
      : null;
  const updateTemplate = (
    patch: Partial<NonNullable<typeof selectedTemplate>>,
  ) => {
    if (!selectedTemplate) return;
    onChange({
      ...value,
      promptTemplates: value.promptTemplates.map((template) =>
        template.id === selectedTemplate.id
          ? { ...template, ...patch }
          : template,
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
    setSelected({ kind: "custom", id: template.id });
  };
  const duplicate = () => {
    if (value.promptTemplates.length >= 50) return;
    const prompt =
      selected.kind === "custom"
        ? selectedTemplate
        : {
            name: selectionLabel(selected),
            prompt: selectedBuiltInPrompt,
          };
    if (!prompt || typeof prompt.prompt !== "string" || !prompt.prompt.trim()) return;
    const template = {
      id: newId(value.promptTemplates),
      name: `${prompt.name} copy`,
      prompt: prompt.prompt,
    };
    onChange({
      ...value,
      promptTemplates: [...value.promptTemplates, template],
    });
    setSelected({ kind: "custom", id: template.id });
  };
  const remove = async () => {
    if (
      selected.kind !== "custom" ||
      !selectedTemplate ||
      !(await confirmAction(
        "Delete template?",
        `Delete ${selectedTemplate.name}? Modes using it will return to the built-in prompt.`,
        "Delete template",
      ))
    )
      return;
    onChange({
      ...value,
      promptTemplates: value.promptTemplates.filter(
        (template) => template.id !== selectedTemplate.id,
      ),
      activePromptTemplateIdsByMode: Object.fromEntries(
        Object.entries(value.activePromptTemplateIdsByMode).map(
          ([mode, id]) => [mode, id === selectedTemplate.id ? null : id],
        ),
      ),
    });
    const nextTemplate = value.promptTemplates.find(
      (template) => template.id !== selectedTemplate.id,
    );
    setSelected(
      nextTemplate
        ? { kind: "custom", id: nextTemplate.id }
        : { kind: "default", mode: "conversation" },
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
          <h4 className="flex items-center gap-1 text-xs font-semibold">
            Prompt templates
            <InfoPopover
              label="Prompt templates"
              content="Custom templates can be activated independently for Conversation, Roleplay, Visual Novel, and Game."
            />
          </h4>
        </div>
        <Button disabled={value.promptTemplates.length >= 50} onClick={create}>
          Create template
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {modes.map((mode) => (
          <div
            key={mode}
            className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]"
          >
            <span>
              <span className="flex items-center gap-1">
                {modeLabels[mode]} active template
                <InfoPopover
                  label={`${modeLabels[mode]} active template`}
                  content="Selects the extraction prompt used for this mode. Built-in default uses the package-provided prompt."
                />
              </span>
            </span>
            <select
              aria-label={`${modeLabels[mode]} active template`}
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
              Reset to default
            </button>
          </div>
        ))}
      </div>
      {value.promptTemplates.length === 0 ? (
        <StatusSurface>
          No custom templates. Built-in defaults remain active.
        </StatusSurface>
      ) : null}
      <div className="grid gap-3 md:grid-cols-[12rem_1fr]">
        <div className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1">
            Prompt template
            <InfoPopover
              label="Prompt template"
              content="Chooses which built-in or custom template is shown in the editor below."
            />
          </span>
          <select
            aria-label="Prompt template"
            className={inputClass}
            value={selectionKey(selected)}
            onChange={(event) => {
              const next = event.target.value;
              if (next.startsWith("default:")) {
                const mode = next.slice(8) as Mode;
                setSelected({ kind: "default", mode });
                return;
              }
              setSelected({
                kind: "custom",
                id: next.slice(7),
              });
            }}
          >
            {modes.map((mode) => (
              <option
                key={mode}
                value={selectionKey({ kind: "default", mode })}
              >
                {selectionLabel({ kind: "default", mode })}
              </option>
            ))}
            {value.promptTemplates.map((template) => (
              <option
                key={template.id}
                value={selectionKey({ kind: "custom", id: template.id })}
              >
                {template.name}
              </option>
            ))}
          </select>
        </div>
        {selected.kind === "default" ? (
          <div className="space-y-2">
            <label className="block space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
              <span>Name</span>
              <input
                className={inputClass}
                readOnly
                maxLength={120}
                value={selectionLabel(selected)}
              />
            </label>
            <div className="block space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
              <span className="flex items-center gap-1">
                Template prompt
                <InfoPopover
                  label="Template prompt"
                  content="Instructions added to the extraction request. The package's required schema and safety rules still apply."
                />
              </span>
              <textarea
                aria-label="Template prompt"
                className={`${inputClass} min-h-48 py-2`}
                readOnly
                maxLength={20000}
                value={selectedBuiltInPrompt ?? ""}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={value.promptTemplates.length >= 50}
                onClick={duplicate}
              >
                Duplicate
              </Button>
            </div>
          </div>
        ) : selectedTemplate ? (
          <div className="space-y-2">
            <label className="block space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
              <span>Name</span>
              <input
                className={inputClass}
                maxLength={120}
                value={selectedTemplate.name}
                onChange={(event) =>
                  updateTemplate({ name: event.target.value })
                }
              />
            </label>
            <div className="block space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
              <span className="flex items-center gap-1">
                Template prompt
                <InfoPopover
                  label="Template prompt"
                  content="Instructions added to the extraction request. The package's required schema and safety rules still apply."
                />
              </span>
              <textarea
                aria-label="Template prompt"
                className={`${inputClass} min-h-48 py-2`}
                maxLength={20000}
                value={selectedTemplate.prompt}
                onChange={(event) =>
                  updateTemplate({ prompt: event.target.value })
                }
              />
            </div>
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
    </div>
  );
}
