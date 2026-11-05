// ──────────────────────────────────────────────
// Otome Forge: the package client. The Engine mounts <marinara-capability-otome-forge view="browser"> in its Home tab.
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import i18next from "i18next";
import { I18nextProvider } from "react-i18next";
import { queryClient } from "marinara:host";
import english from "./locales/en.json";
import { OtomeForgeView } from "./OtomeForgeView";
import { readLocalization } from "./props";
import { otomeForgeStyles } from "./theme/styles";

// Otome Forge's own instance, inside <I18nextProvider>. Never `.use(initReactI18next)`: that would make it the
// Engine's global instance. The catalog's keys are flat (`ui.otomeForge.common.title`), so dots never nest.
const localization = i18next.createInstance();
void localization.init({
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  keySeparator: false,
  lng: "en",
  resources: { en: { translation: english } },
});

type CapabilityElement = HTMLElement & {
  capabilityProps?: Record<string, unknown>;
  __root?: Root | null;
};

const OTOME_FORGE_ELEMENT_TAG = "marinara-capability-otome-forge";
const OTOME_FORGE_STYLE_ID = "marinara-capability-otome-forge-styles";
let stylesheet: string | null = null;

/** One stylesheet while any Otome Forge element is on the page; removed with the last one. */
function syncOtomeForgeStyles() {
  const existing = document.getElementById(OTOME_FORGE_STYLE_ID);
  if (!document.querySelector(OTOME_FORGE_ELEMENT_TAG)) {
    existing?.remove();
    return;
  }
  stylesheet ??= otomeForgeStyles();
  const style = existing ?? document.createElement("style");
  style.id = OTOME_FORGE_STYLE_ID;
  if (style.textContent !== stylesheet) style.textContent = stylesheet;
  if (!existing) document.head.appendChild(style);
}

function OtomeForgePackageRoot({ element }: { element: CapabilityElement }) {
  // The host fires this often and with unchanged values: redraw with the new props, never reset state.
  const [, redraw] = useState(0);
  useEffect(() => {
    const update = () => redraw((value) => value + 1);
    element.addEventListener("marinara-capability-props", update);
    return () => element.removeEventListener("marinara-capability-props", update);
  }, [element]);
  const props = element.capabilityProps ?? {};
  const { locale } = readLocalization(props);
  useEffect(() => {
    const language = locale.split("-")[0];
    const supported = new Set(Object.keys(localization.options.resources ?? {}));
    void localization.changeLanguage(supported.has(language) ? language : "en");
  }, [locale]);
  return (
    <I18nextProvider i18n={localization}>
      <QueryClientProvider client={queryClient}>
        <OtomeForgeView capabilityProps={props} />
      </QueryClientProvider>
    </I18nextProvider>
  );
}

class MarinaraOtomeForgeElement extends HTMLElement {
  declare __root: Root | null;

  connectedCallback() {
    syncOtomeForgeStyles();
    this.__root ??= createRoot(this);
    this.__root.render(<OtomeForgePackageRoot element={this} />);
  }

  disconnectedCallback() {
    queueMicrotask(() => {
      if (!this.isConnected && this.__root) {
        this.__root.unmount();
        this.__root = null;
      }
      syncOtomeForgeStyles();
    });
  }
}

if (!customElements.get(OTOME_FORGE_ELEMENT_TAG)) {
  customElements.define(OTOME_FORGE_ELEMENT_TAG, MarinaraOtomeForgeElement);
}
