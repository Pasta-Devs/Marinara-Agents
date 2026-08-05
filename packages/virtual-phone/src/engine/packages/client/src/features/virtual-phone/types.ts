export type PhoneApp = {
  id: string;
  name: string;
  icon: string;
  domain: string;
  description: string;
  framework?: "social" | "utility" | "media" | "commerce" | "community";
  storeCategory?: "social" | "productivity" | "entertainment" | "finance" | "shopping" | "reference";
  contentGuidance?: string;
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

export type PhoneOwner = {
  kind: "chat" | "character";
  id: string;
  name?: string;
};

export type PhoneInteraction =
  | { type: "open-app"; owner: PhoneOwner; appId: string; url: string }
  | { type: "navigate"; owner: PhoneOwner; appId: string; url: string; action?: string }
  | { type: "home"; owner: PhoneOwner }
  | { type: "store"; owner: PhoneOwner }
  | { type: "screen"; owner: PhoneOwner; screen: "home" | "store" | "app" };

export type PhoneBackground = "aurora" | "midnight" | "paper" | "ocean" | "sunset";

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
  /** The currently displayed phone owner. Character phones can use this later. */
  phoneOwner?: PhoneOwner;
  onPhoneInteraction?: (interaction: PhoneInteraction) => void;
};

export type CapabilityElement = HTMLElement & {
  capabilityProps?: CapabilityProps;
  capabilityRuntimeError?: string | null;
};
