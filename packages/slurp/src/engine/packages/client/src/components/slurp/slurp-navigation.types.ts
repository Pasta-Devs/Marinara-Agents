export const SLURP_API_PREFIX = "/api/slurp";

export type SlurpProfileConnection = "followers" | "following";

export type SlurpNavigationState =
  | { mode: "creator"; view: "hub"; onboarding?: boolean }
  | { mode: "creator"; view: "search" }
  /** `creatorAccountId` lands straight in that Creator's chat, when Messages was opened from a profile. */
  | { mode: "creator"; view: "messages"; creatorAccountId?: string }
  | { mode: "creator"; view: "wallet" }
  | {
      mode: "creator";
      view: "profile";
      accountId: string | null;
      connection?: SlurpProfileConnection | null;
      edit?: boolean;
      returnToSettings?: SlurpNavigationState;
    }
  | { mode: "creator"; view: "profiles"; returnToSettings?: SlurpNavigationState }
  | {
      mode: "creator";
      view: "create-profile";
      sourceAccountId: string;
      returnToSettings?: SlurpNavigationState;
    }
  | {
      mode: "creator-settings";
      tab?: "creator";
      section?: SlurpSettingsSection;
      returnTo?: SlurpNavigationState;
    };

/**
 * The Settings sections, in the order they are shown.
 *
 * One list, three consumers: the section row, the navigation type, and the store's persisted-state
 * check. It used to be copied into each, and the copies drifted — the store silently dropped a
 * persisted `section: "ads"` because its copy never learned about it.
 */
export const SLURP_SETTINGS_SECTIONS = [
  "overview",
  "general",
  "creators",
  "images",
  "audience",
  "ads",
  "wallet",
  "advanced",
] as const;

export type SlurpSettingsSection = (typeof SLURP_SETTINGS_SECTIONS)[number];

export type SlurpSourceKind = "character" | "persona";

export type SlurpSourceReference = {
  sourceKind: SlurpSourceKind;
  sourceEntityId: string;
};

/** The viewer identity is always an Engine persona ID. */
export type SlurpViewerReference = {
  personaId: string;
};

export type SlurpHomeNavigation = SlurpNavigationState;
