import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CircleHelp,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Download,
  GitFork,
  ImageIcon,
  List,
  Loader2,
  Link2,
  Map as MapIcon,
  MoreHorizontal,
  Move,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  compareSpatialLocations,
  getSpatialDescendantIds,
  resolveSpatialLocationDepth,
  resolveSpatialBreadcrumb,
  spatialContextDefinitionSchema,
  validateSpatialArchive,
  type GameMap,
  type GenerateSpatialMapDraftResponse,
  type LorebookFolder,
  type SpatialContextDefinition,
  type SpatialDefinitionIssue,
  type SpatialLocationPlacement,
  type SpatialOwnerMode,
} from "@marinara-engine/shared";
import {
  getSpatialContextProblem,
  useCreateSpatialMapTemplate,
  useCreateSpatialSharedWorld,
  useDiscardSpatialSharedWorldDraft,
  useForkSpatialSharedWorld,
  useLinkSpatialSharedWorld,
  usePublishSpatialSharedWorldDraft,
  useSpatialContext,
  useSpatialSharedWorlds,
  useStartOverSpatialContext,
  useUpdateSpatialContext,
  useUpdateSpatialMapTemplate,
  useUpdateSpatialSharedWorld,
} from "../../hooks/use-spatial-context";
import { cn, WORLD_MAPS_GUIDE_URL } from "./package-utils";
import { locationArtworkGaps, replacementArtworkPatchForCurrentLocation } from "./location-artwork";
import { nextAvailableSharedWorldName } from "./shared-world-naming";
import { HierarchyNavigator } from "./components/HierarchyNavigator";
import { LayerSelector } from "./components/LayerSelector";
import { LocalMapCanvas } from "./components/LocalMapCanvas";
import {
  defaultLocationReferencePrompt,
  locationArtworkContext,
  LocationInspector,
} from "./components/LocationInspector";
import { SpatialMapAiBuilder, type SpatialMapAiBuilderSession } from "./components/SpatialMapAiBuilder";
import { SpatialLocationIcon } from "./components/SpatialLocationIcon";
import { PortableLoreImportDialog } from "./components/PortableLoreImportDialog";
import { useModalKeyboardNavigation } from "./components/use-modal-keyboard-navigation";
import {
  addSpatialLocation,
  archiveSpatialLocation,
  canonicalizeSpatialDirectLinks,
  cloneSpatialDefinition,
  compareSpatialDefinitions,
  createEmptySpatialDefinition,
  duplicateSpatialSubtree,
  isSpatialDefinitionDirty,
  reparentSpatialLocation,
  removeSpatialDirectLink,
  removeSpatialSubtree,
  setSpatialDirectLinkDirection,
  spatialDefinitionIssues,
  startNewSpatialMap,
  updateSpatialDirectLink,
  updateSpatialLocation,
} from "./editor-state";
import {
  getSpatialExcludedLorebookIds,
  reuseOrUploadSpatialGlobalGalleryImage,
  spatialArtworkImages,
  uploadSpatialGalleryImage,
  useGenerateSpatialGalleryImage,
  usePreviewSpatialGalleryImages,
  useSpatialChat,
  useSpatialGalleryImages,
  useSpatialGlobalGalleryImages,
  useSpatialLorebookEntries,
  useSpatialLorebooks,
  type SpatialArtworkImage,
  type SpatialGalleryImage,
  type SpatialGlobalGalleryImage,
  type SpatialGalleryImagePromptPreview,
} from "./use-spatial-resources";
import { packageApi } from "./package-api";
import { clearPendingSpatialTransition, usePendingSpatialTransition } from "./pending-spatial-transitions";
import { shouldRefreshSpatialWorkspace } from "./spatial-workspace-refresh";
import {
  buildPortableLoreBundle,
  importPortableLoreBundle,
  parsePortableLoreBundle,
  planPortableLoreImport,
  portableLoreApproximateBytes,
  portableLoreImportResultMessage,
  remapPortableLoreReferences,
  unresolvedPortableLoreReferences,
  type PortableLoreBundle,
  type PortableLoreExportMode,
  type PortableLoreImportPlan,
  type PortableLoreImportStrategy,
  type PortableLoreReference,
} from "./portable-lore";
import {
  defaultGenerationPreferences,
  defaultHierarchyProfile,
  globalGallerySpatialReferenceId,
  hierarchyTypeForLocation,
  instantiateSpatialMapTemplate,
  isGlobalGallerySpatialReferenceId,
  normalizeHierarchyProfile,
  withLocationHierarchyType,
  type SpatialHierarchyProfile,
  type SpatialMapTemplateRecord,
  type SpatialSharedWorldRecord,
} from "../../../../maps-shared/src/maps-model";

type MobilePane = "hierarchy" | "local" | "details";
type LayoutEditingMode = "places" | "background" | null;

type FirstSaveResult = {
  locationCount: number;
  startingLocationName: string;
};

type ImportIdReport = {
  missing: Array<{ id: string; name: string }>;
};

function artworkPreviewEnvironmentSignature(preview: SpatialGalleryImagePromptPreview): string {
  return JSON.stringify({
    connection: preview.connection,
    styleProfile: preview.styleProfile,
    campaign: preview.campaign,
    chatSettings: preview.chatSettings,
    width: preview.width,
    height: preview.height,
    items: preview.items.map(({ id, sourcePrompt, prompt, negativePrompt, width, height }) => ({
      id,
      sourcePrompt,
      prompt,
      negativePrompt,
      width,
      height,
    })),
  });
}

type PendingPortableLoreImport = {
  rawRecord: Record<string, unknown>;
  definition: SpatialContextDefinition;
  bundle: PortableLoreBundle;
  plan: PortableLoreImportPlan;
  startOverReplacement: boolean;
};

const EMPTY_PORTABLE_LORE_REFERENCES: PortableLoreReference[] = [];

type ArtworkProgress = {
  completed: number;
  total: number;
  currentName: string;
};

export type SpatialMapArtworkExport = Pick<
  SpatialGalleryImage,
  "prompt" | "provider" | "model" | "width" | "height"
> & {
  sourceImageId: string;
  filename: string;
  data: string;
};

const ARTWORK_MIME_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

export function referencedArtworkIds(definition: SpatialContextDefinition): string[] {
  return Array.from(
    new Set(
      definition.locations.flatMap((location) =>
        [location.referenceImageId, location.mapBackgroundImageId].filter(
          (imageId): imageId is string => typeof imageId === "string" && imageId.length > 0,
        ),
      ),
    ),
  );
}

function artworkFilename(image: SpatialArtworkImage, mimeType: string): string | null {
  const extension = ARTWORK_MIME_EXTENSIONS.get(mimeType.toLowerCase());
  if (!extension) return null;
  const sourceName = image.filePath.split(/[\\/]/u).at(-1) ?? `map-artwork-${image.id}`;
  const stem =
    sourceName
      .replace(/\.[^.]+$/u, "")
      .replace(/[^a-z0-9._-]+/giu, "-")
      .replace(/^-+|-+$/gu, "") || `map-artwork-${image.id}`;
  return `${stem}.${extension}`;
}

export function remapArtworkReferences(
  definition: SpatialContextDefinition,
  references: ReadonlyMap<string, string>,
): SpatialContextDefinition {
  return {
    ...definition,
    locations: definition.locations.map((location) => ({
      ...location,
      referenceImageId: location.referenceImageId
        ? (references.get(location.referenceImageId) ?? location.referenceImageId)
        : location.referenceImageId,
      mapBackgroundImageId: location.mapBackgroundImageId
        ? (references.get(location.mapBackgroundImageId) ?? location.mapBackgroundImageId)
        : location.mapBackgroundImageId,
    })),
  };
}

function artworkFile(image: SpatialArtworkImage, blob: Blob): File {
  const filename = artworkFilename(image, blob.type);
  if (!filename) throw new Error("Unsupported artwork type");
  return new File([blob], filename, { type: blob.type });
}

async function promoteSpatialArtworkToGlobalGallery(
  definition: SpatialContextDefinition,
  chatImages: SpatialGalleryImage[],
  initialGlobalImages: SpatialGlobalGalleryImage[],
): Promise<{
  definition: SpatialContextDefinition;
  promoted: number;
  reused: number;
  missing: number;
}> {
  const chatImagesById = new Map(chatImages.map((image) => [image.id, image]));
  const globalImages = [...initialGlobalImages];
  const references = new Map<string, string>();
  let promoted = 0;
  let reused = 0;
  let missing = 0;

  for (const referenceId of referencedArtworkIds(definition)) {
    if (isGlobalGallerySpatialReferenceId(referenceId)) continue;
    const image = chatImagesById.get(referenceId);
    if (!image) {
      missing += 1;
      continue;
    }
    try {
      const file = artworkFile({ ...image, referenceId: image.id, source: "chat" }, await packageApi.blob(image.url));
      const result = await reuseOrUploadSpatialGlobalGalleryImage(file, image, globalImages);
      references.set(referenceId, globalGallerySpatialReferenceId(result.image.id));
      if (!globalImages.some((candidate) => candidate.id === result.image.id)) globalImages.push(result.image);
      if (result.reused) reused += 1;
      else promoted += 1;
    } catch {
      missing += 1;
    }
  }

  return {
    definition: remapArtworkReferences(definition, references),
    promoted,
    reused,
    missing,
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Artwork could not be read."));
    reader.onerror = () => reject(reader.error ?? new Error("Artwork could not be read."));
    reader.readAsDataURL(blob);
  });
}

export function parseBundledArtwork(value: unknown): SpatialMapArtworkExport[] {
  if (!Array.isArray(value)) return [];
  const deduplicated = new Map<string, SpatialMapArtworkExport>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const sourceImageId = typeof record.sourceImageId === "string" ? record.sourceImageId.trim() : "";
    const filename = typeof record.filename === "string" ? record.filename.trim() : "";
    const data = typeof record.data === "string" ? record.data : "";
    if (!sourceImageId || !filename || !/^data:image\/(?:jpeg|png|gif|webp|avif);base64,/iu.test(data)) continue;
    deduplicated.set(sourceImageId, {
      sourceImageId,
      filename,
      data,
      prompt: typeof record.prompt === "string" ? record.prompt : "",
      provider: typeof record.provider === "string" ? record.provider : "",
      model: typeof record.model === "string" ? record.model : "",
      width: typeof record.width === "number" && Number.isFinite(record.width) ? record.width : null,
      height: typeof record.height === "number" && Number.isFinite(record.height) ? record.height : null,
    });
  }
  return [...deduplicated.values()];
}

