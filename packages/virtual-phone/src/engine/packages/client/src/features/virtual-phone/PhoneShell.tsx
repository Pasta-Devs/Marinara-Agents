import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchApps, fetchPage, phoneStorageIdentity, readBackground, readInstalled, readSession, writeBackground, writeInstalled, writeSession } from "./api";
import type { CapabilityProps, HistoryEntry, PhoneApp, PhoneBackground, PhoneInteraction, PhoneOwner } from "./types";

type Screen = { kind: "home" } | { kind: "store" } | { kind: "settings" } | { kind: "app" };

type PhoneRuntimeState = {
  owner: PhoneOwner;
  screen: Screen;
  entries: HistoryEntry[];
  index: number;
  current?: HistoryEntry;
  loading: boolean;
  error: string;
};

/**
 * Injected into every generated page. It runs inside a frame sandboxed WITHOUT
 * allow-same-origin, so it can post navigation intents to the shell but cannot
 * reach the host document, its storage, or its cookies.
 */
const NAVIGATION_BRIDGE = (url: string) => `<script>
  window.__phoneUrl = ${JSON.stringify(url)};
  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var action = new URL(form.getAttribute("action") || window.__phoneUrl, window.__phoneUrl);
    if ((form.getAttribute("method") || "get").toLowerCase() === "get") {
      for (var i = 0; i < form.elements.length; i++) {
        var field = form.elements[i];
        if (field.name) action.searchParams.set(field.name, field.value);
      }
    }
    var data = {};
    new FormData(form).forEach(function (value, key) { data[key] = value; });
    parent.postMessage({ type: "virtual-phone-navigate", url: action.href, formData: data,
      action: "Submitted " + (form.getAttribute("aria-label") || form.id || "form") }, "*");
  }, true);
  document.addEventListener("click", function (event) {
    var link = event.target && event.target.closest ? event.target.closest("a") : null;
    if (!link || !link.href || link.target === "_blank" || link.closest("form")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var label = (link.getAttribute("aria-label") || link.textContent || link.href).trim().replace(/\\s+/g, " ").slice(0, 160);
    parent.postMessage({ type: "virtual-phone-navigate", url: link.href, action: "Tapped " + label }, "*");
  }, true);
</script>`;

const PHONE_STYLES = `
@keyframes marinara-phone-slide-in {
  from { opacity: 0; transform: translateY(22px) scale(.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
[data-marinara-phone-frame] { animation: marinara-phone-slide-in .24s cubic-bezier(.22,1,.36,1); }
[data-marinara-phone-screen] { animation: marinara-phone-fade .18s ease-out; }
@keyframes marinara-phone-fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  [data-marinara-phone-frame], [data-marinara-phone-screen] { animation: none; }
}
`;

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function AppIcon({ app, size = 56 }: { app: Pick<PhoneApp, "icon" | "name">; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        background: "linear-gradient(160deg, color-mix(in srgb, var(--primary, #ffb3d9) 26%, #2a2a32), #1b1b21)",
        boxShadow: "0 2px 8px rgb(0 0 0 / 38%), inset 0 1px 0 rgb(255 255 255 / 12%)",
        fontSize: Math.round(size * 0.5),
      }}
    >
      {app.icon}
    </span>
  );
}

