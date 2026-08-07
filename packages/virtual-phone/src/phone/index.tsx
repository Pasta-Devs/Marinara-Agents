import React from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { AtSign, BatteryMedium, BookUser, Camera, ChevronDown, Eye, Flame, Images, Lock, Mail, MessageCircle, Quote, Search, Settings, Signal, Smartphone, StickyNote, Store, WifiOff, X } from "lucide-react";
import { PhonesSettings, type Phone, type ProvisioningResponse } from "./system/PhonesSettings";
import { phoneThemeTokens } from "./device/theme";
import { phoneStylesheet } from "./device/styles";
import { defaultPhoneStatus } from "./device/status";
import { initialDeviceSession, unlockDevice } from "./device/surfaces";
import { phoneRequest } from "./platform/api";
import { defaultDeviceSettings } from "./device/settings";
import { conditionOpacity, patternBackground } from "./device/effects";
import { InstalledAppRegistry } from "./platform/app-registry";
import { AppRouteStackManager } from "./platform/app-lifecycle";
import { appIconClass } from "./platform/app-icons";
import { settingsManifest } from "./apps/settings/manifest";
import { appStoreManifest } from "./apps/app-store/manifest";
import { goodleManifest } from "./apps/goodle/manifest";
import { messagesManifest } from "./apps/messages/manifest";
import { notesManifest } from "./apps/notes/manifest";
import { noodlerManifest } from "./apps/noodler/manifest";
import { contactsManifest } from "./apps/contacts/manifest";
import { mailManifest } from "./apps/mail/manifest";
import { galleryManifest } from "./apps/gallery/manifest";
import { tindlerManifest } from "./apps/tindler/manifest";
import { noodlerRManifest } from "./apps/noodler-r/manifest";
import { cameraManifest } from "./apps/camera/manifest";

const SettingsApp = React.lazy(() => import("./apps/settings/shell").then((module) => ({ default: module.SettingsShell })));
const AppStoreApp = React.lazy(() => import("./apps/app-store/shell").then((module) => ({ default: module.AppStoreShell })));
const GoodleApp = React.lazy(() => import("./apps/goodle/shell").then((module) => ({ default: module.GoodleShell })));
const MessagesApp = React.lazy(() => import("./apps/messages/shell").then((module) => ({ default: module.MessagesShell })));
const NotesApp = React.lazy(() => import("./apps/notes/shell").then((module) => ({ default: module.NotesShell })));
const NoodlerApp = React.lazy(() => import("./apps/noodler/shell").then((module) => ({ default: module.NoodlerShell })));
const ContactsApp = React.lazy(() => import("./apps/contacts/shell").then((module) => ({ default: module.ContactsShell })));
const MailApp = React.lazy(() => import("./apps/mail/shell").then((module) => ({ default: module.MailShell })));
const GalleryApp = React.lazy(() => import("./apps/gallery/shell").then((module) => ({ default: module.GalleryShell })));
const TindlerApp = React.lazy(() => import("./apps/tindler/shell").then((module) => ({ default: module.TindlerShell })));
const NoodlerRApp = React.lazy(() => import("./apps/noodler-r/shell").then((module) => ({ default: module.NoodlerRShell })));
const CameraApp = React.lazy(() => import("./apps/camera/shell").then((module) => ({ default: module.CameraShell })));
export const phoneAppRegistry = new InstalledAppRegistry();
phoneAppRegistry.register({ manifest: settingsManifest, load: async () => import("./apps/settings/shell") });
phoneAppRegistry.register({ manifest: appStoreManifest, load: async () => import("./apps/app-store/shell") });
phoneAppRegistry.register({ manifest: goodleManifest, load: async () => import("./apps/goodle/shell") });
phoneAppRegistry.register({ manifest: messagesManifest, load: async () => import("./apps/messages/shell") });
phoneAppRegistry.register({ manifest: notesManifest, load: async () => import("./apps/notes/shell") });
phoneAppRegistry.register({ manifest: noodlerManifest, load: async () => import("./apps/noodler/shell") });
phoneAppRegistry.register({ manifest: contactsManifest, load: async () => import("./apps/contacts/shell") });
phoneAppRegistry.register({ manifest: mailManifest, load: async () => import("./apps/mail/shell") });
phoneAppRegistry.register({ manifest: galleryManifest, load: async () => import("./apps/gallery/shell") });
phoneAppRegistry.register({ manifest: tindlerManifest, load: async () => import("./apps/tindler/shell") });
phoneAppRegistry.register({ manifest: noodlerRManifest, load: async () => import("./apps/noodler-r/shell") });
phoneAppRegistry.register({ manifest: cameraManifest, load: async () => import("./apps/camera/shell") });

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

