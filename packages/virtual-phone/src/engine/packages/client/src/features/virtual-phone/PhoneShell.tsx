import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchApps, fetchPage, readInstalled, readSession, writeInstalled, writeSession } from "./api";
import type { CapabilityProps, HistoryEntry, PhoneApp } from "./types";

type Screen = { kind: "home" } | { kind: "store" } | { kind: "app" };

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
  const allowAdult = props.metadata?.allowAdultContent === true;
  const observerEnabled = props.metadata?.virtualPhoneObserverEnabled === true;

  const [apps, setApps] = useState<PhoneApp[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [index, setIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pageNotes = useRef(new Map<string, string>());

  const current = index >= 0 ? entries[index] : undefined;
  const appsById = useMemo(() => new Map(apps.map((app) => [app.id, app])), [apps]);
  const clock = useClock();

  useEffect(() => {
    let cancelled = false;
    fetchApps(allowAdult)
      .then((catalog) => {
        if (cancelled) return;
        setApps(catalog.apps);
        setInstalled(readInstalled(chatId, catalog.defaults));
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [allowAdult, chatId]);

  useEffect(() => {
    const session = readSession(chatId);
    if (!session) return;
    setEntries(session.entries);
    setIndex(session.index);
  }, [chatId]);

  const open = useCallback(
    async (
      app: PhoneApp,
      url: string,
      options: { lastAction?: string; formData?: Record<string, unknown>; refresh?: boolean } = {},
    ) => {
      setScreen({ kind: "app" });
      setLoading(true);
      setError("");
      try {
        const page = await fetchPage({
          chatId,
          appId: app.id,
          url,
          connectionId: props.connectionId,
          chatConnectionId: typeof props.metadata?.connectionId === "string" ? props.metadata.connectionId : undefined,
          allowAdult,
          refresh: options.refresh,
          lastAction: options.lastAction,
          formData: options.formData,
          pageHistory: pageNotes.current.get(url),
          navHistory: entries.slice(Math.max(0, index - 2), index + 1).map((entry) => ({ url: entry.url, title: entry.title })),
          context: props.context,
        });
        const entry: HistoryEntry = { url: page.url, appId: page.appId, title: page.title, html: page.html };
        setEntries((previous) => {
          const next = [...previous.slice(0, index + 1), entry];
          setIndex(next.length - 1);
          writeSession(chatId, next, next.length - 1);
          return next;
        });
        if (page.observerText) {
          pageNotes.current.set(page.url, page.observerText);
          if (observerEnabled) {
            props.onObserver?.({ text: page.observerText, name: page.observerName, url: page.url });
          }
        }
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setLoading(false);
      }
    },
    [allowAdult, chatId, entries, index, observerEnabled, props],
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
      const owner = target ?? (current ? appsById.get(current.appId) : undefined);
      if (!owner) return;
      void open(owner, detail.url, { lastAction: detail.action, formData: detail.formData });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [apps, appsById, current, open]);

  const toggleInstall = (appId: string) => {
    setInstalled((previous) => {
      const next = previous.includes(appId) ? previous.filter((id) => id !== appId) : [...previous, appId];
      writeInstalled(chatId, next);
      return next;
    });
  };

  const goHome = () => {
    setScreen({ kind: "home" });
    setError("");
  };

  // Back walks the cached history: no model call, no cost, no regenerated feed.
  const canGoBack = screen.kind === "app" && index > 0;
  const goBack = () => {
    if (!canGoBack) return;
    const next = index - 1;
    setIndex(next);
    setError("");
    writeSession(chatId, entries, next);
  };

  const homeApps = installed.map((id) => appsById.get(id)).filter((app): app is PhoneApp => Boolean(app));

  return (
    <section
      aria-label="Phone"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        minHeight: 0,
        padding: 12,
        background: "var(--background, #101010)",
        color: "var(--foreground, #f5f5f5)",
        boxSizing: "border-box",
      }}
    >
      <style>{PHONE_STYLES}</style>
      <div
        data-marinara-phone-frame
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          maxWidth: 390,
          height: "100%",
          maxHeight: 844,
          minHeight: 0,
          borderRadius: 38,
          border: "1px solid color-mix(in srgb, var(--border, #444) 80%, white)",
          background: "#0b0b0f",
          boxShadow: "0 24px 70px rgb(0 0 0 / 55%)",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flex: "0 0 auto",
            padding: "12px 24px 6px",
            color: "#f5f5f7",
            font: "600 13px/1 var(--font-sans, system-ui, sans-serif)",
          }}
        >
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {canGoBack ? (
              <button
                type="button"
                onClick={goBack}
                aria-label={`Back to ${entries[index - 1]?.title || "the previous screen"}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  padding: "2px 6px 2px 3px",
                  border: 0,
                  borderRadius: 9,
                  background: "rgb(255 255 255 / 10%)",
                  color: "#f5f5f7",
                  font: "600 11px/1 var(--font-sans, system-ui, sans-serif)",
                  cursor: "pointer",
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>
                  ‹
                </span>
                Back
              </button>
            ) : null}
            <span>{clock}</span>
          </span>
          <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => props.updateMetadata?.({ virtualPhoneObserverEnabled: !observerEnabled })}
              aria-pressed={observerEnabled}
              title={observerEnabled ? "Stop telling the chat what you browse" : "Tell the chat what you browse"}
              style={{
                padding: "2px 7px",
                border: `1px solid ${observerEnabled ? "#34d399" : "rgb(255 255 255 / 22%)"}`,
                borderRadius: 9,
                background: "transparent",
                color: observerEnabled ? "#34d399" : "rgb(255 255 255 / 55%)",
                font: "700 9px/1 ui-monospace, SFMono-Regular, Consolas, monospace",
                cursor: "pointer",
              }}
            >
              {observerEnabled ? "SEEN" : "PRIVATE"}
            </button>
            <span aria-hidden="true" style={{ fontSize: 11, letterSpacing: ".08em", opacity: 0.85 }}>
              ▮▮▮ ᯤ
            </span>
          </span>
        </div>

        <div
          data-marinara-phone-screen
          key={screen.kind === "app" ? current?.url ?? "app" : screen.kind}
          style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}
        >
          {screen.kind === "home" ? (
            <HomeScreen apps={homeApps} onOpen={(app) => void open(app, `https://${app.domain}/`)} onStore={() => setScreen({ kind: "store" })} />
          ) : screen.kind === "store" ? (
            <AppStore apps={apps} installed={installed} onToggle={toggleInstall} />
          ) : (
            <AppFrame current={current} loading={loading} error={error} />
          )}
        </div>

        <button
          type="button"
          aria-label={screen.kind === "home" ? "Close phone" : "Home screen"}
          onClick={() => (screen.kind === "home" ? props.onClose?.() : goHome())}
          style={{
            flex: "0 0 auto",
            height: 26,
            border: 0,
            background: "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span aria-hidden="true" style={{ width: 126, height: 5, borderRadius: 3, background: "#f5f5f7", opacity: 0.55 }} />
        </button>
      </div>
    </section>
  );
}

function HomeScreen({ apps, onOpen, onStore }: { apps: PhoneApp[]; onOpen: (app: PhoneApp) => void; onStore: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        padding: "20px 22px 8px",
        background: "radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--primary, #ffb3d9) 20%, #14141b), #0b0b0f)",
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

function AppStore({
  apps,
  installed,
  onToggle,
}: {
  apps: PhoneApp[];
  installed: string[];
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
        {apps.length === 0 ? (
          <p style={{ padding: 24, color: "#a0a0aa", fontSize: 13 }}>Loading apps…</p>
        ) : (
          apps.map((app) => {
            const isInstalled = installed.includes(app.id);
            return (
              <div key={app.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px" }}>
                <AppIcon app={app} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      font: "600 14px/1.3 var(--font-sans, system-ui, sans-serif)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {app.name}
                  </div>
                  <div style={{ color: "#9a9aa5", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function AppFrame({ current, loading, error }: { current: HistoryEntry | undefined; loading: boolean; error: string }) {
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
