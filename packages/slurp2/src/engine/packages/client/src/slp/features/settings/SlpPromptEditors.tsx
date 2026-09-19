
































import { DEFAULT_SLURP_GENERATION_GUIDANCE, DEFAULT_SLURP_IMAGE_GENERATION_PROMPT, PromptEditor } from "../../../components/slurp/SlurpBackstageWorkflow";









import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";

/** The two full-screen prompt editors: writing guidance and the image prompt. */
export function SlpPromptEditors(page: SlpBackstagePageProps) {
  const {
    t,
    updateSettings,
    settings,
    generationGuidanceDraft,
    setGenerationGuidanceDraft,
    generationGuidanceEditorOpen,
    setGenerationGuidanceEditorOpen,
    imagePromptDraft,
    setImagePromptDraft,
    imagePromptEditorOpen,
    setImagePromptEditorOpen,
    saveImagePrompt,
    saveGenerationGuidance,
  } = page;
  return (
    <>
      <PromptEditor
        open={generationGuidanceEditorOpen}
        title={t("ui.slurp.settings.prompts.editGenerationGuidance")}
        value={generationGuidanceDraft}
        onChange={setGenerationGuidanceDraft}
        onClose={() => {
          setGenerationGuidanceDraft(settings.generationGuidance);
          setGenerationGuidanceEditorOpen(false);
        }}
        onSave={async () => {
          if (await saveGenerationGuidance()) setGenerationGuidanceEditorOpen(false);
        }}
        onRestore={() => setGenerationGuidanceDraft(DEFAULT_SLURP_GENERATION_GUIDANCE)}
        pending={updateSettings.isPending}
      />
      <PromptEditor
        open={imagePromptEditorOpen}
        title={t("ui.slurp.settings.prompts.editImagePrompt")}
        value={imagePromptDraft}
        onChange={setImagePromptDraft}
        onClose={() => {
          setImagePromptDraft(settings.imageGenerationPrompt);
          setImagePromptEditorOpen(false);
        }}
        onSave={async () => {
          if (await saveImagePrompt()) setImagePromptEditorOpen(false);
        }}
        onRestore={() => setImagePromptDraft(DEFAULT_SLURP_IMAGE_GENERATION_PROMPT)}
        pending={updateSettings.isPending}
      />
    </>
  );
}
