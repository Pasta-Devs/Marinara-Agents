import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { flushSync } from "react-dom";
import {
  ArrowLeft,
  CircleHelp,
  Download,
  GitFork,
  Link2,
  Loader2,
  Map,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  spatialContextDefinitionSchema,
  type SpatialContextDefinition,
  type SpatialOwnerMode,
} from "@marinara-engine/shared";
import {
  useCreateSpatialMapTemplate,
  useCreateSpatialSharedWorld,
  useDeleteSpatialSharedWorld,
  useDeleteSpatialMapTemplate,
  useLinkSpatialSharedWorld,
  useReplaceWithIndependentSpatialWorld,
  useStartOverSpatialContext,
  useSpatialContext,
  useSpatialMapTemplates,
  useSpatialSharedWorlds,
  useUpdateSpatialContext,
} from "../../hooks/use-spatial-context";
import {
  defaultHierarchyProfile,
  globalGallerySpatialReferenceId,
  instantiateSpatialSharedWorld,
  instantiateSpatialMapTemplate,
  normalizeHierarchyProfile,
  type SpatialMapTemplateRecord,
  type SpatialSharedWorldRecord,
} from "../../../../maps-shared/src/maps-model";
import { createEmptySpatialDefinition } from "./editor-state";
import {
  bundledArtworkFile,
  parseBundledArtwork,
  referencedArtworkIds,
  remapArtworkReferences,
  SpatialMapWorkspace,
} from "./SpatialMapWorkspace";
import {
  reuseOrUploadSpatialGlobalGalleryImage,
  useSpatialGlobalGalleryImages,
  useSpatialLorebookEntries,
  useSpatialLorebooks,
} from "./use-spatial-resources";
import { cn, WORLD_MAPS_GUIDE_URL } from "./package-utils";
import { packageApi } from "./package-api";
import { PortableLoreImportDialog } from "./components/PortableLoreImportDialog";
import { useModalKeyboardNavigation } from "./components/use-modal-keyboard-navigation";
import {
  importPortableLoreBundle,
  parsePortableLoreBundle,
  planPortableLoreImport,
  remapPortableLoreReferences,
  unresolvedPortableLoreReferences,
  type PortableLoreBundle,
  type PortableLoreImportPlan,
  type PortableLoreImportStrategy,
  type PortableLoreReference,
} from "./portable-lore";

interface SpatialMapLibraryProps {
  chatId: string | null;
  chatName: string | null;
  chatMode: string | null;
  enabledForChat?: boolean;
  onClose: () => void;
  onAppliedToChat?: () => void;
  onSelectForSetup?: (template: SpatialMapTemplateRecord) => void;
  onSelectSharedWorldForSetup?: (world: SpatialSharedWorldRecord) => void;
  onOpenLorebook?: (lorebookId: string) => void;
  onLorebooksChanged?: () => void | Promise<void>;
  onEnabledForChatChange?: (enabled: boolean) => void | Promise<void>;
  startOverReplacement?: boolean;
}

interface LibraryConfirmationOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive" | "accent";
}

interface PendingLibraryPortableLoreImport {
  record: Record<string, unknown> | null;
  data: Record<string, unknown> | null;
  definition: SpatialContextDefinition;
  fileName: string;
  target: "template" | "shared-world";
  bundle: PortableLoreBundle;
  plan: PortableLoreImportPlan;
}

function importedTemplateName(fileName: string): string {
  return (
    fileName
      .replace(/\.(?:world-map|hierarchical-map)\.json$/iu, "")
      .replace(/\.json$/iu, "")
      .replace(/[-_]+/gu, " ")
      .trim() || "Imported map"
  );
}

