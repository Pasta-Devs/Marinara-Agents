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
    // Not passed by the Engine today; ChatSettings reads it from GET /chat-memories/:chatId.
    longTermMemoryChatMemories?: string | null;
  };
  onEnabledForChatChange?: (enabled: boolean) => void | Promise<void>;
  onChatSettingsChange?: (patch: Record<string, unknown>) => void | Promise<void>;
  onOpenAgentSettings?: () => void;
  onOpenChatSummarySettings?: () => void;
  onOpenActivePromptPresetEditor?: () => void;
  onClose?: () => void;
  onManagePackage?: () => void;
  /** The installed version, which busts the browser cache of the package's pictures after an update. */
  packageVersion?: string | null;
  /** Capability API 1.390: the Engine draws the header and gives a slot for header buttons. */
  engineHeader?: boolean;
  headerSlot?: HTMLElement | null;
  onDirtyChange?: (dirty: boolean) => void;
  confirmAction?: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: "destructive" | "default";
  }) => boolean | Promise<boolean>;
};

export type CapabilityElement = HTMLElement & {
  capabilityProps?: CapabilityProps;
  capabilityRuntimeError?: string | null;
  __root?: Root | null;
};

export type LongTermMemoryDestination = "vault" | "review" | "sources" | "activity" | "settings";

export type SourceTab = "characters" | "lorebooks" | "chats" | "messages";

export type LtmRecoveryHandoff = {
  key: number;
  candidate: LtmExtractionDroppedCandidate;
  rejectedSuggestionId?: string;
  scope: LtmScope;
  modes: LtmMode[];
};

export type LongTermMemoryDestinationProps = {
  props: CapabilityProps;
  requestedSource?: { key: number; source: SourceTab; sourceNoteId?: string } | null;
  onRequestedSourceHandled?: () => void;
  selectedSource?: SourceTab;
  onSourceChange?: (source: SourceTab) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveRequest?: (save: (() => Promise<boolean>) | null) => void;
  onOpenMemory?: (noteId: string) => void;
  onOpenVault?: () => void;
  onOpenSources?: (source?: SourceTab, sourceNoteId?: string) => boolean | Promise<boolean>;
  onOpenReview?: (sourceNoteId?: string) => void;
  /** Opens Professor Mari's setup; passed only until setup is done, so the empty Vault offers it. */
  onOpenSetup?: () => void;
  /** Reopens Mari's setup from Troubleshooting. */
  onRunSetup?: () => void;
  /** Replays Mari's tour from Troubleshooting. */
  onStartTour?: () => void;
  onOpenActivity?: (memoryId: string) => void;
  /** Mari's tour is on its Graph stop: a Vault with nothing to draw shows a made-up example graph. */
  exampleGraph?: boolean;
  /** Opens Activity filtered to one memory. */
  openActivityMemoryId?: string | null;
  /** Opens Activity with this recall operation selected (the chat drawer's "Open in Activity"). */
  openActivityOperationId?: string | null;
  /** Chat Settings asked to choose the extraction connection: open Extraction with that field focused. */
  openForConnection?: boolean;
  onOpenForConnectionHandled?: () => void;
  /** Activity asks for Memory Settings on its Recall tab. */
  onOpenRecallSettings?: () => void;
  onOpenActivityMemoryIdHandled?: () => void;
  onOpenActivityOperationIdHandled?: () => void;
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
