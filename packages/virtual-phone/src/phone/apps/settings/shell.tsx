import React from "react";
import { RotateCcw, Search } from "lucide-react";
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

interface PhoneAbout {
  ownerName: string;
  ownerType: string;
  deviceName: string;
  chats: number;
  installedApps: number;
  storageBytes: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SettingsShell({ phone, onPhoneChange, onBack, onClose }: SettingsShellProps) {
  const saved = phone.settings ?? defaultDeviceSettings(phone.baselineTheme);
  /**
   * Appearance previews immediately. Every change is a PATCH, so without local state ahead of the
   * round trip the swatch you just picked lags behind your finger.
   */
  const [pending, setPending] = React.useState<Record<string, unknown>>({});
  const settings = { ...saved, ...pending } as typeof saved;
  const [about, setAbout] = React.useState<PhoneAbout | null>(null);
  const [connections, setConnections] = React.useState<EngineConnection[] | null>(null);
  const [lorebooks, setLorebooks] = React.useState<Array<{ id: string; name: string }> | null>(null);
  const [tab, setTab] = React.useState<"device" | "generation" | "about">("device");
  const [loreQuery, setLoreQuery] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const writeQueue = React.useRef<Promise<void>>(Promise.resolve());

  React.useEffect(() => {
    let active = true;
    void phoneRequest<PhoneAbout>(`/phones/${encodeURIComponent(phone.phoneId)}/about`)
      .then((payload) => { if (active) setAbout(payload); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Phone details could not be loaded."); });
    return () => { active = false; };
  }, [phone.phoneId, settings.installedApps.length]);

  React.useEffect(() => {
    let active = true;
    void phoneRequest<{ lorebooks: Array<{ id: string; name: string }> }>("/lorebooks")
      .then((response) => { if (active) setLorebooks(response.lorebooks); })
      .catch((cause: unknown) => { if (active) { setLorebooks([]); setError(cause instanceof Error ? cause.message : "Lorebooks could not be loaded."); } });
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    let active = true;
    void phoneRequest<unknown>("/api/connections")
      .then((list) => {
        if (!active) return;
        setConnections(Array.isArray(list)
          ? list.filter((item): item is EngineConnection => !!item && typeof (item as EngineConnection).id === "string")
          : []);
      })
      .catch((cause: unknown) => { if (active) { setConnections([]); setError(cause instanceof Error ? cause.message : "Connections could not be loaded."); } });
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
  const update = (patch: Record<string, unknown>) => {
    setError(null);
    setPending((current) => ({ ...current, ...patch }));
    const save = writeQueue.current.then(async () => {
      try {
        const response = await phoneRequest<{ phone: Phone }>(`/phones/${encodeURIComponent(phone.phoneId)}/settings`, {
          method: "PATCH", body: JSON.stringify(patch),
        });
        onPhoneChange(response.phone);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The setting could not be saved.");
      }
    }).finally(() => {
      setPending((current) => {
        const next = { ...current };
        for (const [key, value] of Object.entries(patch)) {
          if (next[key] === value) delete next[key];
        }
        return next;
      });
    });
    writeQueue.current = save;
    return save;
  };
  const reset = async () => {
    setError(null);
    try {
      const response = await phoneRequest<{ phone: Phone }>(`/phones/${encodeURIComponent(phone.phoneId)}/settings/reset`, { method: "POST" });
      onPhoneChange(response.phone);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Settings could not be reset.");
    }
  };
  const visibleLorebooks = lorebooks?.filter((lorebook) => lorebook.name.toLocaleLowerCase().includes(loreQuery.trim().toLocaleLowerCase())) ?? [];
  const selectedLorebooks = settings.lorebookIds.length;
  const toggleRow = (label: string, description: string, checked: boolean, patch: Record<string, unknown>) => (
    <label className="vp-setting-toggle">
      <span className="vp-setting-copy"><span>{label}</span><small>{description}</small></span>
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => void update({ ...patch, [Object.keys(patch)[0]!]: event.target.checked })} className="vp-switch" />
    </label>
  );
  return (
    <section aria-labelledby="device-settings-title" className="vp-appview vp-appview--fixed">
      <PhoneAppHeader title="Settings" titleId="device-settings-title" closeLabel="Close settings" onBack={onBack} onClose={onClose} />
      <div className="vp-settings-tabs" aria-label="Settings sections">
        {(["device", "generation", "about"] as const).map((id) => (
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{id === "device" ? "Device" : id === "generation" ? "Generation" : "About"}</button>
        ))}
      </div>
      {error ? <p role="alert" className="vp-settings-alert">{error}</p> : null}
      <div className="vp-settings-scroll">
      {tab === "device" ? <div className="vp-settings-sections">
        <section><h3 className="vp-section-label">Appearance</h3><div className="vp-group">
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
        </div></section>
        <section><h3 className="vp-section-label">Effects</h3><div className="vp-group">
          <label className="vp-row"><span>Pattern</span><select value={settings.pattern} onChange={(event) => void update({ pattern: event.target.value })} className="vp-row-control"><option value="none">None</option><option value="dots">Dots</option><option value="grid">Grid</option><option value="noise">Noise</option><option value="waves">Waves</option></select></label>
          <label className="vp-row vp-row--stacked"><span>Pattern intensity</span><input type="range" min="0" max="3" step="1" value={settings.patternIntensity} onChange={(event) => void update({ patternIntensity: Number(event.target.value) })} className="vp-range" /></label>
          <label className="vp-row"><span>Screen overlay</span><select value={settings.screenEffect} onChange={(event) => void update({ screenEffect: event.target.value })} className="vp-row-control"><option value="none">None</option><option value="cracks">Cracked glass</option><option value="smudge">Smudges</option><option value="blood">Blood</option><option value="scanlines">Scanlines</option></select></label>
          <label className="vp-row vp-row--stacked"><span>Overlay intensity</span><input type="range" min="0" max="3" step="1" value={settings.screenEffectIntensity} onChange={(event) => void update({ screenEffectIntensity: Number(event.target.value) })} className="vp-range" /></label>
          {toggleRow("Reduce effects", "Disables screen damage and decorative motion.", settings.reduceDeviceEffects, { reduceDeviceEffects: settings.reduceDeviceEffects })}
        </div></section>
        <section><h3 className="vp-section-label">Status bar</h3><div className="vp-group">
          <p className="vp-muted-note">This is the character's phone, not yours — set these to fit the story.</p>
          <label className="vp-row vp-row--stacked"><span>Battery ({settings.batteryLevel}%)</span><input type="range" min="0" max="100" step="1" value={settings.batteryLevel} onChange={(event) => void update({ batteryLevel: Number(event.target.value) })} className="vp-range" /></label>
          <label className="vp-row"><span>Signal</span><select value={settings.cellularSignal} onChange={(event) => void update({ cellularSignal: Number(event.target.value) })} className="vp-row-control"><option value="4">Full</option><option value="3">Good</option><option value="2">Fair</option><option value="1">Weak</option><option value="0">No signal</option></select></label>
        </div></section>
      </div> : tab === "generation" ? <div className="vp-settings-sections">
        <section><h3 className="vp-section-label">Models &amp; activity</h3><div className="vp-group">
          <label className="vp-row"><span>Replies</span><select value={settings.lightConnectionId} disabled={!connections} onChange={(event) => void update({ lightConnectionId: event.target.value })} className="vp-row-control">{connectionOptions(settings.lightConnectionId)}</select></label>
          <label className="vp-row"><span>Feeds &amp; sites</span><select value={settings.heavyConnectionId} disabled={!connections} onChange={(event) => void update({ heavyConnectionId: event.target.value })} className="vp-row-control">{connectionOptions(settings.heavyConnectionId)}</select></label>
          {toggleRow("The story notices", "Adds one quiet summary when you put the phone down.", settings.storyNotices, { storyNotices: settings.storyNotices })}
          {toggleRow("Characters text first", "Allows occasional background replies and uses tokens.", settings.unpromptedTexts, { unpromptedTexts: settings.unpromptedTexts })}
        </div></section>
        <section className="vp-lore-section"><div className="vp-settings-heading"><h3 className="vp-section-label">Lorebooks</h3><span>{settings.lorebookMode === "all" ? "All" : settings.lorebookMode === "none" ? "Off" : `${selectedLorebooks} selected`}</span></div>
          <div className="vp-group vp-lore-picker">
            <div className="vp-segmented" aria-label="Lorebook scope">
              {(["all", "selected", "none"] as const).map((mode) => <button key={mode} type="button" aria-pressed={settings.lorebookMode === mode} onClick={() => void update({ lorebookMode: mode })}>{mode === "all" ? "All" : mode === "selected" ? "Selected" : "None"}</button>)}
            </div>
            {settings.lorebookMode === "selected" ? <>
              <label className="vp-lore-search"><span className="vp-sr-only">Search lorebooks</span><Search size="0.875rem" aria-hidden="true" /><input type="search" value={loreQuery} onChange={(event) => setLoreQuery(event.target.value)} placeholder="Search lorebooks" /></label>
              <div className="vp-lore-list" aria-label="Available lorebooks">
                {lorebooks === null ? <p className="vp-muted-note">Loading lorebooks...</p> : null}
                {lorebooks?.length === 0 ? <p className="vp-muted-note">No lorebooks available.</p> : null}
                {lorebooks && visibleLorebooks.length === 0 && lorebooks.length > 0 ? <p className="vp-muted-note">No matches.</p> : null}
                {visibleLorebooks.map((lorebook) => <label key={lorebook.id} className="vp-lore-option"><span>{lorebook.name}</span><input type="checkbox" checked={settings.lorebookIds.includes(lorebook.id)} onChange={(event) => void update({ lorebookIds: event.target.checked ? [...new Set([...settings.lorebookIds, lorebook.id])] : settings.lorebookIds.filter((id) => id !== lorebook.id) })} /></label>)}
              </div>
            </> : <p className="vp-lore-summary">{settings.lorebookMode === "all" ? "Every available lorebook can ground this phone." : "Lorebooks are excluded from phone generation."}</p>}
          </div>
        </section>
        <section><h3 className="vp-section-label">Instructions</h3><div className="vp-group"><label className="vp-row vp-row--stacked"><span>Custom instructions</span>
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
        </div></section>
      </div> : <div className="vp-settings-sections">
        <section><h3 className="vp-section-label">This phone</h3><div className="vp-group">
          <div className="vp-row"><span>Owner</span><span className="vp-muted-note">{about ? `${about.ownerName} (${about.ownerType})` : "…"}</span></div>
          <div className="vp-row"><span>Device name</span><span className="vp-muted-note">{about?.deviceName || "Not set"}</span></div>
          <div className="vp-row"><span>Chats</span><span className="vp-muted-note">{about ? about.chats : "…"}</span></div>
          <div className="vp-row"><span>Installed apps</span><span className="vp-muted-note">{about ? about.installedApps : "…"}</span></div>
          <div className="vp-row"><span>Storage used</span><span className="vp-muted-note">{about ? formatBytes(about.storageBytes) : "…"}</span></div>
        </div></section>
        <section><div className="vp-group">
          <button type="button" onClick={() => { if (window.confirm("Reset this phone's device settings?")) void reset(); }} className="vp-row vp-row--danger"><RotateCcw size="0.875rem" aria-hidden="true" /> Reset device settings</button>
        </div></section>
      </div>}
      </div>
    </section>
  );
}
