import { useEffect, useMemo, useState } from "react";
import { Link2, Map, Unlink } from "lucide-react";
import { toast } from "sonner";
import type { GameMap, SpatialContextDefinition, SpatialLocation } from "@marinara-engine/shared";
import { useUpdateGameMapBinding, type UpdateGameMapBindingInput } from "../../../hooks/use-game";

interface GameMapBindingsPanelProps {
  chatId: string;
  location: SpatialLocation;
  definition: SpatialContextDefinition;
  maps: GameMap[];
  disabled?: boolean;
}

const CONTROL_CLASS =
  "min-h-11 w-full rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--marinara-chat-chrome-panel-text)] outline-none focus:border-[var(--marinara-chat-chrome-button-border-active)] focus:ring-2 focus:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:opacity-50";

function slugifyMapId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function mapId(map: GameMap, index: number): string {
  return map.id?.trim() || slugifyMapId(map.name) || `map-${index + 1}`;
}

function targetBinding(map: GameMap, targetValue: string): string | null {
  if (targetValue === "map") return map.spatialLocationId ?? null;
  if (targetValue.startsWith("cell:")) {
    const [, x, y] = targetValue.split(":");
    return map.cells?.find((cell) => cell.x === Number(x) && cell.y === Number(y))?.spatialLocationId ?? null;
  }
  if (targetValue.startsWith("node:")) {
    const nodeId = targetValue.slice("node:".length);
    return map.nodes?.find((node) => node.id === nodeId)?.spatialLocationId ?? null;
  }
  return null;
}

function buildInput(
  chatId: string,
  selectedMapId: string,
  targetValue: string,
  spatialLocationId: string | null,
): UpdateGameMapBindingInput {
  if (targetValue.startsWith("cell:")) {
    const [, x, y] = targetValue.split(":");
    return {
      target: "cell",
      chatId,
      mapId: selectedMapId,
      x: Number(x),
      y: Number(y),
      spatialLocationId,
    };
  }
  if (targetValue.startsWith("node:")) {
    return {
      target: "node",
      chatId,
      mapId: selectedMapId,
      nodeId: targetValue.slice("node:".length),
      spatialLocationId,
    };
  }
  return { target: "map", chatId, mapId: selectedMapId, spatialLocationId };
}

export function GameMapBindingsPanel({
  chatId,
  location,
  definition,
  maps,
  disabled = false,
}: GameMapBindingsPanelProps) {
  const updateBinding = useUpdateGameMapBinding();
  const [selectedMapId, setSelectedMapId] = useState(() => (maps[0] ? mapId(maps[0], 0) : ""));
  const [targetValue, setTargetValue] = useState("map");
  const selectedMap = useMemo(
    () => maps.find((map, index) => mapId(map, index) === selectedMapId) ?? maps[0] ?? null,
    [maps, selectedMapId],
  );
  const effectiveMapId = selectedMap
    ? mapId(selectedMap, Math.max(0, maps.findIndex((candidate) => candidate === selectedMap)))
    : "";

  useEffect(() => {
    if (!selectedMap) return;
    if (selectedMapId !== effectiveMapId) setSelectedMapId(effectiveMapId);
    const validTarget =
      targetValue === "map" ||
      (targetValue.startsWith("cell:") &&
        selectedMap.type === "grid" &&
        (selectedMap.cells ?? []).some((cell) => targetValue === `cell:${cell.x}:${cell.y}`)) ||
      (targetValue.startsWith("node:") &&
        selectedMap.type === "node" &&
        (selectedMap.nodes ?? []).some((node) => targetValue === `node:${node.id}`));
    if (!validTarget) setTargetValue("map");
  }, [effectiveMapId, selectedMap, selectedMapId, targetValue]);

  if (maps.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--marinara-chat-chrome-panel-border)] px-3 py-4 text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
        Generate or add a Game map first. You can then bind its whole area, individual cells, or nodes to this story location.
      </div>
    );
  }

  const currentBinding = selectedMap ? targetBinding(selectedMap, targetValue) : null;
  const boundHere = currentBinding === location.id;
  const boundLocationName = currentBinding
    ? definition.locations.find((candidate) => candidate.id === currentBinding)?.name
    : null;
  const targetLabel = targetValue === "map" ? "whole map" : targetValue.startsWith("cell:") ? "map cell" : "map node";
  const runUpdate = async (spatialLocationId: string | null) => {
    if (!effectiveMapId || disabled || updateBinding.isPending) return;
    try {
      await updateBinding.mutateAsync(buildInput(chatId, effectiveMapId, targetValue, spatialLocationId));
      toast.success(spatialLocationId ? `Bound ${targetLabel} to ${location.name}.` : `Cleared ${targetLabel} binding.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update the Game map binding.");
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-highlight-bg)]/40 p-3">
      <div className="flex items-start gap-2">
        <Map size="0.875rem" className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
        <div className="min-w-0">
          <h4 className="text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">Game map binding</h4>
          <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
            Bound positions stage a story-location move. Unbound positions keep normal tactical movement.
          </p>
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium">Game map</span>
        <select className={CONTROL_CLASS} value={effectiveMapId} onChange={(event) => setSelectedMapId(event.target.value)}>
          {maps.map((map, index) => (
            <option key={mapId(map, index)} value={mapId(map, index)}>
              {map.name || `Map ${index + 1}`}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium">Map position</span>
        <select className={CONTROL_CLASS} value={targetValue} onChange={(event) => setTargetValue(event.target.value)}>
          <option value="map">Whole map</option>
          {selectedMap?.type === "grid" &&
            (selectedMap.cells ?? []).map((cell) => (
              <option key={`${cell.x}:${cell.y}`} value={`cell:${cell.x}:${cell.y}`}>
                {cell.emoji || "⌖"} Cell {cell.x},{cell.y} — {cell.label || "Untitled"}
              </option>
            ))}
          {selectedMap?.type === "node" &&
            (selectedMap.nodes ?? []).map((node) => (
              <option key={node.id} value={`node:${node.id}`}>
                {node.emoji || "⌖"} Node — {node.label || node.id}
              </option>
            ))}
        </select>
      </label>

      <div className="rounded-lg border border-[var(--marinara-chat-chrome-panel-divider)] px-3 py-2 text-[0.6875rem]">
        <span className="text-[var(--marinara-chat-chrome-panel-muted)]">Current binding: </span>
        <span className="font-medium">
          {boundHere
            ? location.name
            : currentBinding
              ? boundLocationName || "Missing story location"
              : "Unbound tactical position"}
        </span>
      </div>

      {disabled && (
        <p className="text-[0.6875rem] text-amber-400">Save the hierarchy before changing Game map bindings.</p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={disabled || updateBinding.isPending || boundHere}
          onClick={() => void runUpdate(location.id)}
          className="mari-chrome-control min-h-11 justify-center px-3 text-xs"
        >
          <Link2 size="0.75rem" /> {boundHere ? "Bound here" : "Bind to this location"}
        </button>
        <button
          type="button"
          disabled={disabled || updateBinding.isPending || !currentBinding}
          onClick={() => void runUpdate(null)}
          className="mari-chrome-control min-h-11 justify-center px-3 text-xs"
        >
          <Unlink size="0.75rem" /> Clear binding
        </button>
      </div>
    </div>
  );
}
