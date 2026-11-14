import { useEffect, useId, useState } from "react";
import { DEFAULT_LTM_EXTRACTION_PROMPTS_BY_MODE } from "../../../../../shared/src/features/agents/long-term-memory/constants.js";
import type {
  LtmExtractionSettingsPatch,
  LtmMode,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { Plus } from "lucide-react";
import { Button, inputClass } from "../shared-controls";
import { useLtmTranslation, type LtmTranslationFunction } from "../localization";

type ExtractionForm = Omit<
  Required<LtmExtractionSettingsPatch>,
  "systemPrompt" | "activePromptTemplateId" | "existingNoteMaxChunks" | "existingNoteMaxTokens"
>;
type Mode = LtmMode;
const modes: Mode[] = ["conversation", "roleplay", "game"];
const modeLabelKeys: Record<Mode, string> = {
  conversation: "ui.longTermMemory.extractionprompttemplates.conversation",
  roleplay: "ui.longTermMemory.extractionprompttemplates.roleplay",
  game: "ui.longTermMemory.extractionprompttemplates.game",
};
type PromptSelection = { kind: "default"; mode: Mode } | { kind: "custom"; id: string };

function newId(templates: ExtractionForm["promptTemplates"]) {
  let id = `template_${Date.now().toString(36)}`;
  let suffix = 2;
  while (templates.some((template) => template.id === id)) id = `template_${Date.now().toString(36)}_${suffix++}`;
  return id;
}

function selectionKey(selection: PromptSelection) {
  return selection.kind === "default" ? `default:${selection.mode}` : `custom:${selection.id}`;
}

function selectionLabel(selection: PromptSelection, localizeUi: LtmTranslationFunction, templateName?: string) {
  if (selection.kind === "default") {
    return localizeUi("ui.longTermMemory.extractionprompttemplates.builtInDefaultForMode", {
      mode: localizeUi(modeLabelKeys[selection.mode]),
    });
  }
  return templateName ?? localizeUi("ui.longTermMemory.extractionprompttemplates.template");
}

export function ExtractionPromptTemplates({
  value,
  onChange,
  confirmAction,
}: {
  value: ExtractionForm;
  onChange: (value: ExtractionForm) => void;
  confirmAction: (title: string, message: string, confirmLabel: string) => Promise<boolean>;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const id = useId();
  const promptTemplatesLabelId = `${id}-prompt-templates-label`;
  const promptNameLabelId = `${id}-prompt-name-label`;
  const templatePromptLabelId = `${id}-template-prompt-label`;
  const [selected, setSelected] = useState<PromptSelection>(
    value.promptTemplates[0]
      ? { kind: "custom", id: value.promptTemplates[0].id }
      : { kind: "default", mode: "conversation" },
  );
  // "Edit instructions" opens the editor on the template a mode uses; Create and Duplicate open it on the new copy.
  const [editing, setEditing] = useState(false);
  // The mode whose "Edit instructions" opened the editor: a copy made there becomes that mode's active template.
  const [editingMode, setEditingMode] = useState<Mode | null>(null);
  // Says what Create, Duplicate or Copy to edit just did (W11); any other action clears it.
  const [notice, setNotice] = useState("");
  const selectedTemplate =
    selected.kind === "custom" ? (value.promptTemplates.find((template) => template.id === selected.id) ?? null) : null;
  useEffect(() => {
    if (selected.kind === "custom" && !selectedTemplate) {
      // The open template is gone (Discard removed a fresh copy): close the editor rather than show another one.
      setEditing(false);
      setNotice("");
      setSelected(
        value.promptTemplates[0]
          ? { kind: "custom", id: value.promptTemplates[0].id }
          : { kind: "default", mode: "conversation" },
      );
    }
  }, [selected, selectedTemplate, value.promptTemplates]);
  const selectedBuiltInPrompt =
    selected.kind === "default" ? DEFAULT_LTM_EXTRACTION_PROMPTS_BY_MODE[selected.mode] : null;
  const updateTemplate = (patch: Partial<NonNullable<typeof selectedTemplate>>) => {
    if (!selectedTemplate) return;
    onChange({
      ...value,
      promptTemplates: value.promptTemplates.map((template) =>
        template.id === selectedTemplate.id ? { ...template, ...patch } : template,
      ),
    });
  };
  const addTemplate = (template: { id: string; name: string; prompt: string }, mode: Mode | null) => {
    onChange({
      ...value,
      promptTemplates: [...value.promptTemplates, template],
      activePromptTemplateIdsByMode: mode
        ? { ...value.activePromptTemplateIdsByMode, [mode]: template.id }
        : value.activePromptTemplateIdsByMode,
    });
    setSelected({ kind: "custom", id: template.id });
    setEditing(true);
    setNotice(
      mode
        ? localizeUi("ui.longTermMemory.extractionprompttemplates.nowUsedForMode", {
            mode: localizeUi(modeLabelKeys[mode]),
          })
        : localizeUi("ui.longTermMemory.extractionprompttemplates.copySelectedNotice", { template: template.name }),
    );
  };
  const create = () => {
    if (value.promptTemplates.length >= 50) return;
    const template = {
      id: newId(value.promptTemplates),
      name: localizeUi("ui.longTermMemory.extractionprompttemplates.newTemplate"),
      prompt: localizeUi("ui.longTermMemory.extractionprompttemplates.defaultCustomPrompt"),
    };
    // A blank template is used straight away only while a mode's editor is expanded; the header button alone has no mode.
    addTemplate(template, editorMode());
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
    if (!prompt || typeof prompt.prompt !== "string" || !prompt.prompt.trim()) return;
    const template = {
      id: newId(value.promptTemplates),
      name: localizeUi("ui.longTermMemory.extractionprompttemplates.templateCopy", { template: prompt.name }),
      prompt: prompt.prompt,
    };
    // A copy of the template a mode is using (or of its built-in default) is used for that mode straight away.
    addTemplate(template, selected.kind === "default" ? selected.mode : editorMode());
  };
  const remove = async () => {
    if (
      selected.kind !== "custom" ||
      !selectedTemplate ||
      !(await confirmAction(
        localizeUi("ui.longTermMemory.extractionprompttemplates.deleteTemplate"),
        localizeUi("ui.longTermMemory.extractionprompttemplates.deleteTemplateDescription", {
          template: selectedTemplate.name,
        }),
        localizeUi("ui.longTermMemory.extractionprompttemplates.deleteTemplateAction"),
      ))
    )
      return;
    onChange({
      ...value,
      promptTemplates: value.promptTemplates.filter((template) => template.id !== selectedTemplate.id),
      activePromptTemplateIdsByMode: Object.fromEntries(
        Object.entries(value.activePromptTemplateIdsByMode).map(([mode, id]) => [
          mode,
          id === selectedTemplate.id ? null : id,
        ]),
      ),
    });
    const nextTemplate = value.promptTemplates.find((template) => template.id !== selectedTemplate.id);
    setSelected(nextTemplate ? { kind: "custom", id: nextTemplate.id } : { kind: "default", mode: "conversation" });
    setEditing(false);
    setNotice("");
  };
  const activeSelection = (mode: Mode): PromptSelection => {
    const activeId = value.activePromptTemplateIdsByMode[mode];
    return activeId && value.promptTemplates.some((template) => template.id === activeId)
      ? { kind: "custom", id: activeId }
      : { kind: "default", mode };
  };
  // The mode whose "Edit instructions" is expanded right now (the editor shows the template that mode uses), else none.
  const editorMode = (): Mode | null =>
    editing && editingMode && selectionKey(activeSelection(editingMode)) === selectionKey(selected)
      ? editingMode
      : null;
  const toggleEdit = (mode: Mode) => {
    const target = activeSelection(mode);
    setNotice("");
    if (editing && selectionKey(selected) === selectionKey(target)) {
      setEditing(false);
      return;
    }
    setSelected(target);
    setEditingMode(mode);
    setEditing(true);
  };
  const atLimit = value.promptTemplates.length >= 50;
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
      aria-describedby={`${promptTemplatesLabelId}-hint`}
      data-ltm-settings-section
      className="space-y-3"
    >
      <div className="space-y-0.5">
        <h4 id={promptTemplatesLabelId} data-ltm-group-heading className="text-sm font-semibold">
          {localizeUi("ui.longTermMemory.extractionprompttemplates.promptTemplates")}
        </h4>
        <p
          id={`${promptTemplatesLabelId}-hint`}
          data-ltm-field-hint
          className="text-[0.6875rem] text-[var(--muted-foreground)]"
        >
          {localizeUi("ui.longTermMemory.extractionprompttemplates.promptTemplatesHelp")}
        </p>
      </div>
      <div data-ltm-active-template-grid className="grid gap-3">
        {modes.map((mode) => {
          const activeLabel = localizeUi("ui.longTermMemory.extractionprompttemplates.value1ActiveTemplate", {
            value1: localizeUi(modeLabelKeys[mode]),
          });
          return (
            <div
              key={mode}
              role="group"
              aria-label={activeLabel}
              className="space-y-1 text-xs font-semibold text-[var(--foreground)]"
            >
              <span className="block">{localizeUi(modeLabelKeys[mode])}</span>
              <div className="flex items-center gap-2">
                <select
                  aria-label={activeLabel}
                  className={`${inputClass} min-w-0 flex-1`}
                  value={value.activePromptTemplateIdsByMode[mode] ?? ""}
                  onChange={(event) => setActive(mode, event.target.value || null)}
                >
                  <option value="">{localizeUi("ui.longTermMemory.extractionprompttemplates.builtInDefault")}</option>
                  {value.promptTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <Button
                  aria-label={`${localizeUi("ui.longTermMemory.extractionprompttemplates.editInstructions")} ${localizeUi(modeLabelKeys[mode])}`}
                  aria-expanded={editing && selectionKey(selected) === selectionKey(activeSelection(mode))}
                  onClick={() => toggleEdit(mode)}
                >
                  {localizeUi("ui.longTermMemory.extractionprompttemplates.edit")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={atLimit} onClick={create}>
          <Plus aria-hidden="true" size="0.875rem" />
          {localizeUi("ui.longTermMemory.extractionprompttemplates.createTemplate")}
        </Button>
        <p data-ltm-field-hint className="text-[0.6875rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.longTermMemory.extractionprompttemplates.ownTemplatesHint")}
        </p>
      </div>
      <p aria-live="polite" data-ltm-template-notice className="text-[0.6875rem] text-[var(--muted-foreground)]">
        {notice}
        {atLimit ? ` ${localizeUi("ui.longTermMemory.extractionprompttemplates.templateLimitReached")}` : ""}
      </p>
      {editing ? (
        <div data-ltm-prompt-template-grid className="grid gap-3">
          {selected.kind === "default" ? (
            <div className="space-y-2">
              <label className="block space-y-1 text-xs font-semibold text-[var(--foreground)]">
                <span id={promptNameLabelId}>{localizeUi("ui.longTermMemory.extractionprompttemplates.name")}</span>
                <input className={inputClass} readOnly maxLength={120} value={selectionLabel(selected, localizeUi)} />
              </label>
              <div className="block space-y-1 text-xs font-semibold text-[var(--foreground)]">
                <span id={templatePromptLabelId}>
                  {localizeUi("ui.longTermMemory.extractionprompttemplates.templatePrompt")}
                </span>
                <textarea
                  aria-labelledby={templatePromptLabelId}
                  aria-describedby={`${templatePromptLabelId}-hint`}
                  className={`${inputClass} min-h-48 py-2`}
                  readOnly
                  maxLength={20000}
                  value={selectedBuiltInPrompt ?? ""}
                />
                <p
                  id={`${templatePromptLabelId}-hint`}
                  className="text-[0.6875rem] font-normal text-[var(--muted-foreground)]"
                >
                  {localizeUi(
                    "ui.longTermMemory.extractionprompttemplates.instructionsAddedToTheExtractionRequestThePackageS",
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={atLimit} onClick={duplicate}>
                  {localizeUi("ui.longTermMemory.extractionprompttemplates.copyToEdit")}
                </Button>
              </div>
            </div>
          ) : selectedTemplate ? (
            <div className="space-y-2">
              <label className="block space-y-1 text-xs font-semibold text-[var(--foreground)]">
                <span id={promptNameLabelId}>{localizeUi("ui.longTermMemory.extractionprompttemplates.name")}</span>
                <input
                  className={inputClass}
                  maxLength={120}
                  value={selectedTemplate.name}
                  onChange={(event) => updateTemplate({ name: event.target.value })}
                />
              </label>
              <div className="block space-y-1 text-xs font-semibold text-[var(--foreground)]">
                <span id={templatePromptLabelId}>
                  {localizeUi("ui.longTermMemory.extractionprompttemplates.templatePrompt")}
                </span>
                <textarea
                  aria-labelledby={templatePromptLabelId}
                  aria-describedby={`${templatePromptLabelId}-hint`}
                  className={`${inputClass} min-h-48 py-2`}
                  maxLength={20000}
                  value={selectedTemplate.prompt}
                  onChange={(event) => updateTemplate({ prompt: event.target.value })}
                />
                <p
                  id={`${templatePromptLabelId}-hint`}
                  className="text-[0.6875rem] font-normal text-[var(--muted-foreground)]"
                >
                  {localizeUi(
                    "ui.longTermMemory.extractionprompttemplates.instructionsAddedToTheExtractionRequestThePackageS",
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={atLimit} onClick={duplicate}>
                  {localizeUi("ui.longTermMemory.extractionprompttemplates.duplicate")}
                </Button>
                <Button destructive onClick={() => void remove()}>
                  {localizeUi("ui.longTermMemory.extractionprompttemplates.delete")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
