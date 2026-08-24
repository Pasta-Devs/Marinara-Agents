import type { Root } from "react-dom/client";
import type { MemoryNagSettings, MemoryNagVault } from "../../../../shared/src/features/agents/memory-nag/schema.js";

export type {
  MemoryNagMemory,
  MemoryNagParticipant,
} from "../../../../shared/src/features/agents/memory-nag/schema.js";

export type MemoryNagLocalizationContext = {
  locale?: string;
  direction?: "ltr" | "rtl";
};

export type MemoryNagConnection = {
  id: string;
  name: string;
  model?: string;
  provider?: string;
};

export type CapabilityProps = {
  package?: { name?: string; version?: string };
  localization?: MemoryNagLocalizationContext;
  chatId?: string | null;
  chatMode?: "conversation" | "roleplay" | "game" | null;
  mobileCompact?: boolean;
  toolbarButtonClass?: string;
  onRerunTracker?: () => void;
  trackerRetryBusy?: boolean;
  lockMode?: boolean;
  onToggleLockMode?: () => void;
  detached?: boolean;
  connections?: MemoryNagConnection[];
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

export type MemoryNagScanProgress = {
  processed: number;
  total: number;
  created: number;
  resolved: number;
  done: boolean;
  checkpointMessageId: string | null;
};

export type MemoryNagSettingsResponse = MemoryNagVault & { settings: MemoryNagSettings };