export function PhoneShell({ props }: { props: CapabilityProps }) {
  const chatId = props.chatId;
  const observerEnabled = props.metadata?.virtualPhoneObserverEnabled === true;
  const owner: PhoneOwner = props.phoneOwner ?? {
    kind: "chat",
    id: chatId || "active-chat",
    name: "This chat",
  };
  const personaId = typeof props.metadata?.personaId === "string" ? props.metadata.personaId : undefined;
  const characterIds = Array.isArray(props.metadata?.characterIds) ? props.metadata.characterIds.filter((id): id is string => typeof id === "string") : undefined;
  const phoneIdentity = phoneStorageIdentity({ chatId, owner, personaId, characterIds });
  const emitInteraction = (interaction: PhoneInteraction) => props.onPhoneInteraction?.(interaction);

  const [apps, setApps] = useState<PhoneApp[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const [background, setBackground] = useState<PhoneBackground>(() => readBackground(phoneIdentity));
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [index, setIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const pageNotes = useRef(new Map<string, string>());

  const current = index >= 0 ? entries[index] : undefined;
  const appsById = useMemo(() => new Map(apps.map((app) => [app.id, app])), [apps]);
  const clock = useClock();

  useEffect(() => {
    setBackground(readBackground(phoneIdentity));
  }, [phoneIdentity]);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError("");
    fetchApps()
      .then((catalog) => {
        if (cancelled) return;
        setApps(catalog.apps);
        setInstalled(readInstalled(phoneIdentity, catalog.defaults));
      })
      .catch((cause: unknown) => {
        if (!cancelled) setCatalogError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chatId, phoneIdentity]);

  useEffect(() => {
    const session = readSession(phoneIdentity);
    if (!session) return;
    setEntries(session.entries);
    setIndex(session.index);
  }, [phoneIdentity]);

  const open = useCallback(
    async (
      app: PhoneApp,
      url: string,
      options: { lastAction?: string; formData?: Record<string, unknown>; refresh?: boolean } = {},
    ) => {
      setScreen({ kind: "app" });
      setLoading(true);
      setError("");
      const cachedIndex = entries.findIndex((entry) => entry.appId === app.id && entry.url === url);
      if (cachedIndex >= 0 && !options.refresh && !options.lastAction && !options.formData) {
        setIndex(cachedIndex);
        setLoading(false);
         writeSession(phoneIdentity, entries, cachedIndex);
        return;
      }
      try {
        const page = await fetchPage({
           chatId,
          appId: app.id,
          url,
          connectionId: props.connectionId,
          chatConnectionId: typeof props.metadata?.connectionId === "string" ? props.metadata.connectionId : undefined,
          refresh: options.refresh,
          lastAction: options.lastAction,
          formData: options.formData,
          pageHistory: pageNotes.current.get(url),
          navHistory: entries.slice(Math.max(0, index - 2), index + 1).map((entry) => ({ url: entry.url, title: entry.title })),
           context: {
             ...(props.context || {}),
             personaId,
             characterIds,
           },
           phoneOwner: owner,
           phoneIdentity: phoneIdentity || undefined,
        });
        const entry: HistoryEntry = { url: page.url, appId: page.appId, title: page.title, html: page.html };
        setEntries((previous) => {
          const next = [...previous.slice(0, index + 1), entry];
          setIndex(next.length - 1);
           writeSession(phoneIdentity, next, next.length - 1);
          return next;
        });
        if (page.observerText) {
          pageNotes.current.set(page.url, page.observerText);
          if (observerEnabled) {
            props.onObserver?.({ text: page.observerText, name: page.observerName, url: page.url });
          }
        }
      } catch (cause: unknown) {
        setError(cause instanceof DOMException && cause.name === "AbortError"
          ? "That screen took too long to load. Try again."
          : cause instanceof Error ? cause.message : String(cause));
      } finally {
        setLoading(false);
      }
    },
    [chatId, entries, index, observerEnabled, owner, phoneIdentity, props],
  );

  // Navigation intents from inside the sandboxed frame.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const detail = event.data as { type?: string; url?: string; action?: string; formData?: Record<string, unknown> };
      if (detail?.type !== "virtual-phone-navigate" || typeof detail.url !== "string") return;
      const target = apps.find((app) => {
        try {
          return new URL(detail.url as string, "https://phone.local").hostname.endsWith(app.domain);
        } catch {
          return false;
        }
      });
      const targetApp = target ?? (current ? appsById.get(current.appId) : undefined);
      if (!targetApp) return;
      emitInteraction({ type: "navigate", owner, appId: targetApp.id, url: detail.url, action: detail.action });
      void open(targetApp, detail.url, { lastAction: detail.action, formData: detail.formData });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [apps, appsById, current, emitInteraction, open]);

  const toggleInstall = (appId: string) => {
    setInstalled((previous) => {
      const next = previous.includes(appId) ? previous.filter((id) => id !== appId) : [...previous, appId];
       writeInstalled(phoneIdentity, next);
      return next;
    });
  };

  const goHome = () => {
    setScreen({ kind: "home" });
    setError("");
  };

  const goBack = () => {
    if (screen.kind === "app" && index > 0) {
      const next = index - 1;
      setIndex(next);
      setError("");
      writeSession(phoneIdentity, entries, next);
      return;
    }
    setScreen({ kind: "home" });
    setError("");
  };

  // Back walks the cached history: no model call, no cost, no regenerated feed.
  const canGoBack = screen.kind !== "home";

  const homeApps = installed.map((id) => appsById.get(id)).filter((app): app is PhoneApp => Boolean(app));

  const runtime: PhoneRuntimeState = { owner, screen, entries, index, current, loading, error };

  return (
    <PhoneOsShell
      runtime={runtime}
      background={background}
      apps={apps}
      homeApps={homeApps}
      installed={installed}
      catalogLoading={catalogLoading}
      catalogError={catalogError}
      clock={clock}
      observerEnabled={observerEnabled}
      canGoBack={canGoBack}
      onBack={goBack}
      onHome={() => {
        goHome();
        emitInteraction({ type: "home", owner });
      }}
      onStore={() => {
        setScreen({ kind: "store" });
        emitInteraction({ type: "store", owner });
      }}
      onSettings={() => setScreen({ kind: "settings" })}
      onBackgroundChange={(value) => {
        setBackground(value);
        writeBackground(phoneIdentity, value);
      }}
      onOpenApp={(app) => {
        const url = `https://${app.domain}/`;
        emitInteraction({ type: "open-app", owner, appId: app.id, url });
        void open(app, url);
      }}
      onToggleInstall={toggleInstall}
      onObserverToggle={() => props.updateMetadata?.({ virtualPhoneObserverEnabled: !observerEnabled })}
      onClose={props.onClose}
    />
  );
}

type PhoneOsShellProps = {
  runtime: PhoneRuntimeState;
  background: PhoneBackground;
  apps: PhoneApp[];
  homeApps: PhoneApp[];
  installed: string[];
  catalogLoading: boolean;
  catalogError: string;
  clock: string;
  observerEnabled: boolean;
  canGoBack: boolean;
  onBack: () => void;
  onHome: () => void;
  onStore: () => void;
  onSettings: () => void;
  onBackgroundChange: (background: PhoneBackground) => void;
  onOpenApp: (app: PhoneApp) => void;
  onToggleInstall: (appId: string) => void;
  onObserverToggle: () => void;
  onClose?: () => void;
};

function PhoneOsShell({
  runtime,
  background,
  apps,
  homeApps,
  installed,
  catalogLoading,
  catalogError,
  clock,
  observerEnabled,
  canGoBack,
  onBack,
  onHome,
  onStore,
  onSettings,
  onBackgroundChange,
  onOpenApp,
  onToggleInstall,
  onObserverToggle,
  onClose,
}: PhoneOsShellProps) {
  const { screen, current, loading, error, owner } = runtime;
  return (
    <section aria-label={`${owner.name || "Phone"} phone`} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", width: "100%", maxWidth: 414, flex: "0 0 auto", minHeight: 0, padding: 12, background: "var(--background, #101010)", color: "var(--foreground, #f5f5f5)", boxSizing: "border-box" }}>
      <style>{PHONE_STYLES}</style>
      <div data-marinara-phone-frame style={{ display: "flex", flexDirection: "column", width: "100%", maxWidth: 390, height: "100%", maxHeight: 844, minHeight: 0, borderRadius: 38, border: "1px solid rgb(255 255 255 / 18%)", background: "#0b0b0f", boxShadow: "0 24px 70px rgb(0 0 0 / 55%)", overflow: "hidden", boxSizing: "border-box" }}>
        <PhoneStatusBar clock={clock} canGoBack={canGoBack} observerEnabled={observerEnabled} onBack={onBack} onObserverToggle={onObserverToggle} />
        <div data-marinara-phone-screen key={screen.kind === "app" ? current?.url ?? "app" : screen.kind} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
          <PhoneOsNavigator screen={screen} background={background} homeApps={homeApps} apps={apps} installed={installed} catalogLoading={catalogLoading} catalogError={catalogError} current={current} loading={loading} error={error} onOpenApp={onOpenApp} onStore={onStore} onSettings={onSettings} onBackgroundChange={onBackgroundChange} onToggleInstall={onToggleInstall} />
        </div>
        <button type="button" aria-label={screen.kind === "home" ? "Close phone" : "Home screen"} onClick={screen.kind === "home" ? onClose : onHome} style={{ flex: "0 0 auto", height: 26, border: 0, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span aria-hidden="true" style={{ width: 126, height: 5, borderRadius: 3, background: "#f5f5f7", opacity: 0.55 }} />
        </button>
      </div>
    </section>
  );
}

function PhoneStatusBar({ clock, canGoBack, observerEnabled, onBack, onObserverToggle }: { clock: string; canGoBack: boolean; observerEnabled: boolean; onBack: () => void; onObserverToggle: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: "0 0 auto", padding: "12px 24px 6px", color: "#f5f5f7", font: "600 13px/1 var(--font-sans, system-ui, sans-serif)" }}>
      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {canGoBack ? <button type="button" onClick={onBack} aria-label="Back to previous screen" style={{ display: "flex", alignItems: "center", gap: 2, padding: "2px 6px 2px 3px", border: 0, borderRadius: 9, background: "rgb(255 255 255 / 10%)", color: "#f5f5f7", font: "600 11px/1 var(--font-sans, system-ui, sans-serif)", cursor: "pointer" }}><span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>‹</span>Back</button> : null}
        <span>{clock}</span>
      </span>
      <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" onClick={onObserverToggle} aria-pressed={observerEnabled} title={observerEnabled ? "Stop telling the chat what you browse" : "Tell the chat what you browse"} style={{ padding: "2px 7px", border: `1px solid ${observerEnabled ? "#34d399" : "rgb(255 255 255 / 22%)"}`, borderRadius: 9, background: "transparent", color: observerEnabled ? "#34d399" : "rgb(255 255 255 / 55%)", font: "700 9px/1 ui-monospace, SFMono-Regular, Consolas, monospace", cursor: "pointer" }}>{observerEnabled ? "SEEN" : "PRIVATE"}</button>
        <span aria-hidden="true" style={{ fontSize: 11, letterSpacing: ".08em", opacity: 0.85 }}>▮▮▮ ᯤ</span>
      </span>
    </div>
  );
}

function PhoneOsNavigator({ screen, background, homeApps, apps, installed, catalogLoading, catalogError, current, loading, error, onOpenApp, onStore, onSettings, onBackgroundChange, onToggleInstall }: { screen: Screen; background: PhoneBackground; homeApps: PhoneApp[]; apps: PhoneApp[]; installed: string[]; catalogLoading: boolean; catalogError: string; current?: HistoryEntry; loading: boolean; error: string; onOpenApp: (app: PhoneApp) => void; onStore: () => void; onSettings: () => void; onBackgroundChange: (background: PhoneBackground) => void; onToggleInstall: (appId: string) => void }) {
  if (screen.kind === "home") return <HomeScreen apps={homeApps} background={background} onOpen={onOpenApp} onStore={onStore} onSettings={onSettings} />;
  if (screen.kind === "store") return <AppStore apps={apps} installed={installed} loading={catalogLoading} error={catalogError} onToggle={onToggleInstall} />;
  if (screen.kind === "settings") return <SettingsApp background={background} onBackgroundChange={onBackgroundChange} />;
  return <PhoneAppViewport current={current} loading={loading} error={error} />;
}

const PHONE_BACKGROUNDS: Record<PhoneBackground, string> = {
  aurora: "radial-gradient(120% 90% at 50% 0%, #3a315c 0%, #151827 45%, #090b12 100%)",
  midnight: "linear-gradient(160deg, #202533 0%, #090b12 72%)",
  paper: "linear-gradient(160deg, #dfe6ef 0%, #8e9bad 100%)",
  ocean: "linear-gradient(160deg, #0d5b73 0%, #07151f 78%)",
  sunset: "linear-gradient(160deg, #9c5160 0%, #221525 78%)",
};

function HomeScreen({ apps, background, onOpen, onStore, onSettings }: { apps: PhoneApp[]; background: PhoneBackground; onOpen: (app: PhoneApp) => void; onStore: () => void; onSettings: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        padding: "20px 22px 8px",
        background: PHONE_BACKGROUNDS[background],
        overflowY: "auto",
      }}
    >
      {apps.length === 0 ? (
        <p style={{ margin: "auto", color: "#c8c8d0", fontSize: 13, textAlign: "center" }}>
          No apps installed. Open the App Store below.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px 12px", alignContent: "start" }}>
          {apps.map((app) => (
            <button
              key={app.id}
              type="button"
              onClick={() => onOpen(app)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: 0,
                border: 0,
                background: "transparent",
                color: "#f5f5f7",
                font: "500 10px/1.2 var(--font-sans, system-ui, sans-serif)",
                cursor: "pointer",
              }}
            >
              <AppIcon app={app} />
              <span style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {app.name}
              </span>
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "center", flex: "0 0 auto", marginTop: "auto", padding: 12, borderRadius: 24, background: "rgb(255 255 255 / 14%)", boxShadow: "inset 0 1px 0 rgb(255 255 255 / 14%)" }}>
        <button type="button" onClick={onSettings} aria-label="Open Settings" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 0, border: 0, background: "transparent", color: "#f5f5f7", font: "500 10px/1.2 var(--font-sans, system-ui, sans-serif)", cursor: "pointer" }}>
          <AppIcon app={{ icon: "⚙️", name: "Settings" }} size={52} />
          <span>Settings</span>
        </button>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          flex: "0 0 auto",
          marginTop: "auto",
          padding: 12,
          borderRadius: 26,
           background: "rgb(255 255 255 / 10%)",
        }}
      >
        <button
          type="button"
          onClick={onStore}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            padding: 0,
            border: 0,
            background: "transparent",
            color: "#f5f5f7",
            font: "500 10px/1.2 var(--font-sans, system-ui, sans-serif)",
            cursor: "pointer",
          }}
        >
          <AppIcon app={{ icon: "🛍️", name: "App Store" }} size={52} />
          <span>App Store</span>
        </button>
      </div>
    </div>
  );
}

