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
#qm-dock-body{
  scrollbar-width: thin;
  scrollbar-color: var(--border, rgba(128,128,128,0.4)) transparent;
}
#qm-dock-body::-webkit-scrollbar{ width:8px; height:8px; }
#qm-dock-body::-webkit-scrollbar-track{ background:transparent; }
#qm-dock-body::-webkit-scrollbar-thumb{
  background:var(--border, rgba(128,128,128,0.4)); border-radius:4px;
}
#qm-dock-body::-webkit-scrollbar-thumb:hover{ background:var(--muted-foreground, rgba(128,128,128,0.6)); }
.qm-desc-scroll{
  scrollbar-width: thin;
  scrollbar-color: var(--border, rgba(128,128,128,0.4)) transparent;
}
.qm-desc-scroll::-webkit-scrollbar{ width:6px; height:6px; }
.qm-desc-scroll::-webkit-scrollbar-track{ background:transparent; }
.qm-desc-scroll::-webkit-scrollbar-thumb{
  background:var(--border, rgba(128,128,128,0.4)); border-radius:3px;
}
.qm-desc-scroll::-webkit-scrollbar-thumb:hover{ background:var(--muted-foreground, rgba(128,128,128,0.6)); }
.qm-tooltip-wrap{ position:relative; display:inline-flex; }
.qm-tooltip-popover{ display:none; }
.qm-tooltip-wrap:hover .qm-tooltip-popover,
.qm-tooltip-wrap.qm-tooltip-open .qm-tooltip-popover{ display:block; }
.qm-overflow-wrap{ position:relative; display:inline-flex; }
.qm-overflow-menu{ display:none; }
.qm-overflow-wrap.qm-overflow-open .qm-overflow-menu{ display:flex; }
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
// Independent from QM_UI_SIZES/zoom — this controls the pixel box size of
// outfit portrait thumbnails and item placeholder images specifically, read
// at build time by their card layouts rather than a live CSS zoom, since
// those cards already get rebuilt on every repaint anyway.
const QM_THUMBNAIL_SIZE_KEY = "marinara.quartermaster.thumbnailSize";
const QM_THUMBNAIL_SIZES = { S: 48, M: 72, L: 100 };
// Independent from QM_THUMBNAIL_SIZES above (which still governs item/
// outfit thumbnails, unchanged) — the portrait needs to scale far more
// aggressively per size, since 5 equip-slot-box pairs beside it need real
// vertical room not to overlap at S/M. S stays exactly what it was before;
// M becomes what L used to be; L is double what L used to be.
const QM_PORTRAIT_SCALE = {
  S: QM_THUMBNAIL_SIZES.S / QM_THUMBNAIL_SIZES.M,
  M: QM_THUMBNAIL_SIZES.L / QM_THUMBNAIL_SIZES.M,
  L: (QM_THUMBNAIL_SIZES.L / QM_THUMBNAIL_SIZES.M) * 2,
};
// Cut-corner "gem frame" look for the portrait — shared by both the real
// image and the empty-state placeholder so they read as the same frame
// regardless of which is showing. Border/glow use the theme's own accent
// (var(--primary)), not a fixed brand color, so it matches whatever accent
// the user's actually set in the Engine rather than a hardcoded look.
// Applied to the FRAME (the div wrapping the image/placeholder), not to the
// image/placeholder themselves — clip-path clips a box's descendants along
// with itself, so a child image's square corners are cut away for free
// wherever they'd fall inside the octagon's notches, with no separate
// clip-path needed on the image. The frame's own small padding is what makes
// that backing/mat visible as a ring around the portrait rather than the
// image filling the clipped shape edge-to-edge. Two box-shadow layers: the
// outer glow (unchanged from before) plus a thin inset hairline for a subtle
// "double border" look — same technique, no extra DOM needed for it.
// clipPath is intentionally NOT in this static object — see
// qmPortraitFrameClipPath's own comment for why it has to be a fixed pixel
// value computed per portraitScale instead.
const QM_PORTRAIT_FRAME_STYLE = {
  border: "2px solid var(--primary, #444)",
  padding: "3px",
  background: "color-mix(in srgb, var(--primary, #444) 10%, rgba(0, 0, 0, 0.55))",
  boxShadow:
    "0 0 12px color-mix(in srgb, var(--primary, #444) 45%, transparent), " +
    "inset 0 0 0 1px color-mix(in srgb, var(--primary, #444) 35%, transparent)",
  boxSizing: "border-box",
};

// A percentage-based clip-path inset (the original design) cuts a DIFFERENT
// angle on a non-square box — 12% of a 130px width is a different pixel
// distance than 12% of a 162px height, so the corner cut on a typical
// (taller-than-wide) portrait was never actually 45°. The corner ornaments
// assume a true 45° notch (their own path is drawn against a square 36x36
// viewBox), so a fixed EQUAL pixel inset on both axes is what actually
// matches them, regardless of the portrait's own aspect ratio.
function qmPortraitFrameCutSize(portraitScale) {
  return Math.round(qmClampWindowValue(12 * portraitScale, 8, 18));
}

function qmPortraitFrameClipPath(cut) {
  return (
    `polygon(${cut}px 0, calc(100% - ${cut}px) 0, 100% ${cut}px, ` +
    `100% calc(100% - ${cut}px), calc(100% - ${cut}px) 100%, ${cut}px 100%, ` +
    `0 calc(100% - ${cut}px), 0 ${cut}px)`
  );
}

// Hand-drawn scrollwork corner ornament, designed and iterated visually
// (see _planning/scratch/frame-ornament-lab.html) rather than guessed blind —
// a flat SVG line drawing at ~32px doesn't survive freehand coordinate math
// the way the equip-slot icons didn't either. Drawn once in a canonical
// "top-left-ish" orientation: the dense curl detail sits near local (8,8),
// diagonally inward from local (0,0), with two tendrils sweeping out toward
// (34,2)/(2,34). Every corner reuses this exact same path, oriented by CSS
// transform — see qmBuildPortraitCornerAccent's own comment for why it's
// scale flips, not rotations, and why the specific corner→transform mapping
// below isn't the "obvious" one.
const QM_PORTRAIT_CORNER_PATH =
  "M2 34 C2 16 16 2 34 2 M8 34 C8 20 20 8 34 8 M2 22 C2 22 10 16 10 8 C10 4 8 2 8 2 M22 2 C22 2 16 10 8 10 C4 10 2 8 2 8" +
  " M34 2 C30 6 28 10 28 14 M2 34 C6 30 10 28 14 28";

// scaleX/scaleY (reflections), not rotate(90deg) steps — a true rotation
// would be the "obvious" way to place one ornament at all 4 corners, but
// this path's curl is asymmetric (denser detail on one side), and mirroring
// is what keeps that dense detail pointing in toward the portrait at every
// corner rather than rotating it around to face out toward the corner tip
// at 2 of the 4 positions. The exact mapping (which axis for which corner)
// was arrived at visually, not derived — see the lab file's iteration
// history if this ever needs revisiting.
const QM_PORTRAIT_CORNER_TRANSFORMS = {
  "top left": "scale(-1, -1)",
  "top right": "scaleY(-1)",
  "bottom left": "scaleX(-1)",
  "bottom right": "none",
};

