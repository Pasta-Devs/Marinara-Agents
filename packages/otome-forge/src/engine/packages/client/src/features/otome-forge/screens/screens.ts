// ──────────────────────────────────────────────
// Otome Forge: the screens OtomeForgeView routes between, with each one's name and icon
// ──────────────────────────────────────────────
import {
  BookHeart,
  BookLock,
  CalendarHeart,
  Gem,
  Heart,
  House,
  Images,
  Settings,
  Shirt,
  Smartphone,
  Sparkles,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";

export type ScreenId =
  | "picker"
  | "setup"
  | "forge"
  | "bible"
  | "home"
  | "story"
  | "dates"
  | "wish"
  | "wardrobe"
  | "album"
  | "phone"
  | "settings";

/** The Dock's screens, in order; Wish is the raised one in the middle. */
export const DOCK_SCREENS = ["story", "dates", "wish", "wardrobe", "album"] as const satisfies readonly ScreenId[];
export type DockScreen = (typeof DOCK_SCREENS)[number];

/** Screens inside a run, which show the Starlight counter and his chip. */
export const RUN_SCREENS: ReadonlySet<ScreenId> = new Set([
  "home",
  "story",
  "dates",
  "wish",
  "wardrobe",
  "album",
  "phone",
]);

export const SCREEN_NAME_KEYS: Record<ScreenId, string> = {
  picker: "ui.otomeForge.common.screenPicker",
  setup: "ui.otomeForge.common.screenSetup",
  forge: "ui.otomeForge.common.screenForge",
  bible: "ui.otomeForge.common.screenBible",
  home: "ui.otomeForge.common.screenHome",
  story: "ui.otomeForge.common.screenStory",
  dates: "ui.otomeForge.common.screenDates",
  wish: "ui.otomeForge.common.screenWish",
  wardrobe: "ui.otomeForge.common.screenWardrobe",
  album: "ui.otomeForge.common.screenAlbum",
  phone: "ui.otomeForge.common.screenPhone",
  settings: "ui.otomeForge.common.screenSettings",
};

export const SCREEN_ICONS: Record<ScreenId, LucideIcon> = {
  picker: Heart,
  setup: WandSparkles,
  forge: Gem,
  bible: BookLock,
  home: House,
  story: BookHeart,
  dates: CalendarHeart,
  wish: Sparkles,
  wardrobe: Shirt,
  album: Images,
  phone: Smartphone,
  settings: Settings,
};
