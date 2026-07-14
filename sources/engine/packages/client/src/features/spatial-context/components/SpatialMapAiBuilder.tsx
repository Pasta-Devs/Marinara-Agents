import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BookOpen, Check, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";
import type {
  GenerateSpatialMapDraftResponse,
  Lorebook,
  SpatialContextDefinition,
  SpatialMapGroundingMode,
  SpatialMapDraftOperation,
  SpatialMapDraftSize,
  SpatialOwnerMode,
} from "@marinara-engine/shared";
import { useGenerateSpatialMapDraft } from "../../../hooks/use-spatial-context";
import { useUIStore } from "../../../stores/ui.store";
import { cn } from "../../../lib/utils";

interface SpatialMapAiBuilderProps {
  chatId: string;
  ownerMode: SpatialOwnerMode;
  open: boolean;
  definition: SpatialContextDefinition;
  currentLocationId: string | null;
  hasCommittedSpatialHistory: boolean;
  dirty: boolean;
  initialResult?: GenerateSpatialMapDraftResponse | null;
  setupReview?: boolean;
  lorebooks?: Lorebook[];
  excludedLorebookIds?: string[];
  onClose: () => void;
  onApply: (definition: SpatialContextDefinition) => void;
}

const SIZE_OPTIONS: Array<{
  value: SpatialMapDraftSize;
  label: string;
  description: string;
}> = [
  { value: "small", label: "Small", description: "About 8 places" },
  { value: "medium", label: "Medium", description: "About 16 places" },
  { value: "large", label: "Large", description: "About 28 places" },
];

function sourceCopy(ownerMode: SpatialOwnerMode): string {
  return ownerMode === "game"
    ? "Uses the game setup, world overview, and party characters. Turn history is not included."
    : "Uses the chat setup and character cards. Turn history is not included.";
}

function operationTitle(operation: SpatialMapDraftOperation): string {
  if (operation === "expand") return "Expand the map with AI";
  if (operation === "replace") return "Replace the map draft with AI";
  return "Draft the map with AI";
}

