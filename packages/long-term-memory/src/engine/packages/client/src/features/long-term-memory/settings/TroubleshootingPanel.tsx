import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Map as MapIcon, RotateCcw, Trash2 } from "lucide-react";
import { downloadBackup, errorMessage, invalidateLtmQueries, queryKeys, request } from "../api";
import { Button, confirm, lockedActionProps } from "../shared-controls";
import type { LongTermMemoryDestinationProps } from "../types";
import { useLtmTranslation } from "../localization";
import { LTM_TOUR_STOPS } from "../onboarding/tour-stops";
import { DisclosureSummary, SettingsSharedStyles } from "./settings-shared";

export function TroubleshootingPanel({
  props,
  hidden,
  open,
  onOpenChange,
  disabled,
  onBusyChange,
  onRunSetup,
  onStartTour,
}: {
  props: LongTermMemoryDestinationProps["props"];
  hidden: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True while the parent is saving settings. */
  disabled: boolean;
  /** Reports whether a troubleshooting action is running, so the parent's save stays disabled. */
  onBusyChange: (busy: boolean) => void;
  onRunSetup?: () => void;
  onStartTour?: () => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState("");
  // Running work and the parent's save lock keep focus (`aria-disabled`), so each handler returns early on `busy`.
  const busy = pending !== "" || disabled;
  const lock = lockedActionProps(busy);
  useEffect(() => {
    onBusyChange(pending !== "");
  }, [onBusyChange, pending]);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const exportFirstButton = useRef<HTMLButtonElement>(null);
  // Delete all data asks first whether to export a backup; the host's confirm dialog cannot hold that button.
  const [deletePromptOpen, setDeletePromptOpen] = useState(false);
  useEffect(() => {
    if (hidden || !open) setDeletePromptOpen(false);
  }, [hidden, open]);
  const closeDeletePrompt = () => {
    if (busy) return;
    setDeletePromptOpen(false);
    deleteButton.current?.focus();
  };
  // Delete all hides this section while the forms reload and closes its prompt; both drop focus to the page.
  // Once the panel is back and idle, return focus to the control that started the action, unless
  // the user has already moved it.
  const focusAfterReload = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const target = focusAfterReload.current;
    if (hidden || pending || !target) return;
    focusAfterReload.current = null;
    if (target.isConnected && document.activeElement === document.body) target.focus();
  }, [hidden, pending]);

  const exportBackup = async () => {
    if (busy) return;
    setPending("backup-export");
    try {
      await downloadBackup();
      toast.success(localizeUi("ui.longTermMemory.memorysettings.memoryBackupExported"));
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotExportMemoryData")));
    } finally {
      setPending("");
    }
  };

  const deleteAll = async () => {
    if (busy) return;
    if (
      !(await confirm(
        props,
        localizeUi("ui.longTermMemory.memorysettings.deleteAllMemoryData"),
        localizeUi("ui.longTermMemory.memorysettings.deleteAllMemoryDataDescription"),
        localizeUi("ui.longTermMemory.memorysettings.deleteEverything"),
        true,
      ))
    )
      return;
    setDeletePromptOpen(false);
    focusAfterReload.current = deleteButton.current;
    setPending("data-delete");
    try {
      await request("/data", "DELETE");
      await invalidateLtmQueries(queryClient, [queryKeys.root]);
      toast.success(localizeUi("ui.longTermMemory.memorysettings.allMemoryDataDeleted"));
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotDeleteMemoryData")));
    } finally {
      setPending("");
    }
  };

  return (
    <>
      <SettingsSharedStyles />
      <details
        id="settings-panel-troubleshooting"
        data-ltm-troubleshooting
        hidden={hidden}
        open={open}
        onToggle={(event) => onOpenChange(event.currentTarget.open)}
        className="mari-editor-panel space-y-3 p-3"
      >
        <DisclosureSummary className="text-sm">
          {localizeUi("ui.longTermMemory.memorysettings.troubleshooting")}
        </DisclosureSummary>
        {onRunSetup || onStartTour ? (
          <div data-ltm-troubleshooting-group="help">
            <h4 data-ltm-group-heading className="text-xs font-semibold">
              {localizeUi("ui.longTermMemory.tour.setupGroup")}
            </h4>
            <div className="mt-2 space-y-3">
              {onRunSetup ? (
                <div>
                  <Button data-ltm-troubleshooting-setup onClick={onRunSetup}>
                    <RotateCcw aria-hidden="true" size="0.875rem" />{" "}
                    {localizeUi("ui.longTermMemory.tour.runSetupAgain")}
                  </Button>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {localizeUi("ui.longTermMemory.tour.runSetupAgainHint")}
                  </p>
                </div>
              ) : null}
              {onStartTour ? (
                <div className={onRunSetup ? "border-t border-[var(--border)] pt-3" : undefined}>
                  <Button data-ltm-troubleshooting-tour onClick={onStartTour}>
                    <MapIcon aria-hidden="true" size="0.875rem" /> {localizeUi("ui.longTermMemory.tour.takeTour")}
                  </Button>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {localizeUi("ui.longTermMemory.tour.takeTourHint", { count: LTM_TOUR_STOPS.length })}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        <div data-ltm-troubleshooting-group="delete">
          <h4 data-ltm-group-heading className="text-xs font-semibold">
            {localizeUi("ui.longTermMemory.memorysettings.deleteGroup")}
          </h4>
          <div className="mt-2 space-y-3">
            <div>
              <Button
                ref={deleteButton}
                destructive
                {...lock}
                aria-expanded={deletePromptOpen}
                onClick={() => {
                  if (busy) return;
                  setDeletePromptOpen(true);
                  requestAnimationFrame(() => exportFirstButton.current?.focus());
                }}
              >
                <Trash2 aria-hidden="true" size="0.875rem" />{" "}
                {localizeUi("ui.longTermMemory.memorysettings.deleteAllData")}
              </Button>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.longTermMemory.memorysettings.deleteAllMemoryDataDescription")}
              </p>
              {deletePromptOpen ? (
                <div
                  role="group"
                  aria-label={localizeUi("ui.longTermMemory.memorysettings.deleteAllData")}
                  aria-describedby="ltm-delete-prompt-text"
                  data-ltm-delete-prompt
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && !busy) {
                      event.stopPropagation();
                      closeDeletePrompt();
                    }
                  }}
                  className="mari-editor-panel mari-editor-panel--soft mt-2 space-y-2 p-3 text-xs"
                >
                  <p id="ltm-delete-prompt-text">
                    {localizeUi("ui.longTermMemory.memorysettings.exportBackupFirstPrompt")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button ref={exportFirstButton} primary {...lock} onClick={() => void exportBackup()}>
                      <Download aria-hidden="true" size="0.875rem" />{" "}
                      {localizeUi("ui.longTermMemory.memorysettings.exportBackupFirst")}
                    </Button>
                    <Button destructive {...lock} onClick={() => void deleteAll()}>
                      {localizeUi("ui.longTermMemory.memorysettings.continueToDelete")}
                    </Button>
                    <Button {...lock} onClick={closeDeletePrompt}>
                      {localizeUi("ui.longTermMemory.memoryvault.cancel")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </details>
    </>
  );
}
