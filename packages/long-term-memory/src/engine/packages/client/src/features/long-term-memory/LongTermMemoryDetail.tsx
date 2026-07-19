import { lazy, Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BrainCircuit, Database, Settings2 } from "lucide-react";
import type { LtmStatusResponse } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { queryKeys, request } from "./api";
import { LongTermMemoryNavigation } from "./LongTermMemoryNavigation";
import { Button, StatusSurface } from "./shared-controls";
import type { CapabilityProps, LongTermMemoryDestination } from "./types";

const destinations = {
  vault: lazy(() => import("./MemoryVault")),
  review: lazy(() => import("./ReviewQueue")),
  sources: lazy(() => import("./SourcesWorkspace")),
  activity: lazy(() => import("./ActivityView")),
  settings: lazy(() => import("./MemorySettings")),
} as const;

export function LongTermMemoryDetail({ props }: { props: CapabilityProps }) {
  const status = useQuery({
    queryKey: queryKeys.status,
    queryFn: () => request<LtmStatusResponse>("/status"),
  });
  const pendingDrafts = useQuery({
    queryKey: queryKeys.pendingDrafts,
    queryFn: () => request<{ count: number }>("/drafts/pending-count"),
  });
  const [destination, setDestination] =
    useState<LongTermMemoryDestination>("vault");
  const [activationPending, setActivationPending] = useState(false);
  const [activationError, setActivationError] = useState("");
  const [destinationDirty, setDestinationDirty] = useState(false);
  const [openedNoteId, setOpenedNoteId] = useState<string | null>(null);
  const Destination = destinations[destination];

  useEffect(() => {
    props.onDirtyChange?.(destinationDirty);
    return () => props.onDirtyChange?.(false);
  }, [destinationDirty, props.onDirtyChange]);

  const confirmDestinationChange = async (next: string) => {
    if (!destinationDirty) return true;
    const options = {
      title: "Discard unsaved changes?",
      message: `Your unsaved changes will be lost before opening ${next}.`,
      confirmLabel: "Discard changes",
      tone: "destructive" as const,
    };
    return props.confirmAction
      ? await props.confirmAction(options)
      : window.confirm(`${options.title}\n\n${options.message}`);
  };
  const selectDestination = async (next: LongTermMemoryDestination) => {
    if (next === destination) return;
    if (!(await confirmDestinationChange(next))) return;
    setDestinationDirty(false);
    setDestination(next);
  };
  const openMemory = async (noteId: string) => {
    if (!(await confirmDestinationChange("Memory Vault"))) return;
    setOpenedNoteId(noteId);
    setDestinationDirty(false);
    setDestination("vault");
  };
  const openReview = async () => {
    if (!(await confirmDestinationChange("Review Queue"))) return;
    setDestinationDirty(false);
    setDestination("review");
  };
  const openSources = async () => {
    if (!(await confirmDestinationChange("Sources"))) return;
    setDestinationDirty(false);
    setDestination("sources");
  };
  const toggleActivation = async () => {
    if (!props.onEnabledForChatChange) return;
    setActivationPending(true);
    setActivationError("");
    try {
      await props.onEnabledForChatChange(!props.enabledForChat);
    } catch (error) {
      setActivationError(
        error instanceof Error ? error.message : "Could not update this chat",
      );
    } finally {
      setActivationPending(false);
    }
  };

  return (
    <main
      data-ltm-surface="detail"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--background)] text-[var(--foreground)]"
    >
      <header className="sticky top-0 z-10 flex min-h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--background)] px-4">
        <button
          type="button"
          data-ltm-control="back"
          onClick={props.onClose}
          aria-label="Back to Agents"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <ArrowLeft aria-hidden="true" size="1rem" />
        </button>
        <BrainCircuit
          aria-hidden="true"
          size="1.125rem"
          className="text-[var(--primary)]"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">Long-Term Memory</h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            Version {props.package?.version ?? "unknown"}
          </p>
        </div>
        <button
          type="button"
          data-ltm-control="manage-package"
          onClick={props.onManagePackage}
          aria-label="Manage package"
          title="Manage package"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <Settings2 aria-hidden="true" size="1rem" />
        </button>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-5 sm:px-6 md:flex-row">
        <LongTermMemoryNavigation
          destination={destination}
          onDestinationChange={selectDestination}
          badges={{
            memories: status.data?.notes.total,
            review: pendingDrafts.data?.count,
          }}
        />
        <div className="min-w-0 flex-1 space-y-5">
          <section
            data-ltm-surface="overview"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 p-3"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                <Database aria-hidden="true" size="1rem" />
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {status.data
                    ? `${status.data.notes.total} saved memories`
                    : "Memory vault"}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {status.data
                    ? `${status.data.indexes.chunkCount ?? 0} indexed chunks`
                    : status.isError
                      ? "Status unavailable"
                      : "Loading status"}
                </p>
              </div>
            </div>
            {props.chatId ? (
              <Button
                primary={props.enabledForChat === true}
                disabled={activationPending}
                onClick={() => void toggleActivation()}
              >
                {props.enabledForChat
                  ? `Active in ${props.chatName ?? "this chat"}`
                  : "Enable for this chat"}
              </Button>
            ) : null}
          </section>
          {activationError ? (
            <StatusSurface tone="danger">{activationError}</StatusSurface>
          ) : null}
          {status.isError ? (
            <StatusSurface tone="danger">
              Long-Term Memory status could not load.
            </StatusSurface>
          ) : null}
          <Suspense
            fallback={
              <StatusSurface busy>Loading {destination}...</StatusSurface>
            }
          >
            <Destination
              props={props}
              onDirtyChange={setDestinationDirty}
              onOpenMemory={openMemory}
              onOpenSources={openSources}
              onOpenReview={openReview}
              openedNoteId={openedNoteId}
            />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
