// Quartermaster — self-managed floating sheet panel. Mirrors Beholder's
// BH.dock (src/80-dock.js): the host's Tracker Panel is small and shared
// chrome, not roomy enough for a real character-sheet layout (portrait,
// equip-slot columns, inventory grid). So the panel lives in its own
// fixed-position element appended to document.body, independent of any
// host-provided slot container.
//
// A pure view over QM.state (05-state.js) — subscribes while open, repaints
// on every change, unsubscribes while closed. The tracker-panel slot has its
// own inline accordion view (15-panel.js) reading the same state, so
// equipping something in one place is reflected in the other immediately.
//
// Styled with the host's own CSS custom properties (--popover, --foreground,
// --border, etc. — defined on :root in the Engine's globals.css) for general
// chrome, since our panel is plain light DOM appended under document.body
// and inherits them directly. Destructive/dismiss and save/create actions
// use fixed red/green instead of var(--destructive)/var(--primary) on
// purpose — this app's own theme maps --destructive to the same purple as
// --primary, so following it would lose the actual red/green danger-vs-safe
// signal, which matters more here than perfect theme fidelity.
//
// Draggable/resizable/mobile-aware: ported from Beholder's own dock, which
// solves the identical problem (a floating panel over the same host) —
// geometry as CSS custom properties + a stylesheet with !important (inline
// styles can't express :hover or @media, so position/size move out of
// Object.assign and into QM_DOCK_STYLE below), pointerdown-driven move/
// resize, chat-area bounds clamping via the same .rpg-chat-area/TopBar
// selectors, and a 767px mobile breakpoint that goes full-screen — same
// breakpoint Beholder uses elsewhere in the host, kept consistent rather
// than picked independently. touch-action:none on drag surfaces and
// env(safe-area-inset-bottom) on the scrolling body are both host
// conventions confirmed against Pixelforge's own touch surfaces, not
// Quartermaster-specific choices.

const QM_DOCK_STYLE_ID = "qm-dock-style";
const QM_DOCK_STYLE = `
#qm-dock-root{
  position:fixed !important;
  top:var(--qm-window-top,4rem) !important;
  left:var(--qm-window-left,calc(100vw - 36rem)) !important;
  right:auto !important; bottom:auto !important;
  width:var(--qm-window-width,min(960px,calc(100vw - 2rem))) !important;
  height:var(--qm-window-height,min(640px,calc(100vh - 5rem))) !important;
  display:flex !important;
}
#qm-dock-root.qm-dock-collapsed{ display:none !important; }
#qm-dock-header{ cursor:move; touch-action:none; }
#qm-dock-resize-handle{
  position:absolute; right:.25rem; bottom:.25rem; width:1.25rem; height:1.25rem;
  border:0; border-radius:.25rem; padding:0; background:transparent;
  color:var(--muted-foreground, currentcolor); cursor:nwse-resize; opacity:.6; touch-action:none;
}
#qm-dock-resize-handle::after{
  content:""; position:absolute; right:.3rem; bottom:.3rem; width:.5rem; height:.5rem;
  border-right:2px solid currentColor; border-bottom:2px solid currentColor;
}
#qm-dock-resize-handle:hover{ opacity:1; background:var(--accent, rgba(128,128,128,0.15)); }
#qm-dock-root.qm-dock-dragging, #qm-dock-root.qm-dock-resizing{ user-select:none; }
@media (max-width:767px){
  #qm-dock-root{
    top:var(--qm-mobile-top,0px) !important; left:0 !important; right:0 !important; bottom:0 !important;
    width:100% !important; height:calc(100dvh - var(--qm-mobile-top,0px)) !important; border-radius:0 !important;
  }
  #qm-dock-header{ cursor:default; touch-action:auto; }
  #qm-dock-resize-handle{ display:none !important; }
  #qm-dock-body{ padding-bottom:max(10px, env(safe-area-inset-bottom)) !important; }
}
`;

const QM_WINDOW_KEY = "marinara.quartermaster.window";
const QM_WINDOW_MARGIN = 12;
const QM_WINDOW_MIN_WIDTH = 320;
const QM_WINDOW_MIN_HEIGHT = 360;
const QM_WINDOW_DEFAULT_WIDTH = 960;
const QM_WINDOW_DEFAULT_HEIGHT = 640;
// Below this measured content width the 3 columns stack vertically instead
// of overlapping — this is also what fixes the ring overflowing into the
// Outfits/Bag columns at the old fixed size, not just a resize nicety.
const QM_DOCK_COLUMNS_STACK_WIDTH = 760;
// Below this, the ring's own left-stack/portrait/right-stack row also
// stacks vertically, for narrow phones where even one full-width column
// isn't wide enough for the ring side-by-side.
const QM_DOCK_RING_STACK_WIDTH = 560;

// UI Size — a CSS zoom factor applied to a wrapper around everything in the
// dock's body except the UI-size row itself (kept at a fixed, predictable
// size so it stays a stable control regardless of the current zoom) and the
// header/resize-handle chrome. zoom (not transform:scale) because it
// affects real layout — content correctly reflows and wraps at its scaled
// size instead of visually stretching past its box — and dock-only per the
// request: the tracker panel (15-panel.js) reads the same QM.state but
// isn't part of this wrapper, so it's unaffected.
const QM_UI_SIZE_KEY = "marinara.quartermaster.uiSize";
const QM_UI_SIZES = { S: 0.85, M: 1, L: 1.2 };

function qmClampWindowValue(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

// "The persona" (the export route's own fallback when there's no active
// persona) collapses to an empty slug, which the caller treats as "leave it
// out of the filename" rather than downloading a file literally named
// "the-persona".
function qmFilenameSafe(text) {
  const slug = (typeof text === "string" ? text : "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug === "the-persona" ? "" : slug;
}

function qmReadUiSize() {
  try {
    const stored = window.localStorage.getItem(QM_UI_SIZE_KEY);
    if (stored && QM_UI_SIZES[stored]) return stored;
  } catch {
    // A blocked storage read falls back to the default size.
  }
  return "M";
}

function qmWriteUiSize(size) {
  try {
    window.localStorage.setItem(QM_UI_SIZE_KEY, size);
  } catch {
    // Persisting is a convenience; the session still works without it.
  }
}

function qmReadWindowGeometry() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(QM_WINDOW_KEY) || "null");
    if (stored && [stored.left, stored.top, stored.width, stored.height].every((value) => Number.isFinite(value))) {
      return stored;
    }
  } catch {
    // A blocked or stale storage value falls back to the default placement.
  }
  return null;
}

