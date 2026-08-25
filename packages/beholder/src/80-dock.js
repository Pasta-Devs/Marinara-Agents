// ── The floating panel ───────────────────────────────────────────────────────
// Ported from the Beholder extension's host shim. The extension injected this
// panel into its host and had to fight for a place on screen; here the host
// mounts us. Desktop keeps the extension's movable workspace behavior inside the
// live roleplay area; mobile uses the host's full-screen panel geometry.

const BH_HOST_CSS = `
.beholder-panel{
  --SmartThemeBlurTintColor: var(--card, rgba(20,20,24,.92));
  --SmartThemeBodyColor: var(--foreground, #e0e0e0);
  --SmartThemeBorderColor: var(--border, rgba(255,255,255,.15));
  --SmartThemeEmColor: var(--marinara-chat-chrome-accent, var(--foreground));
  --SmartThemeQuoteColor: var(--marinara-chat-chrome-accent, var(--foreground));
  --bh-accent-pref: var(--marinara-chat-chrome-accent, var(--foreground));
  --bh-chroma: var(--marinara-chat-chrome-accent, var(--foreground));
  --bh-window-accent: var(--marinara-app-accent-static, var(--primary));
  --bh-font-display: var(--font-sans, inherit);
  box-sizing:border-box; display:flex !important; position:absolute !important;
  top:var(--bh-window-top,1rem) !important; left:var(--bh-window-left,1rem) !important; right:auto !important; bottom:auto !important;
  width:var(--bh-window-width,min(500px,calc(100% - 2rem))) !important; height:var(--bh-window-height,min(620px,calc(100% - 2rem))) !important;
  min-width:0 !important; min-height:0 !important; max-width:none !important; max-height:none !important;
  border-color:var(--bh-window-accent) !important; border-radius:.75rem !important; transform:none !important; z-index:50; }
.beholder-panel.bh-detached{ position:fixed !important; inset:0 !important; width:100vw !important; height:100dvh !important; border-radius:0 !important; }
.beholder-panel.bh-collapsed{ display:none !important; }
.beholder-panel-body{ min-height:0; overflow:hidden; }
.beholder-panel .beholder-close{ display:none !important; }
.beholder-panel .beholder-resize-handle{ display:block !important; left:auto; right:.25rem; bottom:.25rem; transform:none;
  width:1.5rem; height:1.5rem; border:0; border-radius:.25rem; background:transparent; color:var(--bh-window-accent);
  cursor:nwse-resize; opacity:.65; touch-action:none; }
.beholder-panel .beholder-resize-handle::after{ content:""; position:absolute; right:.25rem; bottom:.25rem; width:.625rem; height:.625rem;
  border-right:2px solid currentColor; border-bottom:2px solid currentColor; }
.beholder-panel .beholder-resize-handle:hover{ width:1.5rem; background:var(--bh-surface-2); color:var(--bh-window-accent); opacity:1; }
.beholder-panel-header{ touch-action:none; }
.beholder-panel-controls{ flex-wrap:nowrap; }
.beholder-panel-controls :is(.bh-dock-popout,.bh-dock-close){ box-sizing:border-box; display:inline-flex; width:1.75rem; height:1.75rem; align-items:center; justify-content:center; border:0; border-radius:.375rem;
  padding:0; font-size:.875rem;
  background:transparent; color:var(--bh-window-accent); cursor:pointer; opacity:.8; }
.beholder-panel-controls :is(.bh-dock-popout,.bh-dock-close):hover{ background:var(--bh-surface-2); color:var(--bh-window-accent); opacity:1; }
.beholder-panel-controls :is(.bh-dock-popout,.bh-dock-close):focus-visible{ outline:2px solid var(--bh-window-accent); outline-offset:1px; }
.beholder-panel.bh-detached .bh-dock-popout,.beholder-panel.bh-detached .beholder-resize-handle{ display:none !important; }
@media (max-width:767px){
  .rpg-chat-area.bh-beholder-open{ z-index:70; }
  .beholder-panel{ inset:0 !important; width:100% !important; height:100% !important; max-height:none !important; border-radius:0 !important; z-index:80; }
  .beholder-panel-header{ cursor:default; touch-action:auto; }
  .beholder-panel .beholder-resize-handle{ display:none !important; }
  .beholder-panel-body{ overflow-y:auto; padding-bottom:max(var(--bh-space-4),env(safe-area-inset-bottom)); }
  .beholder-panel.bh-mobile-layout .bh-doll-grid{ display:grid; }
  .beholder-panel.bh-mobile-layout .bh-digest{ display:none; }
}
.bh-hud-toggle{ cursor:pointer; }
.bh-hud-icon{ display:block;width:.875rem;height:.875rem;color:var(--marinara-app-accent-solid,var(--primary)); }
.bh-tracker-launch{display:flex;width:100%;min-height:1.75rem;align-items:center;gap:.25rem;
  border:0;border-bottom:1px solid var(--border);background:var(--tracker-panel-section-background,transparent);
  padding:.125rem .25rem;color:var(--foreground);cursor:pointer;font:inherit;text-align:left;}
.bh-tracker-launch:hover{background:color-mix(in srgb,var(--accent) 18%,transparent);}
.bh-tracker-launch.bh-active{background:color-mix(in srgb,var(--marinara-chat-chrome-accent,var(--foreground)) 14%,transparent);}
.bh-tracker-launch:focus-visible{outline:2px solid var(--marinara-chat-chrome-accent,var(--foreground));outline-offset:-2px;}
.bh-tracker-launch__logo{display:flex;width:.875rem;height:.875rem;align-items:center;justify-content:center;color:var(--tracker-profile-icon,var(--muted-foreground));opacity:.75;}
.bh-tracker-launch__icon{display:block;width:.6875rem;height:.6875rem;}
.bh-tracker-launch__title{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:.625rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--foreground) 62%,transparent);}
.bh-tracker-launch__arrow{display:flex;width:.75rem;height:.875rem;align-items:center;justify-content:center;color:var(--tracker-profile-icon,var(--muted-foreground));font-size:.875rem;opacity:.6;transform:rotate(0deg);transition:transform 150ms ease;}
.bh-tracker-launch.bh-active .bh-tracker-launch__arrow{transform:rotate(90deg);}
.beholder-panel:not(.bh-mobile-layout):not(.bh-layout-compact) .bh-doll-grid{display:grid;}
.beholder-panel:not(.bh-mobile-layout):not(.bh-layout-compact) .bh-digest{display:none;}
`;

