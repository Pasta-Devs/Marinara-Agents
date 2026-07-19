import type { Root } from "react-dom/client";

export type CapabilityProps = {
  package?: {
    name?: string;
    version?: string;
    readiness?: string;
    status?: string;
  };
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
  "vault" | "review" | "sources" | "activity" | "settings";

export type LongTermMemoryDestinationProps = {
  props: CapabilityProps;
  onDirtyChange?: (dirty: boolean) => void;
  onOpenMemory?: (noteId: string) => void;
  onOpenSources?: () => void;
  onOpenReview?: (sourceNoteId?: string) => void;
  openedNoteId?: string | null;
};
