// ──────────────────────────────────────────────
// Big Cheese: the package client
// ──────────────────────────────────────────────
// The Engine mounts <marinara-capability-big-cheese view="browser"> in its Home tab.
import { createRoot, type Root } from "react-dom/client";
import i18next from "i18next";
import { I18nextProvider } from "react-i18next";
import english from "./locales/en.json";
import { BigCheeseView } from "./BigCheeseView";
import { bigCheeseStyles } from "./theme/styles";

// Big Cheese's own i18n instance. The catalog's keys are flat (`ui.bigCheese.x`), so dots must not nest.
const localization = i18next.createInstance();
void localization.init({
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  keySeparator: false,
  lng: "en",
  resources: { en: { translation: english } },
});

const TAG = "marinara-capability-big-cheese";
const STYLE_ID = "marinara-capability-big-cheese-styles";

/** One stylesheet while any Big Cheese element is on the page; removed with the last one. */
function syncStyles() {
  const existing = document.getElementById(STYLE_ID);
  if (!document.querySelector(TAG)) return existing?.remove();
  if (existing) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = bigCheeseStyles();
  document.head.appendChild(style);
}

class BigCheeseElement extends HTMLElement {
  private root: Root | null = null;

  connectedCallback() {
    syncStyles();
    this.root ??= createRoot(this);
    this.root.render(
      <I18nextProvider i18n={localization}>
        <BigCheeseView />
      </I18nextProvider>,
    );
  }

  disconnectedCallback() {
    queueMicrotask(() => {
      if (!this.isConnected && this.root) {
        this.root.unmount();
        this.root = null;
      }
      syncStyles();
    });
  }
}

if (!customElements.get(TAG)) customElements.define(TAG, BigCheeseElement);
