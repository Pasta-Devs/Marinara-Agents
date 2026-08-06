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

function PhoneOverlay({ chatId }: { chatId: string | null }) {
  const [open, setOpen] = React.useState(false);
  const [phones, setPhones] = React.useState<Phone[]>([]);
  const [session, setSession] = React.useState(() => initialDeviceSession());
  const [switcherOpen, setSwitcherOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [appStoreOpen, setAppStoreOpen] = React.useState(false);
  const [goodleOpen, setGoodleOpen] = React.useState(false);
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

  if (!open) return null;
  const selectedPhone = phones.find((phone) => phone.phoneId === session.selectedPhoneId) ?? phones[0] ?? null;
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
  return createPortal(
    <div ref={overlayRef} className="fixed inset-0 z-[10020]" data-chat-floating-panel style={phoneThemeTokens(selectedPhone?.baselineTheme ?? "system") as React.CSSProperties}>
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" aria-hidden="true" onClick={close} />
      <section role="dialog" aria-modal="true" aria-labelledby="virtual-phone-title" className="absolute inset-y-0 right-0 flex w-full max-w-[calc(100vw-1rem)] items-center justify-center p-3 sm:p-6">
        <div className="relative flex h-[min(88vh,860px)] aspect-[9/19.5] max-h-full min-h-[28rem] max-w-full flex-col rounded-[40px] border-[12px] border-[var(--vp-bezel,#11151d)] bg-[var(--vp-bg,#edf2f1)] p-1 shadow-2xl ring-1 ring-white/15">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] bg-[var(--vp-bg,#edf2f1)] text-[var(--vp-text,#192321)]">
            <header className="relative flex min-h-11 items-center justify-between px-4 text-[0.6875rem] font-semibold">
              <span className="flex items-center gap-1" aria-label="Full cellular signal and Wi-Fi off">
                <Signal size="0.75rem" aria-hidden="true" />
                <WifiOff size="0.75rem" aria-hidden="true" />
              </span>
              <span id="virtual-phone-title">{new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1" aria-label={`${status.batteryLevel}% battery, not charging`}>
                  {status.batteryLevel}% <BatteryMedium size="0.875rem" aria-hidden="true" />
                </span>
                <button type="button" aria-haspopup="listbox" aria-expanded={switcherOpen} aria-label="Switch phone" onClick={() => setSwitcherOpen((current) => !current)} className="inline-flex min-h-9 max-w-28 items-center gap-1 rounded-md px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]">
                  <span className="truncate">{selectedPhone?.ownerName ?? "Phone"}</span>
                  <ChevronDown size="0.75rem" aria-hidden="true" />
                </button>
              </div>
              {switcherOpen ? (
                <div role="listbox" aria-label="Available phones" className="absolute right-3 top-10 z-20 w-48 space-y-1 rounded-md border border-black/10 bg-[var(--vp-surface)] p-2 text-[var(--vp-text)] shadow-xl">
                  {phones.map((phone) => (
                    <button key={phone.phoneId} type="button" role="option" aria-selected={phone.phoneId === session.selectedPhoneId} onClick={() => { setSession((current) => ({ ...current, selectedPhoneId: phone.phoneId })); setSwitcherOpen(false); }} className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-xs hover:bg-[var(--vp-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]">
                      <span className="truncate">{phone.ownerName}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </header>
            <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(145deg,var(--vp-bg),var(--vp-surface))]" style={{ backgroundImage: `${patternBackground(deviceSettings.pattern, deviceSettings.patternIntensity)}, linear-gradient(145deg,var(--vp-bg),var(--vp-surface))`, backgroundSize: "16px 16px, cover" }}>
              {session.surface === "lock" ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
                  <div>
                    <p className="text-4xl font-light tabular-nums">{new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
                    <p className="mt-1 text-xs text-[var(--vp-muted)]">{new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p>
                  </div>
                  <div className="min-h-20 w-full rounded-[var(--vp-radius)] bg-[var(--vp-surface)]/55 p-4 text-xs text-[var(--vp-muted)]">No notifications</div>
                  <button type="button" onClick={() => setSession(unlockDevice)} className="min-h-11 rounded-lg bg-[var(--vp-surface)] px-5 text-xs font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]">Unlock</button>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col p-5">
                  <div className="flex justify-end">
                    <button type="button" aria-label="Device settings" title="Device settings" onClick={() => setSettingsOpen(true)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--vp-surface)]/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]"><Settings size="1rem" aria-hidden="true" /></button>
                  </div>
                  <label className="mt-2 block">
                    <span className="sr-only">Web Search</span>
                    <input type="search" disabled placeholder="Web Search" className="min-h-11 w-full rounded-[var(--vp-radius)] border-0 bg-[var(--vp-surface)]/80 px-4 text-sm text-[var(--vp-text)] shadow-sm placeholder:text-[var(--vp-muted)] disabled:opacity-100" />
                  </label>
                  <div className="min-h-24 flex-1" aria-hidden="true" />
                  <div aria-label="Installed apps" className="grid min-h-36 grid-cols-4 grid-rows-2 gap-3 rounded-[var(--vp-radius)] bg-[var(--vp-surface)]/35 p-3">
                    <button type="button" aria-label="Open Settings" onClick={() => setSettingsOpen(true)} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl bg-[var(--vp-surface)] text-[var(--vp-text)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]">
                      <Settings size="1.25rem" aria-hidden="true" />
                      <span className="text-[0.625rem]">Settings</span>
                    </button>
                    <button type="button" aria-label="Open App Store" onClick={() => setAppStoreOpen(true)} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl bg-[var(--vp-surface)] text-[var(--vp-text)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]"><Store size="1.25rem" aria-hidden="true" /><span className="text-[0.625rem]">App Store</span></button>
                    {deviceSettings.installedApps.includes("goodle") ? <button type="button" aria-label="Open Goodle" onClick={() => setGoodleOpen(true)} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl bg-[var(--vp-surface)] text-[var(--vp-text)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]"><Search size="1.25rem" aria-hidden="true" /><span className="text-[0.625rem]">Goodle</span></button> : null}
                    {Array.from({ length: deviceSettings.installedApps.includes("goodle") ? 5 : 6 }, (_, index) => <span key={index} aria-hidden="true" className="aspect-square rounded-xl border border-dashed border-[var(--vp-muted)]/20" />)}
                  </div>
                </div>
              )}
              {settingsOpen && selectedPhone ? <React.Suspense fallback={<div className="absolute inset-0 z-10 bg-[var(--vp-bg)] p-5 text-xs">Loading Settings...</div>}><SettingsApp phone={selectedPhone} onPhoneChange={(phone) => setPhones((current) => current.map((item) => item.phoneId === phone.phoneId ? phone : item))} onClose={() => setSettingsOpen(false)} /></React.Suspense> : null}
              {appStoreOpen && selectedPhone ? <React.Suspense fallback={<div className="absolute inset-0 z-10 bg-[var(--vp-bg)] p-5 text-xs">Loading App Store...</div>}><AppStoreApp apps={phoneAppRegistry.list().map(({ manifest }) => ({ manifest, installed: deviceSettings.installedApps.includes(manifest.id) }))} onInstalledChange={(appId, installed) => void updateSettings({ installedApps: installed ? [...new Set([...deviceSettings.installedApps, appId])] : deviceSettings.installedApps.filter((installedId) => installedId !== appId) })} onClose={() => setAppStoreOpen(false)} /></React.Suspense> : null}
              {goodleOpen && deviceSettings.installedApps.includes("goodle") ? <React.Suspense fallback={<div className="absolute inset-0 z-10 bg-[var(--vp-bg)] p-5 text-xs">Loading Goodle...</div>}><GoodleApp onClose={() => setGoodleOpen(false)} /></React.Suspense> : null}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20" style={{ opacity: conditionOpacity(0, deviceSettings.reduceDeviceEffects) }} data-virtual-phone-condition="cracks" />
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20" style={{ opacity: conditionOpacity(0, deviceSettings.reduceDeviceEffects) }} data-virtual-phone-condition="smudge" />
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20" style={{ opacity: conditionOpacity(0, deviceSettings.reduceDeviceEffects) }} data-virtual-phone-condition="blood" />
            </main>
            <button ref={closeButtonRef} type="button" onClick={close} className="mx-4 mb-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--vp-accent,#2c8979)] px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent,#2c8979)] focus-visible:ring-offset-2">
              <X size="0.875rem" aria-hidden="true" /> Put down
            </button>
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
