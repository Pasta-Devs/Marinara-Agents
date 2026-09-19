// Quartermaster — capability package client entrypoint.
// Registers <marinara-capability-quartermaster>, mounted by the host once per
// slot instance with a "view" attribute telling us which one — "toolbar" for
// the compact roleplay-tracker icon button (opens QM.dock, the floating
// panel), "tracker" for the tracker-panel slot, which renders the real
// inline accordion (QM.panel, 15-panel.js) directly rather than being a
// launcher.
//
// v1 slice: persona-only inventory. No images, locks, party members, or
// narrator ingestion yet.
//
// Game Mode: confirmed unreachable, not just undocumented — AppShell.tsx
// gates the Tracker Panel with `activeChat?.mode === "roleplay"`, and
// RoleplayHUD.tsx (which renders the roleplay-tracker toolbar button) is
// Roleplay-only by construction. No package code can route around either.

// A backpack, stroke-based to match the app's own (Lucide-style) toolbar
// icons rather than looking like a pasted-in logo image. Deliberately not a
// person silhouette — that's Persona Stats' icon.
const QM_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
  '<rect x="5" y="8" width="14" height="13" rx="2"></rect>' +
  '<path d="M9 8V6a3 3 0 0 1 6 0v2"></path>' +
  '<rect x="9" y="12" width="6" height="4" rx="1"></rect>' +
  "</svg>";

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
    if (QM.panel.container === this) QM.panel.unmount();
  }

  get _chatId() {
    return this._props && typeof this._props.chatId === "string" ? this._props.chatId : null;
  }

  _render() {
    QM.state.setChat(this._chatId);

    const view = this.getAttribute("view");
    if (view === "tracker") {
      QM.panel.mount(this);
      return;
    }

    let button = this._button;
    if (!button || !this.contains(button)) {
      button = document.createElement("button");
      button.type = "button";
      button.innerHTML = QM_ICON_SVG;
      button.addEventListener("click", () => QM.dock.toggle());
      this.replaceChildren(button);
      this._button = button;
    }

    const props = this._props;
    const hostClass = props && typeof props.toolbarButtonClass === "string" ? props.toolbarButtonClass : "";
    button.className = `${hostClass} qm-launch`.trim();
    button.title = "Quartermaster";
    button.setAttribute("aria-label", "Quartermaster");
    button.setAttribute("aria-pressed", QM.dock.isOpen() ? "true" : "false");
  }
}

const QUARTERMASTER_TAG = "marinara-capability-quartermaster";
if (!customElements.get(QUARTERMASTER_TAG)) customElements.define(QUARTERMASTER_TAG, QuartermasterElement);
