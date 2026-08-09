import type { PhoneBaselineTheme } from "./identity";

export type PhonePattern = "none" | "dots" | "grid" | "noise" | "waves";
export type ScreenEffect = "none" | "cracks" | "smudge" | "blood" | "scanlines";

export interface DeviceSettings {
  deviceName: string;
  wallpaper: string;
  /** A user-uploaded background image (data URL). Takes precedence over `wallpaper` when set. */
  wallpaperImage: string;
  wallpaperTint: string;
  caseColor: string;
  screenEffect: ScreenEffect;
  screenEffectIntensity: 0 | 1 | 2 | 3;
  theme: PhoneBaselineTheme;
  pattern: PhonePattern;
  patternIntensity: 0 | 1 | 2 | 3;
  reduceDeviceEffects: boolean;
  /**
   * Status-bar state belongs to the story, not to the host machine: it is a character's phone, and
   * a desktop's real battery means nothing. Set here by the user today; the same two fields are
   * what a model-driven command will write once the agent runtime is enabled (Step 8.4).
   * Deliberately not drifting over session time — a phone dying should be a beat someone chose.
   */
  batteryLevel: number;
  cellularSignal: 0 | 1 | 2 | 3 | 4;
  installedApps: string[];
  /**
   * Lorebooks read on every generation for this phone, whether or not they are active in chat
   * context. The default is the chat's own lorebooks — the ones it has active, plus any bound to
   * the chat or attached to a character or persona in it. That is what "all" used to mean once the
   * scoping was fixed, so the mode is stored as "chat" now and "all" is read as its old name.
   * Scoped per phone so one character's phone can run on one world's rules and another's on a
   * different set — running two stories used to bleed one world's lore into the other's phone.
   */
  lorebookIds: string[];
  lorebookMode: "chat" | "selected" | "none";
  /**
   * Characters may text you unprompted when a thread has gone quiet or you left them on read.
   * Off by default and deliberately so: it is the one feature here that spends tokens without
   * the user asking for anything.
   */
  unpromptedTexts: boolean;
  /**
   * When the phone is put down, one quiet line tells the scene what was done on it. This is what
   * makes the phone part of the roleplay instead of a side panel, so it is on by default — but it
   * writes a visible message into the chat, so it must be switchable off.
   */
  storyNotices: boolean;
  lightConnectionId: string;
  heavyConnectionId: string;
  generationInstructions: string;
  /**
   * Minutes between the host machine's clock and the story's. A phone read at 3am in the scene
   * showing the user's real 14:22 is the loudest continuity break the device has, and it is on
   * every screen at once. Stored as an offset rather than a fixed time so the clock still runs —
   * a frozen phone clock reads as broken, not as fiction.
   *
   * Timestamps stay real ISO in storage; the offset is applied at render, so ordering, unread
   * arithmetic and generation-time comparisons are untouched.
   */
  storyClockOffsetMinutes: number;
}

/** ±1 year. Wide enough for any scene, narrow enough that a bad value can't render Invalid Date. */
const MAX_CLOCK_OFFSET = 366 * 24 * 60;

/** The story's current time, given a phone's offset. */
export function storyNow(offsetMinutes: number, at?: string | number | Date) {
  const base = at === undefined ? Date.now() : new Date(at).getTime();
  return new Date(base + offsetMinutes * 60_000);
}

/** The offset that puts the story clock at `target` (an HH:MM on today's story date) right now. */
export function offsetForStoryTime(target: string, offsetMinutes: number) {
  const [hours, minutes] = target.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return offsetMinutes;
  const current = storyNow(offsetMinutes);
  const wanted = new Date(current);
  wanted.setHours(hours!, minutes!, 0, 0);
  /**
   * Measured from the start of the current minute, not from the current instant. Rounding the raw
   * difference lost up to 30 seconds in the wrong direction, so picking 03:00 could leave the phone
   * reading 02:59 — the one number the user was looking at when they set it.
   */
  const minuteStart = Math.floor(current.getTime() / 60_000) * 60_000;
  return offsetMinutes + (wanted.getTime() - minuteStart) / 60_000;
}

export function defaultDeviceSettings(theme: PhoneBaselineTheme = "dark"): DeviceSettings {
  return {
    deviceName: "",
    wallpaper: "gradient",
    wallpaperImage: "",
    wallpaperTint: "",
    caseColor: "",
    screenEffect: "none",
    screenEffectIntensity: 2,
    theme,
    pattern: "none",
    patternIntensity: 0,
    reduceDeviceEffects: false,
    batteryLevel: 80,
    cellularSignal: 4,
    installedApps: ["settings", "app-store", "goodle", "messages", "notes", "contacts", "gallery", "camera", "pastasafari", "azmoron", "maps", "find"],
    lorebookIds: [],
    lorebookMode: "chat",
    unpromptedTexts: false,
    storyNotices: true,
    lightConnectionId: "",
    heavyConnectionId: "",
    generationInstructions: "",
    storyClockOffsetMinutes: 0,
  };
}

