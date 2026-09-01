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
  width:var(--bh-window-width,min(500px,calc(100% - 2rem))) !important; height:var(--bh-window-height,min(1040px,calc(100% - 2rem))) !important;
  min-width:0 !important; min-height:0 !important; max-width:none !important; max-height:none !important;
  border-color:var(--bh-window-accent) !important; border-radius:.75rem !important; transform:none !important; z-index:50; }
.beholder-panel.bh-detached{ position:fixed !important; inset:0 !important; width:100vw !important; height:100dvh !important; border-radius:0 !important; }
.beholder-panel.bh-collapsed{ display:none !important; }
.beholder-panel-body{ min-height:0; overflow:hidden; }
.beholder-panel.bh-content-scrolls .beholder-panel-body{ overflow-y:auto; }
.beholder-panel .beholder-close{ display:none !important; }
.beholder-panel .beholder-resize-handle{ display:block !important; left:auto; right:.25rem; bottom:.25rem; transform:none;
  width:1.5rem; height:1.5rem; border:0; border-radius:.25rem; background:transparent; color:var(--bh-window-accent);
  cursor:nwse-resize; opacity:.65; touch-action:none; }
.beholder-panel .beholder-resize-handle::after{ content:""; position:absolute; right:.25rem; bottom:.25rem; width:.625rem; height:.625rem;
  border-right:2px solid currentColor; border-bottom:2px solid currentColor; }
.beholder-panel .beholder-resize-handle:hover{ width:1.5rem; background:var(--bh-surface-2); color:var(--bh-window-accent); opacity:1; }
.beholder-panel-header{ touch-action:none; }
.beholder-panel-controls{ flex-wrap:nowrap; }
.beholder-panel-controls .bh-dock-close{ box-sizing:border-box; display:inline-flex; width:1.75rem; height:1.75rem; align-items:center; justify-content:center; border:0; border-radius:.375rem;
  padding:0; font-size:.875rem;
  background:transparent; color:var(--bh-window-accent); cursor:pointer; opacity:.8; }
