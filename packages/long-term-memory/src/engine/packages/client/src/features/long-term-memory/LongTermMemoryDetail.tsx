import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CircleHelp,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  TriangleAlert,
  Upload,
} from "lucide-react";
import type { LtmStatusResponse } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { queryKeys, request } from "./api";
import { LongTermMemoryNavigation } from "./LongTermMemoryNavigation";
import { Button, IconButton, InfoPopover, StatusSurface } from "./shared-controls";
import type {
  CapabilityProps,
  LongTermMemoryDestination,
  LongTermMemoryDestinationProps,
  LtmRecoveryHandoff,
  SourceTab,
} from "./types";
import { useLtmTranslation } from "./localization";

const onboardingStorageKey = "marinara-long-term-memory-onboarding-v1";
const onboardingStepPattern = /^step:(\d+)$/u;
const persistOnboardingStep = (step: number) => {
  try {
    localStorage.setItem(onboardingStorageKey, `step:${step}`);
  } catch {}
};

const onboardingSteps = [
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.save",
    titleKey: "ui.longTermMemory.longtermmemorydetail.fromSourceToSavedMemory",
    mobileSprite: "Mari_wave.png",
    desktopSprite: "Mari_wave.png",
    mobileFlip: false,
    alt: "",
  },
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.recall",
    titleKey: "ui.longTermMemory.longtermmemorydetail.howRecallWorks",
    mobileSprite: "Mari_explaining.png",
    desktopSprite: "Mari_explaining.png",
    mobileFlip: false,
    alt: "",
  },
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.activate",
    titleKey: "ui.longTermMemory.longtermmemorydetail.turnItOnForThisChat",
    mobileSprite: "Mari_point_up_left.png",
    desktopSprite: "Mari_point_up_left.png",
    mobileFlip: false,
    alt: "",
  },
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.import",
    titleKey: "ui.longTermMemory.longtermmemorydetail.chooseWhatToRemember",
    mobileSprite: "Mari_point_down_left.png",
    desktopSprite: "Mari_point_middle_left.png",
    alt: "",
    mobileFlip: false,
  },
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.review",
    titleKey: "ui.longTermMemory.longtermmemorydetail.reviewBeforeSaving",
    mobileSprite: "Mari_point_down_left.png",
    desktopSprite: "Mari_point_up_left.png",
    mobileFlip: false,
    alt: "",
  },
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.check",
    titleKey: "ui.longTermMemory.longtermmemorydetail.checkWhatTheChatUsed",
    mobileSprite: "Mari_thinking.png",
    desktopSprite: "Mari_thinking.png",
    mobileFlip: false,
    alt: "",
  },
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.underTheHood",
    titleKey: "ui.longTermMemory.longtermmemorydetail.underTheHoodTitle",
    mobileSprite: "Mari_thinking.png",
    desktopSprite: "Mari_thinking.png",
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
const destinationLabelKeys: Record<LongTermMemoryDestination, string> = {
  vault: "ui.longTermMemory.longtermmemorynavigation.memoryVault",
  review: "ui.longTermMemory.longtermmemorynavigation.reviewQueue",
  sources: "ui.longTermMemory.longtermmemorynavigation.sources",
  settings: "ui.longTermMemory.longtermmemorynavigation.memorySettings",
};

