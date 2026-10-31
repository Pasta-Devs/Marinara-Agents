import {
  LTM_CHAT_MEMORIES_MODES,
  type LtmChatMemoriesMode,
} from "../../../../shared/src/features/agents/long-term-memory/runtime-settings.js";
import { StatusSurface } from "./shared-controls";
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
const sampleKeys = {
  manual: "ui.longTermMemory.chatsettings.chatMemoriesSampleManual",
  review: "ui.longTermMemory.chatsettings.chatMemoriesSampleReview",
  save: "ui.longTermMemory.chatsettings.chatMemoriesSampleSave",
} as const;

export const chatMemoriesLabelKey = (mode: LtmChatMemoriesMode) => labelKeys[mode];
export const chatMemoriesDescriptionKey = (mode: LtmChatMemoriesMode) => descriptionKeys[mode];

/** The two stored extraction booleans a mode stands for. */
export const chatMemoriesFlags = (mode: LtmChatMemoriesMode) => ({
  autoImportChatSources: mode !== "manual",
  autoAcceptSafeChanges: mode === "save",
});

/** What the mode does after a reply, as an example line. */
export function ChatMemoriesSample({ mode, compact = false }: { mode: LtmChatMemoriesMode; compact?: boolean }) {
  const { t: localizeUi } = useLtmTranslation();
  return (
    <StatusSurface compact={compact} data-ltm-chat-memories-sample={mode}>
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{localizeUi("ui.longTermMemory.chatsettings.chatMemoriesAfterAReply")}</span>
        {" · "}
        {localizeUi(sampleKeys[mode])}
      </span>
    </StatusSurface>
  );
}
