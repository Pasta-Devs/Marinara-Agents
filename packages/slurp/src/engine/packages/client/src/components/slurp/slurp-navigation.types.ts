export const SLURP_API_PREFIX = "/api/slurp";

export type SlurpNavigationState = {
  view: "home";
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
