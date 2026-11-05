import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  CapabilityElement,
  CapabilityProps,
  SaucelingStateResponse,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { saucelingsRequest } from "./api.js";
import { FriendlyError } from "./care-ui.js";
import { SaucelingsLocalizationProvider, translateSaucelings, useSaucelingsTranslation } from "./localization.js";
import { SaucelingsAlbumView } from "./SaucelingsAlbumView.js";
import { SaucelingsJournalView } from "./SaucelingsJournalView.js";
import { SaucelingsMenagerieView } from "./SaucelingsMenagerieView.js";
import { SaucelingsNookView } from "./SaucelingsNookView.js";
import { SaucelingsSettingsView } from "./SaucelingsSettingsView.js";
import { SaucelingsWidgetView } from "./SaucelingsWidgetView.js";
import { SAUCELINGS_STYLES } from "./styles.js";
import { SaucelingRamps } from "./SaucelingSprite.js";
import { useVoicePrompt } from "./VoiceDialog.js";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 5_000 } },
});

class SaucelingsErrorBoundary extends React.Component<
  { element: CapabilityElement; children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    const message =
      error.message ||
      translateSaucelings(this.props.element.capabilityProps?.localization, "saucelings.error.interface");
    this.props.element.capabilityRuntimeError = message;
    this.props.element.dispatchEvent(
      new CustomEvent("marinara-capability-runtime-error", { detail: { message }, bubbles: true }),
    );
    console.error("Saucelings client capability stopped", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="sl-shell" style={{ padding: "1.5rem" }} role="alert">
        <div className="sl-card" style={{ display: "grid", gap: "0.75rem" }}>
          <strong>
            {translateSaucelings(this.props.element.capabilityProps?.localization, "saucelings.error.interface")}
          </strong>
          <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>{this.state.error.message}</span>
          <div>
            <button
              type="button"
              className="sl-btn"
              onClick={() => {
                this.props.element.capabilityRuntimeError = null;
                this.setState({ error: null });
              }}
            >
              {translateSaucelings(this.props.element.capabilityProps?.localization, "saucelings.error.retry")}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

const TABS = ["nook", "journal", "album", "menagerie", "settings"] as const;
type BrowserSubTab = (typeof TABS)[number];

// ponytail: the day of the last found egg the Menagerie was opened after, kept per browser rather than per Engine,
// so another browser shows the dot again. A seen-day field in the world save is the upgrade.
const MENAGERIE_SEEN_KEY = "saucelings-menagerie-seen";

function readMenagerieSeen(): string | null {
  try {
    return localStorage.getItem(MENAGERIE_SEEN_KEY);
  } catch {
    return null;
  }
}

function SaucelingsBrowserApp({ props }: { props: CapabilityProps }) {
  const { t } = useSaucelingsTranslation();
  const [tab, setTab] = useState<BrowserSubTab>("nook");
  // At the root, so a pet brought back from the Menagerie can be offered its caretaker's voice in the Nook.
  const voice = useVoicePrompt();

  const focusPostId = props.focusPostId;
  const onFocusPostHandled = props.onFocusPostHandled;
  useEffect(() => {
    if (focusPostId) {
      onFocusPostHandled?.();
    }
  }, [focusPostId, onFocusPostHandled]);

  const stateQuery = useQuery({
    queryKey: ["saucelings", "state"],
    queryFn: () => saucelingsRequest<SaucelingStateResponse>("/state"),
    refetchOnMount: "always",
    // The caretaker's words land after the save that asked for them, so look again until they have.
    refetchInterval: (query) => (query.state.data?.writing.length ? 2_000 : false),
  });

  // The server routes are only there after a restart, so a package installed a moment ago answers 404.
  const restartNeeded = (stateQuery.error as { status?: number } | null)?.status === 404;

  // A dot on the Menagerie tab while an egg a character found is waiting there unseen.
  const lastFind = stateQuery.data?.world.lastEggFindDay ?? null;
  const [menagerieSeen, setMenagerieSeen] = useState(readMenagerieSeen);
  const newEgg = lastFind !== null && lastFind !== menagerieSeen && tab !== "menagerie";
  useEffect(() => {
    if (tab !== "menagerie" || !lastFind) return;
    setMenagerieSeen(lastFind);
    try {
      localStorage.setItem(MENAGERIE_SEEN_KEY, lastFind);
    } catch {
      // A private window keeps no storage; the dot then shows again next time.
    }
  }, [tab, lastFind]);

  return (
    <div className="sl-shell">
      <header className="sl-header">
        <div className="sl-header-title">
          <strong style={{ fontSize: "1rem" }}>{t("saucelings.title")}</strong>
          <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>{t("saucelings.subtitle")}</div>
        </div>
        <nav className="sl-nav" data-sl-tour="tabs" aria-label={t("saucelings.nav.label")}>
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              className={`sl-tab-btn ${tab === item ? "sl-tab-btn--active" : ""}`}
              aria-current={tab === item ? "page" : undefined}
              aria-label={item === "menagerie" && newEgg ? t("saucelings.tab.menagerieNew") : undefined}
              onClick={() => setTab(item)}
            >
              {t(`saucelings.tab.${item}`)}
              {item === "album" && stateQuery.data?.portraitCount ? (
                <span className="sl-tab-count"> ({stateQuery.data.portraitCount})</span>
              ) : null}
              {item === "menagerie" && stateQuery.data?.menagerieCount ? (
                <span className="sl-tab-count"> ({stateQuery.data.menagerieCount})</span>
              ) : null}
              {item === "menagerie" && newEgg ? <span className="sl-tab-dot" aria-hidden="true" /> : null}
            </button>
          ))}
        </nav>
      </header>

      <main className="sl-body">
        <div className="sl-container">
          {/* A refresh that fails leaves the Nook up with what it last had. */}
          {stateQuery.isError && stateQuery.data ? (
            <div role="alert" className="sl-error" style={{ marginBottom: "0.5rem" }}>
              {t("saucelings.error.load")}
            </div>
          ) : null}
          {stateQuery.isLoading ? (
            <div className="sl-card" style={{ textAlign: "center", padding: "2rem", opacity: 0.75 }}>
              {t("saucelings.loading")}
            </div>
          ) : !stateQuery.data ? (
            <div className="sl-card" style={{ display: "grid", gap: "0.75rem" }} role="alert">
              <strong>{t("saucelings.error.load")}</strong>
              <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>
                {restartNeeded ? t("saucelings.error.restart") : <FriendlyError error={stateQuery.error} />}
              </span>
              <div>
                <button type="button" className="sl-btn" onClick={() => void stateQuery.refetch()}>
                  {t("saucelings.error.retry")}
                </button>
              </div>
            </div>
          ) : tab === "nook" ? (
            <SaucelingsNookView
              state={stateQuery.data}
              packageId={props.packageId}
              packageVersion={props.packageVersion}
              askVoice={voice.ask}
            />
          ) : tab === "journal" ? (
            <SaucelingsJournalView state={stateQuery.data} onOpenNook={() => setTab("nook")} />
          ) : tab === "album" ? (
            <SaucelingsAlbumView
              state={stateQuery.data}
              packageId={props.packageId}
              packageVersion={props.packageVersion}
            />
          ) : tab === "menagerie" ? (
            <SaucelingsMenagerieView
              state={stateQuery.data}
              packageId={props.packageId}
              packageVersion={props.packageVersion}
              onRestored={(caretakerId) => {
                setTab("nook");
                voice.ask(caretakerId);
              }}
            />
          ) : (
            <SaucelingsSettingsView state={stateQuery.data} />
          )}
        </div>
      </main>
      {voice.dialog}
    </div>
  );
}

