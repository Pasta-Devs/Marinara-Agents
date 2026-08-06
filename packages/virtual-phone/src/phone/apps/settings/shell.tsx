import React from "react";
import { RotateCcw } from "lucide-react";
import type { Phone } from "../../system/PhonesSettings";
import { phoneRequest } from "../../platform/api";
import { defaultDeviceSettings } from "../../device/settings";
import { PhoneAppHeader } from "../../platform/app-header";

interface SettingsShellProps {
  phone: Phone;
  onPhoneChange: (phone: Phone) => void;
  onBack: () => void;
  onClose: () => void;
}

export function SettingsShell({ phone, onPhoneChange, onBack, onClose }: SettingsShellProps) {
  const settings = phone.settings ?? defaultDeviceSettings(phone.baselineTheme);
  const update = async (patch: Record<string, unknown>) => {
    const response = await phoneRequest<{ phone: Phone }>(`/phones/${encodeURIComponent(phone.phoneId)}/settings`, {
      method: "PATCH", body: JSON.stringify(patch),
    });
    onPhoneChange(response.phone);
  };
  const reset = async () => {
    const response = await phoneRequest<{ phone: Phone }>(`/phones/${encodeURIComponent(phone.phoneId)}/settings/reset`, { method: "POST" });
    onPhoneChange(response.phone);
  };
  return (
    <section aria-labelledby="device-settings-title" className="vp-appview">
      <PhoneAppHeader title="Settings" titleId="device-settings-title" closeLabel="Close settings" onBack={onBack} onClose={onClose} />
      <div className="vp-stack">
        <h3 className="vp-section-label">Device</h3>
        <label className="vp-field"><span>Device name</span><input key={`${phone.phoneId}:${settings.deviceName}`} defaultValue={settings.deviceName} onBlur={(event) => void update({ deviceName: event.target.value })} className="vp-input" /></label>
        <label className="vp-field"><span>Theme</span><select value={settings.theme} onChange={(event) => void update({ theme: event.target.value })} className="vp-select"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
        <label className="vp-field"><span>Wallpaper</span><select value={settings.wallpaper} onChange={(event) => void update({ wallpaper: event.target.value })} className="vp-select"><option value="gradient">Gradient</option><option value="midnight">Midnight</option><option value="paper">Paper</option></select></label>
        <h3 className="vp-section-label vp-section-label--spaced">Effects</h3>
        <label className="vp-field"><span>Pattern</span><select value={settings.pattern} onChange={(event) => void update({ pattern: event.target.value })} className="vp-select"><option value="none">None</option><option value="dots">Dots</option><option value="grid">Grid</option><option value="noise">Noise</option><option value="waves">Waves</option></select></label>
        <label className="vp-field"><span>Pattern intensity</span><input type="range" min="0" max="3" step="1" value={settings.patternIntensity} onChange={(event) => void update({ patternIntensity: Number(event.target.value) })} className="vp-range" /></label>
        <label className="vp-check"><input type="checkbox" checked={settings.reduceDeviceEffects} onChange={(event) => void update({ reduceDeviceEffects: event.target.checked })} /><span>Reduce device effects</span></label>
        <h3 className="vp-section-label vp-section-label--spaced">Reset</h3>
        <button type="button" onClick={() => { if (window.confirm("Reset this phone's device settings?")) void reset(); }} className="vp-surface-btn"><RotateCcw size="0.875rem" aria-hidden="true" /> Reset device settings</button>
      </div>
    </section>
  );
}
