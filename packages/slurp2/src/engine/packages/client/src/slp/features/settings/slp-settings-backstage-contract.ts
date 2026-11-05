import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import type { SlpBackstageSection, SlpBackstageTarget } from "../../base/navigation/slp-backstage-target";
import type { SlurpSettings } from "./slp-settings-contract";
import { useSlurpSettings, useSlurpSettingsDefaults, useUpdateSlurpSettings } from "./slp-settings-hooks";

/**
 * The staged settings draft behind Backstage: what is saved, what is staged for Review and apply,
 * and how a save reports itself. Backstage composes this; the settings feature owns it.
 */
export function useSlpSettingsDraft({ section, target }: { section: SlpBackstageSection; target: SlpBackstageTarget }) {
  const { t } = useTranslation();
  const settingsQuery = useSlurpSettings();
  const settingsDefaultsQuery = useSlurpSettingsDefaults();
  const updateSettings = useUpdateSlurpSettings();
  const savedSettings = settingsQuery.data;
  const [draftPatch, setDraftPatch] = useState<Partial<SlurpSettings>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const settings = useMemo(
    () => (savedSettings ? ({ ...savedSettings, ...draftPatch } as SlurpSettings) : undefined),
    [draftPatch, savedSettings],
  );

  const save = async (patch: Partial<SlurpSettings>) => {
    setSaveState("saving");
    try {
      await updateSettings.mutateAsync(patch);
      setSaveState("saved");
      return true;
    } catch (error) {
      setSaveState("error");
      toast.error(errorMessage(error));
      return false;
    }
  };

  /**
   * Stages a patch for Review and apply; only Overview and the Basic page save at once, with Undo.
   * `now` saves at once on any page (extension switches: a staged Off is lost on leaving the page).
   */
  const updatePatch = async (patch: Partial<SlurpSettings>, now = false) => {
    if (!now && section !== "overview" && target !== "basic") {
      setDraftPatch((current) => ({ ...current, ...patch }));
      return true;
    }
    const keys = Object.keys(patch) as Array<keyof SlurpSettings>;
    // "Grows" sizes postsPerDay on the server; Undo must restore the old pace, not the sized one.
    if ("postsPerDayCustom" in patch && !keys.includes("postsPerDay")) keys.push("postsPerDay");
    const previous = savedSettings
      ? (Object.fromEntries(keys.map((key) => [key, savedSettings[key]])) as Partial<SlurpSettings>)
      : undefined;
    const changed = await save(patch);
    // A staged edit of the same key would hide this save and write the old value back on Apply.
    if (changed)
      setDraftPatch(
        (current) =>
          Object.fromEntries(Object.entries(current).filter(([key]) => !(key in patch))) as Partial<SlurpSettings>,
      );
    if (changed && previous) {
      toast.success(t("ui.slurp.settings.backstage.quickSaved", { defaultValue: "Quick setting updated." }), {
        action: {
          label: t("ui.slurp.settings.backstage.undo", { defaultValue: "Undo" }),
          onClick: () => void save(previous),
        },
      });
    }
    return changed;
  };

  const update = (key: keyof SlurpSettings, value: unknown) => updatePatch({ [key]: value } as Partial<SlurpSettings>);
  const updateNow = (key: keyof SlurpSettings, value: unknown) =>
    updatePatch({ [key]: value } as Partial<SlurpSettings>, true);

  const restore = async (patch: Partial<SlurpSettings>, message = "Settings saved.") => {
    setSaveState("saving");
    try {
      await updateSettings.mutateAsync(patch);
      setSaveState("saved");
      toast.success(message);
      return true;
    } catch (error) {
      setSaveState("error");
      toast.error(errorMessage(error));
      return false;
    }
  };

  return {
    settingsQuery,
    settingsDefaultsQuery,
    updateSettings,
    savedSettings,
    draftPatch,
    setDraftPatch,
    saveState,
    setSaveState,
    settings,
    save,
    update,
    updateNow,
    updatePatch,
    restore,
  };
}

export type SlpSettingsDraftState = ReturnType<typeof useSlpSettingsDraft>;
