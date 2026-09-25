import { AlertTriangle, CheckCircle2, ChevronLeft, Loader2, RefreshCw } from "lucide-react";

import { useEffect } from "react";
import { toast } from "sonner";

import { showConfirmDialog } from "../../../lib/app-dialogs";

import {
  changedSlurpSettingKeys,
  isSlurpResettableSection,
  slurpSettingsResetPatch,
} from "../../features/settings/slp-settings-defaults";

import { slurpAudiencePresetFor } from "../../../../../shared/src/slp/slp-tuning.js";
import {
  SLP_BACKSTAGE_SECTION_LABELS,
  SLP_BACKSTAGE_TARGET_LABELS,
  SLP_BACKSTAGE_TARGETS_BY_SECTION,
} from "../../base/navigation/slp-backstage-target";
import { SlurpBackstageApplyBar, useSlurpBackstageDraftGuard } from "../../features/backstage/SlpBackstageControls";
import { SlurpBackstageSearch, SlurpBackstageSubnav } from "../../features/backstage/SlpBackstageNavigation";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { focusSettingAnchor } from "../../modules/settings/SlpSettingsKit";
import { SLP_CREATOR_SETTING_TAB } from "../../features/creators/settings/slp-creator-settings-contract";

import { useSlpBackstageController } from "./slp-backstage-controller";
import { slpBackstagePanelFor } from "./slp-backstage-registry";
import {
  type SlpBackstagePageProps,
  type SlpBackstageShellProps,
} from "../../features/backstage/slp-backstage-contract";
import { SlpBackstageHome } from "../../features/backstage/SlpBackstageSidebar";
import { SlpCreatorRefreshModal } from "../../features/creators/SlpCreatorRefreshModal";
import { SlpPromptEditors } from "../../features/settings/SlpPromptEditors";

/**
 * The Backstage host. It owns the frame, the area header, search, the staged-change bar and the
 * deep link that brings a searched setting into view. It renders exactly one panel, looked up in
 * the registry by target, and knows nothing about what any panel contains.
 */
