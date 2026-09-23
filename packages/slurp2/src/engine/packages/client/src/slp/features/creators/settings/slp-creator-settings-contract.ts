import type { useCreatorAccounts } from "../slp-creators-hooks";

/**
 * The Creator as the roster query returns it, schedule status and all. Derived from the hook so a
 * field added to that response reaches every section without a second type to update.
 */
export type SlpCreatorSettingsCreator = NonNullable<ReturnType<typeof useCreatorAccounts>["data"]>[number];

/**
 * What every Creator settings section is handed.
 *
 * Deliberately small: a section reaches for its own hooks rather than taking a page's props, which
 * is what lets the same section render inside the modal no matter which surface opened it.
 */
export type SlpCreatorSettingsSectionProps = {
  creator: SlpCreatorSettingsCreator;
  /** Close the modal. Used after an action that removes the Creator the modal is describing. */
  onClose: () => void;
  /**
   * Leave for the full-page AI redraft review. That flow has to accept the source snapshot the
   * model was given, so it cannot be reduced to a tab inside this modal.
   */
  onRedraft?: (creator: SlpCreatorSettingsCreator) => void;
  /** Open the Creator's public profile, leaving Backstage if that is where we are. */
  onViewProfile?: (creator: SlpCreatorSettingsCreator) => void;
  /** Reports unsaved profile edits to the modal dismissal guard. */
  onDirtyChange?: (dirty: boolean) => void;
  onSaveStateChange?: (state: { isPending: boolean; dirty: boolean; save: () => void; discard: () => void }) => void;
  mode?: "automation" | "content-rules" | "collaborations";
  /** True while this section is the visible tab. Sections gate their queries on it. */
  active: boolean;
};

/** Which tab owns a setting, so Backstage search can open the modal on the right section. */
export const SLP_CREATOR_SETTING_TAB: Record<string, import("./slp-creator-settings-store").SlpCreatorSettingsTab> = {
  creatorCollabs: "collaborations",
  characterImageInstructions: "production",
};
