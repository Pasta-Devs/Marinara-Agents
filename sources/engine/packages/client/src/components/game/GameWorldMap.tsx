import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  LocateFixed,
  Route,
} from "lucide-react";
import {
  compareSpatialLocations,
  resolveSpatialBreadcrumb,
  spatialRadialPlacement,
  type SpatialContextResponse,
  type SpatialLocation,
} from "@marinara-engine/shared";
import { useChatStore } from "../../stores/chat.store";
import { cn, generateClientId } from "../../lib/utils";

interface GameWorldMapProps {
  chatId: string;
  spatial: SpatialContextResponse;
  disabled?: boolean;
  compact?: boolean;
  onDestinationQueued?: () => void;
}

function sortLocations(locations: SpatialLocation[]): SpatialLocation[] {
  return [...locations].sort(compareSpatialLocations);
}

function defaultViewLocationId(spatial: SpatialContextResponse): string | null {
  const definition = spatial.definition;
  if (!definition) return null;
  const current = definition.locations.find(
    (location) => location.id === spatial.currentLocationId && location.status === "active",
  );
  if (!current) {
    return sortLocations(
      definition.locations.filter((location) => location.status === "active" && location.parentId === null),
    )[0]?.id ?? null;
  }
  const hasActiveChildren = definition.locations.some(
    (location) => location.status === "active" && location.parentId === current.id,
  );
  return hasActiveChildren ? current.id : (current.parentId ?? current.id);
}

function displayCoordinate(value: number): number {
  return Math.min(86, Math.max(14, value));
}

