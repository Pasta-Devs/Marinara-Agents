import { SlpCoinText } from "../../modules/coin/SlpCoin";
import { RotateCcw } from "lucide-react";
import { BackstagePageHeader } from "../../modules/settings/SlpSettingsKit";

import { Field, HowItWorks, SettingsGroup, Toggle } from "../../modules/settings/SlpSettingsControls";
import { SlpExtensionSwitch } from "../../modules/settings/SlpExtensionSwitch";
import { ChoiceSetting } from "../../modules/settings/SlpSettingsInputs";

import { api } from "../../../lib/api-client";
import { toast } from "sonner";
import { SettingAnchor } from "../../modules/settings/SlpSettingsKit";

import type { SlurpSettings } from "../settings/slp-settings-contract";
import { SlpBrandsPanel } from "./SlpBrandsPanel";
import { SlpButton } from "../../modules/chrome/SlpButton";

import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";

/** Ads: the inline ad settings, the ad pool and the ad editors. */
export function SlpAdsPanel(page: SlpBackstagePageProps) {
  const {
    viewerPersonaId,
    t,
    updateSettings,
    resetAds,
    generateAds,
    importAds,
    adsImportRef,
    adState,
    unhideBrand,
    adLorebooks,
    syncAdLorebook,
    imageConnections,
    settings,
    adsWorldDraft,
    setAdsWorldDraft,
    update,
    updateNow,
    updatePatch,
    connectionsQuery,
  } = page;

  // The extension's own switch heads the page; while it is off the page is only that switch.
  const extensionSwitch = (
    <SlpExtensionSwitch
      settingKey="extAds"
      label={t("ui.slurp.settings.ext.ads.label", { defaultValue: "Brands & ads" })}
      detail={t("ui.slurp.settings.ext.ads.detail", {
        defaultValue: "Inline ads, brand deals, ad pictures and brand packs.",
      })}
      on={slpExtensionOn(settings, "ads")}
      onChange={(value) => void updateNow("extAds", value)}
    />
  );
  if (!slpExtensionOn(settings, "ads"))
    return (
      <div className="space-y-5">
        <BackstagePageHeader detail={t("ui.slurp.settings.ads.detail")} />
        {extensionSwitch}
      </div>
    );

  return (
    <div className="space-y-5">
      <BackstagePageHeader detail={t("ui.slurp.settings.ads.detail")} />
      {extensionSwitch}
      <HowItWorks label={t("ui.slurp.settings.howItWorks")}>
        <p>{t("ui.slurp.settings.ads.explainer")}</p>
        <p>{t("ui.slurp.settings.ads.explainerPool")}</p>
        {settings.walletEnabled && settings.walletAdReward > 0 && (
          <p>
            <SlpCoinText>
              {t("ui.slurp.settings.ads.explainerEarning", {
                defaultValue:
                  "Acting on an ad pays {{reward}} <coin/>, up to {{cap}} a day. Change either in SlurpCoins.",
                reward: settings.walletAdReward,
                cap: settings.walletAdDailyCap,
              })}
            </SlpCoinText>
          </p>
        )}
      </HowItWorks>
      <SettingsGroup title={t("ui.slurp.settings.ads.feedGroup", { defaultValue: "In your feed" })}>
        <Toggle
          settingKey="inlineAdsEnabled"
          label={t("ui.slurp.settings.inlinePromotions")}
          detail={t("ui.slurp.settings.inlinePromotionsDetail")}
          value={settings.inlineAdsEnabled}
          onChange={(value) => update("inlineAdsEnabled", value)}
        />
        <ChoiceSetting
          settingKey="inlineAdsFrequency"
          label={t("ui.slurp.settings.ads.frequency")}
          detail={t("ui.slurp.settings.ads.frequencyDetail")}
          options={[
            { value: "light", label: t("ui.slurp.settings.ads.frequencyLight") },
            { value: "standard", label: t("ui.slurp.settings.ads.frequencyStandard") },
            { value: "frequent", label: t("ui.slurp.settings.ads.frequencyFrequent") },
          ]}
          value={settings.inlineAdsFrequency}
          disabled={updateSettings.isPending}
          onChange={(value: SlurpSettings["inlineAdsFrequency"]) => void update("inlineAdsFrequency", value)}
        />
        <ChoiceSetting
          settingKey="brandDealsPace"
          label={t("ui.slurp.settings.ads.dealsPace")}
          detail={t("ui.slurp.settings.ads.dealsPaceDetail")}
          options={[
            { value: "off", label: t("ui.slurp.settings.ads.dealsPaceOff") },
            { value: "rare", label: t("ui.slurp.settings.ads.dealsPaceRare") },
            { value: "normal", label: t("ui.slurp.settings.ads.dealsPaceNormal") },
            { value: "often", label: t("ui.slurp.settings.ads.dealsPaceOften") },
          ]}
          value={settings.brandDealsPace ?? "normal"}
          disabled={updateSettings.isPending}
          onChange={(value: SlurpSettings["brandDealsPace"]) => void update("brandDealsPace", value)}
        />
        <ChoiceSetting
          settingKey="inlineAdsSteering"
          label={t("ui.slurp.settings.ads.steering")}
          detail={t("ui.slurp.settings.ads.steeringDetail")}
          options={[
            { value: "personalized", label: t("ui.slurp.settings.ads.steeringPersonalized") },
            { value: "balanced", label: t("ui.slurp.settings.ads.steeringBalanced") },
            { value: "random", label: t("ui.slurp.settings.ads.steeringRandom") },
          ]}
          value={settings.inlineAdsSteering}
          disabled={updateSettings.isPending}
          onChange={(value: SlurpSettings["inlineAdsSteering"]) => void update("inlineAdsSteering", value)}
        />
        <ChoiceSetting
          settingKey="inlineAdsContentCeiling"
          label={t("ui.slurp.settings.ads.ceiling")}
          detail={t("ui.slurp.settings.ads.ceilingDetail")}
          options={[
            { value: "tame", label: t("ui.slurp.settings.ads.ceilingTame") },
            { value: "suggestive", label: t("ui.slurp.settings.ads.ceilingSuggestive") },
            { value: "explicit", label: t("ui.slurp.settings.ads.ceilingExplicit") },
          ]}
          value={settings.inlineAdsContentCeiling}
          disabled={updateSettings.isPending}
          onChange={(value: SlurpSettings["inlineAdsContentCeiling"]) => void update("inlineAdsContentCeiling", value)}
        />
      </SettingsGroup>
      <SettingsGroup title={t("ui.slurp.settings.ads.voiceGroup", { defaultValue: "How ads read" })}>
        <ChoiceSetting
          settingKey="inlineAdsTone"
          label={t("ui.slurp.settings.ads.tone")}
          detail={t("ui.slurp.settings.ads.toneDetail")}
          options={[
            { value: "corporate", label: t("ui.slurp.settings.ads.toneCorporate") },
            { value: "scammy", label: t("ui.slurp.settings.ads.toneScammy") },
            { value: "local", label: t("ui.slurp.settings.ads.toneLocal") },
            { value: "luxury", label: t("ui.slurp.settings.ads.toneLuxury") },
            { value: "unhinged", label: t("ui.slurp.settings.ads.toneUnhinged") },
          ]}
          value={settings.inlineAdsTone}
          disabled={updateSettings.isPending}
          onChange={(value: SlurpSettings["inlineAdsTone"]) => void update("inlineAdsTone", value)}
        />
        <ChoiceSetting
          settingKey="inlineAdsEra"
          label={t("ui.slurp.settings.ads.era")}
          detail={t("ui.slurp.settings.ads.eraDetail")}
          options={[
            { value: "present", label: t("ui.slurp.settings.ads.eraPresent") },
            { value: "nineties", label: t("ui.slurp.settings.ads.eraNineties") },
            { value: "cyberpunk", label: t("ui.slurp.settings.ads.eraCyberpunk") },
            { value: "retrofuture", label: t("ui.slurp.settings.ads.eraRetrofuture") },
          ]}
          value={settings.inlineAdsEra}
          disabled={updateSettings.isPending}
          onChange={(value: SlurpSettings["inlineAdsEra"]) => void update("inlineAdsEra", value)}
        />
        <Field
          settingKey="inlineAdsWorldContext"
          label={t("ui.slurp.settings.ads.world")}
          detail={t("ui.slurp.settings.ads.worldDetail")}
        >
          <textarea
            rows={3}
            value={adsWorldDraft ?? settings.inlineAdsWorldContext}
            maxLength={1200}
            onChange={(event) => setAdsWorldDraft(event.target.value)}
            onBlur={() => {
              const next = adsWorldDraft;
              setAdsWorldDraft(null);
              if (next !== null && next !== settings.inlineAdsWorldContext) void update("inlineAdsWorldContext", next);
            }}
            className="w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] p-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
          />
        </Field>
        <Toggle
          settingKey="inlineAdsImagesEnabled"
          label={t("ui.slurp.settings.ads.images")}
          detail={t("ui.slurp.settings.ads.imagesDetail")}
          value={settings.inlineAdsImagesEnabled}
          onChange={(value) => update("inlineAdsImagesEnabled", value)}
        />
        <Field
          settingKey="inlineAdsImageConnectionId"
          label={t("ui.slurp.settings.ads.imageConnection")}
          detail={t("ui.slurp.settings.ads.imageConnectionDetail")}
        >
          <select
            value={settings.inlineAdsImageConnectionId ?? ""}
            disabled={updateSettings.isPending || connectionsQuery.isLoading}
            onChange={(event) => void update("inlineAdsImageConnectionId", event.target.value || null)}
            className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
          >
            <option value="">{t("ui.slurp.settings.ads.imageConnectionDefault")}</option>
            {imageConnections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.name ?? connection.model ?? connection.id}
              </option>
            ))}
          </select>
        </Field>
        <Field
          settingKey="inlineAdsLorebookId"
          label={t("ui.slurp.settings.ads.lorebook")}
          detail={t("ui.slurp.settings.ads.lorebookDetail")}
        >
          <div className="flex flex-wrap gap-2">
            <select
              value={settings.inlineAdsLorebookId ?? ""}
              disabled={updateSettings.isPending || adLorebooks.isLoading}
              onChange={(event) =>
                void updatePatch({
                  inlineAdsLorebookId: event.target.value || null,
                  // Clearing the fingerprint makes the next sync regenerate against
                  // the newly chosen book instead of treating it as already applied.
                  inlineAdsLorebookRevision: null,
                })
              }
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
            >
              <option value="">{t("ui.slurp.settings.ads.lorebookNone")}</option>
              {(adLorebooks.data?.items ?? []).map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!settings.inlineAdsLorebookId || syncAdLorebook.isPending}
              onClick={() =>
                syncAdLorebook.mutate(true, {
                  onSuccess: (result) => toast.success(t(`ui.slurp.settings.ads.lorebookSync.${result.outcome}`)),
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
              className="min-h-11 rounded-lg border border-[var(--slurp-outline)] px-4 text-sm font-bold hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {syncAdLorebook.isPending
                ? t("ui.slurp.settings.ads.lorebookSyncing")
                : t("ui.slurp.settings.ads.lorebookSyncNow")}
            </button>
          </div>
        </Field>
      </SettingsGroup>
      <SlpBrandsPanel
        actions={
          <>
            <SlpButton
              variant="quiet"
              disabled={generateAds.isPending}
              onClick={() =>
                generateAds.mutate(undefined, {
                  onSuccess: (result) =>
                    toast.success(
                      t("ui.slurp.settings.ads.generated", {
                        count: result.items.length,
                        retired: result.retired.length,
                        images: result.images,
                      }),
                    ),
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
              className="min-h-10 px-4 text-xs"
            >
              {generateAds.isPending ? t("ui.slurp.settings.ads.generating") : t("ui.slurp.settings.ads.generate")}
            </SlpButton>
            <SlpButton
              variant="quiet"
              onClick={() =>
                void api
                  .download("/slurp2/slurp/ads/export", "slurp-ads.json")
                  .catch((error: unknown) => toast.error(errorMessage(error)))
              }
              className="min-h-10 px-4 text-xs"
            >
              {t("ui.slurp.settings.ads.export")}
            </SlpButton>
            <SlpButton
              variant="quiet"
              disabled={importAds.isPending}
              onClick={() => adsImportRef.current?.click()}
              className="min-h-10 px-4 text-xs"
            >
              {importAds.isPending ? t("ui.slurp.settings.ads.importing") : t("ui.slurp.settings.ads.import")}
            </SlpButton>
            <input
              ref={adsImportRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                void file
                  .text()
                  .then((text) => importAds.mutateAsync(JSON.parse(text)))
                  .then((result) => toast.success(t("ui.slurp.settings.ads.imported", { count: result.imported })))
                  .catch((error) => toast.error(errorMessage(error)));
              }}
            />
          </>
        }
      />
      <div>
        <h2 className="text-sm font-bold">{t("ui.slurp.settings.ads.themes")}</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">{t("ui.slurp.settings.ads.themesDetail")}</p>
        <SettingAnchor settingKey="inlineAdsPreferredTags">
          <div className="mt-3 flex flex-wrap gap-2">
            {["coffee", "beauty", "luxury", "nightlife", "fashion"].map((tag) => {
              const selected = settings.inlineAdsPreferredTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={selected}
                  disabled={updateSettings.isPending}
                  onClick={() =>
                    void update(
                      "inlineAdsPreferredTags",
                      selected
                        ? settings.inlineAdsPreferredTags.filter((value) => value !== tag)
                        : [...settings.inlineAdsPreferredTags, tag],
                    )
                  }
                  className={`min-h-10 rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 ${selected ? "bg-[image:var(--slurp-nav-active)] text-[var(--slurp-text)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-surface-raised)] text-[var(--slurp-muted)] ring-[var(--slurp-outline)] hover:text-[var(--slurp-text)]"}`}
                >
                  {t(`ui.slurp.settings.ads.theme.${tag}`)}
                </button>
              );
            })}
          </div>
        </SettingAnchor>
      </div>
      {viewerPersonaId && (adState.data?.hiddenBrands.length ?? 0) > 0 && (
        <div>
          <h2 className="text-sm font-bold">{t("ui.slurp.settings.ads.hiddenBrands")}</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
            {t("ui.slurp.settings.ads.hiddenBrandsDetail")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {adState.data?.hiddenBrands.map((brand) => (
              <button
                key={brand}
                type="button"
                disabled={unhideBrand.isPending}
                onClick={() =>
                  unhideBrand.mutate(
                    { personaId: viewerPersonaId, brand },
                    {
                      onSuccess: () => toast.success(t("ui.slurp.settings.ads.brandUnhidden", { brand })),
                      onError: (error) => toast.error(errorMessage(error)),
                    },
                  )
                }
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--slurp-surface-raised)] px-4 text-sm font-semibold text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)] transition-colors hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50"
              >
                <RotateCcw size={13} aria-hidden="true" />
                {t("ui.slurp.settings.ads.unhideBrand", { brand })}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)]">
        <div>
          <h2 className="text-sm font-bold">{t("ui.slurp.settings.ads.reset")}</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">{t("ui.slurp.settings.ads.resetDetail")}</p>
        </div>
        <button
          type="button"
          disabled={!viewerPersonaId || resetAds.isPending}
          onClick={() =>
            viewerPersonaId &&
            resetAds.mutate(viewerPersonaId, {
              onSuccess: () => toast.success(t("ui.slurp.settings.ads.resetDone")),
              onError: (error) => toast.error(errorMessage(error)),
            })
          }
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--slurp-outline)] px-4 text-sm font-bold text-[var(--slurp-text)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
        >
          <RotateCcw size={15} aria-hidden="true" />
          {t("ui.slurp.settings.ads.resetAction")}
        </button>
      </div>
    </div>
  );
}
