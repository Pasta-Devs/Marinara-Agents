import { create } from "zustand";

/**
 * Which Creator the settings modal is showing, and on which tab.
 *
 * A store rather than props: the modal is opened from the Creator's profile, from Backstage, and
 * from a Backstage search result, and those three live in different trees. Nothing here is
 * persisted — a modal that reopens itself after a reload is a surprise, not a convenience.
 */
export type SlpCreatorSettingsTab = "overview" | "profile" | "posting" | "content-rules" | "fans" | "memory" | "tools";

/**
 * A block inside a tab: the section ids from before the tabs were merged. Deep links, Backstage
 * search and older callers still name a block; it opens its tab and scrolls to the block.
 */
export type SlpCreatorSettingsBlock =
  | "overview"
  | "identity"
  | "appearance"
  | "wardrobe"
  | "audience"
  | "automation"
  | "content-rules"
  | "production"
  | "collaborations"
  | "messages"
  | "storylines"
  | "continuity"
  | "improve"
  | "danger";

export const SLP_CREATOR_BLOCK_TAB: Record<SlpCreatorSettingsBlock, SlpCreatorSettingsTab> = {
  overview: "overview",
  identity: "profile",
  appearance: "profile",
  wardrobe: "profile",
  audience: "fans",
  automation: "posting",
  "content-rules": "content-rules",
  production: "posting",
  collaborations: "posting",
  messages: "fans",
  storylines: "posting",
  continuity: "memory",
  improve: "tools",
  danger: "tools",
};

/** A tab id, or an older block id resolved to the tab that now holds it. */
export function slpCreatorSettingsTabFor(tab: SlpCreatorSettingsTab | SlpCreatorSettingsBlock): SlpCreatorSettingsTab {
  return tab in SLP_CREATOR_BLOCK_TAB
    ? SLP_CREATOR_BLOCK_TAB[tab as SlpCreatorSettingsBlock]
    : (tab as SlpCreatorSettingsTab);
}

/** The first block of each tab needs no scrolling; the rest are scrolled to by their anchor. */
const FIRST_BLOCKS = new Set<string>([
  "overview",
  "identity",
  "automation",
  "content-rules",
  "audience",
  "continuity",
  "improve",
]);

/** The anchor that brings an older block id into view inside its merged tab, if it needs one. */
export function slpCreatorBlockAnchor(tab: string | undefined): string | null {
  return tab && tab in SLP_CREATOR_BLOCK_TAB && !FIRST_BLOCKS.has(tab) ? `block:${tab}` : null;
}

type SlpCreatorSettingsState = {
  creatorId: string | null;
  tab: SlpCreatorSettingsTab;
  /** A Backstage search result to scroll to and focus once the tab has rendered. */
  settingKey: string | null;
  open: (
    creatorId: string,
    options?: { tab?: SlpCreatorSettingsTab | SlpCreatorSettingsBlock; settingKey?: string },
  ) => void;
  setTab: (tab: SlpCreatorSettingsTab | SlpCreatorSettingsBlock) => void;
  clearSettingKey: () => void;
  close: () => void;
};

export const useSlpCreatorSettingsStore = create<SlpCreatorSettingsState>((set) => ({
  creatorId: null,
  tab: "profile",
  settingKey: null,
  open: (creatorId, options) =>
    set({
      creatorId,
      tab: slpCreatorSettingsTabFor(options?.tab ?? "profile"),
      settingKey: options?.settingKey ?? slpCreatorBlockAnchor(options?.tab),
    }),
  setTab: (tab) => set({ tab: slpCreatorSettingsTabFor(tab), settingKey: slpCreatorBlockAnchor(tab) }),
  clearSettingKey: () => set({ settingKey: null }),
  close: () => set({ creatorId: null, settingKey: null }),
}));

/** Open the Creator settings modal from anywhere, including outside React. */
export function openSlpCreatorSettings(
  creatorId: string,
  options?: { tab?: SlpCreatorSettingsTab | SlpCreatorSettingsBlock; settingKey?: string },
) {
  useSlpCreatorSettingsStore.getState().open(creatorId, options);
}
