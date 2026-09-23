import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { showConfirmDialog } from "../../../../lib/app-dialogs";

import { Modal } from "../../../../components/ui/Modal";
import { Avatar, getSlpAccentStyle } from "../../../base/chrome/SlpChrome";
import { focusSettingAnchor } from "../../../modules/settings/SlpSettingsKit";
import { profileAccent } from "../SlpStageProfileForm";
import { useCreatorAccounts } from "../slp-creators-hooks";
import { focusRing, quietButton } from "../slp-creator-classes";
import { SLP_CREATOR_SETTINGS_SECTIONS } from "./slp-creator-settings-sections";
import type { SlpCreatorSettingsCreator } from "./slp-creator-settings-contract";
import { useSlpCreatorSettingsStore } from "./slp-creator-settings-store";

/**
 * Everything about one Creator, in one place.
 *
 * Their settings used to be split between a Backstage detail panel, two dialogs on their own
 * profile and a schedule modal, with the automation toggle and the image toggle living in two
 * homes each. This modal is the single home; the surfaces that used to hold those controls open it
 * instead. Sections come from the registry, so a new group of settings is one entry, not a tab
 * added by hand in several files.
 */
export function SlpCreatorSettingsModal({
  onRedraft,
  onViewProfile,
}: {
  onRedraft?: (creator: SlpCreatorSettingsCreator) => void;
  onViewProfile?: (creator: SlpCreatorSettingsCreator) => void;
}) {
  const { t } = useTranslation();
  const creatorId = useSlpCreatorSettingsStore((state) => state.creatorId);
  const tab = useSlpCreatorSettingsStore((state) => state.tab);
  const settingKey = useSlpCreatorSettingsStore((state) => state.settingKey);
  const setTab = useSlpCreatorSettingsStore((state) => state.setTab);
  const clearSettingKey = useSlpCreatorSettingsStore((state) => state.clearSettingKey);
  const close = useSlpCreatorSettingsStore((state) => state.close);
  const accountsQuery = useCreatorAccounts(creatorId !== null);
  const creator = accountsQuery.data?.find((entry) => entry.id === creatorId) ?? null;
  const panelRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);

  const sections = SLP_CREATOR_SETTINGS_SECTIONS.filter(
    (section) => !section.available || !creator || section.available(creator),
  );
  const activeSection = sections.find((section) => section.id === tab) ?? sections[0];

  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const direction =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : event.key === "Home"
            ? -sections.length
            : event.key === "End"
              ? sections.length
              : 0;
    if (!direction || sections.length === 0) return;
    event.preventDefault();
    const nextIndex =
      direction === -sections.length
        ? 0
        : direction === sections.length
          ? sections.length - 1
          : (index + direction + sections.length) % sections.length;
    const next = sections[nextIndex];
    if (!next) return;
    setTab(next.id);
    requestAnimationFrame(() => document.getElementById(`slp-creator-settings-tab-${next.id}`)?.focus());
  };

  // A search result lands on its tab first; once that tab has rendered, bring the setting into view.
  useEffect(() => {
    if (!settingKey || !creator) return;
    const frame = requestAnimationFrame(() => {
      focusSettingAnchor(settingKey);
      clearSettingKey();
    });
    return () => cancelAnimationFrame(frame);
  }, [settingKey, creator, tab, clearSettingKey]);

  // The tab rail scrolls independently of the section, so a long section never strands the tabs.
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  const title = creator
    ? t("ui.slurp.settings.creators.settingsTitle", {
        defaultValue: "{{name}}'s settings",
        name: creator.displayName,
      })
    : t("ui.slurp.settings.creators.settingsTitle", { defaultValue: "Creator settings" });
  const requestClose = async () => {
    if (
      dirtyRef.current &&
      !(await showConfirmDialog({
        title: t("ui.slurp.settings.creators.unsavedTitle", { defaultValue: "Discard unsaved changes?" }),
        message: t("ui.slurp.settings.creators.unsavedDetail", {
          defaultValue: "Your profile changes are not saved.",
        }),
        confirmLabel: t("ui.slurp.settings.creators.discardChanges", { defaultValue: "Discard changes" }),
        cancelLabel: t("ui.slurp.actions.cancel", { defaultValue: "Cancel" }),
      }))
    ) {
      return;
    }
    dirtyRef.current = false;
    close();
  };
  const requestNavigation = async (action: () => void) => {
    if (
      dirtyRef.current &&
      !(await showConfirmDialog({
        title: t("ui.slurp.settings.creators.unsavedTitle", { defaultValue: "Discard unsaved changes?" }),
        message: t("ui.slurp.settings.creators.unsavedDetail", {
          defaultValue: "Your profile changes are not saved.",
        }),
        confirmLabel: t("ui.slurp.settings.creators.discardChanges", { defaultValue: "Discard changes" }),
        cancelLabel: t("ui.slurp.actions.cancel", { defaultValue: "Cancel" }),
      }))
    ) {
      return;
    }
    dirtyRef.current = false;
    close();
    action();
  };

  return (
    <Modal
      open={creatorId !== null}
      onClose={() => void requestClose()}
      title={title}
      width="max-w-4xl"
      mobileFullscreen
      panelClassName="noodle-icon-scope"
      panelStyle={
        creator
          ? getSlpAccentStyle(profileAccent(creator.id), {
              // Custom properties are not in the CSSProperties map, so this shape needs the cast the
              // accent helper itself uses.
              "--background": "var(--slurp-surface)",
              "--foreground": "var(--slurp-text)",
              "--muted-foreground": "var(--slurp-muted)",
            } as CSSProperties)
          : undefined
      }
    >
      {accountsQuery.isError ? (
        <div className="flex min-h-32 flex-col items-center justify-center gap-3 p-5 text-center text-sm text-[var(--slurp-muted)]">
          <p>{t("ui.slurp.settings.creators.loadError", { defaultValue: "Could not load this Creator." })}</p>
          <button type="button" onClick={() => void accountsQuery.refetch()} className={quietButton}>
            <RefreshCw size={14} aria-hidden="true" />
            {t("capabilities.actions.tryAgain", { defaultValue: "Try again" })}
          </button>
        </div>
      ) : !creator ? (
        <div
          className="flex min-h-32 items-center justify-center gap-2 text-sm text-[var(--slurp-muted)]"
          role="status"
        >
          <Loader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {t("ui.slurp.settings.loading", { defaultValue: "Loading…" })}
        </div>
      ) : (
        <div className="flex min-h-0 flex-col gap-4 sm:flex-row">
          <div className="flex min-w-0 shrink-0 flex-col gap-3 sm:w-52">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar account={creator} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{creator.displayName}</p>
                <p className="truncate text-xs text-[var(--slurp-muted)]">@{creator.handle}</p>
              </div>
            </div>
            {onViewProfile && (
              <button
                type="button"
                onClick={() => {
                  void requestNavigation(() => onViewProfile(creator));
                }}
                className={quietButton}
              >
                {t("ui.slurp.settings.creators.viewProfile")}
              </button>
            )}
            {/* Horizontal and scrollable on a phone, a vertical rail once there is room for one. */}
            <div
              role="tablist"
              aria-label={t("ui.slurp.settings.creators.tabsLabel", { defaultValue: "Creator settings" })}
              className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-col sm:overflow-visible sm:px-0"
            >
              {sections.map((section, index) => {
                const Icon = section.icon;
                const selected = section.id === activeSection?.id;
                return (
                  <button
                    key={section.id}
                    id={`slp-creator-settings-tab-${section.id}`}
                    type="button"
                    role="tab"
                    tabIndex={selected ? 0 : -1}
                    aria-selected={selected}
                    aria-controls="slp-creator-settings-panel"
                    onKeyDown={(event) => moveTab(event, index)}
                    onClick={() => setTab(section.id)}
                    className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors motion-reduce:transition-none ${focusRing} ${
                      selected
                        ? "bg-[var(--noodle-accent)]/15 text-[var(--slurp-text)]"
                        : "text-[var(--slurp-muted)] hover:bg-[var(--slurp-canvas)] hover:text-[var(--slurp-text)]"
                    }`}
                  >
                    <Icon
                      size={15}
                      aria-hidden="true"
                      className={selected ? "text-[var(--noodle-accent)]" : undefined}
                    />
                    <span className="truncate">{t(section.labelKey, { defaultValue: section.defaultLabel })}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div
            ref={panelRef}
            id="slp-creator-settings-panel"
            role="tabpanel"
            aria-labelledby={`slp-creator-settings-tab-${activeSection?.id}`}
            tabIndex={-1}
            className="min-w-0 flex-1 sm:max-h-[65vh] sm:overflow-y-auto sm:border-s sm:border-[var(--slurp-outline)] sm:ps-4"
          >
            {sections.map((section) => {
              if (section.id !== "identity" && section.id !== activeSection?.id) return null;
              const SectionComponent = section.Component;
              return (
                <div key={`${creator.id}:${section.id}`} hidden={section.id !== activeSection?.id}>
                  <SectionComponent
                    key={`${creator.id}:${section.id}`}
                    creator={creator}
                    active={section.id === activeSection?.id}
                    onClose={requestClose}
                    onDirtyChange={section.id === "identity" ? (dirty) => (dirtyRef.current = dirty) : undefined}
                    onRedraft={
                      onRedraft
                        ? (entry) => {
                            void requestNavigation(() => onRedraft(entry));
                          }
                        : undefined
                    }
                    onViewProfile={onViewProfile}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
