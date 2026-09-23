import {
  BookOpen,
  CalendarClock,
  Images,
  MessageCircle,
  Shirt,
  Sparkles,
  TriangleAlert,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";

import { SlpCreatorPublishingSection } from "./SlpCreatorPublishingSection";
import {
  SlpCreatorAudienceSection,
  SlpCreatorContinuitySection,
  SlpCreatorDangerSection,
  SlpCreatorIdentitySection,
  SlpCreatorImagesSection,
  SlpCreatorImproveSection,
  SlpCreatorMessagesSection,
  SlpCreatorWardrobeSection,
} from "./SlpCreatorSettingsSections";
import type { SlpCreatorSettingsCreator, SlpCreatorSettingsSectionProps } from "./slp-creator-settings-contract";
import type { SlpCreatorSettingsTab } from "./slp-creator-settings-store";

export type SlpCreatorSettingsSection = {
  id: SlpCreatorSettingsTab;
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
    icon: UserRound,
    labelKey: "ui.slurp.settings.creators.tabs.identity",
    defaultLabel: "Identity",
    Component: SlpCreatorIdentitySection,
  },
  {
    id: "wardrobe",
    icon: Shirt,
    labelKey: "ui.slurp.settings.creators.tabs.wardrobe",
    defaultLabel: "Wardrobe",
    Component: SlpCreatorWardrobeSection,
  },
  {
    id: "publishing",
    icon: CalendarClock,
    labelKey: "ui.slurp.settings.creators.tabs.publishing",
    defaultLabel: "Publishing",
    Component: SlpCreatorPublishingSection,
  },
  {
    id: "audience",
    icon: UsersRound,
    labelKey: "ui.slurp.settings.creators.tabs.audience",
    defaultLabel: "Audience",
    Component: SlpCreatorAudienceSection,
  },
  {
    id: "images",
    icon: Images,
    labelKey: "ui.slurp.settings.creators.tabs.images",
    defaultLabel: "Images",
    Component: SlpCreatorImagesSection,
  },
  {
    id: "messages",
    icon: MessageCircle,
    labelKey: "ui.slurp.settings.creators.tabs.messages",
    defaultLabel: "Messages",
    Component: SlpCreatorMessagesSection,
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
