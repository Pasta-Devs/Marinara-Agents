import { Image, MessageSquareText, MoreVertical, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { Field, Toggle } from "../../modules/settings/SlpSettingsControls";
import { PromptCard } from "../../modules/settings/SlpBackstageKit";
import { BackstagePageHeader, SettingAnchor } from "../../modules/settings/SlpSettingsKit";
import {
  DEFAULT_SLURP_GENERATION_GUIDANCE,
  SLURP_GUIDANCE_LEVELS,
  SLURP_GUIDANCE_PRESETS,
  SLURP_IMAGE_INTERPRETATION_PRESETS,
  SLURP_IMAGE_INTERPRETATION_STYLES,
} from "../../modules/settings/slp-backstage-format";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { SlurpPostGuidanceField } from "./SlpPostGuidanceField";
import { SlurpPromptBlockBuilder } from "./SlpPromptBlockBuilder";
import { SlpPromptOutcomeSection } from "./SlpPromptOutcomeCard";

/** Prompt Studio keeps the common prompts readable and opens exact block composition on demand. */
export function SlpPromptsPanel(page: SlpBackstagePageProps) {
  const {
    t,
    settings,
    savedSettings,
    update,
    updateSettings,
    setGenerationGuidanceDraft,
    setGenerationGuidanceEditorOpen,
    setImagePromptDraft,
    setImagePromptEditorOpen,
    generationGuidanceIsDefault,
    guidanceLevel,
    interpretationStyle,
    imagePromptIsDefault,
    selectedPresetName,
    selectedPreset,
    restoreDefaultImagePrompt,
    postGuidanceQuery,
    postGuidanceDraft,
    stagePostGuidance,
  } = page;
  const postGuidanceCustom = Boolean(
    postGuidanceDraft.public !== undefined ||
    postGuidanceDraft.locked !== undefined ||
    postGuidanceQuery.data?.defaults.public ||
    postGuidanceQuery.data?.defaults.locked,
  );

  const outcomeSections = (
    <section aria-label={t("ui.slurp.settings.prompts.outcomesTitle", { defaultValue: "Prompt outcomes" })}>
      <div className="space-y-4">
        <SlpPromptOutcomeSection
          icon={<MessageSquareText size={18} aria-hidden="true" />}
          title={t("ui.slurp.settings.prompts.voiceOutcome", { defaultValue: "Voice and writing" })}
          summary={t("ui.slurp.settings.prompts.voiceOutcomeDetail", {
            defaultValue: "Tone, language, maturity, and context shared across Creator writing.",
          })}
          customized={!generationGuidanceIsDefault || settings.enableLorebookContext}
        >
          <PromptCard
            title={t("ui.slurp.settings.prompts.generationGuidance")}
            value={settings.generationGuidance}
            isDefault={generationGuidanceIsDefault}
            onEdit={() => {
              setGenerationGuidanceDraft(settings.generationGuidance);
              setGenerationGuidanceEditorOpen(true);
            }}
            onRestore={() => void update("generationGuidance", DEFAULT_SLURP_GENERATION_GUIDANCE)}
          />
          <PromptOptions label={t("ui.slurp.settings.prompts.moreSettings", { defaultValue: "More settings" })}>
            <Field
              settingKey="generationGuidance"
              label={t("ui.slurp.settings.prompts.spice")}
              detail={
                guidanceLevel ? t("ui.slurp.settings.prompts.spiceDetail") : t("ui.slurp.settings.prompts.spiceCustom")
              }
            >
              <div className="flex flex-wrap gap-2">
                {SLURP_GUIDANCE_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={guidanceLevel === level}
                    onClick={() => void update("generationGuidance", SLURP_GUIDANCE_PRESETS[level])}
                    className={`min-h-11 rounded-full px-4 text-sm font-semibold ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] ${guidanceLevel === level ? "bg-[var(--slurp-nav-active)] text-[var(--slurp-text)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-canvas)] text-[var(--slurp-muted)] ring-[var(--slurp-outline)] hover:text-[var(--slurp-text)]"}`}
                  >
                    {t(`ui.slurp.settings.prompts.spice.${level}`)}
                  </button>
                ))}
              </div>
            </Field>
            <Toggle
              settingKey="enableLorebookContext"
              label={t("ui.slurp.settings.prompts.lorebookContext")}
              detail={t("ui.slurp.settings.prompts.lorebookContextDetail")}
              value={settings.enableLorebookContext}
              onChange={(value) => update("enableLorebookContext", value)}
            />
          </PromptOptions>
        </SlpPromptOutcomeSection>

        <SlpPromptOutcomeSection
          icon={<SlidersHorizontal size={18} aria-hidden="true" />}
          title={t("ui.slurp.settings.prompts.postOutcome", { defaultValue: "Post behavior" })}
          summary={t("ui.slurp.settings.prompts.postOutcomeDetail", {
            defaultValue: "What public and locked posts should achieve for their audience.",
          })}
          customized={postGuidanceCustom}
        >
          {(["public", "locked"] as const).map((access) => (
            <SlurpPostGuidanceField
              key={access}
              access={access}
              guidance={postGuidanceQuery.data}
              inherited={postGuidanceQuery.data?.builtIn[access] ?? ""}
              draftValue={postGuidanceDraft[access]}
              onStage={(value) => stagePostGuidance(access, value)}
              label={t(`ui.slurp.settings.prompts.${access}Guidance`)}
              detail={t(`ui.slurp.settings.prompts.${access}GuidanceDetail`)}
              generateLabel={t("ui.slurp.settings.prompts.guidanceGenerate")}
              clearLabel={t("ui.slurp.settings.prompts.guidanceUseBuiltIn")}
              savedMessage={t("ui.slurp.settings.prompts.guidanceSavedAccess")}
              disabled={postGuidanceQuery.isLoading || postGuidanceQuery.isError}
            />
          ))}
        </SlpPromptOutcomeSection>

        <SlpPromptOutcomeSection
          icon={<Image size={18} aria-hidden="true" />}
          title={t("ui.slurp.settings.prompts.imageOutcome", { defaultValue: "Image direction" })}
          summary={t("ui.slurp.settings.prompts.imageOutcomeDetail", {
            defaultValue: "Visual style and how Slurp turns ideas into image prompts.",
          })}
          customized={!imagePromptIsDefault || interpretationStyle === null}
        >
          <SettingAnchor settingKey="imageGenerationPrompt">
            <PromptCard
              title={t("ui.slurp.settings.images.instructions")}
              value={settings.imageGenerationPrompt}
              isDefault={imagePromptIsDefault}
              onEdit={() => {
                setImagePromptDraft(settings.imageGenerationPrompt);
                setImagePromptEditorOpen(true);
              }}
              onRestore={() => void restoreDefaultImagePrompt()}
            />
          </SettingAnchor>
          <PromptOptions label={t("ui.slurp.settings.prompts.moreSettings", { defaultValue: "More settings" })}>
            <Toggle
              settingKey="enableImageInterpretation"
              label={t("ui.slurp.settings.images.interpretPrompts")}
              detail={t("ui.slurp.settings.images.interpretPromptsDetail")}
              value={settings.enableImageInterpretation}
              onChange={(value) => update("enableImageInterpretation", value)}
            />
            {settings.enableImageInterpretation && (
              <Field
                settingKey="imagePromptInterpretation"
                label={t("ui.slurp.settings.images.promptStyle")}
                detail={
                  interpretationStyle
                    ? t("ui.slurp.settings.images.promptStyleDetail")
                    : t("ui.slurp.settings.images.promptStyleCustom")
                }
              >
                <div className="flex flex-wrap gap-2">
                  {SLURP_IMAGE_INTERPRETATION_STYLES.map((style) => (
                    <button
                      key={style}
                      type="button"
                      aria-pressed={interpretationStyle === style}
                      onClick={() =>
                        void update("imagePromptInterpretation", SLURP_IMAGE_INTERPRETATION_PRESETS[style])
                      }
                      className={`min-h-11 rounded-full px-4 text-sm font-semibold ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] ${interpretationStyle === style ? "bg-[var(--slurp-nav-active)] text-[var(--slurp-text)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-canvas)] text-[var(--slurp-muted)] ring-[var(--slurp-outline)] hover:text-[var(--slurp-text)]"}`}
                    >
                      {t(`ui.slurp.settings.images.promptStyle.${style}`)}
                    </button>
                  ))}
                </div>
              </Field>
            )}
          </PromptOptions>
        </SlpPromptOutcomeSection>
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      <BackstagePageHeader
        title={t("ui.slurp.settings.prompts.studioTitle", { defaultValue: "Prompt Studio" })}
        detail={t("ui.slurp.settings.prompts.studioDetail", {
          defaultValue: "Shape how Slurp writes, speaks, and creates. Your prompts stay visible and easy to edit.",
        })}
        scope="all-slurp"
        actions={
          <SettingAnchor settingKey="promptPresets">
            <PromptPresetToolbar
              page={page}
              selectedPresetName={selectedPresetName}
              selectedPreset={selectedPreset}
              pending={updateSettings.isPending}
            />
          </SettingAnchor>
        }
      />
      <SettingAnchor settingKey="promptBlocks">
        <SettingAnchor settingKey="promptInstructions">
          <SlurpPromptBlockBuilder
            value={settings.promptBlocks}
            savedValue={savedSettings?.promptBlocks ?? {}}
            instructions={settings.promptInstructions}
            savedInstructions={savedSettings?.promptInstructions ?? []}
            onChange={(promptBlocks) => void update("promptBlocks", promptBlocks)}
            onChangeInstructions={(promptInstructions) => void update("promptInstructions", promptInstructions)}
            overviewContent={outcomeSections}
          />
        </SettingAnchor>
      </SettingAnchor>
    </div>
  );
}