function SettingsApp({ background, onBackgroundChange }: { background: PhoneBackground; onBackgroundChange: (background: PhoneBackground) => void }) {
  const options: Array<{ id: PhoneBackground; name: string; detail: string }> = [
    { id: "aurora", name: "Aurora", detail: "Soft violet glow" },
    { id: "midnight", name: "Midnight", detail: "Quiet dark blue" },
    { id: "paper", name: "Paper", detail: "Light neutral" },
    { id: "ocean", name: "Ocean", detail: "Deep teal" },
    { id: "sunset", name: "Sunset", detail: "Warm rose" },
  ];
  return (
    <main style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflowY: "auto", background: "#f2f2f7", color: "#11131a" }}>
      <header style={{ padding: "18px 20px 12px", background: "rgb(255 255 255 / 92%)", borderBottom: "1px solid #d8d8de" }}>
        <div style={{ color: "#6b6b74", font: "600 12px/1.2 system-ui, sans-serif", letterSpacing: ".02em" }}>Phone</div>
        <h1 style={{ margin: "5px 0 0", font: "700 28px/1.1 system-ui, sans-serif", letterSpacing: 0 }}>Settings</h1>
      </header>
      <section aria-labelledby="wallpaper-heading" style={{ padding: "24px 16px 8px" }}>
        <h2 id="wallpaper-heading" style={{ margin: "0 8px 8px", color: "#6b6b74", font: "600 12px/1.2 system-ui, sans-serif", textTransform: "uppercase", letterSpacing: ".04em" }}>Appearance</h2>
        <div style={{ overflow: "hidden", borderRadius: 12, background: "#fff", boxShadow: "0 1px 2px rgb(0 0 0 / 10%)" }}>
          {options.map((option, index) => (
            <button key={option.id} type="button" onClick={() => onBackgroundChange(option.id)} aria-pressed={background === option.id} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 64, padding: "10px 14px", border: 0, borderBottom: index === options.length - 1 ? 0 : "1px solid #e3e3e8", background: "#fff", color: "#11131a", textAlign: "start", cursor: "pointer" }}>
              <span aria-hidden="true" style={{ width: 42, height: 42, flex: "0 0 auto", borderRadius: 10, background: PHONE_BACKGROUNDS[option.id], boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 12%)" }} />
              <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: "block", font: "600 15px/1.25 system-ui, sans-serif" }}>{option.name}</strong><span style={{ display: "block", marginTop: 2, color: "#6b6b74", font: "400 12px/1.3 system-ui, sans-serif" }}>{option.detail}</span></span>
              <span aria-hidden="true" style={{ color: background === option.id ? "#147ef5" : "#c4c4ca", font: "700 20px/1 system-ui, sans-serif" }}>{background === option.id ? "✓" : "›"}</span>
            </button>
          ))}
        </div>
      </section>
      <section aria-labelledby="phone-info-heading" style={{ padding: "24px 16px" }}>
        <h2 id="phone-info-heading" style={{ margin: "0 8px 8px", color: "#6b6b74", font: "600 12px/1.2 system-ui, sans-serif", textTransform: "uppercase", letterSpacing: ".04em" }}>About</h2>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fff", color: "#6b6b74", font: "400 13px/1.45 system-ui, sans-serif", boxShadow: "0 1px 2px rgb(0 0 0 / 10%)" }}>This phone's apps, history, and appearance are private to its current chat and owner.</div>
      </section>
    </main>
  );
}

