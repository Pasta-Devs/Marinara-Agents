import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { errorMessage, localDateTimeValue } from "../../../components/slurp/SlurpBackstageWorkflow";
import { nextSlurpAutopurgeRunAt } from "../../../../../shared/src/slp/slp-autopurge-time.js";
import type { SlpBackstageSection, SlpBackstageTarget } from "../../base/navigation/slp-backstage-target";
import type { SlurpSettings } from "../settings/slp-settings-contract";
import type { SlurpBackupJob, SlurpRestoreInspection } from "./slp-backup";
import {
  useDeleteAllSlurpData,
  useDeleteUnusedSlurpData,
  useRunSlurpAutopurge,
  useSlurpAutopurgePreview,
  useSlurpMaintenanceSummary,
} from "./slp-maintenance-hooks";
import { getSlurpBackupJob } from "./slp-backup";

/** Cleanup, backup and restore state. Backstage composes it; it owns none of this logic. */
export function useSlpMaintenanceBackstageState({
  section,
  target,
  settings,
  save,
}: {
  section: SlpBackstageSection;
  target: SlpBackstageTarget;
  settings: SlurpSettings | undefined;
  save: (patch: Partial<SlurpSettings>) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const runAutopurge = useRunSlurpAutopurge();
  const maintenanceSummary = useSlurpMaintenanceSummary(section === "maintenance" || section === "overview");
  const autopurgePreview = useSlurpAutopurgePreview(settings, target === "autopurge");
  const deleteAllData = useDeleteAllSlurpData();
  const deleteUnusedData = useDeleteUnusedSlurpData();
  const [autopurgeNextDraft, setAutopurgeNextDraft] = useState("");
  const [backupJob, setBackupJob] = useState<SlurpBackupJob | null>(null);
  const [backupPending, setBackupPending] = useState(false);
  const [restorePending, setRestorePending] = useState(false);
  const [restoreImportSettings, setRestoreImportSettings] = useState(false);
  const [restoreInspection, setRestoreInspection] = useState<SlurpRestoreInspection | null>(null);
  const [restoreFileName, setRestoreFileName] = useState("");
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setAutopurgeNextDraft(settings?.autopurgeNextRunAt ? localDateTimeValue(settings.autopurgeNextRunAt) : "");
  }, [settings?.autopurgeNextRunAt]);

  // A new retention period restarts the schedule from now, so a shorter period takes effect right away.
  const saveRetention = (patch: Partial<Pick<SlurpSettings, "autopurgeRetentionValue" | "autopurgeRetentionUnit">>) =>
    save(
      settings?.autopurgeEnabled
        ? { ...patch, autopurgeNextRunAt: nextSlurpAutopurgeRunAt({ ...settings, ...patch }) }
        : patch,
    );

  /** Poll a job to a terminal state, surfacing each step so a long run does not look stuck. */
  const followBackupJob = async (job: SlurpBackupJob) => {
    let current = job;
    setBackupJob(current);
    while (current.state !== "completed" && current.state !== "error") {
      await new Promise((resolve) => window.setTimeout(resolve, 750));
      current = await getSlurpBackupJob(job.id);
      setBackupJob(current);
    }
    if (current.state === "error") throw new Error(current.error ?? current.detail);
    return current;
  };

  const runAutopurgeNow = async () => {
    if (!settings) return;
    try {
      const confirmed = await showConfirmDialog({
        title: t("ui.slurp.settings.autopurge.runConfirmTitle"),
        message: settings.autopurgeKeepPosts
          ? t(
              settings.autopurgeIncludeMessageMedia
                ? "ui.slurp.settings.autopurge.runConfirmMediaOnlyWithMessages"
                : "ui.slurp.settings.autopurge.runConfirmMediaOnly",
            )
          : t(
              settings.autopurgeIncludeMessageMedia
                ? "ui.slurp.settings.autopurge.runConfirmPostsWithMessages"
                : "ui.slurp.settings.autopurge.runConfirmPosts",
            ),
        confirmLabel: t("ui.slurp.settings.autopurge.runNow"),
      });
      if (!confirmed) return;
      const result = await runAutopurge.mutateAsync();
      toast.success(
        t("ui.slurp.settings.autopurge.runSuccess", {
          posts: result.deletedPosts,
          postMedia: result.removedPostMedia,
          messageMedia: result.removedMessageMedia,
        }),
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return {
    runAutopurge,
    maintenanceSummary,
    autopurgePreview,
    deleteAllData,
    deleteUnusedData,
    autopurgeNextDraft,
    setAutopurgeNextDraft,
    autopurgeNextTime: Date.parse(autopurgeNextDraft),
    backupJob,
    setBackupJob,
    backupPending,
    setBackupPending,
    restorePending,
    setRestorePending,
    restoreImportSettings,
    setRestoreImportSettings,
    restoreInspection,
    setRestoreInspection,
    restoreFileName,
    setRestoreFileName,
    restoreInputRef,
    followBackupJob,
    saveRetention,
    runAutopurgeNow,
  };
}

export type SlpMaintenanceBackstageState = ReturnType<typeof useSlpMaintenanceBackstageState>;