function PromptOptions({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group rounded-lg bg-[var(--slurp-canvas)] ring-1 ring-inset ring-[var(--slurp-outline)]">
      <summary className="min-h-11 cursor-pointer list-none px-3 py-3 text-xs font-bold text-[var(--slurp-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden">
        {label}
      </summary>
      <div className="space-y-4 border-t border-[var(--slurp-outline)] p-4">{children}</div>
    </details>
  );
}

function PromptPresetToolbar({
  page,
  selectedPresetName,
  selectedPreset,
  pending,
}: {
  page: SlpBackstagePageProps;
  selectedPresetName: string;
  selectedPreset: SlpBackstagePageProps["selectedPreset"];
  pending: boolean;
}) {
  const {
    t,
    settings,
    setSelectedPresetName,
    presetImportRef,
    savePromptPreset,
    applyPromptPreset,
    deletePromptPreset,
    exportPromptPresets,
    importPromptPresets,
  } = page;
  const actions: Array<{ label: string; action: () => void; disabled: boolean }> = [
    { label: t("ui.slurp.settings.presets.apply"), action: () => void applyPromptPreset(), disabled: !selectedPreset },
    { label: t("ui.slurp.settings.presets.save"), action: () => void savePromptPreset(), disabled: false },
    {
      label: t("ui.slurp.settings.presets.delete"),
      action: () => void deletePromptPreset(),
      disabled: !selectedPreset,
    },
    {
      label: t("ui.slurp.settings.presets.export"),
      action: exportPromptPresets,
      disabled: settings.promptPresets.length === 0,
    },
    { label: t("ui.slurp.settings.presets.import"), action: () => presetImportRef.current?.click(), disabled: false },
  ];
  return (
    <div className="flex items-end gap-2">
      <label className="block min-w-40 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--slurp-muted)]">
        {t("ui.slurp.settings.prompts.preset", { defaultValue: "Preset" })}
        <select
          value={selectedPreset ? selectedPresetName : ""}
          disabled={settings.promptPresets.length === 0}
          onChange={(event) => setSelectedPresetName(event.target.value)}
          aria-label={t("ui.slurp.settings.presets.choose")}
          className="mt-1 min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-surface-raised)] px-3 text-base font-normal normal-case tracking-normal text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
        >
          <option value="">
            {settings.promptPresets.length > 0
              ? t("ui.slurp.settings.presets.choose")
              : t("ui.slurp.settings.presets.empty")}
          </option>
          {settings.promptPresets.map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>
      </label>
      <details className="group relative">
        <summary
          aria-label={t("ui.slurp.settings.prompts.presetToolbar", { defaultValue: "Manage presets" })}
          className="grid size-11 cursor-pointer list-none place-items-center rounded-lg bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden"
        >
          <MoreVertical size={18} aria-hidden="true" />
        </summary>
        <div className="absolute end-0 z-40 mt-2 w-48 overflow-hidden rounded-xl bg-[var(--slurp-surface-raised)] p-1.5 shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--slurp-outline)]">
          {actions.map(({ label, action, disabled }) => (
            <button
              key={label}
              type="button"
              disabled={disabled || pending}
              onClick={action}
              className="flex min-h-10 w-full items-center rounded-lg px-3 text-start text-xs font-semibold hover:bg-[var(--slurp-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
      </details>
      <input
        ref={presetImportRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => void importPromptPresets(event)}
      />
    </div>
  );
}
