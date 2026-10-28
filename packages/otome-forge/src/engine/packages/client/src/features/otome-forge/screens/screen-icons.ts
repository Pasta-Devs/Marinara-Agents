// ──────────────────────────────────────────────
// Otome Forge: each screen's icon (apart from screens.ts, so its pure rules load without the icon library)
// ──────────────────────────────────────────────
import {
  BookHeart,
  BookLock,
  BookOpen,
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
import type { ScreenId } from "./screens";

export const SCREEN_ICONS: Record<ScreenId, LucideIcon> = {
  picker: Heart,
  setup: WandSparkles,
  forge: Gem,
  bible: BookLock,
  home: House,
  story: BookHeart,
  reader: BookOpen,
  dates: CalendarHeart,
  wish: Sparkles,
  wardrobe: Shirt,
  album: Images,
  phone: Smartphone,
  settings: Settings,
};