export function bundledArtworkFile(artwork: SpatialMapArtworkExport): File {
  const match = /^data:(image\/(?:jpeg|png|gif|webp|avif));base64,(.+)$/isu.exec(artwork.data);
  if (!match) throw new Error("Bundled artwork is not a supported image.");
  const mimeType = match[1]?.toLowerCase();
  const encoded = match[2];
  if (!mimeType || !encoded) throw new Error("Bundled artwork is not a supported image.");
  const extension = ARTWORK_MIME_EXTENSIONS.get(mimeType);
  if (!extension) throw new Error("Bundled artwork is not a supported image.");
  const binary = atob(encoded.replace(/\s+/gu, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const stem =
    artwork.filename
      .replace(/\.[^.]+$/u, "")
      .replace(/[^a-z0-9._-]+/giu, "-")
      .replace(/^-+|-+$/gu, "") || "map-artwork";
  return new File([bytes], `${stem}.${extension}`, { type: mimeType });
}

type MapConfirmationOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "destructive";
};

interface SpatialMapWorkspaceProps {
  chatId: string | null;
  template?: SpatialMapTemplateRecord;
  sharedWorld?: SpatialSharedWorldRecord;
  stagedTemplate?: SpatialMapTemplateRecord | null;
  debugMode?: boolean;
  pendingDraftReview?: {
    chatId: string;
    result: GenerateSpatialMapDraftResponse;
  } | null;
  initialUnresolvedLoreReferences?: PortableLoreReference[];
  onClearPendingDraftReview?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onOpenLorebook?: (lorebookId: string) => void;
  onLorebooksChanged?: () => void | Promise<void>;
  onOpenTemplates?: (options?: { startOver?: boolean }) => void;
  onClose: () => void;
}

function sortedChildren(definition: SpatialContextDefinition, parentId: string | null) {
  return definition.locations.filter((location) => location.parentId === parentId).sort(compareSpatialLocations);
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
    return {
      label: "Conflict",
      className: "text-[var(--destructive)]",
      icon: <AlertCircle size="0.6875rem" />,
    };
  if (options.invalid)
    return {
      label: "Invalid",
      className: "text-[var(--destructive)]",
      icon: <AlertCircle size="0.6875rem" />,
    };
  if (options.dirty)
    return {
      label: "Unsaved",
      className: "text-[var(--marinara-editor-muted)]",
      icon: null,
    };
  if (options.savedFlash)
    return {
      label: "Saved",
      className: "text-[var(--marinara-chat-chrome-accent)]",
      icon: <Check size="0.6875rem" />,
    };
  return {
    label: "Up to date",
    className: "text-[var(--marinara-editor-muted)]",
    icon: <Check size="0.6875rem" />,
  };
}

export function SpatialMapWorkspace({
  chatId,
  template,
  sharedWorld,
  stagedTemplate = null,
  debugMode = false,
  pendingDraftReview = null,
  initialUnresolvedLoreReferences = EMPTY_PORTABLE_LORE_REFERENCES,
  onClearPendingDraftReview,
  onDirtyChange,
  onOpenLorebook,
  onLorebooksChanged,
  onOpenTemplates,
  onClose,
}: SpatialMapWorkspaceProps) {
  const sharedWorldMode = sharedWorld !== undefined;
  const templateMode = template !== undefined || sharedWorldMode;
  const spatial = useSpatialContext(templateMode ? null : chatId);
  const updateSpatial = useUpdateSpatialContext();
  const startOverSpatial = useStartOverSpatialContext();
  const updateTemplate = useUpdateSpatialMapTemplate();
  const updateSharedWorld = useUpdateSpatialSharedWorld();
  const publishSharedWorld = usePublishSpatialSharedWorldDraft();
  const discardSharedWorldDraft = useDiscardSpatialSharedWorldDraft();
  const forkSharedWorld = useForkSpatialSharedWorld();
  const createTemplate = useCreateSpatialMapTemplate();
  const createSharedWorld = useCreateSpatialSharedWorld();
  const linkSharedWorld = useLinkSpatialSharedWorld();
  const sharedWorlds = useSpatialSharedWorlds(!templateMode);
  const { data: chat } = useSpatialChat(templateMode ? null : chatId);
  const galleryImages = useSpatialGalleryImages(chatId ?? "", !templateMode);
  const globalGalleryImages = useSpatialGlobalGalleryImages();
  const availableArtworkImages = useMemo(
    () => spatialArtworkImages(galleryImages.data, globalGalleryImages.data),
    [galleryImages.data, globalGalleryImages.data],
  );
  const availableArtworkReferenceIds = useMemo(
    () => new Set(availableArtworkImages.map((image) => image.referenceId)),
    [availableArtworkImages],
  );
  const generateGalleryImage = useGenerateSpatialGalleryImage(chatId ?? "");
  const previewGalleryImages = usePreviewSpatialGalleryImages(chatId ?? "");
  const pendingSetupReview = !templateMode && pendingDraftReview?.chatId === chatId ? pendingDraftReview : null;
  const libraryRecord = sharedWorld ?? template;
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
  const exportDialogRef = useRef<HTMLDivElement>(null);
  const exportCloseRef = useRef<HTMLButtonElement>(null);
  const [initialized, setInitialized] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [baseTemplateName, setBaseTemplateName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enteredParentId, setEnteredParentId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("hierarchy");
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [serverIssues, setServerIssues] = useState<SpatialDefinitionIssue[]>([]);
  const [conflict, setConflict] = useState(false);
  const [reviewConflict, setReviewConflict] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [firstSaveResult, setFirstSaveResult] = useState<FirstSaveResult | null>(null);
  const [firstMapGenerationSession, setFirstMapGenerationSession] = useState<SpatialMapAiBuilderSession | null>(null);
  const [regenerateRequestId, setRegenerateRequestId] = useState(0);
  const [archiveRequestId, setArchiveRequestId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const pendingStartOverImportRef = useRef(false);
  const [archiveReplacementId, setArchiveReplacementId] = useState("");
  const lorebooksQuery = useSpatialLorebooks();
  const { data: lorebooks = [] } = lorebooksQuery;
  const lorebookEntriesQuery = useSpatialLorebookEntries(lorebooks.map((lorebook) => lorebook.id));
  const excludedLorebookIds = useMemo(() => (chat ? getSpatialExcludedLorebookIds(chat) : []), [chat]);
  const [replacementCurrentLocationId, setReplacementCurrentLocationId] = useState<string | null>(null);
  const [replaceMapOpen, setReplaceMapOpen] = useState(false);
  const [aiBuilderOpen, setAiBuilderOpen] = useState(false);
  const [aiBuilderStartOver, setAiBuilderStartOver] = useState(false);
  const [startOverPending, setStartOverPending] = useState(false);
  const [layoutEditingMode, setLayoutEditingMode] = useState<LayoutEditingMode>(null);
  const [importIdReport, setImportIdReport] = useState<ImportIdReport | null>(null);
  const [includeArtworkInExport, setIncludeArtworkInExport] = useState(true);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportMappingOpen, setExportMappingOpen] = useState(false);
  const [exportLoreMode, setExportLoreMode] = useState<PortableLoreExportMode>("linked-entries");
  const [exportFoldersByLorebookId, setExportFoldersByLorebookId] = useState<ReadonlyMap<string, LorebookFolder[]>>(
    new Map(),
  );
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingPortableLoreImport, setPendingPortableLoreImport] = useState<PendingPortableLoreImport | null>(null);
  const [unresolvedLoreReferences, setUnresolvedLoreReferences] = useState<PortableLoreReference[]>(
    initialUnresolvedLoreReferences,
  );
  const [artworkProgress, setArtworkProgress] = useState<ArtworkProgress | null>(null);
  const [artworkPreview, setArtworkPreview] = useState<SpatialGalleryImagePromptPreview | null>(null);
  const [artworkPreviewSourceSignature, setArtworkPreviewSourceSignature] = useState<string | null>(null);
  const [artworkPreviewSourceEnvironment, setArtworkPreviewSourceEnvironment] = useState<string | null>(null);
  const artworkGenerationOperationRef = useRef(0);
  const backgroundMoveFrameRef = useRef<number | null>(null);
  const pendingBackgroundMoveRef = useRef<{
    locationId: string;
    position: SpatialLocationPlacement;
  } | null>(null);

  useEffect(() => {
    if (!draft || unresolvedLoreReferences.length === 0) return;
    const next = unresolvedLoreReferences.filter((reference) =>
      draft.locations
        .find((location) => location.id === reference.locationId)
        ?.lorebookEntryIds.includes(reference.originalEntryId),
    );
    if (next.length !== unresolvedLoreReferences.length) setUnresolvedLoreReferences(next);
  }, [draft, unresolvedLoreReferences]);

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

  useModalKeyboardNavigation({
    dialogRef: confirmationDialogRef,
    initialFocusRef: confirmationCancelRef,
    open: Boolean(pendingConfirmation),
    onEscape: () => resolveConfirmation(false),
  });

  useEffect(
    () => () => {
      confirmationResolverRef.current?.(false);
      confirmationResolverRef.current = null;
    },
    [],
  );

  useEffect(
    () => () => {
      if (backgroundMoveFrameRef.current !== null) {
        window.cancelAnimationFrame(backgroundMoveFrameRef.current);
        backgroundMoveFrameRef.current = null;
      }
      pendingBackgroundMoveRef.current = null;
    },
    [chatId],
  );

  const ownerMode: SpatialOwnerMode = templateMode
    ? (libraryRecord?.data.definition.ownerMode ?? "roleplay")
    : chat?.mode === "game"
      ? "game"
      : "roleplay";
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
    setMobileActionsOpen(false);
    setConflict(false);
    setAiBuilderOpen(false);
    setAiBuilderStartOver(false);
    setStartOverPending(false);
    setFirstSaveResult(null);
    setFirstMapGenerationSession(null);
    setRegenerateRequestId(0);
    setLayoutEditingMode(null);
    setImportIdReport(null);
    setExportDialogOpen(false);
    setExportMappingOpen(false);
    setPendingPortableLoreImport(null);
    setUnresolvedLoreReferences(initialUnresolvedLoreReferences);
    setArtworkProgress(null);
    setTemplateName(libraryRecord?.name ?? "");
    setBaseTemplateName(libraryRecord?.name ?? "");
  }, [chatId, initialUnresolvedLoreReferences, libraryRecord?.id, resolveConfirmation, stagedTemplate?.id]);

  useEffect(() => {
    if (initialized) return;
    if (templateMode && libraryRecord) {
      const definition = cloneSpatialDefinition(libraryRecord.data.definition);
      const hierarchyProfile = normalizeHierarchyProfile(libraryRecord.data.hierarchyProfile, definition);
      setBaseDefinition(cloneSpatialDefinition(definition));
      setDraft(definition);
      setBaseHierarchyProfile(hierarchyProfile);
      setDraftHierarchyProfile(hierarchyProfile);
      setSelectedId(definition.startingLocationId ?? definition.locations[0]?.id ?? null);
      setEnteredParentId(null);
      setServerIssues([]);
      setInitialized(true);
      return;
    }
    if (!spatial.isSuccess) return;
    const server = spatial.data.definition;
    if (stagedTemplate) {
      const instantiated = instantiateSpatialMapTemplate(stagedTemplate.data, ownerMode);
      const nextDraft = {
        ...instantiated.definition,
        enabled: true,
        revision: server?.revision ?? 0,
      };
      const baseProfile = normalizeHierarchyProfile(
        spatial.data.hierarchyProfile,
        server ?? createEmptySpatialDefinition(ownerMode),
      );
      setBaseDefinition(server ? cloneSpatialDefinition(server) : null);
      setDraft(nextDraft);
      setBaseHierarchyProfile(baseProfile);
      setDraftHierarchyProfile(normalizeHierarchyProfile(instantiated.hierarchyProfile, nextDraft));
      setSelectedId(nextDraft.startingLocationId ?? nextDraft.locations[0]?.id ?? null);
      setEnteredParentId(null);
      setServerIssues(spatial.data.warnings);
      setInitialized(true);
      toast.success(`Loaded “${stagedTemplate.name}” as a Game working copy. Review it, then save.`);
      return;
    }
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
  }, [initialized, libraryRecord, ownerMode, spatial.data, spatial.isSuccess, stagedTemplate, templateMode]);

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
        JSON.stringify(baseHierarchyProfile) !==
          JSON.stringify(normalizeHierarchyProfile(draftHierarchyProfile, draft)) ||
        (templateMode && templateName.trim() !== baseTemplateName) ||
        (!templateMode &&
          replacementCurrentLocationId !== null &&
          replacementCurrentLocationId !== spatial.data?.currentLocationId)),
    [
      baseDefinition,
      baseHierarchyProfile,
      baseTemplateName,
      draft,
      draftHierarchyProfile,
      replacementCurrentLocationId,
      spatial.data?.currentLocationId,
      templateMode,
      templateName,
    ],
  );

  useEffect(() => {
    if (!spatial.isSuccess) return;
    const server = spatial.data.definition;
    const nextDraft = server ? cloneSpatialDefinition(server) : createEmptySpatialDefinition(ownerMode);
    const serverHierarchyProfile = normalizeHierarchyProfile(spatial.data.hierarchyProfile, nextDraft);
    if (
      !shouldRefreshSpatialWorkspace({
        initialized,
        templateMode,
        dirty,
        baseDefinition,
        serverDefinition: server,
        baseHierarchyProfile,
        serverHierarchyProfile,
      })
    ) {
      return;
    }
    setBaseDefinition(server ? cloneSpatialDefinition(server) : null);
    setDraft(nextDraft);
    setBaseHierarchyProfile(serverHierarchyProfile);
    setDraftHierarchyProfile(serverHierarchyProfile);
    setServerIssues(spatial.data.warnings);
    setConflict(false);
    setAiBuilderStartOver(false);
    setStartOverPending(false);
    setSelectedId((current) =>
      current && nextDraft.locations.some((location) => location.id === current)
        ? current
        : (nextDraft.startingLocationId ?? nextDraft.locations[0]?.id ?? null),
    );
    setEnteredParentId((current) =>
      current && nextDraft.locations.some((location) => location.id === current) ? current : null,
    );
  }, [
    baseDefinition,
    baseHierarchyProfile,
    dirty,
    initialized,
    ownerMode,
    spatial.data,
    spatial.isSuccess,
    templateMode,
  ]);

  const selected = draft?.locations.find((location) => location.id === selectedId) ?? null;
  const currentContext = enteredParentId
    ? (draft?.locations.find((location) => location.id === enteredParentId) ?? null)
    : null;
  const currentContextId = currentContext?.id ?? null;
  const localPresentation = currentContext?.childPresentation ?? "list";
  const localMapBackgroundImageUrl = currentContext?.mapBackgroundImageId
    ? availableArtworkImages.find((image) => image.referenceId === currentContext.mapBackgroundImageId)?.url
    : undefined;
  const galleryImagesInitiallyLoading =
    globalGalleryImages.isLoading ||
    (globalGalleryImages.isFetching && globalGalleryImages.data === undefined) ||
    (!templateMode && (galleryImages.isLoading || (galleryImages.isFetching && galleryImages.data === undefined)));
  const effectiveLayoutEditingMode =
    layoutEditingMode === "background" && (localPresentation !== "map" || !localMapBackgroundImageUrl)
      ? null
      : layoutEditingMode;
  const currentLocationId = templateMode ? null : (spatial.data?.currentLocationId ?? null);
  const effectiveCurrentLocationId = replacementCurrentLocationId ?? currentLocationId;
  const pendingTransition = usePendingSpatialTransition(templateMode ? null : chatId);
  const activeLocations = draft?.locations.filter((location) => location.status === "active") ?? [];
  const artworkReferencesResolved = globalGalleryImages.isSuccess && (templateMode || galleryImages.isSuccess);
  const missingArtworkAssignments = useMemo(
    () => locationArtworkGaps(draft?.locations ?? [], availableArtworkReferenceIds, artworkReferencesResolved),
    [artworkReferencesResolved, availableArtworkReferenceIds, draft?.locations],
  );
  const missingArtworkLocations = useMemo(
    () => missingArtworkAssignments.map((assignment) => assignment.location),
    [missingArtworkAssignments],
  );
  const artworkImagesToGenerate = missingArtworkAssignments.length;
  const linkedSharedWorld =
    !templateMode && spatial.data?.sharedWorld.mode === "linked" ? spatial.data.sharedWorld : null;
  const archivedDeletion = useMemo(() => {
    if (!draft || !selected || selected.status !== "archived" || templateMode) return null;
    const locationIds = new Set([selected.id, ...getSpatialDescendantIds(draft, selected.id)]);
    const removedLocations = draft.locations.filter((location) => locationIds.has(location.id));
    const reasons: string[] = [];
    if (linkedSharedWorld) reasons.push("Detach and keep an independent copy before permanently deleting locations.");
    if (removedLocations.some((location) => location.status !== "archived")) {
      reasons.push("Archive every child location in this branch before deleting it.");
    }
    if (draft.startingLocationId && locationIds.has(draft.startingLocationId)) {
      reasons.push("Choose another starting location before deleting this branch.");
    }
    if (effectiveCurrentLocationId && locationIds.has(effectiveCurrentLocationId)) {
      reasons.push("Set another current story location and save it before deleting this branch.");
    }
    const protections = (spatial.data?.locationDeletionProtections ?? []).filter((entry) =>
      locationIds.has(entry.locationId),
    );
    const historySnapshotCount = protections.reduce((total, entry) => total + entry.historySnapshotCount, 0);
    if (historySnapshotCount > 0) {
      reasons.push(
        `Kept because ${historySnapshotCount} historical message${historySnapshotCount === 1 ? "" : "s"} reference this branch.`,
      );
    }
    const gameMapBindingCount = protections.reduce((total, entry) => total + entry.gameMapBindingCount, 0);
    if (gameMapBindingCount > 0) {
      reasons.push(
        `Remove ${gameMapBindingCount} Game map binding${gameMapBindingCount === 1 ? "" : "s"} before deleting this branch.`,
      );
    }
    if (pendingTransition && locationIds.has(pendingTransition.transition.destinationId)) {
      reasons.push("Cancel the queued destination before deleting this branch.");
    }
    return {
      count: removedLocations.length,
      locationIds,
      protection: reasons[0] ?? null,
    };
  }, [
    draft,
    effectiveCurrentLocationId,
    linkedSharedWorld,
    pendingTransition,
    selected,
    spatial.data?.locationDeletionProtections,
    templateMode,
  ]);
  const mobileMapNoticeCount =
    Number(missingArtworkLocations.length > 0) +
    Number(Boolean(linkedSharedWorld?.missing || linkedSharedWorld?.conflict || linkedSharedWorld?.pendingChanges));
  const artworkPreviewInputSignature = missingArtworkAssignments
    .map(({ location, referenceMissing, mapBackgroundMissing }) =>
      [
        location.id,
        location.name,
        referenceMissing ? "reference" : "",
        mapBackgroundMissing ? "background" : "",
        defaultLocationReferencePrompt(location),
        JSON.stringify(locationArtworkContext(draft!, draftHierarchyProfile, location)),
      ].join("\u0000"),
    )
    .join("\u0001");
  const artworkPreviewRequestItems = useMemo(
    () =>
      missingArtworkLocations.map((location) => ({
        id: location.id,
        title: location.name,
        prompt: defaultLocationReferencePrompt(location),
        mapsArtworkContext: locationArtworkContext(draft!, draftHierarchyProfile, location),
      })),
    [draft, draftHierarchyProfile, missingArtworkLocations],
  );
  const invalidateArtworkGeneration = useCallback(() => {
    artworkGenerationOperationRef.current += 1;
  }, []);
  useEffect(() => {
    invalidateArtworkGeneration();
  }, [artworkPreviewInputSignature, chatId, invalidateArtworkGeneration]);
  useEffect(() => () => invalidateArtworkGeneration(), [invalidateArtworkGeneration]);
  const artworkPreviewStale =
    artworkPreview !== null &&
    (artworkPreviewSourceSignature !== artworkPreviewInputSignature || artworkPreviewSourceEnvironment === null);
  const spatialUpdatePending = updateSpatial.isPending || startOverSpatial.isPending;
  const artworkActionsDisabled =
    artworkProgress !== null || previewGalleryImages.isPending || conflict || spatialUpdatePending;
  const canEnable =
    !!draft?.startingLocationId &&
    draft.locations.some((location) => location.id === draft.startingLocationId && location.status === "active");
  const isFirstMapDraft = baseDefinition === null && (draft?.locations.length ?? 0) > 0;
  const startOverBuilderDefinition = useMemo(() => createEmptySpatialDefinition(ownerMode), [ownerMode]);
  const startOverBuilderProfile = useMemo(
    () => defaultHierarchyProfile(startOverBuilderDefinition),
    [startOverBuilderDefinition],
  );
  const aiBuilderDefinition = aiBuilderStartOver ? startOverBuilderDefinition : draft;
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

  useEffect(() => {
    if (
      layoutEditingMode !== "background" ||
      (localPresentation === "map" && localMapBackgroundImageUrl) ||
      galleryImagesInitiallyLoading
    ) {
      return;
    }
    setLayoutEditingMode(null);
  }, [galleryImagesInitiallyLoading, layoutEditingMode, localMapBackgroundImageUrl, localPresentation]);

  const applyDraft = useCallback(
    (next: SpatialContextDefinition) => {
      invalidateArtworkGeneration();
      setDraft(next);
      setServerIssues([]);
      setSavedFlash(false);
      setFirstSaveResult(null);
      setArtworkPreview(null);
      setArtworkPreviewSourceSignature(null);
    },
    [invalidateArtworkGeneration],
  );

  const fillMissingArtwork = useCallback(async () => {
    if (
      !draft ||
      artworkProgress ||
      previewGalleryImages.isPending ||
      artworkPreviewStale ||
      missingArtworkLocations.length === 0
    ) {
      return;
    }

    const operation = artworkGenerationOperationRef.current + 1;
    artworkGenerationOperationRef.current = operation;
    try {
      const currentPreview = await previewGalleryImages.mutateAsync({
        items: artworkPreviewRequestItems,
        debugMode,
      });
      if (artworkGenerationOperationRef.current !== operation) return;
      if (artworkPreviewSourceEnvironment !== artworkPreviewEnvironmentSignature(currentPreview)) {
        setArtworkPreviewSourceEnvironment(null);
        toast.error("Image or Chat Settings changed. Refresh prompts before creating artwork.");
        return;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not verify the reviewed image requests.");
      return;
    }

    const generatedArtwork: Array<{
      assignment: (typeof missingArtworkAssignments)[number];
      imageId: string;
    }> = [];
    let failedImages = 0;
    const reviewedItems = new globalThis.Map(artworkPreview?.items.map((item) => [item.id, item]) ?? []);
    setArtworkPreview(null);
    setArtworkPreviewSourceSignature(null);
    setArtworkProgress({
      completed: 0,
      total: missingArtworkLocations.length,
      currentName: "",
    });

    for (const [index, assignment] of missingArtworkAssignments.entries()) {
      const target = assignment.location;
      setArtworkProgress({
        completed: index,
        total: missingArtworkLocations.length,
        currentName: target.name,
      });

      let imageId: string;
      try {
        const reviewed = reviewedItems.get(target.id);
        const image = await generateGalleryImage.mutateAsync({
          prompt: reviewed?.sourcePrompt ?? defaultLocationReferencePrompt(target),
          title: target.name,
          mapsArtworkContext: locationArtworkContext(draft, draftHierarchyProfile, target),
          ...(reviewed
            ? {
                promptOverride: reviewed.prompt,
                negativePromptOverride: reviewed.negativePrompt,
              }
            : {}),
          debugMode,
        });
        imageId = image.id;
      } catch {
        failedImages += 1;
        continue;
      }

      generatedArtwork.push({ assignment, imageId });
    }

    if (generatedArtwork.length > 0) {
      setDraft((currentDraft) => {
        if (!currentDraft) return currentDraft;
        return generatedArtwork.reduce((nextDraft, generated) => {
          const current = nextDraft.locations.find((location) => location.id === generated.assignment.location.id);
          if (!current) return nextDraft;
          const patch = replacementArtworkPatchForCurrentLocation(generated.assignment, current, generated.imageId);
          return patch ? updateSpatialLocation(nextDraft, current.id, patch) : nextDraft;
        }, currentDraft);
      });
      setServerIssues([]);
      setSavedFlash(false);
      setFirstSaveResult(null);
      setArtworkPreview(null);
      setArtworkPreviewSourceSignature(null);
      toast.success(
        `Created artwork for ${generatedArtwork.length} location${generatedArtwork.length === 1 ? "" : "s"}. Missing roles were filled where still needed; newer artwork choices were preserved. Review it, then Save.`,
      );
    }
    if (failedImages > 0) {
      toast.error(
        `${failedImages} location image${failedImages === 1 ? "" : "s"} could not be created. Any successful artwork is still in the working copy.`,
      );
    }
    setArtworkProgress(null);
  }, [
    artworkPreview,
    artworkPreviewRequestItems,
    artworkPreviewSourceEnvironment,
    artworkProgress,
    debugMode,
    draft,
    draftHierarchyProfile,
    generateGalleryImage,
    missingArtworkAssignments,
    missingArtworkLocations,
    artworkPreviewStale,
    previewGalleryImages.isPending,
  ]);

  const prepareArtworkPreview = useCallback(async () => {
    if (artworkProgress || previewGalleryImages.isPending || artworkImagesToGenerate === 0) return;
    const sourceSignature = artworkPreviewInputSignature;
    try {
      const preview = await previewGalleryImages.mutateAsync({
        items: artworkPreviewRequestItems,
        debugMode,
      });
      setArtworkPreview(preview);
      setArtworkPreviewSourceSignature(sourceSignature);
      setArtworkPreviewSourceEnvironment(artworkPreviewEnvironmentSignature(preview));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not prepare the image request preview.");
    }
  }, [
    artworkImagesToGenerate,
    artworkPreviewInputSignature,
    artworkPreviewRequestItems,
    artworkProgress,
    debugMode,
    previewGalleryImages,
  ]);

  const refreshArtworkPreview = useCallback(async () => {
    if (!artworkPreview || artworkProgress || previewGalleryImages.isPending) return;
    const confirmed = await confirmAction({
      title: "Refresh artwork prompts?",
      message:
        "Refresh every request from the current map and image settings? This replaces any prompt or negative-prompt edits you made in this review.",
      confirmLabel: "Refresh prompts",
    });
    if (!confirmed) return;
    await prepareArtworkPreview();
  }, [artworkPreview, artworkProgress, confirmAction, prepareArtworkPreview, previewGalleryImages.isPending]);

  const flushBackgroundMove = useCallback(() => {
    backgroundMoveFrameRef.current = null;
    const pending = pendingBackgroundMoveRef.current;
    pendingBackgroundMoveRef.current = null;
    if (!pending) return;
    setDraft((currentDraft) =>
      currentDraft
        ? updateSpatialLocation(currentDraft, pending.locationId, {
            mapBackgroundPosition: pending.position,
          })
        : currentDraft,
    );
    setServerIssues([]);
    setSavedFlash(false);
    setFirstSaveResult(null);
  }, []);

  const queueBackgroundMove = useCallback(
    (position: SpatialLocationPlacement) => {
      if (!currentContextId) return;
      pendingBackgroundMoveRef.current = {
        locationId: currentContextId,
        position,
      };
      if (backgroundMoveFrameRef.current !== null) return;
      backgroundMoveFrameRef.current = window.requestAnimationFrame(flushBackgroundMove);
    },
    [currentContextId, flushBackgroundMove],
  );

  const applyHierarchyProfile = useCallback(
    (next: SpatialHierarchyProfile) => {
      if (!draft) return;
      invalidateArtworkGeneration();
      setDraftHierarchyProfile(normalizeHierarchyProfile(next, draft));
      setServerIssues([]);
      setSavedFlash(false);
      setFirstSaveResult(null);
    },
    [draft, invalidateArtworkGeneration],
  );

  const selectLocation = useCallback((locationId: string, showDetails = true) => {
    setSelectedId(locationId);
    if (showDetails) setMobilePane("details");
  }, []);

  const enterLocation = useCallback((locationId: string) => {
    setLayoutEditingMode(null);
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
      const result = addSpatialLocation(draft, {
        parentId: sibling.parentId,
        kind: sibling.kind,
      });
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

  const deleteArchivedLocation = useCallback(async () => {
    if (!draft || !selected || selected.status !== "archived" || !archivedDeletion) return;
    if (archivedDeletion.protection) {
      toast.error(archivedDeletion.protection);
      return;
    }
    const confirmed = await confirmAction({
      title: "Delete archived location permanently?",
      message:
        archivedDeletion.count > 1
          ? `Remove ${selected.name || "this location"} and ${archivedDeletion.count - 1} archived child location${archivedDeletion.count === 2 ? "" : "s"} from this map draft? Direct links, hierarchy assignments, and exported map data are cleaned up when you Save. Closing without saving still discards this deletion.`
          : `Remove ${selected.name || "this location"} from this map draft? Direct links, hierarchy assignments, and exported map data are cleaned up when you Save. Closing without saving still discards this deletion.`,
      confirmLabel: "Delete permanently",
      tone: "destructive",
    });
    if (!confirmed) return;
    const next = removeSpatialSubtree(draft, selected.id);
    const retainedLocationTypeIds = Object.fromEntries(
      Object.entries(draftHierarchyProfile.locationTypeIds).filter(
        ([locationId]) => !archivedDeletion.locationIds.has(locationId),
      ),
    );
    applyDraft(next);
    applyHierarchyProfile(
      normalizeHierarchyProfile({ ...draftHierarchyProfile, locationTypeIds: retainedLocationTypeIds }, next),
    );
    const nextSelection =
      selected.parentId ?? next.locations.find((location) => location.status === "active")?.id ?? null;
    setSelectedId(nextSelection);
    if (enteredParentId && archivedDeletion.locationIds.has(enteredParentId)) setEnteredParentId(selected.parentId);
    toast.success(
      archivedDeletion.count > 1
        ? `${archivedDeletion.count} archived locations removed from the draft. Click Save to apply it.`
        : "Archived location removed from the draft. Click Save to apply it.",
    );
  }, [
    applyDraft,
    applyHierarchyProfile,
    archivedDeletion,
    confirmAction,
    draft,
    draftHierarchyProfile,
    enteredParentId,
    selected,
  ]);

  const requestArchive = useCallback(
    (locationId: string) => {
      if (!draft) return;
      if (templateMode && !sharedWorldMode) {
        const location = draft.locations.find((candidate) => candidate.id === locationId);
        if (!location) return;
        const next = removeSpatialSubtree(draft, locationId);
        const removedCount = draft.locations.length - next.locations.length;
        void confirmAction({
          title: "Delete template location?",
          message: `Delete ${location.name || "this location"}${removedCount > 1 ? ` and its ${removedCount - 1} child locations` : ""} from this template?`,
          confirmLabel: "Delete location",
          tone: "destructive",
        }).then((confirmed) => {
          if (!confirmed) return;
          applyDraft(next);
          setSelectedId(location.parentId);
          if (enteredParentId === locationId) setEnteredParentId(location.parentId);
        });
        return;
      }
      const validation = validateSpatialArchive(draft, locationId, {
        currentLocationId,
      });
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
    [
      applyDraft,
      confirmAction,
      currentLocationId,
      draft,
      enteredParentId,
      finishArchive,
      sharedWorldMode,
      templateMode,
    ],
  );

  const handleDeleteMap = useCallback(async () => {
    const savedDefinition = baseDefinition ?? draft;
    if (!savedDefinition || savedDefinition.locations.length === 0) return false;
    const preserveExistingLocations = spatial.data?.hasCommittedSpatialHistory ?? false;
    const locationCount = savedDefinition.locations.length;
    const confirmed = await confirmAction({
      title: preserveExistingLocations
        ? "Break breadcrumb continuity and start a new map?"
        : "Delete this map and start over?",
      message: preserveExistingLocations
        ? `Are you sure? This is dangerous.\n\nStarting over breaks breadcrumb continuity. Old messages remain, but historical map links may no longer resolve because all ${locationCount} existing ${locationCount === 1 ? "location" : "locations"} will be removed from this map. A new blank New world starting location will become current. Any unsaved map edits are discarded.\n\nNothing changes until you click Save. Export first if you want a separate backup.`
        : `Are you sure? This is dangerous.\n\nDeleting replaces ${locationCount} saved ${locationCount === 1 ? "location" : "locations"} with one blank New world starting location. Existing map names, descriptions, routes, lore links, layout, and other map-only edits will be removed. Any unsaved map edits are also discarded.\n\nNothing changes until you click Save. After Save, the deleted map cannot be restored unless you exported a backup.`,
      confirmLabel: "Start blank",
      cancelLabel: "Go back and backup first",
      tone: "destructive",
    });
    if (!confirmed) return false;

    const result = startNewSpatialMap(savedDefinition, false);
    applyDraft(result.definition);
    setDraftHierarchyProfile(normalizeHierarchyProfile(baseHierarchyProfile, result.definition));
    setSelectedId(result.location.id);
    setEnteredParentId(null);
    setMobilePane("hierarchy");
    setReplacementCurrentLocationId(result.location.id);
    setStartOverPending(true);
    setArchiveRequestId(null);
    setArchiveReplacementId("");
    setImportIdReport(null);
    setFirstMapGenerationSession(null);
    setAiBuilderOpen(false);
    toast.success(
      preserveExistingLocations
        ? "Fresh map started. Old messages remain, but previous map locations will not resolve after Save. Review it, then Save."
        : "Fresh map started in the working copy. Review it, then Save.",
    );
    return true;
  }, [
    applyDraft,
    baseDefinition,
    baseHierarchyProfile,
    confirmAction,
    currentLocationId,
    draft,
    spatial.data?.hasCommittedSpatialHistory,
  ]);

  const beginAiStartOver = useCallback(async () => {
    if (dirty || spatial.data?.hasCommittedSpatialHistory) {
      const confirmed = await confirmAction({
        title: "Break breadcrumb continuity and start a new map?",
        message: `Old messages will remain, but historical map links may no longer resolve after the replacement is saved. ${dirty ? "Any unsaved map edits will also be discarded. " : ""}This cannot be undone unless you exported a backup.`,
        confirmLabel: "Start new map",
        cancelLabel: "Keep current map",
        tone: "destructive",
      });
      if (!confirmed) return;
    }
    setReplaceMapOpen(false);
    setAiBuilderStartOver(true);
    setAiBuilderOpen(true);
  }, [confirmAction, dirty, spatial.data?.hasCommittedSpatialHistory]);

  const portableExportBundle = useMemo(
    () =>
      exportDialogOpen && draft
        ? buildPortableLoreBundle({
            definition: draft,
            mode: exportLoreMode,
            lorebooks,
            entries: lorebookEntriesQuery.entries ?? [],
            foldersByLorebookId: exportFoldersByLorebookId,
          })
        : null,
    [draft, exportDialogOpen, exportFoldersByLorebookId, exportLoreMode, lorebookEntriesQuery.entries, lorebooks],
  );
  const portableExportEntryCount = useMemo(
    () => portableExportBundle?.books.reduce((count, book) => count + book.entries.length, 0) ?? 0,
    [portableExportBundle],
  );
  const portableExportKilobytes = useMemo(
    () =>
      portableExportBundle ? Math.max(1, Math.ceil(portableLoreApproximateBytes(portableExportBundle) / 1024)) : 0,
    [portableExportBundle],
  );
  useModalKeyboardNavigation({
    dialogRef: exportDialogRef,
    initialFocusRef: exportCloseRef,
    open: exportDialogOpen && Boolean(portableExportBundle),
    disabled: isExporting,
    onEscape: () => {
      setExportMappingOpen(false);
      setExportDialogOpen(false);
    },
  });

  const openExportDialog = useCallback(async () => {
    if (!draft || isExporting) return;
    if (lorebookEntriesQuery.isLoading) {
      toast.error("Lore entries are still loading. Try the export again in a moment.");
      return;
    }
    if (lorebookEntriesQuery.isError || !lorebookEntriesQuery.entries) {
      toast.error("Lore entries could not be loaded, so a portable export cannot be created safely.");
      return;
    }
    setIsExporting(true);
    try {
      const entriesById = new Map((lorebookEntriesQuery.entries ?? []).map((entry) => [entry.id, entry]));
      const linkedLorebookIds = Array.from(
        new Set(
          draft.locations
            .flatMap((location) => location.lorebookEntryIds)
            .map((entryId) => entriesById.get(entryId)?.lorebookId)
            .filter((lorebookId): lorebookId is string => Boolean(lorebookId)),
        ),
      );
      const folderRows = await Promise.all(
        linkedLorebookIds.map(
          async (lorebookId) =>
            [lorebookId, await packageApi.get<LorebookFolder[]>(`/lorebooks/${lorebookId}/folders`)] as const,
        ),
      );
      setExportFoldersByLorebookId(new Map(folderRows));
      setExportMappingOpen(false);
      setExportDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lore folders could not be prepared for export.");
    } finally {
      setIsExporting(false);
    }
  }, [draft, isExporting, lorebookEntriesQuery.entries, lorebookEntriesQuery.isError, lorebookEntriesQuery.isLoading]);

  const handleExport = useCallback(async () => {
    if (!draft || !portableExportBundle || isExporting) return;
    setIsExporting(true);
    try {
      const canonicalDraft = canonicalizeSpatialDirectLinks(draft);
      const shouldIncludeArtwork = includeArtworkInExport;
      const artwork: SpatialMapArtworkExport[] = [];
      let missingArtworkCount = 0;
      if (shouldIncludeArtwork) {
        const chatArtwork = templateMode ? [] : (galleryImages.data ?? (await galleryImages.refetch()).data ?? []);
        const globalArtwork = globalGalleryImages.data ?? (await globalGalleryImages.refetch()).data ?? [];
        const imagesById = new Map(
          spatialArtworkImages(chatArtwork, globalArtwork).map((image) => [image.referenceId, image]),
        );
        for (const imageId of referencedArtworkIds(canonicalDraft)) {
          const image = imagesById.get(imageId);
          if (!image) {
            missingArtworkCount += 1;
            continue;
          }
          try {
            const imageBlob = await packageApi.blob(image.url);
            const filename = artworkFilename(image, imageBlob.type);
            if (!filename) throw new Error("Unsupported artwork type");
            artwork.push({
              sourceImageId: image.referenceId,
              filename,
              data: await blobToDataUrl(imageBlob),
              prompt: image.prompt,
              provider: image.provider,
              model: image.model,
              width: image.width,
              height: image.height,
            });
          } catch {
            missingArtworkCount += 1;
          }
        }
      }

      const exportBlob = new Blob(
        [
          JSON.stringify(
            {
              format: "marinara-hierarchical-map",
              formatVersion: 4,
              name:
                (templateMode ? templateName : chat?.name)?.trim() ||
                canonicalDraft.locations.find((location) => location.parentId === null)?.name ||
                "World Map",
              definition: canonicalDraft,
              hierarchyProfile: normalizeHierarchyProfile(draftHierarchyProfile, canonicalDraft),
              portableLore: portableExportBundle,
              ...(shouldIncludeArtwork ? { artwork } : {}),
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(exportBlob);
      const link = document.createElement("a");
      const safeName =
        (templateMode ? templateName : (chat?.name ?? "world-map"))
          .replace(/[^a-z0-9._-]+/gi, "-")
          .replace(/^-+|-+$/g, "") || "world-map";
      link.href = url;
      link.download = `${safeName}.world-map.json`;
      link.click();
      URL.revokeObjectURL(url);
      setExportMappingOpen(false);
      setExportDialogOpen(false);
      if (shouldIncludeArtwork) {
        const includedCopy = `${artwork.length} artwork file${artwork.length === 1 ? "" : "s"} included`;
        const missingCopy =
          missingArtworkCount > 0
            ? `; ${missingArtworkCount} missing artwork link${missingArtworkCount === 1 ? " was" : "s were"} skipped`
            : "";
        toast.success(`World map exported: ${includedCopy}${missingCopy}.`);
      } else {
        toast.success("World map exported.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The world map could not be exported.");
    } finally {
      setIsExporting(false);
    }
  }, [
    chat?.name,
    draft,
    draftHierarchyProfile,
    galleryImages,
    globalGalleryImages,
    includeArtworkInExport,
    isExporting,
    portableExportBundle,
    templateMode,
    templateName,
  ]);

  const applyImportedMap = useCallback(
    async (
      rawRecord: Record<string, unknown> | null,
      definition: SpatialContextDefinition,
      portableLore: PortableLoreBundle | null,
      entryIdMap: ReadonlyMap<string, string>,
      startOverReplacement = false,
      onDraftApplied?: () => void,
    ) => {
      const loreRemappedDefinition = portableLore
        ? remapPortableLoreReferences(definition, portableLore, entryIdMap)
        : definition;
      const bundledArtwork = parseBundledArtwork(rawRecord?.artwork);
      const referencedIds = new Set(referencedArtworkIds(loreRemappedDefinition));
      const applicableArtwork = bundledArtwork.filter((artwork) => referencedIds.has(artwork.sourceImageId));
      const artworkIdMap = new Map<string, string>();
      const currentGlobalImages = [...(globalGalleryImages.data ?? (await globalGalleryImages.refetch()).data ?? [])];
      let sharedArtworkAdded = 0;
      let sharedArtworkReused = 0;
      let chatArtworkRestored = 0;
      let failedArtworkCount = 0;
      for (const artwork of applicableArtwork) {
        try {
          const file = bundledArtworkFile(artwork);
          if (templateMode || isGlobalGallerySpatialReferenceId(artwork.sourceImageId)) {
            const result = await reuseOrUploadSpatialGlobalGalleryImage(file, artwork, currentGlobalImages);
            artworkIdMap.set(artwork.sourceImageId, globalGallerySpatialReferenceId(result.image.id));
            if (!currentGlobalImages.some((candidate) => candidate.id === result.image.id)) {
              currentGlobalImages.push(result.image);
            }
            if (result.reused) sharedArtworkReused += 1;
            else sharedArtworkAdded += 1;
          } else if (chatId) {
            const uploaded = await uploadSpatialGalleryImage(chatId, file, artwork);
            artworkIdMap.set(artwork.sourceImageId, uploaded.id);
            chatArtworkRestored += 1;
          }
        } catch {
          failedArtworkCount += 1;
        }
      }
      if (chatArtworkRestored > 0) await galleryImages.refetch();
      if (sharedArtworkAdded > 0) await globalGalleryImages.refetch();
      const remappedDefinition = remapArtworkReferences(loreRemappedDefinition, artworkIdMap);
      const imported: SpatialContextDefinition = {
        ...remappedDefinition,
        ownerMode,
        enabled: draft?.enabled ?? remappedDefinition.enabled,
        revision: baseDefinition?.revision ?? 0,
      };
      if (!templateMode && startOverReplacement) {
        setReplacementCurrentLocationId(imported.startingLocationId ?? imported.locations[0]?.id ?? null);
      }
      const importedProfile = normalizeHierarchyProfile(rawRecord?.hierarchyProfile, imported);
      applyDraft(imported);
      onDraftApplied?.();
      setDraftHierarchyProfile(importedProfile);
      setImportIdReport(null);
      setFirstMapGenerationSession(null);
      setSelectedId(imported.startingLocationId ?? imported.locations[0]?.id ?? null);
      setEnteredParentId(null);
      setMobilePane("hierarchy");
      if (!templateMode && startOverReplacement) setStartOverPending(true);
      const existingLoreEntryIds = new Set((lorebookEntriesQuery.entries ?? []).map((entry) => entry.id));
      setUnresolvedLoreReferences(
        portableLore
          ? unresolvedPortableLoreReferences(portableLore, entryIdMap).filter(
              (reference) => reference.entryKey !== null || !existingLoreEntryIds.has(reference.originalEntryId),
            )
          : [],
      );
      toast.success(
        templateMode
          ? `World map imported into this template. Review it, then Save template.${sharedArtworkAdded > 0 ? ` ${sharedArtworkAdded} artwork file${sharedArtworkAdded === 1 ? " was" : "s were"} added to Global Gallery.` : ""}${sharedArtworkReused > 0 ? ` ${sharedArtworkReused} existing shared image${sharedArtworkReused === 1 ? " was" : "s were"} reused.` : ""}${failedArtworkCount > 0 ? ` ${failedArtworkCount} artwork file${failedArtworkCount === 1 ? "" : "s"} could not be restored.` : ""}`
          : `World map imported into the working copy. Review it, then Save.${chatArtworkRestored > 0 ? ` ${chatArtworkRestored} artwork file${chatArtworkRestored === 1 ? " was" : "s were"} restored to this chat's Gallery.` : ""}${sharedArtworkAdded > 0 ? ` ${sharedArtworkAdded} shared artwork file${sharedArtworkAdded === 1 ? " was" : "s were"} added to Global Gallery.` : ""}${sharedArtworkReused > 0 ? ` ${sharedArtworkReused} existing shared image${sharedArtworkReused === 1 ? " was" : "s were"} reused.` : ""}${failedArtworkCount > 0 ? ` ${failedArtworkCount} artwork file${failedArtworkCount === 1 ? "" : "s"} could not be restored.` : ""}`,
      );
    },
    [
      applyDraft,
      baseDefinition?.revision,
      chatId,
      draft?.enabled,
      galleryImages,
      globalGalleryImages,
      lorebookEntriesQuery.entries,
      ownerMode,
      templateMode,
    ],
  );

  const handleImport = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      const startOverReplacement = pendingStartOverImportRef.current;
      pendingStartOverImportRef.current = false;
      if (!file || !draft || isImporting) return;
      setIsImporting(true);
      try {
        const raw = JSON.parse(await file.text()) as unknown;
        const rawRecord =
          raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
        const candidate = rawRecord && "definition" in rawRecord ? rawRecord.definition : raw;
        const parsed = spatialContextDefinitionSchema.safeParse(candidate);
        if (!parsed.success) {
          throw new Error(parsed.error.issues[0]?.message ?? "This file is not a valid world map.");
        }
        const importedMapName =
          (typeof rawRecord?.name === "string" ? rawRecord.name.trim() : "") ||
          parsed.data.locations.find((location) => location.parentId === null)?.name.trim() ||
          file.name.replace(/(?:\.world-map)?\.json$/iu, "").trim() ||
          "Imported Map";
        const importedIds = new Set(parsed.data.locations.map((location) => location.id));
        const missing = (baseDefinition?.locations ?? [])
          .filter((location) => !importedIds.has(location.id))
          .map((location) => ({ id: location.id, name: location.name }));
        if (spatial.data?.hasCommittedSpatialHistory && missing.length > 0 && !startOverPending) {
          setImportIdReport({ missing });
          throw new Error(
            `Campaign history uses ${missing.length} location ID${missing.length === 1 ? "" : "s"} missing from this file. Review the repair steps shown in the editor.`,
          );
        }
        const portableLoreValue = rawRecord?.portableLore;
        const hasPortableLore = portableLoreValue !== null && portableLoreValue !== undefined;
        const portableLore = hasPortableLore ? parsePortableLoreBundle(portableLoreValue) : null;
        if (hasPortableLore && !portableLore) {
          throw new Error("This file contains invalid or unsupported portable lore data.");
        }
        if (portableLore && portableLore.references.length > 0 && !lorebookEntriesQuery.entries) {
          throw new Error("Lore entries are still loading. Try the import again in a moment.");
        }
        if (portableLore && portableLore.books.length > 0) {
          const entries = lorebookEntriesQuery.entries;
          if (!entries) throw new Error("Lore entries are still loading. Try the import again in a moment.");
          setPendingPortableLoreImport({
            rawRecord: rawRecord ?? {},
            definition: parsed.data,
            bundle: portableLore,
            plan: planPortableLoreImport(portableLore, lorebooks, entries, importedMapName),
            startOverReplacement,
          });
          return;
        }
        await applyImportedMap(rawRecord, parsed.data, portableLore, new Map(), startOverReplacement);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "The world map could not be imported.");
      } finally {
        setIsImporting(false);
      }
    },
    [
      applyImportedMap,
      baseDefinition,
      draft,
      isImporting,
      lorebookEntriesQuery.entries,
      lorebooks,
      spatial.data?.hasCommittedSpatialHistory,
    ],
  );

  const confirmPortableLoreImport = useCallback(
    async (strategy: PortableLoreImportStrategy, ambiguousSelections: ReadonlyMap<string, string | null>) => {
      if (!pendingPortableLoreImport || isImporting) return;
      setIsImporting(true);
      let createdLorebookIds: string[] = [];
      let draftApplied = false;
      try {
        const result = await importPortableLoreBundle({
          api: packageApi,
          bundle: pendingPortableLoreImport.bundle,
          plan: pendingPortableLoreImport.plan,
          strategy,
          ambiguousSelections,
        });
        createdLorebookIds = result.createdLorebookIds;
        await applyImportedMap(
          pendingPortableLoreImport.rawRecord,
          pendingPortableLoreImport.definition,
          pendingPortableLoreImport.bundle,
          result.entryIdMap,
          pendingPortableLoreImport.startOverReplacement,
          () => {
            draftApplied = true;
          },
        );
        setPendingPortableLoreImport(null);
        try {
          await Promise.all([lorebooksQuery.refetch(), onLorebooksChanged?.()]);
        } catch {
          toast.error("The lore was restored, but the lorebook list could not be refreshed.");
        }
        toast.success(portableLoreImportResultMessage(result));
      } catch (error) {
        if (!draftApplied && createdLorebookIds.length > 0) {
          await Promise.allSettled(
            createdLorebookIds.map((lorebookId) => packageApi.delete(`/lorebooks/${lorebookId}`)),
          );
        }
        toast.error(error instanceof Error ? error.message : "The portable lore could not be restored.");
      } finally {
        setIsImporting(false);
      }
    },
    [applyImportedMap, isImporting, lorebooksQuery, onLorebooksChanged, pendingPortableLoreImport],
  );

  const saveAsTemplate = useCallback(async () => {
    if (templateMode || !draft || draft.locations.length === 0 || createTemplate.isPending) return;
    const name = `${chat?.name?.trim() || "Untitled"} map`;
    const confirmed = await confirmAction({
      title: "Save map as a template?",
      message: `Save a reusable copy named “${name}” to Agents → Maps? Referenced chat artwork will be added to or reused from Global Gallery. Campaign history, current location, and Game bindings are not copied.`,
      confirmLabel: "Save template",
    });
    if (!confirmed) return;
    try {
      const canonicalDraft = canonicalizeSpatialDirectLinks(draft);
      const chatArtwork = galleryImages.data ?? (await galleryImages.refetch()).data ?? [];
      const globalArtwork = globalGalleryImages.data ?? (await globalGalleryImages.refetch()).data ?? [];
      const promotion = await promoteSpatialArtworkToGlobalGallery(canonicalDraft, chatArtwork, globalArtwork);
      if (promotion.promoted > 0) await globalGalleryImages.refetch();
      await createTemplate.mutateAsync({
        name,
        description: "",
        definition: promotion.definition,
        hierarchyProfile: normalizeHierarchyProfile(draftHierarchyProfile, promotion.definition),
      });
      toast.success(
        `Map template saved.${promotion.promoted > 0 ? ` ${promotion.promoted} artwork file${promotion.promoted === 1 ? " was" : "s were"} added to Global Gallery.` : ""}${promotion.reused > 0 ? ` ${promotion.reused} existing shared image${promotion.reused === 1 ? " was" : "s were"} reused.` : ""}${promotion.missing > 0 ? ` ${promotion.missing} missing artwork link${promotion.missing === 1 ? " was" : "s were"} omitted.` : ""}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The map template could not be saved.");
    }
  }, [
    chat?.name,
    confirmAction,
    createTemplate,
    draft,
    draftHierarchyProfile,
    galleryImages,
    globalGalleryImages,
    templateMode,
  ]);

  const saveAsSharedWorld = useCallback(async () => {
    if (
      templateMode ||
      !chatId ||
      !draft ||
      dirty ||
      draft.locations.length === 0 ||
      spatial.data?.sharedWorld.mode === "linked" ||
      createSharedWorld.isPending ||
      linkSharedWorld.isPending
    )
      return;
    const baseName = `${chat?.name?.trim() || "Untitled"} world`;
    const refreshedSharedWorlds = await sharedWorlds.refetch();
    if (refreshedSharedWorlds.isError) {
      toast.error("Shared worlds could not be checked. Try again before creating a new one.");
      return;
    }
    const name = nextAvailableSharedWorldName(
      baseName,
      (refreshedSharedWorlds.data ?? []).map((world) => world.name),
    );
    const nameCollision = name !== baseName;
    const confirmed = await confirmAction({
      title: "Create a shared world from this map?",
      message: nameCollision
        ? `A shared world named “${baseName}” already exists. Create a separate canonical world named “${name}” and link this chat to the new copy? Matching names are not treated as the same world.`
        : `Create “${name}” as one account-owned world and link this chat to it? The map structure and Global Gallery artwork can then be reused by other chats. This chat keeps its own current location and travel history.`,
      confirmLabel: "Create and link",
    });
    if (!confirmed) return;
    try {
      const canonicalDraft = canonicalizeSpatialDirectLinks(draft);
      const chatArtwork = galleryImages.data ?? (await galleryImages.refetch()).data ?? [];
      const globalArtwork = globalGalleryImages.data ?? (await globalGalleryImages.refetch()).data ?? [];
      const promotion = await promoteSpatialArtworkToGlobalGallery(canonicalDraft, chatArtwork, globalArtwork);
      if (promotion.promoted > 0) await globalGalleryImages.refetch();
      const created = await createSharedWorld.mutateAsync({
        name,
        description: "",
        definition: promotion.definition,
        hierarchyProfile: normalizeHierarchyProfile(draftHierarchyProfile, promotion.definition),
      });
      try {
        await linkSharedWorld.mutateAsync({
          chatId,
          worldId: created.id,
          expectedWorldRevision: created.revision,
          expectedRevision: draft.revision,
          expectedCurrentLocationId: currentLocationId,
        });
      } catch (error) {
        throw new Error(
          `${error instanceof Error ? error.message : "The chat could not be linked."} “${created.name}” was still saved in the world map library.`,
        );
      }
      toast.success(
        `Shared world created and linked.${promotion.promoted > 0 ? ` ${promotion.promoted} artwork file${promotion.promoted === 1 ? " was" : "s were"} added to Global Gallery.` : ""}${promotion.reused > 0 ? ` ${promotion.reused} existing shared image${promotion.reused === 1 ? " was" : "s were"} reused.` : ""}`,
      );
      const refreshed = await spatial.refetch();
      if (refreshed.data?.definition) {
        setBaseDefinition(cloneSpatialDefinition(refreshed.data.definition));
        setDraft(cloneSpatialDefinition(refreshed.data.definition));
        setBaseHierarchyProfile(refreshed.data.hierarchyProfile);
        setDraftHierarchyProfile(refreshed.data.hierarchyProfile);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The shared world could not be created.");
    }
  }, [
    chat?.name,
    chatId,
    confirmAction,
    createSharedWorld,
    currentLocationId,
    dirty,
    draft,
    draftHierarchyProfile,
    galleryImages,
    globalGalleryImages,
    linkSharedWorld,
    sharedWorlds,
    spatial,
    templateMode,
  ]);

  const publishLinkedChanges = useCallback(async () => {
    const sharedStatus = spatial.data?.sharedWorld;
    if (
      templateMode ||
      !chatId ||
      !draft ||
      dirty ||
      !sharedStatus?.pendingChanges ||
      !sharedStatus.worldRevision ||
      publishSharedWorld.isPending
    )
      return;
    if (sharedStatus.conflict) {
      toast.error("The shared world changed elsewhere. Fork or discard this chat's changes before publishing.");
      return;
    }
    const confirmed = await confirmAction({
      title: "Publish changes to the shared world?",
      message: `Publish this chat's reviewed map changes to “${sharedStatus.worldName ?? "the shared world"}”? Clean linked chats cached in this window will refresh automatically. Chats with unpublished drafts keep them and show a conflict; reopen other tabs or windows to refresh them. Referenced chat artwork will be promoted to Global Gallery first.`,
      confirmLabel: "Publish changes",
    });
    if (!confirmed) return;
    try {
      const canonicalDraft = canonicalizeSpatialDirectLinks(draft);
      const chatArtwork = galleryImages.data ?? (await galleryImages.refetch()).data ?? [];
      const globalArtwork = globalGalleryImages.data ?? (await globalGalleryImages.refetch()).data ?? [];
      const promotion = await promoteSpatialArtworkToGlobalGallery(canonicalDraft, chatArtwork, globalArtwork);
      if (promotion.promoted > 0) await globalGalleryImages.refetch();
      const result = await publishSharedWorld.mutateAsync({
        chatId,
        expectedWorldRevision: sharedStatus.worldRevision,
        definition: promotion.definition,
        hierarchyProfile: normalizeHierarchyProfile(draftHierarchyProfile, promotion.definition),
      });
      const saved = result.spatial.definition;
      if (!saved) throw new Error("The server did not return the published shared world.");
      setBaseDefinition(cloneSpatialDefinition(saved));
      setDraft(cloneSpatialDefinition(saved));
      setBaseHierarchyProfile(result.spatial.hierarchyProfile);
      setDraftHierarchyProfile(result.spatial.hierarchyProfile);
      setServerIssues(result.spatial.warnings);
      setSavedFlash(true);
      toast.success(
        `Canonical revision ${result.world.revision} saved for ${result.world.linkedChatCount} linked chat${result.world.linkedChatCount === 1 ? "" : "s"}. Cached chats in this window were refreshed; reopen other tabs or windows to load it.${promotion.promoted > 0 ? ` ${promotion.promoted} artwork file${promotion.promoted === 1 ? " was" : "s were"} added to Global Gallery.` : ""}${promotion.reused > 0 ? ` ${promotion.reused} shared image${promotion.reused === 1 ? " was" : "s were"} reused.` : ""}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The shared-world changes could not be published.");
      void spatial.refetch();
    }
  }, [
    chatId,
    confirmAction,
    dirty,
    draft,
    draftHierarchyProfile,
    galleryImages,
    globalGalleryImages,
    publishSharedWorld,
    spatial,
    templateMode,
  ]);

  const discardLinkedChanges = useCallback(async () => {
    const sharedStatus = spatial.data?.sharedWorld;
    if (templateMode || !chatId || !draft || dirty || !sharedStatus?.pendingChanges) return;
    const confirmed = await confirmAction({
      title: "Discard this chat's map changes?",
      message: `Return this chat to the current “${sharedStatus.worldName ?? "shared world"}” definition? Unpublished locations and map edits will be lost.`,
      confirmLabel: "Discard changes",
      tone: "destructive",
    });
    if (!confirmed) return;
    try {
      const response = await discardSharedWorldDraft.mutateAsync({
        chatId,
        expectedRevision: draft.revision,
        expectedCurrentLocationId: currentLocationId,
      });
      const saved = response.definition;
      if (!saved) throw new Error("The shared world is unavailable.");
      setBaseDefinition(cloneSpatialDefinition(saved));
      setDraft(cloneSpatialDefinition(saved));
      setBaseHierarchyProfile(response.hierarchyProfile);
      setDraftHierarchyProfile(response.hierarchyProfile);
      setServerIssues(response.warnings);
      toast.success("Unpublished map changes discarded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The changes could not be discarded.");
      void spatial.refetch();
    }
  }, [chatId, confirmAction, currentLocationId, dirty, discardSharedWorldDraft, draft, spatial, templateMode]);

  const forkLinkedWorld = useCallback(async () => {
    const sharedStatus = spatial.data?.sharedWorld;
    if (templateMode || !chatId || !draft || dirty || sharedStatus?.mode !== "linked") return;
    const confirmed = await confirmAction({
      title: "Detach from the shared world?",
      message: `Detach this chat from “${sharedStatus.worldName ?? "the shared world"}” and keep its current map as an independent copy? Future shared-world edits will no longer appear here.`,
      confirmLabel: "Detach and keep copy",
    });
    if (!confirmed) return;
    try {
      const response = await forkSharedWorld.mutateAsync({
        chatId,
        expectedRevision: draft.revision,
        expectedCurrentLocationId: currentLocationId,
      });
      const saved = response.definition;
      if (!saved) throw new Error("The independent map could not be created.");
      setBaseDefinition(cloneSpatialDefinition(saved));
      setDraft(cloneSpatialDefinition(saved));
      setBaseHierarchyProfile(response.hierarchyProfile);
      setDraftHierarchyProfile(response.hierarchyProfile);
      setServerIssues(response.warnings);
      toast.success("This chat now has an independent map copy.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The chat could not be detached from the shared world.");
      void spatial.refetch();
    }
  }, [chatId, confirmAction, currentLocationId, dirty, draft, forkSharedWorld, spatial, templateMode]);

  const handleOpenLorebook = useCallback(
    async (lorebookId: string) => {
      if (!onOpenLorebook) return;
      if (dirty) {
        const discard = await confirmAction({
          title: templateMode
            ? `Discard ${sharedWorldMode ? "shared-world" : "template"} changes?`
            : "Discard map changes?",
          message: templateMode
            ? `You have unsaved ${sharedWorldMode ? "shared-world" : "map template"} changes. Open the linked lorebook and discard them?`
            : "You have unsaved world map changes. Open the linked lorebook and discard them?",
          confirmLabel: "Discard changes",
          tone: "destructive",
        });
        if (!discard) return;
      }
      onClose();
      onOpenLorebook(lorebookId);
    },
    [confirmAction, dirty, onClose, onOpenLorebook, sharedWorldMode, templateMode],
  );

  const handleClose = useCallback(async () => {
    if (dirty) {
      const discard = await confirmAction({
        title: templateMode
          ? `Discard ${sharedWorldMode ? "shared-world" : "template"} changes?`
          : "Discard map changes?",
        message: templateMode
          ? `You have unsaved ${sharedWorldMode ? "shared-world" : "map template"} changes. Return to the library and discard them?`
          : "You have unsaved world map changes. Leave the editor and discard them?",
        confirmLabel: "Discard changes",
        tone: "destructive",
      });
      if (!discard) return;
    }
    onClose();
  }, [confirmAction, dirty, onClose, sharedWorldMode, templateMode]);

  const handleSave = useCallback(
    async (enableForFirstSave = false) => {
      if (!draft || !dirty || issues.length > 0) return;
      const canonicalDraft = canonicalizeSpatialDirectLinks(draft);
      if (templateMode && libraryRecord) {
        const name = templateName.trim();
        if (!name) {
          toast.error(`Give this ${sharedWorldMode ? "shared world" : "map template"} a name before saving.`);
          return;
        }
        setConflict(false);
        try {
          const input = {
            id: libraryRecord.id,
            expectedRevision: libraryRecord.revision,
            name,
            description: libraryRecord.description,
            definition: canonicalDraft,
            hierarchyProfile: normalizeHierarchyProfile(draftHierarchyProfile, canonicalDraft),
          };
          const saved = sharedWorldMode
            ? await updateSharedWorld.mutateAsync(input)
            : await updateTemplate.mutateAsync(input);
          const savedDefinition = cloneSpatialDefinition(saved.data.definition);
          const savedProfile = normalizeHierarchyProfile(saved.data.hierarchyProfile, savedDefinition);
          setBaseDefinition(savedDefinition);
          setDraft(cloneSpatialDefinition(savedDefinition));
          setBaseHierarchyProfile(savedProfile);
          setDraftHierarchyProfile(savedProfile);
          setTemplateName(saved.name);
          setBaseTemplateName(saved.name);
          setSavedFlash(true);
          onDirtyChange?.(false);
          toast.success(sharedWorldMode ? "Shared world updated for every linked chat." : "Map template saved.");
        } catch (error) {
          if (error instanceof Error && "status" in error && error.status === 409) setConflict(true);
          toast.error(
            error instanceof Error
              ? error.message
              : `The ${sharedWorldMode ? "shared world" : "map template"} could not be saved.`,
          );
        }
        return;
      }
      if (!chatId) return;
      const completingFirstMap = enableForFirstSave && baseDefinition === null;
      if (completingFirstMap && !canEnable) return;
      const definitionToSave = completingFirstMap ? { ...canonicalDraft, enabled: true } : canonicalDraft;
      setServerIssues([]);
      setConflict(false);
      setReviewConflict(false);
      try {
        const request = {
          chatId,
          expectedRevision: baseDefinition?.revision ?? 0,
          expectedCurrentLocationId: currentLocationId,
          ...(replacementCurrentLocationId ? { replacementCurrentLocationId } : {}),
          definition: {
            ...definitionToSave,
            ownerMode,
            revision: baseDefinition?.revision ?? 0,
          },
          hierarchyProfile: normalizeHierarchyProfile(draftHierarchyProfile, definitionToSave),
        };
        const response = startOverPending
          ? await startOverSpatial.mutateAsync({ ...request, breakHistoryContinuity: true })
          : await updateSpatial.mutateAsync(request);
        const saved = response.definition;
        if (!saved) throw new Error("The server did not return the saved map.");
        setBaseDefinition(cloneSpatialDefinition(saved));
        setDraft(cloneSpatialDefinition(saved));
        setBaseHierarchyProfile(response.hierarchyProfile);
        setDraftHierarchyProfile(response.hierarchyProfile);
        setServerIssues(response.warnings);
        if (replacementCurrentLocationId !== null) clearPendingSpatialTransition(chatId);
        setReplacementCurrentLocationId(null);
        setStartOverPending(false);
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
        toast.success(
          completingFirstMap
            ? "Map ready for turns."
            : startOverPending
              ? "New map saved. Historical map links may no longer resolve."
              : response.sharedWorld.pendingChanges
                ? "Map saved for this chat. Review it, then publish or fork it."
                : "World map saved.",
        );
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
    },
    [
      baseDefinition,
      canEnable,
      chatId,
      currentLocationId,
      dirty,
      draft,
      draftHierarchyProfile,
      issues.length,
      libraryRecord,
      ownerMode,
      replacementCurrentLocationId,
      startOverPending,
      startOverSpatial,
      onDirtyChange,
      sharedWorldMode,
      spatial,
      templateMode,
      templateName,
      updateSharedWorld,
      updateSpatial,
      updateTemplate,
    ],
  );

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
    setAiBuilderStartOver(false);
    setStartOverPending(false);
    setFirstSaveResult(null);
    setFirstMapGenerationSession(null);
  }, [ownerMode, spatial]);

  const applyGeneratedDraft = useCallback(
    (session: SpatialMapAiBuilderSession) => {
      if (!draft) return;
      const generated = session.result.definition;
      const parsedGenerated = spatialContextDefinitionSchema.safeParse(generated);
      if (!parsedGenerated.success) {
        toast.error(parsedGenerated.error.issues[0]?.message ?? "The AI draft was not a valid world map.");
        return;
      }
      const normalizedGenerated = parsedGenerated.data;
      const applyingStartOver = aiBuilderStartOver;
      const previousIds = new Set(applyingStartOver ? [] : draft.locations.map((location) => location.id));
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
        applyingStartOver
          ? next.startingLocationId
          : currentLocationId && !next.locations.some((location) => location.id === currentLocationId)
            ? next.startingLocationId
            : null,
      );
      if (applyingStartOver) setStartOverPending(true);
      setAiBuilderStartOver(false);
      onClearPendingDraftReview?.();
      if (baseDefinition === null && session.result.operation !== "expand") {
        setFirstMapGenerationSession(session);
      }
      setAiBuilderOpen(false);
      toast.success(
        templateMode
          ? "AI map draft applied. Review it, choose a start, then save the template."
          : expandedExistingMap
            ? "AI expansion added to the working map. Review it, then Save."
            : "AI map draft applied. Review it, choose a start, then enable and save.",
      );
    },
    [
      applyDraft,
      aiBuilderStartOver,
      baseDefinition,
      currentLocationId,
      draft,
      draftHierarchyProfile,
      onClearPendingDraftReview,
      ownerMode,
      templateMode,
    ],
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
    setAiBuilderStartOver(false);
  }, [onClearPendingDraftReview, onClose, pendingSetupReview]);

  if (!spatial.isError && (spatial.isLoading || !initialized || !draft)) {
    return (
      <div className="mari-editor-shell flex flex-1 flex-col overflow-hidden" aria-label="Loading world map editor">
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

  if (!templateMode && spatial.isError) {
    return (
      <div
        className="mari-editor-shell flex flex-1 items-center justify-center p-6"
        role="region"
        aria-label="World map recovery"
      >
        <div className="max-w-sm text-center">
          <AlertCircle className="mx-auto text-[var(--destructive)]" />
          <h1 className="mt-3 text-base font-semibold">World map unavailable</h1>
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
    pending: spatialUpdatePending || updateTemplate.isPending || updateSharedWorld.isPending,
    savedFlash,
  });
  const saveLabel = sharedWorldMode
    ? "Update shared world"
    : templateMode
      ? "Save template"
      : isFirstMapDraft
        ? "Enable and save map"
        : "Save";
  const localChildren = sortedChildren(draft, enteredParentId);
  const localMapBackgroundPosition = currentContext?.mapBackgroundPosition ?? {
    x: 50,
    y: 50,
  };
  const localBreadcrumb = resolveSpatialBreadcrumb(draft, enteredParentId);
  const conflictDifference = compareSpatialDefinitions(spatial.data?.definition ?? null, draft);
  const archiveRequest = draft.locations.find((location) => location.id === archiveRequestId) ?? null;
  const archiveReplacementChoices = activeLocations.filter((location) => location.id !== archiveRequestId);
  const currentLocationName =
    draft.locations.find((location) => location.id === effectiveCurrentLocationId)?.name ?? "Not set";

  const localView = (
    <section className="flex h-full min-h-0 flex-col" aria-label="Local location view">
      <div className="border-b border-[var(--marinara-chat-chrome-panel-divider)] px-4 py-3">
        <div className="flex items-center gap-2">
          {currentContext && (
            <button
              type="button"
              onClick={() => {
                setLayoutEditingMode(null);
                setEnteredParentId(currentContext.parentId);
              }}
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
                onClick={() => {
                  setLayoutEditingMode(null);
                  setEnteredParentId(null);
                }}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md px-1 hover:text-[var(--marinara-chat-chrome-button-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
              >
                World
              </button>
              {localBreadcrumb.map((location) => (
                <span key={location.id} className="flex min-w-0 items-center gap-1 self-stretch">
                  <ChevronRight size="0.625rem" className="shrink-0" />
                  <button
                    type="button"
                    onClick={() => {
                      setLayoutEditingMode(null);
                      setEnteredParentId(location.id);
                    }}
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
            {localPresentation === "map" ? <MapIcon size="0.6875rem" /> : <List size="0.6875rem" />}
            {localPresentation}
          </span>
        </div>
        {localPresentation === "map" && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={draftHierarchyProfile.showConnections}
              onClick={() =>
                applyHierarchyProfile({
                  ...draftHierarchyProfile,
                  showConnections: !draftHierarchyProfile.showConnections,
                })
              }
              className={cn(
                "mari-chrome-control min-h-11 flex-1 justify-center px-3 text-xs sm:flex-none",
                draftHierarchyProfile.showConnections &&
                  "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]",
              )}
            >
              <Link2 size="0.75rem" />
              {draftHierarchyProfile.showConnections ? "Hide connections" : "Show connections"}
            </button>
            <button
              type="button"
              aria-pressed={effectiveLayoutEditingMode === "places"}
              onClick={() => setLayoutEditingMode((value) => (value === "places" ? null : "places"))}
              className={cn(
                "mari-chrome-control min-h-11 flex-1 justify-center px-3 text-xs sm:flex-none",
                effectiveLayoutEditingMode === "places" &&
                  "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]",
              )}
            >
              <Move size="0.75rem" /> {effectiveLayoutEditingMode === "places" ? "Done arranging" : "Arrange map"}
            </button>
            {localMapBackgroundImageUrl && (
              <button
                type="button"
                aria-pressed={effectiveLayoutEditingMode === "background"}
                onClick={() => setLayoutEditingMode((value) => (value === "background" ? null : "background"))}
                className={cn(
                  "mari-chrome-control min-h-11 flex-1 justify-center px-3 text-xs sm:flex-none",
                  effectiveLayoutEditingMode === "background" &&
                    "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]",
                )}
              >
                <ImageIcon size="0.75rem" />
                {effectiveLayoutEditingMode === "background" ? "Done repositioning" : "Reposition background"}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {localPresentation === "map" ? (
          <LocalMapCanvas
            locations={localChildren}
            selectedId={selectedId}
            onSelect={(locationId) => selectLocation(locationId, effectiveLayoutEditingMode === null)}
            onEnter={enterLocation}
            backgroundImageUrl={localMapBackgroundImageUrl}
            backgroundPosition={localMapBackgroundPosition}
            backgroundEditing={effectiveLayoutEditingMode === "background"}
            onBackgroundMove={queueBackgroundMove}
            hierarchyProfile={draftHierarchyProfile}
            editing={effectiveLayoutEditingMode === "places"}
            onMove={(locationId, placement) => applyDraft(updateSpatialLocation(draft, locationId, { placement }))}
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
                  <SpatialLocationIcon icon={location.icon} className="text-lg" />
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
      chatId={chatId ?? ""}
      artworkEnabled
      allowChatArtwork={!templateMode}
      debugMode={debugMode}
      definition={draft}
      location={selected}
      issues={issues.filter((issue) => issue.locationId === selected?.id)}
      currentLocationId={effectiveCurrentLocationId}
      hierarchyProfile={draftHierarchyProfile}
      onHierarchyTypeChange={(typeId) => {
        if (!selected) return;
        const type = draftHierarchyProfile.types.find((candidate) => candidate.id === typeId);
        if (!type) return;
        applyDraft(updateSpatialLocation(draft, selected.id, { kind: type.baseKind }));
        applyHierarchyProfile(withLocationHierarchyType(draftHierarchyProfile, selected.id, typeId));
      }}
      onHierarchyProfileChange={applyHierarchyProfile}
      onUpdate={(patch) => selected && applyDraft(updateSpatialLocation(draft, selected.id, patch))}
      onUpdateDirectLink={(firstLocationId, secondLocationId, patch) =>
        applyDraft(updateSpatialDirectLink(draft, firstLocationId, secondLocationId, patch))
      }
      onSetDirectLinkDirection={(relatedLocationId, direction) =>
        selected && applyDraft(setSpatialDirectLinkDirection(draft, selected.id, relatedLocationId, direction))
      }
      onRemoveDirectLink={(firstLocationId, secondLocationId) =>
        applyDraft(removeSpatialDirectLink(draft, firstLocationId, secondLocationId))
      }
      onSelectLocation={selectLocation}
      lorebooks={lorebooks}
      lorebookEntries={lorebookEntriesQuery.entries ?? []}
      excludedLorebookIds={excludedLorebookIds}
      lorebooksLoading={lorebookEntriesQuery.isLoading}
      onOpenLorebook={onOpenLorebook ? (lorebookId) => void handleOpenLorebook(lorebookId) : undefined}
      onReparent={(parentId) => selected && applyDraft(reparentSpatialLocation(draft, selected.id, parentId))}
      onSetStarting={() => selected && applyDraft({ ...draft, startingLocationId: selected.id })}
      onSetCurrent={
        !templateMode && selected
          ? () => {
              const location = selected;
              void confirmAction({
                title: "Set current story location?",
                message: `Correct this chat's current location to ${location.name || "this location"}? This is an administrative correction, not narrated travel. It takes effect when you click Save, clears any queued destination or route, and does not rewrite earlier messages.`,
                confirmLabel: "Set current location",
              }).then((confirmed) => {
                if (!confirmed) return;
                setReplacementCurrentLocationId(location.id);
                toast.success("Current story location staged. Click Save to apply it.");
              });
            }
          : undefined
      }
      onArchive={() => selected && requestArchive(selected.id)}
      onDeletePermanently={
        !templateMode && selected?.status === "archived" ? () => void deleteArchivedLocation() : undefined
      }
      permanentDeleteProtection={archivedDeletion?.protection}
      permanentDeleteCount={archivedDeletion?.count}
      gameBinding={
        !templateMode && ownerMode === "game" && chatId
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

      {pendingPortableLoreImport && (
        <PortableLoreImportDialog
          bundle={pendingPortableLoreImport.bundle}
          plan={pendingPortableLoreImport.plan}
          busy={isImporting}
          onCancel={() => setPendingPortableLoreImport(null)}
          onImport={(strategy, selections) => void confirmPortableLoreImport(strategy, selections)}
        />
      )}

      {exportDialogOpen && portableExportBundle && (
        <div
          ref={exportDialogRef}
          data-chat-floating-panel
          role="dialog"
          aria-modal="true"
          aria-label="Export portable world map"
          className="fixed inset-0 flex items-center justify-center bg-[var(--background)]/90 p-3 sm:p-4"
          style={{ zIndex: 105 }}
        >
          <div className="flex max-h-[min(90vh,48rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] shadow-2xl">
            <div className="flex min-h-12 items-center gap-3 border-b border-[var(--marinara-chat-chrome-panel-divider)] px-4 py-3">
              <Upload size="0.9375rem" className="text-[var(--marinara-chat-chrome-accent)]" />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                  Export portable world map
                </h2>
                <p className="text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                  Choose how much linked lore travels with this map.
                </p>
              </div>
              <button
                ref={exportCloseRef}
                type="button"
                onClick={() => {
                  setExportMappingOpen(false);
                  setExportDialogOpen(false);
                }}
                disabled={isExporting}
                className="mari-chrome-control h-11 w-11 shrink-0 justify-center p-0 disabled:opacity-45"
                aria-label="Cancel map export"
              >
                <X size="0.875rem" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                  Lore to include
                </legend>
                {(
                  [
                    [
                      "map-only",
                      "Map only",
                      "Keep readable lore-link provenance, but do not include lorebook content.",
                    ],
                    [
                      "linked-entries",
                      "Map + linked entries",
                      "Recommended. Include only entries this map links to and their folder paths.",
                    ],
                    [
                      "complete-lorebooks",
                      "Map + complete lorebooks",
                      "Include every entry and folder from each linked lorebook.",
                    ],
                  ] as const
                ).map(([mode, title, description]) => (
                  <label
                    key={mode}
                    className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-3"
                  >
                    <input
                      type="radio"
                      name="portable-lore-export-mode"
                      value={mode}
                      checked={exportLoreMode === mode}
                      onChange={() => setExportLoreMode(mode)}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                        {title}
                      </span>
                      <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
                        {description}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
              {exportLoreMode === "complete-lorebooks" && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  <AlertCircle size="0.875rem" className="mt-0.5 shrink-0" />
                  <p>
                    Complete lorebooks may contain private notes unrelated to this map. Review the file before sharing
                    it.
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                    {portableExportBundle.books.length} lorebook
                    {portableExportBundle.books.length === 1 ? "" : "s"} · {portableExportEntryCount}{" "}
                    {portableExportEntryCount === 1 ? "entry" : "entries"}
                  </span>
                  <span className="text-[var(--marinara-chat-chrome-panel-muted)]">
                    About {portableExportKilobytes} KB
                  </span>
                </div>
                {portableExportBundle.books.length > 0 && (
                  <ul className="mt-2 space-y-1 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                    {portableExportBundle.books.map((book) => (
                      <li key={book.key} className="flex justify-between gap-3">
                        <span className="truncate" title={book.name}>
                          {book.name}
                        </span>
                        <span className="shrink-0">{book.entries.length} entries</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] px-3 text-xs">
                <span>
                  <span className="block font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                    Include map artwork
                  </span>
                  <span className="text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                    Makes the export file larger.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={includeArtworkInExport}
                  disabled={isExporting}
                  onChange={(event) => setIncludeArtworkInExport(event.target.checked)}
                />
              </label>
              <details
                onToggle={(event) => setExportMappingOpen(event.currentTarget.open)}
                className="rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] p-3"
              >
                <summary className="cursor-pointer text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                  Inspect location-to-lore mapping ({portableExportBundle.references.length})
                </summary>
                {exportMappingOpen && (
                  <div className="mt-3 max-h-44 space-y-1 overflow-y-auto font-mono text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                    {portableExportBundle.references.map((reference, index) => (
                      <p key={`${reference.locationId}-${reference.originalEntryId}-${index}`}>
                        {reference.locationName} → {reference.originalLorebookName} → {reference.originalEntryName} →{" "}
                        {reference.originalEntryId}
                      </p>
                    ))}
                  </div>
                )}
              </details>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-[var(--marinara-chat-chrome-panel-divider)] p-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setExportMappingOpen(false);
                  setExportDialogOpen(false);
                }}
                disabled={isExporting}
                className="mari-chrome-control min-h-11 justify-center px-4 text-xs disabled:opacity-45"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={isExporting}
                className="mari-chrome-control mari-chrome-control--primary min-h-11 justify-center px-4 text-xs disabled:opacity-45"
              >
                {isExporting ? <Loader2 size="0.75rem" className="animate-spin" /> : <Download size="0.75rem" />}
                Download export
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mari-editor-header relative z-50">
        <button
          type="button"
          data-marinara-map-header-back
          onClick={() => void handleClose()}
          aria-label={templateMode ? "Back to map library" : "Back to chat"}
          className="mari-editor-action inline-flex min-h-11 min-w-11"
        >
          <ArrowLeft size="1.125rem" />
        </button>
        <div data-marinara-map-header-icon className="mari-editor-icon-tile">
          <MapIcon size="1.125rem" />
        </div>
        <div data-marinara-map-header-title className="min-w-0 flex-1">
          {templateMode ? (
            <label className="block max-w-md">
              <span className="sr-only">{sharedWorldMode ? "Shared world name" : "Map template name"}</span>
              <input
                aria-label={sharedWorldMode ? "Shared world name" : "Map template name"}
                value={templateName}
                maxLength={120}
                onChange={(event) => setTemplateName(event.target.value)}
                className="w-full border-0 bg-transparent p-0 text-sm font-semibold text-[var(--marinara-editor-title)] outline-none placeholder:text-[var(--marinara-editor-muted)]"
                placeholder="Untitled map"
              />
              <span className="block truncate text-[0.625rem] text-[var(--marinara-editor-muted)]">
                {sharedWorldMode
                  ? `Canonical shared world · ${sharedWorld?.linkedChatCount ?? 0} linked chat${sharedWorld?.linkedChatCount === 1 ? "" : "s"}`
                  : "Reusable map template · no chat history"}
              </span>
            </label>
          ) : (
            <>
              <h1 className="truncate text-sm font-semibold text-[var(--marinara-editor-title)]">World map</h1>
              <p
                className="truncate text-[0.625rem] text-[var(--marinara-editor-muted)]"
                title={
                  linkedSharedWorld
                    ? `${chat?.name ?? "Chat"} · Linked to ${linkedSharedWorld.worldName ?? "shared world"}`
                    : `${chat?.name ?? "Chat"} · Independent chat map`
                }
              >
                {linkedSharedWorld
                  ? `${chat?.name ?? "Chat"} · Linked to ${linkedSharedWorld.worldName ?? "shared world"}`
                  : `${chat?.name ?? "Chat"} · Independent chat map`}
              </p>
            </>
          )}
        </div>
        <div
          data-marinara-map-header-actions
          className="mari-editor-actions flex max-md:w-full max-md:justify-between max-md:border-t max-md:border-[var(--marinara-editor-divider)] max-md:pt-2"
        >
          <div className="hidden items-center gap-1.5 lg:flex">
            {!templateMode && missingArtworkLocations.length > 0 && !artworkPreview && (
              <button
                type="button"
                data-marinara-fill-map-artwork
                onClick={() => void prepareArtworkPreview()}
                disabled={artworkActionsDisabled}
                className="mari-editor-action inline-flex min-h-11 px-3 text-xs disabled:opacity-45"
                aria-label={`Review artwork for ${missingArtworkLocations.length} ${missingArtworkLocations.length === 1 ? "location" : "locations"}`}
                title={`${missingArtworkLocations.length} ${missingArtworkLocations.length === 1 ? "location needs" : "locations need"} artwork`}
              >
                {artworkProgress || previewGalleryImages.isPending ? (
                  <Loader2 size="0.8125rem" className="animate-spin" />
                ) : (
                  <ImageIcon size="0.8125rem" />
                )}
                {missingArtworkLocations.length} incomplete location
                {missingArtworkLocations.length === 1 ? "" : "s"}
              </button>
            )}
            {linkedSharedWorld && (
              <>
                <span
                  role={linkedSharedWorld.missing || linkedSharedWorld.conflict ? "alert" : "status"}
                  className={cn(
                    "mari-editor-action inline-flex min-h-11 max-w-44 px-3 text-xs",
                    linkedSharedWorld.missing || linkedSharedWorld.conflict
                      ? "border-red-500/30 bg-red-500/10 text-[var(--destructive)]"
                      : linkedSharedWorld.pendingChanges
                        ? "border-amber-500/30 bg-amber-500/10"
                        : "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]",
                  )}
                  title={
                    linkedSharedWorld.missing
                      ? "The account-owned world is unavailable."
                      : linkedSharedWorld.conflict
                        ? "The canonical world changed after this chat began editing."
                        : linkedSharedWorld.pendingChanges
                          ? "This chat has unpublished shared-world changes."
                          : `Revision ${linkedSharedWorld.worldRevision ?? "?"} · ${linkedSharedWorld.linkedChatCount} linked chat${linkedSharedWorld.linkedChatCount === 1 ? "" : "s"}`
                  }
                >
                  <Link2 size="0.8125rem" className="shrink-0" />
                  <span className="truncate">
                    {linkedSharedWorld.missing
                      ? "Shared unavailable"
                      : linkedSharedWorld.conflict
                        ? "Shared conflict"
                        : linkedSharedWorld.pendingChanges
                          ? "Shared changes"
                          : (linkedSharedWorld.worldName ?? "Shared world")}
                  </span>
                </span>
                {linkedSharedWorld.pendingChanges && !linkedSharedWorld.conflict && (
                  <button
                    type="button"
                    onClick={() => void publishLinkedChanges()}
                    disabled={dirty || publishSharedWorld.isPending}
                    className="mari-editor-action mari-editor-action--primary inline-flex min-h-11 px-3 text-xs disabled:opacity-45"
                  >
                    {publishSharedWorld.isPending ? (
                      <Loader2 size="0.75rem" className="animate-spin" />
                    ) : (
                      <Upload size="0.75rem" />
                    )}
                    Publish
                  </button>
                )}
                {linkedSharedWorld.pendingChanges && (
                  <button
                    type="button"
                    onClick={() => void discardLinkedChanges()}
                    disabled={dirty || discardSharedWorldDraft.isPending}
                    className="mari-editor-action inline-flex min-h-11 px-3 text-xs disabled:opacity-45"
                  >
                    Discard
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void forkLinkedWorld()}
                  disabled={dirty || forkSharedWorld.isPending || linkedSharedWorld.missing}
                  className="mari-editor-action inline-flex min-h-11 px-3 text-xs disabled:opacity-45"
                >
                  <GitFork size="0.75rem" /> Detach and keep copy
                </button>
                <a
                  href={`${WORLD_MAPS_GUIDE_URL}#link-chats-to-one-shared-world`}
                  target="_blank"
                  rel="noreferrer"
                  className="mari-editor-action inline-flex min-h-11 px-3 text-xs"
                  title="Open shared-world guide"
                >
                  <CircleHelp size="0.75rem" /> Guide
                </a>
              </>
            )}
            {!templateMode && (
              <button
                type="button"
                onClick={() => {
                  void spatial.refetch();
                  setAiBuilderOpen(true);
                }}
                disabled={aiBuilderOpen || conflict || spatialUpdatePending}
                className="mari-editor-action inline-flex min-h-11 px-3 text-xs disabled:opacity-45"
              >
                <Sparkles size="0.8125rem" />{" "}
                {firstMapGenerationSession
                  ? "Regenerate with AI"
                  : draft.locations.length > 0
                    ? "Expand with AI"
                    : "Build with AI"}
              </button>
            )}
          </div>
          <div data-marinara-map-more-control className="shrink-0">
            <button
              type="button"
              onClick={() => setMobileActionsOpen((open) => !open)}
              className={cn(
                "mari-editor-action inline-flex min-h-11 px-3 text-xs",
                mobileActionsOpen && "mari-editor-action--accent",
              )}
              aria-expanded={mobileActionsOpen}
              aria-controls="hierarchical-map-mobile-actions"
              aria-label={`${mobileActionsOpen ? "Close map actions" : "More map actions"}${
                mobileMapNoticeCount > 0
                  ? `, ${mobileMapNoticeCount} ${mobileMapNoticeCount === 1 ? "notice" : "notices"}`
                  : ""
              }`}
            >
              <MoreHorizontal size="0.8125rem" />
              <span data-marinara-map-more-label>More</span>
              {mobileMapNoticeCount > 0 && (
                <span
                  data-marinara-map-notice-count
                  aria-hidden="true"
                  className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--destructive)] px-1 text-[0.625rem] font-bold leading-none text-white lg:hidden"
                >
                  {mobileMapNoticeCount}
                </span>
              )}
              <ChevronDown
                data-marinara-map-more-chevron
                size="0.75rem"
                className={cn("transition-transform duration-150", mobileActionsOpen && "rotate-180")}
              />
            </button>
          </div>
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
          <span
            data-marinara-map-header-status
            title={status.label}
            className={cn(
              "mari-editor-status mr-2",
              "max-md:mr-0 max-md:min-w-0 max-md:flex-1 max-md:justify-end max-md:overflow-hidden max-md:whitespace-nowrap",
              status.className,
            )}
          >
            {status.icon}
            <span data-marinara-map-status-label>{status.label}</span>
          </span>
          {!templateMode && !isFirstMapDraft && (
            <div data-marinara-map-wide-only className="hidden lg:block">
              <label className="mari-editor-action inline-flex min-h-11 cursor-pointer gap-2 px-3 text-xs">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  disabled={!canEnable && !draft.enabled}
                  onChange={(event) => applyDraft({ ...draft, enabled: event.target.checked })}
                />
                <span>{draft.enabled ? "Enabled" : "Disabled"}</span>
              </label>
            </div>
          )}
          <button
            type="button"
            data-marinara-map-header-save
            onClick={() => {
              setMobileActionsOpen(false);
              void handleSave(isFirstMapDraft);
            }}
            disabled={
              !dirty ||
              issues.length > 0 ||
              spatialUpdatePending ||
              updateTemplate.isPending ||
              updateSharedWorld.isPending ||
              conflict ||
              (!templateMode && isFirstMapDraft && !canEnable)
            }
            className="mari-editor-action mari-editor-action--primary inline-flex min-h-11 shrink-0 disabled:opacity-45"
            aria-label={saveLabel}
          >
            <Save size="0.8125rem" />
            <span data-marinara-map-save-label className="lg:hidden">
              {isFirstMapDraft ? "Enable & save" : "Save"}
            </span>
            <span className="hidden lg:inline">{saveLabel}</span>
          </button>
        </div>
      </div>

      {mobileActionsOpen && (
        <section
          id="hierarchical-map-mobile-actions"
          data-marinara-map-mobile-actions
          role="region"
          aria-label="Map actions"
          className="relative z-40 border-b border-[var(--marinara-editor-divider)] bg-[var(--marinara-editor-surface)] p-3"
        >
          <div className="grid grid-cols-2 gap-2">
            {!templateMode && missingArtworkLocations.length > 0 && !artworkPreview && (
              <button
                type="button"
                data-marinara-fill-map-artwork
                data-marinara-map-compact-only
                onClick={() => {
                  setMobileActionsOpen(false);
                  void prepareArtworkPreview();
                }}
                disabled={artworkActionsDisabled}
                className="mari-editor-action col-span-2 inline-flex min-h-11 w-full justify-between px-3 text-xs disabled:opacity-45"
                aria-label={`Review artwork for ${missingArtworkLocations.length} ${missingArtworkLocations.length === 1 ? "location" : "locations"}`}
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  {artworkProgress || previewGalleryImages.isPending ? (
                    <Loader2 size="0.8125rem" className="shrink-0 animate-spin" />
                  ) : (
                    <ImageIcon size="0.8125rem" className="shrink-0" />
                  )}
                  <span className="truncate">
                    {missingArtworkLocations.length} incomplete location
                    {missingArtworkLocations.length === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-[var(--marinara-chat-chrome-accent)]">Review</span>
              </button>
            )}
            {linkedSharedWorld && (
              <div
                data-marinara-mobile-shared-world-status
                data-marinara-map-compact-only
                role={linkedSharedWorld.missing || linkedSharedWorld.conflict ? "alert" : "status"}
                className={cn(
                  "col-span-2 flex min-h-11 min-w-0 items-center gap-2 rounded-lg border px-3 text-xs",
                  linkedSharedWorld.missing || linkedSharedWorld.conflict
                    ? "border-red-500/25 bg-red-500/10 text-[var(--destructive)]"
                    : linkedSharedWorld.pendingChanges
                      ? "border-amber-500/25 bg-amber-500/10 text-[var(--marinara-editor-title)]"
                      : "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-editor-title)]",
                )}
                title={
                  linkedSharedWorld.missing
                    ? "The account-owned world is unavailable."
                    : linkedSharedWorld.conflict
                      ? "The canonical world changed after this chat began editing."
                      : linkedSharedWorld.pendingChanges
                        ? "This chat has unpublished shared-world changes."
                        : `Revision ${linkedSharedWorld.worldRevision ?? "?"} · ${linkedSharedWorld.linkedChatCount} linked chat${linkedSharedWorld.linkedChatCount === 1 ? "" : "s"}`
                }
              >
                <Link2 size="0.8125rem" className="shrink-0" />
                <span className="truncate font-semibold">
                  {linkedSharedWorld.missing
                    ? "Shared world unavailable"
                    : linkedSharedWorld.conflict
                      ? "Shared world conflict"
                      : linkedSharedWorld.pendingChanges
                        ? "Unpublished shared changes"
                        : `Linked to ${linkedSharedWorld.worldName ?? "shared world"}`}
                </span>
              </div>
            )}
            {linkedSharedWorld?.pendingChanges && !linkedSharedWorld.conflict && (
              <button
                type="button"
                data-marinara-map-compact-only
                onClick={() => {
                  setMobileActionsOpen(false);
                  void publishLinkedChanges();
                }}
                disabled={dirty || publishSharedWorld.isPending}
                className="mari-editor-action mari-editor-action--primary inline-flex min-h-11 w-full justify-center px-3 text-xs disabled:opacity-45"
              >
                {publishSharedWorld.isPending ? (
                  <Loader2 size="0.75rem" className="animate-spin" />
                ) : (
                  <Upload size="0.75rem" />
                )}
                Publish changes
              </button>
            )}
            {linkedSharedWorld?.pendingChanges && (
              <button
                type="button"
                data-marinara-map-compact-only
                onClick={() => {
                  setMobileActionsOpen(false);
                  void discardLinkedChanges();
                }}
                disabled={dirty || discardSharedWorldDraft.isPending}
                className="mari-editor-action inline-flex min-h-11 w-full justify-center px-3 text-xs disabled:opacity-45"
              >
                Discard
              </button>
            )}
            {linkedSharedWorld && (
              <button
                type="button"
                data-marinara-map-compact-only
                onClick={() => {
                  setMobileActionsOpen(false);
                  void forkLinkedWorld();
                }}
                disabled={dirty || forkSharedWorld.isPending || linkedSharedWorld.missing}
                className="mari-editor-action col-span-2 inline-flex min-h-11 w-full justify-center px-3 text-xs disabled:opacity-45"
              >
                <GitFork size="0.75rem" /> Detach and keep copy
              </button>
            )}
            {!templateMode && (
              <button
                type="button"
                data-marinara-map-compact-only
                onClick={() => {
                  setMobileActionsOpen(false);
                  void spatial.refetch();
                  setAiBuilderOpen(true);
                }}
                disabled={aiBuilderOpen || conflict || spatialUpdatePending}
                className="mari-editor-action col-span-2 inline-flex min-h-11 w-full justify-center px-3 text-xs disabled:opacity-45"
              >
                <Sparkles size="0.8125rem" />{" "}
                {firstMapGenerationSession
                  ? "Regenerate with AI"
                  : draft.locations.length > 0
                    ? "Expand with AI"
                    : "Build with AI"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMobileActionsOpen(false);
                void openExportDialog();
              }}
              disabled={isExporting}
              className="mari-editor-action inline-flex min-h-11 w-full justify-center px-3 text-xs disabled:opacity-45"
              aria-label="Export world map"
            >
              {isExporting ? <Loader2 size="0.8125rem" className="animate-spin" /> : <Upload size="0.8125rem" />} Export
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileActionsOpen(false);
                pendingStartOverImportRef.current = false;
                setStartOverPending(false);
                importInputRef.current?.click();
              }}
              disabled={conflict || spatialUpdatePending || isImporting}
              className="mari-editor-action inline-flex min-h-11 w-full justify-center px-3 text-xs disabled:opacity-45"
              aria-label="Import world map"
            >
              {isImporting ? <Loader2 size="0.8125rem" className="animate-spin" /> : <Download size="0.8125rem" />}{" "}
              Import
            </button>
            {!templateMode && onOpenTemplates && (
              <button
                type="button"
                onClick={() => {
                  setMobileActionsOpen(false);
                  onOpenTemplates();
                }}
                disabled={conflict || spatialUpdatePending}
                className="mari-editor-action inline-flex min-h-11 w-full justify-center px-3 text-xs disabled:opacity-45"
                aria-label="Open shared worlds and map templates"
              >
                <MapIcon size="0.8125rem" /> World library
              </button>
            )}
            {!templateMode && draft.locations.length > 0 && (
              <button
                type="button"
                onClick={() => void saveAsTemplate()}
                disabled={createTemplate.isPending}
                className="mari-editor-action inline-flex min-h-11 w-full justify-center px-3 text-xs disabled:opacity-45"
              >
                <Save size="0.8125rem" /> {createTemplate.isPending ? "Saving template" : "Save as template"}
              </button>
            )}
            {!templateMode && spatial.data?.sharedWorld.mode !== "linked" && draft.locations.length > 0 && (
              <button
                type="button"
                onClick={() => void saveAsSharedWorld()}
                disabled={dirty || createSharedWorld.isPending || linkSharedWorld.isPending}
                title={dirty ? "Save this chat's map before creating a shared world." : undefined}
                className="mari-editor-action inline-flex min-h-11 w-full justify-center px-3 text-xs disabled:opacity-45"
              >
                <Link2 size="0.8125rem" />{" "}
                {createSharedWorld.isPending || linkSharedWorld.isPending ? "Creating shared world" : "Make shared"}
              </button>
            )}
            {!templateMode && !isFirstMapDraft && (
              <label
                data-marinara-map-mid-overflow
                className="mari-editor-action col-span-2 inline-flex min-h-11 w-full cursor-pointer justify-between gap-2 px-3 text-xs"
              >
                <span>{draft.enabled ? "Map enabled" : "Map disabled"}</span>
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  disabled={!canEnable && !draft.enabled}
                  onChange={(event) => applyDraft({ ...draft, enabled: event.target.checked })}
                />
              </label>
            )}
            {!templateMode && baseDefinition && baseDefinition.locations.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMobileActionsOpen(false);
                  setReplaceMapOpen(true);
                }}
                disabled={aiBuilderOpen || conflict || spatialUpdatePending}
                className="mari-editor-action col-span-2 inline-flex min-h-11 w-full justify-center px-3 text-xs text-[var(--destructive)] disabled:opacity-45"
                aria-label="Replace map or start over"
                aria-expanded={replaceMapOpen}
                aria-controls="hierarchical-map-replace-panel"
              >
                <RefreshCw size="0.8125rem" /> Replace / start over
              </button>
            )}
          </div>
        </section>
      )}

      {!templateMode && replaceMapOpen && baseDefinition && baseDefinition.locations.length > 0 && (
        <section
          id="hierarchical-map-replace-panel"
          data-marinara-map-replace-panel
          aria-labelledby="hierarchical-map-replace-title"
          className="border-b border-[var(--marinara-editor-divider)] bg-[var(--marinara-editor-surface)] px-4 py-4"
        >
          <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,1.2fr)]">
            <div>
              <div className="flex items-start gap-3">
                <RefreshCw size="1rem" className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
                <div className="min-w-0 flex-1">
                  <h2
                    id="hierarchical-map-replace-title"
                    className="text-sm font-semibold text-[var(--marinara-chat-chrome-panel-title)]"
                  >
                    Replace the current map
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
                    Preserve a reusable copy or export a backup first. A blank or AI-generated replacement remains a
                    working copy until you click Save.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplaceMapOpen(false)}
                  className="mari-chrome-control h-11 w-11 shrink-0 justify-center p-0"
                  aria-label="Close replace map options"
                >
                  <X size="0.875rem" />
                </button>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] p-3">
                  <dt className="text-[0.625rem] uppercase tracking-[0.1em] text-[var(--marinara-chat-chrome-panel-muted)]">
                    Current map
                  </dt>
                  <dd className="mt-1 font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                    {baseDefinition.locations.length} {baseDefinition.locations.length === 1 ? "location" : "locations"}
                  </dd>
                </div>
                <div className="rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] p-3">
                  <dt className="text-[0.625rem] uppercase tracking-[0.1em] text-[var(--marinara-chat-chrome-panel-muted)]">
                    Story location
                  </dt>
                  <dd
                    className="mt-1 truncate font-semibold text-[var(--marinara-chat-chrome-panel-title)]"
                    title={currentLocationName}
                  >
                    {currentLocationName}
                  </dd>
                </div>
              </dl>
              {pendingTransition && (
                <p className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[0.6875rem] leading-relaxed text-amber-300">
                  A queued move to {pendingTransition.destinationName} will be cleared when the replacement is saved.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] p-3">
                <h3 className="text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                  Preserve this map
                </h3>
                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    onClick={() => void saveAsTemplate()}
                    disabled={createTemplate.isPending}
                    className="mari-chrome-control min-h-11 justify-start px-3 text-xs disabled:opacity-45"
                  >
                    <Save size="0.75rem" /> {createTemplate.isPending ? "Saving template" : "Save as template"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void openExportDialog()}
                    disabled={isExporting}
                    className="mari-chrome-control min-h-11 justify-start px-3 text-xs disabled:opacity-45"
                  >
                    {isExporting ? <Loader2 size="0.75rem" className="animate-spin" /> : <Upload size="0.75rem" />}
                    Export backup
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] p-3">
                <h3 className="text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                  Choose a replacement
                </h3>
                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    onClick={() => void beginAiStartOver()}
                    className="mari-chrome-control min-h-11 justify-start px-3 text-xs"
                  >
                    <Sparkles size="0.75rem" /> Create with AI
                  </button>
                  {onOpenTemplates && (
                    <button
                      type="button"
                      onClick={() => {
                        setReplaceMapOpen(false);
                        onOpenTemplates({ startOver: true });
                      }}
                      className="mari-chrome-control min-h-11 justify-start px-3 text-xs"
                    >
                      <MapIcon size="0.75rem" /> Use template or shared world
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setReplaceMapOpen(false);
                      pendingStartOverImportRef.current = true;
                      importInputRef.current?.click();
                    }}
                    disabled={isImporting}
                    className="mari-chrome-control min-h-11 justify-start px-3 text-xs disabled:opacity-45"
                  >
                    <Download size="0.75rem" /> Import map file
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteMap().then((started) => {
                        if (started) setReplaceMapOpen(false);
                      });
                    }}
                    className="mari-chrome-control mari-chrome-control--danger min-h-11 justify-start px-3 text-xs"
                  >
                    <Trash2 size="0.75rem" /> Start blank
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <SpatialMapAiBuilder
        chatId={chatId ?? ""}
        chatConnectionId={chat?.connectionId ?? null}
        standalone={templateMode}
        debugMode={debugMode}
        ownerMode={ownerMode}
        open={aiBuilderOpen}
        definition={aiBuilderDefinition ?? startOverBuilderDefinition}
        hierarchyProfile={aiBuilderStartOver ? startOverBuilderProfile : draftHierarchyProfile}
        generationPreferences={spatial.data?.generationPreferences ?? defaultGenerationPreferences(ownerMode)}
        currentLocationId={aiBuilderStartOver ? null : currentLocationId}
        preferredTargetLocationId={aiBuilderStartOver ? null : (selected?.id ?? null)}
        hasCommittedSpatialHistory={spatial.data?.hasCommittedSpatialHistory ?? false}
        dirty={dirty}
        initialResult={pendingSetupReview?.result}
        initialSession={firstMapGenerationSession}
        regenerateRequestId={regenerateRequestId}
        allowDirtyGeneratedReplacement={
          aiBuilderStartOver || (baseDefinition === null && firstMapGenerationSession !== null)
        }
        startOver={aiBuilderStartOver}
        setupReview={Boolean(pendingSetupReview)}
        lorebooks={lorebooks}
        excludedLorebookIds={excludedLorebookIds}
        onClose={closeAiBuilder}
        onApply={applyGeneratedDraft}
      />

      {!templateMode &&
        !aiBuilderOpen &&
        missingArtworkLocations.length > 0 &&
        (artworkPreview || artworkProgress !== null) && (
          <section
            data-marinara-map-artwork-reminder
            className="border-b border-[var(--marinara-editor-divider)] bg-[var(--marinara-editor-surface)]/35 px-4 py-3"
          >
            {artworkPreview ? (
              <div
                className="mx-auto flex min-h-0 w-full max-w-5xl flex-col gap-3 overflow-hidden rounded-xl border border-amber-500/35 bg-amber-500/10 p-3"
                style={{ maxHeight: "calc(100dvh - 8rem)" }}
                aria-label="Review location artwork image requests"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle size="0.9375rem" className="mt-0.5 shrink-0 text-amber-300" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--marinara-editor-title)]">
                      Review {artworkPreview.requestCount} image request
                      {artworkPreview.requestCount === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--marinara-editor-muted)]">
                      This will send {artworkPreview.requestCount} separate request
                      {artworkPreview.requestCount === 1 ? "" : "s"} to your image provider. Existing available artwork
                      is not replaced. Each new image fills only the missing role, or both roles when both are missing.
                      Prompts use the relevant Chat Settings and global image-generation settings.
                    </p>
                    {artworkPreviewStale && (
                      <p className="mt-2 text-[0.6875rem] font-semibold text-amber-200" role="status">
                        The map or image settings changed. Your prompt edits are preserved as stale data; refresh
                        prompts before generating artwork.
                      </p>
                    )}
                  </div>
                </div>

                <div
                  className="grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain pr-1"
                  data-marinara-map-artwork-review-scroll
                >
                  <dl className="grid gap-2 text-[0.6875rem] sm:grid-cols-2 lg:grid-cols-6">
                    <div className="min-w-0 rounded-lg border border-white/10 bg-black/10 px-2.5 py-2">
                      <dt className="text-[var(--marinara-editor-muted)]">Image connection</dt>
                      <dd className="mt-0.5 truncate font-semibold text-[var(--marinara-editor-title)]">
                        {artworkPreview.connection.name}
                      </dd>
                    </div>
                    <div className="min-w-0 rounded-lg border border-white/10 bg-black/10 px-2.5 py-2">
                      <dt className="text-[var(--marinara-editor-muted)]">Model</dt>
                      <dd className="mt-0.5 truncate font-semibold text-[var(--marinara-editor-title)]">
                        {artworkPreview.connection.model}
                      </dd>
                    </div>
                    <div className="min-w-0 rounded-lg border border-white/10 bg-black/10 px-2.5 py-2">
                      <dt className="text-[var(--marinara-editor-muted)]">Engine style</dt>
                      <dd className="mt-0.5 truncate font-semibold text-[var(--marinara-editor-title)]">
                        {artworkPreview.styleProfile.name}
                      </dd>
                    </div>
                    <div className="min-w-0 rounded-lg border border-white/10 bg-black/10 px-2.5 py-2">
                      <dt className="text-[var(--marinara-editor-muted)]">Campaign art style</dt>
                      <dd className="mt-0.5 font-semibold text-[var(--marinara-editor-title)]">
                        {artworkPreview.campaign.artStyleIncluded ? "Included" : "Off"}
                      </dd>
                    </div>
                    <div className="min-w-0 rounded-lg border border-white/10 bg-black/10 px-2.5 py-2">
                      <dt className="text-[var(--marinara-editor-muted)]">Scene instructions</dt>
                      <dd className="mt-0.5 font-semibold text-[var(--marinara-editor-title)]">
                        {artworkPreview.chatSettings.imageInstructionsIncluded ? "Included" : "None saved"}
                      </dd>
                    </div>
                    <div className="min-w-0 rounded-lg border border-white/10 bg-black/10 px-2.5 py-2">
                      <dt className="text-[var(--marinara-editor-muted)]">Image size</dt>
                      <dd className="mt-0.5 font-semibold text-[var(--marinara-editor-title)]">
                        {artworkPreview.width} × {artworkPreview.height}
                      </dd>
                    </div>
                  </dl>

                  <div className="grid gap-2">
                    {artworkPreview.items.map((item, index) => (
                      <details
                        key={item.id}
                        className="rounded-lg border border-white/10 bg-black/10"
                        open={index === 0}
                      >
                        <summary className="cursor-pointer px-3 py-2 text-[0.6875rem] font-semibold text-[var(--marinara-editor-title)]">
                          {index + 1}. {item.title}
                        </summary>
                        <div className="grid gap-2 border-t border-white/10 px-3 py-2.5">
                          <div>
                            <label
                              htmlFor={`map-artwork-positive-${item.id}`}
                              className="text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--marinara-editor-muted)]"
                            >
                              Prompt sent to provider
                            </label>
                            <textarea
                              id={`map-artwork-positive-${item.id}`}
                              aria-label={`Positive prompt for ${item.title}`}
                              value={item.prompt}
                              maxLength={200_000}
                              rows={5}
                              onChange={(event) => {
                                invalidateArtworkGeneration();
                                setArtworkPreview((current) =>
                                  current
                                    ? {
                                        ...current,
                                        items: current.items.map((candidate) =>
                                          candidate.id === item.id
                                            ? {
                                                ...candidate,
                                                prompt: event.target.value,
                                              }
                                            : candidate,
                                        ),
                                      }
                                    : current,
                                );
                              }}
                              className="mari-editor-field mt-1 max-h-40 min-h-24 w-full resize-y overflow-auto whitespace-pre-wrap break-words p-2 font-mono text-[0.625rem] leading-relaxed"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`map-artwork-negative-${item.id}`}
                              className="text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--marinara-editor-muted)]"
                            >
                              Negative prompt
                            </label>
                            <textarea
                              id={`map-artwork-negative-${item.id}`}
                              aria-label={`Negative prompt for ${item.title}`}
                              value={item.negativePrompt}
                              maxLength={200_000}
                              rows={3}
                              placeholder="None"
                              onChange={(event) => {
                                invalidateArtworkGeneration();
                                setArtworkPreview((current) =>
                                  current
                                    ? {
                                        ...current,
                                        items: current.items.map((candidate) =>
                                          candidate.id === item.id
                                            ? {
                                                ...candidate,
                                                negativePrompt: event.target.value,
                                              }
                                            : candidate,
                                        ),
                                      }
                                    : current,
                                );
                              }}
                              className="mari-editor-field mt-1 max-h-32 min-h-20 w-full resize-y overflow-auto whitespace-pre-wrap break-words p-2 font-mono text-[0.625rem] leading-relaxed"
                            />
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      invalidateArtworkGeneration();
                      setArtworkPreview(null);
                    }}
                    className="mari-chrome-control min-h-11 justify-center px-3 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    data-marinara-refresh-map-artwork-prompts
                    onClick={() => void refreshArtworkPreview()}
                    disabled={artworkActionsDisabled}
                    className="mari-chrome-control min-h-11 justify-center px-3 text-xs disabled:opacity-45"
                  >
                    {previewGalleryImages.isPending ? (
                      <Loader2 size="0.8125rem" className="animate-spin" />
                    ) : (
                      <RefreshCw size="0.8125rem" />
                    )}
                    {previewGalleryImages.isPending ? "Refreshing prompts" : "Refresh prompts"}
                  </button>
                  <button
                    type="button"
                    data-marinara-confirm-map-artwork
                    onClick={() => void fillMissingArtwork()}
                    disabled={artworkActionsDisabled || artworkPreviewStale}
                    className="mari-editor-action mari-editor-action--primary min-h-11 justify-center px-3 text-xs disabled:opacity-45"
                  >
                    <Sparkles size="0.8125rem" /> Generate {artworkPreview.requestCount} image
                    {artworkPreview.requestCount === 1 ? "" : "s"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[var(--marinara-editor-title)]">Location artwork</p>
                  <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-[var(--marinara-editor-muted)]">
                    Review {missingArtworkLocations.length} incomplete location
                    {missingArtworkLocations.length === 1 ? "" : "s"} before anything is generated. Each provider
                    request fills only the missing role, or both roles when both are missing.
                  </p>
                </div>
                <button
                  type="button"
                  data-marinara-fill-map-artwork
                  onClick={() => void prepareArtworkPreview()}
                  disabled={artworkActionsDisabled}
                  className="mari-chrome-control min-h-11 shrink-0 justify-center border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-3 text-xs disabled:opacity-45"
                >
                  {artworkProgress || previewGalleryImages.isPending ? (
                    <Loader2 size="0.8125rem" className="animate-spin" />
                  ) : (
                    <ImageIcon size="0.8125rem" />
                  )}
                  {artworkProgress
                    ? `Creating ${Math.min(artworkProgress.completed + 1, artworkProgress.total)} of ${artworkProgress.total}`
                    : previewGalleryImages.isPending
                      ? "Preparing preview"
                      : `Review ${artworkImagesToGenerate} request${artworkImagesToGenerate === 1 ? "" : "s"}`}
                </button>
                {artworkProgress?.currentName && (
                  <span className="sr-only" role="status" aria-live="polite">
                    Creating artwork for {artworkProgress.currentName}
                  </span>
                )}
              </div>
            )}
          </section>
        )}

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
                Names are editable labels; campaign history follows the stable IDs. Export this map as a baseline, copy
                your revised names and details into that file, and keep each matching ID unchanged before importing
                again.
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
                Reusing an old ID for a different conceptual place will make historical messages resolve to that new
                place.
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

      {!aiBuilderOpen && unresolvedLoreReferences.length > 0 && (
        <section
          data-marinara-portable-lore-unresolved
          className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-100"
          role="alert"
        >
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-wrap items-start gap-3">
              <AlertCircle size="0.875rem" className="mt-0.5 shrink-0" />
              <div className="min-w-52 flex-1">
                <p className="font-semibold">
                  {unresolvedLoreReferences.length} lore link
                  {unresolvedLoreReferences.length === 1 ? " needs" : "s need"} review
                </p>
                <p className="mt-1 leading-relaxed text-amber-100/80">
                  No name-only match was made. Select a location to relink it in Lore links, or explicitly detach the
                  unresolved IDs.
                </p>
              </div>
              <button
                type="button"
                disabled={isImporting}
                onClick={() => {
                  if (isImporting) return;
                  const unresolvedByLocation = new Map<string, Set<string>>();
                  for (const reference of unresolvedLoreReferences) {
                    const ids = unresolvedByLocation.get(reference.locationId) ?? new Set<string>();
                    ids.add(reference.originalEntryId);
                    unresolvedByLocation.set(reference.locationId, ids);
                  }
                  applyDraft({
                    ...draft,
                    locations: draft.locations.map((location) => ({
                      ...location,
                      lorebookEntryIds: location.lorebookEntryIds.filter(
                        (entryId) => !unresolvedByLocation.get(location.id)?.has(entryId),
                      ),
                    })),
                  });
                  setUnresolvedLoreReferences([]);
                  toast.success("Unresolved lore links detached from the working copy. Click Save to keep the change.");
                }}
                className="mari-chrome-control min-h-11 px-3 text-xs disabled:opacity-45"
              >
                Detach unresolved links
              </button>
            </div>
            <div className="mt-3 max-h-48 space-y-1 overflow-y-auto font-mono text-[0.625rem] leading-relaxed">
              {unresolvedLoreReferences.map((reference, index) => (
                <div
                  key={`${reference.locationId}-${reference.originalEntryId}-${index}`}
                  className="flex flex-wrap items-center gap-2 rounded bg-black/10 px-2 py-1"
                >
                  <button
                    type="button"
                    onClick={() => selectLocation(reference.locationId)}
                    className="min-h-8 min-w-0 flex-1 text-left underline decoration-current/40 underline-offset-2"
                  >
                    {reference.locationName} → {reference.originalLorebookName} → {reference.originalEntryName} →{" "}
                    {reference.originalEntryId}
                  </button>
                  {reference.originalLorebookId &&
                    onOpenLorebook &&
                    lorebooks.some((book) => book.id === reference.originalLorebookId) && (
                      <button
                        type="button"
                        onClick={() => void handleOpenLorebook(reference.originalLorebookId!)}
                        className="mari-chrome-control min-h-8 px-2 text-[0.625rem]"
                      >
                        Open lorebook
                      </button>
                    )}
                </div>
              ))}
            </div>
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
            Map ready · {firstSaveResult.locationCount} {firstSaveResult.locationCount === 1 ? "location" : "locations"}{" "}
            · Starting at {firstSaveResult.startingLocationName}
          </span>
          <button
            type="button"
            onClick={() => void handleClose()}
            className="mari-chrome-control min-h-11 px-3 text-xs"
          >
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
              {templateMode
                ? `This ${sharedWorldMode ? "shared world" : "template"} changed elsewhere. Your working copy is preserved. Return to the library and reopen it.`
                : "The map changed elsewhere. Your working copy is preserved."}
            </span>
            {templateMode ? (
              <button
                type="button"
                onClick={() => void handleClose()}
                className="mari-chrome-control min-h-11 px-3 text-xs"
              >
                <ArrowLeft size="0.75rem" /> Return to library
              </button>
            ) : (
              <>
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
              </>
            )}
          </div>
          {!templateMode && reviewConflict && (
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

      {!aiBuilderOpen &&
        (draft.locations.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6">
            <div className="max-w-md text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] text-[var(--marinara-chat-chrome-accent)]">
                <MapIcon size="1.25rem" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                {sharedWorldMode
                  ? "Create a shared world"
                  : templateMode
                    ? "Create a map template"
                    : "Create a starting location"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
                {templateMode
                  ? sharedWorldMode
                    ? "Build the canonical world once, then link Roleplay and Game chats while each keeps its own location and travel history."
                    : "Describe a fandom or setting for Maps to draft without a chat, or start manually with one broad place."
                  : "Let AI draft the full hierarchy from the game or chat setup, add a saved template, or start manually with one broad place."}
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setAiBuilderOpen(true)}
                  className="mari-chrome-control mari-chrome-control--primary min-h-11 justify-center px-5 text-sm"
                >
                  <Sparkles size="0.875rem" /> {templateMode ? "Create with AI" : "Draft with AI"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const result = addSpatialLocation(draft);
                    applyDraft(result.definition);
                    selectLocation(result.location.id);
                  }}
                  className="mari-chrome-control min-h-11 justify-center px-5 text-sm"
                >
                  <Plus size="0.875rem" /> Build manually
                </button>
                {!templateMode && onOpenTemplates && (
                  <button
                    type="button"
                    onClick={onOpenTemplates}
                    className="mari-chrome-control min-h-11 justify-center px-5 text-sm"
                  >
                    <MapIcon size="0.875rem" /> Use template or shared world
                  </button>
                )}
                {!templateMode && (
                  <button
                    type="button"
                    onClick={() => {
                      pendingStartOverImportRef.current = false;
                      setStartOverPending(false);
                      importInputRef.current?.click();
                    }}
                    disabled={isImporting}
                    className="mari-chrome-control min-h-11 justify-center px-5 text-sm disabled:opacity-45"
                  >
                    {isImporting ? <Loader2 size="0.875rem" className="animate-spin" /> : <Download size="0.875rem" />}
                    Import map file
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mari-maps-workspace-grid hidden min-h-0 flex-1 divide-x divide-[var(--marinara-chat-chrome-panel-divider)] lg:grid">
              <HierarchyNavigator
                definition={draft}
                hierarchyProfile={draftHierarchyProfile}
                selectedId={selectedId}
                currentLocationId={effectiveCurrentLocationId}
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
                    hierarchyProfile={draftHierarchyProfile}
                    selectedId={selectedId}
                    currentLocationId={effectiveCurrentLocationId}
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
