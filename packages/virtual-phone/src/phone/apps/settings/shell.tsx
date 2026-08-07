import React from "react";
import { RotateCcw } from "lucide-react";
import type { Phone } from "../../system/PhonesSettings";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { defaultDeviceSettings } from "../../device/settings";

interface SettingsShellProps {
  phone: Phone;
  onPhoneChange: (phone: Phone) => void;
  onBack: () => void;
  onClose: () => void;
}

interface EngineConnection {
  id: string;
  name?: string | null;
  provider?: string | null;
  model?: string | null;
}

function connectionLabel(connection: EngineConnection) {
  const name = connection.name?.trim();
  if (name) return name;
  return [connection.provider, connection.model].filter(Boolean).join(" · ") || connection.id;
}

export function SettingsShell({ phone, onPhoneChange, onBack, onClose }: SettingsShellProps) {
  const settings = phone.settings ?? defaultDeviceSettings(phone.baselineTheme);
  const [connections, setConnections] = React.useState<EngineConnection[] | null>(null);
  const [lorebooks, setLorebooks] = React.useState<Array<{ id: string; name: string }> | null>(null);

  React.useEffect(() => {
    let active = true;
    void phoneRequest<{ lorebooks: Array<{ id: string; name: string }> }>("/lorebooks")
      .then((response) => { if (active) setLorebooks(response.lorebooks); })
      .catch(() => { if (active) setLorebooks([]); });
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    let active = true;
    void fetch("/api/connections", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<unknown> : [])
      .then((list) => {
        if (!active) return;
        setConnections(Array.isArray(list)
          ? list.filter((item): item is EngineConnection => !!item && typeof (item as EngineConnection).id === "string")
          : []);
      })
      .catch(() => { if (active) setConnections([]); });
    return () => { active = false; };
  }, []);

  const connectionOptions = (selected: string) => (
    <>
      <option value="">Agent default</option>
      {connections?.map((connection) => <option key={connection.id} value={connection.id}>{connectionLabel(connection)}</option>)}
      {selected && !connections?.some((connection) => connection.id === selected)
        ? <option value={selected}>Saved connection (unavailable)</option>
        : null}
    </>
  );
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
        <div className="vp-group">
          <label className="vp-row"><span>Device name</span><input key={`${phone.phoneId}:${settings.deviceName}`} defaultValue={settings.deviceName} placeholder={`${phone.ownerName}'s phone`} onBlur={(event) => void update({ deviceName: event.target.value })} className="vp-row-control" /></label>
          <label className="vp-row"><span>Theme</span><select value={settings.theme} onChange={(event) => void update({ theme: event.target.value })} className="vp-row-control"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <label className="vp-row"><span>Wallpaper</span><select value={settings.wallpaper} onChange={(event) => void update({ wallpaper: event.target.value })} className="vp-row-control"><option value="gradient">Gradient</option><option value="midnight">Midnight</option><option value="paper">Paper</option></select></label>
          <div className="vp-row"><span>Wallpaper tint</span><span className="vp-color-row">
            <input type="color" aria-label="Wallpaper tint color" value={settings.wallpaperTint || "#3a6ea5"} onChange={(event) => void update({ wallpaperTint: event.target.value })} className="vp-color-input" />
            {settings.wallpaperTint ? <button type="button" onClick={() => void update({ wallpaperTint: "" })} className="vp-accent-btn" style={{ minHeight: "1.875rem" }}>Clear</button> : <span className="vp-muted-note">None</span>}
          </span></div>
          <div className="vp-row"><span>Case color</span><span className="vp-color-row">
            <input type="color" aria-label="Case color" value={settings.caseColor || "#101216"} onChange={(event) => void update({ caseColor: event.target.value })} className="vp-color-input" />
            {settings.caseColor ? <button type="button" onClick={() => void update({ caseColor: "" })} className="vp-accent-btn" style={{ minHeight: "1.875rem" }}>Clear</button> : <span className="vp-muted-note">Default</span>}
          </span></div>
        </div>
        <h3 className="vp-section-label">Effects</h3>
        <div className="vp-group">
          <label className="vp-row"><span>Pattern</span><select value={settings.pattern} onChange={(event) => void update({ pattern: event.target.value })} className="vp-row-control"><option value="none">None</option><option value="dots">Dots</option><option value="grid">Grid</option><option value="noise">Noise</option><option value="waves">Waves</option></select></label>
          <label className="vp-row vp-row--stacked"><span>Pattern intensity</span><input type="range" min="0" max="3" step="1" value={settings.patternIntensity} onChange={(event) => void update({ patternIntensity: Number(event.target.value) })} className="vp-range" /></label>
          <label className="vp-row"><span>Screen overlay</span><select value={settings.screenEffect} onChange={(event) => void update({ screenEffect: event.target.value })} className="vp-row-control"><option value="none">None</option><option value="cracks">Cracked glass</option><option value="smudge">Smudges</option><option value="blood">Blood</option><option value="scanlines">Scanlines</option></select></label>
          <label className="vp-row vp-row--stacked"><span>Overlay intensity</span><input type="range" min="0" max="3" step="1" value={settings.screenEffectIntensity} onChange={(event) => void update({ screenEffectIntensity: Number(event.target.value) })} className="vp-range" /></label>
          <label className="vp-row"><span>Reduce device effects</span><input type="checkbox" checked={settings.reduceDeviceEffects} onChange={(event) => void update({ reduceDeviceEffects: event.target.checked })} className="vp-switch" /></label>
        </div>
        <h3 className="vp-section-label">Status bar</h3>
        <div className="vp-group">
          <p className="vp-muted-note">This is the character's phone, not yours — set these to fit the story.</p>
          <label className="vp-row vp-row--stacked"><span>Battery ({settings.batteryLevel}%)</span><input type="range" min="0" max="100" step="1" value={settings.batteryLevel} onChange={(event) => void update({ batteryLevel: Number(event.target.value) })} className="vp-range" /></label>
          <label className="vp-row"><span>Signal</span><select value={settings.cellularSignal} onChange={(event) => void update({ cellularSignal: Number(event.target.value) })} className="vp-row-control"><option value="4">Full</option><option value="3">Good</option><option value="2">Fair</option><option value="1">Weak</option><option value="0">No signal</option></select></label>
        </div>
        <h3 className="vp-section-label">Generation</h3>
        <div className="vp-group">
          <label className="vp-row"><span>Replies</span><select value={settings.lightConnectionId} disabled={!connections} onChange={(event) => void update({ lightConnectionId: event.target.value })} className="vp-row-control">{connectionOptions(settings.lightConnectionId)}</select></label>
          <label className="vp-row"><span>Feeds &amp; sites</span><select value={settings.heavyConnectionId} disabled={!connections} onChange={(event) => void update({ heavyConnectionId: event.target.value })} className="vp-row-control">{connectionOptions(settings.heavyConnectionId)}</select></label>
          <div className="vp-row vp-row--stacked">
            <span>Lorebooks</span>
            <p className="vp-muted-note">Read on every generation from this phone, whether or not they are active in the chat. None selected means all of them.</p>
            {lorebooks === null ? <p className="vp-muted-note">Loading lorebooks…</p> : null}
            {lorebooks?.length === 0 ? <p className="vp-muted-note">No lorebooks available.</p> : null}
            {lorebooks?.map((lorebook) => (
              <label key={lorebook.id} className="vp-row">
                <span>{lorebook.name}</span>
                <input
                  type="checkbox"
                  checked={settings.lorebookIds.includes(lorebook.id)}
                  onChange={(event) => void update({
                    lorebookIds: event.target.checked
                      ? [...settings.lorebookIds, lorebook.id]
                      : settings.lorebookIds.filter((id) => id !== lorebook.id),
                  })}
                  className="vp-switch"
                />
              </label>
            ))}
          </div>
          <label className="vp-row vp-row--stacked"><span>Custom instructions</span>
            <textarea
              key={`${phone.phoneId}:instructions`}
              defaultValue={settings.generationInstructions}
              onBlur={(event) => void update({ generationInstructions: event.target.value })}
              placeholder="Extra style or tone instructions added to everything this phone generates"
              maxLength={2000}
              className="vp-textarea"
              style={{ minHeight: "5.5rem", width: "100%" }}
            />
          </label>
        </div>
        <p className="vp-muted-note" style={{ padding: "0 1rem" }}>Replies covers character texts in Messages. Feeds &amp; sites covers Goodle, Noodle, NoodleR, Mail, and Tindler.</p>
        <div className="vp-group">
          <button type="button" onClick={() => { if (window.confirm("Reset this phone's device settings?")) void reset(); }} className="vp-row vp-row--danger"><RotateCcw size="0.875rem" aria-hidden="true" /> Reset device settings</button>
        </div>
      </div>
    </section>
  );
}
