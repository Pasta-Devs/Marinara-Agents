import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { PhoneShell } from "./PhoneShell";
import type { CapabilityElement, CapabilityProps } from "./types";

const PHONE_VISIBILITY_EVENT = "marinara-virtual-phone-visibility";

function setPhoneVisible(chatId: string | undefined, visible: boolean) {
  if (!chatId) return;
  window.dispatchEvent(new CustomEvent(PHONE_VISIBILITY_EVENT, { detail: { chatId, visible } }));
}

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
      onClick={() => setPhoneVisible(props.chatId, true)}
      style={
        props.toolbarButtonClass
           ? undefined
           : {
               display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              padding: 0,
              border: 0,
              borderRadius: 10,
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

function SurfacePhone({ props }: { props: CapabilityProps }) {
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ chatId?: string; visible?: boolean }>).detail;
      if (detail?.chatId === props.chatId) setVisible(detail.visible === true);
    };
    window.addEventListener(PHONE_VISIBILITY_EVENT, update);
    return () => window.removeEventListener(PHONE_VISIBILITY_EVENT, update);
  }, [props.chatId]);

  useEffect(() => {
    if (!visible) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPhoneVisible(props.chatId, false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [props.chatId, visible]);

  if (!visible) return null;
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Virtual Phone"
      tabIndex={-1}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        justifyContent: "flex-end",
        background: "rgb(0 0 0 / 48%)",
        backdropFilter: "blur(4px)",
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setPhoneVisible(props.chatId, false);
      }}
    >
      <PhoneShell props={{ ...props, onClose: () => setPhoneVisible(props.chatId, false) }} />
    </div>
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
  if (view !== "surface" && view !== "detail") return null;
  if (view === "surface") return <SurfacePhone props={props} />;
  if (view === "detail" && !props.chatId) {
    return (
      <div role="status" style={{ margin: "auto", padding: 24, textAlign: "center", fontSize: 13 }}>
        Open a Conversation or Roleplay chat to use this phone.
      </div>
    );
  }
  if (view === "detail" && props.enabledForChat === false) {
    return (
      <div style={{ margin: "auto", maxWidth: 360, padding: 24, textAlign: "center", fontSize: 13 }}>
        <p style={{ margin: 0 }}>Enable Virtual Phone for this chat to open its home screen and apps.</p>
        <button
          type="button"
          onClick={() => void props.onEnabledForChatChange?.(true)}
          style={{
            marginTop: 16,
            minHeight: 44,
            padding: "0 18px",
            border: "1px solid var(--border, #444)",
            borderRadius: 10,
            background: "var(--primary, #ffb3d9)",
            color: "var(--primary-foreground, #171117)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Enable for this chat
        </button>
      </div>
    );
  }
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