export function normalizeDeviceSettings(value: unknown, theme: PhoneBaselineTheme = "dark"): DeviceSettings {
  const defaults = defaultDeviceSettings(theme);
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const input = value as Record<string, unknown>;
  const pattern = ["none", "dots", "grid", "noise", "waves"].includes(String(input.pattern))
    ? input.pattern as PhonePattern
    : defaults.pattern;
  const intensity = Number(input.patternIntensity);
  return {
    deviceName: typeof input.deviceName === "string" ? input.deviceName.slice(0, 80) : defaults.deviceName,
    wallpaper: typeof input.wallpaper === "string" && input.wallpaper.trim() ? input.wallpaper.slice(0, 1000) : defaults.wallpaper,
    // An uploaded image is a data: URL and can be large; cap at ~4MB so one wallpaper can't bloat the document unboundedly.
    wallpaperImage: typeof input.wallpaperImage === "string" && /^data:image\//u.test(input.wallpaperImage) && input.wallpaperImage.length <= 4_000_000 ? input.wallpaperImage : defaults.wallpaperImage,
    wallpaperTint: typeof input.wallpaperTint === "string" && /^#[0-9a-fA-F]{6}$/u.test(input.wallpaperTint) ? input.wallpaperTint.toLowerCase() : defaults.wallpaperTint,
    caseColor: typeof input.caseColor === "string" && /^#[0-9a-fA-F]{6}$/u.test(input.caseColor) ? input.caseColor.toLowerCase() : defaults.caseColor,
    screenEffect: ["none", "cracks", "smudge", "blood", "scanlines"].includes(String(input.screenEffect)) ? input.screenEffect as ScreenEffect : defaults.screenEffect,
    screenEffectIntensity: [0, 1, 2, 3].includes(Number(input.screenEffectIntensity)) ? Number(input.screenEffectIntensity) as 0 | 1 | 2 | 3 : defaults.screenEffectIntensity,
    theme: input.theme === "light" || input.theme === "dark" || input.theme === "system" ? input.theme : defaults.theme,
    pattern,
    patternIntensity: intensity === 1 || intensity === 2 || intensity === 3 ? intensity : 0,
    reduceDeviceEffects: input.reduceDeviceEffects === true,
    batteryLevel: Number.isFinite(Number(input.batteryLevel))
      ? Math.min(100, Math.max(0, Math.round(Number(input.batteryLevel))))
      : defaults.batteryLevel,
    cellularSignal: [0, 1, 2, 3, 4].includes(Number(input.cellularSignal))
      ? Number(input.cellularSignal) as 0 | 1 | 2 | 3 | 4
      : defaults.cellularSignal,
    installedApps: Array.isArray(input.installedApps)
      ? [...new Set(["settings", "app-store", ...input.installedApps.filter((appId): appId is string => typeof appId === "string" && appId.trim().length > 0)])]
      : defaults.installedApps,
    lorebookIds: Array.isArray(input.lorebookIds)
      ? [...new Set(input.lorebookIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))].slice(0, 50)
      : defaults.lorebookIds,
    // "all" is the old name for "chat": every phone written before the scoping fix carries it.
    lorebookMode: input.lorebookMode === "selected" || input.lorebookMode === "none" ? input.lorebookMode : "chat",
    unpromptedTexts: input.unpromptedTexts === true,
    storyNotices: input.storyNotices !== false,
    lightConnectionId: typeof input.lightConnectionId === "string" ? input.lightConnectionId.slice(0, 100) : defaults.lightConnectionId,
    heavyConnectionId: typeof input.heavyConnectionId === "string" ? input.heavyConnectionId.slice(0, 100) : defaults.heavyConnectionId,
    generationInstructions: typeof input.generationInstructions === "string" ? input.generationInstructions.slice(0, 12000) : defaults.generationInstructions,
    storyClockOffsetMinutes: Number.isFinite(Number(input.storyClockOffsetMinutes))
      ? Math.min(MAX_CLOCK_OFFSET, Math.max(-MAX_CLOCK_OFFSET, Math.round(Number(input.storyClockOffsetMinutes))))
      : defaults.storyClockOffsetMinutes,
  };
}
