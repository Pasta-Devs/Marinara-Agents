import { useEffect, useRef, useState } from "react";
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
import { errorMessage, queryKeys, request } from "./api";
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
import { Onboarding } from "./Onboarding";
import MemoryVault from "./vault/MemoryVault";
import ReviewQueue from "./review/ReviewQueue";
import SourcesWorkspace from "./sources/SourcesWorkspace";
import MemorySettings from "./settings/MemorySettings";
import { confirm } from "./settings/settings-shared";

const destinations = {
  vault: MemoryVault,
  review: ReviewQueue,
  sources: SourcesWorkspace,
  settings: MemorySettings,
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
  const openOnboardingRef = useRef<(() => void) | null>(null);
  const [openedNoteId, setOpenedNoteId] = useState<string | null>(null);
  const [reviewSourceNoteId, setReviewSourceNoteId] = useState<string | null>(null);
  const [recoveryHandoff, setRecoveryHandoff] = useState<LtmRecoveryHandoff | null>(null);
  const [requestedSource, setRequestedSource] = useState<{
    key: number;
    source: SourceTab;
    sourceNoteId?: string;
  } | null>(null);
  const [selectedSource, setSelectedSource] = useState<SourceTab>("chats");
  const [openActivityRequest, setOpenActivityRequest] = useState(0);
  const [openActivityMemoryId, setOpenActivityMemoryId] = useState<string | null>(null);
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
    return confirm(
      props,
      localizeUi("ui.longTermMemory.longtermmemorydetail.discardUnsavedChanges"),
      localizeUi("ui.longTermMemory.longtermmemorydetail.unsavedChangesLostBeforeOpening", { destination: next }),
      localizeUi("ui.longTermMemory.longtermmemorydetail.discardChanges"),
      true,
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
  const openSources = async (source?: SourceTab, sourceNoteId?: string) => {
    if (!(await confirmDestinationChange(destinationLabel("sources")))) return false;
    setDestinationDirty(false);
    setAddOpen(false);
    if (source) {
      setRequestedSource({ key: Date.now(), source, sourceNoteId });
      setSelectedSource(source);
    }
    setDestination("sources");
    return true;
  };
  const openActivity = async (memoryId: string) => {
    if (!(await confirmDestinationChange(destinationLabel("settings")))) return;
    setDestinationDirty(false);
    setOpenActivityMemoryId(memoryId);
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
        errorMessage(error, localizeUi("ui.longTermMemory.longtermmemorydetail.couldNotUpdateThisChat")),
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
      setRepairMessage(errorMessage(error, localizeUi("ui.longTermMemory.longtermmemorydetail.reindexFailed")));
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
        <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.savedButNotSearchable")}</p>
      ) : null}
      {indexHealth?.rebuildState === "failed" ? (
        <p className="text-[var(--destructive)]">
          {localizeUi("ui.longTermMemory.longtermmemorydetail.semanticRecallUnavailable")}
        </p>
      ) : null}
      {indexHealth?.embeddingSource ? (
        <p>
          {localizeUi("ui.longTermMemory.longtermmemorydetail.embeddingSource", {
            source: indexHealth.embeddingSource,
          })}
        </p>
      ) : null}
      {indexHealth?.embeddingSource &&
      indexHealth.indexedEmbeddingSource &&
      indexHealth.embeddingsAvailable === false ? (
        <p>
          {localizeUi("ui.longTermMemory.activityview.embeddingSourceChanged", {
            indexed: indexHealth.indexedEmbeddingSource,
            current: indexHealth.embeddingSource,
          })}
        </p>
      ) : null}
      <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.embeddingSourceHelp")}</p>
      {repairButton()}
      {repairMessage ? <p role="status">{repairMessage}</p> : null}
    </div>
  );
  const chatLabel = props.chatName ?? localizeUi("ui.longTermMemory.longtermmemorydetail.thisChat");
  const connectedChat = Boolean(props.chatId);
  const activeChat = connectedChat && props.enabledForChat === true;
  const enableForOnboarding = async () => {
    if (!props.onEnabledForChatChange || activationPending) return false;
    setActivationPending(true);
    setActivationError("");
    try {
      await props.onEnabledForChatChange(true);
      return true;
    } catch (error) {
      setActivationError(
        errorMessage(error, localizeUi("ui.longTermMemory.longtermmemorydetail.couldNotUpdateThisChat")),
      );
      return false;
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
          flex: none;
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
        [data-ltm-destination-content] > section {
          scroll-margin-top: 1rem;
        }
        [data-ltm-tab-focus]:focus-visible {
          outline: 2px solid var(--marinara-editor-focus-ring);
        }
        [data-ltm-accent-border],
        [data-ltm-status="success"]:not(.mari-editor-panel),
        [data-ltm-freshness="fresh"] {
          border-color: color-mix(in srgb, var(--marinara-editor-accent) 30%, transparent);
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
          className="fixed inset-0 z-50 grid h-full w-full place-items-center bg-black/50 p-4"
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
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-50"
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
            onClick={() => openOnboardingRef.current?.()}
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
      <div className="mari-editor-content max-md:p-4">
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
                    <TriangleAlert aria-hidden="true" size="1rem" className="shrink-0" />
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
                    <TriangleAlert aria-hidden="true" size="1rem" className="shrink-0" />
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
                className="min-w-0 space-y-5"
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
                <Onboarding
                  props={props}
                  ready={status.isSuccess}
                  savedMemoryCount={savedMemoryCount}
                  pendingDraftCount={pendingDrafts.data?.count}
                  chatLabel={chatLabel}
                  connectedChat={connectedChat}
                  activeChat={activeChat}
                  activationPending={activationPending}
                  onActivate={enableForOnboarding}
                  onOpenReview={openReview}
                  onOpenSources={openSources}
                  onOpenVault={() => selectDestination("vault")}
                  onOpen={(open) => {
                    openOnboardingRef.current = open;
                  }}
                />
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
                  onOpenActivity={
                    destination === "vault" ? (memoryId: string) => void openActivity(memoryId) : undefined
                  }
                  openActivityRequest={openActivityRequest}
                  openActivityMemoryId={openActivityMemoryId}
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
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        data-ltm-mobile-navigation
        className="sticky bottom-0 z-20 border-t border-[var(--marinara-editor-divider)] bg-[var(--marinara-editor-bg)]"
        style={{ paddingBottom: "var(--mari-safe-area-inset-bottom, env(safe-area-inset-bottom))" }}
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
