import React from "react";
import { BookOpen, ChevronRight, Grid2X2, Info, LockKeyhole, Palette, RotateCcw, Search } from "lucide-react";
import type { Phone } from "../../system/PhonesSettings";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { defaultDeviceSettings, offsetForStoryTime, storyNow } from "../../device/settings";
import { WallpaperCropper } from "./wallpaper-cropper";

type LorebookScope = "active" | "chat" | "character" | "persona" | "global" | null;

interface LorebookOption {
  id: string;
  name: string;
  scope: LorebookScope;
}

/** Why a lorebook is in this chat, said plainly enough to choose by. */
const SCOPE_LABELS: Record<Exclude<LorebookScope, null>, string> = {
  active: "Active in this chat",
  chat: "Bound to this chat",
  character: "On a character here",
  persona: "On your persona",
  global: "Global",
};

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
  // The <input type="time"> shows where the story clock stands right now, not a stored wall time.
  const storyClockValue = storyNow(settings.storyClockOffsetMinutes).toTimeString().slice(0, 5);
  const [about, setAbout] = React.useState<PhoneAbout | null>(null);
  const [connections, setConnections] = React.useState<EngineConnection[] | null>(null);
  const [lorebooks, setLorebooks] = React.useState<LorebookOption[] | null>(null);
  const [showOtherLorebooks, setShowOtherLorebooks] = React.useState(false);
  const [tab, setTab] = React.useState<"overview" | "appearance" | "home" | "scene" | "ai" | "about">("overview");
  const [loreQuery, setLoreQuery] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [cropSrc, setCropSrc] = React.useState<string | null>(null);
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
    // Scoped to this phone's chat, so the list leads with the lore this story actually uses.
    void phoneRequest<{ lorebooks: LorebookOption[]; others: LorebookOption[] }>(
      `/lorebooks?phoneId=${encodeURIComponent(phone.phoneId)}`,
    )
      .then((response) => { if (active) setLorebooks([...response.lorebooks, ...response.others]); })
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
  const otherLorebooks = visibleLorebooks.filter((lorebook) => lorebook.scope === null);
  const chatLorebooks = lorebooks?.filter((lorebook) => lorebook.scope !== null) ?? [];
  const selectedLorebooks = settings.lorebookIds.length;
  const sectionTitle = tab === "appearance" ? "Appearance" : tab === "home" ? "Home Screen" : tab === "scene" ? "Phone State" : tab === "ai" ? "Roleplay & AI" : tab === "about" ? "About" : "Settings";
  const toggleRow = (label: string, description: string, checked: boolean, patch: Record<string, unknown>) => (
    <label className="vp-setting-toggle">
      <span className="vp-setting-copy"><span>{label}</span><small>{description}</small></span>
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => void update({ ...patch, [Object.keys(patch)[0]!]: event.target.checked })} className="vp-switch" />
    </label>
  );
  return (
    <section aria-labelledby="device-settings-title" className="vp-appview vp-appview--fixed" data-phone-app="settings">
      <PhoneAppHeader title={sectionTitle} titleId="device-settings-title" closeLabel="Close settings" onBack={() => tab === "overview" ? onBack() : setTab("overview")} onClose={onClose} />
      {error ? <p role="alert" className="vp-settings-alert">{error}</p> : null}
      <div className="vp-settings-scroll">
      {tab === "overview" ? <div className="vp-settings-sections">
        <section><h3 className="vp-section-label">Phone</h3><div className="vp-settings-menu">
          <button type="button" onClick={() => setTab("appearance")}><span className="vp-settings-menu-icon is-blue"><Palette size="1rem" aria-hidden="true" /></span><span><strong>Appearance</strong><small>Theme, wallpaper and screen effects</small></span><ChevronRight size="0.9rem" aria-hidden="true" /></button>
          <button type="button" onClick={() => setTab("home")}><span className="vp-settings-menu-icon is-teal"><Grid2X2 size="1rem" aria-hidden="true" /></span><span><strong>Home Screen</strong><small>Choose apps for the dock</small></span><ChevronRight size="0.9rem" aria-hidden="true" /></button>
          <button type="button" onClick={() => setTab("scene")}><span className="vp-settings-menu-icon is-orange"><LockKeyhole size="1rem" aria-hidden="true" /></span><span><strong>Phone State</strong><small>Power, access, signal and scene time</small></span><ChevronRight size="0.9rem" aria-hidden="true" /></button>
        </div></section>
        <section><h3 className="vp-section-label">Roleplay</h3><div className="vp-settings-menu">
          <button type="button" onClick={() => setTab("ai")}><span className="vp-settings-menu-icon is-purple"><BookOpen size="1rem" aria-hidden="true" /></span><span><strong>Roleplay &amp; AI</strong><small>Story activity, generation and lore</small></span><ChevronRight size="0.9rem" aria-hidden="true" /></button>
        </div></section>
        <section><h3 className="vp-section-label">General</h3><div className="vp-settings-menu">
          <button type="button" onClick={() => setTab("about")}><span className="vp-settings-menu-icon is-gray"><Info size="1rem" aria-hidden="true" /></span><span><strong>About</strong><small>Phone details, storage and reset</small></span><ChevronRight size="0.9rem" aria-hidden="true" /></button>
        </div></section>
      </div> : tab === "appearance" ? <div className="vp-settings-sections">
        <section><h3 className="vp-section-label">Appearance</h3><div className="vp-group">
          <label className="vp-row"><span>Device name</span><input key={`${phone.phoneId}:${settings.deviceName}`} defaultValue={settings.deviceName} placeholder={`${phone.ownerName}'s phone`} onBlur={(event) => void update({ deviceName: event.target.value })} className="vp-row-control" /></label>
          <label className="vp-row"><span>Theme</span><select value={settings.theme} onChange={(event) => void update({ theme: event.target.value })} className="vp-row-control"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <label className="vp-row"><span>Wallpaper</span><select value={settings.wallpaper} onChange={(event) => void update({ wallpaper: event.target.value })} className="vp-row-control"><option value="gradient">Gradient</option><option value="midnight">Midnight</option><option value="paper">Paper</option></select></label>
          <div className="vp-row"><span>Background image</span><span className="vp-color-row">
            <label className="vp-accent-btn" style={{ minHeight: "1.875rem", cursor: "pointer" }}>
              {settings.wallpaperImage ? "Replace" : "Upload"}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                if (file.size > 8_000_000) { setError("Pick an image under 8 MB."); return; }
                const reader = new FileReader();
                reader.onload = () => { const result = reader.result; if (typeof result === "string") setCropSrc(result); };
                reader.onerror = () => setError("That image could not be read.");
                reader.readAsDataURL(file);
              }} />
            </label>
            {settings.wallpaperImage ? <button type="button" onClick={() => void update({ wallpaperImage: "" })} className="vp-accent-btn" style={{ minHeight: "1.875rem" }}>Clear</button> : <span className="vp-muted-note">None</span>}
          </span></div>
          {cropSrc ? <WallpaperCropper src={cropSrc} onCancel={() => setCropSrc(null)} onDone={(dataUrl) => { setCropSrc(null); void update({ wallpaperImage: dataUrl }); }} /> : null}
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
      </div> : tab === "home" ? <div className="vp-settings-sections">
        <section><h3 className="vp-section-label">Dock</h3><div className="vp-group">
          {[0, 1, 2, 3].map((slot) => <label key={slot} className="vp-row"><span>Position {slot + 1}</span><select value={settings.dockApps[slot] ?? ""} onChange={(event) => { const next = [...settings.dockApps]; if (event.target.value) next[slot] = event.target.value; else next.splice(slot, 1); void update({ dockApps: [...new Set(next)].slice(0, 4) }); }} className="vp-row-control"><option value="">Empty</option>{settings.installedApps.filter((id) => id !== "settings").map((id) => <option key={id} value={id}>{id.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")}</option>)}</select></label>)}
        </div><p className="vp-settings-footnote">These apps stay at the bottom of the Home Screen. Settings always remains in the app grid.</p></section>
      </div> : tab === "scene" ? <div className="vp-settings-sections">
        <section><h3 className="vp-section-label">Device</h3><div className="vp-group">
          <label className="vp-row"><span>Power</span><select value={settings.power} onChange={(event) => void update({ power: event.target.value })} className="vp-row-control"><option value="on">On</option><option value="off">Off</option></select></label>
          <label className="vp-row"><span>Connection</span><select value={settings.connectivity} onChange={(event) => void update({ connectivity: event.target.value })} className="vp-row-control"><option value="online">Online</option><option value="limited">Limited</option><option value="offline">Offline</option></select></label>
          <label className="vp-row"><span>Ringer</span><select value={settings.ringer} onChange={(event) => void update({ ringer: event.target.value })} className="vp-row-control"><option value="sound">Sound</option><option value="vibrate">Vibrate</option><option value="silent">Silent</option></select></label>
          <label className="vp-row vp-row--stacked"><span>Battery · {settings.batteryLevel}%</span><input type="range" min="0" max="100" step="1" value={settings.batteryLevel} onChange={(event) => void update({ batteryLevel: Number(event.target.value) })} className="vp-range" /></label>
          <label className="vp-row"><span>Cellular signal</span><select value={settings.cellularSignal} onChange={(event) => void update({ cellularSignal: Number(event.target.value) })} className="vp-row-control"><option value="4">Full</option><option value="3">Good</option><option value="2">Fair</option><option value="1">Weak</option><option value="0">None</option></select></label>
        </div></section>
        <section><h3 className="vp-section-label">In the scene</h3><div className="vp-group">
          <label className="vp-row"><span>Where is the phone?</span><select value={settings.availability} onChange={(event) => void update({ availability: event.target.value })} className="vp-row-control"><option value="carried">With its owner</option><option value="nearby">Nearby</option><option value="absent">Elsewhere</option><option value="lost">Lost</option></select></label>
          <label className="vp-row"><span>Access</span><select value={settings.access} onChange={(event) => void update({ access: event.target.value })} className="vp-row-control"><option value="unlocked">Unlocked</option><option value="owner-locked">Owner only</option><option value="story-locked">Locked by story</option></select></label>
          <label className="vp-row"><span>Phone time</span><input type="time" value={storyClockValue} onChange={(event) => { if (event.target.value) void update({ storyClockOffsetMinutes: offsetForStoryTime(event.target.value, settings.storyClockOffsetMinutes) }); }} className="vp-row-control" /></label>
          <button type="button" className="vp-row vp-row--action" disabled={settings.storyClockOffsetMinutes === 0} onClick={() => void update({ storyClockOffsetMinutes: 0 })}><span>Match real time</span></button>
        </div><p className="vp-settings-footnote">These are scene facts about the handset, not actions performed by its owner.</p></section>
      </div> : tab === "ai" ? <div className="vp-settings-sections">
        <section><h3 className="vp-section-label">Story behavior</h3><div className="vp-group">
          <label className="vp-row"><span>Replies</span><select value={settings.lightConnectionId} disabled={!connections} onChange={(event) => void update({ lightConnectionId: event.target.value })} className="vp-row-control">{connectionOptions(settings.lightConnectionId)}</select></label>
          <label className="vp-row"><span>Rich content</span><select value={settings.heavyConnectionId} disabled={!connections} onChange={(event) => void update({ heavyConnectionId: event.target.value })} className="vp-row-control">{connectionOptions(settings.heavyConnectionId)}</select></label>
          {toggleRow("Share phone activity", "Adds significant phone actions to the story.", settings.storyNotices, { storyNotices: settings.storyNotices })}
          {toggleRow("Spontaneous messages", "Characters can text without being prompted.", settings.unpromptedTexts, { unpromptedTexts: settings.unpromptedTexts })}
        </div></section>
        <section className="vp-lore-section"><div className="vp-settings-heading"><h3 className="vp-section-label">Lorebooks</h3><span>{settings.lorebookMode === "chat" ? "This chat" : settings.lorebookMode === "none" ? "Off" : `${selectedLorebooks} chosen`}</span></div>
          <div className="vp-group vp-lore-picker">
            <div className="vp-segmented" aria-label="Lorebook scope">
              {(["chat", "selected", "none"] as const).map((mode) => (
                <button key={mode} type="button" aria-pressed={settings.lorebookMode === mode} onClick={() => void update({ lorebookMode: mode })}>
                  {mode === "chat" ? "This chat" : mode === "selected" ? "Chosen" : "Off"}
                </button>
              ))}
            </div>
            {settings.lorebookMode === "selected" ? <>
              <label className="vp-lore-search"><span className="vp-sr-only">Search lorebooks</span><Search size="0.875rem" aria-hidden="true" /><input type="search" value={loreQuery} onChange={(event) => setLoreQuery(event.target.value)} placeholder="Search lorebooks" /></label>
              <div className="vp-lore-list" aria-label="Available lorebooks">
                {lorebooks === null ? <p className="vp-muted-note">Loading lorebooks...</p> : null}
                {lorebooks?.length === 0 ? <p className="vp-muted-note">No lorebooks available.</p> : null}
                {lorebooks && visibleLorebooks.length === 0 && lorebooks.length > 0 ? <p className="vp-muted-note">No matches.</p> : null}
                {visibleLorebooks.filter((lorebook) => lorebook.scope !== null).map((lorebook) => (
                  <label key={lorebook.id} className="vp-lore-option">
                    <span>{lorebook.name}<small>{SCOPE_LABELS[lorebook.scope!]}</small></span>
                    <input type="checkbox" checked={settings.lorebookIds.includes(lorebook.id)} onChange={(event) => void update({ lorebookIds: event.target.checked ? [...new Set([...settings.lorebookIds, lorebook.id])] : settings.lorebookIds.filter((id) => id !== lorebook.id) })} />
                  </label>
                ))}
                {otherLorebooks.length ? (
                  <button type="button" className="vp-lore-more" onClick={() => setShowOtherLorebooks((current) => !current)} aria-expanded={showOtherLorebooks}>
                    {showOtherLorebooks ? "Hide" : `Show ${otherLorebooks.length} lorebook${otherLorebooks.length === 1 ? "" : "s"} from other stories`}
                  </button>
                ) : null}
                {showOtherLorebooks ? otherLorebooks.map((lorebook) => (
                  <label key={lorebook.id} className="vp-lore-option">
                    <span>{lorebook.name}<small>Not in this chat</small></span>
                    <input type="checkbox" checked={settings.lorebookIds.includes(lorebook.id)} onChange={(event) => void update({ lorebookIds: event.target.checked ? [...new Set([...settings.lorebookIds, lorebook.id])] : settings.lorebookIds.filter((id) => id !== lorebook.id) })} />
                  </label>
                )) : null}
              </div>
            </> : settings.lorebookMode === "chat" ? (
              <div className="vp-lore-summary">
                <p>Uses only lorebooks attached to this story.</p>
                {chatLorebooks.length ? (
                  <ul className="vp-lore-inplay">
                    {chatLorebooks.map((lorebook) => (
                      <li key={lorebook.id}><span>{lorebook.name}</span><small>{SCOPE_LABELS[lorebook.scope!]}</small></li>
                    ))}
                  </ul>
                ) : <p className="vp-muted-note">No lorebooks are active in this story.</p>}
              </div>
            ) : <p className="vp-lore-summary">Lorebooks are excluded from phone generation.</p>}
          </div>
        </section>
        <section><h3 className="vp-section-label">Generation guidance</h3><div className="vp-group"><label className="vp-row vp-row--stacked"><span>Author instructions</span>
            <textarea
              key={`${phone.phoneId}:instructions`}
              defaultValue={settings.generationInstructions}
              onBlur={(event) => void update({ generationInstructions: event.target.value })}
              placeholder="Tone, genre, or world rules for generated phone content."
              maxLength={12000}
              className="vp-textarea"
              style={{ minHeight: "5.5rem", width: "100%" }}
            />
          </label>
        </div></section>
      </div> : <div className="vp-settings-sections">
        <section><h3 className="vp-section-label">This phone</h3><div className="vp-group">
          <div className="vp-row"><span>Owner</span><span className="vp-muted-note">{about?.ownerName ?? "…"}</span></div>
          <div className="vp-row"><span>Phone type</span><span className="vp-muted-note">{about ? (about.ownerType === "character" ? "Character phone" : "Persona phone") : "…"}</span></div>
          <div className="vp-row"><span>Device name</span><span className="vp-muted-note">{about?.deviceName || "Not set"}</span></div>
          <div className="vp-row"><span>Chats</span><span className="vp-muted-note">{about ? about.chats : "…"}</span></div>
          <div className="vp-row"><span>Installed apps</span><span className="vp-muted-note">{about ? about.installedApps : "…"}</span></div>
          <div className="vp-row"><span>Storage used</span><span className="vp-muted-note">{about ? formatBytes(about.storageBytes) : "…"}</span></div>
        </div></section>
        <section><div className="vp-group">
          <button type="button" onClick={() => { if (window.confirm("Reset appearance, phone state, dock, and roleplay settings? Apps and their data will be kept.")) void reset(); }} className="vp-row vp-row--danger"><RotateCcw size="0.875rem" aria-hidden="true" /> Reset all settings</button>
        </div></section>
      </div>}
      </div>
    </section>
  );
}
