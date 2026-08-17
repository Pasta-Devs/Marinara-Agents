import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  ImageIcon,
  Link2,
  Loader2,
  LocateFixed,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type {
  Lorebook,
  LorebookEntry,
  GameMap,
  SpatialContextDefinition,
  SpatialDefinitionIssue,
  SpatialLocation,
  SpatialLinkState,
} from "@marinara-engine/shared";
import { cn } from "../package-utils";
import { getSpatialDescendantIds, resolveSpatialBreadcrumb } from "@marinara-engine/shared";
import { canonicalizeSpatialDirectLinks, type SpatialDirectLinkDirection } from "../editor-state";
import { GameMapBindingsPanel } from "./GameMapBindingsPanel";
import {
  DEFAULT_SPATIAL_LINK_PICKER_COLOR,
  SPATIAL_LOCATION_ICON_MAX_LENGTH,
  hierarchyTypeForLocation,
  resolveSpatialLinkPresentation,
  withoutSpatialLinkPresentation,
  withSpatialLinkPresentation,
  type SpatialHierarchyProfile,
  type SpatialLinkLineStyle,
} from "../../../../../maps-shared/src/maps-model";
import {
  resolveSpatialArtworkImage,
  spatialArtworkImages,
  uploadSpatialGalleryImage,
  useGenerateSpatialGalleryImage,
  useSpatialGalleryImages,
  useSpatialGlobalGalleryImages,
  type SpatialArtworkImage,
  type SpatialGalleryImage,
} from "../use-spatial-resources";

const INPUT_CLASS =
  "w-full rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--marinara-chat-chrome-panel-text)] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--marinara-chat-chrome-panel-muted)] focus:border-[var(--marinara-chat-chrome-button-border-active)] focus:ring-2 focus:ring-[var(--marinara-chat-chrome-focus-ring)]";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between gap-2 text-xs font-medium text-[var(--marinara-chat-chrome-panel-title)]">
        {label}
        {hint && (
          <span className="text-[0.625rem] font-normal text-[var(--marinara-chat-chrome-panel-muted)]">{hint}</span>
        )}
      </span>
      {children}
      {error && <span className="block text-[0.6875rem] text-red-400">{error}</span>}
    </label>
  );
}

