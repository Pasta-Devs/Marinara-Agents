import type { PhoneBaselineTheme } from "./identity";

export type PhonePattern = "none" | "dots" | "grid" | "noise" | "waves";
export type ScreenEffect = "none" | "cracks" | "smudge" | "blood" | "scanlines";

export interface DeviceSettings {
  deviceName: string;
  wallpaper: string;
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
   * context. Empty means all of them, which is the old behaviour and the sane "Any" default.
   * Scoped per phone so one character's phone can run on one world's rules and another's on a
   * different set — running two stories used to bleed one world's lore into the other's phone.
   */
  lorebookIds: string[];
  lightConnectionId: string;
  heavyConnectionId: string;
  generationInstructions: string;
}

export function defaultDeviceSettings(theme: PhoneBaselineTheme = "dark"): DeviceSettings {
  return {
    deviceName: "",
    wallpaper: "gradient",
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
    installedApps: ["settings", "app-store", "goodle", "messages", "notes", "contacts", "gallery", "camera"],
    lorebookIds: [],
    lightConnectionId: "",
    heavyConnectionId: "",
    generationInstructions: "",
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
    wallpaper: typeof input.wallpaper === "string" && input.wallpaper.trim() ? input.wallpaper.slice(0, 200) : defaults.wallpaper,
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
    lightConnectionId: typeof input.lightConnectionId === "string" ? input.lightConnectionId.slice(0, 100) : defaults.lightConnectionId,
    heavyConnectionId: typeof input.heavyConnectionId === "string" ? input.heavyConnectionId.slice(0, 100) : defaults.heavyConnectionId,
    generationInstructions: typeof input.generationInstructions === "string" ? input.generationInstructions.slice(0, 2000) : defaults.generationInstructions,
  };
}
