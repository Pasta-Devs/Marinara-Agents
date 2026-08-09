import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { Toaster } from "sonner";
import german from "./localization/locales/de.json";
import english from "./localization/locales/en.json";
import korean from "./localization/locales/ko.json";
import polish from "./localization/locales/pl.json";
import { NoodleView } from "./components/noodle/NoodleView";
import { configureNoodlePackageState } from "./stores/noodle-package.store";

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const localization = i18next.createInstance();
void localization.use(initReactI18next).init({
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  lng: "en",
  resources: {
    de: { translation: german },
    en: { translation: english },
    ko: { translation: korean },
    pl: { translation: polish },
  },
});

type CapabilityElement = HTMLElement & {
  capabilityProps?: Record<string, unknown>;
  __root?: Root | null;
};

function NoodlePackageRoot({ element }: { element: CapabilityElement }) {
  const [revision, redraw] = useState(0);
  useEffect(() => {
    const update = () => redraw((value) => value + 1);
    element.addEventListener("marinara-capability-props", update);
    return () => element.removeEventListener("marinara-capability-props", update);
  }, [element]);
  useEffect(() => {
    const props = element.capabilityProps ?? {};
    configureNoodlePackageState(props);
    const localizationContext = props.localization;
    const requestedLocale =
      localizationContext && typeof localizationContext === "object" && !Array.isArray(localizationContext)
        ? (localizationContext as Record<string, unknown>).locale
        : null;
    const language = typeof requestedLocale === "string" ? requestedLocale.split("-")[0] : "en";
    void localization.changeLanguage(language && ["de", "en", "ko", "pl"].includes(language) ? language : "en");
  }, [element, revision]);
  return (
    <I18nextProvider i18n={localization}>
      <QueryClientProvider client={client}>
        <div className="h-full min-h-0 overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
          <NoodleView />
          <Toaster richColors />
        </div>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

class MarinaraNoodleElement extends HTMLElement {
  declare __root: Root | null;

  connectedCallback() {
    this.__root ??= createRoot(this);
    this.__root.render(<NoodlePackageRoot element={this} />);
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

if (!customElements.get("marinara-capability-noodle")) {
  customElements.define("marinara-capability-noodle", MarinaraNoodleElement);
}
