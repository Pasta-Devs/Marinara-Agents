import React, { useEffect, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  Check,
  Edit3,
  CheckCircle2,
  Database,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { CSRF_HEADER, CSRF_HEADER_VALUE } from "@marinara-engine/shared";
import type {
  LtmExtractionSettings,
  LtmGlobalSettings,
  LtmIntegrityResponse,
  LtmDraftReviewResponse,
  LtmDebugEvent,
  LtmIdentityRepairPreviewResponse,
  LtmInteropPreviewResponse,
  LtmLastInjectionResponse,
  LtmNoteTransferPreviewResponse,
  LtmMode,
  LtmNote,
  LtmNoteTransferApplyResponse,
  LtmNoteType,
  LtmStatus,
  LtmStatusResponse,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";

const API_ROOT = "/api/long-term-memory";
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

type CapabilityProps = {
  package?: { name?: string; version?: string; readiness?: string; status?: string };
  chatId?: string | null;
  chatName?: string | null;
  enabledForChat?: boolean;
  chatSettings?: {
    longTermMemoryRecallStyle?: string;
    longTermMemoryBudgetTokens?: number;
    longTermMemoryMaxChunks?: number;
  };
  onEnabledForChatChange?: (enabled: boolean) => void | Promise<void>;
  onChatSettingsChange?: (patch: Record<string, unknown>) => void | Promise<void>;
  onClose?: () => void;
  onManagePackage?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  confirmAction?: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    tone?: "destructive" | "default";
  }) => boolean | Promise<boolean>;
};

