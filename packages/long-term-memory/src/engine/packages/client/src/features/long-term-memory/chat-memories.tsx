import {
  LTM_CHAT_MEMORIES_MODES,
  type LtmChatMemoriesMode,
} from "../../../../shared/src/features/agents/long-term-memory/runtime-settings.js";
import { Check, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { Button, StatusSurface } from "./shared-controls";
import { useLtmTranslation } from "./localization";

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
 * One line for what a mode does: live in the chat drawer only for Add them myself (with an Import button), and as the
 * "After a reply" sample's example for every mode. The other modes' live counts are on the activity card.
 */
export function ChatMemoriesStatusLine({
  mode,
  compact = false,
  onImport,
  ...props
}: {
  mode: LtmChatMemoriesMode;
  compact?: boolean;
  onImport?: () => void;
  "data-ltm-auto-import-status"?: boolean;
  "data-ltm-chat-memories-sample"?: LtmChatMemoriesMode;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const iconSize = compact ? "0.75rem" : "0.875rem";
  const parts: ReactNode[] = [];
  let action: ReactNode = null;
  if (mode === "manual") {
    parts.push(<span key="manual">{localizeUi("ui.longTermMemory.chatsettings.chatMemoriesSampleManual")}</span>);
    if (onImport)
      action = <Button onClick={onImport}>{localizeUi("ui.longTermMemory.chatsettings.autoImportImport")}</Button>;
  } else {
    if (mode === "save")
      parts.push(
        <span key="saved" className={partClass} style={{ color: "var(--ltm-success, var(--marinara-editor-text))" }}>
          <Check aria-hidden="true" size={iconSize} className="shrink-0" />
          {localizeUi("ui.longTermMemory.chatsettings.chatMemoriesSampleSaved")}
        </span>,
        <span key="dot" aria-hidden="true">
          ·
        </span>,
      );
    parts.push(
      <span key="waiting" className={partClass}>
        <Clock aria-hidden="true" size={iconSize} className="shrink-0" />
        {localizeUi(
          mode === "save"
            ? "ui.longTermMemory.chatsettings.chatMemoriesSampleSaveWaiting"
            : "ui.longTermMemory.chatsettings.chatMemoriesSampleReview",
        )}
      </span>,
    );
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
      <ChatMemoriesStatusLine mode={mode} compact={compact} />
    </div>
  );
}
