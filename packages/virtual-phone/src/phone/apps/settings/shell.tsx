import React from "react";
import { RotateCcw } from "lucide-react";
import type { Phone } from "../../system/PhonesSettings";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";

interface SettingsShellProps {
  phone: Phone;
  onPhoneChange: (phone: Phone) => void;
  onBack: () => void;
  onClose: () => void;
}

export function SettingsShell({ phone, onPhoneChange, onClose }: SettingsShellProps) {
  const settings = phone.settings ?? {
    deviceName: "", wallpaper: "gradient", theme: phone.baselineTheme,
    pattern: "none" as const, patternIntensity: 0 as const, reduceDeviceEffects: false,
    installedApps: ["settings", "app-store", "goodle"],
  };
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
    <section aria-labelledby="device-settings-title" className="absolute inset-0 z-10 overflow-y-auto bg-[var(--vp-bg)] p-5">
      <PhoneAppHeader title="Settings" titleId="device-settings-title" closeLabel="Close settings" onBack={onBack} onClose={onClose} />
      <div className="space-y-4 text-xs">
        <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--vp-muted)]">Device</h3>
        <label className="block space-y-1.5"><span className="font-medium">Device name</span><input key={`${phone.phoneId}:${settings.deviceName}`} defaultValue={settings.deviceName} onBlur={(event) => void update({ deviceName: event.target.value })} className="min-h-11 w-full rounded-lg border border-black/10 bg-[var(--vp-surface)] px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]" /></label>
        <label className="block space-y-1.5"><span className="font-medium">Theme</span><select value={settings.theme} onChange={(event) => void update({ theme: event.target.value })} className="min-h-11 w-full rounded-lg border border-black/10 bg-[var(--vp-surface)] px-3"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
        <label className="block space-y-1.5"><span className="font-medium">Wallpaper</span><select value={settings.wallpaper} onChange={(event) => void update({ wallpaper: event.target.value })} className="min-h-11 w-full rounded-lg border border-black/10 bg-[var(--vp-surface)] px-3"><option value="gradient">Gradient</option><option value="midnight">Midnight</option><option value="paper">Paper</option></select></label>
        <h3 className="pt-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--vp-muted)]">Effects</h3>
        <label className="block space-y-1.5"><span className="font-medium">Pattern</span><select value={settings.pattern} onChange={(event) => void update({ pattern: event.target.value })} className="min-h-11 w-full rounded-lg border border-black/10 bg-[var(--vp-surface)] px-3"><option value="none">None</option><option value="dots">Dots</option><option value="grid">Grid</option><option value="noise">Noise</option><option value="waves">Waves</option></select></label>
        <label className="block space-y-1.5"><span className="font-medium">Pattern intensity</span><input type="range" min="0" max="3" step="1" value={settings.patternIntensity} onChange={(event) => void update({ patternIntensity: Number(event.target.value) })} className="min-h-11 w-full accent-[var(--vp-accent)]" /></label>
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={settings.reduceDeviceEffects} onChange={(event) => void update({ reduceDeviceEffects: event.target.checked })} className="h-5 w-5 accent-[var(--vp-accent)]" /><span className="font-medium">Reduce device effects</span></label>
        <h3 className="pt-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--vp-muted)]">Reset</h3>
        <button type="button" onClick={() => { if (window.confirm("Reset this phone's device settings?")) void reset(); }} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-black/10 bg-[var(--vp-surface)] px-4 font-semibold"><RotateCcw size="0.875rem" aria-hidden="true" /> Reset device settings</button>
      </div>
    </section>
  );
}