export function SpatialMapLibrary({
  chatId,
  chatName,
  chatMode,
  enabledForChat = false,
  onClose,
  onAppliedToChat,
  onSelectForSetup,
  onSelectSharedWorldForSetup,
  onOpenLorebook,
  onLorebooksChanged,
  onEnabledForChatChange,
  startOverReplacement = false,
}: SpatialMapLibraryProps) {
  const templates = useSpatialMapTemplates();
  const sharedWorlds = useSpatialSharedWorlds();
  const createTemplate = useCreateSpatialMapTemplate();
  const createSharedWorld = useCreateSpatialSharedWorld();
  const deleteTemplate = useDeleteSpatialMapTemplate();
  const deleteSharedWorld = useDeleteSpatialSharedWorld();
  const linkSharedWorld = useLinkSpatialSharedWorld();
  const replaceWithIndependentWorld = useReplaceWithIndependentSpatialWorld();
  const startOverSpatial = useStartOverSpatialContext();
  const globalGalleryImages = useSpatialGlobalGalleryImages();
  const [isImporting, setIsImporting] = useState(false);
  const [importEntriesPrimed, setImportEntriesPrimed] = useState(false);
  const [pendingPortableLoreImport, setPendingPortableLoreImport] =
    useState<PendingLibraryPortableLoreImport | null>(null);
  const lorebooksQuery = useSpatialLorebooks();
  const { data: lorebooks = [] } = lorebooksQuery;
  const portableLorebookIds = useMemo(
    () =>
      importEntriesPrimed || isImporting || pendingPortableLoreImport
        ? lorebooks.map((lorebook) => lorebook.id)
        : [],
    [importEntriesPrimed, isImporting, lorebooks, pendingPortableLoreImport],
  );
  const lorebookEntriesQuery = useSpatialLorebookEntries(portableLorebookIds);
  const spatial = useSpatialContext(chatId);
  const updateSpatial = useUpdateSpatialContext();
  const importInputRef = useRef<HTMLInputElement>(null);
  const importTargetRef = useRef<"template" | "shared-world">("template");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSharedWorldId, setEditingSharedWorldId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editingUnresolvedLoreReferences, setEditingUnresolvedLoreReferences] =
    useState<PortableLoreReference[]>([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<LibraryConfirmationOptions | null>(null);
  const confirmationResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const confirmationDialogRef = useRef<HTMLDivElement>(null);
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);
  const editingTemplate = templates.data?.find((template) => template.id === editingId) ?? null;
  const editingSharedWorld = sharedWorlds.data?.find((world) => world.id === editingSharedWorldId) ?? null;
  const supportedChat = !!chatId && (chatMode === "roleplay" || chatMode === "game");
  const visibleTemplates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return templates.data ?? [];
    return (templates.data ?? []).filter((template) => template.name.toLocaleLowerCase().includes(normalized));
  }, [query, templates.data]);
  const visibleSharedWorlds = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return sharedWorlds.data ?? [];
    return (sharedWorlds.data ?? []).filter((world) => world.name.toLocaleLowerCase().includes(normalized));
  }, [query, sharedWorlds.data]);

  const resolveConfirmation = useCallback((confirmed: boolean) => {
    const resolve = confirmationResolverRef.current;
    confirmationResolverRef.current = null;
    setPendingConfirmation(null);
    resolve?.(confirmed);
  }, []);

  const ask = useCallback((options: LibraryConfirmationOptions) => {
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

  const createBlank = async () => {
    if (createTemplate.isPending) return;
    const definition = createEmptySpatialDefinition("roleplay");
    try {
      const created = await createTemplate.mutateAsync({
        name: "Untitled map",
        description: "",
        definition,
        hierarchyProfile: defaultHierarchyProfile(definition),
      });
      setEditingId(created.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The map template could not be created.");
    }
  };

  const createBlankSharedWorld = async () => {
    if (createSharedWorld.isPending) return;
    const definition = createEmptySpatialDefinition("roleplay");
    try {
      const created = await createSharedWorld.mutateAsync({
        name: "Untitled shared world",
        description: "",
        definition,
        hierarchyProfile: defaultHierarchyProfile(definition),
      });
      setEditingSharedWorldId(created.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The shared world could not be created.");
    }
  };

  const finishLibraryImport = async (options: {
    record: Record<string, unknown> | null;
    data: Record<string, unknown> | null;
    definition: SpatialContextDefinition;
    fileName: string;
    target: "template" | "shared-world";
    portableLore: PortableLoreBundle | null;
    entryIdMap: ReadonlyMap<string, string>;
  }) => {
    const loreRemappedDefinition = options.portableLore
      ? remapPortableLoreReferences(options.definition, options.portableLore, options.entryIdMap)
      : options.definition;
    const bundledArtwork = parseBundledArtwork(options.record?.artwork);
    const referencedIds = new Set(referencedArtworkIds(loreRemappedDefinition));
    const currentGlobalImages = [...(globalGalleryImages.data ?? (await globalGalleryImages.refetch()).data ?? [])];
    const artworkIdMap = new globalThis.Map<string, string>();
    let sharedArtworkAdded = 0;
    let sharedArtworkReused = 0;
    let failedArtworkCount = 0;
    for (const artwork of bundledArtwork.filter((entry) => referencedIds.has(entry.sourceImageId))) {
      try {
        const result = await reuseOrUploadSpatialGlobalGalleryImage(
          bundledArtworkFile(artwork),
          artwork,
          currentGlobalImages,
        );
        artworkIdMap.set(artwork.sourceImageId, globalGallerySpatialReferenceId(result.image.id));
        if (!currentGlobalImages.some((candidate) => candidate.id === result.image.id)) {
          currentGlobalImages.push(result.image);
        }
        if (result.reused) sharedArtworkReused += 1;
        else sharedArtworkAdded += 1;
      } catch {
        failedArtworkCount += 1;
      }
    }
    if (sharedArtworkAdded > 0) await globalGalleryImages.refetch();
    const importedDefinition = remapArtworkReferences(loreRemappedDefinition, artworkIdMap);
    const hierarchyProfile = normalizeHierarchyProfile(options.data?.hierarchyProfile, importedDefinition);
    const createInput = {
      name:
        typeof options.record?.name === "string" && options.record.name.trim()
          ? options.record.name.trim()
          : importedTemplateName(options.fileName),
      description: "",
      definition: importedDefinition,
      hierarchyProfile,
    };
    const created =
      options.target === "shared-world"
        ? await createSharedWorld.mutateAsync(createInput)
        : await createTemplate.mutateAsync(createInput);
    const existingLoreEntryIds = new Set((lorebookEntriesQuery.entries ?? []).map((entry) => entry.id));
    setEditingUnresolvedLoreReferences(
      options.portableLore
        ? unresolvedPortableLoreReferences(options.portableLore, options.entryIdMap).filter(
            (reference) => reference.entryKey !== null || !existingLoreEntryIds.has(reference.originalEntryId),
          )
        : [],
    );
    toast.success(
      `Map added to your ${options.target === "shared-world" ? "shared worlds" : "templates"}.${sharedArtworkAdded > 0 ? ` ${sharedArtworkAdded} artwork file${sharedArtworkAdded === 1 ? " was" : "s were"} added to Global Gallery.` : ""}${sharedArtworkReused > 0 ? ` ${sharedArtworkReused} existing shared image${sharedArtworkReused === 1 ? " was" : "s were"} reused.` : ""}${failedArtworkCount > 0 ? ` ${failedArtworkCount} artwork file${failedArtworkCount === 1 ? "" : "s"} could not be restored.` : ""}`,
    );
    if (options.target === "shared-world") setEditingSharedWorldId(created.id);
    else setEditingId(created.id);
    return created.id;
  };

  const importTemplate = async (event: ChangeEvent<HTMLInputElement>) => {
    const target = importTargetRef.current;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || isImporting || pendingPortableLoreImport) {
      setImportEntriesPrimed(false);
      return;
    }
    setIsImporting(true);
    setImportEntriesPrimed(false);
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const record = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
      const data =
        record?.data && typeof record.data === "object" && !Array.isArray(record.data)
          ? (record.data as Record<string, unknown>)
          : record;
      const candidate = data && "definition" in data ? data.definition : raw;
      const parsed = spatialContextDefinitionSchema.safeParse(candidate);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "This is not a valid map file.");
      const portableLoreValue = record?.portableLore;
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
        const importedMapName =
          typeof record?.name === "string" && record.name.trim()
            ? record.name.trim()
            : importedTemplateName(file.name);
        setPendingPortableLoreImport({
          record,
          data,
          definition: parsed.data,
          fileName: file.name,
          target,
          bundle: portableLore,
          plan: planPortableLoreImport(portableLore, lorebooks, entries, importedMapName),
        });
        return;
      }
      await finishLibraryImport({
        record,
        data,
        definition: parsed.data,
        fileName: file.name,
        target,
        portableLore,
        entryIdMap: new globalThis.Map(),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The map template could not be imported.");
    } finally {
      setIsImporting(false);
    }
  };

  const openImportPicker = (target: "template" | "shared-world") => {
    const importInput = importInputRef.current;
    if (!importInput) {
      setImportEntriesPrimed(false);
      return;
    }
    flushSync(() => setImportEntriesPrimed(true));
    importTargetRef.current = target;
    window.addEventListener(
      "focus",
      () => {
        window.setTimeout(() => {
          if (!importInputRef.current?.files?.length) setImportEntriesPrimed(false);
        }, 0);
      },
      { once: true },
    );
    importInput.click();
  };

  const confirmPortableLoreImport = async (
    strategy: PortableLoreImportStrategy,
    selections: ReadonlyMap<string, string | null>,
  ) => {
    if (!pendingPortableLoreImport || isImporting) return;
    setIsImporting(true);
    let createdLorebookIds: string[] = [];
    let createdRecordId: string | null = null;
    let importSummary: {
      reusedEntries: number;
      importedEntries: number;
    } | null = null;
    try {
      const result = await importPortableLoreBundle({
        api: packageApi,
        bundle: pendingPortableLoreImport.bundle,
        plan: pendingPortableLoreImport.plan,
        strategy,
        ambiguousSelections: selections,
      });
      createdLorebookIds = result.createdLorebookIds;
      createdRecordId = await finishLibraryImport({
        record: pendingPortableLoreImport.record,
        data: pendingPortableLoreImport.data,
        definition: pendingPortableLoreImport.definition,
        fileName: pendingPortableLoreImport.fileName,
        target: pendingPortableLoreImport.target,
        portableLore: pendingPortableLoreImport.bundle,
        entryIdMap: result.entryIdMap,
      });
      setPendingPortableLoreImport(null);
      importSummary = result;
    } catch (error) {
      if (!createdRecordId && createdLorebookIds.length > 0) {
        await Promise.allSettled(
          createdLorebookIds.map((lorebookId) => packageApi.delete(`/lorebooks/${lorebookId}`)),
        );
      }
      toast.error(error instanceof Error ? error.message : "The portable lore could not be restored.");
      setIsImporting(false);
      return;
    }
    try {
      await Promise.all([lorebooksQuery.refetch(), onLorebooksChanged?.()]);
    } catch {
      toast.error("The map was imported, but the lorebook list could not be refreshed.");
    }
    if (importSummary) {
      toast.success(
        `${importSummary.reusedEntries} lore link${importSummary.reusedEntries === 1 ? " was" : "s were"} reused; ${importSummary.importedEntries} entr${importSummary.importedEntries === 1 ? "y was" : "ies were"} imported. Imported lorebooks stay independent of the map.`,
      );
    }
    setIsImporting(false);
  };

  const removeTemplate = async (template: SpatialMapTemplateRecord) => {
    const confirmed = await ask({
      title: "Delete map template?",
      message: `Delete “${template.name}” from your map templates? Chats that already copied it are not affected.`,
      confirmLabel: "Delete template",
      tone: "destructive",
    });
    if (!confirmed) return;
    try {
      await deleteTemplate.mutateAsync({
        id: template.id,
        expectedRevision: template.revision,
      });
      toast.success("Map template deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The map template could not be deleted.");
    }
  };

  const createSharedWorldFromTemplate = async (template: SpatialMapTemplateRecord) => {
    const confirmed = await ask({
      title: "Create a shared world?",
      message: `Create one canonical shared world from “${template.name}”? The original template remains available for independent copies.`,
      confirmLabel: "Create shared world",
      tone: "accent",
    });
    if (!confirmed) return;
    try {
      const created = await createSharedWorld.mutateAsync({
        name: template.name,
        description: template.description,
        definition: template.data.definition,
        hierarchyProfile: template.data.hierarchyProfile,
      });
      toast.success("Shared world created. Link chats to it or edit the canonical definition.");
      setEditingSharedWorldId(created.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The shared world could not be created.");
    }
  };

  const removeSharedWorld = async (world: SpatialSharedWorldRecord) => {
    if (world.linkedChatCount > 0) {
      toast.error(
        `This world is linked to ${world.linkedChatCount} chat${world.linkedChatCount === 1 ? "" : "s"}. Fork or relink them before deleting it.`,
      );
      return;
    }
    const confirmed = await ask({
      title: "Delete shared world?",
      message: `Delete “${world.name}”? Shared Global Gallery images remain available because templates or other worlds may still use them.`,
      confirmLabel: "Delete shared world",
      tone: "destructive",
    });
    if (!confirmed) return;
    try {
      await deleteSharedWorld.mutateAsync({
        id: world.id,
        expectedRevision: world.revision,
      });
      toast.success("Shared world deleted. Reusable Global Gallery artwork was kept.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The shared world could not be deleted.");
    }
  };

  const linkWorldToChat = async (world: SpatialSharedWorldRecord) => {
    if (!supportedChat || !chatId || !spatial.data) return;
    const current = spatial.data.definition;
    const confirmed = await ask({
      title: startOverReplacement ? "Break breadcrumb continuity and replace this map?" : "Link this chat to the shared world?",
      message: startOverReplacement
        ? `Replace ${chatName || "this chat"} with “${world.name}”? Old messages remain, but prior map locations may no longer resolve. Game map bindings will be reset. The world definition and artwork stay account-owned.`
        : `Link ${chatName || "this chat"} to “${world.name}”? The world definition and artwork stay account-owned. This chat keeps its own current location, route history, snapshots, and Game bindings. Story discoveries remain unpublished until reviewed.`,
      confirmLabel: startOverReplacement ? "Replace map" : "Link shared world",
      tone: startOverReplacement ? "destructive" : "accent",
    });
    if (!confirmed) return;
    const enablementChanged = !enabledForChat && Boolean(onEnabledForChatChange);
    const ownerMode: SpatialOwnerMode = chatMode === "game" ? "game" : "roleplay";
    const instantiated = instantiateSpatialSharedWorld(world.data, ownerMode, current?.revision ?? 0);
    try {
      if (enablementChanged) await onEnabledForChatChange?.(true);
      if (startOverReplacement) {
        const replaced = await startOverSpatial.mutateAsync({
          chatId,
          expectedRevision: current?.revision ?? 0,
          expectedCurrentLocationId: spatial.data.currentLocationId,
          replacementCurrentLocationId: instantiated.definition.startingLocationId,
          definition: instantiated.definition,
          hierarchyProfile: instantiated.hierarchyProfile,
          breakHistoryContinuity: true,
        });
        await linkSharedWorld.mutateAsync({
          chatId,
          worldId: world.id,
          expectedWorldRevision: world.revision,
          expectedRevision: replaced.definition?.revision ?? 0,
          expectedCurrentLocationId: replaced.currentLocationId,
        });
        toast.success(`Replaced ${chatName || "the chat"} with “${world.name}” and linked the shared world.`);
        onAppliedToChat?.();
        return;
      }
      await linkSharedWorld.mutateAsync({
        chatId,
        worldId: world.id,
        expectedWorldRevision: world.revision,
        expectedRevision: current?.revision ?? 0,
        expectedCurrentLocationId: spatial.data.currentLocationId,
      });
      toast.success(`Linked ${chatName || "the chat"} to “${world.name}”.`);
      onAppliedToChat?.();
    } catch (error) {
      if (enablementChanged) {
        try {
          await onEnabledForChatChange?.(false);
        } catch {
          // Preserve the original linking error.
        }
      }
      toast.error(error instanceof Error ? error.message : "The shared world could not be linked.");
    }
  };

  const selectSharedWorldForSetup = async (world: SpatialSharedWorldRecord) => {
    if (!onSelectSharedWorldForSetup) return;
    const confirmed = await ask({
      title: "Use this shared world?",
      message: `Link the new Game to “${world.name}”? The canonical world definition and artwork stay account-owned. The Game keeps its own location, travel history, snapshots, bindings, and unpublished discoveries.`,
      confirmLabel: "Use shared world",
      tone: "accent",
    });
    if (confirmed) onSelectSharedWorldForSetup(world);
  };

  const copyWorldToChat = async (world: SpatialSharedWorldRecord) => {
    if (!supportedChat || !chatId || !spatial.data) return;
    const existing = spatial.data.definition;
    const confirmed = await ask({
      title: startOverReplacement ? "Break breadcrumb continuity and replace this map?" : existing ? "Replace with an independent copy?" : "Add an independent copy?",
      message: startOverReplacement
        ? `Replace ${chatName || "this chat"} with an independent copy of “${world.name}”? Old messages remain, but prior map locations may no longer resolve. Game map bindings will be reset. Future edits to the shared world will not appear here.`
        : `Copy “${world.name}” into ${chatName || "this chat"}? Future edits to the shared world will not appear here. Shared artwork references remain account-wide.`,
      confirmLabel: startOverReplacement ? "Replace map" : "Use independent copy",
      tone: startOverReplacement || existing ? "destructive" : "accent",
    });
    if (!confirmed) return;
    const ownerMode: SpatialOwnerMode = chatMode === "game" ? "game" : "roleplay";
    const enablementChanged = !enabledForChat && Boolean(onEnabledForChatChange);
    const instantiated = instantiateSpatialSharedWorld(world.data, ownerMode, existing?.revision ?? 0);
    try {
      if (enablementChanged) await onEnabledForChatChange?.(true);
      const request = {
        chatId,
        expectedRevision: existing?.revision ?? 0,
        expectedCurrentLocationId: spatial.data.currentLocationId,
        ...(spatial.data.currentLocationId &&
        !instantiated.definition.locations.some((location) => location.id === spatial.data.currentLocationId)
          ? {
              replacementCurrentLocationId: instantiated.definition.startingLocationId,
            }
          : {}),
        definition: instantiated.definition,
        hierarchyProfile: instantiated.hierarchyProfile,
      };
      if (startOverReplacement) {
        await startOverSpatial.mutateAsync({
          ...request,
          replacementCurrentLocationId: instantiated.definition.startingLocationId,
          breakHistoryContinuity: true,
        });
      } else {
        await replaceWithIndependentWorld.mutateAsync(request);
      }
      toast.success(`${startOverReplacement ? "Replaced with" : "Added an independent copy of"} “${world.name}”.`);
      onAppliedToChat?.();
    } catch (error) {
      if (enablementChanged) {
        try {
          await onEnabledForChatChange?.(false);
        } catch {
          // Preserve the original apply error.
        }
      }
      toast.error(error instanceof Error ? error.message : "The independent map copy could not be added.");
    }
  };

  const applyToChat = async (template: SpatialMapTemplateRecord) => {
    if (onSelectForSetup) {
      const confirmed = await ask({
        title: "Use this map template?",
        message: `Create a Game-owned working copy of “${template.name}” for review? The saved template will stay unchanged.`,
        confirmLabel: "Use template",
        tone: "accent",
      });
      if (confirmed) onSelectForSetup(template);
      return;
    }
    if (!supportedChat || !chatId || !spatial.data) return;
    const existing = spatial.data.definition;
    const confirmed = await ask({
      title: startOverReplacement ? "Break breadcrumb continuity and replace this map?" : existing ? "Replace this chat's map?" : "Add map template to this chat?",
      message: startOverReplacement
        ? `Replace ${chatName || "this chat"} with “${template.name}”? Old messages remain, but prior map locations may no longer resolve. Game map bindings will be reset. The saved template will stay unchanged.`
        : existing
          ? `Replace the current working hierarchy with a copy of “${template.name}”? Campaign history may prevent replacement once locations have been used.`
          : `Add a fresh copy of “${template.name}” to ${chatName || "this chat"}? The saved template will stay unchanged.`,
      confirmLabel: startOverReplacement ? "Replace map" : existing ? "Replace map" : "Add to chat",
      tone: startOverReplacement || existing ? "destructive" : "accent",
    });
    if (!confirmed) return;
    const ownerMode: SpatialOwnerMode = chatMode === "game" ? "game" : "roleplay";
    const instantiated = instantiateSpatialMapTemplate(template.data, ownerMode);
    const enablementChanged = !enabledForChat && Boolean(onEnabledForChatChange);
    try {
      if (enablementChanged) await onEnabledForChatChange?.(true);
      const request = {
        chatId,
        expectedRevision: existing?.revision ?? 0,
        expectedCurrentLocationId: spatial.data.currentLocationId,
        ...(spatial.data.currentLocationId &&
        !instantiated.definition.locations.some((location) => location.id === spatial.data.currentLocationId)
          ? {
              replacementCurrentLocationId: instantiated.definition.startingLocationId,
            }
          : {}),
        definition: {
          ...instantiated.definition,
          ownerMode,
          enabled: true,
          revision: existing?.revision ?? 0,
        },
        hierarchyProfile: instantiated.hierarchyProfile,
      };
      if (startOverReplacement) {
        await startOverSpatial.mutateAsync({
          ...request,
          replacementCurrentLocationId: instantiated.definition.startingLocationId,
          breakHistoryContinuity: true,
        });
      } else {
        await updateSpatial.mutateAsync(request);
      }
      toast.success(
        startOverReplacement ? `Replaced with “${template.name}”.` : `Added “${template.name}” to ${chatName || "the chat"}.`,
      );
      onAppliedToChat?.();
    } catch (error) {
      if (enablementChanged) {
        try {
          await onEnabledForChatChange?.(false);
        } catch {
          // Preserve the original apply error; the chat settings control still exposes the enabled state.
        }
      }
      toast.error(error instanceof Error ? error.message : "The map template could not be added to this chat.");
    }
  };

  if (editingSharedWorld) {
    return (
      <SpatialMapWorkspace
        chatId={null}
        sharedWorld={editingSharedWorld}
        initialUnresolvedLoreReferences={editingUnresolvedLoreReferences}
        onOpenLorebook={onOpenLorebook}
        onLorebooksChanged={onLorebooksChanged}
        onClose={() => {
          setEditingSharedWorldId(null);
          setEditingUnresolvedLoreReferences([]);
        }}
      />
    );
  }

  if (editingTemplate) {
    return (
      <SpatialMapWorkspace
        chatId={null}
        template={editingTemplate}
        initialUnresolvedLoreReferences={editingUnresolvedLoreReferences}
        onOpenLorebook={onOpenLorebook}
        onLorebooksChanged={onLorebooksChanged}
        onClose={() => {
          setEditingId(null);
          setEditingUnresolvedLoreReferences([]);
        }}
      />
    );
  }

  return (
    <div className="mari-editor-shell flex min-h-0 flex-1 flex-col overflow-hidden" data-marinara-map-template-library>
      {pendingConfirmation && (
        <div
          ref={confirmationDialogRef}
          data-chat-floating-panel
          role="dialog"
          aria-modal="true"
          aria-label={pendingConfirmation.title ?? "Confirm map template action"}
          aria-describedby="marinara-map-library-confirmation-message"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--background)]/85 p-3 sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) resolveConfirmation(false);
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-2xl">
            <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
              <h2 className="text-base font-semibold text-[var(--foreground)]">
                {pendingConfirmation.title ?? "Confirm map template action"}
              </h2>
            </div>
            <p
              id="marinara-map-library-confirmation-message"
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
                className={
                  pendingConfirmation.tone === "destructive"
                    ? "mari-chrome-control mari-chrome-control--danger min-h-11 w-full px-4 text-sm sm:w-auto"
                    : "mari-editor-action mari-editor-action--primary min-h-11 w-full px-4 text-sm sm:w-auto"
                }
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
      <header className="mari-editor-header">
        <button
          type="button"
          onClick={onClose}
          className="mari-editor-action inline-flex min-h-11 min-w-11"
          aria-label="Back to Maps"
        >
          <ArrowLeft size="1.125rem" />
        </button>
        <div className="mari-editor-icon-tile">
          <Map size="1.125rem" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-[var(--marinara-editor-title)]">World map library</h1>
          <p className="text-[0.625rem] text-[var(--marinara-editor-muted)]">
            {supportedChat
              ? `Choose a shared world or independent template copy for ${chatName || "this chat"}`
              : "Link one durable world across chats or create independent template copies"}
          </p>
        </div>
        <div className="mari-editor-actions flex max-sm:w-full max-sm:border-t max-sm:border-[var(--marinara-editor-divider)] max-sm:pt-2">
          <a
            href={WORLD_MAPS_GUIDE_URL}
            target="_blank"
            rel="noreferrer"
            className="mari-editor-action inline-flex min-h-11 px-3 text-xs"
            title="Open World Maps guide"
          >
            <CircleHelp size="0.8125rem" /> Guide
          </a>
          <button
            type="button"
            onClick={() => openImportPicker("shared-world")}
            className="mari-editor-action inline-flex min-h-11 px-3 text-xs"
          >
            <Download size="0.8125rem" /> Import shared
          </button>
          <button
            type="button"
            onClick={() => void createBlankSharedWorld()}
            disabled={createSharedWorld.isPending}
            className="mari-editor-action mari-editor-action--primary inline-flex min-h-11 px-3 text-xs disabled:opacity-45"
          >
            {createSharedWorld.isPending ? (
              <Loader2 size="0.8125rem" className="animate-spin" />
            ) : (
              <Link2 size="0.8125rem" />
            )}
            New shared world
          </button>
          <button
            type="button"
            onClick={() => openImportPicker("template")}
            className="mari-editor-action inline-flex min-h-11 px-3 text-xs"
          >
            <Download size="0.8125rem" /> Import template
          </button>
          <button
            type="button"
            onClick={() => void createBlank()}
            disabled={createTemplate.isPending}
            className="mari-editor-action mari-editor-action--primary inline-flex min-h-11 px-3 text-xs disabled:opacity-45"
          >
            {createTemplate.isPending ? (
              <Loader2 size="0.8125rem" className="animate-spin" />
            ) : (
              <Plus size="0.8125rem" />
            )}
            New map template
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => void importTemplate(event)}
          />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search world maps</span>
              <Search
                size="0.875rem"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--marinara-editor-muted)]"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search shared worlds and templates"
                className="mari-editor-field min-h-11 w-full pl-9 pr-3 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                void templates.refetch();
                void sharedWorlds.refetch();
              }}
              disabled={templates.isFetching || sharedWorlds.isFetching}
              className="mari-editor-action inline-flex min-h-11 justify-center px-3 text-xs disabled:opacity-45"
            >
              <RefreshCw
                size="0.8125rem"
                className={templates.isFetching || sharedWorlds.isFetching ? "animate-spin" : ""}
              />{" "}
              Refresh
            </button>
          </div>

          <section className="mb-8" aria-labelledby="shared-worlds-heading">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-[var(--marinara-editor-divider)] pb-3">
              <div>
                <h2 id="shared-worlds-heading" className="text-sm font-semibold text-[var(--marinara-editor-title)]">
                  Shared worlds
                </h2>
                <p className="mt-1 max-w-2xl text-xs text-[var(--marinara-editor-muted)]">
                  One canonical definition and Global Gallery artwork set. Each linked chat keeps separate travel
                  history and unpublished discoveries.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void createBlankSharedWorld()}
                disabled={createSharedWorld.isPending}
                className="mari-editor-action inline-flex min-h-11 px-3 text-xs disabled:opacity-45"
              >
                <Plus size="0.75rem" /> New shared world
              </button>
            </div>
            {sharedWorlds.isLoading ? (
              <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-[var(--marinara-editor-muted)]">
                <Loader2 className="animate-spin" /> Loading shared worlds…
              </div>
            ) : sharedWorlds.isError ? (
              <div role="alert" className="mari-editor-panel p-5 text-sm text-[var(--destructive)]">
                Shared worlds could not be loaded.
              </div>
            ) : visibleSharedWorlds.length === 0 ? (
              <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] px-6 text-center">
                <Link2 size="1.5rem" className="text-[var(--marinara-editor-muted)]" />
                <h3 className="mt-3 text-sm font-semibold">
                  {query.trim() ? "No matching shared worlds" : "No shared worlds yet"}
                </h3>
                <p className="mt-1 max-w-md text-xs text-[var(--marinara-editor-muted)]">
                  {query.trim()
                    ? "Try a different search."
                    : "Create one directly, or promote an existing template below."}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleSharedWorlds.map((world) => {
                  const linkedHere = spatial.data?.sharedWorld.worldId === world.id;
                  return (
                    <article key={world.id} className="mari-editor-panel flex min-h-52 flex-col p-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-accent)]">
                          <Link2 size="1rem" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-semibold">{world.name}</h3>
                          <p className="mt-1 text-[0.6875rem] text-[var(--marinara-editor-muted)]">
                            {world.data.definition.locations.length}{" "}
                            {world.data.definition.locations.length === 1 ? "location" : "locations"} · revision{" "}
                            {world.revision}
                          </p>
                          <p className="mt-1 text-[0.6875rem] text-[var(--marinara-editor-muted)]">
                            {world.linkedChatCount} linked chat
                            {world.linkedChatCount === 1 ? "" : "s"}
                            {linkedHere ? " · linked here" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                        <button
                          type="button"
                          onClick={() => setEditingSharedWorldId(world.id)}
                          className="mari-editor-action inline-flex min-h-11 justify-center px-3 text-xs"
                        >
                          <PencilLine size="0.75rem" /> Edit canonical
                        </button>
                        {onSelectSharedWorldForSetup ? (
                          <button
                            type="button"
                            onClick={() => void selectSharedWorldForSetup(world)}
                            disabled={
                              world.data.definition.locations.length === 0 ||
                              !world.data.definition.startingLocationId
                            }
                            className="mari-editor-action mari-editor-action--primary inline-flex min-h-11 justify-center px-3 text-xs disabled:opacity-45"
                          >
                            <Link2 size="0.75rem" /> Use shared world
                          </button>
                        ) : supportedChat ? (
                          <button
                            type="button"
                            onClick={() => void linkWorldToChat(world)}
                            disabled={
                              linkSharedWorld.isPending ||
                              spatial.isLoading ||
                              linkedHere ||
                              world.data.definition.locations.length === 0 ||
                              !world.data.definition.startingLocationId
                            }
                            className="mari-editor-action mari-editor-action--primary inline-flex min-h-11 justify-center px-3 text-xs disabled:opacity-45"
                          >
                            <Link2 size="0.75rem" /> {linkedHere ? "Linked" : "Link to chat"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void removeSharedWorld(world)}
                            disabled={deleteSharedWorld.isPending || world.linkedChatCount > 0}
                            className="mari-editor-action inline-flex min-h-11 justify-center px-3 text-xs text-[var(--destructive)] disabled:opacity-45"
                          >
                            <Trash2 size="0.75rem" /> Delete
                          </button>
                        )}
                      </div>
                      {supportedChat && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => void copyWorldToChat(world)}
                            disabled={
                              replaceWithIndependentWorld.isPending ||
                              spatial.isLoading ||
                              world.data.definition.locations.length === 0 ||
                              !world.data.definition.startingLocationId
                            }
                            className="mari-editor-action inline-flex min-h-11 justify-center px-3 text-xs disabled:opacity-45"
                          >
                            <GitFork size="0.75rem" /> Independent copy
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeSharedWorld(world)}
                            disabled={deleteSharedWorld.isPending || world.linkedChatCount > 0}
                            title={
                              world.linkedChatCount > 0
                                ? "Fork or relink every attached chat before deleting this world."
                                : undefined
                            }
                            className="mari-editor-action inline-flex min-h-11 justify-center px-3 text-xs text-[var(--destructive)] disabled:opacity-45"
                          >
                            <Trash2 size="0.75rem" /> Delete
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <div className="mb-3 border-b border-[var(--marinara-editor-divider)] pb-3">
            <h2 className="text-sm font-semibold text-[var(--marinara-editor-title)]">Independent templates</h2>
            <p className="mt-1 max-w-2xl text-xs text-[var(--marinara-editor-muted)]">
              Apply a fresh copy when each scenario should diverge safely. Shared Global Gallery artwork is reused
              without duplicating image files.
            </p>
          </div>

          {templates.isLoading ? (
            <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-[var(--marinara-editor-muted)]">
              <Loader2 className="animate-spin" /> Loading map templates…
            </div>
          ) : templates.isError ? (
            <div role="alert" className="mari-editor-panel p-5 text-sm text-[var(--destructive)]">
              Map templates could not be loaded.
            </div>
          ) : visibleTemplates.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] px-6 text-center">
              <Map size="1.5rem" className="text-[var(--marinara-editor-muted)]" />
              <h2 className="mt-3 text-base font-semibold">
                {query.trim() ? "No matching maps" : "No map templates yet"}
              </h2>
              <p className="mt-1 max-w-md text-sm text-[var(--marinara-editor-muted)]">
                {query.trim()
                  ? "Try a different search."
                  : "Create one with AI, build it manually, or import an existing map JSON."}
              </p>
              {!query.trim() && (
                <button
                  type="button"
                  onClick={() => void createBlank()}
                  className="mari-editor-action mari-editor-action--primary mt-4 inline-flex min-h-11 px-4 text-sm"
                >
                  <Plus size="0.875rem" /> New map template
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleTemplates.map((template) => (
                <article key={template.id} className="mari-editor-panel flex min-h-44 flex-col p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-accent)]">
                      <Map size="1rem" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-semibold">{template.name}</h2>
                      <p className="mt-1 text-[0.6875rem] text-[var(--marinara-editor-muted)]">
                        {template.data.definition.locations.length}{" "}
                        {template.data.definition.locations.length === 1 ? "location" : "locations"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                    <button
                      type="button"
                      onClick={() => setEditingId(template.id)}
                      className="mari-editor-action inline-flex min-h-11 justify-center px-3 text-xs"
                    >
                      <PencilLine size="0.75rem" /> Edit
                    </button>
                    {supportedChat || onSelectForSetup ? (
                      <button
                        type="button"
                        onClick={() => void applyToChat(template)}
                        disabled={
                          updateSpatial.isPending ||
                          (!onSelectForSetup && spatial.isLoading) ||
                          template.data.definition.locations.length === 0 ||
                          !template.data.definition.startingLocationId
                        }
                        className="mari-editor-action mari-editor-action--primary inline-flex min-h-11 justify-center px-3 text-xs disabled:opacity-45"
                      >
                        <Plus size="0.75rem" /> {onSelectForSetup ? "Use template" : "Add to chat"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void createSharedWorldFromTemplate(template)}
                        disabled={createSharedWorld.isPending}
                        className="mari-editor-action inline-flex min-h-11 justify-center px-3 text-xs disabled:opacity-45"
                      >
                        <Link2 size="0.75rem" /> Make shared
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(supportedChat || onSelectForSetup) && (
                      <button
                        type="button"
                        onClick={() => void createSharedWorldFromTemplate(template)}
                        disabled={createSharedWorld.isPending}
                        className="mari-editor-action inline-flex min-h-11 justify-center px-3 text-xs disabled:opacity-45"
                      >
                        <Link2 size="0.75rem" /> Make shared
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void removeTemplate(template)}
                      disabled={deleteTemplate.isPending}
                      className={cn(
                        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg text-xs text-[var(--destructive)] hover:bg-[var(--destructive)]/10 disabled:opacity-45",
                        !(supportedChat || onSelectForSetup) && "col-span-2",
                      )}
                    >
                      <Trash2 size="0.75rem" /> Delete template
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
