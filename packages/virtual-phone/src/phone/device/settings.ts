import type { PhoneBaselineTheme } from "./identity";

export type PhonePattern = "none" | "dots" | "grid" | "noise" | "waves";

export interface DeviceSettings {
  deviceName: string;
  wallpaper: string;
  theme: PhoneBaselineTheme;
  pattern: PhonePattern;
  patternIntensity: 0 | 1 | 2 | 3;
  reduceDeviceEffects: boolean;
  installedApps: string[];
}

export function defaultDeviceSettings(theme: PhoneBaselineTheme = "system"): DeviceSettings {
  return {
    deviceName: "",
    wallpaper: "gradient",
    theme,
    pattern: "none",
    patternIntensity: 0,
    reduceDeviceEffects: false,
    installedApps: ["settings", "app-store", "goodle", "messages", "notes"],
  };
}

export function normalizeDeviceSettings(value: unknown, theme: PhoneBaselineTheme = "system"): DeviceSettings {
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
    theme: input.theme === "light" || input.theme === "dark" || input.theme === "system" ? input.theme : defaults.theme,
    pattern,
    patternIntensity: intensity === 1 || intensity === 2 || intensity === 3 ? intensity : 0,
    reduceDeviceEffects: input.reduceDeviceEffects === true,
    installedApps: Array.isArray(input.installedApps)
      ? [...new Set(["settings", "app-store", ...input.installedApps.filter((appId): appId is string => typeof appId === "string" && appId.trim().length > 0)])]
      : defaults.installedApps,
  };
}