function CapabilityRoot({ element }: { element: CapabilityElement }) {
  const props = element.capabilityProps ?? {};
  const view = element.getAttribute("view");
  const packageId = typeof props.packageId === "string" ? props.packageId : "saucelings";
  const packageVersion = typeof props.packageVersion === "string" ? props.packageVersion : null;
  return view === "widget" ? (
    <SaucelingsWidgetView
      active={props.active === true}
      compact={props.widgetId === "sauceling-compact"}
      packageId={packageId}
      packageVersion={packageVersion}
      onOpenNoodle={typeof props.onOpenNoodle === "function" ? props.onOpenNoodle : undefined}
    />
  ) : (
    <SaucelingsBrowserApp props={props} />
  );
}

function LocalizedRoot({ element }: { element: CapabilityElement }) {
  const [, redraw] = useState(0);
  useEffect(() => {
    const update = () => redraw((value) => value + 1);
    element.addEventListener("marinara-capability-props", update);
    return () => element.removeEventListener("marinara-capability-props", update);
  }, [element]);

  return (
    <SaucelingsLocalizationProvider localization={element.capabilityProps?.localization}>
      <style>{SAUCELINGS_STYLES}</style>
      <SaucelingRamps />
      <SaucelingsErrorBoundary element={element}>
        <CapabilityRoot element={element} />
      </SaucelingsErrorBoundary>
    </SaucelingsLocalizationProvider>
  );
}

class SaucelingsElement extends HTMLElement {
  __root: ReturnType<typeof createRoot> | null = null;
  capabilityProps?: CapabilityElement["capabilityProps"];
  capabilityRuntimeError?: string | null;

  static observedAttributes = ["view"];

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (name === "view" && oldValue !== newValue && this.__root) this.render();
  }

  render() {
    this.__root?.render(
      <QueryClientProvider client={queryClient}>
        <LocalizedRoot element={this} />
      </QueryClientProvider>,
    );
  }

  connectedCallback() {
    if (!this.__root) this.__root = createRoot(this);
    this.render();
  }

  disconnectedCallback() {
    queueMicrotask(() => {
      if (!this.isConnected && this.__root) {
        this.__root.unmount();
        this.__root = null;
      }
    });
  }
}

const TAG = "marinara-capability-saucelings";
if (!customElements.get(TAG)) customElements.define(TAG, SaucelingsElement);
