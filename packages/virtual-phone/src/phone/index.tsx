import React from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { BatteryFull, BatteryLow, BatteryMedium, BatteryWarning, Bell, ChevronDown, ChevronRight, Eye, Quote, SignalHigh, SignalLow, SignalMedium, SignalZero, Smartphone, Wifi, WifiLow, WifiOff, X } from "lucide-react";
import { PhonesSettings, type Phone, type ProvisioningResponse } from "./system/PhonesSettings";
import { phoneThemeTokens } from "./device/theme";
import { phoneStylesheet } from "./device/styles";
import { initialDeviceSession, unlockDevice } from "./device/surfaces";
import { grantPhoneAccess, phoneRequest, releasePhoneAccess, setActiveChatId, waitForPhoneWrites } from "./platform/api";
import { defaultDeviceSettings, storyNow } from "./device/settings";
import { StoryClockProvider } from "./platform/story-clock";
import { conditionOpacity, patternBackground } from "./device/effects";
import { InstalledAppRegistry, type AppRenderContext, type InstalledApp } from "./platform/app-registry";
import { AppRouteStackManager } from "./platform/app-lifecycle";
import { appGlyph, appIconClass } from "./platform/app-icons";
import { settingsManifest } from "./apps/settings/manifest";
import { appStoreManifest } from "./apps/app-store/manifest";
import { goodleManifest } from "./apps/goodle/manifest";
import { messagesManifest } from "./apps/messages/manifest";
import { callsManifest } from "./apps/calls/manifest";
import { notesManifest } from "./apps/notes/manifest";
import { noodlerManifest } from "./apps/noodler/manifest";
import { contactsManifest } from "./apps/contacts/manifest";
import { mailManifest } from "./apps/mail/manifest";
import { galleryManifest } from "./apps/gallery/manifest";
import { tindlerManifest } from "./apps/tindler/manifest";
import { noodlerRManifest } from "./apps/noodler-r/manifest";
import { cameraManifest } from "./apps/camera/manifest";
import { bankingManifest } from "./apps/banking/manifest";
import { bazaarManifest } from "./apps/bazaar/manifest";
import { gameManifest } from "./apps/game/manifest";
import { shopManifest } from "./apps/shop/manifest";
import { mapsManifest } from "./apps/maps/manifest";
import { findManifest } from "./apps/find/manifest";
import { encodeLaunchIntent, type PhoneLaunchIntent } from "./platform/launch-intent";
import { projectVisibleScreen } from "./platform/screen-projection";

const lazyShell = <Module, Key extends keyof Module>(load: () => Promise<Module>, exportName: Key) =>
  React.lazy(() => load().then((module) => ({ default: module[exportName] as React.ComponentType<any> })));

const phoneId = (context: AppRenderContext) => ({ phoneId: context.phone.phoneId });

/**
 * The single registration site. Order here is the home-screen order.
 * `settings` and `app-store` are not removable, so they ignore the install check.
 */
