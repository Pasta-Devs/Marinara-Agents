import { CornerDownRight, MapPin } from "lucide-react";
import type { SpatialLocation } from "@marinara-engine/shared";
import { cn } from "../../../lib/utils";

interface LocalMapCanvasProps {
  locations: SpatialLocation[];
  selectedId: string | null;
  onSelect: (locationId: string) => void;
  onEnter: (locationId: string) => void;
}

export function LocalMapCanvas({ locations, selectedId, onSelect, onEnter }: LocalMapCanvasProps) {
  return (
    <div className="relative min-h-[22rem] overflow-hidden rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--marinara-chat-chrome-panel-divider) 1px, transparent 1px), linear-gradient(to bottom, var(--marinara-chat-chrome-panel-divider) 1px, transparent 1px)",
          backgroundSize: "2rem 2rem",
        }}
      />
      {locations.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
          Add a child location to place it on this map.
        </div>
      )}
      {locations.map((location) => {
        const placement = location.placement ?? { x: 50, y: 50 };
        const selected = selectedId === location.id;
        return (
          <div
            key={location.id}
            className="absolute z-10 w-36 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${placement.x}%`, top: `${placement.y}%` }}
          >
            <button
              type="button"
              onClick={() => onSelect(location.id)}
              className={cn(
                "flex min-h-11 w-full items-center gap-2 rounded-xl border bg-[var(--marinara-chat-chrome-panel-bg)] px-3 py-2 text-left shadow-md transition-[border-color,background-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]",
                selected
                  ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]"
                  : "border-[var(--marinara-chat-chrome-panel-border)] hover:border-[var(--marinara-chat-chrome-button-border-hover)]",
                location.status === "archived" && "opacity-60",
              )}
            >
              <MapPin size="0.875rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{location.name || "Untitled"}</span>
            </button>
            <button
              type="button"
              onClick={() => onEnter(location.id)}
              className="mari-chrome-control mari-chrome-control--small mx-auto mt-1 min-h-8 px-2 text-[0.625rem]"
            >
              <CornerDownRight size="0.6875rem" /> Enter
            </button>
          </div>
        );
      })}
    </div>
  );
}
