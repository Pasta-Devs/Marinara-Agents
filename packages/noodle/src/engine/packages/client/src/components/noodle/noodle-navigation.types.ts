export type NoodleProfileConnection = "followers" | "following";

export type NoodlePublicNavigationState =
  | { mode: "public"; view: "home" }
  | { mode: "public"; view: "search" }
  | { mode: "public"; view: "notifications" }
  | {
      mode: "public";
      view: "profile";
      accountId: string | null;
      connection: NoodleProfileConnection | null;
      edit?: boolean;
      returnToSettings?: NoodleSettingsNavigationState;
    };

export type NoodleSettingsReturnState = NoodlePublicNavigationState;

export type NoodleSettingsNavigationState = {
  mode: "settings";
  tab?: "noodle";
  section?: "general" | "timeline" | "images" | "participants" | "advanced";
  returnTo?: NoodleSettingsReturnState;
};

export type NoodleNavigationState = NoodlePublicNavigationState | NoodleSettingsNavigationState;
