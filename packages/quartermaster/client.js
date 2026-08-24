// Quartermaster 0.1.0 — Marinara Engine roleplay-tracker capability (single-file client bundle)
// Built from packages/quartermaster/src (1 modules) by scripts/build-quartermaster-package.mjs. Do not edit; edit src/ and rebuild.
(() => {
"use strict";
// ===== 00-element.js =====
// Quartermaster — capability package client entrypoint (scaffold).
// Registers <marinara-capability-quartermaster>, mounted by the host once per
// slot instance with a "view" attribute telling us which one — "toolbar" for
// the compact roleplay-tracker launcher, "tracker" for the full tracker-panel
// content. Mirrors Beholder's src/90-element.js, the closest proven example
// of this exact slot pair. For now the tracker view just calls its own
// /api/quartermaster/ping route so we can confirm the server, storage, and
// route registration all work end to end before any real sheet UI is built.
//
// Game Mode coverage is unresolved — roleplay-tracker/tracker-panel are
// documented as Roleplay-only. Not yet decided how (or whether) this reaches
// Game Mode; needs a live check against the local staging Engine.

class QuartermasterElement extends HTMLElement {
  constructor() {
    super();
    this._props = null;
    this._onPropsEvent = () => this._render();
  }

  set capabilityProps(value) {
    this._props = value;
    this._render();
  }

  get capabilityProps() {
    return this._props;
  }

  static get observedAttributes() {
    return ["view"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "view" && oldValue !== newValue) this._render();
  }

  connectedCallback() {
    this.addEventListener("marinara-capability-props", this._onPropsEvent);
    this._render();
  }

  disconnectedCallback() {
    this.removeEventListener("marinara-capability-props", this._onPropsEvent);
  }

  _render() {
    const view = this.getAttribute("view");
    if (view === "tracker") this._renderTrackerPanel();
    else this._renderToolbarLauncher();
  }

  _renderToolbarLauncher() {
    let button = this._button;
    if (!button || !this.contains(button)) {
      button = document.createElement("button");
      button.type = "button";
      button.textContent = "Quartermaster";
      this.replaceChildren(button);
      this._button = button;
    }
  }

  async _renderTrackerPanel() {
    const container = document.createElement("div");
    container.style.padding = "16px";
    container.style.fontFamily = "system-ui, sans-serif";

    const heading = document.createElement("h2");
    heading.textContent = "Quartermaster";
    container.appendChild(heading);

    const note = document.createElement("p");
    note.textContent = "Scaffold build — checking server connection.";
    container.appendChild(note);

    const status = document.createElement("pre");
    status.style.whiteSpace = "pre-wrap";
    status.textContent = "Checking…";
    container.appendChild(status);

    this.replaceChildren(container);

    try {
      const response = await fetch("/api/quartermaster/ping");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      status.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
      status.textContent = `Server check failed: ${error && error.message ? error.message : error}`;
    }
  }
}

const QUARTERMASTER_TAG = "marinara-capability-quartermaster";
if (!customElements.get(QUARTERMASTER_TAG)) customElements.define(QUARTERMASTER_TAG, QuartermasterElement);

})();
