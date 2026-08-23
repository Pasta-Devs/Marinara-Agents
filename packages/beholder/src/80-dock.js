// ── The docked panel ─────────────────────────────────────────────────────────
// Ported from the Beholder extension's host shim. The extension injected this
// panel into its host and had to fight for a place on screen; here the host
// mounts us, so only the panel itself and its docking behaviour carry over.
//
// It docks to the right rather than floating: Marinara already reflows the chat
// around a right-side panel (--tracker-chat-avoid-right), so opening Beholder
// moves the conversation aside instead of covering it. Offsets are measured from
// the live layout each time it opens, so it never parks on top of another panel.

const BH_HOST_CSS = `
.beholder-panel{
  --SmartThemeBlurTintColor: var(--card, rgba(20,20,24,.92));
  --SmartThemeBodyColor: var(--foreground, #e0e0e0);
  --SmartThemeBorderColor: var(--border, rgba(255,255,255,.15));
  --SmartThemeEmColor: var(--marinara-chat-chrome-accent, var(--primary));
  --SmartThemeQuoteColor: var(--marinara-chat-chrome-accent, var(--primary));
  --bh-accent-pref: var(--primary);
  --bh-chroma: var(--marinara-chat-chrome-accent, var(--primary));
  --bh-font-display: var(--font-sans, inherit);
  display:flex !important; position:fixed !important; top:var(--bh-dock-top,0px) !important; right:0 !important; left:auto !important; bottom:auto !important;
  height:calc(100vh - var(--bh-dock-top,0px)) !important; max-height:calc(100vh - var(--bh-dock-top,0px)) !important; width:min(500px,94vw) !important; min-width:0 !important;
  border-radius:0 !important; transform:translateX(calc(-1 * var(--bh-dock-right,0px))); transition:transform .22s ease; z-index:40; }
/* Collapsed: slide fully off the viewport's right edge — independent of the open-state
   offset, so it never parks on top of a Marinara right panel. */
.beholder-panel.bh-collapsed{ transform:translateX(103%) !important; }
/* floating-only chrome doesn't apply to a docked side-tab */
.beholder-panel .beholder-close, .beholder-panel .beholder-resize-handle{ display:none !important; }
@media (max-width:767px){
  .beholder-panel{ top:auto !important; bottom:0 !important; right:0 !important; left:0 !important;
    width:100% !important; height:auto !important; max-height:72vh !important; border-radius:14px 14px 0 0 !important; transform:translateY(0); }
  .beholder-panel.bh-collapsed{ transform:translateY(103%) !important; }
}
/* Native reflow: Marinara shifts the chat + composer to avoid a right-side panel via
   --tracker-chat-avoid-right (the shell sets it inline; !important beats the inline value).
   So opening the Beholder dock makes the roleplay view make room, not get covered. */
body.bh-dock-open .mari-app-background-paint{ --tracker-chat-avoid-right: min(500px,94vw) !important; --tracker-panel-hud-clear-right: min(500px,94vw) !important; }
.bh-hud-toggle{ display:inline-flex;align-items:center;justify-content:center;cursor:pointer;
  border-color:var(--primary) !important;color:var(--primary) !important; }
.bh-hud-toggle:hover,.bh-hud-toggle.bh-active{ color:var(--primary) !important; }
.bh-hud-icon{ display:block;width:16px;height:16px;object-fit:contain; }
.bh-tracker-launch{display:flex;width:100%;min-height:2rem;align-items:center;gap:.5rem;
  border:0;border-bottom:1px solid var(--border);background:var(--tracker-panel-section-background,transparent);
  padding:.25rem .5rem;color:var(--foreground);cursor:pointer;font:inherit;text-align:left;}
.bh-tracker-launch:hover{background:color-mix(in srgb,var(--accent) 18%,transparent);}
.bh-tracker-launch__logo{display:flex;width:1.25rem;height:1.25rem;align-items:center;justify-content:center;
  border:1px solid var(--primary);border-radius:.25rem;background:color-mix(in srgb,var(--primary) 9%,transparent);}
.bh-tracker-launch__logo img{display:block;width:.875rem;height:.875rem;object-fit:contain;}
.bh-tracker-launch__title{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:.625rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--foreground) 62%,transparent);}
.bh-tracker-launch__arrow{color:var(--muted-foreground);font-size:.875rem;opacity:.7;}
.bh-dock-close{ cursor:pointer; margin-right:6px; opacity:.75 }
.bh-dock-close:hover{ opacity:1 }
`;

const BH_LAYER_KEYS = ["color", "damage", "wounds"];
const BH_LAYOUTS = ["paired", "columns", "list"];
const BH_LAYOUT_KEY = "marinara.beholder.layout";
const BH_LAYERS_KEY = "marinara.beholder.viewLayers";