type CapabilityElement = HTMLElement & {
  capabilityProps?: CapabilityProps;
  capabilityRuntimeError?: string | null;
  __root?: Root | null;
};

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers = new Headers();
  if (method !== "GET") headers.set(CSRF_HEADER, CSRF_HEADER_VALUE);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_ROOT}${path}`, {
    method,
    headers,
    cache: "no-store",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const message = typeof payload?.error === "string" ? payload.error : response.statusText;
    throw new Error(message || "Long-Term Memory request failed");
  }
  return response.json() as Promise<T>;
}

function Button({
  children,
  onClick,
  disabled,
  primary = false,
  destructive = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  destructive?: boolean;
  type?: "button" | "submit";
}) {
  const tone = primary
    ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
    : destructive
      ? "border-[var(--destructive)]/35 text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
      : "border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--accent)]";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
    >
      {children}
    </button>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-[var(--border)] pt-5">
      <div>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-[70ch] text-xs leading-relaxed text-[var(--muted-foreground)]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

const inputClass =
  "min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]";

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
      <span>{label}</span>
      <input
        className={inputClass}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next)));
        }}
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/45 px-3 text-xs font-medium text-[var(--foreground)]">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--primary)]"
      />
    </label>
  );
}

function GlobalSettingsForm({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const client = useQueryClient();
  const [message, setMessage] = useState("");
  const settings = useQuery({
    queryKey: ["long-term-memory", "settings"],
    queryFn: () => request<LtmGlobalSettings>("/settings"),
  });
  const [draft, setDraft] = useState<LtmGlobalSettings | null>(null);
  const dirty = Boolean(draft && settings.data && JSON.stringify(draft) !== JSON.stringify(settings.data));
  useEffect(() => {
    if (!dirty) setDraft(settings.data ?? null);
  }, [dirty, settings.data]);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  const save = useMutation({
    mutationFn: (value: LtmGlobalSettings) => request<LtmGlobalSettings>("/settings", "PUT", value),
    onSuccess: (value) => {
      client.setQueryData(["long-term-memory", "settings"], value);
      setDraft(value);
      setMessage("Recall defaults saved");
    },
    onError: (error: Error) => setMessage(error.message),
  });
  if (settings.isLoading) return <p className="text-xs text-[var(--muted-foreground)]">Loading recall defaults...</p>;
  if (settings.isError) return <p role="alert" className="text-xs text-[var(--destructive)]">Recall defaults could not load.</p>;
  if (!draft) return null;
  const patch = (value: Partial<LtmGlobalSettings>) => setDraft((current) => ({ ...current!, ...value }));
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
          <span>Recall style</span>
          <select className={inputClass} value={draft.longTermMemoryRecallStyle} onChange={(event) => patch({ longTermMemoryRecallStyle: event.target.value as LtmGlobalSettings["longTermMemoryRecallStyle"] })}>
            <option value="balanced">Balanced</option>
            <option value="exact">Exact</option>
            <option value="broad">Broad</option>
            <option value="story">Story</option>
          </select>
        </label>
        <NumberField label="Recall context budget" value={draft.longTermMemoryBudgetTokens ?? 4096} min={128} max={16384} step={128} onChange={(value) => patch({ longTermMemoryBudgetTokens: value })} />
        <NumberField label="Maximum memories" value={draft.longTermMemoryMaxChunks ?? 20} min={1} max={100} onChange={(value) => patch({ longTermMemoryMaxChunks: value })} />
        <NumberField label="Context messages" value={draft.longTermMemoryRecallContextMessages ?? 4} min={1} max={20} onChange={(value) => patch({ longTermMemoryRecallContextMessages: value })} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle label="Include resolved threads" checked={draft.longTermMemoryIncludeResolved ?? false} onChange={(value) => patch({ longTermMemoryIncludeResolved: value })} />
        <Toggle label="Debug retrieval logs" checked={draft.longTermMemoryDebug ?? false} onChange={(value) => patch({ longTermMemoryDebug: value })} />
      </div>
      <Button primary disabled={!dirty || save.isPending} onClick={() => save.mutate(draft)}>
        {save.isPending ? <Loader2 size="0.875rem" className="animate-spin" /> : <Save size="0.875rem" />}
        Save recall defaults
      </Button>
      {message ? <p role="status" className="text-xs text-[var(--muted-foreground)]">{message}</p> : null}
    </div>
  );
}

function ExtractionSettingsForm({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const client = useQueryClient();
  const [message, setMessage] = useState("");
  const settings = useQuery({
    queryKey: ["long-term-memory", "extraction-settings"],
    queryFn: async () => {
      const { systemPrompt: _systemPrompt, activePromptTemplateId: _activePromptTemplateId, ...editable } =
        await request<LtmExtractionSettings & { systemPrompt?: string; activePromptTemplateId?: string | null }>(
          "/extraction-settings",
        );
      return editable;
    },
  });
  const [draft, setDraft] = useState<LtmExtractionSettings | null>(null);
  const dirty = Boolean(draft && settings.data && JSON.stringify(draft) !== JSON.stringify(settings.data));
  useEffect(() => {
    if (!dirty) setDraft(settings.data ?? null);
  }, [dirty, settings.data]);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  const save = useMutation({
    mutationFn: (value: LtmExtractionSettings) => request<LtmExtractionSettings>("/extraction-settings", "PUT", value),
    onSuccess: (value) => {
      client.setQueryData(["long-term-memory", "extraction-settings"], value);
      setDraft(value);
      setMessage("Extraction options saved");
    },
    onError: (error: Error) => setMessage(error.message),
  });
  if (settings.isLoading) return <p className="text-xs text-[var(--muted-foreground)]">Loading extraction options...</p>;
  if (settings.isError) return <p role="alert" className="text-xs text-[var(--destructive)]">Extraction options could not load.</p>;
  if (!draft) return null;
  const patch = (value: Partial<LtmExtractionSettings>) => setDraft((current) => ({ ...current!, ...value }));
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField label="Maximum output tokens" value={draft.maxOutputTokens ?? 8192} min={512} max={32768} step={256} onChange={(value) => patch({ maxOutputTokens: value })} />
        <NumberField label="Existing-memory context" value={draft.maxExistingNoteTokens ?? 4096} min={128} max={32768} step={128} onChange={(value) => patch({ maxExistingNoteTokens: value })} />
        <NumberField label="Temperature" value={draft.temperature ?? 0} min={0} max={2} step={0.1} onChange={(value) => patch({ temperature: value })} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle label="Suggest memory keywords" checked={draft.aiKeywordExtraction ?? false} onChange={(value) => patch({ aiKeywordExtraction: value })} />
        <Toggle label="Refine imported game summaries" checked={draft.refinePass ?? false} onChange={(value) => patch({ refinePass: value })} />
      </div>
      <Button primary disabled={!dirty || save.isPending} onClick={() => save.mutate(draft)}>
        {save.isPending ? <Loader2 size="0.875rem" className="animate-spin" /> : <Save size="0.875rem" />}
        Save extraction options
      </Button>
      {message ? <p role="status" className="text-xs text-[var(--muted-foreground)]">{message}</p> : null}
    </div>
  );
}

function Maintenance({ confirmAction }: Pick<CapabilityProps, "confirmAction">) {
  const client = useQueryClient();
  const [message, setMessage] = useState("");
  const integrity = useQuery({
    queryKey: ["long-term-memory", "integrity"],
    queryFn: () => request<LtmIntegrityResponse>("/integrity"),
  });
  const rebuild = useMutation({
    mutationFn: () => request("/rebuild", "POST"),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["long-term-memory"] });
      setMessage("Memory index rebuilt");
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const repair = useMutation({
    mutationFn: () => request("/repair", "POST", { actions: ["quarantine_malformed_notes", "backfill_imported_source_titles", "rebuild_indexes"] }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["long-term-memory"] });
      setMessage("Memory store repaired");
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const runRepair = async () => {
    const confirmed = confirmAction
      ? await confirmAction({ title: "Repair memory store?", message: "Malformed notes will be quarantined before indexes are rebuilt.", confirmLabel: "Repair", tone: "destructive" })
      : window.confirm("Repair the memory store? Malformed notes will be quarantined.");
    if (confirmed) repair.mutate();
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
        {integrity.isLoading ? <Loader2 size="0.875rem" className="animate-spin" /> : integrity.data?.ok ? <CheckCircle2 size="0.875rem" className="text-emerald-500" /> : <AlertTriangle size="0.875rem" className="text-[var(--destructive)]" />}
        <span>{integrity.data ? `${integrity.data.noteCount} memories, ${integrity.data.ok ? "store healthy" : `${integrity.data.issues.length} issues found`}` : integrity.isError ? "Memory store check failed" : "Checking memory store"}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button primary disabled={rebuild.isPending} onClick={() => rebuild.mutate()}>
          {rebuild.isPending ? <Loader2 size="0.875rem" className="animate-spin" /> : <RefreshCw size="0.875rem" />}
          Reindex memories
        </Button>
        <Button destructive disabled={repair.isPending} onClick={() => void runRepair()}>
          {repair.isPending ? <Loader2 size="0.875rem" className="animate-spin" /> : <ShieldCheck size="0.875rem" />}
          Repair store
        </Button>
      </div>
      {message ? <p role="status" className="text-xs text-[var(--muted-foreground)]">{message}</p> : null}
    </div>
  );
}

const noteTypes: LtmNoteType[] = ["character", "relationship", "scene", "thread", "world", "tone", "timeline_event"];
const noteModes: LtmMode[] = ["conversation", "roleplay", "game"];
const notePrefixes: Record<LtmNoteType, string> = {
  source: "source",
  timeline_event: "timeline",
  character: "char",
  relationship: "rel",
  scene: "scene",
  thread: "thread",
  world: "world",
  tone: "tone",
};

function newNoteDraft(): Pick<LtmNote, "id" | "title" | "type" | "status" | "modes" | "sections"> {
  const now = new Date().toISOString();
  return {
    id: `world_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
    title: "Untitled memory",
    type: "world",
    status: "active",
    modes: ["conversation", "roleplay", "game"],
    sections: { summary: { text: "", updatedAt: now } },
  };
}