// sizePx here is deliberately small relative to the frame — anchored 2px
// out from the frame's own edge (well outside the frame's 3px padding), not
// flush with it, so the ornament's outer tips push past the border while
// the dense inner detail (fixed at local ~8,8 regardless of sizePx) lands
// close to the corner rather than reaching deep into the portrait. Lives on
// `wrapper` (a sibling of the clipped `frame`, not a child of it) — anything
// placed inside `frame` itself would be clipped away wherever it fell in one
// of the octagon's cut notches, corners included.
function qmBuildPortraitCornerAccent(corner, sizePx) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 36 36");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    `<path d="${QM_PORTRAIT_CORNER_PATH}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>` +
    `<circle cx="8" cy="8" r="1.6" fill="currentColor"/>`;
  const offset = "2px";
  Object.assign(svg.style, {
    position: "absolute",
    width: `${sizePx}px`,
    height: `${sizePx}px`,
    color: "var(--primary, #444)",
    pointerEvents: "none",
    transform: QM_PORTRAIT_CORNER_TRANSFORMS[corner],
    top: corner.includes("top") ? offset : "auto",
    bottom: corner.includes("bottom") ? offset : "auto",
    left: corner.includes("left") ? offset : "auto",
    right: corner.includes("right") ? offset : "auto",
  });
  return svg;
}

// Same clamp the lab settled on (20-30px), driven off the portrait's own max
// width at the current Thumbnail Size — there's no single fixed "frame
// width" to size off of the way the lab's test harness had, since the real
// portrait's rendered width varies with its own aspect ratio; the max-width
// QM_PORTRAIT_SCALE already computes is the closest stand-in.
function qmPortraitCornerSize(portraitScale) {
  return qmClampWindowValue(Math.round(160 * portraitScale) * 0.16, 20, 30);
}

function qmClampWindowValue(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

// A related but deliberately simpler sibling to the portrait's own frame —
// same theme-colored border + soft glow language, but a plain rounded rect
// (no clip-path cut corners: a compact list row's image/text would bite
// against a cut notch at this size) with small corner dots instead of
// scrollwork — the same accent the portrait frame carried before its own
// curl-ornament upgrade, reused here rather than reinvented.
const QM_ITEM_CARD_FRAME_STYLE = {
  border: "1px solid var(--primary, #444)",
  borderRadius: "var(--radius, 4px)",
  padding: "5px 7px",
  boxShadow: "0 0 6px color-mix(in srgb, var(--primary, #444) 25%, transparent)",
  boxSizing: "border-box",
};

// Same technique as QM_ITEM_CARD_FRAME_STYLE, but outlined in the Add
// button's own success color instead of the theme accent — a visually
// distinct "this is the create-new form, not one more item" cue, without
// needing a different shape or extra ornamentation to say it.
const QM_ADD_ITEM_FRAME_STYLE = {
  border: `1px solid ${QM_COLOR_SUCCESS}`,
  borderRadius: "var(--radius, 4px)",
  padding: "5px 7px",
  boxShadow: `0 0 6px color-mix(in srgb, ${QM_COLOR_SUCCESS} 25%, transparent)`,
  boxSizing: "border-box",
};

// An item/outfit card's description preview scrolls within a fixed cap
// instead of growing the card for a very long description. Used to be
// measured live against a same-row action column's real rendered height
// (three earlier revisions of that, each subtly wrong — see git history if
// this history matters again); that action column no longer exists at all
// now that Edit/Update/Delete collapsed into the "⋯" overflow menu and the
// description runs full width, so there's nothing left to measure against
// — a plain fixed cap is simpler and, with the action column gone, no
// longer trading anything away.
const QM_DESC_LINE_HEIGHT_PX = 14;
const QM_CARD_DESC_MAX_HEIGHT_PX = QM_DESC_LINE_HEIGHT_PX * 5;

function qmBuildCardCornerDot(corner) {
  const dot = document.createElement("span");
  dot.setAttribute("aria-hidden", "true");
  const edge = 5;
  const offset = "-2px";
  Object.assign(dot.style, {
    position: "absolute",
    width: `${edge}px`,
    height: `${edge}px`,
    background: "var(--primary, #444)",
    opacity: "0.75",
    transform: "rotate(45deg)",
    pointerEvents: "none",
    top: corner.includes("top") ? offset : "auto",
    bottom: corner.includes("bottom") ? offset : "auto",
    left: corner.includes("left") ? offset : "auto",
    right: corner.includes("right") ? offset : "auto",
  });
  return dot;
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

function qmReadThumbnailSize() {
  try {
    const stored = window.localStorage.getItem(QM_THUMBNAIL_SIZE_KEY);
    if (stored && QM_THUMBNAIL_SIZES[stored]) return stored;
  } catch {
    // A blocked storage read falls back to the default size.
  }
  return "M";
}

function qmWriteThumbnailSize(size) {
  try {
    window.localStorage.setItem(QM_THUMBNAIL_SIZE_KEY, size);
  } catch {
    // Persisting is a convenience; the session still works without it.
  }
}

const QM_COLUMN_COLLAPSED_KEY = "marinara.quartermaster.columnCollapsed";
const QM_COLUMN_KEYS = ["outfits", "equipped", "bag"];
// The flex value each column uses when expanded — matches what each
// column's own Object.assign(...style, {flex: ...}) already set at
// creation (Equipped is wider since the portrait ring needs the room), so
// collapsing/expanding restores exactly the original proportions rather
// than a guessed one. Collapsed columns get a fixed narrow basis instead
// (see _applySectionHeaders) so the OTHER columns' own flex naturally
// absorbs the reclaimed width — a real horizontal collapse, not just
// hiding content inside a column that stays its full original width.
const QM_COLUMN_EXPANDED_FLEX = { outfits: "1", equipped: "1.6", bag: "1" };
const QM_COLUMN_COLLAPSED_WIDTH = 40;

// Sub-tabs within the Bag column, splitting one flat list into three so a
// chat with a lot of stuff isn't one giant scroll. A stored location wins
// over defaultSlot when both apply (an item stashed in a closet stays
// "Stored" even if it's also wearable) — location is the more specific,
// deliberately-set fact in that case, so it takes priority.
const QM_BAG_TABS = [
  { key: "items", label: "Items" },
  { key: "wearables", label: "Wearables" },
  { key: "stored", label: "Stored" },
];
function qmItemMatchesBagTab(item, tab) {
  const stored = item.location.startsWith("stored:");
  if (tab === "stored") return stored;
  if (stored) return false;
  return tab === "wearables" ? Boolean(item.defaultSlot) : !item.defaultSlot;
}

// Tracks whichever "tap-opened" popover (an info tooltip, a card's overflow
// menu) is currently open -- at most one at a time, whatever kind -- so one
// document-level click listener can close it when the next click lands
// anywhere else. Both popover kinds share this: opening one always closes
// whatever else was open first.
let qmOpenPopover = null; // { wrapper, openClass } | null
let qmPopoverDocumentListenerBound = false;
function qmClosePopover() {
  if (qmOpenPopover) qmOpenPopover.wrapper.classList.remove(qmOpenPopover.openClass);
  qmOpenPopover = null;
}
function qmBindPopoverDocumentListener() {
  if (qmPopoverDocumentListenerBound || typeof document === "undefined") return;
  qmPopoverDocumentListenerBound = true;
  document.addEventListener("click", () => qmClosePopover());
}
// `onOpen`, when given, runs after the popover's now-visible via
// requestAnimationFrame (so it has real layout to measure) -- used to clamp
// it back inside the dock's own bounds, see qmClampPopoverToContainer.
function qmTogglePopover(wrapper, openClass, event, onOpen) {
  event.stopPropagation();
  const alreadyOpen = qmOpenPopover && qmOpenPopover.wrapper === wrapper;
  qmClosePopover();
  if (!alreadyOpen) {
    wrapper.classList.add(openClass);
    qmOpenPopover = { wrapper, openClass };
    if (onOpen) requestAnimationFrame(onOpen);
  }
}

// Re-measures `popoverEl` against `containerEl` (the dock's own scrollable
// body -- the ask is "stay inside the dock," not just the browser viewport)
// and flips whichever edge it would otherwise clip through. Resets to
// `defaults` first so a stale flip from a previous open never carries over
// to this one (a different trigger, or the dock having since been resized).
// This is why #qm-dock-body's own overflow:auto used to visibly clip these:
// a position:absolute descendant is still clipped by the nearest ancestor
// whose overflow isn't "visible," regardless of which direction it grows.
function qmClampPopoverToContainer(popoverEl, containerEl, defaults) {
  Object.assign(popoverEl.style, defaults);
  if (!containerEl) return;
  const containerRect = containerEl.getBoundingClientRect();
  const rect = popoverEl.getBoundingClientRect();
  if (rect.right > containerRect.right) {
    popoverEl.style.left = "auto";
    popoverEl.style.right = "0";
  } else if (rect.left < containerRect.left) {
    popoverEl.style.left = "0";
    popoverEl.style.right = "auto";
  }
  if (rect.bottom > containerRect.bottom) {
    popoverEl.style.top = "auto";
    popoverEl.style.bottom = "100%";
  }
}

function qmReadColumnCollapsed() {
  const result = { outfits: false, equipped: false, bag: false };
  try {
    const stored = JSON.parse(window.localStorage.getItem(QM_COLUMN_COLLAPSED_KEY) || "null");
    if (stored && typeof stored === "object") {
      for (const key of QM_COLUMN_KEYS) {
        if (typeof stored[key] === "boolean") result[key] = stored[key];
      }
    }
  } catch {
    // A blocked or stale storage value falls back to every column expanded.
  }
  return result;
}

function qmWriteColumnCollapsed(state) {
  try {
    window.localStorage.setItem(QM_COLUMN_COLLAPSED_KEY, JSON.stringify(state));
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
  thumbnailSizeButtons: null,
  errorNode: null,
  feedSelect: null,
  imageConnectionSelect: null,
  itemPromptTextarea: null,
  outfitPromptTextarea: null,
  settingsSection: null,
  inventoryView: null,
  settingsView: null,
  viewTabButtons: null,
  underwearToggle: null,
  armorToggle: null,
  weaponsToggle: null,
  replaceRealAvatarToggle: null,
  restoreInventoryButton: null,
  recentChangesContainer: null,
  recentUpdateContainer: null,
  recentUpdateChevron: null,
  recentUpdateCountBadge: null,
  equippedContainer: null,
  outfitsContainer: null,
  listContainer: null,
  portraitWrapper: null,
  portraitImage: null,
  portraitPlaceholder: null,
  portraitCorners: null,
  portraitFrame: null,
  connectorSvg: null,
  equippedSlotBoxRefs: null,
  geometry: qmReadWindowGeometry(),
  bodyWidth: QM_WINDOW_DEFAULT_WIDTH,
  uiSize: qmReadUiSize(),
  thumbnailSize: qmReadThumbnailSize(),
  // Top-level dock view: the 3-column inventory grid (plus Recent Agent
  // Update above it) or the restructured Settings groups. A session-only UI
  // preference, same as bagTab/recentUpdateExpanded below — not reset on
  // chat switch, unlike geometry/uiSize which are worth persisting for real.
  activeView: "inventory",
  // Collapsed by default to keep the dock compact.
  recentUpdateExpanded: false,
  // Which equip slot's picker is open, if any — set by clicking a slot box,
  // cleared by picking an item, clicking the same slot again, closing the
  // dock, or switching chats (see close()/QM.state.setChat's own reset).
  selectedSlot: null,
  itemEditorBackdrop: null,
  outfitEditorBackdrop: null,
  saveOutfitBackdrop: null,
  wardrobeBuilderBackdrop: null,
  imageGenBackdrop: null,
  addItemBackdrop: null,
  _itemEditorEscapeHandler: null,
  _outfitEditorEscapeHandler: null,
  _saveOutfitEscapeHandler: null,
  _wardrobeEscapeHandler: null,
  _imageGenEscapeHandler: null,
  _addItemEscapeHandler: null,
  bagSearchQuery: "",
  bagSearchMode: "name",
  bagSearchInput: null,
  bagSearchModeButtons: null,
  bagTab: "items",
  bagTabButtons: null,
  outfitSearchQuery: "",
  outfitSearchInput: null,
  columnCollapsed: qmReadColumnCollapsed(),
  // How much window width was reclaimed the last time each column
  // collapsed, so expanding it again can hand back exactly that much
  // rather than re-measuring (the column's own rendered width while
  // collapsed is just the fixed strip width, not useful for a restore).
  columnCollapseDelta: { outfits: 0, equipped: 0, bag: 0 },
  sectionHeaders: null,
  sectionBodies: null,
  _windowBound: false,
  _outsideClickBound: false,
  _interaction: null,
  _boundsObserver: null,
  _bodyObserver: null,

  // Every DOM node _paint/_ensureRoot cache on `this` so a repaint can find
  // and update them without rebuilding — cleared together whenever the root
  // is rebuilt or there's no chat to show, since a stale reference into a
  // detached tree is worse than none.
  _resetCachedNodes() {
    this._closeItemEditor();
    this._closeOutfitEditor();
    this._closeSaveOutfitModal();
    this._closeAddItemModal();
    this._closeWardrobeBuilder();
    this._closeImageGenModal();
    this.columns = null;
    this.zoomWrapper = null;
    this.uiSizeButtons = null;
    this.thumbnailSizeButtons = null;
    this.errorNode = null;
    this.feedSelect = null;
    this.imageConnectionSelect = null;
    this.itemPromptTextarea = null;
    this.outfitPromptTextarea = null;
    this.settingsSection = null;
    this.inventoryView = null;
    this.settingsView = null;
    this.viewTabButtons = null;
    this.underwearToggle = null;
    this.armorToggle = null;
    this.weaponsToggle = null;
    this.replaceRealAvatarToggle = null;
    this.restoreInventoryButton = null;
    this.recentChangesContainer = null;
    this.equippedContainer = null;
    this.outfitsContainer = null;
    this.listContainer = null;
    this.portraitWrapper = null;
    this.portraitImage = null;
    this.portraitPlaceholder = null;
    this.portraitCorners = null;
    this.portraitFrame = null;
    this.connectorSvg = null;
    this.equippedSlotBoxRefs = null;
    this.bagSearchInput = null;
    this.bagSearchModeButtons = null;
    this.bagTabButtons = null;
    this.outfitSearchInput = null;
    this.sectionHeaders = null;
    this.sectionBodies = null;
    this.recentUpdateContainer = null;
    this.recentUpdateChevron = null;
    this.recentUpdateCountBadge = null;
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
      // Picks up server-side changes from the tracker agent via the
      // Engine's own generation-complete event — see QM.state.startPolling's
      // comment.
      QM.state.startPolling();
    }
    QM.state.ensureLoaded();
    this._paint();
  },

  close() {
    this.isOpenFlag = false;
    this.selectedSlot = null;
    this._closeItemEditor();
    this._closeOutfitEditor();
    this._closeSaveOutfitModal();
    this._closeAddItemModal();
    this._closeWardrobeBuilder();
    this._closeImageGenModal();
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

  // QM_DOCK_COLUMNS_STACK_WIDTH is calibrated assuming all three columns are
  // showing their full expanded share; a collapsed column only needs its
  // fixed narrow-strip width, not that share, so each currently-collapsed
  // column lowers the threshold by the gap between the two. Without this,
  // collapsing more than one column (which deliberately shrinks the window
  // to match — see _toggleColumnCollapsed) could trip the "not enough room,
  // stack them vertically" fallback even though everything still visible
  // comfortably fits in a row.
  _columnsStackThreshold() {
    const flexSum = QM_COLUMN_KEYS.reduce((sum, key) => sum + Number(QM_COLUMN_EXPANDED_FLEX[key]), 0);
    let threshold = QM_DOCK_COLUMNS_STACK_WIDTH;
    for (const key of QM_COLUMN_KEYS) {
      if (!this.columnCollapsed[key]) continue;
      const fairShare = QM_DOCK_COLUMNS_STACK_WIDTH * (Number(QM_COLUMN_EXPANDED_FLEX[key]) / flexSum);
      threshold -= Math.max(0, fairShare - QM_COLUMN_COLLAPSED_WIDTH);
    }
    return threshold;
  },

  _isColumnsStacked() {
    if (!this.columns) return false;
    return this.bodyWidth < this._columnsStackThreshold() * this._zoomFactor();
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
    // _applySectionHeaders owns the flexDirection decision too (see its own
    // comment) — it needs the same collapse-aware threshold this function
    // used to compute on its own with a plain flat one, so there's now a
    // single, consistent place that decides it instead of two call sites
    // that could disagree about whether the layout should be stacked.
    this._applySectionHeaders();
    if (this.equippedContainer) {
      this.equippedContainer.replaceChildren(this._buildEquippedSection());
      requestAnimationFrame(() => this._updateConnectorLines());
    }
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
    if (!this._outsideClickBound) {
      this._outsideClickBound = true;
      // Matches most other Marinara menus (and the original extension):
      // clicking anywhere outside the open dock closes it. Capture phase so
      // an intervening stopPropagation() elsewhere in the host can't hide a
      // click from this; pointerdown (not click) to match the drag/resize
      // handlers' own event choice and to close as soon as the press lands,
      // not after it releases. Two exclusions: mid-drag/resize (this
      // .root.contains would be true anyway since the pointer started
      // inside, but this also covers a resize handle drag that ends outside
      // the dock's own bounds), and the toolbar launch button itself — its
      // own click handler already toggles, so also closing here would
      // close-then-immediately-reopen instead of just toggling once.
      document.addEventListener(
        "pointerdown",
        (event) => {
          if (!this.isOpenFlag || this._interaction || !this.root) return;
          const target = event.target instanceof Element ? event.target : null;
          if (!target || this.root.contains(target) || target.closest(".qm-launch")) return;
          this.close();
        },
        true,
      );
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

    if (!this.zoomWrapper || !this.body.contains(this.zoomWrapper)) {
      // Outside the zoom wrapper, so it stays a fixed-size, stable control
      // no matter what size it's currently set to.
      const uiSizeRow = this._buildUiSizeRow();
      const thumbnailSizeRow = this._buildThumbnailSizeRow();
      const sizeControlsRow = document.createElement("div");
      Object.assign(sizeControlsRow.style, {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "16px",
        marginBottom: "8px",
        flexShrink: "0",
      });
      sizeControlsRow.append(uiSizeRow, thumbnailSizeRow);

      this.zoomWrapper = document.createElement("div");

      this.errorNode = QM.textNode("");
      this.errorNode.style.color = QM_COLOR_DANGER;
      this.errorNode.style.display = "none";

      // Top-level Inventory/Settings switch — same active/inactive
      // background-swap idiom as QM_BAG_TABS, not the bordered
      // section-header style used by the 3 columns below.
      const viewTabRow = document.createElement("div");
      Object.assign(viewTabRow.style, { display: "flex", gap: "4px", marginBottom: "8px" });
      this.viewTabButtons = {};
      for (const [key, label] of [
        ["inventory", "Inventory"],
        ["settings", "Settings"],
      ]) {
        const button = QM.button(label);
        Object.assign(button.style, { flex: "1", padding: "4px 8px" });
        button.addEventListener("click", () => {
          if (this.activeView === key) return;
          this.activeView = key;
          this._applyActiveView();
        });
        this.viewTabButtons[key] = button;
        viewTabRow.appendChild(button);
      }

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

      // Left: Outfits. Center: portrait ring. Right: Bag/Inventory. Each
      // column's header (_buildSectionHeader) is bordered/clickable and
      // toggles that column's own body wrapper — see that method's own
      // comment for why the live count and the collapse toggle share one
      // element instead of being two separate headers.
      const outfitsColumn = document.createElement("div");
      Object.assign(outfitsColumn.style, { flex: "1", minWidth: "0", width: "100%" });
      this.outfitsContainer = document.createElement("div");
      const outfitSearchRow = this._buildOutfitSearchRow();
      const outfitsBody = document.createElement("div");
      outfitsBody.append(outfitSearchRow, this.outfitsContainer);
      outfitsColumn.append(this._buildSectionHeader("outfits", "Outfits", outfitsBody, outfitsColumn), outfitsBody);

      const equippedColumn = document.createElement("div");
      Object.assign(equippedColumn.style, { flex: "1.6", minWidth: "0", width: "100%" });
      this.equippedContainer = document.createElement("div");
      const equippedBody = document.createElement("div");
      equippedBody.appendChild(this.equippedContainer);
      equippedColumn.append(
        this._buildSectionHeader("equipped", "Equipped", equippedBody, equippedColumn),
        equippedBody,
      );

      const bagColumn = document.createElement("div");
      Object.assign(bagColumn.style, { flex: "1", minWidth: "0", width: "100%" });
      const bagSearchRow = this._buildBagSearchRow();
      const bagTabRow = this._buildBagTabRow();
      this.listContainer = document.createElement("div");
      const bagBody = document.createElement("div");
      bagBody.append(bagSearchRow, bagTabRow, this.listContainer);
      bagColumn.append(this._buildSectionHeader("bag", "Bag", bagBody, bagColumn), bagBody);

      columns.append(outfitsColumn, equippedColumn, bagColumn);

      // Inventory view: Recent Agent Update (moved into the slot the old
      // Settings accordion used to occupy) above the 3-column grid. Settings
      // view: the regrouped settings content. Visibility toggled by
      // _applyActiveView, not rebuilt on every tab switch.
      this.inventoryView = document.createElement("div");
      this.inventoryView.append(this._buildRecentUpdateSection(), columns);
      this.settingsView = this.settingsSection;

      this.zoomWrapper.append(this.errorNode, viewTabRow, this.inventoryView, this.settingsView);
      this.body.replaceChildren(sizeControlsRow, this.zoomWrapper);
      this._applyActiveView();
      this._applySectionHeaders();
      this._applyUiSize();
      this._applyThumbnailSize();
    }

    if (QM.state.error) {
      this.errorNode.textContent = `Error: ${QM.state.error}`;
      this.errorNode.style.display = "";
    } else {
      this.errorNode.style.display = "none";
    }

    this._applyBagSearch();
    this._applyOutfitSearch();
    this._applySectionHeaders();
    this._applyRecentUpdateHeader();
    this.feedSelect.value = QM.state.appearanceFeedMode;
    this.underwearToggle.checked = QM.state.showUnderwear;
    this.armorToggle.checked = QM.state.showArmor;
    this.weaponsToggle.checked = QM.state.showWeapons;
    this.replaceRealAvatarToggle.checked = QM.state.replaceRealAvatarOnEquip;
    this.restoreInventoryButton.disabled = !QM.state.previousSnapshot;
    this.recentChangesContainer.replaceChildren(this._buildRecentChangesList());
    if (this.imageConnectionSelect && !this.imageConnectionSelect.disabled) {
      this.imageConnectionSelect.value = QM.state.imageConnectionId || "";
    }
    // Guarded against the active element: _paint() fires on every state
    // change, including ones unrelated to these fields (e.g. an equip action
    // elsewhere in the dock) -- an unconditional value= assignment here would
    // silently clobber an in-progress, not-yet-blurred edit. Falls back to
    // the real default TEXT (not just a placeholder ghost) when unset, so a
    // user edits FROM the actual default instead of writing a prompt from
    // scratch -- placeholder stays as a secondary safety net, never shown
    // once value is populated this way.
    if (document.activeElement !== this.itemPromptTextarea) {
      this.itemPromptTextarea.value = QM.state.itemImagePromptTemplate || QM_DEFAULT_ITEM_IMAGE_PROMPT_TEMPLATE;
    }
    if (document.activeElement !== this.outfitPromptTextarea) {
      this.outfitPromptTextarea.value =
        QM.state.outfitPortraitPromptTemplate || QM_DEFAULT_OUTFIT_PORTRAIT_PROMPT_TEMPLATE;
    }
    // display was previously only set once at _buildPortrait()'s construction
    // time, from whatever hasAvatar was at mount — harmless while the only
    // input was the persona's own avatar (rarely changes mid-session), but
    // outfit-portrait swapping changes this input constantly, so both the
    // src and the image/placeholder toggle need to be live here, not just src.
    const portraitUrl = QM.state.activeOutfitPortraitUrl() || QM.state.personaAvatarUrl;
    if (this.portraitImage && this.portraitPlaceholder) {
      this.portraitImage.style.display = portraitUrl ? "block" : "none";
      this.portraitPlaceholder.style.display = portraitUrl ? "none" : "flex";
      if (portraitUrl) this.portraitImage.src = portraitUrl;
      // Scales with Thumbnail Size same as item/outfit thumbnails, relative
      // to the 160x200 / 120x120 box _buildPortrait() sized at "M" — live
      // here (not just at _buildPortrait()'s one-time construction) since a
      // size change repaints without rebuilding the cached portrait nodes.
      const portraitScale = QM_PORTRAIT_SCALE[this.thumbnailSize];
      this.portraitImage.style.maxWidth = `${Math.round(160 * portraitScale)}px`;
      this.portraitImage.style.maxHeight = `${Math.round(200 * portraitScale)}px`;
      this.portraitPlaceholder.style.width = `${Math.round(120 * portraitScale)}px`;
      this.portraitPlaceholder.style.height = `${Math.round(120 * portraitScale)}px`;
      if (this.portraitFrame) {
        this.portraitFrame.style.clipPath = qmPortraitFrameClipPath(qmPortraitFrameCutSize(portraitScale));
      }
      if (this.portraitCorners) {
        const cornerSize = qmPortraitCornerSize(portraitScale);
        for (const corner of this.portraitCorners) {
          corner.style.width = `${cornerSize}px`;
          corner.style.height = `${cornerSize}px`;
        }
      }
    }
    this.equippedContainer.replaceChildren(this._buildEquippedSection());
    requestAnimationFrame(() => this._updateConnectorLines());
    this.outfitsContainer.replaceChildren(this._buildOutfitsList());
    this._applyBagTabs();
    this.listContainer.replaceChildren(this._buildItemList());
  },

  // Controls what QM.state.updateAppearanceFeedMode writes into this chat's
  // chatMeta.macroVariables (quartermaster_appearance_persona) every time
  // equip state changes — the value a {{getvar::...}} token in the
  // persona's own appearance field can pick up so Roleplay's Illustrator
  // image generation reflects what's actually equipped, without a user
  // having to hand-edit that field themselves.
  _buildAppearanceFeedRow() {
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, { fontSize: "12px" });

    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", alignItems: "center", gap: "6px" });

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

    const tooltip = this._buildInfoTooltip(
      "Writes the chosen text into a per-chat variable so a {{getvar::quartermaster_appearance_persona}} " +
        "token in the persona's own Appearance field resolves to it — letting image generation (e.g. " +
        "Illustrator) pick up what's actually equipped. Off writes nothing; Outfit description uses the " +
        "saved outfit that exactly matches the current equip state (falling back to a plain list of " +
        "equipped item names when nothing matches, e.g. after equipping something outside any saved " +
        "outfit); Equipped item names always lists what's equipped, regardless of outfit.",
    );

    row.append(label, select, tooltip);

    wrapper.append(row);
    return wrapper;
  },

  // Generate Image settings: which image_generation connection Quartermaster
  // itself uses (a purely local, per-chat preference -- never an Engine-wide
  // default, see server.mjs's own comment), and the two editable prompt
  // templates. The connection list is fetched client-side straight from the
  // Engine's own /api/connections (QM.listImageConnections, mirrors
  // pixelforge's PF.api.getJson) since no package permission gates what
  // browser JS can fetch same-origin.
  _buildImageGenerationSettingsRow() {
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, { fontSize: "12px", display: "flex", flexDirection: "column", gap: "8px" });

    const connectionRow = document.createElement("div");
    Object.assign(connectionRow.style, { display: "flex", alignItems: "center", gap: "6px" });
    const connectionLabel = document.createElement("span");
    connectionLabel.textContent = "Image connection:";
    connectionLabel.style.color = "var(--muted-foreground, currentcolor)";
    const connectionSelect = QM.smallInput("select");
    connectionSelect.style.flex = "1";
    connectionSelect.disabled = true;
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Loading connections…";
    connectionSelect.appendChild(defaultOption);
    connectionSelect.addEventListener("change", () => QM.state.updateImageConnectionId(connectionSelect.value));
    this.imageConnectionSelect = connectionSelect;
    connectionRow.append(connectionLabel, connectionSelect);

    const connectionNote = document.createElement("p");
    Object.assign(connectionNote.style, {
      margin: "0",
      fontSize: "11px",
      color: "var(--muted-foreground, currentcolor)",
    });

    const populateConnections = () => {
      connectionSelect.disabled = true;
      const checkingOption = document.createElement("option");
      checkingOption.value = "";
      checkingOption.textContent = "Checking…";
      connectionSelect.replaceChildren(checkingOption);
      QM.listImageConnections().then(
        (connections) => {
          const useDefaultOption = document.createElement("option");
          useDefaultOption.value = "";
          useDefaultOption.textContent = "Use Engine default";
          const options = [
            useDefaultOption,
            ...connections.map((connection) => {
              const option = document.createElement("option");
              option.value = connection.id;
              option.textContent = connection.name || connection.id;
              return option;
            }),
          ];
          connectionSelect.replaceChildren(...options);
          connectionSelect.value = QM.state.imageConnectionId || "";
          connectionSelect.disabled = false;
          connectionNote.textContent =
            connections.length === 0
              ? "No image connection is configured in the Engine yet — Generate will be unavailable until one exists (Upload still works)."
              : "Used only for Quartermaster's own Generate Image feature — never changes any Engine-wide default.";
        },
        () => {
          const errorOption = document.createElement("option");
          errorOption.value = "";
          errorOption.textContent = "Could not load connections";
          connectionSelect.replaceChildren(errorOption);
          const retry = document.createElement("button");
          retry.type = "button";
          retry.textContent = "↻ Retry";
          Object.assign(retry.style, {
            marginLeft: "6px",
            background: "none",
            border: "none",
            color: "var(--primary, currentcolor)",
            cursor: "pointer",
            font: "inherit",
            fontSize: "11px",
            padding: "0",
          });
          retry.addEventListener("click", populateConnections);
          connectionNote.replaceChildren(document.createTextNode("Could not check for an image connection."), retry);
        },
      );
    };
    populateConnections();

    const itemPromptLabel = document.createElement("p");
    itemPromptLabel.textContent = "Item image prompt template:";
    Object.assign(itemPromptLabel.style, { margin: "0", color: "var(--muted-foreground, currentcolor)" });
    const itemPromptTextarea = QM.smallInput("textarea");
    Object.assign(itemPromptTextarea.style, {
      width: "100%",
      minHeight: "48px",
      resize: "vertical",
      boxSizing: "border-box",
    });
    itemPromptTextarea.placeholder = QM_DEFAULT_ITEM_IMAGE_PROMPT_TEMPLATE;
    itemPromptTextarea.addEventListener("blur", () => QM.state.updateItemImagePromptTemplate(itemPromptTextarea.value));
    this.itemPromptTextarea = itemPromptTextarea;
    const itemPromptNote = document.createElement("p");
    itemPromptNote.textContent = "Tokens: {item}, {item_description}. Saves when you click away.";
    Object.assign(itemPromptNote.style, {
      margin: "0",
      fontSize: "11px",
      color: "var(--muted-foreground, currentcolor)",
    });

    const outfitPromptLabel = document.createElement("p");
    outfitPromptLabel.textContent = "Outfit portrait prompt template:";
    Object.assign(outfitPromptLabel.style, { margin: "0", color: "var(--muted-foreground, currentcolor)" });
    const outfitPromptTextarea = QM.smallInput("textarea");
    Object.assign(outfitPromptTextarea.style, {
      width: "100%",
      minHeight: "48px",
      resize: "vertical",
      boxSizing: "border-box",
    });
    outfitPromptTextarea.placeholder = QM_DEFAULT_OUTFIT_PORTRAIT_PROMPT_TEMPLATE;
    outfitPromptTextarea.addEventListener("blur", () =>
      QM.state.updateOutfitPortraitPromptTemplate(outfitPromptTextarea.value),
    );
    this.outfitPromptTextarea = outfitPromptTextarea;
    const outfitPromptNote = document.createElement("p");
    outfitPromptNote.textContent =
      "Tokens: {name}, {persona_appearance} (the persona's own Appearance field only), {equipped_items} " +
      "(the outfit's own description). Saves when you click away.";
    Object.assign(outfitPromptNote.style, {
      margin: "0",
      fontSize: "11px",
      color: "var(--muted-foreground, currentcolor)",
    });

    wrapper.append(
      connectionRow,
      connectionNote,
      itemPromptLabel,
      itemPromptTextarea,
      itemPromptNote,
      outfitPromptLabel,
      outfitPromptTextarea,
      outfitPromptNote,
    );
    return wrapper;
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
    // The zoom factor changed, which shifts the outfits/equipped/bag
    // columns' own stack threshold (_applyResponsiveLayout reads it) even
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

  // Controls the pixel box size of outfit portrait thumbnails and item
  // placeholder images — separate from UI Size (that's a CSS zoom over the
  // whole dock; this only affects how much room images take up in each
  // card). Outfit/item cards already get rebuilt on every repaint, so a
  // size change just triggers a full repaint rather than a live style patch.
  _buildThumbnailSizeRow() {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      fontSize: "12px",
      flexShrink: "0",
    });

    const label = document.createElement("span");
    label.textContent = "Thumbnail Size:";
    label.style.color = "var(--muted-foreground, currentcolor)";
    row.appendChild(label);

    this.thumbnailSizeButtons = {};
    for (const size of Object.keys(QM_THUMBNAIL_SIZES)) {
      const button = QM.button(size);
      button.style.padding = "2px 10px";
      button.addEventListener("click", () => this._setThumbnailSize(size));
      this.thumbnailSizeButtons[size] = button;
      row.appendChild(button);
    }
    return row;
  },

  _setThumbnailSize(size) {
    if (!QM_THUMBNAIL_SIZES[size] || this.thumbnailSize === size) return;
    this.thumbnailSize = size;
    qmWriteThumbnailSize(size);
    this._applyThumbnailSize();
    this._paint();
  },

  _applyThumbnailSize() {
    for (const [size, button] of Object.entries(this.thumbnailSizeButtons || {})) {
      const active = size === this.thumbnailSize;
      button.style.background = active ? "var(--primary, #444)" : "var(--secondary, transparent)";
      button.style.color = active ? "var(--primary-foreground, #fff)" : "var(--secondary-foreground, inherit)";
      button.style.border = active ? "none" : "1px solid var(--border, rgba(0,0,0,0.2))";
    }
  },

  // A small "?" badge revealing `text` in a positioned popover — on hover
  // (desktop, pure CSS via .qm-tooltip-wrap:hover in QM_DOCK_STYLE) AND on
  // click/tap (qmTogglePopover's .qm-tooltip-open class), since :hover
  // alone is unreachable on a touchscreen and this dock commits to mobile
  // support. Replaces the permanent explanatory paragraphs Settings used to
  // carry under every control — shown on demand instead of always taking
  // vertical space.
  _buildInfoTooltip(text) {
    const wrapper = document.createElement("span");
    wrapper.className = "qm-tooltip-wrap";

    const badge = document.createElement("button");
    badge.type = "button";
    badge.textContent = "?";
    badge.setAttribute("aria-label", "More info");
    Object.assign(badge.style, {
      width: "14px",
      height: "14px",
      borderRadius: "50%",
      border: "1px solid var(--border, rgba(128,128,128,0.4))",
      background: "var(--secondary, transparent)",
      color: "var(--muted-foreground, inherit)",
      fontSize: "10px",
      lineHeight: "12px",
      padding: "0",
      cursor: "pointer",
      flexShrink: "0",
    });
    const popover = document.createElement("div");
    popover.className = "qm-tooltip-popover";
    popover.textContent = text;
    Object.assign(popover.style, {
      position: "absolute",
      top: "18px",
      left: "0",
      zIndex: "30",
      // Wide enough that the Feed Appearance tooltip's own
      // {{getvar::quartermaster_appearance_persona}} token (the longest
      // unbroken run any tooltip currently has) reads on one line instead
      // of an awkward mid-token break — 220px forced it to wrap there.
      width: "320px",
      boxSizing: "border-box",
      padding: "8px",
      borderRadius: "var(--radius, 4px)",
      border: "1px solid var(--border, rgba(128,128,128,0.4))",
      background: "var(--popover, var(--card, #1a1a1a))",
      color: "var(--popover-foreground, inherit)",
      fontSize: "11px",
      lineHeight: "1.4",
      boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
      // A long unbroken token (the {{getvar::...}} macro name in the Feed
      // Appearance tooltip has no spaces to wrap at) would otherwise overflow
      // this fixed width instead of breaking mid-token to stay inside it.
      overflowWrap: "break-word",
      wordBreak: "break-word",
    });

    // Defaults it may get flipped away from -- see qmClampPopoverToContainer.
    // Re-clamped on every open (click OR hover), since #qm-dock-body's own
    // overflow:auto clips a stray edge otherwise, regardless of growth
    // direction.
    const tooltipDefaults = { left: "0", right: "auto", top: "18px", bottom: "auto" };
    const clampToDock = () => qmClampPopoverToContainer(popover, this.body, tooltipDefaults);
    wrapper.addEventListener("mouseenter", () => requestAnimationFrame(clampToDock));
    badge.addEventListener("click", (event) => qmTogglePopover(wrapper, "qm-tooltip-open", event, clampToDock));
    qmBindPopoverDocumentListener();

    wrapper.append(badge, popover);
    return wrapper;
  },

  // A "⋯" button opening a small dropdown of secondary actions — used by
  // both item and outfit cards to collapse Edit/Update/Delete out of the
  // name row, so Equip can live there instead and the description gets the
  // width that used to go to a fixed action column. Click-only (no hover
  // reveal, unlike the info tooltip) since this holds real actions,
  // including a destructive one -- hovering shouldn't be enough to expose
  // them. Each action's own onClick is responsible for any confirmation it
  // needs (Delete already confirms via window.confirm).
  _buildCardOverflowMenu(actions) {
    const wrapper = document.createElement("span");
    wrapper.className = "qm-overflow-wrap";

    const button = QM.button("⋯", { border: true, bg: "transparent", fg: "inherit" });
    Object.assign(button.style, { width: "32px", padding: "2px 0", flexShrink: "0" });

    const menu = document.createElement("div");
    menu.className = "qm-overflow-menu";
    Object.assign(menu.style, {
      position: "absolute",
      top: "100%",
      right: "0",
      zIndex: "30",
      marginTop: "2px",
      flexDirection: "column",
      minWidth: "110px",
      borderRadius: "var(--radius, 4px)",
      border: "1px solid var(--border, rgba(128,128,128,0.4))",
      background: "var(--popover, var(--card, #1a1a1a))",
      boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
      overflow: "hidden",
    });

    // Defaults it may get flipped away from -- see qmClampPopoverToContainer.
    // Right-aligned by default (grows leftward from the button, since the
    // button itself usually sits near a card's right edge); re-clamped on
    // every open since #qm-dock-body's own overflow:auto otherwise clips
    // whichever edge this would cross, most often the bottom for a card
    // near the end of a scrolled list.
    const menuDefaults = { left: "auto", right: "0", top: "100%", bottom: "auto" };
    button.addEventListener("click", (event) =>
      qmTogglePopover(wrapper, "qm-overflow-open", event, () =>
        qmClampPopoverToContainer(menu, this.body, menuDefaults),
      ),
    );

    for (const action of actions) {
      const menuItem = document.createElement("button");
      menuItem.type = "button";
      menuItem.textContent = action.label;
      Object.assign(menuItem.style, {
        display: "block",
        width: "100%",
        padding: "6px 10px",
        textAlign: "left",
        background: "transparent",
        border: "none",
        color: action.danger ? QM_COLOR_DANGER : "inherit",
        cursor: "pointer",
        font: "inherit",
        fontSize: "11px",
      });
      menuItem.addEventListener("click", (event) => {
        event.stopPropagation();
        qmClosePopover();
        action.onClick();
      });
      menu.appendChild(menuItem);
    }

    wrapper.append(button, menu);
    return wrapper;
  },

  // Small caps-label divider used to break Settings' controls into named
  // groups — Appearance/Display/Image Generation/Data — instead of one flat
  // run of unrelated rows.
  _buildSettingsGroupHeader(label) {
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, { marginTop: "12px", marginBottom: "6px" });
    const text = document.createElement("div");
    text.textContent = label;
    Object.assign(text.style, {
      fontWeight: "600",
      fontSize: "11px",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      color: "var(--muted-foreground, inherit)",
      marginBottom: "6px",
    });
    const rule = document.createElement("div");
    rule.style.borderTop = "1px solid var(--border, rgba(128,128,128,0.3))";
    wrapper.append(text, rule);
    return wrapper;
  },

  // The Settings tab's content — grouped, not a flat list of nine unrelated
  // rows. No accordion/chevron of its own any more: which top-level view
  // (Inventory vs Settings) is showing is what controls visibility now, see
  // _paint()'s own top-level tab switch.
  _buildSettingsSection() {
    const section = document.createElement("div");
    section.append(
      this._buildSettingsGroupHeader("Appearance"),
      this._buildAppearanceFeedRow(),
      this._buildRealAvatarToggleRow(),
      this._buildSettingsGroupHeader("Display"),
      this._buildSlotVisibilityRow(),
      this._buildSettingsGroupHeader("Image Generation"),
      this._buildImageGenerationSettingsRow(),
      this._buildRefreshImagesRow(),
      this._buildSettingsGroupHeader("Data"),
      this._buildExportImportRow(),
    );
    return section;
  },

  // Portable character sheet: export the current chat's items/outfits/
  // settings as a downloadable file, or replace them by importing one back —
  // in a fresh chat this needs no tracker agent enabled at all, matching the
  // original extension's own export/import.
  _buildExportImportRow() {
    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", alignItems: "center", gap: "10px" });

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
        setTimeout(() => URL.revokeObjectURL(url), 0);
      } catch (error) {
        QM.state.error = error instanceof Error ? error.message : String(error);
        QM.state._notify();
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

  // Manual escape hatch for QM._missingItemImageIds (00-api.js): once an
  // item's image request 404s, every equip-slot box and bag row remembers
  // that for the rest of the session rather than re-requesting (and
  // re-404ing) it on every repaint. That's the right default, but it means
  // a pack image dropped straight into the gallery folder mid-session, or a
  // just-uploaded image that should now show everywhere it's cached as
  // missing, doesn't appear until something clears that cache. Closing and
  // reopening the dock would also work (_resetCachedNodes runs on the next
  // open regardless), but isn't obvious as the fix — this does the same
  // rebuild on demand, from a control that's actually about images.
  _buildRefreshImagesRow() {
    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", alignItems: "center", gap: "10px" });

    const description = document.createElement("span");
    description.textContent = "Re-check every item for a matching image.";
    Object.assign(description.style, { fontSize: "11px", color: "var(--muted-foreground, inherit)", flex: "1" });

    const refreshButton = QM.button("Refresh Images", {
      bg: "var(--secondary, transparent)",
      fg: "var(--secondary-foreground, inherit)",
      border: true,
    });
    refreshButton.addEventListener("click", () => {
      QM._missingItemImageIds.clear();
      this._resetCachedNodes();
      this._paint();
    });

    row.append(description, refreshButton);
    return row;
  },

  // The safety net for a bad tracker-agent turn: server.mjs's
  // reconcileTrackerOutput snapshots items+outfits right before applying
  // each turn's changes, so this can revert to exactly how things stood
  // before the LAST agent update, even if that turn wiped or badly mangled
  // the inventory and there's no export file to re-import. Single-level —
  // restoring consumes the snapshot, so the button disables itself again
  // right after (synced every _paint from QM.state.previousSnapshot, same
  // as the other Settings toggles) until the next agent turn creates a new
  // one.
  _buildRestoreInventoryRow() {
    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", alignItems: "center", gap: "10px" });

    const description = document.createElement("span");
    description.textContent = "Revert to the state from just before the last agent update.";
    Object.assign(description.style, { fontSize: "11px", color: "var(--muted-foreground, inherit)", flex: "1" });

    const restoreButton = QM.button("Restore Inventory", {
      bg: "var(--secondary, transparent)",
      fg: "var(--secondary-foreground, inherit)",
      border: true,
    });
    restoreButton.disabled = !QM.state.previousSnapshot;
    restoreButton.addEventListener("click", async () => {
      if (!window.confirm("Replace the current items and outfits with the state from before the last agent update?")) {
        return;
      }
      restoreButton.disabled = true;
      await QM.state.restoreInventory();
    });
    this.restoreInventoryButton = restoreButton;

    row.append(description, restoreButton);
    return row;
  },

  // The collapsible accordion that replaced Settings in this same visual
  // slot (see _paint()'s top-level view split) — everything about reviewing
  // and recovering from what the tracker agent just did, in one place:
  // Restore Inventory (whole-state) above the per-item Recent Agent Update
  // list. Collapsed by default; the header itself always shows a compact
  // +N/↑N/−N count (see _applyRecentUpdateHeader) so there's something to
  // glance at without expanding.
  _buildRecentUpdateSection() {
    const section = document.createElement("div");
    Object.assign(section.style, {
      border: "1px solid var(--border, rgba(128,128,128,0.3))",
      borderRadius: "var(--radius, 4px)",
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
      transform: this.recentUpdateExpanded ? "rotate(90deg)" : "rotate(0deg)",
    });
    this.recentUpdateChevron = chevron;

    const label = document.createElement("span");
    label.textContent = "Recent Agent Update";
    Object.assign(label.style, {
      fontWeight: "600",
      fontSize: "11px",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    });

    const countBadge = document.createElement("span");
    Object.assign(countBadge.style, {
      fontSize: "11px",
      fontWeight: "600",
      marginLeft: "auto",
      display: "flex",
      gap: "8px",
    });
    this.recentUpdateCountBadge = countBadge;

    header.append(chevron, label, countBadge);
    header.addEventListener("click", () => {
      this.recentUpdateExpanded = !this.recentUpdateExpanded;
      content.style.display = this.recentUpdateExpanded ? "flex" : "none";
      this.recentUpdateChevron.style.transform = this.recentUpdateExpanded ? "rotate(90deg)" : "rotate(0deg)";
    });

    // Plain display:none/"" toggle, not a max-height+overflow:hidden
    // transition (what the old Settings accordion used, and what this
    // section itself tried first) — that approach went through two rounds
    // of real leaks here (padding not folded into the 0px, then a flex
    // container's own min-height:"auto" default overriding max-height
    // per spec) before landing on this instead: display:none removes the
    // element from layout entirely, so there's no box-model subtlety left
    // to get wrong. The tradeoff is losing the slide animation the old
    // accordion had; correctness here matters more than that polish.
    const content = document.createElement("div");
    Object.assign(content.style, {
      padding: "8px",
      display: this.recentUpdateExpanded ? "flex" : "none",
      flexDirection: "column",
      gap: "8px",
    });

    const container = document.createElement("div");
    this.recentChangesContainer = container;
    content.append(this._buildRestoreInventoryRow(), container);

    section.append(header, content);
    return section;
  },

  // One row per touched item (never per field) — Revert resets everything
  // about that item atomically, matching how the server records it. Diff
  // text is computed here from the raw before/after values the server
  // persisted, so a row only mentions fields that actually changed
  // ("qty 2→1 · moved to Bag") instead of restating every field regardless.
  // Reasoning is shown whether or not anything changed -- a quiet turn is
  // still worth reading the agent's own reasoning for.
  _buildRecentChangesList() {
    const change = QM.state.lastTrackerChange;
    const list = document.createElement("div");
    Object.assign(list.style, { display: "flex", flexDirection: "column", gap: "4px" });

    const hasAnyChange =
      change && (change.addedItems.length > 0 || change.updatedItems.length > 0 || change.removedItems.length > 0);
    if (!hasAnyChange) {
      const empty = QM.textNode(change ? "Nothing changed on the last automatic update." : "No automatic updates yet.");
      Object.assign(empty.style, { fontSize: "11px", color: "var(--muted-foreground, inherit)" });
      list.appendChild(empty);
      if (!change || !change.reasoning) return list;
    } else {
      // Revert sits to the LEFT of the item text -- right beside what it
      // applies to, not trailing off on the far side of the row.
      const buildRow = (symbol, color, label, name, detail, itemId) => {
        const row = document.createElement("div");
        Object.assign(row.style, { display: "flex", alignItems: "center", gap: "8px", fontSize: "11px" });

        if (itemId) {
          const revertButton = QM.button("Revert", {
            bg: "var(--secondary, transparent)",
            fg: "var(--secondary-foreground, inherit)",
            border: true,
          });
          Object.assign(revertButton.style, { padding: "2px 8px", fontSize: "10px", flexShrink: "0" });
          revertButton.addEventListener("click", async () => {
            revertButton.disabled = true;
            await QM.state.revertTrackerItem(itemId);
          });
          row.appendChild(revertButton);
        }

        const text = document.createElement("span");
        text.style.flex = "1";
        text.style.color = color;
        text.textContent = `${symbol} ${label}  ${name}${detail ? `  ${detail}` : ""}`;
        row.appendChild(text);
        return row;
      };

      const fieldDiffText = (before, after) => {
        const parts = [];
        if (before.quantity !== after.quantity) parts.push(`qty ${before.quantity}→${after.quantity}`);
        if (before.location !== after.location) parts.push(`moved to ${qmLocationLabel(after.location)}`);
        if (before.description !== after.description) parts.push("description changed");
        return parts.join(" · ");
      };

      for (const entry of change.addedItems) {
        list.appendChild(buildRow("+", QM_COLOR_SUCCESS, "Added", entry.name, "", entry.id));
      }
      for (const entry of change.updatedItems) {
        list.appendChild(
          buildRow("↑", QM_COLOR_WARNING, "Updated", entry.name, fieldDiffText(entry.before, entry.after), entry.id),
        );
      }
      for (const entry of change.removedItems) {
        list.appendChild(buildRow("−", QM_COLOR_DANGER, "Removed", entry.name, "", entry.id));
      }
      if (change.equippedOutfitName) {
        list.appendChild(buildRow("⚙", "inherit", "Equipped outfit:", change.equippedOutfitName, "", null));
      }
    }

    if (change && change.reasoning) {
      const reasoning = document.createElement("div");
      reasoning.textContent = `Reasoning: "${change.reasoning}"`;
      Object.assign(reasoning.style, {
        fontSize: "11px",
        fontStyle: "italic",
        color: "var(--muted-foreground, inherit)",
        marginTop: "4px",
      });
      list.appendChild(reasoning);
    }
    return list;
  },

  // Keeps the accordion header's collapsed-state count readout
  // (+N / ↑N / −N, same symbols and colors the expanded rows use) in sync
  // every paint — a glanceable summary of what changed without expanding.
  // A segment is omitted entirely when its count is 0, so a quiet turn
  // shows nothing extra in the header at all.
  _applyRecentUpdateHeader() {
    const change = QM.state.lastTrackerChange;
    const counts = [
      { count: change ? change.addedItems.length : 0, symbol: "+", color: QM_COLOR_SUCCESS },
      { count: change ? change.updatedItems.length : 0, symbol: "↑", color: QM_COLOR_WARNING },
      { count: change ? change.removedItems.length : 0, symbol: "−", color: QM_COLOR_DANGER },
    ];
    this.recentUpdateCountBadge.replaceChildren(
      ...counts
        .filter((entry) => entry.count > 0)
        .map((entry) => {
          const span = document.createElement("span");
          span.textContent = `${entry.symbol}${entry.count}`;
          span.style.color = entry.color;
          return span;
        }),
    );
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

  // Opt-in, default-off: also push the active outfit's portrait to the
  // persona's REAL avatar (not just this dock's own display), reverting to
  // whatever it was before when unequipped. Two costs worth surfacing right
  // here rather than only in the README, since this toggle is the one place
  // a user decides to take them on: (1) the Engine keeps a permanent version
  // history entry on every avatar change — no way to suppress it; (2) other
  // Marinara UI showing the persona's avatar (chat header, persona picker)
  // may take a while to visually catch up, per a known Engine-side caching
  // behavior — generation-time reads (e.g. "send avatar as reference") are
  // unaffected, this dock's own portrait display is unaffected either way.
  _buildRealAvatarToggleRow() {
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" });

    const checkboxLabel = document.createElement("label");
    Object.assign(checkboxLabel.style, { display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" });
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", () => QM.state.updateReplaceRealAvatarOnEquip(checkbox.checked));
    const text = document.createElement("span");
    text.textContent = "Replace persona's real avatar on equip";
    checkboxLabel.append(checkbox, text);
    this.replaceRealAvatarToggle = checkbox;

    const tooltip = this._buildInfoTooltip(
      "Reverts automatically when unequipped. Each change adds a permanent entry to the persona's " +
        "version history (can't be turned off), and other Marinara screens showing this avatar may take " +
        "a bit to catch up visually — image generation itself isn't affected.",
    );

    wrapper.append(checkboxLabel, tooltip);
    return wrapper;
  },

  // Built once (like the forms) and cached on this.portraitImage/
  // this.portraitPlaceholder so a refreshed avatar can be applied live
  // without a repaint — see render()'s own comment on why both need their
  // display toggled on every render now, not just src. Shows the active
  // outfit's own portrait when one's set (QM.state.activeOutfitPortraitUrl),
  // falling back to the persona's real avatar otherwise.
  _buildPortrait() {
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, {
      display: "flex",
      justifyContent: "center",
      marginBottom: "8px",
      position: "relative",
      // middleRow's alignItems: "stretch" (see _buildEquippedSection's own
      // comment) stretches every flex item to match whichever sibling is
      // tallest — originally always the portrait, since its own max height
      // (200 * portraitScale) comfortably exceeded the slot columns' stacked
      // height. At smaller Thumbnail Sizes that's flipped: 5 stacked slot
      // boxes can now be taller than a shrunk portrait, so stretch was
      // pulling the frame down to match THEM instead, leaving empty border
      // below the actual photo. align-self: center opts this one item out
      // of that stretch, sizing it to its own content (the image/
      // placeholder) regardless of which side is taller, while still
      // centering it vertically alongside whichever side is.
      alignSelf: "center",
    });

    // QM_PORTRAIT_SCALE, not QM_THUMBNAIL_SIZES directly — the portrait
    // needs to scale much more aggressively per size than item/outfit
    // thumbnails do, since 5 slot-box pairs need real vertical room beside
    // it not to overlap at S/M. See QM_PORTRAIT_SCALE's own comment.
    const portraitScale = QM_PORTRAIT_SCALE[this.thumbnailSize];

    // No fixed box — the frame just centers whatever's inside it. A fixed
    // square with object-fit: cover was cropping non-square avatars; capping
    // width/height on the <img> itself and letting it size naturally (below)
    // shows the whole portrait at its real aspect ratio instead. The frame
    // itself (not the image/placeholder) carries QM_PORTRAIT_FRAME_STYLE now
    // — see that constant's own comment for why.
    const frame = document.createElement("div");
    Object.assign(frame.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      clipPath: qmPortraitFrameClipPath(qmPortraitFrameCutSize(portraitScale)),
      ...QM_PORTRAIT_FRAME_STYLE,
    });
    // Measured by _updateConnectorLines to find where the connector lines
    // should actually terminate — the frame is the real visual boundary
    // (border, clip-path corners), not `wrapper`, which also contains the
    // corner ornaments sitting outside that boundary.
    this.portraitFrame = frame;

    const image = document.createElement("img");
    image.alt = "Persona portrait";
    const hasAvatar = Boolean(QM.state.personaAvatarUrl);
    Object.assign(image.style, {
      maxWidth: `${Math.round(160 * portraitScale)}px`,
      maxHeight: `${Math.round(200 * portraitScale)}px`,
      width: "auto",
      height: "auto",
      objectFit: "contain",
      display: hasAvatar ? "block" : "none",
    });
    if (hasAvatar) image.src = QM.state.personaAvatarUrl;
    this.portraitImage = image;

    const placeholder = document.createElement("span");
    placeholder.textContent = "No portrait";
    Object.assign(placeholder.style, {
      width: `${Math.round(120 * portraitScale)}px`,
      height: `${Math.round(120 * portraitScale)}px`,
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
      requestAnimationFrame(() => this._updateConnectorLines());
    });
    image.addEventListener("load", () => {
      image.style.display = "block";
      placeholder.style.display = "none";
      // The one geometry change that doesn't go through a full
      // _buildEquippedSection() rebuild — a freshly loaded avatar can change
      // the frame's rendered size (different aspect ratio than whatever was
      // showing before), so the connector lines need their own explicit
      // recompute here.
      requestAnimationFrame(() => this._updateConnectorLines());
    });
    this.portraitPlaceholder = placeholder;

    frame.append(image, placeholder);
    const cornerSize = qmPortraitCornerSize(portraitScale);
    this.portraitCorners = [
      qmBuildPortraitCornerAccent("top left", cornerSize),
      qmBuildPortraitCornerAccent("top right", cornerSize),
      qmBuildPortraitCornerAccent("bottom left", cornerSize),
      qmBuildPortraitCornerAccent("bottom right", cornerSize),
    ];
    wrapper.append(frame, ...this.portraitCorners);
    return wrapper;
  },

  // Head/Eyes/Ears/Neck sit in a row above the portrait, Belt/Feet below —
  // beside it. The remaining 5 pairs (QM_OVERLAY_SLOT_PAIRS) sit in columns
  // to either side, stretched (alignItems: "stretch" on middleRow) to match
  // whatever the portrait's own real rendered height turns out to be, then
  // spread evenly across that matched height (space-between) — there's no
  // way to pin a slot to a real anatomical position without pose analysis,
  // since personas vary in aspect ratio, so this is the practical
  // alternative. `this.portraitWrapper` itself is cached/reused (not
  // rebuilt here) so the avatar <img> element survives every repaint.
  _buildEquippedSection() {
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      alignItems: "center",
      position: "relative",
    });

    // Reset fresh each rebuild — _buildOverlaySlotBox populates this as it
    // creates each box, keyed by slot, so _updateConnectorLines knows which
    // element to measure and which frame edge it should reach toward without
    // re-deriving "which side is this slot on" from scratch every time.
    this.equippedSlotBoxRefs = new Map();

    // Painted first so slot boxes/portrait (opaque, drawn after in DOM
    // order) sit visually on top of the lines rather than the lines
    // crossing over them — only the small connection nodes are meant to
    // read as touching an edge. Absolutely positioned to fill `wrapper`
    // exactly (inset: 0), remeasured by _updateConnectorLines once real
    // layout exists — building the lines here would just measure zeros,
    // since nothing's attached to the document yet at this point.
    const connectorSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    // width/height: 100% is load-bearing, not redundant with inset: 0 — SVG
    // is a replaced element, and a replaced element's auto-height under
    // position:absolute falls back to its intrinsic size (an SVG's default
    // is literally 300x150, the same classic default <canvas> has) rather
    // than actually stretching to the containing block the way an ordinary
    // div would. Confirmed live in _planning/scratch/connector-lines-lab.html
    // — inset: 0 alone silently clipped every line past the first ~150px.
    Object.assign(connectorSvg.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
    });
    this.connectorSvg = connectorSvg;
    wrapper.appendChild(connectorSvg);

    const topRow = document.createElement("div");
    Object.assign(topRow.style, { display: "flex", gap: "4px", justifyContent: "center", flexWrap: "wrap" });
    for (const slot of QM_OVERLAY_TOP_SLOTS) {
      const box = this._buildOverlaySlotBox(slot);
      this.equippedSlotBoxRefs.set(slot, { element: box, side: "top" });
      topRow.appendChild(box);
    }
    wrapper.appendChild(topRow);

    const middleRow = document.createElement("div");
    Object.assign(middleRow.style, {
      display: "flex",
      gap: "8px",
      alignItems: "stretch",
      justifyContent: "center",
      width: "100%",
    });

    const leftColumn = document.createElement("div");
    Object.assign(leftColumn.style, { display: "flex", flexDirection: "column", justifyContent: "space-between" });
    const rightColumn = document.createElement("div");
    Object.assign(rightColumn.style, { display: "flex", flexDirection: "column", justifyContent: "space-between" });
    for (const [leftSlot, rightSlot] of QM_OVERLAY_SLOT_PAIRS) {
      // A pair always shares one group (or neither has one) — see
      // QM_OVERLAY_SLOT_PAIRS's own comment — so checking the left slot
      // alone is enough to decide the whole row.
      if (!QM.state.slotVisible(leftSlot)) continue;
      const leftBox = this._buildOverlaySlotBox(leftSlot);
      const rightBox = this._buildOverlaySlotBox(rightSlot);
      this.equippedSlotBoxRefs.set(leftSlot, { element: leftBox, side: "left" });
      this.equippedSlotBoxRefs.set(rightSlot, { element: rightBox, side: "right" });
      leftColumn.appendChild(leftBox);
      rightColumn.appendChild(rightBox);
    }

    middleRow.append(leftColumn, this.portraitWrapper, rightColumn);
    wrapper.appendChild(middleRow);

    const bottomRow = document.createElement("div");
    Object.assign(bottomRow.style, { display: "flex", gap: "4px", justifyContent: "center", flexWrap: "wrap" });
    for (const slot of QM_OVERLAY_BOTTOM_SLOTS) {
      const box = this._buildOverlaySlotBox(slot);
      this.equippedSlotBoxRefs.set(slot, { element: box, side: "bottom" });
      bottomRow.appendChild(box);
    }
    wrapper.appendChild(bottomRow);

    // Moved here from the Outfits column header (Save) and the Equipped
    // column header (Unequip All) — both act on the current equip state,
    // so both live beside it now instead of split across two different
    // column headers.
    const actionsRow = document.createElement("div");
    Object.assign(actionsRow.style, { display: "flex", gap: "6px", justifyContent: "center", marginTop: "4px" });
    const saveOutfitButton = QM.button("Save Current Outfit", {
      bg: QM_COLOR_SUCCESS,
      fg: QM_COLOR_SUCCESS_FG,
    });
    saveOutfitButton.addEventListener("click", () => this._openSaveOutfitModal());
    const unequipAllButton = QM.button("Unequip All", {
      bg: "var(--secondary, transparent)",
      fg: "var(--secondary-foreground, inherit)",
      border: true,
    });
    unequipAllButton.addEventListener("click", () => QM.state.unequipAll());
    actionsRow.append(saveOutfitButton, unequipAllButton);
    wrapper.appendChild(actionsRow);

    return wrapper;
  },

  // Called (via requestAnimationFrame, so real layout exists) after every
  // _buildEquippedSection() attach, after a Thumbnail Size change, and after
  // the portrait image itself finishes loading (the one case that changes
  // the frame's rendered size without going through a full section
  // rebuild). Fully rebuilds the connector SVG's contents every time rather
  // than trying to incrementally patch it — geometry can change for enough
  // different reasons (selection, equip state, resize, image load) that a
  // full recompute is simpler and cheap enough at this scale (≤16 slots).
  _updateConnectorLines() {
    const svg = this.connectorSvg;
    const frame = this.portraitFrame;
    if (!svg || !frame || !svg.isConnected) return;
    const containerRect = svg.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return;
    svg.setAttribute("width", String(containerRect.width));
    svg.setAttribute("height", String(containerRect.height));
    // Load-bearing, not redundant with the width/height attributes above —
    // confirmed live in _planning/scratch/connector-lines-zoom-test.html:
    // without an explicit viewBox, this svg's internal coordinate mapping
    // becomes unreliable specifically under the dock's own UI Size zoom
    // (S/L, not M) — the width/height attributes alone aren't enough to pin
    // "1 user unit = 1 real pixel" once an ancestor's CSS zoom is anything
    // other than 1. A viewBox matching the same dimensions forces that
    // mapping explicitly, which fixed it at both zoom factors tested.
    svg.setAttribute("viewBox", `0 0 ${containerRect.width} ${containerRect.height}`);
    svg.replaceChildren();

    // Frame edges in container-relative coordinates.
    const frameLeft = frameRect.left - containerRect.left;
    const frameTop = frameRect.top - containerRect.top;
    const frameRight = frameLeft + frameRect.width;
    const frameBottom = frameTop + frameRect.height;

    // Boxes on the same side are distributed across the matching frame edge
    // in the same relative order they appear on screen (top-to-bottom for
    // the side columns, left-to-right for the top/bottom rows) — a fan of
    // distinct connection points, not every line converging on one spot.
    const bySide = { top: [], bottom: [], left: [], right: [] };
    for (const [slot, ref] of this.equippedSlotBoxRefs) {
      if (!ref.element.isConnected) continue;
      bySide[ref.side].push({ slot, rect: ref.element.getBoundingClientRect() });
    }
    bySide.top.sort((a, b) => a.rect.left - b.rect.left);
    bySide.bottom.sort((a, b) => a.rect.left - b.rect.left);
    bySide.left.sort((a, b) => a.rect.top - b.rect.top);
    bySide.right.sort((a, b) => a.rect.top - b.rect.top);

    const qmFrameSpread = (list, from, to) =>
      list.map((entry, index) => from + ((to - from) * (index + 1)) / (list.length + 1));

    const topPoints = qmFrameSpread(bySide.top, frameLeft + 6, frameRight - 6);
    const bottomPoints = qmFrameSpread(bySide.bottom, frameLeft + 6, frameRight - 6);
    const leftPoints = qmFrameSpread(bySide.left, frameTop + 6, frameBottom - 6);
    const rightPoints = qmFrameSpread(bySide.right, frameTop + 6, frameBottom - 6);

    const qmDrawConnector = (slot, side, boxX, boxY, frameX, frameY) => {
      const selected = this.selectedSlot === slot;
      const opacity = selected ? 0.85 : 0.32;
      const midX = (boxX + frameX) / 2;
      const midY = (boxY + frameY) / 2;
      // A gentle bow rather than a straight segment. Fixed axis-aligned
      // offset, not perpendicular-to-this-line's-own-direction (the
      // previous approach) — a per-line perpendicular flips sign between
      // the left and right columns (their dx has opposite sign), which
      // rotates the curve 180° instead of mirroring it: left bowed down,
      // right bowed up, an visibly asymmetric pair rather than a matched
      // one. A fixed bow direction per side-group is trivially mirror-
      // symmetric instead — left/right always bow the same vertical way,
      // top/bottom always bow the same horizontal way.
      const length = Math.hypot(frameX - boxX, frameY - boxY) || 1;
      const bow = Math.min(10, length * 0.12);
      const curveX = side === "top" || side === "bottom" ? midX + bow : midX;
      const curveY = side === "left" || side === "right" ? midY + bow : midY;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${boxX} ${boxY} Q ${curveX} ${curveY} ${frameX} ${frameY}`);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "var(--primary, #7a5cff)");
      path.setAttribute("stroke-width", selected ? "1.6" : "1");
      path.setAttribute("opacity", String(opacity));
      svg.appendChild(path);

      for (const [x, y] of [
        [boxX, boxY],
        [frameX, frameY],
      ]) {
        const node = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        node.setAttribute("cx", String(x));
        node.setAttribute("cy", String(y));
        node.setAttribute("r", selected ? "2.4" : "1.8");
        node.setAttribute("fill", "var(--primary, #7a5cff)");
        node.setAttribute("opacity", String(opacity));
        svg.appendChild(node);
      }
    };

    for (const [slot, ref] of this.equippedSlotBoxRefs) {
      if (!ref.element.isConnected) continue;
      const box = ref.element.getBoundingClientRect();
      const boxX = box.left - containerRect.left + box.width / 2;
      const boxY = box.top - containerRect.top + box.height / 2;
      if (ref.side === "top") {
        const index = bySide.top.findIndex((entry) => entry.slot === slot);
        qmDrawConnector(slot, "top", boxX, box.bottom - containerRect.top, topPoints[index], frameTop);
      } else if (ref.side === "bottom") {
        const index = bySide.bottom.findIndex((entry) => entry.slot === slot);
        qmDrawConnector(slot, "bottom", boxX, box.top - containerRect.top, bottomPoints[index], frameBottom);
      } else if (ref.side === "left") {
        const index = bySide.left.findIndex((entry) => entry.slot === slot);
        qmDrawConnector(slot, "left", box.right - containerRect.left, boxY, frameLeft, leftPoints[index]);
      } else if (ref.side === "right") {
        const index = bySide.right.findIndex((entry) => entry.slot === slot);
        qmDrawConnector(slot, "right", box.left - containerRect.left, boxY, frameRight, rightPoints[index]);
      }
    }
  },

  // One equip-slot overlay box, in one of three visual states: empty
  // (neutral border), equipped (theme-accent border — QM.button()'s own
  // default fill, matching the Equip button beside it), or selected
  // (stronger accent + glow, this.selectedSlot === slot — set by clicking
  // the box body). Selecting reveals the bag picker inline, whether the
  // slot's empty or already occupied (swap, not just fill); an equipped
  // slot always shows a small "×" badge to unequip directly, whether
  // selected or not.
  //
  // The item's own image (same by-name lookup item cards use), or the
  // slot's fallback pictogram, fills the whole imageArea — the slot name
  // and item name/"Empty" are overlay bands top and bottom, each with their
  // OWN small translucent backing (not one dimming layer across the whole
  // box), so the image reads clearly in the gap between the two bands
  // rather than sitting under a single uniform tint. Dark/semi-transparent
  // regardless of the app's own light/dark theme — this sits on top of a
  // photo of unknown brightness, so it needs its own reliable contrast
  // rather than following var(--card)/var(--foreground), the same
  // reasoning a photo-overlay caption uses elsewhere.
  _buildOverlaySlotBox(slot) {
    const equippedItem = QM.state.itemInSlot(slot);
    const selected = this.selectedSlot === slot;

    const box = document.createElement("div");
    Object.assign(box.style, {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      gap: "4px",
      width: "92px",
      borderRadius: "var(--radius, 4px)",
      cursor: "pointer",
      boxSizing: "border-box",
      pointerEvents: "auto",
      color: "#f2f2f2",
      ...(selected
        ? {
            border: "2px solid var(--ring, var(--primary, #444))",
            boxShadow: "0 0 8px color-mix(in srgb, var(--primary, #444) 55%, transparent)",
          }
        : equippedItem
          ? { border: "1px solid var(--primary, #444)" }
          : { border: "1px solid rgba(255, 255, 255, 0.22)" }),
    });
    box.addEventListener("click", (event) => {
      if (event.target.closest("[data-qm-unequip]")) return; // the × badge handles its own click
      const nowSelecting = !selected;
      this.selectedSlot = nowSelecting ? slot : null;
      // Selecting a slot searches the Bag for exactly what could fill it —
      // a real navigational shortcut, not just a visual highlight.
      // Deselecting that same slot (clicking it again) clears that search
      // back out rather than leaving a stale filter the user has to notice
      // and clear by hand — the slot-driven search and the slot's own
      // selected state are meant to track each other.
      if (nowSelecting) {
        this.bagSearchMode = "slot";
        this.bagSearchQuery = QM_SLOT_LABELS[slot];
        // Only a wearable (defaultSlot set) can ever fill a slot, so jump
        // the Bag to that tab too — otherwise the shortcut could land the
        // user on an empty Items/Stored tab even though matches exist.
        this.bagTab = "wearables";
      } else {
        this.bagSearchMode = "name";
        this.bagSearchQuery = "";
      }
      this._paint();
    });

    // Fixed square, clipped to its own rounding — only this element clips
    // (not `box` itself), so the unequip badge below can still hang
    // slightly outside it (negative offset, like before) without being cut
    // off.
    const imageArea = document.createElement("div");
    Object.assign(imageArea.style, {
      position: "relative",
      width: "100%",
      height: "92px",
      overflow: "hidden",
      borderRadius: "var(--radius, 4px)",
      background: "rgba(15, 15, 18, 0.72)",
    });

    // Fills imageArea the same way a real equipped-item photo does (both
    // qmDrawConnector's img and this share the same box), not a small
    // centered icon with margin around it — the bundled slot artwork is a
    // real illustrated image now, not a plain glyph, so it should read the
    // same way a real item photo would rather than looking noticeably
    // smaller/"funkier" next to one. width/height: 100% is load-bearing
    // here, not just objectFit — an absolutely positioned <img> only
    // stretches to fill inset: 0 when its own width/height are explicitly
    // set too (the same replaced-element sizing quirk the connector-line
    // SVG overlay hit earlier).
    const qmCenterFallbackIcon = () => {
      const fallback = QM.buildSlotIconRaster(slot, 92);
      Object.assign(fallback.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        objectFit: "cover",
      });
      // Always the bottom-most layer in imageArea, whether this runs now
      // (empty slot, before the label bands exist yet) or later from the
      // equipped item's <img> error handler below (after the bands are
      // already in the DOM) -- appendChild in that second case would paint
      // the fallback OVER the bands instead of behind them.
      imageArea.prepend(fallback);
    };

    if (equippedItem && QM._missingItemImageIds.has(equippedItem.id)) {
      qmCenterFallbackIcon();
    } else if (equippedItem) {
      // Same by-name image lookup item cards use (QM.itemImageUrl). On a
      // 404 (no matching image, uploaded or pack), falls back to the
      // slot's own plain pictogram rather than leaving the area blank.
      const img = document.createElement("img");
      img.alt = equippedItem.name;
      Object.assign(img.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
      });
      img.addEventListener("error", () => {
        QM._missingItemImageIds.add(equippedItem.id);
        img.remove();
        qmCenterFallbackIcon();
      });
      img.src = QM.itemImageUrl(QM.state.chatId, QM_OWNER_ID, equippedItem.id);
      imageArea.appendChild(img);
    } else {
      qmCenterFallbackIcon();
    }

    // Pre-split into explicit lines (QM_OVERLAY_SLOT_LABEL_LINES), not left
    // to natural wrapping — see that constant's own comment for why: at a
    // fixed box width, different first-word lengths wrapped inconsistently
    // between a pair's two labels, throwing the two columns out of
    // alignment with each other.
    const topBand = document.createElement("div");
    Object.assign(topBand.style, {
      position: "absolute",
      top: "0",
      left: "0",
      right: "0",
      padding: "2px 3px",
      background: "rgba(0, 0, 0, 0.55)",
      textAlign: "center",
    });
    const label = document.createElement("span");
    Object.assign(label.style, {
      display: "block",
      fontSize: "9px",
      textTransform: "uppercase",
      letterSpacing: "0.02em",
      lineHeight: "1.2",
      color: "rgba(255, 255, 255, 0.85)",
    });
    const labelLines = QM_OVERLAY_SLOT_LABEL_LINES[slot];
    labelLines.forEach((line, index) => {
      if (index > 0) label.appendChild(document.createElement("br"));
      label.appendChild(document.createTextNode(line));
    });
    topBand.appendChild(label);
    imageArea.appendChild(topBand);

    const bottomBand = document.createElement("div");
    Object.assign(bottomBand.style, {
      position: "absolute",
      bottom: "0",
      left: "0",
      right: "0",
      padding: "2px 3px",
      background: "rgba(0, 0, 0, 0.55)",
      textAlign: "center",
    });
    const status = document.createElement("span");
    status.textContent = equippedItem ? equippedItem.name : "Empty";
    if (equippedItem) status.title = equippedItem.name;
    Object.assign(status.style, {
      display: "block",
      fontSize: "10px",
      fontWeight: equippedItem ? "600" : "400",
      fontStyle: equippedItem ? "normal" : "italic",
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      color: equippedItem ? "#f2f2f2" : "rgba(255, 255, 255, 0.7)",
    });
    bottomBand.appendChild(status);
    imageArea.appendChild(bottomBand);

    box.appendChild(imageArea);

    if (equippedItem) {
      const unequipButton = document.createElement("button");
      unequipButton.type = "button";
      unequipButton.dataset.qmUnequip = "true";
      unequipButton.textContent = "×";
      const unequipLabel = `Unequip ${QM_OVERLAY_SLOT_LABELS[slot]}`;
      unequipButton.title = unequipLabel;
      unequipButton.setAttribute("aria-label", unequipLabel);
      Object.assign(unequipButton.style, {
        position: "absolute",
        top: "-6px",
        right: "-6px",
        width: "16px",
        height: "16px",
        lineHeight: "14px",
        padding: "0",
        fontSize: "12px",
        borderRadius: "50%",
        cursor: "pointer",
        background: QM_COLOR_DANGER,
        color: QM_COLOR_DANGER_FG,
        border: "none",
      });
      unequipButton.addEventListener("click", () => {
        QM.state.updateItem(equippedItem.id, { location: "bag" });
        if (selected) this.selectedSlot = null;
      });
      box.appendChild(unequipButton);
    }

    if (selected) {
      const bagItems = QM.state.bagItems();
      const select = document.createElement("select");
      select.disabled = bagItems.length === 0;
      select.addEventListener("click", (event) => event.stopPropagation()); // don't toggle selection off under the open dropdown
      Object.assign(select.style, {
        width: "100%",
        marginTop: "2px",
        fontSize: "9px",
        boxSizing: "border-box",
        borderRadius: "3px",
        background: "rgba(255, 255, 255, 0.1)",
        color: "#f2f2f2",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        colorScheme: "dark",
      });
      const placeholderOption = document.createElement("option");
      placeholderOption.value = "";
      placeholderOption.textContent = bagItems.length === 0 ? "(bag empty)" : "Equip…";
      select.appendChild(placeholderOption);
      for (const item of bagItems) {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.name;
        select.appendChild(option);
      }
      select.addEventListener("change", () => {
        const itemId = select.value;
        if (itemId) {
          QM.state.updateItem(itemId, { location: `equipped:${slot}` });
          this.selectedSlot = null;
        }
      });
      box.appendChild(select);
    }

    return box;
  },

  // Name-only, unlike the Bag's name/slot toggle — outfits have no "slot"
  // dimension to search by, so there's nothing for a second mode to filter
  // against.
  _buildOutfitSearchRow() {
    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" });
    const searchInput = QM.smallInput("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search...";
    searchInput.value = this.outfitSearchQuery;
    searchInput.style.flex = "1";
    searchInput.addEventListener("input", () => {
      this.outfitSearchQuery = searchInput.value;
      this.outfitsContainer.replaceChildren(this._buildOutfitsList());
    });
    this.outfitSearchInput = searchInput;

    const buildWardrobeButton = QM.button("Build Wardrobe…", { border: true });
    buildWardrobeButton.addEventListener("click", () => this._openWardrobeBuilder());

    row.append(searchInput, buildWardrobeButton);
    return row;
  },

  _applyOutfitSearch() {
    if (this.outfitSearchInput && this.outfitSearchInput.value !== this.outfitSearchQuery) {
      this.outfitSearchInput.value = this.outfitSearchQuery;
    }
  },

  // Shows whichever of inventoryView/settingsView matches this.activeView
  // and updates the tab buttons' active styling -- called once at initial
  // build and again on every tab click. Both views stay built (not
  // rebuilt/discarded on switch), same reasoning as everywhere else in this
  // file that avoids losing in-progress state (an open equip-slot picker,
  // an unsaved textarea edit) to an unnecessary rebuild.
  _applyActiveView() {
    if (!this.inventoryView || !this.settingsView || !this.viewTabButtons) return;
    this.inventoryView.style.display = this.activeView === "inventory" ? "" : "none";
    this.settingsView.style.display = this.activeView === "settings" ? "" : "none";
    for (const [key, button] of Object.entries(this.viewTabButtons)) {
      const active = key === this.activeView;
      button.style.background = active ? "var(--primary, #444)" : "var(--secondary, transparent)";
      button.style.color = active ? "var(--primary-foreground, #fff)" : "var(--secondary-foreground, inherit)";
      button.style.border = active ? "none" : "1px solid var(--border, rgba(0,0,0,0.2))";
    }
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

    const query = this.outfitSearchQuery.trim().toLowerCase();
    let outfits = QM.state.sortedOutfits();
    if (query) outfits = outfits.filter((outfit) => outfit.name.toLowerCase().includes(query));
    if (outfits.length === 0) {
      const empty = QM.textNode(query ? "No matching outfits." : "No saved outfits yet.");
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

  // A small clickable thumbnail (or a dashed placeholder when unset) that
  // opens the Generate/Upload choice modal for this outfit's portrait, plus
  // a "×" to remove it. Compression happens client-side (QM.compressImageFile)
  // before the upload call — the server only validates size/type, it never
  // resizes. The hidden fileInput below is reused as-is by the modal's own
  // "Upload" choice (12-image-gen.js) — this control's own upload logic is
  // untouched either way.
  // sizePx follows QM_THUMBNAIL_SIZES[this.thumbnailSize] — same S/M/L
  // control that sizes item-card placeholders, so the two stay visually
  // consistent with each other.
  _buildOutfitPortraitControl(outfit, sizePx) {
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, {
      position: "relative",
      flexShrink: "0",
      width: `${sizePx}px`,
      height: `${sizePx}px`,
    });

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/png,image/jpeg,image/webp";
    fileInput.style.display = "none";
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      try {
        const dataUrl = await QM.compressImageFile(file);
        await QM.state.uploadOutfitPortrait(outfit.id, dataUrl);
      } catch (error) {
        QM.state.error = error && error.message ? error.message : String(error);
        QM.state._notify();
      }
    });

    const thumbButton = document.createElement("button");
    thumbButton.type = "button";
    thumbButton.title = outfit.portraitFile ? "Replace portrait" : "Add portrait";
    Object.assign(thumbButton.style, {
      width: `${sizePx}px`,
      height: `${sizePx}px`,
      padding: "0",
      cursor: "pointer",
      borderRadius: "var(--radius, 4px)",
      overflow: "hidden",
      background: "var(--muted, rgba(128,128,128,0.15))",
      border: outfit.portraitFile
        ? "1px solid var(--border, rgba(128,128,128,0.3))"
        : "1px dashed var(--border, rgba(128,128,128,0.4))",
    });
    thumbButton.addEventListener("click", () =>
      this._openImageGenModal({ kind: "outfit", subjectId: outfit.id, fileInput }),
    );

    if (outfit.portraitFile) {
      const thumb = document.createElement("img");
      thumb.alt = `${outfit.name} portrait`;
      thumb.src = QM.outfitPortraitUrl(QM.state.chatId, QM_OWNER_ID, outfit.id);
      Object.assign(thumb.style, { width: "100%", height: "100%", objectFit: "cover", display: "block" });
      thumbButton.appendChild(thumb);
    } else {
      thumbButton.textContent = "+";
      Object.assign(thumbButton.style, {
        fontSize: `${Math.round(sizePx * 0.4)}px`,
        lineHeight: "1",
        color: "var(--muted-foreground, currentcolor)",
      });
    }

    wrapper.append(thumbButton, fileInput);

    if (outfit.portraitFile) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.title = "Remove portrait";
      removeButton.textContent = "×";
      Object.assign(removeButton.style, {
        position: "absolute",
        top: "-6px",
        right: "-6px",
        width: "14px",
        height: "14px",
        lineHeight: "12px",
        padding: "0",
        fontSize: "11px",
        borderRadius: "50%",
        cursor: "pointer",
        background: QM_COLOR_DANGER,
        color: QM_COLOR_DANGER_FG,
        border: "none",
      });
      removeButton.addEventListener("click", () => {
        if (window.confirm("Remove this outfit's portrait? This can't be undone.")) {
          QM.state.deleteOutfitPortrait(outfit.id);
        }
      });
      wrapper.appendChild(removeButton);
    }

    return wrapper;
  },

  // Unlike outfit portraits, an item's image isn't a stored reference —
  // it's resolved server-side by name (findItemImageFile, matching an
  // uploaded file or a hand-placed image-pack file the same way — see
  // server.mjs's own comment). So the client doesn't know in advance
  // whether one exists; it just tries the URL and falls back to the dashed
  // placeholder on a 404 via onerror/onload, rather than checking a flag.
  // Clicking the thumbnail opens the Generate/Upload choice modal
  // (12-image-gen.js); the hidden fileInput below is reused as-is by its own
  // "Upload" choice, this control's own upload logic is untouched either way.
  _buildItemImageControl(item, sizePx) {
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, {
      position: "relative",
      flexShrink: "0",
      width: `${sizePx}px`,
      height: `${sizePx}px`,
    });

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/png,image/jpeg,image/webp";
    fileInput.style.display = "none";
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      try {
        const dataUrl = await QM.compressImageFile(file);
        await QM.state.uploadItemImage(item.id, dataUrl);
      } catch (error) {
        QM.state.error = error && error.message ? error.message : String(error);
        QM.state._notify();
      }
    });

    const thumbButton = document.createElement("button");
    thumbButton.type = "button";
    thumbButton.title = "Add or replace image";
    Object.assign(thumbButton.style, {
      width: `${sizePx}px`,
      height: `${sizePx}px`,
      padding: "0",
      cursor: "pointer",
      borderRadius: "var(--radius, 4px)",
      overflow: "hidden",
      background: "var(--muted, rgba(128,128,128,0.15))",
      border: "1px dashed var(--border, rgba(128,128,128,0.4))",
    });
    thumbButton.addEventListener("click", () =>
      this._openImageGenModal({ kind: "item", subjectId: item.id, fileInput }),
    );

    const placeholderMark = document.createElement("span");
    placeholderMark.textContent = "+";
    Object.assign(placeholderMark.style, {
      fontSize: `${Math.round(sizePx * 0.4)}px`,
      lineHeight: "1",
      color: "var(--muted-foreground, currentcolor)",
    });
    thumbButton.appendChild(placeholderMark);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.title = "Remove uploaded image (a matching image-pack file, if any, would still show)";
    removeButton.textContent = "×";
    Object.assign(removeButton.style, {
      position: "absolute",
      top: "-6px",
      right: "-6px",
      width: "14px",
      height: "14px",
      lineHeight: "12px",
      padding: "0",
      fontSize: "11px",
      borderRadius: "50%",
      cursor: "pointer",
      background: QM_COLOR_DANGER,
      color: QM_COLOR_DANGER_FG,
      border: "none",
      display: "none",
    });
    removeButton.addEventListener("click", () => {
      if (window.confirm(`Remove ${item.name}'s image? This can't be undone.`)) {
        QM.state.deleteItemImage(item.id);
      }
    });

    // No matching image (uploaded or pack) — fall back to that item's own
    // default-slot icon rather than the bare "+" mark, same artwork the
    // equip-slot boxes use. An item with no default slot set keeps the
    // plain "+" on purpose: it's a real, useful visual cue while scrolling
    // the bag that this item still needs one set. Full sizePx, not a
    // fraction of it — this is real illustrated artwork now, not a plain
    // glyph, so it should fill thumbButton the same way an actual item
    // photo does (the sibling `img` below, same width/height/objectFit)
    // instead of sitting small in the middle of it.
    const applyMissingImageFallback = () => {
      if (item.defaultSlot) {
        placeholderMark.style.display = "none";
        const fallback = QM.buildSlotIconRaster(item.defaultSlot, sizePx);
        Object.assign(fallback.style, { width: "100%", height: "100%", objectFit: "cover" });
        thumbButton.appendChild(fallback);
      }
    };

    if (QM._missingItemImageIds.has(item.id)) {
      // Already confirmed missing this session — skip the doomed request
      // (and its console 404) entirely rather than re-fetching on every
      // rebuild of this row (thumbnail size changes, list re-renders, etc).
      applyMissingImageFallback();
    } else {
      const img = document.createElement("img");
      img.alt = `${item.name} image`;
      // No loading="lazy": this element starts (and often stays, on a
      // no-match) display:none, which has no layout box — a lazy image can
      // never be "near the viewport" with no box at all, so the browser may
      // never actually fetch it, leaving the placeholder showing forever even
      // when a real match exists on disk. Fetch eagerly instead; the item
      // list is never long enough for that to matter.
      Object.assign(img.style, { width: "100%", height: "100%", objectFit: "cover", display: "none" });
      img.addEventListener("load", () => {
        placeholderMark.style.display = "none";
        thumbButton.style.border = "1px solid var(--border, rgba(128,128,128,0.3))";
        img.style.display = "block";
        removeButton.style.display = "block";
      });
      img.addEventListener("error", () => {
        QM._missingItemImageIds.add(item.id);
        img.remove();
        applyMissingImageFallback();
      });
      img.src = QM.itemImageUrl(QM.state.chatId, QM_OWNER_ID, item.id);
      thumbButton.appendChild(img);
    }

    wrapper.append(thumbButton, fileInput, removeButton);
    return wrapper;
  },

  // Read-only display card, same rhythm as the item card: full-height
  // portrait on the left, everything else stacked to the right. No slot/
  // stored-at line here — outfits don't have either — so the description
  // gets the extra room instead, scrollable rather than a single clamped
  // preview, so a long description is still fully readable without opening
  // the editor. Name/description editing and the portrait upload moved into
  // _openOutfitEditor's modal, opened via [Edit]; "Update" (resnapshotting
  // from whatever's currently equipped) sits directly on the card between
  // Edit and Equip instead, since it acts on live equip state rather than
  // editing a stored field. Delete stays directly on the card like it does
  // on an item card. The currently-equipped outfit
  // (QM.state.outfitMatchesCurrent) gets a success-colored border/glow
  // instead of the theme accent, echoing the Add Item form's own "borrow a
  // semantic color instead of a new shape" approach to standing out from
  // its neighbors.
  _buildOutfitRow(outfit) {
    const equipped = QM.state.outfitMatchesCurrent(outfit);
    const thumbnailPx = QM_THUMBNAIL_SIZES[this.thumbnailSize];
    const row = document.createElement("li");
    Object.assign(row.style, {
      display: "flex",
      gap: "8px",
      alignItems: "stretch",
      position: "relative",
      ...QM_ITEM_CARD_FRAME_STYLE,
      ...(equipped
        ? {
            border: `2px solid ${QM_COLOR_SUCCESS}`,
            boxShadow: `0 0 8px color-mix(in srgb, ${QM_COLOR_SUCCESS} 45%, transparent)`,
          }
        : {}),
    });
    for (const corner of ["top left", "top right", "bottom left", "bottom right"]) {
      row.appendChild(qmBuildCardCornerDot(corner));
    }

    const portraitControl = this._buildOutfitPortraitControl(outfit, thumbnailPx);

    const detailsColumn = document.createElement("div");
    Object.assign(detailsColumn.style, {
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      gap: "4px",
      flex: "1",
      minWidth: "0",
    });

    const nameLine = document.createElement("div");
    Object.assign(nameLine.style, { display: "flex", alignItems: "center", gap: "6px" });
    const nameLabel = document.createElement("span");
    nameLabel.textContent = outfit.name;
    Object.assign(nameLabel.style, {
      flex: "1",
      minWidth: "0",
      fontWeight: "600",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });
    nameLine.appendChild(nameLabel);
    if (equipped) {
      const badge = document.createElement("span");
      badge.textContent = "Equipped";
      Object.assign(badge.style, {
        fontSize: "10px",
        fontWeight: "600",
        color: QM_COLOR_SUCCESS,
        textTransform: "uppercase",
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      });
      nameLine.appendChild(badge);
    }

    // [Name] [Equipped?] [⋯] [Equip] -- Edit/Update/Delete collapsed into
    // the overflow menu, Equip promoted up here so the description below
    // (no more actionColumn beside it) gets the full card width.
    const overflowMenu = this._buildCardOverflowMenu([
      { label: "Edit", onClick: () => this._openOutfitEditor(outfit) },
      {
        label: "Update",
        onClick: () => QM.state.updateOutfit(outfit.id, { resnapshot: true }),
      },
      {
        label: "Delete",
        danger: true,
        onClick: () => {
          if (window.confirm(`Delete "${outfit.name}"? This can't be undone.`)) QM.state.deleteOutfit(outfit.id);
        },
      },
    ]);
    nameLine.appendChild(overflowMenu);
    const equipButton = QM.button("Equip");
    equipButton.disabled = equipped;
    equipButton.style.opacity = equipped ? "0.5" : "1";
    equipButton.addEventListener("click", () => QM.state.equipOutfit(outfit.id));
    nameLine.appendChild(equipButton);

    const descriptionRow = document.createElement("div");
    descriptionRow.className = "qm-card-desc-row";
    const descriptionPreview = document.createElement("span");
    descriptionPreview.className = "qm-desc-scroll";
    descriptionPreview.textContent = outfit.description || "No description";
    Object.assign(descriptionPreview.style, {
      display: "block",
      fontSize: "11px",
      lineHeight: `${QM_DESC_LINE_HEIGHT_PX}px`,
      maxHeight: `${QM_CARD_DESC_MAX_HEIGHT_PX}px`,
      overflowY: "auto",
      whiteSpace: "normal",
      wordBreak: "break-word",
      color: "var(--muted-foreground, currentcolor)",
      fontStyle: outfit.description ? "normal" : "italic",
    });
    descriptionRow.appendChild(descriptionPreview);

    detailsColumn.append(nameLine, descriptionRow);
    row.append(portraitControl, detailsColumn);
    return row;
  },

  // Lives inside the Add Item modal (_openAddItemModal) now, not inline in
  // the Bag column — the modal's own panel already carries the success-
  // colored frame (matching _openSaveOutfitModal's), so this form doesn't
  // need QM_ADD_ITEM_FRAME_STYLE of its own any more. No image control —
  // there's no item id yet to attach an uploaded image to until after
  // creation. `onAdded` fires after a successful add, once fields are
  // reset — the modal uses it to close itself.
  _buildAddItemForm(onAdded) {
    const form = document.createElement("form");
    Object.assign(form.style, {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    });

    const nameLine = document.createElement("div");
    Object.assign(nameLine.style, { display: "flex", gap: "6px" });

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

    nameLine.append(nameInput, quantityInput);

    const slotLine = document.createElement("div");
    Object.assign(slotLine.style, { display: "flex", alignItems: "center", gap: "6px" });

    // Not QM.defaultSlotSelect — that helper writes straight to
    // QM.state.updateItem(item.id, ...) on change, but this item doesn't
    // exist yet. Same population rule (hidden-group slots dropped), read
    // once at submit time instead.
    const slotSelect = QM.smallInput("select");
    slotSelect.style.flex = "1";
    const noneOption = document.createElement("option");
    noneOption.value = "";
    noneOption.textContent = "Select Default Slot";
    slotSelect.appendChild(noneOption);
    for (const slot of QM_EQUIP_SLOTS) {
      if (!QM.state.slotVisible(slot)) continue;
      const option = document.createElement("option");
      option.value = slot;
      option.textContent = QM_SLOT_LABELS[slot];
      slotSelect.appendChild(option);
    }

    const storedLabel = document.createElement("span");
    storedLabel.textContent = "Stored at:";
    Object.assign(storedLabel.style, {
      fontSize: "11px",
      color: "var(--muted-foreground, currentcolor)",
      whiteSpace: "nowrap",
    });
    const storedInput = QM.smallInput("input");
    storedInput.type = "text";
    storedInput.placeholder = "bag";
    storedInput.style.flex = "1";

    slotLine.append(slotSelect, storedLabel, storedInput);

    const descriptionInput = QM.smallInput("input");
    descriptionInput.type = "text";
    descriptionInput.placeholder = "Description (optional)";
    descriptionInput.style.width = "100%";
    descriptionInput.style.boxSizing = "border-box";

    // Footer lives inside the <form> (so Enter in a text field and clicking
    // "Add Item" both submit the same way) but is visually its own row —
    // Cancel is a plain type="button" so it can never accidentally submit.
    const footer = document.createElement("div");
    Object.assign(footer.style, { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" });
    const cancelButton = QM.button("Cancel", { border: true, bg: "transparent", fg: "inherit" });
    cancelButton.type = "button";
    cancelButton.addEventListener("click", () => this._closeAddItemModal());
    const addButton = QM.button("Add Item", { bg: QM_COLOR_SUCCESS, fg: QM_COLOR_SUCCESS_FG });
    addButton.type = "submit";
    footer.append(cancelButton, addButton);

    form.append(nameLine, slotLine, descriptionInput, footer);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      if (!name) return;
      addButton.disabled = true;
      const stored = storedInput.value.trim();
      await QM.state.addItem({
        name,
        quantity: quantityInput.value,
        description: descriptionInput.value,
        defaultSlot: slotSelect.value || null,
        location: stored ? `stored:${stored}` : "bag",
      });
      addButton.disabled = false;
      nameInput.value = "";
      quantityInput.value = "1";
      descriptionInput.value = "";
      slotSelect.value = "";
      storedInput.value = "";
      onAdded?.();
    });

    return form;
  },

  // Sits between the Add Item form and the item list, so it visually
  // separates the two the way the request asked. Name/Slot is a toggle
  // (mutually exclusive, like Thumbnail Size's S/M/L group), not a
  // checkbox — a search only ever matches one field at a time. Clicking an
  // equip slot box (_buildOverlaySlotBox) sets bagSearchMode to "slot" and
  // the query to that slot's own label, so the Bag immediately shows
  // exactly what could fill it — _applyBagSearch (called every _paint, not
  // just here) is what keeps this row's own DOM in sync with that, since
  // the row itself is built once and cached like the Thumbnail Size row is.
  // Three-way split of the Bag list, checked every paint via
  // _applyBagTabs (called from _applyBagSearch's own call sites, since the
  // two rows always need to redraw together) so the active tab's styling
  // and the item counts beside each label stay live.
  _buildBagTabRow() {
    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", gap: "4px", marginBottom: "8px" });

    this.bagTabButtons = {};
    for (const { key, label } of QM_BAG_TABS) {
      const button = QM.button(label);
      Object.assign(button.style, { flex: "1", padding: "2px 6px", fontSize: "11px" });
      button.addEventListener("click", () => {
        if (this.bagTab === key) return;
        this.bagTab = key;
        this._applyBagTabs();
        this.listContainer.replaceChildren(this._buildItemList());
      });
      this.bagTabButtons[key] = button;
      row.appendChild(button);
    }
    this._applyBagTabs();
    return row;
  },

  _applyBagTabs() {
    if (!this.bagTabButtons) return;
    const items = QM.state.bagItems();
    for (const { key, label } of QM_BAG_TABS) {
      const button = this.bagTabButtons[key];
      if (!button) continue;
      const count = items.filter((item) => qmItemMatchesBagTab(item, key)).length;
      button.textContent = `${label} (${count})`;
      const active = this.bagTab === key;
      button.style.background = active ? "var(--primary, #444)" : "var(--secondary, transparent)";
      button.style.color = active ? "var(--primary-foreground, #fff)" : "var(--secondary-foreground, inherit)";
      button.style.border = active ? "none" : "1px solid var(--border, rgba(0,0,0,0.2))";
    }
  },

  _buildBagSearchRow() {
    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" });

    const searchInput = QM.smallInput("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search...";
    searchInput.value = this.bagSearchQuery;
    searchInput.style.flex = "1";
    searchInput.addEventListener("input", () => {
      this.bagSearchQuery = searchInput.value;
      this.listContainer.replaceChildren(this._buildItemList());
    });
    this.bagSearchInput = searchInput;
    row.appendChild(searchInput);

    this.bagSearchModeButtons = {};
    for (const mode of ["name", "slot"]) {
      const button = QM.button(mode === "name" ? "Name" : "Slot");
      button.style.padding = "2px 10px";
      button.addEventListener("click", () => {
        if (this.bagSearchMode === mode) return;
        this.bagSearchMode = mode;
        this._applyBagSearch();
        this.listContainer.replaceChildren(this._buildItemList());
      });
      this.bagSearchModeButtons[mode] = button;
      row.appendChild(button);
    }

    const addItemButton = QM.button("+ Add Item", { bg: QM_COLOR_SUCCESS, fg: QM_COLOR_SUCCESS_FG });
    addItemButton.addEventListener("click", () => this._openAddItemModal());
    row.appendChild(addItemButton);

    this._applyBagSearch();
    return row;
  },

  _applyBagSearch() {
    if (this.bagSearchInput && this.bagSearchInput.value !== this.bagSearchQuery) {
      this.bagSearchInput.value = this.bagSearchQuery;
    }
    for (const [mode, button] of Object.entries(this.bagSearchModeButtons || {})) {
      const active = mode === this.bagSearchMode;
      button.style.background = active ? "var(--primary, #444)" : "var(--secondary, transparent)";
      button.style.color = active ? "var(--primary-foreground, #fff)" : "var(--secondary-foreground, inherit)";
      button.style.border = active ? "none" : "1px solid var(--border, rgba(0,0,0,0.2))";
    }
  },

  // A bordered, clickable header (replacing the old plain QM.sectionHeading
  // for these three columns specifically) that both shows a live count and
  // toggles that column's body collapsed/expanded — the two things the
  // request asked for landed on the same element rather than two separate
  // ones, since a header that already has to repaint its count every frame
  // is the natural place to also reflect collapsed state. `bodyEl` is
  // whatever sits below the header for that column; hiding/showing it is
  // the entire collapse mechanism, no separate wrapper needed.
  _buildSectionHeader(columnKey, baseLabel, bodyEl, columnEl) {
    this.sectionBodies = this.sectionBodies || {};
    this.sectionBodies[columnKey] = bodyEl;

    const header = document.createElement("button");
    header.type = "button";
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      width: "100%",
      padding: "6px 8px",
      marginBottom: "6px",
      boxSizing: "border-box",
      border: "1px solid var(--primary, #444)",
      borderRadius: "var(--radius, 4px)",
      background: "color-mix(in srgb, var(--primary, #444) 12%, transparent)",
      color: "inherit",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    });
    const text = document.createElement("span");
    const chevron = document.createElement("span");
    chevron.setAttribute("aria-hidden", "true");
    header.append(text, chevron);
    header.addEventListener("click", () => this._toggleColumnCollapsed(columnKey));

    this.sectionHeaders = this.sectionHeaders || {};
    this.sectionHeaders[columnKey] = { baseLabel, textEl: text, chevronEl: chevron, headerEl: header, columnEl };
    return header;
  },

  // Collapsing a column shrinks the dock's own window width by exactly what
  // that column used to occupy, instead of leaving the window alone and
  // letting the other columns' flex stretch to absorb the reclaimed space
  // -- per explicit feedback, the point is a narrower UI, not a wider
  // Equipped column. Measuring the column's actual rendered width (rather
  // than computing a share of the flex ratios) keeps this correct
  // regardless of the window's current size or zoom factor; the exact
  // pixel amount removed on collapse is stored so expanding hands back
  // precisely that much rather than guessing.
  //
  // Whether to shrink the window at all is decided from the width the dock
  // would have AFTER that shrink, not its current pre-collapse width --
  // otherwise a collapse that (once the shrink actually lands) still needs
  // stacked/mobile-style layout would pointlessly shrink the window for a
  // column that, in stacked mode, doesn't need its width reclaimed at all
  // (a collapsed column there just hides its content at full width). This
  // same prediction also naturally covers "already stacked before this
  // click": a column's rendered width IS the full body width in stacked
  // layout, so subtracting it back out always lands far below the stack
  // threshold, correctly skipping the resize without a separate check.
  //
  // this.bodyWidth is otherwise only updated later by the async
  // ResizeObserver (observeBodyWidth), once the browser actually reflows
  // after resizeBy changes the window's geometry -- updating it here too
  // (by whatever resizeBy actually applied, which can be less than
  // requested if window-size clamping kicked in) keeps the very next
  // _applySectionHeaders call, a few lines down, already consistent with
  // reality instead of quietly relying on a stale width until the real
  // observer catches up moments later.
  //
  // Expanding always hands back whatever was taken regardless of the
  // resulting stacked state -- otherwise, if some OTHER column's collapse
  // had already pushed the layout into stacked mode, this column's own
  // expand would silently skip restoring its share of the window width,
  // leaving the dock stuck narrow even after every column shows itself
  // expanded again.
  _toggleColumnCollapsed(columnKey) {
    const collapsing = !this.columnCollapsed[columnKey];
    const refs = this.sectionHeaders && this.sectionHeaders[columnKey];
    this.columnCollapsed[columnKey] = collapsing;
    if (collapsing) {
      const measured = refs && refs.columnEl ? refs.columnEl.getBoundingClientRect().width : 0;
      const delta = Math.max(0, measured - QM_COLUMN_COLLAPSED_WIDTH);
      const stackedAfterShrink = this.bodyWidth - delta < this._columnsStackThreshold() * this._zoomFactor();
      if (refs && refs.columnEl && !stackedAfterShrink) {
        this.columnCollapseDelta[columnKey] = delta;
        const widthBefore = this.geometry?.width;
        this.resizeBy(-delta, 0);
        const applied = widthBefore != null && this.geometry ? widthBefore - this.geometry.width : delta;
        this.bodyWidth = Math.max(0, this.bodyWidth - applied);
      } else {
        this.columnCollapseDelta[columnKey] = 0;
      }
    } else {
      const delta = this.columnCollapseDelta[columnKey] || 0;
      this.columnCollapseDelta[columnKey] = 0;
      if (refs && refs.columnEl && delta > 0) {
        const widthBefore = this.geometry?.width;
        this.resizeBy(delta, 0);
        const applied = widthBefore != null && this.geometry ? this.geometry.width - widthBefore : delta;
        this.bodyWidth += applied;
      }
    }
    qmWriteColumnCollapsed(this.columnCollapsed);
    this._applySectionHeaders();
  },

  // Called once at mount, again on every _paint (counts change on essentially
  // every state mutation), and again whenever the body width changes
  // (_applyResponsiveLayout) or a column's collapse state flips
  // (_toggleColumnCollapsed). Also owns the row/stacked flexDirection call
  // for the whole columns container -- previously _applyResponsiveLayout
  // decided that on its own with a flat threshold while this function
  // separately decided each column's own narrow-strip styling with the same
  // flat threshold; consolidating into one place means there's exactly one
  // definition of "stacked" (the collapse-aware one in _isColumnsStacked)
  // instead of two that could disagree. Collapsing narrows the actual
  // COLUMN width — not just hiding its content inside a column that stays
  // full width — so the dock's own window shrinks to match (see
  // _toggleColumnCollapsed), matching a real sidebar-collapse rather than a
  // cosmetic content toggle. That narrow-strip + sideways-label treatment
  // only makes sense in the side-by-side (row) layout; when the dock is
  // narrow enough to stack the columns (column layout), there's no
  // horizontal neighbor to hand the space to, so a collapsed column there
  // just hides its content at full width instead.
  _applySectionHeaders() {
    const stacked = this._isColumnsStacked();
    if (this.columns) this.columns.style.flexDirection = stacked ? "column" : "row";
    for (const key of QM_COLUMN_KEYS) {
      const refs = this.sectionHeaders && this.sectionHeaders[key];
      const body = this.sectionBodies && this.sectionBodies[key];
      const collapsed = Boolean(this.columnCollapsed[key]);
      const narrow = collapsed && !stacked;
      if (body) body.style.display = collapsed ? "none" : "";
      if (!refs) continue;
      const count =
        key === "outfits" ? QM.state.sortedOutfits().length : key === "bag" ? QM.state.bagItems().length : null;
      refs.textEl.textContent = count === null ? refs.baseLabel : `${refs.baseLabel} (${count})`;
      refs.chevronEl.textContent = collapsed ? "▸" : "▾";
      if (refs.columnEl) {
        Object.assign(
          refs.columnEl.style,
          narrow
            ? { flex: `0 0 ${QM_COLUMN_COLLAPSED_WIDTH}px`, width: `${QM_COLUMN_COLLAPSED_WIDTH}px` }
            : { flex: QM_COLUMN_EXPANDED_FLEX[key], width: "100%" },
        );
      }
      if (refs.headerEl) {
        Object.assign(
          refs.headerEl.style,
          narrow
            ? { flexDirection: "column", height: "200px", padding: "8px 4px" }
            : { flexDirection: "row", height: "auto", padding: "6px 8px" },
        );
      }
      Object.assign(
        refs.textEl.style,
        narrow ? { writingMode: "vertical-rl", textOrientation: "mixed" } : { writingMode: "horizontal-tb" },
      );
    }
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

    const query = this.bagSearchQuery.trim().toLowerCase();
    // A slot-driven search (the equip-slot quick-fill shortcut) means "what
    // could fill this slot" -- that has to reach every wearable regardless
    // of tab, including ones currently stashed, or a stashed item becomes
    // impossible to equip via this picker at all. Bypass the tab split for
    // it; an ordinary name search still respects whichever tab is active.
    const slotSearchActive = this.bagSearchMode === "slot" && query;
    let items = slotSearchActive
      ? QM.state.bagItems()
      : QM.state.bagItems().filter((item) => qmItemMatchesBagTab(item, this.bagTab));
    if (query) {
      items = items.filter((item) => {
        if (this.bagSearchMode === "slot") {
          const label = item.defaultSlot ? QM_SLOT_LABELS[item.defaultSlot].toLowerCase() : "";
          return label.includes(query);
        }
        return item.name.toLowerCase().includes(query);
      });
    }
    if (items.length === 0) {
      const emptyLabel =
        this.bagTab === "wearables" ? "No wearables." : this.bagTab === "stored" ? "Nothing stored." : "No items.";
      const empty = QM.textNode(query ? "No matching items." : emptyLabel);
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

  // Read-only display card — name/slot/description/stored-at are no longer
  // inline-editable here (see _openItemEditor's own comment for where that
  // moved). Only quantity stays directly on the card, per the request: it's
  // the one field someone adjusts constantly during play (used a charge,
  // picked up another), while the rest are set-once-and-rarely-touched.
  // Layout: [name ... qty] [⋯] [Equip] / slot+stored (only when either
  // carries real info, see below) / description, full width.
  _buildItemRow(item) {
    const thumbnailPx = QM_THUMBNAIL_SIZES[this.thumbnailSize];
    const row = document.createElement("li");
    Object.assign(row.style, {
      display: "flex",
      gap: "8px",
      alignItems: "stretch",
      position: "relative",
      ...QM_ITEM_CARD_FRAME_STYLE,
    });
    for (const corner of ["top left", "top right", "bottom left", "bottom right"]) {
      row.appendChild(qmBuildCardCornerDot(corner));
    }

    const imageControl = this._buildItemImageControl(item, thumbnailPx);

    const detailsColumn = document.createElement("div");
    Object.assign(detailsColumn.style, {
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      gap: "4px",
      flex: "1",
      minWidth: "0",
    });

    const nameLine = document.createElement("div");
    Object.assign(nameLine.style, { display: "flex", alignItems: "center", gap: "6px" });
    const nameLabel = document.createElement("span");
    nameLabel.textContent = item.name;
    Object.assign(nameLabel.style, {
      flex: "1",
      minWidth: "0",
      fontWeight: "600",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });

    // Same up/down adjustment as before (a plain number input's native
    // spinner) — the one field that stays directly editable on the card.
    const quantityInput = QM.smallInput("input");
    quantityInput.type = "number";
    // 0 is a legitimate quantity now ("used up but still tracked" — the same
    // rule the tracker agent follows), so this no longer floors at 1 the way
    // a brand-new item's starting quantity still does.
    quantityInput.min = "0";
    quantityInput.value = String(item.quantity);
    // Matches the "⋯" button's own width beside it -- it'll rarely hold a
    // number wide enough to need more room than that.
    quantityInput.style.width = "32px";
    quantityInput.addEventListener("change", () => QM.state.updateItem(item.id, { quantity: quantityInput.value }));

    // Favorited items sort to the top of the Bag (QM.state.bagItems' own
    // sort) -- this is just the toggle. Outline vs filled star, same "⋯"
    // icon-button idiom used elsewhere on the card.
    const favoriteButton = QM.button(item.favorite ? "★" : "☆", {
      bg: "transparent",
      fg: item.favorite ? "#eab308" : "inherit",
    });
    Object.assign(favoriteButton.style, { width: "20px", padding: "0", flexShrink: "0", fontSize: "14px" });
    favoriteButton.title = item.favorite ? "Remove from favorites" : "Add to favorites";
    favoriteButton.addEventListener("click", () => QM.state.updateItem(item.id, { favorite: !item.favorite }));

    nameLine.append(favoriteButton, nameLabel, quantityInput);

    // [⋯] [Equip] -- Edit/Delete collapsed into the overflow menu, Equip
    // promoted up here so the description below (no more actionColumn
    // beside it) gets the full card width.
    const overflowMenu = this._buildCardOverflowMenu([
      { label: "Edit", onClick: () => this._openItemEditor(item) },
      {
        label: "Delete",
        danger: true,
        onClick: () => {
          if (window.confirm(`Delete "${item.name}"? This can't be undone.`)) QM.state.deleteItem(item.id);
        },
      },
    ]);
    nameLine.appendChild(overflowMenu);
    const equipButton = QM.button("Equip");
    // A stored defaultSlot can still point at a slot whose group has since
    // been hidden (the editor's slot picker just won't offer it as an
    // option anymore) — block the shortcut button too, or it'd be the one
    // way left to equip into a slot a toggle is supposed to disable.
    const canEquip = Boolean(item.defaultSlot) && QM.state.slotVisible(item.defaultSlot);
    equipButton.disabled = !canEquip;
    equipButton.style.opacity = canEquip ? "1" : "0.5";
    equipButton.addEventListener("click", () => {
      if (canEquip) QM.state.updateItem(item.id, { location: `equipped:${item.defaultSlot}` });
    });
    nameLine.appendChild(equipButton);

    // Slot/stored-at info only takes a row at all when it actually carries
    // information -- "Default Slot" (no slot set) and "Stored at: Bag"
    // (plain bag, not a named stash) are both the common case and pure
    // noise, so that row is entirely omitted for them; detailsColumn's
    // justify-content:space-between then hands the reclaimed height to the
    // description below instead.
    const detailRows = [nameLine];
    const storedText = item.location.startsWith("stored:") ? item.location.slice("stored:".length) : null;
    if (item.defaultSlot || storedText) {
      const slotLine = document.createElement("div");
      Object.assign(slotLine.style, { display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" });
      if (item.defaultSlot) {
        const slotLabel = document.createElement("span");
        slotLabel.textContent = QM_SLOT_LABELS[item.defaultSlot];
        Object.assign(slotLabel.style, {
          flex: "1",
          minWidth: "0",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        });
        slotLine.appendChild(slotLabel);
      }
      if (storedText) {
        const storedLabel = document.createElement("span");
        storedLabel.textContent = `Stored at: ${storedText}`;
        Object.assign(storedLabel.style, { color: "var(--muted-foreground, currentcolor)", whiteSpace: "nowrap" });
        slotLine.appendChild(storedLabel);
      }
      detailRows.push(slotLine);
    }

    const descriptionLine = document.createElement("div");
    descriptionLine.className = "qm-card-desc-row";
    const descriptionPreview = document.createElement("span");
    descriptionPreview.className = "qm-desc-scroll";
    descriptionPreview.textContent = item.description || "No description";
    Object.assign(descriptionPreview.style, {
      display: "block",
      fontSize: "11px",
      lineHeight: `${QM_DESC_LINE_HEIGHT_PX}px`,
      maxHeight: `${QM_CARD_DESC_MAX_HEIGHT_PX}px`,
      overflowY: "auto",
      whiteSpace: "normal",
      wordBreak: "break-word",
      color: "var(--muted-foreground, currentcolor)",
      fontStyle: item.description ? "normal" : "italic",
    });
    descriptionLine.appendChild(descriptionPreview);
    detailRows.push(descriptionLine);

    detailsColumn.append(...detailRows);
    row.append(imageControl, detailsColumn);
    return row;
  },

  // Shared by all three modals below (item editor, outfit editor,
  // save-outfit) so Escape closes whichever one is open, matching the
  // backdrop-click-to-close affordance they already had. Listens on
  // `document` rather than the backdrop itself since the backdrop is never
  // focused (only its children are interactive) — a `keydown` on the
  // backdrop element would never fire. Each open function stores the
  // returned handler under its own property and the matching close function
  // removes that exact listener, so closing one modal never accidentally
  // strips Escape handling from a different one that might still be open.
  _bindEscapeClose(closeFn) {
    const handler = (event) => {
      if (event.key === "Escape") closeFn();
    };
    document.addEventListener("keydown", handler);
    return handler;
  },

  _unbindEscapeClose(handler) {
    if (handler) document.removeEventListener("keydown", handler);
  },

  // Every field that used to be inline-editable directly on the card
  // (name, description, stored-at, default slot) except quantity now lives
  // here instead — opened via the card's own [Edit] button. Each field
  // still auto-applies on change/blur exactly like it did on the card
  // (QM.defaultSlotSelect and QM.descriptionTextarea already wire their own
  // onChange straight to QM.state.updateItem), so this is a relocation of
  // existing controls into a focused view, not a new save/cancel flow — no
  // "Save" button, just a close affordance once you're done. First modal
  // this package has needed; mounted as a child of `this.root` (not
  // document.body) so it's naturally removed if the dock itself closes, and
  // a backdrop click only closes the editor, never the whole dock, since it
  // never reaches the dock's own document-level outside-click listener.
  _openItemEditor(item) {
    this._closeItemEditor();
    const backdrop = document.createElement("div");
    Object.assign(backdrop.style, {
      position: "absolute",
      inset: "0",
      background: "rgba(0, 0, 0, 0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
      boxSizing: "border-box",
      zIndex: "30",
    });
    backdrop.addEventListener("pointerdown", (event) => {
      if (event.target === backdrop) this._closeItemEditor();
    });

    const panel = document.createElement("div");
    Object.assign(panel.style, {
      background: "var(--card, #1c1c1c)",
      border: "1px solid var(--border, rgba(128,128,128,0.3))",
      borderRadius: "var(--radius, 6px)",
      padding: "12px",
      width: "min(280px, 100%)",
      maxHeight: "100%",
      overflowY: "auto",
      boxSizing: "border-box",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    });
    panel.addEventListener("pointerdown", (event) => event.stopPropagation());

    const header = document.createElement("div");
    Object.assign(header.style, { display: "flex", alignItems: "center", justifyContent: "space-between" });
    const title = document.createElement("strong");
    title.textContent = "Edit Item";
    title.style.fontSize = "13px";
    const closeButton = QM.button("×", { bg: "transparent", border: true, fg: "inherit" });
    closeButton.style.padding = "0 6px";
    closeButton.addEventListener("click", () => this._closeItemEditor());
    header.append(title, closeButton);

    const imageRow = document.createElement("div");
    Object.assign(imageRow.style, { display: "flex", justifyContent: "center" });
    imageRow.appendChild(this._buildItemImageControl(item, 96));

    const nameInput = QM.smallInput("input");
    nameInput.type = "text";
    nameInput.value = item.name;
    nameInput.style.width = "100%";
    nameInput.style.boxSizing = "border-box";
    nameInput.style.fontWeight = "600";
    // Renaming pushes through to any saved outfit's own snapshot of this
    // item too (server.mjs's items PATCH route), so a renamed item doesn't
    // show its old name the next time an outfit that equips it is re-equipped.
    nameInput.addEventListener("change", () => {
      const name = nameInput.value.trim();
      if (name) QM.state.updateItem(item.id, { name });
      else nameInput.value = item.name; // Empty isn't a valid name — revert rather than submit it.
    });

    const slotSelect = QM.defaultSlotSelect(item);
    slotSelect.style.width = "100%";
    slotSelect.style.boxSizing = "border-box";

    const storedLine = document.createElement("div");
    Object.assign(storedLine.style, { display: "flex", alignItems: "center", gap: "6px" });
    const storedLabel = document.createElement("span");
    storedLabel.textContent = "Stored at:";
    Object.assign(storedLabel.style, {
      fontSize: "11px",
      color: "var(--muted-foreground, currentcolor)",
      whiteSpace: "nowrap",
    });
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

    const description = QM.descriptionTextarea(item.description, (value) =>
      QM.state.updateItem(item.id, { description: value }),
    );
    description.rows = 4;

    panel.append(header, imageRow, nameInput, slotSelect, storedLine, description);
    backdrop.appendChild(panel);
    this.itemEditorBackdrop = backdrop;
    (this.root || this.body).appendChild(backdrop);
    this._itemEditorEscapeHandler = this._bindEscapeClose(() => this._closeItemEditor());
  },

  _closeItemEditor() {
    this.itemEditorBackdrop?.remove();
    this.itemEditorBackdrop = null;
    this._unbindEscapeClose(this._itemEditorEscapeHandler);
    this._itemEditorEscapeHandler = null;
  },

  // Backdrop/panel structure identical to _openItemEditor (see that method's
  // own comment) — this one holds what used to be the outfit card's own
  // inline fields (name, description, portrait); the "Update" resnapshot
  // action lives directly on the card instead (between Edit and Equip),
  // since it acts on the currently-equipped state rather than editing a
  // field, so it doesn't belong behind this modal like the others. Every
  // field still auto-applies on change/blur; no Save button here either,
  // since nothing in this modal is a pending edit the way a brand-new
  // outfit's fields are in _openSaveOutfitModal.
  _openOutfitEditor(outfit) {
    this._closeOutfitEditor();
    const backdrop = document.createElement("div");
    Object.assign(backdrop.style, {
      position: "absolute",
      inset: "0",
      background: "rgba(0, 0, 0, 0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
      boxSizing: "border-box",
      zIndex: "30",
    });
    backdrop.addEventListener("pointerdown", (event) => {
      if (event.target === backdrop) this._closeOutfitEditor();
    });

    const panel = document.createElement("div");
    Object.assign(panel.style, {
      background: "var(--card, #1c1c1c)",
      border: "1px solid var(--border, rgba(128,128,128,0.3))",
      borderRadius: "var(--radius, 6px)",
      padding: "12px",
      width: "min(280px, 100%)",
      maxHeight: "100%",
      overflowY: "auto",
      boxSizing: "border-box",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    });
    panel.addEventListener("pointerdown", (event) => event.stopPropagation());

    const header = document.createElement("div");
    Object.assign(header.style, { display: "flex", alignItems: "center", justifyContent: "space-between" });
    const title = document.createElement("strong");
    title.textContent = "Edit Outfit";
    title.style.fontSize = "13px";
    const closeButton = QM.button("×", { bg: "transparent", border: true, fg: "inherit" });
    closeButton.style.padding = "0 6px";
    closeButton.addEventListener("click", () => this._closeOutfitEditor());
    header.append(title, closeButton);

    const imageRow = document.createElement("div");
    Object.assign(imageRow.style, { display: "flex", justifyContent: "center" });
    imageRow.appendChild(this._buildOutfitPortraitControl(outfit, 96));

    const nameInput = QM.smallInput("input");
    nameInput.type = "text";
    nameInput.value = outfit.name;
    nameInput.style.width = "100%";
    nameInput.style.boxSizing = "border-box";
    nameInput.style.fontWeight = "600";
    nameInput.addEventListener("change", () => {
      const name = nameInput.value.trim();
      if (name) QM.state.updateOutfit(outfit.id, { name });
      else nameInput.value = outfit.name; // Empty isn't a valid name — revert rather than submit it.
    });

    const description = QM.descriptionTextarea(outfit.description, (value) =>
      QM.state.updateOutfit(outfit.id, { description: value }),
    );
    description.rows = 4;

    panel.append(header, imageRow, nameInput, description);
    backdrop.appendChild(panel);
    this.outfitEditorBackdrop = backdrop;
    (this.root || this.body).appendChild(backdrop);
    this._outfitEditorEscapeHandler = this._bindEscapeClose(() => this._closeOutfitEditor());
  },

  _closeOutfitEditor() {
    this.outfitEditorBackdrop?.remove();
    this.outfitEditorBackdrop = null;
    this._unbindEscapeClose(this._outfitEditorEscapeHandler);
    this._outfitEditorEscapeHandler = null;
  },

  // Unlike the editors above, this one really is a pending-edit form with a
  // real Save step — there's no outfit id yet for a field to auto-apply
  // against. The image control is a plain staged file picker (not
  // _buildOutfitPortraitControl, which uploads immediately via an outfit id
  // this doesn't have yet): picking a file just compresses it and holds the
  // resulting data URL in `stagedImageDataUrl` until Save actually creates
  // the outfit and learns its id. QM.state.createOutfit's own response
  // updates QM.state.outfits in place (05-state.js's _mutate). Compare IDs
  // only after a successful create, so a failed save cannot replace an
  // existing outfit's portrait.
  _openSaveOutfitModal() {
    this._closeSaveOutfitModal();
    const backdrop = document.createElement("div");
    Object.assign(backdrop.style, {
      position: "absolute",
      inset: "0",
      background: "rgba(0, 0, 0, 0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
      boxSizing: "border-box",
      zIndex: "30",
    });
    backdrop.addEventListener("pointerdown", (event) => {
      if (event.target === backdrop) this._closeSaveOutfitModal();
    });

    const panel = document.createElement("div");
    Object.assign(panel.style, {
      background: "var(--card, #1c1c1c)",
      border: `1px solid ${QM_COLOR_SUCCESS}`,
      borderRadius: "var(--radius, 6px)",
      padding: "12px",
      width: "min(280px, 100%)",
      maxHeight: "100%",
      overflowY: "auto",
      boxSizing: "border-box",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    });
    panel.addEventListener("pointerdown", (event) => event.stopPropagation());

    const header = document.createElement("div");
    Object.assign(header.style, { display: "flex", alignItems: "center", justifyContent: "space-between" });
    const title = document.createElement("strong");
    title.textContent = "Save Current Outfit";
    title.style.fontSize = "13px";
    const closeButton = QM.button("×", { bg: "transparent", border: true, fg: "inherit" });
    closeButton.style.padding = "0 6px";
    closeButton.addEventListener("click", () => this._closeSaveOutfitModal());
    header.append(title, closeButton);

    let stagedImageDataUrl = null;
    const imageRow = document.createElement("div");
    Object.assign(imageRow.style, { display: "flex", justifyContent: "center" });
    const imageWrapper = document.createElement("div");
    Object.assign(imageWrapper.style, { position: "relative", width: "96px", height: "96px" });
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/png,image/jpeg,image/webp";
    fileInput.style.display = "none";
    const thumbButton = document.createElement("button");
    thumbButton.type = "button";
    thumbButton.title = "Add portrait";
    Object.assign(thumbButton.style, {
      width: "96px",
      height: "96px",
      padding: "0",
      cursor: "pointer",
      borderRadius: "var(--radius, 4px)",
      overflow: "hidden",
      background: "var(--muted, rgba(128,128,128,0.15))",
      border: "1px dashed var(--border, rgba(128,128,128,0.4))",
      fontSize: "38px",
      lineHeight: "1",
      color: "var(--muted-foreground, currentcolor)",
    });
    thumbButton.textContent = "+";
    thumbButton.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      try {
        stagedImageDataUrl = await QM.compressImageFile(file);
        thumbButton.textContent = "";
        thumbButton.style.border = "1px solid var(--border, rgba(128,128,128,0.3))";
        const preview = document.createElement("img");
        preview.alt = "Outfit portrait preview";
        Object.assign(preview.style, { width: "100%", height: "100%", objectFit: "cover", display: "block" });
        preview.src = stagedImageDataUrl;
        thumbButton.replaceChildren(preview);
      } catch (error) {
        QM.state.error = error && error.message ? error.message : String(error);
        QM.state._notify();
      }
    });
    imageWrapper.append(thumbButton, fileInput);
    imageRow.appendChild(imageWrapper);

    const nameInput = QM.smallInput("input");
    nameInput.type = "text";
    nameInput.placeholder = "Outfit name";
    nameInput.required = true;
    nameInput.style.width = "100%";
    nameInput.style.boxSizing = "border-box";

    const descriptionInput = QM.smallInput("textarea");
    descriptionInput.placeholder = "Description (fed to appearance when selected)";
    descriptionInput.rows = 3;
    Object.assign(descriptionInput.style, {
      width: "100%",
      boxSizing: "border-box",
      resize: "vertical",
      font: "inherit",
    });

    const saveButton = QM.button("Save", { bg: QM_COLOR_SUCCESS, fg: QM_COLOR_SUCCESS_FG });
    saveButton.style.width = "100%";
    saveButton.addEventListener("click", async () => {
      const name = nameInput.value.trim();
      if (!name) return;
      saveButton.disabled = true;
      const chatId = QM.state.chatId;
      const existingIds = new Set((QM.state.outfits ?? []).map((outfit) => outfit.id));
      const outcome = await QM.state.createOutfit({ name, description: descriptionInput.value });
      if (!outcome?.ok || chatId !== QM.state.chatId || this.saveOutfitBackdrop !== backdrop) {
        saveButton.disabled = false;
        return;
      }
      const created = (outcome.result.outfits ?? []).find((outfit) => !existingIds.has(outfit.id));
      if (stagedImageDataUrl && created) {
        await QM.state.uploadOutfitPortrait(created.id, stagedImageDataUrl);
      }
      saveButton.disabled = false;
      if (chatId !== QM.state.chatId || this.saveOutfitBackdrop !== backdrop) return;
      this._closeSaveOutfitModal();
    });

    panel.append(header, imageRow, nameInput, descriptionInput, saveButton);
    backdrop.appendChild(panel);
    this.saveOutfitBackdrop = backdrop;
    (this.root || this.body).appendChild(backdrop);
    this._saveOutfitEscapeHandler = this._bindEscapeClose(() => this._closeSaveOutfitModal());
  },

  _closeSaveOutfitModal() {
    this.saveOutfitBackdrop?.remove();
    this.saveOutfitBackdrop = null;
    this._unbindEscapeClose(this._saveOutfitEscapeHandler);
    this._saveOutfitEscapeHandler = null;
  },

  // A modal rather than the old inline collapse/expand toggle: a toggle
  // button has the awkward property that a second click could mean either
  // "collapse this" or "submit," which is exactly the ambiguity a modal
  // avoids. Same shell as _openSaveOutfitModal (backdrop/panel/Escape
  // pattern); the form itself is _buildAddItemForm's, unchanged internally,
  // just rebuilt fresh each open so it always starts blank.
  _openAddItemModal() {
    this._closeAddItemModal();
    const backdrop = document.createElement("div");
    Object.assign(backdrop.style, {
      position: "absolute",
      inset: "0",
      background: "rgba(0, 0, 0, 0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
      boxSizing: "border-box",
      zIndex: "30",
    });
    backdrop.addEventListener("pointerdown", (event) => {
      if (event.target === backdrop) this._closeAddItemModal();
    });

    const panel = document.createElement("div");
    Object.assign(panel.style, {
      background: "var(--card, #1c1c1c)",
      border: `1px solid ${QM_COLOR_SUCCESS}`,
      borderRadius: "var(--radius, 6px)",
      padding: "12px",
      width: "min(320px, 100%)",
      maxHeight: "100%",
      overflowY: "auto",
      boxSizing: "border-box",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    });
    panel.addEventListener("pointerdown", (event) => event.stopPropagation());

    const header = document.createElement("div");
    Object.assign(header.style, { display: "flex", alignItems: "center", justifyContent: "space-between" });
    const title = document.createElement("strong");
    title.textContent = "Add Item";
    title.style.fontSize = "13px";
    const closeButton = QM.button("×", { bg: "transparent", border: true, fg: "inherit" });
    closeButton.style.padding = "0 6px";
    closeButton.addEventListener("click", () => this._closeAddItemModal());
    header.append(title, closeButton);

    const form = this._buildAddItemForm(() => this._closeAddItemModal());

    panel.append(header, form);
    backdrop.appendChild(panel);
    this.addItemBackdrop = backdrop;
    (this.root || this.body).appendChild(backdrop);
    this._addItemEscapeHandler = this._bindEscapeClose(() => this._closeAddItemModal());
  },

  _closeAddItemModal() {
    this.addItemBackdrop?.remove();
    this.addItemBackdrop = null;
    this._unbindEscapeClose(this._addItemEscapeHandler);
    this._addItemEscapeHandler = null;
  },
};
