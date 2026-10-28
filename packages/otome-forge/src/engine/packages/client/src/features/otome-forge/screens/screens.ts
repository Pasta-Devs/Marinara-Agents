// ──────────────────────────────────────────────
// Otome Forge: the screens OtomeForgeView routes between, with each one's name and icon
// ──────────────────────────────────────────────
import {
  BookHeart,
  BookLock,
  BookOpen,
  CalendarHeart,
  Eye,
  Gem,
  Heart,
  House,
  Images,
  Joystick,
  Settings,
  Shirt,
  Smartphone,
  Sparkles,
  WandSparkles,
  Wine,
  type LucideIcon,
} from "lucide-react";

export type ScreenId =
  | "picker"
  | "setup"
  | "forge"
  | "bible"
  | "home"
  | "story"
  | "reader"
  | "dates"
  | "read-him"
  | "date-night"
  | "claw"
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
  "read-him",
  "date-night",
  "claw",
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
  reader: "ui.otomeForge.common.screenReader",
  dates: "ui.otomeForge.common.screenDates",
  "read-him": "ui.otomeForge.common.screenReadHim",
  "date-night": "ui.otomeForge.common.screenDateNight",
  claw: "ui.otomeForge.common.screenClaw",
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
  reader: BookOpen,
  dates: CalendarHeart,
  "read-him": Eye,
  "date-night": Wine,
  claw: Joystick,
  wish: Sparkles,
  wardrobe: Shirt,
  album: Images,
  phone: Smartphone,
  settings: Settings,
};
