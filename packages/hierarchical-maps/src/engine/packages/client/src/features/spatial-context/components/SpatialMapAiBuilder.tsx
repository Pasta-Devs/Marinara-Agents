import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type {
  GenerateSpatialMapDraftResponse,
  Lorebook,
  SpatialContextDefinition,
  SpatialLocation,
  SpatialLocationKind,
  SpatialMapGroundingMode,
  SpatialMapDraftOperation,
  SpatialMapDraftSize,
  SpatialOwnerMode,
} from "@marinara-engine/shared";
import { compareSpatialLocations } from "@marinara-engine/shared";
import {
  useGenerateSpatialMapDraft,
  useSpatialGenerationPromptLibraries,
  type MapsGenerateSpatialMapDraftResponse,
} from "../../../hooks/use-spatial-context";
import { cn } from "../package-utils";
import {
  HIERARCHY_TEMPLATES,
  generationPreferencesWithPromptLibrary,
  hierarchyTypeForLocation,
  hierarchyTypeId,
  normalizeHierarchyProfile,
  profileFromTemplate,
  type SpatialGenerationPreferences,
  type SpatialHierarchyProfile,
} from "../../../../../maps-shared/src/maps-model";

interface SpatialMapAiBuilderProps {
  chatId: string;
  ownerMode: SpatialOwnerMode;
  open: boolean;
  definition: SpatialContextDefinition;
  hierarchyProfile: SpatialHierarchyProfile;
  generationPreferences: SpatialGenerationPreferences;
  currentLocationId: string | null;
  preferredTargetLocationId?: string | null;
  hasCommittedSpatialHistory: boolean;
  dirty: boolean;
  initialResult?: GenerateSpatialMapDraftResponse | null;
  initialSession?: SpatialMapAiBuilderSession | null;
  regenerateRequestId?: number;
  allowDirtyGeneratedReplacement?: boolean;
  setupReview?: boolean;
  lorebooks?: Lorebook[];
  excludedLorebookIds?: string[];
  debugMode?: boolean;
  onClose: () => void;
  onApply: (session: SpatialMapAiBuilderSession) => void;
}

type SpatialMapAiBuilderRequest = {
  operation: SpatialMapDraftOperation;
  targetLocationId: string;
  size: SpatialMapDraftSize;
  instructions: string;
  groundingMode: SpatialMapGroundingMode;
  sourceLorebookIds: string[];
  hierarchyMode: SpatialHierarchyProfile["mode"];
  hierarchyProfile?: SpatialHierarchyProfile;
};

export type SpatialMapAiBuilderSession = SpatialMapAiBuilderRequest & {
  result: MapsGenerateSpatialMapDraftResponse;
};

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

function hierarchyOrderedActiveLocations(
  definition: SpatialContextDefinition,
): Array<{ location: SpatialLocation; depth: number }> {
  const activeLocations = definition.locations.filter((location) => location.status === "active");
  const activeIds = new Set(activeLocations.map((location) => location.id));
  const childrenByParent = new Map<string | null, SpatialLocation[]>();

  for (const location of activeLocations) {
    const parentId = location.parentId && activeIds.has(location.parentId) ? location.parentId : null;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(location);
    childrenByParent.set(parentId, siblings);
  }
  for (const siblings of childrenByParent.values()) siblings.sort(compareSpatialLocations);

  const ordered: Array<{ location: SpatialLocation; depth: number }> = [];
  const visited = new Set<string>();
  const visit = (location: SpatialLocation, depth: number) => {
    if (visited.has(location.id)) return;
    visited.add(location.id);
    ordered.push({ location, depth });
    for (const child of childrenByParent.get(location.id) ?? []) visit(child, depth + 1);
  };

  for (const root of childrenByParent.get(null) ?? []) visit(root, 0);
  for (const location of [...activeLocations].sort(compareSpatialLocations)) visit(location, 0);
  return ordered;
}

function hierarchyOptionLabel(location: SpatialLocation, depth: number): string {
  if (depth === 0) return location.name;
  return `${"\u00a0\u00a0".repeat(depth)}└─ ${location.name}`;
}

function withHierarchyProfile(
  result: GenerateSpatialMapDraftResponse | MapsGenerateSpatialMapDraftResponse | null,
  fallbackProfile: SpatialHierarchyProfile,
): MapsGenerateSpatialMapDraftResponse | null {
  if (!result) return null;
  const supplied = "hierarchyProfile" in result ? result.hierarchyProfile : fallbackProfile;
  return {
    ...result,
    hierarchyProfile: normalizeHierarchyProfile(supplied, result.definition),
  };
}

