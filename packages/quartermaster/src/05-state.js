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