export function SlpBackstageShell({
  navigation,
  onNavigate,
  onAddCreators,
  personaSourceIds,
  onRestartOnboarding,
  viewerPersonaId,
}: SlpBackstageShellProps) {
  const controller = useSlpBackstageController({
    navigation,
    onNavigate,
    onAddCreators,
    personaSourceIds,
    onRestartOnboarding,
    viewerPersonaId,
  });
  const {
    t,
    section,
    target,
    settings,
    settingsQuery,
    settingsDefaultsQuery,
    updateSettings,
    draftPatch,
    setDraftPatch,
    saveState,
    save,
    promptDraftCount,
    discardPromptDraft,
    applyPromptDraft,
  } = controller;
  const stagedChangeCount = Object.keys(draftPatch).length + promptDraftCount;
  useSlurpBackstageDraftGuard(stagedChangeCount);
  const settingKey = navigation.settingKey;
  const settingsReady = Boolean(settings);
  // A search result lands on its page first; once that page renders, bring the setting into view.
  useEffect(() => {
    if (!settingKey || !settingsReady) return;
    // A setting that lives in the Creator settings modal is not on this page at all. The Creators
    // page opens the modal for it and clears the key, so this must not clear it first.
    if (settingKey in SLP_CREATOR_SETTING_TAB) return;
    const frame = requestAnimationFrame(() => {
      focusSettingAnchor(settingKey);
      onNavigate({ ...navigation, settingKey: undefined });
    });
    return () => cancelAnimationFrame(frame);
    // Runs once per search selection; `navigation` changes identity with every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingKey, section, target, settingsReady]);

  useEffect(() => {
    if (!navigation.openRefresh || !settingsReady) return;
    controller.openRefresh();
    onNavigate({ ...navigation, openRefresh: undefined });
  }, [navigation.openRefresh, settingsReady]);

  if (settingsQuery.isError)
    return (
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-sm text-[var(--muted-foreground)]">
        <p>{t("ui.slurp.settings.loadError")}</p>
        <button
          type="button"
          onClick={() => void settingsQuery.refetch()}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--noodle-accent)]/40 px-3 font-semibold text-[var(--noodle-accent)]"
        >
          <RefreshCw size={14} />
          {t("capabilities.actions.tryAgain")}
        </button>
      </main>
    );
  if (settingsQuery.isLoading || !settings)
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center gap-2 p-6 text-sm text-[var(--muted-foreground)]">
        <Loader2 size={18} className="animate-spin" />
        {t("ui.slurp.studio.loading")}
      </main>
    );

  // Without the side menu (Slurp narrower than 1024 px, the same container query the shell uses),
  // no section chosen yet shows the settings home list. With the menu, it shows Overview.
  const home = navigation.section === undefined;
  const multiPage = SLP_BACKSTAGE_TARGETS_BY_SECTION[section].length > 1;
  const sectionLabel = t(`ui.slurp.settings.backstage.sections.${section}`, {
    defaultValue: SLP_BACKSTAGE_SECTION_LABELS[section],
  });
  const page: SlpBackstagePageProps = { ...controller, settings, audiencePreset: slurpAudiencePresetFor(settings) };
  // One lookup, one panel. An unknown target keeps the frame and shows nothing inside it, which is
  // what the six self-gating page components did before the registry replaced them.
  const panel = slpBackstagePanelFor(target);
  const Panel = panel?.Component;

  return (
    <>
      <main className="min-h-0 flex-1 overflow-y-auto bg-[var(--slurp-canvas)] pb-[calc(5rem+env(safe-area-inset-bottom))] text-[var(--slurp-text)] sm:pb-8">
        <div className="mx-auto flex w-full flex-col gap-4 p-3 sm:p-5 lg:gap-6 lg:p-6" data-slurp-settings-layout>
          {/* The header answers three questions and nothing else: which page am I on, where do I
              find a setting, and is my change saved. No card around it: the page title is the
              loudest thing, the save state and search are quiet. */}
          {home && (
            <SlpBackstageHome
              className="@min-[1024px]:hidden"
              navigation={navigation}
              onNavigate={onNavigate}
              search={
                <SlurpBackstageSearch
                  onSelect={(nextSection, nextTarget, settingKey) =>
                    onNavigate({ ...navigation, section: nextSection, target: nextTarget, settingKey })
                  }
                  className="max-w-none"
                />
              }
            />
          )}
          <header className={`relative z-30 flex flex-col gap-3 px-1 pt-1 ${home ? "@max-[1024px]:hidden" : ""}`}>
            <button
              type="button"
              onClick={() => onNavigate({ ...navigation, section: undefined, target: undefined })}
              className="-ms-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[var(--noodle-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] @min-[1024px]:hidden"
            >
              <ChevronLeft size={18} className="rtl:rotate-180" aria-hidden="true" />
              {t("ui.slurp.settings.title")}
            </button>
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                {multiPage && <p className="text-xs font-semibold text-[var(--slurp-muted)]">{sectionLabel}</p>}
                <h1 className="truncate text-2xl font-black tracking-tight sm:text-3xl">
                  {multiPage ? SLP_BACKSTAGE_TARGET_LABELS[target] : sectionLabel}
                </h1>
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                <p
                  className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold ${saveState === "error" ? "text-red-300" : saveState === "saved" ? "text-[var(--slurp-success)]" : "text-[var(--slurp-muted)]"}`}
                  role="status"
                  aria-live="polite"
                >
                  {saveState === "saving" ? (
                    <Loader2 size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : saveState === "error" ? (
                    <AlertTriangle size={13} aria-hidden="true" />
                  ) : saveState === "saved" ? (
                    <CheckCircle2 size={13} aria-hidden="true" />
                  ) : null}
                  {saveState === "saving"
                    ? t("ui.slurp.settings.saveState.saving")
                    : saveState === "error"
                      ? t("ui.slurp.settings.saveState.error")
                      : saveState === "saved"
                        ? t("ui.slurp.settings.saveState.saved")
                        : t("ui.slurp.settings.autoSave")}
                </p>
                <SlurpBackstageSearch
                  onSelect={(nextSection, nextTarget, settingKey) =>
                    onNavigate({ ...navigation, section: nextSection, target: nextTarget, settingKey })
                  }
                  className="max-w-xs max-md:hidden"
                />
              </div>
            </div>
            <SlurpBackstageSubnav
              section={section}
              target={target}
              onSelect={(nextTarget) => onNavigate({ ...navigation, target: nextTarget })}
            />
          </header>
          <div className={home ? "@max-[1024px]:hidden" : undefined}>
            <div className="mt-4 min-w-0 rounded-xl rounded-t-none bg-[linear-gradient(145deg,var(--slurp-surface),color-mix(in_srgb,var(--slurp-violet)_4%,var(--slurp-surface)))] p-3 shadow-[var(--slurp-shadow)] ring-1 ring-inset ring-[var(--slurp-outline)] md:mt-0 md:rounded-t-xl md:p-5 lg:p-6">
              <div className="min-w-0">
                <div className="min-w-0" data-backstage-target={target}>
                  {Panel ? <Panel {...page} /> : null}
                  {settings &&
                    settingsDefaultsQuery.data &&
                    isSlurpResettableSection(target) &&
                    (() => {
                      const defaults = settingsDefaultsQuery.data;
                      const changed = changedSlurpSettingKeys(settings, defaults, target);
                      if (changed.length === 0) return null;
                      return (
                        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--slurp-outline)] pt-4">
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {t("ui.slurp.settings.reset.changed", { count: changed.length })}
                          </p>
                          <button
                            type="button"
                            disabled={updateSettings.isPending}
                            onClick={() =>
                              void showConfirmDialog({
                                title: t("ui.slurp.settings.reset.confirmTitle"),
                                message: t("ui.slurp.settings.reset.confirmDetail"),
                                confirmLabel: t("ui.slurp.settings.reset.button"),
                              })
                                .then((confirmed) => {
                                  if (confirmed) void save(slurpSettingsResetPatch(settings, defaults, target));
                                })
                                .catch((error) => toast.error(errorMessage(error)))
                            }
                            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
                          >
                            <RefreshCw size={14} />
                            {t("ui.slurp.settings.reset.button")}
                          </button>
                        </div>
                      );
                    })()}
                  <SlurpBackstageApplyBar
                    count={stagedChangeCount}
                    pending={updateSettings.isPending}
                    onDiscard={() => {
                      setDraftPatch({});
                      discardPromptDraft();
                    }}
                    onApply={() => {
                      void (async () => {
                        const settingsSaved = Object.keys(draftPatch).length === 0 ? true : await save(draftPatch);
                        if (!settingsSaved) return;
                        const promptsSaved = await applyPromptDraft();
                        if (promptsSaved) setDraftPatch({});
                      })();
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SlpCreatorRefreshModal {...page} />
      <SlpPromptEditors {...page} />
    </>
  );
}
