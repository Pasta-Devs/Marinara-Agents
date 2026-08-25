import React, { useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryNagLocalizationProvider, translateMemoryNag, useMemoryNagTranslation } from "./localization";
import { MemoryNagSettings } from "./MemoryNagSettings";
import { MemoryNagToolbar } from "./MemoryNagToolbar";
import { MemoryNagTrackerPanel } from "./MemoryNagTrackerPanel";
import { MEMORY_NAG_STYLES } from "./styles";
import type { CapabilityElement } from "./types";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 1000 } },
});

class MemoryNagErrorBoundary extends React.Component<
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
      translateMemoryNag(this.props.element.capabilityProps?.localization, "memoryNag.error.interface");
    this.props.element.capabilityRuntimeError = message;
    this.props.element.dispatchEvent(
      new CustomEvent("marinara-capability-runtime-error", { detail: { message }, bubbles: true }),
    );
    console.error("Memory Nag client capability stopped", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <MemoryNagError
        onRetry={() => {
          this.props.element.capabilityRuntimeError = null;
          this.setState({ error: null });
        }}
      />
    );
  }
}

function MemoryNagError({ onRetry }: { onRetry: () => void }) {
  const { t } = useMemoryNagTranslation();
  return (
    <div className="mn-shell mn-panel mn-stack" role="alert">
      <strong>{t("memoryNag.error.interface")}</strong>
      <button type="button" className="mari-chrome-control mari-chrome-control--small" onClick={onRetry}>
        {t("memoryNag.error.retry")}
      </button>
    </div>
  );
}

function CapabilityRoot({ element }: { element: CapabilityElement }) {
  const props = element.capabilityProps ?? {};
  const view = element.getAttribute("view");
  if (view === "settings") return <MemoryNagSettings props={props} />;
  if (view === "toolbar") return <MemoryNagToolbar props={props} />;
  if (view === "tracker") return <MemoryNagTrackerPanel props={props} />;
  return null;
}

function LocalizedRoot({ element }: { element: CapabilityElement }) {
  const [, redraw] = useState(0);
  useEffect(() => {
    const update = () => redraw((value) => value + 1);
    element.addEventListener("marinara-capability-props", update);
    return () => element.removeEventListener("marinara-capability-props", update);
  }, [element]);
  return (
    <MemoryNagLocalizationProvider localization={element.capabilityProps?.localization}>
      <style>{MEMORY_NAG_STYLES}</style>
      <MemoryNagErrorBoundary element={element}>
        <CapabilityRoot element={element} />
      </MemoryNagErrorBoundary>
    </MemoryNagLocalizationProvider>
  );
}

class MemoryNagElement extends HTMLElement {
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

const tag = "marinara-capability-memory-nag";
if (!customElements.get(tag)) customElements.define(tag, MemoryNagElement);
