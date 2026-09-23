import { Check, ChevronDown, Loader2, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
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
  const [profileDirty, setProfileDirty] = useState(false);
  const [profileSaveState, setProfileSaveState] = useState<{
    isPending: boolean;
    dirty: boolean;
    save: () => void;
    discard: () => void;
  } | null>(null);
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false);
  const sectionPickerRef = useRef<HTMLDivElement>(null);
  const sectionPickerTriggerRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (tab !== "identity") setProfileSaveState(null);
  }, [tab]);

  useEffect(() => {
    if (!sectionPickerOpen) return;
    sectionPickerRef.current?.querySelector<HTMLButtonElement>("[aria-current='page']")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSectionPickerOpen(false);
        sectionPickerTriggerRef.current?.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const items = Array.from(
        sectionPickerRef.current?.querySelectorAll<HTMLButtonElement>("button[data-section]") ?? [],
      );
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      if (index < 0 || items.length === 0) return;
      event.preventDefault();
      items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sectionPickerOpen]);

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
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden sm:flex-row">
          <div className="flex min-w-0 shrink-0 flex-col gap-3 sm:w-52 sm:overflow-y-auto sm:overscroll-contain">
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
            <button
              ref={sectionPickerTriggerRef}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={sectionPickerOpen}
              onClick={() => setSectionPickerOpen(true)}
              className={`inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-lg bg-[var(--slurp-surface-raised)] px-3 text-start text-sm font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] sm:hidden ${focusRing}`}
            >
              <span>
                {t(activeSection?.labelKey ?? "ui.slurp.settings.creators.tabs.overview", {
                  defaultValue: activeSection?.defaultLabel ?? "Overview",
                })}
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            <div
              role="tablist"
              aria-label={t("ui.slurp.settings.creators.tabsLabel", { defaultValue: "Creator settings" })}
              className="hidden gap-1 sm:flex sm:flex-col"
            >
              {sections.map((section, index) => {
                const Icon = section.icon;
                const selected = section.id === activeSection?.id;
                const previous = sections[index - 1];
                return (
                  <div key={section.id} className={previous?.group === section.group ? undefined : "pt-2 first:pt-0"}>
                    {previous?.group !== section.group && (
                      <p className="px-3 pb-1 text-[0.65rem] font-bold uppercase text-[var(--slurp-muted)]">
                        {t(`ui.slurp.settings.creators.groups.${section.group}`, {
                          defaultValue: {
                            creator: "Creator",
                            publishing: "Publishing",
                            interaction: "Interaction",
                            memory: "Memory",
                            tools: "Tools",
                            danger: "Danger zone",
                          }[section.group],
                        })}
                      </p>
                    )}
                    <button
                      id={`slp-creator-settings-tab-${section.id}`}
                      type="button"
                      role="tab"
                      tabIndex={selected ? 0 : -1}
                      aria-selected={selected}
                      aria-controls="slp-creator-settings-panel"
                      onKeyDown={(event) => moveTab(event, index)}
                      onClick={() => setTab(section.id)}
                      className={`inline-flex min-h-11 w-full shrink-0 items-center gap-2 rounded-lg px-3 text-start text-sm font-semibold transition-colors motion-reduce:transition-none ${focusRing} ${
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
                  </div>
                );
              })}
            </div>
          </div>
          {sectionPickerOpen && (
            <div className="fixed inset-0 z-[10001] bg-black/55 sm:hidden" onClick={() => setSectionPickerOpen(false)}>
              <div
                ref={sectionPickerRef}
                role="dialog"
                aria-modal="true"
                aria-label={t("ui.slurp.settings.creators.sectionsTitle", { defaultValue: "Creator sections" })}
                className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-xl bg-[var(--slurp-surface)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="sticky top-0 z-10 flex items-center justify-between bg-[var(--slurp-surface)] py-2">
                  <div>
                    <p className="text-sm font-bold">
                      {t("ui.slurp.settings.creators.sectionsTitle", { defaultValue: "Creator sections" })}
                    </p>
                    <p className="text-xs text-[var(--slurp-muted)]">{creator.displayName}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={t("capabilities.actions.close", { defaultValue: "Close" })}
                    onClick={() => {
                      setSectionPickerOpen(false);
                      sectionPickerTriggerRef.current?.focus();
                    }}
                    className={`grid size-11 place-items-center rounded-lg ${focusRing}`}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                {sections.map((section, index) => {
                  const previous = sections[index - 1];
                  const selected = section.id === activeSection?.id;
                  const Icon = section.icon;
                  return (
                    <div key={section.id} className={previous?.group === section.group ? undefined : "pt-4"}>
                      {previous?.group !== section.group && (
                        <p className="px-2 pb-1 text-xs font-bold uppercase text-[var(--slurp-muted)]">
                          {t(`ui.slurp.settings.creators.groups.${section.group}`, {
                            defaultValue: {
                              creator: "Creator",
                              publishing: "Publishing",
                              interaction: "Interaction",
                              memory: "Memory",
                              tools: "Tools",
                              danger: "Danger zone",
                            }[section.group],
                          })}
                        </p>
                      )}
                      <button
                        type="button"
                        data-section
                        aria-current={selected ? "page" : undefined}
                        onClick={() => {
                          setTab(section.id);
                          setSectionPickerOpen(false);
                          sectionPickerTriggerRef.current?.focus();
                        }}
                        className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-start text-sm font-semibold ${focusRing} ${selected ? "bg-[var(--noodle-accent)]/15 text-[var(--slurp-text)]" : "text-[var(--slurp-muted)] hover:bg-[var(--slurp-canvas)] hover:text-[var(--slurp-text)]"}`}
                      >
                        <Icon size={17} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          {t(section.labelKey, { defaultValue: section.defaultLabel })}
                        </span>
                        {selected && (
                          <span className="text-xs text-[var(--noodle-accent)]">
                            {t("ui.slurp.settings.creators.currentSection", { defaultValue: "Current" })}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div
            ref={panelRef}
            id="slp-creator-settings-panel"
            role="tabpanel"
            aria-labelledby={`slp-creator-settings-tab-${activeSection?.id}`}
            tabIndex={-1}
            className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain sm:border-s sm:border-[var(--slurp-outline)] sm:ps-4"
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
                    onDirtyChange={
                      section.id === "identity"
                        ? (dirty) => {
                            dirtyRef.current = dirty;
                            setProfileDirty(dirty);
                          }
                        : undefined
                    }
                    onSaveStateChange={
                      section.id === "identity"
                        ? (state) => {
                            setProfileSaveState(state);
                            dirtyRef.current = state.dirty;
                            setProfileDirty(state.dirty);
                          }
                        : undefined
                    }
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
          {tab === "identity" && profileSaveState && (
            <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-end gap-2 border-t border-[var(--slurp-outline)] bg-[var(--slurp-surface)] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:static sm:shrink-0 sm:bg-[var(--slurp-surface)] sm:px-0 sm:pb-0 sm:pt-3 sm:ps-56">
              <button
                type="button"
                disabled={profileSaveState.isPending}
                onClick={profileSaveState.discard}
                className={quietButton}
              >
                {t("ui.slurp.creatorForm.cancel", { defaultValue: "Discard" })}
              </button>
              <button
                type="button"
                disabled={profileSaveState.isPending || !profileDirty}
                onClick={profileSaveState.save}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-bold text-zinc-950 disabled:opacity-50"
              >
                {profileSaveState.isPending ? (
                  <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Check size={15} aria-hidden="true" />
                )}
                {profileSaveState.isPending
                  ? t("ui.noodle.stageprofileform.saving")
                  : t("ui.noodle.stageprofileform.saveChanges")}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
