import { AlertTriangle, CheckCircle2, ChevronRight, Image, Sparkles } from "lucide-react";
import { ShapeSetting } from "../../modules/settings/SlpShapeSetting";

import { AdvancedGroup, Field, NumberSetting, SettingsGroup, Toggle } from "../../modules/settings/SlpSettingsControls";
import { ChoiceSetting, StatusStrip } from "../../modules/settings/SlpSettingsInputs";
import { BackstagePageHeader, BackstageWizard, SettingAnchor } from "../../modules/settings/SlpSettingsKit";

import type { SlurpSettings } from "../settings/slp-settings-contract";

import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { useSlurpImageStyleProfiles } from "./slp-image-connection-hooks";

/** Image generation: connections, sizes, context mode and what gets an image. */
export function SlpImagesPanel(page: SlpBackstagePageProps) {
  const {
    t,
    updateSettings,
    settings,
    update,
    updatePatch,
    connectionsQuery,
    imagesReady,
    imageWizardOpen,
    setImageWizardOpen,
    imageDraft,
    setImageDraft,
    imageConnectionLabel,
  } = page;
  const styleProfilesQuery = useSlurpImageStyleProfiles();

  const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
  return (
    <div className="space-y-4">
      <BackstagePageHeader
        detail={t("ui.slurp.settings.images.detail")}
        actions={
          <button
            type="button"
            aria-expanded={imageWizardOpen}
            onClick={() => {
              setImageDraft({
                imageContextMode: settings.imageContextMode,
                autoPostingImagesEnabled: settings.autoPostingImagesEnabled,
                allowGalleryImageAttachments: settings.allowGalleryImageAttachments,
                imageWidth: settings.imageWidth,
                imageHeight: settings.imageHeight,
              });
              setImageWizardOpen((open) => !open);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
          >
            <Sparkles size={14} aria-hidden="true" />
            {t("ui.slurp.settings.backstage.wizard.imagesTitle", { defaultValue: "Set up images" })}
          </button>
        }
      />
      <StatusStrip
        label={t("ui.slurp.settings.strip.label")}
        items={[
          {
            label: t("ui.slurp.settings.strip.context"),
            value: t(
              `ui.slurp.settings.images.context${settings.imageContextMode === "imagePrompt" ? "Prompt" : cap(settings.imageContextMode)}`,
            ),
            settingKey: "imageContextMode",
          },
          {
            label: t("ui.slurp.settings.strip.appearance"),
            value: t(
              `ui.slurp.appearance.mode.${settings.appearanceProfileMode === "high_confidence" ? "highConfidence" : settings.appearanceProfileMode}`,
            ),
            settingKey: "appearanceProfileMode",
          },
        ]}
      />
      {imageWizardOpen && imageDraft && (
        <BackstageWizard
          title={t("ui.slurp.settings.backstage.wizard.imagesTitle", { defaultValue: "Set up images" })}
          preset={null}
          current={settings}
          proposed={{ ...settings, ...imageDraft }}
          patch={imageDraft}
          pending={updateSettings.isPending}
          onCancel={() => setImageWizardOpen(false)}
          onApply={(patch) => {
            void updatePatch(patch);
            setImageWizardOpen(false);
          }}
          steps={[
            {
              id: "source",
              title: t("ui.slurp.settings.backstage.wizard.imagesSource", { defaultValue: "Choose image context" }),
              content: (
                <Field
                  label={t("ui.slurp.settings.images.contextMode")}
                  detail={t("ui.slurp.settings.images.contextModeDetail")}
                >
                  <select
                    value={imageDraft.imageContextMode}
                    onChange={(event) =>
                      setImageDraft({
                        ...imageDraft,
                        imageContextMode: event.target.value as SlurpSettings["imageContextMode"],
                      })
                    }
                    className="min-h-11 w-full rounded-lg bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] sm:text-sm"
                  >
                    <option value="auto">{t("ui.slurp.settings.images.contextAuto")}</option>
                    <option value="imagePrompt">{t("ui.slurp.settings.images.contextPrompt")}</option>
                    <option value="vision">{t("ui.slurp.settings.images.contextVision")}</option>
                  </select>
                </Field>
              ),
            },
            {
              id: "delivery",
              title: t("ui.slurp.settings.backstage.wizard.imagesDelivery", {
                defaultValue: "Choose when images appear",
              }),
              content: (
                <div className="space-y-3">
                  <Toggle
                    label={t("ui.slurp.settings.images.enableForNew")}
                    detail={t("ui.slurp.settings.images.enableForNewDetail")}
                    value={imageDraft.autoPostingImagesEnabled}
                    onChange={(value) => setImageDraft({ ...imageDraft, autoPostingImagesEnabled: value })}
                  />
                  <Toggle
                    label={t("ui.slurp.settings.images.galleryFallback")}
                    detail={t("ui.slurp.settings.images.galleryFallbackDetail")}
                    value={imageDraft.allowGalleryImageAttachments}
                    onChange={(value) => setImageDraft({ ...imageDraft, allowGalleryImageAttachments: value })}
                  />
                </div>
              ),
            },
            {
              id: "shape",
              title: t("ui.slurp.settings.backstage.wizard.imagesShape", {
                defaultValue: "Choose the image shape",
              }),
              content: (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("ui.slurp.settings.images.width")}>
                    <NumberSetting
                      value={imageDraft.imageWidth}
                      min={64}
                      max={4096}
                      onSave={(value) => setImageDraft({ ...imageDraft, imageWidth: value })}
                    />
                  </Field>
                  <Field label={t("ui.slurp.settings.images.height")}>
                    <NumberSetting
                      value={imageDraft.imageHeight}
                      min={64}
                      max={4096}
                      onSave={(value) => setImageDraft({ ...imageDraft, imageHeight: value })}
                    />
                  </Field>
                </div>
              ),
            },
          ]}
        />
      )}
      <div
        className={`flex flex-wrap items-center gap-3 rounded-xl p-4 ring-1 ring-inset ${imagesReady ? "bg-[color-mix(in_srgb,var(--slurp-success)_8%,var(--slurp-surface-raised))] ring-[var(--slurp-success)]/25" : "bg-[color-mix(in_srgb,var(--slurp-warning)_8%,var(--slurp-surface-raised))] ring-[var(--slurp-warning)]/25"}`}
      >
        {imagesReady ? (
          <CheckCircle2 size={19} className="shrink-0 text-[var(--slurp-success)]" aria-hidden="true" />
        ) : (
          <AlertTriangle size={19} className="shrink-0 text-[var(--slurp-warning)]" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1 basis-60">
          <h2 className="text-sm font-bold">
            {imagesReady ? t("ui.slurp.settings.images.readyTitle") : t("ui.slurp.settings.images.needsSetupTitle")}
          </h2>
          <p className="mt-0.5 text-xs leading-5 text-[var(--slurp-muted)]">
            {t("ui.slurp.settings.connections.imageGeneration")}: {imageConnectionLabel}
          </p>
        </div>
        {/* The picture model has one home, Connections; this row only says which one is used. */}
        <button
          type="button"
          onClick={() => page.onNavigate({ ...page.navigation, section: "models", target: "connections" })}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] hover:bg-[var(--slurp-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
        >
          {t("ui.slurp.settings.images.changeModel")}
          <ChevronRight size={16} className="rtl:rotate-180" aria-hidden="true" />
        </button>
      </div>
      <SettingsGroup title={t("ui.slurp.settings.images.postsGroup")}>
        <Toggle
          settingKey="autoPostingImagesEnabled"
          label={t("ui.slurp.settings.images.enableForNew")}
          detail={t("ui.slurp.settings.images.enableForNewDetail")}
          value={settings.autoPostingImagesEnabled}
          onChange={(value) => update("autoPostingImagesEnabled", value)}
        />
        <Toggle
          settingKey="allowGalleryImageAttachments"
          label={t("ui.slurp.settings.images.galleryFallback")}
          detail={t("ui.slurp.settings.images.galleryFallbackDetail")}
          value={settings.allowGalleryImageAttachments}
          onChange={(value) => update("allowGalleryImageAttachments", value)}
        />
        <Field
          settingKey="imageStyleProfileId"
          label={t("ui.slurp.settings.images.styleProfile")}
          detail={t("ui.slurp.settings.images.styleProfileDetail")}
        >
          <select
            value={settings.imageStyleProfileId ?? ""}
            disabled={styleProfilesQuery.isLoading || styleProfilesQuery.isError || updateSettings.isPending}
            onChange={(event) => void update("imageStyleProfileId", event.target.value || null)}
            className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
          >
            <option value="">{t("ui.slurp.settings.images.styleProfileDefault")}</option>
            {(styleProfilesQuery.data ?? []).map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </Field>
        <SettingAnchor settingKey="imageWidth">
          <SettingAnchor settingKey="imageHeight">
            <ShapeSetting
              label={t("ui.slurp.settings.images.postShape")}
              detail={t("ui.slurp.settings.images.widthDetail")}
              width={settings.imageWidth}
              height={settings.imageHeight}
              onSave={(width, height) => void updatePatch({ imageWidth: width, imageHeight: height })}
            />
          </SettingAnchor>
        </SettingAnchor>
      </SettingsGroup>
      <SettingsGroup title={t("ui.slurp.settings.images.storiesGroup", { defaultValue: "Story images" })}>
        <SettingAnchor settingKey="storyImageWidth">
          <SettingAnchor settingKey="storyImageHeight">
            <ShapeSetting
              label={t("ui.slurp.settings.images.storyShape")}
              detail={t("ui.slurp.settings.images.storyWidthDetail")}
              width={settings.storyImageWidth}
              height={settings.storyImageHeight}
              onSave={(width, height) => void updatePatch({ storyImageWidth: width, storyImageHeight: height })}
            />
          </SettingAnchor>
        </SettingAnchor>
      </SettingsGroup>
      <SettingsGroup title={t("ui.slurp.settings.images.readingGroup")}>
        <ChoiceSetting
          settingKey="imageContextMode"
          label={t("ui.slurp.settings.images.contextMode")}
          detail={t("ui.slurp.settings.images.contextModeDetail")}
          options={[
            { value: "auto", label: t("ui.slurp.settings.images.contextAuto") },
            { value: "imagePrompt", label: t("ui.slurp.settings.images.contextPrompt") },
            { value: "vision", label: t("ui.slurp.settings.images.contextVision") },
          ]}
          value={settings.imageContextMode}
          disabled={updateSettings.isPending}
          onChange={(value: SlurpSettings["imageContextMode"]) => void update("imageContextMode", value)}
        />
        {settings.imageContextMode !== "imagePrompt" && (
          <Field
            settingKey="imageContextConnectionId"
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
      </SettingsGroup>
      <AdvancedGroup
        icon={<Image size={17} className="text-[var(--slurp-violet)]" aria-hidden="true" />}
        title={t("ui.slurp.settings.images.detailsTitle")}
      >
        <ChoiceSetting
          settingKey="appearanceProfileMode"
          label={t("ui.slurp.appearance.mode")}
          detail={t("ui.slurp.appearance.modeDetail")}
          options={[
            { value: "ask", label: t("ui.slurp.appearance.mode.ask") },
            { value: "high_confidence", label: t("ui.slurp.appearance.mode.highConfidence") },
            { value: "always", label: t("ui.slurp.appearance.mode.always") },
          ]}
          value={settings.appearanceProfileMode}
          onChange={(value: SlurpSettings["appearanceProfileMode"]) => void update("appearanceProfileMode", value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            settingKey="imageGenerationUseAvatarReferences"
            label={t("ui.slurp.settings.images.useAvatarReferences")}
            detail={t("ui.slurp.settings.images.useAvatarReferencesDetail")}
            value={settings.imageGenerationUseAvatarReferences}
            onChange={(value) => update("imageGenerationUseAvatarReferences", value)}
          />
          <Toggle
            settingKey="imageGenerationIncludeDescriptions"
            label={t("ui.slurp.settings.images.includeDescriptions")}
            detail={t("ui.slurp.settings.images.includeDescriptionsDetail")}
            value={settings.imageGenerationIncludeDescriptions}
            onChange={(value) => update("imageGenerationIncludeDescriptions", value)}
          />
        </div>
      </AdvancedGroup>
    </div>
  );
}