type ActiveApp = "settings" | "app-store" | "goodle" | "messages" | "notes" | "noodler" | "contacts" | "mail" | "gallery" | "tindler" | "noodler-r" | "camera" | null;

interface PhoneNotification {
  id: string;
  appId: string;
  title: string;
  body: string;
  count: number;
  at: string;
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
  const [notifications, setNotifications] = React.useState<PhoneNotification[]>([]);
  const [homeSearch, setHomeSearch] = React.useState("");
  const [pendingSearch, setPendingSearch] = React.useState("");
  const [showState, setShowState] = React.useState<"idle" | "pending" | "done">("idle");
  const [refState, setRefState] = React.useState<"idle" | "pending" | "done">("idle");
  const [gridPage, setGridPage] = React.useState(0);
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
  React.useEffect(() => {
    if (!open || !selectedPhone || activeApp !== null) {
      if (!selectedPhone) setNotifications([]);
      return;
    }
    let active = true;
    void phoneRequest<{ notifications: PhoneNotification[] }>(`/phones/${encodeURIComponent(selectedPhone.phoneId)}/notifications`)
      .then((response) => { if (active) setNotifications(response.notifications); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [open, selectedPhone?.phoneId, activeApp]);
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
  const messagesUnread = notifications.filter((notification) => notification.appId === "messages").reduce((total, notification) => total + notification.count, 0);
  const optionalApps: Array<{ id: Exclude<ActiveApp, null>; label: string; Icon: typeof Settings; badge?: number }> = [
    { id: "messages", label: "Messages", Icon: MessageCircle, badge: messagesUnread },
    { id: "goodle", label: "Goodle", Icon: Search },
    { id: "notes", label: "Notes", Icon: StickyNote },
    { id: "noodler", label: "Noodle", Icon: AtSign },
    { id: "contacts", label: "Contacts", Icon: BookUser },
    { id: "mail", label: "Mail", Icon: Mail },
    { id: "gallery", label: "Gallery", Icon: Images },
    { id: "tindler", label: "Tindler", Icon: Flame },
    { id: "noodler-r", label: "NoodleR", Icon: Lock },
    { id: "camera", label: "Camera", Icon: Camera },
  ];
  const installedOptionalApps = optionalApps.filter((app) => deviceSettings.installedApps.includes(app.id));
  const launchableApps: typeof optionalApps = [...installedOptionalApps, { id: "app-store", label: "App Store", Icon: Store }];
  const dockIds = ["messages", "goodle", "notes", "app-store"];
  const dockApps = dockIds.flatMap((id) => launchableApps.filter((app) => app.id === id)).slice(0, 4);
  const gridApps = launchableApps.filter((app) => !dockIds.includes(app.id));
  const gridPages = Array.from({ length: Math.ceil(gridApps.length / 8) }, (_, page) => gridApps.slice(page * 8, page * 8 + 8));
  const theme = deviceSettings.theme === "system" ? selectedPhone?.baselineTheme ?? "system" : deviceSettings.theme;
  const clock = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return createPortal(
    <div ref={overlayRef} className="vp-root" data-chat-floating-panel style={{ ...phoneThemeTokens(theme), ...(deviceSettings.caseColor ? { "--vp-bezel": deviceSettings.caseColor } : {}) } as React.CSSProperties}>
      <style data-virtual-phone-styles>{phoneStylesheet}</style>
      <div className="vp-scrim" aria-hidden="true" onClick={close} />
      <section role="dialog" aria-modal="true" aria-labelledby="virtual-phone-title" className="vp-stage" onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
        <div key={selectedPhone?.phoneId ?? "none"} className={`vp-stage-col ${selectedPhone?.ownerType === "character" ? "vp-slide-down" : "vp-slide-up"}`}>
        <div className="vp-shell">
          <span className="vp-key vp-key--volume" aria-hidden="true" />
          <span className="vp-key vp-key--power" aria-hidden="true" />
          <div className="vp-screen">
            <header className="vp-statusbar">
              <span id="virtual-phone-title" className="vp-statusbar-clock">{clock}</span>
              <button type="button" aria-haspopup="listbox" aria-expanded={switcherOpen} aria-label="Switch phone" onClick={() => setSwitcherOpen((current) => !current)} className="vp-switch-btn">
                <span>{selectedPhone?.ownerName ?? "Phone"}</span>
                <ChevronDown size="0.75rem" aria-hidden="true" />
              </button>
              <div className="vp-statusbar-end">
                <span className="vp-statusbar-cluster" aria-label="Full cellular signal and Wi-Fi off">
                  <Signal size="0.75rem" aria-hidden="true" />
                  <WifiOff size="0.75rem" aria-hidden="true" />
                </span>
                <span className="vp-statusbar-cluster" aria-label={`${status.batteryLevel}% battery, not charging`}>
                  {status.batteryLevel}% <BatteryMedium size="0.875rem" aria-hidden="true" />
                </span>
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
            <main className="vp-surface-area" style={{ backgroundImage: `${patternBackground(deviceSettings.pattern, deviceSettings.patternIntensity)}, ${deviceSettings.wallpaperTint ? `linear-gradient(${deviceSettings.wallpaperTint}59, ${deviceSettings.wallpaperTint}59)` : "linear-gradient(rgb(0 0 0 / 0), rgb(0 0 0 / 0))"}, ${wallpaperBackground(deviceSettings.wallpaper)}`, backgroundSize: "16px 16px, cover, cover" }}>
              {session.surface === "lock" ? (
                <div className="vp-lock">
                  <div>
                    <p className="vp-lock-clock">{clock}</p>
                    <p className="vp-lock-date">{now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p>
                    {deviceSettings.deviceName.trim() ? <p className="vp-lock-device">{deviceSettings.deviceName}</p> : null}
                  </div>
                  {notifications.length === 0 ? <div className="vp-lock-card">No notifications</div> : (
                    <div className="vp-lock-list" aria-label="Notifications">
                      {notifications.slice(0, 3).map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          className="vp-lock-card vp-lock-card--notification"
                          onClick={() => {
                            setSession(unlockDevice);
                            if (notification.appId === "messages" && deviceSettings.installedApps.includes("messages")) openAppRoute("messages", "/");
                          }}
                        >
                          <span className="vp-thread-name">{notification.title}</span>
                          <span className="vp-thread-preview">{notification.body}</span>
                          {notification.count > 1 ? <span className="vp-muted-note">{notification.count} new messages</span> : null}
                        </button>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => setSession(unlockDevice)} className="vp-unlock-btn">Unlock</button>
                </div>
              ) : (
                <div className="vp-home">
                  <div className="vp-home-top">
                    <form className="vp-search-go" onSubmit={(event) => {
                      event.preventDefault();
                      if (!deviceSettings.installedApps.includes("goodle") || !homeSearch.trim()) return;
                      setPendingSearch(homeSearch.trim());
                      setHomeSearch("");
                      openAppRoute("goodle", "/");
                    }}>
                      <label className="vp-field">
                        <span className="vp-sr-only">Web Search</span>
                        <input type="search" value={homeSearch} onChange={(event) => setHomeSearch(event.target.value)} disabled={!deviceSettings.installedApps.includes("goodle")} placeholder={deviceSettings.installedApps.includes("goodle") ? "Search Goodle" : "Install Goodle to search"} className="vp-search-bar" />
                      </label>
                      {homeSearch.trim() ? <button type="submit" aria-label="Search" className="vp-go-btn"><Search size="0.875rem" aria-hidden="true" /></button> : null}
                    </form>
                    <button type="button" aria-label="Device settings" title="Device settings" onClick={() => openAppRoute("settings", "/")} className="vp-icon-btn vp-icon-btn--surface"><Settings size="1rem" aria-hidden="true" /></button>
                  </div>
                  <p className="vp-home-clock">{clock}</p>
                  <p className="vp-home-date">{now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p>
                  <div className="vp-home-spacer" aria-hidden="true" />
                  {gridPages.length ? (
                    <>
                      <div aria-label="Installed apps" className="vp-grid-pager" onScroll={(event) => {
                        const target = event.currentTarget;
                        setGridPage(Math.round(target.scrollLeft / Math.max(1, target.clientWidth)));
                      }}>
                        {gridPages.map((page, pageIndex) => (
                          <div key={pageIndex} className="vp-app-grid vp-grid-page">
                            {page.map(({ id, label, Icon, badge }) => (
                              <button key={id} type="button" aria-label={`Open ${label}${badge ? `, ${badge} unread` : ""}`} onClick={() => { if (id === "goodle") setPendingSearch(""); openAppRoute(id, "/"); }} className="vp-app">
                                <span className={`vp-app-icon ${appIconClass(id)}`}><Icon size="1.5rem" aria-hidden="true" /></span>
                                {badge ? <span className="vp-badge vp-app-badge" aria-hidden="true">{badge > 99 ? "99+" : badge}</span> : null}
                                <span className="vp-app-label">{label}</span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                      {gridPages.length > 1 ? (
                        <div className="vp-page-dots" aria-hidden="true">
                          {gridPages.map((_, dotIndex) => <span key={dotIndex} className={`vp-page-dot${dotIndex === gridPage ? " vp-page-dot--active" : ""}`} />)}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  {dockApps.length ? (
                    <div className="vp-dockrow" aria-label="Favorite apps">
                      {dockApps.map(({ id, label, Icon, badge }) => (
                        <button key={id} type="button" aria-label={`Open ${label}${badge ? `, ${badge} unread` : ""}`} title={label} onClick={() => { if (id === "goodle") setPendingSearch(""); openAppRoute(id, "/"); }} className="vp-app">
                          <span className={`vp-app-icon ${appIconClass(id)}`}><Icon size="1.5rem" aria-hidden="true" /></span>
                          {badge ? <span className="vp-badge vp-app-badge" aria-hidden="true">{badge > 99 ? "99+" : badge}</span> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
              {activeApp === "settings" && selectedPhone ? <AppErrorBoundary appName="Settings"><React.Suspense fallback={<div className="vp-appview vp-appview--loading">Loading Settings...</div>}><SettingsApp phone={{ ...selectedPhone, settings: deviceSettings }} onPhoneChange={(phone) => setPhones((current) => current.map((item) => item.phoneId === phone.phoneId ? phone : item))} onBack={() => backFromApp("settings")} onClose={closeApp} /></React.Suspense></AppErrorBoundary> : null}
              {activeApp === "app-store" && selectedPhone ? <AppErrorBoundary appName="App Store"><React.Suspense fallback={<div className="vp-appview vp-appview--loading">Loading App Store...</div>}><AppStoreApp apps={phoneAppRegistry.list().map(({ manifest }) => ({ manifest, installed: deviceSettings.installedApps.includes(manifest.id) }))} onInstalledChange={(appId, installed) => void updateSettings({ installedApps: installed ? [...new Set([...deviceSettings.installedApps, appId])] : deviceSettings.installedApps.filter((installedId) => installedId !== appId) })} onOpenApp={(appId) => { if (appId === "goodle") setPendingSearch(""); openAppRoute(appId as Exclude<ActiveApp, null>, "/"); }} onBack={() => backFromApp("app-store")} onClose={closeApp} /></React.Suspense></AppErrorBoundary> : null}
              {activeApp === "goodle" && selectedPhone && deviceSettings.installedApps.includes("goodle") ? <AppErrorBoundary appName="Goodle"><React.Suspense fallback={<div className="vp-appview vp-appview--loading">Loading Goodle...</div>}><GoodleApp phoneId={selectedPhone.phoneId} initialQuery={pendingSearch} onBack={() => backFromApp("goodle")} onClose={closeApp} /></React.Suspense></AppErrorBoundary> : null}
              {activeApp === "messages" && selectedPhone && deviceSettings.installedApps.includes("messages") ? <AppErrorBoundary appName="Messages"><React.Suspense fallback={<div className="vp-appview vp-appview--loading">Loading Messages...</div>}><MessagesApp phoneId={selectedPhone.phoneId} onBack={() => backFromApp("messages")} onClose={closeApp} /></React.Suspense></AppErrorBoundary> : null}
              {activeApp === "notes" && selectedPhone && deviceSettings.installedApps.includes("notes") ? <AppErrorBoundary appName="Notes"><React.Suspense fallback={<div className="vp-appview vp-appview--loading">Loading Notes...</div>}><NotesApp phoneId={selectedPhone.phoneId} onBack={() => backFromApp("notes")} onClose={closeApp} /></React.Suspense></AppErrorBoundary> : null}
              {activeApp === "noodler" && selectedPhone && deviceSettings.installedApps.includes("noodler") ? <AppErrorBoundary appName="Noodle"><React.Suspense fallback={<div className="vp-appview vp-appview--loading">Loading Noodle...</div>}><NoodlerApp phoneId={selectedPhone.phoneId} ownerName={selectedPhone.ownerName} onBack={() => backFromApp("noodler")} onClose={closeApp} /></React.Suspense></AppErrorBoundary> : null}
               {activeApp === "contacts" && selectedPhone && chatId && deviceSettings.installedApps.includes("contacts") ? <AppErrorBoundary appName="Contacts"><React.Suspense fallback={<div className="vp-appview vp-appview--loading">Loading Contacts...</div>}><ContactsApp phoneId={selectedPhone.phoneId} chatId={chatId} onBack={() => backFromApp("contacts")} onClose={closeApp} /></React.Suspense></AppErrorBoundary> : null}
              {activeApp === "mail" && selectedPhone && deviceSettings.installedApps.includes("mail") ? <AppErrorBoundary appName="Mail"><React.Suspense fallback={<div className="vp-appview vp-appview--loading">Loading Mail...</div>}><MailApp phoneId={selectedPhone.phoneId} onBack={() => backFromApp("mail")} onClose={closeApp} /></React.Suspense></AppErrorBoundary> : null}
              {activeApp === "gallery" && selectedPhone && deviceSettings.installedApps.includes("gallery") ? <AppErrorBoundary appName="Gallery"><React.Suspense fallback={<div className="vp-appview vp-appview--loading">Loading Gallery...</div>}><GalleryApp phoneId={selectedPhone.phoneId} onBack={() => backFromApp("gallery")} onClose={closeApp} /></React.Suspense></AppErrorBoundary> : null}
              {activeApp === "tindler" && selectedPhone && deviceSettings.installedApps.includes("tindler") ? <AppErrorBoundary appName="Tindler"><React.Suspense fallback={<div className="vp-appview vp-appview--loading">Loading Tindler...</div>}><TindlerApp phoneId={selectedPhone.phoneId} onBack={() => backFromApp("tindler")} onClose={closeApp} /></React.Suspense></AppErrorBoundary> : null}
               {activeApp === "noodler-r" && selectedPhone && chatId && deviceSettings.installedApps.includes("noodler-r") ? <AppErrorBoundary appName="NoodleR"><React.Suspense fallback={<div className="vp-appview vp-appview--loading">Loading NoodleR...</div>}><NoodlerRApp phoneId={selectedPhone.phoneId} chatId={chatId} onBack={() => backFromApp("noodler-r")} onClose={closeApp} /></React.Suspense></AppErrorBoundary> : null}
              {activeApp === "camera" && selectedPhone && deviceSettings.installedApps.includes("camera") ? <AppErrorBoundary appName="Camera"><React.Suspense fallback={<div className="vp-appview vp-appview--loading">Loading Camera...</div>}><CameraApp phoneId={selectedPhone.phoneId} onBack={() => backFromApp("camera")} onClose={closeApp} /></React.Suspense></AppErrorBoundary> : null}
            </main>
            {deviceSettings.screenEffect !== "none" ? <span className={`vp-fx vp-fx--${deviceSettings.screenEffect}`} style={{ opacity: conditionOpacity(deviceSettings.screenEffectIntensity, deviceSettings.reduceDeviceEffects) }} aria-hidden="true" /> : null}
            <span className="vp-home-indicator" aria-hidden="true" />
          </div>
        </div>
        <div className="vp-dock" aria-label="Phone actions">
          <button ref={closeButtonRef} type="button" onClick={close} className="vp-dock-btn vp-dock-btn--primary">
            <X size="0.875rem" aria-hidden="true" /> Put down
          </button>
          <button type="button" disabled={!chatId || !selectedPhone || showState === "pending"} title="Show this screen to the story" aria-label="Show to character" onClick={() => {
            if (!chatId || !selectedPhone) return;
            setShowState("pending");
            void phoneRequest(`/chats/${encodeURIComponent(chatId)}/phones/${encodeURIComponent(selectedPhone.phoneId)}/show`, {
              method: "POST", body: JSON.stringify({ app: activeApp, surface: session.surface }),
            }).then(() => {
              setShowState("done");
              window.setTimeout(() => setShowState("idle"), 2000);
            }).catch(() => setShowState("idle"));
          }} className="vp-dock-btn">
            <Eye size="0.875rem" aria-hidden="true" /> {showState === "done" ? "Shown ✓" : "Show"}
          </button>
          <button type="button" disabled={!chatId || !selectedPhone || refState === "pending"} title="Add this screen to the chat as quiet context" aria-label="Reference in chat" onClick={() => {
            if (!chatId || !selectedPhone) return;
            setRefState("pending");
            void phoneRequest(`/chats/${encodeURIComponent(chatId)}/phones/${encodeURIComponent(selectedPhone.phoneId)}/show`, {
              method: "POST", body: JSON.stringify({ app: activeApp, surface: session.surface, mode: "reference" }),
            }).then(() => {
              setRefState("done");
              window.setTimeout(() => setRefState("idle"), 2000);
            }).catch(() => setRefState("idle"));
          }} className="vp-dock-btn">
            <Quote size="0.875rem" aria-hidden="true" /> {refState === "done" ? "Added ✓" : "Reference"}
          </button>
        </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function VirtualPhoneToolbar({ className, chatId }: { className?: string; chatId: string | null }) {
  const [unread, setUnread] = React.useState(0);
  React.useEffect(() => {
    if (!chatId) return;
    let active = true;
    const refresh = () => {
      void phoneRequest<{ unread: number }>(`/chats/${encodeURIComponent(chatId)}/unread`)
        .then((response) => { if (active) setUnread(response.unread); })
        .catch(() => undefined);
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener(PHONE_CLOSE_EVENT, refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(PHONE_CLOSE_EVENT, refresh);
    };
  }, [chatId]);
  return (
    <button type="button" title="Open Virtual Phone" aria-label={`Open Virtual Phone${unread > 0 ? `, ${unread} unread messages` : ""}`} style={{ position: "relative" }} className={className ?? "inline-flex h-9 w-9 items-center justify-center rounded-lg"} onClick={(event) => {
      phoneOpener = event.currentTarget;
      dispatchPhoneEvent(PHONE_OPEN_EVENT);
    }}>
      <Smartphone size="0.875rem" aria-hidden="true" />
      {unread > 0 ? (
        <span aria-hidden="true" style={{ position: "absolute", top: "0.125rem", right: "0.125rem", minWidth: "0.875rem", height: "0.875rem", padding: "0 0.1875rem", borderRadius: "999px", background: "#ff3b30", color: "#fff", fontSize: "0.5625rem", fontWeight: 700, lineHeight: "0.875rem", textAlign: "center" }}>{unread > 99 ? "99+" : unread}</span>
      ) : null}
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
        this.getAttribute("view") === "toolbar" ? <VirtualPhoneToolbar className={this.capabilityProps?.toolbarButtonClass} chatId={this.capabilityProps?.chatId ?? null} /> :
          this.getAttribute("view") === "surface" ? <PhoneOverlay chatId={this.capabilityProps?.chatId ?? null} /> : null,
    );
  };
}

const tag = "marinara-capability-virtual-phone";
if (!customElements.get(tag)) customElements.define(tag, VirtualPhoneElement);