export const phoneAppRegistry = new InstalledAppRegistry();
phoneAppRegistry.register({
  manifest: settingsManifest,
  component: lazyShell(() => import("./apps/settings/shell"), "SettingsShell"),
  props: (context) => ({ phone: { ...context.phone, settings: context.settings }, onPhoneChange: context.onPhoneChange }),
});
phoneAppRegistry.register({
  manifest: appStoreManifest,
  component: lazyShell(() => import("./apps/app-store/shell"), "AppStoreShell"),
  props: (context) => ({ apps: context.installedApps, onInstalledChange: context.onInstalledChange, onOpenApp: context.openApp }),
});
phoneAppRegistry.register({
  manifest: callsManifest,
  component: lazyShell(() => import("./apps/calls/shell"), "CallsShell"),
  requiresChat: true,
  props: (context) => ({ phoneId: context.phone.phoneId, chatId: context.chatId, launchTarget: context.launchTarget }),
});
phoneAppRegistry.register({
  manifest: messagesManifest,
  component: lazyShell(() => import("./apps/messages/shell"), "MessagesShell"),
  props: (context) => ({ phoneId: context.phone.phoneId, openWith: context.launchTarget }),
});
phoneAppRegistry.register({
  manifest: goodleManifest,
  component: lazyShell(() => import("./apps/goodle/shell"), "GoodleShell"),
  props: (context) => ({ phoneId: context.phone.phoneId, initialQuery: context.pendingSearch || context.launchTarget, openNotes: context.settings.installedApps.includes("notes") ? (noteId?: string) => context.openApp("notes", noteId) : undefined }),
});
phoneAppRegistry.register({
  manifest: notesManifest,
  component: lazyShell(() => import("./apps/notes/shell"), "NotesShell"),
  props: (context) => ({ phoneId: context.phone.phoneId, initialNoteId: context.launchTarget }),
});
phoneAppRegistry.register({
  manifest: noodlerManifest,
  component: lazyShell(() => import("./apps/noodler/shell"), "NoodlerShell"),
  props: (context) => ({ phoneId: context.phone.phoneId, ownerName: context.phone.ownerName, chatId: context.chatId, openWeb: context.settings.installedApps.includes("goodle") ? (query: string) => context.openApp("goodle", query) : undefined }),
});
phoneAppRegistry.register({
  manifest: contactsManifest,
  component: lazyShell(() => import("./apps/contacts/shell"), "ContactsShell"),
  requiresChat: true,
  props: (context) => ({
    phoneId: context.phone.phoneId,
    chatId: context.chatId,
    openApp: context.openApp,
    installedApps: context.settings.installedApps,
  }),
});
phoneAppRegistry.register({
  manifest: mailManifest,
  component: lazyShell(() => import("./apps/mail/shell"), "MailShell"),
  props: (context) => ({ phoneId: context.phone.phoneId, ownerName: context.phone.ownerName, chatId: context.chatId }),
});
phoneAppRegistry.register({
  manifest: galleryManifest,
  component: lazyShell(() => import("./apps/gallery/shell"), "GalleryShell"),
  props: (context) => ({
    phoneId: context.phone.phoneId,
    onSettingsPatch: context.onSettingsPatch,
    openApp: context.openApp,
    messagesAvailable: context.settings.installedApps.includes("messages"),
    noodleAvailable: context.settings.installedApps.includes("noodler"),
  }),
});
phoneAppRegistry.register({
  manifest: tindlerManifest,
  component: lazyShell(() => import("./apps/tindler/shell"), "TindlerShell"),
  props: (context) => ({
    phoneId: context.phone.phoneId,
    openMessages: context.settings.installedApps.includes("messages") ? (target: string) => context.openApp("messages", target) : undefined,
  }),
});
phoneAppRegistry.register({
  manifest: noodlerRManifest,
  component: lazyShell(() => import("./apps/noodler-r/shell"), "NoodlerRShell"),
  requiresChat: true,
  props: (context) => ({ phoneId: context.phone.phoneId, chatId: context.chatId }),
});
phoneAppRegistry.register({
  manifest: bankingManifest,
  component: lazyShell(() => import("./apps/banking/shell"), "BankingShell"),
  props: phoneId,
});
phoneAppRegistry.register({
  manifest: bazaarManifest,
  component: lazyShell(() => import("./apps/bazaar/shell"), "BazaarShell"),
  props: phoneId,
});
phoneAppRegistry.register({
  manifest: cameraManifest,
  component: lazyShell(() => import("./apps/camera/shell"), "CameraShell"),
  props: (context) => ({
    phoneId: context.phone.phoneId,
    openGallery: context.settings.installedApps.includes("gallery") ? () => context.openApp("gallery") : undefined,
    openMessages: context.settings.installedApps.includes("messages") ? (draft: string) => context.openApp("messages", { draft }) : undefined,
  }),
});
phoneAppRegistry.register({
  manifest: gameManifest,
  component: lazyShell(() => import("./apps/game/shell"), "GameShell"),
  props: phoneId,
});
phoneAppRegistry.register({
  manifest: shopManifest,
  component: lazyShell(() => import("./apps/shop/shell"), "ShopShell"),
  props: phoneId,
});
phoneAppRegistry.register({
  manifest: mapsManifest,
  component: lazyShell(() => import("./apps/maps/shell"), "MapsShell"),
  props: (context) => ({ phoneId: context.phone.phoneId, chatId: context.chatId, initialQuery: context.launchTarget }),
});
phoneAppRegistry.register({
  manifest: findManifest,
  component: lazyShell(() => import("./apps/find/shell"), "FindShell"),
  props: (context) => ({ phoneId: context.phone.phoneId, chatId: context.chatId, openMaps: context.settings.installedApps.includes("maps") ? (place: string) => { context.openApp("maps", place); } : undefined }),
});

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

/** An app id from `phoneAppRegistry`, or null for the home screen. */
type ActiveApp = string | null;

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
    // Tick on the minute boundary. A plain 30s interval left the displayed time up to 30 seconds
    // stale on one of the two most-looked-at rows of pixels on the device.
    let timer = 0;
    const tick = () => {
      const current = new Date();
      setNow(current);
      timer = window.setTimeout(tick, 60_000 - (current.getSeconds() * 1000 + current.getMilliseconds()));
    };
    tick();
    return () => window.clearTimeout(timer);
  }, []);
  return now;
}

