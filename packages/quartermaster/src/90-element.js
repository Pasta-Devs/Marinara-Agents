// Quartermaster — capability package client entrypoint.
// Registers <marinara-capability-quartermaster>, mounted by the host once per
// slot instance with a "view" attribute telling us which one — "toolbar" for
// the compact roleplay-tracker launcher, "tracker" for the tracker-panel
// launcher. Both are just buttons that toggle QM.dock (10-dock.js), the
// self-managed floating panel — matches Beholder's src/90-element.js, where
// both slots launch the same BH.dock rather than each rendering their own
// content.
//
// v1 slice: persona-only inventory. No images, locks, party members, or
// narrator ingestion yet.
//
// Game Mode: confirmed unreachable, not just undocumented — AppShell.tsx
// gates the Tracker Panel with `activeChat?.mode === "roleplay"`, and
// RoleplayHUD.tsx (which renders the roleplay-tracker toolbar button) is
// Roleplay-only by construction. No package code can route around either.

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

  get _chatId() {
    return this._props && typeof this._props.chatId === "string" ? this._props.chatId : null;
  }

  _render() {
    // Neither slot's capabilityProps carries personaInfo/avatarUrl (checked
    // against the Engine's actual RoleplayHUD.tsx/TrackerDataSidebar.tsx
    // render sites) — the portrait is resolved server-side instead, from
    // the GET /inventory response. See QM.dock._loadAndPaint.
    QM.dock.setChat(this._chatId);

    let button = this._button;
    if (!button || !this.contains(button)) {
      button = document.createElement("button");
      button.type = "button";
      button.addEventListener("click", () => QM.dock.toggle());
      this.replaceChildren(button);
      this._button = button;
    }

    const view = this.getAttribute("view");
    const props = this._props;
    const hostClass = props && typeof props.toolbarButtonClass === "string" ? props.toolbarButtonClass : "";
    button.className = `${hostClass} qm-launch`.trim();
    button.textContent = view === "tracker" ? "Open Quartermaster" : "Quartermaster";
    button.setAttribute("aria-pressed", QM.dock.isOpen() ? "true" : "false");
  }
}

const QUARTERMASTER_TAG = "marinara-capability-quartermaster";
if (!customElements.get(QUARTERMASTER_TAG)) customElements.define(QUARTERMASTER_TAG, QuartermasterElement);
