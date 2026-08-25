// Quartermaster — capability package client entrypoint.
// Registers <marinara-capability-quartermaster>, mounted by the host once per
// slot instance with a "view" attribute telling us which one — "toolbar" for
// the compact roleplay-tracker launcher, "tracker" for the tracker-panel
// launcher. Both are just buttons that toggle QM.dock (10-dock.js), the
// self-managed floating panel — matches Beholder's src/90-element.js, where
// both slots launch the same BH.dock rather than each rendering their own
// content.
//
// v1 slice: persona-only inventory. No equip slots, images, locks, party
// members, or narrator ingestion yet.
//
// Game Mode coverage is unresolved — roleplay-tracker/tracker-panel are
// documented as Roleplay-only; not yet decided how (or whether) this reaches
// Game Mode.

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
