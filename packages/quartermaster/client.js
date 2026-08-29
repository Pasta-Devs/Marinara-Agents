// Quartermaster 0.1.0 — Marinara Engine roleplay-tracker capability (single-file client bundle)
// Built from packages/quartermaster/src (6 modules) by scripts/build-quartermaster-package.mjs. Do not edit; edit src/ and rebuild.
(() => {
"use strict";
// ===== 00-api.js =====
// Quartermaster — client-side fetch helpers for the package's own privileged
// routes (server.mjs). QM is the shared namespace concatenated files use to
// talk to each other, the way Beholder's src/*.js share BH.

const QM = {};

async function qmRequest(path, options) {
  // Only set Content-Type when there's actually a JSON body — Fastify's body
  // parser rejects a bodyless request (GET/DELETE) that still declares
  // application/json with "Body cannot be empty when content-type is set to
  // 'application/json'".
  const headers = options && options.body ? { "Content-Type": "application/json" } : {};
  const response = await fetch(`/api/quartermaster${path}`, { ...options, headers });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((body && body.error) || `Request failed (${response.status})`);
  }
  return body;
}

QM.listItems = (chatId, ownerId) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}`, { method: "GET" });

QM.addItem = (chatId, ownerId, item) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/items`, {
    method: "POST",
    body: JSON.stringify(item),
  });

QM.updateItem = (chatId, ownerId, itemId, patch) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/items/${encodeURIComponent(itemId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );

QM.deleteItem = (chatId, ownerId, itemId) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/items/${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
  );

QM.createOutfit = (chatId, ownerId, outfit) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/outfits`, {
    method: "POST",
    body: JSON.stringify(outfit),
  });

QM.updateOutfit = (chatId, ownerId, outfitId, patch) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/outfits/${encodeURIComponent(outfitId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );

QM.equipOutfit = (chatId, ownerId, outfitId) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/outfits/${encodeURIComponent(outfitId)}/equip`,
    { method: "POST", body: "{}" },
  );

QM.deleteOutfit = (chatId, ownerId, outfitId) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/outfits/${encodeURIComponent(outfitId)}`,
    { method: "DELETE" },
  );

QM.updateSettings = (chatId, ownerId, settings) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/settings`, {
    method: "PATCH",
    body: JSON.stringify(settings),
  });

QM.unequipAll = (chatId, ownerId) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/unequip-all`, {
    method: "POST",
    body: "{}",
  });

QM.exportInventory = (chatId, ownerId) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/export`, { method: "GET" });

