export type PhoneApp = {
  id: string;
  name: string;
  icon: string;
  domain: string;
  description: string;
  preinstalled?: boolean;
  adult?: boolean;
};

export type PhonePage = {
  html: string;
  title: string;
  observerText: string;
  observerName: string;
  appId: string;
  url: string;
  fromCache?: boolean;
};

export type HistoryEntry = { url: string; appId: string; title: string; html: string };

export type CapabilityProps = {
  view?: string;
  chatId?: string;
  connectionId?: string;
  toolbarButtonClass?: string;
  metadata?: Record<string, unknown>;
  context?: Record<string, unknown>;
  openSurface?: () => void;
  onClose?: () => void;
  enabledForChat?: boolean;
  onEnabledForChatChange?: (enabled: boolean) => void | Promise<void>;
  onObserver?: (input: { text: string; name: string; url: string }) => void;
  updateMetadata?: (patch: Record<string, unknown>) => void;
};

export type CapabilityElement = HTMLElement & {
  capabilityProps?: CapabilityProps;
  capabilityRuntimeError?: string | null;
};
