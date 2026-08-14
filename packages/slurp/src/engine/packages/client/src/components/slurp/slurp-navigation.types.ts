export type SlurpSourceKind = "character" | "persona";

export type SlurpNavigationState =
  | { view: "home" }
  | { view: "sources" }
  | { view: "preview" };

export type SlurpSourceReference = {
  kind: SlurpSourceKind;
  entityId: string;
};
