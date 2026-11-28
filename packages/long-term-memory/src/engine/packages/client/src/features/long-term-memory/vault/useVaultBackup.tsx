import { useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { downloadBackup, errorMessage, invalidateLtmQueries, queryKeys, request } from "../api";
import { Button, confirm, lockedActionProps } from "../shared-controls";
import { useLtmTranslation } from "../localization";
import type { LongTermMemoryDestinationProps } from "../types";

type BackupCounts = { notes: number; drafts: number; rejectedSuggestions: number };
type BackupPreview = { backup: unknown; incoming: BackupCounts; current: BackupCounts };

/**
 * Back up and Restore for the Memory Vault header. `buttons` goes in the header; `panel` goes under it and holds
 * the restore steps (Choose backup, the incoming counts, Replace); each result is a toast. `busy` and `setBusy` are
 * the Vault's own lock, which a running restore holds so no memory is saved or archived into a half-replaced vault;
 * `onReplaced` runs after a restore replaced the vault, so the Vault can drop what it has open.
 */
export function useVaultBackup({
  props,
  busy: vaultBusy,
  setBusy: setVaultBusy,
  onReplaced,
}: {
  props: LongTermMemoryDestinationProps["props"];
  busy: boolean;
  setBusy: Dispatch<SetStateAction<string>>;
  onReplaced: () => void;
}): { buttons: ReactNode; panel: ReactNode } {
  const { t: localizeUi } = useLtmTranslation();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState("");
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const restoreButton = useRef<HTMLButtonElement>(null);
  // Restore lives in the header's "⋯" menu; if the menu was closed under the panel, focus its toggle instead.
  const focusRestore = () =>
    (restoreButton.current ?? document.querySelector<HTMLElement>("[data-ltm-vault-more]"))?.focus();
  const replaceButton = useRef<HTMLButtonElement>(null);
  const busy = vaultBusy || pending !== "";
  const lock = lockedActionProps(busy);

  const exportBackup = async () => {
    if (busy) return;
    setPending("export");
    try {
      await downloadBackup();
      toast.success(localizeUi("ui.longTermMemory.memorysettings.memoryBackupExported"));
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotExportMemoryData")));
    } finally {
      setPending("");
    }
  };

  const previewBackup = async (file: File) => {
    setPending("preview");
    try {
      const backup = JSON.parse(await file.text());
      const counts = await request<{ incoming: BackupCounts; current: BackupCounts }>(
        "/backup/preview",
        "POST",
        backup,
      );
      setPreview({ ...counts, backup });
      // The Choose backup button is replaced by the counts step, so focus moves to the next action.
      window.requestAnimationFrame(() => replaceButton.current?.focus());
      toast.success(localizeUi("ui.longTermMemory.memoryvault.backupValidatedReviewCounts"));
    } catch (error) {
      setPreview(null);
      toast.error(errorMessage(error, localizeUi("ui.longTermMemory.memoryvault.couldNotValidateBackup")));
    } finally {
      setPending("");
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const importBackup = async () => {
    if (busy || !preview) return;
    if (
      !(await confirm(
        props,
        localizeUi("ui.longTermMemory.memoryvault.replaceLongTermMemoryData"),
        localizeUi("ui.longTermMemory.memoryvault.replaceLongTermMemoryDataDescription", {
          currentNotes: preview.current.notes,
          currentDrafts: preview.current.drafts,
          incomingNotes: preview.incoming.notes,
          incomingDrafts: preview.incoming.drafts,
        }),
        localizeUi("ui.longTermMemory.memoryvault.replaceData"),
        true,
      ))
    )
      return;
    setPending("import");
    setVaultBusy("restore");
    try {
      await request("/backup/import", "POST", preview.backup);
      setPreview(null);
      setRestoreOpen(false);
      onReplaced();
      // The panel (and its focused Replace button) is gone; the Vault's own focus move may land on a hidden
      // control, so return focus to Restore after it.
      window.requestAnimationFrame(() => focusRestore());
      // The restore replaces the whole vault and the settings, so everything cached is stale. Memory Settings
      // refills its forms from the refetched settings when it opens.
      await invalidateLtmQueries(queryClient, [queryKeys.root]);
      toast.success(localizeUi("ui.longTermMemory.memoryvault.memoryBackupImported"));
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.longTermMemory.memoryvault.couldNotImportMemoryData")));
    } finally {
      setPending("");
      setVaultBusy((current) => (current === "restore" ? "" : current));
    }
  };

  const closeRestore = () => {
    if (busy) return;
    setRestoreOpen(false);
    setPreview(null);
    focusRestore();
  };

  const buttons = (
    <>
      <Button {...lock} onClick={() => void exportBackup()} data-ltm-vault-backup>
        <Download aria-hidden="true" size="0.875rem" /> {localizeUi("ui.longTermMemory.memoryvault.backUp")}
      </Button>
      <Button
        ref={restoreButton}
        {...lock}
        aria-expanded={restoreOpen}
        onClick={() => {
          if (busy) return;
          if (restoreOpen) closeRestore();
          else setRestoreOpen(true);
        }}
        data-ltm-vault-restore
      >
        <Upload aria-hidden="true" size="0.875rem" /> {localizeUi("ui.longTermMemory.memoryvault.restore")}
      </Button>
    </>
  );

  const panel = (
    <>
      {restoreOpen ? (
        <div
          role="group"
          aria-label={localizeUi("ui.longTermMemory.memoryvault.restoreABackup")}
          data-ltm-vault-restore-panel
          className="mari-editor-panel mari-editor-panel--soft col-span-2 space-y-2 p-3 text-xs"
        >
          {preview ? (
            <>
              <p className="font-semibold">
                {localizeUi("ui.longTermMemory.memoryvault.validatedBackupReadyToImport")}
              </p>
              <p className="text-[var(--muted-foreground)]">
                {localizeUi("ui.longTermMemory.memoryvault.backupCurrent")} {preview.current.notes}{" "}
                {localizeUi("ui.longTermMemory.memoryvault.backupMemories")} {preview.current.drafts}{" "}
                {localizeUi("ui.longTermMemory.memoryvault.backupDraftsIncoming")} {preview.incoming.notes}{" "}
                {localizeUi("ui.longTermMemory.memoryvault.backupMemories")} {preview.incoming.drafts}{" "}
                {localizeUi("ui.longTermMemory.memoryvault.backupDrafts")} {" | "}
                {preview.current.rejectedSuggestions}{" "}
                {localizeUi("ui.longTermMemory.memoryvault.backupRejectedSuggestionsCurrent")} {" | "}
                {preview.incoming.rejectedSuggestions}{" "}
                {localizeUi("ui.longTermMemory.memoryvault.backupRejectedSuggestionsIncoming")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button ref={replaceButton} primary {...lock} onClick={() => void importBackup()}>
                  {localizeUi("ui.longTermMemory.memoryvault.replaceWithThisBackup")}
                </Button>
                <Button {...lock} onClick={closeRestore}>
                  {localizeUi("ui.longTermMemory.memoryvault.cancel")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="font-semibold">{localizeUi("ui.longTermMemory.memoryvault.restoreABackup")}</p>
              <p className="text-[var(--muted-foreground)]">
                {localizeUi("ui.longTermMemory.memoryvault.chooseBackupHint")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  primary
                  {...lock}
                  onClick={() => {
                    if (!busy) fileInput.current?.click();
                  }}
                >
                  <Upload aria-hidden="true" size="0.875rem" />{" "}
                  {localizeUi("ui.longTermMemory.memoryvault.chooseBackup")}
                </Button>
                <Button {...lock} onClick={closeRestore}>
                  {localizeUi("ui.longTermMemory.memoryvault.cancel")}
                </Button>
              </div>
            </>
          )}
          <input
            ref={fileInput}
            type="file"
            aria-label={localizeUi("ui.longTermMemory.memoryvault.chooseBackup")}
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void previewBackup(file);
            }}
          />
        </div>
      ) : null}
    </>
  );

  return { buttons, panel };
}
