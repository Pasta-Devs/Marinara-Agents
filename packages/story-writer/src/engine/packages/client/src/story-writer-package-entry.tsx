import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import i18next from "i18next";
import { I18nextProvider } from "react-i18next";
import { queryClient } from "marinara:host";
import english from "./localization/locales/en.json";
import { StoryWriterView } from "./components/story-writer/StoryWriterView";
import { useKeepFocusedFieldAboveKeyboard } from "./hooks/use-keep-focused-field-above-keyboard";
import { READER_STYLES } from "./lib/story-writer/styles-reader";
import { SHELL_STYLES } from "./lib/story-writer/styles-shell";

type Catalog = Record<string, unknown>;

function isCatalog(value: unknown): value is Catalog {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

// Story Writer's own instance, inside <I18nextProvider>. Never `.use(initReactI18next)`: that would make it the
// Engine's global instance.
const localization = i18next.createInstance();
void localization.init({
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  lng: "en",
  resources: {
    en: { translation: english },
  },
});

type CapabilityElement = HTMLElement & {
  capabilityProps?: Record<string, unknown>;
  __root?: Root | null;
};

const STORY_WRITER_ELEMENT_TAG = "marinara-capability-story-writer";
const STORY_WRITER_STYLE_ID = "marinara-capability-story-writer-styles";
const STORY_WRITER_STYLES = `${SHELL_STYLES}\n${READER_STYLES}`;

/** One stylesheet while any Story Writer element is on the page; removed with the last one. */
function syncStoryWriterStyles() {
  const existing = document.getElementById(STORY_WRITER_STYLE_ID);
  if (!document.querySelector(STORY_WRITER_ELEMENT_TAG)) {
    existing?.remove();
    return;
  }
  const style = existing ?? document.createElement("style");
  style.id = STORY_WRITER_STYLE_ID;
  if (style.textContent !== STORY_WRITER_STYLES) style.textContent = STORY_WRITER_STYLES;
  if (!existing) document.head.appendChild(style);
}

function readLocale(props: Record<string, unknown>): string {
  const context = props.localization;
  const locale = isCatalog(context) ? context.locale : null;
  return typeof locale === "string" ? locale : "en";
}

function StoryWriterPackageRoot({ element }: { element: CapabilityElement }) {
  const focusRoot = useRef<HTMLElement>(element);
  useKeepFocusedFieldAboveKeyboard(focusRoot);
  // The host fires this often and with unchanged values: redraw with the new props, never reset state.
  const [, redraw] = useState(0);
  useEffect(() => {
    const update = () => redraw((value) => value + 1);
    element.addEventListener("marinara-capability-props", update);
    return () => element.removeEventListener("marinara-capability-props", update);
  }, [element]);
  const props = element.capabilityProps ?? {};
  const locale = readLocale(props);
  useEffect(() => {
    const language = locale.split("-")[0];
    const supported = new Set(Object.keys(localization.options.resources ?? {}));
    void localization.changeLanguage(supported.has(language) ? language : "en");
  }, [locale]);
  return (
    <I18nextProvider i18n={localization}>
      <QueryClientProvider client={queryClient}>
        <StoryWriterView capabilityProps={props} />
        {/* Dialogs and toasts are the Engine's: its one renderer and toast stack (sources/host-client-overlay). */}
      </QueryClientProvider>
    </I18nextProvider>
  );
}

class MarinaraStoryWriterElement extends HTMLElement {
  declare __root: Root | null;

  connectedCallback() {
    syncStoryWriterStyles();
    this.__root ??= createRoot(this);
    this.__root.render(<StoryWriterPackageRoot element={this} />);
  }

  disconnectedCallback() {
    queueMicrotask(() => {
      if (!this.isConnected && this.__root) {
        this.__root.unmount();
        this.__root = null;
      }
      syncStoryWriterStyles();
    });
  }
}

if (!customElements.get(STORY_WRITER_ELEMENT_TAG)) {
  customElements.define(STORY_WRITER_ELEMENT_TAG, MarinaraStoryWriterElement);
}
