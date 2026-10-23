import type { SlurpLiveScheduleSettings } from "../live/slp-live.js";

export function slurpLiveSettingsValid(
  settings: Pick<SlurpLiveScheduleSettings, "liveStartHour" | "liveEndHour" | "liveMinMinutes" | "liveMaxMinutes">,
): boolean {
  return settings.liveStartHour < settings.liveEndHour && settings.liveMinMinutes <= settings.liveMaxMinutes;
}

export function normalizeSlurpLiveSettings<T extends SlurpLiveScheduleSettings>(settings: T, defaults: T): T {
  return {
    ...settings,
    ...(settings.liveStartHour >= settings.liveEndHour && {
      liveStartHour: defaults.liveStartHour,
      liveEndHour: defaults.liveEndHour,
    }),
    ...(settings.liveMinMinutes > settings.liveMaxMinutes && {
      liveMinMinutes: defaults.liveMinMinutes,
      liveMaxMinutes: defaults.liveMaxMinutes,
    }),
  };
}
