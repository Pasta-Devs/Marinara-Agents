import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DEFAULT_LTM_GLOBAL_SETTINGS,
  type LtmGlobalSettings,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  branchMemoriesPath,
  errorMessage,
  queryKeys,
  request,
  statusQueryOptions,
  type LtmBranchMemories,
} from "./api";
import { requestLtmOpen } from "./auto-import-status";
import {
  Button,
  Chip,
  DefaultChip,
  NumberField,
  StatusSurface,
  compactInputClass,
  compactInputStyle,
  lockedActionProps,
} from "./shared-controls";
import type { CapabilityProps } from "./types";
import { ActivityCardView, openChatPlaceInVault, useActivityCardState } from "./ActivityCard";
import { useBranchHiddenTail } from "./BranchHiddenTail";
import { readSetupProgress } from "./onboarding/progress";
import { selectLtmPluralForm, useLtmTranslation } from "./localization";
import { recallStyleDescriptionKey, recallStyleLabelKey, recallStyles } from "./recall-style";
import {
  ltmRecallBudgetMemories,
  ltmRecallBudgetWithLegacyCount,
  type LtmChatMemoriesMode,
} from "../../../../shared/src/features/agents/long-term-memory/runtime-settings.js";
import {
  ChatMemoriesStatusLine,
  chatMemoriesDescriptionKey,
  chatMemoriesLabelKey,
  chatMemoriesModes,
} from "./chat-memories";

// One compact look for every "Use the default" button here, so it sits level with the fields beside it.
const compactButtonProps = { className: "mari-editor-action--compact text-[0.625rem]", style: { minHeight: "2rem" } };

