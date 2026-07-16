import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Link2, Loader2, Map, RefreshCw, Unlink } from "lucide-react";
import { toast } from "sonner";
import type { GameMap, SpatialContextDefinition, SpatialLocation } from "@marinara-engine/shared";
import {
  useUpdateSpatialGameMapBinding,
  type UpdateGameMapBindingInput,
} from "../use-spatial-resources";
import {
  useApplyGameMapBindingReconciliation,
  useGameMapBindingReconciliation,
  type GameMapBindingReference,
  type GameMapBindingTarget,
} from "../../../hooks/use-spatial-context";

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

function reconciliationTarget(reference: GameMapBindingReference): GameMapBindingTarget {
  if (reference.target === "cell") {
    return { target: "cell", mapId: reference.mapId, x: reference.x, y: reference.y };
  }
  if (reference.target === "node") {
    return { target: "node", mapId: reference.mapId, nodeId: reference.nodeId };
  }
  return { target: "map", mapId: reference.mapId };
}

function reconciliationTargetKey(reference: GameMapBindingReference): string {
  if (reference.target === "cell") return `cell:${reference.mapId}:${reference.x}:${reference.y}`;
  if (reference.target === "node") return `node:${reference.mapId}:${reference.nodeId}`;
  return `map:${reference.mapId}`;
}

function GameMapReconciliationReview({
  chatId,
  definition,
  disabled,
}: {
  chatId: string;
  definition: SpatialContextDefinition;
  disabled: boolean;
}) {
  const reconciliation = useGameMapBindingReconciliation(chatId, !disabled);
  const applyReconciliation = useApplyGameMapBindingReconciliation();

  if (disabled) return null;
  if (reconciliation.isLoading) {
    return (
      <div className="flex min-h-11 items-center gap-2 border-y border-[var(--marinara-chat-chrome-panel-divider)] py-3 text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
        <Loader2 size="0.75rem" className="animate-spin" /> Checking existing Game map names…
      </div>
    );
  }
  if (reconciliation.isError) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-y border-[var(--marinara-chat-chrome-panel-divider)] py-3 text-xs">
        <AlertTriangle size="0.8125rem" className="text-amber-400" />
        <span className="min-w-48 flex-1 text-[var(--marinara-chat-chrome-panel-muted)]">
          Existing map matches could not be checked.
        </span>
        <button
          type="button"
          onClick={() => void reconciliation.refetch()}
          className="mari-chrome-control min-h-11 px-3 text-xs"
        >
          <RefreshCw size="0.75rem" /> Retry
        </button>
      </div>
    );
  }

  const preview = reconciliation.data;
  if (!preview || preview.totalTargetCount === 0) return null;
  if (preview.suggestions.length === 0 && preview.conflicts.length === 0 && preview.unmatched.length === 0) {
    return null;
  }
  const reviewedSuggestions = preview.suggestions.slice(0, 500);

  const applyExactMatches = async () => {
    try {
      const result = await applyReconciliation.mutateAsync({
        chatId,
        expectedDefinitionRevision: definition.revision,
        bindings: reviewedSuggestions.map((suggestion) => ({
          target: reconciliationTarget(suggestion.target),
          spatialLocationId: suggestion.spatialLocationId,
        })),
      });
      toast.success(
        result.bindingCount
          ? `Applied ${result.bindingCount} reviewed Game map ${result.bindingCount === 1 ? "match" : "matches"}.`
          : "Those Game map matches were already applied.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reconcile existing Game maps.");
    }
  };

  return (
    <section
      className="space-y-3 border-y border-[var(--marinara-chat-chrome-panel-divider)] py-3"
      aria-labelledby="game-map-reconciliation-heading"
    >
      <div className="flex items-start gap-2">
        <CheckCircle2 size="0.875rem" className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
        <div className="min-w-0">
          <h5 id="game-map-reconciliation-heading" className="text-xs font-semibold">
            Review existing map matches
          </h5>
          <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
            Exact normalized names are suggestions only. Existing bindings stay unchanged until you apply this review.
          </p>
        </div>
      </div>

      {preview.suggestions.length > 0 && (
        <div className="max-h-48 overflow-y-auto border-y border-[var(--marinara-chat-chrome-panel-divider)]">
          {preview.suggestions.map((suggestion) => (
            <div
              key={reconciliationTargetKey(suggestion.target)}
              className="flex min-h-11 items-center gap-2 py-2 text-[0.6875rem] [&+&]:border-t [&+&]:border-[var(--marinara-chat-chrome-panel-divider)]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{suggestion.sourceName}</span>
                <span className="block truncate text-[var(--marinara-chat-chrome-panel-muted)]">
                  {suggestion.target.mapName} · {suggestion.target.targetName}
                </span>
              </span>
              <span aria-hidden="true" className="text-[var(--marinara-chat-chrome-panel-muted)]">
                →
              </span>
              <span className="max-w-[45%] truncate font-medium">{suggestion.spatialLocationName}</span>
            </div>
          ))}
        </div>
      )}

      {preview.conflicts.length > 0 && (
        <details className="text-[0.6875rem]">
          <summary className="min-h-11 cursor-pointer py-2 font-medium text-amber-400">
            {preview.conflicts.length} ambiguous {preview.conflicts.length === 1 ? "name" : "names"} need manual binding
          </summary>
          <ul className="max-h-40 space-y-2 overflow-y-auto pb-2 text-[var(--marinara-chat-chrome-panel-muted)]">
            {preview.conflicts.map((conflict) => (
              <li key={reconciliationTargetKey(conflict.target)}>
                <span className="font-medium text-[var(--marinara-chat-chrome-panel-text)]">{conflict.sourceName}</span>
                {": "}
                {conflict.candidateLocations.map((candidate) => candidate.name).join(", ")}
              </li>
            ))}
          </ul>
        </details>
      )}

      {preview.unmatched.length > 0 && (
        <details className="text-[0.6875rem]">
          <summary className="min-h-11 cursor-pointer py-2 font-medium text-[var(--marinara-chat-chrome-panel-muted)]">
            {preview.unmatched.length} unmatched map {preview.unmatched.length === 1 ? "position" : "positions"}
          </summary>
          <ul className="max-h-40 space-y-1 overflow-y-auto pb-2 text-[var(--marinara-chat-chrome-panel-muted)]">
            {preview.unmatched.map((target) => (
              <li key={reconciliationTargetKey(target.target)}>{target.sourceName}</li>
            ))}
          </ul>
        </details>
      )}

      {preview.suggestions.length > 0 && (
        <button
          type="button"
          disabled={applyReconciliation.isPending}
          onClick={() => void applyExactMatches()}
          className="mari-chrome-control min-h-11 w-full justify-center px-3 text-xs"
          aria-live="polite"
        >
          {applyReconciliation.isPending ? (
            <Loader2 size="0.75rem" className="animate-spin" />
          ) : (
            <Link2 size="0.75rem" />
          )}
          Apply {preview.suggestions.length > reviewedSuggestions.length ? "next " : ""}
          {reviewedSuggestions.length} reviewed exact {reviewedSuggestions.length === 1 ? "match" : "matches"}
        </button>
      )}
    </section>
  );
}

export function GameMapBindingsPanel({
  chatId,
  location,
  definition,
  maps,
  disabled = false,
}: GameMapBindingsPanelProps) {
  const updateBinding = useUpdateSpatialGameMapBinding();
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

      <GameMapReconciliationReview chatId={chatId} definition={definition} disabled={disabled} />

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