function wallpaperBackground(wallpaper: string) {
  // A photo shared out of the Gallery becomes the wallpaper by storing its URL here.
  if (/^(https?:|data:|\/)/u.test(wallpaper)) return `url("${wallpaper.replace(/"/gu, "%22")}")`;
  if (wallpaper === "midnight") return "linear-gradient(145deg, #111827 0%, #243447 55%, #0f172a 100%)";
  if (wallpaper === "paper") return "linear-gradient(145deg, #fff8e7 0%, #e8dfcc 52%, #f7efe1 100%)";
  return "linear-gradient(145deg, var(--vp-bg), var(--vp-surface))";
}

const signalIcons = [SignalZero, SignalLow, SignalMedium, SignalHigh, SignalHigh] as const;
const signalLabels = ["No", "Weak", "Fair", "Good", "Full"] as const;

function batteryIcon(level: number) {
  if (level <= 10) return BatteryWarning;
  if (level <= 35) return BatteryLow;
  if (level <= 80) return BatteryMedium;
  return BatteryFull;
}

function PhoneOverlay({ chatId }: { chatId: string | null }) {
  const [open, setOpen] = React.useState(false);
  const [phones, setPhones] = React.useState<Phone[]>([]);
  const [session, setSession] = React.useState(() => initialDeviceSession());
  const [switcherOpen, setSwitcherOpen] = React.useState(false);
  /** Set when the model refused access to another character's phone, shown on the lock screen. */
  const [accessDenied, setAccessDenied] = React.useState<string | null>(null);
  const [accessPending, setAccessPending] = React.useState(false);
  const [activeApp, setActiveApp] = React.useState<ActiveApp>(null);
  const [notifications, setNotifications] = React.useState<PhoneNotification[]>([]);
  const [notificationCenterOpen, setNotificationCenterOpen] = React.useState(false);
  const [pendingSearch, setPendingSearch] = React.useState("");
  const [launchTarget, setLaunchTarget] = React.useState("");
  const [showState, setShowState] = React.useState<"idle" | "pending" | "done">("idle");
  const [refState, setRefState] = React.useState<"idle" | "pending" | "done">("idle");
  const [sceneCharacters, setSceneCharacters] = React.useState<Array<{ ownerId: string; ownerName: string }>>([]);
  const [showAudience, setShowAudience] = React.useState("all");
  const routeStacks = React.useRef(new Map<string, AppRouteStackManager>());
  const activeApps = React.useRef(new Map<string, Exclude<ActiveApp, null>>());
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const closeSessionRef = React.useRef<() => void>(() => setOpen(false));
  const now = useClock();

  React.useEffect(() => {
    if (!open || !chatId) return;
    void phoneRequest<ProvisioningResponse>(`/chats/${encodeURIComponent(chatId)}/phones`).then((response) => {
      const available = [
        ...(response.persona ? [response.persona] : []),
        ...response.characters.flatMap((character) => character.phone?.enabled ? [character.phone] : []),
      ];
      setPhones(available);
      setSceneCharacters(response.characters.map(({ ownerId, ownerName }) => ({ ownerId, ownerName })));
      setSession((current) => ({
        ...current,
        selectedPhoneId: available.some((phone) => phone.phoneId === current.selectedPhoneId)
          ? current.selectedPhoneId
          : available[0]?.phoneId ?? "",
      }));
    });
  }, [chatId, open]);

  React.useEffect(() => { setActiveChatId(chatId); }, [chatId]);

  React.useEffect(() => {
    const handleOpen = () => setOpen(true);
    const handleClose = () => closeSessionRef.current();
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
        closeSessionRef.current();
        return;
      }
      if (event.key !== "Tab" || !overlayRef.current) return;
      const controls = [...overlayRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
  // Notifications used to be fetched once, only while open AND on the home screen, so a character
  // texting mid-scene could not reach you from inside an app. Poll on the same 30s cadence the
  // toolbar badge uses, for as long as the phone is open, whatever is on screen.
  const refreshNotifications = React.useCallback(() => {
    if (!selectedPhone) return Promise.resolve();
    return phoneRequest<{ notifications: PhoneNotification[] }>(`/phones/${encodeURIComponent(selectedPhone.phoneId)}/notifications`)
      .then((response) => setNotifications(response.notifications));
  }, [selectedPhone?.phoneId]);
  React.useEffect(() => {
    if (!open || !selectedPhone) {
      if (!selectedPhone) setNotifications([]);
      return;
    }
    const refresh = () => {
      void refreshNotifications()
        .catch(() => undefined);
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(timer);
  }, [open, selectedPhone?.phoneId, refreshNotifications]);
  if (!open) return null;
  const deviceSettings = selectedPhone?.settings ?? defaultDeviceSettings(selectedPhone?.baselineTheme ?? "system");
  const updateSettings = async (patch: Record<string, unknown>) => {
    if (!selectedPhone) return;
    const response = await phoneRequest<{ phone: Phone }>(`/phones/${encodeURIComponent(selectedPhone.phoneId)}/settings`, {
      method: "PATCH", body: JSON.stringify(patch),
    });
    setPhones((current) => current.map((phone) => phone.phoneId === response.phone.phoneId ? response.phone : phone));
  };
  const close = async () => {
    // Flush the session before closing so the last app action cannot race the ledger read.
    if (chatId && selectedPhone) {
      try {
        await waitForPhoneWrites(selectedPhone.phoneId);
        await phoneRequest(`/chats/${encodeURIComponent(chatId)}/phones/${encodeURIComponent(selectedPhone.phoneId)}/session`, {
          method: "POST", body: JSON.stringify({}),
        });
      } catch (cause) {
        console.error(cause instanceof Error ? cause.message : "The phone session could not be recorded.");
      }
      if (selectedPhone.ownerType === "character") releasePhoneAccess(selectedPhone.phoneId);
    }
    // Access to somebody else's phone is a scene-bound lease, not a permanent device selection.
    // Putting it down ends the lease; reopening starts safely on the persona phone and requires a
    // fresh story-aware access verdict before another character device can be entered.
    const personaPhone = phones.find((phone) => phone.ownerType === "persona") ?? phones[0] ?? null;
    setSession((current) => ({ ...current, selectedPhoneId: personaPhone?.phoneId ?? null, surface: "lock" }));
    setNotificationCenterOpen(false);
    setSwitcherOpen(false);
    setAccessDenied(null);
    setOpen(false);
  };
  closeSessionRef.current = () => { void close(); };
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
  const callsUnread = notifications.filter((notification) => notification.appId === "calls").reduce((total, notification) => total + notification.count, 0);
  const notificationCount = notifications.reduce((total, notification) => total + notification.count, 0);
  const effectiveSignal = deviceSettings.connectivity === "offline" ? 0 : deviceSettings.cellularSignal;
  const SignalIcon = signalIcons[effectiveSignal] ?? SignalHigh;
  const signalLabel = signalLabels[effectiveSignal] ?? "Full";
  const BatteryIcon = batteryIcon(deviceSettings.batteryLevel);
  const powered = deviceSettings.power === "on" && deviceSettings.batteryLevel > 0;
  /**
   * Stage 10 — another character's phone opens only if the model judges you could plausibly get at
   * it right now, and picking it up is recorded in the chat so anyone who sees you can react. Your
   * own phone is never gated. The old unconditional switcher survives behind a dev flag, since it
   * is genuinely useful while building.
   */
  const devSwitcher = (() => {
    try {
      return window.localStorage.getItem("marinara_vp_dev_switcher") === "1";
    } catch {
      return false;
    }
  })();
  const switchToPhone = async (phone: Phone) => {
    setSwitcherOpen(false);
    setAccessDenied(null);
    const select = () => setSession((current) => ({ ...current, selectedPhoneId: phone.phoneId }));
    if (devSwitcher || phone.ownerType === "persona" || phone.phoneId === session.selectedPhoneId || !chatId) {
      select();
      return;
    }
    setAccessPending(true);
    try {
      const verdict = await phoneRequest<{ allowed: boolean; reason: string; accessToken?: string }>(
        `/chats/${encodeURIComponent(chatId)}/phones/${encodeURIComponent(phone.phoneId)}/access`,
        { method: "POST", body: JSON.stringify({}) },
      );
      if (verdict.allowed) {
        if (verdict.accessToken) grantPhoneAccess(phone.phoneId, verdict.accessToken);
        select();
        setSession((current) => ({ ...current, surface: "lock" }));
      } else {
        setAccessDenied(verdict.reason || `${phone.ownerName}'s phone is out of reach.`);
      }
    } catch (cause) {
      setAccessDenied(cause instanceof Error ? cause.message : "That phone is out of reach.");
    } finally {
      setAccessPending(false);
    }
  };

  const openApp = (appId: string, target: string | Omit<PhoneLaunchIntent, "version"> = "") => {
    setNotificationCenterOpen(false);
    if (appId === "goodle") setPendingSearch("");
    setLaunchTarget(typeof target === "string" ? target : encodeLaunchIntent(target));
    openAppRoute(appId, "/");
  };
  const dismissNotification = async (notification: PhoneNotification) => {
    if (!selectedPhone) return;
    setNotifications((current) => current.filter((item) => item.id !== notification.id));
    await phoneRequest(`/phones/${encodeURIComponent(selectedPhone.phoneId)}/notifications/${encodeURIComponent(notification.id)}/dismiss`, {
      method: "POST", body: JSON.stringify({}),
    }).catch(() => void refreshNotifications());
  };
  const dismissAllNotifications = async () => {
    if (!selectedPhone || notifications.length === 0) return;
    const pending = notifications;
    setNotifications([]);
    try {
      // The server merges each dismissal into one stored list. Keep these sequential so two
      // simultaneous read-modify-write requests cannot accidentally restore an older item.
      for (const notification of pending) {
        await phoneRequest(
          `/phones/${encodeURIComponent(selectedPhone.phoneId)}/notifications/${encodeURIComponent(notification.id)}/dismiss`,
          { method: "POST", body: JSON.stringify({}) },
        );
      }
    } catch {
      void refreshNotifications();
    }
  };
  const openNotification = async (notification: PhoneNotification) => {
    await dismissNotification(notification);
    setSession(unlockDevice);
    if (phoneAppRegistry.get(notification.appId) && deviceSettings.installedApps.includes(notification.appId)) openApp(notification.appId);
  };
  /** An app is available when it is installed (or not removable) and has the chat it needs. */
  const isAvailable = (app: InstalledApp) =>
    (!app.manifest.removable || deviceSettings.installedApps.includes(app.manifest.id))
    && (!app.requiresChat || Boolean(chatId));
  const appContext: Omit<AppRenderContext, "phone"> = {
    chatId,
    settings: deviceSettings,
    pendingSearch,
    setPendingSearch,
    launchTarget,
    onPhoneChange: (phone) => setPhones((current) => current.map((item) => item.phoneId === phone.phoneId ? phone : item)),
    openApp,
    installedApps: phoneAppRegistry.list().map(({ manifest }) => ({ manifest, installed: deviceSettings.installedApps.includes(manifest.id) })),
    onSettingsPatch: updateSettings,
    onInstalledChange: (appId, installed) => void updateSettings({
      installedApps: installed
        ? [...new Set([...deviceSettings.installedApps, appId])]
        : deviceSettings.installedApps.filter((installedId) => installedId !== appId),
    }),
  };
  const registeredApp = activeApp ? phoneAppRegistry.get(activeApp) : undefined;
  // An unknown id (an app removed from a build, e.g. Forum) or an uninstalled one renders nothing.
  const activeAppEntry = registeredApp && isAvailable(registeredApp) ? registeredApp : undefined;
  const launchableApps = phoneAppRegistry.list()
    .filter((app) => app.launcher !== false && isAvailable(app))
    .map(({ manifest }) => ({
      id: manifest.id,
      label: manifest.name,
      Icon: appGlyph(manifest.id),
      badge: manifest.id === "messages" ? messagesUnread : manifest.id === "calls" ? callsUnread : undefined,
    }));
  const dockIds = deviceSettings.dockApps;
  const quickApps = dockIds.flatMap((id) => launchableApps.filter((app) => app.id === id));
  const drawerApps = launchableApps
    .filter((app) => !dockIds.includes(app.id))
    .sort((left, right) => Number(left.id === "settings") - Number(right.id === "settings"));
  const theme = deviceSettings.theme === "system" ? selectedPhone?.baselineTheme ?? "system" : deviceSettings.theme;
  // The whole device reads the story's clock, not the host machine's.
  const storyTime = storyNow(deviceSettings.storyClockOffsetMinutes, now);
  const clock = storyTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const ConnectivityIcon = deviceSettings.connectivity === "offline" ? WifiOff : deviceSettings.connectivity === "limited" ? WifiLow : Wifi;
  const notificationStamp = (at: string) => {
    const value = new Date(at);
    if (!at || Number.isNaN(value.getTime())) return "";
    const adjusted = storyNow(deviceSettings.storyClockOffsetMinutes, value);
    return adjusted.toDateString() === storyTime.toDateString()
      ? adjusted.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : adjusted.toLocaleDateString([], { weekday: "short" });
  };
  return createPortal(
    <StoryClockProvider value={deviceSettings.storyClockOffsetMinutes}>
    <div ref={overlayRef} className="vp-root" data-chat-floating-panel style={{ ...phoneThemeTokens(theme), ...(deviceSettings.caseColor ? { "--vp-bezel": deviceSettings.caseColor } : {}) } as React.CSSProperties}>
      <style data-virtual-phone-styles>{phoneStylesheet}</style>
      <div className="vp-scrim" aria-hidden="true" onClick={close} />
      <section role="dialog" aria-modal="true" aria-labelledby="virtual-phone-title" className="vp-stage" onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
        <div key={selectedPhone?.phoneId ?? "none"} className={`vp-stage-col ${selectedPhone?.ownerType === "character" ? "vp-slide-down" : "vp-slide-up"}`}>
        <div className="vp-shell">
          <span className="vp-key vp-key--volume" aria-hidden="true" />
          <span className="vp-key vp-key--power" aria-hidden="true" />
          <div className="vp-screen">
            <header className={`vp-statusbar${session.surface === "lock" ? " vp-statusbar--lock" : ""}`}>
              <span id="virtual-phone-title" className="vp-statusbar-clock">{clock}</span>
              {phones.length > 1 ? (
                <button type="button" aria-haspopup="listbox" aria-expanded={switcherOpen} aria-label="Switch phone" onClick={() => setSwitcherOpen((current) => !current)} className="vp-switch-btn">
                  <span>{selectedPhone?.ownerName ?? "Phone"}</span>
                  <ChevronDown size="0.75rem" aria-hidden="true" />
                </button>
              ) : <span aria-hidden="true" />}
              <div className="vp-statusbar-end">
                {/* Reachable from inside an app, which is where a mid-scene text used to be invisible. */}
                {session.surface !== "lock" && notificationCount > 0 ? (
                  <button type="button" className="vp-statusbar-notice" onClick={() => setNotificationCenterOpen(true)} aria-label={`${notificationCount} new ${notificationCount === 1 ? "notification" : "notifications"}, open notification center`}>
                    <span className="vp-badge" aria-hidden="true">{notificationCount > 99 ? "99+" : notificationCount}</span>
                  </button>
                ) : null}
                <span className="vp-statusbar-cluster" aria-label={`${signalLabel} cellular signal, ${deviceSettings.connectivity}`}>
                  <SignalIcon size="0.75rem" aria-hidden="true" />
                  <ConnectivityIcon size="0.75rem" aria-hidden="true" />
                </span>
                <span className="vp-statusbar-cluster" aria-label={`${deviceSettings.batteryLevel}% battery, not charging`}>
                  {deviceSettings.batteryLevel}% <BatteryIcon size="0.875rem" aria-hidden="true" />
                </span>
              </div>
              {switcherOpen ? (
                <div role="listbox" aria-label="Available phones" className="vp-switcher">
                  {phones.map((phone) => (
                    <button key={phone.phoneId} type="button" role="option" aria-selected={phone.phoneId === session.selectedPhoneId} disabled={accessPending} onClick={() => { void switchToPhone(phone); }} className="vp-switcher-option">
                      <span>{phone.ownerName}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </header>
            {/* Denials happen while you're still on your own (unlocked) phone; the lock-screen copy below never shows there. */}
            {accessDenied && session.surface !== "lock" ? (
              <div role="alert" className="vp-access-denied">
                <span>{accessDenied}</span>
                <button type="button" aria-label="Dismiss" onClick={() => setAccessDenied(null)}><X size="0.75rem" aria-hidden="true" /></button>
              </div>
            ) : null}
            <main className="vp-surface-area" style={{ backgroundImage: `${patternBackground(deviceSettings.pattern, deviceSettings.patternIntensity)}, ${deviceSettings.wallpaperTint ? `linear-gradient(${deviceSettings.wallpaperTint}59, ${deviceSettings.wallpaperTint}59)` : "linear-gradient(rgb(0 0 0 / 0), rgb(0 0 0 / 0))"}, ${wallpaperBackground(deviceSettings.wallpaperImage || deviceSettings.wallpaper)}`, backgroundSize: "16px 16px, cover, cover" }}>
              {!powered ? (
                <div className="vp-powered-off">
                  <Smartphone size="2rem" aria-hidden="true" />
                  <strong>{deviceSettings.batteryLevel === 0 ? "Battery empty" : "Phone is off"}</strong>
                  <span>{deviceSettings.batteryLevel === 0 ? "Charge the handset in Settings before turning it on." : "Incoming activity waits until the handset is switched back on."}</span>
                  <button type="button" disabled={deviceSettings.batteryLevel === 0} onClick={() => void updateSettings({ power: "on" })}>Turn on</button>
                </div>
              ) : session.surface === "lock" ? (
                <div className="vp-lock">
                  <div className="vp-lock-hero">
                    <p className="vp-lock-clock">{clock}</p>
                    <p className="vp-lock-date">{storyTime.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p>
                  </div>
                  {accessDenied ? <div role="alert" className="vp-lock-card">{accessDenied}</div> : null}
                  {notifications.length > 0 ? (
                    <div className="vp-lock-list" aria-label="Notifications">
                      {notifications.slice(0, 3).map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          className="vp-lock-card vp-lock-card--notification"
                          onClick={() => void openNotification(notification)}
                        >
                          {React.createElement(appGlyph(notification.appId), { size: "1rem", "aria-hidden": true, className: `vp-lock-app-icon ${appIconClass(notification.appId)}` })}
                          <span className="vp-thread-body"><span className="vp-thread-name">{notification.title}</span><span className="vp-thread-preview">{notification.body}</span>{notification.count > 1 ? <span className="vp-muted-note">{notification.count} new</span> : null}</span>
                          {notificationStamp(notification.at) ? <time className="vp-lock-notification-time">{notificationStamp(notification.at)}</time> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <button type="button" onClick={() => setSession(unlockDevice)} className="vp-unlock-btn"><span>Unlock</span><ChevronRight size="1rem" aria-hidden="true" /></button>
                </div>
              ) : (
                <div className="vp-home">
                  <div aria-label="Installed apps" className="vp-home-apps">
                    <div className="vp-app-grid">
                      {drawerApps.map(({ id, label, Icon, badge }) => (
                        <button key={id} type="button" aria-label={`Open ${label}${badge ? `, ${badge} unread` : ""}`} onClick={() => openApp(id)} className="vp-app">
                          <span className={`vp-app-icon ${appIconClass(id)}`}><Icon size="1.375rem" aria-hidden="true" /></span>
                          {badge ? <span className="vp-badge vp-app-badge" aria-hidden="true">{badge > 99 ? "99+" : badge}</span> : null}
                          <span className="vp-app-label">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {quickApps.length ? <nav aria-label="Phone dock" className="vp-home-dock">{quickApps.map(({ id, label, Icon, badge }) => <button key={id} type="button" aria-label={`Open ${label}${badge ? `, ${badge} unread` : ""}`} onClick={() => openApp(id)} className="vp-dock-app"><span className={`vp-app-icon ${appIconClass(id)}`}><Icon size="1.3rem" aria-hidden="true" /></span>{badge ? <span className="vp-badge vp-app-badge" aria-hidden="true">{badge > 99 ? "99+" : badge}</span> : null}</button>)}</nav> : null}
                </div>
              )}
              {powered && session.surface !== "lock" && activeAppEntry && selectedPhone ? (
                <AppErrorBoundary key={activeAppEntry.manifest.id} appName={activeAppEntry.manifest.name}>
                  <React.Suspense fallback={<div className="vp-appview vp-appview--loading">Loading {activeAppEntry.manifest.name}...</div>}>
                    <activeAppEntry.component
                      {...activeAppEntry.props({ ...appContext, phone: selectedPhone })}
                      onBack={() => backFromApp(activeAppEntry.manifest.id)}
                      onClose={closeApp}
                    />
                  </React.Suspense>
                </AppErrorBoundary>
              ) : null}
              {powered && notificationCenterOpen && session.surface !== "lock" ? (
                <section aria-labelledby="notification-center-title" className="vp-notification-center">
                  <header className="vp-notification-head">
                    <h2 id="notification-center-title">Notifications</h2>
                    <div className="vp-notification-head-actions">
                      {notifications.length ? <button type="button" className="vp-notification-clear" onClick={() => void dismissAllNotifications()}>Clear</button> : null}
                      <button type="button" className="vp-icon-btn" aria-label="Close notification center" onClick={() => setNotificationCenterOpen(false)}><X size="1rem" aria-hidden="true" /></button>
                    </div>
                  </header>
                  {notifications.length === 0 ? (
                    <div className="vp-notification-empty"><Bell size="1.5rem" aria-hidden="true" /><strong>All caught up</strong><span>New activity will appear here.</span></div>
                  ) : (
                    <div className="vp-notification-list">
                      {notifications.map((notification) => {
                        const Icon = appGlyph(notification.appId);
                        return (
                          <article key={notification.id} className="vp-notification-row">
                            <button type="button" className="vp-notification-open" onClick={() => void openNotification(notification)}>
                              <span className={`vp-notification-icon ${appIconClass(notification.appId)}`}><Icon size="1rem" aria-hidden="true" /></span>
                              <span className="vp-thread-body"><span className="vp-thread-name">{notification.title}</span><span className="vp-notification-body">{notification.body}</span><span className="vp-muted-note">{notification.count > 1 ? `${notification.count} new` : phoneAppRegistry.get(notification.appId)?.manifest.name ?? "Phone"}{notificationStamp(notification.at) ? ` · ${notificationStamp(notification.at)}` : ""}</span></span>
                              <ChevronRight size="1rem" aria-hidden="true" className="vp-row-chevron" />
                            </button>
                            <button type="button" className="vp-notification-dismiss" aria-label={`Dismiss ${notification.title}`} onClick={() => void dismissNotification(notification)}><X size="0.875rem" aria-hidden="true" /></button>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              ) : null}
            </main>
            {deviceSettings.screenEffect !== "none" ? <span className={`vp-fx vp-fx--${deviceSettings.screenEffect}`} style={{ opacity: conditionOpacity(deviceSettings.screenEffectIntensity, deviceSettings.reduceDeviceEffects) }} aria-hidden="true" /> : null}
            <span className="vp-home-indicator" aria-hidden="true" />
          </div>
        </div>
        <div className="vp-dock" aria-label="Phone actions">
          <button ref={closeButtonRef} type="button" onClick={close} className="vp-dock-btn vp-dock-btn--primary">
            <X size="0.875rem" aria-hidden="true" /> Put down
          </button>
          <button type="button" disabled={!chatId || !selectedPhone || showState === "pending"} title="Perform the user action of showing this phone screen in the scene" aria-label="Show phone in scene" onClick={() => {
            if (!chatId || !selectedPhone) return;
            setShowState("pending");
            const label = notificationCenterOpen ? "the notification center"
              : session.surface === "lock" ? "the lock screen"
                : activeAppEntry ? `the ${activeAppEntry.manifest.name} app` : "the home screen";
            const screen = overlayRef.current?.querySelector<HTMLElement>(".vp-screen");
            const projection = screen ? projectVisibleScreen(screen, label) : { summary: label, lines: [] };
            const audienceCharacterIds = showAudience === "all" ? sceneCharacters.map(({ ownerId }) => ownerId) : [showAudience];
            void phoneRequest(`/chats/${encodeURIComponent(chatId)}/phones/${encodeURIComponent(selectedPhone.phoneId)}/show`, {
              method: "POST", body: JSON.stringify({ app: activeApp, surface: session.surface, projection, audienceCharacterIds }),
            }).then(() => {
              setShowState("done");
              window.setTimeout(() => setShowState("idle"), 2000);
            }).catch(() => setShowState("idle"));
          }} className="vp-dock-btn">
            <Eye size="0.875rem" aria-hidden="true" /> {showState === "done" ? "Shown ✓" : "Show"}
          </button>
          {sceneCharacters.length > 1 ? <label className="vp-dock-audience"><span className="vp-sr-only">Who can read the shown screen</span><select value={showAudience} onChange={(event) => setShowAudience(event.target.value)}><option value="all">Everyone</option>{sceneCharacters.map((character) => <option key={character.ownerId} value={character.ownerId}>{character.ownerName}</option>)}</select></label> : null}
          <button type="button" disabled={!chatId || !selectedPhone || refState === "pending"} title="Give the model author context without making any character perceive it" aria-label="Add author reference" onClick={() => {
            if (!chatId || !selectedPhone) return;
            setRefState("pending");
            const label = notificationCenterOpen ? "the notification center"
              : session.surface === "lock" ? "the lock screen"
                : activeAppEntry ? `the ${activeAppEntry.manifest.name} app` : "the home screen";
            const screen = overlayRef.current?.querySelector<HTMLElement>(".vp-screen");
            const projection = screen ? projectVisibleScreen(screen, label) : { summary: label, lines: [] };
            void phoneRequest(`/chats/${encodeURIComponent(chatId)}/phones/${encodeURIComponent(selectedPhone.phoneId)}/show`, {
              method: "POST", body: JSON.stringify({ app: activeApp, surface: session.surface, mode: "reference", projection }),
            }).then(() => {
              setRefState("done");
              window.setTimeout(() => setRefState("idle"), 2000);
            }).catch(() => setRefState("idle"));
          }} className="vp-dock-btn">
            <Quote size="0.875rem" aria-hidden="true" /> {refState === "done" ? "Added ✓" : "Context"}
          </button>
        </div>
        </div>
      </section>
    </div>
    </StoryClockProvider>,
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
    // Matches the in-device notification cadence, so the closed-phone badge is never a minute behind.
    const timer = window.setInterval(refresh, 30_000);
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
