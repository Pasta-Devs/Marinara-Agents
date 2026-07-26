import { lazy, Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BrainCircuit,
  CircleHelp,
  CirclePlus,
  Pencil,
  Settings2,
  Upload,
} from "lucide-react";
import type { LtmStatusResponse } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { queryKeys, request } from "./api";
import { LongTermMemoryNavigation } from "./LongTermMemoryNavigation";
import {
  Button,
  IconButton,
  InfoPopover,
  StatusSurface,
} from "./shared-controls";
import type {
  CapabilityProps,
  LongTermMemoryDestination,
  LongTermMemoryDestinationProps,
  LtmRecoveryHandoff,
} from "./types";

const onboardingStorageKey = "marinara-long-term-memory-onboarding-v1";

const destinations = {
  vault: lazy(() => import("./MemoryVault")),
  review: lazy(() => import("./ReviewQueue")),
  sources: lazy(() => import("./SourcesWorkspace")),
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
  const [addOpen, setAddOpen] = useState(false);
  const [createMemoryRequest, setCreateMemoryRequest] = useState<number | null>(
    null,
  );
  const [destinationDirty, setDestinationDirty] = useState(false);
  const [openedNoteId, setOpenedNoteId] = useState<string | null>(null);
  const [reviewSourceNoteId, setReviewSourceNoteId] = useState<string | null>(
    null,
  );
  const [recoveryHandoff, setRecoveryHandoff] =
    useState<LtmRecoveryHandoff | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const Destination = destinations[destination];

  useEffect(() => {
    props.onDirtyChange?.(destinationDirty);
    return () => props.onDirtyChange?.(false);
  }, [destinationDirty, props.onDirtyChange]);

  useEffect(() => {
    if (!status.isSuccess || status.data.notes.total !== 0) return;
    try {
      if (localStorage.getItem(onboardingStorageKey) === "complete") return;
    } catch {}
    setOnboardingOpen(true);
  }, [status.isSuccess, status.data?.notes.total]);

  const completeOnboarding = () => {
    setOnboardingOpen(false);
    try {
      localStorage.setItem(onboardingStorageKey, "complete");
    } catch {}
  };

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
    if (onboardingOpen) completeOnboarding();
    setDestinationDirty(false);
    if (next === "review") setReviewSourceNoteId(null);
    if (next === "vault") setOpenedNoteId(null);
    if (next !== "vault") setRecoveryHandoff(null);
    setAddOpen(false);
    setDestination(next);
  };
  const close = async () => {
    if (!(await confirmDestinationChange("Agents"))) return;
    setDestinationDirty(false);
    props.onDirtyChange?.(false);
    props.onClose?.();
  };
  const openMemory = async (noteId: string) => {
    if (!(await confirmDestinationChange("Memory Vault"))) return;
    setRecoveryHandoff(null);
    setOpenedNoteId(noteId);
    setDestinationDirty(false);
    setDestination("vault");
  };
  const openReview = async (sourceNoteId?: string) => {
    if (!(await confirmDestinationChange("Review Queue"))) return;
    setDestinationDirty(false);
    setReviewSourceNoteId(sourceNoteId ?? null);
    setDestination("review");
  };
  const recoverCandidate: NonNullable<
    LongTermMemoryDestinationProps["onRecoverCandidate"]
  > = async (candidate, scope, modes) => {
    if (!(await confirmDestinationChange("Memory Vault"))) return;
    setOpenedNoteId(null);
    setRecoveryHandoff({ key: Date.now(), candidate, scope, modes });
    setDestinationDirty(false);
    setDestination("vault");
  };
  const openSources = async () => {
    if (!(await confirmDestinationChange("Sources"))) return false;
    setDestinationDirty(false);
    setAddOpen(false);
    setDestination("sources");
    return true;
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

  const indexHealth = status.data?.indexes;
  const health =
    indexHealth?.rebuildState === "building"
      ? "building"
      : indexHealth?.rebuildState === "failed"
        ? "failed"
        : indexHealth?.health;
  const healthLabel = {
    healthy: "Vault healthy",
    building: "Vault rebuilding",
    failed: "Rebuild failed",
    degraded: "Vault degraded",
    stale: "Vault stale",
    corrupt: "Vault corrupt",
    not_built: "Vault not built",
  }[health ?? "not_built"];
  const emptyUnbuiltVault =
    health === "not_built" && (status.data?.notes.total ?? 0) === 0;
  const needsHealthAttention = health !== "healthy" && !emptyUnbuiltVault;
  const healthTone =
    !status.data || emptyUnbuiltVault
      ? "bg-[var(--muted-foreground)]"
      : health === "healthy"
        ? "bg-emerald-500"
        : health === "corrupt" || health === "failed"
          ? "bg-[var(--destructive)]"
          : "bg-amber-500";

  return (
    <main
      data-ltm-surface="detail"
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]"
    >
      <header className="sticky top-0 z-10 flex min-h-14 flex-wrap items-center gap-x-3 border-b border-[var(--border)] bg-[var(--background)] px-4 py-1">
        <IconButton
          icon={ArrowLeft}
          label="Back to Agents"
          data-ltm-control="back"
          onClick={() => void close()}
          className="border-transparent bg-transparent"
        />
        <BrainCircuit
          aria-hidden="true"
          size="1.125rem"
          className="text-[var(--primary)]"
        />
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <h1 className="truncate text-sm font-semibold">Long-Term Memory</h1>
          <InfoPopover
            label="Long-Term Memory version"
            content={`Package version: ${props.package?.version ?? "unknown"}.`}
          />
        </div>
        <section
          data-ltm-surface="overview"
          aria-label="Memory status"
          className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]"
        >
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
            <strong className="text-[var(--foreground)]">
              {status.data ? status.data.notes.total : "--"}
            </strong>{" "}
            memories
          </span>
          <span className="hidden whitespace-nowrap lg:inline">
            <strong className="text-[var(--foreground)]">
              {status.data ? (status.data.indexes.chunkCount ?? "--") : "--"}
            </strong>{" "}
            indexed chunks
          </span>
          <span className="hidden items-center gap-1.5 whitespace-nowrap sm:inline-flex">
            <span className={`h-1.5 w-1.5 rounded-full ${healthTone}`} />
            {status.isError
              ? "Status unavailable"
              : status.data
                ? healthLabel
                : "Loading status"}
            {status.data && needsHealthAttention ? (
              <InfoPopover
                label="How to repair vault health"
                content="Check Settings > Maintenance > Reindex recall data."
              />
            ) : null}
          </span>
          {props.chatId ? (
            <div className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="hidden xl:inline">
                Active in{" "}
                <strong className="text-[var(--foreground)]">
                  {props.chatName ?? "this chat"}
                </strong>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={props.enabledForChat === true}
                aria-label={`Active in ${props.chatName ?? "this chat"}`}
                data-ltm-control="activation"
                className="relative h-9 w-10 rounded-md bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50 before:absolute before:left-0 before:top-1.5 before:h-6 before:w-10 before:rounded-full before:bg-[var(--secondary)] before:transition-colors aria-checked:before:bg-[var(--primary)] after:absolute after:left-1 after:top-2.5 after:h-4 after:w-4 after:rounded-full after:bg-[var(--foreground)] after:transition-transform aria-checked:after:translate-x-4"
                disabled={activationPending || !props.onEnabledForChatChange}
                onClick={() => void toggleActivation()}
              />
            </div>
          ) : null}
          {destination === "vault" ? (
            <div className="relative">
              <Button
                primary
                className="min-h-9 min-w-9 px-2"
                onClick={() => setAddOpen((value) => !value)}
                aria-expanded={addOpen}
                aria-controls="ltm-add-menu"
                aria-label="Add memories"
              >
                <CirclePlus aria-hidden="true" size="0.875rem" />
                <span className="hidden xl:inline">Add memories</span>
              </Button>
              {addOpen ? (
                <div
                  id="ltm-add-menu"
                  aria-label="Add memories"
                  className="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 shadow-lg"
                >
                  <div className="px-2 py-1">
                    <h2 className="text-sm font-semibold">Add memories</h2>
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      Durable context usually starts in an existing source.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void openSources()}
                    className="mt-1 flex min-h-16 w-full items-center gap-3 rounded-md bg-[var(--primary)]/10 p-3 text-left hover:bg-[var(--primary)]/15"
                  >
                    <Upload
                      aria-hidden="true"
                      size="1rem"
                      className="shrink-0 text-[var(--primary)]"
                    />
                    <span>
                      <strong className="block text-sm">Import sources</strong>
                      <span className="block text-xs text-[var(--primary)]">
                        Recommended
                      </span>
                      <span className="block text-xs text-[var(--muted-foreground)]">
                        Characters, lorebooks, and chat summaries
                      </span>
                    </span>
                  </button>
                  <div className="my-1 border-t border-[var(--border)]" />
                  <button
                    type="button"
                    onClick={() => {
                      setAddOpen(false);
                      setCreateMemoryRequest(Date.now());
                    }}
                    className="flex min-h-14 w-full items-center gap-3 rounded-md p-3 text-left hover:bg-[var(--accent)]"
                  >
                    <Pencil
                      aria-hidden="true"
                      size="1rem"
                      className="shrink-0"
                    />
                    <span>
                      <strong className="block text-sm">Create manually</strong>
                      <span className="block text-xs text-[var(--muted-foreground)]">
                        One-off durable context
                      </span>
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
        <IconButton
          icon={CircleHelp}
          label="Show setup guide"
          onClick={() => {
            setOnboardingStep(0);
            setOnboardingOpen(true);
          }}
          className="border-transparent bg-transparent"
        />
        <IconButton
          icon={Settings2}
          label="Manage package"
          data-ltm-control="manage-package"
          onClick={props.onManagePackage}
          className="border-transparent bg-transparent"
        />
      </header>
      <div className="flex w-full flex-1 flex-col gap-5 overflow-y-auto px-4 py-5 sm:px-6 md:flex-row">
        <LongTermMemoryNavigation
          destination={destination}
          onDestinationChange={selectDestination}
          badges={{
            memories: status.data?.notes.total,
            review: pendingDrafts.data?.count,
          }}
        />
        <div className="min-w-0 flex-1 space-y-5">
          {activationError ? (
            <StatusSurface tone="danger">{activationError}</StatusSurface>
          ) : null}
          {status.isError ? (
            <StatusSurface tone="danger">
              Long-Term Memory status could not load.
            </StatusSurface>
          ) : null}
          {onboardingOpen ? (
            <section
              aria-labelledby="ltm-onboarding-title"
              data-ltm-surface="onboarding"
              className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--secondary)]/45"
            >
              <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
                <img
                  src="/sprites/mari/chibi-professor-mari.png"
                  alt=""
                  draggable={false}
                  className="h-10 w-10 shrink-0 object-contain"
                />
                <p className="min-w-0 flex-1 text-xs font-semibold">
                  Professor Mari's setup guide
                </p>
                <p
                  aria-live="polite"
                  className="shrink-0 text-xs text-[var(--muted-foreground)]"
                >
                  Step {onboardingStep + 1} of 3
                </p>
              </div>
              <div className="grid items-center gap-5 p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_12rem]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h2
                      id="ltm-onboarding-title"
                      className="text-lg font-semibold"
                    >
                      {onboardingStep === 0
                        ? "Meet Long-Term Memory"
                        : onboardingStep === 1
                          ? "Enable It for a Chat"
                          : "Add Memories"}
                    </h2>
                    <p className="max-w-[65ch] text-sm leading-6 text-[var(--muted-foreground)]">
                      {onboardingStep === 0
                        ? "Long-Term Memory saves durable facts from chats, characters, and lorebooks, then recalls relevant details when they matter. Your existing Memory Settings are ready to use."
                        : onboardingStep === 1
                          ? props.chatId
                            ? props.enabledForChat
                              ? `Long-Term Memory is active in ${props.chatName ?? "this chat"}.`
                              : `Use the Active in ${props.chatName ?? "this chat"} switch above to turn it on.`
                            : "Open a supported chat, then use Chat Settings > Agents > Misc Agents to add Long-Term Memory."
                          : "Open Sources to import chat summaries, characters, or lorebooks. Imported information appears in Memory Vault and can be recalled in chats where Long-Term Memory is active."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {onboardingStep > 0 ? (
                      <Button
                        onClick={() => setOnboardingStep((step) => step - 1)}
                      >
                        Back
                      </Button>
                    ) : null}
                    {onboardingStep < 2 ? (
                      <Button
                        primary
                        onClick={() => setOnboardingStep((step) => step + 1)}
                      >
                        Next
                      </Button>
                    ) : (
                      <Button
                        primary
                        onClick={async () => {
                          if (await openSources()) completeOnboarding();
                        }}
                      >
                        Open Sources
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        if (onboardingStep < 2 || destination === "vault")
                          completeOnboarding();
                        else void selectDestination("vault");
                      }}
                    >
                      {onboardingStep === 2 ? "Finish for now" : "Skip"}
                    </Button>
                  </div>
                </div>
                <img
                  src={
                    onboardingStep === 0
                      ? "/sprites/mari/Mari_wave.png"
                      : onboardingStep === 1
                        ? "/sprites/mari/Mari_point_middle_left.png"
                        : "/sprites/mari/Mari_explaining.png"
                  }
                  alt={
                    onboardingStep === 0
                      ? "Professor Mari welcomes you to Long-Term Memory"
                      : onboardingStep === 1
                        ? "Professor Mari points toward the chat activation control"
                        : "Professor Mari explains how to add memory sources"
                  }
                  draggable={false}
                  className="order-first h-24 w-full object-contain md:order-last md:h-36"
                />
              </div>
            </section>
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
              onOpenReview={openReview}
              onRecoverCandidate={recoverCandidate}
              openedNoteId={openedNoteId}
              createMemoryRequest={createMemoryRequest}
              onCreateMemoryRequestHandled={() => setCreateMemoryRequest(null)}
              reviewSourceNoteId={reviewSourceNoteId}
              recoveryHandoff={recoveryHandoff}
            />
          </Suspense>
        </div>
      </div>
      <LongTermMemoryNavigation
        mobile
        destination={destination}
        onDestinationChange={selectDestination}
        badges={{
          memories: status.data?.notes.total,
          review: pendingDrafts.data?.count,
        }}
      />
    </main>
  );
}
