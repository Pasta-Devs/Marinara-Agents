import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CircleHelp,
  Pencil,
  Plus,
  Settings2,
  Sparkles,
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
import { useLtmTranslation } from "./localization";

const onboardingStorageKey = "marinara-long-term-memory-onboarding-v1";

const onboardingSteps = [
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.howItWorks",
    titleKey: "ui.longTermMemory.longtermmemorydetail.howLongTermMemoryWorks",
    mobileSprite: "Mari_wave.png",
    desktopSprite: "Mari_wave.png",
    mobileFlip: false,
    alt: "",
  },
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.activate",
    titleKey: "ui.longTermMemory.longtermmemorydetail.activateForAChat",
    mobileSprite: "Mari_point_up_left.png",
    desktopSprite: "Mari_point_up_left.png",
    mobileFlip: true,
    alt: "",
  },
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.import",
    titleKey: "ui.longTermMemory.longtermmemorydetail.importSources",
    mobileSprite: "Mari_point_down_left.png",
    desktopSprite: "Mari_point_middle_left.png",
    alt: "",
    mobileFlip: true,
  },
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.review",
    titleKey: "ui.longTermMemory.longtermmemorydetail.reviewProposedMemories",
    mobileSprite: "Mari_point_down_left.png",
    desktopSprite: "Mari_point_up_left.png",
    mobileFlip: false,
    alt: "",
  },
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.recall",
    titleKey: "ui.longTermMemory.longtermmemorydetail.saveAndRecall",
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
const destinationLabelKeys: Record<LongTermMemoryDestination, string> = {
  vault: "ui.longTermMemory.longtermmemorynavigation.memoryVault",
  review: "ui.longTermMemory.longtermmemorynavigation.reviewQueue",
  sources: "ui.longTermMemory.longtermmemorynavigation.sources",
  settings: "ui.longTermMemory.longtermmemorynavigation.memorySettings",
};