QM.importInventory = (chatId, ownerId, payload) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/import`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

// ===== 05-state.js =====
// Quartermaster — shared reactive state for the persona's inventory. Both
// QM.dock (the self-managed floating panel) and QM.panel (the inline
// tracker-panel accordion) read from and mutate through this single source,
// so equipping/unequipping in one place is immediately reflected in the
// other if both happen to be visible at once — each view just subscribes
// and repaints on change rather than keeping its own copy.

const QM_OWNER_ID = "persona";

// Mirrors server.mjs's EQUIP_SLOTS exactly (same order too) — client and
// server are separate bundles, so this is duplicated rather than shared.
const QM_EQUIP_SLOTS = [
  "head",
  "neck",
  "eyes",
  "ears",
  "armor_torso",
  "armor_legs",
  "clothing_torso",
  "clothing_legs",
  "underwear_top",
  "underwear_bottom",
  "back",
  "hands",
  "weapon_left_hand",
  "weapon_right_hand",
  "feet",
  "belt",
];
// Three of the extension's original SLOT_GROUPS toggles (armor/underwear/
// weapon) — every other slot has no group and is always on ("just regular
// slots", per the request). Mirrors server.mjs's SLOT_GROUPS.
const QM_SLOT_GROUPS = {
  underwear: new Set(["underwear_top", "underwear_bottom"]),
  armor: new Set(["armor_torso", "armor_legs"]),
  weapons: new Set(["weapon_left_hand", "weapon_right_hand"]),
};
const QM_SLOT_LABELS = {
  head: "Head",
  neck: "Neck",
  eyes: "Eyes",
  ears: "Ears",
  armor_torso: "Armor (Torso)",
  armor_legs: "Armor (Legs)",
  clothing_torso: "Clothing (Torso)",
  clothing_legs: "Clothing (Legs)",
  underwear_top: "Underwear (Top)",
  underwear_bottom: "Underwear (Bottom)",
  back: "Back",
  hands: "Hands",
  weapon_left_hand: "Weapon (Left Hand)",
  weapon_right_hand: "Weapon (Right Hand)",
  feet: "Feet",
  belt: "Belt",
};
// The dock's portrait-ring layout: slots arranged around the character
// portrait the way the original extension's character sheet laid them out
// (top row above the head, armor/clothing/underwear stacked to the left,
// accessories/weapons stacked to the right, feet/belt below). A column
// tagged with `group` is dropped as a unit by the dock when that group's
// toggle is off (QM.state.groupVisible) — Clothing/Accessories have no
// group and stay on the ring even with Armor/Weapons hidden. `underwear` is
// kept separate from `left` rather than folded into the Clothing entry so it
// can render directly beneath Clothing specifically, matching the requested
// "underneath clothing" placement.
const QM_PORTRAIT_LAYOUT = {
  top: ["head", "neck", "eyes", "ears"],
  left: [
    { header: "Armor", slots: ["armor_torso", "armor_legs"], group: "armor" },
    { header: "Clothing", slots: ["clothing_torso", "clothing_legs"] },
  ],
  underwear: { header: "Underwear", slots: ["underwear_top", "underwear_bottom"], group: "underwear" },
  right: [
    { header: "Accessories", slots: ["back", "hands"] },
    { header: "Weapons", slots: ["weapon_left_hand", "weapon_right_hand"], group: "weapons" },
  ],
  bottom: ["feet", "belt"],
};
const QM_APPEARANCE_FEED_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "outfitDescription", label: "Outfit description" },
  { value: "equippedNames", label: "Equipped item names" },
];
const QM_COLOR_DANGER = "#dc2626";
const QM_COLOR_DANGER_FG = "#fff";
const QM_COLOR_SUCCESS = "#16a34a";
const QM_COLOR_SUCCESS_FG = "#fff";

function qmSortByName(list) {
  return list.slice().sort((a, b) => a.name.localeCompare(b.name));
}

// True while the user is mid-interaction with a live input/select inside
// either view — an open <select> keeps its native dropdown's owning element
// focused for as long as the popup stays open, so checking focus alone
// covers both "typing in a field" and "a dropdown is open" without needing
// a separate open/closed tracker.
function qmIsLiveEditableElement(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
}

function qmFocusIsInsideLiveView() {
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  if (!qmIsLiveEditableElement(active)) return false;
  const dockRoot = QM.dock && QM.dock.root;
  const panelRoot = QM.panel && QM.panel.container;
  return Boolean((dockRoot && dockRoot.contains(active)) || (panelRoot && panelRoot.contains(active)));
}

// Registered once, module-wide (not per mount/unmount), since it's a no-op
// whenever polling isn't active. Catches the user up as soon as they finish
// editing instead of leaving them looking at up-to-5-second-stale data until
// the next tick — "focusout" (unlike "blur") bubbles, so one delegated
// listener covers every field/select either view ever builds. The delay
// lets focus land on wherever it's actually going next (tabbing to another
// field, a <select>'s popup closing) before deciding the user is done.
if (typeof document !== "undefined") {
  document.addEventListener(
    "focusout",
    () => {
      if (!QM.state._pollTimer) return;
      setTimeout(() => {
        if (QM.state.chatId && !qmFocusIsInsideLiveView()) QM.state._reload();
      }, 200);
    },
    true,
  );
}

QM.state = {
  chatId: null,
  items: null,
  outfits: null,
  appearanceFeedMode: "off",
  // Per-group defaults (matches server.mjs's SLOT_GROUP_DEFAULTS): underwear
  // off so a fresh inventory is SFW; armor/weapons on since most characters
  // use them. Off hides that group's slots from the dock's portrait ring,
  // the tracker panel's Equipped list, and the default-slot picker, and the
  // server independently rejects equipping into them — see server.mjs's
  // normalizeLocation.
  showUnderwear: false,
  showArmor: true,
  showWeapons: true,
  personaAvatarUrl: null,
  error: null,
  _listeners: new Set(),

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  },

  _notify() {
    for (const fn of this._listeners) fn();
  },

  setChat(chatId) {
    if (this.chatId === chatId) return;
    this.chatId = chatId;
    this.items = null;
    this.outfits = null;
    this.appearanceFeedMode = "off";
    this.showUnderwear = false;
    this.showArmor = true;
    this.showWeapons = true;
    this.personaAvatarUrl = null;
    this.error = null;
    this._notify();
    this.ensureLoaded();
  },

  ensureLoaded() {
    if (!this.chatId || this.items !== null) return;
    this._reload();
  },

  // Neither view has any way to know the server-side tracker agent changed
  // something — that happens entirely inside the post_processing pipeline,
  // with no push/event back to the client. Confirmed live: an agent turn
  // reconciled correctly (verified server-side), but the dock kept showing
  // stale data until an unrelated manual action forced a reload. Polling
  // while a view is actually open/mounted is the fix — ref-counted so the
  // dock and tracker panel can both be open without either one stopping the
  // other's polling when it closes first.
  _activeViewers: 0,
  _pollTimer: null,

  startPolling() {
    this._activeViewers += 1;
    if (this._pollTimer) return;
    this._pollTimer = setInterval(() => {
      if (!this.chatId || typeof document === "undefined" || document.hidden) return;
      // A repaint replaces the DOM nodes wholesale (there's no cheap way to
      // patch just the one row that changed), so a poll landing mid-edit —
      // typing in a description field, an open <select>'s native dropdown —
      // would tear the control out from under the user. Skip this tick and
      // let qmScheduleCatchUpReload pick it up the moment focus leaves.
      if (qmFocusIsInsideLiveView()) return;
      this._reload();
    }, 5000);
  },

  stopPolling() {
    this._activeViewers = Math.max(0, this._activeViewers - 1);
    if (this._activeViewers === 0 && this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  async _reload() {
    const chatId = this.chatId;
    if (!chatId) return;
    try {
      const result = await QM.listItems(chatId, QM_OWNER_ID);
      if (this.chatId !== chatId) return; // chat changed while this was in flight
      this.items = result.items;
      this.outfits = result.outfits;
      this.appearanceFeedMode = result.appearanceFeedMode;
      this.showUnderwear = result.showUnderwear === true;
      this.showArmor = result.showArmor !== false;
      this.showWeapons = result.showWeapons !== false;
      this.personaAvatarUrl = result.personaAvatarUrl || null;
      this.error = null;
    } catch (error) {
      this.error = error && error.message ? error.message : String(error);
    }
    this._notify();
  },

  async _mutate(request) {
    const chatId = this.chatId;
    if (!chatId) return;
    try {
      const result = await request;
      if (this.chatId !== chatId) return;
      if (result.items !== undefined) this.items = result.items;
      if (result.outfits !== undefined) this.outfits = result.outfits;
      if (result.appearanceFeedMode !== undefined) this.appearanceFeedMode = result.appearanceFeedMode;
      if (result.showUnderwear !== undefined) this.showUnderwear = result.showUnderwear;
      if (result.showArmor !== undefined) this.showArmor = result.showArmor;
      if (result.showWeapons !== undefined) this.showWeapons = result.showWeapons;
      this.error = null;
    } catch (error) {
      this.error = error && error.message ? error.message : String(error);
    }
    this._notify();
  },

  addItem(item) {
    return this._mutate(QM.addItem(this.chatId, QM_OWNER_ID, item));
  },
  updateItem(itemId, patch) {
    return this._mutate(QM.updateItem(this.chatId, QM_OWNER_ID, itemId, patch));
  },
  deleteItem(itemId) {
    return this._mutate(QM.deleteItem(this.chatId, QM_OWNER_ID, itemId));
  },
  unequipAll() {
    return this._mutate(QM.unequipAll(this.chatId, QM_OWNER_ID));
  },
  // Read-only — doesn't touch `this` state, just hands the caller (the dock's
  // export button) the payload to write out as a file.
  exportInventory() {
    return QM.exportInventory(this.chatId, QM_OWNER_ID);
  },
  importInventory(payload) {
    return this._mutate(QM.importInventory(this.chatId, QM_OWNER_ID, payload));
  },
  createOutfit(outfit) {
    return this._mutate(QM.createOutfit(this.chatId, QM_OWNER_ID, outfit));
  },
  updateOutfit(outfitId, patch) {
    return this._mutate(QM.updateOutfit(this.chatId, QM_OWNER_ID, outfitId, patch));
  },
  equipOutfit(outfitId) {
    return this._mutate(QM.equipOutfit(this.chatId, QM_OWNER_ID, outfitId));
  },
  deleteOutfit(outfitId) {
    return this._mutate(QM.deleteOutfit(this.chatId, QM_OWNER_ID, outfitId));
  },
  updateAppearanceFeedMode(mode) {
    return this._mutate(QM.updateSettings(this.chatId, QM_OWNER_ID, { appearanceFeedMode: mode }));
  },
  updateShowUnderwear(value) {
    return this._mutate(QM.updateSettings(this.chatId, QM_OWNER_ID, { showUnderwear: value }));
  },
  updateShowArmor(value) {
    return this._mutate(QM.updateSettings(this.chatId, QM_OWNER_ID, { showArmor: value }));
  },
  updateShowWeapons(value) {
    return this._mutate(QM.updateSettings(this.chatId, QM_OWNER_ID, { showWeapons: value }));
  },

  // A group with no toggle (e.g. undefined) is always visible.
  groupVisible(group) {
    if (!group) return true;
    if (group === "underwear") return this.showUnderwear;
    if (group === "armor") return this.showArmor;
    if (group === "weapons") return this.showWeapons;
    return true;
  },

  // Single choke point every consumer (portrait ring, tracker panel, the
  // default-slot picker) calls instead of checking QM_SLOT_GROUPS directly.
  slotVisible(slot) {
    for (const [group, slots] of Object.entries(QM_SLOT_GROUPS)) {
      if (slots.has(slot)) return this.groupVisible(group);
    }
    return true;
  },

  // ── Derived, sorted views. Every list-producing getter sorts A-Z here so
  // no render path can accidentally show raw insertion order again. ──
  bagItems() {
    return qmSortByName((this.items ?? []).filter((item) => !item.location.startsWith("equipped:")));
  },

  // [{ label, items }], Bag first then each "stored:<name>" category A-Z by
  // label; items within a category A-Z by name.
  itemsByLocationCategory() {
    const categories = new Map();
    for (const item of this.bagItems()) {
      const label = item.location === "bag" ? "Bag" : item.location.slice("stored:".length);
      if (!categories.has(label)) categories.set(label, []);
      categories.get(label).push(item);
    }
    const labels = [...categories.keys()].sort((a, b) => {
      if (a === "Bag") return -1;
      if (b === "Bag") return 1;
      return a.localeCompare(b);
    });
    return labels.map((label) => ({ label, items: categories.get(label) }));
  },

  // [{ slot, item }] for occupied slots, in EQUIP_SLOTS' fixed anatomical
  // order — that order is itself the sort, not insertion order. A hidden
  // group's entries drop out here too, the same as the portrait ring's slot
  // boxes — so every consumer (tracker panel, dock) agrees on what's
  // visible, not just the dock's own layout.
  equippedEntries() {
    const items = this.items ?? [];
    const entries = [];
    for (const slot of QM_EQUIP_SLOTS) {
      if (!this.slotVisible(slot)) continue;
      const item = items.find((candidate) => candidate.location === `equipped:${slot}`);
      if (item) entries.push({ slot, item });
    }
    return entries;
  },

  itemInSlot(slot) {
    return (this.items ?? []).find((item) => item.location === `equipped:${slot}`) ?? null;
  },

  sortedOutfits() {
    return qmSortByName(this.outfits ?? []);
  },

  // Each slot carries its own name/description snapshot now (not just an
  // item id — plan-locked this session so a saved outfit is a durable
  // record, not a live reference: server.mjs's applyOutfitEquip recreates a
  // missing item from this same snapshot). Reads the name straight off the
  // outfit, so this shows correctly even for an item that's since been
  // deleted or dropped by a tracker-agent turn.
  outfitItemNames(outfit) {
    return Object.values(outfit.slots ?? {})
      .map((snapshot) => (snapshot && typeof snapshot === "object" ? snapshot.name : null))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  },

  outfitMatchesCurrent(outfit) {
    const current = {};
    for (const item of this.items ?? []) {
      if (item.location.startsWith("equipped:")) current[item.location.slice("equipped:".length)] = item.id;
    }
    const outfitEntries = Object.entries(outfit.slots ?? {});
    const currentEntries = Object.entries(current);
    if (outfitEntries.length !== currentEntries.length) return false;
    return outfitEntries.every(([slot, snapshot]) => {
      const itemId = snapshot && typeof snapshot === "object" ? snapshot.itemId : snapshot;
      return current[slot] === itemId;
    });
  },
};

// ===== 07-ui.js =====
// Quartermaster — small shared DOM-building helpers used by both QM.dock
// (the floating panel) and QM.panel (the inline tracker-panel accordion),
// so the two views stay visually and behaviorally consistent instead of
// each hand-rolling their own button/input styling.

QM.textNode = function textNode(text) {
  const node = document.createElement("p");
  node.style.margin = "0 0 8px";
  node.textContent = text;
  return node;
};

// Centered — the Outfits/Equipped/Bag column headings sat flush left before
// (the default for a block element), which read as misaligned against the
// centered portrait ring between them. In the Equipped column the heading
// sits in a grid alongside the Unequip All button (10-dock.js), which
// centers it via a spacer column regardless of this text-align; here it
// matters for Outfits/Bag, where the heading is the column's sole full-width
// child.
QM.sectionHeading = function sectionHeading(text) {
  const heading = document.createElement("h3");
  heading.textContent = text;
  Object.assign(heading.style, {
    margin: "0 0 6px",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "var(--muted-foreground, currentcolor)",
    textAlign: "center",
  });
  return heading;
};

QM.smallInput = function smallInput(tag) {
  const el = document.createElement(tag);
  Object.assign(el.style, {
    background: "var(--input, transparent)",
    color: "inherit",
    border: "1px solid var(--border, rgba(0,0,0,0.2))",
    borderRadius: "4px",
    padding: "2px 4px",
    fontSize: "12px",
  });
  // <select>'s CLOSED box respects author background/color reliably, but the
  // OPEN dropdown popup is largely native-rendered by the browser —
  // Chromium in particular picks colors for it from the page's inherited
  // color-scheme, ignoring var(--input)/color:inherit, which produced
  // white-background/light-text. Forcing color-scheme: light plus explicit
  // (non-variable) colors fixes both the closed box and the popup
  // consistently — real theme-matching for the popup itself isn't reliably
  // achievable across browsers.
  if (tag === "select") {
    el.style.colorScheme = "light";
    el.style.background = "#fff";
    el.style.color = "#000";
  }
  return el;
};

// Shared button factory so danger/success/neutral styling stays consistent.
// bg/fg are CSS color values; border draws a themed outline for neutral
// (non-colored) buttons instead of a solid fill.
QM.button = function button(text, { bg, fg, border } = {}) {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = text;
  Object.assign(el.style, {
    background: bg ?? "var(--primary, #444)",
    color: fg ?? "var(--primary-foreground, #fff)",
    border: border ? "1px solid var(--border, rgba(0,0,0,0.2))" : "none",
    borderRadius: "4px",
    padding: "2px 8px",
    cursor: "pointer",
    fontSize: "12px",
  });
  return el;
};

QM.descriptionInput = function descriptionInput(item) {
  const input = QM.smallInput("input");
  input.type = "text";
  input.placeholder = "Description";
  input.value = item.description || "";
  input.addEventListener("change", () => QM.state.updateItem(item.id, { description: input.value }));
  return input;
};

QM.defaultSlotSelect = function defaultSlotSelect(item) {
  const select = QM.smallInput("select");
  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "Default slot…";
  select.appendChild(noneOption);
  // A hidden group's slots drop out of the picker, matching the portrait
  // ring — same "disabled AND hidden" behavior as the original extension's
  // groupEnabled(), not just a cosmetic hide.
  for (const slot of QM_EQUIP_SLOTS) {
    if (!QM.state.slotVisible(slot)) continue;
    const option = document.createElement("option");
    option.value = slot;
    option.textContent = QM_SLOT_LABELS[slot];
    select.appendChild(option);
  }
  select.value = item.defaultSlot || "";
  select.addEventListener("change", () => QM.state.updateItem(item.id, { defaultSlot: select.value || null }));
  return select;
};

// ===== 10-dock.js =====
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

// ===== 15-panel.js =====
// Quartermaster — inline tracker-panel accordion. Renders directly into the
// tracker-panel slot's element (unlike the toolbar slot, which is just a
// launcher button for QM.dock), matching how built-in trackers show up as a
// collapsible section in the same panel: a top-level "Quartermaster" section
// containing three sub-sections (Equipped, Outfits, Inventory). A pure view
// over QM.state (05-state.js) — see 10-dock.js's header comment for why both
// views share one state module instead of each keeping their own copy.
//
// Headers are hand-built <div>/<button> structures, NOT <details>/<summary>.
// The Engine's native section header (SectionHeader in SectionControls.tsx)
// is a clickable button containing, in order, a rotating chevron span, an
// icon span, and a title span, with its own hover/focus treatment — <summary>
// has no equivalent slot for the icon and no hover styling hook that matches.
// memory-nag (MemoryNagTrackerPanel.tsx), a real capability package rendering
// into this same tracker-panel slot, independently hand-builds the identical
// chevron-frame → icon → title layout with manually-tracked collapsed state
// for the same reason — confirming this is the established pattern for
// package-supplied tracker-panel content, not just native-only.
//
// The whole DOM tree (including headers) is built ONCE and cached (this.root,
// per-section refs in this._sections) — only each section's content <div>
// gets replaceChildren() on every repaint, and expanded/collapsed state lives
// in this.expanded rather than in the DOM. Rebuilding elements from scratch on
// every equip/unequip (the first version did this with <details>) reset them
// to closed every time, since a freshly-created element has no memory of
// prior state — collapsing the whole menu on every click.
//
// Styled with the Engine's OWN tracker-panel Tailwind classes (copied
// verbatim from SectionControls.tsx / InventoryTrackerPanel.tsx /
// tracker-panel.constants.ts) instead of inline styles or guessed CSS
// variables — Tailwind compiles one CSS rule per unique class string found
// anywhere in the Engine's own source, so setting the exact same strings on
// our plain DOM elements picks up already-compiled rules and matches native
// tracker rows exactly, not an approximation of them.
const QM_TRACKER_TEXT_ROW = "text-[0.6875rem] leading-[0.875rem]";
const QM_TRACKER_TEXT_MICRO = "text-[0.625rem] leading-[0.75rem]";
const QM_TRACKER_SECTION_SHELL_CLASS =
  "relative z-10 overflow-hidden border-b border-[var(--border)] bg-[var(--tracker-panel-section-background,color-mix(in_srgb,var(--card)_5%,transparent))] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent)]";
// Header container: layout/border only, not interactive — mirrors
// SectionHeader's outer element in SectionControls.tsx.
const QM_TRACKER_HEADER_CLASS =
  "relative flex min-h-7 items-center gap-1 border-b border-[var(--border)]/42 px-1 py-0.5";
// The actual clickable toggle inside the header — carries the hover/focus
// treatment, copied verbatim from SectionHeader's button className.
const QM_TRACKER_TOGGLE_CLASS =
  "flex min-w-0 flex-1 items-center gap-1 self-stretch rounded-sm px-0 text-left cursor-pointer select-none transition-colors hover:bg-[var(--accent)]/18 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--border)]";
const QM_TRACKER_CHEVRON_FRAME_CLASS = "flex h-3.5 w-3 shrink-0 items-center justify-center";
const QM_TRACKER_CHEVRON_CLASS =
  "text-[color:var(--tracker-profile-icon,var(--muted-foreground))] opacity-60 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]";
const QM_TRACKER_ICON_CLASS =
  "flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[color:var(--tracker-profile-icon,var(--muted-foreground))] opacity-75";
const QM_TRACKER_TITLE_CLASS =
  "min-w-0 flex-1 truncate font-semibold uppercase tracking-[0.08em] text-[var(--foreground)]/62 " +
  QM_TRACKER_TEXT_MICRO;
// Lucide's ChevronDown path, redrawn at a fixed pixel size (not left to the
// component's own 24x24 default) so it actually fits the chevron frame —
// memory-nag's own chevron CSS does the same thing (explicit width/height on
// the icon itself) rather than relying on the frame to clip it.
const QM_TRACKER_CHEVRON_SVG =
  '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
  '<path d="m6 9 6 6 6-6"></path>' +
  "</svg>";
const QM_TRACKER_EMPTY_CLASS =
  "rounded-sm border border-dashed border-[color-mix(in_srgb,var(--tracker-inline-rule,var(--border))_38%,transparent)] px-1 py-1 text-center text-[color-mix(in_srgb,var(--tracker-inline-muted,var(--muted-foreground))_66%,transparent)] " +
  QM_TRACKER_TEXT_ROW;
const QM_TRACKER_ROW_CLASS =
  "flex min-w-0 items-center gap-1 border-b border-[var(--border)]/25 px-1 py-1 last:border-0 " + QM_TRACKER_TEXT_ROW;
const QM_TRACKER_MUTED_CLASS = "text-[var(--muted-foreground)] " + QM_TRACKER_TEXT_MICRO;

QM.panel = {
  container: null,
  unsubscribe: null,
  root: null,
  errorNode: null,
  equippedContent: null,
  outfitsContent: null,
  inventoryContent: null,
  // Collapsed by default for every section, matching the previous
  // <details>-without-`open`-attribute behavior — this rewrite changes how
  // the header looks and where state lives, not the default open/closed
  // state. Persists across repaints and container remounts (e.g. switching
  // between detached/docked tracker panel) since it lives on `this`, not
  // rebuilt with the DOM.
  expanded: { root: false, equipped: false, outfits: false, inventory: false },
  _sections: null,

  mount(container) {
    if (this.container === container) {
      this.paint();
      return;
    }
    this.unmount();
    this.container = container;
    this.root = null; // force the persistent structure to be rebuilt for the new container
    this.unsubscribe = QM.state.subscribe(() => this.paint());
    // Picks up server-side changes from the tracker agent, which has no way
    // to push an update to us — see QM.state.startPolling's comment.
    QM.state.startPolling();
    QM.state.ensureLoaded();
    this.paint();
  },

  unmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      QM.state.stopPolling();
    }
    this.container = null;
    this.root = null;
  },

  paint() {
    if (!this.container) return;
    if (!this.root || !this.container.contains(this.root)) this._buildStructure();
    this._updateContent();
  },

  _buildStructure() {
    const root = document.createElement("div");
    root.className = QM_TRACKER_SECTION_SHELL_CLASS;

    const rootSection = this._buildHeader("Quartermaster", QM_ICON_SVG, "root");
    root.appendChild(rootSection.header);

    const body = document.createElement("div");
    Object.assign(body.style, { display: "flex", flexDirection: "column" });

    this.errorNode = document.createElement("div");
    this.errorNode.className = QM_TRACKER_ROW_CLASS;
    this.errorNode.style.color = QM_COLOR_DANGER;
    this.errorNode.style.display = "none";

    const equipped = this._buildSubsection("Equipped", "equipped");
    this.equippedContent = equipped.content;
    const outfits = this._buildSubsection("Outfits", "outfits");
    this.outfitsContent = outfits.content;
    const inventory = this._buildSubsection("Inventory", "inventory");
    this.inventoryContent = inventory.content;

    body.append(this.errorNode, equipped.wrapper, outfits.wrapper, inventory.wrapper);
    root.appendChild(body);

    this._sections = {
      root: { toggle: rootSection.toggle, chevron: rootSection.chevron, content: body },
      equipped: { toggle: equipped.toggle, chevron: equipped.chevron, content: equipped.content },
      outfits: { toggle: outfits.toggle, chevron: outfits.chevron, content: outfits.content },
      inventory: { toggle: inventory.toggle, chevron: inventory.chevron, content: inventory.content },
    };
    this._applyExpanded();

    this.container.replaceChildren(root);
    this.root = root;
  },

  // Hand-built replica of the native SectionHeader (SectionControls.tsx): a
  // header shell (layout/border only) containing one clickable toggle button
  // with a rotating chevron, an optional package icon, and a title — see the
  // file-level comment for why this replaces <details>/<summary>. `iconSvg`
  // is only passed for the root section: nested sub-sections aren't separate
  // packages, so they get the chevron + hover + title but no icon slot.
  _buildHeader(label, iconSvg, key) {
    const header = document.createElement("div");
    header.className = QM_TRACKER_HEADER_CLASS;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = QM_TRACKER_TOGGLE_CLASS;

    const chevronFrame = document.createElement("span");
    chevronFrame.className = QM_TRACKER_CHEVRON_FRAME_CLASS;
    chevronFrame.setAttribute("aria-hidden", "true");
    const chevron = document.createElement("span");
    chevron.className = QM_TRACKER_CHEVRON_CLASS;
    chevron.innerHTML = QM_TRACKER_CHEVRON_SVG;
    chevronFrame.appendChild(chevron);
    toggle.appendChild(chevronFrame);

    if (iconSvg) {
      const iconSpan = document.createElement("span");
      iconSpan.className = QM_TRACKER_ICON_CLASS;
      iconSpan.setAttribute("aria-hidden", "true");
      iconSpan.innerHTML = iconSvg;
      toggle.appendChild(iconSpan);
    }

    const title = document.createElement("span");
    title.textContent = label;
    title.className = QM_TRACKER_TITLE_CLASS;
    toggle.appendChild(title);

    toggle.setAttribute("aria-label", label);
    toggle.addEventListener("click", () => this._toggleSection(key));
    header.appendChild(toggle);

    return { header, toggle, chevron };
  },

  _buildSubsection(label, key) {
    const wrapper = document.createElement("div");
    const built = this._buildHeader(label, null, key);
    const content = document.createElement("div");
    wrapper.append(built.header, content);
    return { wrapper, content, toggle: built.toggle, chevron: built.chevron };
  },

  _toggleSection(key) {
    this.expanded[key] = !this.expanded[key];
    this._applyExpanded();
  },

  _applyExpanded() {
    if (!this._sections) return;
    for (const key of Object.keys(this._sections)) {
      const { toggle, chevron, content } = this._sections[key];
      const open = this.expanded[key];
      content.style.display = open ? "" : "none";
      chevron.classList.toggle("-rotate-90", !open);
      toggle.setAttribute("aria-expanded", String(open));
    }
  },

  _updateContent() {
    if (!QM.state.chatId) {
      this.equippedContent.replaceChildren(this._empty("No active chat."));
      this.outfitsContent.replaceChildren(this._empty("No active chat."));
      this.inventoryContent.replaceChildren(this._empty("No active chat."));
      return;
    }

    if (QM.state.error) {
      this.errorNode.textContent = `Error: ${QM.state.error}`;
      this.errorNode.style.display = "";
    } else {
      this.errorNode.style.display = "none";
    }

    this.equippedContent.replaceChildren(this._buildEquipped());
    this.outfitsContent.replaceChildren(this._buildOutfits());
    this.inventoryContent.replaceChildren(this._buildInventory());
  },

  _row(children) {
    const row = document.createElement("div");
    row.className = QM_TRACKER_ROW_CLASS;
    row.append(...children);
    return row;
  },

  _empty(text) {
    const node = document.createElement("div");
    node.className = QM_TRACKER_EMPTY_CLASS;
    node.textContent = text;
    return node;
  },

  _buildEquipped() {
    const list = document.createElement("div");
    const entries = QM.state.equippedEntries();
    if (entries.length === 0) {
      list.appendChild(this._empty("Nothing equipped."));
      return list;
    }
    for (const { slot, item } of entries) {
      const name = document.createElement("span");
      name.textContent = item.name;
      name.style.flex = "1";

      const slotLabel = document.createElement("span");
      slotLabel.textContent = QM_SLOT_LABELS[slot];
      slotLabel.className = QM_TRACKER_MUTED_CLASS;

      const unequipButton = QM.button("Unequip", {
        bg: "var(--secondary, transparent)",
        fg: "var(--secondary-foreground, inherit)",
        border: true,
      });
      unequipButton.addEventListener("click", () => QM.state.updateItem(item.id, { location: "bag" }));

      list.appendChild(this._row([name, slotLabel, unequipButton]));
    }
    return list;
  },

  _buildOutfits() {
    const list = document.createElement("div");
    const outfits = QM.state.sortedOutfits();
    if (outfits.length === 0) {
      list.appendChild(this._empty("No saved outfits yet."));
      return list;
    }
    for (const outfit of outfits) {
      const wrapper = document.createElement("div");
      wrapper.className = "border-b border-[var(--border)]/25 px-1 py-1 last:border-0";

      const topLine = document.createElement("div");
      Object.assign(topLine.style, { display: "flex", alignItems: "center", gap: "6px" });

      const name = document.createElement("span");
      name.textContent = outfit.name;
      name.style.flex = "1";
      name.className = "font-semibold " + QM_TRACKER_TEXT_ROW;

      const equipped = QM.state.outfitMatchesCurrent(outfit);
      const toggleButton = equipped
        ? QM.button("Unequip", {
            bg: "var(--secondary, transparent)",
            fg: "var(--secondary-foreground, inherit)",
            border: true,
          })
        : QM.button("Equip");
      toggleButton.addEventListener("click", () =>
        equipped ? QM.state.unequipAll() : QM.state.equipOutfit(outfit.id),
      );

      topLine.append(name, toggleButton);

      const itemNames = QM.state.outfitItemNames(outfit);
      const itemsLine = document.createElement("div");
      itemsLine.textContent = itemNames.length > 0 ? itemNames.join(", ") : "(empty)";
      itemsLine.className = QM_TRACKER_MUTED_CLASS;

      wrapper.append(topLine, itemsLine);
      list.appendChild(wrapper);
    }
    return list;
  },

  _buildInventory() {
    const list = document.createElement("div");
    const categories = QM.state.itemsByLocationCategory();
    if (categories.length === 0) {
      list.appendChild(this._empty("Bag is empty."));
      return list;
    }
    for (const category of categories) {
      const categoryLabel = document.createElement("div");
      categoryLabel.textContent = category.label;
      categoryLabel.className = "px-1 pt-1 font-semibold uppercase tracking-[0.08em] " + QM_TRACKER_MUTED_CLASS;
      list.appendChild(categoryLabel);
      for (const item of category.items) {
        const name = document.createElement("span");
        name.textContent = item.name;
        name.style.flex = "1";
        const qty = document.createElement("span");
        qty.textContent = `×${item.quantity}`;
        qty.className = QM_TRACKER_MUTED_CLASS;
        list.appendChild(this._row([name, qty]));
      }
    }
    return list;
  },
};

// ===== 90-element.js =====
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

})();
