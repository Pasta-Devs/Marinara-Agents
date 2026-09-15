import { AlertTriangle, CheckCircle2, ChevronRight, FileText, Image, Sparkles } from "lucide-react";
import { Field, GuidanceBox, NumberSetting, SectionTitle, Toggle } from "./SlurpSettingsControls";
import { toast } from "sonner";
import { type SlurpSettings } from "../../hooks/use-slurp";
import { SLURP_ACTIVITY_PRESETS, slurpActivityPresetPatch, slurpPostsPerDayForPreset } from "./slurp-activity-presets";
import type { SlurpBackstagePageProps } from "./SlurpSettings";
import {
  SLURP_GUIDANCE_PRESETS,
  SLURP_GUIDANCE_LEVELS,
  DEFAULT_SLURP_GENERATION_GUIDANCE,
  errorMessage,
  PromptCard,
} from "./SlurpBackstageWorkflow";

/** Automation: publishing, writing guidance, and image generation. */
export function SlurpBackstageAutomation(page: SlurpBackstagePageProps) {
  const {
    t,
    updateSettings,
    target,
    settings,
    setGenerationGuidanceDraft,
    setGenerationGuidanceEditorOpen,
    setImagePromptDraft,
    setImagePromptEditorOpen,
    customPaceOpen,
    setCustomPaceOpen,
    save,
    update,
    accountsQuery,
    imageSettingsQuery,
    updateImages,
    connectionsQuery,
    imageConnections,
    imageSettings,
    generationGuidanceIsDefault,
    guidanceLevel,
    imagePromptIsDefault,
    activityPreset,
    imagesReady,
    openRefresh,
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
  return (
    <>
      {target === "general" && (
        <div className="space-y-4">
          <SectionTitle
            title={t("ui.slurp.settings.publishing.title")}
            detail={t("ui.slurp.settings.publishing.detail")}
          />
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[var(--slurp-surface-raised,var(--background))] p-4 shadow-sm ring-1 ring-inset ring-[var(--border)] sm:p-5">
            <div>
              <h2 className="text-sm font-semibold">{t("ui.slurp.settings.refresh.title")}</h2>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">{t("ui.slurp.settings.refresh.detail")}</p>
            </div>
            <button
              type="button"
              disabled={accountsQuery.isLoading || accountsQuery.isError}
              onClick={openRefresh}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 shadow-sm transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50"
            >
              <Sparkles size={14} />
              {t("ui.slurp.settings.refresh.title")}
            </button>
          </div>
          <div>
            <h2 className="text-sm font-bold">{t("ui.slurp.settings.publishing.pace")}</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
              {t("ui.slurp.settings.publishing.howDetail")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {SLURP_ACTIVITY_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={activityPreset === preset}
                disabled={updateSettings.isPending}
                onClick={() => {
                  setCustomPaceOpen(false);
                  void save(slurpActivityPresetPatch(preset));
                }}
                className={`min-h-20 rounded-xl p-4 text-start ring-1 ring-inset transition-[background-color,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50 ${!customPaceOpen && activityPreset === preset ? "bg-[var(--slurp-nav-active)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-surface-raised)] ring-[var(--slurp-outline)] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_7%,var(--slurp-surface-raised))]"}`}
              >
                <span className="block text-sm font-semibold">{t(`ui.slurp.settings.presets.${preset}`)}</span>
                <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
                  {preset === "manual"
                    ? t("ui.slurp.settings.presets.manualDetail")
                    : t("ui.slurp.settings.presets.postsDetail", {
                        count: slurpPostsPerDayForPreset(preset),
                      })}
                </span>
              </button>
            ))}
            <button
              type="button"
              aria-pressed={customPaceOpen || activityPreset === null}
              disabled={updateSettings.isPending}
              onClick={() => setCustomPaceOpen(true)}
              className={`min-h-20 rounded-xl p-4 text-start ring-1 ring-inset transition-[background-color,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50 ${customPaceOpen || activityPreset === null ? "bg-[var(--slurp-nav-active)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-surface-raised)] ring-[var(--slurp-outline)] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_7%,var(--slurp-surface-raised))]"}`}
            >
              <span className="block text-sm font-semibold">{t("ui.slurp.settings.presets.custom")}</span>
              <span className="mt-1 block text-xs text-[var(--slurp-muted)]">
                {t("ui.slurp.settings.presets.customDetail")}
              </span>
            </button>
          </div>
          {(customPaceOpen || activityPreset === null) && (
            <Field label={t("ui.slurp.settings.postsPerDay")} detail={t("ui.slurp.settings.postsPerDayDetail")}>
              <NumberSetting
                value={settings.postsPerDay}
                min={1}
                max={96}
                onSave={(value) => save({ autoPostingScheduleEnabled: true, postsPerDay: value })}
              />
            </Field>
          )}
          {settings.autoPostingScheduleEnabled && (
            <Field label={t("ui.slurp.settings.storyRate")} detail={t("ui.slurp.settings.storyRateDetail")}>
              <select
                value={settings.storyRate}
                disabled={updateSettings.isPending}
                onChange={(event) => void update("storyRate", event.target.value as SlurpSettings["storyRate"])}
                className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
              >
                <option value="off">{t("ui.slurp.settings.storyRateOff")}</option>
                <option value="rare">{t("ui.slurp.settings.storyRateRare")}</option>
                <option value="regular">{t("ui.slurp.settings.storyRateRegular")}</option>
                <option value="often">{t("ui.slurp.settings.storyRateOften")}</option>
              </select>
            </Field>
          )}
          {settings.autoPostingScheduleEnabled ? (
            <Toggle
              label={t("ui.slurp.settings.quietHours")}
              detail={t("ui.slurp.settings.quietHoursDetail")}
              value={settings.nightQuiet}
              onChange={(value) => update("nightQuiet", value)}
            />
          ) : (
            <GuidanceBox
              title={t("ui.slurp.settings.publishing.manualTitle")}
              detail={t("ui.slurp.settings.publishing.manualDetail")}
            />
          )}
          <div className="space-y-3">
            <SectionTitle
              title={t("ui.slurp.settings.carryover.title")}
              detail={t("ui.slurp.settings.carryover.detail")}
            />
            {(["conversation", "roleplay", "game"] as const).map((mode) => (
              <Toggle
                key={mode}
                compact
                label={t(`ui.slurp.settings.carryover.${mode}`)}
                value={settings.carryoverModes.includes(mode)}
                onChange={(value) =>
                  update(
                    "carryoverModes",
                    value
                      ? [...settings.carryoverModes.filter((entry) => entry !== mode), mode]
                      : settings.carryoverModes.filter((entry) => entry !== mode),
                  )
                }
              />
            ))}
            {settings.carryoverModes.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={t("ui.slurp.settings.carryover.hours")}
                  detail={t("ui.slurp.settings.carryover.hoursDetail")}
                >
                  <NumberSetting
                    value={settings.carryoverHours}
                    min={1}
                    max={24 * 365}
                    onSave={(value) => save({ carryoverHours: value })}
                  />
                </Field>
                <Field
                  label={t("ui.slurp.settings.carryover.maxItems")}
                  detail={t("ui.slurp.settings.carryover.maxItemsDetail")}
                >
                  <NumberSetting
                    value={settings.carryoverMaxItems}
                    min={1}
                    max={100}
                    onSave={(value) => save({ carryoverMaxItems: value })}
                  />
                </Field>
              </div>
            )}
          </div>
          <details className="group rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden">
              <FileText size={17} className="text-[var(--slurp-violet)]" aria-hidden="true" />
              <span className="flex-1">{t("ui.slurp.settings.publishing.generationDetails")}</span>
              <ChevronRight
                size={17}
                className="transition-transform group-open:rotate-90 rtl:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-5 border-t border-[var(--slurp-outline)] p-4 sm:p-5">
              {settings.autoPostingScheduleEnabled && (
                <Field
                  label={t("ui.slurp.settings.generationMode")}
                  detail={t("ui.slurp.settings.generationModeDetail")}
                >
                  <select
                    value={settings.autoPostGenerationMode}
                    disabled={updateSettings.isPending}
                    onChange={(event) =>
                      void update(
                        "autoPostGenerationMode",
                        event.target.value as SlurpSettings["autoPostGenerationMode"],
                      )
                    }
                    className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
                  >
                    <option value="pre_generate">{t("ui.slurp.settings.generationModePreGenerate")}</option>
                    <option value="on_demand">{t("ui.slurp.settings.generationModeOnDemand")}</option>
                  </select>
                </Field>
              )}
              <Field
                label={t("ui.slurp.settings.connections.creatorText")}
                detail={t("ui.slurp.settings.connections.creatorTextDetail")}
              >
                <select
                  value={settings.generationConnectionId ?? ""}
                  disabled={connectionsQuery.isLoading || connectionsQuery.isError || updateSettings.isPending}
                  onChange={(event) => void update("generationConnectionId", event.target.value || null)}
                  className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
                >
                  <option value="">{t("ui.slurp.settings.connections.engineDefault")}</option>
                  {(connectionsQuery.data ?? [])
                    .filter((connection) => connection.provider !== "image_generation")
                    .map((connection) => (
                      <option key={connection.id} value={connection.id}>
                        {connection.name ?? connection.model ?? connection.id}
                      </option>
                    ))}
                </select>
              </Field>
              <Toggle
                label={t("ui.slurp.settings.prompts.lorebookContext")}
                detail={t("ui.slurp.settings.prompts.lorebookContextDetail")}
                value={settings.enableLorebookContext}
                onChange={(value) => update("enableLorebookContext", value)}
              />
              <Toggle
                label={t("ui.slurp.settings.prompts.professorMari")}
                detail={t("ui.slurp.settings.prompts.professorMariDetail")}
                value={settings.professorMariCreatorSource}
                onChange={(value) => update("professorMariCreatorSource", value)}
              />
              <Field
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
              <Field label={t("ui.slurp.settings.presets.title")} detail={t("ui.slurp.settings.presets.detail")}>
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
          </details>
        </div>
      )}

      {target === "images" && (
        <div className="space-y-4">
          <SectionTitle title={t("ui.slurp.settings.images.title")} detail={t("ui.slurp.settings.images.detail")} />
          <Field
            label={t("ui.slurp.settings.images.contextMode")}
            detail={t("ui.slurp.settings.images.contextModeDetail")}
          >
            <select
              value={settings.imageContextMode}
              disabled={updateSettings.isPending}
              onChange={(event) =>
                void update("imageContextMode", event.target.value as SlurpSettings["imageContextMode"])
              }
              className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
            >
              <option value="auto">{t("ui.slurp.settings.images.contextAuto")}</option>
              <option value="imagePrompt">{t("ui.slurp.settings.images.contextPrompt")}</option>
              <option value="vision">{t("ui.slurp.settings.images.contextVision")}</option>
            </select>
          </Field>
          {settings.imageContextMode !== "imagePrompt" && (
            <Field
              label={t("ui.slurp.settings.images.contextConnection")}
              detail={t("ui.slurp.settings.images.contextConnectionDetail")}
            >
              <select
                value={settings.imageContextConnectionId ?? ""}
                disabled={connectionsQuery.isLoading || connectionsQuery.isError || updateSettings.isPending}
                onChange={(event) => void update("imageContextConnectionId", event.target.value || null)}
                className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
              >
                <option value="">{t("ui.slurp.settings.images.contextConnectionText")}</option>
                {(connectionsQuery.data ?? [])
                  .filter((connection) => connection.provider !== "image_generation")
                  .map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.name ?? connection.model ?? connection.id}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <Toggle
            label={t("ui.slurp.settings.images.galleryFallback")}
            detail={t("ui.slurp.settings.images.galleryFallbackDetail")}
            value={settings.allowGalleryImageAttachments}
            onChange={(value) => update("allowGalleryImageAttachments", value)}
          />
          <div
            className={`flex items-start gap-3 rounded-xl p-4 ring-1 ring-inset ${imagesReady ? "bg-[color-mix(in_srgb,var(--slurp-success)_8%,var(--slurp-surface-raised))] ring-[var(--slurp-success)]/25" : "bg-[color-mix(in_srgb,var(--slurp-warning)_8%,var(--slurp-surface-raised))] ring-[var(--slurp-warning)]/25"}`}
          >
            {imagesReady ? (
              <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-[var(--slurp-success)]" aria-hidden="true" />
            ) : (
              <AlertTriangle size={19} className="mt-0.5 shrink-0 text-[var(--slurp-warning)]" aria-hidden="true" />
            )}
            <div>
              <h2 className="text-sm font-bold">
                {imagesReady ? t("ui.slurp.settings.images.readyTitle") : t("ui.slurp.settings.images.needsSetupTitle")}
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
                {t("ui.slurp.settings.images.howDetail")}
              </p>
            </div>
          </div>
          <Field
            label={t("ui.slurp.settings.images.globalConnection")}
            detail={t("ui.slurp.settings.images.globalConnectionDetail")}
          >
            <select
              value={imageSettings?.defaultConnectionId ?? ""}
              disabled={
                imageSettingsQuery.isLoading ||
                imageSettingsQuery.isError ||
                connectionsQuery.isLoading ||
                connectionsQuery.isError ||
                updateImages.isPending
              }
              onChange={(event) =>
                updateImages.mutate(
                  { defaultConnectionId: event.target.value || null },
                  { onError: (error) => toast.error(errorMessage(error)) },
                )
              }
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 sm:text-sm"
            >
              <option value="">{t("ui.slurp.settings.images.engineDefault")}</option>
              {imageConnections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name ?? connection.model ?? connection.id}
                </option>
              ))}
            </select>
            {(imageSettingsQuery.isLoading || connectionsQuery.isLoading) && (
              <p className="text-xs font-normal text-[var(--muted-foreground)]">
                {t("ui.slurp.settings.images.loading")}
              </p>
            )}
            {(imageSettingsQuery.isError || connectionsQuery.isError) && (
              <p className="text-xs font-normal text-red-400">{t("ui.slurp.settings.images.loadError")}</p>
            )}
          </Field>
          <Toggle
            label={t("ui.slurp.settings.images.enableForNew")}
            detail={t("ui.slurp.settings.images.enableForNewDetail")}
            value={settings.autoPostingImagesEnabled}
            onChange={(value) => update("autoPostingImagesEnabled", value)}
          />
          {/* Output size, from staging's package image settings. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("ui.slurp.settings.images.width")} detail={t("ui.slurp.settings.images.widthDetail")}>
              <NumberSetting
                value={settings.imageWidth}
                min={64}
                max={4096}
                onSave={(value) => update("imageWidth", value)}
              />
            </Field>
            <Field label={t("ui.slurp.settings.images.height")} detail={t("ui.slurp.settings.images.heightDetail")}>
              <NumberSetting
                value={settings.imageHeight}
                min={64}
                max={4096}
                onSave={(value) => update("imageHeight", value)}
              />
            </Field>
          </div>
          {/* A Story is shown in its own tall frame, so it carries its own size. The
                      composer crops an uploaded Story to this ratio too. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t("ui.slurp.settings.images.storyWidth")}
              detail={t("ui.slurp.settings.images.storyWidthDetail")}
            >
              <NumberSetting
                value={settings.storyImageWidth}
                min={64}
                max={4096}
                onSave={(value) => update("storyImageWidth", value)}
              />
            </Field>
            <Field
              label={t("ui.slurp.settings.images.storyHeight")}
              detail={t("ui.slurp.settings.images.storyHeightDetail")}
            >
              <NumberSetting
                value={settings.storyImageHeight}
                min={64}
                max={4096}
                onSave={(value) => update("storyImageHeight", value)}
              />
            </Field>
          </div>
          <details className="group rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden">
              <Image size={17} className="text-[var(--slurp-violet)]" aria-hidden="true" />
              <span className="flex-1">{t("ui.slurp.settings.images.detailsTitle")}</span>
              <ChevronRight
                size={17}
                className="transition-transform group-open:rotate-90 rtl:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-5 border-t border-[var(--slurp-outline)] p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Toggle
                  label={t("ui.slurp.settings.images.interpretPrompts")}
                  detail={t("ui.slurp.settings.images.interpretPromptsDetail")}
                  value={settings.enableImageInterpretation}
                  onChange={(value) => update("enableImageInterpretation", value)}
                />
                <Toggle
                  label={t("ui.slurp.settings.images.useAvatarReferences")}
                  detail={t("ui.slurp.settings.images.useAvatarReferencesDetail")}
                  value={settings.imageGenerationUseAvatarReferences}
                  onChange={(value) => update("imageGenerationUseAvatarReferences", value)}
                />
                <Toggle
                  label={t("ui.slurp.settings.images.includeDescriptions")}
                  detail={t("ui.slurp.settings.images.includeDescriptionsDetail")}
                  value={settings.imageGenerationIncludeDescriptions}
                  onChange={(value) => update("imageGenerationIncludeDescriptions", value)}
                />
              </div>
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
            </div>
          </details>
        </div>
      )}
    </>
  );
}