export function LongTermMemoryDetail({ props }: { props: CapabilityProps }) {
  const { t: localizeUi } = useLtmTranslation();
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
  const destinationLabel = (value: LongTermMemoryDestination) =>
    localizeUi(destinationLabelKeys[value]);

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
      title: localizeUi(
        "ui.longTermMemory.longtermmemorydetail.discardUnsavedChanges",
      ),
      message: localizeUi(
        "ui.longTermMemory.longtermmemorydetail.unsavedChangesLostBeforeOpening",
        { destination: next },
      ),
      confirmLabel: localizeUi(
        "ui.longTermMemory.longtermmemorydetail.discardChanges",
      ),
      tone: "destructive" as const,
    };
    return props.confirmAction
      ? await props.confirmAction(options)
      : window.confirm(
          localizeUi(
            "ui.longTermMemory.longtermmemorydetail.confirmationWithMessage",
            { title: options.title, message: options.message },
          ),
        );
  };
  const selectDestination = async (next: LongTermMemoryDestination) => {
    if (next === destination) return;
    if (!(await confirmDestinationChange(destinationLabel(next)))) return;
    if (onboardingOpen) completeOnboarding();
    setDestinationDirty(false);
    if (next === "review") setReviewSourceNoteId(null);
    if (next === "vault") setOpenedNoteId(null);
    if (next !== "vault") setRecoveryHandoff(null);
    setAddOpen(false);
    setDestination(next);
  };
  const close = async () => {
    if (
      !(await confirmDestinationChange(
        localizeUi("ui.longTermMemory.longtermmemorydetail.agents"),
      ))
    )
      return;
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
    if (!(await confirmDestinationChange(destinationLabel("review")))) return;
    setDestinationDirty(false);
    setReviewSourceNoteId(sourceNoteId ?? null);
    setDestination("review");
  };
  const recoverCandidate: NonNullable<
    LongTermMemoryDestinationProps["onRecoverCandidate"]
  > = async (candidate, scope, modes, rejectedSuggestionId) => {
    if (!(await confirmDestinationChange(destinationLabel("vault")))) return;
    setOpenedNoteId(null);
    setRecoveryHandoff({ key: Date.now(), candidate, scope, modes, rejectedSuggestionId });
    setDestinationDirty(false);
    setDestination("vault");
  };
  const openSources = async () => {
    if (!(await confirmDestinationChange(destinationLabel("sources"))))
      return false;
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
        error instanceof Error
          ? error.message
          : localizeUi(
              "ui.longTermMemory.longtermmemorydetail.couldNotUpdateThisChat",
            ),
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
  const emptyUnbuiltVault =
    health === "not_built" && (status.data?.notes.total ?? 0) === 0;
  const needsHealthAttention = [
    "building",
    "degraded",
    "stale",
    "corrupt",
    "failed",
  ].includes(health ?? "");
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
  const healthInfo = (
    <div className="space-y-2">
      <strong className="block text-[var(--marinara-editor-text)]">
        {healthLabel}
      </strong>
      <p>
        {indexedChunks} {localizeUi("ui.longTermMemory.longtermmemorydetail.indexedChunks")}
      </p>
      <p>
        {localizeUi(
          "ui.longTermMemory.longtermmemorydetail.checkSettingsMaintenanceReindexRecallData",
        )}
      </p>
    </div>
  );

  return (
    <main
      data-ltm-surface="detail"
      aria-labelledby="ltm-detail-title"
      className="mari-editor-shell mari-editor-legacy-bridge flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <header className="mari-editor-header relative z-20">
        <div className="mari-editor-header-main max-md:min-w-full">
          <button
            type="button"
            aria-label={localizeUi(
              "ui.longTermMemory.longtermmemorydetail.backToAgents",
            )}
            data-ltm-control="back"
            onClick={() => void close()}
            className="mari-editor-action inline-flex"
          >
            <ArrowLeft aria-hidden="true" size="1.125rem" />
          </button>
          <span className="mari-editor-icon-tile">
            <Sparkles
              aria-hidden="true"
              size="1.125rem"
              className="max-md:!h-[0.875rem] max-md:!w-[0.875rem]"
            />
          </span>
          <div className="min-w-0 flex-1">
            <h1 id="ltm-detail-title" className="mari-editor-title truncate">
              {props.agent?.name?.trim() ||
                localizeUi(
                  "ui.longTermMemory.longtermmemorydetail.longTermMemory",
                )}
            </h1>
            <p className="mari-editor-meta mt-0.5">
              {props.agent?.author?.trim() || "Pasta Devs"}
              {props.package?.version ? ` · v${props.package.version}` : ""}
            </p>
          </div>
        </div>
        <div className="mari-editor-actions flex max-md:w-full max-md:justify-end max-md:border-t max-md:border-[var(--marinara-editor-divider)] max-md:pt-2">
          {props.chatId ? (
            <div className="mr-1 inline-flex items-center gap-2 whitespace-nowrap text-xs text-[var(--marinara-editor-muted)]">
              <span className="hidden lg:inline">
                {localizeUi("ui.longTermMemory.longtermmemorydetail.activeIn")}{" "}
                <strong className="text-[var(--marinara-editor-text)]">
                  {props.chatName ??
                    localizeUi(
                      "ui.longTermMemory.longtermmemorydetail.thisChat",
                    )}
                </strong>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={props.enabledForChat === true}
                aria-label={localizeUi(
                  "ui.longTermMemory.longtermmemorydetail.activeInValue1",
                  {
                    value1:
                      props.chatName ??
                      localizeUi(
                        "ui.longTermMemory.longtermmemorydetail.thisChat",
                      ),
                  },
                )}
                data-ltm-control="activation"
                className="relative h-9 w-10 rounded-md bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-editor-focus-ring)] disabled:opacity-50 before:absolute before:left-0 before:top-1.5 before:h-6 before:w-10 before:rounded-full before:bg-[var(--marinara-editor-control-bg)] before:transition-colors aria-checked:before:bg-[var(--marinara-editor-accent)] after:absolute after:left-1 after:top-2.5 after:h-4 after:w-4 after:rounded-full after:bg-[var(--marinara-editor-text)] after:transition-transform aria-checked:after:translate-x-4"
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
                className="min-h-11 min-w-11 sm:min-h-9 sm:min-w-0"
                onClick={() => setAddOpen((value) => !value)}
                aria-expanded={addOpen}
                aria-controls={addOpen ? "ltm-add-menu" : undefined}
                aria-label={localizeUi(
                  "ui.longTermMemory.longtermmemorydetail.addMemories",
                )}
              >
                <Plus aria-hidden="true" size="0.75rem" />
                <span className="hidden sm:inline">
                  {localizeUi(
                    "ui.longTermMemory.longtermmemorydetail.addMemories",
                  )}
                </span>
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
                    <h2
                      id="ltm-add-menu-title"
                      className="text-sm font-semibold"
                    >
                      {localizeUi(
                        "ui.longTermMemory.longtermmemorydetail.addMemories",
                      )}
                    </h2>
                    <p
                      id="ltm-add-menu-description"
                      className="mt-0.5 text-xs text-[var(--muted-foreground)]"
                    >
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
                    <Upload
                      aria-hidden="true"
                      size="1rem"
                      className="shrink-0 text-[var(--marinara-editor-accent)]"
                    />
                    <span>
                      <strong className="block text-sm">
                        {localizeUi(
                          "ui.longTermMemory.longtermmemorydetail.importSources",
                        )}
                      </strong>
                      <span className="block text-xs text-[var(--marinara-editor-accent)]">
                        {localizeUi(
                          "ui.longTermMemory.longtermmemorydetail.recommended",
                        )}
                      </span>
                      <span className="block text-xs text-[var(--muted-foreground)]">
                        {localizeUi(
                          "ui.longTermMemory.longtermmemorydetail.charactersLorebooksAndChatSummaries",
                        )}
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
                    <Pencil
                      aria-hidden="true"
                      size="1rem"
                      className="shrink-0"
                    />
                    <span>
                      <strong className="block text-sm">
                        {localizeUi(
                          "ui.longTermMemory.longtermmemorydetail.createManually",
                        )}
                      </strong>
                      <span className="block text-xs text-[var(--muted-foreground)]">
                        {localizeUi(
                          "ui.longTermMemory.longtermmemorydetail.oneOffDurableContext",
                        )}
                      </span>
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          <IconButton
            icon={CircleHelp}
            label={localizeUi(
              "ui.longTermMemory.longtermmemorydetail.showSetupGuide",
            )}
            onClick={() => {
              setOnboardingStep(0);
              setOnboardingOpen(true);
            }}
            className="h-11 min-h-11 w-11 min-w-11"
          />
          {props.onManagePackage ? (
            <IconButton
              icon={Settings2}
              label={localizeUi(
                "ui.longTermMemory.longtermmemorydetail.managePackage",
              )}
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
          <div className="flex min-w-0 gap-5">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex min-w-0 items-stretch gap-3">
                <LongTermMemoryNavigation
                  destination={destination}
                  onDestinationChange={selectDestination}
                  badges={{
                    memories: status.data?.notes.total,
                    review: pendingDrafts.data?.count,
                  }}
                />
                {health !== "healthy" ? (
                  <div
                    aria-busy={status.isFetching}
                    data-ltm-surface="vault-health-pill"
                    className="hidden shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs text-[var(--marinara-editor-muted)] md:flex"
                  >
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 rounded-full ${healthTone}`}
                    />
                    <span aria-live="polite" aria-atomic="true">
                      {status.isError
                        ? localizeUi(
                            "ui.longTermMemory.longtermmemorydetail.statusUnavailable",
                          )
                        : status.data
                          ? healthLabel
                          : localizeUi(
                              "ui.longTermMemory.longtermmemorydetail.loadingStatus",
                            )}
                    </span>
                    {needsHealthAttention ? null : (
                      <InfoPopover
                        label={localizeUi(
                          "ui.longTermMemory.longtermmemorydetail.howToRepairVaultHealth",
                        )}
                        content={healthInfo}
                      />
                    )}
                  </div>
                ) : null}
              </div>
              {needsHealthAttention ? (
                <StatusSurface
                  compact
                  tone={healthNeedsDangerTone ? "danger" : "neutral"}
                  data-ltm-surface="vault-health-warning"
                  className="justify-between"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${healthTone}`}
                    />
                    <span className="font-semibold">{healthLabel}</span>
                    <span className="hidden truncate sm:inline">
                      {localizeUi(
                        "ui.longTermMemory.longtermmemorydetail.checkSettingsMaintenanceReindexRecallData",
                      )}
                    </span>
                  </span>
                  <InfoPopover
                    label={localizeUi(
                      "ui.longTermMemory.longtermmemorydetail.howToRepairVaultHealth",
                    )}
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
              {activationError ? (
                <StatusSurface tone="danger">{activationError}</StatusSurface>
              ) : null}
              {status.isError ? (
                <StatusSurface tone="danger">
                  {localizeUi(
                    "ui.longTermMemory.longtermmemorydetail.longTermMemoryStatusCouldNotLoad",
                  )}
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
                      {localizeUi(
                        "ui.longTermMemory.longtermmemorydetail.professorMariSSetupGuide",
                      )}
                    </p>
                    <p className="shrink-0 text-xs text-[var(--muted-foreground)]">
                      {localizeUi(
                        "ui.longTermMemory.longtermmemorydetail.stepProgress",
                        {
                          current: onboardingStep + 1,
                          total: onboardingSteps.length,
                          label: localizeUi(
                            onboardingSteps[onboardingStep].labelKey,
                          ),
                        },
                      )}
                    </p>
                  </div>
                  <div data-ltm-onboarding-body className="p-4 sm:p-6">
                      <div className="space-y-4">
                        <div
                          className="space-y-2"
                          aria-live="polite"
                          aria-atomic="true"
                        >
                          <h2
                            id="ltm-onboarding-title"
                            className="text-lg font-semibold"
                        >
                          {localizeUi(onboardingSteps[onboardingStep].titleKey)}
                        </h2>
                        <p
                          id="ltm-onboarding-description"
                          className="max-w-[65ch] text-sm leading-6 text-[var(--muted-foreground)]"
                        >
                          {onboardingStep === 0
                            ? localizeUi(
                                "ui.longTermMemory.longtermmemorydetail.importInformationFromChatsCharactersOrLorebooksLongTerm",
                              )
                            : onboardingStep === 1
                              ? props.chatId
                                ? props.enabledForChat
                                  ? localizeUi(
                                      "ui.longTermMemory.longtermmemorydetail.longTermMemoryIsActiveInValue1RelevantSaved",
                                      {
                                        value1:
                                          props.chatName ??
                                          localizeUi(
                                            "ui.longTermMemory.longtermmemorydetail.thisChat",
                                          ),
                                      },
                                    )
                                  : localizeUi(
                                      "ui.longTermMemory.longtermmemorydetail.turnOnActiveInValue1AboveToLetThis",
                                      {
                                        value1:
                                          props.chatName ??
                                          localizeUi(
                                            "ui.longTermMemory.longtermmemorydetail.thisChat",
                                          ),
                                      },
                                    )
                                : localizeUi(
                                    "ui.longTermMemory.longtermmemorydetail.openASupportedChatThenUseChatSettingsAgents",
                                  )
                              : onboardingStep === 2
                                ? localizeUi(
                                    "ui.longTermMemory.longtermmemorydetail.chooseAChatSummaryCharacterOrLorebookToImport",
                                  )
                                : onboardingStep === 3
                                  ? localizeUi(
                                      "ui.longTermMemory.longtermmemorydetail.reviewProposedChangesBeforeSavingThemEditAnythingThat",
                                    )
                                  : localizeUi(
                                      "ui.longTermMemory.longtermmemorydetail.acceptedMemoriesAppearInMemoryVaultAndCanBe",
                                    )}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {onboardingStep > 0 ? (
                          <Button
                            onClick={() =>
                              setOnboardingStep((step) => step - 1)
                            }
                          >
                            {localizeUi(
                              "ui.longTermMemory.longtermmemorydetail.back",
                            )}
                          </Button>
                        ) : null}
                        {onboardingStep < onboardingSteps.length - 1 ? (
                          <Button
                            primary
                            onClick={() =>
                              setOnboardingStep((step) => step + 1)
                            }
                          >
                            {localizeUi(
                              "ui.longTermMemory.longtermmemorydetail.next",
                            )}
                          </Button>
                        ) : (
                          <Button
                            primary
                            onClick={async () => {
                              if (await openSources()) completeOnboarding();
                            }}
                          >
                            {localizeUi(
                              "ui.longTermMemory.longtermmemorydetail.importASource",
                            )}
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
                            ? localizeUi(
                                "ui.longTermMemory.longtermmemorydetail.exploreMemoryVault",
                              )
                            : localizeUi(
                                "ui.longTermMemory.longtermmemorydetail.skip",
                              )}
                        </Button>
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {localizeUi(
                          "ui.longTermMemory.longtermmemorydetail.youCanReplayThisGuideWithTheHelpButton",
                        )}
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
                            onboardingSteps[onboardingStep].mobileFlip ||
                            undefined
                          }
                        />
                      </picture>
                    </div>
                  </div>
                </section>
              ) : null}
              <Suspense
                fallback={
                  <StatusSurface busy>
                    {localizeUi(
                      "ui.longTermMemory.longtermmemorydetail.loadingDestination",
                      { destination: destinationLabel(destination) },
                    )}
                  </StatusSurface>
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
                  onCreateMemoryRequestHandled={() =>
                    setCreateMemoryRequest(null)
                  }
                  reviewSourceNoteId={reviewSourceNoteId}
                  recoveryHandoff={recoveryHandoff}
                />
              </Suspense>
              </div>
            </div>
          </div>
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
