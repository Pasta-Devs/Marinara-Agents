import { useState } from "react";
import type { SlurpSettings } from "../settings/slp-settings-contract";
import { useSetSlurpCreatorMessaging } from "./slp-messages-hooks";

/** Per-creator messaging policy and the messaging wizard draft Backstage drives. */
export function useSlpMessagesBackstageState() {
  const setCreatorMessaging = useSetSlurpCreatorMessaging();
  const [messagingWizardOpen, setMessagingWizardOpen] = useState(false);
  const [messagingDraft, setMessagingDraft] = useState<Pick<
    SlurpSettings,
    | "messagesAwayRepliesEnabled"
    | "messagesDefaultDmPolicy"
    | "messagesReplyBubbleLimit"
    | "messagesMaxReplyDelayMinutes"
  > | null>(null);
  return {
    setCreatorMessaging,
    messagingWizardOpen,
    setMessagingWizardOpen,
    messagingDraft,
    setMessagingDraft,
  };
}

export type SlpMessagesBackstageState = ReturnType<typeof useSlpMessagesBackstageState>;