export function GameWorldMap({
  chatId,
  spatial,
  disabled = false,
  compact = false,
  onDestinationQueued,
}: GameWorldMapProps) {
  const definition = spatial.definition;
  const centeredViewLocationId = defaultViewLocationId(spatial);
  const [viewLocationId, setViewLocationId] = useState<string | null>(() => centeredViewLocationId);
  const [selectedId, setSelectedId] = useState<string | null>(spatial.currentLocationId);
  const pending = useChatStore((state) => state.pendingSpatialTransitions.get(chatId) ?? null);
  const setPending = useChatStore((state) => state.setPendingSpatialTransition);

  useEffect(() => {
    setViewLocationId(centeredViewLocationId);
    setSelectedId(spatial.currentLocationId);
  }, [centeredViewLocationId, definition?.revision, spatial.currentLocationId]);

  const activeLocations = useMemo(
    () => definition?.locations.filter((location) => location.status === "active") ?? [],
    [definition?.locations],
  );
  const locationById = useMemo(
    () => new Map(activeLocations.map((location) => [location.id, location])),
    [activeLocations],
  );
  const viewLocation = viewLocationId ? (locationById.get(viewLocationId) ?? null) : null;
  const visibleLocations = useMemo(
    () =>
      sortLocations(
        activeLocations.filter((location) =>
          viewLocation ? location.parentId === viewLocation.id : location.parentId === null,
        ),
      ),
    [activeLocations, viewLocation],
  );
  const visibleLocationIds = useMemo(
    () => new Set(visibleLocations.map((location) => location.id)),
    [visibleLocations],
  );
  const placementById = useMemo(
    () =>
      new Map(
        visibleLocations.map((location, index) => [
          location.id,
          location.placement ?? spatialRadialPlacement(index, visibleLocations.length, 34),
        ]),
      ),
    [visibleLocations],
  );
  const visibleLinks = useMemo(() => {
    const seen = new Set<string>();
    return visibleLocations.flatMap((location) =>
      location.links.flatMap((link) => {
        if (link.state !== "available" || !visibleLocationIds.has(link.targetId)) return [];
        const key = [location.id, link.targetId].sort().join(":");
        if (seen.has(key)) return [];
        seen.add(key);
        return [{ key, from: location.id, to: link.targetId }];
      }),
    );
  }, [visibleLocationIds, visibleLocations]);
  const selected = selectedId ? (locationById.get(selectedId) ?? null) : null;
  const selectedDestination = spatial.destinations.find((destination) => destination.id === selected?.id);
  const selectedHasChildren = selected
    ? activeLocations.some((location) => location.parentId === selected.id)
    : false;
  const viewBreadcrumb = definition ? resolveSpatialBreadcrumb(definition, viewLocation?.id ?? null) : [];
  const currentBreadcrumb = spatial.breadcrumb.map((crumb) => crumb.name).join(" › ");
  const presentation = viewLocation?.childPresentation ?? "map";
  const canBrowseUp = viewLocation !== null;

  const browseTo = (locationId: string | null) => {
    setViewLocationId(locationId);
    setSelectedId(locationId);
  };

  const centerCurrent = () => {
    setViewLocationId(centeredViewLocationId);
    setSelectedId(spatial.currentLocationId);
  };

  const queueDestination = () => {
    if (!definition || !spatial.currentLocationId || !selectedDestination || disabled) return;
    setPending(chatId, {
      transition: {
        destinationId: selectedDestination.id,
        expectedDefinitionRevision: definition.revision,
        expectedCurrentLocationId: spatial.currentLocationId,
        commandId: generateClientId(),
      },
      destinationName: selectedDestination.name,
      relation: selectedDestination.relation,
      ...(selectedDestination.label ? { label: selectedDestination.label } : {}),
      status: "ready",
    });
    onDestinationQueued?.();
  };

  const renderLocationRow = (location: SpatialLocation, layer = false) => {
    const isCurrent = location.id === spatial.currentLocationId;
    const isPending = location.id === pending?.transition.destinationId;
    const isSelected = location.id === selectedId;
    const hasChildren = activeLocations.some((candidate) => candidate.parentId === location.id);
    return (
      <button
        key={location.id}
        type="button"
        onClick={() => setSelectedId(location.id)}
        className={cn(
          "flex min-h-11 w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]",
          isSelected
            ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]"
            : "border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)]",
        )}
        aria-label={`${location.name}${isCurrent ? ", current story location" : ""}${isPending ? ", pending destination" : ""}`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--marinara-chat-chrome-highlight-bg)] text-lg" aria-hidden="true">
          {location.icon || "⌖"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
            {location.name}
          </span>
          <span className="block truncate text-[0.625rem] capitalize text-[var(--marinara-chat-chrome-panel-muted)]">
            {layer ? `Layer ${location.layerOrder ?? 0}` : location.kind}
            {isCurrent ? " · You are here" : isPending ? " · Pending" : ""}
          </span>
        </span>
        {hasChildren && <ChevronRight size="0.875rem" className="shrink-0 text-[var(--marinara-chat-chrome-panel-muted)]" />}
      </button>
    );
  };

  if (!definition || !definition.enabled || activeLocations.length === 0) return null;

  return (
    <section aria-label="Hierarchical world map" className="min-w-0">
      <div className="border-b border-[var(--marinara-chat-chrome-panel-divider)] px-1 pb-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => browseTo(viewLocation?.parentId ?? null)}
            disabled={!canBrowseUp}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--marinara-chat-chrome-button-text)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:opacity-30"
            aria-label="Browse up one location"
          >
            <ChevronLeft size="1rem" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-xs font-bold text-[var(--marinara-chat-chrome-panel-title)]">
              <span className="mr-1" aria-hidden="true">{viewLocation?.icon || "🌍"}</span>
              {viewLocation?.name || "World"}
            </p>
            <p className="truncate text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]" title={currentBreadcrumb}>
              Story location: {currentBreadcrumb || "Unavailable"}
            </p>
          </div>
          <button
            type="button"
            onClick={centerCurrent}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--marinara-chat-chrome-button-text)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
            aria-label="Center current story location"
            title="Center current story location"
          >
            <LocateFixed size="1rem" />
          </button>
        </div>
        {viewBreadcrumb.length > 0 && (
          <div className="flex min-w-0 items-center justify-center gap-0.5 overflow-hidden" aria-label="Viewed location breadcrumb">
            {viewBreadcrumb.map((crumb, index) => (
              <span key={crumb.id} className="flex min-w-0 items-center">
                {index > 0 && <ChevronRight size="0.625rem" className="shrink-0 opacity-50" />}
                <button
                  type="button"
                  onClick={() => browseTo(crumb.id)}
                  className="max-w-24 truncate rounded px-1 py-0.5 text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)] hover:text-[var(--marinara-chat-chrome-panel-title)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
                  title={crumb.name}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {pending && (
        <div
          className={cn(
            "mx-1 mt-2 flex min-h-10 items-center gap-2 rounded-lg border px-2 text-[0.6875rem]",
            pending.status === "needs_review"
              ? "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200"
              : "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]",
          )}
          role="status"
        >
          {pending.status === "needs_review" ? <AlertTriangle size="0.8125rem" /> : <Route size="0.8125rem" />}
          <span className="min-w-0 flex-1 truncate">
            {pending.status === "needs_review" ? "Review destination" : "Pending"}: {pending.destinationName}
          </span>
        </div>
      )}

      <div className={cn("min-h-0 overflow-auto overscroll-contain py-2", compact ? "max-h-[40dvh]" : "max-h-80")}>
        {visibleLocations.length === 0 ? (
          <div className="flex min-h-36 flex-col items-center justify-center px-5 text-center">
            <span className="text-2xl" aria-hidden="true">{viewLocation?.icon || "📍"}</span>
            <p className="mt-2 text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">No places inside this location</p>
            <p className="mt-1 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
              Browse up to see nearby places.
            </p>
          </div>
        ) : presentation === "map" ? (
          <div className={cn("relative overflow-hidden rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)]", compact ? "h-56" : "h-52")}>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "linear-gradient(to right, var(--marinara-chat-chrome-panel-divider) 1px, transparent 1px), linear-gradient(to bottom, var(--marinara-chat-chrome-panel-divider) 1px, transparent 1px)",
                backgroundSize: "1.5rem 1.5rem",
              }}
            />
            <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
              {visibleLinks.map((link) => {
                const from = placementById.get(link.from);
                const to = placementById.get(link.to);
                if (!from || !to) return null;
                return (
                  <line
                    key={link.key}
                    x1={`${displayCoordinate(from.x)}%`}
                    y1={`${displayCoordinate(from.y)}%`}
                    x2={`${displayCoordinate(to.x)}%`}
                    y2={`${displayCoordinate(to.y)}%`}
                    stroke="var(--marinara-chat-chrome-panel-muted)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    opacity="0.55"
                  />
                );
              })}
            </svg>
            {visibleLocations.map((location) => {
              const placement = placementById.get(location.id) ?? { x: 50, y: 50 };
              const isCurrent = location.id === spatial.currentLocationId;
              const isPending = location.id === pending?.transition.destinationId;
              const isSelected = location.id === selectedId;
              return (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => setSelectedId(location.id)}
                  className="absolute z-10 flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
                  style={{ left: `${displayCoordinate(placement.x)}%`, top: `${displayCoordinate(placement.y)}%` }}
                  aria-label={`${location.name}${isCurrent ? ", current story location" : ""}${isPending ? ", pending destination" : ""}`}
                >
                  <span
                    className={cn(
                      "relative flex h-11 w-11 items-center justify-center rounded-full border bg-[var(--marinara-chat-chrome-panel-bg)] text-xl shadow-md transition-[border-color,transform,background-color] duration-200",
                      isSelected
                        ? "scale-105 border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]"
                        : "border-[var(--marinara-chat-chrome-panel-border)] hover:border-[var(--marinara-chat-chrome-button-border-hover)]",
                      isCurrent && "ring-2 ring-[var(--marinara-chat-chrome-focus-ring)] ring-offset-1 ring-offset-[var(--background)]",
                    )}
                    aria-hidden="true"
                  >
                    {location.icon || "⌖"}
                    {isPending && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">
                        <Route size="0.5625rem" />
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block w-full truncate rounded bg-[var(--marinara-chat-chrome-panel-bg)]/90 px-1 text-center text-[0.625rem] font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                    {location.name}
                  </span>
                  {isCurrent && <span className="text-[0.5625rem] font-semibold text-[var(--marinara-chat-chrome-accent)]">You are here</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-1.5" role="list" aria-label={presentation === "layers" ? "Location layers" : "Locations"}>
            {(presentation === "layers"
              ? [...visibleLocations].sort(
                  (left, right) => (right.layerOrder ?? 0) - (left.layerOrder ?? 0),
                )
              : visibleLocations
            ).map((location) => (
              <div key={location.id} role="listitem">{renderLocationRow(location, presentation === "layers")}</div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="border-t border-[var(--marinara-chat-chrome-panel-divider)] px-1 pt-2">
          <div className="flex items-start gap-2">
            <span className="text-lg" aria-hidden="true">{selected.icon || "📍"}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-[var(--marinara-chat-chrome-panel-title)]">{selected.name}</p>
              <p className="line-clamp-2 text-[0.6875rem] leading-4 text-[var(--marinara-chat-chrome-panel-muted)]">
                {selected.description || `A ${selected.kind} in this world.`}
              </p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            {selectedHasChildren && selected.id !== viewLocation?.id && (
              <button
                type="button"
                onClick={() => browseTo(selected.id)}
                className="flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] px-3 text-[0.6875rem] font-semibold text-[var(--marinara-chat-chrome-button-text-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
              >
                <CornerDownRight size="0.75rem" /> Explore
              </button>
            )}
            {selected.id === spatial.currentLocationId ? (
              <span className="flex min-h-11 items-center px-2 text-[0.6875rem] font-semibold text-[var(--marinara-chat-chrome-accent)]">
                You are here
              </span>
            ) : selected.id === pending?.transition.destinationId ? (
              <span className="flex min-h-11 items-center gap-1.5 px-2 text-[0.6875rem] font-semibold text-[var(--marinara-chat-chrome-accent)]">
                <Route size="0.75rem" /> Destination queued
              </span>
            ) : selectedDestination ? (
              <button
                type="button"
                onClick={queueDestination}
                disabled={disabled}
                className="flex min-h-11 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-[0.6875rem] font-bold text-[var(--primary-foreground)] shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Set destination: ${selected.name}`}
              >
                <Route size="0.75rem" /> Set destination
              </button>
            ) : (
              <span className="flex min-h-11 items-center px-2 text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                Browse only from here
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
