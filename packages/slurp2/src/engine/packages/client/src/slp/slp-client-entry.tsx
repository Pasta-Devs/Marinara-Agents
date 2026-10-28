import { Component, useEffect, useState, type CSSProperties, type ErrorInfo, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import i18next from "i18next";
import { I18nextProvider } from "react-i18next";
import { queryClient } from "marinara:host";
import english from "./locales/en.json";
import { SlpApp } from "./app/SlpApp";
import { api, ApiError } from "../lib/api-client";
import { useSlurpUIStore } from "./base/state/slp-package-store";
import { configureSlurpPackageState } from "./base/state/slp-package-store";
import { ModalPortalContext } from "../components/ui/Modal";
import { SLP_DISPLAY_FONT_STYLES } from "./base/chrome/slp-display-font";
import { SLP_SPARKLE_STYLES } from "./modules/sparkle/slp-sparkle-styles";
import { SLP_CREATOR_PAGE_STYLES } from "./modules/creator/slp-creator-page-styles";
import { getSlpAccentStyle, SLP_PINK, SlpAccentContext } from "./base/chrome/SlpChrome";
import { slpKeys } from "./base/state/slp-query-keys";
import { SlpErrorState } from "./modules/chrome/SlpStateKit";

const SLURP_ELEMENT_TAG = "marinara-capability-slurp2";
const SLURP_STYLE_ID = "marinara-capability-slurp2-styles";
// Slurp's queries live in the Engine's cache, under Slurp's own keys (slp-query-keys.ts), with these defaults.
// An Engine restart drops every request for a few seconds. With no retry, one poll landing in that
// window left the Hub on "Slurp could not be loaded." Network failures and 5xx retry with backoff
// (about 30s in total); a 4xx is a real answer and fails at once.
const slurpQueryDefaults = {
  retry: (failures: number, error: unknown) => failures < 5 && !(error instanceof ApiError && error.status < 500),
  // Without a floor every remount and window focus refetches; returning to the app on a phone
  // fired 10-15 requests at once. Invalidations and polls still refetch immediately.
  staleTime: 15_000,
};
for (const root of [slpKeys.all, slpKeys.settings().slice(0, 1)])
  queryClient.setQueryDefaults(root, slurpQueryDefaults);
// Slurp's own instance, inside <I18nextProvider>. Never `.use(initReactI18next)`: that would make it the Engine's
// global instance.
const localization = i18next.createInstance();

void localization.init({
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  lng: "en",
  resources: { en: { translation: english } },
});

/**
 * Only English ships inside client.js (0.3.6): the other catalogs were about 650 KB the app parsed on
 * every start. They are package assets (`contributions.assets` in scripts/build-feature-packages.mjs),
 * fetched once when the Engine asks for that language. Until one arrives, or if it fails, English shows.
 */
const SLP_LAZY_LOCALES = new Set(["de", "ko", "pl"]);
let slpLanguageRequest = 0;
async function applySlpLanguage(language: string) {
  // A later switch wins: a slow catalog must not flip the app back to an older choice.
  const request = ++slpLanguageRequest;
  if (SLP_LAZY_LOCALES.has(language) && !localization.hasResourceBundle(language, "translation")) {
    const bundle = await api
      .get<Record<string, string>>(
        `/capability-packages/slurp2/assets/src/engine/packages/client/src/slp/locales/${language}.json`,
      )
      .catch(() => null);
    if (bundle) localization.addResourceBundle(language, "translation", bundle);
  }
  if (request !== slpLanguageRequest) return;
  await localization.changeLanguage(localization.hasResourceBundle(language, "translation") ? language : "en");
}

type CapabilityElement = HTMLElement & {
  capabilityProps?: Record<string, unknown>;
  __root?: Root | null;
  __portal?: HTMLDivElement | null;
};

let slurpPackageStyles = "";

/**
 * With accent animation on, the Engine repaints every `svg` inside a chrome token scope to the
 * chrome accent colour. Slurp's shell is such a scope, so an icon on an accent-filled button was
 * painted accent-on-accent and vanished, leaving the gap its label was spaced for. Icons here
 * follow their own button's text colour instead.
 */
const SLURP_ICON_COLOR_FIX =
  "[data-marinara-accent-animation] .mari-chrome-token-scope svg:not(.mari-rgb-static-icon){color:inherit;stroke:currentColor;}" +
  // Icons on photos and scrims (carousel arrows, lock badges) sit in a `text-white` control. The
  // shell paints every icon in the pink ink, which is dark plum in light mode, so these follow
  // their control's white instead.
  ':is(marinara-capability-slurp2,[data-marinara-capability-scope="slurp2"]) .text-white svg:not([class*="text-"]){color:inherit;}';

// Slurp has no chat, so the sticker and emoji pickers' per-chat selection preferences do not apply here.
const SLURP_HIDDEN_CHAT_SETTINGS =
  ':is(marinara-capability-slurp2,[data-marinara-capability-scope="slurp2"]) :is(button[aria-label="Selection preferences"],button[title="Selection preferences"]){display:none !important;}';

/**
 * Shell polish (step 3.1). Screens scroll behind the floating nav, so only the end of the innermost
 * page scroller keeps room for it. Pictures wait in a shimmering frame, then fade in and un-blur
 * (`SLP_IMG_FRAME_CLASS` / `slpImgFade` in base/chrome/SlpChrome.tsx).
 */
const SLURP_SHELL_STYLES = `
  /* The nav slides away: only the bottom bars that follow it (\`slp-nav-live\`) restyle. Setting
     --slp-nav-live on the scroll root restyled every post in the feed on each flick (0.3.6). */
  [data-slp-nav-hidden] .slp-nav-live { --slp-nav-live: 0px; }
  /* Desktop only: off-screen feed cards skip restyles and layout (4 s → 1.5 s of restyling per scroll,
     measured 0.3.6). Not on phones, where a fast flick outran it and showed half-black pages. An open
     menu must not be clipped by the containment. */
  @media (min-width: 1024px) {
    [data-slurp-access-transition]:not([data-slp-menu-open]) {
      content-visibility: auto; contain-intrinsic-size: auto 720px;
    }
  }
  .slp-page-scroll:not(:has(.slp-page-scroll))::after {
    content: ""; display: block; flex: none; height: var(--slp-nav-space, 0px);
  }
  :where(.slp-img-frame) { transition: background-color 360ms var(--slurp-ease, ease-out); }
  .slp-img-frame:not(:has(> img[data-slp-loaded])) {
    background-color: color-mix(in srgb, var(--noodle-accent) 9%, var(--slurp-surface-raised, #211624));
    background-image: linear-gradient(100deg, transparent 30%, rgb(255 255 255 / 0.07) 45%, rgb(255 255 255 / 0.13) 50%, rgb(255 255 255 / 0.07) 55%, transparent 70%);
    background-size: 250% 100%; background-repeat: no-repeat; background-position: 120% 0;
  }
  /* :where() keeps these at zero specificity, so a picture's own opacity, blur or transition wins. */
  :where(img[data-slp-fade]) {
    opacity: 0; filter: blur(12px);
    transition: opacity 360ms var(--slurp-ease, ease-out), filter 420ms var(--slurp-ease, ease-out);
  }
  :where(img[data-slp-fade][data-slp-loaded]) { opacity: 1; filter: none; }
  .slp-img-frame > [data-slp-img-placeholder] { transition: opacity 360ms var(--slurp-ease, ease-out); }
  .slp-img-frame:has(> img[data-slp-loaded]) > [data-slp-img-placeholder] { opacity: 0; }
  @media (prefers-reduced-motion: no-preference) {
    .slp-img-frame:not(:has(> img[data-slp-loaded])) { animation: slp-img-frame-sweep 1.8s ease-in-out infinite; }
  }
  @media (prefers-reduced-motion: reduce) {
    :where(img[data-slp-fade]) { filter: none; transition: opacity 120ms linear; }
  }
  @keyframes slp-img-frame-sweep { 0% { background-position: 120% 0; } 70%, 100% { background-position: -20% 0; } }
  /* Cropped previews (SLP_CROP_CLASS in base/chrome/SlpChrome.tsx): keep the top centre, where faces
     are. "Show whole pictures" (data-slp-whole on <html>) fits the picture instead. A really cut
     picture gets a small quiet corner mark on its frame. */
  .slp-crop, .slp-crop-top { object-position: top center; }
  [data-slp-whole] .slp-crop { object-fit: contain; }
  /* "Blur pictures until tapped" (data-slp-blur on <html>, SlpHomeHost): every picture and video in
     Slurp and its sheets stays blurred until it is tapped. Inline SVG art (the coin, G's face) is
     interface, not a picture, and stays sharp. */
  [data-slp-blur] :is(marinara-capability-slurp2, [data-marinara-capability-scope="slurp2"]) :is(img:not([src^="data:image/svg"]), video):not([data-slp-revealed]) {
    filter: blur(22px); cursor: pointer;
  }
  :has(> img.slp-crop[data-slp-cut])::after {
    content: ""; position: absolute; z-index: 1; top: 8px; inset-inline-end: 8px; width: 22px; height: 22px;
    border-radius: 999px; pointer-events: none; background-color: rgb(8 4 10 / 0.42);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5'/%3E%3C/svg%3E");
    background-size: 12px 12px; background-position: center; background-repeat: no-repeat;
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.16); opacity: 0.85;
  }
  [data-slp-whole] :has(> img.slp-crop[data-slp-cut])::after { content: none; }
  /* Story tiles are small: the mark sat beside the Creator's avatar and read as clutter (G7). */
  [data-slp-no-crop-mark] :has(> img.slp-crop[data-slp-cut])::after { content: none; }
  /* A conversation on a phone is a full-screen task: its layer slides in from the side (push navigation). */
  @media (prefers-reduced-motion: no-preference) {
    .slp-task-in { animation: slp-task-in 320ms var(--slurp-ease, ease-out) both; }
  }
  @keyframes slp-task-in { from { opacity: 0; transform: translate3d(28px, 0, 0); } to { opacity: 1; transform: none; } }
  /* The ambient canvas (SlpCanvasAmbient): a new photo's colour fades in slowly over the last one. */
  .slp-ambient-in { animation: slp-ambient-in 1200ms var(--slurp-ease, ease-out) both; }
  @keyframes slp-ambient-in { from { opacity: 0; } to { opacity: 1; } }
`;

function syncSlurpPackageStyles() {
  const existing = document.getElementById(SLURP_STYLE_ID);
  if (!document.querySelector(SLURP_ELEMENT_TAG) || !slurpPackageStyles) {
    existing?.remove();
    return;
  }

  const style = existing ?? document.createElement("style");
  style.id = SLURP_STYLE_ID;
  style.textContent = `${slurpPackageStyles}\n${SLURP_ICON_COLOR_FIX}\n${SLURP_HIDDEN_CHAT_SETTINGS}\n${SLURP_SHELL_STYLES}\n${SLP_SPARKLE_STYLES}\n${SLP_DISPLAY_FONT_STYLES}\n${SLP_CREATOR_PAGE_STYLES}`;
  if (!existing) document.head.appendChild(style);
}

/** Supplies the package-scoped stylesheet generated by the catalog build. */
export function setSlurpPackageStyles(styleText: string) {
  slurpPackageStyles = styleText;
  syncSlurpPackageStyles();
}

function requestedLanguage(element: CapabilityElement) {
  const localizationContext = element.capabilityProps?.localization;
  if (!localizationContext || typeof localizationContext !== "object" || Array.isArray(localizationContext)) {
    return "en";
  }

  const locale = (localizationContext as Record<string, unknown>).locale;
  return typeof locale === "string" ? locale.split("-")[0] : "en";
}

/**
 * Without this, any render throw tears down the whole React root and leaves an empty panel next to
 * the Engine chrome, with nothing in the bug report to explain it.
 */
class SlurpErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[slurp2] render failed", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <SlpAccentContext.Provider value={SLP_PINK}>
        <div
          className="flex h-full flex-col items-center justify-center overflow-y-auto"
          style={getSlpAccentStyle(SLP_PINK)}
        >
          <SlpErrorState
            title={localization.t("ui.slurp.crash.title")}
            detail={localization.t("ui.slurp.crash.body")}
            onRetry={() => this.setState({ error: null })}
          />
          {/* The raw message helps a bug report but is not for reading, so it waits behind a disclosure. */}
          <details className="-mt-4 max-w-sm px-8 pb-8 text-center text-xs text-[var(--slurp-muted)]">
            <summary className="cursor-pointer">
              {localization.t("ui.slurp.crash.details", { defaultValue: "Show details" })}
            </summary>
            <pre className="mt-2 max-w-full overflow-auto whitespace-pre-wrap text-start">{error.message}</pre>
          </details>
        </div>
      </SlpAccentContext.Provider>
    );
  }
}

