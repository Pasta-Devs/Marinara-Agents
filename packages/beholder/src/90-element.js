// ── Custom element ───────────────────────────────────────────────────────────
// The host mounts <marinara-capability-beholder view="toolbar"> in the roleplay
// toolbar for every chat where the Beholder agent is switched on, and assigns
// node.capabilityProps before dispatching marinara-capability-props. The element
// is only the button; the panel it opens lives in module scope (BH.dock) so it
// survives the remounts the host performs on chat switch, version bump, or retry.

const bhEyeIcon = (className) =>
  `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.06 12.35a1 1 0 0 1 0-.7C3.7 7.6 7.64 5 12 5c4.36 0 8.3 2.6 9.94 6.65a1 1 0 0 1 0 .7C20.3 16.4 16.36 19 12 19c-4.36 0-8.3-2.6-9.94-6.65Z"/><circle cx="12" cy="12" r="3"/></svg>`;

/** Keep every mounted toggle's pressed state in step with the dock. */
BH.syncToggles = function syncToggles() {
  const open = BH.dock.isOpen();
  for (const button of document.querySelectorAll(".bh-hud-toggle,.bh-tracker-launch")) {
    button.setAttribute("aria-pressed", open ? "true" : "false");
    button.classList.toggle("bh-active", open);
  }
};

// The extractor runs server-side after the turn completes, so the state lands a
// few seconds after generation does. Re-read on a short schedule and stop as
// soon as the state changes, rather than polling for the life of the chat.
const BH_REFRESH_DELAYS = [0, 2000, 5000, 9000];
let bhRefreshTimers = [];
BH.dock.refreshSoon = function refreshSoon() {
  for (const timer of bhRefreshTimers) clearTimeout(timer);
  bhRefreshTimers = [];
  const before = JSON.stringify(this.state);
  for (const delay of BH_REFRESH_DELAYS) {
    bhRefreshTimers.push(
      setTimeout(async () => {
        await this.refresh();
        // Landed: drop the remaining attempts.
        if (JSON.stringify(this.state) !== before) {
          for (const timer of bhRefreshTimers) clearTimeout(timer);
          bhRefreshTimers = [];
        }
      }, delay),
    );
  }
};

let bhGenerationBound = false;
function bindGenerationListener() {
  if (bhGenerationBound) return;
  bhGenerationBound = true;
  window.addEventListener("marinara:generation-complete", (event) => {
    const chatId = event?.detail?.chatId;
    if (chatId && chatId === BH.dock.chatId) BH.dock.refreshSoon();
  });
}

class BeholderElement extends HTMLElement {
  constructor() {
    super();
    this._props = null;
    this._onPropsEvent = () => this._sync();
  }

  // The host assigns capabilityProps then dispatches the event; support both the
  // accessor and the event so either ordering works.
  set capabilityProps(value) {
    this._props = value;
    this._sync();
  }

  get capabilityProps() {
    return this._props;
  }

  static get observedAttributes() {
    return ["view"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "view" && oldValue !== newValue) this._sync();
  }

  connectedCallback() {
    this.addEventListener("marinara-capability-props", this._onPropsEvent);
    BH.dock.registerHost(this);
    bindGenerationListener();
    this._sync();
  }

  disconnectedCallback() {
    this.removeEventListener("marinara-capability-props", this._onPropsEvent);
    BH.dock.releaseHost(this);
  }

  _sync() {
    try {
      const view = this.getAttribute("view");
      if (view !== "toolbar" && view !== "tracker") return;
      const props = this._props;
      if (!props || typeof props.chatId !== "string") return;
      BH.ensureStyles();
      BH.dock.props = props;
      BH.dock.setChat(props.chatId);
      if (view === "tracker") this._renderTrackerButton(props);
      else this._renderToggle(props);
    } catch (error) {
      BH.fail(this, error);
    }
  }

  _renderToggle(props) {
    let button = this._button;
    if (!button || !this.contains(button) || !button.classList.contains("bh-hud-toggle")) {
      button = document.createElement("button");
      button.type = "button";
      // The extension had to clone a live toolbar button's classes to match the
      // host's controls; here the host hands us the class it uses itself.
      button.innerHTML = bhEyeIcon("bh-hud-icon");
      button.addEventListener("click", () => {
        BH.dock.toggle();
      });
      this.replaceChildren(button);
      this._button = button;
    }
    const hostClass = typeof props.toolbarButtonClass === "string" ? props.toolbarButtonClass : "";
    button.className = `${hostClass} mari-accent-animated bh-hud-toggle`.trim();
    const label = BH.localize(props, "toolbarLabel", "Beholder");
    button.title = label;
    button.setAttribute("aria-label", label);
    BH.syncToggles();
  }

  _renderTrackerButton(props) {
    let button = this._button;
    if (!button || !this.contains(button) || !button.classList.contains("bh-tracker-launch")) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "bh-tracker-launch";
      button.innerHTML = `<span class="bh-tracker-launch__arrow" aria-hidden="true">›</span><span class="bh-tracker-launch__logo" aria-hidden="true">${bhEyeIcon("bh-tracker-launch__icon")}</span><span class="bh-tracker-launch__title">Beholder</span>`;
      button.addEventListener("click", () => BH.dock.toggle());
      this.replaceChildren(button);
      this._button = button;
    }
    const label = BH.localize(props, "trackerPanelLabel", "Open Beholder");
    button.title = label;
    button.setAttribute("aria-label", label);
    BH.syncToggles();
  }
}

const BH_TAG = "marinara-capability-beholder";
if (!customElements.get(BH_TAG)) customElements.define(BH_TAG, BeholderElement);
