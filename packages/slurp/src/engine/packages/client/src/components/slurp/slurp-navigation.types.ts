export const SLURP_API_PREFIX = "/api/slurp";

export type SlurpProfileConnection = "followers" | "following";

export type SlurpNavigationState =
  | { mode: "creator"; view: "hub"; onboarding?: boolean }
  | { mode: "creator"; view: "search" }
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
      section?: "general" | "creators" | "images" | "audience" | "advanced";
      returnTo?: SlurpNavigationState;
    };

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
