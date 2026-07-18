import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  LtmGlobalSettings,
  LtmLastInjectionResponse,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { queryKeys, request } from "./api";
import {
  Button,
  NumberField,
  StatusSurface,
  inputClass,
} from "./shared-controls";
import type { CapabilityProps } from "./types";

export function ChatSettings({ props }: { props: CapabilityProps }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const globalSettings = useQuery({
    queryKey: queryKeys.chatDefaults,
    queryFn: () => request<LtmGlobalSettings>("/settings"),
  });
  const lastInjection = useQuery({
    enabled: Boolean(props.chatId && props.enabledForChat),
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
  const enabled = props.enabledForChat === true;
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
    <section
      data-ltm-surface="chat-settings"
      className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--background)]/45 p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold">Long-Term Memory</h3>
          <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
            Recall durable facts and events in this chat.
          </p>
        </div>
        <Button
          primary={enabled}
          disabled={pending || readOnly}
          onClick={() =>
            void runUpdate(() => props.onEnabledForChatChange?.(!enabled))
          }
        >
          {enabled ? "Enabled" : "Enable"}
        </Button>
      </div>
      {enabled ? (
        <>
          {readOnly ? (
            <StatusSurface>
              Chat settings are managed by the host and cannot be changed from
              this view.
            </StatusSurface>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
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
                onChange={(value) =>
                  update({ longTermMemoryBudgetTokens: value })
                }
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
            tone={lastInjection.isError ? "danger" : "neutral"}
            busy={lastInjection.isLoading}
          >
            {lastInjection.data
              ? `${lastInjection.data.memoryCount} memories, ${lastInjection.data.tokenCount.toLocaleString()} tokens in the last recall.`
              : lastInjection.isError
                ? "The last recall could not load."
                : "No memories have been recalled for this chat yet."}
          </StatusSurface>
        </>
      ) : null}
      {message ? <StatusSurface tone="danger">{message}</StatusSurface> : null}
    </section>
  );
}
