import type { SlpBackstageSection as SlurpBackstageSection, SlpBackstageTarget as SlurpBackstageTarget } from "../../slp/base/navigation/slp-backstage-target";

export const SLURP_API_PREFIX = "/api/slurp2";

export type SlurpProfileConnection = "followers" | "following";

export type SlurpNavigationState =
  | { mode: "creator"; view: "hub"; onboarding?: boolean }
  | { mode: "creator"; view: "search" }
  /**
   * `creatorAccountId` lands straight in that Creator's chat, when Messages was opened from a profile.
   * `returnTo` is where Back leaves that chat for.
   */
  | { mode: "creator"; view: "messages"; creatorAccountId?: string; returnTo?: SlurpNavigationState }
  | { mode: "creator"; view: "wallet" }
  /** The Creator home: earnings, reach, recent post performance, and goals. */
  | { mode: "creator"; view: "studio" }
  | { mode: "creator"; view: "notifications" }
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
      section?: SlurpBackstageSection;
      target?: SlurpBackstageTarget;
      /** A search result to scroll to and focus once the target renders. Never persisted. */
      settingKey?: string;
      returnTo?: SlurpNavigationState;
    };

/**
 * The Settings sections, in the order they are shown.
 *
 * One list, three consumers: the section row, the navigation type, and the store's persisted-state
 * check. It used to be copied into each, and the copies drifted — the store silently dropped a
 * persisted `section: "ads"` because its copy never learned about it.
 */
export { SLP_BACKSTAGE_SECTIONS as SLURP_SETTINGS_SECTIONS } from "../../slp/base/navigation/slp-backstage-target";
export type { SlpBackstageSection as SlurpSettingsSection } from "../../slp/base/navigation/slp-backstage-target";

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
