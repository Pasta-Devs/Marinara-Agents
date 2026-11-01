import {
  LTM_CHAT_MEMORIES_MODES,
  type LtmChatMemoriesMode,
} from "../../../../shared/src/features/agents/long-term-memory/runtime-settings.js";
import { Check, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { Button, StatusSurface } from "./shared-controls";
import { selectLtmPluralForm, useLtmTranslation } from "./localization";

export const chatMemoriesModes = LTM_CHAT_MEMORIES_MODES;

const labelKeys = {
  manual: "ui.longTermMemory.chatsettings.chatMemoriesManual",
  review: "ui.longTermMemory.chatsettings.chatMemoriesReview",
  save: "ui.longTermMemory.chatsettings.chatMemoriesSave",
} as const;
const descriptionKeys = {
  manual: "ui.longTermMemory.chatsettings.chatMemoriesManualDescription",
  review: "ui.longTermMemory.chatsettings.chatMemoriesReviewDescription",
  save: "ui.longTermMemory.chatsettings.chatMemoriesSaveDescription",
} as const;

export const chatMemoriesLabelKey = (mode: LtmChatMemoriesMode) => labelKeys[mode];
export const chatMemoriesDescriptionKey = (mode: LtmChatMemoriesMode) => descriptionKeys[mode];

/** The two stored extraction booleans a mode stands for. */
export const chatMemoriesFlags = (mode: LtmChatMemoriesMode) => ({
  autoImportChatSources: mode !== "manual",
  autoAcceptSafeChanges: mode === "save",
});

const partClass = "inline-flex items-center gap-1";

/**
 * One status line for "what happened to this chat's memories", used live in Chat Settings and as the "After a
 * reply" sample. Saved counts show only in Save them for me (nothing saves on its own in review mode), waiting
 * counts only when something waits, and manual mode says nothing is added on its own.
 */
export function ChatMemoriesStatusLine({
  mode,
  saved,
  waiting,
  sample = false,
  compact = false,
  onReview,
  onImport,
  ...props
}: {
  mode: LtmChatMemoriesMode;
  saved: number;
  waiting: number;
  /** Fixed example numbers ("2 saved") instead of today's live counts. */
  sample?: boolean;
  compact?: boolean;
  onReview?: () => void;
  onImport?: () => void;
  "data-ltm-auto-import-status"?: boolean;
  "data-ltm-chat-memories-sample"?: LtmChatMemoriesMode;
}) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const iconSize = compact ? "0.75rem" : "0.875rem";
  const count = (n: number, one: string, other: string) =>
    localizeUi(selectLtmPluralForm(locale, n) === "one" ? one : other, { count: n });
  const parts: ReactNode[] = [];
  let action: ReactNode = null;
  if (mode === "manual") {
    parts.push(<span key="manual">{localizeUi("ui.longTermMemory.chatsettings.chatMemoriesSampleManual")}</span>);
    if (onImport)
      action = <Button onClick={onImport}>{localizeUi("ui.longTermMemory.chatsettings.autoImportImport")}</Button>;
  } else {
    const showSaved = mode === "save";
    if (showSaved)
      parts.push(
        <span key="saved" className={partClass} style={{ color: "var(--ltm-success, var(--marinara-editor-text))" }}>
          <Check aria-hidden="true" size={iconSize} className="shrink-0" />
          {sample
            ? localizeUi("ui.longTermMemory.chatsettings.chatMemoriesSampleSaved")
            : count(
                saved,
                "ui.longTermMemory.chatsettings.autoImportSavedTodayOne",
                "ui.longTermMemory.chatsettings.autoImportSavedTodayOther",
              )}
        </span>,
      );
    if (sample || waiting > 0) {
      if (parts.length > 0)
        parts.push(
          <span key="dot" aria-hidden="true">
            ·
          </span>,
        );
      parts.push(
        <span key="waiting" className={partClass}>
          <Clock aria-hidden="true" size={iconSize} className="shrink-0" />
          {sample
            ? localizeUi(
                mode === "save"
                  ? "ui.longTermMemory.chatsettings.chatMemoriesSampleSaveWaiting"
                  : "ui.longTermMemory.chatsettings.chatMemoriesSampleReview",
              )
            : count(
                waiting,
                "ui.longTermMemory.chatsettings.autoImportWaitingOne",
                "ui.longTermMemory.chatsettings.autoImportWaitingOther",
              )}
        </span>,
      );
    }
    if (parts.length === 0)
      parts.push(<span key="empty">{localizeUi("ui.longTermMemory.chatsettings.autoImportEmpty")}</span>);
    if (!sample && waiting > 0 && onReview)
      action = <Button onClick={onReview}>{localizeUi("ui.longTermMemory.chatsettings.autoImportReview")}</Button>;
  }
  return (
    <StatusSurface compact={compact} {...props}>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">{parts}</span>
      {action}
    </StatusSurface>
  );
}

/** What the mode does after a reply, as the same status line with example numbers under a small label. */
export function ChatMemoriesSample({ mode, compact = false }: { mode: LtmChatMemoriesMode; compact?: boolean }) {
  const { t: localizeUi } = useLtmTranslation();
  return (
    <div className="grid gap-1" data-ltm-chat-memories-sample={mode}>
      <span className="text-[0.5625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {localizeUi("ui.longTermMemory.chatsettings.chatMemoriesAfterAReply")}
      </span>
      <ChatMemoriesStatusLine mode={mode} saved={0} waiting={0} sample compact={compact} />
    </div>
  );
}
