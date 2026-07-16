import { CornerDownRight, Layers3 } from "lucide-react";
import type { SpatialLocation } from "@marinara-engine/shared";
import { cn } from "../package-utils";

interface LayerSelectorProps {
  locations: SpatialLocation[];
  selectedId: string | null;
  onSelect: (locationId: string) => void;
  onEnter: (locationId: string) => void;
}

export function LayerSelector({ locations, selectedId, onSelect, onEnter }: LayerSelectorProps) {
  const layers = [...locations].sort(
    (left, right) => (right.layerOrder ?? 0) - (left.layerOrder ?? 0) || left.name.localeCompare(right.name),
  );
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-2" role="list" aria-label="Location layers">
      {layers.length === 0 ? (
        <p className="py-10 text-center text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
          Add a child location to create the first layer.
        </p>
      ) : (
        layers.map((location) => (
          <div
            key={location.id}
            role="listitem"
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 transition-colors duration-200",
              selectedId === location.id
                ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]"
                : "border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)]",
              location.status === "archived" && "opacity-60",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-accent)]">
              <Layers3 size="0.875rem" />
            </span>
            <button
              type="button"
              onClick={() => onSelect(location.id)}
              className="min-w-0 flex-1 self-stretch rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
            >
              <span className="block truncate text-sm font-medium text-[var(--marinara-chat-chrome-panel-title)]">
                {location.name || "Untitled layer"}
              </span>
              <span className="text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                Layer {location.layerOrder ?? 0}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onEnter(location.id)}
              className="mari-chrome-control min-h-11 px-3 text-xs"
            >
              <CornerDownRight size="0.75rem" /> Enter
            </button>
          </div>
        ))
      )}
    </div>
  );
}
