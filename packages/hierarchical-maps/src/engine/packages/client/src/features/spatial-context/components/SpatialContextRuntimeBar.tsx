import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Footprints,
  Map as MapIcon,
  MapPin,
  RefreshCw,
  Route,
  X,
  Zap,
} from "lucide-react";
import type { SpatialDestination, SpatialDestinationRelation } from "@marinara-engine/shared";
import { GameWorldMap } from "../../../components/game/GameWorldMap";
import { useSpatialContext } from "../../../hooks/use-spatial-context";
import { cn, generateClientId, WORLD_MAPS_GUIDE_URL } from "../package-utils";
import {
  clearPendingSpatialTransition,
  setPendingSpatialTransition,
  setPendingSpatialTransitionStatus,
  usePendingSpatialTransition,
} from "../pending-spatial-transitions";
import { useSpatialMapTranslation } from "../localization";
import { findSpatialRoute } from "../spatial-route-plans";
import { SpatialLocationIcon } from "./SpatialLocationIcon";
import { useMapConfirmation } from "./use-map-confirmation";

interface SpatialContextRuntimeBarProps {
  chatId: string | null;
  disabled?: boolean;
  onPendingSelected?: () => void;
  onOpenEditor?: () => void;
}

const GROUPS: Array<{
  relation: SpatialDestinationRelation;
  title: string;
  empty: string;
}> = [
  { relation: "leave", title: "Leave", empty: "No parent location" },
  { relation: "enter", title: "Enter", empty: "No nearby sub-locations" },
  { relation: "link", title: "Nearby", empty: "No nearby connected places" },
];

function destinationAction(destination: SpatialDestination): string {
  if (destination.label?.trim()) return destination.label.trim();
  if (destination.relation === "leave") return `Leave for ${destination.name}`;
  if (destination.relation === "enter") return `Enter ${destination.name}`;
  return `Travel to ${destination.name}`;
}

