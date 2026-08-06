import React from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { BatteryMedium, ChevronDown, MessageCircle, Search, Settings, Signal, Smartphone, Store, WifiOff, X } from "lucide-react";
import { PhonesSettings, type Phone, type ProvisioningResponse } from "./system/PhonesSettings";
import { phoneThemeTokens } from "./device/theme";
import { phoneStylesheet } from "./device/styles";
import { defaultPhoneStatus } from "./device/status";
import { initialDeviceSession, unlockDevice } from "./device/surfaces";
import { phoneRequest } from "./platform/api";
import { defaultDeviceSettings } from "./device/settings";
import { patternBackground } from "./device/effects";
import { InstalledAppRegistry } from "./platform/app-registry";
import { AppRouteStackManager } from "./platform/app-lifecycle";
import { settingsManifest } from "./apps/settings/manifest";
import { appStoreManifest } from "./apps/app-store/manifest";
import { goodleManifest } from "./apps/goodle/manifest";
import { messagesManifest } from "./apps/messages/manifest";

const SettingsApp = React.lazy(() => import("./apps/settings/shell").then((module) => ({ default: module.SettingsShell })));
const AppStoreApp = React.lazy(() => import("./apps/app-store/shell").then((module) => ({ default: module.AppStoreShell })));
const GoodleApp = React.lazy(() => import("./apps/goodle/shell").then((module) => ({ default: module.GoodleShell })));
const MessagesApp = React.lazy(() => import("./apps/messages/shell").then((module) => ({ default: module.MessagesShell })));
export const phoneAppRegistry = new InstalledAppRegistry();
phoneAppRegistry.register({ manifest: settingsManifest, load: async () => import("./apps/settings/shell") });
phoneAppRegistry.register({ manifest: appStoreManifest, load: async () => import("./apps/app-store/shell") });
phoneAppRegistry.register({ manifest: goodleManifest, load: async () => import("./apps/goodle/shell") });
phoneAppRegistry.register({ manifest: messagesManifest, load: async () => import("./apps/messages/shell") });