export function ChatSettings({ props }: { props: CapabilityProps }) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const recallStyleLabelId = useId();
  const recallStyleDescriptionId = useId();
  const chatMemoriesDescriptionId = useId();
  const chatMemoriesLabelId = useId();
  const [pending, setPending] = useState(false);
  // A pending save keeps its controls focusable (aria-disabled, not `disabled`), so this guard ignores input meanwhile.
  const pendingRef = useRef(false);
  // The recall field that just saved shows a muted "Saved" until the next edit or a few seconds pass.
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(savedTimer.current), []);
  const globalSettings = useQuery({
    queryKey: queryKeys.chatDefaults,
    queryFn: () => request<LtmGlobalSettings>("/settings"),
  });
  // The card's own reads; the status line below shares them.
  const card = useActivityCardState(props);
  const { chatMemories, extraction, effectiveChatMemories, chatMemoriesOverride, globalChatMemories } = card;
  const { autoImportOn, autoImportEvents, waitingDrafts } = card;
  // On a branch, the memories recall also uses from the conversation's other branches (the same set recall uses).
  const branchMemories = useQuery({
    enabled: Boolean(props.chatId),
    queryKey: queryKeys.branchMemories(props.chatId),
    queryFn: () => request<LtmBranchMemories>(branchMemoriesPath(props.chatId!)),
  });
  const handHidden = useBranchHiddenTail(props.chatId);
  const runUpdate = async (operation: () => void | Promise<void>) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await operation();
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.longTermMemory.longtermmemorydetail.couldNotUpdateThisChat")));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  const update = (patch: Record<string, unknown>) => {
    clearTimeout(savedTimer.current);
    setSavedKey(null);
    void runUpdate(async () => {
      await props.onChatSettingsChange?.(patch);
      setSavedKey(Object.keys(patch)[0] ?? null);
      savedTimer.current = setTimeout(() => setSavedKey(null), 4000);
    });
  };
  const savedLine = (key: string) => (
    // Always mounted so a screen reader announces the text when it appears; empty, it takes no room.
    <p
      role="status"
      data-ltm-chat-saved={key}
      className="text-[0.6875rem] font-normal leading-snug text-[var(--muted-foreground)]"
      style={savedKey === key ? undefined : { marginTop: 0 }}
    >
      {savedKey === key ? localizeUi("ui.longTermMemory.memorysettings.saveStateSaved") : null}
    </p>
  );
  const updateChatMemories = (mode: LtmChatMemoriesMode | null) =>
    void runUpdate(async () => {
      await props.onChatSettingsChange?.({ longTermMemoryChatMemories: mode });
      await chatMemories.refetch();
    });
  const settings = props.chatSettings ?? {};
  const readOnly = typeof props.onChatSettingsChange !== "function";
  // Until the global defaults arrive, an inherited value is unknown: show a neutral placeholder, not an invented number.
  const defaults = globalSettings.data;
  const effectiveStyle =
    settings.longTermMemoryRecallStyle ?? (defaults ? (defaults.longTermMemoryRecallStyle ?? "balanced") : null);
  const defaultBudget = defaults?.longTermMemoryBudgetTokens ?? DEFAULT_LTM_GLOBAL_SETTINGS.longTermMemoryBudgetTokens;
  // A memory count this chat saved before recall became budget-only still caps its budget, as recall applies it.
  const legacyCount = settings.longTermMemoryMaxChunks;
  const effectiveBudget =
    settings.longTermMemoryBudgetTokens == null && !defaults
      ? null
      : ltmRecallBudgetWithLegacyCount(settings.longTermMemoryBudgetTokens ?? defaultBudget, legacyCount);
  const status = useQuery(statusQueryOptions);
  const budgetFit =
    effectiveBudget === null
      ? null
      : ltmRecallBudgetMemories(effectiveBudget, status.data?.indexes.averageMemoryTokens);
  // Saving or resetting the budget ends that cap.
  const budgetPatch = (value: number | null) => ({
    longTermMemoryBudgetTokens: value,
    ...(legacyCount == null ? {} : { longTermMemoryMaxChunks: null }),
  });
  const unknownValueLabel = localizeUi(
    globalSettings.isError
      ? "ui.longTermMemory.chatsettings.defaultUnavailable"
      : "ui.longTermMemory.chatsettings.defaultLoading",
  );
  const openChatInVault = () => openChatPlaceInVault(props, localizeUi);
  // "Raise limit" on the card lands on the budget, the one limit a recall has.
  const budgetField = useRef<HTMLDivElement>(null);
  const raiseLimit = () => {
    const field = budgetField.current;
    field?.scrollIntoView?.({ block: "center" });
    field?.querySelector("input")?.focus();
  };
  const styleInherited = settings.longTermMemoryRecallStyle == null;
  const budgetInherited = settings.longTermMemoryBudgetTokens == null && legacyCount == null;
  // Each field says it follows the default for all chats (with its value), or offers one click back to it.
  const defaultControl = (inherited: boolean, value: string, resetKey: string) =>
    inherited && globalSettings.data ? (
      <DefaultChip value={value} />
    ) : !inherited && !readOnly && globalSettings.data ? (
      <Button
        {...compactButtonProps}
        data-ltm-default-reset={resetKey}
        onClick={() => update(resetKey === "longTermMemoryBudgetTokens" ? budgetPatch(null) : { [resetKey]: null })}
        {...lockedActionProps(pending)}
      >
        {localizeUi("ui.longTermMemory.chatsettings.useGlobalDefaultValue", { value })}
      </Button>
    ) : null;
  const globalStyle = defaults?.longTermMemoryRecallStyle ?? "balanced";
  const statusQueries = [chatMemories, extraction, ...(autoImportOn ? [autoImportEvents, waitingDrafts] : [])];
  const statusError = statusQueries.some((query) => query.isError);
  const statusLoading = statusQueries.some((query) => query.isFetching && query.data === undefined);
  // A failed read stays an error while its retry runs, so the Retry locks until that refetch settles.
  const statusRetrying = statusQueries.some((query) => query.isError && query.isFetching);

  return (
    <section data-ltm-surface="chat-settings" data-ltm-density="compact" className="space-y-1.5">
      {/* D27 (initial load only, so a background refetch keeps the card; error/Retry unchanged) and the
          memory-on gate live in ActivityCardView, shared with the Agent activity panel. */}
      <ActivityCardView props={props} card={card} onRaiseLimit={readOnly ? undefined : raiseLimit} />
      {/* Until setup is done, a chat with memory off offers it here; setup opens in the agent's page. */}
      {props.chatId && !props.enabledForChat && props.onOpenAgentSettings && readSetupProgress() !== "done" ? (
        <div data-ltm-chat-setup className="space-y-1 text-[0.625rem]">
          <div className="flex items-center gap-1.5">
            <Chip className="inline-flex">{localizeUi("ui.longTermMemory.chatsettings.setupOff")}</Chip>
            <Button
              {...compactButtonProps}
              primary
              data-ltm-chat-setup-open
              onClick={() => {
                requestLtmOpen("setup");
                props.onOpenAgentSettings?.();
              }}
            >
              {localizeUi("ui.longTermMemory.chatsettings.setUp")}
            </Button>
          </div>
          <p className="text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
            {localizeUi("ui.longTermMemory.chatsettings.setupHint")}
          </p>
        </div>
      ) : null}
      {readOnly ? (
        <StatusSurface compact>
          {localizeUi("ui.longTermMemory.chatsettings.chatSettingsAreManagedByTheHostAndCannot")}
        </StatusSurface>
      ) : null}
      {props.chatId ? (
        <div data-ltm-chat-memories-field className="space-y-1 text-[0.625rem] font-medium">
          <span id={chatMemoriesLabelId} className="flex items-center gap-1 text-[var(--foreground)]">
            {localizeUi("ui.longTermMemory.chatsettings.memoriesFromThisChat")}
          </span>
          <select
            aria-labelledby={chatMemoriesLabelId}
            aria-describedby={effectiveChatMemories ? chatMemoriesDescriptionId : undefined}
            data-ltm-control="select"
            data-ltm-chat-memories="chat"
            className={`${compactInputClass}${pending ? " opacity-50" : ""}`}
            style={compactInputStyle}
            disabled={readOnly || !chatMemories.data}
            aria-disabled={pending || undefined}
            value={effectiveChatMemories ?? ""}
            onChange={(event) => updateChatMemories(event.target.value as LtmChatMemoriesMode)}
          >
            {effectiveChatMemories === null ? (
              <option value="" disabled hidden>
                {localizeUi(
                  chatMemories.isError || extraction.isError
                    ? "ui.longTermMemory.chatsettings.defaultUnavailable"
                    : "ui.longTermMemory.chatsettings.defaultLoading",
                )}
              </option>
            ) : null}
            {chatMemoriesModes.map((mode) => (
              <option key={mode} value={mode}>
                {localizeUi(chatMemoriesLabelKey(mode))}
              </option>
            ))}
          </select>
          {effectiveChatMemories ? (
            <p
              id={chatMemoriesDescriptionId}
              data-ltm-chat-memories-description
              className="text-[0.6875rem] font-normal leading-snug text-[var(--muted-foreground)]"
            >
              {localizeUi(chatMemoriesDescriptionKey(effectiveChatMemories))}
            </p>
          ) : null}
          {chatMemories.data && !chatMemoriesOverride && globalChatMemories ? (
            <DefaultChip />
          ) : chatMemoriesOverride && !readOnly ? (
            <Button
              {...compactButtonProps}
              data-ltm-chat-memories-reset
              onClick={() => updateChatMemories(null)}
              aria-disabled={pending || undefined}
            >
              {localizeUi("ui.longTermMemory.chatsettings.useGlobalDefault")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {props.chatId && effectiveChatMemories === "manual" ? (
        <ChatMemoriesStatusLine
          mode="manual"
          compact
          data-ltm-auto-import-status
          onImport={
            props.onOpenAgentSettings
              ? () => {
                  requestLtmOpen("sources");
                  props.onOpenAgentSettings?.();
                }
              : undefined
          }
        />
      ) : props.chatId && statusError ? (
        <StatusSurface tone="danger" compact data-ltm-auto-import-status-error>
          <span className="min-w-0 flex-1">{localizeUi("ui.longTermMemory.chatsettings.statusUnavailable")}</span>
          <Button
            {...compactButtonProps}
            onClick={() => {
              if (statusRetrying) return;
              for (const query of statusQueries) if (query.isError) void query.refetch();
            }}
            {...lockedActionProps(statusRetrying)}
          >
            {localizeUi("ui.longTermMemory.activityview.retry")}
          </Button>
        </StatusSurface>
      ) : props.chatId && statusLoading ? (
        <StatusSurface busy compact data-ltm-auto-import-status-loading>
          {localizeUi("ui.longTermMemory.chatsettings.statusLoading")}
        </StatusSurface>
      ) : null}
      {handHidden.ids.length ? (
        <StatusSurface compact data-ltm-branch-hidden-tail>
          <span className="min-w-0 flex-1">{handHidden.line}</span>
          <Button
            {...compactButtonProps}
            onClick={() => void handHidden.show()}
            {...lockedActionProps(handHidden.showing)}
          >
            {localizeUi("ui.longTermMemory.chatsettings.branchHiddenTailShow")}
          </Button>
        </StatusSurface>
      ) : null}
      {props.chatId
        ? branchMemories.data?.branches.map((branch) => (
            <StatusSurface key={branch.chatId} compact data-ltm-branch-memories={branch.chatId}>
              <span className="min-w-0 flex-1">
                {localizeUi(
                  selectLtmPluralForm(locale, branch.noteIds.length) === "one"
                    ? "ui.longTermMemory.chatsettings.branchMemoriesOne"
                    : "ui.longTermMemory.chatsettings.branchMemoriesOther",
                  { count: branch.noteIds.length, value1: branch.name },
                )}
              </span>
              <Button {...compactButtonProps} onClick={openChatInVault} disabled={!props.onOpenAgentSettings}>
                {localizeUi("ui.longTermMemory.chatsettings.branchMemoriesShow")}
              </Button>
            </StatusSurface>
          ))
        : null}
      <div className="grid gap-2">
        <p className="px-0.5 text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
          {localizeUi("ui.longTermMemory.chatsettings.recallExplanation")}
        </p>
        <div className="space-y-1 text-[0.625rem] font-medium">
          <span id={recallStyleLabelId} className="flex items-center gap-1 text-[var(--foreground)]">
            {localizeUi("ui.longTermMemory.chatsettings.recallStyle")}
          </span>
          <select
            aria-labelledby={recallStyleLabelId}
            aria-describedby={effectiveStyle ? recallStyleDescriptionId : undefined}
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
            {recallStyles.map((style) => (
              <option key={style} value={style}>
                {localizeUi(recallStyleLabelKey(style))}
              </option>
            ))}
          </select>
          {effectiveStyle ? (
            <p
              id={recallStyleDescriptionId}
              data-ltm-recall-style-description
              className="text-[0.6875rem] font-normal leading-snug text-[var(--muted-foreground)]"
            >
              {localizeUi(recallStyleDescriptionKey(effectiveStyle))}
            </p>
          ) : null}
          {savedLine("longTermMemoryRecallStyle")}
          {defaultControl(styleInherited, localizeUi(recallStyleLabelKey(globalStyle)), "longTermMemoryRecallStyle")}
        </div>
        <div ref={budgetField} className="space-y-1" onInput={() => setSavedKey(null)}>
          <NumberField
            label={localizeUi("ui.longTermMemory.memorysettings.recallBudgetTokens")}
            hint={
              <>
                {budgetFit === null ? null : (
                  <p aria-live="polite" data-ltm-recall-budget-hint>
                    {budgetFit === 1
                      ? localizeUi("ui.longTermMemory.memorysettings.recallBudgetFitOne")
                      : localizeUi("ui.longTermMemory.memorysettings.recallBudgetFit", { count: budgetFit })}
                  </p>
                )}
                <p>{localizeUi("ui.longTermMemory.chatsettings.maximumNumberOfTokensThatRecalledMemoriesMayAdd")}</p>
              </>
            }
            value={effectiveBudget}
            integer
            min={128}
            max={16384}
            step={128}
            placeholder={effectiveBudget === null ? unknownValueLabel : undefined}
            disabled={readOnly}
            busy={pending}
            onChange={(value) => update(budgetPatch(value))}
            compact
          />
          {savedLine("longTermMemoryBudgetTokens")}
          {defaultControl(budgetInherited, defaultBudget.toLocaleString(locale), "longTermMemoryBudgetTokens")}
        </div>
      </div>
    </section>
  );
}
