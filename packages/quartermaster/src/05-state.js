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
// Mirrors server.mjs's DEFAULT_ITEM_IMAGE_PROMPT_TEMPLATE/
// DEFAULT_OUTFIT_PORTRAIT_PROMPT_TEMPLATE exactly -- client and server are
// separate bundles, so this is duplicated rather than shared. Used only as
// placeholder text (what an empty saved template actually falls back to),
// never sent anywhere -- the server is the source of truth at generate time.
const QM_DEFAULT_ITEM_IMAGE_PROMPT_TEMPLATE =
  "A crisp, studio photograph of a detailed {item}, {item_description}, set on a dark slate surface, dramatic cinematic side-lighting, 8k resolution, dark neutral background, perfectly centered item sheet asset.";
const QM_DEFAULT_OUTFIT_PORTRAIT_PROMPT_TEMPLATE =
  "A full body portrait in a casual pose of {name}, {persona_appearance}, wearing {equipped_items}.";

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
// The dock's equipment overlay. Head/Eyes/Ears/Neck sit in a row above the
// portrait, Belt/Feet below it; the remaining 5 pairs sit in columns beside
// it, stretched to the portrait's own real rendered height and spread
// evenly across it (10-dock.js's middleRow/space-between) — there's no way
// to pin a slot to a real anatomical pixel position without image
// analysis, since personas vary in aspect ratio/pose, so this spreads them
// evenly instead. Order and pairing match a reference RPG equipment-screen
// layout the user provided. Every pair shares a single group (or neither
// slot has one) — never split across two different groups — so
// group-visibility only needs one check per row; QM.state.slotVisible on
// either slot in a pair always agrees with the other.
const QM_OVERLAY_TOP_SLOTS = ["head", "eyes", "ears", "neck"];
const QM_OVERLAY_BOTTOM_SLOTS = ["belt", "feet"];
const QM_OVERLAY_SLOT_PAIRS = [
  ["hands", "back"],
  ["armor_torso", "armor_legs"],
  ["clothing_torso", "clothing_legs"],
  ["underwear_top", "underwear_bottom"],
  ["weapon_left_hand", "weapon_right_hand"],
];
// Fuller than QM_SLOT_LABELS would need to be for a grouped layout with a
// heading nearby (the old ring's short labels) — this overlay has no
// heading to disambiguate armor vs. clothing between rows, so every label
// carries its own context, matching the reference layout's own labels.
// Plain string — used for the unequip button's aria-label/title, not the
// visible box label (see QM_OVERLAY_SLOT_LABEL_LINES for that).
const QM_OVERLAY_SLOT_LABELS = {
  head: "Head",
  neck: "Neck",
  eyes: "Eyes",
  ears: "Ears",
  armor_torso: "Torso Armor",
  armor_legs: "Legs Armor",
  clothing_torso: "Torso Clothing",
  clothing_legs: "Legs Clothing",
  underwear_top: "Top Underwear",
  underwear_bottom: "Bottom Underwear",
  back: "Back Accessory",
  hands: "Hands Accessory",
  weapon_left_hand: "Left Hand Weapon",
  weapon_right_hand: "Right Hand Weapon",
  feet: "Feet",
  belt: "Belt",
};
// The visible box label, pre-split into explicit lines rather than left to
// natural CSS wrapping — at a fixed box width, "Torso Clothing" wrapped
// while "Legs Clothing" didn't (different first-word length), throwing the
// two paired columns visibly out of alignment with each other. Forcing
// every multi-word label to break at the same point keeps a pair's two
// boxes the same height regardless of word length.
const QM_OVERLAY_SLOT_LABEL_LINES = {
  head: ["Head"],
  neck: ["Neck"],
  eyes: ["Eyes"],
  ears: ["Ears"],
  armor_torso: ["Torso", "Armor"],
  armor_legs: ["Legs", "Armor"],
  clothing_torso: ["Torso", "Clothing"],
  clothing_legs: ["Legs", "Clothing"],
  underwear_top: ["Top", "Underwear"],
  underwear_bottom: ["Bottom", "Underwear"],
  back: ["Back", "Accessory"],
  hands: ["Hands", "Accessory"],
  weapon_left_hand: ["Left Hand", "Weapon"],
  weapon_right_hand: ["Right Hand", "Weapon"],
  feet: ["Feet"],
  belt: ["Belt"],
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

// The Engine dispatches this DOM event to every mounted package host when a
// chat turn's generation finishes, including the persona-inventory-updating
// post_processing tracker agent's own turn (same event packages/beholder
// already relies on for its own equivalent tracker-agent-catch-up need).
// Catching it means the dock/tracker panel catch up within moments of a
// turn landing instead of on a fixed timer, and cost zero network traffic
// while nothing has actually happened. The agent itself still runs
// asynchronously after the event fires, so a short catch-up schedule (not a
// single immediate reload) is still needed — self-cancels the moment state
// actually changes.
const QM_CATCH_UP_DELAYS = [0, 2000, 5000, 9000];
let qmCatchUpTimers = [];
let qmGenerationListenerBound = false;

function qmStateSnapshotForChangeDetection() {
  return JSON.stringify({
    items: QM.state.items,
    outfits: QM.state.outfits,
    appearanceFeedMode: QM.state.appearanceFeedMode,
    showUnderwear: QM.state.showUnderwear,
    showArmor: QM.state.showArmor,
    showWeapons: QM.state.showWeapons,
    personaAvatarUrl: QM.state.personaAvatarUrl,
    replaceRealAvatarOnEquip: QM.state.replaceRealAvatarOnEquip,
    previousSnapshot: QM.state.previousSnapshot,
    lastTrackerChange: QM.state.lastTrackerChange,
  });
}

function qmScheduleCatchUpReload() {
  for (const timer of qmCatchUpTimers) clearTimeout(timer);
  qmCatchUpTimers = [];
  const before = qmStateSnapshotForChangeDetection();
  for (const delay of QM_CATCH_UP_DELAYS) {
    qmCatchUpTimers.push(
      setTimeout(async () => {
        // No viewer left to show it, or the user's mid-edit — the next
        // generation event (or the focusout catch-up below) will retry.
        if (!QM.state._activeViewers || qmFocusIsInsideLiveView()) return;
        await QM.state._reload();
        if (qmStateSnapshotForChangeDetection() !== before) {
          for (const timer of qmCatchUpTimers) clearTimeout(timer);
          qmCatchUpTimers = [];
        }
      }, delay),
    );
  }
}

function qmBindGenerationListener() {
  if (qmGenerationListenerBound || typeof window === "undefined") return;
  qmGenerationListenerBound = true;
  window.addEventListener("marinara:generation-complete", (event) => {
    const chatId = event?.detail?.chatId;
    if (chatId && chatId === QM.state.chatId && QM.state._activeViewers > 0) qmScheduleCatchUpReload();
  });
}

// Registered once, module-wide (not per mount/unmount), since it's a no-op
// whenever no viewer is registered. Catches the user up as soon as they
// finish editing instead of leaving them looking at stale data until the
// next generation event — "focusout" (unlike "blur") bubbles, so one
// delegated listener covers every field/select either view ever builds. The
// delay lets focus land on wherever it's actually going next (tabbing to
// another field, a <select>'s popup closing) before deciding the user is
// done.
if (typeof document !== "undefined") {
  document.addEventListener(
    "focusout",
    () => {
      if (!QM.state._activeViewers) return;
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
  replaceRealAvatarOnEquip: false,
  // Set (server-side, via reconcileTrackerOutput) right before each
  // tracker-agent turn applies its changes — non-null means "Restore
  // Inventory" in Settings has something to revert to. See
  // server.mjs's own comment for the single-level (not full history) scope.
  previousSnapshot: null,
  // What the last tracker-agent turn actually did, in review-able form —
  // the Recent Changes view in Settings. Always in lockstep with
  // previousSnapshot (see server.mjs's reconcileTrackerOutput).
  lastTrackerChange: null,
  // Generate Image settings — a purely local, per-chat preference read only
  // when Quartermaster itself generates an image; see server.mjs's own
  // field comments for why this never affects any other feature. Empty
  // template string means "use the built-in default", not the literal text.
  imageConnectionId: null,
  itemImagePromptTemplate: "",
  outfitPortraitPromptTemplate: "",
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
    this.previousSnapshot = null;
    this.lastTrackerChange = null;
    this.imageConnectionId = null;
    this.itemImagePromptTemplate = "";
    this.outfitPortraitPromptTemplate = "";
    this.error = null;
    // A selected equip-slot picker (QM.dock's own UI state, not this
    // object's) doesn't carry any meaning across a chat switch — the slot
    // NAMES are the same fixed set everywhere, so leaving one "selected"
    // wouldn't crash, but it would look like a stale leftover from the
    // previous chat.
    if (QM.dock) QM.dock.selectedSlot = null;
    this._notify();
    this.ensureLoaded();
  },

  ensureLoaded() {
    if (!this.chatId || this.items !== null) return;
    this._reload();
  },

  // Neither view has any way to know the server-side tracker agent changed
  // something purely from its own state — that happens inside the
  // post_processing pipeline. Catching the Engine's own
  // "marinara:generation-complete" event (qmBindGenerationListener, above)
  // is the fix, ref-counted so the dock and tracker panel can both be open
  // without either one unregistering the other's ability to react to it
  // when it closes first.
  _activeViewers: 0,

  startPolling() {
    this._activeViewers += 1;
    qmBindGenerationListener();
  },

  stopPolling() {
    this._activeViewers = Math.max(0, this._activeViewers - 1);
    if (this._activeViewers === 0) {
      for (const timer of qmCatchUpTimers) clearTimeout(timer);
      qmCatchUpTimers = [];
    }
  },

  async _reload() {
    const chatId = this.chatId;
    if (!chatId) return;
    try {
      const result = await QM.listItems(chatId, QM_OWNER_ID);
      if (this.chatId !== chatId) return; // chat changed while this was in flight
      const next = {
        items: result.items,
        outfits: result.outfits,
        appearanceFeedMode: result.appearanceFeedMode,
        showUnderwear: result.showUnderwear === true,
        showArmor: result.showArmor !== false,
        showWeapons: result.showWeapons !== false,
        personaAvatarUrl: result.personaAvatarUrl || null,
        replaceRealAvatarOnEquip: result.replaceRealAvatarOnEquip === true,
        previousSnapshot: result.previousSnapshot ?? null,
        lastTrackerChange: result.lastTrackerChange ?? null,
        imageConnectionId: result.imageConnectionId ?? null,
        itemImagePromptTemplate: result.itemImagePromptTemplate || "",
        outfitPortraitPromptTemplate: result.outfitPortraitPromptTemplate || "",
      };
      // A repaint rebuilds every card's DOM wholesale (there's no cheap way
      // to patch just the one thing that changed) — item images in
      // particular re-fetch and visibly flicker on every rebuild. Most poll
      // ticks land with nothing actually different server-side (the poll's
      // whole job is catching a tracker-agent turn or another view's edit,
      // which is the exception, not the norm), so compare before assigning
      // and skip the notify entirely when nothing changed, rather than
      // repainting every 5 seconds regardless.
      const current = {
        items: this.items,
        outfits: this.outfits,
        appearanceFeedMode: this.appearanceFeedMode,
        showUnderwear: this.showUnderwear,
        showArmor: this.showArmor,
        showWeapons: this.showWeapons,
        personaAvatarUrl: this.personaAvatarUrl,
        replaceRealAvatarOnEquip: this.replaceRealAvatarOnEquip,
        previousSnapshot: this.previousSnapshot,
        lastTrackerChange: this.lastTrackerChange,
        imageConnectionId: this.imageConnectionId,
        itemImagePromptTemplate: this.itemImagePromptTemplate,
        outfitPortraitPromptTemplate: this.outfitPortraitPromptTemplate,
      };
      const changed = this.error !== null || JSON.stringify(next) !== JSON.stringify(current);
      Object.assign(this, next);
      this.error = null;
      if (!changed) return;
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
      if (result.replaceRealAvatarOnEquip !== undefined)
        this.replaceRealAvatarOnEquip = result.replaceRealAvatarOnEquip;
      if (result.previousSnapshot !== undefined) this.previousSnapshot = result.previousSnapshot;
      if (result.lastTrackerChange !== undefined) this.lastTrackerChange = result.lastTrackerChange;
      if (result.imageConnectionId !== undefined) this.imageConnectionId = result.imageConnectionId;
      if (result.itemImagePromptTemplate !== undefined) this.itemImagePromptTemplate = result.itemImagePromptTemplate;
      if (result.outfitPortraitPromptTemplate !== undefined)
        this.outfitPortraitPromptTemplate = result.outfitPortraitPromptTemplate;
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
  uploadItemImage(itemId, imageDataUrl) {
    QM._missingItemImageIds.delete(itemId);
    return this._mutate(QM.uploadItemImage(this.chatId, QM_OWNER_ID, itemId, imageDataUrl));
  },
  deleteItemImage(itemId) {
    QM._missingItemImageIds.add(itemId);
    return this._mutate(QM.deleteItemImage(this.chatId, QM_OWNER_ID, itemId));
  },
  unequipAll() {
    return this._mutate(QM.unequipAll(this.chatId, QM_OWNER_ID));
  },
  restoreInventory() {
    return this._mutate(QM.restoreInventory(this.chatId, QM_OWNER_ID));
  },
  revertTrackerItem(itemId) {
    return this._mutate(QM.revertTrackerItem(this.chatId, QM_OWNER_ID, itemId));
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
  // Read-only preview — bypasses _mutate like exportInventory() above, since
  // nothing gets written until confirmWardrobe below is called.
  generateWardrobe(direction, includePersonaContext) {
    return QM.generateWardrobe(this.chatId, QM_OWNER_ID, direction, includePersonaContext);
  },
  // _mutate applies the returned items/outfits but only reads the fields it
  // recognizes — it drops the response's own `summary` field. Returning the
  // same (already-settled) request lets the caller read `summary` too,
  // without a second network round trip; a caller doing so must wrap it in
  // its own try/catch, since a rejection is still a rejection on re-await.
  async confirmWardrobe(proposal) {
    const request = QM.confirmWardrobe(this.chatId, QM_OWNER_ID, proposal);
    await this._mutate(request);
    return request;
  },
  uploadOutfitPortrait(outfitId, imageDataUrl) {
    return this._mutate(QM.uploadOutfitPortrait(this.chatId, QM_OWNER_ID, outfitId, imageDataUrl));
  },
  deleteOutfitPortrait(outfitId) {
    return this._mutate(QM.deleteOutfitPortrait(this.chatId, QM_OWNER_ID, outfitId));
  },
  updateAppearanceFeedMode(mode) {
    return this._mutate(QM.updateSettings(this.chatId, QM_OWNER_ID, { appearanceFeedMode: mode }));
  },
  updateImageConnectionId(value) {
    return this._mutate(QM.updateSettings(this.chatId, QM_OWNER_ID, { imageConnectionId: value || null }));
  },
  updateItemImagePromptTemplate(value) {
    return this._mutate(QM.updateSettings(this.chatId, QM_OWNER_ID, { itemImagePromptTemplate: value }));
  },
  updateOutfitPortraitPromptTemplate(value) {
    return this._mutate(QM.updateSettings(this.chatId, QM_OWNER_ID, { outfitPortraitPromptTemplate: value }));
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
  updateReplaceRealAvatarOnEquip(value) {
    return this._mutate(QM.updateSettings(this.chatId, QM_OWNER_ID, { replaceRealAvatarOnEquip: value }));
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
  // item id — a saved outfit is a durable record, not a live reference:
  // server.mjs's applyOutfitEquip recreates a
  // missing item from this same snapshot). Reads the name straight off the
  // outfit, so this shows correctly even for an item that's since been
  // deleted or dropped by a tracker-agent turn.
  outfitItemNames(outfit) {
    return Object.values(outfit.slots ?? {})
      .map((snapshot) => (snapshot && typeof snapshot === "object" ? snapshot.name : null))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  },

  // An outfit stays "the current outfit" as long as every slot IT saved is
  // still worn exactly as saved — equipping something extra in a slot the
  // outfit never claimed doesn't unequip it, only swapping out one of the
  // outfit's own slots does. Mirrors server.mjs's outfitMatchesCurrent
  // exactly (see its own comment for why this isn't exact-set equality).
  outfitMatchesCurrent(outfit) {
    const current = {};
    for (const item of this.items ?? []) {
      if (item.location.startsWith("equipped:")) current[item.location.slice("equipped:".length)] = item.id;
    }
    const outfitEntries = Object.entries(outfit.slots ?? {});
    if (outfitEntries.length === 0) return false; // a slotless outfit is never "currently worn"
    return outfitEntries.every(([slot, snapshot]) => {
      const itemId = snapshot && typeof snapshot === "object" ? snapshot.itemId : snapshot;
      return current[slot] === itemId;
    });
  },

  // The outfit (if any) whose slots exactly match what's currently equipped
  // AND has a portrait set — used by the portrait ring to decide whether to
  // show that portrait instead of the persona's own avatar. Ambiguous when
  // two saved outfits happen to have identical slots (picks the first, same
  // tie-break outfitMatchesCurrent's server-side counterpart already accepts
  // for the appearance-macro's "outfitDescription" mode).
  activeOutfitPortraitUrl() {
    const active = (this.outfits ?? []).find((outfit) => outfit.portraitFile && this.outfitMatchesCurrent(outfit));
    return active ? QM.outfitPortraitUrl(this.chatId, QM_OWNER_ID, active.id) : null;
  },
};
