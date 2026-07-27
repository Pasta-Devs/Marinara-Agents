import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, Download, Loader2, Map, PencilLine, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { spatialContextDefinitionSchema, type SpatialOwnerMode } from "@marinara-engine/shared";
import {
  useCreateSpatialMapTemplate,
  useDeleteSpatialMapTemplate,
  useSpatialContext,
  useSpatialMapTemplates,
  useUpdateSpatialContext,
} from "../../hooks/use-spatial-context";
import {
  defaultHierarchyProfile,
  instantiateSpatialMapTemplate,
  normalizeHierarchyProfile,
  type SpatialMapTemplateRecord,
} from "../../../../maps-shared/src/maps-model";
import { createEmptySpatialDefinition } from "./editor-state";
import { SpatialMapWorkspace } from "./SpatialMapWorkspace";

interface SpatialMapLibraryProps {
  chatId: string | null;
  chatName: string | null;
  chatMode: string | null;
  enabledForChat?: boolean;
  onClose: () => void;
  onAppliedToChat?: () => void;
  onSelectForSetup?: (template: SpatialMapTemplateRecord) => void;
  onOpenLorebook?: (lorebookId: string) => void;
  onEnabledForChatChange?: (enabled: boolean) => void | Promise<void>;
}

interface LibraryConfirmationOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive" | "accent";
}

function importedTemplateName(fileName: string): string {
  return fileName
    .replace(/\.hierarchical-map\.json$/iu, "")
    .replace(/\.json$/iu, "")
    .replace(/[-_]+/gu, " ")
    .trim() || "Imported map";
}