.beholder-panel-controls .bh-dock-close:hover{ background:var(--bh-surface-2); color:var(--bh-window-accent); opacity:1; }
.beholder-panel-controls .bh-dock-close:focus-visible{ outline:2px solid var(--bh-window-accent); outline-offset:1px; }
.beholder-panel.bh-detached .beholder-resize-handle{ display:none !important; }
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
// How tall a panel OPENS. The body holds about 844px of doll plus 178px of chrome, so
// anything much under a thousand guarantees the shrink-to-fit path on first open — the
// old 620 opened every panel at roughly half size. Clamped to the chat area, so a short
// screen still gets a panel that fits; it just falls back to scrolling.
const BH_WINDOW_DEFAULT_HEIGHT = 1040;
// What counts as 100%, which is a separate question from how tall the panel opens. One
// constant answered both, so opening the panel taller would have redefined full size and
// scaled everything back down again.
const BH_SCALE_REFERENCE_WIDTH = 500;
const BH_SCALE_REFERENCE_HEIGHT = 620;
const BH_WINDOW_MIN_SCALE = 0.24;
// The floor for shrinking-to-fit, which is a different question from how small the
// WINDOW may get. Fitting the whole body into a short panel drove the interface to 52%
// at the default size — slot labels rendered at 6.4px against a designed 12.2px, which
// is not a smaller interface but an unreadable one. Below this the body scrolls instead,
// because a scrollbar costs less than text nobody can read.
const BH_CONTENT_MIN_SCALE = 0.85;
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
        <span class="beholder-panel-controls"><span class="beholder-backfill-group" role="group" aria-label="${say("backfillGroup", "Build state from the chat")}"><button type="button" class="beholder-backfill-btn fa-solid fa-clock-rotate-left" title="${say("backfillHint", "Build state from this chat's messages")}" aria-label="${say("backfill", "Build state from history")}"></button><button type="button" class="beholder-backfill-more fa-solid fa-caret-down" title="${say("backfillMoreHint", "More build options")}" aria-label="${say("backfillMore", "More build options")}"></button></span><span class="bh-header-sep" aria-hidden="true"></span><button type="button" class="beholder-tool-btn fa-solid fa-wand-magic-sparkles" data-view="prompt" title="${say("viewPromptHint", "Prompt — which prompt set this model needs")}" aria-label="${say("viewPrompt", "Prompt")}"></button><button type="button" class="beholder-tool-btn fa-solid fa-stethoscope" data-view="doctor" title="${say("viewDoctorHint", "Doctor — the last extraction, end to end")}" aria-label="${say("viewDoctor", "Doctor")}"></button><button type="button" class="beholder-tool-btn fa-solid fa-users" data-view="characters" title="${say("viewCharactersHint", "Characters — hide, reorder, merge duplicates")}" aria-label="${say("viewCharacters", "Characters")}"></button><button type="button" class="beholder-tool-btn fa-solid fa-magnifying-glass" data-view="inspector" title="${say("viewInspectorHint", "Inspector — the full round trip for a turn")}" aria-label="${say("viewInspector", "Inspector")}"></button><button type="button" class="beholder-tool-btn fa-solid fa-circle-question" data-view="help" title="${say("viewHelpHint", "Help — legend and writing tips")}" aria-label="${say("viewHelp", "Help")}"></button><button type="button" class="beholder-tools-more fa-solid fa-ellipsis-vertical" title="${say("toolsMore", "Beholder tools")}" aria-label="${say("toolsMore", "Beholder tools")}" aria-haspopup="menu"></button><button type="button" class="bh-dock-close fa-solid fa-xmark" title="${say("dockClose", "Close Beholder")}" aria-label="${say("dockClose", "Close Beholder")}"></button></span>
      </div>
      <div class="beholder-backfill-status" hidden></div>
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
    panel.querySelector(".beholder-backfill-btn").addEventListener("click", () => {
      void BH.backfill.run("build");
    });
    panel.querySelector(".beholder-backfill-more").addEventListener("click", (event) => {
      event.stopPropagation();
      BH.backfill.toggleMenu();
    });
    panel.querySelector(".beholder-tools-more").addEventListener("click", (event) => {
      event.stopPropagation();
      this.toggleToolsMenu();
    });
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
        return;
      }
      const tool = target.closest(".beholder-tool-btn[data-view]");
      if (tool) {
        const view = tool.dataset.view;
        this.openView(view);
        return;
      }
      // "Edit slots" opens the sheet: the list layout draws no cards to click, and a
      // slot with nothing in it has no card anywhere, so this is the only way to reach
      // an empty one.
      // From the empty-panel note straight to the full explanation.
      if (target.closest(".bh-scope-more")) {
        BH.views.helpView();
        return;
      }
      if (target.closest(".bh-digest-edit")) {
        BH.sheet.open();
        return;
      }
      // A slot card opens the editor for that slot on the active character.
      const card = target.closest(".bh-slot-card[data-slot]");
      if (card) BH.editor.openFor(card);
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
    // The note box lives beside the chat input, not in the panel, so it comes and goes
    // with the panel rather than sitting there when Beholder is closed.
    BH.notebox.mount();
    // Once per browser, and only with the panel actually on screen, so the note has
    // something to point at.
    BH.onboard.maybeShow();
    // Badges belong to the message list, not the panel, but they come and go with
    // Beholder: they are its output, and leaving them behind when it is closed would
    // be marking up someone's chat with a feature they turned off.
    BH.badges.watch();
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
    BH.notebox.unmount();
    BH.badges.stop();
    // Everything the dock opened outside its own box goes with it. The build menu in
    // particular lived on `document.body`, so its "Re-extract this turn" action could
    // still start an agent run after Beholder had been closed — a closed panel doing
    // work is the last thing anyone would look for.
    BH.backfill.closeMenu?.();
    this.closeToolsMenu?.();
    BH.views.close();
    BH.editor.close();
    BH.sheet.close?.();
    document.querySelector(".beholder-onboard")?.remove();
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
      Math.min(width / BH_SCALE_REFERENCE_WIDTH, height / BH_SCALE_REFERENCE_HEIGHT),
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
    const geometryScale = this.applyScale(rect.width, rect.height);
    let scale = geometryScale;
    for (let pass = 0; pass < 2; pass += 1) {
      const widthRatio = body.clientWidth / Math.max(body.scrollWidth, 1);
      const heightRatio = body.clientHeight / Math.max(body.scrollHeight, 1);
      const fit = Math.min(1, widthRatio, heightRatio);
      if (fit >= 0.995) break;
      // Never below the readability floor, and never above what the geometry allows.
      scale = clampWindowValue(scale * fit, Math.min(geometryScale, BH_CONTENT_MIN_SCALE), BH_WINDOW_MAX_SCALE);
      panel.style.setProperty("--bh-ui-scale", scale.toFixed(3));
    }
    // Whatever still does not fit is scrolled to. The body is overflow:hidden on the
    // desktop, so without this the floor above would clip the doll rather than shrink
    // it — trading unreadable for invisible.
    panel.classList.toggle("bh-content-scrolls", body.scrollHeight - body.clientHeight > 1);
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
    // Before the chat guard: which model answers does not depend on there being a
    // chat, and an empty panel is exactly when someone needs to be told why.
    void BH.banner.refresh();
    // Separate call: the update check reaches the model repository, so it must not be
    // able to delay or fail the strip that says which model is answering right now.
    void BH.banner.refreshUpdate();
    const chatId = this.chatId;
    if (!chatId) return;
    try {
      const next = await BH.fetchState(chatId);
      if (this.chatId !== chatId) return; // chat switched mid-flight
      this.adopt(next);
      // A lock promises the slot keeps its value; the extractor does not read locks,
      // so put back anything it overwrote and show the restored state.
      if (await BH.locks.enforce(next, chatId)) {
        const restored = await BH.fetchState(chatId);
        if (this.chatId === chatId) this.adopt(restored);
      }
    } catch (error) {
      // A read failure leaves the last known doll on screen; the next turn retries.
      console.warn("[beholder] state refresh failed", error);
    }
    // After the state, never before it. A badge is coloured by what the slot holds
    // NOW, so running this first read an empty state and painted every change as a
    // removal — the gloves a message had just added were shown as gloves taken off.
    void BH.badges.refresh(chatId);
  },

  /**
   * The tool row, as a menu.
   *
   * Not a nicety: below the narrow breakpoint the stylesheet hides every
   * `.beholder-tool-btn` and shows this trigger instead. Without it, Prompt, Doctor,
   * Inspector, Characters and Help are simply unreachable on a phone.
   */
  closeToolsMenu() {
    this.panel?.querySelector(".beholder-tools-menu")?.remove();
    this.panel?.querySelector(".beholder-tools-more")?.classList.remove("bh-more-open");
    if (this._toolsDismiss) {
      document.removeEventListener("click", this._toolsDismiss, true);
      document.removeEventListener("keydown", this._toolsKeydown, true);
      this._toolsDismiss = null;
      this._toolsKeydown = null;
    }
  },

  toggleToolsMenu() {
    const panel = this.panel;
    if (!panel) return;
    if (panel.querySelector(".beholder-tools-menu")) {
      this.closeToolsMenu();
      return;
    }
    // Built from the header's own buttons so the two can never drift apart.
    const tools = [...panel.querySelectorAll(".beholder-tool-btn[data-view]")].map((button) => ({
      view: button.dataset.view,
      icon: [...button.classList].find((name) => name.startsWith("fa-") && name !== "fa-solid") ?? "fa-circle",
      label: button.getAttribute("aria-label") || button.dataset.view,
    }));
    const menu = document.createElement("div");
    menu.className = "beholder-tools-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = tools
      .map(
        (tool) =>
          `<button type="button" class="beholder-tools-item" data-view="${BH.escapeHtml(tool.view)}" role="menuitem">
             <i class="fa-solid ${BH.escapeHtml(tool.icon)}"></i><span>${BH.escapeHtml(tool.label)}</span>
           </button>`,
      )
      .join("");
    panel.querySelector(".beholder-tools-more")?.classList.add("bh-more-open");
    panel.querySelector(".beholder-panel-header")?.appendChild(menu);
    menu.addEventListener("mousedown", (event) => event.stopPropagation());
    for (const item of menu.querySelectorAll(".beholder-tools-item")) {
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        const view = item.dataset.view;
        this.closeToolsMenu();
        this.openView(view);
      });
    }
    this._toolsDismiss = (event) => {
      if (event.target?.closest?.(".beholder-tools-menu, .beholder-tools-more")) return;
      this.closeToolsMenu();
    };
    this._toolsKeydown = (event) => {
      if (event.key === "Escape") this.closeToolsMenu();
    };
    setTimeout(() => {
      document.addEventListener("click", this._toolsDismiss, true);
      document.addEventListener("keydown", this._toolsKeydown, true);
    }, 0);
  },

  /** One place that maps a view name to its view, for the header and the menu alike. */
  openView(view) {
    if (view === "prompt") void BH.views.promptView();
    else if (view === "doctor") void BH.views.doctorView();
    else if (view === "characters") BH.views.charactersView();
    else if (view === "inspector") void BH.views.inspectorView();
    else if (view === "help") BH.views.helpView();
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
    // The operator's roster choices are applied here, so every surface that reads the
    // rendered panel agrees on who is on screen: hidden people are dropped and the
    // rest are put in the chosen order. Object key order is insertion order, which is
    // what the renderer walks to build its tabs.
    const arranged = BH.roster.arrange(Object.keys(this.state));
    const shownState = {};
    for (const name of arranged.visible) shownState[name] = this.state[name];
    // Hiding everyone would leave a panel with no way back, so fall through to the
    // full state and let the characters view be the way out.
    const stateForRender = arranged.visible.length ? shownState : this.state;
    if (this.activeName && !stateForRender[this.activeName]) this.activeName = null;
    const rendered = renderDollPanel(stateForRender, this.activeName, unviewedForRender, view);
    this.activeName = rendered.activeName;
    if (this.activeName) this.unviewed.delete(this.activeName);
    body.innerHTML = rendered.html || "";
    // Re-applied every render: the body is rebuilt wholesale, so lock marks would
    // otherwise vanish the first time anything else changes.
    BH.locks.decorate(panel, this.activeName);
    this.fitDesktopContent();
  },
};
