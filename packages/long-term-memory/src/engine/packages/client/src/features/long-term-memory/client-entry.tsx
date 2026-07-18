import React, { useEffect, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { CSRF_HEADER, CSRF_HEADER_VALUE } from "@marinara-engine/shared";
import type {
  LtmExtractionSettings,
  LtmGlobalSettings,
  LtmIntegrityResponse,
  LtmStatusResponse,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";

const API_ROOT = "/api/long-term-memory";
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

type CapabilityProps = {
  package?: { name?: string; version?: string; readiness?: string; status?: string };
  chatId?: string | null;
  chatName?: string | null;
  enabledForChat?: boolean;
  onEnabledForChatChange?: (enabled: boolean) => void | Promise<void>;
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
  useEffect(() => setDraft(settings.data ?? null), [settings.data]);
  const dirty = Boolean(draft && settings.data && JSON.stringify(draft) !== JSON.stringify(settings.data));
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
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
  useEffect(() => setDraft(settings.data ?? null), [settings.data]);
  const dirty = Boolean(draft && settings.data && JSON.stringify(draft) !== JSON.stringify(settings.data));
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
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
        <span>{integrity.data ? `${integrity.data.noteCount} memories, ${integrity.data.ok ? "store healthy" : `${integrity.data.issues.length} issues found`}` : "Checking memory store"}</span>
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

function Detail({ props }: { props: CapabilityProps }) {
  const status = useQuery({
    queryKey: ["long-term-memory", "status"],
    queryFn: () => request<LtmStatusResponse>("/status"),
  });
  const [activationPending, setActivationPending] = useState(false);
  const [activationError, setActivationError] = useState("");
  const [recallDirty, setRecallDirty] = useState(false);
  const [extractionDirty, setExtractionDirty] = useState(false);
  useEffect(() => props.onDirtyChange?.(recallDirty || extractionDirty), [extractionDirty, props.onDirtyChange, recallDirty]);
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
  if (element.getAttribute("view") !== "detail") return null;
  return <Detail props={element.capabilityProps ?? {}} />;
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