export function SpatialMapAiBuilder({
  chatId,
  ownerMode,
  open,
  definition,
  currentLocationId,
  hasCommittedSpatialHistory,
  dirty,
  initialResult = null,
  setupReview = false,
  lorebooks = [],
  excludedLorebookIds = [],
  onClose,
  onApply,
}: SpatialMapAiBuilderProps) {
  const debugMode = useUIStore((state) => state.debugMode);
  const generateDraft = useGenerateSpatialMapDraft();
  const hasLocations = definition.locations.length > 0;
  const activeLocations = useMemo(
    () =>
      definition.locations
        .filter((location) => location.status === "active")
        .sort((left, right) => left.name.localeCompare(right.name)),
    [definition.locations],
  );
  const defaultTargetLocationId =
    (currentLocationId && activeLocations.some((location) => location.id === currentLocationId)
      ? currentLocationId
      : definition.startingLocationId) ??
    activeLocations[0]?.id ??
    "";
  const [operation, setOperation] = useState<SpatialMapDraftOperation>(
    initialResult?.operation ?? (hasLocations ? "expand" : "create"),
  );
  const [targetLocationId, setTargetLocationId] = useState(defaultTargetLocationId);
  const [size, setSize] = useState<SpatialMapDraftSize>(initialResult?.size ?? "medium");
  const [instructions, setInstructions] = useState("");
  const [result, setResult] = useState<GenerateSpatialMapDraftResponse | null>(initialResult);
  const [error, setError] = useState<string | null>(null);
  const [groundingMode, setGroundingMode] = useState<SpatialMapGroundingMode>(
    initialResult?.grounding?.mode ?? "setup",
  );
  const [sourceLorebookIds, setSourceLorebookIds] = useState<string[]>([]);
  const excludedLorebookIdSet = useMemo(() => new Set(excludedLorebookIds), [excludedLorebookIds]);
  const eligibleLorebooks = useMemo(
    () =>
      lorebooks
        .filter((lorebook) => lorebook.enabled !== false && !excludedLorebookIdSet.has(lorebook.id))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [excludedLorebookIdSet, lorebooks],
  );

  useEffect(() => {
    if (!open) return;
    setOperation(initialResult?.operation ?? (hasLocations ? "expand" : "create"));
    setTargetLocationId(initialResult?.targetLocationId ?? defaultTargetLocationId);
    if (initialResult) setSize(initialResult.size);
    setResult(initialResult);
    setError(null);
    setGroundingMode(initialResult?.grounding?.mode ?? "setup");
    setSourceLorebookIds([]);
  }, [chatId, defaultTargetLocationId, hasLocations, initialResult, open]);

  useEffect(() => {
    if (!open || !hasCommittedSpatialHistory || operation !== "replace") return;
    setOperation("expand");
    setTargetLocationId(defaultTargetLocationId);
    setResult(null);
    setError(null);
  }, [defaultTargetLocationId, hasCommittedSpatialHistory, open, operation]);

  if (!open) return null;

  const resetResult = () => {
    setResult(null);
    setError(null);
  };
  const generate = async () => {
    setError(null);
    try {
      const generated = await generateDraft.mutateAsync({
        chatId,
        operation,
        size,
        ...(operation === "expand" ? { targetLocationId } : {}),
        instructions: instructions.trim() || undefined,
        groundingMode,
        sourceLorebookIds: groundingMode === "setup" ? [] : sourceLorebookIds,
        debugMode,
      });
      setResult(generated);
    } catch (generationError) {
      setResult(null);
      setError(generationError instanceof Error ? generationError.message : "The map draft could not be generated.");
    }
  };
  const existingIds = new Set(definition.locations.map((location) => location.id));
  const previewLocations =
    result?.operation === "expand"
      ? result.definition.locations.filter((location) => !existingIds.has(location.id))
      : (result?.definition.locations ?? []);
  const previewIds = new Set(previewLocations.map((location) => location.id));
  const previewRoots = previewLocations.filter(
    (location) => location.parentId === null || !previewIds.has(location.parentId),
  );
  const generationDisabled =
    generateDraft.isPending ||
    dirty ||
    (operation === "expand" && targetLocationId.length === 0) ||
    (groundingMode !== "setup" && sourceLorebookIds.length === 0);

  return (
    <section
      className="min-h-0 flex-1 overflow-y-auto border-b border-[var(--marinara-editor-divider)] bg-[var(--marinara-editor-surface)]"
      aria-label="AI map builder"
    >
      <div className="flex items-start gap-3 border-b border-[var(--marinara-editor-divider)] px-4 py-3">
        <span className="mari-editor-icon-tile mt-0.5">
          <Sparkles size="1rem" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[var(--marinara-editor-title)]">{operationTitle(operation)}</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--marinara-editor-muted)]">
            {setupReview
              ? "Your game world is ready. Inspect this generated hierarchy, then apply it or skip it before play."
              : operation === "expand"
              ? "Add new places while preserving the current map, campaign state, and every existing location ID."
              : "Describe the world in everyday language. The result stays local until you apply it, then Save confirms it."}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={setupReview ? "Skip generated map" : "Close AI map builder"}
          className="mari-editor-action"
        >
          <X size="0.875rem" />
        </button>
      </div>

      <div className="grid min-h-0 gap-px bg-[var(--marinara-editor-divider)] lg:grid-cols-[minmax(20rem,0.9fr)_minmax(22rem,1.1fr)]">
        <div className="bg-[var(--marinara-editor-bg)] p-4">
          {hasLocations && !hasCommittedSpatialHistory && (
            <fieldset className="mb-4">
              <legend className="text-xs font-semibold text-[var(--marinara-editor-title)]">AI action</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["expand", "replace"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={operation === value}
                    disabled={generateDraft.isPending}
                    onClick={() => {
                      setOperation(value);
                      resetResult();
                    }}
                    className={cn(
                      "min-h-12 rounded-lg border px-3 py-2 text-left text-xs transition-colors duration-200 disabled:opacity-60",
                      operation === value
                        ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-button-text-active)]"
                        : "border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] text-[var(--marinara-editor-muted)]",
                    )}
                  >
                    <span className="block font-semibold">{value === "expand" ? "Expand current map" : "Replace draft"}</span>
                    <span className="mt-0.5 block text-[0.625rem]">
                      {value === "expand" ? "Keep existing location IDs" : "Available before campaign history"}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {operation === "expand" && (
            <div className="mb-4">
              <label
                className="text-xs font-semibold text-[var(--marinara-editor-title)]"
                htmlFor="spatial-ai-target"
              >
                Expand beneath
              </label>
              <select
                id="spatial-ai-target"
                value={targetLocationId}
                disabled={generateDraft.isPending}
                onChange={(event) => {
                  setTargetLocationId(event.target.value);
                  resetResult();
                }}
                className="mt-2 min-h-11 w-full rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--marinara-chat-chrome-button-border-active)] focus:ring-2 focus:ring-[var(--marinara-chat-chrome-highlight-bg)] disabled:opacity-60"
              >
                {activeLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <fieldset className="mb-4">
            <legend className="text-xs font-semibold text-[var(--marinara-editor-title)]">Build from</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([
                { value: "setup", label: "Game setup", detail: "World and characters" },
                { value: "lore_strict", label: "Selected lore", detail: "Chosen source books" },
              ] as const).map((option) => {
                const selected =
                  option.value === "setup" ? groundingMode === "setup" : groundingMode !== "setup";
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    disabled={generateDraft.isPending || (option.value !== "setup" && eligibleLorebooks.length === 0)}
                    onClick={() => {
                      setGroundingMode(option.value);
                      resetResult();
                    }}
                    className={cn(
                      "min-h-12 rounded-lg border px-3 py-2 text-left text-xs transition-colors disabled:opacity-45",
                      selected
                        ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]"
                        : "border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] text-[var(--marinara-editor-muted)]",
                    )}
                  >
                    <span className="block font-semibold">{option.label}</span>
                    <span className="mt-0.5 block text-[0.625rem]">{option.detail}</span>
                  </button>
                );
              })}
            </div>

            {groundingMode !== "setup" && (
              <div className="mt-2 space-y-2 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-3">
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: "lore_strict", label: "Strict canon", detail: "Only lore-backed places" },
                    { value: "lore_expand", label: "Canon + expansion", detail: "AI may add fitting places" },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={groundingMode === option.value}
                      disabled={generateDraft.isPending}
                      onClick={() => {
                        setGroundingMode(option.value);
                        resetResult();
                      }}
                      className={cn(
                        "min-h-11 rounded-lg px-2 py-2 text-left text-[0.625rem] ring-1 transition-colors disabled:opacity-45",
                        groundingMode === option.value
                          ? "bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-button-text-active)] ring-[var(--marinara-chat-chrome-button-border-active)]"
                          : "text-[var(--marinara-editor-muted)] ring-[var(--marinara-chat-chrome-panel-border)]",
                      )}
                    >
                      <span className="block font-semibold">{option.label}</span>
                      <span className="mt-0.5 block">{option.detail}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[0.625rem] text-[var(--marinara-editor-muted)]">
                  Select the lorebooks the map generator may read. Disabled or chat-excluded books are unavailable.
                </p>
                <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                  {eligibleLorebooks.map((lorebook) => {
                    const checked = sourceLorebookIds.includes(lorebook.id);
                    return (
                      <label
                        key={lorebook.id}
                        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs hover:bg-[var(--marinara-chat-chrome-highlight-bg)]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={generateDraft.isPending}
                          onChange={() => {
                            setSourceLorebookIds((ids) =>
                              checked ? ids.filter((id) => id !== lorebook.id) : [...ids, lorebook.id],
                            );
                            resetResult();
                          }}
                        />
                        <BookOpen size="0.75rem" className="shrink-0 text-[var(--marinara-editor-muted)]" />
                        <span className="min-w-0 flex-1 truncate">{lorebook.name}</span>
                      </label>
                    );
                  })}
                </div>
                {sourceLorebookIds.length === 0 && (
                  <p className="text-[0.625rem] text-amber-300">Choose at least one lorebook to generate.</p>
                )}
              </div>
            )}
          </fieldset>

          <label className="text-xs font-semibold text-[var(--marinara-editor-title)]" htmlFor="spatial-ai-request">
            {operation === "expand" ? "What should be added?" : "What should this world include?"}
          </label>
          <textarea
            id="spatial-ai-request"
            value={instructions}
            disabled={generateDraft.isPending}
            onChange={(event) => {
              setInstructions(event.target.value);
              resetResult();
            }}
            maxLength={4_000}
            rows={4}
            placeholder={
              operation === "expand"
                ? "Add a haunted inn, riverside market, lighthouse, and old sewers beneath the district."
                : "A misty coastal city with a harbor, market, haunted inn, lighthouse, and sewers beneath the old district."
            }
            className="mt-2 w-full resize-y rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--marinara-chat-chrome-button-border-active)] focus:ring-2 focus:ring-[var(--marinara-chat-chrome-highlight-bg)] disabled:cursor-wait disabled:opacity-60"
          />
          <p className="mt-1 text-[0.625rem] leading-relaxed text-[var(--marinara-editor-muted)]">
            Optional. If left blank, Marinara builds from the existing setup.
          </p>

          <fieldset className="mt-4">
            <legend className="text-xs font-semibold text-[var(--marinara-editor-title)]">
              {operation === "expand" ? "Expansion size" : "Map size"}
            </legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SIZE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={size === option.value}
                  disabled={generateDraft.isPending}
                  onClick={() => {
                    setSize(option.value);
                    resetResult();
                  }}
                  className={cn(
                    "min-h-14 rounded-lg border px-2 py-2 text-left transition-colors duration-200 disabled:cursor-wait disabled:opacity-60",
                    size === option.value
                      ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-button-text-active)]"
                      : "border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] text-[var(--marinara-editor-muted)]",
                  )}
                >
                  <span className="block text-xs font-semibold">{option.label}</span>
                  <span className="mt-0.5 block text-[0.625rem]">{option.description}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <p className="mt-4 text-[0.625rem] leading-relaxed text-[var(--marinara-editor-muted)]">
            {groundingMode === "setup"
              ? sourceCopy(ownerMode)
              : `Uses ${sourceLorebookIds.length} selected lorebook${sourceLorebookIds.length === 1 ? "" : "s"} plus setup context. Turn history is not included.`}
          </p>
          {setupReview && (
            <p className="mt-2 text-xs leading-relaxed text-[var(--marinara-editor-muted)]">
              Applying changes only the working copy. Enable the map and press Save when you want it to affect turns.
            </p>
          )}
          {hasCommittedSpatialHistory && (
            <p className="mt-2 flex items-start gap-2 text-xs text-emerald-300">
              <ShieldCheck size="0.75rem" className="mt-0.5 shrink-0" />
              Campaign history is protected. AI can add places, but it cannot replace or remove the current map.
            </p>
          )}
          {operation === "replace" && (
            <p className="mt-2 flex items-start gap-2 text-xs text-amber-300">
              <AlertCircle size="0.75rem" className="mt-0.5 shrink-0" />
              Applying this result replaces the current working map. Nothing changes on the server until Save.
            </p>
          )}
          {dirty && (
            <p className="mt-2 flex items-start gap-2 text-xs text-amber-300" role="alert">
              <AlertCircle size="0.75rem" className="mt-0.5 shrink-0" />
              Save or discard the current map edits before using AI.
            </p>
          )}
          <button
            type="button"
            onClick={() => void generate()}
            disabled={generationDisabled}
            className="mari-editor-action mari-editor-action--primary mt-4 inline-flex min-h-11 px-4 text-xs disabled:opacity-50"
          >
            {generateDraft.isPending ? (
              <>
                <LoaderCircle size="0.8125rem" className="animate-spin" /> Building map
              </>
            ) : result ? (
              <>
                <RefreshCw size="0.8125rem" /> Generate another
              </>
            ) : (
              <>
                <Sparkles size="0.8125rem" /> {operation === "expand" ? "Generate expansion" : "Generate draft"}
              </>
            )}
          </button>
        </div>

        <div className="flex min-h-56 flex-col bg-[var(--marinara-editor-bg)] p-4" aria-live="polite">
          <h3 className="text-xs font-semibold text-[var(--marinara-editor-title)]">Draft preview</h3>
          {generateDraft.isPending ? (
            <div className="mt-4 space-y-3" aria-label="Generating map draft">
              <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--marinara-editor-surface)]" />
              <div className="h-12 animate-pulse rounded-lg bg-[var(--marinara-editor-surface)]" />
              <div className="h-12 animate-pulse rounded-lg bg-[var(--marinara-editor-surface)]" />
              <div className="h-12 animate-pulse rounded-lg bg-[var(--marinara-editor-surface)]" />
            </div>
          ) : error ? (
            <div
              className="mt-4 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300"
              role="alert"
            >
              <p className="flex items-start gap-2">
                <AlertCircle size="0.8125rem" className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </p>
            </div>
          ) : result ? (
            <div className="mt-3 flex flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300">
                  <Check size="0.6875rem" /> Validated
                </span>
                <span className="text-[var(--marinara-editor-muted)]">
                  {result.generatedLocationCount} new {result.generatedLocationCount === 1 ? "location" : "locations"}
                </span>
              </div>
              {result.grounding && result.grounding.mode !== "setup" && (
                <div className="mt-3 rounded-lg border border-sky-500/25 bg-sky-500/10 p-3 text-[0.6875rem] text-sky-200">
                  <p className="font-semibold">
                    {result.grounding.mode === "lore_strict" ? "Strict lore grounding" : "Lore-guided expansion"}
                  </p>
                  <p className="mt-1 leading-relaxed text-sky-200/80">
                    Considered {result.grounding.consideredEntryCount} entries from {result.grounding.selectedLorebookCount}{" "}
                    {result.grounding.selectedLorebookCount === 1 ? "book" : "books"}.
                    {result.grounding.omittedEntryCount > 0
                      ? ` ${result.grounding.omittedEntryCount} entries were omitted to keep the source packet bounded.`
                      : ""}
                  </p>
                </div>
              )}
              <div className="mt-3 divide-y divide-[var(--marinara-editor-divider)] border-y border-[var(--marinara-editor-divider)]">
                {previewRoots.slice(0, 5).map((location) => {
                  const childCount = result.definition.locations.filter(
                    (candidate) => candidate.parentId === location.id,
                  ).length;
                  const provenance = result.provenance?.[location.id];
                  const provenanceLabel =
                    provenance?.kind === "lore_backed"
                      ? "Lore-backed"
                      : provenance?.kind === "added_by_ai"
                        ? "Added by AI"
                        : provenance
                          ? "Inferred"
                          : null;
                  return (
                    <div key={location.id} className="flex min-h-12 items-center gap-3 py-2">
                      <span className="text-lg" aria-hidden="true">
                        {location.icon || "⌖"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{location.name}</span>
                        <span className="block text-[0.625rem] capitalize text-[var(--marinara-editor-muted)]">
                          {location.kind} · {childCount} direct {childCount === 1 ? "place" : "places"}
                        </span>
                        {provenanceLabel && (
                          <span
                            className="mt-0.5 block truncate text-[0.625rem] text-sky-300"
                            title={provenance?.sources.map((source) => `${source.lorebookName}: ${source.entryName}`).join(", ")}
                          >
                            {provenanceLabel}
                            {provenance?.sources.length ? ` · ${provenance.sources.map((source) => source.entryName).join(", ")}` : ""}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[var(--marinara-editor-muted)]">
                {result.operation === "expand"
                  ? "Apply the expansion to inspect every new place before saving. Existing locations remain unchanged."
                  : "Apply the draft to inspect every description, private memory, link, layer, and map position before saving."}
              </p>
              <div className="mt-auto flex flex-wrap justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="mari-editor-action inline-flex min-h-11 px-3 text-xs"
                >
                  {setupReview ? "Skip map" : "Keep current map"}
                </button>
                <button
                  type="button"
                  onClick={() => onApply(result.definition)}
                  className="mari-editor-action mari-editor-action--primary inline-flex min-h-11 px-4 text-xs"
                >
                  <Check size="0.8125rem" />{" "}
                  {result.operation === "expand"
                    ? "Add to working map"
                    : hasLocations
                      ? "Replace working draft"
                      : "Use this draft"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
              <div className="max-w-xs">
                <Sparkles className="mx-auto text-[var(--marinara-editor-muted)]" size="1.25rem" />
                <p className="mt-3 text-sm font-medium text-[var(--marinara-editor-title)]">
                  {operation === "expand" ? "New places appear here" : "Your generated hierarchy appears here"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--marinara-editor-muted)]">
                  {operation === "expand"
                    ? "Existing locations and campaign state remain untouched."
                    : "The draft is validated before you can apply it."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