const BH_LAYER_KEYS = ["color", "damage", "wounds"];
const BH_LAYOUTS = ["paired", "columns", "list"];
const BH_LAYOUT_KEY = "marinara.beholder.layout";
const BH_LAYERS_KEY = "marinara.beholder.viewLayers";
const BH_WINDOW_KEY = "marinara.beholder.window";
const BH_WINDOW_MARGIN = 12;
const BH_WINDOW_MIN_WIDTH = 280;
const BH_WINDOW_MIN_HEIGHT = 260;
const BH_WINDOW_DEFAULT_WIDTH = 500;
const BH_WINDOW_DEFAULT_HEIGHT = 620;
const BH_WINDOW_MIN_SCALE = 0.24;
const BH_WINDOW_MAX_SCALE = 1.35;
const BH_THEME_VARIABLES = [
  "--background",
  "--foreground",
  "--card",
  "--border",
  "--accent",
  "--primary",
  "--ring",
  "--muted",
  "--muted-foreground",
  "--popover",
  "--font-sans",
  "--marinara-app-accent-solid",
  "--marinara-app-accent-static",
  "--marinara-chat-chrome-accent",
];

const clampWindowValue = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

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

BH.readWindowGeometry = function readWindowGeometry() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(BH_WINDOW_KEY) || "null");
    if (stored && [stored.left, stored.top, stored.width, stored.height].every((value) => Number.isFinite(value))) {
      return stored;
    }
  } catch {
    // A blocked or stale storage value falls back to the default placement.
  }
  return null;
};

BH.writeSetting = function writeSetting(key, value) {
  try {
    window.localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    // Persisting is a convenience; the session still works without it.
  }
};

