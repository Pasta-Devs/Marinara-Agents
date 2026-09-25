import {
  BookOpen,
  CalendarClock,
  CircleAlert,
  Images,
  MessageCircle,
  Palette,
  ShieldCheck,
  Shirt,
  Sparkles,
  TriangleAlert,
  UserRound,
  UsersRound,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";

import {
  SlpCreatorOverviewSection,
  SlpCreatorAppearanceSection,
  SlpCreatorAutomationSection,
  SlpCreatorAudienceSection,
  SlpCreatorCollaborationsSection,
  SlpCreatorContentRulesSection,
  SlpCreatorContinuitySection,
  SlpCreatorDangerSection,
  SlpCreatorIdentitySection,
  SlpCreatorImproveSection,
  SlpCreatorMessagesSection,
  SlpCreatorProductionSection,
  SlpCreatorWardrobeSection,
} from "./SlpCreatorSettingsSections";
import { SlpCreatorStorylinesSection } from "./SlpCreatorStorylinesSection";
import type { SlpCreatorSettingsCreator, SlpCreatorSettingsSectionProps } from "./slp-creator-settings-contract";
import type { SlpCreatorSettingsBlock, SlpCreatorSettingsTab } from "./slp-creator-settings-store";

/** One block of settings; a tab shows one or more blocks in order. */
export type SlpCreatorSettingsBlockEntry = {
  id: SlpCreatorSettingsBlock;
  icon: LucideIcon;
  /** Localization key for the tab label; the fallback doubles as the English copy. */
  labelKey: string;
  defaultLabel: string;
  Component: ComponentType<SlpCreatorSettingsSectionProps>;
  /** Hides a tab that has nothing to show for this Creator, rather than showing it empty. */
  available?: (creator: SlpCreatorSettingsCreator) => boolean;
};

/**
 * Every block of Creator settings. Adding a per-Creator setting means adding it to one block, or
 * adding a block here and naming it in one tab below.
 */
export const SLP_CREATOR_SETTINGS_BLOCKS: readonly SlpCreatorSettingsBlockEntry[] = [
  {
    id: "overview",
    icon: CircleAlert,
    labelKey: "ui.slurp.settings.creators.tabs.overview",
    defaultLabel: "Overview",
    Component: SlpCreatorOverviewSection,
  },
  {
    id: "identity",
    icon: UserRound,
    labelKey: "ui.slurp.settings.creators.tabs.identity",
    defaultLabel: "Identity",
    Component: SlpCreatorIdentitySection,
  },
  {
    id: "appearance",
    icon: Palette,
    labelKey: "ui.slurp.settings.creators.tabs.appearance",
    defaultLabel: "Appearance",
    Component: SlpCreatorAppearanceSection,
  },
  {
    id: "wardrobe",
    icon: Shirt,
    labelKey: "ui.slurp.settings.creators.tabs.wardrobe",
    defaultLabel: "Wardrobe",
    Component: SlpCreatorWardrobeSection,
  },
  {
    id: "audience",
    icon: UsersRound,
    labelKey: "ui.slurp.settings.creators.tabs.audienceActivity",
    defaultLabel: "Audience activity",
    Component: SlpCreatorAudienceSection,
  },
  {
    id: "automation",
    icon: CalendarClock,
    labelKey: "ui.slurp.settings.creators.tabs.automation",
    defaultLabel: "Automation",
    Component: SlpCreatorAutomationSection,
  },
  {
    id: "content-rules",
    icon: ShieldCheck,
    labelKey: "ui.slurp.settings.creators.tabs.contentRules",
    defaultLabel: "Content rules",
    Component: SlpCreatorContentRulesSection,
  },
  {
    id: "production",
    icon: Images,
    labelKey: "ui.slurp.settings.creators.tabs.production",
    defaultLabel: "Production",
    Component: SlpCreatorProductionSection,
  },
  {
    id: "collaborations",
    icon: UsersRound,
    labelKey: "ui.slurp.settings.creators.tabs.collaborations",
    defaultLabel: "Collaborations",
    Component: SlpCreatorCollaborationsSection,
  },
  {
    id: "messages",
    icon: MessageCircle,
    labelKey: "ui.slurp.settings.creators.tabs.messages",
    defaultLabel: "Messages",
    Component: SlpCreatorMessagesSection,
  },
  {
    id: "storylines",
    icon: Workflow,
    labelKey: "ui.slurp.settings.creators.tabs.storylines",
    defaultLabel: "Storylines",
    Component: SlpCreatorStorylinesSection,
  },
  {
    id: "continuity",
    icon: BookOpen,
    labelKey: "ui.slurp.settings.creators.tabs.continuity",
    defaultLabel: "Continuity",
    Component: SlpCreatorContinuitySection,
  },
  {
    id: "improve",
    icon: Sparkles,
    labelKey: "ui.slurp.settings.creators.tabs.improve",
    defaultLabel: "Improve",
    Component: SlpCreatorImproveSection,
  },
  {
    id: "danger",
    icon: TriangleAlert,
    labelKey: "ui.slurp.settings.creators.tabs.danger",
    defaultLabel: "Remove",
    Component: SlpCreatorDangerSection,
  },
];

export type SlpCreatorSettingsSection = {
  id: SlpCreatorSettingsTab;
  icon: LucideIcon;
  labelKey: string;
  defaultLabel: string;
  blocks: readonly SlpCreatorSettingsBlockEntry[];
};

const blocks = (...ids: SlpCreatorSettingsBlock[]) =>
  ids.map((id) => SLP_CREATOR_SETTINGS_BLOCKS.find((block) => block.id === id)!);

/**
 * The Creator settings modal, one entry per tab: who they are, what they post, who they talk to,
 * what they remember, tools. The modal, its tab rail and the settings search all read this.
 */
export const SLP_CREATOR_SETTINGS_SECTIONS: readonly SlpCreatorSettingsSection[] = [
  {
    id: "overview",
    icon: CircleAlert,
    labelKey: "ui.slurp.settings.creators.tabs.overview",
    defaultLabel: "Overview",
    blocks: blocks("overview"),
  },
  {
    id: "profile",
    icon: UserRound,
    labelKey: "ui.slurp.settings.creators.tabs.profile",
    defaultLabel: "Profile",
    blocks: blocks("identity", "appearance", "wardrobe"),
  },
  {
    id: "posting",
    icon: CalendarClock,
    labelKey: "ui.slurp.settings.creators.tabs.posting",
    defaultLabel: "Posting",
    blocks: blocks("automation", "production", "storylines", "collaborations"),
  },
  {
    id: "content-rules",
    icon: ShieldCheck,
    labelKey: "ui.slurp.settings.creators.tabs.contentRules",
    defaultLabel: "Content rules",
    blocks: blocks("content-rules"),
  },
  {
    id: "fans",
    icon: MessageCircle,
    labelKey: "ui.slurp.settings.creators.tabs.fans",
    defaultLabel: "Fans & messages",
    blocks: blocks("audience", "messages"),
  },
  {
    id: "memory",
    icon: BookOpen,
    labelKey: "ui.slurp.settings.creators.tabs.memory",
    defaultLabel: "Memory",
    blocks: blocks("continuity"),
  },
  {
    id: "tools",
    icon: Sparkles,
    labelKey: "ui.slurp.settings.creators.tabs.tools",
    defaultLabel: "Tools",
    blocks: blocks("improve", "danger"),
  },
];
