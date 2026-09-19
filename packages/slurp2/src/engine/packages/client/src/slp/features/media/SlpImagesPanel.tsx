import { AlertTriangle, CheckCircle2, ChevronRight, Image, Sparkles } from "lucide-react";

import { Field, NumberSetting, SettingsGroup, Toggle } from "../../modules/settings/SlpSettingsControls";
import { toast } from "sonner";
import { BackstagePageHeader, BackstageWizard } from "../../modules/settings/SlpSettingsKit";

import type { SlurpSettings } from "../settings/slp-settings-contract";

import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { errorMessage } from "../../modules/settings/slp-backstage-format";

/** Image generation: connections, sizes, context mode and what gets an image. */
export function SlpImagesPanel(page: SlpBackstagePageProps) {
  const {
    t,
    updateSettings,
    settings,
    update,
    updatePatch,
    imageSettingsQuery,
    updateImages,
    connectionsQuery,
    imageConnections,
    imageSettings,
    imagesReady,
    imageWizardOpen,
    setImageWizardOpen,
    imageDraft,
    setImageDraft,
  } = page;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <BackstagePageHeader
          title={t("ui.slurp.settings.images.title")}
          detail={t("ui.slurp.settings.images.detail")}
          scope="all-slurp"
        />
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
      </div>
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
      <Field
        settingKey="imageContextMode"
        label={t("ui.slurp.settings.images.contextMode")}
        detail={t("ui.slurp.settings.images.contextModeDetail")}
      >
        <select
          value={settings.imageContextMode}
          disabled={updateSettings.isPending}
          onChange={(event) => void update("imageContextMode", event.target.value as SlurpSettings["imageContextMode"])}
          className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
        >
          <option value="auto">{t("ui.slurp.settings.images.contextAuto")}</option>
          <option value="imagePrompt">{t("ui.slurp.settings.images.contextPrompt")}</option>
          <option value="vision">{t("ui.slurp.settings.images.contextVision")}</option>
        </select>
      </Field>
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
      <Toggle
        settingKey="allowGalleryImageAttachments"
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
          <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">{t("ui.slurp.settings.images.howDetail")}</p>
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
          <p className="text-xs font-normal text-[var(--muted-foreground)]">{t("ui.slurp.settings.images.loading")}</p>
        )}
        {(imageSettingsQuery.isError || connectionsQuery.isError) && (
          <p className="text-xs font-normal text-red-400">{t("ui.slurp.settings.images.loadError")}</p>
        )}
      </Field>
      <Toggle
        settingKey="autoPostingImagesEnabled"
        label={t("ui.slurp.settings.images.enableForNew")}
        detail={t("ui.slurp.settings.images.enableForNewDetail")}
        value={settings.autoPostingImagesEnabled}
        onChange={(value) => update("autoPostingImagesEnabled", value)}
      />
      {/* Output size, from staging's package image settings. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          settingKey="imageWidth"
          label={t("ui.slurp.settings.images.width")}
          detail={t("ui.slurp.settings.images.widthDetail")}
        >
          <NumberSetting
            value={settings.imageWidth}
            min={64}
            max={4096}
            onSave={(value) => update("imageWidth", value)}
          />
        </Field>
        <Field
          settingKey="imageHeight"
          label={t("ui.slurp.settings.images.height")}
          detail={t("ui.slurp.settings.images.heightDetail")}
        >
          <NumberSetting
            value={settings.imageHeight}
            min={64}
            max={4096}
            onSave={(value) => update("imageHeight", value)}
          />
        </Field>
      </div>
      <SettingsGroup title={t("ui.slurp.settings.images.storiesGroup", { defaultValue: "Story images" })}>
        <p className="text-xs leading-5 text-[var(--slurp-muted)]">
          {t("ui.slurp.settings.images.storiesGroupDetail", {
            defaultValue: "Set the size used by image Stories. Story publishing cadence remains in Publishing.",
          })}
        </p>
        <Toggle
          settingKey="storyImagesEnabled"
          label={t("ui.slurp.settings.storyImagesEnabled")}
          detail={t("ui.slurp.settings.storyImagesEnabledDetail")}
          value={settings.storyImagesEnabled}
          onChange={(value) => update("storyImagesEnabled", value)}
        />
        <Field
          settingKey="storyLifetimeHours"
          label={t("ui.slurp.settings.storyLifetimeHours")}
          detail={t("ui.slurp.settings.storyLifetimeHoursDetail")}
        >
          <NumberSetting
            value={settings.storyLifetimeHours}
            min={1}
            max={168}
            onSave={(value) => update("storyLifetimeHours", value)}
          />
        </Field>
        {/* A Story is shown in its own tall frame, so it carries its own size. The
                        composer crops an uploaded Story to this ratio too. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            settingKey="storyImageWidth"
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
            settingKey="storyImageHeight"
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
      </SettingsGroup>
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
        </div>
      </details>
    </div>
  );
}
