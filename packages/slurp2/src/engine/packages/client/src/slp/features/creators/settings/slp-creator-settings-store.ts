import { create } from "zustand";

/**
 * Which Creator the settings modal is showing, and on which tab.
 *
 * A store rather than props: the modal is opened from the Creator's profile, from Backstage, and
 * from a Backstage search result, and those three live in different trees. Nothing here is
 * persisted — a modal that reopens itself after a reload is a surprise, not a convenience.
 */
export type SlpCreatorSettingsTab =
  "identity" | "wardrobe" | "publishing" | "audience" | "images" | "messages" | "continuity" | "improve" | "danger";

type SlpCreatorSettingsState = {
  creatorId: string | null;
  tab: SlpCreatorSettingsTab;
  /** A Backstage search result to scroll to and focus once the tab has rendered. */
  settingKey: string | null;
  open: (creatorId: string, options?: { tab?: SlpCreatorSettingsTab; settingKey?: string }) => void;
  setTab: (tab: SlpCreatorSettingsTab) => void;
  clearSettingKey: () => void;
  close: () => void;
};

export const useSlpCreatorSettingsStore = create<SlpCreatorSettingsState>((set) => ({
  creatorId: null,
  tab: "identity",
  settingKey: null,
  open: (creatorId, options) =>
    set({ creatorId, tab: options?.tab ?? "identity", settingKey: options?.settingKey ?? null }),
  setTab: (tab) => set({ tab, settingKey: null }),
  clearSettingKey: () => set({ settingKey: null }),
  close: () => set({ creatorId: null, settingKey: null }),
}));

/** Open the Creator settings modal from anywhere, including outside React. */
export function openSlpCreatorSettings(
  creatorId: string,
  options?: { tab?: SlpCreatorSettingsTab; settingKey?: string },
) {
  useSlpCreatorSettingsStore.getState().open(creatorId, options);
}