export function SpatialContextRuntimeBar({
  chatId,
  disabled = false,
  onPendingSelected,
  onOpenEditor,
}: SpatialContextRuntimeBarProps) {
  const [open, setOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(null);
  const desktopMapTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileMapTriggerRef = useRef<HTMLButtonElement | null>(null);
  const spatial = useSpatialContext(chatId);
  const pending = usePendingSpatialTransition(chatId);
  const data = spatial.data;
  const { confirmAction, confirmationDialog } = useMapConfirmation();
  const { t } = useSpatialMapTranslation();
  const pendingRoute = useMemo(() => {
    if (!pending?.transition.travelMode || !data?.definition || !data.currentLocationId) return null;
    return findSpatialRoute(data.definition, data.currentLocationId, pending.transition.destinationId);
  }, [data?.currentLocationId, data?.definition, pending?.transition.destinationId, pending?.transition.travelMode]);
  const nextStopName =
    pending?.transition.travelMode === "step_by_step" ? (pendingRoute?.steps[0]?.locationName ?? null) : null;

  useEffect(() => {
    if (!chatId || !data) return;
    if (!pending) return;
    const destinationStillAvailable = data.destinations.some(
      (destination) => destination.id === pending.transition.destinationId,
    );
    const plannedRouteStillAvailable =
      (pending.transition.travelMode === "step_by_step" || pending.transition.travelMode === "travel_now") &&
      Boolean(pendingRoute);
    const isStale =
      data.definition?.revision !== pending.transition.expectedDefinitionRevision ||
      data.currentLocationId !== pending.transition.expectedCurrentLocationId ||
      (!destinationStillAvailable && !plannedRouteStillAvailable);
    if (isStale) setPendingSpatialTransitionStatus(chatId, "needs_review");
  }, [chatId, data, pending, pendingRoute]);

  const destinationsByRelation = useMemo(() => {
    const result = new Map<SpatialDestinationRelation, SpatialDestination[]>();
    for (const group of GROUPS) result.set(group.relation, []);
    for (const destination of data?.destinations ?? []) {
      result.get(destination.relation)?.push(destination);
    }
    return result;
  }, [data?.destinations]);

  const selectedDestination = useMemo(
    () => data?.destinations.find((destination) => destination.id === selectedDestinationId) ?? null,
    [data?.destinations, selectedDestinationId],
  );
  const selectedLocation = selectedDestination
    ? (data?.definition?.locations.find((location) => location.id === selectedDestination.id) ?? null)
    : null;
  const currentLocation = data?.currentLocationId
    ? (data.definition?.locations.find((location) => location.id === data.currentLocationId) ?? null)
    : null;

  useEffect(() => {
    if (!selectedDestinationId) return;
    if (!data?.destinations.some((destination) => destination.id === selectedDestinationId)) {
      setSelectedDestinationId(null);
    }
  }, [data?.destinations, selectedDestinationId]);

  const enabled = Boolean(data?.definition?.enabled && data.currentLocationId);
  const mapAvailable = Boolean(
    data?.definition?.enabled && data.definition.locations.some((location) => location.status === "active"),
  );
  const mobilePanelOpen = mapOpen || open;

  useEffect(() => {
    setOpen(false);
    setMapOpen(false);
  }, [chatId]);

  const queueDestination = async (
    destination: SpatialDestination,
    travelMode: "step_by_step" | "travel_now",
  ): Promise<void> => {
    if (!chatId || !data?.definition || !data.currentLocationId || disabled) return;
    if (pending && pending.transition.destinationId !== destination.id) {
      const confirmed = await confirmAction({
        title: "Replace pending move?",
        message: `Replace the pending move to ${pending.destinationName}?`,
        confirmLabel: "Replace move",
      });
      if (!confirmed) return;
    }
    setPendingSpatialTransition(chatId, {
      transition: {
        destinationId: destination.id,
        travelMode,
        expectedDefinitionRevision: data.definition.revision,
        expectedCurrentLocationId: data.currentLocationId,
        commandId: generateClientId(),
      },
      destinationName: destination.name,
      relation: destination.relation,
      ...(destination.label ? { label: destination.label } : {}),
      status: "ready",
    });
    onPendingSelected?.();
    setOpen(false);
    setMapOpen(false);
  };

  const closeMobileMap = () => {
    setOpen(false);
    setMapOpen(false);
    requestAnimationFrame(() => mobileMapTriggerRef.current?.focus({ preventScroll: true }));
  };

  const closeDesktopMap = () => {
    setMapOpen(false);
    requestAnimationFrame(() => desktopMapTriggerRef.current?.focus({ preventScroll: true }));
  };

  const handleDestinationQueued = () => {
    setMapOpen(false);
    onPendingSelected?.();
  };

  const breadcrumbLabel =
    data?.breadcrumb.map((crumb) => crumb.name).join(" › ") ||
    (!data?.definition ? "No map yet" : !data.definition.enabled ? "Map disabled" : "Location unavailable");

  if (spatial.isLoading && !pending) {
    return (
      <section
        aria-label="Story location"
        className="mb-2 min-h-11 animate-pulse rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] px-3 py-2"
      >
        <span role="status" className="sr-only">
          Loading story location
        </span>
        <div className="h-3 w-28 rounded bg-[var(--muted)]" />
        <div className="mt-2 h-3 w-2/3 rounded bg-[var(--muted)]/70" />
      </section>
    );
  }

  if (spatial.isError && !pending) {
    return (
      <section
        aria-label="Story location"
        role="alert"
        className="mb-2 flex min-h-11 items-center gap-2 rounded-xl border border-[var(--destructive)]/25 bg-[var(--destructive)]/10 px-3 py-2 text-xs"
      >
        <AlertTriangle size="0.875rem" className="shrink-0 text-[var(--destructive)]" />
        <span className="min-w-0 flex-1">Story location unavailable. Your message draft is unchanged.</span>
        <button
          type="button"
          onClick={() => void spatial.refetch()}
          className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 font-semibold text-[var(--destructive)] hover:bg-[var(--destructive)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
        >
          <RefreshCw size="0.75rem" /> Retry
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label="Story location"
      data-marinara-maps-runtime-root
      data-runtime-mode={data?.definition?.ownerMode ?? "unknown"}
      data-runtime-layout={pending || !enabled ? "recovery" : "compact"}
      className={cn(
        "relative mb-2 text-[var(--marinara-chat-chrome-panel-text)]",
        pending || !enabled
          ? "w-full overflow-hidden rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] shadow-sm"
          : cn(
              "ml-auto h-11 w-11 overflow-visible sm:ml-0 sm:h-auto sm:w-full sm:rounded-xl sm:border sm:border-[var(--marinara-chat-chrome-panel-border)] sm:bg-[var(--marinara-chat-chrome-panel-bg)] sm:shadow-sm",
              mapOpen ? "sm:overflow-visible" : "sm:overflow-hidden",
            ),
      )}
    >
      {confirmationDialog}
      <div data-marinara-maps-runtime-desktop className="hidden min-h-11 items-center gap-1.5 px-2 sm:flex">
        <button
          type="button"
          onClick={() => {
            if (!enabled) return;
            setMapOpen(false);
            setOpen((value) => !value);
          }}
          disabled={!enabled || disabled}
          aria-expanded={open}
          aria-label={`Story location: ${breadcrumbLabel}`}
          className={cn(
            "flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:cursor-default max-sm:w-11 max-sm:flex-none max-sm:justify-center max-sm:px-0",
            open &&
              "bg-[var(--marinara-chat-chrome-button-bg-active)] text-[var(--marinara-chat-chrome-button-text-active)]",
          )}
          title={breadcrumbLabel}
        >
          <MapPin size="0.9375rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
          <span className="shrink-0 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-[var(--marinara-chat-chrome-panel-muted)] max-sm:hidden">
            Story location
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium max-sm:hidden">{breadcrumbLabel}</span>
          {enabled &&
            (open ? (
              <ChevronDown size="0.875rem" className="shrink-0 max-sm:hidden" />
            ) : (
              <ChevronRight size="0.875rem" className="shrink-0 max-sm:hidden" />
            ))}
        </button>
        {mapAvailable && (
          <button
            ref={desktopMapTriggerRef}
            type="button"
            onClick={() => {
              setOpen(false);
              setMapOpen((value) => !value);
            }}
            disabled={disabled}
            aria-expanded={mapOpen}
            aria-label={mapOpen ? "Close story map" : "Open story map"}
            title={mapOpen ? "Close story map" : "Open story map"}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:opacity-50",
              mapOpen
                ? "bg-[var(--marinara-chat-chrome-button-bg-active)] text-[var(--marinara-chat-chrome-button-text-active)]"
                : "text-[var(--marinara-chat-chrome-button-text)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)]",
            )}
          >
            <MapIcon size="1rem" />
          </button>
        )}
      </div>

      {enabled && mapAvailable && (
        <div data-marinara-maps-runtime-mobile className="relative flex h-11 w-11 items-center sm:hidden">
          <button
            ref={mobileMapTriggerRef}
            type="button"
            onClick={() => {
              if (mobilePanelOpen) {
                setOpen(false);
                setMapOpen(false);
                return;
              }
              setMapOpen(true);
            }}
            disabled={disabled}
            aria-expanded={mobilePanelOpen}
            aria-label={mobilePanelOpen ? "Close story map" : "Open story map"}
            title={mobilePanelOpen ? "Close story map" : `Open story map: ${breadcrumbLabel}`}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:opacity-50",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] text-[var(--marinara-chat-chrome-button-text)]",
                mobilePanelOpen &&
                  "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] text-[var(--marinara-chat-chrome-button-text-active)]",
              )}
            >
              <MapIcon size="0.75rem" />
            </span>
          </button>

          {mapOpen && data?.definition && chatId && (
            <div
              data-marinara-maps-runtime-popover
              role="dialog"
              aria-label="Story map"
              className="absolute bottom-[calc(100%+0.375rem)] right-0 z-50 isolate flex w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(70dvh,36rem)] flex-col overflow-hidden rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] text-[var(--marinara-chat-chrome-panel-text)] shadow-2xl shadow-black/45"
              style={{
                bottom: "calc(100% + 0.375rem)",
                backgroundColor: "var(--background)",
                right: 0,
                width: "min(22rem, calc(100vw - 1.5rem))",
                maxHeight: "min(70dvh, 36rem)",
                zIndex: 100,
              }}
            >
              <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-[var(--marinara-chat-chrome-panel-divider)] px-2">
                <MapIcon size="0.875rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[var(--marinara-chat-chrome-panel-title)]">Story map</p>
                  <p
                    className="truncate text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]"
                    title={breadcrumbLabel}
                  >
                    {breadcrumbLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMapOpen(false);
                    setOpen(true);
                  }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--marinara-chat-chrome-button-text)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
                  aria-label={`Open story location options: ${breadcrumbLabel}`}
                  title="Story location options"
                >
                  <MapPin size="1rem" />
                </button>
                <button
                  type="button"
                  onClick={closeMobileMap}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--marinara-chat-chrome-button-text)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
                  aria-label="Close story map panel"
                  title="Close story map"
                >
                  <X size="1rem" />
                </button>
              </div>
              <div
                data-marinara-maps-runtime-map-scroll
                className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-2"
              >
                <GameWorldMap
                  chatId={chatId}
                  spatial={data}
                  disabled={disabled}
                  compact
                  useParentScroll
                  onDestinationQueued={handleDestinationQueued}
                  onOpenEditor={onOpenEditor}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {pending && (
        <div
          className={cn(
            "mx-2 mb-2 flex min-h-11 items-center gap-2 rounded-lg border px-2.5",
            pending.status === "needs_review"
              ? "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200"
              : "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]",
          )}
          role="status"
        >
          {pending.status === "needs_review" ? (
            <AlertTriangle size="0.875rem" className="shrink-0" />
          ) : (
            <Route size="0.875rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">{pending.destinationName}</span>
            <span className="block truncate text-[0.625rem] opacity-75">
              {pending.status === "needs_review"
                ? `Needs review — ${pending.reviewMessage ?? "choose the destination again"}`
                : pending.transition.travelMode === "step_by_step"
                  ? "Step by step · advances one hop per turn"
                  : pending.transition.travelMode === "travel_now"
                    ? "Travel now · resolves the full route this turn"
                    : "Moves with your next turn"}
            </span>
            {pending.status === "ready" && nextStopName ? (
              <span
                className="block truncate text-[0.625rem] font-medium text-[var(--marinara-chat-chrome-accent)]"
                title={`${t("ui.worldMaps.runtime.nextStop")}: ${nextStopName}`}
              >
                {t("ui.worldMaps.runtime.nextStop")}: {nextStopName}
              </span>
            ) : null}
          </span>
          <a
            href={WORLD_MAPS_GUIDE_URL}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
            aria-label="Open World Maps movement help"
            title="Movement help"
          >
            <CircleHelp size="0.875rem" />
          </a>
          <button
            type="button"
            onClick={() => {
              if (!chatId) return;
              clearPendingSpatialTransition(chatId, pending.transition.commandId);
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
            aria-label={`Cancel move to ${pending.destinationName}`}
          >
            <X size="0.875rem" />
          </button>
        </div>
      )}

      {!enabled && !pending && (
        <div className="border-t border-[var(--marinara-chat-chrome-panel-divider)] px-3 py-2.5 text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
          {!data?.definition
            ? "No map yet. Create one from Agents → World Maps; your message draft is unchanged."
            : !data.definition.enabled
              ? "Map disabled. Its saved hierarchy and history are preserved until you enable it again."
              : "The saved map does not have an available current location. Open World Maps to review it."}
        </div>
      )}

      {mapOpen && mapAvailable && data?.definition && chatId && (
        <div
          data-marinara-maps-runtime-desktop-popover
          data-marinara-maps-runtime-popover
          role="dialog"
          aria-label="Story map"
          className="absolute bottom-[calc(100%+0.375rem)] right-0 z-[100] hidden w-[min(32rem,calc(100vw-2rem))] max-h-[min(70dvh,42rem)] flex-col overflow-hidden rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] text-[var(--marinara-chat-chrome-panel-text)] shadow-2xl shadow-black/45 sm:flex"
          style={{
            bottom: "calc(100% + 0.375rem)",
            backgroundColor: "var(--background)",
            maxHeight: "min(70dvh, 42rem)",
            right: 0,
            width: "min(32rem, calc(100vw - 2rem))",
            zIndex: 100,
          }}
        >
          <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-[var(--marinara-chat-chrome-panel-divider)] px-2">
            <MapIcon size="0.875rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-[var(--marinara-chat-chrome-panel-title)]">Story map</p>
              <p
                className="truncate text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]"
                title={breadcrumbLabel}
              >
                {breadcrumbLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={closeDesktopMap}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--marinara-chat-chrome-button-text)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
              aria-label="Close expanded story map"
              title="Close story map"
            >
              <X size="1rem" />
            </button>
          </div>
          <div
            data-marinara-maps-runtime-map-scroll
            className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-2"
          >
            <GameWorldMap
              chatId={chatId}
              spatial={data}
              disabled={disabled}
              compact
              useParentScroll
              onDestinationQueued={handleDestinationQueued}
              onOpenEditor={onOpenEditor}
            />
          </div>
        </div>
      )}

      {open && enabled && (
        <div
          data-marinara-maps-runtime-options
          className="border-t border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--background)] p-2"
        >
          <div className="mb-2 flex min-h-11 items-center gap-2 border-b border-[var(--marinara-chat-chrome-panel-divider)] px-1 pb-2 sm:hidden">
            <MapPin size="0.875rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-[var(--marinara-chat-chrome-panel-title)]">
                Story location
              </p>
              <p
                className="truncate text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]"
                title={breadcrumbLabel}
              >
                {breadcrumbLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setMapOpen(true);
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--marinara-chat-chrome-button-text)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
              aria-label="Show story map"
              title="Show story map"
            >
              <MapIcon size="1rem" />
            </button>
            <button
              type="button"
              onClick={closeMobileMap}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--marinara-chat-chrome-button-text)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
              aria-label="Close story location options"
              title="Close"
            >
              <X size="1rem" />
            </button>
          </div>
          {currentLocation && (
            <div className="mb-2 flex items-start gap-2 rounded-lg bg-[var(--marinara-chat-chrome-highlight-bg)] px-3 py-2.5">
              <SpatialLocationIcon icon={currentLocation.icon} fallback="📍" className="text-base" />
              <div className="min-w-0 flex-1">
                <p className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-[var(--marinara-chat-chrome-accent)]">
                  You are here
                </p>
                <p className="truncate text-xs font-semibold">{currentLocation.name}</p>
                {currentLocation.description && (
                  <p className="mt-0.5 line-clamp-2 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                    {currentLocation.description}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            {GROUPS.map((group) => {
              const destinations = destinationsByRelation.get(group.relation) ?? [];
              return (
                <div key={group.relation}>
                  <h3 className="px-2 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-[var(--marinara-chat-chrome-panel-muted)]">
                    {group.title}
                  </h3>
                  {destinations.length > 0 ? (
                    <div className="grid gap-1">
                      {destinations.map((destination) => {
                        const location = data?.definition?.locations.find(
                          (candidate) => candidate.id === destination.id,
                        );
                        const selected = destination.id === selectedDestinationId;
                        return (
                          <button
                            key={destination.id}
                            type="button"
                            onClick={() => setSelectedDestinationId(destination.id)}
                            aria-pressed={selected}
                            className={cn(
                              "flex min-h-11 w-full items-center gap-2 rounded-lg border px-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]",
                              selected
                                ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]"
                                : "border-transparent hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)]",
                            )}
                            aria-label={`Inspect ${destination.name}`}
                          >
                            <SpatialLocationIcon icon={location?.icon} className="text-base" />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{destination.name}</span>
                              <span className="block truncate text-[0.625rem] capitalize text-[var(--marinara-chat-chrome-panel-muted)]">
                                {destination.kind}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="px-2 py-2 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                      {group.empty}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {selectedDestination && (
            <div className="mt-2 flex flex-wrap items-start gap-3 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)]/35 p-3">
              <SpatialLocationIcon icon={selectedLocation?.icon} fallback="📍" className="text-lg" />
              <div className="min-w-52 flex-1">
                <p className="text-xs font-semibold">{selectedDestination.name}</p>
                <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
                  {selectedLocation?.description || `A ${selectedDestination.kind} reachable from here.`}
                </p>
                <p className="mt-1 text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                  {destinationAction(selectedDestination)}. Choose step-by-step travel or travel now.
                </p>
              </div>
              {pending?.transition.destinationId === selectedDestination.id ? (
                <span className="flex min-h-11 items-center gap-1.5 px-2 text-xs font-semibold text-[var(--marinara-chat-chrome-accent)]">
                  <Route size="0.75rem" />{" "}
                  {pending.transition.travelMode === "step_by_step" ? "Step-by-step queued" : "Travel queued"}
                </span>
              ) : (
                <div className="flex flex-wrap justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => void queueDestination(selectedDestination, "step_by_step")}
                    disabled={disabled}
                    className="flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] px-3 text-xs font-semibold text-[var(--marinara-chat-chrome-button-text-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:opacity-50"
                    aria-label={`Step by step to ${selectedDestination.name}`}
                  >
                    <Footprints size="0.75rem" /> Step by step
                  </button>
                  <button
                    type="button"
                    onClick={() => void queueDestination(selectedDestination, "travel_now")}
                    disabled={disabled}
                    className="flex min-h-11 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:opacity-50"
                    aria-label={`Travel now to ${selectedDestination.name}`}
                  >
                    <Zap size="0.75rem" /> Travel now
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
