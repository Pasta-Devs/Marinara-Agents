import React from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { BatteryMedium, ChevronDown, Search, Settings, Signal, Smartphone, Store, WifiOff, X } from "lucide-react";
import { PhonesSettings, type Phone, type ProvisioningResponse } from "./system/PhonesSettings";
import { phoneThemeTokens } from "./device/theme";
import { defaultPhoneStatus } from "./device/status";
import { initialDeviceSession, unlockDevice } from "./device/surfaces";
import { phoneRequest } from "./platform/api";
import { conditionOpacity, patternBackground } from "./device/effects";
import { InstalledAppRegistry } from "./platform/app-registry";
import { AppRouteStackManager } from "./platform/app-lifecycle";
import { settingsManifest } from "./apps/settings/manifest";
import { appStoreManifest } from "./apps/app-store/manifest";
import { goodleManifest } from "./apps/goodle/manifest";

const SettingsApp = React.lazy(() => import("./apps/settings/shell").then((module) => ({ default: module.SettingsShell })));
const AppStoreApp = React.lazy(() => import("./apps/app-store/shell").then((module) => ({ default: module.AppStoreShell })));
const GoodleApp = React.lazy(() => import("./apps/goodle/shell").then((module) => ({ default: module.GoodleShell })));
export const phoneAppRegistry = new InstalledAppRegistry();
phoneAppRegistry.register({ manifest: settingsManifest, load: async () => import("./apps/settings/shell") });
phoneAppRegistry.register({ manifest: appStoreManifest, load: async () => import("./apps/app-store/shell") });
phoneAppRegistry.register({ manifest: goodleManifest, load: async () => import("./apps/goodle/shell") });

const PHONE_OPEN_EVENT = "marinara-virtual-phone-open";
const PHONE_CLOSE_EVENT = "marinara-virtual-phone-close";
let phoneOpener: HTMLElement | null = null;

function dispatchPhoneEvent(type: string) {
  window.dispatchEvent(new CustomEvent(type));
}

type ActiveApp = "settings" | "app-store" | "goodle" | null;

