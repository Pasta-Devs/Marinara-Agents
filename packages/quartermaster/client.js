// Quartermaster 0.2.1 — Marinara Engine roleplay-tracker capability (single-file client bundle)
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

// ===== 05-state.js =====
// Quartermaster — shared reactive state for the persona's inventory. Both
// QM.dock (the self-managed floating panel) and QM.panel (the inline
// tracker-panel accordion) read from and mutate through this single source,
// so equipping/unequipping in one place is immediately reflected in the
// other if both happen to be visible at once — each view just subscribes
// and repaints on change rather than keeping its own copy.

const QM_OWNER_ID = "persona";

// Mirrors server.mjs's EQUIP_SLOTS exactly — client and server are separate
// bundles, so this is duplicated rather than shared. Grouped for display
// only; the slot ids themselves (and their order in server.mjs's
// EQUIP_SLOTS) are the source of truth for what's valid.
const QM_SLOT_GROUPS = [
  { label: "Head & Neck", slots: ["head", "neck"] },
  { label: "Eyes & Ears", slots: ["eyes", "ears"] },
  { label: "Torso", slots: ["underwear_top", "clothing_torso", "armor_torso"] },
  { label: "Legs", slots: ["underwear_bottom", "clothing_legs", "armor_legs"] },
  { label: "Hands", slots: ["weapon_left_hand", "weapon_right_hand"] },
  { label: "Other", slots: ["feet", "accessory", "belt"] },
];
const QM_EQUIP_SLOTS = QM_SLOT_GROUPS.flatMap((group) => group.slots);
const QM_SLOT_LABELS = {
  head: "Head",
  neck: "Neck",
  eyes: "Eyes",
  ears: "Ears",
  feet: "Feet",
  accessory: "Accessory",
  belt: "Belt",
  underwear_top: "Underwear (Top)",
  underwear_bottom: "Underwear (Bottom)",
  clothing_torso: "Clothing (Torso)",
  clothing_legs: "Clothing (Legs)",
  armor_torso: "Armor (Torso)",
  armor_legs: "Armor (Legs)",
  weapon_left_hand: "Weapon (Left Hand)",
  weapon_right_hand: "Weapon (Right Hand)",
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

QM.state = {
  chatId: null,
  items: null,
  outfits: null,
  appearanceFeedMode: "off",
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
    this.personaAvatarUrl = null;
    this.error = null;
    this._notify();
    this.ensureLoaded();
  },

  ensureLoaded() {
    if (!this.chatId || this.items !== null) return;
    this._reload();
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
  // order — that order is itself the sort, not insertion order.
  equippedEntries() {
    const items = this.items ?? [];
    const entries = [];
    for (const slot of QM_EQUIP_SLOTS) {
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

  outfitItemNames(outfit) {
    const items = this.items ?? [];
    return Object.values(outfit.slots ?? {})
      .map((itemId) => items.find((item) => item.id === itemId))
      .filter(Boolean)
      .map((item) => item.name)
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
    return outfitEntries.every(([slot, itemId]) => current[slot] === itemId);
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

QM.sectionHeading = function sectionHeading(text) {
  const heading = document.createElement("h3");
  heading.textContent = text;
  Object.assign(heading.style, {
    margin: "0 0 6px",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "var(--muted-foreground, currentcolor)",
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
  for (const slot of QM_EQUIP_SLOTS) {
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

QM.dock = {
  isOpenFlag: false,
  unsubscribe: null,
  root: null,
  body: null,
  errorNode: null,
  feedSelect: null,
  equippedContainer: null,
  outfitsContainer: null,
  outfitForm: null,
  form: null,
  listContainer: null,
  portraitImage: null,
  portraitPlaceholder: null,

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
    this.root.style.display = "flex";
    this._syncToggles();
    if (!this.unsubscribe) this.unsubscribe = QM.state.subscribe(() => this._paint());
    QM.state.ensureLoaded();
    this._paint();
  },

  close() {
    this.isOpenFlag = false;
    if (this.root) this.root.style.display = "none";
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this._syncToggles();
  },

  _syncToggles() {
    for (const button of document.querySelectorAll(".qm-launch")) {
      button.setAttribute("aria-pressed", this.isOpenFlag ? "true" : "false");
    }
  },

  _ensureRoot() {
    if (this.root && document.body.contains(this.root)) return;

    const root = document.createElement("div");
    root.id = "qm-dock-root";
    Object.assign(root.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      width: "min(820px, 95vw)",
      maxHeight: "82vh",
      display: "none",
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
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 10px",
      borderBottom: "1px solid var(--border, rgba(0,0,0,0.1))",
      fontWeight: "600",
    });
    const title = document.createElement("span");
    title.textContent = "Quartermaster";
    const closeButton = QM.button("×", { bg: QM_COLOR_DANGER, fg: QM_COLOR_DANGER_FG });
    closeButton.setAttribute("aria-label", "Close Quartermaster");
    Object.assign(closeButton.style, { fontSize: "14px", lineHeight: "1", padding: "2px 8px" });
    closeButton.addEventListener("click", () => this.close());
    header.append(title, closeButton);

    const body = document.createElement("div");
    Object.assign(body.style, {
      padding: "10px",
      overflowY: "auto",
    });

    root.append(header, body);
    document.body.appendChild(root);
    this.root = root;
    this.body = body;
    // Reset the cached body children — a fresh body element means everything
    // built for a previous root no longer exists.
    this.errorNode = null;
    this.feedSelect = null;
    this.equippedContainer = null;
    this.outfitsContainer = null;
    this.outfitForm = null;
    this.form = null;
    this.listContainer = null;
    this.portraitImage = null;
    this.portraitPlaceholder = null;
  },

  // Rebuilds only what changed. Forms are built once and left alone on every
  // repaint — rebuilding them on every add/delete/quantity change was wiping
  // out whatever the user had already typed, since a fresh <input> has no
  // value.
  _paint() {
    if (!this.body || !this.isOpenFlag) return;

    if (!QM.state.chatId) {
      this.body.replaceChildren(QM.textNode("No active chat."));
      this.errorNode = null;
      this.feedSelect = null;
      this.equippedContainer = null;
      this.outfitsContainer = null;
      this.outfitForm = null;
      this.form = null;
      this.listContainer = null;
      this.portraitImage = null;
      this.portraitPlaceholder = null;
      return;
    }

    if (!this.form || !this.body.contains(this.form)) {
      this.errorNode = QM.textNode("");
      this.errorNode.style.color = QM_COLOR_DANGER;
      this.errorNode.style.display = "none";

      const feedRow = this._buildAppearanceFeedRow();

      const columns = document.createElement("div");
      Object.assign(columns.style, { display: "flex", gap: "12px", alignItems: "flex-start" });

      const equippedColumn = document.createElement("div");
      Object.assign(equippedColumn.style, { flex: "1", minWidth: "0" });
      const equippedHeadingRow = document.createElement("div");
      Object.assign(equippedHeadingRow.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      });
      const unequipAllButton = QM.button("Unequip All", {
        bg: "var(--secondary, transparent)",
        fg: "var(--secondary-foreground, inherit)",
        border: true,
      });
      unequipAllButton.addEventListener("click", () => QM.state.unequipAll());
      equippedHeadingRow.append(QM.sectionHeading("Equipped"), unequipAllButton);
      this.equippedContainer = document.createElement("div");
      equippedColumn.append(equippedHeadingRow, this._buildPortrait(), this.equippedContainer);

      const outfitsColumn = document.createElement("div");
      Object.assign(outfitsColumn.style, { flex: "1", minWidth: "0" });
      this.outfitsContainer = document.createElement("div");
      this.outfitForm = this._buildSaveOutfitForm();
      outfitsColumn.append(QM.sectionHeading("Outfits"), this.outfitForm, this.outfitsContainer);

      const bagColumn = document.createElement("div");
      Object.assign(bagColumn.style, { flex: "1", minWidth: "0" });
      this.form = this._buildAddItemForm();
      this.listContainer = document.createElement("div");
      bagColumn.append(QM.sectionHeading("Bag"), this.form, this.listContainer);

      columns.append(equippedColumn, outfitsColumn, bagColumn);
      this.body.replaceChildren(this.errorNode, feedRow, columns);
    }

    if (QM.state.error) {
      this.errorNode.textContent = `Error: ${QM.state.error}`;
      this.errorNode.style.display = "";
    } else {
      this.errorNode.style.display = "none";
    }

    this.feedSelect.value = QM.state.appearanceFeedMode;
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

  _buildEquippedSection() {
    const container = document.createElement("div");
    Object.assign(container.style, { display: "flex", flexDirection: "column", gap: "8px" });

    for (const group of QM_SLOT_GROUPS) {
      const groupBox = document.createElement("div");
      const groupLabel = document.createElement("div");
      groupLabel.textContent = group.label;
      Object.assign(groupLabel.style, {
        fontSize: "11px",
        color: "var(--muted-foreground, currentcolor)",
        marginBottom: "3px",
      });
      groupBox.appendChild(groupLabel);

      const rows = document.createElement("div");
      Object.assign(rows.style, { display: "flex", flexDirection: "column", gap: "4px" });
      for (const slot of group.slots) {
        rows.appendChild(this._buildSlotRow(slot));
      }
      groupBox.appendChild(rows);
      container.appendChild(groupBox);
    }

    return container;
  },

  _buildSlotRow(slot) {
    const row = document.createElement("div");
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

    const label = document.createElement("span");
    label.textContent = QM_SLOT_LABELS[slot];
    Object.assign(label.style, { width: "108px", flexShrink: "0", fontSize: "12px" });
    topLine.appendChild(label);

    const equippedItem = QM.state.itemInSlot(slot);
    if (equippedItem) {
      const name = document.createElement("span");
      name.textContent = equippedItem.name;
      name.style.flex = "1";

      const unequipButton = QM.button("Unequip", {
        bg: "var(--secondary, transparent)",
        fg: "var(--secondary-foreground, inherit)",
        border: true,
      });
      unequipButton.addEventListener("click", () => QM.state.updateItem(equippedItem.id, { location: "bag" }));

      topLine.append(name, unequipButton);
      row.appendChild(topLine);
      row.appendChild(QM.descriptionInput(equippedItem));
      return row;
    }

    const bagItems = QM.state.bagItems();
    const select = QM.smallInput("select");
    select.disabled = bagItems.length === 0;
    select.style.flex = "1";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = bagItems.length === 0 ? "(nothing in bag)" : "Equip…";
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

    topLine.appendChild(select);
    row.appendChild(topLine);
    return row;
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
    quantityInput.min = "1";
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
    equipButton.disabled = !item.defaultSlot;
    equipButton.style.opacity = item.defaultSlot ? "1" : "0.5";
    equipButton.addEventListener("click", () => {
      if (item.defaultSlot) QM.state.updateItem(item.id, { location: `equipped:${item.defaultSlot}` });
    });
    equipLine.append(defaultSlotSelect, equipButton);

    row.append(topLine, storedLine, equipLine, QM.descriptionInput(item));
    return row;
  },
};

// ===== 15-panel.js =====
// Quartermaster — inline tracker-panel accordion. Renders directly into the
// tracker-panel slot's element (unlike the toolbar slot, which is just a
// launcher button for QM.dock) as a native <details>/<summary> tree, matching
// how built-in trackers like Inventory Tracker show up as a collapsible
// section in the same panel: a top-level "Quartermaster" section containing
// three sub-sections (Equipped, Outfits, Inventory). A pure view over
// QM.state (05-state.js) — see 10-dock.js's header comment for why both
// views share one state module instead of each keeping their own copy.
//
// The <details>/<summary> tree is built ONCE and cached (this.root, per
// subsection this._equipped.content etc.) — only the content <div> inside
// each subsection gets replaceChildren() on every repaint. Rebuilding the
// <details> elements themselves on every equip/unequip (the first version
// did this) reset them to closed every time, since a freshly-created
// <details> has no memory of being open — collapsing the whole menu on
// every click.
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
const QM_TRACKER_SUMMARY_CLASS =
  "flex min-h-7 cursor-pointer select-none items-center gap-1 border-b border-[var(--border)]/42 px-1 py-0.5 font-semibold uppercase tracking-[0.08em] text-[var(--foreground)]/62 " +
  QM_TRACKER_TEXT_MICRO;
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

  mount(container) {
    if (this.container === container) {
      this.paint();
      return;
    }
    this.unmount();
    this.container = container;
    this.root = null; // force the persistent structure to be rebuilt for the new container
    this.unsubscribe = QM.state.subscribe(() => this.paint());
    QM.state.ensureLoaded();
    this.paint();
  },

  unmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
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
    const root = document.createElement("details");
    root.className = QM_TRACKER_SECTION_SHELL_CLASS;

    const summary = document.createElement("summary");
    summary.textContent = "Quartermaster";
    summary.className = QM_TRACKER_SUMMARY_CLASS;
    root.appendChild(summary);

    const body = document.createElement("div");
    Object.assign(body.style, { display: "flex", flexDirection: "column" });

    this.errorNode = document.createElement("div");
    this.errorNode.className = QM_TRACKER_ROW_CLASS;
    this.errorNode.style.color = QM_COLOR_DANGER;
    this.errorNode.style.display = "none";

    const equipped = this._buildSubsectionShell("Equipped");
    this.equippedContent = equipped.content;
    const outfits = this._buildSubsectionShell("Outfits");
    this.outfitsContent = outfits.content;
    const inventory = this._buildSubsectionShell("Inventory");
    this.inventoryContent = inventory.content;

    body.append(this.errorNode, equipped.details, outfits.details, inventory.details);
    root.appendChild(body);

    this.container.replaceChildren(root);
    this.root = root;
  },

  _buildSubsectionShell(label) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = label;
    summary.className = QM_TRACKER_SUMMARY_CLASS;
    const content = document.createElement("div");
    details.append(summary, content);
    return { details, content };
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