export function LongTermMemoryDetail({ props }: { props: CapabilityProps }) {
  const { t: localizeUi } = useLtmTranslation();
  const backToAgentsLabel = localizeUi("ui.longTermMemory.longtermmemorydetail.backToAgents");
  const addMemoriesLabel = localizeUi("ui.longTermMemory.longtermmemorydetail.addMemories");
  const status = useQuery({
    queryKey: queryKeys.status,
    queryFn: () => request<LtmStatusResponse>("/status"),
  });
  const pendingDrafts = useQuery({
    queryKey: queryKeys.pendingDrafts,
    queryFn: () => request<{ count: number }>("/drafts/pending-count"),
  });
  const [destination, setDestination] = useState<LongTermMemoryDestination>("vault");
  const [activationPending, setActivationPending] = useState(false);
  const [activationError, setActivationError] = useState("");
  const [repairPending, setRepairPending] = useState(false);
  const [repairMessage, setRepairMessage] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const addTriggerRef = useRef<HTMLButtonElement>(null);
  const [createMemoryRequest, setCreateMemoryRequest] = useState<number | null>(null);
  const [destinationDirty, setDestinationDirty] = useState(false);
  const destinationSaveRef = useRef<(() => Promise<boolean>) | null>(null);
  const navigationSaveInFlightRef = useRef(false);
  const [navigationSaveInFlight, setNavigationSaveInFlight] = useState(false);
  const [navigationPrompt, setNavigationPrompt] = useState<string | null>(null);
  const navigationDialogRef = useRef<HTMLDialogElement>(null);
  const navigationResolveRef = useRef<((allow: boolean) => void) | null>(null);
  const navigationTriggerRef = useRef<HTMLElement | null>(null);
  const [openedNoteId, setOpenedNoteId] = useState<string | null>(null);
  const [reviewSourceNoteId, setReviewSourceNoteId] = useState<string | null>(null);
  const [recoveryHandoff, setRecoveryHandoff] = useState<LtmRecoveryHandoff | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [requestedSource, setRequestedSource] = useState<{
    key: number;
    source: SourceTab;
  } | null>(null);
  const [selectedSource, setSelectedSource] = useState<SourceTab>("chats");
  const [openActivityRequest, setOpenActivityRequest] = useState(0);
  const [onboardingSource, setOnboardingSource] = useState<SourceTab>("chats");
  const Destination = destinations[destination];
  const destinationLabel = (value: LongTermMemoryDestination) => localizeUi(destinationLabelKeys[value]);

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
    if (!navigationPrompt) return;
    const dialog = navigationDialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-ltm-destination-stay]")?.focus();
  }, [navigationPrompt]);

  useEffect(() => {
    props.onDirtyChange?.(destinationDirty);
    return () => props.onDirtyChange?.(false);
  }, [destinationDirty, props.onDirtyChange]);

  useEffect(() => {
    if (!status.isSuccess) return;
    let stored = "";
    try {
      stored = localStorage.getItem(onboardingStorageKey) ?? "";
    } catch {}
    if (stored === "complete") return;
    const match = onboardingStepPattern.exec(stored);
    const savedStep = match ? Number(match[1]) : null;
    if (savedStep !== null && Number.isInteger(savedStep) && savedStep >= 0 && savedStep < onboardingSteps.length) {
      setOnboardingStep(savedStep);
      setOnboardingOpen(true);
      return;
    }
    if (status.data.notes.savedMemories !== 0) return;
    setOnboardingOpen(true);
  }, [status.isSuccess, status.data?.notes.savedMemories]);

  const completeOnboarding = () => {
    setOnboardingOpen(false);
    try {
      localStorage.setItem(onboardingStorageKey, "complete");
    } catch {}
  };
  const suspendOnboarding = () => {
    persistOnboardingStep(onboardingStep);
    setOnboardingOpen(false);
  };

  useEffect(() => {
    if (!onboardingOpen) return;
    persistOnboardingStep(onboardingStep);
  }, [onboardingOpen, onboardingStep]);

  const confirmDestinationChange = async (next: string) => {
    if (!destinationDirty) return true;
    if (destinationSaveRef.current) {
      return new Promise<boolean>((resolve) => {
        navigationResolveRef.current?.(false);
        navigationResolveRef.current = resolve;
        navigationTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setNavigationPrompt(next);
      });
    }
    const options = {
      title: localizeUi("ui.longTermMemory.longtermmemorydetail.discardUnsavedChanges"),
      message: localizeUi("ui.longTermMemory.longtermmemorydetail.unsavedChangesLostBeforeOpening", {
        destination: next,
      }),
      confirmLabel: localizeUi("ui.longTermMemory.longtermmemorydetail.discardChanges"),
      tone: "destructive" as const,
    };
    return props.confirmAction
      ? await props.confirmAction(options)
      : window.confirm(
          localizeUi("ui.longTermMemory.longtermmemorydetail.confirmationWithMessage", {
            title: options.title,
            message: options.message,
          }),
        );
  };
  const finishNavigationPrompt = async (decision: "save" | "discard" | "stay") => {
    if (decision === "save") {
      if (navigationSaveInFlightRef.current) return;
      navigationSaveInFlightRef.current = true;
      setNavigationSaveInFlight(true);
      try {
        if (!(await destinationSaveRef.current?.())) return;
      } finally {
        navigationSaveInFlightRef.current = false;
        setNavigationSaveInFlight(false);
      }
    }
    const resolve = navigationResolveRef.current;
    navigationResolveRef.current = null;
    navigationDialogRef.current?.close();
    setNavigationPrompt(null);
    resolve?.(decision !== "stay");
    requestAnimationFrame(() => navigationTriggerRef.current?.focus({ preventScroll: true }));
    navigationTriggerRef.current = null;
  };
  const selectDestination = async (next: LongTermMemoryDestination) => {
    if (next === destination) return true;
    if (!(await confirmDestinationChange(destinationLabel(next)))) return false;
    setDestinationDirty(false);
    if (next === "review") setReviewSourceNoteId(null);
    if (next === "vault") setOpenedNoteId(null);
    if (next !== "vault") setRecoveryHandoff(null);
    setAddOpen(false);
    setDestination(next);
    return true;
  };
  const close = async () => {
    if (!(await confirmDestinationChange(localizeUi("ui.longTermMemory.longtermmemorydetail.agents")))) return;
    setDestinationDirty(false);
    props.onDirtyChange?.(false);
    props.onClose?.();
  };
  const openMemory = async (noteId: string) => {
    if (!(await confirmDestinationChange(destinationLabel("vault")))) return;
    setRecoveryHandoff(null);
    setOpenedNoteId(noteId);
    setDestinationDirty(false);
    setDestination("vault");
  };
  const openReview = async (sourceNoteId?: string) => {
    if (!(await confirmDestinationChange(destinationLabel("review")))) return false;
    setDestinationDirty(false);
    setReviewSourceNoteId(sourceNoteId ?? null);
    setDestination("review");
    return true;
  };
  const recoverCandidate: NonNullable<LongTermMemoryDestinationProps["onRecoverCandidate"]> = async (
    candidate,
    scope,
    modes,
    rejectedSuggestionId,
  ) => {
    if (!(await confirmDestinationChange(destinationLabel("vault")))) return;
    setOpenedNoteId(null);
    setRecoveryHandoff({
      key: Date.now(),
      candidate,
      scope,
      modes,
      rejectedSuggestionId,
    });
    setDestinationDirty(false);
    setDestination("vault");
  };
  const openSources = async (source?: SourceTab) => {
    if (!(await confirmDestinationChange(destinationLabel("sources")))) return false;
    setDestinationDirty(false);
    setAddOpen(false);
    if (source) {
      setRequestedSource({ key: Date.now(), source });
      setSelectedSource(source);
    }
    setDestination("sources");
    return true;
  };
  const openActivity = async () => {
    if (!(await confirmDestinationChange(destinationLabel("settings")))) return;
    setDestinationDirty(false);
    setOpenActivityRequest((value) => value + 1);
    setDestination("settings");
  };
  const toggleActivation = async () => {
    if (!props.onEnabledForChatChange) return;
    setActivationPending(true);
    setActivationError("");
    try {
      await props.onEnabledForChatChange(!props.enabledForChat);
    } catch (error) {
      setActivationError(
        error instanceof Error
          ? error.message
          : localizeUi("ui.longTermMemory.longtermmemorydetail.couldNotUpdateThisChat"),
      );
    } finally {
      setActivationPending(false);
    }
  };

  const indexHealth = status.data?.indexes;
  const savedMemoryCount = status.data?.notes.savedMemories ?? 0;
  const health =
    indexHealth?.rebuildState === "building"
      ? "building"
      : indexHealth?.rebuildState === "failed"
        ? "failed"
        : indexHealth?.health;
  const healthLabel = localizeUi(
    {
      healthy: "ui.longTermMemory.longtermmemorydetail.vaultHealthy",
      building: "ui.longTermMemory.longtermmemorydetail.vaultRebuilding",
      failed: "ui.longTermMemory.longtermmemorydetail.rebuildFailed",
      degraded: "ui.longTermMemory.longtermmemorydetail.vaultDegraded",
      stale: "ui.longTermMemory.longtermmemorydetail.vaultStale",
      corrupt: "ui.longTermMemory.longtermmemorydetail.vaultCorrupt",
      not_built: "ui.longTermMemory.longtermmemorydetail.vaultNotBuilt",
    }[health ?? "not_built"],
  );
  const emptyUnbuiltVault = health === "not_built" && savedMemoryCount === 0;
  const needsHealthAttention = ["building", "degraded", "stale", "corrupt", "failed"].includes(health ?? "");
  const embeddingsNeedAttention = indexHealth?.embeddingsAvailable === false && savedMemoryCount > 0;
  const healthTone =
    !status.data || emptyUnbuiltVault
      ? "bg-[var(--muted-foreground)]"
      : health === "healthy"
        ? "bg-[var(--marinara-editor-accent)]"
        : health === "corrupt" || health === "failed"
          ? "bg-[var(--destructive)]"
          : "bg-[var(--marinara-editor-accent)] opacity-50";
  const healthNeedsDangerTone = health === "corrupt" || health === "failed";
  const indexedChunks = status.data?.indexes.chunkCount ?? "--";
  const repairRecall = async () => {
    setRepairPending(true);
    setRepairMessage("");
    try {
      await request("/repair", "POST", { actions: ["rebuild_indexes"] });
      setRepairMessage(localizeUi("ui.longTermMemory.longtermmemorydetail.reindexComplete"));
      await status.refetch();
    } catch (error) {
      setRepairMessage(
        error instanceof Error ? error.message : localizeUi("ui.longTermMemory.longtermmemorydetail.reindexFailed"),
      );
    } finally {
      setRepairPending(false);
    }
  };
  const repairButton = () => (
    <Button disabled={repairPending} onClick={() => void repairRecall()}>
      <RefreshCw aria-hidden="true" size="0.75rem" className={repairPending ? "animate-spin" : ""} />
      {localizeUi("ui.longTermMemory.longtermmemorydetail.reindexRecall")}
    </Button>
  );
  const healthInfo = (
    <div className="space-y-2">
      <strong className="block text-[var(--marinara-editor-text)]">{healthLabel}</strong>
      <p>
        {indexedChunks} {localizeUi("ui.longTermMemory.longtermmemorydetail.indexedChunks")}
      </p>
      <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.checkSettingsMaintenanceReindexRecallData")}</p>
      {indexHealth?.embeddingsAvailable === false && savedMemoryCount > 0 ? (
        <p className="text-[var(--marinara-editor-warning)]">
          {localizeUi("ui.longTermMemory.longtermmemorydetail.savedButNotSearchable")}
        </p>
      ) : null}
      {indexHealth?.rebuildState === "failed" ? (
        <p className="text-[var(--destructive)]">
          {localizeUi("ui.longTermMemory.longtermmemorydetail.semanticRecallUnavailable")}
        </p>
      ) : null}
      {repairButton()}
      {repairMessage ? <p role="status">{repairMessage}</p> : null}
    </div>
  );
  const chatLabel = props.chatName ?? localizeUi("ui.longTermMemory.longtermmemorydetail.thisChat");
  const connectedChat = Boolean(props.chatId);
  const activeChat = connectedChat && props.enabledForChat === true;
  const openPromptPresetSections = () => {
    suspendOnboarding();
    props.onOpenActivePromptPresetEditor?.();
  };
  const openChatSummarySettings = () => {
    suspendOnboarding();
    props.onOpenChatSummarySettings?.();
  };
  const advanceOnboarding = () =>
    setOnboardingStep((step) => {
      const next = Math.min(step + 1, onboardingSteps.length - 1);
      persistOnboardingStep(next);
      return next;
    });
  const activateForOnboarding = async () => {
    if (!props.onEnabledForChatChange || activationPending) return;
    setActivationPending(true);
    setActivationError("");
    try {
      await props.onEnabledForChatChange(true);
      advanceOnboarding();
    } catch (error) {
      setActivationError(
        error instanceof Error
          ? error.message
          : localizeUi("ui.longTermMemory.longtermmemorydetail.couldNotUpdateThisChat"),
      );
    } finally {
      setActivationPending(false);
    }
  };

  return (
    <main
      data-ltm-surface="detail"
      aria-labelledby="ltm-detail-title"
      className="mari-editor-shell mari-editor-legacy-bridge flex min-h-0 flex-1 flex-col overflow-hidden"
      style={{ containerName: "ltm-detail", containerType: "inline-size" }}
    >
      <style>{`
        [data-ltm-surface="detail"] [data-ltm-navigation="desktop"] {
          display: flex;
        }
        [data-ltm-surface="detail"] [data-ltm-navigation="mobile"] {
          display: none;
        }
        [data-ltm-mobile-navigation] {
          display: none;
        }
        @container ltm-detail (max-width: 47.99rem) {
          [data-ltm-surface="detail"] [data-ltm-navigation="desktop"] {
            display: none;
          }
          [data-ltm-surface="detail"] [data-ltm-navigation="mobile"] {
            display: grid;
          }
          [data-ltm-mobile-navigation] {
            display: block;
          }
        }
        [data-ltm-navigation="mobile"] > [data-ltm-control="navigation"] {
          min-height: 2.75rem;
          min-width: 0;
          width: 100%;
        }
        [data-ltm-navigation="mobile"] {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        [data-ltm-navigation="mobile"] [data-ltm-badge] {
          position: absolute;
          left: 0.375rem;
          top: 0.375rem;
          margin-left: 0;
        }
        [data-ltm-control="activation"] {
          display: inline-flex;
          width: auto;
          height: 2.75rem;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          border: 0;
          border-radius: 0.375rem;
          background: transparent;
          padding: 0 0.25rem;
        }
        [data-ltm-activation-label] {
          color: var(--marinara-editor-text);
          font-size: 0.8125rem;
          font-weight: 600;
          line-height: 1.25;
        }
        [data-ltm-activation-track] {
          display: flex;
          box-sizing: border-box;
          width: 2.75rem;
          height: 1.5rem;
          align-items: center;
          border: 1px solid var(--marinara-editor-border-strong);
          border-radius: 9999px;
          background: var(--marinara-editor-control-bg);
          padding: 0.125rem;
          transition: background-color 150ms ease, border-color 150ms ease;
        }
        [data-ltm-control="activation"][aria-checked="true"] [data-ltm-activation-track] {
          border-color: var(--marinara-editor-accent);
          background: var(--marinara-editor-accent);
        }
        [data-ltm-activation-knob] {
          display: block;
          width: 1.25rem;
          height: 1.25rem;
          border-radius: 9999px;
          background: var(--marinara-editor-text);
          box-shadow: 0 1px 2px color-mix(in srgb, #000 25%, transparent);
          transform: translateX(0);
          transition: transform 150ms ease;
        }
        [data-ltm-control="activation"][aria-checked="true"] [data-ltm-activation-knob] {
          transform: translateX(1.125rem);
        }
        [data-ltm-control="activation"]:focus-visible {
          outline: none;
          box-shadow: 0 0 0 0.125rem var(--marinara-editor-focus-ring);
        }
        [data-ltm-control="activation"]:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
        @container ltm-detail (max-width: 47.99rem) {
          [data-ltm-control="activation"] {
            min-width: 3rem;
          }
        }
        @container ltm-detail (max-width: 47.99rem) {
          [data-ltm-surface="detail"] > .mari-editor-header {
            flex-wrap: nowrap;
            gap: 0.375rem;
            padding-inline: 0.625rem;
          }
          [data-ltm-surface="detail"] > .mari-editor-header > .mari-editor-header-main {
            flex-basis: auto;
            gap: 0.5rem;
          }
          [data-ltm-surface="detail"] > .mari-editor-header > .mari-editor-actions {
            width: auto;
            gap: 0.25rem;
            border-top: 0;
            padding-top: 0;
          }
          [data-ltm-control="activation"] {
            gap: 0.375rem;
            padding-inline: 0.125rem;
          }
        }
        @container ltm-detail (max-width: 22.49rem) {
          [data-ltm-surface="detail"] > .mari-editor-header {
            gap: 0.25rem;
            padding-inline: 0.5rem;
          }
          [data-ltm-surface="detail"] > .mari-editor-header > .mari-editor-header-main {
            gap: 0.375rem;
          }
          [data-ltm-surface="detail"] > .mari-editor-header .mari-editor-icon-tile {
            display: none;
          }
        }
      `}</style>
      {navigationPrompt ? (
        <dialog
          ref={navigationDialogRef}
          aria-modal="true"
          aria-labelledby="ltm-destination-unsaved-title"
          aria-describedby="ltm-destination-unsaved-description"
          onCancel={(event) => {
            event.preventDefault();
            void finishNavigationPrompt("stay");
          }}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const focusable = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
              ),
            );
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }}
          className="fixed inset-0 z-50 m-0 grid h-full w-full place-items-center bg-black/50 p-4"
        >
          <section className="w-full max-w-md space-y-4 rounded-md border border-[var(--border)] bg-[var(--background)] p-5 shadow-xl">
            <h2 id="ltm-destination-unsaved-title" className="text-base font-semibold">
              {localizeUi("ui.longTermMemory.memoryvault.unsavedNavigationTitle")}
            </h2>
            <p id="ltm-destination-unsaved-description" className="text-sm text-[var(--muted-foreground)]">
              {localizeUi("ui.longTermMemory.memoryvault.unsavedNavigationDescription", { action: navigationPrompt })}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                disabled={navigationSaveInFlight}
                data-ltm-destination-stay
                onClick={() => void finishNavigationPrompt("stay")}
              >
                {localizeUi("ui.longTermMemory.memoryvault.stay")}
              </Button>
              <Button
                disabled={navigationSaveInFlight}
                destructive
                onClick={() => void finishNavigationPrompt("discard")}
              >
                {localizeUi("ui.longTermMemory.memoryvault.discardAndContinue")}
              </Button>
              <Button disabled={navigationSaveInFlight} primary onClick={() => void finishNavigationPrompt("save")}>
                {localizeUi("ui.longTermMemory.memoryvault.saveAndContinue")}
              </Button>
            </div>
          </section>
        </dialog>
      ) : null}
      <header className="mari-editor-header relative z-20">
        <div className="mari-editor-header-main">
          <button
            type="button"
            aria-label={backToAgentsLabel}
            title={backToAgentsLabel}
            data-ltm-control="back"
            onClick={() => void close()}
            className="mari-editor-action inline-flex"
          >
            <ArrowLeft aria-hidden="true" size="1.125rem" />
          </button>
          <span className="mari-editor-icon-tile">
            <Sparkles aria-hidden="true" size="1.125rem" className="max-md:!h-[0.875rem] max-md:!w-[0.875rem]" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 id="ltm-detail-title" className="mari-editor-title truncate">
              {props.agent?.name?.trim() || localizeUi("ui.longTermMemory.longtermmemorydetail.longTermMemory")}
            </h1>
            <p className="mari-editor-meta mt-0.5">
              {props.agent?.author?.trim() || "Pasta Devs"}
              {props.package?.version ? ` · v${props.package.version}` : ""}
            </p>
          </div>
        </div>
        <div className="mari-editor-actions flex">
          {props.chatId || props.onEnabledForChatChange ? (
            <button
              type="button"
              role="switch"
              aria-checked={props.enabledForChat === true}
              aria-label={localizeUi(
                props.enabledForChat === true
                  ? "ui.longTermMemory.longtermmemorydetail.activeInValue1"
                  : "ui.longTermMemory.longtermmemorydetail.inactiveInValue1",
                {
                  value1: props.chatName ?? localizeUi("ui.longTermMemory.longtermmemorydetail.thisChat"),
                },
              )}
              title={localizeUi(
                props.enabledForChat === true
                  ? "ui.longTermMemory.longtermmemorydetail.activeInValue1"
                  : "ui.longTermMemory.longtermmemorydetail.inactiveInValue1",
                {
                  value1: props.chatName ?? localizeUi("ui.longTermMemory.longtermmemorydetail.thisChat"),
                },
              )}
              data-ltm-control="activation"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-editor-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={activationPending || !props.onEnabledForChatChange}
              onClick={() => void toggleActivation()}
            >
              <span data-ltm-activation-label>
                {localizeUi(
                  props.enabledForChat === true
                    ? "ui.longTermMemory.longtermmemorydetail.active"
                    : "ui.longTermMemory.longtermmemorydetail.inactive",
                )}
              </span>
              <span aria-hidden="true" data-ltm-activation-track>
                <span data-ltm-activation-knob />
              </span>
            </button>
          ) : null}
          {destination === "vault" ? (
            <div ref={addMenuRef} className="relative">
              <Button
                ref={addTriggerRef}
                primary
                className="min-h-11 min-w-11 sm:min-h-9 sm:min-w-0"
                onClick={() => setAddOpen((value) => !value)}
                aria-expanded={addOpen}
                aria-controls={addOpen ? "ltm-add-menu" : undefined}
                aria-label={addMemoriesLabel}
                title={addMemoriesLabel}
              >
                <Plus aria-hidden="true" size="0.75rem" />
                <span className="hidden sm:inline">{addMemoriesLabel}</span>
              </Button>
              {addOpen ? (
                <div
                  id="ltm-add-menu"
                  role="group"
                  aria-labelledby="ltm-add-menu-title"
                  aria-describedby="ltm-add-menu-description"
                  className="mari-editor-panel absolute right-0 z-30 mt-2 w-72 p-2 text-[var(--marinara-editor-text)] shadow-lg"
                >
                  <div className="px-2 py-1">
                    <h2 id="ltm-add-menu-title" className="text-sm font-semibold">
                      {localizeUi("ui.longTermMemory.longtermmemorydetail.addMemories")}
                    </h2>
                    <p id="ltm-add-menu-description" className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      {localizeUi(
                        "ui.longTermMemory.longtermmemorydetail.durableContextUsuallyStartsInAnExistingSource",
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void openSources()}
                    className="mari-editor-tab mt-1 flex min-h-16 w-full items-center gap-3 rounded-md p-3 text-left"
                  >
                    <Upload aria-hidden="true" size="1rem" className="shrink-0 text-[var(--marinara-editor-accent)]" />
                    <span>
                      <strong className="block text-sm">
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.importSources")}
                      </strong>
                      <span className="block text-xs text-[var(--marinara-editor-accent)]">
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.recommended")}
                      </span>
                      <span className="block text-xs text-[var(--muted-foreground)]">
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.charactersLorebooksAndChatSummaries")}
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
                    className="mari-editor-tab flex min-h-14 w-full items-center gap-3 rounded-md p-3 text-left"
                  >
                    <Pencil aria-hidden="true" size="1rem" className="shrink-0" />
                    <span>
                      <strong className="block text-sm">
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.createManually")}
                      </strong>
                      <span className="block text-xs text-[var(--muted-foreground)]">
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.oneOffDurableContext")}
                      </span>
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          <IconButton
            icon={CircleHelp}
            label={localizeUi("ui.longTermMemory.longtermmemorydetail.showSetupGuide")}
            onClick={() => {
              setOnboardingStep(0);
              setOnboardingOpen(true);
            }}
            className="h-11 min-h-11 w-11 min-w-11"
          />
          {props.onManagePackage ? (
            <IconButton
              icon={Settings2}
              label={localizeUi("ui.longTermMemory.longtermmemorydetail.managePackage")}
              data-ltm-control="manage-package"
              onClick={props.onManagePackage}
              className="h-11 min-h-11 w-11 min-w-11"
            />
          ) : null}
        </div>
      </header>
      <div className="mari-editor-content max-md:p-4 max-md:pb-24">
        <div
          className="mari-editor-content-inner mari-editor-content-inner--wide space-y-5"
          style={{ maxWidth: "90rem" }}
        >
          <div className="flex min-h-0 min-w-0 gap-5">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex min-w-0 flex-wrap items-stretch gap-3">
                <LongTermMemoryNavigation
                  destination={destination}
                  onDestinationChange={selectDestination}
                  badges={{
                    memories: savedMemoryCount,
                    review: pendingDrafts.data?.count,
                  }}
                />
                {health !== "healthy" && !needsHealthAttention ? (
                  <div
                    aria-busy={status.isFetching}
                    data-ltm-surface="vault-health-pill"
                    className="mari-editor-panel mari-editor-panel--soft hidden min-h-11 shrink-0 items-center gap-2 px-3 text-xs text-[var(--marinara-editor-muted)] md:flex"
                  >
                    <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${healthTone}`} />
                    <span aria-live="polite" aria-atomic="true">
                      {status.isError
                        ? localizeUi("ui.longTermMemory.longtermmemorydetail.statusUnavailable")
                        : status.data
                          ? healthLabel
                          : localizeUi("ui.longTermMemory.longtermmemorydetail.loadingStatus")}
                    </span>
                    {needsHealthAttention ? null : (
                      <InfoPopover
                        label={localizeUi("ui.longTermMemory.longtermmemorydetail.howToRepairVaultHealth")}
                        content={healthInfo}
                        compact
                      />
                    )}
                  </div>
                ) : null}
              </div>
              {needsHealthAttention ? (
                <StatusSurface
                  tone={healthNeedsDangerTone ? "danger" : "warning"}
                  data-ltm-surface="vault-health-warning"
                  className="min-h-12 justify-between px-3 py-2 text-sm font-medium"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <TriangleAlert
                      aria-hidden="true"
                      size="1rem"
                      className="shrink-0 !text-[var(--marinara-editor-warning)]"
                    />
                    <span className="font-semibold">{healthLabel}</span>
                    <span className="hidden truncate sm:inline">
                      {localizeUi("ui.longTermMemory.longtermmemorydetail.checkSettingsMaintenanceReindexRecallData")}
                    </span>
                  </span>
                  <InfoPopover
                    label={localizeUi("ui.longTermMemory.longtermmemorydetail.howToRepairVaultHealth")}
                    content={healthInfo}
                  />
                  {repairButton()}
                </StatusSurface>
              ) : null}
              {embeddingsNeedAttention && !needsHealthAttention ? (
                <StatusSurface
                  tone="warning"
                  data-ltm-surface="semantic-recall-warning"
                  className="min-h-12 justify-between px-3 py-2 text-sm font-medium"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <TriangleAlert
                      aria-hidden="true"
                      size="1rem"
                      className="shrink-0 !text-[var(--marinara-editor-warning)]"
                    />
                    <span className="font-semibold">
                      {localizeUi("ui.longTermMemory.longtermmemorydetail.savedButNotSearchable")}
                    </span>
                  </span>
                  <InfoPopover
                    label={localizeUi("ui.longTermMemory.longtermmemorydetail.howToRepairVaultHealth")}
                    content={healthInfo}
                  />
                </StatusSurface>
              ) : null}
              <div
                data-ltm-destination-content
                role="region"
                aria-label={destinationLabel(destination)}
                className="min-w-0 space-y-5 [&>section]:scroll-mt-4"
                style={{
                  containerName: "ltm-destination",
                  containerType: "inline-size",
                }}
              >
                {activationError ? <StatusSurface tone="danger">{activationError}</StatusSurface> : null}
                {status.isError ? (
                  <StatusSurface tone="danger">
                    {localizeUi("ui.longTermMemory.longtermmemorydetail.longTermMemoryStatusCouldNotLoad")}
                  </StatusSurface>
                ) : null}
                {onboardingOpen ? (
                  <section
                    aria-labelledby="ltm-onboarding-title"
                    aria-describedby="ltm-onboarding-description"
                    data-ltm-surface="onboarding"
                    className="mari-editor-panel mari-editor-panel--soft overflow-hidden"
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
                [data-ltm-onboarding-sprite][data-ltm-onboarding-mobile-shift="left-40"] {
                  transform: translateX(-40px);
                }
                [data-ltm-onboarding-actions] {
                  display: flex;
                  flex-direction: column;
                  gap: 0.5rem;
                }
                [data-ltm-onboarding-actions] > button {
                  width: 100%;
                }
                [data-ltm-source-choice] {
                  display: grid;
                  grid-template-columns: repeat(3, minmax(0, 1fr));
                  gap: 0.5rem;
                }
                [data-ltm-source-choice] > button {
                  min-width: 0;
                  width: 100%;
                  justify-content: center;
                  text-align: center;
                  white-space: normal;
                }
                [data-ltm-onboarding-footer] {
                  display: flex;
                  justify-content: flex-start;
                  border-top: 1px solid var(--border);
                  padding: 0.75rem 1rem;
                }
                [data-ltm-onboarding-footer] > p {
                  min-width: 0;
                  flex: 1;
                }
                [data-ltm-onboarding-close] {
                  min-height: 2.75rem;
                  padding: 0.375rem 0.625rem;
                  font-size: 0.75rem;
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
                  [data-ltm-onboarding-sprite][data-ltm-onboarding-mobile-shift] {
                    transform: none;
                  }
                  [data-ltm-onboarding-actions] {
                    flex-direction: row;
                    flex-wrap: wrap;
                  }
                  [data-ltm-onboarding-actions] > button {
                    width: auto;
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
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.professorMariSSetupGuide")}
                      </p>
                      <p className="shrink-0 text-xs text-[var(--muted-foreground)]">
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.stepProgress", {
                          current: onboardingStep + 1,
                          total: onboardingSteps.length,
                          label: localizeUi(onboardingSteps[onboardingStep].labelKey),
                        })}
                      </p>
                    </div>
                    <div data-ltm-onboarding-body className="p-4 sm:p-6">
                      <div className="space-y-4">
                        <div className="space-y-2" aria-live="polite" aria-atomic="true">
                          <h2 id="ltm-onboarding-title" className="text-lg font-semibold">
                            {localizeUi(onboardingSteps[onboardingStep].titleKey)}
                          </h2>
                          <div
                            id="ltm-onboarding-description"
                            className="max-w-[65ch] space-y-4 text-sm leading-6 text-[var(--muted-foreground)]"
                          >
                            {onboardingStep === 0 ? (
                              <>
                                <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.memoryStatesIntro")}</p>
                                <dl className="space-y-4">
                                  <div>
                                    <dt className="font-semibold text-[var(--foreground)]">
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.sourceNote")}
                                    </dt>
                                    <dd>{localizeUi("ui.longTermMemory.longtermmemorydetail.sourceNoteDefinition")}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-semibold text-[var(--foreground)]">
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.proposedMemory")}
                                    </dt>
                                    <dd>
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.proposedMemoryDefinition")}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="font-semibold text-[var(--foreground)]">
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.savedMemory")}
                                    </dt>
                                    <dd>
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.savedMemoryDefinition")}
                                    </dd>
                                  </div>
                                </dl>
                              </>
                            ) : onboardingStep === 1 ? (
                              <>
                                <p>
                                  <strong className="font-semibold text-[var(--foreground)]">
                                    {localizeUi("ui.longTermMemory.longtermmemorydetail.recalledMemory")}
                                  </strong>{" "}
                                  {localizeUi("ui.longTermMemory.longtermmemorydetail.recalledMemoryDefinition")}
                                </p>
                                <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.recallNotEveryReply")}</p>
                                <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.recallMatchmaker")}</p>
                              </>
                            ) : onboardingStep === 2 ? (
                              <>
                                {activeChat ? (
                                  <>
                                    <p>
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.activeChatStatus", {
                                        value1: chatLabel,
                                      })}
                                    </p>
                                    <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.activeChatBehavior")}</p>
                                  </>
                                ) : connectedChat ? (
                                  <>
                                    <p>
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.inactiveChatStatus", {
                                        value1: chatLabel,
                                      })}
                                    </p>
                                    <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.inactiveChatAction")}</p>
                                    <p>
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.inactiveChatAvailability")}
                                    </p>
                                    <p>
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.inactiveChatVerification")}
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.noChatAvailability")}</p>
                                    <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.noChatActivationPath")}</p>
                                  </>
                                )}
                                {props.chatMode === "conversation" ? (
                                  <>
                                    <p>
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.conversationPlacementLead")}
                                    </p>
                                    <p>
                                      {localizeUi(
                                        "ui.longTermMemory.longtermmemorydetail.conversationPlacementAdvancedBefore",
                                      )}{" "}
                                      <code>{"{{memories}}"}</code>{" "}
                                      {localizeUi(
                                        "ui.longTermMemory.longtermmemorydetail.conversationPlacementAdvancedBetween",
                                      )}{" "}
                                      <code>{"{{memoryRecall}}"}</code>{" "}
                                      {localizeUi(
                                        "ui.longTermMemory.longtermmemorydetail.conversationPlacementAdvancedAfter",
                                      )}
                                    </p>
                                  </>
                                ) : props.chatMode === "roleplay" || props.chatMode === "game" ? (
                                  <>
                                    <ol className="list-decimal list-outside space-y-1 ps-6">
                                      <li>
                                        {localizeUi(
                                          "ui.longTermMemory.longtermmemorydetail.promptBlockPlacementOpenEditor",
                                        )}
                                      </li>
                                      <li>
                                        {localizeUi(
                                          "ui.longTermMemory.longtermmemorydetail.promptBlockPlacementOpenSections",
                                        )}
                                      </li>
                                      <li>
                                        {localizeUi(
                                          "ui.longTermMemory.longtermmemorydetail.promptBlockPlacementAddAgentSection",
                                        )}
                                      </li>
                                      <li>
                                        {localizeUi(
                                          "ui.longTermMemory.longtermmemorydetail.promptBlockPlacementKeepBlockEnabled",
                                        )}
                                      </li>
                                    </ol>
                                    <p>
                                      {localizeUi(
                                        "ui.longTermMemory.longtermmemorydetail.promptBlockPlacementFallback",
                                      )}
                                    </p>
                                  </>
                                ) : null}
                              </>
                            ) : onboardingStep === 3 ? (
                              <>
                                <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.sourceChoiceIntro")}</p>
                                <ul className="list-disc list-outside space-y-1 ps-6">
                                  <li>
                                    <strong className="font-semibold text-[var(--foreground)]">
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.sourceChats")}
                                    </strong>{" "}
                                    {localizeUi("ui.longTermMemory.longtermmemorydetail.sourceChatDescription")}
                                  </li>
                                  <li>
                                    <strong className="font-semibold text-[var(--foreground)]">
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.sourceLorebooks")}
                                    </strong>{" "}
                                    {localizeUi("ui.longTermMemory.longtermmemorydetail.sourceLorebookDescription")}
                                  </li>
                                  <li>
                                    <strong className="font-semibold text-[var(--foreground)]">
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.sourceCharacters")}
                                    </strong>{" "}
                                    {localizeUi("ui.longTermMemory.longtermmemorydetail.sourceCharacterDescription")}
                                  </li>
                                </ul>
                                <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.sourceChoiceAfterList")}</p>
                              </>
                            ) : onboardingStep === 4 ? (
                              <>
                                <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.reviewIntro")}</p>
                                <ul className="list-disc list-outside space-y-1 ps-6">
                                  <li>
                                    <strong className="font-semibold text-[var(--foreground)]">
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.reviewAccept")}
                                    </strong>{" "}
                                    {localizeUi("ui.longTermMemory.longtermmemorydetail.reviewAcceptConsequence")}
                                  </li>
                                  <li>
                                    <strong className="font-semibold text-[var(--foreground)]">
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.reviewEdit")}
                                    </strong>{" "}
                                    {localizeUi("ui.longTermMemory.longtermmemorydetail.reviewEditConsequence")}
                                  </li>
                                  <li>
                                    <strong className="font-semibold text-[var(--foreground)]">
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.reviewSkip")}
                                    </strong>{" "}
                                    {localizeUi("ui.longTermMemory.longtermmemorydetail.reviewSkipConsequence")}
                                  </li>
                                </ul>
                                <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.reviewStableAppearance")}</p>
                                <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.reviewRecallEligibility")}</p>
                              </>
                            ) : onboardingStep === 5 ? (
                              activeChat ? (
                                <>
                                  <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.verifyIntro")}</p>
                                  <ol className="list-decimal list-outside space-y-1 ps-6">
                                    <li>
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.verifySendMessage", {
                                        value1: chatLabel,
                                      })}
                                    </li>
                                    <li>{localizeUi("ui.longTermMemory.longtermmemorydetail.verifyPeekPrompt")}</li>
                                  </ol>
                                  <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.verifyZeroResults")}</p>
                                </>
                              ) : (
                                <>
                                  <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.verifyPrerequisite")}</p>
                                  <ol className="list-decimal list-outside space-y-1 ps-6">
                                    <li>
                                      {localizeUi(
                                        "ui.longTermMemory.longtermmemorydetail.verifyWithoutChatSendMessage",
                                      )}
                                    </li>
                                    <li>
                                      {localizeUi(
                                        "ui.longTermMemory.longtermmemorydetail.verifyWithoutChatInspectSummary",
                                      )}
                                    </li>
                                  </ol>
                                </>
                              )
                            ) : onboardingStep === 6 ? (
                              <>
                                <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodIntro")}</p>
                                <details className="rounded-md border border-[var(--border)] px-3 py-2">
                                  <summary className="cursor-pointer font-semibold text-[var(--foreground)]">
                                    {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodExtraction")}
                                  </summary>
                                  <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--muted-foreground)]">
                                    <p>
                                      <strong className="font-semibold text-[var(--foreground)]">
                                        {localizeUi(
                                          "ui.longTermMemory.longtermmemorydetail.underTheHoodSourceNotesLabel",
                                        )}
                                      </strong>{" "}
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodSourceNotes")}
                                    </p>
                                    <p>
                                      <strong className="font-semibold text-[var(--foreground)]">
                                        {localizeUi(
                                          "ui.longTermMemory.longtermmemorydetail.underTheHoodFingerprintsLabel",
                                        )}
                                      </strong>{" "}
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodFingerprints")}
                                    </p>
                                    <p>
                                      <strong className="font-semibold text-[var(--foreground)]">
                                        {localizeUi(
                                          "ui.longTermMemory.longtermmemorydetail.underTheHoodCandidatesLabel",
                                        )}
                                      </strong>{" "}
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodCandidates")}
                                    </p>
                                    <p>
                                      <strong className="font-semibold text-[var(--foreground)]">
                                        {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodEvidenceLabel")}
                                      </strong>{" "}
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodEvidence")}
                                    </p>
                                    <p>
                                      <strong className="font-semibold text-[var(--foreground)]">
                                        {localizeUi(
                                          "ui.longTermMemory.longtermmemorydetail.underTheHoodDuplicatesLabel",
                                        )}
                                      </strong>{" "}
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodDuplicates")}
                                    </p>
                                    <p>
                                      <strong className="font-semibold text-[var(--foreground)]">
                                        {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodReviewLabel")}
                                      </strong>{" "}
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodReview")}
                                    </p>
                                  </div>
                                </details>
                                <details className="rounded-md border border-[var(--border)] px-3 py-2">
                                  <summary className="cursor-pointer font-semibold text-[var(--foreground)]">
                                    {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodRecall")}
                                  </summary>
                                  <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--muted-foreground)]">
                                    <ul className="list-disc list-outside space-y-2 ps-6">
                                      <li>
                                        <strong className="font-semibold text-[var(--foreground)]">
                                          {localizeUi(
                                            "ui.longTermMemory.longtermmemorydetail.underTheHoodDirectMatchesLabel",
                                          )}
                                        </strong>{" "}
                                        {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodDirectMatches")}
                                      </li>
                                      <li>
                                        <strong className="font-semibold text-[var(--foreground)]">
                                          {localizeUi(
                                            "ui.longTermMemory.longtermmemorydetail.underTheHoodWordMatchingLabel",
                                          )}
                                        </strong>{" "}
                                        {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodWordMatching")}
                                      </li>
                                      <li>
                                        <strong className="font-semibold text-[var(--foreground)]">
                                          {localizeUi(
                                            "ui.longTermMemory.longtermmemorydetail.underTheHoodKeywordsLabel",
                                          )}
                                        </strong>{" "}
                                        {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodKeywords")}
                                      </li>
                                      <li>
                                        <strong className="font-semibold text-[var(--foreground)]">
                                          {localizeUi(
                                            "ui.longTermMemory.longtermmemorydetail.underTheHoodRelatedMemoriesLabel",
                                          )}
                                        </strong>{" "}
                                        {localizeUi(
                                          "ui.longTermMemory.longtermmemorydetail.underTheHoodRelatedMemories",
                                        )}
                                      </li>
                                      <li>
                                        <strong className="font-semibold text-[var(--foreground)]">
                                          {localizeUi(
                                            "ui.longTermMemory.longtermmemorydetail.underTheHoodMeaningLabel",
                                          )}
                                        </strong>{" "}
                                        {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodMeaning")}
                                      </li>
                                    </ul>
                                    <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodFusion")}</p>
                                    <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodCooldown")}</p>
                                  </div>
                                </details>
                              </>
                            ) : null}
                          </div>
                          {onboardingStep === 3 ? (
                            <>
                              <div
                                data-ltm-source-choice
                                role="group"
                                aria-label={localizeUi("ui.longTermMemory.longtermmemorydetail.sourceChoice")}
                              >
                                {(["chats", "lorebooks", "characters"] as const).map((source) => (
                                  <Button
                                    key={source}
                                    primary={onboardingSource === source}
                                    aria-pressed={onboardingSource === source}
                                    onClick={() => setOnboardingSource(source)}
                                  >
                                    {localizeUi(
                                      `ui.longTermMemory.longtermmemorydetail.source${source[0].toUpperCase()}${source.slice(1)}`,
                                    )}
                                  </Button>
                                ))}
                              </div>
                              {onboardingSource === "chats" ? (
                                <div className="max-w-[65ch] space-y-4 text-sm leading-6 text-[var(--muted-foreground)]">
                                  <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.chatSummarySetupIntro")}</p>
                                  <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.chatSummarySetupOpen")}</p>
                                </div>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                        <div data-ltm-onboarding-actions>
                          {onboardingStep > 0 ? (
                            <Button
                              onClick={() =>
                                setOnboardingStep((step) => {
                                  const previous = step - 1;
                                  persistOnboardingStep(previous);
                                  return previous;
                                })
                              }
                            >
                              {localizeUi("ui.longTermMemory.longtermmemorydetail.back")}
                            </Button>
                          ) : null}
                          {onboardingStep === 0 ? (
                            <Button primary onClick={advanceOnboarding}>
                              {localizeUi("ui.longTermMemory.longtermmemorydetail.nextHowRecallWorks")}
                            </Button>
                          ) : onboardingStep === 1 ? (
                            <Button primary onClick={advanceOnboarding}>
                              {localizeUi("ui.longTermMemory.longtermmemorydetail.nextTurnItOn")}
                            </Button>
                          ) : onboardingStep === 2 ? (
                            activeChat ? (
                              <>
                                <Button primary onClick={advanceOnboarding}>
                                  {localizeUi("ui.longTermMemory.longtermmemorydetail.nextChooseASource")}
                                </Button>
                                {(props.chatMode === "roleplay" || props.chatMode === "game") &&
                                props.onOpenActivePromptPresetEditor ? (
                                  <Button onClick={openPromptPresetSections}>
                                    {localizeUi("ui.longTermMemory.longtermmemorydetail.openPromptPresetSections")}
                                  </Button>
                                ) : null}
                              </>
                            ) : connectedChat ? (
                              <>
                                <Button
                                  primary
                                  disabled={activationPending || !props.onEnabledForChatChange}
                                  onClick={() => void activateForOnboarding()}
                                >
                                  {localizeUi("ui.longTermMemory.longtermmemorydetail.turnOnForThisChat")}
                                </Button>
                                <Button onClick={advanceOnboarding}>
                                  {localizeUi("ui.longTermMemory.longtermmemorydetail.continueWithoutActivating")}
                                </Button>
                                {(props.chatMode === "roleplay" || props.chatMode === "game") &&
                                props.onOpenActivePromptPresetEditor ? (
                                  <Button onClick={openPromptPresetSections}>
                                    {localizeUi("ui.longTermMemory.longtermmemorydetail.openPromptPresetSections")}
                                  </Button>
                                ) : null}
                              </>
                            ) : (
                              <Button primary onClick={advanceOnboarding}>
                                {localizeUi("ui.longTermMemory.longtermmemorydetail.continueWithoutAChat")}
                              </Button>
                            )
                          ) : onboardingStep === 3 ? (
                            <>
                              <Button onClick={advanceOnboarding}>
                                {localizeUi("ui.longTermMemory.longtermmemorydetail.continueToReview")}
                              </Button>
                              {onboardingSource === "chats" ? (
                                <>
                                  {props.chatMode === "roleplay" && props.onOpenChatSummarySettings ? (
                                    <Button onClick={openChatSummarySettings}>
                                      {localizeUi("ui.longTermMemory.longtermmemorydetail.openChatSummarySettings")}
                                    </Button>
                                  ) : null}
                                  <Button
                                    primary
                                    onClick={async () => {
                                      await openSources("chats");
                                    }}
                                  >
                                    {localizeUi("ui.longTermMemory.longtermmemorydetail.openChatSources")}
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  primary
                                  onClick={async () => {
                                    await openSources(onboardingSource);
                                  }}
                                >
                                  {localizeUi(
                                    onboardingSource === "characters"
                                      ? "ui.longTermMemory.longtermmemorydetail.importACharacter"
                                      : "ui.longTermMemory.longtermmemorydetail.importALorebook",
                                  )}
                                </Button>
                              )}
                            </>
                          ) : onboardingStep === 4 ? (
                            <>
                              <Button onClick={advanceOnboarding}>
                                {localizeUi("ui.longTermMemory.longtermmemorydetail.continueToCheck")}
                              </Button>
                              <Button
                                primary
                                onClick={async () => {
                                  if (pendingDrafts.data?.count) await openReview();
                                  else await openSources("characters");
                                }}
                              >
                                {localizeUi(
                                  pendingDrafts.data?.count
                                    ? "ui.longTermMemory.longtermmemorydetail.openReviewQueue"
                                    : "ui.longTermMemory.longtermmemorydetail.chooseASource",
                                )}
                              </Button>
                            </>
                          ) : onboardingStep === 5 ? (
                            <>
                              <Button primary onClick={advanceOnboarding}>
                                {localizeUi("ui.longTermMemory.longtermmemorydetail.nextUnderTheHood")}
                              </Button>
                              <Button
                                onClick={async () => {
                                  if (savedMemoryCount) await selectDestination("vault");
                                  else await openSources("characters");
                                }}
                              >
                                {localizeUi(
                                  savedMemoryCount
                                    ? "ui.longTermMemory.longtermmemorydetail.goToSavedMemories"
                                    : "ui.longTermMemory.longtermmemorydetail.chooseASource",
                                )}
                              </Button>
                            </>
                          ) : (
                            <Button
                              primary
                              onClick={async () => {
                                if (savedMemoryCount) await selectDestination("vault");
                                else await openSources("characters");
                              }}
                            >
                              {localizeUi(
                                savedMemoryCount
                                  ? "ui.longTermMemory.longtermmemorydetail.goToSavedMemories"
                                  : "ui.longTermMemory.longtermmemorydetail.chooseASource",
                              )}
                            </Button>
                          )}
                        </div>
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
                            data-ltm-onboarding-sprite={onboardingSteps[onboardingStep].mobileSprite}
                            data-ltm-onboarding-mobile-flip={onboardingSteps[onboardingStep].mobileFlip || undefined}
                            data-ltm-onboarding-mobile-shift={onboardingStep === 4 ? "left-40" : undefined}
                          />
                        </picture>
                      </div>
                    </div>
                    <div data-ltm-onboarding-footer className="items-center gap-3">
                      <Button data-ltm-onboarding-close onClick={completeOnboarding}>
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.close")}
                      </Button>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.youCanReplayThisGuideWithTheHelpButton")}
                      </p>
                    </div>
                  </section>
                ) : null}
                <Suspense
                  fallback={
                    <StatusSurface busy>
                      {localizeUi("ui.longTermMemory.longtermmemorydetail.loadingDestination", {
                        destination: destinationLabel(destination),
                      })}
                    </StatusSurface>
                  }
                >
                  <Destination
                    props={props}
                    onDirtyChange={setDestinationDirty}
                    onSaveRequest={(save) => {
                      destinationSaveRef.current = save;
                    }}
                    onOpenMemory={openMemory}
                    onOpenSources={openSources}
                    onOpenVault={() => void selectDestination("vault")}
                    onOpenReview={openReview}
                    onOpenActivity={destination === "vault" ? () => void openActivity() : undefined}
                    openActivityRequest={openActivityRequest}
                    onOpenActivityHandled={() => setOpenActivityRequest(0)}
                    onRecoverCandidate={recoverCandidate}
                    openedNoteId={openedNoteId}
                    createMemoryRequest={createMemoryRequest}
                    onCreateMemoryRequestHandled={() => setCreateMemoryRequest(null)}
                    reviewSourceNoteId={reviewSourceNoteId}
                    recoveryHandoff={recoveryHandoff}
                    requestedSource={requestedSource}
                    onRequestedSourceHandled={() => setRequestedSource(null)}
                    selectedSource={selectedSource}
                    onSourceChange={setSelectedSource}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        data-ltm-mobile-navigation
        className="sticky bottom-0 z-20 border-t border-[var(--marinara-editor-divider)] bg-[var(--marinara-editor-bg)] pb-[env(safe-area-inset-bottom)]"
      >
        <LongTermMemoryNavigation
          mobile
          destination={destination}
          onDestinationChange={selectDestination}
          badges={{
            memories: savedMemoryCount,
            review: pendingDrafts.data?.count,
          }}
        />
      </div>
    </main>
  );
}