function GalleryImagePicker({
  title,
  images,
  selectedId,
  isLoading,
  isError,
  onSelect,
  onConfirm,
  onRefresh,
  onClose,
}: {
  title: string;
  images: SpatialArtworkImage[];
  selectedId: string | null;
  isLoading: boolean;
  isError: boolean;
  onSelect: (imageId: string) => void;
  onConfirm: () => void;
  onRefresh: () => void;
  onClose: () => void;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)]">
      <div className="flex min-h-11 items-center gap-2 border-b border-[var(--marinara-chat-chrome-panel-divider)] px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
          {title}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className="mari-chrome-control h-9 w-9 justify-center p-0"
          aria-label="Refresh Gallery images"
          title="Refresh Gallery images"
        >
          <RefreshCw size="0.75rem" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mari-chrome-control h-9 w-9 justify-center p-0"
          aria-label="Close Gallery picker"
          title="Close Gallery picker"
        >
          <X size="0.75rem" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex min-h-32 items-center justify-center gap-2 text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
          <Loader2 size="0.875rem" className="animate-spin" /> Loading Gallery…
        </div>
      ) : isError ? (
        <div className="px-4 py-8 text-center text-xs text-red-400">The Gallery could not be loaded.</div>
      ) : images.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
          No artwork is available. Add an image to this chat&apos;s Gallery or the shared Global Gallery, then refresh.
        </div>
      ) : (
        <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto p-2 sm:grid-cols-3">
          {images.map((image) => {
            const selected = image.referenceId === selectedId;
            return (
              <button
                key={image.referenceId}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(image.referenceId)}
                title={image.prompt || "Gallery image"}
                className={cn(
                  "group relative min-h-24 overflow-hidden rounded-lg border bg-[var(--marinara-chat-chrome-panel-bg)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]",
                  selected
                    ? "border-[var(--marinara-chat-chrome-button-border-active)] ring-2 ring-[var(--marinara-chat-chrome-focus-ring)]"
                    : "border-[var(--marinara-chat-chrome-panel-border)] hover:border-[var(--marinara-chat-chrome-button-border-active)]",
                )}
              >
                <img src={image.url} alt="" loading="lazy" className="h-24 w-full object-cover" />
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[var(--marinara-chat-chrome-panel-bg)]/90 px-2 py-0.5 text-[0.625rem] font-medium text-[var(--marinara-chat-chrome-panel-text)] shadow-sm">
                  {image.source === "global" ? "Shared" : "This chat"}
                </span>
                {selected && (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm">
                    <Check size="0.75rem" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 border-t border-[var(--marinara-chat-chrome-panel-divider)] p-2">
        <button type="button" onClick={onClose} className="mari-chrome-control min-h-11 justify-center px-3 text-xs">
          Cancel
        </button>
        <button
          type="button"
          disabled={!selectedId}
          onClick={onConfirm}
          className="mari-chrome-control min-h-11 justify-center border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-3 text-xs disabled:opacity-45"
        >
          <Check size="0.75rem" /> Use selected
        </button>
      </div>
    </div>
  );
}

export function defaultLocationReferencePrompt(location: SpatialLocation): string {
  const description = location.description.trim();
  return [
    `Wide establishing image of ${location.name.trim() || "this location"}.`,
    description,
    "Show the environment, architecture, lighting, palette, and stable landmarks clearly. No text.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function locationArtworkContext(
  definition: SpatialContextDefinition,
  hierarchyProfile: SpatialHierarchyProfile,
  location: SpatialLocation,
) {
  const parent = location.parentId
    ? (definition.locations.find((candidate) => candidate.id === location.parentId) ?? null)
    : null;
  return {
    locationName: location.name.trim() || "this location",
    locationDescription: location.description.trim(),
    locationType: hierarchyTypeForLocation(hierarchyProfile, location).label,
    parentLocationName: parent?.name.trim() ?? "",
    parentLocationDescription: parent?.description.trim() ?? "",
    locationPath: resolveSpatialBreadcrumb(definition, location.id)
      .map((entry) => entry.name.trim())
      .filter(Boolean)
      .join(" > "),
  };
}

interface LocationInspectorProps {
  chatId: string;
  artworkEnabled?: boolean;
  allowChatArtwork?: boolean;
  debugMode?: boolean;
  definition: SpatialContextDefinition;
  location: SpatialLocation | null;
  issues: SpatialDefinitionIssue[];
  currentLocationId: string | null;
  hierarchyProfile: SpatialHierarchyProfile;
  onHierarchyTypeChange: (typeId: string) => void;
  onHierarchyProfileChange: (profile: SpatialHierarchyProfile) => void;
  onUpdate: (patch: Partial<SpatialLocation>) => void;
  onUpdateDirectLink: (
    firstLocationId: string,
    secondLocationId: string,
    patch: Partial<Omit<SpatialLocation["links"][number], "targetId" | "bidirectional">>,
  ) => void;
  onSetDirectLinkDirection: (relatedLocationId: string, direction: SpatialDirectLinkDirection) => void;
  onRemoveDirectLink: (firstLocationId: string, secondLocationId: string) => void;
  onSelectLocation: (locationId: string) => void;
  lorebooks?: Lorebook[];
  lorebookEntries?: LorebookEntry[];
  excludedLorebookIds?: string[];
  lorebooksLoading?: boolean;
  onOpenLorebook?: (lorebookId: string) => void;
  onReparent: (parentId: string | null) => void;
  onSetStarting: () => void;
  onSetCurrent?: () => void;
  onArchive: () => void;
  onDeletePermanently?: () => void;
  permanentDeleteProtection?: string | null;
  permanentDeleteCount?: number;
  gameBinding?: {
    chatId: string;
    maps: GameMap[];
    disabled: boolean;
  };
}

interface LocationDirectLinkRow {
  source: SpatialLocation;
  related: SpatialLocation | null;
  link: SpatialLocation["links"][number];
  direction: SpatialDirectLinkDirection;
}

export function resolveLocationDirectLinkRows(
  definition: SpatialContextDefinition,
  location: SpatialLocation,
): LocationDirectLinkRow[] {
  const canonical = canonicalizeSpatialDirectLinks(definition);
  const locationsById = new Map(canonical.locations.map((candidate) => [candidate.id, candidate]));
  const current = locationsById.get(location.id);
  if (!current) return [];
  const outgoing: LocationDirectLinkRow[] = current.links.map((link) => ({
    source: current,
    related: locationsById.get(link.targetId) ?? null,
    link,
    direction: link.bidirectional ? "both" : "outgoing",
  }));
  const incoming: LocationDirectLinkRow[] = [];
  for (const source of canonical.locations) {
    if (source.id === current.id) continue;
    source.links.forEach((link) => {
      if (link.targetId !== current.id) return;
      incoming.push({
        source,
        related: source,
        link,
        direction: link.bidirectional ? "both" : "incoming",
      });
    });
  }
  incoming.sort((left, right) => {
    const nameOrder = (left.related?.name ?? "").localeCompare(right.related?.name ?? "");
    return nameOrder || left.source.id.localeCompare(right.source.id);
  });
  return [...outgoing, ...incoming];
}

export function LocationInspector({
  chatId,
  artworkEnabled = true,
  allowChatArtwork = true,
  debugMode = false,
  definition,
  location,
  issues,
  currentLocationId,
  hierarchyProfile,
  onHierarchyTypeChange,
  onHierarchyProfileChange,
  onUpdate,
  onUpdateDirectLink,
  onSetDirectLinkDirection,
  onRemoveDirectLink,
  onSelectLocation,
  onReparent,
  lorebooks = [],
  lorebookEntries = [],
  excludedLorebookIds = [],
  lorebooksLoading = false,
  onOpenLorebook,
  onSetStarting,
  onSetCurrent,
  onArchive,
  onDeletePermanently,
  permanentDeleteProtection = null,
  permanentDeleteCount = 1,
  gameBinding,
}: LocationInspectorProps) {
  const [loreSearch, setLoreSearch] = useState("");
  const [expandedLorebookIds, setExpandedLorebookIds] = useState<Set<string>>(() => new Set());
  const [newLinkTarget, setNewLinkTarget] = useState("");
  const [galleryPickerTarget, setGalleryPickerTarget] = useState<"reference" | "background" | null>(null);
  const [pendingGalleryImageId, setPendingGalleryImageId] = useState<string | null>(null);
  const [referenceGeneratorOpen, setReferenceGeneratorOpen] = useState(false);
  const [referenceGenerationPrompt, setReferenceGenerationPrompt] = useState("");
  const [generatedReferenceImage, setGeneratedReferenceImage] = useState<SpatialGalleryImage | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<"reference" | "background" | null>(null);
  const [uploadingArtwork, setUploadingArtwork] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const galleryImages = useSpatialGalleryImages(chatId, artworkEnabled && allowChatArtwork && chatId.length > 0);
  const globalGalleryImages = useSpatialGlobalGalleryImages(artworkEnabled);
  const artworkImages = useMemo(
    () => spatialArtworkImages(galleryImages.data, globalGalleryImages.data),
    [galleryImages.data, globalGalleryImages.data],
  );
  const galleryPickerLoading =
    globalGalleryImages.isLoading ||
    (globalGalleryImages.isFetching && globalGalleryImages.data === undefined) ||
    (allowChatArtwork && (galleryImages.isLoading || (galleryImages.isFetching && galleryImages.data === undefined)));
  const galleryPickerError =
    artworkImages.length === 0 && (globalGalleryImages.isError || (allowChatArtwork && galleryImages.isError));
  const generateReferenceImage = useGenerateSpatialGalleryImage(chatId);
  const referenceImage = useMemo(
    () => resolveSpatialArtworkImage(location?.referenceImageId, galleryImages.data, globalGalleryImages.data),
    [galleryImages.data, globalGalleryImages.data, location?.referenceImageId],
  );
  const referenceImageMissing =
    Boolean(location?.referenceImageId) &&
    globalGalleryImages.isSuccess &&
    (!allowChatArtwork || galleryImages.isSuccess) &&
    referenceImage === null;
  const mapBackgroundImage = useMemo(
    () => resolveSpatialArtworkImage(location?.mapBackgroundImageId, galleryImages.data, globalGalleryImages.data),
    [galleryImages.data, globalGalleryImages.data, location?.mapBackgroundImageId],
  );
  const mapBackgroundImageMissing =
    Boolean(location?.mapBackgroundImageId) &&
    globalGalleryImages.isSuccess &&
    (!allowChatArtwork || galleryImages.isSuccess) &&
    mapBackgroundImage === null;
  const sharedArtworkReferenceId =
    location?.referenceImageId && location.referenceImageId === location.mapBackgroundImageId
      ? location.referenceImageId
      : null;
  const descendants = useMemo(
    () => (location ? getSpatialDescendantIds(definition, location.id) : new Set<string>()),
    [definition, location],
  );
  const eligibleParents = definition.locations
    .filter((candidate) => candidate.id !== location?.id && !descendants.has(candidate.id))
    .sort((left, right) => left.name.localeCompare(right.name));
  const directLinkRows = useMemo(
    () => (location ? resolveLocationDirectLinkRows(definition, location) : []),
    [definition, location],
  );
  const linkedLocationIds = useMemo(
    () => new Set(directLinkRows.flatMap(({ related }) => (related ? [related.id] : []))),
    [directLinkRows],
  );
  const eligibleLinks = definition.locations
    .filter((candidate) => candidate.id !== location?.id && !linkedLocationIds.has(candidate.id))
    .sort((left, right) => left.name.localeCompare(right.name));

  const lorebookById = useMemo(() => new Map(lorebooks.map((lorebook) => [lorebook.id, lorebook])), [lorebooks]);
  const loreEntryById = useMemo(() => new Map(lorebookEntries.map((entry) => [entry.id, entry])), [lorebookEntries]);
  const candidateLoreGroups = useMemo(() => {
    const attachedIds = new Set(location?.lorebookEntryIds ?? []);
    const query = loreSearch.trim().toLocaleLowerCase();
    const entriesByLorebook = new Map<string, LorebookEntry[]>();
    for (const entry of lorebookEntries) {
      if (attachedIds.has(entry.id)) continue;
      const entries = entriesByLorebook.get(entry.lorebookId);
      if (entries) entries.push(entry);
      else entriesByLorebook.set(entry.lorebookId, [entry]);
    }
    return lorebooks
      .map((lorebook) => {
        const bookMatches = lorebook.name.toLocaleLowerCase().includes(query);
        return {
          lorebook,
          entries: (entriesByLorebook.get(lorebook.id) ?? []).filter(
            (entry) =>
              !query ||
              bookMatches ||
              entry.name.toLocaleLowerCase().includes(query) ||
              entry.description.toLocaleLowerCase().includes(query) ||
              entry.keys.some((key) => key.toLocaleLowerCase().includes(query)),
          ),
        };
      })
      .filter((group) => group.entries.length > 0);
  }, [location?.lorebookEntryIds, loreSearch, lorebookEntries, lorebooks]);
  const excludedLorebookIdSet = useMemo(() => new Set(excludedLorebookIds), [excludedLorebookIds]);

  useEffect(() => {
    setGalleryPickerTarget(null);
    setPendingGalleryImageId(null);
    setReferenceGeneratorOpen(false);
    setReferenceGenerationPrompt("");
    setGeneratedReferenceImage(null);
    setUploadTarget(null);
    setUploadError(null);
  }, [location?.id]);

  const openGalleryPicker = (target: "reference" | "background") => {
    setReferenceGeneratorOpen(false);
    setGeneratedReferenceImage(null);
    setPendingGalleryImageId(
      target === "reference" ? (location?.referenceImageId ?? null) : (location?.mapBackgroundImageId ?? null),
    );
    setGalleryPickerTarget(target);
    if (allowChatArtwork) void galleryImages.refetch();
    void globalGalleryImages.refetch();
  };

  const confirmGallerySelection = () => {
    if (!pendingGalleryImageId || !galleryPickerTarget) return;
    if (galleryPickerTarget === "reference") {
      onUpdate({ referenceImageId: pendingGalleryImageId, useReferenceImage: true });
    } else {
      onUpdate({ mapBackgroundImageId: pendingGalleryImageId, mapBackgroundPosition: { x: 50, y: 50 } });
    }
    setGalleryPickerTarget(null);
    setPendingGalleryImageId(null);
  };

  const beginArtworkUpload = (target: "reference" | "background") => {
    setGalleryPickerTarget(null);
    setReferenceGeneratorOpen(false);
    setUploadError(null);
    setUploadTarget(target);
    uploadInputRef.current?.click();
  };

  const handleArtworkUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !location || !uploadTarget || !allowChatArtwork || !chatId) return;
    setUploadingArtwork(true);
    setUploadError(null);
    try {
      const uploaded = await uploadSpatialGalleryImage(chatId, file, {
        prompt: `Uploaded ${uploadTarget === "reference" ? "location reference" : "child map background"} for ${location.name}.`,
        provider: "upload",
        model: "user-upload",
        width: null,
        height: null,
      });
      await galleryImages.refetch();
      if (uploadTarget === "reference") {
        onUpdate({ referenceImageId: uploaded.id, useReferenceImage: true });
      } else {
        onUpdate({
          mapBackgroundImageId: uploaded.id,
          mapBackgroundPosition: location.mapBackgroundPosition ?? { x: 50, y: 50 },
        });
      }
      setUploadTarget(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "The image could not be uploaded.");
    } finally {
      setUploadingArtwork(false);
    }
  };

  if (!location) {
    return (
      <section className="flex h-full items-center justify-center px-6 text-center" aria-label="Location details">
        <div>
          <MapPin className="mx-auto mb-3 text-[var(--marinara-chat-chrome-panel-muted)]" size="1.25rem" />
          <h2 className="text-sm font-semibold text-[var(--marinara-chat-chrome-panel-title)]">Select a location</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
            Preview a location here, then use Enter to navigate into it.
          </p>
        </div>
      </section>
    );
  }

  const issueFor = (field: string) => issues.find((issue) => issue.path.at(-1) === field)?.message;
  const removeLink = (sourceId: string, targetId: string) => {
    onRemoveDirectLink(sourceId, targetId);
    onHierarchyProfileChange(withoutSpatialLinkPresentation(hierarchyProfile, sourceId, targetId));
  };
  const addLink = () => {
    if (!newLinkTarget) return;
    onSetDirectLinkDirection(newLinkTarget, "outgoing");
    setNewLinkTarget("");
  };

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={`Details for ${location.name}`}>
      <div className="border-b border-[var(--marinara-chat-chrome-panel-divider)] px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPin size="0.875rem" className="text-[var(--marinara-chat-chrome-accent)]" />
          <h2 className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-[var(--marinara-chat-chrome-panel-title)]">
            Location details
          </h2>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[0.625rem] font-medium",
              location.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400",
            )}
          >
            {location.status}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {issues.length > 0 && (
          <div
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
            role="alert"
          >
            <p className="font-semibold">This location needs attention</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {issues.map((issue, index) => (
                <li key={`${issue.code}-${index}`}>{issue.message}</li>
              ))}
            </ul>
          </div>
        )}

        <Field label="Name" error={issueFor("name")}>
          <input
            className={INPUT_CLASS}
            value={location.name}
            onChange={(event) => onUpdate({ name: event.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Location type" hint={`Uses ${location.kind} rules`}>
            <select
              className={INPUT_CLASS}
              value={
                hierarchyProfile.locationTypeIds[location.id] ??
                hierarchyProfile.types.find((type) => type.baseKind === location.kind)?.id ??
                hierarchyProfile.types[0]?.id
              }
              onChange={(event) => onHierarchyTypeChange(event.target.value)}
            >
              {hierarchyProfile.types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Icon"
            hint={`One emoji or short symbol · ${SPATIAL_LOCATION_ICON_MAX_LENGTH} max`}
            error={
              (location.icon?.length ?? 0) > SPATIAL_LOCATION_ICON_MAX_LENGTH
                ? `Shorten this icon to ${SPATIAL_LOCATION_ICON_MAX_LENGTH} characters or fewer.`
                : undefined
            }
          >
            <input
              className={INPUT_CLASS}
              value={location.icon ?? ""}
              maxLength={SPATIAL_LOCATION_ICON_MAX_LENGTH}
              placeholder="⌖"
              onChange={(event) => onUpdate({ icon: event.target.value || undefined })}
            />
          </Field>
        </div>

        <Field label="Public description" hint="Shown in location context" error={issueFor("description")}>
          <textarea
            className={`${INPUT_CLASS} min-h-24 resize-y`}
            value={location.description}
            onChange={(event) => onUpdate({ description: event.target.value })}
          />
        </Field>

        <Field label="Private model memory" hint="AI only" error={issueFor("modelMemory")}>
          <textarea
            className={`${INPUT_CLASS} min-h-28 resize-y`}
            value={location.modelMemory ?? ""}
            placeholder="Facts the model should remember only while this location is active"
            onChange={(event) => onUpdate({ modelMemory: event.target.value || undefined })}
          />
        </Field>

        <Field label="Awareness summary" hint="Short orientation cue" error={issueFor("awarenessSummary")}>
          <textarea
            className={`${INPUT_CLASS} min-h-20 resize-y`}
            value={location.awarenessSummary ?? ""}
            onChange={(event) => onUpdate({ awarenessSummary: event.target.value || undefined })}
          />
        </Field>

        {artworkEnabled && (
          <div className="border-t border-[var(--marinara-chat-chrome-panel-divider)] pt-4">
            <div className="mb-3 flex items-center gap-2">
              <ImageIcon size="0.8125rem" className="text-[var(--marinara-chat-chrome-accent)]" />
              <h3 className="text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                Location reference image
              </h3>
            </div>
            <p className="mb-3 text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
              Choose a reviewed image from this chat or the shared Global Gallery. One image anchors this
              location&apos;s look.
            </p>
            {sharedArtworkReferenceId && (
              <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-text)]">
                This Gallery image fills both the location reference and child-map background. Removing only one role
                keeps the other link.
                {allowChatArtwork ? " Reject both roles to create one clean replacement." : ""}
              </div>
            )}

            <div className="overflow-hidden rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)]">
              {referenceImage ? (
                <img
                  src={referenceImage.url}
                  alt={`${location.name} location reference`}
                  loading="lazy"
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="flex min-h-32 items-center justify-center px-4 text-center text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                  {galleryPickerLoading && location.referenceImageId ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size="0.75rem" className="animate-spin" /> Loading reference image…
                    </span>
                  ) : referenceImageMissing ? (
                    "This Gallery image is no longer available. Choose a replacement or remove the link."
                  ) : galleryPickerError ? (
                    "Available artwork could not be loaded."
                  ) : (
                    "No reference image yet."
                  )}
                </div>
              )}
            </div>

            {allowChatArtwork && (
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => void handleArtworkUpload(event)}
              />
            )}

            <div className={cn("mt-3 grid gap-2", allowChatArtwork ? "grid-cols-3" : "grid-cols-1")}>
              <button
                type="button"
                onClick={() => openGalleryPicker("reference")}
                className="mari-chrome-control min-h-11 justify-center px-3 text-xs"
              >
                <ImageIcon size="0.75rem" /> Choose artwork
              </button>
              {allowChatArtwork && (
                <button
                  type="button"
                  disabled={uploadingArtwork}
                  onClick={() => beginArtworkUpload("reference")}
                  className="mari-chrome-control min-h-11 justify-center px-3 text-xs disabled:opacity-45"
                  aria-label="Upload location reference"
                >
                  {uploadingArtwork && uploadTarget === "reference" ? (
                    <Loader2 size="0.75rem" className="animate-spin" />
                  ) : (
                    <Upload size="0.75rem" />
                  )}{" "}
                  Upload
                </button>
              )}
              {allowChatArtwork && (
                <button
                  type="button"
                  onClick={() => {
                    setGalleryPickerTarget(null);
                    setGeneratedReferenceImage(null);
                    setReferenceGenerationPrompt(defaultLocationReferencePrompt(location));
                    setReferenceGeneratorOpen(true);
                    generateReferenceImage.reset();
                  }}
                  className="mari-chrome-control min-h-11 justify-center px-3 text-xs"
                >
                  <Sparkles size="0.75rem" /> Create with AI
                </button>
              )}
            </div>
            {uploadError && <p className="mt-2 text-[0.6875rem] text-red-400">{uploadError}</p>}
            {location.referenceImageId && (
              <button
                type="button"
                onClick={() => onUpdate({ referenceImageId: undefined, useReferenceImage: false })}
                className="mari-chrome-control mt-2 min-h-11 w-full justify-center px-3 text-xs"
              >
                <Trash2 size="0.75rem" /> {sharedArtworkReferenceId ? "Remove reference only" : "Remove reference"}
              </button>
            )}
            {sharedArtworkReferenceId && allowChatArtwork && (
              <button
                type="button"
                onClick={() => {
                  onUpdate({
                    referenceImageId: undefined,
                    useReferenceImage: false,
                    mapBackgroundImageId: undefined,
                    mapBackgroundPosition: undefined,
                  });
                  setGalleryPickerTarget(null);
                  setGeneratedReferenceImage(null);
                  setReferenceGenerationPrompt(defaultLocationReferencePrompt(location));
                  setReferenceGeneratorOpen(true);
                  generateReferenceImage.reset();
                }}
                className="mari-chrome-control mt-2 min-h-11 w-full justify-center border-amber-500/35 bg-amber-500/10 px-3 text-xs"
              >
                <RefreshCw size="0.75rem" /> Reject both and create replacement
              </button>
            )}

            {galleryPickerTarget === "reference" && (
              <GalleryImagePicker
                title="Choose location reference"
                images={artworkImages}
                selectedId={pendingGalleryImageId}
                isLoading={galleryPickerLoading}
                isError={galleryPickerError}
                onSelect={setPendingGalleryImageId}
                onConfirm={confirmGallerySelection}
                onRefresh={() => {
                  if (allowChatArtwork) void galleryImages.refetch();
                  void globalGalleryImages.refetch();
                }}
                onClose={() => {
                  setGalleryPickerTarget(null);
                  setPendingGalleryImageId(null);
                }}
              />
            )}

            {referenceGeneratorOpen && (
              <div className="mt-3 space-y-3 rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] p-3">
                <div className="flex items-center gap-2">
                  <Sparkles size="0.8125rem" className="text-[var(--marinara-chat-chrome-accent)]" />
                  <p className="min-w-0 flex-1 text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                    Create location reference
                  </p>
                  <button
                    type="button"
                    disabled={generateReferenceImage.isPending}
                    onClick={() => {
                      setReferenceGeneratorOpen(false);
                      setGeneratedReferenceImage(null);
                    }}
                    className="mari-chrome-control h-9 w-9 justify-center p-0"
                    aria-label="Close AI reference creator"
                    title="Close AI reference creator"
                  >
                    <X size="0.75rem" />
                  </button>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-[0.6875rem] font-medium text-[var(--marinara-chat-chrome-panel-title)]">
                    Image prompt
                  </span>
                  <textarea
                    className={`${INPUT_CLASS} min-h-28 resize-y`}
                    value={referenceGenerationPrompt}
                    maxLength={7_000}
                    disabled={generateReferenceImage.isPending}
                    onChange={(event) => setReferenceGenerationPrompt(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={generateReferenceImage.isPending || !referenceGenerationPrompt.trim()}
                  onClick={() => {
                    setGeneratedReferenceImage(null);
                    generateReferenceImage.mutate(
                      {
                        prompt: referenceGenerationPrompt.trim(),
                        mapsArtworkContext: locationArtworkContext(definition, hierarchyProfile, location),
                        debugMode,
                      },
                      { onSuccess: setGeneratedReferenceImage },
                    );
                  }}
                  className="mari-chrome-control min-h-11 w-full justify-center border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-3 text-xs disabled:opacity-45"
                >
                  {generateReferenceImage.isPending ? (
                    <Loader2 size="0.75rem" className="animate-spin" />
                  ) : (
                    <Sparkles size="0.75rem" />
                  )}
                  {generateReferenceImage.isPending ? "Creating image…" : "Generate into Gallery"}
                </button>
                {generateReferenceImage.isError && (
                  <p className="text-[0.6875rem] text-red-400" role="alert">
                    {generateReferenceImage.error instanceof Error
                      ? generateReferenceImage.error.message
                      : "The location reference could not be generated."}
                  </p>
                )}
                {generatedReferenceImage && (
                  <div className="overflow-hidden rounded-lg border border-[var(--marinara-chat-chrome-panel-border)]">
                    <img
                      src={generatedReferenceImage.url}
                      alt={`Generated reference candidate for ${location.name}`}
                      className="h-40 w-full object-cover"
                    />
                    <p className="px-3 pt-2 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                      Saved to Gallery. Review it before making it this location&apos;s reference.
                    </p>
                    <div
                      className={cn(
                        "grid gap-2 p-2",
                        location.childPresentation === "map" ? "grid-cols-3" : "grid-cols-2",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setReferenceGeneratorOpen(false);
                          setGeneratedReferenceImage(null);
                        }}
                        className="mari-chrome-control min-h-11 justify-center px-3 text-xs"
                      >
                        Keep in Gallery
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onUpdate({ referenceImageId: generatedReferenceImage.id, useReferenceImage: true });
                          setReferenceGeneratorOpen(false);
                          setGeneratedReferenceImage(null);
                        }}
                        className="mari-chrome-control min-h-11 justify-center border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-3 text-xs"
                      >
                        <Check size="0.75rem" /> Use as reference
                      </button>
                      {location.childPresentation === "map" && (
                        <button
                          type="button"
                          onClick={() => {
                            onUpdate({
                              referenceImageId: generatedReferenceImage.id,
                              useReferenceImage: true,
                              mapBackgroundImageId: generatedReferenceImage.id,
                              mapBackgroundPosition: location.mapBackgroundPosition ?? { x: 50, y: 50 },
                            });
                            setReferenceGeneratorOpen(false);
                            setGeneratedReferenceImage(null);
                          }}
                          className="mari-chrome-control min-h-11 justify-center border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-3 text-xs"
                        >
                          <Check size="0.75rem" /> Use for both
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <label className="mt-3 flex min-h-11 items-center gap-2 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] px-3 text-xs text-[var(--marinara-chat-chrome-panel-text)]">
              <input
                type="checkbox"
                checked={location.useReferenceImage === true}
                disabled={!referenceImage}
                onChange={(event) => onUpdate({ useReferenceImage: event.target.checked })}
              />
              Use for Roleplay illustrations and Game storyboards
            </label>
          </div>
        )}

        <details
          data-marinara-linked-lore
          className="group rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)]"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
            <BookOpen size="0.8125rem" className="text-[var(--marinara-chat-chrome-accent)]" />
            <span className="flex-1">Linked lore</span>
            <span className="rounded-full bg-[var(--marinara-chat-chrome-highlight-bg)] px-2 py-0.5 text-[0.625rem] font-medium text-[var(--marinara-chat-chrome-panel-muted)]">
              {location.lorebookEntryIds.length}
            </span>
            <ChevronRight
              data-marinara-disclosure-indicator
              size="0.875rem"
              aria-hidden="true"
              className="shrink-0 text-[var(--marinara-chat-chrome-panel-muted)] transition-transform duration-200 group-open:rotate-90"
            />
          </summary>
          <div className="space-y-3 border-t border-[var(--marinara-chat-chrome-panel-divider)] p-3">
            <p className="text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
              These entries activate only while this exact location is current. Parent and child locations do not
              inherit them.
            </p>

            {location.lorebookEntryIds.length > 0 && (
              <div className="space-y-2">
                {location.lorebookEntryIds.map((entryId) => {
                  const entry = loreEntryById.get(entryId);
                  const lorebook = entry ? lorebookById.get(entry.lorebookId) : undefined;
                  const excluded = Boolean(lorebook && excludedLorebookIdSet.has(lorebook.id));
                  const disabled = entry?.enabled === false || lorebook?.enabled === false;
                  return (
                    <div
                      key={entryId}
                      className={cn(
                        "rounded-lg border px-3 py-2",
                        !entry
                          ? "border-red-500/30 bg-red-500/10"
                          : excluded || disabled
                            ? "border-amber-500/30 bg-amber-500/10"
                            : "border-[var(--marinara-chat-chrome-panel-border)]",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-[var(--marinara-chat-chrome-panel-title)]">
                            {entry?.name ?? "Missing lore entry"}
                          </p>
                          <p className="mt-0.5 truncate text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                            {!entry
                              ? "The original entry name is unavailable."
                              : excluded
                                ? `${lorebook?.name ?? "Lorebook"} · excluded from this chat`
                                : disabled
                                  ? `${lorebook?.name ?? "Lorebook"} · disabled`
                                  : (lorebook?.name ?? "Unknown lorebook")}
                          </p>
                        </div>
                        {entry && lorebook && onOpenLorebook && (
                          <button
                            type="button"
                            onClick={() => onOpenLorebook(lorebook.id)}
                            className="mari-chrome-control min-h-11 px-2 text-[0.625rem]"
                          >
                            Open
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            onUpdate({
                              lorebookEntryIds: location.lorebookEntryIds.filter((id) => id !== entryId),
                            })
                          }
                          className="mari-chrome-control min-h-11 px-2 text-[0.625rem]"
                        >
                          Detach
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="relative">
              <Search
                size="0.75rem"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--marinara-chat-chrome-panel-muted)]"
              />
              <input
                className={`${INPUT_CLASS} min-h-11 pl-8`}
                value={loreSearch}
                aria-label="Search lorebook names and entries"
                placeholder="Search lore entries"
                onChange={(event) => setLoreSearch(event.target.value)}
              />
            </div>

            {lorebooksLoading ? (
              <p className="py-3 text-center text-xs text-[var(--marinara-chat-chrome-panel-muted)]">Loading lore…</p>
            ) : candidateLoreGroups.length === 0 ? (
              <p className="py-3 text-center text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
                No available entries match this search.
              </p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {candidateLoreGroups.map(({ lorebook, entries }) => {
                  const bookUnavailable = lorebook.enabled === false || excludedLorebookIdSet.has(lorebook.id);
                  const searchActive = loreSearch.trim().length > 0;
                  const expanded = searchActive || expandedLorebookIds.has(lorebook.id);
                  return (
                    <details
                      key={lorebook.id}
                      data-marinara-lorebook-group={lorebook.id}
                      open={expanded}
                      onToggle={(event) => {
                        if (searchActive) return;
                        const open = event.currentTarget.open;
                        setExpandedLorebookIds((current) => {
                          const next = new Set(current);
                          if (open) next.add(lorebook.id);
                          else next.delete(lorebook.id);
                          return next;
                        });
                      }}
                      className="group/lorebook overflow-hidden rounded-lg border border-[var(--marinara-chat-chrome-panel-border)]"
                    >
                      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-left">
                        <ChevronRight
                          size="0.8125rem"
                          aria-hidden="true"
                          className="shrink-0 text-[var(--marinara-chat-chrome-panel-muted)] transition-transform duration-200 group-open/lorebook:rotate-90"
                        />
                        <span className="min-w-0 flex-1 truncate text-[0.6875rem] font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                          {lorebook.name}
                          {bookUnavailable ? " · unavailable" : ""}
                        </span>
                        <span className="rounded-full bg-[var(--marinara-chat-chrome-highlight-bg)] px-2 py-0.5 text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                          {entries.length}
                        </span>
                      </summary>
                      <div className="space-y-1 border-t border-[var(--marinara-chat-chrome-panel-divider)] p-2">
                        {entries.map((entry) => {
                          const unavailable = bookUnavailable || entry.enabled === false;
                          return (
                            <button
                              key={entry.id}
                              type="button"
                              disabled={unavailable}
                              title={
                                unavailable
                                  ? "Enable this entry and lorebook, and remove chat exclusions, before attaching."
                                  : undefined
                              }
                              onClick={() => onUpdate({ lorebookEntryIds: [...location.lorebookEntryIds, entry.id] })}
                              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] px-3 py-2 text-left text-xs hover:bg-[var(--marinara-chat-chrome-highlight-bg)] disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                              <Plus size="0.75rem" className="shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        </details>
        {gameBinding && (
          <GameMapBindingsPanel
            chatId={gameBinding.chatId}
            location={location}
            definition={definition}
            maps={gameBinding.maps}
            disabled={gameBinding.disabled || location.status !== "active"}
          />
        )}

        <div className="border-t border-[var(--marinara-chat-chrome-panel-divider)] pt-4">
          <h3 className="mb-3 text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
            Hierarchy and display
          </h3>
          <div className="space-y-3">
            <Field label="Parent" error={issueFor("parentId")}>
              <select
                className={INPUT_CLASS}
                value={location.parentId ?? ""}
                onChange={(event) => onReparent(event.target.value || null)}
              >
                <option value="">Top level</option>
                {eligibleParents.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name || "Untitled location"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Child presentation">
              <select
                className={INPUT_CLASS}
                value={location.childPresentation}
                onChange={(event) =>
                  onUpdate({ childPresentation: event.target.value as SpatialLocation["childPresentation"] })
                }
              >
                <option value="list">List</option>
                <option value="map">Map</option>
                <option value="layers">Layers</option>
              </select>
            </Field>
            {location.childPresentation === "map" && (
              <div className="rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-3">
                <div className="flex items-center gap-2">
                  <ImageIcon size="0.75rem" className="text-[var(--marinara-chat-chrome-accent)]" />
                  <p className="text-xs font-medium text-[var(--marinara-chat-chrome-panel-title)]">
                    Child map background
                  </p>
                </div>
                <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
                  Displayed behind the movable places on this map and in the runtime minimap. It is never sent to image
                  generation.
                </p>
                <div className="mt-3 overflow-hidden rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)]">
                  {mapBackgroundImage ? (
                    <img
                      src={mapBackgroundImage.url}
                      alt={`${location.name} child map background`}
                      loading="lazy"
                      className="h-32 w-full object-cover"
                      style={{
                        objectPosition: `${location.mapBackgroundPosition?.x ?? 50}% ${location.mapBackgroundPosition?.y ?? 50}%`,
                      }}
                    />
                  ) : (
                    <div className="flex min-h-24 items-center justify-center px-4 text-center text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                      {galleryPickerLoading && location.mapBackgroundImageId ? (
                        <span className="flex items-center gap-2">
                          <Loader2 size="0.75rem" className="animate-spin" /> Loading map background…
                        </span>
                      ) : mapBackgroundImageMissing ? (
                        "This Gallery image is no longer available."
                      ) : galleryPickerError ? (
                        "Available artwork could not be loaded."
                      ) : (
                        "The map grid is used until you choose a Gallery background."
                      )}
                    </div>
                  )}
                </div>
                <div className={cn("mt-2 grid gap-2", allowChatArtwork ? "grid-cols-3" : "grid-cols-2")}>
                  <button
                    type="button"
                    onClick={() => openGalleryPicker("background")}
                    className="mari-chrome-control min-h-11 justify-center px-3 text-xs"
                  >
                    <ImageIcon size="0.75rem" /> Choose artwork
                  </button>
                  {allowChatArtwork && (
                    <button
                      type="button"
                      disabled={uploadingArtwork}
                      onClick={() => beginArtworkUpload("background")}
                      className="mari-chrome-control min-h-11 justify-center px-3 text-xs disabled:opacity-45"
                      aria-label="Upload child map background"
                    >
                      {uploadingArtwork && uploadTarget === "background" ? (
                        <Loader2 size="0.75rem" className="animate-spin" />
                      ) : (
                        <Upload size="0.75rem" />
                      )}{" "}
                      Upload
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!location.mapBackgroundImageId}
                    onClick={() => onUpdate({ mapBackgroundImageId: undefined, mapBackgroundPosition: undefined })}
                    className="mari-chrome-control min-h-11 justify-center px-3 text-xs"
                  >
                    <Trash2 size="0.75rem" /> Remove
                  </button>
                </div>
                {galleryPickerTarget === "background" && (
                  <GalleryImagePicker
                    title="Choose child map background"
                    images={artworkImages}
                    selectedId={pendingGalleryImageId}
                    isLoading={galleryPickerLoading}
                    isError={galleryPickerError}
                    onSelect={setPendingGalleryImageId}
                    onConfirm={confirmGallerySelection}
                    onRefresh={() => {
                      if (allowChatArtwork) void galleryImages.refetch();
                      void globalGalleryImages.refetch();
                    }}
                    onClose={() => {
                      setGalleryPickerTarget(null);
                      setPendingGalleryImageId(null);
                    }}
                  />
                )}
              </div>
            )}
            {location.placement && (
              <details className="rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)]">
                <summary className="flex min-h-11 cursor-pointer list-none items-center px-3 text-xs font-medium text-[var(--marinara-chat-chrome-panel-title)]">
                  Precision map position
                  <span className="ml-auto text-[0.625rem] font-normal text-[var(--marinara-chat-chrome-panel-muted)]">
                    Advanced
                  </span>
                </summary>
                <div className="grid grid-cols-2 gap-3 border-t border-[var(--marinara-chat-chrome-panel-divider)] p-3">
                  <Field label="Map X" hint="0 to 100" error={issueFor("x")}>
                    <input
                      className={INPUT_CLASS}
                      type="number"
                      min={0}
                      max={100}
                      value={location.placement.x}
                      onChange={(event) =>
                        onUpdate({ placement: { ...location.placement!, x: Number(event.target.value) } })
                      }
                    />
                  </Field>
                  <Field label="Map Y" hint="0 to 100" error={issueFor("y")}>
                    <input
                      className={INPUT_CLASS}
                      type="number"
                      min={0}
                      max={100}
                      value={location.placement.y}
                      onChange={(event) =>
                        onUpdate({ placement: { ...location.placement!, y: Number(event.target.value) } })
                      }
                    />
                  </Field>
                </div>
              </details>
            )}
            {location.layerOrder !== undefined && (
              <Field label="Layer order" error={issueFor("layerOrder")}>
                <input
                  className={INPUT_CLASS}
                  type="number"
                  value={location.layerOrder}
                  onChange={(event) => onUpdate({ layerOrder: Number(event.target.value) })}
                />
              </Field>
            )}
          </div>
        </div>

        <div className="border-t border-[var(--marinara-chat-chrome-panel-divider)] pt-4">
          <div className="mb-3 flex items-center gap-2">
            <Link2 size="0.8125rem" className="text-[var(--marinara-chat-chrome-accent)]" />
            <h3 className="text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">Direct links</h3>
          </div>
          <div className="space-y-2">
            {directLinkRows.map(({ source, related, link, direction }) => {
              const editable = direction !== "incoming";
              const relatedName = related?.name || "Missing location";
              const relatedPath = related
                ? resolveSpatialBreadcrumb(definition, related.id)
                    .map((entry) => entry.name.trim())
                    .filter(Boolean)
                    .join(" > ")
                : "Missing location";
              const directionLabel =
                direction === "both" ? "Both ways" : direction === "incoming" ? "Incoming one-way" : "Outgoing one-way";
              const DirectionIcon =
                direction === "both" ? ArrowLeftRight : direction === "incoming" ? ArrowLeft : ArrowRight;
              const presentation = resolveSpatialLinkPresentation(hierarchyProfile, source.id, link.targetId);
              return (
                <div
                  key={[source.id, link.targetId].sort().join(":")}
                  role="group"
                  aria-label={`${directionLabel} direct link with ${relatedName}`}
                  data-marinara-direct-link-source={source.id}
                  data-marinara-direct-link-target={link.targetId}
                  data-marinara-direct-link-direction={direction}
                  data-marinara-direct-link-editable={editable ? "true" : "false"}
                  className={cn(
                    "rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] p-2.5",
                    !editable && "border-dashed bg-[var(--marinara-chat-chrome-panel-bg)]",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{relatedName}</span>
                      <span
                        className="mt-0.5 block truncate text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]"
                        title={relatedPath}
                      >
                        {relatedPath}
                      </span>
                    </div>
                    {editable && related && (
                      <button
                        type="button"
                        onClick={() => onSelectLocation(related.id)}
                        aria-label={`View linked location ${relatedName}`}
                        title={`View linked location ${relatedName}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--marinara-chat-chrome-panel-muted)] hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--marinara-chat-chrome-panel-title)]"
                      >
                        <LocateFixed size="0.75rem" />
                      </button>
                    )}
                    {editable && (
                      <button
                        type="button"
                        onClick={() => removeLink(source.id, link.targetId)}
                        aria-label={`Remove Direct Link with ${relatedName}`}
                        title={`Remove Direct Link with ${relatedName}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--marinara-chat-chrome-panel-muted)] hover:bg-red-500/10 hover:text-[var(--destructive)]"
                      >
                        <Trash2 size="0.75rem" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-2 text-[0.625rem] font-medium text-[var(--marinara-chat-chrome-panel-title)]">
                      <DirectionIcon size="0.6875rem" /> {directionLabel}
                    </span>
                    {!editable && (
                      <span className="inline-flex min-h-7 items-center rounded-full border border-[var(--marinara-chat-chrome-panel-border)] px-2 text-[0.625rem] capitalize text-[var(--marinara-chat-chrome-panel-muted)]">
                        {link.state}
                      </span>
                    )}
                  </div>
                  {editable ? (
                    <>
                      <input
                        className={`${INPUT_CLASS} mt-2`}
                        value={link.label ?? ""}
                        aria-label={`Link label for ${relatedName}`}
                        placeholder="Optional direction label"
                        onChange={(event) =>
                          onUpdateDirectLink(source.id, link.targetId, {
                            label: event.target.value || undefined,
                          })
                        }
                      />
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <select
                          className={INPUT_CLASS}
                          value={link.state}
                          aria-label={`Link state for ${relatedName}`}
                          onChange={(event) =>
                            onUpdateDirectLink(source.id, link.targetId, {
                              state: event.target.value as SpatialLinkState,
                            })
                          }
                        >
                          <option value="available">Available</option>
                          <option value="hidden">Hidden</option>
                          <option value="blocked">Blocked</option>
                        </select>
                        <select
                          className={INPUT_CLASS}
                          value={direction}
                          aria-label={`Direction for ${relatedName}`}
                          onChange={(event) =>
                            related &&
                            onSetDirectLinkDirection(related.id, event.target.value as SpatialDirectLinkDirection)
                          }
                        >
                          <option value="outgoing">Outgoing</option>
                          <option value="both">Both ways</option>
                          <option value="incoming">Incoming</option>
                        </select>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <select
                          className={INPUT_CLASS}
                          value={presentation.lineStyle}
                          aria-label={`Line style for ${relatedName}`}
                          onChange={(event) =>
                            onHierarchyProfileChange(
                              withSpatialLinkPresentation(hierarchyProfile, source.id, link.targetId, {
                                lineStyle: event.target.value as SpatialLinkLineStyle,
                              }),
                            )
                          }
                        >
                          <option value="solid">Solid line</option>
                          <option value="dashed">Dashed line</option>
                          <option value="dotted">Dotted line</option>
                        </select>
                        <div className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] px-2">
                          <input
                            type="color"
                            value={presentation.color ?? DEFAULT_SPATIAL_LINK_PICKER_COLOR}
                            aria-label={`Line color for ${relatedName}`}
                            title="Choose line color"
                            onChange={(event) =>
                              onHierarchyProfileChange(
                                withSpatialLinkPresentation(hierarchyProfile, source.id, link.targetId, {
                                  color: event.target.value,
                                }),
                              )
                            }
                            className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                          />
                          <span className="min-w-0 flex-1 text-xs">Color</span>
                          {presentation.color && (
                            <button
                              type="button"
                              onClick={() =>
                                onHierarchyProfileChange(
                                  withSpatialLinkPresentation(hierarchyProfile, source.id, link.targetId, {
                                    color: undefined,
                                  }),
                                )
                              }
                              className="min-h-11 rounded-md px-2 text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)] hover:text-[var(--marinara-chat-chrome-panel-title)]"
                            >
                              Auto
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {link.label && (
                        <p className="mt-2 text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-text)]">
                          {link.label}
                        </p>
                      )}
                      {related && (
                        <button
                          type="button"
                          onClick={() => onSelectLocation(source.id)}
                          className="mari-chrome-control mt-2 min-h-11 w-full justify-center px-3 text-xs"
                          aria-label={`View source ${relatedName}`}
                        >
                          <LocateFixed size="0.75rem" /> View source
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            <div className="flex gap-2">
              <select
                className={`${INPUT_CLASS} min-w-0 flex-1`}
                value={newLinkTarget}
                onChange={(event) => setNewLinkTarget(event.target.value)}
              >
                <option value="">Choose location</option>
                {eligibleLinks.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name || "Untitled location"}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!newLinkTarget}
                onClick={addLink}
                className="mari-chrome-control min-h-11 px-3 text-xs"
              >
                <Plus size="0.75rem" /> Link
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--marinara-chat-chrome-panel-divider)] pt-4">
          <h3 className="mb-3 text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">Location status</h3>
          <div className="space-y-2">
            <p className="text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
              The starting location is used when a new story begins. The current story location is where this chat is
              now.
            </p>
            <button
              type="button"
              onClick={onSetStarting}
              disabled={location.status !== "active" || definition.startingLocationId === location.id}
              className="mari-chrome-control min-h-11 w-full justify-start px-3 text-xs"
            >
              <MapPin size="0.75rem" />
              {definition.startingLocationId === location.id ? "Starting location" : "Set as starting location"}
            </button>
            {onSetCurrent && (
              <button
                type="button"
                onClick={onSetCurrent}
                disabled={location.status !== "active" || currentLocationId === location.id}
                className="mari-chrome-control min-h-11 w-full justify-start px-3 text-xs"
              >
                <LocateFixed size="0.75rem" />
                {currentLocationId === location.id ? "Current story location" : "Set current story location"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (location.status === "archived") onUpdate({ status: "active" });
                else onArchive();
              }}
              className={cn(
                "mari-chrome-control min-h-11 w-full justify-start px-3 text-xs",
                location.status === "active" && "mari-chrome-control--danger",
              )}
            >
              <Archive size="0.75rem" />
              {location.status === "archived" ? "Restore location" : "Archive location"}
            </button>
            {location.status === "archived" && onDeletePermanently && (
              <>
                <button
                  type="button"
                  onClick={onDeletePermanently}
                  disabled={Boolean(permanentDeleteProtection)}
                  title={permanentDeleteProtection ?? undefined}
                  className="mari-chrome-control mari-chrome-control--danger min-h-11 w-full justify-start px-3 text-xs disabled:opacity-45"
                >
                  <Trash2 size="0.75rem" />
                  {permanentDeleteCount > 1
                    ? `Delete ${permanentDeleteCount} archived locations permanently`
                    : "Delete permanently"}
                </button>
                {permanentDeleteProtection && (
                  <p className="text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
                    {permanentDeleteProtection}
                  </p>
                )}
              </>
            )}
            {currentLocationId === location.id && (
              <p className="text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
                This is the current story location. Setting another location here corrects the saved state without
                narrating travel.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