function editableNote(note: LtmNote): Pick<LtmNote, "id" | "title" | "type" | "status" | "modes" | "sections"> {
  return { id: note.id, title: note.title, type: note.type, status: note.status, modes: note.modes, sections: note.sections };
}

function Vault({ confirmAction, onDirtyChange }: Pick<CapabilityProps, "confirmAction" | "onDirtyChange">) {
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Pick<LtmNote, "id" | "title" | "type" | "status" | "modes" | "sections"> | null>(null);
  const [message, setMessage] = useState("");
  const notes = useQuery({ queryKey: ["long-term-memory", "notes"], queryFn: () => request<LtmNote[]>("/notes") });
  const save = useMutation({
    mutationFn: async (value: typeof draft) => {
      if (!value) throw new Error("No note selected");
      const title = value.title?.trim() || undefined;
      const body = { ...(title ? { title } : {}), status: value.status, modes: value.modes, sections: value.sections };
      return value.id && notes.data?.some((note) => note.id === value.id)
        ? request<LtmNote>(`/notes/${value.id}`, "PATCH", body)
        : request<LtmNote>("/notes", "POST", { ...body, id: value.id, type: value.type, scope: {}, tags: [], keywords: [], links: [] });
    },
    onSuccess: async (value) => {
      client.setQueryData<LtmNote[]>(["long-term-memory", "notes"], (current) => {
        const without = (current ?? []).filter((note) => note.id !== value.id);
        return [...without, value].sort((a, b) => a.id.localeCompare(b.id));
      });
      setSelectedId(value.id);
      setDraft(editableNote(value));
      setMessage("Memory saved");
      await client.invalidateQueries({ queryKey: ["long-term-memory", "status"] });
      await client.invalidateQueries({ queryKey: ["long-term-memory", "integrity"] });
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const currentNote = selectedId ? notes.data?.find((note) => note.id === selectedId) : null;
  const dirty = Boolean(draft && (!currentNote || JSON.stringify(draft) !== JSON.stringify(editableNote(currentNote))));
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  const canDiscardDraft = async () => {
    if (!dirty) return true;
    return confirmAction
      ? confirmAction({ title: "Discard memory changes?", message: "Your unsaved memory edits will be lost.", confirmLabel: "Discard", tone: "destructive" })
      : window.confirm("Discard your unsaved memory edits?");
  };
  const selectNote = async (note: LtmNote) => {
    if (!await canDiscardDraft()) return;
    setSelectedId(note.id);
    setDraft(editableNote(note));
    setMessage("");
  };
  const patch = (value: Partial<NonNullable<typeof draft>>) => setDraft((current) => current ? { ...current, ...value } : current);
  const section = draft ? Object.entries(draft.sections)[0] : null;
  return (
    <Panel title="Memory vault" description="Browse and edit durable memories without leaving the package.">
      <div className="grid gap-4 lg:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.4fr)]">
        <div className="space-y-2">
          <Button primary onClick={() => void (async () => { if (!await canDiscardDraft()) return; const next = newNoteDraft(); setSelectedId(null); setDraft(next); setMessage(""); })()}>
            <Plus size="0.875rem" /> New memory
          </Button>
          {notes.isLoading ? <p className="text-xs text-[var(--muted-foreground)]">Loading memories...</p> : null}
          {notes.isError ? <p role="alert" className="text-xs text-[var(--destructive)]">Memories could not load.</p> : null}
          <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
            {(notes.data ?? []).map((note) => (
              <button key={note.id} type="button" onClick={() => void selectNote(note)} className={`flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-left text-xs ${selectedId === note.id ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)] bg-[var(--secondary)]/45 hover:bg-[var(--accent)]"}`}>
                <Edit3 size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                <span className="min-w-0 flex-1 truncate">{note.title ?? note.id}</span>
                <span className="text-[var(--muted-foreground)]">{note.type}</span>
              </button>
            ))}
          </div>
        </div>
        {draft ? (
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); save.mutate(draft); }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]"><span>Title</span><input className={inputClass} value={draft.title ?? ""} onChange={(event) => patch({ title: event.target.value })} /></label>
              <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]"><span>Type</span><select className={inputClass} value={draft.type} disabled={Boolean(selectedId)} onChange={(event) => { const type = event.target.value as LtmNoteType; patch({ type, id: `${notePrefixes[type]}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}` }); }}>{noteTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
              <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]"><span>Status</span><select className={inputClass} value={draft.status} onChange={(event) => patch({ status: event.target.value as LtmStatus })}><option value="active">Active</option><option value="resolved">Resolved</option><option value="archived">Archived</option></select></label>
            </div>
            <div className="flex flex-wrap gap-2">
              {noteModes.map((mode) => <label key={mode} className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs"><input type="checkbox" checked={draft.modes.includes(mode)} onChange={(event) => patch({ modes: event.target.checked ? [...new Set([...draft.modes, mode])] : draft.modes.filter((item) => item !== mode) })} />{mode}</label>)}
            </div>
            <label className="block space-y-1 text-xs font-medium text-[var(--muted-foreground)]"><span>Memory text</span><textarea className={`${inputClass} min-h-44 py-3`} value={section?.[1].text ?? ""} onChange={(event) => { const key = section?.[0] ?? "summary"; patch({ sections: { ...draft.sections, [key]: { ...draft.sections[key], text: event.target.value, updatedAt: new Date().toISOString() } } }); }} /></label>
            <div className="flex flex-wrap items-center gap-2"><Button primary type="submit" disabled={save.isPending || draft.modes.length === 0 || !(section?.[1].text.trim())}>{save.isPending ? <Loader2 size="0.875rem" className="animate-spin" /> : <Save size="0.875rem" />} Save memory</Button>{message ? <span role="status" className="text-xs text-[var(--muted-foreground)]">{message}</span> : null}</div>
          </form>
        ) : <p className="text-xs text-[var(--muted-foreground)]">Select a memory to edit.</p>}
      </div>
    </Panel>
  );
}

