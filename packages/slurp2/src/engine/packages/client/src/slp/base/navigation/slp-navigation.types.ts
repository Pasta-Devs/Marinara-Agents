import type {
  SlpBackstageSection as SlurpBackstageSection,
  SlpBackstageTarget as SlurpBackstageTarget,
} from "./slp-backstage-target";

export const SLURP_API_PREFIX = "/api/slurp2";

export type SlurpProfileConnection = "followers" | "following";

export type SlurpNavigationState =
  | { mode: "creator"; view: "hub"; onboarding?: boolean }
  | { mode: "creator"; view: "search" }
  /**
   * `creatorAccountId` lands straight in that Creator's chat, when Messages was opened from a profile.
   * `returnTo` is where Back leaves that chat for.
   */
  | {
      mode: "creator";
      view: "messages";
      creatorAccountId?: string;
      /** Open that Creator's Slurp Support thread (W: the Stir ✦ sheet). */
      asSupport?: boolean;
      returnTo?: SlurpNavigationState;
    }
  | { mode: "creator"; view: "wallet" }
  /** A live show, full screen (LIVE-V3-PLAN.md). */
  | { mode: "creator"; view: "live"; showId: string; returnTo?: SlurpNavigationState }
  /** W: the Stir tab (make things happen). */
  | { mode: "creator"; view: "stir" }
  /** Before W, the Creator home. Old links open the Stir tab (the Dashboard is on the own profile now). */
  | { mode: "creator"; view: "studio" }
  | { mode: "creator"; view: "notifications" }
  | {
      mode: "creator";
      view: "profile";
      accountId: string | null;
      connection?: SlurpProfileConnection | null;
      edit?: boolean;
      /** Open the own page's Dashboard sheet on arrival (W: an owed #ad suggestion in Stir). */
      dashboard?: boolean;
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
      /** Opens this Creator's continuity editor once the Creators page renders. Never persisted. */
      continuityCreatorId?: string;
      /** Opens the generation selector when Pulse routes into Backstage. Never persisted. */
      openRefresh?: boolean;
      returnTo?: SlurpNavigationState;
    };

/**
 * The Settings sections, in the order they are shown.
 *
 * One list, three consumers: the section row, the navigation type, and the store's persisted-state
 * check. It used to be copied into each, and the copies drifted — the store silently dropped a
 * persisted `section: "ads"` because its copy never learned about it.
 */
export { SLP_BACKSTAGE_SECTIONS as SLURP_SETTINGS_SECTIONS } from "./slp-backstage-target";
export type { SlpBackstageSection as SlurpSettingsSection } from "./slp-backstage-target";

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
