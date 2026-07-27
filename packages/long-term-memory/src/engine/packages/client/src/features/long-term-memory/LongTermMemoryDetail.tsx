import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BrainCircuit,
  CircleHelp,
  Pencil,
  Plus,
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

const onboardingSteps = [
  {
    label: "How it works",
    title: "How Long-Term Memory Works",
    mobileSprite: "Mari_wave.png",
    desktopSprite: "Mari_wave.png",
    mobileFlip: false,
    alt: "",
  },
  {
    label: "Activate",
    title: "Activate For A Chat",
    mobileSprite: "Mari_point_up_left.png",
    desktopSprite: "Mari_point_up_left.png",
    mobileFlip: true,
    alt: "",
  },
  {
    label: "Import",
    title: "Import Sources",
    mobileSprite: "Mari_point_down_left.png",
    desktopSprite: "Mari_point_middle_left.png",
    alt: "",
    mobileFlip: true,
  },
  {
    label: "Review",
    title: "Review Proposed Memories",
    mobileSprite: "Mari_point_down_left.png",
    desktopSprite: "Mari_point_up_left.png",
    mobileFlip: false,
    alt: "",
  },
  {
    label: "Recall",
    title: "Save And Recall",
    mobileSprite: "Mari_explaining.png",
    desktopSprite: "Mari_explaining.png",
    mobileFlip: false,
    alt: "",
  },
] as const;

const destinations = {
  vault: lazy(() => import("./MemoryVault")),
  review: lazy(() => import("./ReviewQueue")),
  sources: lazy(() => import("./SourcesWorkspace")),
  settings: lazy(() => import("./MemorySettings")),
} as const;
const destinationLabels: Record<LongTermMemoryDestination, string> = {
  vault: "Memory Vault",
  review: "Review Queue",
  sources: "Sources",
  settings: "Memory Settings",
};

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
  const addMenuRef = useRef<HTMLDivElement>(null);
  const addTriggerRef = useRef<HTMLButtonElement>(null);
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
    if (!addOpen) return;
    const dismiss = () => {
      setAddOpen(false);
      addTriggerRef.current?.focus();
    };
    const close = (event: PointerEvent) => {
      if (!addMenuRef.current?.contains(event.target as Node)) dismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [addOpen]);

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
    if (!(await confirmDestinationChange(destinationLabels[next]))) return;
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
      <header className="sticky top-0 z-10 flex min-h-14 flex-nowrap items-center gap-x-1 border-b border-[var(--border)] bg-[var(--background)] px-2 py-1 sm:gap-x-3 sm:px-4">
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
          className="hidden shrink-0 text-[var(--primary)] sm:block"
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
          className="flex shrink-0 items-center gap-1 text-xs text-[var(--muted-foreground)] sm:gap-3"
        >
          <span className="hidden items-center gap-1.5 whitespace-nowrap sm:inline-flex">
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
            <div ref={addMenuRef} className="relative">
              <Button
                ref={addTriggerRef}
                primary
                className="max-sm:min-h-8 min-h-8 min-w-8 px-2 sm:min-h-9 sm:min-w-0 sm:px-3"
                onClick={() => setAddOpen((value) => !value)}
                aria-expanded={addOpen}
                aria-controls="ltm-add-menu"
                aria-label="Add memories"
              >
                <Plus aria-hidden="true" size="0.75rem" />
                <span className="hidden sm:inline">Add memories</span>
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
              <style>{`
                [data-ltm-onboarding-body] {
                  display: grid;
                  grid-template-columns: minmax(0, 1fr);
                  align-items: center;
                  gap: 1.25rem;
                }
                [data-ltm-onboarding-sprite-wrap] {
                  display: flex;
                  min-height: 7rem;
                  align-items: center;
                  justify-content: flex-end;
                }
                [data-ltm-onboarding-sprite] {
                  display: block;
                  width: auto;
                  height: 7rem;
                  max-width: 100%;
                  object-fit: contain;
                }
                [data-ltm-onboarding-sprite][data-ltm-onboarding-mobile-flip] {
                  transform: scaleX(-1);
                }
                @media (min-width: 768px) {
                  [data-ltm-onboarding-body] {
                    grid-template-columns: minmax(0, 1fr) 12rem;
                  }
                  [data-ltm-onboarding-sprite-wrap] {
                    min-height: 11rem;
                    justify-content: center;
                  }
                  [data-ltm-onboarding-sprite] {
                    height: 11rem;
                    max-width: 12rem;
                  }
                  [data-ltm-onboarding-sprite][data-ltm-onboarding-mobile-flip] {
                    transform: none;
                  }
                }
              `}</style>
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
                  Step {onboardingStep + 1} of {onboardingSteps.length} ·{" "}
                  {onboardingSteps[onboardingStep].label}
                </p>
              </div>
              <div data-ltm-onboarding-body className="p-4 sm:p-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h2
                      id="ltm-onboarding-title"
                      className="text-lg font-semibold"
                    >
                      {onboardingSteps[onboardingStep].title}
                    </h2>
                    <p className="max-w-[65ch] text-sm leading-6 text-[var(--muted-foreground)]">
                      {onboardingStep === 0
                        ? "Import information from chats, characters, or lorebooks. Long-Term Memory turns it into proposed memories for you to review. Accepted memories are saved and recalled when relevant."
                        : onboardingStep === 1
                          ? props.chatId
                            ? props.enabledForChat
                              ? `Long-Term Memory is active in ${props.chatName ?? "this chat"}. Relevant saved memories can now be added to this chat's AI context automatically. Recommended settings are already selected.`
                              : `Turn on Active in ${props.chatName ?? "this chat"} above to let this chat use saved memories. Activating it does not change or import anything.`
                            : "Open a supported chat, then use Chat Settings > Agents > Misc Agents to add Long-Term Memory."
                          : onboardingStep === 2
                            ? "Choose a chat summary, character, or lorebook to import. The source is saved first, then extraction produces proposed memories for review."
                            : onboardingStep === 3
                              ? "Review proposed changes before saving them. Edit anything that needs correction, then accept the memories you want to keep."
                              : "Accepted memories appear in Memory Vault and can be recalled when Long-Term Memory is active in a chat."}
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
                    {onboardingStep < onboardingSteps.length - 1 ? (
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
                        Import a source
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        if (
                          onboardingStep < onboardingSteps.length - 1 ||
                          destination === "vault"
                        )
                          completeOnboarding();
                        else void selectDestination("vault");
                      }}
                    >
                      {onboardingStep === onboardingSteps.length - 1
                        ? "Explore Memory Vault"
                        : "Skip"}
                    </Button>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    You can replay this guide with the help button above.
                  </p>
                </div>
                <div data-ltm-onboarding-sprite-wrap>
                  <picture>
                    <source
                      media="(min-width: 768px)"
                      srcSet={`/sprites/mari/${onboardingSteps[onboardingStep].desktopSprite}`}
                    />
                    <img
                      src={`/sprites/mari/${onboardingSteps[onboardingStep].mobileSprite}`}
                      alt={onboardingSteps[onboardingStep].alt}
                      draggable={false}
                      data-ltm-onboarding-sprite={
                        onboardingSteps[onboardingStep].mobileSprite
                      }
                      data-ltm-onboarding-mobile-flip={
                        onboardingSteps[onboardingStep].mobileFlip || undefined
                      }
                    />
                  </picture>
                </div>
              </div>
            </section>
          ) : null}
          <Suspense
            fallback={
              <StatusSurface busy>Loading {destinationLabels[destination]}...</StatusSurface>
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
