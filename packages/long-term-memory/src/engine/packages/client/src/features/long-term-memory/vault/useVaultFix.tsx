import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2, Sparkles, TriangleAlert, Users } from "lucide-react";
import type {
  LtmIntegrityResponse,
  LtmNote,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { errorMessage, invalidateLtmQueries, queryKeys, request } from "../api";
import { labelKeys, localizedLabel, memoryLabel } from "../display-labels";
import { Button, StatusSurface, confirm, lockedActionProps } from "../shared-controls";
import { selectLtmPluralForm, useLtmTranslation } from "../localization";
import type { LtmAiCheckKind } from "../onboarding/TidyWithAi";
import type { LongTermMemoryDestinationProps } from "../types";

type RepairAction = "rebuild_indexes" | "quarantine_malformed_notes" | "backfill_imported_source_titles";

const repairActions: Array<{ id: RepairAction; labelKey: string; descriptionKey: string }> = [
  {
    id: "rebuild_indexes",
    labelKey: "ui.longTermMemory.memoryvault.fixReindex",
    descriptionKey: "ui.longTermMemory.memoryvault.fixReindexHint",
  },
  {
    id: "quarantine_malformed_notes",
    labelKey: "ui.longTermMemory.memoryvault.fixQuarantine",
    descriptionKey: "ui.longTermMemory.memoryvault.fixQuarantineHint",
  },
  {
    id: "backfill_imported_source_titles",
    labelKey: "ui.longTermMemory.memoryvault.fixBackfillTitles",
    descriptionKey: "ui.longTermMemory.memoryvault.fixBackfillTitlesHint",
  },
];

/** How many memories the integrity issues name; an issue with no memory (an index or log problem) is not counted. */
function memoriesNeedingFix(issues: LtmIntegrityResponse["issues"]) {
  const memories = new Set<string>();
  for (const issue of issues) {
    // A warning (a dangling link, a possible duplicate) is not something the repair actions fix.
    if (issue.severity !== "error") continue;
    // A malformed note has no id yet, so its path stands for it.
    if (issue.noteId) memories.add(issue.noteId);
    else if (issue.code === "malformed_note") memories.add(issue.path ?? issue.message);
  }
  return memories.size;
}

/**
 * The "N memories need fixing · Fix" bar for the Memory Vault header, with the maintenance panel it opens: the
 * integrity issues and the three repair actions; the result of a run is a toast. `fix` goes in the header grid.
 * `busy` and `setBusy` are the Vault's own lock, which a running repair holds so no memory is saved or archived
 * while indexes are rebuilt or notes are moved out of the vault; `notesById` and `onOpenMemory` let an issue open
 * the memory it names.
 */
export function useVaultFix({
  props,
  busy: vaultBusy,
  setBusy: setVaultBusy,
  notesById,
  onOpenMemory,
  onAiCheck,
}: {
  props: LongTermMemoryDestinationProps["props"];
  busy: boolean;
  setBusy: Dispatch<SetStateAction<string>>;
  notesById: ReadonlyMap<string, LtmNote>;
  onOpenMemory: (noteId: string) => void;
  /** Opens an AI check (Tidy with AI, Link older relationships), which the Vault's More menu offers too. */
  onAiCheck: (kind: LtmAiCheckKind) => void;
}): ReactNode {
  const { t: localizeUi, locale } = useLtmTranslation();
  const queryClient = useQueryClient();
  const integrity = useQuery({
    queryKey: queryKeys.integrity,
    queryFn: () => request<LtmIntegrityResponse>("/integrity"),
    // The scan reads every note under the vault lock; the invalidations after a save or repair keep the bar fresh.
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<RepairAction[]>([]);
  const [pending, setPending] = useState(false);
  const fixButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const focusAfterRun = useRef(false);
  const busy = vaultBusy || pending;
  const lock = lockedActionProps(busy);

  const data = integrity.isError ? undefined : integrity.data;
  const problems = data && !data.ok ? data : null;
  const memoryCount = problems ? memoriesNeedingFix(problems.issues) : 0;

  const run = async () => {
    if (busy || !selected.length) return;
    if (
      !(await confirm(
        props,
        localizeUi("ui.longTermMemory.memoryvault.fixConfirmTitle"),
        localizeUi("ui.longTermMemory.memoryvault.fixConfirmBody"),
        localizeUi("ui.longTermMemory.memoryvault.fixConfirmAction"),
        true,
      ))
    )
      return;
    setPending(true);
    setVaultBusy("repair");
    try {
      const response = await request<{ actions: Array<{ action: string; result: string; count?: number }> }>(
        "/repair",
        "POST",
        { actions: selected },
      );
      toast.success(
        response.actions
          .map((item) =>
            localizeUi("ui.longTermMemory.memoryvault.fixResultLine", {
              action: localizedLabel(item.action, localizeUi, labelKeys.maintenanceAction),
              result: localizedLabel(item.result, localizeUi, labelKeys.maintenanceResult),
              count: item.count ?? 0,
            }),
          )
          .join(" "),
      );
      setSelected([]);
      // A finished run empties the selection, so Run turns natively disabled and drops focus to the page; the
      // bar may also be gone once nothing is left to fix. Move focus to Close, unless the user moved it.
      focusAfterRun.current = true;
      await invalidateLtmQueries(queryClient, [
        queryKeys.integrity,
        queryKeys.identityRepair,
        queryKeys.status,
        queryKeys.notes,
        queryKeys.activity,
        queryKeys.localCharactersRoot,
        queryKeys.scopeTargetsRoot,
        ...(props.chatId ? [queryKeys.lastInjection(props.chatId)] : []),
      ]);
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.longTermMemory.memoryvault.fixFailed")));
    } finally {
      setPending(false);
      setVaultBusy((current) => (current === "repair" ? "" : current));
    }
  };

  // Once the run has finished and rendered (Run is natively disabled again), move focus to Close.
  useEffect(() => {
    if (pending || !focusAfterRun.current) return;
    focusAfterRun.current = false;
    const active = document.activeElement;
    if (!active || active === document.body || active.matches(":disabled")) closeButton.current?.focus();
  }, [pending]);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setSelected([]);
    // The bar (and its Fix button) is gone once nothing is left to fix; the memory search in the Vault header is the fallback.
    window.requestAnimationFrame(() =>
      (
        fixButton.current ??
        document.querySelector<HTMLElement>(
          `input[aria-label="${localizeUi("ui.longTermMemory.memoryvault.searchMemories")}"]`,
        )
      )?.focus(),
    );
  };

  const barText = problems
    ? memoryCount > 0
      ? localizeUi(
          selectLtmPluralForm(locale, memoryCount) === "one"
            ? "ui.longTermMemory.memoryvault.fixBarMemoriesOne"
            : "ui.longTermMemory.memoryvault.fixBarMemoriesOther",
          { count: memoryCount },
        )
      : localizeUi("ui.longTermMemory.memoryvault.fixBarRecallData")
    : "";

  return (
    <>
      {integrity.isError ? (
        <StatusSurface tone="danger" className="col-span-2">
          {localizeUi("ui.longTermMemory.memoryvault.fixIntegrityCouldNotLoad")}{" "}
          <button
            type="button"
            className="inline-flex min-h-11 items-center underline"
            onClick={() => void integrity.refetch()}
          >
            {localizeUi("ui.longTermMemory.activityview.retry")}
          </button>
        </StatusSurface>
      ) : null}
      {problems ? (
        <StatusSurface tone="warning" className="col-span-2" data-ltm-vault-fix-bar>
          <TriangleAlert aria-hidden="true" size="0.875rem" className="shrink-0" />
          <span className="min-w-0 flex-1">{barText} · </span>
          <Button
            ref={fixButton}
            {...lock}
            aria-expanded={open}
            onClick={() => {
              if (busy) return;
              if (open) close();
              else setOpen(true);
            }}
          >
            {localizeUi("ui.longTermMemory.memoryvault.fix")}
          </Button>
        </StatusSurface>
      ) : null}
      {open ? (
        <div
          role="group"
          aria-label={localizeUi("ui.longTermMemory.memoryvault.fixTitle")}
          data-ltm-vault-fix-panel
          className="mari-editor-panel mari-editor-panel--soft col-span-2 space-y-2 p-3 text-xs"
        >
          <p className="font-semibold">{localizeUi("ui.longTermMemory.memoryvault.fixTitle")}</p>
          <p className="text-[var(--muted-foreground)]">
            {localizeUi("ui.longTermMemory.memoryvault.fixIntegrityState")}{" "}
            {/* A retained "healthy" reading from before a failed reload would contradict the error above. */}
            {localizedLabel(
              integrity.isError ? "loading" : (integrity.data?.health ?? "loading"),
              localizeUi,
              labelKeys.integrity,
            )}
            .
          </p>
          {data ? (
            <StatusSurface tone={data.ok ? "success" : "danger"}>
              {data.ok
                ? localizeUi("ui.longTermMemory.memoryvault.fixIntegrityPassed", { value1: data.noteCount })
                : localizeUi("ui.longTermMemory.memoryvault.fixIssuesFound", { value1: data.issues.length })}
            </StatusSurface>
          ) : null}
          {data?.issues.length ? (
            <ul className="space-y-1 text-[var(--muted-foreground)]">
              {data.issues.slice(0, 20).map((issue, index) => {
                const note = issue.noteId ? notesById.get(issue.noteId) : undefined;
                return (
                  <li key={`${issue.code}-${index}`}>
                    {issue.noteId ? (
                      <button
                        type="button"
                        className="mr-1 inline-flex min-h-11 items-center font-semibold text-[var(--foreground)] underline underline-offset-2"
                        onClick={() => onOpenMemory(issue.noteId!)}
                      >
                        {memoryLabel(
                          note,
                          note ? localizeUi("ui.longTermMemory.memoryvault.untitledMemory") : issue.noteId,
                        )}
                      </button>
                    ) : null}
                    {issue.severity}: {issue.message}
                  </li>
                );
              })}
            </ul>
          ) : null}
          <div className="space-y-1">
            {repairActions.map((action) => (
              <label key={action.id} className="flex min-h-11 items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selected.includes(action.id)}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked ? [...selected, action.id] : selected.filter((id) => id !== action.id),
                    )
                  }
                />
                <span>
                  <span className="block font-semibold">{localizeUi(action.labelKey)}</span>
                  <span className="block text-[var(--muted-foreground)]">{localizeUi(action.descriptionKey)}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button primary disabled={!selected.length} {...lock} onClick={() => void run()}>
              {localizeUi("ui.longTermMemory.memoryvault.fixRun")}
            </Button>
            <Button {...lock} data-ltm-vault-fix-tidy onClick={() => (busy ? undefined : onAiCheck("tidy"))}>
              <Sparkles aria-hidden="true" size="0.875rem" />
              {localizeUi("ui.longTermMemory.whatsnew.tidyTitle")}
            </Button>
            <Button {...lock} data-ltm-vault-fix-links onClick={() => (busy ? undefined : onAiCheck("links"))}>
              <Link2 aria-hidden="true" size="0.875rem" />
              {localizeUi("ui.longTermMemory.whatsnew.linkTitle")}
            </Button>
            <Button {...lock} data-ltm-vault-fix-people onClick={() => (busy ? undefined : onAiCheck("people"))}>
              <Users aria-hidden="true" size="0.875rem" />
              {localizeUi("ui.longTermMemory.whatsnew.peopleTitle")}
            </Button>
            <Button ref={closeButton} {...lock} onClick={close}>
              {localizeUi("ui.longTermMemory.memoryvault.close")}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