function qmWriteWindowGeometry(geometry) {
  try {
    window.localStorage.setItem(QM_WINDOW_KEY, JSON.stringify(geometry));
  } catch {
    // Persisting is a convenience; the session still works without it.
  }
}

function qmEnsureDockStyle() {
  if (document.getElementById(QM_DOCK_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = QM_DOCK_STYLE_ID;
  style.textContent = QM_DOCK_STYLE;
  (document.head || document.body).appendChild(style);
}

QM.dock = {
  isOpenFlag: false,
  unsubscribe: null,
  root: null,
  header: null,
  body: null,
  columns: null,
  zoomWrapper: null,
  uiSizeButtons: null,
  errorNode: null,
  feedSelect: null,
  settingsSection: null,
  settingsContent: null,
  settingsChevron: null,
  underwearToggle: null,
  armorToggle: null,
  weaponsToggle: null,
  equippedContainer: null,
  outfitsContainer: null,
  outfitForm: null,
  form: null,
  listContainer: null,
  portraitWrapper: null,
  portraitImage: null,
  portraitPlaceholder: null,
  geometry: qmReadWindowGeometry(),
  bodyWidth: QM_WINDOW_DEFAULT_WIDTH,
  uiSize: qmReadUiSize(),
  // Collapsed by default to keep the dock compact; not persisted — a session
  // -only UI preference, unlike geometry/uiSize which are worth remembering
  // across visits.
  settingsExpanded: false,
  _windowBound: false,
  _interaction: null,
  _boundsObserver: null,
  _bodyObserver: null,

  // Every DOM node _paint/_ensureRoot cache on `this` so a repaint can find
  // and update them without rebuilding — cleared together whenever the root
  // is rebuilt or there's no chat to show, since a stale reference into a
  // detached tree is worse than none.
  _resetCachedNodes() {
    this.columns = null;
    this.zoomWrapper = null;
    this.uiSizeButtons = null;
    this.errorNode = null;
    this.feedSelect = null;
    this.settingsSection = null;
    this.settingsContent = null;
    this.settingsChevron = null;
    this.underwearToggle = null;
    this.armorToggle = null;
    this.weaponsToggle = null;
    this.equippedContainer = null;
    this.outfitsContainer = null;
    this.outfitForm = null;
    this.form = null;
    this.listContainer = null;
    this.portraitWrapper = null;
    this.portraitImage = null;
    this.portraitPlaceholder = null;
  },

  isOpen() {
    return this.isOpenFlag;
  },

  toggle() {
    if (this.isOpenFlag) this.close();
    else this.openPanel();
  },

  openPanel() {
    this.isOpenFlag = true;
    this._ensureRoot();
    this.root.classList.remove("qm-dock-collapsed");
    this._syncToggles();
    this.syncGeometry();
    if (!this.unsubscribe) {
      this.unsubscribe = QM.state.subscribe(() => this._paint());
      // Picks up server-side changes from the tracker agent, which has no
      // way to push an update to us — see QM.state.startPolling's comment.
      QM.state.startPolling();
    }
    QM.state.ensureLoaded();
    this._paint();
  },

  close() {
    this.isOpenFlag = false;
    if (this.root) this.root.classList.add("qm-dock-collapsed");
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      QM.state.stopPolling();
    }
    this._syncToggles();
  },

  _syncToggles() {
    for (const button of document.querySelectorAll(".qm-launch")) {
      button.setAttribute("aria-pressed", this.isOpenFlag ? "true" : "false");
    }
  },

  isMobile() {
    return window.matchMedia("(max-width: 767px)").matches;
  },

  // The live roleplay chat area, not the viewport — keeps the dock from
  // drifting over the composer or off past the sidebar. Same selectors
  // Beholder's dock uses against this same host.
  getChatBounds() {
    const areas = Array.from(document.querySelectorAll(".rpg-chat-area"))
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 1 && rect.height > 1)
      .sort((left, right) => right.width * right.height - left.width * left.height);
    const rect = areas[0] || { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    const topbar = document.querySelector('[data-component="TopBar"], header.mari-topbar');
    const topbarBottom = topbar ? topbar.getBoundingClientRect().bottom : rect.top;
    const top = Math.min(rect.bottom, Math.max(rect.top, topbarBottom));
    return { left: rect.left, top, right: rect.right, bottom: rect.bottom };
  },

  applyGeometry(geometry) {
    if (!this.root) return;
    this.root.style.setProperty("--qm-window-left", `${Math.round(geometry.left)}px`);
    this.root.style.setProperty("--qm-window-top", `${Math.round(geometry.top)}px`);
    this.root.style.setProperty("--qm-window-width", `${Math.round(geometry.width)}px`);
    this.root.style.setProperty("--qm-window-height", `${Math.round(geometry.height)}px`);
  },

  syncGeometry() {
    if (!this.root) return;
    const bounds = this.getChatBounds();
    this.root.style.setProperty("--qm-mobile-top", `${Math.round(bounds.top)}px`);
    if (this.isMobile()) return;

    const availableWidth = Math.max(1, bounds.right - bounds.left);
    const availableHeight = Math.max(1, bounds.bottom - bounds.top);
    const margin = Math.min(QM_WINDOW_MARGIN, availableWidth / 4, availableHeight / 4);
    const maxWidth = Math.max(1, availableWidth - margin * 2);
    const maxHeight = Math.max(1, availableHeight - margin * 2);
    const minWidth = Math.min(QM_WINDOW_MIN_WIDTH, maxWidth);
    const minHeight = Math.min(QM_WINDOW_MIN_HEIGHT, maxHeight);
    const width = qmClampWindowValue(this.geometry?.width ?? QM_WINDOW_DEFAULT_WIDTH, minWidth, maxWidth);
    const height = qmClampWindowValue(this.geometry?.height ?? QM_WINDOW_DEFAULT_HEIGHT, minHeight, maxHeight);
    const defaultLeft = bounds.right - margin - width;
    const defaultTop = bounds.top + margin;
    const left = qmClampWindowValue(
      this.geometry?.left ?? defaultLeft,
      bounds.left + margin,
      bounds.right - margin - width,
    );
    const top = qmClampWindowValue(
      this.geometry?.top ?? defaultTop,
      bounds.top + margin,
      bounds.bottom - margin - height,
    );
    this.geometry = { left, top, width, height };
    this.applyGeometry(this.geometry);
  },

  observeChatBounds() {
    if (typeof ResizeObserver !== "function") return;
    this._boundsObserver?.disconnect();
    this._boundsObserver = new ResizeObserver(() => this.syncGeometry());
    const area = Array.from(document.querySelectorAll(".rpg-chat-area")).find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    });
    if (area) this._boundsObserver.observe(area);
    const main = document.querySelector(".mari-main");
    if (main && main !== area) this._boundsObserver.observe(main);
  },

  // Tracks the dock's own content width so the columns/ring can reflow as
  // it's resized, independent of the chat-bounds observer above (which
  // tracks where the dock is ALLOWED to be, not how wide it currently is).
  observeBodyWidth() {
    if (typeof ResizeObserver !== "function" || !this.body) return;
    this._bodyObserver?.disconnect();
    this._bodyObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      if (!width || Math.abs(width - this.bodyWidth) < 4) return;
      this.bodyWidth = width;
      this._applyResponsiveLayout();
    });
    this._bodyObserver.observe(this.body);
  },

  _zoomFactor() {
    return QM_UI_SIZES[this.uiSize] || 1;
  },

  // Cheap re-layout that doesn't touch QM.state — just toggles flex
  // direction on the stable, cached column/ring containers based on the
  // last measured body width. The ring's own middleRow is rebuilt on every
  // state repaint anyway (_buildEquippedSection), so it just reads
  // this.bodyWidth fresh each time rather than needing a matching toggle
  // here. Thresholds scale by the current zoom factor: at UI Size L,
  // zoomed content needs more real (unzoomed) body pixels to fit the same
  // logical layout, so the stack point has to move out to match, or L would
  // stack sooner than it actually needs to.
  _applyResponsiveLayout() {
    if (this.columns) {
      const stacked = this.bodyWidth < QM_DOCK_COLUMNS_STACK_WIDTH * this._zoomFactor();
      this.columns.style.flexDirection = stacked ? "column" : "row";
    }
    if (this.equippedContainer) this.equippedContainer.replaceChildren(this._buildEquippedSection());
  },

  resizeBy(deltaWidth, deltaHeight) {
    if (this.isMobile()) return;
    this.syncGeometry();
    const bounds = this.getChatBounds();
    const geometry = this.geometry;
    if (!geometry) return;
    const margin = Math.min(QM_WINDOW_MARGIN, (bounds.right - bounds.left) / 4, (bounds.bottom - bounds.top) / 4);
    const maxWidth = Math.max(1, bounds.right - margin - geometry.left);
    const maxHeight = Math.max(1, bounds.bottom - margin - geometry.top);
    this.geometry = {
      ...geometry,
      width: qmClampWindowValue(geometry.width + deltaWidth, Math.min(QM_WINDOW_MIN_WIDTH, maxWidth), maxWidth),
      height: qmClampWindowValue(geometry.height + deltaHeight, Math.min(QM_WINDOW_MIN_HEIGHT, maxHeight), maxHeight),
    };
    this.applyGeometry(this.geometry);
    qmWriteWindowGeometry(this.geometry);
  },

  // Pointerdown-driven move (header) or resize (corner handle). Ported from
  // Beholder's dock almost verbatim — same host, same problem.
  startInteraction(kind, event) {
    if (this.isMobile() || event.button !== 0 || !this.root) return;
    const target = event.target instanceof Element ? event.target : null;
    if (kind === "move" && target?.closest("button, input, label, select, textarea, a")) return;
    event.preventDefault();
    this._interaction?.();

    const pointerId = event.pointerId;
    const startRect = this.root.getBoundingClientRect();
    const start = {
      x: event.clientX,
      y: event.clientY,
      left: startRect.left,
      top: startRect.top,
      width: startRect.width,
      height: startRect.height,
    };
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = kind === "move" ? "move" : "nwse-resize";
    document.body.style.userSelect = "none";
    this.root.classList.add(kind === "move" ? "qm-dock-dragging" : "qm-dock-resizing");

    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const bounds = this.getChatBounds();
      const margin = Math.min(QM_WINDOW_MARGIN, (bounds.right - bounds.left) / 4, (bounds.bottom - bounds.top) / 4);
      const deltaX = moveEvent.clientX - start.x;
      const deltaY = moveEvent.clientY - start.y;
      if (kind === "move") {
        const left = qmClampWindowValue(start.left + deltaX, bounds.left + margin, bounds.right - margin - start.width);
        const top = qmClampWindowValue(start.top + deltaY, bounds.top + margin, bounds.bottom - margin - start.height);
        this.geometry = { left, top, width: start.width, height: start.height };
      } else {
        const maxWidth = Math.max(1, bounds.right - margin - start.left);
        const maxHeight = Math.max(1, bounds.bottom - margin - start.top);
        this.geometry = {
          left: start.left,
          top: start.top,
          width: qmClampWindowValue(start.width + deltaX, Math.min(QM_WINDOW_MIN_WIDTH, maxWidth), maxWidth),
          height: qmClampWindowValue(start.height + deltaY, Math.min(QM_WINDOW_MIN_HEIGHT, maxHeight), maxHeight),
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
      this.root?.classList.remove("qm-dock-dragging", "qm-dock-resizing");
      if (this.geometry) qmWriteWindowGeometry(this.geometry);
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

  _ensureRoot() {
    if (this.root && document.body.contains(this.root)) return;
    qmEnsureDockStyle();

    const root = document.createElement("div");
    root.id = "qm-dock-root";
    root.className = "qm-dock-collapsed";
    Object.assign(root.style, {
      flexDirection: "column",
      background: "var(--popover, #fff)",
      color: "var(--popover-foreground, #1a1a1a)",
      border: "1px solid var(--border, rgba(0,0,0,0.15))",
      borderRadius: "var(--radius, 8px)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      zIndex: "9999",
      overflow: "hidden",
    });

    const header = document.createElement("div");
    header.id = "qm-dock-header";
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 10px",
      borderBottom: "1px solid var(--border, rgba(0,0,0,0.1))",
      fontWeight: "600",
      flexShrink: "0",
    });
    const title = document.createElement("span");
    title.textContent = "Quartermaster";
    const closeButton = QM.button("×", { bg: QM_COLOR_DANGER, fg: QM_COLOR_DANGER_FG });
    closeButton.setAttribute("aria-label", "Close Quartermaster");
    Object.assign(closeButton.style, { fontSize: "14px", lineHeight: "1", padding: "2px 8px" });
    closeButton.addEventListener("click", () => this.close());
    header.append(title, closeButton);
    header.addEventListener("pointerdown", (event) => this.startInteraction("move", event));

    const body = document.createElement("div");
    body.id = "qm-dock-body";
    Object.assign(body.style, {
      padding: "10px",
      overflowY: "auto",
      flex: "1",
      minHeight: "0",
    });

    const resizeHandle = document.createElement("button");
    resizeHandle.type = "button";
    resizeHandle.id = "qm-dock-resize-handle";
    resizeHandle.title = "Resize Quartermaster";
    resizeHandle.setAttribute("aria-label", "Resize Quartermaster");
    resizeHandle.addEventListener("pointerdown", (event) => this.startInteraction("resize", event));
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

    root.append(header, body, resizeHandle);
    document.body.appendChild(root);
    this.root = root;
    this.header = header;
    this.body = body;
    // A fresh body element means everything built for a previous root no
    // longer exists.
    this._resetCachedNodes();

    this.observeChatBounds();
    this.observeBodyWidth();
    if (!this._windowBound) {
      this._windowBound = true;
      let frame = 0;
      window.addEventListener("resize", () => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          this.syncGeometry();
        });
      });
    }
  },

  // Rebuilds only what changed. Forms are built once and left alone on every
  // repaint — rebuilding them on every add/delete/quantity change was wiping
  // out whatever the user had already typed, since a fresh <input> has no
  // value.
  _paint() {
    if (!this.body || !this.isOpenFlag) return;

    if (!QM.state.chatId) {
      this.body.replaceChildren(QM.textNode("No active chat."));
      this._resetCachedNodes();
      return;
    }

    if (!this.form || !this.body.contains(this.form)) {
      // Outside the zoom wrapper, so it stays a fixed-size, stable control
      // no matter what size it's currently set to.
      const uiSizeRow = this._buildUiSizeRow();

      this.zoomWrapper = document.createElement("div");

      this.errorNode = QM.textNode("");
      this.errorNode.style.color = QM_COLOR_DANGER;
      this.errorNode.style.display = "none";

      const feedRow = this._buildAppearanceFeedRow();
      this.settingsSection = this._buildSettingsSection();

      // Built once and cached — the ring layout re-inserts this same node on
      // every repaint instead of rebuilding it, so equipping/unequipping
      // something doesn't reset or reload the portrait <img>.
      this.portraitWrapper = this._buildPortrait();

      const columns = document.createElement("div");
      columns.id = "qm-dock-columns";
      Object.assign(columns.style, {
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
        flexDirection: this.bodyWidth < QM_DOCK_COLUMNS_STACK_WIDTH * this._zoomFactor() ? "column" : "row",
      });
      this.columns = columns;

      // Left: Outfits. Center: portrait ring. Right: Bag/Inventory.
      const outfitsColumn = document.createElement("div");
      Object.assign(outfitsColumn.style, { flex: "1", minWidth: "0", width: "100%" });
      this.outfitsContainer = document.createElement("div");
      this.outfitForm = this._buildSaveOutfitForm();
      outfitsColumn.append(QM.sectionHeading("Outfits"), this.outfitForm, this.outfitsContainer);

      const equippedColumn = document.createElement("div");
      Object.assign(equippedColumn.style, { flex: "1.6", minWidth: "0", width: "100%" });
      const equippedHeadingRow = document.createElement("div");
      Object.assign(equippedHeadingRow.style, {
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: "6px",
      });
      const equippedHeadingSpacer = document.createElement("span");
      const unequipAllButton = QM.button("Unequip All", {
        bg: "var(--secondary, transparent)",
        fg: "var(--secondary-foreground, inherit)",
        border: true,
      });
      unequipAllButton.addEventListener("click", () => QM.state.unequipAll());
      equippedHeadingRow.append(equippedHeadingSpacer, QM.sectionHeading("Equipped"), unequipAllButton);
      this.equippedContainer = document.createElement("div");
      equippedColumn.append(equippedHeadingRow, this.equippedContainer);

      const bagColumn = document.createElement("div");
      Object.assign(bagColumn.style, { flex: "1", minWidth: "0", width: "100%" });
      this.form = this._buildAddItemForm();
      this.listContainer = document.createElement("div");
      bagColumn.append(QM.sectionHeading("Bag"), this.form, this.listContainer);

      columns.append(outfitsColumn, equippedColumn, bagColumn);
      this.zoomWrapper.append(this.errorNode, feedRow, this.settingsSection, columns);
      this.body.replaceChildren(uiSizeRow, this.zoomWrapper);
      this._applyUiSize();
    }

    if (QM.state.error) {
      this.errorNode.textContent = `Error: ${QM.state.error}`;
      this.errorNode.style.display = "";
    } else {
      this.errorNode.style.display = "none";
    }

    this.feedSelect.value = QM.state.appearanceFeedMode;
    this.underwearToggle.checked = QM.state.showUnderwear;
    this.armorToggle.checked = QM.state.showArmor;
    this.weaponsToggle.checked = QM.state.showWeapons;
    if (QM.state.personaAvatarUrl && this.portraitImage) this.portraitImage.src = QM.state.personaAvatarUrl;
    this.equippedContainer.replaceChildren(this._buildEquippedSection());
    this.outfitsContainer.replaceChildren(this._buildOutfitsList());
    this.listContainer.replaceChildren(this._buildItemList());
  },

  _buildAppearanceFeedRow() {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      marginBottom: "8px",
      fontSize: "12px",
    });

    const label = document.createElement("span");
    label.textContent = "Feed appearance:";
    label.style.color = "var(--muted-foreground, currentcolor)";

    const select = QM.smallInput("select");
    select.style.flex = "1";
    for (const option of QM_APPEARANCE_FEED_OPTIONS) {
      const optionEl = document.createElement("option");
      optionEl.value = option.value;
      optionEl.textContent = option.label;
      select.appendChild(optionEl);
    }
    select.addEventListener("change", () => QM.state.updateAppearanceFeedMode(select.value));
    this.feedSelect = select;

    row.append(label, select);
    return row;
  },

  // Fixed-size (outside the zoom wrapper) so the size control itself
  // doesn't grow/shrink along with everything it controls. The active size
  // gets QM.button's primary fill; the other two stay neutral outlines —
  // reapplied by _applyUiSize rather than baked in here, so a size change
  // can update the same buttons in place without rebuilding them.
  _buildUiSizeRow() {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      marginBottom: "8px",
      fontSize: "12px",
      flexShrink: "0",
    });

    const label = document.createElement("span");
    label.textContent = "UI Size:";
    label.style.color = "var(--muted-foreground, currentcolor)";
    row.appendChild(label);

    this.uiSizeButtons = {};
    for (const size of Object.keys(QM_UI_SIZES)) {
      const button = QM.button(size);
      button.style.padding = "2px 10px";
      button.addEventListener("click", () => this._setUiSize(size));
      this.uiSizeButtons[size] = button;
      row.appendChild(button);
    }
    return row;
  },

  _setUiSize(size) {
    if (!QM_UI_SIZES[size] || this.uiSize === size) return;
    this.uiSize = size;
    qmWriteUiSize(size);
    this._applyUiSize();
    // The zoom factor changed, which shifts the effective stack thresholds
    // (_applyResponsiveLayout and _buildEquippedSection both read it) even
    // though the real body width didn't move.
    this._applyResponsiveLayout();
  },

  _applyUiSize() {
    if (this.zoomWrapper) this.zoomWrapper.style.zoom = this._zoomFactor();
    for (const [size, button] of Object.entries(this.uiSizeButtons || {})) {
      const active = size === this.uiSize;
      button.style.background = active ? "var(--primary, #444)" : "var(--secondary, transparent)";
      button.style.color = active ? "var(--primary-foreground, #fff)" : "var(--secondary-foreground, inherit)";
      button.style.border = active ? "none" : "1px solid var(--border, rgba(0,0,0,0.2))";
    }
  },

  // A collapsible wrapper (chevron + label, click to expand) around the
  // slot-visibility toggles — collapsed by default to keep the dock compact
  // when there's nothing to configure. Built once; the toggle checkboxes
  // inside get their checked state synced every repaint (_paint), same as
  // the other cached form-like controls.
  _buildSettingsSection() {
    const section = document.createElement("div");
    Object.assign(section.style, {
      border: "1px solid var(--border, rgba(128,128,128,0.3))",
      borderRadius: "4px",
      marginBottom: "8px",
      overflow: "hidden",
    });

    const header = document.createElement("button");
    header.type = "button";
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      width: "100%",
      padding: "6px 8px",
      background: "var(--secondary, transparent)",
      color: "inherit",
      border: "none",
      font: "inherit",
      textAlign: "left",
      cursor: "pointer",
    });

    const chevron = document.createElement("span");
    chevron.textContent = "▸";
    Object.assign(chevron.style, {
      display: "inline-block",
      transition: "transform 0.15s ease",
      transform: this.settingsExpanded ? "rotate(90deg)" : "rotate(0deg)",
    });
    this.settingsChevron = chevron;

    const label = document.createElement("span");
    label.textContent = "Settings";
    Object.assign(label.style, {
      fontWeight: "600",
      fontSize: "12px",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    });

    header.append(chevron, label);
    header.addEventListener("click", () => {
      this.settingsExpanded = !this.settingsExpanded;
      this.settingsContent.style.display = this.settingsExpanded ? "" : "none";
      this.settingsChevron.style.transform = this.settingsExpanded ? "rotate(90deg)" : "rotate(0deg)";
    });

    const content = document.createElement("div");
    Object.assign(content.style, { padding: "8px", display: this.settingsExpanded ? "" : "none" });
    content.appendChild(this._buildSlotVisibilityRow());
    content.appendChild(this._buildExportImportRow());
    this.settingsContent = content;

    section.append(header, content);
    return section;
  },

  // Portable character sheet: export the current chat's items/outfits/
  // settings as a downloadable file, or replace them by importing one back —
  // in a fresh chat this needs no tracker agent enabled at all, matching the
  // original extension's own export/import.
  _buildExportImportRow() {
    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" });

    const exportButton = QM.button("Export…", {
      bg: "var(--secondary, transparent)",
      fg: "var(--secondary-foreground, inherit)",
      border: true,
    });
    exportButton.addEventListener("click", async () => {
      exportButton.disabled = true;
      try {
        const payload = await QM.state.exportInventory();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const personaSlug = qmFilenameSafe(payload.personaName);
        const datePart = new Date().toISOString().slice(0, 10);
        link.download = `quartermaster-inventory-${personaSlug ? `${personaSlug}-` : ""}${datePart}.json`;
        link.click();
        URL.revokeObjectURL(url);
      } finally {
        exportButton.disabled = false;
      }
    });

    const importButton = QM.button("Import…", {
      bg: "var(--secondary, transparent)",
      fg: "var(--secondary-foreground, inherit)",
      border: true,
    });
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/json";
    fileInput.style.display = "none";
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      const hasExistingData = (QM.state.items ?? []).length > 0 || (QM.state.outfits ?? []).length > 0;
      if (hasExistingData && !window.confirm("Importing replaces this chat's current items and outfits. Continue?")) {
        return;
      }
      let payload;
      try {
        payload = JSON.parse(await file.text());
      } catch {
        QM.state.error = "That file isn't valid JSON.";
        QM.state._notify();
        return;
      }
      await QM.state.importInventory(payload);
    });
    importButton.addEventListener("click", () => fileInput.click());

    row.append(exportButton, importButton, fileInput);
    return row;
  },

  // A single row, one checkbox per group: "Show Slots: [ ] Underwear
  // [ ] Armor [ ] Weapons". Matches the original extension's SLOT_GROUPS
  // convention — armor, underwear, and weapon are the only groups with a
  // toggle, everything else is always on. A group hidden here removes its
  // slots from both the portrait ring and the equip picker (07-ui.js's
  // defaultSlotSelect), not just a cosmetic hide — see
  // QM.state.groupVisible/slotVisible.
  _buildSlotVisibilityRow() {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "10px",
      fontSize: "12px",
    });

    const label = document.createElement("span");
    label.textContent = "Show Slots:";
    label.style.color = "var(--muted-foreground, currentcolor)";
    row.appendChild(label);

    const build = (labelText, onChange) => {
      const checkboxLabel = document.createElement("label");
      Object.assign(checkboxLabel.style, { display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" });
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.addEventListener("change", () => onChange(checkbox.checked));
      const text = document.createElement("span");
      text.textContent = labelText;
      checkboxLabel.append(checkbox, text);
      return { label: checkboxLabel, checkbox };
    };

    const underwear = build("Underwear", (value) => QM.state.updateShowUnderwear(value));
    this.underwearToggle = underwear.checkbox;
    const armor = build("Armor", (value) => QM.state.updateShowArmor(value));
    this.armorToggle = armor.checkbox;
    const weapons = build("Weapons", (value) => QM.state.updateShowWeapons(value));
    this.weaponsToggle = weapons.checkbox;

    row.append(underwear.label, armor.label, weapons.label);
    return row;
  },

  // Built once (like the forms) and cached on this.portraitImage so a
  // refreshed avatar can be applied live without a repaint. v1 just shows
  // the persona's real avatar — a package-owned generated/uploaded portrait
  // (per the extension: separate from the persona avatar, swaps on equip)
  // is later work, once this layout is settled.
  _buildPortrait() {
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, { display: "flex", justifyContent: "center", marginBottom: "8px" });

    // No fixed box — the frame just centers whatever's inside it. A fixed
    // square with object-fit: cover was cropping non-square avatars; capping
    // width/height on the <img> itself and letting it size naturally (below)
    // shows the whole portrait at its real aspect ratio instead.
    const frame = document.createElement("div");
    Object.assign(frame.style, { display: "flex", alignItems: "center", justifyContent: "center" });

    const image = document.createElement("img");
    image.alt = "Persona portrait";
    const hasAvatar = Boolean(QM.state.personaAvatarUrl);
    Object.assign(image.style, {
      maxWidth: "160px",
      maxHeight: "200px",
      width: "auto",
      height: "auto",
      objectFit: "contain",
      borderRadius: "var(--radius, 8px)",
      border: "1px solid var(--border, rgba(128,128,128,0.3))",
      display: hasAvatar ? "block" : "none",
    });
    if (hasAvatar) image.src = QM.state.personaAvatarUrl;
    this.portraitImage = image;

    const placeholder = document.createElement("span");
    placeholder.textContent = "No portrait";
    Object.assign(placeholder.style, {
      width: "120px",
      height: "120px",
      borderRadius: "var(--radius, 8px)",
      border: "1px solid var(--border, rgba(128,128,128,0.3))",
      background: "var(--muted, rgba(128,128,128,0.15))",
      display: hasAvatar ? "none" : "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "11px",
      color: "var(--muted-foreground, currentcolor)",
    });
    image.addEventListener("error", () => {
      image.style.display = "none";
      placeholder.style.display = "flex";
    });
    image.addEventListener("load", () => {
      image.style.display = "block";
      placeholder.style.display = "none";
    });
    this.portraitPlaceholder = placeholder;

    frame.append(image, placeholder);
    wrapper.appendChild(frame);
    return wrapper;
  },

  // Portrait ring: a row of slots above the portrait, a stacked column of
  // slots to each side, and a row below — the character-sheet layout from
  // the original extension, not the flat grouped list this replaced. Layout
  // data lives in QM_PORTRAIT_LAYOUT (05-state.js) so the dock only handles
  // arrangement, not slot membership or visibility rules. Below
  // QM_DOCK_RING_STACK_WIDTH the left-stack/portrait/right-stack row itself
  // stacks vertically too, for phone-width docks.
  _buildEquippedSection() {
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, { display: "flex", flexDirection: "column", gap: "6px", alignItems: "center" });

    wrapper.appendChild(this._buildSlotBoxRow(QM_PORTRAIT_LAYOUT.top));

    const ringStacked = this.bodyWidth < QM_DOCK_RING_STACK_WIDTH * this._zoomFactor();
    const middleRow = document.createElement("div");
    Object.assign(middleRow.style, {
      display: "flex",
      flexDirection: ringStacked ? "column" : "row",
      gap: "8px",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
    });

    const leftStack = document.createElement("div");
    Object.assign(leftStack.style, { display: "flex", gap: "4px" });
    for (const group of QM_PORTRAIT_LAYOUT.left) {
      if (group.group && !QM.state.groupVisible(group.group)) continue;
      leftStack.appendChild(this._buildSlotBoxColumn(group.header, group.slots));
    }
    // Stacked beneath the Clothing column specifically (the last column
    // appended above, since Clothing has no group and is always present),
    // not a third column of its own — matches "underneath clothing" from
    // the requested layout. Dropped entirely while hidden, same as every
    // other group-gated surface (05-state.js/07-ui.js).
    if (QM.state.groupVisible("underwear")) {
      const clothingColumn = leftStack.lastElementChild;
      clothingColumn.appendChild(this._buildSlotBoxColumnHeading(QM_PORTRAIT_LAYOUT.underwear.header));
      for (const slot of QM_PORTRAIT_LAYOUT.underwear.slots) clothingColumn.appendChild(this._buildSlotBox(slot));
    }

    const rightStack = document.createElement("div");
    Object.assign(rightStack.style, { display: "flex", gap: "4px" });
    for (const group of QM_PORTRAIT_LAYOUT.right) {
      if (group.group && !QM.state.groupVisible(group.group)) continue;
      rightStack.appendChild(this._buildSlotBoxColumn(group.header, group.slots));
    }

    middleRow.append(leftStack, this.portraitWrapper, rightStack);
    wrapper.appendChild(middleRow);

    wrapper.appendChild(this._buildSlotBoxRow(QM_PORTRAIT_LAYOUT.bottom));

    return wrapper;
  },

  _buildSlotBoxRow(slots) {
    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", gap: "4px", justifyContent: "center", flexWrap: "wrap" });
    for (const slot of slots) row.appendChild(this._buildSlotBox(slot));
    return row;
  },

  _buildSlotBoxColumnHeading(text) {
    const heading = document.createElement("div");
    heading.textContent = text;
    Object.assign(heading.style, {
      fontSize: "10px",
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      color: "var(--muted-foreground, currentcolor)",
      textAlign: "center",
      marginTop: "2px",
    });
    return heading;
  },

  _buildSlotBoxColumn(header, slots) {
    const column = document.createElement("div");
    Object.assign(column.style, { display: "flex", flexDirection: "column", gap: "4px" });
    column.appendChild(this._buildSlotBoxColumnHeading(header));
    for (const slot of slots) column.appendChild(this._buildSlotBox(slot));
    return column;
  },

  // A single compact slot box for the portrait ring — fixed width so the top
  // row, side columns, and bottom row all line up. Occupied boxes show the
  // item name and a small unequip button; empty ones show a bag picker, the
  // same two states _buildSlotRow covered before, just narrower.
  _buildSlotBox(slot) {
    const box = document.createElement("div");
    Object.assign(box.style, {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      border: "1px solid var(--border, rgba(128,128,128,0.3))",
      borderRadius: "4px",
      padding: "3px 4px",
      width: "104px",
      boxSizing: "border-box",
    });

    const label = document.createElement("span");
    label.textContent = QM_SLOT_LABELS[slot];
    Object.assign(label.style, {
      fontSize: "10px",
      color: "var(--muted-foreground, currentcolor)",
      textTransform: "uppercase",
      letterSpacing: "0.03em",
    });
    box.appendChild(label);

    const equippedItem = QM.state.itemInSlot(slot);
    if (equippedItem) {
      const line = document.createElement("div");
      Object.assign(line.style, { display: "flex", alignItems: "center", gap: "4px" });

      const name = document.createElement("span");
      name.textContent = equippedItem.name;
      name.title = equippedItem.name;
      Object.assign(name.style, {
        flex: "1",
        minWidth: "0",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontSize: "11px",
      });

      const unequipButton = QM.button("×", {
        bg: "var(--secondary, transparent)",
        fg: "var(--secondary-foreground, inherit)",
        border: true,
      });
      const unequipLabel = `Unequip ${QM_SLOT_LABELS[slot]}`;
      unequipButton.title = unequipLabel;
      unequipButton.setAttribute("aria-label", unequipLabel);
      Object.assign(unequipButton.style, { padding: "0 6px", lineHeight: "1.5", flexShrink: "0" });
      unequipButton.addEventListener("click", () => QM.state.updateItem(equippedItem.id, { location: "bag" }));

      line.append(name, unequipButton);
      box.appendChild(line);
      // Equipped items disappear from the Bag list (bagItems() excludes
      // anything in an equipped: location), so this is the only place left
      // to edit a description without unequipping first — keep it, just
      // narrower than the old full-width slot row it replaced.
      const description = QM.descriptionInput(equippedItem);
      description.style.width = "100%";
      description.style.boxSizing = "border-box";
      description.style.fontSize = "10px";
      box.appendChild(description);
      return box;
    }

    const bagItems = QM.state.bagItems();
    const select = QM.smallInput("select");
    select.disabled = bagItems.length === 0;
    Object.assign(select.style, { width: "100%", boxSizing: "border-box", fontSize: "11px" });
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = bagItems.length === 0 ? "(empty)" : "Equip…";
    select.appendChild(placeholder);
    for (const item of bagItems) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name;
      select.appendChild(option);
    }
    select.addEventListener("change", () => {
      const itemId = select.value;
      if (itemId) QM.state.updateItem(itemId, { location: `equipped:${slot}` });
    });
    box.appendChild(select);
    return box;
  },

  _buildSaveOutfitForm() {
    const form = document.createElement("form");
    Object.assign(form.style, { display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px" });

    const line = document.createElement("div");
    Object.assign(line.style, { display: "flex", gap: "6px" });

    const nameInput = QM.smallInput("input");
    nameInput.type = "text";
    nameInput.placeholder = "Save current as outfit…";
    nameInput.required = true;
    nameInput.style.flex = "1";

    const saveButton = QM.button("Save", { bg: QM_COLOR_SUCCESS, fg: QM_COLOR_SUCCESS_FG });
    saveButton.type = "submit";

    line.append(nameInput, saveButton);

    const descriptionInput = QM.smallInput("input");
    descriptionInput.type = "text";
    descriptionInput.placeholder = "Description (fed to appearance when selected above)";
    descriptionInput.style.width = "100%";
    descriptionInput.style.boxSizing = "border-box";

    form.append(line, descriptionInput);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      if (!name) return;
      saveButton.disabled = true;
      await QM.state.createOutfit({ name, description: descriptionInput.value });
      saveButton.disabled = false;
      nameInput.value = "";
      descriptionInput.value = "";
    });

    return form;
  },

  _buildOutfitsList() {
    const list = document.createElement("ul");
    Object.assign(list.style, {
      listStyle: "none",
      margin: "0",
      padding: "0",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    });

    const outfits = QM.state.sortedOutfits();
    if (outfits.length === 0) {
      const empty = QM.textNode("No saved outfits yet.");
      empty.style.color = "var(--muted-foreground, currentcolor)";
      empty.style.margin = "0";
      list.appendChild(empty);
      return list;
    }

    for (const outfit of outfits) {
      list.appendChild(this._buildOutfitRow(outfit));
    }
    return list;
  },

  _buildOutfitRow(outfit) {
    const row = document.createElement("li");
    Object.assign(row.style, {
      display: "flex",
      flexDirection: "column",
      gap: "3px",
      border: "1px solid var(--border, rgba(128,128,128,0.3))",
      borderRadius: "4px",
      padding: "4px 6px",
    });

    const topLine = document.createElement("div");
    Object.assign(topLine.style, { display: "flex", alignItems: "center", gap: "6px" });

    const equipped = QM.state.outfitMatchesCurrent(outfit);
    const name = document.createElement("span");
    name.style.flex = "1";
    name.textContent = equipped ? `${outfit.name} (equipped)` : outfit.name;
    if (equipped) name.style.fontWeight = "600";

    const equipButton = QM.button("Equip");
    equipButton.addEventListener("click", () => QM.state.equipOutfit(outfit.id));

    const updateButton = QM.button("Update", {
      bg: "var(--secondary, transparent)",
      fg: "var(--secondary-foreground, inherit)",
      border: true,
    });
    updateButton.title = "Resave the currently-equipped items into this outfit";
    updateButton.addEventListener("click", () => QM.state.updateOutfit(outfit.id, { resnapshot: true }));

    const deleteButton = QM.button("Delete", { bg: QM_COLOR_DANGER, fg: QM_COLOR_DANGER_FG });
    deleteButton.addEventListener("click", () => QM.state.deleteOutfit(outfit.id));

    topLine.append(name, equipButton, updateButton, deleteButton);
    row.appendChild(topLine);

    const descriptionInput = QM.smallInput("input");
    descriptionInput.type = "text";
    descriptionInput.placeholder = "Description";
    descriptionInput.value = outfit.description || "";
    descriptionInput.addEventListener("change", () =>
      QM.state.updateOutfit(outfit.id, { description: descriptionInput.value }),
    );
    row.appendChild(descriptionInput);

    return row;
  },

  _buildAddItemForm() {
    const form = document.createElement("form");
    Object.assign(form.style, { display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px" });

    const line = document.createElement("div");
    Object.assign(line.style, { display: "flex", gap: "6px" });

    const nameInput = QM.smallInput("input");
    nameInput.type = "text";
    nameInput.placeholder = "Item name";
    nameInput.required = true;
    nameInput.style.flex = "1";

    const quantityInput = QM.smallInput("input");
    quantityInput.type = "number";
    quantityInput.min = "1";
    quantityInput.value = "1";
    quantityInput.style.width = "56px";

    const addButton = QM.button("Add", { bg: QM_COLOR_SUCCESS, fg: QM_COLOR_SUCCESS_FG });
    addButton.type = "submit";

    line.append(nameInput, quantityInput, addButton);

    const descriptionInput = QM.smallInput("input");
    descriptionInput.type = "text";
    descriptionInput.placeholder = "Description (optional)";
    descriptionInput.style.width = "100%";
    descriptionInput.style.boxSizing = "border-box";

    form.append(line, descriptionInput);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      if (!name) return;
      addButton.disabled = true;
      await QM.state.addItem({ name, quantity: quantityInput.value, description: descriptionInput.value });
      addButton.disabled = false;
      nameInput.value = "";
      quantityInput.value = "1";
      descriptionInput.value = "";
    });

    return form;
  },

  _buildItemList() {
    const list = document.createElement("ul");
    Object.assign(list.style, {
      listStyle: "none",
      margin: "0",
      padding: "0",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    });

    const items = QM.state.bagItems();
    if (items.length === 0) {
      const empty = QM.textNode("Bag is empty.");
      empty.style.color = "var(--muted-foreground, currentcolor)";
      empty.style.margin = "0";
      list.appendChild(empty);
      return list;
    }

    for (const item of items) {
      list.appendChild(this._buildItemRow(item));
    }
    return list;
  },

  _buildItemRow(item) {
    const row = document.createElement("li");
    Object.assign(row.style, {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      border: "1px solid var(--border, rgba(128,128,128,0.3))",
      borderRadius: "4px",
      padding: "4px 6px",
    });

    const topLine = document.createElement("div");
    Object.assign(topLine.style, { display: "flex", alignItems: "center", gap: "6px" });

    const label = document.createElement("span");
    label.textContent = item.name;
    label.style.flex = "1";

    const quantityInput = QM.smallInput("input");
    quantityInput.type = "number";
    // 0 is a legitimate quantity now ("used up but still tracked" — the same
    // rule the tracker agent follows, plan §16.3), so this no longer floors
    // at 1 the way a brand-new item's starting quantity still does.
    quantityInput.min = "0";
    quantityInput.value = String(item.quantity);
    quantityInput.style.width = "48px";
    quantityInput.addEventListener("change", () => QM.state.updateItem(item.id, { quantity: quantityInput.value }));

    const deleteButton = QM.button("Delete", { bg: QM_COLOR_DANGER, fg: QM_COLOR_DANGER_FG });
    deleteButton.addEventListener("click", () => QM.state.deleteItem(item.id));

    topLine.append(label, quantityInput, deleteButton);

    const storedLine = document.createElement("div");
    Object.assign(storedLine.style, { display: "flex", alignItems: "center", gap: "6px" });

    const storedLabel = document.createElement("span");
    storedLabel.textContent = "Stored at:";
    Object.assign(storedLabel.style, { fontSize: "11px", color: "var(--muted-foreground, currentcolor)" });

    const storedInput = QM.smallInput("input");
    storedInput.type = "text";
    storedInput.placeholder = "bag";
    storedInput.value = item.location.startsWith("stored:") ? item.location.slice("stored:".length) : "";
    storedInput.style.flex = "1";
    storedInput.addEventListener("change", () => {
      const text = storedInput.value.trim();
      QM.state.updateItem(item.id, { location: text ? `stored:${text}` : "bag" });
    });

    storedLine.append(storedLabel, storedInput);

    const equipLine = document.createElement("div");
    Object.assign(equipLine.style, { display: "flex", alignItems: "center", gap: "6px" });
    const defaultSlotSelect = QM.defaultSlotSelect(item);
    defaultSlotSelect.style.flex = "1";
    const equipButton = QM.button("Equip");
    // A stored defaultSlot can still point at a slot whose group has since
    // been hidden (defaultSlotSelect just won't offer it as an option
    // anymore) — block the shortcut button too, or it'd be the one way left
    // to equip into a slot a toggle is supposed to disable.
    const canEquip = Boolean(item.defaultSlot) && QM.state.slotVisible(item.defaultSlot);
    equipButton.disabled = !canEquip;
    equipButton.style.opacity = canEquip ? "1" : "0.5";
    equipButton.addEventListener("click", () => {
      if (canEquip) QM.state.updateItem(item.id, { location: `equipped:${item.defaultSlot}` });
    });
    equipLine.append(defaultSlotSelect, equipButton);

    row.append(topLine, storedLine, equipLine, QM.descriptionInput(item));
    return row;
  },
};