export function SpatialMapLibrary({
  chatId,
  chatName,
  chatMode,
  enabledForChat = false,
  onClose,
  onAppliedToChat,
  onSelectForSetup,
  onOpenLorebook,
  onEnabledForChatChange,
}: SpatialMapLibraryProps) {
  const templates = useSpatialMapTemplates();
  const createTemplate = useCreateSpatialMapTemplate();
  const deleteTemplate = useDeleteSpatialMapTemplate();
  const spatial = useSpatialContext(chatId);
  const updateSpatial = useUpdateSpatialContext();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState<LibraryConfirmationOptions | null>(null);
  const confirmationResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const confirmationDialogRef = useRef<HTMLDivElement>(null);
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);
  const editingTemplate = templates.data?.find((template) => template.id === editingId) ?? null;
  const supportedChat = !!chatId && (chatMode === "roleplay" || chatMode === "game");
  const visibleTemplates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return templates.data ?? [];
    return (templates.data ?? []).filter((template) => template.name.toLocaleLowerCase().includes(normalized));
  }, [query, templates.data]);

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
      if (
        event.shiftKey &&
        (document.activeElement === first || !confirmationDialogRef.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !confirmationDialogRef.current?.contains(document.activeElement))
      ) {
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

  const importTemplate = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
      const data = record?.data && typeof record.data === "object" && !Array.isArray(record.data)
        ? record.data as Record<string, unknown>
        : record;
      const candidate = data && "definition" in data ? data.definition : raw;
      const parsed = spatialContextDefinitionSchema.safeParse(candidate);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "This is not a valid map file.");
      const hierarchyProfile = normalizeHierarchyProfile(data?.hierarchyProfile, parsed.data);
      const created = await createTemplate.mutateAsync({
        name: typeof record?.name === "string" && record.name.trim()
          ? record.name.trim()
          : importedTemplateName(file.name),
        description: "",
        definition: parsed.data,
        hierarchyProfile,
      });
      toast.success("Map added to your templates.");
      setEditingId(created.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The map template could not be imported.");
    }
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
      await deleteTemplate.mutateAsync({ id: template.id, expectedRevision: template.revision });
      toast.success("Map template deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The map template could not be deleted.");
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
      title: existing ? "Replace this chat's map?" : "Add map template to this chat?",
      message: existing
        ? `Replace the current working hierarchy with a copy of “${template.name}”? Campaign history may prevent replacement once locations have been used.`
        : `Add a fresh copy of “${template.name}” to ${chatName || "this chat"}? The saved template will stay unchanged.`,
      confirmLabel: existing ? "Replace map" : "Add to chat",
      tone: existing ? "destructive" : "accent",
    });
    if (!confirmed) return;
    const ownerMode: SpatialOwnerMode = chatMode === "game" ? "game" : "roleplay";
    const instantiated = instantiateSpatialMapTemplate(template.data, ownerMode);
    const enablementChanged = !enabledForChat && Boolean(onEnabledForChatChange);
    try {
      if (enablementChanged) await onEnabledForChatChange?.(true);
      await updateSpatial.mutateAsync({
        chatId,
        expectedRevision: existing?.revision ?? 0,
        expectedCurrentLocationId: spatial.data.currentLocationId,
        ...(spatial.data.currentLocationId &&
        !instantiated.definition.locations.some((location) => location.id === spatial.data.currentLocationId)
          ? { replacementCurrentLocationId: instantiated.definition.startingLocationId }
          : {}),
        definition: {
          ...instantiated.definition,
          ownerMode,
          enabled: true,
          revision: existing?.revision ?? 0,
        },
        hierarchyProfile: instantiated.hierarchyProfile,
      });
      toast.success(`Added “${template.name}” to ${chatName || "the chat"}.`);
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

  if (editingTemplate) {
    return (
      <SpatialMapWorkspace
        chatId={null}
        template={editingTemplate}
        onOpenLorebook={onOpenLorebook}
        onClose={() => setEditingId(null)}
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
      <header className="mari-editor-header">
        <button type="button" onClick={onClose} className="mari-editor-action inline-flex min-h-11 min-w-11" aria-label="Back to Maps">
          <ArrowLeft size="1.125rem" />
        </button>
        <div className="mari-editor-icon-tile"><Map size="1.125rem" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-[var(--marinara-editor-title)]">Map templates</h1>
          <p className="text-[0.625rem] text-[var(--marinara-editor-muted)]">Reusable maps for Roleplay and Game; chat Gallery artwork is not copied</p>
        </div>
        <div className="mari-editor-actions flex max-sm:w-full max-sm:border-t max-sm:border-[var(--marinara-editor-divider)] max-sm:pt-2">
          <button type="button" onClick={() => importInputRef.current?.click()} className="mari-editor-action inline-flex min-h-11 px-3 text-xs">
            <Download size="0.8125rem" /> Import JSON
          </button>
          <button type="button" onClick={() => void createBlank()} disabled={createTemplate.isPending} className="mari-editor-action mari-editor-action--primary inline-flex min-h-11 px-3 text-xs disabled:opacity-45">
            {createTemplate.isPending ? <Loader2 size="0.8125rem" className="animate-spin" /> : <Plus size="0.8125rem" />}
            New map template
          </button>
          <input ref={importInputRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(event) => void importTemplate(event)} />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search map templates</span>
              <Search size="0.875rem" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--marinara-editor-muted)]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search map templates" className="mari-editor-field min-h-11 w-full pl-9 pr-3 text-sm" />
            </label>
            <button type="button" onClick={() => void templates.refetch()} disabled={templates.isFetching} className="mari-editor-action inline-flex min-h-11 justify-center px-3 text-xs disabled:opacity-45">
              <RefreshCw size="0.8125rem" className={templates.isFetching ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          {templates.isLoading ? (
            <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-[var(--marinara-editor-muted)]"><Loader2 className="animate-spin" /> Loading map templates…</div>
          ) : templates.isError ? (
            <div role="alert" className="mari-editor-panel p-5 text-sm text-[var(--destructive)]">Map templates could not be loaded.</div>
          ) : visibleTemplates.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] px-6 text-center">
              <Map size="1.5rem" className="text-[var(--marinara-editor-muted)]" />
              <h2 className="mt-3 text-base font-semibold">{query.trim() ? "No matching maps" : "No map templates yet"}</h2>
              <p className="mt-1 max-w-md text-sm text-[var(--marinara-editor-muted)]">{query.trim() ? "Try a different search." : "Create one with AI, build it manually, or import an existing map JSON."}</p>
              {!query.trim() && <button type="button" onClick={() => void createBlank()} className="mari-editor-action mari-editor-action--primary mt-4 inline-flex min-h-11 px-4 text-sm"><Plus size="0.875rem" /> New map template</button>}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleTemplates.map((template) => (
                <article key={template.id} className="mari-editor-panel flex min-h-44 flex-col p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-accent)]"><Map size="1rem" /></span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-semibold">{template.name}</h2>
                      <p className="mt-1 text-[0.6875rem] text-[var(--marinara-editor-muted)]">{template.data.definition.locations.length} {template.data.definition.locations.length === 1 ? "location" : "locations"}</p>
                    </div>
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                    <button type="button" onClick={() => setEditingId(template.id)} className="mari-editor-action inline-flex min-h-11 justify-center px-3 text-xs"><PencilLine size="0.75rem" /> Edit</button>
                    {supportedChat || onSelectForSetup ? (
                      <button type="button" onClick={() => void applyToChat(template)} disabled={updateSpatial.isPending || (!onSelectForSetup && spatial.isLoading) || template.data.definition.locations.length === 0 || !template.data.definition.startingLocationId} className="mari-editor-action mari-editor-action--primary inline-flex min-h-11 justify-center px-3 text-xs disabled:opacity-45"><Plus size="0.75rem" /> {onSelectForSetup ? "Use template" : "Add to chat"}</button>
                    ) : (
                      <button type="button" onClick={() => void removeTemplate(template)} disabled={deleteTemplate.isPending} className="mari-editor-action inline-flex min-h-11 justify-center px-3 text-xs text-[var(--destructive)] disabled:opacity-45"><Trash2 size="0.75rem" /> Delete</button>
                    )}
                  </div>
                  {(supportedChat || onSelectForSetup) && <button type="button" onClick={() => void removeTemplate(template)} disabled={deleteTemplate.isPending} className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg text-xs text-[var(--destructive)] hover:bg-[var(--destructive)]/10 disabled:opacity-45"><Trash2 size="0.75rem" /> Delete template</button>}
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