function AppStore({
  apps,
  installed,
  loading,
  error,
  onToggle,
}: {
  apps: PhoneApp[];
  installed: string[];
  loading: boolean;
  error: string;
  onToggle: (appId: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, background: "#101016", color: "#f5f5f7" }}>
      <header
        style={{
          flex: "0 0 auto",
          padding: "14px 20px 10px",
          borderBottom: "1px solid rgb(255 255 255 / 10%)",
          font: "700 22px/1.2 var(--font-sans, system-ui, sans-serif)",
        }}
      >
        App Store
      </header>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "6px 0" }}>
        {error ? (
          <p role="alert" style={{ padding: 24, color: "#fca5a5", fontSize: 13, lineHeight: 1.5 }}>
            {error}
          </p>
        ) : loading ? (
          <p style={{ padding: 24, color: "#a0a0aa", fontSize: 13 }}>Loading apps…</p>
        ) : apps.length === 0 ? (
          <p style={{ padding: 24, color: "#a0a0aa", fontSize: 13 }}>No apps are available.</p>
        ) : (
          <AppStoreTemplate apps={apps} installed={installed} onToggle={onToggle} />
        )}
      </div>
    </div>
  );
}

function AppStoreTemplate({ apps, installed, onToggle }: { apps: PhoneApp[]; installed: string[]; onToggle: (appId: string) => void }) {
  const grouped = apps.reduce<Record<string, PhoneApp[]>>((groups, app) => {
    const category = app.storeCategory || "reference";
    (groups[category] ||= []).push(app);
    return groups;
  }, {});
  return (
    <>
      {Object.entries(grouped).map(([category, categoryApps]) => (
        <section key={category} aria-labelledby={`store-${category}`} style={{ borderBottom: "1px solid rgb(255 255 255 / 10%)" }}>
          <h2 id={`store-${category}`} style={{ margin: 0, padding: "14px 20px 6px", color: "#a0a0aa", font: "700 11px/1.2 var(--font-sans, system-ui, sans-serif)", textTransform: "uppercase", letterSpacing: ".08em" }}>{category}</h2>
          {categoryApps.map((app) => {
            const isInstalled = installed.includes(app.id);
            return (
              <article key={app.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 20px 14px" }}>
                <AppIcon app={app} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      font: "600 14px/1.3 var(--font-sans, system-ui, sans-serif)",
                     overflowWrap: "anywhere",
                    }}
                  >
                    {app.name}
                  </div>
                  <div style={{ color: "#9a9aa5", fontSize: 11, lineHeight: 1.4 }}>
                    {app.description}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggle(app.id)}
                  aria-label={`${isInstalled ? "Remove" : "Install"} ${app.name}`}
                  style={{
                    flex: "0 0 auto",
                    minWidth: 68,
                    padding: "6px 14px",
                    border: 0,
                    borderRadius: 14,
                    background: isInstalled ? "rgb(255 255 255 / 12%)" : "color-mix(in srgb, var(--primary, #ffb3d9) 82%, #000)",
                    color: isInstalled ? "#f5f5f7" : "#12121a",
                    font: "700 12px/1 var(--font-sans, system-ui, sans-serif)",
                    cursor: "pointer",
                  }}
                >
                  {isInstalled ? "Remove" : "Get"}
                </button>
              </article>
            );
          })
          }
        </section>
      ))}
    </>
  );
}

function PhoneAppViewport({ current, loading, error }: { current: HistoryEntry | undefined; loading: boolean; error: string }) {
  if (error) {
    return (
      <p role="alert" style={{ margin: "auto", padding: 24, textAlign: "center", color: "#fca5a5", fontSize: 13 }}>
        {error}
      </p>
    );
  }
  if (loading || !current) {
    return (
      <p style={{ margin: "auto", color: "var(--muted-foreground, #a0a0a0)", fontSize: 13 }}>
        {loading ? "Loading…" : "Tap an app."}
      </p>
    );
  }
  return (
    <iframe
      title={current.title}
      // No allow-same-origin: the page cannot reach the host document or its storage.
      sandbox="allow-scripts allow-forms"
      srcDoc={`${current.html}${NAVIGATION_BRIDGE(current.url)}`}
      style={{ width: "100%", flex: 1, minHeight: 0, border: 0, background: "white" }}
    />
  );
}
