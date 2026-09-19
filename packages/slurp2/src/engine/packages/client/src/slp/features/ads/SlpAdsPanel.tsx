import { Image, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { BackstagePageHeader } from "../../modules/settings/SlpSettingsKit";

import { Field, SettingsGroup, Toggle } from "../../modules/settings/SlpSettingsControls";

import { api } from "../../../lib/api-client";
import { toast } from "sonner";
import { SettingAnchor } from "../../modules/settings/SlpSettingsKit";
import type { SlurpContentRating } from "../../base/state/slp-state-types";

import type { SlurpSettings } from "../settings/slp-settings-contract";
import { SlurpMediaImg } from "../../../components/slurp/SlurpShell";

import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { errorMessage } from "../../../components/slurp/SlurpBackstageWorkflow";

/** Ads: the inline ad settings, the ad pool and the ad editors. */
export function SlpAdsPanel(page: SlpBackstagePageProps) {
  const {
    viewerPersonaId,
    t,
    updateSettings,
    resetAds,
    adPool,
    generateAds,
    importAds,
    createAd,
    customAdOpen,
    setCustomAdOpen,
    customAd,
    setCustomAd,
    adsImportRef,
    adState,
    unhideBrand,
    deleteAd,
    updateAd,
    editingAd,
    setEditingAd,
    generateAdImage,
    adLorebooks,
    syncAdLorebook,
    imageConnections,
    settings,
    adsWorldDraft,
    setAdsWorldDraft,
    update,
    updatePatch,
    connectionsQuery,
  } = page;

  return (
    <div className="space-y-5">
      <BackstagePageHeader title={t("ui.slurp.settings.ads.title")} detail={t("ui.slurp.settings.ads.detail")} />
      <div className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 text-xs leading-5 text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]">
        <p>{t("ui.slurp.settings.ads.explainer")}</p>
        <p className="mt-2">{t("ui.slurp.settings.ads.explainerPool")}</p>
        {settings.walletEnabled && settings.walletAdReward > 0 && (
          <p className="mt-2">
            {t("ui.slurp.settings.ads.explainerEarning", {
              defaultValue:
                "Acting on an ad pays {{reward}} SlurpCoins, up to {{cap}} a day. Change either in SlurpCoins.",
              reward: settings.walletAdReward,
              cap: settings.walletAdDailyCap,
            })}
          </p>
        )}
      </div>
      <SettingsGroup title={t("ui.slurp.settings.ads.feedGroup", { defaultValue: "In your feed" })}>
        <Toggle
          settingKey="inlineAdsEnabled"
          label={t("ui.slurp.settings.inlinePromotions")}
          detail={t("ui.slurp.settings.inlinePromotionsDetail")}
          value={settings.inlineAdsEnabled}
          onChange={(value) => update("inlineAdsEnabled", value)}
        />
        <Field
          settingKey="inlineAdsFrequency"
          label={t("ui.slurp.settings.ads.frequency")}
          detail={t("ui.slurp.settings.ads.frequencyDetail")}
        >
          <select
            value={settings.inlineAdsFrequency}
            disabled={updateSettings.isPending}
            onChange={(event) =>
              void update("inlineAdsFrequency", event.target.value as SlurpSettings["inlineAdsFrequency"])
            }
            className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
          >
            <option value="light">{t("ui.slurp.settings.ads.frequencyLight")}</option>
            <option value="standard">{t("ui.slurp.settings.ads.frequencyStandard")}</option>
            <option value="frequent">{t("ui.slurp.settings.ads.frequencyFrequent")}</option>
          </select>
        </Field>
        <Field
          settingKey="inlineAdsSteering"
          label={t("ui.slurp.settings.ads.steering")}
          detail={t("ui.slurp.settings.ads.steeringDetail")}
        >
          <select
            value={settings.inlineAdsSteering}
            disabled={updateSettings.isPending}
            onChange={(event) =>
              void update("inlineAdsSteering", event.target.value as SlurpSettings["inlineAdsSteering"])
            }
            className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
          >
            <option value="personalized">{t("ui.slurp.settings.ads.steeringPersonalized")}</option>
            <option value="balanced">{t("ui.slurp.settings.ads.steeringBalanced")}</option>
            <option value="random">{t("ui.slurp.settings.ads.steeringRandom")}</option>
          </select>
        </Field>
        <Field
          settingKey="inlineAdsContentCeiling"
          label={t("ui.slurp.settings.ads.ceiling")}
          detail={t("ui.slurp.settings.ads.ceilingDetail")}
        >
          <select
            value={settings.inlineAdsContentCeiling}
            disabled={updateSettings.isPending}
            onChange={(event) =>
              void update("inlineAdsContentCeiling", event.target.value as SlurpSettings["inlineAdsContentCeiling"])
            }
            className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
          >
            <option value="tame">{t("ui.slurp.settings.ads.ceilingTame")}</option>
            <option value="suggestive">{t("ui.slurp.settings.ads.ceilingSuggestive")}</option>
            <option value="explicit">{t("ui.slurp.settings.ads.ceilingExplicit")}</option>
          </select>
        </Field>
      </SettingsGroup>
      <SettingsGroup title={t("ui.slurp.settings.ads.voiceGroup", { defaultValue: "How ads read" })}>
        <Field
          settingKey="inlineAdsTone"
          label={t("ui.slurp.settings.ads.tone")}
          detail={t("ui.slurp.settings.ads.toneDetail")}
        >
          <select
            value={settings.inlineAdsTone}
            disabled={updateSettings.isPending}
            onChange={(event) => void update("inlineAdsTone", event.target.value as SlurpSettings["inlineAdsTone"])}
            className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
          >
            <option value="corporate">{t("ui.slurp.settings.ads.toneCorporate")}</option>
            <option value="scammy">{t("ui.slurp.settings.ads.toneScammy")}</option>
            <option value="local">{t("ui.slurp.settings.ads.toneLocal")}</option>
            <option value="luxury">{t("ui.slurp.settings.ads.toneLuxury")}</option>
            <option value="unhinged">{t("ui.slurp.settings.ads.toneUnhinged")}</option>
          </select>
        </Field>
        <Field
          settingKey="inlineAdsEra"
          label={t("ui.slurp.settings.ads.era")}
          detail={t("ui.slurp.settings.ads.eraDetail")}
        >
          <select
            value={settings.inlineAdsEra}
            disabled={updateSettings.isPending}
            onChange={(event) => void update("inlineAdsEra", event.target.value as SlurpSettings["inlineAdsEra"])}
            className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
          >
            <option value="present">{t("ui.slurp.settings.ads.eraPresent")}</option>
            <option value="nineties">{t("ui.slurp.settings.ads.eraNineties")}</option>
            <option value="cyberpunk">{t("ui.slurp.settings.ads.eraCyberpunk")}</option>
            <option value="retrofuture">{t("ui.slurp.settings.ads.eraRetrofuture")}</option>
          </select>
        </Field>
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
      <div className="rounded-xl border border-[var(--slurp-outline)] p-4">
        <h2 className="text-sm font-bold">{t("ui.slurp.settings.ads.pool")}</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
          {t("ui.slurp.settings.ads.poolDetail", { count: adPool.data?.items.length ?? 0 })}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
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
            className="min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:opacity-50"
          >
            {generateAds.isPending ? t("ui.slurp.settings.ads.generating") : t("ui.slurp.settings.ads.generate")}
          </button>
          <button
            type="button"
            onClick={() =>
              void api
                .download("/slurp2/noodler/ads/export", "slurp-ads.json")
                .catch((error: unknown) => toast.error(errorMessage(error)))
            }
            className="min-h-9 rounded-lg border border-[var(--slurp-outline)] px-3 text-xs font-bold hover:bg-[var(--accent)]"
          >
            {t("ui.slurp.settings.ads.export")}
          </button>
          <button
            type="button"
            disabled={importAds.isPending}
            onClick={() => adsImportRef.current?.click()}
            className="min-h-9 rounded-lg border border-[var(--slurp-outline)] px-3 text-xs font-bold hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {importAds.isPending ? t("ui.slurp.settings.ads.importing") : t("ui.slurp.settings.ads.import")}
          </button>
          <button
            type="button"
            onClick={() => setCustomAdOpen((open) => !open)}
            aria-expanded={customAdOpen}
            className="flex min-h-9 items-center gap-1 rounded-lg border border-[var(--slurp-outline)] px-3 text-xs font-bold hover:bg-[var(--accent)]"
          >
            <Plus size={13} aria-hidden="true" />
            {t("ui.slurp.settings.ads.createOwn")}
          </button>
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
        </div>
        {customAdOpen && (
          <form
            className="mt-3 space-y-2 rounded-lg border border-[var(--slurp-outline)] p-3"
            onSubmit={(event) => {
              event.preventDefault();
              createAd.mutate(customAd, {
                onSuccess: () => {
                  toast.success(t("ui.slurp.settings.ads.created", { brand: customAd.brand }));
                  setCustomAd({ brand: "", product: "", copy: "", contentRating: "tame" });
                  setCustomAdOpen(false);
                },
                onError: (error) => toast.error(errorMessage(error)),
              });
            }}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                required
                maxLength={80}
                value={customAd.brand}
                onChange={(event) => setCustomAd((prev) => ({ ...prev, brand: event.target.value }))}
                placeholder={t("ui.slurp.settings.ads.createBrandPlaceholder")}
                aria-label={t("ui.slurp.settings.ads.createBrandPlaceholder")}
                className="min-h-9 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
              />
              <input
                required
                maxLength={120}
                value={customAd.product}
                onChange={(event) => setCustomAd((prev) => ({ ...prev, product: event.target.value }))}
                placeholder={t("ui.slurp.settings.ads.createProductPlaceholder")}
                aria-label={t("ui.slurp.settings.ads.createProductPlaceholder")}
                className="min-h-9 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
              />
            </div>
            <textarea
              required
              maxLength={600}
              rows={2}
              value={customAd.copy}
              onChange={(event) => setCustomAd((prev) => ({ ...prev, copy: event.target.value }))}
              placeholder={t("ui.slurp.settings.ads.createCopyPlaceholder")}
              aria-label={t("ui.slurp.settings.ads.createCopyPlaceholder")}
              className="w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={customAd.contentRating}
                onChange={(event) =>
                  setCustomAd((prev) => ({
                    ...prev,
                    contentRating: event.target.value as SlurpContentRating,
                  }))
                }
                aria-label={t("ui.slurp.settings.ads.ceiling")}
                className="min-h-9 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
              >
                <option value="tame">{t("ui.slurp.settings.ads.ceilingTame")}</option>
                <option value="suggestive">{t("ui.slurp.settings.ads.ceilingSuggestive")}</option>
                <option value="explicit">{t("ui.slurp.settings.ads.ceilingExplicit")}</option>
              </select>
              <button
                type="submit"
                disabled={createAd.isPending}
                className="min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:opacity-50"
              >
                {createAd.isPending ? t("ui.slurp.settings.ads.creating") : t("ui.slurp.settings.ads.createSubmit")}
              </button>
            </div>
          </form>
        )}
        {/* The pool used to be a bare count, so a bad generated ad could only be
                        removed by resetting everything. */}
        <ul className="mt-4 space-y-2">
          {(adPool.data?.items ?? []).map((ad) => {
            const builtin = ad.origin === "builtin";
            return (
              <li
                key={ad.id}
                className="flex items-start gap-3 rounded-lg bg-[var(--slurp-surface-raised)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]"
              >
                {ad.imageUrl ? (
                  <SlurpMediaImg
                    src={ad.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-14 w-20 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-[var(--slurp-canvas)] text-[var(--slurp-muted)]"
                  >
                    <Image size={16} />
                  </span>
                )}
                {editingAd?.id === ad.id ? (
                  <form
                    className="min-w-0 flex-1 space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      updateAd.mutate(editingAd, {
                        onSuccess: () => {
                          toast.success(t("ui.slurp.settings.ads.edited", { brand: editingAd.brand }));
                          setEditingAd(null);
                        },
                        onError: (error) => toast.error(errorMessage(error)),
                      });
                    }}
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        required
                        maxLength={80}
                        value={editingAd.brand}
                        onChange={(event) => setEditingAd({ ...editingAd, brand: event.target.value })}
                        placeholder={t("ui.slurp.settings.ads.createBrandPlaceholder")}
                        aria-label={t("ui.slurp.settings.ads.createBrandPlaceholder")}
                        className="min-h-9 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                      />
                      <input
                        required
                        maxLength={120}
                        value={editingAd.product}
                        onChange={(event) => setEditingAd({ ...editingAd, product: event.target.value })}
                        placeholder={t("ui.slurp.settings.ads.createProductPlaceholder")}
                        aria-label={t("ui.slurp.settings.ads.createProductPlaceholder")}
                        className="min-h-9 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                      />
                    </div>
                    <textarea
                      required
                      maxLength={600}
                      rows={2}
                      value={editingAd.copy}
                      onChange={(event) => setEditingAd({ ...editingAd, copy: event.target.value })}
                      placeholder={t("ui.slurp.settings.ads.createCopyPlaceholder")}
                      aria-label={t("ui.slurp.settings.ads.createCopyPlaceholder")}
                      className="w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={editingAd.contentRating}
                        onChange={(event) =>
                          setEditingAd({
                            ...editingAd,
                            contentRating: event.target.value as SlurpContentRating,
                          })
                        }
                        aria-label={t("ui.slurp.settings.ads.ceiling")}
                        className="min-h-9 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                      >
                        <option value="tame">{t("ui.slurp.settings.ads.ceilingTame")}</option>
                        <option value="suggestive">{t("ui.slurp.settings.ads.ceilingSuggestive")}</option>
                        <option value="explicit">{t("ui.slurp.settings.ads.ceilingExplicit")}</option>
                      </select>
                      <button
                        type="submit"
                        disabled={updateAd.isPending}
                        className="min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:opacity-50"
                      >
                        {t("ui.slurp.settings.ads.editSubmit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingAd(null)}
                        className="min-h-9 rounded-lg px-3 text-xs font-bold text-[var(--slurp-muted)] hover:bg-[var(--accent)]"
                      >
                        {t("ui.slurp.settings.ads.editCancel")}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{ad.brand}</p>
                    <p className="truncate text-xs font-semibold text-[var(--slurp-muted)]">{ad.product}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--slurp-muted)]">{ad.copy}</p>
                    <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--slurp-muted)]">
                      {t(
                        `ui.slurp.settings.ads.ceiling${ad.contentRating === "suggestive" ? "Suggestive" : ad.contentRating === "explicit" ? "Explicit" : "Tame"}`,
                      )}
                      {ad.retiredAt ? ` · ${t("ui.slurp.settings.ads.retired")}` : ""}
                    </p>
                  </div>
                )}
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingAd({
                        id: ad.id,
                        brand: ad.brand,
                        product: ad.product,
                        copy: ad.copy,
                        contentRating: ad.contentRating ?? "tame",
                      })
                    }
                    aria-label={t("ui.slurp.settings.ads.editAd", { brand: ad.brand })}
                    title={t("ui.slurp.settings.ads.editAd", { brand: ad.brand })}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--slurp-muted)] hover:bg-[var(--accent)] hover:text-[var(--slurp-text)]"
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={generateAdImage.isPending}
                    onClick={() =>
                      generateAdImage.mutate(ad.id, {
                        onSuccess: () => toast.success(t("ui.slurp.settings.ads.imageGenerated")),
                        onError: (error) => toast.error(errorMessage(error)),
                      })
                    }
                    aria-label={t("ui.slurp.settings.ads.regenerateImage", { brand: ad.brand })}
                    title={t("ui.slurp.settings.ads.regenerateImage", { brand: ad.brand })}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--slurp-muted)] hover:bg-[var(--accent)] hover:text-[var(--slurp-text)] disabled:opacity-50"
                  >
                    <Image size={15} aria-hidden="true" />
                  </button>
                  {ad.retiredAt ? (
                    <button
                      type="button"
                      disabled={updateAd.isPending}
                      onClick={() =>
                        updateAd.mutate(
                          { id: ad.id, retiredAt: null },
                          {
                            onSuccess: () => toast.success(t("ui.slurp.settings.ads.restored", { brand: ad.brand })),
                            onError: (error) => toast.error(errorMessage(error)),
                          },
                        )
                      }
                      aria-label={t("ui.slurp.settings.ads.restoreAd", { brand: ad.brand })}
                      title={t("ui.slurp.settings.ads.restoreAd", { brand: ad.brand })}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--slurp-muted)] hover:bg-[var(--accent)] hover:text-[var(--slurp-text)] disabled:opacity-50"
                    >
                      <RotateCcw size={15} aria-hidden="true" />
                    </button>
                  ) : null}
                  {!(builtin && ad.retiredAt) && (
                    <button
                      type="button"
                      disabled={deleteAd.isPending}
                      onClick={() =>
                        deleteAd.mutate(ad.id, {
                          onSuccess: () =>
                            toast.success(
                              t(`ui.slurp.settings.ads.${builtin ? "hiddenBuiltin" : "deleted"}`, {
                                brand: ad.brand,
                              }),
                            ),
                          onError: (error) => toast.error(errorMessage(error)),
                        })
                      }
                      aria-label={t(`ui.slurp.settings.ads.${builtin ? "hideAd" : "deleteAd"}`, {
                        brand: ad.brand,
                      })}
                      title={t(`ui.slurp.settings.ads.${builtin ? "hideAd" : "deleteAd"}`, {
                        brand: ad.brand,
                      })}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--slurp-muted)] hover:bg-[var(--accent)] hover:text-red-300 disabled:opacity-50"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {(adPool.data?.items.length ?? 0) === 0 && (
          <p className="mt-4 text-xs leading-5 text-[var(--slurp-muted)]">{t("ui.slurp.settings.ads.poolEmpty")}</p>
        )}
      </div>
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
                  className={`min-h-10 rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 ${selected ? "bg-[var(--slurp-nav-active)] text-[var(--slurp-text)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-surface-raised)] text-[var(--slurp-muted)] ring-[var(--slurp-outline)] hover:text-[var(--slurp-text)]"}`}
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
