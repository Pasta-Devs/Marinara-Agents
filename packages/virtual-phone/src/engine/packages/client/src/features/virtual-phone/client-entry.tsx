import React, { useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { PhoneShell } from "./PhoneShell";
import type { CapabilityElement } from "./types";

class CapabilityClientErrorBoundary extends React.Component<
  { element: CapabilityElement; children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    const message = error.message || "The phone stopped responding.";
    this.props.element.capabilityRuntimeError = message;
    this.props.element.dispatchEvent(
      new CustomEvent("marinara-capability-runtime-error", { detail: { message }, bubbles: true }),
    );
    console.error("Virtual Phone client capability stopped", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" style={{ margin: "auto", padding: 24, textAlign: "center", fontSize: 13 }}>
        <p style={{ color: "#fca5a5" }}>The phone stopped responding.</p>
        <button
          type="button"
          onClick={() => {
            this.props.element.capabilityRuntimeError = null;
            this.setState({ error: null });
          }}
          style={{
            marginTop: 12,
            padding: "6px 14px",
            border: "1px solid rgb(255 255 255 / 22%)",
            borderRadius: 14,
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          Restart
        </button>
      </div>
    );
  }
}

function ToolbarButton({ element }: { element: CapabilityElement }) {
  const props = element.capabilityProps ?? {};
  return (
    <button
      type="button"
      aria-label="Open phone"
      title="Open the phone for this chat"
      className={props.toolbarButtonClass || ""}
      onClick={() => props.openSurface?.()}
      style={
        props.toolbarButtonClass
          ? undefined
          : {
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              border: 0,
              background: "transparent",
              color: "currentColor",
              cursor: "pointer",
            }
      }
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="7" y="2" width="10" height="20" rx="2.5" />
        <path d="M11 18h2" />
      </svg>
    </button>
  );
}

function CapabilityRoot({ element }: { element: CapabilityElement }) {
  const [, redraw] = useState(0);
  useEffect(() => {
    const update = () => redraw((value) => value + 1);
    element.addEventListener("marinara-capability-props", update);
    return () => element.removeEventListener("marinara-capability-props", update);
  }, [element]);

  const props = element.capabilityProps ?? {};
  const view = element.getAttribute("view") || props.view || "toolbar";
  if (view === "toolbar") return <ToolbarButton element={element} />;
  if (view !== "surface") return null;
  return <PhoneShell props={props} />;
}

class VirtualPhoneElement extends HTMLElement {
  __root: ReturnType<typeof createRoot> | null = null;
  capabilityProps?: CapabilityElement["capabilityProps"];
  capabilityRuntimeError?: string | null;

  static observedAttributes = ["view"];

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (name === "view" && oldValue !== newValue && this.__root) this.render();
  }

  render() {
    this.__root?.render(
      <CapabilityClientErrorBoundary element={this}>
        <CapabilityRoot element={this} />
      </CapabilityClientErrorBoundary>,
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

const tag = "marinara-capability-virtual-phone";
if (!customElements.get(tag)) customElements.define(tag, VirtualPhoneElement);
