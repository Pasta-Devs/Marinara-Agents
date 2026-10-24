import { Settings2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  LtmGlobalSettings,
  LtmLastInjectionResponse,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { errorMessage, queryKeys, request } from "./api";
import { InfoPopover, NumberField, StatusSurface, compactInputClass, compactInputStyle } from "./shared-controls";
import type { CapabilityProps } from "./types";
import { LastInjectionSummary } from "./LastInjectionSummary";
import { useLtmTranslation } from "./localization";
import { recallStyleDescriptionKey, recallStyles } from "./recall-style";

export function ChatSettings({ props }: { props: CapabilityProps }) {
  const { t: localizeUi } = useLtmTranslation();
  const recallStyleLabelId = useId();
  const [pending, setPending] = useState(false);
  // A pending save keeps its controls focusable (aria-disabled, not `disabled`), so this guard ignores input meanwhile.
  const pendingRef = useRef(false);
  const [message, setMessage] = useState("");
  const globalSettings = useQuery({
    queryKey: queryKeys.chatDefaults,
    queryFn: () => request<LtmGlobalSettings>("/settings"),
  });
  const lastInjection = useQuery({
    enabled: Boolean(props.chatId),
    queryKey: queryKeys.lastInjection(props.chatId),
    queryFn: () => request<LtmLastInjectionResponse>(`/last-injection/${encodeURIComponent(props.chatId!)}`),
  });
  const runUpdate = async (operation: () => void | Promise<void>) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setMessage("");
    try {
      await operation();
    } catch (error) {
      setMessage(errorMessage(error, localizeUi("ui.longTermMemory.longtermmemorydetail.couldNotUpdateThisChat")));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  const update = (patch: Record<string, unknown>) => void runUpdate(() => props.onChatSettingsChange?.(patch));
  const settings = props.chatSettings ?? {};
  const readOnly = typeof props.onChatSettingsChange !== "function";
  // Until the global defaults arrive, an inherited value is unknown: show a neutral placeholder, not an invented number.
  const defaults = globalSettings.data;
  const effectiveStyle =
    settings.longTermMemoryRecallStyle ?? (defaults ? (defaults.longTermMemoryRecallStyle ?? "balanced") : null);
  const effectiveBudget =
    settings.longTermMemoryBudgetTokens ?? (defaults ? (defaults.longTermMemoryBudgetTokens ?? 4096) : null);
  const effectiveMaxChunks =
    settings.longTermMemoryMaxChunks ?? (defaults ? (defaults.longTermMemoryMaxChunks ?? 20) : null);
  const unknownValueLabel = localizeUi(
    globalSettings.isError
      ? "ui.longTermMemory.chatsettings.defaultUnavailable"
      : "ui.longTermMemory.chatsettings.defaultLoading",
  );
  const styleInherited = settings.longTermMemoryRecallStyle == null;
  const budgetInherited = settings.longTermMemoryBudgetTokens == null;
  const maxChunksInherited = settings.longTermMemoryMaxChunks == null;

  return (
    <section data-ltm-surface="chat-settings" data-ltm-density="compact" className="space-y-1.5">
      {readOnly ? (
        <StatusSurface compact>
          {localizeUi("ui.longTermMemory.chatsettings.chatSettingsAreManagedByTheHostAndCannot")}
        </StatusSurface>
      ) : null}
      <div className="grid gap-1.5">
        <p className="px-0.5 text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">
          {localizeUi("ui.longTermMemory.chatsettings.recallExplanation")}
        </p>
        <div className="space-y-1 text-[0.625rem] font-medium">
          <span id={recallStyleLabelId} className="flex items-center gap-1 text-[var(--foreground)]">
            {localizeUi("ui.longTermMemory.chatsettings.recallStyle")}
            <InfoPopover
              label={localizeUi("ui.longTermMemory.chatsettings.recallStyle")}
              content={
                <ul className="space-y-1.5">
                  {recallStyles.map((style) => (
                    <li key={style} data-ltm-recall-style-option={style}>
                      {style === effectiveStyle ? (
                        <span className="mr-1 inline-flex rounded border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5 text-[0.5625rem] font-semibold">
                          {localizeUi("ui.longTermMemory.chatsettings.currentRecallStyle")}
                        </span>
                      ) : null}
                      {localizeUi(recallStyleDescriptionKey(style))}
                    </li>
                  ))}
                </ul>
              }
              compact
            />
          </span>
          <select
            aria-labelledby={recallStyleLabelId}
            data-ltm-control="select"
            className={`${compactInputClass}${pending ? " opacity-50" : ""}`}
            style={compactInputStyle}
            disabled={readOnly}
            aria-disabled={pending || undefined}
            value={effectiveStyle ?? ""}
            onChange={(event) => update({ longTermMemoryRecallStyle: event.target.value })}
          >
            {effectiveStyle === null ? (
              <option value="" disabled hidden>
                {unknownValueLabel}
              </option>
            ) : null}
            <option value="balanced">{localizeUi("ui.longTermMemory.chatsettings.balanced")}</option>
            <option value="exact">{localizeUi("ui.longTermMemory.chatsettings.exact")}</option>
            <option value="broad">{localizeUi("ui.longTermMemory.chatsettings.broad")}</option>
            <option value="story">{localizeUi("ui.longTermMemory.chatsettings.story")}</option>
            <option value="custom">{localizeUi("ui.longTermMemory.chatsettings.custom")}</option>
          </select>
          {styleInherited && globalSettings.data ? (
            <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
              <span className="inline-flex rounded border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5">
                {localizeUi("ui.longTermMemory.chatsettings.globalDefault")}
              </span>
            </span>
          ) : null}
        </div>
        <div className="space-y-1">
          <NumberField
            label={localizeUi("ui.longTermMemory.chatsettings.recallContextBudget")}
            help={localizeUi("ui.longTermMemory.chatsettings.maximumNumberOfTokensThatRecalledMemoriesMayAdd")}
            value={effectiveBudget}
            min={128}
            max={16384}
            step={128}
            placeholder={effectiveBudget === null ? unknownValueLabel : undefined}
            disabled={readOnly}
            busy={pending}
            onChange={(value) => update({ longTermMemoryBudgetTokens: value })}
            compact
          />
          {budgetInherited && globalSettings.data ? (
            <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
              <span className="inline-flex rounded border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5">
                {localizeUi("ui.longTermMemory.chatsettings.globalDefault")}
              </span>
            </span>
          ) : null}
        </div>
        <div className="space-y-1">
          <NumberField
            label={localizeUi("ui.longTermMemory.chatsettings.maximumMemories")}
            help={localizeUi("ui.longTermMemory.chatsettings.maximumNumberOfSavedMemoriesThatOneRecallMay")}
            value={effectiveMaxChunks}
            min={1}
            max={100}
            placeholder={effectiveMaxChunks === null ? unknownValueLabel : undefined}
            disabled={readOnly}
            busy={pending}
            onChange={(value) => update({ longTermMemoryMaxChunks: value })}
            compact
          />
          {maxChunksInherited && globalSettings.data ? (
            <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
              <span className="inline-flex rounded border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5">
                {localizeUi("ui.longTermMemory.chatsettings.globalDefault")}
              </span>
            </span>
          ) : null}
        </div>
      </div>
      {/* D27: initial load only, so a background refetch keeps the existing data and
          title instead of flashing the loading title; error/Retry behavior is unchanged. */}
      <LastInjectionSummary
        data={lastInjection.data}
        loading={lastInjection.isLoading}
        retryPending={lastInjection.isFetching}
        error={lastInjection.isError}
        onRetry={() => void lastInjection.refetch()}
        compact
      />
      {props.onOpenAgentSettings ? (
        <button
          type="button"
          onClick={props.onOpenAgentSettings}
          className="mari-agent-settings-action inline-flex min-h-8 w-full items-center justify-center gap-1.5 px-2.5 text-[0.625rem]"
        >
          <Settings2 aria-hidden="true" size="0.75rem" />
          {localizeUi("ui.longTermMemory.chatsettings.openLongTermMemory")}
        </button>
      ) : null}
      {message ? (
        <StatusSurface tone="danger" compact>
          {message}
        </StatusSurface>
      ) : null}
    </section>
  );
}
