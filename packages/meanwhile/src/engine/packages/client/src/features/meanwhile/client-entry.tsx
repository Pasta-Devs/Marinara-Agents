import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { createRoot } from "react-dom/client";
import { MeanwhileView } from "./MeanwhileView.js";
import { MEANWHILE_STYLES } from "./styles.js";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 5_000 } } });

class MeanwhileElement extends HTMLElement {
  private root: ReturnType<typeof createRoot> | null = null;

  connectedCallback() {
    if (!this.root) this.root = createRoot(this);
    this.root.render(
      <QueryClientProvider client={queryClient}>
        <style>{MEANWHILE_STYLES}</style>
        <MeanwhileView />
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
