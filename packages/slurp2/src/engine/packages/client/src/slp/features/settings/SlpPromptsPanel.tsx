import { Field, SectionTitle, Toggle } from "../../modules/settings/SlpSettingsControls";
import { BackstagePageHeader, SettingAnchor } from "../../modules/settings/SlpSettingsKit";
import { useSlurpPostGuidance } from "./slp-post-guidance-contract";
import { SlurpPostGuidanceField } from "./SlpPostGuidanceField";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { SlurpPromptBlockBuilder } from "./SlpPromptBlockBuilder";
import {
  SLURP_GUIDANCE_PRESETS,
  SLURP_GUIDANCE_LEVELS,
  SLURP_IMAGE_INTERPRETATION_PRESETS,
  SLURP_IMAGE_INTERPRETATION_STYLES,
  DEFAULT_SLURP_GENERATION_GUIDANCE,
} from "../../modules/settings/slp-backstage-format";
import { PromptCard } from "../../modules/settings/SlpBackstageKit";
import { SLURP_PROMPT_MODES, type SlurpPromptMode } from "./slp-settings-contract";

/**
 * Prompts: every text Slurp sends to a model, in one place.
 *
 * Writing guidance sat in Automation and the image prompts sat in Images, so changing the voice of
 * a Creator meant two screens that never showed each other.
 */
