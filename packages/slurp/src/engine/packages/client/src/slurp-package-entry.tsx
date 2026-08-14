import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SlurpHome } from "./components/slurp/SlurpHome";

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const SLURP_ELEMENT_TAG = "marinara-capability-slurp";
const SLURP_STYLE_ID = "marinara-capability-slurp-styles";
let slurpPackageStyles = "";

function syncStyles() {
  const existing = document.getElementById(SLURP_STYLE_ID);
  if (!document.querySelector(SLURP_ELEMENT_TAG) || !slurpPackageStyles) {
    existing?.remove();
    return;
  }
  const style = existing ?? document.createElement("style");
  style.id = SLURP_STYLE_ID;
  style.textContent = slurpPackageStyles;
  if (!existing) document.head.appendChild(style);
}

export function setSlurpPackageStyles(styleText: string) {
  slurpPackageStyles = styleText;
  syncStyles();
}

type SlurpElement = HTMLElement & { __root?: Root | null };

class MarinaraSlurpElement extends HTMLElement {
  declare __root: Root | null;

  connectedCallback() {
    syncStyles();
    this.__root ??= createRoot(this);
    this.__root.render(
      <QueryClientProvider client={client}>
        <SlurpHome />
      </QueryClientProvider>,
    );
  }

  disconnectedCallback() {
    queueMicrotask(() => {
      if (!this.isConnected && this.__root) {
        this.__root.unmount();
        this.__root = null;
      }
      syncStyles();
    });
  }
}

if (!customElements.get(SLURP_ELEMENT_TAG)) {
  customElements.define(SLURP_ELEMENT_TAG, MarinaraSlurpElement);
}

export type { SlurpElement };
