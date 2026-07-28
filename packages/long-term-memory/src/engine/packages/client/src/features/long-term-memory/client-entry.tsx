import React, { useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChatSettings } from "./ChatSettings";
import { LongTermMemoryDetail } from "./LongTermMemoryDetail";
import {
  LtmLocalizationProvider,
  translateLtm,
  useLtmTranslation,
} from "./localization";
import type { CapabilityElement } from "./types";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

class CapabilityClientErrorBoundary extends React.Component<
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
      translateLtm(
        this.props.element.capabilityProps?.localization,
        "errors.interfaceStopped",
      );
    this.props.element.capabilityRuntimeError = message;
    this.props.element.dispatchEvent(
      new CustomEvent("marinara-capability-runtime-error", {
        detail: { message },
        bubbles: true,
      }),
    );
    console.error("Long-Term Memory client capability stopped", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <CapabilityClientErrorState
        onRetry={() => {
          this.props.element.capabilityRuntimeError = null;
          this.setState({ error: null });
        }}
      />
    );
  }
}

function CapabilityClientErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useLtmTranslation();
  return (
    <div role="alert" className="mari-editor-panel m-4 space-y-3 p-4 text-sm">
      <p className="font-semibold">{t("errors.interfaceStoppedMessage")}</p>
      <button
        type="button"
        className="mari-editor-action min-h-11 px-3 font-semibold"
        onClick={onRetry}
      >
        {t("errors.tryAgain")}
      </button>
    </div>
  );
}

function LocalizedCapabilityRoot({ element }: { element: CapabilityElement }) {
  const [, redraw] = useState(0);
  useEffect(() => {
    const update = () => redraw((value) => value + 1);
    element.addEventListener("marinara-capability-props", update);
    return () =>
      element.removeEventListener("marinara-capability-props", update);
  }, [element]);

  const props = element.capabilityProps ?? {};
  return (
    <LtmLocalizationProvider localization={props.localization}>
      <CapabilityClientErrorBoundary element={element}>
        <CapabilityRoot element={element} />
      </CapabilityClientErrorBoundary>
    </LtmLocalizationProvider>
  );
}

function CapabilityRoot({ element }: { element: CapabilityElement }) {
  const props = element.capabilityProps ?? {};
  if (element.getAttribute("view") === "settings")
    return <ChatSettings props={props} />;
  if (element.getAttribute("view") !== "detail") return null;
  return <LongTermMemoryDetail props={props} />;
}

class LongTermMemoryElement extends HTMLElement {
  __root: ReturnType<typeof createRoot> | null = null;
  capabilityProps?: CapabilityElement["capabilityProps"];
  capabilityRuntimeError?: string | null;

  static observedAttributes = ["view"];

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ) {
    if (name === "view" && oldValue !== newValue && this.__root) this.render();
  }

  render() {
    this.__root?.render(
      <QueryClientProvider client={queryClient}>
        <LocalizedCapabilityRoot element={this} />
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

const tag = "marinara-capability-long-term-memory";
if (!customElements.get(tag)) customElements.define(tag, LongTermMemoryElement);
