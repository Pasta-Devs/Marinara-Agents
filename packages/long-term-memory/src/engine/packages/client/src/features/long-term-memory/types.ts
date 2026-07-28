import type { Root } from "react-dom/client";
import type {
  LtmExtractionDroppedCandidate,
  LtmMode,
  LtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import type { LtmLocalizationContext } from "./localization";

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
  | "vault"
  | "review"
  | "sources"
  | "settings";

export type LtmRecoveryHandoff = {
  key: number;
  candidate: LtmExtractionDroppedCandidate;
  scope: LtmScope;
  modes: LtmMode[];
};

export type LongTermMemoryDestinationProps = {
  props: CapabilityProps;
  onDirtyChange?: (dirty: boolean) => void;
  onOpenMemory?: (noteId: string) => void;
  onOpenReview?: (sourceNoteId?: string) => void;
  onRecoverCandidate?: (
    candidate: LtmExtractionDroppedCandidate,
    scope: LtmScope,
    modes: LtmMode[],
  ) => void;
  openedNoteId?: string | null;
  createMemoryRequest?: number | null;
  onCreateMemoryRequestHandled?: () => void;
  reviewSourceNoteId?: string | null;
  recoveryHandoff?: LtmRecoveryHandoff | null;
};
