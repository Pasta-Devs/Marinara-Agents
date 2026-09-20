import { Image, MessageSquareText, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Field, Toggle } from "../../modules/settings/SlpSettingsControls";
import { BackstagePageHeader, SettingAnchor } from "../../modules/settings/SlpSettingsKit";
import { PromptCard } from "../../modules/settings/SlpBackstageKit";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { SlurpPromptBlockBuilder } from "./SlpPromptBlockBuilder";
import { SlpPromptOutcomeCard } from "./SlpPromptOutcomeCard";
import { SlurpPostGuidanceField } from "./SlpPostGuidanceField";
import {
  DEFAULT_SLURP_GENERATION_GUIDANCE,
  SLURP_GUIDANCE_LEVELS,
  SLURP_GUIDANCE_PRESETS,
  SLURP_IMAGE_INTERPRETATION_PRESETS,
  SLURP_IMAGE_INTERPRETATION_STYLES,
} from "../../modules/settings/slp-backstage-format";

type PromptOutcome = "voice" | "posts" | "images";

/** The calm Prompt Studio overview; low-level recipe composition opens only when a recipe is selected. */
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
    setSelectedPresetName,
    presetImportRef,
    selectedPreset,
    savePromptPreset,
    applyPromptPreset,
    deletePromptPreset,
    exportPromptPresets,
    importPromptPresets,
    restoreDefaultImagePrompt,
    postGuidanceQuery,
    postGuidanceDraft,
    stagePostGuidance,
  } = page;
  const [outcome, setOutcome] = useState<PromptOutcome>("voice");
  const postGuidanceCustom = Boolean(
    postGuidanceDraft.public !== undefined ||
    postGuidanceDraft.locked !== undefined ||
    postGuidanceQuery.data?.defaults.public ||
    postGuidanceQuery.data?.defaults.locked,
  );

  return (
    <div className="space-y-6">
      <BackstagePageHeader
        title={t("ui.slurp.settings.prompts.studioTitle", { defaultValue: "Prompt Studio" })}
        detail={t("ui.slurp.settings.prompts.studioDetail", {
          defaultValue: "Shape how Slurp writes, speaks, and creates.",
        })}
        scope="all-slurp"
      />

      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-[var(--slurp-surface-raised)] px-3 py-1.5 text-[var(--slurp-violet)] ring-1 ring-inset ring-[var(--slurp-violet)]/25">
          {t("ui.slurp.settings.prompts.globalDefaults", { defaultValue: "Global defaults" })}
        </span>
        <span className="rounded-full bg-[var(--slurp-surface-raised)] px-3 py-1.5 text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]">
          {t("ui.slurp.settings.prompts.producePipeline", { defaultValue: "Produce pipeline" })}
        </span>
        <span className="max-w-2xl py-1.5 text-[var(--slurp-muted)]">
          {t("ui.slurp.settings.prompts.scopeShort", {
            defaultValue: "Changes apply to every Creator; Creator selection below is preview context only.",
          })}
        </span>
      </div>

      <details className="rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
        <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)]">
          {t("ui.slurp.settings.prompts.presetToolbar", { defaultValue: "Presets and import" })}
          <span className="ms-2 text-xs font-normal text-[var(--slurp-muted)]">
            {t("ui.slurp.settings.prompts.presetCount", {
              count: settings.promptPresets.length,
              defaultValue: "{{count}} saved",
            })}
          </span>
        </summary>
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--slurp-outline)] p-4">
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
          {[
            [t("ui.slurp.settings.presets.apply"), () => void applyPromptPreset(), !selectedPreset],
            [t("ui.slurp.settings.presets.save"), () => void savePromptPreset(), false],
            [t("ui.slurp.settings.presets.delete"), () => void deletePromptPreset(), !selectedPreset],
            [t("ui.slurp.settings.presets.export"), exportPromptPresets, settings.promptPresets.length === 0],
            [t("ui.slurp.settings.presets.import"), () => presetImportRef.current?.click(), false],
          ].map(([label, action, disabled]) => (
            <button
              key={String(label)}
              type="button"
              disabled={Boolean(disabled) || updateSettings.isPending}
              onClick={action as () => void}
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] hover:bg-[var(--slurp-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50"
            >
              {label as string}
            </button>
          ))}
          <input
            ref={presetImportRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void importPromptPresets(event)}
          />
        </div>
      </details>

      <section aria-labelledby="slurp-prompt-outcomes-title" className="space-y-4">
        <div>
          <h2 id="slurp-prompt-outcomes-title" className="text-lg font-black text-balance">
            {t("ui.slurp.settings.prompts.outcomesTitle", { defaultValue: "Outcome controls" })}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--slurp-muted)] text-pretty">
            {t("ui.slurp.settings.prompts.outcomesDetail", {
              defaultValue: "Set the high-level direction first. Open recipes below when you need exact control.",
            })}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <SlpPromptOutcomeCard
            icon={<MessageSquareText size={18} aria-hidden="true" />}
            title={t("ui.slurp.settings.prompts.voiceOutcome", { defaultValue: "Voice and writing" })}
            summary={t("ui.slurp.settings.prompts.voiceOutcomeDetail", {
              defaultValue: "Tone, language, maturity, and context shared across Creator writing.",
            })}
            customized={!generationGuidanceIsDefault || settings.enableLorebookContext}
            selected={outcome === "voice"}
            onSelect={() => setOutcome("voice")}
          />
          <SlpPromptOutcomeCard
            icon={<SlidersHorizontal size={18} aria-hidden="true" />}
            title={t("ui.slurp.settings.prompts.postOutcome", { defaultValue: "Post behavior" })}
            summary={t("ui.slurp.settings.prompts.postOutcomeDetail", {
              defaultValue: "What public and locked posts should achieve for their audience.",
            })}
            customized={postGuidanceCustom}
            selected={outcome === "posts"}
            onSelect={() => setOutcome("posts")}
          />
          <SlpPromptOutcomeCard
            icon={<Image size={18} aria-hidden="true" />}
            title={t("ui.slurp.settings.prompts.imageOutcome", { defaultValue: "Image direction" })}
            summary={t("ui.slurp.settings.prompts.imageOutcomeDetail", {
              defaultValue: "Visual style and how Slurp turns ideas into image prompts.",
            })}
            customized={!imagePromptIsDefault || interpretationStyle === null}
            selected={outcome === "images"}
            onSelect={() => setOutcome("images")}
          />
        </div>

        <div className="space-y-5 rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)] sm:p-5">
          {outcome === "voice" && (
            <>
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
                  guidanceLevel
                    ? t("ui.slurp.settings.prompts.spiceDetail")
                    : t("ui.slurp.settings.prompts.spiceCustom")
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
            </>
          )}

          {outcome === "posts" &&
            (["public", "locked"] as const).map((access) => (
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

          {outcome === "images" && (
            <>
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
            </>
          )}
        </div>
      </section>

      <SettingAnchor settingKey="promptBlocks">
        <SlurpPromptBlockBuilder
          mode="produce"
          value={settings.promptBlocks.produce ?? {}}
          savedValue={savedSettings?.promptBlocks.produce ?? {}}
          instructions={settings.promptInstructions}
          savedInstructions={savedSettings?.promptInstructions ?? []}
          onChange={(promptBlocks) => void update("promptBlocks", { ...settings.promptBlocks, produce: promptBlocks })}
          onChangeInstructions={(promptInstructions) => void update("promptInstructions", promptInstructions)}
        />
      </SettingAnchor>
    </div>
  );
}
