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
const QM_UNDERWEAR_SLOTS = new Set(["underwear_top", "underwear_bottom"]);
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
// accessories/weapons stacked to the right, feet/belt below). `underwear` is
// kept separate from `left` rather than folded into the Clothing entry so
// the dock can drop it as a unit when QM.state.showUnderwear is off — it
// still renders directly beneath the Clothing column when shown, matching
// the requested layout.
const QM_PORTRAIT_LAYOUT = {
  top: ["head", "neck", "eyes", "ears"],
  left: [
    { header: "Armor", slots: ["armor_torso", "armor_legs"] },
    { header: "Clothing", slots: ["clothing_torso", "clothing_legs"] },
  ],
  underwear: { header: "Underwear", slots: ["underwear_top", "underwear_bottom"] },
  right: [
    { header: "Accessories", slots: ["back", "hands"] },
    { header: "Weapons", slots: ["weapon_left_hand", "weapon_right_hand"] },
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

QM.state = {
  chatId: null,
  items: null,
  outfits: null,
  appearanceFeedMode: "off",
  // Off by default (SFW): hides the underwear slots from the dock's portrait
  // ring and the default-slot picker, and the server independently rejects
  // equipping into them while off — see server.mjs's normalizeLocation.
  showUnderwear: false,
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
      this.showUnderwear = result.showUnderwear === true;
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
  updateShowUnderwear(value) {
    return this._mutate(QM.updateSettings(this.chatId, QM_OWNER_ID, { showUnderwear: value }));
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
  // order — that order is itself the sort, not insertion order. Underwear
  // entries drop out while showUnderwear is off, the same as the portrait
  // ring's slot boxes — a single choke point so every consumer (tracker
  // panel, dock) agrees on what's visible, not just the dock's own layout.
  equippedEntries() {
    const items = this.items ?? [];
    const entries = [];
    for (const slot of QM_EQUIP_SLOTS) {
      if (!this.showUnderwear && QM_UNDERWEAR_SLOTS.has(slot)) continue;
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
