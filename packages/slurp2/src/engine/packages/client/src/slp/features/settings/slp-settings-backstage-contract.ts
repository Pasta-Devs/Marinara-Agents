import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { errorMessage } from "../../../components/slurp/SlurpBackstageWorkflow";
import type { SlpBackstageSection } from "../../base/navigation/slp-backstage-target";
import type { SlurpSettings } from "./slp-settings-contract";
import { useSlurpSettings, useSlurpSettingsDefaults, useUpdateSlurpSettings } from "./slp-settings-hooks";

/**
 * The staged settings draft behind Backstage: what is saved, what is staged for Review and apply,
 * and how a save reports itself. Backstage composes this; the settings feature owns it.
 */
export function useSlpSettingsDraft({ section }: { section: SlpBackstageSection }) {
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

  /** Stages a patch for Review and apply; only Overview quick toggles save at once, with Undo. */
  const updatePatch = async (patch: Partial<SlurpSettings>) => {
    if (section !== "overview") {
      setDraftPatch((current) => ({ ...current, ...patch }));
      return true;
    }
    const keys = Object.keys(patch) as Array<keyof SlurpSettings>;
    const previous = savedSettings
      ? (Object.fromEntries(keys.map((key) => [key, savedSettings[key]])) as Partial<SlurpSettings>)
      : undefined;
    const changed = await save(patch);
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
    updatePatch,
    restore,
  };
}

export type SlpSettingsDraftState = ReturnType<typeof useSlpSettingsDraft>;
