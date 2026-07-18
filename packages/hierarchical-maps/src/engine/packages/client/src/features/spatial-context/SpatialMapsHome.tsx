import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  CircleAlert,
  ClipboardCopy,
  Code2,
  Eye,
  FileText,
  LoaderCircle,
  Map,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  getSpatialContextProblem,
  usePreviewSpatialMapPrompt,
  useSpatialContext,
  useUpdateSpatialGenerationPreferences,
  useUpdateSpatialContext,
  type SpatialMapPromptPreview,
} from "../../hooks/use-spatial-context";
import {
  defaultGenerationPreferences,
  DEFAULT_SPATIAL_GENERATION_PROMPT_OPTION_ID,
  normalizeHierarchyProfile,
  SPATIAL_GENERATION_PROMPT_VARIABLES,
  spatialGenerationPreferencesSchema,
  type SpatialGenerationPreferences,
  type SpatialGenerationCustomVariable,
  type SpatialGenerationPromptOption,
} from "../../../../maps-shared/src/maps-model";
import {
  SpatialHierarchyProfileFields,
  type SpatialHierarchyProfileDraft,
} from "./components/SpatialHierarchyProfileFields";

interface SpatialMapsHomeProps {
  chatId: string | null;
  chatName: string | null;
  chatMode: string | null;
  enabledForChat: boolean;
  packageInfo?: {
    version?: string | null;
    status?: string | null;
    readiness?: string | null;
  } | null;
  onEnabledForChatChange?: (enabled: boolean) => void | Promise<void>;
  onOpenEditor: () => void;
  onManagePackage?: () => void;
  onClose?: () => void;
}

function modeLabel(mode: string | null) {
  if (mode === "roleplay") return "Roleplay";
  if (mode === "game") return "Game";
  if (mode === "visual_novel") return "Visual Novel";
  if (mode === "conversation") return "Conversation";
  return "Chat";
}

const SPATIAL_GENERATION_VARIABLE_DETAILS: Record<
  (typeof SPATIAL_GENERATION_PROMPT_VARIABLES)[number],
  { source: string; description: string }
> = {
  groundingRules: {
    source: "Generated each run",
    description: "Grounding requirements for setup-only or selected-lore generation.",
  },
  targetLocations: {
    source: "Generated each run",
    description: "Suggested location count for the selected draft or expansion size.",
  },
  maxLocations: {
    source: "Generated each run",
    description: "Hard location limit for the selected size and operation.",
  },
  maxDepth: {
    source: "Generated each run",
    description: "Maximum hierarchy depth allowed for this request.",
  },
  hierarchyRules: {
    source: "Generated each run",
    description: "Rules derived from Auto, a built-in hierarchy, or the current custom location types.",
  },
  routeRules: {
    source: "Generated each run",
    description: "Connectivity and travel-route requirements for the generated map graph.",
  },
  gameMapRules: {
    source: "Game requests",
    description: "Requirements for preserving accepted Game map locations. Empty in Roleplay.",
  },
  existingConnectionRule: {
    source: "Expansion requests",
    description: "Requires new places to connect to existing children when appropriate.",
  },
  outputSchema: {
    source: "Required contract",
    description: "The exact JSON response schema. System templates must retain this variable.",
  },
  ownerMode: {
    source: "Generated each run",
    description: "The owning chat mode: roleplay or game.",
  },
  size: {
    source: "Generated each run",
    description: "The selected small, medium, or large generation size.",
  },
  creatorGuidanceBlock: {
    source: "Editable for this option",
    description: "Reusable instructions stored with the selected named prompt option.",
  },
  creatorRequestBlock: {
    source: "Draft or Expand form",
    description: "The one-run instructions entered when requesting a map or expansion.",
  },
  requiredGameLocationsBlock: {
    source: "Game requests",
    description: "Authoritative location names read from accepted Game maps. Empty in Roleplay.",
  },
  selectedMapContextBlock: {
    source: "Expansion requests",
    description: "The selected location, breadcrumb, and existing child context for an expansion.",
  },
  loreCatalogBlock: {
    source: "Generated each run",
    description: "The eligible lore entries selected as grounding material, when present.",
  },
  sourceContextBlock: {
    source: "Required private context",
    description: "Current setup, character, chat, and relevant map context. User templates must retain it.",
  },
};

