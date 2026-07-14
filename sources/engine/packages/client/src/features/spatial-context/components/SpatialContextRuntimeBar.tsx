import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, MapPin, Route, X } from "lucide-react";
import type { SpatialDestination, SpatialDestinationRelation } from "@marinara-engine/shared";
import { useSpatialContext } from "../../../hooks/use-spatial-context";
import { useChatStore } from "../../../stores/chat.store";
import { cn, generateClientId } from "../../../lib/utils";

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
  { relation: "link", title: "Routes", empty: "No direct routes" },
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
  const spatial = useSpatialContext(chatId);
  const pending = useChatStore((state) =>
    chatId ? (state.pendingSpatialTransitions.get(chatId) ?? null) : null,
  );
  const setPending = useChatStore((state) => state.setPendingSpatialTransition);
  const clearPending = useChatStore((state) => state.clearPendingSpatialTransition);
  const setPendingStatus = useChatStore((state) => state.setPendingSpatialTransitionStatus);
  const data = spatial.data;

  useEffect(() => {
    if (!chatId || !pending || !data) return;
    if (data.currentLocationId === pending.transition.destinationId) {
      clearPending(chatId, pending.transition.commandId);
      return;
    }
    const destinationStillAvailable = data.destinations.some(
      (destination) => destination.id === pending.transition.destinationId,
    );
    const isStale =
      data.definition?.revision !== pending.transition.expectedDefinitionRevision ||
      data.currentLocationId !== pending.transition.expectedCurrentLocationId ||
      !destinationStillAvailable;
    if (isStale) setPendingStatus(chatId, "needs_review");
  }, [chatId, clearPending, data, pending, setPendingStatus]);

  const destinationsByRelation = useMemo(() => {
    const result = new Map<SpatialDestinationRelation, SpatialDestination[]>();
    for (const group of GROUPS) result.set(group.relation, []);
    for (const destination of data?.destinations ?? []) {
      result.get(destination.relation)?.push(destination);
    }
    return result;
  }, [data?.destinations]);

  const enabled = Boolean(data?.definition?.enabled && data.currentLocationId);
  if (!enabled && !pending) return null;

  const queueDestination = (destination: SpatialDestination) => {
    if (!chatId || !data?.definition || !data.currentLocationId || disabled) return;
    setPending(chatId, {
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

  const breadcrumbLabel = data?.breadcrumb.map((crumb) => crumb.name).join(" › ") || "Location unavailable";

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
            onClick={() => chatId && clearPending(chatId, pending.transition.commandId)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
            aria-label={`Cancel move to ${pending.destinationName}`}
          >
            <X size="0.875rem" />
          </button>
        </div>
      )}

      {open && enabled && (
        <div className="grid gap-3 border-t border-[var(--marinara-chat-chrome-panel-divider)] p-2 sm:grid-cols-3">
          {GROUPS.map((group) => {
            const destinations = destinationsByRelation.get(group.relation) ?? [];
            return (
              <div key={group.relation}>
                <h3 className="px-2 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-[var(--marinara-chat-chrome-panel-muted)]">
                  {group.title}
                </h3>
                {destinations.length > 0 ? (
                  <div className="grid gap-1">
                    {destinations.map((destination) => (
                      <button
                        key={destination.id}
                        type="button"
                        onClick={() => queueDestination(destination)}
                        disabled={disabled}
                        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-xs hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:opacity-50"
                      >
                        <span className="text-base" aria-hidden="true">
                          {data?.definition?.locations.find((location) => location.id === destination.id)?.icon || "⌖"}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{destinationAction(destination)}</span>
                          <span className="block truncate text-[0.625rem] capitalize text-[var(--marinara-chat-chrome-panel-muted)]">
                            {destination.kind}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-2 py-2 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">{group.empty}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