function SlurpPackageRoot({ element }: { element: CapabilityElement }) {
  const [revision, redraw] = useState(0);
  const navigation = useSlurpUIStore((state) => state.navigation);
  const setNavigation = useSlurpUIStore((state) => state.setNavigation);
  const close = element.capabilityProps?.onClose;
  const onLeave = typeof close === "function" ? () => close() : undefined;

  useEffect(() => {
    // The host re-dispatches this event whenever capabilityProps change, so the store has to be
    // reconfigured as well. Redrawing alone left debugMode and reviewImagePromptsBeforeSend stuck
    // on their mount-time values until the tab was remounted.
    const update = () => {
      configureSlurpPackageState(element.capabilityProps ?? {});
      redraw((value) => value + 1);
    };
    configureSlurpPackageState(element.capabilityProps ?? {});
    element.addEventListener("marinara-capability-props", update);
    return () => element.removeEventListener("marinara-capability-props", update);
  }, [element]);

  useEffect(() => {
    void applySlpLanguage(requestedLanguage(element));
  }, [element, revision]);

  return (
    <I18nextProvider i18n={localization}>
      <QueryClientProvider client={queryClient}>
        <ModalPortalContext.Provider value={element.__portal ?? element}>
          <div
            className="h-full min-h-0 overflow-hidden bg-[var(--background)] text-[var(--foreground)]"
            // Screens outside the Slurp shell (Backstage panels) still paint text on pink fills.
            style={{ "--slurp-on-accent": "#2a0a1b" } as CSSProperties}
          >
            <SlurpErrorBoundary>
              <SlpApp navigation={navigation} onNavigate={setNavigation} onLeave={onLeave} />
              {/* Dialogs and toasts are the Engine's: its one renderer and toast stack (sources/host-client-overlay). */}
            </SlurpErrorBoundary>
          </div>
        </ModalPortalContext.Provider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

class MarinaraSlurpElement extends HTMLElement {
  declare __root: Root | null;
  declare __portal: HTMLDivElement | null;

  connectedCallback() {
    syncSlurpPackageStyles();
    if (!this.__portal) {
      this.__portal = document.createElement("div");
      this.__portal.dataset.marinaraCapabilityScope = "slurp2";
      this.__portal.classList.add("mari-chrome-token-scope", "noodle-icon-scope");
      Object.assign(this.__portal.style, {
        inset: "0",
        pointerEvents: "none",
        position: "fixed",
        // The Engine's Modal layer: a dialog or Modal the Engine opens for Slurp (it portals to the page body, after
        // this) stacks above an open sheet, and its app dialogs and toasts sit higher still.
        zIndex: "10000",
      });
      this.__portal.style.setProperty("--accent", "rgba(255, 126, 193, 0.14)");
      this.__portal.style.setProperty("--background", "#17121b");
      this.__portal.style.setProperty("--border", "rgba(255, 255, 255, 0.18)");
      this.__portal.style.setProperty("--foreground", "#fff7fc");
      this.__portal.style.setProperty("--muted-foreground", "#d8c9d4");
      this.__portal.style.setProperty("--noodle-accent", "#ff7ec1");
      // Pink ink (text/icons) on this dark portal; text *on* a pink fill uses --slurp-on-accent.
      this.__portal.style.setProperty("--noodle-accent-foreground", "#ff9bd0");
      this.__portal.style.setProperty("--slurp-on-accent", "#2a0a1b");
      document.body.appendChild(this.__portal);
    }
    this.__root ??= createRoot(this);
    this.__root.render(<SlurpPackageRoot element={this} />);
  }

  disconnectedCallback() {
    queueMicrotask(() => {
      if (!this.isConnected && this.__root) {
        this.__root.unmount();
        this.__root = null;
      }
      if (!this.isConnected && this.__portal) {
        this.__portal.remove();
        this.__portal = null;
      }
      syncSlurpPackageStyles();
    });
  }
}

if (!customElements.get(SLURP_ELEMENT_TAG)) {
  customElements.define(SLURP_ELEMENT_TAG, MarinaraSlurpElement);
}
