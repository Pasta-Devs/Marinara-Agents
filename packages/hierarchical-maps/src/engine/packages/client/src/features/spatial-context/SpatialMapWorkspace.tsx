import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  CornerDownRight,
  Download,
  List,
  Loader2,
  Map,
  Move,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  compareSpatialLocations,
  resolveSpatialLocationDepth,
  resolveSpatialBreadcrumb,
  SPATIAL_CONTEXT_LIMITS,
  spatialContextDefinitionSchema,
  validateSpatialArchive,
  type GameMap,
  type GenerateSpatialMapDraftResponse,
  type SpatialContextDefinition,
  type SpatialDefinitionIssue,
  type SpatialOwnerMode,
} from "@marinara-engine/shared";
import { getSpatialContextProblem, useSpatialContext, useUpdateSpatialContext } from "../../hooks/use-spatial-context";
import { cn } from "./package-utils";
import { HierarchyNavigator } from "./components/HierarchyNavigator";
import { LayerSelector } from "./components/LayerSelector";
import { LocalMapCanvas } from "./components/LocalMapCanvas";
import { LocationInspector } from "./components/LocationInspector";
import { SpatialMapAiBuilder, type SpatialMapAiBuilderSession } from "./components/SpatialMapAiBuilder";
import {
  addSpatialLocation,
  archiveSpatialLocation,
  cloneSpatialDefinition,
  compareSpatialDefinitions,
  createEmptySpatialDefinition,
  duplicateSpatialSubtree,
  isSpatialDefinitionDirty,
  reparentSpatialLocation,
  spatialDefinitionIssues,
  startNewSpatialMap,
  updateSpatialLocation,
} from "./editor-state";
import {
  getSpatialExcludedLorebookIds,
  useSpatialChat,
  useSpatialLorebookEntries,
  useSpatialLorebooks,
} from "./use-spatial-resources";
import {
  defaultGenerationPreferences,
  defaultHierarchyProfile,
  hierarchyTypeForLocation,
  normalizeHierarchyProfile,
  withLocationHierarchyType,
  type SpatialHierarchyProfile,
} from "../../../../maps-shared/src/maps-model";

type MobilePane = "hierarchy" | "local" | "details";

type FirstSaveResult = {
  locationCount: number;
  startingLocationName: string;
};

type ImportIdReport = {
  missing: Array<{ id: string; name: string }>;
};

type MapConfirmationOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "destructive";
};

interface SpatialMapWorkspaceProps {
  chatId: string;
  debugMode?: boolean;
  pendingDraftReview?: { chatId: string; result: GenerateSpatialMapDraftResponse } | null;
  onClearPendingDraftReview?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onOpenLorebook?: (lorebookId: string) => void;
  onClose: () => void;
}

function sortedChildren(definition: SpatialContextDefinition, parentId: string | null) {
  return definition.locations
    .filter((location) => location.parentId === parentId)
    .sort(compareSpatialLocations);
}

function statusCopy(options: {
  dirty: boolean;
  conflict: boolean;
  invalid: boolean;
  pending: boolean;
  savedFlash: boolean;
}) {
  if (options.pending)
    return {
      label: "Saving",
      className: "text-[var(--marinara-chat-chrome-accent)]",
      icon: <Loader2 size="0.6875rem" className="animate-spin" />,
    };
  if (options.conflict)
    return { label: "Conflict", className: "text-[var(--destructive)]", icon: <AlertCircle size="0.6875rem" /> };
  if (options.invalid)
    return { label: "Invalid", className: "text-[var(--destructive)]", icon: <AlertCircle size="0.6875rem" /> };
  if (options.dirty) return { label: "Unsaved", className: "text-[var(--marinara-editor-muted)]", icon: null };
  if (options.savedFlash)
    return {
      label: "Saved",
      className: "text-[var(--marinara-chat-chrome-accent)]",
      icon: <Check size="0.6875rem" />,
    };
  return { label: "Up to date", className: "text-[var(--marinara-editor-muted)]", icon: <Check size="0.6875rem" /> };
}

