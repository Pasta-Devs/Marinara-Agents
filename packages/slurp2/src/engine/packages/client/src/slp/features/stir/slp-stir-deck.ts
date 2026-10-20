import {
  BookPlus,
  CalendarPlus,
  Palette,
  Target,
  TrendingUp,
  Compass,
  CalendarHeart,
  Flame,
  Handshake,
  HeartHandshake,
  Lightbulb,
  Megaphone,
  PartyPopper,
  PenLine,
  ShoppingBag,
  Snowflake,
  Store,
  SunMoon,
  Zap,
  BookOpen,
  UsersRound,
  Clapperboard,
  Users,
  type LucideIcon,
} from "lucide-react";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import {
  SLP_ACTION_META,
  SLP_ACTION_NAMES,
  type SlpActionName,
  type SlpStirCategory,
} from "../../../../../shared/src/slp/slp-actions.js";

/**
 * The deck, fed from the action catalog: a card per deck lever (`SLP_ACTION_META`), in its category,
 * with its icon. A new action with `deck: true` is a new card; only its icon and words are added here.
 */
const ICONS: Partial<Record<SlpActionName, LucideIcon>> = {
  "set-up-couple": HeartHandshake,
  "steer-couple": CalendarHeart,
  "add-to-couple": UsersRound,
  "couple-page": Store,
  "suggest-collab": Handshake,
  "push-collab": Zap,
  "offer-brand-deal": ShoppingBag,
  "start-rivalry": Flame,
  "cool-rivalry": Snowflake,
  "add-idea": Lightbulb,
  "write-post": PenLine,
  "steer-creator": SunMoon,
  "set-spice": SlpSparkleGlyph as LucideIcon,
  "start-event": PartyPopper,
  "steer-storyline": BookOpen,
  "run-audience": Megaphone,
  "start-storyline": BookPlus,
  "set-tip-goal": Target,
  "new-look": Palette,
  "invent-event": CalendarPlus,
  "start-trend": TrendingUp,
  "steer-trend": Compass,
  "set-bond": Users,
  "start-drama": Clapperboard,
};

export type SlpStirDeckCard = {
  action: SlpActionName;
  category: SlpStirCategory;
  targets: (typeof SLP_ACTION_META)[SlpActionName]["targets"];
  icon: LucideIcon;
  ai: boolean;
};

export const SLP_STIR_DECK = Object.fromEntries(
  SLP_ACTION_NAMES.filter((name) => SLP_ACTION_META[name].deck).map((name) => [
    name,
    {
      action: name,
      category: SLP_ACTION_META[name].category as SlpStirCategory,
      targets: SLP_ACTION_META[name].targets,
      icon: ICONS[name] ?? (SlpSparkleGlyph as LucideIcon),
      ai: SLP_ACTION_META[name].ai,
    },
  ]),
) as Record<SlpActionName, SlpStirDeckCard>;

/** The order cards show in, per category (the most fun first). */
export const SLP_STIR_DECK_ORDER: SlpActionName[] = [
  "set-up-couple",
  "steer-couple",
  "add-to-couple",
  "couple-page",
  "suggest-collab",
  "push-collab",
  "offer-brand-deal",
  "set-tip-goal",
  "start-drama",
  "start-rivalry",
  "cool-rivalry",
  "set-bond",
  "add-idea",
  "write-post",
  "start-storyline",
  "steer-creator",
  "new-look",
  "set-spice",
  "start-event",
  "invent-event",
  "start-trend",
  "steer-trend",
  "steer-storyline",
  "run-audience",
];
