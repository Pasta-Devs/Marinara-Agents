import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, MapPin, RefreshCw, Route, X } from "lucide-react";
import type { SpatialDestination, SpatialDestinationRelation } from "@marinara-engine/shared";
import { useSpatialContext } from "../../../hooks/use-spatial-context";
import { cn, generateClientId } from "../package-utils";
import {
  clearPendingSpatialTransition,
  setPendingSpatialTransition,
  setPendingSpatialTransitionStatus,
  usePendingSpatialTransition,
} from "../pending-spatial-transitions";

interface SpatialContextRuntimeBarProps {
  chatId: string | null;
  disabled?: boolean;
  onPendingSelected?: () => void;
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
}: SpatialContextRuntimeBarProps) {
  const [open, setOpen] = useState(false);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(null);
  const spatial = useSpatialContext(chatId);
  const pending = usePendingSpatialTransition(chatId);
  const data = spatial.data;

  useEffect(() => {
    if (!chatId || !pending || !data) return;
    if (data.currentLocationId === pending.transition.destinationId) {
      clearPendingSpatialTransition(chatId, pending.transition.commandId);
      return;
    }
    const destinationStillAvailable = data.destinations.some(
      (destination) => destination.id === pending.transition.destinationId,
    );
    const isStale =
      data.definition?.revision !== pending.transition.expectedDefinitionRevision ||
      data.currentLocationId !== pending.transition.expectedCurrentLocationId ||
      !destinationStillAvailable;
    if (isStale) setPendingSpatialTransitionStatus(chatId, "needs_review");
  }, [chatId, data, pending]);

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
    ? data?.definition?.locations.find((location) => location.id === selectedDestination.id) ?? null
    : null;
  const currentLocation = data?.currentLocationId
    ? data.definition?.locations.find((location) => location.id === data.currentLocationId) ?? null
    : null;

  useEffect(() => {
    if (!selectedDestinationId) return;
    if (!data?.destinations.some((destination) => destination.id === selectedDestinationId)) {
      setSelectedDestinationId(null);
    }
  }, [data?.destinations, selectedDestinationId]);

  const enabled = Boolean(data?.definition?.enabled && data.currentLocationId);

  const queueDestination = (destination: SpatialDestination) => {
    if (!chatId || !data?.definition || !data.currentLocationId || disabled) return;
    setPendingSpatialTransition(chatId, {
      transition: {
        destinationId: destination.id,
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
        <span role="status" className="sr-only">Loading story location</span>
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
      className="mb-2 overflow-hidden rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] text-[var(--marinara-chat-chrome-panel-text)] shadow-sm"
    >
      <div className="flex min-h-11 items-center gap-1.5 px-2">
        <MapPin size="0.9375rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
        <button
          type="button"
          onClick={() => enabled && setOpen((value) => !value)}
          disabled={!enabled || disabled}
          aria-expanded={open}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:cursor-default"
          title={breadcrumbLabel}
        >
          <span className="shrink-0 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-[var(--marinara-chat-chrome-panel-muted)]">
            Story location
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{breadcrumbLabel}</span>
          {enabled &&
            (open ? <ChevronDown size="0.875rem" className="shrink-0" /> : <ChevronRight size="0.875rem" className="shrink-0" />)}
        </button>
      </div>

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
              {pending.status === "needs_review" ? "Needs review — choose the destination again" : "Moves with your next turn"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => chatId && clearPendingSpatialTransition(chatId, pending.transition.commandId)}
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
            ? "No map yet. Create one from Agents → Hierarchical Maps; your message draft is unchanged."
            : !data.definition.enabled
              ? "Map disabled. Its saved hierarchy and history are preserved until you enable it again."
              : "The saved map does not have an available current location. Open Hierarchical Maps to review it."}
        </div>
      )}

      {open && enabled && (
        <div className="border-t border-[var(--marinara-chat-chrome-panel-divider)] p-2">
          {currentLocation && (
            <div className="mb-2 flex items-start gap-2 rounded-lg bg-[var(--marinara-chat-chrome-highlight-bg)] px-3 py-2.5">
              <span className="text-base" aria-hidden="true">{currentLocation.icon || "📍"}</span>
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
                        const location = data?.definition?.locations.find((candidate) => candidate.id === destination.id);
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
                            <span className="text-base" aria-hidden="true">{location?.icon || "⌖"}</span>
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
                    <p className="px-2 py-2 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">{group.empty}</p>
                  )}
                </div>
              );
            })}
          </div>

          {selectedDestination && (
            <div className="mt-2 flex flex-wrap items-start gap-3 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)]/35 p-3">
              <span className="text-lg" aria-hidden="true">{selectedLocation?.icon || "📍"}</span>
              <div className="min-w-52 flex-1">
                <p className="text-xs font-semibold">{selectedDestination.name}</p>
                <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
                  {selectedLocation?.description || `A ${selectedDestination.kind} reachable from here.`}
                </p>
                <p className="mt-1 text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                  {destinationAction(selectedDestination)} with your next turn.
                </p>
              </div>
              {pending?.transition.destinationId === selectedDestination.id ? (
                <span className="flex min-h-11 items-center gap-1.5 px-2 text-xs font-semibold text-[var(--marinara-chat-chrome-accent)]">
                  <Route size="0.75rem" /> Destination queued
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => queueDestination(selectedDestination)}
                  disabled={disabled}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:opacity-50"
                  aria-label={`Set destination: ${selectedDestination.name}`}
                >
                  <Route size="0.75rem" /> Set destination
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
