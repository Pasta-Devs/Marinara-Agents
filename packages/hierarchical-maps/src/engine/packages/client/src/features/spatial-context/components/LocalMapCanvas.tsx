import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { CornerDownRight, MapPin, Move } from "lucide-react";
import type { SpatialLocation } from "@marinara-engine/shared";
import { cn } from "../package-utils";

interface LocalMapCanvasProps {
  locations: SpatialLocation[];
  selectedId: string | null;
  onSelect: (locationId: string) => void;
  onEnter: (locationId: string) => void;
  editing?: boolean;
  onMove?: (locationId: string, placement: { x: number; y: number }) => void;
}

function clampCoordinate(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

export function LocalMapCanvas({
  locations,
  selectedId,
  onSelect,
  onEnter,
  editing = false,
  onMove,
}: LocalMapCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const moveFromPointer = (locationId: string, event: PointerEvent<HTMLElement>) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    onMove?.(locationId, {
      x: clampCoordinate(((event.clientX - bounds.left) / bounds.width) * 100),
      y: clampCoordinate(((event.clientY - bounds.top) / bounds.height) * 100),
    });
  };

  const nudge = (location: SpatialLocation, event: KeyboardEvent<HTMLButtonElement>) => {
    if (!editing || !onMove || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 5 : 1;
    const placement = location.placement ?? { x: 50, y: 50 };
    onMove(location.id, {
      x: clampCoordinate(placement.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0)),
      y: clampCoordinate(placement.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0)),
    });
  };

  return (
    <div
      ref={canvasRef}
      className="relative min-h-[22rem] overflow-hidden rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)]"
      data-layout-editing={editing ? "true" : "false"}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--marinara-chat-chrome-panel-divider) 1px, transparent 1px), linear-gradient(to bottom, var(--marinara-chat-chrome-panel-divider) 1px, transparent 1px)",
          backgroundSize: "2rem 2rem",
        }}
      />
      {editing && (
        <div className="pointer-events-none absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--background)]/95 px-2.5 py-1.5 text-[0.625rem] font-semibold text-[var(--marinara-chat-chrome-button-text-active)] shadow-sm">
          <Move size="0.6875rem" /> Drag places · Arrow keys nudge · Shift moves 5
        </div>
      )}
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
              onKeyDown={(event) => nudge(location, event)}
              onPointerDown={(event) => {
                if (!editing || !onMove) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                setDraggingId(location.id);
                onSelect(location.id);
                moveFromPointer(location.id, event);
              }}
              onPointerMove={(event) => {
                if (!editing || draggingId !== location.id) return;
                moveFromPointer(location.id, event);
              }}
              onPointerUp={(event) => {
                if (draggingId !== location.id) return;
                moveFromPointer(location.id, event);
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                setDraggingId(null);
              }}
              onPointerCancel={() => setDraggingId(null)}
              aria-pressed={selected}
              aria-description={editing ? "Drag to reposition. Use arrow keys to nudge; hold Shift for five units." : undefined}
              className={cn(
                "flex min-h-11 w-full items-center gap-2 rounded-xl border bg-[var(--marinara-chat-chrome-panel-bg)] px-3 py-2 text-left shadow-md transition-[border-color,background-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]",
                selected
                  ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]"
                  : "border-[var(--marinara-chat-chrome-panel-border)] hover:border-[var(--marinara-chat-chrome-button-border-hover)]",
                location.status === "archived" && "opacity-60",
                editing && "cursor-move touch-none",
                draggingId === location.id && "scale-[1.02] shadow-lg",
              )}
              style={{ touchAction: editing ? "none" : undefined }}
            >
              <MapPin size="0.875rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{location.name || "Untitled"}</span>
            </button>
            {!editing && (
              <button
                type="button"
                onClick={() => onEnter(location.id)}
                className="mari-chrome-control mx-auto mt-1 min-h-11 px-3 text-[0.625rem]"
              >
                <CornerDownRight size="0.6875rem" /> Enter
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
