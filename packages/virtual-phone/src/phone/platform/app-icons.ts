import { AtSign, BookUser, Camera, Flame, Images, Lock, Mail, MessageCircle, Search, Settings, StickyNote, Store } from "lucide-react";

/**
 * Single source for app glyphs and icon styling. Previously duplicated in three places
 * (index.tsx `styledAppIds`, its `optionalApps` array, and app-store's own `appGlyphs`).
 * Adding an app means adding one entry here.
 */
export const appGlyphs: Record<string, typeof Store> = {
  settings: Settings,
  "app-store": Store,
  goodle: Search,
  messages: MessageCircle,
  notes: StickyNote,
  noodler: AtSign,
  contacts: BookUser,
  mail: Mail,
  gallery: Images,
  tindler: Flame,
  "noodler-r": Lock,
  camera: Camera,
};

export function appGlyph(appId: string) {
  return appGlyphs[appId] ?? Store;
}

/** Apps with a bespoke icon gradient in the stylesheet; anything else gets the default. */
export function appIconClass(appId: string) {
  return appId in appGlyphs ? `vp-app-icon--${appId}` : "vp-app-icon--default";
}
