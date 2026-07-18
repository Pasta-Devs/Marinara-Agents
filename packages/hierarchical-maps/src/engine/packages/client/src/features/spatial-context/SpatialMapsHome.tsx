import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  CircleAlert,
  Code2,
  FileText,
  Map,
  MapPin,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
} from "lucide-react";
import { useSpatialContext, useUpdateSpatialGenerationPreferences } from "../../hooks/use-spatial-context";
import {
  defaultGenerationPreferences,
  SPATIAL_GENERATION_PROMPT_VARIABLES,
  type SpatialGenerationPreferences,
} from "../../../../maps-shared/src/maps-model";

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
  const updateGenerationPreferences = useUpdateSpatialGenerationPreferences();
  const ownerMode = chatMode === "game" ? "game" : "roleplay";
  const [promptDraft, setPromptDraft] = useState<SpatialGenerationPreferences>(() =>
    defaultGenerationPreferences(ownerMode),
  );
  const [promptEditing, setPromptEditing] = useState(false);
  const [promptOperation, setPromptOperation] = useState<"draft" | "expansion">("draft");
  const [promptMessageRole, setPromptMessageRole] = useState<"system" | "user">("system");
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
  const resetGenerationPreferences = updateGenerationPreferences.reset;
  useEffect(() => {
    setPromptEditing(false);
    setPromptDraft(defaultGenerationPreferences(ownerMode));
    setPromptOperation("draft");
    setPromptMessageRole("system");
    resetGenerationPreferences();
  }, [chatId, ownerMode, resetGenerationPreferences]);
  useEffect(() => {
    if (promptEditing || !spatial.data?.generationPreferences) return;
    setPromptDraft(spatial.data.generationPreferences);
  }, [promptEditing, spatial.data?.generationPreferences]);
  const selectedPromptField: keyof SpatialGenerationPreferences["prompts"] =
    promptOperation === "draft"
      ? promptMessageRole === "system"
        ? "draftSystem"
        : "draftUser"
      : promptMessageRole === "system"
        ? "expansionSystem"
        : "expansionUser";
  const selectedPromptTemplate = promptDraft.prompts[selectedPromptField];
  const promptTemplatesComplete = Object.values(promptDraft.prompts).every((template) => template.trim().length > 0);

  const savePrompt = async (preferences: SpatialGenerationPreferences) => {
    if (!chatId) return;
    const savingChatId = chatId;
    await updateGenerationPreferences.mutateAsync({ chatId: savingChatId, preferences });
    if (currentChatIdRef.current !== savingChatId) return;
    setPromptDraft(preferences);
    setPromptEditing(false);
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
                {modeLabel(chatMode)} · {promptDraft.mode === "custom" ? "Customized" : "Built-in default"}
              </span>
            </div>

            <div className="mt-3 border-y border-[var(--border)] py-3">
              <label className="text-[0.6875rem] font-semibold" htmlFor="maps-generation-guidance">
                Reusable creator guidance
              </label>
              <textarea
                id="maps-generation-guidance"
                rows={3}
                maxLength={4_000}
                readOnly={!promptEditing}
                value={promptDraft.guidance}
                onChange={(event) =>
                  setPromptDraft((current) => ({ ...current, mode: "custom", guidance: event.target.value }))
                }
                className="mt-2 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs leading-relaxed outline-none read-only:cursor-default read-only:opacity-80 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
              />
              <p className="mt-2 text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
                Inserted through <code className="font-mono">${"{creatorGuidanceBlock}"}</code> wherever that variable appears in the selected template.
              </p>
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
              <div className="flex rounded-lg bg-[var(--secondary)] p-1 ring-1 ring-[var(--border)]" role="group" aria-label="Prompt message">
                {(["system", "user"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={promptMessageRole === value}
                    onClick={() => setPromptMessageRole(value)}
                    className={`min-h-9 rounded-md px-3 text-[0.6875rem] font-medium capitalize ${
                      promptMessageRole === value ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm" : "text-[var(--marinara-chat-chrome-accent)]"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="maps-generation-template" className="text-[0.6875rem] font-semibold capitalize">
                  {promptOperation === "draft" ? "New map" : "Expansion"} {promptMessageRole} template
                </label>
                <span className="text-[0.5625rem] text-[var(--marinara-chat-chrome-accent)]">
                  {selectedPromptTemplate.length} chars
                </span>
              </div>
              <textarea
                id="maps-generation-template"
                rows={14}
                maxLength={80_000}
                readOnly={!promptEditing}
                value={selectedPromptTemplate}
                onChange={(event) =>
                  setPromptDraft((current) => ({
                    ...current,
                    mode: "custom",
                    prompts: { ...current.prompts, [selectedPromptField]: event.target.value },
                  }))
                }
                className="mt-2 min-h-64 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 font-mono text-[0.6875rem] leading-relaxed outline-none read-only:cursor-default read-only:opacity-85 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            <details className="mt-3 rounded-lg border border-[var(--border)] px-3 py-2">
              <summary className="min-h-8 cursor-pointer text-[0.6875rem] font-semibold">Available template variables</summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SPATIAL_GENERATION_PROMPT_VARIABLES.map((variable) => (
                  <span key={variable} className="inline-flex items-center gap-1 rounded-md bg-[var(--secondary)] px-2 py-1 font-mono text-[0.6rem] text-[var(--marinara-chat-chrome-accent)] ring-1 ring-[var(--border)]">
                    <Code2 size="0.625rem" /> ${"{"}{variable}{"}"}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-accent)]">
                Variables are resolved from the current Roleplay or Game chat when generation runs. The builder’s Full prompt tab shows and can edit the exact resolved messages before sending.
              </p>
            </details>

            {updateGenerationPreferences.isError && (
              <p className="mt-3 rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-[0.6875rem] text-[var(--destructive)]" role="alert">
                {updateGenerationPreferences.error instanceof Error
                  ? updateGenerationPreferences.error.message
                  : "The generation prompt could not be saved."}
              </p>
            )}

            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {promptEditing ? (
                <>
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
                    disabled={updateGenerationPreferences.isPending || !promptDraft.guidance.trim() || !promptTemplatesComplete}
                    onClick={() => void savePrompt({ ...promptDraft, mode: "custom" })}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-45"
                  >
                    <Save size="0.75rem" /> Save templates
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={updateGenerationPreferences.isPending || promptDraft.mode === "default"}
                    onClick={() => void savePrompt(defaultGenerationPreferences(ownerMode))}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-medium disabled:opacity-40"
                  >
                    <RotateCcw size="0.75rem" /> Reset to default
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPromptDraft((current) => ({ ...current, mode: "custom" }));
                      setPromptEditing(true);
                    }}
                    className="inline-flex min-h-11 items-center rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)]"
                  >
                    Customize
                  </button>
                </>
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