export function SpatialMapsHome({
  chatId,
  chatName,
  chatMode,
  enabledForChat,
  packageInfo,
  onEnabledForChatChange,
  onOpenEditor,
  onManagePackage,
  onClose,
}: SpatialMapsHomeProps) {
  const spatial = useSpatialContext(chatId);
  const [activationPending, setActivationPending] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const updateSpatial = useUpdateSpatialContext();
  const updateGenerationPreferences = useUpdateSpatialGenerationPreferences();
  const previewGenerationPrompt = usePreviewSpatialMapPrompt();
  const ownerMode = chatMode === "game" ? "game" : "roleplay";
  const [promptDraft, setPromptDraft] = useState<SpatialGenerationPreferences>(() =>
    defaultGenerationPreferences(ownerMode),
  );
  const [promptEditing, setPromptEditing] = useState(false);
  const [promptOperation, setPromptOperation] = useState<"draft" | "expansion">("draft");
  const [promptPreview, setPromptPreview] = useState<SpatialMapPromptPreview | null>(null);
  const [promptCopyStatus, setPromptCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [hierarchyEditing, setHierarchyEditing] = useState(false);
  const [hierarchyDraft, setHierarchyDraft] = useState<SpatialHierarchyProfileDraft | null>(null);
  const supportedChat = chatMode === "roleplay" || chatMode === "game";
  const definition = spatial.data?.definition ?? null;
  const activeLocationCount = definition?.locations.filter((location) => location.status === "active").length ?? 0;
  const currentPath = spatial.data?.breadcrumb.map((location) => location.name).join(" / ") ?? "";
  const mapState = !definition
    ? "No map yet"
    : definition.enabled
      ? "Saved, map active for turns"
      : "Saved, map disabled";
  const packageReady =
    packageInfo?.status === "active" && (packageInfo.readiness === "ready" || packageInfo.readiness == null);
  const currentChatIdRef = useRef(chatId);
  currentChatIdRef.current = chatId;
  const promptPreviewRequestIdRef = useRef(0);
  const resetGenerationPreferences = updateGenerationPreferences.reset;
  const resetSpatialUpdate = updateSpatial.reset;
  const resetPromptPreviewRequest = previewGenerationPrompt.reset;
  useEffect(() => {
    setPromptEditing(false);
    setPromptDraft(defaultGenerationPreferences(ownerMode));
    setPromptOperation("draft");
    setPromptPreview(null);
    setPromptCopyStatus("idle");
    setHierarchyEditing(false);
    setHierarchyDraft(null);
    promptPreviewRequestIdRef.current += 1;
    resetGenerationPreferences();
    resetPromptPreviewRequest();
    resetSpatialUpdate();
  }, [chatId, ownerMode, resetGenerationPreferences, resetPromptPreviewRequest, resetSpatialUpdate]);
  useEffect(() => {
    if (promptEditing || !spatial.data?.generationPreferences) return;
    setPromptDraft(spatial.data.generationPreferences);
  }, [promptEditing, spatial.data?.generationPreferences]);
  useEffect(() => {
    if (hierarchyEditing) return;
    if (!spatial.data?.definition) {
      setHierarchyDraft(null);
      return;
    }
    setHierarchyDraft({
      definition: spatial.data.definition,
      profile: normalizeHierarchyProfile(spatial.data.hierarchyProfile, spatial.data.definition),
    });
  }, [hierarchyEditing, spatial.data?.definition, spatial.data?.hierarchyProfile]);
  useEffect(() => {
    setPromptPreview(null);
    setPromptCopyStatus("idle");
    promptPreviewRequestIdRef.current += 1;
    resetPromptPreviewRequest();
  }, [promptDraft, promptOperation, resetPromptPreviewRequest]);
  const selectedPromptFields =
    promptOperation === "draft"
      ? ({ system: "draftSystem", user: "draftUser" } as const)
      : ({ system: "expansionSystem", user: "expansionUser" } as const);
  const activePromptOption =
    promptDraft.options.find((option) => option.id === promptDraft.activeOptionId) ?? promptDraft.options[0]!;
  const promptValidation = spatialGenerationPreferencesSchema.safeParse(promptDraft);
  const promptValidationMessage = promptValidation.success
    ? null
    : promptValidation.error.issues[0]?.message ?? "The prompt templates are incomplete.";
  const activeLocations = definition?.locations.filter((location) => location.status === "active") ?? [];
  const expansionPreviewTarget =
    activeLocations.find((location) => location.id === spatial.data?.currentLocationId) ??
    activeLocations.find((location) => location.id === definition?.startingLocationId) ??
    activeLocations[0] ??
    null;
  const expansionPreviewUnavailable = promptOperation === "expansion" && !expansionPreviewTarget;
  const hierarchySaveError = updateSpatial.isError
    ? getSpatialContextProblem(updateSpatial.error).message
    : null;

  const resetHierarchyDraft = () => {
    if (!spatial.data?.definition) {
      setHierarchyDraft(null);
      return;
    }
    setHierarchyDraft({
      definition: spatial.data.definition,
      profile: normalizeHierarchyProfile(spatial.data.hierarchyProfile, spatial.data.definition),
    });
  };

  const saveHierarchyProfile = async () => {
    if (!chatId || !hierarchyDraft || !spatial.data?.definition) return;
    const savingChatId = chatId;
    const response = await updateSpatial.mutateAsync({
      chatId: savingChatId,
      expectedRevision: spatial.data.definition.revision,
      expectedCurrentLocationId: spatial.data.currentLocationId,
      definition: hierarchyDraft.definition,
      hierarchyProfile: normalizeHierarchyProfile(hierarchyDraft.profile, hierarchyDraft.definition),
    });
    if (currentChatIdRef.current !== savingChatId || !response.definition) return;
    setHierarchyDraft({
      definition: response.definition,
      profile: normalizeHierarchyProfile(response.hierarchyProfile, response.definition),
    });
    setHierarchyEditing(false);
  };

  const savePrompt = async (preferences: SpatialGenerationPreferences) => {
    if (!chatId) return;
    const savingChatId = chatId;
    await updateGenerationPreferences.mutateAsync({ chatId: savingChatId, preferences });
    if (currentChatIdRef.current !== savingChatId) return;
    setPromptDraft(preferences);
    setPromptEditing(false);
  };
  const updateActivePromptOption = (
    patch: Partial<
      Pick<SpatialGenerationPromptOption, "name" | "description" | "guidance" | "customVariables" | "prompts">
    >,
  ) => {
    setPromptDraft((current) => ({
      ...current,
      options: current.options.map((option) =>
        option.id === current.activeOptionId ? { ...option, ...patch } : option,
      ),
    }));
  };
  const selectPromptOption = async (optionId: string) => {
    const preferences = { ...promptDraft, activeOptionId: optionId };
    setPromptDraft(preferences);
    if (!promptEditing) await savePrompt(preferences);
  };
  const addPromptOption = () => {
    const usedIds = new Set(promptDraft.options.map((option) => option.id));
    const baseId = `option-${Date.now().toString(36)}`;
    let optionId = baseId;
    let suffix = 2;
    while (usedIds.has(optionId)) {
      optionId = `${baseId}-${suffix}`;
      suffix += 1;
    }
    const option: SpatialGenerationPromptOption = {
      ...activePromptOption,
      id: optionId,
      name: `Copy of ${activePromptOption.name}`.slice(0, 120),
      description: "Custom map generation prompt option.",
      customVariables: activePromptOption.customVariables.map((variable) => ({ ...variable })),
      prompts: { ...activePromptOption.prompts },
    };
    setPromptDraft((current) => ({
      ...current,
      activeOptionId: optionId,
      options: [...current.options, option],
    }));
    setPromptEditing(true);
  };
  const removeActivePromptOption = () => {
    if (activePromptOption.id === DEFAULT_SPATIAL_GENERATION_PROMPT_OPTION_ID) return;
    const options = promptDraft.options.filter((option) => option.id !== activePromptOption.id);
    const nextActiveOption =
      options.find((option) => option.id === DEFAULT_SPATIAL_GENERATION_PROMPT_OPTION_ID) ?? options[0]!;
    setPromptDraft((current) => ({ ...current, activeOptionId: nextActiveOption.id, options }));
  };
  const restoreBuiltInPromptOption = () => {
    const builtInOption = defaultGenerationPreferences(ownerMode).options[0]!;
    setPromptDraft((current) => ({
      ...current,
      options: current.options.map((option) =>
        option.id === DEFAULT_SPATIAL_GENERATION_PROMPT_OPTION_ID ? builtInOption : option,
      ),
    }));
  };
  const addCustomVariable = () => {
    const usedNames = new Set(activePromptOption.customVariables.map((variable) => variable.name));
    let name = "customVariable";
    let suffix = 2;
    while (usedNames.has(name)) {
      name = `customVariable${suffix}`;
      suffix += 1;
    }
    updateActivePromptOption({
      customVariables: [...activePromptOption.customVariables, { name, value: "" }],
    });
  };
  const updateCustomVariable = (index: number, patch: Partial<SpatialGenerationCustomVariable>) => {
    updateActivePromptOption({
      customVariables: activePromptOption.customVariables.map((variable, variableIndex) =>
        variableIndex === index ? { ...variable, ...patch } : variable,
      ),
    });
  };
  const removeCustomVariable = (index: number) => {
    updateActivePromptOption({
      customVariables: activePromptOption.customVariables.filter((_, variableIndex) => variableIndex !== index),
    });
  };
  const previewPrompt = async () => {
    if (!chatId || !promptValidation.success || expansionPreviewUnavailable) return;
    const previewChatId = chatId;
    const requestId = ++promptPreviewRequestIdRef.current;
    try {
      const preview = await previewGenerationPrompt.mutateAsync({
        chatId,
        operation: promptOperation === "draft" ? "create" : "expand",
        size: "medium",
        ...(promptOperation === "expansion" && expansionPreviewTarget
          ? { targetLocationId: expansionPreviewTarget.id }
          : {}),
        groundingMode: "setup",
        sourceLorebookIds: [],
        hierarchyMode: promptOperation === "draft" ? "auto" : spatial.data?.hierarchyProfile.mode ?? "auto",
        generationPreferencesOverride: promptValidation.data,
        debugMode: false,
      });
      if (currentChatIdRef.current !== previewChatId || promptPreviewRequestIdRef.current !== requestId) return;
      setPromptPreview(preview);
      setPromptCopyStatus("idle");
    } catch {
      if (currentChatIdRef.current !== previewChatId || promptPreviewRequestIdRef.current !== requestId) return;
      setPromptPreview(null);
    }
  };
  const copyPromptPreview = async () => {
    if (!promptPreview) return;
    try {
      await navigator.clipboard.writeText(`[SYSTEM]\n${promptPreview.system}\n\n[USER]\n${promptPreview.user}`);
      setPromptCopyStatus("copied");
    } catch {
      setPromptCopyStatus("failed");
    }
  };
  const toggleForChat = async () => {
    if (!onEnabledForChatChange || activationPending || !supportedChat) return;
    setActivationPending(true);
    setActivationError(null);
    try {
      await onEnabledForChatChange(!enabledForChat);
    } catch (error) {
      setActivationError(error instanceof Error ? error.message : "Hierarchical Maps could not be updated for this chat.");
    } finally {
      setActivationPending(false);
    }
  };

  return (
    <section
      data-marinara-maps-home
      className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--background)] text-[var(--foreground)]"
      aria-labelledby="hierarchical-maps-home-title"
    >
      <header className="sticky top-0 z-10 flex min-h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--background)]/95 px-4 backdrop-blur-xl">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to Agents"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--marinara-chat-chrome-accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <ArrowLeft size="1rem" />
          </button>
        )}
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)]/12 text-[var(--marinara-chat-chrome-accent)]">
          <Map size="1rem" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 id="hierarchical-maps-home-title" className="truncate text-sm font-semibold">
            Hierarchical Maps
          </h1>
          <p className="text-[0.625rem] uppercase tracking-[0.12em] text-[var(--marinara-chat-chrome-accent)]">
            World location feature
          </p>
        </div>
        {packageInfo?.version && (
          <span className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1 text-[0.625rem] font-medium text-[var(--marinara-chat-chrome-accent)]">
            v{packageInfo.version}
          </span>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 sm:p-6">
        <div>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
            Build nested regions, settlements, buildings, and places so Roleplay and Game turns share one authoritative world location.
          </p>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Supported chat modes">
            {['Roleplay', 'Game'].map((mode) => (
              <span key={mode} className="rounded-full bg-[var(--secondary)] px-2.5 py-1 text-[0.6875rem] font-medium">
                {mode}
              </span>
            ))}
          </div>
        </div>

        <article className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex flex-wrap items-start gap-3">
            <span className={`mt-0.5 ${packageReady ? "text-emerald-400" : "text-amber-400"}`}>
              {packageReady ? <CheckCircle2 size="1rem" /> : <CircleAlert size="1rem" />}
            </span>
            <div className="min-w-52 flex-1">
              <h2 className="text-xs font-semibold">Installed package</h2>
              <p className="mt-1 text-[0.6875rem] text-[var(--marinara-chat-chrome-accent)]">
                {packageReady ? "Ready to use" : "Restart or package attention may be required"}
                {packageInfo?.version ? ` · Version ${packageInfo.version}` : ""}
              </p>
            </div>
            {onManagePackage && (
              <button
                type="button"
                onClick={onManagePackage}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-xs font-medium transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <Settings2 size="0.8125rem" /> Manage package
              </button>
            )}
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-start gap-3 border-b border-[var(--border)] px-4 py-3">
            <MessageSquare size="1rem" className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-semibold">Current chat</h2>
              <p className="mt-1 truncate text-[0.6875rem] text-[var(--marinara-chat-chrome-accent)]">
                {chatId ? `${chatName || "Untitled chat"} · ${modeLabel(chatMode)}` : "No chat is open"}
              </p>
            </div>
          </div>

          {!chatId ? (
            <div className="px-4 py-5 text-sm text-[var(--marinara-chat-chrome-accent)]">
              Open a Roleplay or Game chat to activate Maps and create its world hierarchy.
            </div>
          ) : !supportedChat ? (
            <div className="px-4 py-5 text-sm text-[var(--marinara-chat-chrome-accent)]">
              Hierarchical Maps supports Roleplay and Game. The current {modeLabel(chatMode)} chat is unchanged.
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <button
                type="button"
                role="switch"
                aria-checked={enabledForChat}
                disabled={!onEnabledForChatChange || activationPending}
                onClick={() => void toggleForChat()}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60 ${
                  enabledForChat
                    ? "bg-[var(--primary)]/10 ring-[var(--primary)]/30"
                    : "bg-[var(--secondary)] ring-[var(--border)] hover:bg-[var(--accent)]"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">Use in this chat</span>
                  <span className="mt-0.5 block text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
                    {enabledForChat
                      ? "Active in this chat. Saved map context can participate in turns."
                      : "Installed in Marinara, but not active in this chat yet."}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors ${
                    enabledForChat ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50"
                  }`}
                >
                  <span
                    className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      enabledForChat ? "translate-x-3.5" : ""
                    }`}
                  />
                </span>
              </button>

              {activationPending && (
                <p role="status" aria-live="polite" className="text-[0.6875rem] text-[var(--marinara-chat-chrome-accent)]">
                  Updating Hierarchical Maps…
                </p>
              )}
              {activationError && (
                <p role="alert" className="rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-[0.6875rem] text-[var(--destructive)]">
                  {activationError}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/35 p-3">
                <MapPin size="0.9375rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
                <div className="min-w-52 flex-1">
                  <p className="text-xs font-semibold">{spatial.isError ? "Map status unavailable" : mapState}</p>
                  <p className="mt-1 text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
                    {spatial.isLoading
                      ? "Loading this chat’s map status…"
                      : spatial.isError
                        ? "Retry the status check or open the map workspace to recover."
                        : definition
                          ? `${activeLocationCount} active ${activeLocationCount === 1 ? "location" : "locations"}${currentPath ? ` · ${currentPath}` : ""}`
                          : "Create manually, import a map, or draft the hierarchy with AI."}
                  </p>
                </div>
                {spatial.isError && (
                  <button
                    type="button"
                    onClick={() => void spatial.refetch()}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-medium text-[var(--marinara-chat-chrome-accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <RefreshCw size="0.8125rem" /> Retry status
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onOpenEditor}
                disabled={!enabledForChat || activationPending}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
              >
                <Map size="0.875rem" /> {definition ? "Open map" : "Create map"}
              </button>
            </div>
          )}
        </article>

        {chatId && supportedChat && (
          <article
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
            aria-labelledby="maps-location-types-title"
          >
            <div className="flex flex-wrap items-start gap-3">
              <Settings2 size="1rem" className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
              <div className="min-w-52 flex-1">
                <h2 id="maps-location-types-title" className="text-xs font-semibold">Location types</h2>
                <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
                  View and edit the vocabulary saved with this chat’s map. These are the same hierarchy names and semantic base kinds shown in Edit Map and reused by AI expansions.
                </p>
              </div>
              {hierarchyDraft && (
                <span className="rounded-full bg-[var(--secondary)] px-2 py-1 text-[0.625rem] font-medium text-[var(--marinara-chat-chrome-accent)]">
                  {hierarchyDraft.profile.mode === "custom" ? "Custom" : hierarchyDraft.profile.mode === "auto" ? "Chosen by AI" : "Template"}
                </span>
              )}
            </div>

            {spatial.isLoading ? (
              <div className="mt-4 flex min-h-20 items-center gap-2 text-xs text-[var(--marinara-chat-chrome-accent)]" role="status">
                <LoaderCircle size="0.875rem" className="animate-spin" /> Loading location types…
              </div>
            ) : hierarchyDraft && definition ? (
              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <SpatialHierarchyProfileFields
                  definition={hierarchyDraft.definition}
                  profile={hierarchyDraft.profile}
                  editable={hierarchyEditing}
                  disabled={updateSpatial.isPending}
                  onChange={setHierarchyDraft}
                />

                {hierarchySaveError && (
                  <p className="mt-3 rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-[0.6875rem] text-[var(--destructive)]" role="alert">
                    {hierarchySaveError}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-3">
                  {hierarchyEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          resetHierarchyDraft();
                          setHierarchyEditing(false);
                          updateSpatial.reset();
                        }}
                        disabled={updateSpatial.isPending}
                        className="inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-medium hover:bg-[var(--accent)] disabled:opacity-45"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveHierarchyProfile()}
                        disabled={updateSpatial.isPending}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-45"
                      >
                        {updateSpatial.isPending ? <LoaderCircle size="0.75rem" className="animate-spin" /> : <Save size="0.75rem" />}
                        Save location types
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        resetHierarchyDraft();
                        setHierarchyEditing(true);
                        updateSpatial.reset();
                      }}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)]"
                    >
                      <Settings2 size="0.75rem" /> Edit location types
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--secondary)]/30 px-3 py-4 text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
                Create or import a map first. Its generated or imported hierarchy vocabulary will then be editable here.
              </div>
            )}
          </article>
        )}

        {chatId && supportedChat && (
          <article className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4" aria-labelledby="maps-generation-prompt-title">
            <div className="flex flex-wrap items-start gap-3">
              <FileText size="1rem" className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
              <div className="min-w-52 flex-1">
                <h2 id="maps-generation-prompt-title" className="text-xs font-semibold">Generation prompt</h2>
                <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
                  Edit the {modeLabel(chatMode)} templates that build the complete System and User messages for new maps and expansions in this chat.
                </p>
              </div>
              <span className="rounded-full bg-[var(--secondary)] px-2 py-1 text-[0.625rem] font-medium text-[var(--marinara-chat-chrome-accent)]">
                {modeLabel(chatMode)} · {activePromptOption.name}
              </span>
            </div>

            <div className="mt-3 border-y border-[var(--border)] py-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-52 flex-1 text-[0.6875rem] font-semibold" htmlFor="maps-generation-prompt-option">
                  Prompt option
                  <select
                    id="maps-generation-prompt-option"
                    value={promptDraft.activeOptionId}
                    disabled={updateGenerationPreferences.isPending}
                    onChange={(event) => void selectPromptOption(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-xs font-medium outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
                  >
                    {promptDraft.options.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={addPromptOption}
                  disabled={promptDraft.options.length >= 24 || updateGenerationPreferences.isPending}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-medium hover:bg-[var(--accent)] disabled:opacity-40"
                >
                  <Plus size="0.75rem" /> Add option
                </button>
              </div>
              <p className="mt-2 text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
                Selecting an option loads and activates its complete New Map and Expansion prompt set for this chat.
              </p>

              {promptEditing ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-[0.6875rem] font-semibold" htmlFor="maps-generation-option-name">
                    Option name
                    <input
                      id="maps-generation-option-name"
                      value={activePromptOption.name}
                      maxLength={120}
                      onChange={(event) => updateActivePromptOption({ name: event.target.value })}
                      className="mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
                    />
                  </label>
                  <label className="text-[0.6875rem] font-semibold" htmlFor="maps-generation-option-description">
                    Short description
                    <input
                      id="maps-generation-option-description"
                      value={activePromptOption.description ?? ""}
                      maxLength={240}
                      onChange={(event) => updateActivePromptOption({ description: event.target.value })}
                      placeholder="When should this option be used?"
                      className="mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
                    />
                  </label>
                </div>
              ) : activePromptOption.description ? (
                <p className="mt-3 rounded-lg bg-[var(--secondary)]/50 px-3 py-2 text-[0.6875rem] text-[var(--marinara-chat-chrome-accent)]">
                  {activePromptOption.description}
                </p>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2" aria-label="Prompt template selection">
              <div className="flex rounded-lg bg-[var(--secondary)] p-1 ring-1 ring-[var(--border)]" role="group" aria-label="Map operation">
                {(["draft", "expansion"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={promptOperation === value}
                    onClick={() => setPromptOperation(value)}
                    className={`min-h-9 rounded-md px-3 text-[0.6875rem] font-medium ${
                      promptOperation === value ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm" : "text-[var(--marinara-chat-chrome-accent)]"
                    }`}
                  >
                    {value === "draft" ? "New map" : "Expansion"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="maps-generation-system-template" className="text-[0.6875rem] font-semibold">
                  {promptOperation === "draft" ? "New map" : "Expansion"} System template
                </label>
                <span className="text-[0.5625rem] text-[var(--marinara-chat-chrome-accent)]">
                  {activePromptOption.prompts[selectedPromptFields.system].length} chars
                </span>
              </div>
              <textarea
                id="maps-generation-system-template"
                rows={14}
                maxLength={80_000}
                readOnly={!promptEditing}
                value={activePromptOption.prompts[selectedPromptFields.system]}
                onChange={(event) =>
                  updateActivePromptOption({
                    prompts: { ...activePromptOption.prompts, [selectedPromptFields.system]: event.target.value },
                  })
                }
                className="mt-2 min-h-64 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 font-mono text-[0.6875rem] leading-relaxed outline-none read-only:cursor-default read-only:opacity-85 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="maps-generation-user-template" className="text-[0.6875rem] font-semibold">
                  {promptOperation === "draft" ? "New map" : "Expansion"} User template
                </label>
                <span className="text-[0.5625rem] text-[var(--marinara-chat-chrome-accent)]">
                  {activePromptOption.prompts[selectedPromptFields.user].length} chars
                </span>
              </div>
              <textarea
                id="maps-generation-user-template"
                rows={12}
                maxLength={80_000}
                readOnly={!promptEditing}
                value={activePromptOption.prompts[selectedPromptFields.user]}
                onChange={(event) =>
                  updateActivePromptOption({
                    prompts: { ...activePromptOption.prompts, [selectedPromptFields.user]: event.target.value },
                  })
                }
                className="mt-2 min-h-56 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 font-mono text-[0.6875rem] leading-relaxed outline-none read-only:cursor-default read-only:opacity-85 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
              />
              <p className="mt-2 text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
                Maps sends these as two messages in order: System first, then User.
              </p>
            </div>

            <details className="mt-3 rounded-lg border border-[var(--border)] px-3 py-2">
              <summary className="min-h-8 cursor-pointer text-[0.6875rem] font-semibold">
                Available template variables ({SPATIAL_GENERATION_PROMPT_VARIABLES.length} built-in
                {activePromptOption.customVariables.length > 0
                  ? ` + ${activePromptOption.customVariables.length} custom`
                  : ""})
              </summary>
              <p className="mt-2 max-w-3xl text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
                Built-in values come from the current request and chat. Their position in a template is editable, but generated context and response contracts cannot be replaced with stored text.
              </p>

              <div className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {SPATIAL_GENERATION_PROMPT_VARIABLES.map((variable) => {
                  const detail = SPATIAL_GENERATION_VARIABLE_DETAILS[variable];
                  return (
                    <div key={variable} className="py-3 first:pt-2 last:pb-2">
                      <div className="flex flex-wrap items-start gap-2">
                        <code className="inline-flex items-center gap-1 rounded-md bg-[var(--secondary)] px-2 py-1 font-mono text-[0.625rem] text-[var(--foreground)]">
                          <Code2 size="0.625rem" /> ${"{"}{variable}{"}"}
                        </code>
                        <span className="rounded-full border border-[var(--border)] px-2 py-1 text-[0.5625rem] font-medium text-[var(--marinara-chat-chrome-accent)]">
                          {detail.source}
                        </span>
                      </div>
                      <p className="mt-1.5 max-w-3xl text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
                        {detail.description}
                      </p>
                      {variable === "creatorGuidanceBlock" && (
                        <div className="mt-3">
                          <label className="text-[0.6875rem] font-semibold" htmlFor="maps-generation-guidance">
                            Reusable creator guidance
                          </label>
                          <textarea
                            id="maps-generation-guidance"
                            rows={3}
                            maxLength={4_000}
                            readOnly={!promptEditing}
                            value={activePromptOption.guidance}
                            onChange={(event) => updateActivePromptOption({ guidance: event.target.value })}
                            className="mt-2 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs leading-relaxed outline-none read-only:cursor-default read-only:opacity-80 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-[0.6875rem] font-semibold">Custom variables</h3>
                    <p className="mt-1 max-w-2xl text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
                      Store reusable text with this prompt option, then insert it in any System or User template using its token.
                    </p>
                  </div>
                  {promptEditing && (
                    <button
                      type="button"
                      onClick={addCustomVariable}
                      disabled={activePromptOption.customVariables.length >= 32}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-medium hover:bg-[var(--accent)] disabled:opacity-40"
                    >
                      <Plus size="0.75rem" /> Add custom variable
                    </button>
                  )}
                </div>

                {activePromptOption.customVariables.length === 0 ? (
                  <p className="mt-3 text-[0.625rem] text-[var(--marinara-chat-chrome-accent)]">
                    {promptEditing ? "No custom variables yet." : "Edit this prompt option to add custom variables."}
                  </p>
                ) : (
                  <div className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                    {activePromptOption.customVariables.map((variable, index) => (
                      <div key={index} className="py-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <code className="rounded-md bg-[var(--secondary)] px-2 py-1 font-mono text-[0.625rem]">
                            ${"{"}{variable.name || "variableName"}{"}"}
                          </code>
                          {promptEditing && (
                            <button
                              type="button"
                              onClick={() => removeCustomVariable(index)}
                              aria-label={`Remove custom variable ${index + 1}`}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--marinara-chat-chrome-accent)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                            >
                              <Trash2 size="0.75rem" />
                            </button>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[minmax(10rem,0.4fr)_minmax(0,1fr)]">
                          <label className="text-[0.625rem] font-medium">
                            Variable name
                            <input
                              aria-label={`Custom variable ${index + 1} name`}
                              value={variable.name}
                              maxLength={80}
                              readOnly={!promptEditing}
                              onChange={(event) => updateCustomVariable(index, { name: event.target.value })}
                              className="mt-1.5 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 font-mono text-xs outline-none read-only:cursor-default read-only:opacity-80 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
                            />
                          </label>
                          <label className="text-[0.625rem] font-medium">
                            Replacement text
                            <textarea
                              aria-label={`Custom variable ${index + 1} value`}
                              value={variable.value}
                              rows={3}
                              maxLength={20_000}
                              readOnly={!promptEditing}
                              onChange={(event) => updateCustomVariable(index, { value: event.target.value })}
                              className="mt-1.5 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs leading-relaxed outline-none read-only:cursor-default read-only:opacity-80 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-3 text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
                Preview uses the unsaved template, guidance, and custom-variable values currently shown here.
              </p>
            </details>

            <section className="mt-4 border-t border-[var(--border)] pt-4" aria-labelledby="maps-resolved-prompt-title">
              <div className="flex flex-wrap items-start gap-3">
                <Eye size="0.875rem" className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
                <div className="min-w-52 flex-1">
                  <h3 id="maps-resolved-prompt-title" className="text-xs font-semibold">Resolved prompt preview</h3>
                  <p className="mt-1 text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
                    Uses Medium size, setup context, and {promptOperation === "draft" ? "Auto hierarchy" : expansionPreviewTarget ? `the existing hierarchy at ${expansionPreviewTarget.name}` : "the existing hierarchy"}. No model request is made.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void previewPrompt()}
                  disabled={previewGenerationPrompt.isPending || !promptValidation.success || expansionPreviewUnavailable}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-xs font-medium transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {previewGenerationPrompt.isPending ? (
                    <><LoaderCircle size="0.8125rem" className="animate-spin" /> Resolving</>
                  ) : (
                    <><Eye size="0.8125rem" /> {promptPreview ? "Refresh preview" : "Preview resolved prompt"}</>
                  )}
                </button>
              </div>

              {promptValidationMessage && promptEditing && (
                <p className="mt-3 rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-[0.6875rem] text-[var(--destructive)]" role="alert">
                  {promptValidationMessage}
                </p>
              )}
              {expansionPreviewUnavailable && (
                <p className="mt-3 text-[0.6875rem] text-amber-400">
                  Create a map with an active location before previewing the Expansion templates.
                </p>
              )}
              {previewGenerationPrompt.isError && (
                <p className="mt-3 rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-[0.6875rem] text-[var(--destructive)]" role="alert">
                  {previewGenerationPrompt.error instanceof Error
                    ? previewGenerationPrompt.error.message
                    : "The resolved prompt could not be previewed."}
                </p>
              )}
              {previewGenerationPrompt.isPending && (
                <div className="mt-4 space-y-3" aria-label="Resolving prompt preview">
                  <div className="h-4 w-40 animate-pulse rounded bg-[var(--secondary)]" />
                  <div className="h-36 animate-pulse rounded-lg bg-[var(--secondary)]" />
                  <div className="h-4 w-36 animate-pulse rounded bg-[var(--secondary)]" />
                  <div className="h-36 animate-pulse rounded-lg bg-[var(--secondary)]" />
                </div>
              )}
              {promptPreview && !previewGenerationPrompt.isPending && (
                <div className="mt-4" role="region" aria-label="Resolved prompt messages">
                  <p className="text-[0.625rem] leading-relaxed text-amber-500">
                    Contains private setup, character, lore, and map context from this chat.
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <h4 className="text-[0.6875rem] font-semibold">System message</h4>
                    <span className="text-[0.5625rem] text-[var(--marinara-chat-chrome-accent)]">
                      {promptPreview.system.length} chars
                    </span>
                  </div>
                  <pre aria-label="Resolved System message" className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 font-mono text-[0.6875rem] leading-relaxed text-[var(--foreground)]">
                    {promptPreview.system}
                  </pre>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <h4 className="text-[0.6875rem] font-semibold">User message</h4>
                    <span className="text-[0.5625rem] text-[var(--marinara-chat-chrome-accent)]">
                      {promptPreview.user.length} chars
                    </span>
                  </div>
                  <pre aria-label="Resolved User message" className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 font-mono text-[0.6875rem] leading-relaxed text-[var(--foreground)]">
                    {promptPreview.user}
                  </pre>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void copyPromptPreview()}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-medium hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    >
                      <ClipboardCopy size="0.75rem" /> {promptCopyStatus === "copied" ? "Copied" : promptCopyStatus === "failed" ? "Copy failed" : "Copy System + User"}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {updateGenerationPreferences.isError && (
              <p className="mt-3 rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-[0.6875rem] text-[var(--destructive)]" role="alert">
                {updateGenerationPreferences.error instanceof Error
                  ? updateGenerationPreferences.error.message
                  : "The generation prompt could not be saved."}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              {promptEditing ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {activePromptOption.id === DEFAULT_SPATIAL_GENERATION_PROMPT_OPTION_ID ? (
                      <button
                        type="button"
                        onClick={restoreBuiltInPromptOption}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-medium hover:bg-[var(--accent)]"
                      >
                        <RotateCcw size="0.75rem" /> Restore built-in option
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={removeActivePromptOption}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--destructive)]/40 px-3 text-xs font-medium text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                      >
                        <Trash2 size="0.75rem" /> Delete option
                      </button>
                    )}
                  </div>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPromptDraft(spatial.data?.generationPreferences ?? defaultGenerationPreferences(ownerMode));
                        setPromptEditing(false);
                      }}
                      className="inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-medium hover:bg-[var(--accent)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={updateGenerationPreferences.isPending || !promptValidation.success}
                      onClick={() => promptValidation.success && void savePrompt(promptValidation.data)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-45"
                    >
                      <Save size="0.75rem" /> Save prompt options
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setPromptEditing(true)}
                  className="ml-auto inline-flex min-h-11 items-center rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)]"
                >
                  Edit prompt option
                </button>
              )}
            </div>
          </article>
        )}

        <article className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--secondary)]/30 p-4">
          <div className="flex items-start gap-3">
            <Box size="1rem" className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
            <div>
              <h2 className="text-xs font-semibold">Map state stays with each chat</h2>
              <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
                Hierarchy contents, current location, lore bindings, Game bindings, history, and unsaved drafts are never promoted into global agent settings.
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