function Review() {
  const client = useQueryClient();
  const [message, setMessage] = useState("");
  const review = useQuery({
    queryKey: ["long-term-memory", "draft-review"],
    queryFn: () => request<LtmDraftReviewResponse>("/drafts/review?status=pending"),
  });
  const action = useMutation({
    mutationFn: async ({ draftId, mutationId, accept }: { draftId: string; mutationId: string; accept: boolean }) =>
      request(accept ? `/drafts/${draftId}/accept` : `/drafts/${draftId}/skip`, "POST", { mutationIds: [mutationId] }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["long-term-memory", "draft-review"] });
      await client.invalidateQueries({ queryKey: ["long-term-memory", "notes"] });
      setMessage("Review updated");
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const drafts = new Map(review.data?.sources.flatMap((source) => source.drafts.map((draft) => [draft.draft.id, draft] as const)) ?? []);
  const rows = review.data?.sources.flatMap((source) => source.targets.flatMap((target) => target.rows)) ?? [];
  return (
    <Panel title="Review suggestions" description="Accept or skip pending extracted memory changes.">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
        {review.isLoading ? <Loader2 size="0.875rem" className="animate-spin" /> : null}
        <span>{review.data ? `${review.data.counts.mutations} pending suggestions` : review.isError ? "Suggestions could not load" : "Loading suggestions"}</span>
      </div>
      {review.isError ? <p role="alert" className="text-xs text-[var(--destructive)]">Review suggestions could not load.</p> : null}
      <div className="space-y-2">
        {rows.map((row) => {
          const mutation = row.mutation;
          const target = mutation.kind === "create_note" ? mutation.note.title ?? mutation.note.id : mutation.noteId;
          const draft = drafts.get(row.draftId);
          const blocked = !draft || draft.freshness !== "fresh" || draft.blockReasons.length > 0;
          return (
            <div key={`${row.draftId}-${mutation.id}`} className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/45 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><p className="text-xs font-semibold text-[var(--foreground)]">{mutation.summary}</p><p className="mt-1 truncate text-[11px] text-[var(--muted-foreground)]">{target} · {mutation.risk} risk</p></div>
                <span className="text-[11px] text-[var(--muted-foreground)]">{row.disposition}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button primary disabled={action.isPending || blocked} onClick={() => action.mutate({ draftId: row.draftId, mutationId: mutation.id, accept: true })}><Check size="0.875rem" /> Accept</Button>
                <Button disabled={action.isPending} onClick={() => action.mutate({ draftId: row.draftId, mutationId: mutation.id, accept: false })}>Skip</Button>
              </div>
              {blocked ? <p className="text-[11px] text-[var(--destructive)]">{draft?.blockReasons[0]?.message ?? "Refresh this suggestion before accepting it."}</p> : null}
            </div>
          );
        })}
      </div>
      {!review.isLoading && !review.isError && rows.length === 0 ? <p className="text-xs text-[var(--muted-foreground)]">No pending suggestions.</p> : null}
      {message ? <p role="status" className="text-xs text-[var(--muted-foreground)]">{message}</p> : null}
    </Panel>
  );
}

function ImportTools() {
  const client = useQueryClient();
  const [source, setSource] = useState<"characters" | "lorebooks" | "chats">("characters");
  const [message, setMessage] = useState("");
  const preview = useQuery({
    queryKey: ["long-term-memory", "import-preview", source],
    queryFn: () => request<LtmInteropPreviewResponse>("/import/preview", "POST", { source, limit: 100 }),
  });
  const importSources = useMutation({
    mutationFn: () => request("/import/source-notes", "POST", { source, sourceIds: (preview.data?.samples ?? []).filter((sample) => sample.status === "pending").map((sample) => sample.sourceId), limit: 100 }),
    onSuccess: async (result: { imported?: unknown[]; batchStatus?: string }) => {
      await client.invalidateQueries({ queryKey: ["long-term-memory"] });
      setMessage(`${result.imported?.length ?? 0} sources imported (${result.batchStatus ?? "complete"})`);
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const pending = (preview.data?.samples ?? []).filter((sample) => sample.status === "pending");
  return (
    <Panel title="Import sources" description="Preview package-owned character, lorebook, and chat sources before importing them into the vault.">
      <div className="flex flex-wrap gap-2">
        {(["characters", "lorebooks", "chats"] as const).map((value) => <button key={value} type="button" onClick={() => setSource(value)} className={`min-h-10 rounded-lg border px-3 text-xs font-semibold ${source === value ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)] bg-[var(--secondary)]"}`}>{value}</button>)}
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">{preview.isLoading ? "Scanning sources..." : preview.data ? `${preview.data.draftable} sources ready, ${preview.data.importedCount} already imported` : preview.isError ? "Source preview unavailable" : "Loading source preview"}</p>
      {preview.data?.samples.length ? <div className="max-h-56 space-y-1 overflow-y-auto">{preview.data.samples.map((sample) => <div key={sample.sourceId} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs"><span className="min-w-0 flex-1 truncate">{sample.title}</span><span className="text-[var(--muted-foreground)]">{sample.status}</span></div>)}</div> : null}
      <div className="flex flex-wrap items-center gap-2"><Button primary disabled={importSources.isPending || pending.length === 0} onClick={() => importSources.mutate()}>{importSources.isPending ? <Loader2 size="0.875rem" className="animate-spin" /> : <Download size="0.875rem" />} Import pending sources</Button>{message ? <span role="status" className="text-xs text-[var(--muted-foreground)]">{message}</span> : null}</div>
    </Panel>
  );
}

function IdentityRepair({ confirmAction }: Pick<CapabilityProps, "confirmAction">) {
  const client = useQueryClient();
  const [message, setMessage] = useState("");
  const preview = useQuery({ queryKey: ["long-term-memory", "identity-preview"], queryFn: () => request<LtmIdentityRepairPreviewResponse>("/identity-repair/preview", "POST", { scope: {} }) });
  const apply = useMutation({
    mutationFn: () => request("/identity-repair/apply", "POST", { scope: {}, repairs: repairable.map((candidate) => ({ candidateId: candidate.id, canonicalNoteId: candidate.canonicalNoteId, excludedNoteIds: [], sectionChoices: [] })) }),
    onSuccess: async (result: { repairs?: unknown[] }) => {
      await client.invalidateQueries({ queryKey: ["long-term-memory"] });
      setMessage(`${result.repairs?.length ?? 0} identity groups repaired`);
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const repairable = (preview.data?.candidates ?? []).filter((candidate) => candidate.blockingReasons.length === 0 && candidate.supersedingConflicts.length === 0);
  const runApply = async () => {
    const confirmed = confirmAction
      ? await confirmAction({ title: "Merge duplicate identities?", message: "Duplicate notes will be merged into each canonical memory and archived.", confirmLabel: "Merge duplicates", tone: "destructive" })
      : window.confirm("Merge duplicate identities and archive the duplicate notes?");
    if (confirmed) apply.mutate();
  };
  return (
    <Panel title="Identity repair" description="Review duplicate character and relationship identities before applying the safe canonical merge.">
      <p className="text-xs text-[var(--muted-foreground)]">{preview.isLoading ? "Analyzing identities..." : preview.data ? `${preview.data.counts.candidateCount} candidate groups, ${preview.data.counts.unresolvedNotes} unresolved notes` : preview.isError ? "Identity preview unavailable" : "Loading identity preview"}</p>
      {repairable.length ? <div className="max-h-48 space-y-1 overflow-y-auto">{repairable.map((candidate) => <div key={candidate.id} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs"><span className="font-semibold">{candidate.subjectNames.join(" / ")}</span><span className="ml-2 text-[var(--muted-foreground)]">{candidate.duplicateNoteIds.length} duplicate(s)</span></div>)}</div> : null}
      <div className="flex flex-wrap items-center gap-2"><Button destructive disabled={apply.isPending || repairable.length === 0} onClick={() => void runApply()}>{apply.isPending ? <Loader2 size="0.875rem" className="animate-spin" /> : <ShieldCheck size="0.875rem" />} Apply safe repairs</Button>{message ? <span role="status" className="text-xs text-[var(--muted-foreground)]">{message}</span> : null}</div>
    </Panel>
  );
}

function Transfer({ chatId }: { chatId?: string | null }) {
  const client = useQueryClient();
  const notes = useQuery({ queryKey: ["long-term-memory", "notes"], queryFn: () => request<LtmNote[]>("/notes") });
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<"copy" | "move">("copy");
  const [preview, setPreview] = useState<LtmNoteTransferPreviewResponse | null>(null);
  const [message, setMessage] = useState("");
  const transfer = useMutation({
    mutationFn: (apply: boolean) => request<LtmNoteTransferPreviewResponse | LtmNoteTransferApplyResponse>(apply ? "/notes/transfer" : "/notes/transfer-preview", "POST", {
      noteIds: preview && apply ? preview.items.filter((item) => item.defaultIncluded).map((item) => item.noteId) : selected,
      mode,
      destinationChatId: chatId,
      includeDerived: false,
    }),
    onSuccess: async (value, apply) => {
      if (apply) {
        setPreview(null); setSelected([]); setMessage("Notes transferred");
        await client.invalidateQueries({ queryKey: ["long-term-memory"] });
      } else setPreview(value as LtmNoteTransferPreviewResponse);
    },
    onError: (error: Error) => setMessage(error.message),
  });
  const toggle = (id: string) => { setPreview(null); setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); };
  return (
    <Panel title="Transfer notes" description="Preview copying or moving selected memories into the current chat scope.">
      {!chatId ? <p className="text-xs text-[var(--muted-foreground)]">Open this package from a chat to transfer notes.</p> : <>
        {notes.isLoading ? <p className="text-xs text-[var(--muted-foreground)]">Loading memories...</p> : null}
        {notes.isError ? <p role="alert" className="text-xs text-[var(--destructive)]">Memories could not load.</p> : null}
        <div className="max-h-48 space-y-1 overflow-y-auto">{(notes.data ?? []).map((note) => <label key={note.id} className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs"><input type="checkbox" checked={selected.includes(note.id)} onChange={() => toggle(note.id)} /><span className="min-w-0 flex-1 truncate">{note.title ?? note.id}</span><span className="text-[var(--muted-foreground)]">{note.type}</span></label>)}</div>
        <div className="flex flex-wrap gap-2"><select className={`${inputClass} max-w-32`} value={mode} onChange={(event) => { setPreview(null); setMode(event.target.value as typeof mode); }}><option value="copy">Copy</option><option value="move">Move</option></select><Button primary disabled={transfer.isPending || selected.length === 0} onClick={() => transfer.mutate(false)}>{transfer.isPending ? <Loader2 size="0.875rem" className="animate-spin" /> : null} Preview transfer</Button></div>
        {preview ? <div className="space-y-2 rounded-lg border border-[var(--border)] p-3 text-xs"><p>{preview.buckets.ready.length} ready, {preview.buckets.conflict.length} conflicts, {preview.buckets.noOp.length} unchanged</p>{preview.items.filter((item) => item.classification === "conflict").map((item) => <p key={item.noteId} className="text-[var(--destructive)]">{item.title}: {item.conflicts[0]?.reason ?? "conflict"}</p>)}<Button primary disabled={transfer.isPending || preview.buckets.ready.length === 0} onClick={() => transfer.mutate(true)}>Apply ready transfer</Button></div> : null}
      </>}
      {message ? <p role="status" className="text-xs text-[var(--muted-foreground)]">{message}</p> : null}
    </Panel>
  );
}

function DebugAndContext({ chatId }: { chatId?: string | null }) {
  const client = useQueryClient();
  const [message, setMessage] = useState("");
  const debug = useQuery({ queryKey: ["long-term-memory", "debug-log"], queryFn: () => request<{ events: LtmDebugEvent[] }>("/debug-log?limit=50") });
  const context = useQuery({ enabled: Boolean(chatId), queryKey: ["long-term-memory", "last-injection", chatId], queryFn: () => request<LtmLastInjectionResponse>(`/last-injection/${encodeURIComponent(chatId!)}`) });
  const clear = useMutation({ mutationFn: () => request("/debug-log", "DELETE"), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["long-term-memory", "debug-log"] }); setMessage("Debug log cleared"); }, onError: (error: Error) => setMessage(error.message) });
  return <>
    <Panel title="Active context" description="Inspect the memories most recently contributed to this chat.">
      {!chatId ? <p className="text-xs text-[var(--muted-foreground)]">Open this package from a chat to inspect active context.</p> : <p className={`text-xs ${context.isError ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]"}`}>{context.isLoading ? "Loading active context..." : context.isError ? "Active context could not load." : context.data ? `${context.data.memoryCount} memories, ${context.data.tokenCount} tokens` : "No memories were injected for this chat."}</p>}
      {context.data?.memories.length ? <div className="space-y-1">{context.data.memories.map((memory) => <div key={memory.noteId} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs"><span className="truncate">{memory.title}</span><span className="text-[var(--muted-foreground)]">{memory.tokenCount} tokens</span></div>)}</div> : null}
    </Panel>
    <Panel title="Debug log" description="Inspect recent package operations and export or clear diagnostic events.">
      <div className="flex flex-wrap gap-2"><Button onClick={() => window.open(`${API_ROOT}/debug-log/export`, "_blank", "noopener,noreferrer")}><Download size="0.875rem" /> Export log</Button><Button destructive disabled={clear.isPending} onClick={() => clear.mutate()}><Trash2 size="0.875rem" /> Clear log</Button></div>
      {debug.isError ? <p role="alert" className="text-xs text-[var(--destructive)]">Debug log could not load.</p> : null}
      <div className="max-h-56 space-y-1 overflow-y-auto">{(debug.data?.events ?? []).map((event) => <div key={event.id} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs"><div className="flex justify-between gap-2"><span className="font-semibold">{event.phase}: {event.action}</span><span className="text-[var(--muted-foreground)]">{event.status}</span></div>{event.message ? <p className="mt-1 text-[var(--muted-foreground)]">{event.message}</p> : null}</div>)}</div>
      {message ? <p role="status" className="text-xs text-[var(--muted-foreground)]">{message}</p> : null}
    </Panel>
  </>;
}

function ChatSettings({ props }: { props: CapabilityProps }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const lastInjection = useQuery({
    enabled: Boolean(props.chatId && props.enabledForChat),
    queryKey: ["long-term-memory", "last-injection", props.chatId],
    queryFn: () => request<LtmLastInjectionResponse>(`/last-injection/${encodeURIComponent(props.chatId!)}`),
  });
  const runUpdate = async (operation: () => void | Promise<void>) => {
    setPending(true);
    setMessage("");
    try {
      await operation();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update this chat");
    } finally {
      setPending(false);
    }
  };
  const update = (patch: Record<string, unknown>) => void runUpdate(() => props.onChatSettingsChange?.(patch));
  const enabled = props.enabledForChat === true;
  const settings = props.chatSettings ?? {};
  return (
    <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--background)]/45 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold">Long-Term Memory</h3>
          <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">Recall durable facts and events in this chat.</p>
        </div>
        <Button primary={enabled} disabled={pending} onClick={() => void runUpdate(() => props.onEnabledForChatChange?.(!enabled))}>
          {pending ? <Loader2 size="0.875rem" className="animate-spin" /> : null}
          {enabled ? "Enabled" : "Enable"}
        </Button>
      </div>
      {enabled ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]"><span>Recall style</span><select className={inputClass} disabled={pending} value={settings.longTermMemoryRecallStyle ?? "balanced"} onChange={(event) => update({ longTermMemoryRecallStyle: event.target.value })}><option value="balanced">Balanced</option><option value="exact">Exact</option><option value="broad">Broad</option><option value="story">Story</option></select></label>
            <NumberField label="Recall context budget" value={settings.longTermMemoryBudgetTokens ?? 4096} min={128} max={16384} step={128} onChange={(value) => update({ longTermMemoryBudgetTokens: value })} />
            <NumberField label="Maximum memories" value={settings.longTermMemoryMaxChunks ?? 20} min={1} max={100} onChange={(value) => update({ longTermMemoryMaxChunks: value })} />
          </div>
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{lastInjection.data ? `${lastInjection.data.memoryCount} memories, ${lastInjection.data.tokenCount.toLocaleString()} tokens in the last recall.` : "No memories have been recalled for this chat yet."}</p>
        </>
      ) : null}
      {message ? <p role="alert" className="text-xs text-[var(--destructive)]">{message}</p> : null}
    </section>
  );
}

function Detail({ props }: { props: CapabilityProps }) {
  const status = useQuery({
    queryKey: ["long-term-memory", "status"],
    queryFn: () => request<LtmStatusResponse>("/status"),
  });
  const [activationPending, setActivationPending] = useState(false);
  const [activationError, setActivationError] = useState("");
  const [recallDirty, setRecallDirty] = useState(false);
  const [extractionDirty, setExtractionDirty] = useState(false);
  const [vaultDirty, setVaultDirty] = useState(false);
  useEffect(() => props.onDirtyChange?.(recallDirty || extractionDirty || vaultDirty), [extractionDirty, props.onDirtyChange, recallDirty, vaultDirty]);
  const toggleActivation = async () => {
    if (!props.onEnabledForChatChange) return;
    setActivationPending(true);
    setActivationError("");
    try {
      await props.onEnabledForChatChange(!props.enabledForChat);
    } catch (error) {
      setActivationError(error instanceof Error ? error.message : "Could not update this chat");
    } finally {
      setActivationPending(false);
    }
  };
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-10 flex min-h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--background)] px-4">
        <button type="button" onClick={props.onClose} aria-label="Back to Agents" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--accent)]">
          <ArrowLeft size="1rem" />
        </button>
        <BrainCircuit size="1.125rem" className="text-[var(--primary)]" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">Long-Term Memory</h1>
          <p className="text-xs text-[var(--muted-foreground)]">Version {props.package?.version ?? "unknown"}</p>
        </div>
        <button type="button" onClick={props.onManagePackage} aria-label="Manage package" title="Manage package" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--accent)]">
          <Settings2 size="1rem" />
        </button>
      </header>
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]"><Database size="1rem" /></span>
            <div>
              <p className="text-sm font-semibold">{status.data ? `${status.data.notes.total} saved memories` : "Memory vault"}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{status.data ? `${status.data.indexes.chunkCount ?? 0} indexed chunks` : status.isError ? "Status unavailable" : "Loading status"}</p>
            </div>
          </div>
          {props.chatId ? (
            <Button primary={props.enabledForChat === true} disabled={activationPending} onClick={() => void toggleActivation()}>
              {activationPending ? <Loader2 size="0.875rem" className="animate-spin" /> : null}
              {props.enabledForChat ? `Active in ${props.chatName ?? "this chat"}` : "Enable for this chat"}
            </Button>
          ) : null}
        </div>
        {activationError ? <p role="alert" className="text-xs text-[var(--destructive)]">{activationError}</p> : null}
        <Panel title="Recall defaults" description="Control how much saved context is selected for future prompts.">
          <GlobalSettingsForm onDirtyChange={setRecallDirty} />
        </Panel>
        <Panel title="Extraction options" description="Set bounded model output and optional enrichment behavior.">
          <ExtractionSettingsForm onDirtyChange={setExtractionDirty} />
        </Panel>
        <Vault confirmAction={props.confirmAction} onDirtyChange={setVaultDirty} />
        <Review />
        <ImportTools />
        <IdentityRepair confirmAction={props.confirmAction} />
        <Transfer chatId={props.chatId} />
        <DebugAndContext chatId={props.chatId} />
        <Panel title="Maintenance" description="Check durable files and rebuild derived search data.">
          <Maintenance confirmAction={props.confirmAction} />
        </Panel>
      </div>
    </main>
  );
}

class CapabilityClientErrorBoundary extends React.Component<
  { element: CapabilityElement; children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) {
    const message = error.message || "Long-Term Memory interface stopped";
    this.props.element.capabilityRuntimeError = message;
    this.props.element.dispatchEvent(new CustomEvent("marinara-capability-runtime-error", { detail: { message }, bubbles: true }));
    console.error("Long-Term Memory client capability stopped", error);
  }
  render() { return this.state.error ? null : this.props.children; }
}

function CapabilityRoot({ element }: { element: CapabilityElement }) {
  const [, redraw] = useState(0);
  useEffect(() => {
    const update = () => redraw((value) => value + 1);
    element.addEventListener("marinara-capability-props", update);
    return () => element.removeEventListener("marinara-capability-props", update);
  }, [element]);
  const props = element.capabilityProps ?? {};
  if (element.getAttribute("view") === "settings") return <ChatSettings props={props} />;
  if (element.getAttribute("view") !== "detail") return null;
  return <Detail props={props} />;
}

class LongTermMemoryElement extends HTMLElement {
  __root: Root | null = null;
  capabilityProps?: CapabilityProps;
  capabilityRuntimeError?: string | null;
  connectedCallback() {
    if (!this.__root) this.__root = createRoot(this);
    this.__root.render(
      <QueryClientProvider client={queryClient}>
        <CapabilityClientErrorBoundary element={this}><CapabilityRoot element={this} /></CapabilityClientErrorBoundary>
      </QueryClientProvider>,
    );
  }
  disconnectedCallback() {
    queueMicrotask(() => {
      if (!this.isConnected && this.__root) {
        this.__root.unmount();
        this.__root = null;
      }
    });
  }
}

const tag = "marinara-capability-long-term-memory";
if (!customElements.get(tag)) customElements.define(tag, LongTermMemoryElement);
