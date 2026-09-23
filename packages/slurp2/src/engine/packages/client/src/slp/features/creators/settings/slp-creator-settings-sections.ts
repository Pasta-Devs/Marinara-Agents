import {
  BookOpen,
  CalendarClock,
  Images,
  MessageCircle,
  Palette,
  ShieldCheck,
  Shirt,
  Sparkles,
  TriangleAlert,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";

import {
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
import type { SlpCreatorSettingsCreator, SlpCreatorSettingsSectionProps } from "./slp-creator-settings-contract";
import type { SlpCreatorSettingsTab } from "./slp-creator-settings-store";

export type SlpCreatorSettingsSection = {
  id: SlpCreatorSettingsTab;
  group: "creator" | "publishing" | "interaction" | "memory" | "tools" | "danger";
  icon: LucideIcon;
  /** Localization key for the tab label; the fallback doubles as the English copy. */
  labelKey: string;
  defaultLabel: string;
  Component: ComponentType<SlpCreatorSettingsSectionProps>;
  /** Hides a tab that has nothing to show for this Creator, rather than showing it empty. */
  available?: (creator: SlpCreatorSettingsCreator) => boolean;
};

/**
 * The Creator settings modal, one entry per tab.
 *
 * Adding a per-Creator setting means adding it to one section, or adding a section here. There is
 * no second list to keep in step: the modal, its tab rail and the settings search all read this.
 */
export const SLP_CREATOR_SETTINGS_SECTIONS: readonly SlpCreatorSettingsSection[] = [
  {
    id: "identity",
    group: "creator",
    icon: UserRound,
    labelKey: "ui.slurp.settings.creators.tabs.identity",
    defaultLabel: "Identity",
    Component: SlpCreatorIdentitySection,
  },
  {
    id: "appearance",
    group: "creator",
    icon: Palette,
    labelKey: "ui.slurp.settings.creators.tabs.appearance",
    defaultLabel: "Appearance",
    Component: SlpCreatorAppearanceSection,
  },
  {
    id: "wardrobe",
    group: "creator",
    icon: Shirt,
    labelKey: "ui.slurp.settings.creators.tabs.wardrobe",
    defaultLabel: "Wardrobe",
    Component: SlpCreatorWardrobeSection,
  },
  {
    id: "audience",
    group: "creator",
    icon: UsersRound,
    labelKey: "ui.slurp.settings.creators.tabs.audience",
    defaultLabel: "Audience",
    Component: SlpCreatorAudienceSection,
  },
  {
    id: "automation",
    group: "publishing",
    icon: CalendarClock,
    labelKey: "ui.slurp.settings.creators.tabs.automation",
    defaultLabel: "Automation",
    Component: SlpCreatorAutomationSection,
  },
  {
    id: "content-rules",
    group: "publishing",
    icon: ShieldCheck,
    labelKey: "ui.slurp.settings.creators.tabs.contentRules",
    defaultLabel: "Content rules",
    Component: SlpCreatorContentRulesSection,
  },
  {
    id: "production",
    group: "publishing",
    icon: Images,
    labelKey: "ui.slurp.settings.creators.tabs.production",
    defaultLabel: "Production",
    Component: SlpCreatorProductionSection,
  },
  {
    id: "collaborations",
    group: "publishing",
    icon: UsersRound,
    labelKey: "ui.slurp.settings.creators.tabs.collaborations",
    defaultLabel: "Collaborations",
    Component: SlpCreatorCollaborationsSection,
  },
  {
    id: "messages",
    group: "interaction",
    icon: MessageCircle,
    labelKey: "ui.slurp.settings.creators.tabs.messages",
    defaultLabel: "Messages",
    Component: SlpCreatorMessagesSection,
  },
  {
    id: "continuity",
    group: "memory",
    icon: BookOpen,
    labelKey: "ui.slurp.settings.creators.tabs.continuity",
    defaultLabel: "Continuity",
    Component: SlpCreatorContinuitySection,
  },
  {
    id: "improve",
    group: "tools",
    icon: Sparkles,
    labelKey: "ui.slurp.settings.creators.tabs.improve",
    defaultLabel: "Improve",
    Component: SlpCreatorImproveSection,
  },
  {
    id: "danger",
    group: "danger",
    icon: TriangleAlert,
    labelKey: "ui.slurp.settings.creators.tabs.danger",
    defaultLabel: "Remove",
    Component: SlpCreatorDangerSection,
  },
];
