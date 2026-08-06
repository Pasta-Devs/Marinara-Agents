export type DeviceSurface = "lock" | "home";

export interface DeviceSessionState {
  surface: DeviceSurface;
  selectedPhoneId: string;
}

export function initialDeviceSession(selectedPhoneId = ""): DeviceSessionState {
  return { surface: "lock", selectedPhoneId };
}

export function unlockDevice(state: DeviceSessionState): DeviceSessionState {
  return { ...state, surface: "home" };
}