export function SpatialMapWorkspace({
  chatId,
  debugMode = false,
  pendingDraftReview = null,
  onClearPendingDraftReview,
  onDirtyChange,
  onOpenLorebook,
  onClose,
}: SpatialMapWorkspaceProps) {
  const spatial = useSpatialContext(chatId);
  const updateSpatial = useUpdateSpatialContext();
  const { data: chat } = useSpatialChat(chatId);
  const pendingSetupReview = pendingDraftReview?.chatId === chatId ? pendingDraftReview : null;
  const [baseDefinition, setBaseDefinition] = useState<SpatialContextDefinition | null>(null);
  const [draft, setDraft] = useState<SpatialContextDefinition | null>(null);
  const [baseHierarchyProfile, setBaseHierarchyProfile] = useState<SpatialHierarchyProfile>(() =>
    defaultHierarchyProfile(),
  );
  const [draftHierarchyProfile, setDraftHierarchyProfile] = useState<SpatialHierarchyProfile>(() =>
    defaultHierarchyProfile(),
  );
  const [pendingConfirmation, setPendingConfirmation] = useState<MapConfirmationOptions | null>(null);
  const confirmationResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const confirmationDialogRef = useRef<HTMLDivElement>(null);
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);
  const [initialized, setInitialized] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enteredParentId, setEnteredParentId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("hierarchy");
  const [serverIssues, setServerIssues] = useState<SpatialDefinitionIssue[]>([]);
  const [conflict, setConflict] = useState(false);
  const [reviewConflict, setReviewConflict] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [firstSaveResult, setFirstSaveResult] = useState<FirstSaveResult | null>(null);
  const [firstMapGenerationSession, setFirstMapGenerationSession] = useState<SpatialMapAiBuilderSession | null>(null);
  const [regenerateRequestId, setRegenerateRequestId] = useState(0);
  const [archiveRequestId, setArchiveRequestId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [archiveReplacementId, setArchiveReplacementId] = useState("");
  const { data: lorebooks = [] } = useSpatialLorebooks();
  const lorebookEntriesQuery = useSpatialLorebookEntries(lorebooks.map((lorebook) => lorebook.id));
  const excludedLorebookIds = useMemo(
    () => (chat ? getSpatialExcludedLorebookIds(chat) : []),
    [chat],
  );
  const [replacementCurrentLocationId, setReplacementCurrentLocationId] = useState<string | null>(null);
  const [aiBuilderOpen, setAiBuilderOpen] = useState(false);
  const [layoutEditing, setLayoutEditing] = useState(false);
  const [importIdReport, setImportIdReport] = useState<ImportIdReport | null>(null);

  const resolveConfirmation = useCallback((confirmed: boolean) => {
    const resolve = confirmationResolverRef.current;
    confirmationResolverRef.current = null;
    setPendingConfirmation(null);
    resolve?.(confirmed);
  }, []);

  const confirmAction = useCallback((options: MapConfirmationOptions) => {
    confirmationResolverRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      confirmationResolverRef.current = resolve;
      setPendingConfirmation(options);
    });
  }, []);

  useEffect(() => {
    if (!pendingConfirmation) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => confirmationCancelRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        resolveConfirmation(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        confirmationDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !confirmationDialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !confirmationDialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [pendingConfirmation, resolveConfirmation]);

  useEffect(
    () => () => {
      confirmationResolverRef.current?.(false);
      confirmationResolverRef.current = null;
    },
    [],
  );

  const ownerMode: SpatialOwnerMode = chat?.mode === "game" ? "game" : "roleplay";
  const gameMaps = useMemo(() => {
    if (ownerMode !== "game") return [];
    const raw = chat?.metadata as unknown;
    let metadata: Record<string, unknown> = {};
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          metadata = parsed as Record<string, unknown>;
        }
      } catch {
        return [];
      }
    } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      metadata = raw as Record<string, unknown>;
    }
    const maps = Array.isArray(metadata.gameMaps) ? (metadata.gameMaps as GameMap[]) : [];
    const activeMap = metadata.gameMap as GameMap | undefined;
    if (!activeMap) return maps;
    const activeId = activeMap.id?.trim();
    return maps.some((map) => (activeId ? map.id === activeId : map === activeMap)) ? maps : [...maps, activeMap];
  }, [chat?.metadata, ownerMode]);

  useEffect(() => {
    resolveConfirmation(false);
    setInitialized(false);
    setDraft(null);
    setBaseDefinition(null);
    setSelectedId(null);
    setEnteredParentId(null);
    setConflict(false);
    setAiBuilderOpen(false);
    setFirstSaveResult(null);
    setFirstMapGenerationSession(null);
    setRegenerateRequestId(0);
    setLayoutEditing(false);
    setImportIdReport(null);
  }, [chatId, resolveConfirmation]);

  useEffect(() => {
    if (!spatial.isSuccess || initialized) return;
    const server = spatial.data.definition;
    const nextDraft = server ? cloneSpatialDefinition(server) : createEmptySpatialDefinition(ownerMode);
    setBaseDefinition(server ? cloneSpatialDefinition(server) : null);
    setDraft(nextDraft);
    const hierarchyProfile = normalizeHierarchyProfile(spatial.data.hierarchyProfile, nextDraft);
    setBaseHierarchyProfile(hierarchyProfile);
    setDraftHierarchyProfile(hierarchyProfile);
    setSelectedId(nextDraft.startingLocationId ?? nextDraft.locations[0]?.id ?? null);
    setEnteredParentId(null);
    setServerIssues(spatial.data.warnings);
    setInitialized(true);
  }, [initialized, ownerMode, spatial.data, spatial.isSuccess]);

  useEffect(() => {
    if (!initialized || !pendingSetupReview) return;
    setAiBuilderOpen(true);
  }, [initialized, pendingSetupReview]);

  const issues = useMemo(
    () => (draft ? [...spatialDefinitionIssues(draft), ...serverIssues] : []),
    [draft, serverIssues],
  );
  const dirty = useMemo(
    () =>
      !!draft &&
      (isSpatialDefinitionDirty(baseDefinition, draft) ||
        JSON.stringify(baseHierarchyProfile) !== JSON.stringify(normalizeHierarchyProfile(draftHierarchyProfile, draft))),
    [baseDefinition, baseHierarchyProfile, draft, draftHierarchyProfile],
  );
  const selected = draft?.locations.find((location) => location.id === selectedId) ?? null;
  const currentLocationId = spatial.data?.currentLocationId ?? null;
  const activeLocations = draft?.locations.filter((location) => location.status === "active") ?? [];
  const canEnable =
    !!draft?.startingLocationId &&
    draft.locations.some((location) => location.id === draft.startingLocationId && location.status === "active");
  const isFirstMapDraft = baseDefinition === null && (draft?.locations.length ?? 0) > 0;
  const firstMapDepth = useMemo(
    () =>
      draft
        ? draft.locations.reduce(
            (maximum, location) => Math.max(maximum, resolveSpatialLocationDepth(draft, location)),
            0,
          )
        : 0,
    [draft],
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!savedFlash) return;
    const timer = window.setTimeout(() => setSavedFlash(false), 2_000);
    return () => window.clearTimeout(timer);
  }, [savedFlash]);

  const applyDraft = useCallback((next: SpatialContextDefinition) => {
    setDraft(next);
    setServerIssues([]);
    setSavedFlash(false);
    setFirstSaveResult(null);
  }, []);

  const applyHierarchyProfile = useCallback(
    (next: SpatialHierarchyProfile) => {
      if (!draft) return;
      setDraftHierarchyProfile(normalizeHierarchyProfile(next, draft));
      setServerIssues([]);
      setSavedFlash(false);
      setFirstSaveResult(null);
    },
    [draft],
  );

  const selectLocation = useCallback((locationId: string, showDetails = true) => {
    setSelectedId(locationId);
    if (showDetails) setMobilePane("details");
  }, []);

  const enterLocation = useCallback((locationId: string) => {
    setEnteredParentId(locationId);
    setSelectedId(locationId);
    setMobilePane("local");
  }, []);

  const addChild = useCallback(
    (locationId: string) => {
      if (!draft) return;
      const result = addSpatialLocation(draft, { parentId: locationId });
      applyDraft(result.definition);
      selectLocation(result.location.id);
    },
    [applyDraft, draft, selectLocation],
  );

  const addSibling = useCallback(
    (locationId: string) => {
      if (!draft) return;
      const sibling = draft.locations.find((location) => location.id === locationId);
      if (!sibling) return;
      const result = addSpatialLocation(draft, { parentId: sibling.parentId, kind: sibling.kind });
      applyDraft(result.definition);
      selectLocation(result.location.id);
    },
    [applyDraft, draft, selectLocation],
  );

  const duplicateSubtree = useCallback(
    (locationId: string) => {
      if (!draft) return;
      const result = duplicateSpatialSubtree(draft, locationId);
      if (!result) return;
      applyDraft(result.definition);
      selectLocation(result.rootId);
      toast.success("Location subtree duplicated.");
    },
    [applyDraft, draft, selectLocation],
  );

  const finishArchive = useCallback(
    async (locationId: string, replacementId?: string | null) => {
      if (!draft) return;
      const location = draft.locations.find((candidate) => candidate.id === locationId);
      if (!location) return;
      const confirmed = await confirmAction({
        title: "Archive location",
        message: `Archive ${location.name || "this location"}? It remains in the map and can be restored later.`,
        confirmLabel: "Archive",
        tone: "destructive",
      });
      if (!confirmed) return;
      applyDraft(archiveSpatialLocation(draft, locationId, replacementId));
      if (currentLocationId === locationId && replacementId) setReplacementCurrentLocationId(replacementId);
      if (enteredParentId === locationId) setEnteredParentId(location.parentId);
      setArchiveRequestId(null);
      setArchiveReplacementId("");
    },
    [applyDraft, confirmAction, currentLocationId, draft, enteredParentId],
  );

  const requestArchive = useCallback(
    (locationId: string) => {
      if (!draft) return;
      const validation = validateSpatialArchive(draft, locationId, { currentLocationId });
      if (validation.ok) {
        void finishArchive(locationId);
        return;
      }
      if (
        validation.code === "spatial_archive_starting_replacement_required" ||
        validation.code === "spatial_archive_current_replacement_required"
      ) {
        setArchiveRequestId(locationId);
        setArchiveReplacementId("");
        return;
      }
      toast.error(validation.message);
    },
    [currentLocationId, draft, finishArchive],
  );

  const handleDeleteMap = useCallback(async () => {
    const savedDefinition = baseDefinition ?? draft;
    if (!savedDefinition || savedDefinition.locations.length === 0) return;
    const preserveExistingLocations = spatial.data?.hasCommittedSpatialHistory ?? false;
    if (
      preserveExistingLocations &&
      savedDefinition.locations.length >= SPATIAL_CONTEXT_LIMITS.maxLocations
    ) {
      toast.error(
        "This map is at the location limit, so a history-safe new starting location cannot be added. Export it and start a new chat instead.",
      );
      return;
    }

    const locationCount = savedDefinition.locations.length;
    const confirmed = await confirmAction({
      title: preserveExistingLocations ? "Archive this map and start over?" : "Delete this map and start over?",
      message: preserveExistingLocations
        ? `Are you sure? This is dangerous.\n\nCampaign history uses this map, so its ${locationCount} saved ${locationCount === 1 ? "location" : "locations"} cannot be erased. Delete will instead archive every existing location and preserve its stable ID for older messages, then create one blank New world starting location. Existing routes and details will remain only in the archived hierarchy. Any unsaved map edits are discarded.\n\nNothing changes until you click Save. Export first if you want a separate backup.`
        : `Are you sure? This is dangerous.\n\nDeleting replaces ${locationCount} saved ${locationCount === 1 ? "location" : "locations"} with one blank New world starting location. Existing map names, descriptions, routes, lore links, layout, and other map-only edits will be removed. Any unsaved map edits are also discarded.\n\nNothing changes until you click Save. After Save, the deleted map cannot be restored unless you exported a backup.`,
      confirmLabel: "Delete",
      cancelLabel: "Go back and backup first",
      tone: "destructive",
    });
    if (!confirmed) return;

    const result = startNewSpatialMap(savedDefinition, preserveExistingLocations);
    applyDraft(result.definition);
    setDraftHierarchyProfile(normalizeHierarchyProfile(baseHierarchyProfile, result.definition));
    setSelectedId(result.location.id);
    setEnteredParentId(null);
    setMobilePane("hierarchy");
    setReplacementCurrentLocationId(currentLocationId ? result.location.id : null);
    setArchiveRequestId(null);
    setArchiveReplacementId("");
    setImportIdReport(null);
    setFirstMapGenerationSession(null);
    setAiBuilderOpen(false);
    toast.success(
      preserveExistingLocations
        ? "Fresh map started. Previous locations remain archived for campaign history. Review it, then Save."
        : "Fresh map started in the working copy. Review it, then Save.",
    );
  }, [
    applyDraft,
    baseDefinition,
    baseHierarchyProfile,
    confirmAction,
    currentLocationId,
    draft,
    spatial.data?.hasCommittedSpatialHistory,
  ]);

  const handleExport = useCallback(() => {
    if (!draft) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: "marinara-hierarchical-map",
            formatVersion: 2,
            definition: draft,
            hierarchyProfile: normalizeHierarchyProfile(draftHierarchyProfile, draft),
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (chat?.name ?? "hierarchical-map")
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "hierarchical-map";
    link.href = url;
    link.download = `${safeName}.hierarchical-map.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [chat?.name, draft, draftHierarchyProfile]);

  const handleImport = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !draft) return;
      try {
        const raw = JSON.parse(await file.text()) as unknown;
        const rawRecord = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
        const candidate =
          rawRecord && "definition" in rawRecord
            ? rawRecord.definition
            : raw;
        const parsed = spatialContextDefinitionSchema.safeParse(candidate);
        if (!parsed.success) {
          throw new Error(parsed.error.issues[0]?.message ?? "This file is not a valid hierarchical map.");
        }
        const importedIds = new Set(parsed.data.locations.map((location) => location.id));
        const missing = (baseDefinition?.locations ?? [])
          .filter((location) => !importedIds.has(location.id))
          .map((location) => ({ id: location.id, name: location.name }));
        if (spatial.data?.hasCommittedSpatialHistory && missing.length > 0) {
          setImportIdReport({ missing });
          throw new Error(
            `Campaign history uses ${missing.length} location ID${missing.length === 1 ? "" : "s"} missing from this file. Review the repair steps shown in the editor.`,
          );
        }
        const imported: SpatialContextDefinition = {
          ...parsed.data,
          ownerMode,
          enabled: draft.enabled,
          revision: baseDefinition?.revision ?? 0,
        };
        const importedProfile = normalizeHierarchyProfile(rawRecord?.hierarchyProfile, imported);
        applyDraft(imported);
        setDraftHierarchyProfile(importedProfile);
        setImportIdReport(null);
        setFirstMapGenerationSession(null);
        setSelectedId(imported.startingLocationId ?? imported.locations[0]?.id ?? null);
        setEnteredParentId(null);
        setMobilePane("hierarchy");
        toast.success("Map imported into the working copy. Review it, then Save.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "The map could not be imported.");
      }
    },
    [applyDraft, baseDefinition, draft, ownerMode, spatial.data?.hasCommittedSpatialHistory],
  );

  const handleClose = useCallback(async () => {
    if (dirty) {
      const discard = await confirmAction({
        title: "Discard map changes?",
        message: "You have unsaved hierarchical map changes. Leave the editor and discard them?",
        confirmLabel: "Discard changes",
        tone: "destructive",
      });
      if (!discard) return;
    }
    onClose();
  }, [confirmAction, dirty, onClose]);

  const handleSave = useCallback(async (enableForFirstSave = false) => {
    if (!draft || !dirty || issues.length > 0) return;
    const completingFirstMap = enableForFirstSave && baseDefinition === null;
    if (completingFirstMap && !canEnable) return;
    const definitionToSave = completingFirstMap ? { ...draft, enabled: true } : draft;
    setServerIssues([]);
    setConflict(false);
    setReviewConflict(false);
    try {
      const response = await updateSpatial.mutateAsync({
        chatId,
        expectedRevision: baseDefinition?.revision ?? 0,
        expectedCurrentLocationId: currentLocationId,
        ...(replacementCurrentLocationId ? { replacementCurrentLocationId } : {}),
        definition: { ...definitionToSave, ownerMode, revision: baseDefinition?.revision ?? 0 },
        hierarchyProfile: normalizeHierarchyProfile(draftHierarchyProfile, definitionToSave),
      });
      const saved = response.definition;
      if (!saved) throw new Error("The server did not return the saved map.");
      setBaseDefinition(cloneSpatialDefinition(saved));
      setDraft(cloneSpatialDefinition(saved));
      setBaseHierarchyProfile(response.hierarchyProfile);
      setDraftHierarchyProfile(response.hierarchyProfile);
      setServerIssues(response.warnings);
      setReplacementCurrentLocationId(null);
      setSavedFlash(true);
      setFirstMapGenerationSession(null);
      if (completingFirstMap) {
        const startingLocation = saved.locations.find((location) => location.id === saved.startingLocationId);
        setFirstSaveResult({
          locationCount: saved.locations.length,
          startingLocationName: startingLocation?.name ?? "the starting location",
        });
      }
      onDirtyChange?.(false);
      toast.success(completingFirstMap ? "Map ready for turns." : "Hierarchical map saved.");
    } catch (error) {
      const problem = getSpatialContextProblem(error);
      setServerIssues(problem.issues);
      if (problem.conflict) {
        setConflict(true);
        void spatial.refetch();
      } else {
        toast.error(problem.message);
      }
    }
  }, [
    baseDefinition,
    canEnable,
    chatId,
    currentLocationId,
    dirty,
    draft,
    draftHierarchyProfile,
    issues.length,
    ownerMode,
    replacementCurrentLocationId,
    onDirtyChange,
    spatial,
    updateSpatial,
  ]);

  const reloadServerVersion = useCallback(async () => {
    const result = await spatial.refetch();
    if (!result.data) return;
    const server = result.data.definition;
    const next = server ? cloneSpatialDefinition(server) : createEmptySpatialDefinition(ownerMode);
    setBaseDefinition(server ? cloneSpatialDefinition(server) : null);
    setDraft(next);
    const hierarchyProfile = normalizeHierarchyProfile(result.data.hierarchyProfile, next);
    setBaseHierarchyProfile(hierarchyProfile);
    setDraftHierarchyProfile(hierarchyProfile);
    setSelectedId(next.startingLocationId ?? next.locations[0]?.id ?? null);
    setEnteredParentId(null);
    setConflict(false);
    setReviewConflict(false);
    setServerIssues(result.data.warnings);
    setReplacementCurrentLocationId(null);
    setFirstSaveResult(null);
    setFirstMapGenerationSession(null);
  }, [ownerMode, spatial]);

  const applyGeneratedDraft = useCallback(
    (session: SpatialMapAiBuilderSession) => {
      if (!draft) return;
      const generated = session.result.definition;
      const parsedGenerated = spatialContextDefinitionSchema.safeParse(generated);
      if (!parsedGenerated.success) {
        toast.error(parsedGenerated.error.issues[0]?.message ?? "The AI draft was not a valid hierarchical map.");
        return;
      }
      const normalizedGenerated = parsedGenerated.data;
      const previousIds = new Set(draft.locations.map((location) => location.id));
      const next = {
        ...cloneSpatialDefinition(normalizedGenerated),
        ownerMode,
        enabled: draft.enabled,
        revision: baseDefinition?.revision ?? normalizedGenerated.revision,
      };
      const firstAddedLocation = next.locations.find((location) => !previousIds.has(location.id));
      const expandedExistingMap = session.result.operation === "expand";
      applyDraft(next);
      setDraftHierarchyProfile(
        normalizeHierarchyProfile(
          "hierarchyProfile" in session.result ? session.result.hierarchyProfile : draftHierarchyProfile,
          next,
        ),
      );
      setSelectedId(firstAddedLocation?.id ?? next.startingLocationId ?? next.locations[0]?.id ?? null);
      setEnteredParentId(firstAddedLocation?.parentId ?? null);
      setMobilePane("hierarchy");
      setArchiveRequestId(null);
      setArchiveReplacementId("");
      setConflict(false);
      setReviewConflict(false);
      setReplacementCurrentLocationId(
        currentLocationId && !next.locations.some((location) => location.id === currentLocationId)
          ? next.startingLocationId
          : null,
      );
      onClearPendingDraftReview?.();
      if (baseDefinition === null && session.result.operation !== "expand") {
        setFirstMapGenerationSession(session);
      }
      setAiBuilderOpen(false);
      toast.success(
        expandedExistingMap
          ? "AI expansion added to the working map. Review it, then Save."
          : "AI map draft applied. Review it, choose a start, then enable and save.",
      );
    },
    [applyDraft, baseDefinition, currentLocationId, draft, draftHierarchyProfile, onClearPendingDraftReview, ownerMode],
  );

  const regenerateFirstMapDraft = useCallback(async () => {
    if (!firstMapGenerationSession) return;
    const confirmed = await confirmAction({
      title: "Regenerate this working draft?",
      message:
        "This replaces the generated working draft and any unsaved edits made after it was applied. Nothing saved on the server changes.",
      confirmLabel: "Regenerate draft",
      tone: "destructive",
    });
    if (!confirmed) return;
    setAiBuilderOpen(true);
    setRegenerateRequestId((current) => current + 1);
  }, [confirmAction, firstMapGenerationSession]);

  const discardFirstMapDraft = useCallback(async () => {
    if (!draft || !firstMapGenerationSession) return;
    const confirmed = await confirmAction({
      title: "Discard this working draft?",
      message: "This clears the unsaved generated map. No saved map or chat history is changed.",
      confirmLabel: "Discard draft",
      tone: "destructive",
    });
    if (!confirmed) return;
    const empty = createEmptySpatialDefinition(ownerMode);
    applyDraft(empty);
    setDraftHierarchyProfile(defaultHierarchyProfile(empty));
    setSelectedId(null);
    setEnteredParentId(null);
    setMobilePane("hierarchy");
    setFirstMapGenerationSession(null);
    setReplacementCurrentLocationId(null);
    toast.info("Generated map draft discarded.");
  }, [applyDraft, confirmAction, draft, firstMapGenerationSession, ownerMode]);

  const closeAiBuilder = useCallback(() => {
    if (pendingSetupReview) {
      onClearPendingDraftReview?.();
      onClose();
      toast.info("Map draft skipped. You can build one later from Chat Settings.");
      return;
    }
    setAiBuilderOpen(false);
  }, [onClearPendingDraftReview, onClose, pendingSetupReview]);

  if (!spatial.isError && (spatial.isLoading || !initialized || !draft)) {
    return (
      <div
        className="mari-editor-shell flex flex-1 flex-col overflow-hidden"
        aria-label="Loading hierarchical map editor"
      >
        <div className="mari-editor-header">
          <div className="h-9 w-9 animate-pulse rounded-lg bg-[var(--marinara-editor-surface)]" />
          <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--marinara-editor-surface)]" />
        </div>
        <div className="grid flex-1 grid-cols-1 gap-px bg-[var(--marinara-editor-divider)] lg:grid-cols-[18rem_1fr_22rem]">
          {[0, 1, 2].map((column) => (
            <div key={column} className="space-y-3 bg-[var(--marinara-editor-bg)] p-4">
              <div className="h-5 w-1/2 animate-pulse rounded bg-[var(--marinara-editor-surface)]" />
              <div className="h-12 animate-pulse rounded-lg bg-[var(--marinara-editor-surface)]" />
              <div className="h-12 animate-pulse rounded-lg bg-[var(--marinara-editor-surface)]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (spatial.isError) {
    return (
      <div
        className="mari-editor-shell flex flex-1 items-center justify-center p-6"
        role="region"
        aria-label="Hierarchical map recovery"
      >
        <div className="max-w-sm text-center">
          <AlertCircle className="mx-auto text-[var(--destructive)]" />
          <h1 className="mt-3 text-base font-semibold">Hierarchical map unavailable</h1>
          <p className="mt-1 text-sm text-[var(--marinara-editor-muted)]">
            {getSpatialContextProblem(spatial.error).message}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => void spatial.refetch()}
              className="mari-editor-action inline-flex min-h-11 px-3"
            >
              <RefreshCw size="0.8125rem" /> Retry
            </button>
            <button
              type="button"
              onClick={() => void handleClose()}
              className="mari-editor-action inline-flex min-h-11 px-3"
            >
              <ArrowLeft size="0.8125rem" /> Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!draft) return null;

  const status = statusCopy({
    dirty,
    conflict,
    invalid: issues.length > 0,
    pending: updateSpatial.isPending,
    savedFlash,
  });
  const currentContext = enteredParentId
    ? (draft.locations.find((location) => location.id === enteredParentId) ?? null)
    : null;
  const localChildren = sortedChildren(draft, enteredParentId);
  const localPresentation = currentContext?.childPresentation ?? "list";
  const localBreadcrumb = resolveSpatialBreadcrumb(draft, enteredParentId);
  const conflictDifference = compareSpatialDefinitions(spatial.data?.definition ?? null, draft);
  const archiveRequest = draft.locations.find((location) => location.id === archiveRequestId) ?? null;
  const archiveReplacementChoices = activeLocations.filter((location) => location.id !== archiveRequestId);

  const localView = (
    <section className="flex h-full min-h-0 flex-col" aria-label="Local location view">
      <div className="border-b border-[var(--marinara-chat-chrome-panel-divider)] px-4 py-3">
        <div className="flex items-center gap-2">
          {currentContext && (
            <button
              type="button"
              onClick={() => setEnteredParentId(currentContext.parentId)}
              aria-label="Leave this location"
              className="mari-chrome-control h-11 w-11 p-0"
            >
              <ArrowLeft size="0.8125rem" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 overflow-hidden text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
              <button
                type="button"
                onClick={() => setEnteredParentId(null)}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md px-1 hover:text-[var(--marinara-chat-chrome-button-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
              >
                World
              </button>
              {localBreadcrumb.map((location) => (
                <span key={location.id} className="flex min-w-0 items-center gap-1 self-stretch">
                  <ChevronRight size="0.625rem" className="shrink-0" />
                  <button
                    type="button"
                    onClick={() => setEnteredParentId(location.id)}
                    className="flex min-h-11 min-w-0 items-center truncate rounded-md px-1 hover:text-[var(--marinara-chat-chrome-button-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
                  >
                    {location.name}
                  </button>
                </span>
              ))}
            </div>
            <h2 className="mt-0.5 truncate text-sm font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
              {currentContext?.name ?? "World map"}
            </h2>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-[var(--marinara-chat-chrome-highlight-bg)] px-2 py-1 text-[0.625rem] capitalize text-[var(--marinara-chat-chrome-panel-muted)]">
            {localPresentation === "map" ? <Map size="0.6875rem" /> : <List size="0.6875rem" />}
            {localPresentation}
          </span>
          {localPresentation === "map" && (
            <button
              type="button"
              aria-pressed={layoutEditing}
              onClick={() => setLayoutEditing((value) => !value)}
              className={cn(
                "mari-chrome-control min-h-11 px-3 text-xs",
                layoutEditing && "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]",
              )}
            >
              <Move size="0.75rem" /> {layoutEditing ? "Done arranging" : "Arrange map"}
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {localPresentation === "map" ? (
          <LocalMapCanvas
            locations={localChildren}
            selectedId={selectedId}
            onSelect={(locationId) => selectLocation(locationId, !layoutEditing)}
            onEnter={enterLocation}
            editing={layoutEditing}
            onMove={(locationId, placement) =>
              applyDraft(updateSpatialLocation(draft, locationId, { placement }))
            }
          />
        ) : localPresentation === "layers" ? (
          <LayerSelector
            locations={localChildren}
            selectedId={selectedId}
            onSelect={selectLocation}
            onEnter={enterLocation}
          />
        ) : localChildren.length === 0 ? (
          <div className="flex min-h-72 items-center justify-center px-6 text-center text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
            {currentContext
              ? "This location has no child locations yet."
              : "Create a starting location to begin the map."}
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-2" role="list">
            {localChildren.map((location) => (
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
                <button
                  type="button"
                  onClick={() => selectLocation(location.id)}
                  className="flex min-w-0 flex-1 self-stretch items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
                >
                  <span className="text-lg" aria-hidden="true">
                    {location.icon || "⌖"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{location.name || "Untitled location"}</span>
                    <span className="block truncate text-[0.625rem] capitalize text-[var(--marinara-chat-chrome-panel-muted)]">
                      {hierarchyTypeForLocation(draftHierarchyProfile, location).label}
                      {location.status === "archived" ? " · archived" : ""}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => enterLocation(location.id)}
                  className="mari-chrome-control min-h-11 px-3 text-xs"
                >
                  <CornerDownRight size="0.75rem" /> Enter
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );

  const inspector = (
    <LocationInspector
      definition={draft}
      location={selected}
      issues={issues.filter((issue) => issue.locationId === selected?.id)}
      currentLocationId={currentLocationId}
      hierarchyProfile={draftHierarchyProfile}
      onHierarchyTypeChange={(typeId) => {
        if (!selected) return;
        const type = draftHierarchyProfile.types.find((candidate) => candidate.id === typeId);
        if (!type) return;
        applyDraft(updateSpatialLocation(draft, selected.id, { kind: type.baseKind }));
        applyHierarchyProfile(withLocationHierarchyType(draftHierarchyProfile, selected.id, typeId));
      }}
      onUpdate={(patch) => selected && applyDraft(updateSpatialLocation(draft, selected.id, patch))}
      lorebooks={lorebooks}
      lorebookEntries={lorebookEntriesQuery.entries ?? []}
      excludedLorebookIds={excludedLorebookIds}
      lorebooksLoading={lorebookEntriesQuery.isLoading}
      onOpenLorebook={onOpenLorebook}
      onReparent={(parentId) => selected && applyDraft(reparentSpatialLocation(draft, selected.id, parentId))}
      onSetStarting={() => selected && applyDraft({ ...draft, startingLocationId: selected.id })}
      onArchive={() => selected && requestArchive(selected.id)}
      gameBinding={
        ownerMode === "game"
          ? {
              chatId,
              maps: gameMaps,
              disabled: dirty || !baseDefinition?.locations.some((location) => location.id === selected?.id),
            }
          : undefined
      }
    />
  );

  return (
    <div
      data-marinara-maps-workspace-root
      className="mari-editor-shell mari-editor-legacy-bridge relative z-[46] flex flex-1 flex-col overflow-hidden"
    >
      {pendingConfirmation && (
        <div
          ref={confirmationDialogRef}
          data-chat-floating-panel
          data-marinara-maps-confirmation="true"
          role="dialog"
          aria-modal="true"
          aria-label={pendingConfirmation.title}
          aria-describedby="marinara-maps-confirmation-message"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--background)]/85 p-3 sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) resolveConfirmation(false);
          }}
        >
          <div className="max-h-[min(42rem,calc(100dvh-1.5rem))] w-full max-w-md overflow-y-auto rounded-xl border border-[var(--destructive)]/35 bg-[var(--background)] shadow-2xl">
            <div className="flex items-start gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-5">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--destructive)]/15 text-[var(--destructive)]">
                <AlertCircle size="1.125rem" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-[var(--foreground)]">{pendingConfirmation.title}</h2>
                <p className="mt-1 text-xs font-medium text-[var(--destructive)]">Destructive map action</p>
              </div>
            </div>
            <p
              id="marinara-maps-confirmation-message"
              className="whitespace-pre-wrap px-4 py-4 text-sm leading-relaxed text-[var(--foreground)] sm:px-5"
            >
              {pendingConfirmation.message}
            </p>
            <div className="flex flex-col gap-2 border-t border-[var(--border)] px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
              <button
                ref={confirmationCancelRef}
                type="button"
                onClick={() => resolveConfirmation(false)}
                className="mari-chrome-control min-h-11 w-full px-4 text-sm sm:w-auto"
              >
                {pendingConfirmation.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => resolveConfirmation(true)}
                className="mari-chrome-control mari-chrome-control--danger min-h-11 w-full px-4 text-sm sm:w-auto"
              >
                {pendingConfirmation.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mari-editor-header relative z-50">
        <button
          type="button"
          onClick={() => void handleClose()}
          aria-label="Back to chat"
          className="mari-editor-action inline-flex min-h-11 min-w-11"
        >
          <ArrowLeft size="1.125rem" />
        </button>
        <div className="mari-editor-icon-tile">
          <Map size="1.125rem" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-[var(--marinara-editor-title)]">Hierarchical map</h1>
          <p className="truncate text-[0.625rem] text-[var(--marinara-editor-muted)]">{chat?.name ?? "Chat"}</p>
        </div>
        <div className="mari-editor-actions flex max-md:w-full max-md:justify-end max-md:border-t max-md:border-[var(--marinara-editor-divider)] max-md:pt-2">
          <button
            type="button"
            onClick={() => {
              void spatial.refetch();
              setAiBuilderOpen(true);
            }}
            disabled={aiBuilderOpen || conflict || updateSpatial.isPending}
            className="mari-editor-action inline-flex min-h-11 px-3 text-xs disabled:opacity-45"
          >
            <Sparkles size="0.8125rem" />{" "}
            {firstMapGenerationSession
              ? "Regenerate with AI"
              : draft.locations.length > 0
                ? "Expand with AI"
                : "Build with AI"}
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="mari-editor-action inline-flex min-h-11 px-3 text-xs"
            aria-label="Export hierarchical map"
          >
            <Upload size="0.8125rem" /> Export
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={conflict || updateSpatial.isPending}
            className="mari-editor-action inline-flex min-h-11 px-3 text-xs disabled:opacity-45"
            aria-label="Import hierarchical map"
          >
            <Download size="0.8125rem" /> Import
          </button>
          {baseDefinition && baseDefinition.locations.length > 0 && (
            <button
              type="button"
              onClick={() => void handleDeleteMap()}
              disabled={aiBuilderOpen || conflict || updateSpatial.isPending}
              className="mari-editor-action inline-flex min-h-11 px-3 text-xs text-[var(--destructive)] disabled:opacity-45"
              aria-label="Delete map and start over"
            >
              <Trash2 size="0.8125rem" /> Delete map
            </button>
          )}
          <input
            data-marinara-map-import-input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => void handleImport(event)}
          />
          <span className={cn("mari-editor-status mr-2", status.className)}>
            {status.icon}
            {status.label}
          </span>
          {!isFirstMapDraft && (
            <label className="mari-editor-action inline-flex min-h-11 cursor-pointer gap-2 px-3 text-xs">
              <input
                type="checkbox"
                checked={draft.enabled}
                disabled={!canEnable && !draft.enabled}
                onChange={(event) => applyDraft({ ...draft, enabled: event.target.checked })}
              />
              <span>{draft.enabled ? "Enabled" : "Disabled"}</span>
            </label>
          )}
          <button
            type="button"
            onClick={() => void handleSave(isFirstMapDraft)}
            disabled={
              !dirty ||
              issues.length > 0 ||
              updateSpatial.isPending ||
              conflict ||
              (isFirstMapDraft && !canEnable)
            }
            className="mari-editor-action mari-editor-action--primary inline-flex min-h-11 disabled:opacity-45"
          >
            <Save size="0.8125rem" /> {isFirstMapDraft ? "Enable and save map" : "Save"}
          </button>
        </div>
      </div>

      <SpatialMapAiBuilder
        chatId={chatId}
        debugMode={debugMode}
        ownerMode={ownerMode}
        open={aiBuilderOpen}
        definition={draft}
        hierarchyProfile={draftHierarchyProfile}
        generationPreferences={
          spatial.data?.generationPreferences ?? defaultGenerationPreferences(ownerMode)
        }
        currentLocationId={currentLocationId}
        preferredTargetLocationId={selected?.id ?? null}
        hasCommittedSpatialHistory={spatial.data?.hasCommittedSpatialHistory ?? false}
        dirty={dirty}
        initialResult={pendingSetupReview?.result}
        initialSession={firstMapGenerationSession}
        regenerateRequestId={regenerateRequestId}
        allowDirtyGeneratedReplacement={baseDefinition === null && firstMapGenerationSession !== null}
        setupReview={Boolean(pendingSetupReview)}
        lorebooks={lorebooks}
        excludedLorebookIds={excludedLorebookIds}
        onClose={closeAiBuilder}
        onApply={applyGeneratedDraft}
      />

      {!aiBuilderOpen && importIdReport && (
        <section
          className="border-b border-amber-500/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-200"
          role="alert"
          aria-label="Import location ID repair guidance"
        >
          <div className="flex items-start gap-3">
            <AlertCircle size="0.875rem" className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                Import blocked: {importIdReport.missing.length} saved location ID
                {importIdReport.missing.length === 1 ? " is" : "s are"} missing
              </p>
              <p className="mt-1 leading-relaxed text-amber-200/80">
                Names are editable labels; campaign history follows the stable IDs. Export this map as a baseline, copy your revised names and details into that file, and keep each matching ID unchanged before importing again.
              </p>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2" aria-label="Missing saved location IDs">
                {importIdReport.missing.slice(0, 12).map((location) => (
                  <li key={location.id} className="truncate rounded bg-black/10 px-2 py-1 font-mono text-[0.625rem]">
                    {location.name || "Untitled location"} · {location.id}
                  </li>
                ))}
              </ul>
              {importIdReport.missing.length > 12 && (
                <p className="mt-1 text-[0.625rem]">And {importIdReport.missing.length - 12} more missing IDs.</p>
              )}
              <p className="mt-2 text-[0.625rem] leading-relaxed text-amber-200/75">
                Reusing an old ID for a different conceptual place will make historical messages resolve to that new place.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setImportIdReport(null)}
              className="mari-chrome-control min-h-11 px-3 text-xs"
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      {!aiBuilderOpen && isFirstMapDraft && (
        <section
          aria-label="First map setup"
          className="border-b border-[var(--marinara-editor-divider)] bg-[var(--marinara-editor-surface)] px-4 py-3"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-52 flex-1">
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-[var(--marinara-chat-chrome-accent)]">
                First map
              </p>
              <p className="mt-1 text-xs font-medium text-[var(--marinara-editor-title)]">
                {draft.locations.length} {draft.locations.length === 1 ? "location" : "locations"} · {firstMapDepth}{" "}
                {firstMapDepth === 1 ? "level" : "levels"} · Working draft, not saved
              </p>
            </div>
            <ol
              aria-label="First map progress"
              className="flex flex-wrap items-center gap-1.5 text-[0.625rem] font-semibold text-[var(--marinara-editor-muted)]"
            >
              <li className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[var(--marinara-chat-chrome-highlight-bg)] px-2.5 text-[var(--marinara-chat-chrome-accent)]">
                <Check size="0.6875rem" /> Build
              </li>
              <li className="inline-flex min-h-8 items-center rounded-full bg-[var(--marinara-chat-chrome-highlight-bg)] px-2.5 text-[var(--marinara-editor-title)]">
                Review
              </li>
              <li className="inline-flex min-h-8 items-center rounded-full px-2.5">Start here</li>
              <li className="inline-flex min-h-8 items-center rounded-full px-2.5">Enable map</li>
            </ol>
            <label className="flex min-w-52 items-center gap-2 text-xs font-medium text-[var(--marinara-editor-title)] max-sm:w-full">
              <span className="shrink-0">Start here</span>
              <select
                aria-label="Starting location"
                value={draft.startingLocationId ?? ""}
                onChange={(event) => {
                  const startingLocationId = event.target.value || null;
                  applyDraft({ ...draft, startingLocationId });
                  if (startingLocationId) setSelectedId(startingLocationId);
                }}
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--marinara-chat-chrome-input-border)] bg-[var(--marinara-chat-chrome-input-bg)] px-3 text-xs text-[var(--marinara-chat-chrome-panel-title)] outline-none focus:border-[var(--marinara-chat-chrome-button-border-active)] focus:ring-2 focus:ring-[var(--marinara-chat-chrome-focus-ring)]"
              >
                <option value="">Choose a starting location</option>
                {activeLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            {firstMapGenerationSession && (
              <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
                <button
                  type="button"
                  onClick={() => void discardFirstMapDraft()}
                  className="mari-editor-action inline-flex min-h-11 px-3 text-xs"
                >
                  <Trash2 size="0.75rem" /> Discard draft
                </button>
                <button
                  type="button"
                  onClick={() => void regenerateFirstMapDraft()}
                  className="mari-editor-action inline-flex min-h-11 px-3 text-xs"
                >
                  <RefreshCw size="0.75rem" /> Regenerate
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {!aiBuilderOpen && firstSaveResult && (
        <div
          className="flex flex-wrap items-center gap-3 border-b border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-4 py-3 text-xs text-[var(--marinara-editor-title)]"
          role="status"
          aria-live="polite"
        >
          <Check size="0.875rem" className="text-[var(--marinara-chat-chrome-accent)]" />
          <span className="min-w-52 flex-1 font-semibold">
            Map ready · {firstSaveResult.locationCount}{" "}
            {firstSaveResult.locationCount === 1 ? "location" : "locations"} · Starting at {firstSaveResult.startingLocationName}
          </span>
          <button type="button" onClick={() => void handleClose()} className="mari-chrome-control min-h-11 px-3 text-xs">
            Return to chat
          </button>
        </div>
      )}

      {!aiBuilderOpen && conflict && (
        <div
          className="border-b border-red-500/25 bg-red-500/10 px-4 py-3 text-xs text-[var(--destructive)]"
          role="alert"
        >
          <div className="flex flex-wrap items-center gap-2">
            <AlertCircle size="0.8125rem" />
            <span className="min-w-52 flex-1 font-medium">
              The map changed elsewhere. Your working copy is preserved.
            </span>
            <button
              type="button"
              onClick={() => void reloadServerVersion()}
              className="mari-chrome-control min-h-11 px-3 text-xs"
            >
              <RefreshCw size="0.75rem" /> Reload server version
            </button>
            <button
              type="button"
              onClick={() => setReviewConflict((value) => !value)}
              className="mari-chrome-control min-h-11 px-3 text-xs"
            >
              Review differences
            </button>
          </div>
          {reviewConflict && (
            <div className="mt-3 grid gap-2 rounded-lg border border-red-500/20 bg-[var(--background)]/40 p-3 sm:grid-cols-4">
              <span>{conflictDifference.added.length} added</span>
              <span>{conflictDifference.removed.length} removed</span>
              <span>{conflictDifference.changed.length} changed</span>
              <span>{conflictDifference.settingsChanged ? "Settings changed" : "Settings match"}</span>
            </div>
          )}
        </div>
      )}

      {!aiBuilderOpen && archiveRequest && (
        <div className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-[var(--marinara-editor-text)]">
          <div className="flex flex-wrap items-center gap-2">
            <AlertCircle size="0.8125rem" />
            <span className="min-w-52 flex-1">
              Choose an active replacement before archiving {archiveRequest.name || "this location"}.
            </span>
            <select
              value={archiveReplacementId}
              onChange={(event) => setArchiveReplacementId(event.target.value)}
              className="min-h-11 min-w-48 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3"
            >
              <option value="">Choose replacement</option>
              {archiveReplacementChoices.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!archiveReplacementId}
              onClick={() => void finishArchive(archiveRequest.id, archiveReplacementId)}
              className="mari-chrome-control mari-chrome-control--danger min-h-11 px-3 text-xs"
            >
              Archive
            </button>
            <button
              type="button"
              onClick={() => setArchiveRequestId(null)}
              className="mari-chrome-control min-h-11 px-3 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!aiBuilderOpen && issues.length > 0 && (
        <div
          className="border-b border-red-500/25 bg-red-500/10 px-4 py-2 text-xs text-[var(--destructive)]"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <AlertCircle size="0.8125rem" className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Fix {issues.length} issue(s) before saving.</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {issues.slice(0, 4).map((issue, index) => (
                  <button
                    key={`${issue.code}-${index}`}
                    type="button"
                    onClick={() => issue.locationId && selectLocation(issue.locationId)}
                    className="inline-flex min-h-11 items-center rounded px-1 text-left underline decoration-current/40 underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
                  >
                    {issue.message}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!aiBuilderOpen && (draft.locations.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="max-w-md text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] text-[var(--marinara-chat-chrome-accent)]">
              <Map size="1.25rem" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
              Create a starting location
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
              Let AI draft the full hierarchy from the game or chat setup, or start manually with one broad place.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setAiBuilderOpen(true)}
                className="mari-chrome-control mari-chrome-control--primary min-h-11 px-5 text-sm"
              >
                <Sparkles size="0.875rem" /> Draft with AI
              </button>
              <button
                type="button"
                onClick={() => {
                  const result = addSpatialLocation(draft);
                  applyDraft(result.definition);
                  selectLocation(result.location.id);
                }}
                className="mari-chrome-control min-h-11 px-5 text-sm"
              >
                <Plus size="0.875rem" /> Build manually
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mari-maps-workspace-grid hidden min-h-0 flex-1 divide-x divide-[var(--marinara-chat-chrome-panel-divider)] lg:grid">
            <HierarchyNavigator
              definition={draft}
              selectedId={selectedId}
              currentLocationId={currentLocationId}
              expandSelectedChildren={isFirstMapDraft}
              onSelect={(id) => selectLocation(id, false)}
              onEnter={enterLocation}
              onAddChild={addChild}
              onAddSibling={addSibling}
              onDuplicate={duplicateSubtree}
              onArchive={requestArchive}
            />
            {localView}
            {inspector}
          </div>

          <div className="flex min-h-0 flex-1 flex-col lg:hidden">
            <nav
              className="grid grid-cols-3 border-b border-[var(--marinara-chat-chrome-panel-divider)] p-2"
              aria-label="Map editor panes"
            >
              {(["hierarchy", "local", "details"] as const).map((pane) => (
                <button
                  key={pane}
                  type="button"
                  aria-pressed={mobilePane === pane}
                  onClick={() => setMobilePane(pane)}
                  className={cn(
                    "min-h-11 rounded-lg px-2 text-xs font-medium capitalize transition-colors duration-200",
                    mobilePane === pane
                      ? "bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-button-text-active)]"
                      : "text-[var(--marinara-chat-chrome-panel-muted)]",
                  )}
                >
                  {pane}
                </button>
              ))}
            </nav>
            <div className="min-h-0 flex-1">
              {mobilePane === "hierarchy" ? (
                <HierarchyNavigator
                  definition={draft}
                  selectedId={selectedId}
                  currentLocationId={currentLocationId}
                  expandSelectedChildren={isFirstMapDraft}
                  onSelect={selectLocation}
                  onEnter={enterLocation}
                  onAddChild={addChild}
                  onAddSibling={addSibling}
                  onDuplicate={duplicateSubtree}
                  onArchive={requestArchive}
                />
              ) : mobilePane === "local" ? (
                localView
              ) : (
                inspector
              )}
            </div>
          </div>
        </>
      ))}
    </div>
  );
}
