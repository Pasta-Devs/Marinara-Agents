import { AtSign, BookUser, Camera, Flame, Gamepad2, Images, Landmark, Lock, Mail, Map, MessageCircle, Package, Phone, Radar, Search, Settings, ShoppingBag, StickyNote, Store } from "lucide-react";

/**
 * Single source for app glyphs and icon styling. Previously duplicated in three places
 * (index.tsx `styledAppIds`, its `optionalApps` array, and app-store's own `appGlyphs`).
 * Adding an app means adding one entry here.
 */
export const appGlyphs: Record<string, typeof Store> = {
  settings: Settings,
  "app-store": Store,
  calls: Phone,
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
  banking: Landmark,
  bazaar: ShoppingBag,
  game: Gamepad2,
  shop: Package,
  maps: Map,
  find: Radar,
};

export function appGlyph(appId: string) {
  return appGlyphs[appId] ?? Store;
}

/** Apps with a bespoke icon gradient in the stylesheet; anything else gets the default. */
export function appIconClass(appId: string) {
  return appId in appGlyphs ? `vp-app-icon--${appId}` : "vp-app-icon--default";
}
