import { Settings2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  LtmGlobalSettings,
  LtmLastInjectionResponse,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { queryKeys, request } from "./api";
import { NumberField, StatusSurface, inputClass } from "./shared-controls";
import type { CapabilityProps } from "./types";

export function ChatSettings({ props }: { props: CapabilityProps }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const globalSettings = useQuery({
    queryKey: queryKeys.chatDefaults,
    queryFn: () => request<LtmGlobalSettings>("/settings"),
  });
  const lastInjection = useQuery({
    enabled: Boolean(props.chatId),
    queryKey: queryKeys.lastInjection(props.chatId),
    queryFn: () =>
      request<LtmLastInjectionResponse>(
        `/last-injection/${encodeURIComponent(props.chatId!)}`,
      ),
  });
  const runUpdate = async (operation: () => void | Promise<void>) => {
    setPending(true);
    setMessage("");
    try {
      await operation();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update this chat",
      );
    } finally {
      setPending(false);
    }
  };
  const update = (patch: Record<string, unknown>) =>
    void runUpdate(() => props.onChatSettingsChange?.(patch));
  const settings = props.chatSettings ?? {};
  const readOnly = typeof props.onChatSettingsChange !== "function";
  const effectiveStyle =
    settings.longTermMemoryRecallStyle ??
    globalSettings.data?.longTermMemoryRecallStyle ??
    "balanced";
  const effectiveBudget =
    settings.longTermMemoryBudgetTokens ??
    globalSettings.data?.longTermMemoryBudgetTokens ??
    4096;
  const effectiveMaxChunks =
    settings.longTermMemoryMaxChunks ??
    globalSettings.data?.longTermMemoryMaxChunks ??
    20;
  const styleInherited = settings.longTermMemoryRecallStyle == null;
  const budgetInherited = settings.longTermMemoryBudgetTokens == null;
  const maxChunksInherited = settings.longTermMemoryMaxChunks == null;

  return (
    <section data-ltm-surface="chat-settings" className="space-y-2">
      {readOnly ? (
        <StatusSurface>
          Chat settings are managed by the host and cannot be changed from this
          view.
        </StatusSurface>
      ) : null}
      <div className="grid gap-2">
        <label className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
          <span>Recall style</span>
          <select
            data-ltm-control="select"
            className={inputClass}
            disabled={pending || readOnly}
            value={effectiveStyle}
            onChange={(event) =>
              update({ longTermMemoryRecallStyle: event.target.value })
            }
          >
            <option value="balanced">Balanced</option>
            <option value="exact">Exact</option>
            <option value="broad">Broad</option>
            <option value="story">Story</option>
          </select>
          {styleInherited && globalSettings.data ? (
            <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
              (default)
            </span>
          ) : null}
        </label>
        <div className="space-y-1">
          <NumberField
            label="Recall context budget"
            value={effectiveBudget}
            min={128}
            max={16384}
            step={128}
            disabled={pending || readOnly}
            onChange={(value) => update({ longTermMemoryBudgetTokens: value })}
          />
          {budgetInherited && globalSettings.data ? (
            <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
              (default)
            </span>
          ) : null}
        </div>
        <div className="space-y-1">
          <NumberField
            label="Maximum memories"
            value={effectiveMaxChunks}
            min={1}
            max={100}
            disabled={pending || readOnly}
            onChange={(value) => update({ longTermMemoryMaxChunks: value })}
          />
          {maxChunksInherited && globalSettings.data ? (
            <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
              (default)
            </span>
          ) : null}
        </div>
      </div>
      <StatusSurface
        compact
        tone={lastInjection.isError ? "danger" : "neutral"}
        busy={lastInjection.isLoading}
      >
        {lastInjection.data
          ? `${lastInjection.data.memoryCount} memories, ${lastInjection.data.tokenCount.toLocaleString()} tokens in the last recall.`
          : lastInjection.isError
            ? "The last recall could not load."
            : "No memories have been recalled for this chat yet."}
      </StatusSurface>
      {props.onOpenAgentSettings ? (
        <button
          type="button"
          onClick={props.onOpenAgentSettings}
          className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-[0.6875rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <Settings2 aria-hidden="true" size="0.75rem" />
          Open Long-Term Memory settings
        </button>
      ) : null}
      {message ? <StatusSurface tone="danger">{message}</StatusSurface> : null}
    </section>
  );
}