export function SlpPromptsPanel(page: SlpBackstagePageProps) {
  const {
    t,
    updateSettings,
    settings,
    setGenerationGuidanceDraft,
    setGenerationGuidanceEditorOpen,
    setImagePromptDraft,
    setImagePromptEditorOpen,
    update,
    generationGuidanceIsDefault,
    guidanceLevel,
    interpretationStyle,
    imagePromptIsDefault,
    selectedPresetName,
    setSelectedPresetName,
    presetImportRef,
    selectedPreset,
    savePromptPreset,
    applyPromptPreset,
    deletePromptPreset,
    exportPromptPresets,
    importPromptPresets,
    restore,
    restoreDefaultImagePrompt,
  } = page;
  const postGuidanceQuery = useSlurpPostGuidance(true);
  return (
    <div className="space-y-4">
      <BackstagePageHeader
        title={t("ui.slurp.settings.prompts.studioTitle", { defaultValue: "Prompt Studio" })}
        detail={t("ui.slurp.settings.prompts.studioDetail", {
          defaultValue: "Shape how Slurp thinks, writes, and produces content for your Creators.",
        })}
        scope="all-slurp"
      />
      <section
        aria-labelledby="slurp-prompt-studio-scope"
        className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)] sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 id="slurp-prompt-studio-scope" className="text-sm font-bold">
              {t("ui.slurp.settings.prompts.scopeTitle", { defaultValue: "Prompt scope" })}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--slurp-muted)]">
              {t("ui.slurp.settings.prompts.scopeDetail", {
                defaultValue:
                  "These defaults apply to every Creator. Choose a Creator in the advanced builder when you need to inspect the runtime context used by a preview.",
              })}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-[var(--slurp-canvas)] px-3 py-1.5 text-[var(--slurp-violet)] ring-1 ring-inset ring-[var(--slurp-violet)]/25">
              {t("ui.slurp.settings.prompts.globalDefaults", { defaultValue: "Global defaults" })}
            </span>
            <span className="rounded-full bg-[var(--slurp-canvas)] px-3 py-1.5 text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]">
              {t("ui.slurp.settings.prompts.producePipeline", { defaultValue: "Produce pipeline" })}
            </span>
          </div>
        </div>
      </section>
      <div className="space-y-5 rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)] sm:p-5">
        <SectionTitle
          title={t("ui.slurp.settings.prompts.textTitle")}
          detail={t("ui.slurp.settings.prompts.textDetail")}
        />
        <Toggle
          settingKey="enableLorebookContext"
          label={t("ui.slurp.settings.prompts.lorebookContext")}
          detail={t("ui.slurp.settings.prompts.lorebookContextDetail")}
          value={settings.enableLorebookContext}
          onChange={(value) => update("enableLorebookContext", value)}
        />
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
                disabled={updateSettings.isPending}
                onClick={() =>
                  void restore(
                    { generationGuidance: SLURP_GUIDANCE_PRESETS[level] },
                    t("ui.slurp.settings.prompts.spiceApplied", {
                      level: t(`ui.slurp.settings.prompts.spice.${level}`),
                    }),
                  )
                }
                className={`min-h-10 rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 ${guidanceLevel === level ? "bg-[var(--slurp-nav-active)] text-[var(--slurp-text)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-surface-raised)] text-[var(--slurp-muted)] ring-[var(--slurp-outline)] hover:text-[var(--slurp-text)]"}`}
              >
                {t(`ui.slurp.settings.prompts.spice.${level}`)}
              </button>
            ))}
          </div>
        </Field>
        <PromptCard
          title={t("ui.slurp.settings.prompts.generationGuidance")}
          value={settings.generationGuidance}
          isDefault={generationGuidanceIsDefault}
          onEdit={() => {
            setGenerationGuidanceDraft(settings.generationGuidance);
            setGenerationGuidanceEditorOpen(true);
          }}
          onRestore={() =>
            void restore(
              { generationGuidance: DEFAULT_SLURP_GENERATION_GUIDANCE },
              t("ui.slurp.settings.prompts.guidanceRestored"),
            )
          }
        />
        {/* The guidance above applies to every post. These two say what a post is for, which
              is a different question for a free post than for one somebody paid to read. */}
        {(["public", "locked"] as const).map((access) => (
          <SlurpPostGuidanceField
            key={access}
            access={access}
            guidance={postGuidanceQuery.data}
            inherited={postGuidanceQuery.data?.builtIn[access] ?? ""}
            label={t(`ui.slurp.settings.prompts.${access}Guidance`)}
            detail={t(`ui.slurp.settings.prompts.${access}GuidanceDetail`)}
            generateLabel={t("ui.slurp.settings.prompts.guidanceGenerate")}
            clearLabel={t("ui.slurp.settings.prompts.guidanceUseBuiltIn")}
            savedMessage={t("ui.slurp.settings.prompts.guidanceSavedAccess")}
            disabled={postGuidanceQuery.isLoading || postGuidanceQuery.isError}
          />
        ))}
        <Field
          settingKey="promptPresets"
          label={t("ui.slurp.settings.presets.title")}
          detail={t("ui.slurp.settings.presets.detail")}
        >
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedPreset ? selectedPresetName : ""}
              disabled={settings.promptPresets.length === 0}
              onChange={(event) => setSelectedPresetName(event.target.value)}
              aria-label={t("ui.slurp.settings.presets.choose")}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
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
            <button
              type="button"
              disabled={!selectedPreset || updateSettings.isPending}
              onClick={() => void applyPromptPreset()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {t("ui.slurp.settings.presets.apply")}
            </button>
            <button
              type="button"
              disabled={!selectedPreset || updateSettings.isPending}
              onClick={() => void deletePromptPreset()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {t("ui.slurp.settings.presets.delete")}
            </button>
            <button
              type="button"
              disabled={updateSettings.isPending}
              onClick={() => void savePromptPreset()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {t("ui.slurp.settings.presets.save")}
            </button>
            <button
              type="button"
              disabled={settings.promptPresets.length === 0}
              onClick={exportPromptPresets}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {t("ui.slurp.settings.presets.export")}
            </button>
            <button
              type="button"
              disabled={updateSettings.isPending}
              onClick={() => presetImportRef.current?.click()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {t("ui.slurp.settings.presets.import")}
            </button>
            <input
              ref={presetImportRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => void importPromptPresets(event)}
            />
          </div>
        </Field>
      </div>
      <div
        id="slurp-prompt-builder"
        className="space-y-5 rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)] sm:p-5"
      >
        <SectionTitle
          title={t("ui.slurp.settings.prompts.blockBuildersTitle", { defaultValue: "Prompt block builders" })}
          detail={t("ui.slurp.settings.prompts.blockBuildersDetail", {
            defaultValue:
              "Change the instructions, order, and optional context for every prompt Slurp sends to a model.",
          })}
        />
        <Field
          settingKey="promptMode"
          label={t("ui.slurp.settings.prompts.modeLabel", { defaultValue: "Prompt mode" })}
          detail={t("ui.slurp.settings.prompts.modeDetail", {
            defaultValue:
              "Produce writes as a creator who plans, shoots, and sells content. Classic is the older behaviour, where a moment happens and a photo records it. Each mode keeps its own block edits, so switching never discards the other one's tuning.",
          })}
        >
          <select
            value={settings.promptMode}
            disabled={updateSettings.isPending}
            onChange={(event) => void update("promptMode", event.target.value as SlurpPromptMode)}
            className="min-h-10 w-full rounded-lg border border-[var(--slurp-outline)] bg-transparent px-3 text-sm"
          >
            {SLURP_PROMPT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {t(`ui.slurp.settings.prompts.mode.${mode}`, {
                  defaultValue: mode === "produce" ? "Produce (new)" : "Classic",
                })}
              </option>
            ))}
          </select>
        </Field>
        <SettingAnchor settingKey="promptBlocks">
          <SlurpPromptBlockBuilder
            mode={settings.promptMode}
            value={settings.promptBlocks[settings.promptMode] ?? {}}
            instructions={settings.promptInstructions}
            pending={updateSettings.isPending}
            onSave={(promptBlocks) =>
              // Merge, never replace. Writing only the active mode would drop the other mode's
              // saved layout on the first save after a switch.
              update("promptBlocks", { ...settings.promptBlocks, [settings.promptMode]: promptBlocks })
            }
            onSaveInstructions={(promptInstructions) => update("promptInstructions", promptInstructions)}
          />
        </SettingAnchor>
      </div>
      <div className="space-y-5 rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)] sm:p-5">
        <SectionTitle
          title={t("ui.slurp.settings.prompts.imageTitle")}
          detail={t("ui.slurp.settings.prompts.imageDetail")}
        />
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
                  disabled={updateSettings.isPending}
                  onClick={() =>
                    void restore(
                      { imagePromptInterpretation: SLURP_IMAGE_INTERPRETATION_PRESETS[style] },
                      t("ui.slurp.settings.images.promptStyleApplied", {
                        style: t(`ui.slurp.settings.images.promptStyle.${style}`),
                      }),
                    )
                  }
                  className={`min-h-10 rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 ${interpretationStyle === style ? "bg-[var(--slurp-nav-active)] text-[var(--slurp-text)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-surface-raised)] text-[var(--slurp-muted)] ring-[var(--slurp-outline)] hover:text-[var(--slurp-text)]"}`}
                >
                  {t(`ui.slurp.settings.images.promptStyle.${style}`)}
                </button>
              ))}
            </div>
          </Field>
        )}
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
      </div>
    </div>
  );
}
