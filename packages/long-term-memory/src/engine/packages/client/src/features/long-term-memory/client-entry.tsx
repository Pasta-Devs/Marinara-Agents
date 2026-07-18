import React, { useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChatSettings } from "./ChatSettings";
import { LongTermMemoryDetail } from "./LongTermMemoryDetail";
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
    const message = error.message || "Long-Term Memory interface stopped";
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
    return this.state.error ? null : this.props.children;
  }
}

function CapabilityRoot({ element }: { element: CapabilityElement }) {
  const [, redraw] = useState(0);
  useEffect(() => {
    const update = () => redraw((value) => value + 1);
    element.addEventListener("marinara-capability-props", update);
    return () =>
      element.removeEventListener("marinara-capability-props", update);
  }, [element]);

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

  connectedCallback() {
    if (!this.__root) this.__root = createRoot(this);
    this.__root.render(
      <QueryClientProvider client={queryClient}>
        <CapabilityClientErrorBoundary element={this}>
          <CapabilityRoot element={this} />
        </CapabilityClientErrorBoundary>
      </QueryClientProvider>,
    );
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