function appIconStyle(appId: string) {
  if (appId === "settings") return "bg-amber-500/20 text-amber-700 dark:text-amber-300";
  if (appId === "app-store") return "bg-sky-500/20 text-sky-700 dark:text-sky-300";
  if (appId === "goodle") return "bg-rose-500/20 text-rose-700 dark:text-rose-300";
  return "bg-[var(--vp-surface)] text-[var(--vp-text)]";
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
        phoneOpener?.focus();
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
    };
  }, [open]);

  const selectedPhone = phones.find((phone) => phone.phoneId === session.selectedPhoneId) ?? phones[0] ?? null;
  React.useEffect(() => {
    setActiveApp(selectedPhone ? activeApps.current.get(selectedPhone.phoneId) ?? null : null);
  }, [selectedPhone?.phoneId]);
  if (!open) return null;
  const deviceSettings = selectedPhone?.settings ?? {
    deviceName: "", wallpaper: "gradient", theme: selectedPhone?.baselineTheme ?? "system",
    pattern: "none" as const, patternIntensity: 0 as const, reduceDeviceEffects: false,
    installedApps: ["settings", "app-store", "goodle"],
  };
  const updateSettings = async (patch: Record<string, unknown>) => {
    if (!selectedPhone) return;
    const response = await phoneRequest<{ phone: Phone }>(`/phones/${encodeURIComponent(selectedPhone.phoneId)}/settings`, {
      method: "PATCH", body: JSON.stringify(patch),
    });
    setPhones((current) => current.map((phone) => phone.phoneId === response.phone.phoneId ? response.phone : phone));
  };
  const close = () => {
    dispatchPhoneEvent(PHONE_CLOSE_EVENT);
    phoneOpener?.focus();
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
  return createPortal(
    <div ref={overlayRef} className="fixed inset-0 z-[10020]" data-chat-floating-panel style={phoneThemeTokens(theme) as React.CSSProperties}>
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" aria-hidden="true" onClick={close} />
      <section role="dialog" aria-modal="true" aria-labelledby="virtual-phone-title" className="absolute inset-y-0 right-0 flex w-full items-center justify-end p-3 sm:p-6">
        <div className="relative flex w-[min(calc(100vw-1.5rem),calc((100dvh-1.5rem)*9/19.5),396px)] aspect-[9/19.5] flex-col rounded-[42px] border-[10px] border-[var(--vp-bezel,#11151d)] bg-[var(--vp-bezel,#11151d)] p-1 shadow-[0_24px_80px_rgb(0_0_0_/_0.4),0_2px_8px_rgb(0_0_0_/_0.35)] ring-1 ring-white/20 sm:w-[min(calc(100vw-3rem),calc(88dvh*9/19.5),396px)] sm:border-[12px] sm:rounded-[46px]">
          <span className="pointer-events-none absolute left-1/2 top-0 z-30 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-[var(--vp-bezel,#11151d)] sm:h-7 sm:w-32" aria-hidden="true"><span className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/20 sm:top-2.5" /></span>
          <span className="pointer-events-none absolute -left-3 top-24 h-12 w-1 rounded-l-full bg-[var(--vp-bezel,#11151d)] shadow-[0_72px_0_var(--vp-bezel),0_128px_0_var(--vp-bezel)] sm:-left-4" aria-hidden="true" />
          <span className="pointer-events-none absolute -right-3 top-32 h-20 w-1 rounded-r-full bg-[var(--vp-bezel,#11151d)] sm:-right-4" aria-hidden="true" />
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px] bg-[var(--vp-bg,#edf2f1)] text-[var(--vp-text,#192321)] sm:rounded-[34px]">
            <header className="relative grid min-h-12 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 pt-1 text-[0.6875rem] font-semibold sm:min-h-14 sm:px-5 sm:pt-2">
              <span className="flex items-center gap-1" aria-label="Full cellular signal and Wi-Fi off">
                <Signal size="0.75rem" aria-hidden="true" />
                <WifiOff size="0.75rem" aria-hidden="true" />
              </span>
              <span id="virtual-phone-title" className="min-w-0 truncate text-center">{new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              <div className="flex min-w-0 items-center justify-end gap-1.5">
                <span className="inline-flex items-center gap-1" aria-label={`${status.batteryLevel}% battery, not charging`}>
                  {status.batteryLevel}% <BatteryMedium size="0.875rem" aria-hidden="true" />
                </span>
                <button type="button" aria-haspopup="listbox" aria-expanded={switcherOpen} aria-label="Switch phone" onClick={() => setSwitcherOpen((current) => !current)} className="inline-flex min-h-9 max-w-28 items-center gap-1 rounded-md px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]">
                  <span className="truncate">{selectedPhone?.ownerName ?? "Phone"}</span>
                  <ChevronDown size="0.75rem" aria-hidden="true" />
                </button>
              </div>
              {switcherOpen ? (
                <div role="listbox" aria-label="Available phones" className="absolute right-3 top-12 z-20 max-w-[calc(100%-1.5rem)] w-48 space-y-1 rounded-xl border border-black/10 bg-[var(--vp-surface)] p-2 text-[var(--vp-text)] shadow-xl">
                  {phones.map((phone) => (
                    <button key={phone.phoneId} type="button" role="option" aria-selected={phone.phoneId === session.selectedPhoneId} onClick={() => { setSession((current) => ({ ...current, selectedPhoneId: phone.phoneId })); setSwitcherOpen(false); }} className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-xs hover:bg-[var(--vp-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]">
                      <span className="truncate">{phone.ownerName}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </header>
            <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden" style={{ backgroundImage: `${patternBackground(deviceSettings.pattern, deviceSettings.patternIntensity)}, ${wallpaperBackground(deviceSettings.wallpaper)}`, backgroundSize: "16px 16px, cover" }}>
              {session.surface === "lock" ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
                  <div>
                    <p className="text-4xl font-light tabular-nums">{new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
                    <p className="mt-1 text-xs text-[var(--vp-muted)]">{new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p>
                  </div>
                  <div className="min-h-20 w-full rounded-[var(--vp-radius)] bg-[var(--vp-surface)]/55 p-4 text-xs text-[var(--vp-muted)]">No notifications</div>
                     <button type="button" onClick={() => setSession(unlockDevice)} className="min-h-11 rounded-xl bg-[var(--vp-surface)] px-5 text-xs font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]">Unlock</button>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col p-5">
                   <div className="flex justify-end">
                     <button type="button" aria-label="Device settings" title="Device settings" onClick={() => openAppRoute("settings", "/")} className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--vp-surface)]/75 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]"><Settings size="1rem" aria-hidden="true" /></button>
                  </div>
                  <label className="mt-2 block">
                    <span className="sr-only">Web Search</span>
                    <input type="search" disabled placeholder="Web Search" className="min-h-11 w-full rounded-[var(--vp-radius)] border-0 bg-[var(--vp-surface)]/80 px-4 text-sm text-[var(--vp-text)] shadow-sm placeholder:text-[var(--vp-muted)] disabled:opacity-100" />
                  </label>
                   <div className="min-h-24 flex-1" aria-hidden="true" />
                   <div aria-label="Installed apps" className="grid grid-cols-4 gap-x-3 gap-y-5 px-1 pb-2">
                      <button type="button" aria-label="Open Settings" onClick={() => openAppRoute("settings", "/")} className="group flex min-w-0 flex-col items-center justify-start gap-1.5 rounded-xl text-[var(--vp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]">
                       <span className={`flex aspect-square w-full max-w-[4.25rem] items-center justify-center rounded-[18px] shadow-[inset_0_1px_rgb(255_255_255_/_0.35),0_4px_10px_rgb(0_0_0_/_0.12)] transition-transform group-active:scale-[0.96] ${appIconStyle("settings")}`}><Settings size="1.5rem" aria-hidden="true" /></span>
                       <span className="text-[0.625rem]">Settings</span>
                     </button>
                     <button type="button" aria-label="Open App Store" onClick={() => openAppRoute("app-store", "/")} className="group flex min-w-0 flex-col items-center justify-start gap-1.5 rounded-xl text-[var(--vp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]"><span className={`flex aspect-square w-full max-w-[4.25rem] items-center justify-center rounded-[18px] shadow-[inset_0_1px_rgb(255_255_255_/_0.35),0_4px_10px_rgb(0_0_0_/_0.12)] transition-transform group-active:scale-[0.96] ${appIconStyle("app-store")}`}><Store size="1.5rem" aria-hidden="true" /></span><span className="text-[0.625rem]">App Store</span></button>
                     {deviceSettings.installedApps.includes("goodle") ? <button type="button" aria-label="Open Goodle" onClick={() => openAppRoute("goodle", "/")} className="group flex min-w-0 flex-col items-center justify-start gap-1.5 rounded-xl text-[var(--vp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]"><span className={`flex aspect-square w-full max-w-[4.25rem] items-center justify-center rounded-[18px] shadow-[inset_0_1px_rgb(255_255_255_/_0.35),0_4px_10px_rgb(0_0_0_/_0.12)] transition-transform group-active:scale-[0.96] ${appIconStyle("goodle")}`}><Search size="1.5rem" aria-hidden="true" /></span><span className="text-[0.625rem]">Goodle</span></button> : null}
                     {Array.from({ length: deviceSettings.installedApps.includes("goodle") ? 1 : 2 }, (_, index) => <span key={index} aria-hidden="true" className="aspect-square w-full max-w-[4.25rem] rounded-[18px] border border-dashed border-[var(--vp-muted)]/20" />)}
                   </div>
                 </div>
               )}
               {activeApp === "settings" && selectedPhone ? <React.Suspense fallback={<div className="absolute inset-0 z-10 bg-[var(--vp-bg)] p-5 text-xs">Loading Settings...</div>}><SettingsApp phone={{ ...selectedPhone, settings: { ...deviceSettings, theme } }} onPhoneChange={(phone) => setPhones((current) => current.map((item) => item.phoneId === phone.phoneId ? phone : item))} onBack={() => backFromApp("settings")} onClose={closeApp} /></React.Suspense> : null}
               {activeApp === "app-store" && selectedPhone ? <React.Suspense fallback={<div className="absolute inset-0 z-10 bg-[var(--vp-bg)] p-5 text-xs">Loading App Store...</div>}><AppStoreApp apps={phoneAppRegistry.list().map(({ manifest }) => ({ manifest, installed: deviceSettings.installedApps.includes(manifest.id) }))} onInstalledChange={(appId, installed) => void updateSettings({ installedApps: installed ? [...new Set([...deviceSettings.installedApps, appId])] : deviceSettings.installedApps.filter((installedId) => installedId !== appId) })} onBack={() => backFromApp("app-store")} onClose={closeApp} /></React.Suspense> : null}
               {activeApp === "goodle" && deviceSettings.installedApps.includes("goodle") ? <React.Suspense fallback={<div className="absolute inset-0 z-10 bg-[var(--vp-bg)] p-5 text-xs">Loading Goodle...</div>}><GoodleApp onBack={() => backFromApp("goodle")} onClose={closeApp} /></React.Suspense> : null}
               <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 mix-blend-multiply" style={{ opacity: conditionOpacity(1, deviceSettings.reduceDeviceEffects), backgroundImage: "linear-gradient(35deg, transparent 47%, rgb(20 20 20 / 0.22) 48%, transparent 49%), linear-gradient(125deg, transparent 62%, rgb(20 20 20 / 0.16) 63%, transparent 64%)", backgroundSize: "52% 38%, 68% 55%" }} data-virtual-phone-condition="cracks" />
               <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 mix-blend-multiply" style={{ opacity: conditionOpacity(1, deviceSettings.reduceDeviceEffects), backgroundImage: "radial-gradient(ellipse at 20% 28%, rgb(20 20 20 / 0.12), transparent 24%), radial-gradient(ellipse at 78% 64%, rgb(20 20 20 / 0.09), transparent 20%)" }} data-virtual-phone-condition="smudge" />
               <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 mix-blend-multiply" style={{ opacity: conditionOpacity(1, deviceSettings.reduceDeviceEffects), backgroundImage: "radial-gradient(ellipse at 88% 18%, rgb(100 15 15 / 0.13), transparent 24%), radial-gradient(ellipse at 8% 82%, rgb(100 15 15 / 0.08), transparent 18%)" }} data-virtual-phone-condition="blood" />
            </main>
            <footer className="shrink-0 border-t border-black/5 bg-[var(--vp-bg)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"><button ref={closeButtonRef} type="button" onClick={close} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--vp-accent,#2c8979)] px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent,#2c8979)] focus-visible:ring-offset-2">
               <X size="0.875rem" aria-hidden="true" /> Put down
             </button></footer>
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
