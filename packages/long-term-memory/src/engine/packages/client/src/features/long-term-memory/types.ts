import type { Root } from "react-dom/client";
import type {
  LtmExtractionDroppedCandidate,
  LtmMode,
  LtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import type { LtmLocalizationContext } from "./localization";
export type { ScopeTargets } from "./scope-targets";

export type CapabilityProps = {
  package?: {
    name?: string;
    version?: string;
    readiness?: string;
    status?: string;
  };
  agent?: {
    id?: string;
    name?: string;
    description?: string;
    author?: string | null;
  };
  localization?: LtmLocalizationContext;
  chatId?: string | null;
  chatName?: string | null;
  chatMode?: "conversation" | "roleplay" | "game" | null;
  enabledForChat?: boolean;
  chatSettings?: {
    longTermMemoryRecallStyle?: string;
    longTermMemoryBudgetTokens?: number;
    longTermMemoryMaxChunks?: number;
  };
  onEnabledForChatChange?: (enabled: boolean) => void | Promise<void>;
  onChatSettingsChange?: (
    patch: Record<string, unknown>,
  ) => void | Promise<void>;
  onOpenAgentSettings?: () => void;
  onOpenChatSummarySettings?: () => void;
  onOpenActivePromptPresetEditor?: () => void;
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

export type CapabilityElement = HTMLElement & {
  capabilityProps?: CapabilityProps;
  capabilityRuntimeError?: string | null;
  __root?: Root | null;
};

export type LongTermMemoryDestination =
  "vault" | "review" | "sources" | "settings";

export type SourceTab = "characters" | "lorebooks" | "chats";

export type LtmRecoveryHandoff = {
  key: number;
  candidate: LtmExtractionDroppedCandidate;
  rejectedSuggestionId?: string;
  scope: LtmScope;
  modes: LtmMode[];
};

export type LongTermMemoryDestinationProps = {
  props: CapabilityProps;
  requestedSource?: { key: number; source: SourceTab } | null;
  onRequestedSourceHandled?: () => void;
  selectedSource?: SourceTab;
  onSourceChange?: (source: SourceTab) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onOpenMemory?: (noteId: string) => void;
  onOpenVault?: () => void;
  onOpenReview?: (sourceNoteId?: string) => void;
  onRecoverCandidate?: (
    candidate: LtmExtractionDroppedCandidate,
    scope: LtmScope,
    modes: LtmMode[],
    rejectedSuggestionId?: string,
  ) => void;
  openedNoteId?: string | null;
  createMemoryRequest?: number | null;
  onCreateMemoryRequestHandled?: () => void;
  reviewSourceNoteId?: string | null;
  recoveryHandoff?: LtmRecoveryHandoff | null;
};