class AppErrorBoundary extends React.Component<{ appName: string; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="vp-appview vp-app-error">
          <p>{this.props.appName} ran into a problem.</p>
          <button type="button" onClick={() => this.setState({ failed: false })} className="vp-surface-btn">Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PHONE_OPEN_EVENT = "marinara-virtual-phone-open";
const PHONE_CLOSE_EVENT = "marinara-virtual-phone-close";
let phoneOpener: HTMLElement | null = null;

function dispatchPhoneEvent(type: string) {
  window.dispatchEvent(new CustomEvent(type));
}

type ActiveApp = "settings" | "app-store" | "goodle" | "messages" | null;

function appIconStyle(appId: string) {
  if (appId === "settings" || appId === "app-store" || appId === "goodle" || appId === "messages") return `vp-app-icon--${appId}`;
  return "vp-app-icon--default";
}

function useClock() {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function wallpaperBackground(wallpaper: string) {
  if (wallpaper === "midnight") return "linear-gradient(145deg, #111827 0%, #243447 55%, #0f172a 100%)";
  if (wallpaper === "paper") return "linear-gradient(145deg, #fff8e7 0%, #e8dfcc 52%, #f7efe1 100%)";
  return "linear-gradient(145deg, var(--vp-bg), var(--vp-surface))";
}

function PhoneOverlay({ chatId }: { chatId: string | null }) {
  const [open, setOpen] = React.useState(false);
  const [phones, setPhones] = React.useState<Phone[]>([]);
  const [session, setSession] = React.useState(() => initialDeviceSession());
  const [switcherOpen, setSwitcherOpen] = React.useState(false);
  const [activeApp, setActiveApp] = React.useState<ActiveApp>(null);
  const routeStacks = React.useRef(new Map<string, AppRouteStackManager>());
  const activeApps = React.useRef(new Map<string, Exclude<ActiveApp, null>>());
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const status = defaultPhoneStatus();
  const now = useClock();

  React.useEffect(() => {
    if (!open || !chatId) return;
    void phoneRequest<ProvisioningResponse>(`/chats/${encodeURIComponent(chatId)}/phones`).then((response) => {
      const available = [
        ...(response.persona ? [response.persona] : []),
        ...response.characters.flatMap((character) => character.phone?.enabled ? [character.phone] : []),
      ];
      setPhones(available);
      setSession((current) => ({
        ...current,
        selectedPhoneId: available.some((phone) => phone.phoneId === current.selectedPhoneId)
          ? current.selectedPhoneId
          : available[0]?.phoneId ?? "",
      }));
    });
  }, [chatId, open]);

  React.useEffect(() => {
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);
    window.addEventListener(PHONE_OPEN_EVENT, handleOpen);
    window.addEventListener(PHONE_CLOSE_EVENT, handleClose);
    return () => {
      window.removeEventListener(PHONE_OPEN_EVENT, handleOpen);
      window.removeEventListener(PHONE_CLOSE_EVENT, handleClose);
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dispatchPhoneEvent(PHONE_CLOSE_EVENT);
        return;
      }
      if (event.key !== "Tab" || !overlayRef.current) return;
      const controls = [...overlayRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (controls.length === 0) return;
      const first = controls[0]!;
      const last = controls[controls.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const overlay = overlayRef.current;
    const background = [...document.body.children].filter((child) => !overlay || !child.contains(overlay));
    const previousInert = background.map((child) => ({ child: child as HTMLElement, inert: (child as HTMLElement).inert }));
    for (const { child } of previousInert) child.inert = true;
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      for (const { child, inert } of previousInert) child.inert = inert;
      // Focus can only return to the opener after its subtree is no longer inert.
      phoneOpener?.focus();
    };
  }, [open]);

  const selectedPhone = phones.find((phone) => phone.phoneId === session.selectedPhoneId) ?? phones[0] ?? null;
  React.useEffect(() => {
    setActiveApp(selectedPhone ? activeApps.current.get(selectedPhone.phoneId) ?? null : null);
  }, [selectedPhone?.phoneId]);
  if (!open) return null;
  const deviceSettings = selectedPhone?.settings ?? defaultDeviceSettings(selectedPhone?.baselineTheme ?? "system");
  const updateSettings = async (patch: Record<string, unknown>) => {
    if (!selectedPhone) return;
    const response = await phoneRequest<{ phone: Phone }>(`/phones/${encodeURIComponent(selectedPhone.phoneId)}/settings`, {
      method: "PATCH", body: JSON.stringify(patch),
    });
    setPhones((current) => current.map((phone) => phone.phoneId === response.phone.phoneId ? response.phone : phone));
  };
  const close = () => {
    dispatchPhoneEvent(PHONE_CLOSE_EVENT);
  };
  const phoneRouteStacks = selectedPhone
    ? (routeStacks.current.get(selectedPhone.phoneId) ?? (() => {
      const manager = new AppRouteStackManager();
      routeStacks.current.set(selectedPhone.phoneId, manager);
      return manager;
    })())
    : null;
  const openAppRoute = (app: Exclude<ActiveApp, null>, rootRoute: string) => {
    phoneRouteStacks?.open(app, rootRoute);
    if (selectedPhone) activeApps.current.set(selectedPhone.phoneId, app);
    setActiveApp(app);
  };
  const closeApp = () => {
    setActiveApp(null);
  };
  const backFromApp = (app: Exclude<ActiveApp, null>) => {
    if (phoneRouteStacks?.back(app) === "home") {
      if (selectedPhone) activeApps.current.delete(selectedPhone.phoneId);
      closeApp();
    }
  };
  const theme = deviceSettings.theme === "system" ? selectedPhone?.baselineTheme ?? "system" : deviceSettings.theme;
  const clock = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return createPortal(
    <div ref={overlayRef} className="vp-root" data-chat-floating-panel style={phoneThemeTokens(theme) as React.CSSProperties}>
      <style data-virtual-phone-styles>{phoneStylesheet}</style>
      <div className="vp-scrim" aria-hidden="true" onClick={close} />
      <section role="dialog" aria-modal="true" aria-labelledby="virtual-phone-title" className="vp-stage">
        <div className="vp-shell">
          <span className="vp-notch" aria-hidden="true" />
          <span className="vp-key vp-key--volume" aria-hidden="true" />
          <span className="vp-key vp-key--power" aria-hidden="true" />
          <div className="vp-screen">
            <header className="vp-statusbar">
              <span id="virtual-phone-title" className="vp-statusbar-clock">{clock}</span>
              <span aria-hidden="true" />
              <div className="vp-statusbar-end">
                <span className="vp-statusbar-cluster" aria-label="Full cellular signal and Wi-Fi off">
                  <Signal size="0.75rem" aria-hidden="true" />
                  <WifiOff size="0.75rem" aria-hidden="true" />
                </span>
                <span className="vp-statusbar-cluster" aria-label={`${status.batteryLevel}% battery, not charging`}>
                  {status.batteryLevel}% <BatteryMedium size="0.875rem" aria-hidden="true" />
                </span>
                <button type="button" aria-haspopup="listbox" aria-expanded={switcherOpen} aria-label="Switch phone" onClick={() => setSwitcherOpen((current) => !current)} className="vp-switch-btn">
                  <span>{selectedPhone?.ownerName ?? "Phone"}</span>
                  <ChevronDown size="0.75rem" aria-hidden="true" />
                </button>
              </div>
              {switcherOpen ? (
                <div role="listbox" aria-label="Available phones" className="vp-switcher">
                  {phones.map((phone) => (
                    <button key={phone.phoneId} type="button" role="option" aria-selected={phone.phoneId === session.selectedPhoneId} onClick={() => { setSession((current) => ({ ...current, selectedPhoneId: phone.phoneId })); setSwitcherOpen(false); }} className="vp-switcher-option">
                      <span>{phone.ownerName}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </header>
            <main className="vp-surface-area" style={{ backgroundImage: `${patternBackground(deviceSettings.pattern, deviceSettings.patternIntensity)}, ${wallpaperBackground(deviceSettings.wallpaper)}`, backgroundSize: "16px 16px, cover" }}>
              {session.surface === "lock" ? (
                <div className="vp-lock">
                  <div>
                    <p className="vp-lock-clock">{clock}</p>
                    <p className="vp-lock-date">{now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p>
                  </div>
                  <div className="vp-lock-card">No notifications</div>
                  <button type="button" onClick={() => setSession(unlockDevice)} className="vp-unlock-btn">Unlock</button>
                </div>
              ) : (
                <div className="vp-home">
                  <div className="vp-home-top">
                    <button type="button" aria-label="Device settings" title="Device settings" onClick={() => openAppRoute("settings", "/")} className="vp-icon-btn vp-icon-btn--surface"><Settings size="1rem" aria-hidden="true" /></button>
                  </div>
                  <label className="vp-field" style={{ marginTop: "0.5rem" }}>
                    <span className="vp-sr-only">Web Search</span>
                    <input type="search" disabled placeholder="Web Search" className="vp-search-bar" />
                  </label>
                  <div className="vp-home-spacer" aria-hidden="true" />
                  <div aria-label="Installed apps" className="vp-app-grid">
                    <button type="button" aria-label="Open Settings" onClick={() => openAppRoute("settings", "/")} className="vp-app">
                      <span className={`vp-app-icon ${appIconStyle("settings")}`}><Settings size="1.5rem" aria-hidden="true" /></span>
                      <span className="vp-app-label">Settings</span>
                    </button>
                    <button type="button" aria-label="Open App Store" onClick={() => openAppRoute("app-store", "/")} className="vp-app">
                      <span className={`vp-app-icon ${appIconStyle("app-store")}`}><Store size="1.5rem" aria-hidden="true" /></span>
                      <span className="vp-app-label">App Store</span>
                    </button>
                    {deviceSettings.installedApps.includes("messages") ? (
                      <button type="button" aria-label="Open Messages" onClick={() => openAppRoute("messages", "/")} className="vp-app">
                        <span className={`vp-app-icon ${appIconStyle("messages")}`}><MessageCircle size="1.5rem" aria-hidden="true" /></span>
                        <span className="vp-app-label">Messages</span>
                      </button>
                    ) : null}
                    {deviceSettings.installedApps.includes("goodle") ? (
                      <button type="button" aria-label="Open Goodle" onClick={() => openAppRoute("goodle", "/")} className="vp-app">
                        <span className={`vp-app-icon ${appIconStyle("goodle")}`}><Search size="1.5rem" aria-hidden="true" /></span>
                        <span className="vp-app-label">Goodle</span>
                      </button>
                    ) : null}
                    {Array.from({ length: Math.max(0, 2 - ["goodle", "messages"].filter((appId) => deviceSettings.installedApps.includes(appId)).length) }, (_, index) => <span key={index} aria-hidden="true" className="vp-app-slot" />)}
                  </div>
                </div>
              )}
              {activeApp === "settings" && selectedPhone ? <AppErrorBoundary appName="Settings"><React.Suspense fallback={<div className="vp-appview vp-appview--loading">Loading Settings...</div>}><SettingsApp phone={{ ...selectedPhone, settings: deviceSettings }} onPhoneChange={(phone) => setPhones((current) => current.map((item) => item.phoneId === phone.phoneId ? phone : item))} onBack={() => backFromApp("settings")} onClose={closeApp} /></React.Suspense></AppErrorBoundary> : null}
              {activeApp === "app-store" && selectedPhone ? <AppErrorBoundary appName="App Store"><React.Suspense fallback={<div className="vp-appview vp-appview--loading">Loading App Store...</div>}><AppStoreApp apps={phoneAppRegistry.list().map(({ manifest }) => ({ manifest, installed: deviceSettings.installedApps.includes(manifest.id) }))} onInstalledChange={(appId, installed) => void updateSettings({ installedApps: installed ? [...new Set([...deviceSettings.installedApps, appId])] : deviceSettings.installedApps.filter((installedId) => installedId !== appId) })} onBack={() => backFromApp("app-store")} onClose={closeApp} /></React.Suspense></AppErrorBoundary> : null}
              {activeApp === "goodle" && selectedPhone && deviceSettings.installedApps.includes("goodle") ? <AppErrorBoundary appName="Goodle"><React.Suspense fallback={<div className="vp-appview vp-appview--loading">Loading Goodle...</div>}><GoodleApp phoneId={selectedPhone.phoneId} onBack={() => backFromApp("goodle")} onClose={closeApp} /></React.Suspense></AppErrorBoundary> : null}
              {activeApp === "messages" && selectedPhone && deviceSettings.installedApps.includes("messages") ? <AppErrorBoundary appName="Messages"><React.Suspense fallback={<div className="vp-appview vp-appview--loading">Loading Messages...</div>}><MessagesApp phoneId={selectedPhone.phoneId} onBack={() => backFromApp("messages")} onClose={closeApp} /></React.Suspense></AppErrorBoundary> : null}
            </main>
            <footer className="vp-footer">
              <button ref={closeButtonRef} type="button" onClick={close} className="vp-putdown-btn">
                <X size="0.875rem" aria-hidden="true" /> Put down
              </button>
              <span className="vp-home-indicator" aria-hidden="true" />
            </footer>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function VirtualPhoneToolbar({ className }: { className?: string }) {
  return (
    <button type="button" title="Open Virtual Phone" aria-label="Open Virtual Phone" className={className ?? "inline-flex h-9 w-9 items-center justify-center rounded-lg"} onClick={(event) => {
      phoneOpener = event.currentTarget;
      dispatchPhoneEvent(PHONE_OPEN_EVENT);
    }}>
      <Smartphone size="0.875rem" aria-hidden="true" />
    </button>
  );
}

type CapabilityElement = HTMLElement & {
  capabilityProps?: { chatId?: string | null; toolbarButtonClass?: string };
  __root?: Root | null;
};

class VirtualPhoneElement extends HTMLElement implements CapabilityElement {
  capabilityProps?: { chatId?: string | null };
  __root: Root | null = null;

  static observedAttributes = ["view"];

  connectedCallback() {
    this.addEventListener("marinara-capability-props", this.render);
    if (!this.__root) this.__root = createRoot(this);
    this.render();
  }

  disconnectedCallback() {
    this.removeEventListener("marinara-capability-props", this.render);
    queueMicrotask(() => {
      if (!this.isConnected && this.__root) {
        this.__root.unmount();
        this.__root = null;
      }
    });
  }

  attributeChangedCallback() {
    this.render();
  }

  render = () => {
    if (!this.__root) return;
    this.__root.render(
      this.getAttribute("view") === "detail" ? <PhonesSettings chatId={this.capabilityProps?.chatId ?? null} /> :
        this.getAttribute("view") === "toolbar" ? <VirtualPhoneToolbar className={this.capabilityProps?.toolbarButtonClass} /> :
          this.getAttribute("view") === "surface" ? <PhoneOverlay chatId={this.capabilityProps?.chatId ?? null} /> : null,
    );
  };
}

const tag = "marinara-capability-virtual-phone";
if (!customElements.get(tag)) customElements.define(tag, VirtualPhoneElement);
