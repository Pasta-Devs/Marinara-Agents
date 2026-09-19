import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { showConfirmDialog, showPromptDialog } from "../../../lib/app-dialogs";
import {
  DEFAULT_SLURP_GENERATION_GUIDANCE,
  DEFAULT_SLURP_IMAGE_GENERATION_PROMPT,
  SLURP_GUIDANCE_LEVELS,
  SLURP_GUIDANCE_PRESETS,
  SLURP_IMAGE_INTERPRETATION_PRESETS,
  SLURP_IMAGE_INTERPRETATION_STYLES,
} from "../../../components/slurp/SlurpBackstageWorkflow";
import {
  exportSlurpPromptPresets,
  importSlurpPromptPresets,
  mergeSlurpPromptPreset,
  SLURP_PROMPT_PRESET_NAME_LIMIT,
} from "../../../components/slurp/slurp-prompt-presets";
import type { SlurpSettings } from "./slp-settings-contract";

/**
 * Generation guidance, prompt presets and the image prompt. These settings are read by ads,
 * audience, creators, feed, media, messages, projects and world, so no content feature owns them.
 */
export function useSlpPromptsBackstageState({
  settings,
  save,
  restore,
}: {
  settings: SlurpSettings | undefined;
  save: (patch: Partial<SlurpSettings>) => Promise<boolean>;
  restore: (patch: Partial<SlurpSettings>, message?: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [generationGuidanceDraft, setGenerationGuidanceDraft] = useState("");
  const [generationGuidanceEditorOpen, setGenerationGuidanceEditorOpen] = useState(false);
  const [imagePromptDraft, setImagePromptDraft] = useState("");
  const [imagePromptEditorOpen, setImagePromptEditorOpen] = useState(false);
  const [selectedPresetName, setSelectedPresetName] = useState("");
  const presetImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      if (!generationGuidanceEditorOpen) setGenerationGuidanceDraft(settings.generationGuidance);
      if (!imagePromptEditorOpen) setImagePromptDraft(settings.imageGenerationPrompt);
    }
  }, [generationGuidanceEditorOpen, imagePromptEditorOpen, settings]);

  const selectedPreset = settings?.promptPresets.find((preset) => preset.name === selectedPresetName) ?? null;
  const generationGuidanceIsDefault = settings?.generationGuidance === DEFAULT_SLURP_GENERATION_GUIDANCE;
  const guidanceLevel =
    SLURP_GUIDANCE_LEVELS.find((level) => SLURP_GUIDANCE_PRESETS[level] === settings?.generationGuidance) ?? null;
  const interpretationStyle =
    SLURP_IMAGE_INTERPRETATION_STYLES.find(
      (style) => SLURP_IMAGE_INTERPRETATION_PRESETS[style] === settings?.imagePromptInterpretation,
    ) ?? null;
  const imagePromptIsDefault = settings?.imageGenerationPrompt === DEFAULT_SLURP_IMAGE_GENERATION_PROMPT;

  const savePromptPreset = async () => {
    if (!settings) return;
    const name = (
      await showPromptDialog({
        title: t("ui.slurp.settings.presets.nameTitle"),
        message: t("ui.slurp.settings.presets.nameDetail"),
        placeholder: selectedPresetName,
        confirmLabel: t("ui.slurp.settings.presets.save"),
      })
    )
      ?.trim()
      .slice(0, SLURP_PROMPT_PRESET_NAME_LIMIT);
    if (!name) return;
    const saved = await restore(
      {
        promptPresets: mergeSlurpPromptPreset(settings.promptPresets, {
          name,
          generationGuidance: settings.generationGuidance,
          imageGenerationPrompt: settings.imageGenerationPrompt,
        }),
      },
      t("ui.slurp.settings.presets.saved"),
    );
    if (saved) setSelectedPresetName(name);
  };

  const applyPromptPreset = async () => {
    if (!settings || !selectedPreset) return;
    const differs =
      settings.generationGuidance !== selectedPreset.generationGuidance ||
      settings.imageGenerationPrompt !== selectedPreset.imageGenerationPrompt;
    // Applying replaces prompts that may have been edited by hand, so ask first when it would change them.
    if (
      differs &&
      !(await showConfirmDialog({
        title: t("ui.slurp.settings.presets.applyTitle"),
        message: t("ui.slurp.settings.presets.applyDetail", { name: selectedPreset.name }),
        confirmLabel: t("ui.slurp.settings.presets.apply"),
      }))
    )
      return;
    await restore(
      {
        generationGuidance: selectedPreset.generationGuidance,
        imageGenerationPrompt: selectedPreset.imageGenerationPrompt,
      },
      t("ui.slurp.settings.presets.applied"),
    );
  };

  const deletePromptPreset = async () => {
    if (!settings || !selectedPreset) return;
    const confirmed = await showConfirmDialog({
      title: t("ui.slurp.settings.presets.deleteTitle"),
      message: t("ui.slurp.settings.presets.deleteDetail", { name: selectedPreset.name }),
      confirmLabel: t("ui.slurp.settings.presets.delete"),
    });
    if (!confirmed) return;
    if (await save({ promptPresets: settings.promptPresets.filter((preset) => preset.name !== selectedPreset.name) })) {
      setSelectedPresetName("");
    }
  };

  const exportPromptPresets = () => {
    if (!settings) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(exportSlurpPromptPresets(settings.promptPresets), null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "marinara-slurp-prompts.json";
    document.body.append(anchor);
    anchor.click();
    window.setTimeout(() => {
      anchor.remove();
      URL.revokeObjectURL(url);
    }, 0);
  };

  const importPromptPresets = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !settings) return;
    try {
      const result = importSlurpPromptPresets(settings.promptPresets, JSON.parse(await file.text()));
      if (result.imported === 0) {
        toast.error(t("ui.slurp.settings.presets.importInvalid"));
        return;
      }
      await restore(
        { promptPresets: result.presets },
        t("ui.slurp.settings.presets.imported", { count: result.imported }),
      );
    } catch {
      toast.error(t("ui.slurp.settings.presets.importInvalid"));
    }
  };

  const restoreDefaultImagePrompt = () =>
    restore(
      { imageGenerationPrompt: DEFAULT_SLURP_IMAGE_GENERATION_PROMPT },
      t("ui.slurp.settings.prompts.imageRestored"),
    );
  const saveImagePrompt = () =>
    restore({ imageGenerationPrompt: imagePromptDraft }, t("ui.slurp.settings.prompts.imageSaved"));
  const saveGenerationGuidance = () =>
    restore({ generationGuidance: generationGuidanceDraft }, t("ui.slurp.settings.prompts.guidanceSaved"));

  return {
    generationGuidanceDraft,
    setGenerationGuidanceDraft,
    generationGuidanceEditorOpen,
    setGenerationGuidanceEditorOpen,
    imagePromptDraft,
    setImagePromptDraft,
    imagePromptEditorOpen,
    setImagePromptEditorOpen,
    selectedPresetName,
    setSelectedPresetName,
    presetImportRef,
    selectedPreset,
    generationGuidanceIsDefault,
    guidanceLevel,
    interpretationStyle,
    imagePromptIsDefault,
    savePromptPreset,
    applyPromptPreset,
    deletePromptPreset,
    exportPromptPresets,
    importPromptPresets,
    restoreDefaultImagePrompt,
    saveImagePrompt,
    saveGenerationGuidance,
  };
}

export type SlpPromptsBackstageState = ReturnType<typeof useSlpPromptsBackstageState>;
