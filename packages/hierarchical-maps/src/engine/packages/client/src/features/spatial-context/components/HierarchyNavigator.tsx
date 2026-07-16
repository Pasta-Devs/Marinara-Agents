import { useEffect, useMemo, useState } from "react";
import { Archive, ChevronDown, ChevronRight, Copy, CornerDownRight, MapPin, Plus, Split } from "lucide-react";
import { compareSpatialLocations, type SpatialContextDefinition, type SpatialLocation } from "@marinara-engine/shared";
import { cn } from "../../../lib/utils";

interface HierarchyNavigatorProps {
  definition: SpatialContextDefinition;
  selectedId: string | null;
  currentLocationId: string | null;
  onSelect: (locationId: string) => void;
  onEnter: (locationId: string) => void;
  onAddChild: (locationId: string) => void;
  onAddSibling: (locationId: string) => void;
  onDuplicate: (locationId: string) => void;
  onArchive: (locationId: string) => void;
}

export function HierarchyNavigator({
  definition,
  selectedId,
  currentLocationId,
  onSelect,
  onEnter,
  onAddChild,
  onAddSibling,
  onDuplicate,
  onArchive,
}: HierarchyNavigatorProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const childrenByParent = useMemo(() => {
    const result = new Map<string | null, SpatialLocation[]>();
    for (const location of definition.locations) {
      const children = result.get(location.parentId) ?? [];
      children.push(location);
      result.set(location.parentId, children);
    }
    for (const children of result.values()) children.sort(compareSpatialLocations);
    return result;
  }, [definition.locations]);

  useEffect(() => {
    if (!selectedId) return;
    const parents: string[] = [];
    let current = definition.locations.find((location) => location.id === selectedId);
    while (current?.parentId) {
      parents.push(current.parentId);
      current = definition.locations.find((location) => location.id === current?.parentId);
    }
    if (parents.length > 0) setExpanded((previous) => new Set([...previous, ...parents]));
  }, [definition.locations, selectedId]);

  const toggleExpanded = (locationId: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(locationId)) next.delete(locationId);
      else next.add(locationId);
      return next;
    });
  };

  const renderLocation = (location: SpatialLocation, depth: number) => {
    const children = childrenByParent.get(location.id) ?? [];
    const isExpanded = expanded.has(location.id);
    const selected = selectedId === location.id;
    return (
      <li key={location.id}>
        <div
          className={cn(
            "group flex min-h-11 items-center gap-1 rounded-lg border px-1.5 transition-colors duration-200",
            selected
              ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]"
              : "border-transparent hover:bg-[var(--marinara-chat-chrome-highlight-bg)]",
            location.status === "archived" && "opacity-60",
          )}
          style={{ paddingLeft: `${Math.min(depth, 8) * 0.875 + 0.375}rem` }}
        >
          <button
            type="button"
            onClick={() => toggleExpanded(location.id)}
            disabled={children.length === 0}
            aria-label={isExpanded ? `Collapse ${location.name}` : `Expand ${location.name}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--marinara-chat-chrome-panel-muted)] hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] disabled:opacity-25"
          >
            {isExpanded ? <ChevronDown size="0.875rem" /> : <ChevronRight size="0.875rem" />}
          </button>
          <button
            type="button"
            onClick={() => onSelect(location.id)}
            aria-current={selected ? "true" : undefined}
            className="flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
          >
            <span className="text-base" aria-hidden="true">
              {location.icon || "⌖"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-[var(--marinara-chat-chrome-panel-title)]">
                {location.name || "Untitled location"}
              </span>
              <span className="block truncate text-[0.625rem] capitalize text-[var(--marinara-chat-chrome-panel-muted)]">
                {location.kind}
                {location.id === currentLocationId ? " · current" : ""}
                {location.status === "archived" ? " · archived" : ""}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onEnter(location.id)}
            aria-label={`Enter ${location.name}`}
            title="Enter location"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--marinara-chat-chrome-panel-muted)] hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]"
          >
            <CornerDownRight size="0.875rem" />
          </button>
        </div>
        {isExpanded && children.length > 0 && <ul>{children.map((child) => renderLocation(child, depth + 1))}</ul>}
      </li>
    );
  };

  const selected = definition.locations.find((location) => location.id === selectedId) ?? null;

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Location hierarchy">
      <div className="border-b border-[var(--marinara-chat-chrome-panel-divider)] px-3 py-3">
        <div className="flex items-center gap-2">
          <MapPin size="0.875rem" className="text-[var(--marinara-chat-chrome-accent)]" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--marinara-chat-chrome-panel-title)]">
            Locations
          </h2>
          <span className="ml-auto text-[0.625rem] tabular-nums text-[var(--marinara-chat-chrome-panel-muted)]">
            {definition.locations.length}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {definition.locations.length === 0 ? (
          <p className="px-2 py-5 text-center text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
            No locations yet.
          </p>
        ) : (
          <ul className="space-y-0.5">{(childrenByParent.get(null) ?? []).map((root) => renderLocation(root, 0))}</ul>
        )}
      </div>
      {selected && (
        <div className="border-t border-[var(--marinara-chat-chrome-panel-divider)] p-2">
          <p className="mb-2 truncate px-1 text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
            Actions for {selected.name || "untitled location"}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onAddChild(selected.id)}
              className="mari-chrome-control min-h-11 px-2 text-xs"
            >
              <Plus size="0.75rem" /> Add child
            </button>
            <button
              type="button"
              onClick={() => onAddSibling(selected.id)}
              className="mari-chrome-control min-h-11 px-2 text-xs"
            >
              <Split size="0.75rem" /> Add sibling
            </button>
            <button
              type="button"
              onClick={() => onDuplicate(selected.id)}
              className="mari-chrome-control min-h-11 px-2 text-xs"
            >
              <Copy size="0.75rem" /> Duplicate
            </button>
            <button
              type="button"
              onClick={() => onArchive(selected.id)}
              disabled={selected.status === "archived"}
              className="mari-chrome-control min-h-11 px-2 text-xs"
            >
              <Archive size="0.75rem" /> Archive
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