export function SpatialMapAiBuilder({
  chatId,
  ownerMode,
  open,
  definition,
  hierarchyProfile,
  generationPreferences,
  currentLocationId,
  preferredTargetLocationId = null,
  hasCommittedSpatialHistory,
  dirty,
  initialResult = null,
  initialSession = null,
  regenerateRequestId = 0,
  allowDirtyGeneratedReplacement = false,
  setupReview = false,
  lorebooks = [],
  excludedLorebookIds = [],
  debugMode = false,
  onClose,
  onApply,
}: SpatialMapAiBuilderProps) {
  const generateDraft = useGenerateSpatialMapDraft();
  const promptLibraries = useSpatialGenerationPromptLibraries();
  const generationPreferencesOverride = useMemo(
    () =>
      generationPreferencesWithPromptLibrary(
        promptLibraries.data?.[ownerMode],
        generationPreferences,
        ownerMode,
      ),
    [generationPreferences, ownerMode, promptLibraries.data],
  );
  const hasLocations = definition.locations.length > 0;
  const activeLocationOptions = useMemo(() => hierarchyOrderedActiveLocations(definition), [definition]);
  const activeLocations = useMemo(() => activeLocationOptions.map(({ location }) => location), [activeLocationOptions]);
  const defaultTargetLocationId =
    (preferredTargetLocationId && activeLocations.some((location) => location.id === preferredTargetLocationId)
      ? preferredTargetLocationId
      : currentLocationId && activeLocations.some((location) => location.id === currentLocationId)
        ? currentLocationId
        : definition.startingLocationId) ??
    activeLocations[0]?.id ??
    "";
  const initialOperation = initialSession?.operation ?? initialResult?.operation ?? (hasLocations ? "expand" : "create");
  const [operation, setOperation] = useState<SpatialMapDraftOperation>(initialOperation);
  const [targetLocationId, setTargetLocationId] = useState(defaultTargetLocationId);
  const [size, setSize] = useState<SpatialMapDraftSize>(initialSession?.size ?? initialResult?.size ?? "medium");
  const [instructions, setInstructions] = useState(initialSession?.instructions ?? "");
  const [result, setResult] = useState<MapsGenerateSpatialMapDraftResponse | null>(() =>
    withHierarchyProfile(initialSession?.result ?? initialResult, hierarchyProfile),
  );
  const [error, setError] = useState<string | null>(null);
  const [groundingMode, setGroundingMode] = useState<SpatialMapGroundingMode>(
    initialSession?.groundingMode ?? initialResult?.grounding?.mode ?? "setup",
  );
  const [sourceLorebookIds, setSourceLorebookIds] = useState<string[]>(initialSession?.sourceLorebookIds ?? []);
  const [hierarchyMode, setHierarchyMode] = useState<SpatialHierarchyProfile["mode"]>(
    initialSession?.hierarchyMode ?? (hasLocations ? hierarchyProfile.mode : "auto"),
  );
  const [hierarchyTemplateId, setHierarchyTemplateId] = useState("world");
  const [workingHierarchyProfile, setWorkingHierarchyProfile] = useState<SpatialHierarchyProfile>(() =>
    initialSession?.hierarchyProfile ?? normalizeHierarchyProfile(hierarchyProfile, definition),
  );
  const [advancedOpen, setAdvancedOpen] = useState(initialOperation !== "expand");
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);
  const [expandedPreviewIds, setExpandedPreviewIds] = useState<Set<string>>(() => new Set());
  const [previewQuery, setPreviewQuery] = useState("");
  const requestInputRef = useRef<HTMLTextAreaElement>(null);
  const handledRegenerationRef = useRef(0);
  const excludedLorebookIdSet = useMemo(() => new Set(excludedLorebookIds), [excludedLorebookIds]);
  const eligibleLorebooks = useMemo(
    () =>
      lorebooks
        .filter((lorebook) => lorebook.enabled !== false && !excludedLorebookIdSet.has(lorebook.id))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [excludedLorebookIdSet, lorebooks],
  );
  const existingIds = useMemo(() => new Set(definition.locations.map((location) => location.id)), [definition.locations]);
  const previewLocations = useMemo(
    () =>
      result?.operation === "expand"
        ? result.definition.locations.filter((location) => !existingIds.has(location.id))
        : (result?.definition.locations ?? []),
    [existingIds, result],
  );
  const previewIds = useMemo(() => new Set(previewLocations.map((location) => location.id)), [previewLocations]);
  const previewById = useMemo(() => new Map(previewLocations.map((location) => [location.id, location])), [previewLocations]);
  const previewChildrenByParent = useMemo(() => {
    const children = new Map<string | null, SpatialLocation[]>();
    for (const location of previewLocations) {
      const previewParentId = location.parentId && previewIds.has(location.parentId) ? location.parentId : null;
      const siblings = children.get(previewParentId) ?? [];
      siblings.push(location);
      children.set(previewParentId, siblings);
    }
    for (const siblings of children.values()) siblings.sort(compareSpatialLocations);
    return children;
  }, [previewIds, previewLocations]);
  const previewRoots = useMemo(() => previewChildrenByParent.get(null) ?? [], [previewChildrenByParent]);
  const maxPreviewDepth = useMemo(() => {
    let maximum = 0;
    const visit = (location: SpatialLocation, depth: number) => {
      maximum = Math.max(maximum, depth);
      for (const child of previewChildrenByParent.get(location.id) ?? []) visit(child, depth + 1);
    };
    for (const root of previewRoots) visit(root, 1);
    return maximum;
  }, [previewChildrenByParent, previewRoots]);
  const expandablePreviewIds = useMemo(
    () =>
      new Set(
        previewLocations.filter((location) => (previewChildrenByParent.get(location.id)?.length ?? 0) > 0).map((location) => location.id),
      ),
    [previewChildrenByParent, previewLocations],
  );
  const normalizedPreviewQuery = previewQuery.trim().toLocaleLowerCase();
  const visiblePreviewIds = useMemo(() => {
    if (!normalizedPreviewQuery) return previewIds;
    const visible = new Set<string>();
    for (const location of previewLocations) {
      const matches = [location.name, location.kind, location.description, location.modelMemory]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLocaleLowerCase().includes(normalizedPreviewQuery));
      if (!matches) continue;
      visible.add(location.id);
      let parentId = location.parentId;
      while (parentId && previewIds.has(parentId)) {
        visible.add(parentId);
        parentId = previewById.get(parentId)?.parentId ?? null;
      }
    }
    return visible;
  }, [normalizedPreviewQuery, previewById, previewIds, previewLocations]);
  const selectedPreviewLocation = selectedPreviewId ? (previewById.get(selectedPreviewId) ?? null) : null;
  const selectedPreviewPath = useMemo(() => {
    if (!selectedPreviewLocation) return [];
    const path: SpatialLocation[] = [selectedPreviewLocation];
    let parentId = selectedPreviewLocation.parentId;
    while (parentId && previewIds.has(parentId)) {
      const parent = previewById.get(parentId);
      if (!parent) break;
      path.unshift(parent);
      parentId = parent.parentId;
    }
    return path;
  }, [previewById, previewIds, selectedPreviewLocation]);
  const proposedStartingLocation = result?.definition.startingLocationId
    ? (result.definition.locations.find((location) => location.id === result.definition.startingLocationId) ?? null)
    : null;

  useEffect(() => {
    if (!open) return;
    const nextOperation = initialSession?.operation ?? initialResult?.operation ?? (hasLocations ? "expand" : "create");
    setOperation(nextOperation);
    setTargetLocationId(initialSession?.targetLocationId ?? initialResult?.targetLocationId ?? defaultTargetLocationId);
    setSize(initialSession?.size ?? initialResult?.size ?? "medium");
    setInstructions(initialSession?.instructions ?? "");
    setResult(withHierarchyProfile(initialSession?.result ?? initialResult, hierarchyProfile));
    setError(null);
    setGroundingMode(initialSession?.groundingMode ?? initialResult?.grounding?.mode ?? "setup");
    setSourceLorebookIds(initialSession?.sourceLorebookIds ?? []);
    setHierarchyMode(initialSession?.hierarchyMode ?? (hasLocations ? hierarchyProfile.mode : "auto"));
    setWorkingHierarchyProfile(
      initialSession?.hierarchyProfile ?? normalizeHierarchyProfile(hierarchyProfile, definition),
    );
    setAdvancedOpen(nextOperation !== "expand");
    setSelectedPreviewId(null);
    setExpandedPreviewIds(new Set());
    setPreviewQuery("");
  }, [chatId, defaultTargetLocationId, definition, hasLocations, hierarchyProfile, initialResult, initialSession, open]);

  const runGeneration = useCallback(
    async (request: SpatialMapAiBuilderRequest) => {
      setError(null);
      try {
        const generated = await generateDraft.mutateAsync({
          chatId,
          operation: request.operation,
          size: request.size,
          ...(request.operation === "expand" ? { targetLocationId: request.targetLocationId } : {}),
          instructions: request.instructions.trim() || undefined,
          groundingMode: request.groundingMode,
          sourceLorebookIds: request.groundingMode === "setup" ? [] : request.sourceLorebookIds,
          hierarchyMode: request.hierarchyMode,
          ...(request.hierarchyProfile ? { hierarchyProfile: request.hierarchyProfile } : {}),
          generationPreferencesOverride,
          debugMode,
        });
        setResult(withHierarchyProfile(generated, request.hierarchyProfile ?? workingHierarchyProfile));
      } catch (generationError) {
        setResult(null);
        setError(generationError instanceof Error ? generationError.message : "The map draft could not be generated.");
      }
    },
    [chatId, debugMode, generateDraft, generationPreferencesOverride, workingHierarchyProfile],
  );

  useEffect(() => {
    if (
      !open ||
      !initialSession ||
      regenerateRequestId <= 0 ||
      handledRegenerationRef.current === regenerateRequestId
    ) {
      return;
    }
    handledRegenerationRef.current = regenerateRequestId;
    setResult(null);
    void runGeneration({
      operation: initialSession.operation,
      targetLocationId: initialSession.targetLocationId,
      size: initialSession.size,
      instructions: initialSession.instructions,
      groundingMode: initialSession.groundingMode,
      sourceLorebookIds: initialSession.sourceLorebookIds,
      hierarchyMode: initialSession.hierarchyMode,
      hierarchyProfile: initialSession.hierarchyProfile,
    });
  }, [initialSession, open, regenerateRequestId, runGeneration]);

  useEffect(() => {
    if (!open || !result || previewLocations.length === 0) return;
    const startingId = result.definition.startingLocationId;
    setSelectedPreviewId(startingId && previewIds.has(startingId) ? startingId : (previewRoots[0]?.id ?? null));
    setExpandedPreviewIds(new Set(previewRoots.map((location) => location.id)));
    setPreviewQuery("");
  }, [open, previewIds, previewLocations.length, previewRoots, result]);

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
  const requestedHierarchyProfile =
    operation === "expand"
      ? normalizeHierarchyProfile(hierarchyProfile, definition)
      : hierarchyMode !== "auto"
        ? { ...workingHierarchyProfile, mode: hierarchyMode }
        : undefined;
  const currentRequest: SpatialMapAiBuilderRequest = {
    operation,
    targetLocationId,
    size,
    instructions,
    groundingMode,
    sourceLorebookIds,
    hierarchyMode: operation === "expand" ? hierarchyProfile.mode : hierarchyMode,
    hierarchyProfile: requestedHierarchyProfile,
  };
  const requestInvalid =
    (dirty && !allowDirtyGeneratedReplacement) ||
    (operation === "expand" && targetLocationId.length === 0) ||
    (operation !== "expand" && hierarchyMode === "custom" &&
      (!workingHierarchyProfile.name.trim() || workingHierarchyProfile.types.some((type) => !type.label.trim()))) ||
    (groundingMode !== "setup" && sourceLorebookIds.length === 0);
  const resultHierarchyValid = Boolean(
    result && result.hierarchyProfile.types.every((type) => type.label.trim().length > 0),
  );
  const generationDisabled = generateDraft.isPending || requestInvalid;
  const generate = () => runGeneration(currentRequest);
  const selectedPreviewProvenance = selectedPreviewLocation ? result?.provenance?.[selectedPreviewLocation.id] : null;
  const togglePreviewExpanded = (locationId: string) => {
    setExpandedPreviewIds((previous) => {
      const next = new Set(previous);
      if (next.has(locationId)) next.delete(locationId);
      else next.add(locationId);
      return next;
    });
  };
  const renderPreviewLocation = (location: SpatialLocation, depth: number) => {
    if (!visiblePreviewIds.has(location.id)) return null;
    const children = previewChildrenByParent.get(location.id) ?? [];
    const isExpanded = normalizedPreviewQuery.length > 0 || expandedPreviewIds.has(location.id);
    const selected = selectedPreviewId === location.id;
    const isStartingLocation = result?.definition.startingLocationId === location.id;
    const provenance = result?.provenance?.[location.id];
    const provenanceLabel =
      provenance?.kind === "lore_backed"
        ? "Lore-backed"
        : provenance?.kind === "added_by_ai"
          ? "Added by AI"
          : provenance
            ? "Inferred"
            : null;
    return (
      <li key={location.id} role="treeitem" aria-expanded={children.length > 0 ? isExpanded : undefined}>
        <div
          className={cn(
            "flex min-h-11 items-center gap-1 rounded-lg border px-1.5 transition-colors duration-200",
            selected
              ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]"
              : "border-transparent hover:bg-[var(--marinara-chat-chrome-highlight-bg)]",
          )}
          style={{ paddingLeft: `${Math.min(depth, 8) * 0.875 + 0.25}rem` }}
        >
          <button
            type="button"
            onClick={() => togglePreviewExpanded(location.id)}
            disabled={children.length === 0}
            aria-label={isExpanded ? `Collapse ${location.name}` : `Expand ${location.name}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--marinara-editor-muted)] hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] disabled:opacity-25"
          >
            {isExpanded ? <ChevronDown size="0.875rem" /> : <ChevronRight size="0.875rem" />}
          </button>
          <button
            type="button"
            onClick={() => setSelectedPreviewId(location.id)}
            aria-current={selected ? "true" : undefined}
            className="flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
          >
            <span className="text-base" aria-hidden="true">
              {location.icon || "⌖"}
            </span>
            <span className="min-w-0 flex-1 py-1">
              <span className="block truncate text-xs font-medium text-[var(--marinara-editor-title)]">
                {location.name || "Untitled location"}
              </span>
              <span className="flex flex-wrap items-center gap-x-1.5 text-[0.625rem] capitalize text-[var(--marinara-editor-muted)]">
                <span>{result ? hierarchyTypeForLocation(result.hierarchyProfile, location).label : location.kind}</span>
                {children.length > 0 && <span>{children.length} direct</span>}
                {isStartingLocation && (
                  <span className="inline-flex items-center gap-0.5 text-[var(--marinara-chat-chrome-button-text-active)]">
                    <MapPin size="0.5625rem" /> Start
                  </span>
                )}
                {provenanceLabel && <span className="text-sky-300">{provenanceLabel}</span>}
              </span>
            </span>
          </button>
        </div>
        {isExpanded && children.length > 0 && <ul role="group">{children.map((child) => renderPreviewLocation(child, depth + 1))}</ul>}
      </li>
    );
  };

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
          className="mari-editor-action min-h-11 min-w-11"
        >
          <X size="0.875rem" />
        </button>
      </div>

      <div className="mari-maps-ai-grid grid min-h-0 gap-px bg-[var(--marinara-editor-divider)]">
        <div className="bg-[var(--marinara-editor-bg)] p-4">
          {hasLocations && operation === "expand" && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] px-3 py-2.5">
              <div className="min-w-48 flex-1">
                <p className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-[var(--marinara-editor-muted)]">
                  Adding beneath
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold text-[var(--marinara-editor-title)]">
                  {activeLocations.find((location) => location.id === targetLocationId)?.name ?? "Choose a location"}
                </p>
              </div>
              <button
                type="button"
                aria-expanded={advancedOpen}
                onClick={() => setAdvancedOpen((current) => !current)}
                className="mari-editor-action inline-flex min-h-11 px-3 text-xs"
              >
                <ChevronDown
                  size="0.75rem"
                  className={cn("transition-transform duration-200", advancedOpen && "rotate-180")}
                />
                {advancedOpen ? "Hide advanced options" : "Advanced options"}
              </button>
            </div>
          )}

          {advancedOpen && hasLocations && !hasCommittedSpatialHistory && (
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

          {operation === "expand" && advancedOpen && (
            <div className="mb-4">
              <label className="text-xs font-semibold text-[var(--marinara-editor-title)]" htmlFor="spatial-ai-target">
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
                {activeLocationOptions.map(({ location, depth }) => (
                  <option key={location.id} value={location.id}>
                    {hierarchyOptionLabel(location, depth)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {operation !== "expand" && (
            <fieldset className="mb-4">
              <legend className="text-xs font-semibold text-[var(--marinara-editor-title)]">Hierarchy vocabulary</legend>
              <p className="mt-1 text-[0.625rem] leading-relaxed text-[var(--marinara-editor-muted)]">
                Choose whether AI names the location types, start from a template, or define your own. Semantic base kinds remain locked underneath for travel and validation.
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(
                  [
                    { value: "auto", label: "Auto", detail: "AI fits this world" },
                    { value: "template", label: "Template", detail: "Choose a starting path" },
                    { value: "custom", label: "Custom", detail: "Edit every type" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={hierarchyMode === option.value}
                    disabled={generateDraft.isPending}
                    onClick={() => {
                      setHierarchyMode(option.value);
                      if (option.value === "template") {
                        setWorkingHierarchyProfile(profileFromTemplate(hierarchyTemplateId, definition));
                      } else if (option.value === "custom") {
                        setWorkingHierarchyProfile((current) => ({ ...current, mode: "custom", name: current.name || "Custom hierarchy" }));
                      }
                      resetResult();
                    }}
                    className={cn(
                      "min-h-14 rounded-lg border px-2 py-2 text-left transition-colors disabled:opacity-50",
                      hierarchyMode === option.value
                        ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-button-text-active)]"
                        : "border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] text-[var(--marinara-editor-muted)]",
                    )}
                  >
                    <span className="block text-xs font-semibold">{option.label}</span>
                    <span className="mt-0.5 block text-[0.625rem]">{option.detail}</span>
                  </button>
                ))}
              </div>

              {hierarchyMode === "template" && (
                <label className="mt-3 block text-xs font-medium text-[var(--marinara-editor-title)]">
                  Template
                  <select
                    value={hierarchyTemplateId}
                    onChange={(event) => {
                      setHierarchyTemplateId(event.target.value);
                      setWorkingHierarchyProfile(profileFromTemplate(event.target.value, definition));
                      resetResult();
                    }}
                    className="mt-1 min-h-11 w-full rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-xs outline-none focus:ring-2 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
                  >
                    {HIERARCHY_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>{template.path}</option>
                    ))}
                  </select>
                </label>
              )}

              {hierarchyMode === "custom" && (
                <div className="mt-3 space-y-2 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-3">
                  <input
                    aria-label="Custom hierarchy name"
                    value={workingHierarchyProfile.name}
                    maxLength={120}
                    onChange={(event) => {
                      setWorkingHierarchyProfile((current) => ({ ...current, mode: "custom", name: event.target.value }));
                      resetResult();
                    }}
                    className="min-h-11 w-full rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-xs"
                    placeholder="Custom hierarchy name"
                  />
                  {workingHierarchyProfile.types.map((type, index) => (
                    <div key={type.id} className="grid grid-cols-[minmax(0,1fr)_8rem_2.75rem] gap-2">
                      <input
                        aria-label={`Location type ${index + 1} label`}
                        value={type.label}
                        maxLength={80}
                        onChange={(event) => {
                          setWorkingHierarchyProfile((current) => ({
                            ...current,
                            types: current.types.map((candidate) =>
                              candidate.id === type.id ? { ...candidate, label: event.target.value } : candidate,
                            ),
                          }));
                          resetResult();
                        }}
                        className="min-h-11 min-w-0 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-xs"
                      />
                      <select
                        aria-label={`${type.label || `Location type ${index + 1}`} semantic base kind`}
                        value={type.baseKind}
                        onChange={(event) => {
                          setWorkingHierarchyProfile((current) => ({
                            ...current,
                            types: current.types.map((candidate) =>
                              candidate.id === type.id
                                ? { ...candidate, baseKind: event.target.value as SpatialLocationKind }
                                : candidate,
                            ),
                          }));
                          resetResult();
                        }}
                        className="min-h-11 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-2 text-[0.625rem]"
                      >
                        {(["region", "settlement", "place", "building", "floor", "room"] as const).map((kind) => (
                          <option key={kind} value={kind}>{kind}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={workingHierarchyProfile.types.length === 1}
                        onClick={() => {
                          setWorkingHierarchyProfile((current) =>
                            normalizeHierarchyProfile(
                              {
                                ...current,
                                types: current.types.filter((candidate) => candidate.id !== type.id),
                                locationTypeIds: Object.fromEntries(
                                  Object.entries(current.locationTypeIds).filter(
                                    ([, assignedTypeId]) => assignedTypeId !== type.id,
                                  ),
                                ),
                              },
                              definition,
                            ),
                          );
                          resetResult();
                        }}
                        className="mari-chrome-control h-11 w-11 p-0 disabled:opacity-35"
                        aria-label={`Remove ${type.label || "location type"}`}
                      >
                        <X size="0.75rem" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={workingHierarchyProfile.types.length >= 40}
                    onClick={() => {
                      setWorkingHierarchyProfile((current) => {
                        const base = hierarchyTypeId(`custom-${current.types.length + 1}`);
                        let id = base;
                        let suffix = 2;
                        while (current.types.some((type) => type.id === id)) id = `${base}_${suffix++}`;
                        return {
                          ...current,
                          types: [...current.types, { id, label: `Location type ${current.types.length + 1}`, baseKind: "place" }],
                        };
                      });
                      resetResult();
                    }}
                    className="mari-editor-action inline-flex min-h-11 px-3 text-xs"
                  >
                    <Plus size="0.75rem" /> Add location type
                  </button>
                </div>
              )}
            </fieldset>
          )}

          {(operation !== "expand" || advancedOpen) && <fieldset className="mb-4">
            <legend className="text-xs font-semibold text-[var(--marinara-editor-title)]">Build from</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  {
                    value: "setup",
                    label: "Game setup",
                    detail: "World and characters",
                  },
                  {
                    value: "lore_strict",
                    label: "Selected lore",
                    detail: "Chosen source books",
                  },
                ] as const
              ).map((option) => {
                const selected = option.value === "setup" ? groundingMode === "setup" : groundingMode !== "setup";
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
                  {(
                    [
                      {
                        value: "lore_strict",
                        label: "Strict canon",
                        detail: "Only lore-backed places",
                      },
                      {
                        value: "lore_expand",
                        label: "Canon + expansion",
                        detail: "AI may add fitting places",
                      },
                    ] as const
                  ).map((option) => (
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
                            setSourceLorebookIds((ids) => (checked ? ids.filter((id) => id !== lorebook.id) : [...ids, lorebook.id]));
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
          </fieldset>}

          <label className="text-xs font-semibold text-[var(--marinara-editor-title)]" htmlFor="spatial-ai-request">
            {operation === "expand" ? "What should be added?" : "What should this world include?"}
          </label>
          <textarea
            ref={requestInputRef}
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
          {dirty && !allowDirtyGeneratedReplacement && (
            <p className="mt-2 flex items-start gap-2 text-xs text-amber-300" role="alert">
              <AlertCircle size="0.75rem" className="mt-0.5 shrink-0" />
              Save or discard the current map edits before using AI.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {!result && (
              <button
                type="button"
                onClick={() => void generate()}
                disabled={generationDisabled}
                className="mari-editor-action mari-editor-action--primary inline-flex min-h-11 px-4 text-xs disabled:opacity-50"
              >
                {generateDraft.isPending ? (
                  <>
                    <LoaderCircle size="0.8125rem" className="animate-spin" /> Building map
                  </>
                ) : (
                  <>
                    <Sparkles size="0.8125rem" /> {operation === "expand" ? "Generate expansion" : "Generate draft"}
                  </>
                )}
              </button>
            )}
          </div>
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
            <div className="mt-4 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300" role="alert">
              <p className="flex items-start gap-2">
                <AlertCircle size="0.8125rem" className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </p>
            </div>
          ) : result ? (
            <div className="mt-3 flex flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300">
                  <Check size="0.6875rem" /> Validated
                </span>
                <span className="text-[var(--marinara-editor-muted)]">
                  {previewLocations.length} {result.operation === "expand" ? "new " : ""}
                  {previewLocations.length === 1 ? "location" : "locations"} · {maxPreviewDepth}{" "}
                  {maxPreviewDepth === 1 ? "level" : "levels"} · {result.operation === "expand" ? "not applied" : "not saved"}
                </span>
              </div>
              <div className="mt-3 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-[0.6875rem] font-semibold text-[var(--marinara-editor-title)]">Location types</h4>
                  <span className="text-[0.625rem] text-[var(--marinara-editor-muted)]">
                    {result.hierarchyProfile.mode === "auto" ? "Chosen by AI · edit labels before applying" : result.hierarchyProfile.name}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {result.hierarchyProfile.types.map((type) => (
                    <label key={type.id} className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2">
                      <span className="sr-only">Edit {type.label} label</span>
                      <input
                        value={type.label}
                        maxLength={80}
                        onChange={(event) =>
                          setResult((current) =>
                            current
                              ? {
                                  ...current,
                                  hierarchyProfile: {
                                    ...current.hierarchyProfile,
                                    mode: "custom",
                                    types: current.hierarchyProfile.types.map((candidate) =>
                                      candidate.id === type.id ? { ...candidate, label: event.target.value } : candidate,
                                    ),
                                  },
                                }
                              : current,
                          )
                        }
                        className="min-h-10 min-w-0 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-2.5 text-xs"
                      />
                      <span className="truncate text-[0.5625rem] capitalize text-[var(--marinara-editor-muted)]" title={`Semantic base kind: ${type.baseKind}`}>
                        {type.baseKind}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              {result.operation !== "expand" && proposedStartingLocation && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--marinara-editor-title)]">
                  <MapPin size="0.75rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
                  Proposed start: <span className="font-semibold">{proposedStartingLocation.name}</span>
                </p>
              )}
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
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <label className="relative min-w-48 flex-1" htmlFor="spatial-draft-preview-search">
                  <Search
                    size="0.75rem"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--marinara-editor-muted)]"
                  />
                  <span className="sr-only">Search generated locations</span>
                  <input
                    id="spatial-draft-preview-search"
                    type="search"
                    value={previewQuery}
                    onChange={(event) => setPreviewQuery(event.target.value)}
                    placeholder="Search generated locations"
                    className="min-h-11 w-full rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] py-2 pl-9 pr-3 text-xs outline-none focus:border-[var(--marinara-chat-chrome-button-border-active)] focus:ring-2 focus:ring-[var(--marinara-chat-chrome-highlight-bg)]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setExpandedPreviewIds(new Set(expandablePreviewIds))}
                  className="mari-editor-action inline-flex min-h-11 px-3 text-xs"
                >
                  Expand all
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewQuery("");
                    setExpandedPreviewIds(new Set());
                  }}
                  className="mari-editor-action inline-flex min-h-11 px-3 text-xs"
                >
                  Collapse all
                </button>
              </div>

              <section
                className="mt-3 max-h-72 overflow-y-auto border-y border-[var(--marinara-editor-divider)] py-2"
                aria-label="Generated location hierarchy"
              >
                {previewRoots.some((location) => visiblePreviewIds.has(location.id)) ? (
                  <ul role="tree" className="space-y-0.5">
                    {previewRoots.map((location) => renderPreviewLocation(location, 0))}
                  </ul>
                ) : (
                  <p className="px-3 py-8 text-center text-xs text-[var(--marinara-editor-muted)]">
                    No generated locations match “{previewQuery.trim()}”.
                  </p>
                )}
              </section>

              {selectedPreviewLocation && (
                <section className="mt-4" aria-label="Selected generated location details">
                  <p className="truncate text-[0.625rem] text-[var(--marinara-editor-muted)]">
                    {selectedPreviewPath.map((location) => location.name).join(" / ")}
                  </p>
                  <div className="mt-2 flex items-start gap-3">
                    <span className="text-xl" aria-hidden="true">
                      {selectedPreviewLocation.icon || "⌖"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-[var(--marinara-editor-title)]">{selectedPreviewLocation.name}</h4>
                      <p className="mt-0.5 text-[0.625rem] capitalize text-[var(--marinara-editor-muted)]">
                        {hierarchyTypeForLocation(result.hierarchyProfile, selectedPreviewLocation).label} · {selectedPreviewLocation.childPresentation} children
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <h5 className="text-[0.6875rem] font-semibold text-[var(--marinara-editor-title)]">Public description</h5>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--marinara-editor-muted)]">
                        {selectedPreviewLocation.description || "No public description was generated."}
                      </p>
                    </div>
                    <div>
                      <h5 className="text-[0.6875rem] font-semibold text-[var(--marinara-editor-title)]">Private model memory</h5>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--marinara-editor-muted)]">
                        {selectedPreviewLocation.modelMemory || "No private model memory was generated."}
                      </p>
                    </div>
                  </div>
                  {selectedPreviewProvenance && (
                    <div className="mt-3 border-t border-[var(--marinara-editor-divider)] pt-3 text-[0.6875rem]">
                      <p className="font-semibold text-sky-300">
                        {selectedPreviewProvenance.kind === "lore_backed"
                          ? "Grounded in selected lore"
                          : selectedPreviewProvenance.kind === "added_by_ai"
                            ? "Added by AI"
                            : "Inferred from selected lore"}
                      </p>
                      {selectedPreviewProvenance.sources.length > 0 && (
                        <p className="mt-1 leading-relaxed text-[var(--marinara-editor-muted)]">
                          {selectedPreviewProvenance.sources.map((source) => `${source.lorebookName}: ${source.entryName}`).join(" · ")}
                        </p>
                      )}
                    </div>
                  )}
                </section>
              )}

              <p className="mt-4 text-xs leading-relaxed text-[var(--marinara-editor-muted)]">
                {result.operation === "expand"
                  ? "Review every new place here. Continuing adds only this expansion to the unsaved working map."
                  : "Review the complete generated hierarchy here. Continuing moves it into the editor as an unsaved working draft."}
              </p>
              <div className="mt-auto flex flex-wrap justify-end gap-2 pt-4">
                <button type="button" onClick={onClose} className="mari-editor-action inline-flex min-h-11 px-3 text-xs">
                  {setupReview ? "Skip map" : result.operation === "expand" ? "Keep current map" : "Discard draft"}
                </button>
                <button
                  type="button"
                  onClick={() => requestInputRef.current?.focus()}
                  className="mari-editor-action inline-flex min-h-11 px-3 text-xs"
                >
                  <Pencil size="0.75rem" /> Edit prompt
                </button>
                <button
                  type="button"
                  onClick={() => void generate()}
                  disabled={generationDisabled}
                  className="mari-editor-action inline-flex min-h-11 px-3 text-xs disabled:opacity-50"
                >
                  <RefreshCw size="0.75rem" /> Regenerate
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onApply({
                      result,
                      operation,
                      targetLocationId,
                      size,
                      instructions,
                      groundingMode,
                      sourceLorebookIds,
                      hierarchyMode: result.hierarchyProfile.mode,
                      hierarchyProfile: result.hierarchyProfile,
                    })
                  }
                  disabled={!resultHierarchyValid}
                  className="mari-editor-action mari-editor-action--primary inline-flex min-h-11 px-4 text-xs disabled:opacity-50"
                >
                  <Check size="0.8125rem" />{" "}
                  {result.operation === "expand" ? "Add to working map" : hasLocations ? "Replace working draft" : "Continue to editor"}
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
