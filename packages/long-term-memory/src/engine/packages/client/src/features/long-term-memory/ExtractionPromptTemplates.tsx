import { useEffect, useId, useState } from "react";
import { DEFAULT_LTM_EXTRACTION_PROMPTS_BY_MODE } from "../../../../shared/src/features/agents/long-term-memory/constants.js";
import type {
  LtmExtractionSettingsPatch,
  LtmMode,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  Button,
  InfoPopover,
  StatusSurface,
  inputClass,
} from "./shared-controls";
import { useLtmTranslation, type LtmTranslationFunction } from "./localization";

type ExtractionForm = Omit<
  Required<LtmExtractionSettingsPatch>,
  "systemPrompt" | "activePromptTemplateId"
>;
type Mode = LtmMode;
const modes: Mode[] = ["conversation", "roleplay", "game"];
const modeLabelKeys: Record<Mode, string> = {
  conversation: "ui.longTermMemory.extractionprompttemplates.conversation",
  roleplay: "ui.longTermMemory.extractionprompttemplates.roleplay",
  game: "ui.longTermMemory.extractionprompttemplates.game",
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

function selectionLabel(
  selection: PromptSelection,
  localizeUi: LtmTranslationFunction,
  templateName?: string,
) {
  if (selection.kind === "default") {
    return localizeUi(
      "ui.longTermMemory.extractionprompttemplates.builtInDefaultForMode",
      { mode: localizeUi(modeLabelKeys[selection.mode]) },
    );
  }
  return (
    templateName ??
    localizeUi("ui.longTermMemory.extractionprompttemplates.template")
  );
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
  const { t: localizeUi } = useLtmTranslation();
  const id = useId();
  const promptTemplatesLabelId = `${id}-prompt-templates-label`;
  const promptTemplateLabelId = `${id}-prompt-template-label`;
  const promptNameLabelId = `${id}-prompt-name-label`;
  const templatePromptLabelId = `${id}-template-prompt-label`;
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
      name: localizeUi(
        "ui.longTermMemory.extractionprompttemplates.newTemplate",
      ),
      prompt: localizeUi(
        "ui.longTermMemory.extractionprompttemplates.defaultCustomPrompt",
      ),
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
            name: selectionLabel(selected, localizeUi),
            prompt: selectedBuiltInPrompt,
          };
    if (!prompt || typeof prompt.prompt !== "string" || !prompt.prompt.trim())
      return;
    const template = {
      id: newId(value.promptTemplates),
      name: localizeUi(
        "ui.longTermMemory.extractionprompttemplates.templateCopy",
        { template: prompt.name },
      ),
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
        localizeUi(
          "ui.longTermMemory.extractionprompttemplates.deleteTemplate",
        ),
        localizeUi(
          "ui.longTermMemory.extractionprompttemplates.deleteTemplateDescription",
          { template: selectedTemplate.name },
        ),
        localizeUi(
          "ui.longTermMemory.extractionprompttemplates.deleteTemplateAction",
        ),
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
    <section
      aria-labelledby={promptTemplatesLabelId}
      className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/20 p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4
            id={promptTemplatesLabelId}
            className="flex items-center gap-1 text-xs font-semibold"
          >
            {localizeUi(
              "ui.longTermMemory.extractionprompttemplates.promptTemplates",
            )}
            <InfoPopover
              label={localizeUi(
                "ui.longTermMemory.extractionprompttemplates.promptTemplates",
              )}
              content={localizeUi(
                "ui.longTermMemory.extractionprompttemplates.customTemplatesCanBeActivatedIndependentlyForConversationRoleplay",
              )}
            />
          </h4>
        </div>
        <Button disabled={value.promptTemplates.length >= 50} onClick={create}>
          {localizeUi(
            "ui.longTermMemory.extractionprompttemplates.createTemplate",
          )}
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {modes.map((mode) => (
          <div
            key={mode}
            role="group"
            aria-labelledby={`${id}-${mode}-active-template-label`}
            className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]"
          >
            <span id={`${id}-${mode}-active-template-label`}>
              <span className="flex items-center gap-1">
                {localizeUi(modeLabelKeys[mode])}{" "}
                {localizeUi(
                  "ui.longTermMemory.extractionprompttemplates.activeTemplate",
                )}
                <InfoPopover
                  label={localizeUi(
                    "ui.longTermMemory.extractionprompttemplates.value1ActiveTemplate",
                    { value1: localizeUi(modeLabelKeys[mode]) },
                  )}
                  content={localizeUi(
                    "ui.longTermMemory.extractionprompttemplates.selectsTheExtractionPromptUsedForThisModeBuilt",
                  )}
                />
              </span>
            </span>
            <select
              aria-labelledby={`${id}-${mode}-active-template-label`}
              className={inputClass}
              value={value.activePromptTemplateIdsByMode[mode] ?? ""}
              onChange={(event) => setActive(mode, event.target.value || null)}
            >
              <option value="">
                {localizeUi(
                  "ui.longTermMemory.extractionprompttemplates.builtInDefault",
                )}
              </option>
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
              {localizeUi(
                "ui.longTermMemory.extractionprompttemplates.resetToDefault",
              )}
            </button>
          </div>
        ))}
      </div>
      {value.promptTemplates.length === 0 ? (
        <StatusSurface>
          {localizeUi(
            "ui.longTermMemory.extractionprompttemplates.noCustomTemplatesBuiltInDefaultsRemainActive",
          )}
        </StatusSurface>
      ) : null}
      <div className="grid gap-3 md:grid-cols-[12rem_1fr]">
        <div className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
          <span id={promptTemplateLabelId} className="flex items-center gap-1">
            {localizeUi(
              "ui.longTermMemory.extractionprompttemplates.promptTemplate",
            )}
            <InfoPopover
              label={localizeUi(
                "ui.longTermMemory.extractionprompttemplates.promptTemplate",
              )}
              content={localizeUi(
                "ui.longTermMemory.extractionprompttemplates.choosesWhichBuiltInOrCustomTemplateIsShown",
              )}
            />
          </span>
          <select
            aria-labelledby={promptTemplateLabelId}
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
                {selectionLabel({ kind: "default", mode }, localizeUi)}
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
              <span id={promptNameLabelId}>
                {localizeUi("ui.longTermMemory.extractionprompttemplates.name")}
              </span>
              <input
                className={inputClass}
                readOnly
                maxLength={120}
                value={selectionLabel(selected, localizeUi)}
              />
            </label>
            <div className="block space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
              <span id={templatePromptLabelId} className="flex items-center gap-1">
                {localizeUi(
                  "ui.longTermMemory.extractionprompttemplates.templatePrompt",
                )}
                <InfoPopover
                  label={localizeUi(
                    "ui.longTermMemory.extractionprompttemplates.templatePrompt",
                  )}
                  content={localizeUi(
                    "ui.longTermMemory.extractionprompttemplates.instructionsAddedToTheExtractionRequestThePackageS",
                  )}
                />
              </span>
              <textarea
                aria-labelledby={templatePromptLabelId}
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
                {localizeUi(
                  "ui.longTermMemory.extractionprompttemplates.duplicate",
                )}
              </Button>
            </div>
          </div>
        ) : selectedTemplate ? (
          <div className="space-y-2">
            <label className="block space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
              <span id={promptNameLabelId}>
                {localizeUi("ui.longTermMemory.extractionprompttemplates.name")}
              </span>
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
              <span id={templatePromptLabelId} className="flex items-center gap-1">
                {localizeUi(
                  "ui.longTermMemory.extractionprompttemplates.templatePrompt",
                )}
                <InfoPopover
                  label={localizeUi(
                    "ui.longTermMemory.extractionprompttemplates.templatePrompt",
                  )}
                  content={localizeUi(
                    "ui.longTermMemory.extractionprompttemplates.instructionsAddedToTheExtractionRequestThePackageS",
                  )}
                />
              </span>
              <textarea
                aria-labelledby={templatePromptLabelId}
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
                {localizeUi(
                  "ui.longTermMemory.extractionprompttemplates.duplicate",
                )}
              </Button>
              <Button destructive onClick={() => void remove()}>
                {localizeUi(
                  "ui.longTermMemory.extractionprompttemplates.delete",
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
