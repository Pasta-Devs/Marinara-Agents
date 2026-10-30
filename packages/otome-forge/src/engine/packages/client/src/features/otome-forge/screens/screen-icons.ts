// ──────────────────────────────────────────────
// Otome Forge: each screen's icon (apart from screens.ts, so its pure rules load without the icon library)
// ──────────────────────────────────────────────
import {
  BookHeart,
  BookLock,
  BookOpen,
  CalendarDays,
  CalendarHeart,
  Eye,
  Gem,
  Heart,
  House,
  Images,
  Joystick,
  MessageCircleHeart,
  NotebookPen,
  Settings,
  Shirt,
  Sparkles,
  WandSparkles,
  Wine,
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
  "read-him": Eye,
  "read-me": NotebookPen,
  "date-night": Wine,
  claw: Joystick,
  wish: Sparkles,
  wardrobe: Shirt,
  album: Images,
  phone: MessageCircleHeart,
  remind: CalendarDays,
  settings: Settings,
};
