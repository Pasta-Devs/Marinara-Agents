// ──────────────────────────────────────────────
// Otome Forge: the screens OtomeForgeView routes between, with each one's name (its icon: screen-icons.ts)
// ──────────────────────────────────────────────
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
  | "remind"
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
  "remind",
]);

/**
 * Whether the home cue is the music beneath this screen (OtomeForgeView's audio): inside a run, in the reader too (its
 * scenes hold their own cue once one arrives, so Home's plays on while the first scene loads), and in Settings opened
 * from inside a run.
 */
export function playsHomeCue(screen: ScreenId, settingsReturn: ScreenId): boolean {
  const inRun = (id: ScreenId) => RUN_SCREENS.has(id) || id === "reader";
  return inRun(screen) || (screen === "settings" && inRun(settingsReturn));
}

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
  remind: "ui.otomeForge.common.screenRemind",
  settings: "ui.otomeForge.common.screenSettings",
};