BH.readLayout = function readLayout() {
  try {
    const stored = window.localStorage.getItem(BH_LAYOUT_KEY);
    if (BH_LAYOUTS.includes(stored)) return stored;
  } catch {
    // A blocked storage read must not break the dock.
  }
  return "paired";
};

BH.readLayers = function readLayers() {
  const layers = { color: true, damage: true, wounds: true };
  try {
    const raw = JSON.parse(window.localStorage.getItem(BH_LAYERS_KEY) || "null");
    if (raw && typeof raw === "object") {
      for (const key of BH_LAYER_KEYS) if (typeof raw[key] === "boolean") layers[key] = raw[key];
    }
  } catch {
    // Fall back to all layers on.
  }
  return layers;
};

BH.writeSetting = function writeSetting(key, value) {
  try {
    window.localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    // Persisting is a convenience; the session still works without it.
  }
};

/**
 * The dock: one panel per document, shared by every element instance.
 *
 * The host may mount the toolbar element more than once across a session (chat
 * switches, version bumps, error retries), so the panel and its state live in
 * module scope and survive remounts, exactly as the extension's did.
 */
BH.dock = {
  panel: null,
  props: null,
  state: {},
  chatId: null,
  activeName: null,
  layout: BH.readLayout(),
  layers: BH.readLayers(),
  viewByChar: new Map(),
  unviewed: new Set(),
  _resizeBound: false,

  /** Build the panel once. Markup is the extension's, so style.css applies unchanged. */
  ensure() {
    if (this.panel && document.body.contains(this.panel)) return this.panel;
    BH.ensureStyles();
    const panel = document.createElement("div");
    panel.id = BH.PANEL_ID;
    panel.className = "beholder-panel bh-collapsed";
    panel.setAttribute("data-empty", "true");
    // data-chat-floating-panel keeps host keyboard shortcuts off our controls.
    panel.setAttribute("data-chat-floating-panel", "");
    const say = (key, fallback) => BH.escapeHtml(BH.localize(this.props, key, fallback));
    panel.innerHTML = `
      <div class="beholder-panel-header">
        <button type="button" class="bh-dock-close fa-solid fa-xmark" title="${say("dockClose", "Close Beholder")}" aria-label="${say("dockClose", "Close Beholder")}"></button>
        <span class="beholder-panel-title">${say("dockTitle", "Beholder")}</span>
        <span class="beholder-panel-controls"></span>
      </div>
      <div class="beholder-layer-bar" role="group" aria-label="${say("layerBarLabel", "Detail layers")}">
        <label class="bh-layer-cell" data-layer="color" title="${say("layerColorHint", "Color word annotation on chips")}"><input type="checkbox" name="bh-view-layer" value="color"><span>${say("layerColor", "Color")}</span></label>
        <label class="bh-layer-cell" data-layer="damage" title="${say("layerDamageHint", "Damage-tier visuals + damage word")}"><input type="checkbox" name="bh-view-layer" value="damage"><span>${say("layerDamage", "Damage")}</span></label>
        <label class="bh-layer-cell" data-layer="wounds" title="${say("layerWoundsHint", "Wounds, bleeding, severity")}"><input type="checkbox" name="bh-view-layer" value="wounds"><span>${say("layerWounds", "Wounds")}</span></label>
      </div>
      <div class="beholder-panel-body"></div>`;
    document.body.appendChild(panel);
    this.panel = panel;

    panel.querySelector(".bh-dock-close").addEventListener("click", () => this.close());
    panel.addEventListener("change", (event) => {
      const input = event.target.closest('input[name="bh-view-layer"]');
      if (!input) return;
      this.layers = { ...this.layers, [input.value]: input.checked };
      BH.writeSetting(BH_LAYERS_KEY, this.layers);
      this.applyLayers();
    });
    // The doll emits its own controls; delegate so they drive dock state. The
    // view toggle also carries data-char, so it is matched before the tabs.
    panel.addEventListener("click", (event) => {
      const target = event.target;
      if (target.closest(".bh-view-toggle")) {
        const name = this.activeName;
        if (name) this.viewByChar.set(name, this.viewByChar.get(name) === "back" ? "front" : "back");
        this.render();
        return;
      }
      const layoutButton = target.closest("[data-layout]");
      if (layoutButton && BH_LAYOUTS.includes(layoutButton.dataset.layout)) {
        this.layout = layoutButton.dataset.layout;
        BH.writeSetting(BH_LAYOUT_KEY, this.layout);
        this.render();
        return;
      }
      const tab = target.closest("button[data-char]");
      if (tab && tab.dataset.char) {
        this.activeName = tab.dataset.char;
        this.render();
      }
    });

    this.applyLayers();
    if (!this._resizeBound) {
      this._resizeBound = true;
      let frame = 0;
      window.addEventListener("resize", () => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          this.syncOffset();
          this.render();
        });
      });
    }
    return panel;
  },

  applyLayers() {
    if (!this.panel) return;
    for (const key of BH_LAYER_KEYS) this.panel.classList.toggle(`bh-hide-${key}`, !this.layers[key]);
    for (const input of this.panel.querySelectorAll('input[name="bh-view-layer"]')) {
      input.checked = !!this.layers[input.value];
    }
  },

  isOpen() {
    return !!this.panel && !this.panel.classList.contains("bh-collapsed");
  },

  toggle() {
    const panel = this.ensure();
    panel.classList.toggle("bh-collapsed");
    // Sync Marinara's native chat reflow to the dock's open state.
    document.body.classList.toggle(BH.DOCK_OPEN_CLASS, !panel.classList.contains("bh-collapsed"));
    this.syncOffset();
    BH.syncToggles();
    if (this.isOpen()) void this.refresh();
  },

  close() {
    if (this.panel) this.panel.classList.add("bh-collapsed");
    document.body.classList.remove(BH.DOCK_OPEN_CLASS);
    BH.syncToggles();
  },

  // Marinara's own right-side panels are flex siblings that SHRINK `.mari-main`, but
  // Beholder is viewport-fixed at right:0 — so when one opens we would overlap it AND
  // leave an empty gap (the chat over-compresses). Keep Beholder flush with main's
  // right edge: right = (width of whatever is docked right) = innerWidth - main.right.
  syncOffset() {
    const panel = this.panel;
    const main = document.querySelector(".mari-main");
    if (!panel || !main) return;
    const offset = Math.max(0, Math.round(window.innerWidth - main.getBoundingClientRect().right));
    panel.style.setProperty("--bh-dock-right", `${offset}px`);
    // Top: sit directly below the app top bar. Its right-side nav stays reachable
    // above the panel, and the chat toolbar row reflows to the LEFT of the panel
    // (--tracker-chat-avoid-right), so nothing is covered.
    const topbar = document.querySelector("header.mari-topbar");
    panel.style.setProperty("--bh-dock-top", `${topbar ? Math.round(topbar.getBoundingClientRect().bottom) : 0}px`);
  },

  /** Point the dock at a chat. Switching chats drops per-chat view memory. */
  setChat(chatId) {
    if (this.chatId === chatId) return;
    this.chatId = chatId;
    this.state = {};
    this.activeName = null;
    this.viewByChar.clear();
    this.unviewed.clear();
    if (this.panel) this.render();
    if (this.isOpen()) void this.refresh();
  },

  async refresh() {
    const chatId = this.chatId;
    if (!chatId) return;
    try {
      const next = await BH.fetchState(chatId);
      if (this.chatId !== chatId) return; // chat switched mid-flight
      this.adopt(next);
    } catch (error) {
      // A read failure leaves the last known doll on screen; the next turn retries.
      console.warn("[beholder] state refresh failed", error);
    }
  },

  /** Mark characters whose state changed since the last render, then draw. */
  adopt(next) {
    const previous = this.state || {};
    for (const [name, value] of Object.entries(next)) {
      const before = previous[name];
      if (!before || JSON.stringify(before) !== JSON.stringify(value)) this.unviewed.add(name);
    }
    for (const name of [...this.unviewed]) if (!(name in next)) this.unviewed.delete(name);
    this.state = next;
    this.render();
  },

  render() {
    const panel = this.panel;
    if (!panel) return;
    const body = panel.querySelector(".beholder-panel-body");
    if (!body) return;

    // No state renders the full-size default-human placeholder built by the
    // renderer rather than collapsing to a chip, so the panel shows at its real
    // size immediately. data-empty only mutes the placeholder's name + caption.
    const isEmpty = Object.keys(this.state).length === 0;
    panel.setAttribute("data-empty", isEmpty ? "true" : "false");
    if (isEmpty) this.unviewed.clear();

    // Narrow viewports use the compact list; a wide one restores the choice.
    const layout = window.innerWidth < 768 ? "list" : this.layout;
    setDollLayout(layout);
    panel.classList.toggle("bh-layout-compact", layout === "list");

    // The active character's updates are viewed by definition.
    const unviewedForRender = new Set(this.unviewed);
    if (this.activeName) unviewedForRender.delete(this.activeName);
    const view = this.activeName ? this.viewByChar.get(this.activeName) || "front" : "front";
    const rendered = renderDollPanel(this.state, this.activeName, unviewedForRender, view);
    this.activeName = rendered.activeName;
    if (this.activeName) this.unviewed.delete(this.activeName);
    body.innerHTML = rendered.html || "";
  },
};
