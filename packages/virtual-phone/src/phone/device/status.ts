export interface PhoneStatus {
  cellularSignal: 0 | 1 | 2 | 3 | 4;
  wifi: boolean;
  airplaneMode: boolean;
  batteryLevel: number;
  charging: boolean;
  online: boolean;
}

export function defaultPhoneStatus(): PhoneStatus {
  return {
    cellularSignal: 4,
    wifi: false,
    airplaneMode: false,
    batteryLevel: 80,
    charging: false,
    online: true,
  };
}