/**
 * One floating panel per document, shared by every element instance.
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
  geometry: BH.readWindowGeometry(),
  viewByChar: new Map(),
  unviewed: new Set(),
  hostElements: new Set(),
  hostArea: null,
  detachedWindow: null,
  _windowBound: false,
  _interaction: null,
  _boundsObserver: null,
  _detachedResize: null,

  registerHost(element) {
    const area = element.closest?.(".rpg-chat-area");
    if (!area) return;
    this.hostElements.add(element);
    this.hostArea = area;
    if (this.panel && !this.isDetached() && this.panel.parentElement !== area) area.appendChild(this.panel);
    this.observeBounds();
    this.syncGeometry();
  },

  releaseHost(element) {
    this.hostElements.delete(element);
    requestAnimationFrame(() => {
      for (const host of this.hostElements) if (!host.isConnected) this.hostElements.delete(host);
      if (this.hostElements.size === 0 && !this.isDetached()) this.close();
    });
  },

  findChatArea() {
    if (this.hostArea?.isConnected) return this.hostArea;
    this.hostArea =
      Array.from(document.querySelectorAll(".rpg-chat-area")).find((area) => {
        const rect = area.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1;
      }) || null;
    return this.hostArea;
  },

  isDetached() {
    return (
      !!this.detachedWindow && !this.detachedWindow.closed && this.panel?.ownerDocument === this.detachedWindow.document
    );
  },

  /** Build the panel once. Markup is the extension's, so style.css applies unchanged. */
  ensure() {
    if (this.panel?.isConnected) return this.panel;
    const hostArea = this.findChatArea();
    if (!hostArea) return null;
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
        <span class="beholder-panel-title">${say("dockTitle", "Beholder")}</span>
        <span class="beholder-panel-controls"><button type="button" class="bh-dock-popout fa-solid fa-arrow-up-right-from-square" title="${say("dockPopOut", "Open Beholder in a new tab")}" aria-label="${say("dockPopOut", "Open Beholder in a new tab")}"></button><button type="button" class="bh-dock-close fa-solid fa-xmark" title="${say("dockClose", "Close Beholder")}" aria-label="${say("dockClose", "Close Beholder")}"></button></span>
      </div>
      <div class="beholder-layer-bar" role="group" aria-label="${say("layerBarLabel", "Detail layers")}">
        <label class="bh-layer-cell" data-layer="color" title="${say("layerColorHint", "Color word annotation on chips")}"><input type="checkbox" name="bh-view-layer" value="color"><span>${say("layerColor", "Color")}</span></label>
        <label class="bh-layer-cell" data-layer="damage" title="${say("layerDamageHint", "Damage-tier visuals + damage word")}"><input type="checkbox" name="bh-view-layer" value="damage"><span>${say("layerDamage", "Damage")}</span></label>
        <label class="bh-layer-cell" data-layer="wounds" title="${say("layerWoundsHint", "Wounds, bleeding, severity")}"><input type="checkbox" name="bh-view-layer" value="wounds"><span>${say("layerWounds", "Wounds")}</span></label>
      </div>
      <div class="beholder-panel-body"></div>
      <button type="button" class="beholder-resize-handle" title="${say("resizeWindow", "Resize Beholder")}" aria-label="${say("resizeWindow", "Resize Beholder")}"></button>`;
    hostArea.appendChild(panel);
    this.panel = panel;
    document.body.classList.remove("bh-dock-open");

    panel.querySelector(".bh-dock-close").addEventListener("click", () => this.close());
    panel.querySelector(".bh-dock-popout").addEventListener("click", () => this.popOut());
    panel.querySelector(".beholder-panel-header").addEventListener("pointerdown", (event) => {
      this.startInteraction("move", event);
    });
    const resizeHandle = panel.querySelector(".beholder-resize-handle");
    resizeHandle.addEventListener("pointerdown", (event) => {
      this.startInteraction("resize", event);
    });
    resizeHandle.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 48 : 16;
      const delta = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }[event.key];
      if (!delta) return;
      event.preventDefault();
      this.resizeBy(delta[0], delta[1]);
    });
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
    this.syncGeometry();
    this.observeBounds();
    if (!this._windowBound) {
      this._windowBound = true;
      let frame = 0;
      window.addEventListener("resize", () => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          this.syncGeometry();
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
    if (!panel) return;
    if (this.isDetached()) {
      this.detachedWindow.focus();
      return;
    }
    if (this.isOpen()) {
      this.close();
      return;
    }
    this.syncGeometry();
    panel.classList.remove("bh-collapsed");
    this.syncHostLayer();
    BH.syncToggles();
    void this.refresh();
  },

  close() {
    if (this.isDetached()) {
      const popup = this.detachedWindow;
      this.restoreFromDetached();
      popup.close();
      return;
    }
    if (this.panel) this.panel.classList.add("bh-collapsed");
    this.syncHostLayer();
    BH.syncToggles();
  },

  syncHostLayer() {
    this.findChatArea()?.classList.toggle("bh-beholder-open", this.isOpen() && !this.isDetached());
  },

  isMobile() {
    return window.matchMedia("(max-width: 767px)").matches;
  },

  getChatBounds() {
    if (this.isDetached()) {
      return { left: 0, top: 0, right: this.detachedWindow.innerWidth, bottom: this.detachedWindow.innerHeight };
    }
    const area = this.findChatArea();
    if (!area) return null;
    const rect = area.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) return null;
    return { left: 0, top: 0, right: area.clientWidth, bottom: area.clientHeight };
  },

  applyScale(width, height) {
    if (!this.panel) return 1;
    const scale = clampWindowValue(
      Math.min(width / BH_WINDOW_DEFAULT_WIDTH, height / BH_WINDOW_DEFAULT_HEIGHT),
      BH_WINDOW_MIN_SCALE,
      BH_WINDOW_MAX_SCALE,
    );
    this.panel.style.setProperty("--bh-ui-scale", scale.toFixed(3));
    return scale;
  },

  fitDesktopContent() {
    const panel = this.panel;
    if (!panel || (!this.isDetached() && this.isMobile())) return;
    const body = panel.querySelector(".beholder-panel-body");
    if (!body) return;
    const rect = panel.getBoundingClientRect();
    let scale = this.applyScale(rect.width, rect.height);
    for (let pass = 0; pass < 2; pass += 1) {
      const widthRatio = body.clientWidth / Math.max(body.scrollWidth, 1);
      const heightRatio = body.clientHeight / Math.max(body.scrollHeight, 1);
      const fit = Math.min(1, widthRatio, heightRatio);
      if (fit >= 0.995) break;
      scale = clampWindowValue(scale * fit, BH_WINDOW_MIN_SCALE, BH_WINDOW_MAX_SCALE);
      panel.style.setProperty("--bh-ui-scale", scale.toFixed(3));
    }
  },

  applyGeometry(geometry) {
    const panel = this.panel;
    if (!panel) return;
    panel.style.setProperty("--bh-window-left", `${Math.round(geometry.left)}px`);
    panel.style.setProperty("--bh-window-top", `${Math.round(geometry.top)}px`);
    panel.style.setProperty("--bh-window-width", `${Math.round(geometry.width)}px`);
    panel.style.setProperty("--bh-window-height", `${Math.round(geometry.height)}px`);
    this.applyScale(geometry.width, geometry.height);
  },

  syncGeometry() {
    const panel = this.panel;
    if (!panel) return;
    const bounds = this.getChatBounds();
    if (!bounds) {
      if (this.isOpen() && !this.isDetached()) this.close();
      return;
    }
    if (this.isDetached()) {
      panel.classList.remove("bh-mobile-layout");
      this.applyScale(bounds.right, bounds.bottom);
      return;
    }
    if (this.isMobile()) {
      panel.classList.add("bh-mobile-layout");
      this.applyScale(bounds.right, bounds.bottom);
      return;
    }
    panel.classList.remove("bh-mobile-layout");

    const availableWidth = Math.max(1, bounds.right - bounds.left);
    const availableHeight = Math.max(1, bounds.bottom - bounds.top);
    const margin = Math.min(BH_WINDOW_MARGIN, availableWidth / 4, availableHeight / 4);
    const maxWidth = Math.max(1, availableWidth - margin * 2);
    const maxHeight = Math.max(1, availableHeight - margin * 2);
    const minWidth = Math.min(BH_WINDOW_MIN_WIDTH, maxWidth);
    const minHeight = Math.min(BH_WINDOW_MIN_HEIGHT, maxHeight);
    const width = clampWindowValue(this.geometry?.width ?? BH_WINDOW_DEFAULT_WIDTH, minWidth, maxWidth);
    const height = clampWindowValue(this.geometry?.height ?? BH_WINDOW_DEFAULT_HEIGHT, minHeight, maxHeight);
    const defaultLeft = bounds.right - margin - width;
    const defaultTop = bounds.top + margin;
    const left = clampWindowValue(
      this.geometry?.left ?? defaultLeft,
      bounds.left + margin,
      bounds.right - margin - width,
    );
    const top = clampWindowValue(
      this.geometry?.top ?? defaultTop,
      bounds.top + margin,
      bounds.bottom - margin - height,
    );
    this.geometry = { left, top, width, height };
    this.applyGeometry(this.geometry);
  },

  observeBounds() {
    if (typeof ResizeObserver !== "function") return;
    this._boundsObserver?.disconnect();
    this._boundsObserver = new ResizeObserver(() => {
      this.syncGeometry();
      this.render();
    });
    const area = this.findChatArea();
    if (area) this._boundsObserver.observe(area);
  },

  popOut() {
    const panel = this.ensure();
    if (!panel || this.isDetached()) return;
    const popup = window.open("", "_blank");
    if (!popup) return;
    const popupDocument = popup.document;
    popupDocument.title = BH.localize(this.props, "dockTitle", "Beholder");
    popupDocument.documentElement.lang = document.documentElement.lang || "en";
    popupDocument.documentElement.dir = document.documentElement.dir || "ltr";
    const sourceTheme = getComputedStyle(this.findChatArea() || document.documentElement);
    for (const variable of BH_THEME_VARIABLES) {
      const value = sourceTheme.getPropertyValue(variable);
      if (value) popupDocument.documentElement.style.setProperty(variable, value);
    }
    popupDocument.documentElement.style.colorScheme = getComputedStyle(document.documentElement).colorScheme;
    popupDocument.body.replaceChildren();
    popupDocument.body.style.margin = "0";
    popupDocument.body.style.overflow = "hidden";
    popupDocument.body.style.background = "var(--background, #111)";
    popupDocument.body.style.color = "var(--foreground, #eee)";
    popupDocument.body.style.fontFamily = sourceTheme.fontFamily;
    BH.ensureStyles(popupDocument);

    panel.classList.add("bh-detached");
    popupDocument.body.appendChild(panel);
    this.detachedWindow = popup;
    this.syncHostLayer();
    this._detachedResize = () => {
      this.syncGeometry();
      this.render();
    };
    popup.addEventListener("resize", this._detachedResize);
    popup.addEventListener("beforeunload", () => this.restoreFromDetached(), { once: true });
    this.syncGeometry();
    this.render();
    popup.focus();
  },

  restoreFromDetached() {
    const popup = this.detachedWindow;
    const panel = this.panel;
    if (!popup || !panel) return;
    if (this._detachedResize) popup.removeEventListener("resize", this._detachedResize);
    this._detachedResize = null;
    this.detachedWindow = null;
    panel.classList.remove("bh-detached");
    const hostArea = this.findChatArea();
    if (hostArea) {
      hostArea.appendChild(panel);
      panel.classList.add("bh-collapsed");
      this.syncHostLayer();
      this.syncGeometry();
    } else {
      panel.remove();
      this.panel = null;
    }
    BH.syncToggles();
  },

  resizeBy(deltaWidth, deltaHeight) {
    if (this.isMobile()) return;
    this.syncGeometry();
    const bounds = this.getChatBounds();
    if (!bounds) return;
    const geometry = this.geometry;
    if (!geometry) return;
    const margin = Math.min(BH_WINDOW_MARGIN, (bounds.right - bounds.left) / 4, (bounds.bottom - bounds.top) / 4);
    const maxWidth = Math.max(1, bounds.right - margin - geometry.left);
    const maxHeight = Math.max(1, bounds.bottom - margin - geometry.top);
    this.geometry = {
      ...geometry,
      width: clampWindowValue(geometry.width + deltaWidth, Math.min(BH_WINDOW_MIN_WIDTH, maxWidth), maxWidth),
      height: clampWindowValue(geometry.height + deltaHeight, Math.min(BH_WINDOW_MIN_HEIGHT, maxHeight), maxHeight),
    };
    this.applyGeometry(this.geometry);
    BH.writeSetting(BH_WINDOW_KEY, this.geometry);
    this.render();
  },

  startInteraction(kind, event) {
    if (this.isMobile() || this.isDetached() || event.button !== 0 || !this.panel) return;
    const target = event.target instanceof Element ? event.target : null;
    if (kind === "move" && target?.closest("button, input, label, select, textarea, a")) return;
    event.preventDefault();
    this._interaction?.();

    const pointerId = event.pointerId;
    const start = {
      x: event.clientX,
      y: event.clientY,
      left: this.geometry?.left ?? this.panel.offsetLeft,
      top: this.geometry?.top ?? this.panel.offsetTop,
      width: this.panel.offsetWidth,
      height: this.panel.offsetHeight,
    };
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = kind === "move" ? "move" : "nwse-resize";
    document.body.style.userSelect = "none";
    this.panel.classList.add(kind === "move" ? "beholder-dragging" : "beholder-resizing");

    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const bounds = this.getChatBounds();
      if (!bounds) return;
      const margin = Math.min(BH_WINDOW_MARGIN, (bounds.right - bounds.left) / 4, (bounds.bottom - bounds.top) / 4);
      const deltaX = moveEvent.clientX - start.x;
      const deltaY = moveEvent.clientY - start.y;
      if (kind === "move") {
        const left = clampWindowValue(start.left + deltaX, bounds.left + margin, bounds.right - margin - start.width);
        const top = clampWindowValue(start.top + deltaY, bounds.top + margin, bounds.bottom - margin - start.height);
        this.geometry = { left, top, width: start.width, height: start.height };
      } else {
        const maxWidth = Math.max(1, bounds.right - margin - start.left);
        const maxHeight = Math.max(1, bounds.bottom - margin - start.top);
        this.geometry = {
          left: start.left,
          top: start.top,
          width: clampWindowValue(start.width + deltaX, Math.min(BH_WINDOW_MIN_WIDTH, maxWidth), maxWidth),
          height: clampWindowValue(start.height + deltaY, Math.min(BH_WINDOW_MIN_HEIGHT, maxHeight), maxHeight),
        };
      }
      this.applyGeometry(this.geometry);
    };

    const finish = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      this.panel?.classList.remove("beholder-dragging", "beholder-resizing");
      if (this.geometry) BH.writeSetting(BH_WINDOW_KEY, this.geometry);
      this.render();
      this._interaction = null;
    };
    const onEnd = (endEvent) => {
      if (endEvent.pointerId === pointerId) finish();
    };
    this._interaction = finish;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  },

  /** Point the dock at a chat. Switching chats drops per-chat view memory. */
  setChat(chatId) {
    if (this.chatId === chatId) return;
    this.chatId = chatId;
    this.state = {};
    this.activeName = null;
    this.viewByChar.clear();
    this.unviewed.clear();
    this.observeBounds();
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

    // The full-screen mobile window keeps the paper doll visible and scales it
    // to the viewport. Resizable desktop windows retain the selected layout.
    const layout = !this.isDetached() && this.isMobile() ? "paired" : this.layout;
    setDollLayout(layout);
    panel.classList.toggle("bh-layout-compact", layout === "list");
    panel.classList.toggle("bh-mobile-layout", !this.isDetached() && this.isMobile());

    // The active character's updates are viewed by definition.
    const unviewedForRender = new Set(this.unviewed);
    if (this.activeName) unviewedForRender.delete(this.activeName);
    const view = this.activeName ? this.viewByChar.get(this.activeName) || "front" : "front";
    const rendered = renderDollPanel(this.state, this.activeName, unviewedForRender, view);
    this.activeName = rendered.activeName;
    if (this.activeName) this.unviewed.delete(this.activeName);
    body.innerHTML = rendered.html || "";
    this.fitDesktopContent();
  },
};
