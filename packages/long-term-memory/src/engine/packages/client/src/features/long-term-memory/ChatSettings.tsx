import { Settings2 } from "lucide-react";
import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  LtmGlobalSettings,
  LtmLastInjectionResponse,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { queryKeys, request } from "./api";
import {
  InfoPopover,
  NumberField,
  StatusSurface,
  inputClass,
} from "./shared-controls";
import type { CapabilityProps } from "./types";
import { LastInjectionSummary } from "./LastInjectionSummary";
import { useLtmTranslation } from "./localization";

export function ChatSettings({ props }: { props: CapabilityProps }) {
  const { t: localizeUi } = useLtmTranslation();
  const recallStyleLabelId = useId();
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
        error instanceof Error
          ? error.message
          : localizeUi(
              "ui.longTermMemory.longtermmemorydetail.couldNotUpdateThisChat",
            ),
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
    <section data-ltm-surface="chat-settings" className="space-y-2 px-2">
      {readOnly ? (
        <StatusSurface>
          {localizeUi(
            "ui.longTermMemory.chatsettings.chatSettingsAreManagedByTheHostAndCannot",
          )}
        </StatusSurface>
      ) : null}
      <div className="grid gap-2">
        <div className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
          <span id={recallStyleLabelId} className="flex items-center gap-1">
            {localizeUi("ui.longTermMemory.chatsettings.recallStyle")}
            <InfoPopover
              label={localizeUi("ui.longTermMemory.chatsettings.recallStyle")}
              content={localizeUi(
                "ui.longTermMemory.chatsettings.controlsHowBroadlyThisChatMatchesSavedMemoriesThis",
              )}
            />
          </span>
          <select
            aria-labelledby={recallStyleLabelId}
            data-ltm-control="select"
            className={inputClass}
            disabled={pending || readOnly}
            value={effectiveStyle}
            onChange={(event) =>
              update({ longTermMemoryRecallStyle: event.target.value })
            }
          >
            <option value="balanced">
              {localizeUi("ui.longTermMemory.chatsettings.balanced")}
            </option>
            <option value="exact">
              {localizeUi("ui.longTermMemory.chatsettings.exact")}
            </option>
            <option value="broad">
              {localizeUi("ui.longTermMemory.chatsettings.broad")}
            </option>
            <option value="story">
              {localizeUi("ui.longTermMemory.chatsettings.story")}
            </option>
            <option value="custom">
              {localizeUi("ui.longTermMemory.chatsettings.custom")}
            </option>
          </select>
          {styleInherited && globalSettings.data ? (
            <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
              <span className="inline-flex rounded bg-[var(--secondary)] px-1.5 py-0.5">
                {localizeUi("ui.longTermMemory.chatsettings.globalDefault")}
              </span>
            </span>
          ) : null}
        </div>
        <div className="space-y-1">
          <NumberField
            label={localizeUi(
              "ui.longTermMemory.chatsettings.recallContextBudget",
            )}
            help={localizeUi(
              "ui.longTermMemory.chatsettings.maximumNumberOfTokensThatRecalledMemoriesMayAdd",
            )}
            value={effectiveBudget}
            min={128}
            max={16384}
            step={128}
            disabled={pending || readOnly}
            onChange={(value) => update({ longTermMemoryBudgetTokens: value })}
          />
          {budgetInherited && globalSettings.data ? (
            <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
              <span className="inline-flex rounded bg-[var(--secondary)] px-1.5 py-0.5">
                {localizeUi("ui.longTermMemory.chatsettings.globalDefault")}
              </span>
            </span>
          ) : null}
        </div>
        <div className="space-y-1">
          <NumberField
            label={localizeUi("ui.longTermMemory.chatsettings.maximumMemories")}
            help={localizeUi(
              "ui.longTermMemory.chatsettings.maximumNumberOfSavedMemoriesThatOneRecallMay",
            )}
            value={effectiveMaxChunks}
            min={1}
            max={100}
            disabled={pending || readOnly}
            onChange={(value) => update({ longTermMemoryMaxChunks: value })}
          />
          {maxChunksInherited && globalSettings.data ? (
            <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
              <span className="inline-flex rounded bg-[var(--secondary)] px-1.5 py-0.5">
                {localizeUi("ui.longTermMemory.chatsettings.globalDefault")}
              </span>
            </span>
          ) : null}
        </div>
      </div>
      <LastInjectionSummary
        data={lastInjection.data}
        loading={lastInjection.isFetching}
        error={lastInjection.isError}
      />
      {props.onOpenAgentSettings ? (
        <button
          type="button"
          onClick={props.onOpenAgentSettings}
          className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-[0.6875rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <Settings2 aria-hidden="true" size="0.75rem" />
          {localizeUi(
            "ui.longTermMemory.chatsettings.openLongTermMemorySettings",
          )}
        </button>
      ) : null}
      {message ? <StatusSurface tone="danger">{message}</StatusSurface> : null}
    </section>
  );
}
