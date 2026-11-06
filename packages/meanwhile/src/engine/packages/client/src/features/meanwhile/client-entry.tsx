import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { createRoot } from "react-dom/client";
import { MeanwhileView } from "./MeanwhileView.js";
import { MeanwhileWidget } from "./MeanwhileWidget.js";
import { MEANWHILE_STYLES } from "./styles.js";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 5_000 } } });

class MeanwhileElement extends HTMLElement {
  private root: ReturnType<typeof createRoot> | null = null;

  connectedCallback() {
    // A custom element is inline by default. The widget fills the card the Engine gives it and scrolls inside.
    if (this.getAttribute("view") === "widget") Object.assign(this.style, { display: "block", height: "100%" });
    if (!this.root) this.root = createRoot(this);
    // The Engine sets the props after it creates the element, so they are read when the user taps.
    const props = () =>
      (this as unknown as { capabilityProps?: { openChat?: (id: string) => void; onOpenNoodle?: () => void } })
        .capabilityProps;
    this.root.render(
      <QueryClientProvider client={queryClient}>
        <style>{MEANWHILE_STYLES}</style>
        {this.getAttribute("view") === "widget" ? (
          <MeanwhileWidget open={() => props()?.onOpenNoodle?.()} active={props()?.active !== false} />
        ) : (
          <MeanwhileView openChat={(id) => props()?.openChat?.(id)} />
        )}
      </QueryClientProvider>,
    );
  }

  disconnectedCallback() {
    queueMicrotask(() => {
      if (!this.isConnected && this.root) {
        this.root.unmount();
        this.root = null;
      }
    });
  }
}

const TAG = "marinara-capability-meanwhile";
if (!customElements.get(TAG)) customElements.define(TAG, MeanwhileElement);
