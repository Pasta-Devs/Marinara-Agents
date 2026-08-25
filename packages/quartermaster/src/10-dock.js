// Quartermaster — self-managed floating sheet panel. Mirrors Beholder's
// BH.dock (src/80-dock.js): the host's Tracker Panel is small and shared
// chrome, not roomy enough for a real character-sheet layout (portrait,
// equip-slot columns, inventory grid). So the panel lives in its own
// fixed-position element appended to document.body, independent of any
// host-provided slot container, and BOTH the roleplay-tracker toolbar
// button and the tracker-panel launcher just toggle this same panel open.
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
// v1 slice: persona-only. Equip slots, bag/stored locations, item
// descriptions + default slots, and saved outfits. appearanceFeedMode is
// selectable and persisted but not yet wired to actually write a {{getvar}}
// appearance macro. No images, locks, or party members yet.

const QM_OWNER_ID = "persona";
const QM_COLOR_DANGER = "#dc2626";
const QM_COLOR_DANGER_FG = "#fff";
const QM_COLOR_SUCCESS = "#16a34a";
const QM_COLOR_SUCCESS_FG = "#fff";

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

QM.dock = {
  chatId: null,
  isOpenFlag: false,
  root: null,
  body: null,
  errorNode: null,
  feedSelect: null,
  equippedContainer: null,
  outfitsContainer: null,
  outfitForm: null,
  form: null,
  listContainer: null,
  items: null,
  outfits: null,
  appearanceFeedMode: "off",
  error: null,

  isOpen() {
    return this.isOpenFlag;
  },

  setChat(chatId) {
    if (this.chatId === chatId) return;
    this.chatId = chatId;
    this.items = null;
    this.outfits = null;
    this.appearanceFeedMode = "off";
    this.error = null;
    if (this.isOpenFlag) this._loadAndPaint();
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
    this._loadAndPaint();
  },

  close() {
    this.isOpenFlag = false;
    if (this.root) this.root.style.display = "none";
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
    const closeButton = this._button("×", { bg: QM_COLOR_DANGER, fg: QM_COLOR_DANGER_FG });
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
  },

  async _loadAndPaint() {
    const chatId = this.chatId;
    if (!chatId) {
      this._paint();
      return;
    }
    if (this.items === null) {
      try {
        const result = await QM.listItems(chatId, QM_OWNER_ID);
        this.items = result.items;
        this.outfits = result.outfits;
        this.appearanceFeedMode = result.appearanceFeedMode;
      } catch (error) {
        this.error = error && error.message ? error.message : String(error);
      }
    }
    this._paint();
  },

  // Rebuilds only what changed. Forms are built once and left alone on every
  // repaint — rebuilding them on every add/delete/quantity change was wiping
  // out whatever the user had already typed, since a fresh <input> has no
  // value.
  _paint() {
    if (!this.body) return;

    if (!this.chatId) {
      this.body.replaceChildren(this._textNode("No active chat."));
      this.errorNode = null;
      this.feedSelect = null;
      this.equippedContainer = null;
      this.outfitsContainer = null;
      this.outfitForm = null;
      this.form = null;
      this.listContainer = null;
      return;
    }

    if (!this.form || !this.body.contains(this.form)) {
      this.errorNode = this._textNode("");
      this.errorNode.style.color = QM_COLOR_DANGER;
      this.errorNode.style.display = "none";

      const feedRow = this._buildAppearanceFeedRow();

      // Three columns side by side rather than stacked, so Equipped/
      // Outfits/Bag are all visible at once instead of scrolling past each
      // other.
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
      const unequipAllButton = this._button("Unequip All", {
        bg: "var(--secondary, transparent)",
        fg: "var(--secondary-foreground, inherit)",
        border: true,
      });
      unequipAllButton.addEventListener("click", async () => {
        const chatId = this.chatId;
        if (!chatId) return;
        try {
          const result = await QM.unequipAll(chatId, QM_OWNER_ID);
          this.items = result.items;
          this.outfits = result.outfits;
          this.error = null;
        } catch (error) {
          this.error = error && error.message ? error.message : String(error);
        }
        this._paint();
      });
      equippedHeadingRow.append(this._sectionHeading("Equipped"), unequipAllButton);
      this.equippedContainer = document.createElement("div");
      equippedColumn.append(equippedHeadingRow, this.equippedContainer);

      const outfitsColumn = document.createElement("div");
      Object.assign(outfitsColumn.style, { flex: "1", minWidth: "0" });
      this.outfitsContainer = document.createElement("div");
      this.outfitForm = this._buildSaveOutfitForm();
      outfitsColumn.append(this._sectionHeading("Outfits"), this.outfitForm, this.outfitsContainer);

      const bagColumn = document.createElement("div");
      Object.assign(bagColumn.style, { flex: "1", minWidth: "0" });
      this.form = this._buildAddItemForm();
      this.listContainer = document.createElement("div");
      bagColumn.append(this._sectionHeading("Bag"), this.form, this.listContainer);

      columns.append(equippedColumn, outfitsColumn, bagColumn);
      this.body.replaceChildren(this.errorNode, feedRow, columns);
    }

    if (this.error) {
      this.errorNode.textContent = `Error: ${this.error}`;
      this.errorNode.style.display = "";
    } else {
      this.errorNode.style.display = "none";
    }

    this.feedSelect.value = this.appearanceFeedMode;
    this.equippedContainer.replaceChildren(this._buildEquippedSection());
    this.outfitsContainer.replaceChildren(this._buildOutfitsList());
    this.listContainer.replaceChildren(this._buildItemList());
  },

  _sectionHeading(text) {
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
  },

  _textNode(text) {
    const node = document.createElement("p");
    node.style.margin = "0 0 8px";
    node.textContent = text;
    return node;
  },

  _smallInput(tag) {
    const el = document.createElement(tag);
    Object.assign(el.style, {
      background: "var(--input, transparent)",
      color: "inherit",
      border: "1px solid var(--border, rgba(0,0,0,0.2))",
      borderRadius: "4px",
      padding: "2px 4px",
      fontSize: "12px",
    });
    return el;
  },

  // Shared button factory so danger/success/neutral styling stays
  // consistent. bg/fg are CSS color values; border draws a themed outline
  // for neutral (non-colored) buttons instead of a solid fill.
  _button(text, { bg, fg, border } = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    Object.assign(button.style, {
      background: bg ?? "var(--primary, #444)",
      color: fg ?? "var(--primary-foreground, #fff)",
      border: border ? "1px solid var(--border, rgba(0,0,0,0.2))" : "none",
      borderRadius: "4px",
      padding: "2px 8px",
      cursor: "pointer",
      fontSize: "12px",
    });
    return button;
  },

  _bagItems() {
    return (this.items ?? []).filter((item) => !item.location.startsWith("equipped:"));
  },

  _itemInSlot(slot) {
    return (this.items ?? []).find((item) => item.location === `equipped:${slot}`) ?? null;
  },

  _currentEquippedSlots() {
    const slots = {};
    for (const item of this.items ?? []) {
      if (item.location.startsWith("equipped:")) slots[item.location.slice("equipped:".length)] = item.id;
    }
    return slots;
  },

  _outfitMatchesCurrent(outfit) {
    const current = this._currentEquippedSlots();
    const outfitSlots = Object.entries(outfit.slots ?? {});
    const currentSlots = Object.entries(current);
    if (outfitSlots.length !== currentSlots.length) return false;
    return outfitSlots.every(([slot, itemId]) => current[slot] === itemId);
  },

  async _updateItem(itemId, patch) {
    const chatId = this.chatId;
    if (!chatId) return;
    try {
      const result = await QM.updateItem(chatId, QM_OWNER_ID, itemId, patch);
      this.items = result.items;
      this.error = null;
    } catch (error) {
      this.error = error && error.message ? error.message : String(error);
    }
    this._paint();
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

    const select = this._smallInput("select");
    select.style.flex = "1";
    for (const option of QM_APPEARANCE_FEED_OPTIONS) {
      const optionEl = document.createElement("option");
      optionEl.value = option.value;
      optionEl.textContent = option.label;
      select.appendChild(optionEl);
    }
    select.addEventListener("change", async () => {
      const chatId = this.chatId;
      if (!chatId) return;
      try {
        const result = await QM.updateSettings(chatId, QM_OWNER_ID, { appearanceFeedMode: select.value });
        this.appearanceFeedMode = result.appearanceFeedMode;
        this.error = null;
      } catch (error) {
        this.error = error && error.message ? error.message : String(error);
      }
      this._paint();
    });
    this.feedSelect = select;

    row.append(label, select);
    return row;
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

    const equippedItem = this._itemInSlot(slot);
    if (equippedItem) {
      const name = document.createElement("span");
      name.textContent = equippedItem.name;
      name.style.flex = "1";

      const unequipButton = this._button("Unequip", {
        bg: "var(--secondary, transparent)",
        fg: "var(--secondary-foreground, inherit)",
        border: true,
      });
      unequipButton.addEventListener("click", () => this._updateItem(equippedItem.id, { location: "bag" }));

      topLine.append(name, unequipButton);
      row.appendChild(topLine);
      row.appendChild(this._descriptionInput(equippedItem));
      return row;
    }

    const bagItems = this._bagItems();
    const select = this._smallInput("select");
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
      if (itemId) this._updateItem(itemId, { location: `equipped:${slot}` });
    });

    topLine.appendChild(select);
    row.appendChild(topLine);
    return row;
  },

  _descriptionInput(item) {
    const input = this._smallInput("input");
    input.type = "text";
    input.placeholder = "Description";
    input.value = item.description || "";
    input.addEventListener("change", () => this._updateItem(item.id, { description: input.value }));
    return input;
  },

  _defaultSlotSelect(item) {
    const select = this._smallInput("select");
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
    select.addEventListener("change", () => this._updateItem(item.id, { defaultSlot: select.value || null }));
    return select;
  },

  _buildSaveOutfitForm() {
    const form = document.createElement("form");
    Object.assign(form.style, { display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px" });

    const line = document.createElement("div");
    Object.assign(line.style, { display: "flex", gap: "6px" });

    const nameInput = this._smallInput("input");
    nameInput.type = "text";
    nameInput.placeholder = "Save current as outfit…";
    nameInput.required = true;
    nameInput.style.flex = "1";

    const saveButton = this._button("Save", { bg: QM_COLOR_SUCCESS, fg: QM_COLOR_SUCCESS_FG });
    saveButton.type = "submit";

    line.append(nameInput, saveButton);

    const descriptionInput = this._smallInput("input");
    descriptionInput.type = "text";
    descriptionInput.placeholder = "Description (fed to appearance when selected above)";
    descriptionInput.style.width = "100%";
    descriptionInput.style.boxSizing = "border-box";

    form.append(line, descriptionInput);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const chatId = this.chatId;
      const name = nameInput.value.trim();
      if (!chatId || !name) return;
      saveButton.disabled = true;
      try {
        const result = await QM.createOutfit(chatId, QM_OWNER_ID, {
          name,
          description: descriptionInput.value,
        });
        this.items = result.items;
        this.outfits = result.outfits;
        this.error = null;
        nameInput.value = "";
        descriptionInput.value = "";
      } catch (error) {
        this.error = error && error.message ? error.message : String(error);
      }
      saveButton.disabled = false;
      this._paint();
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

    const outfits = this.outfits ?? [];
    if (outfits.length === 0) {
      const empty = this._textNode("No saved outfits yet.");
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

    const name = document.createElement("span");
    name.style.flex = "1";
    name.textContent = this._outfitMatchesCurrent(outfit) ? `${outfit.name} (equipped)` : outfit.name;
    if (this._outfitMatchesCurrent(outfit)) name.style.fontWeight = "600";

    const equipButton = this._button("Equip");
    equipButton.addEventListener("click", async () => {
      const chatId = this.chatId;
      if (!chatId) return;
      try {
        const result = await QM.equipOutfit(chatId, QM_OWNER_ID, outfit.id);
        this.items = result.items;
        this.outfits = result.outfits;
        this.error = null;
      } catch (error) {
        this.error = error && error.message ? error.message : String(error);
      }
      this._paint();
    });

    const updateButton = this._button("Update", {
      bg: "var(--secondary, transparent)",
      fg: "var(--secondary-foreground, inherit)",
      border: true,
    });
    updateButton.title = "Resave the currently-equipped items into this outfit";
    updateButton.addEventListener("click", async () => {
      const chatId = this.chatId;
      if (!chatId) return;
      try {
        const result = await QM.updateOutfit(chatId, QM_OWNER_ID, outfit.id, { resnapshot: true });
        this.items = result.items;
        this.outfits = result.outfits;
        this.error = null;
      } catch (error) {
        this.error = error && error.message ? error.message : String(error);
      }
      this._paint();
    });

    const deleteButton = this._button("Delete", { bg: QM_COLOR_DANGER, fg: QM_COLOR_DANGER_FG });
    deleteButton.addEventListener("click", async () => {
      const chatId = this.chatId;
      if (!chatId) return;
      try {
        const result = await QM.deleteOutfit(chatId, QM_OWNER_ID, outfit.id);
        this.items = result.items;
        this.outfits = result.outfits;
        this.error = null;
      } catch (error) {
        this.error = error && error.message ? error.message : String(error);
      }
      this._paint();
    });

    topLine.append(name, equipButton, updateButton, deleteButton);
    row.appendChild(topLine);

    const descriptionInput = this._smallInput("input");
    descriptionInput.type = "text";
    descriptionInput.placeholder = "Description";
    descriptionInput.value = outfit.description || "";
    descriptionInput.addEventListener("change", async () => {
      const chatId = this.chatId;
      if (!chatId) return;
      try {
        const result = await QM.updateOutfit(chatId, QM_OWNER_ID, outfit.id, {
          description: descriptionInput.value,
        });
        this.items = result.items;
        this.outfits = result.outfits;
        this.error = null;
      } catch (error) {
        this.error = error && error.message ? error.message : String(error);
      }
      this._paint();
    });
    row.appendChild(descriptionInput);

    return row;
  },

  _buildAddItemForm() {
    const form = document.createElement("form");
    Object.assign(form.style, { display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px" });

    const line = document.createElement("div");
    Object.assign(line.style, { display: "flex", gap: "6px" });

    const nameInput = this._smallInput("input");
    nameInput.type = "text";
    nameInput.placeholder = "Item name";
    nameInput.required = true;
    nameInput.style.flex = "1";

    const quantityInput = this._smallInput("input");
    quantityInput.type = "number";
    quantityInput.min = "1";
    quantityInput.value = "1";
    quantityInput.style.width = "56px";

    const addButton = this._button("Add", { bg: QM_COLOR_SUCCESS, fg: QM_COLOR_SUCCESS_FG });
    addButton.type = "submit";

    line.append(nameInput, quantityInput, addButton);

    const descriptionInput = this._smallInput("input");
    descriptionInput.type = "text";
    descriptionInput.placeholder = "Description (optional)";
    descriptionInput.style.width = "100%";
    descriptionInput.style.boxSizing = "border-box";

    form.append(line, descriptionInput);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const chatId = this.chatId;
      const name = nameInput.value.trim();
      if (!chatId || !name) return;
      addButton.disabled = true;
      try {
        const result = await QM.addItem(chatId, QM_OWNER_ID, {
          name,
          quantity: quantityInput.value,
          description: descriptionInput.value,
        });
        this.items = result.items;
        this.outfits = result.outfits;
        this.error = null;
        nameInput.value = "";
        quantityInput.value = "1";
        descriptionInput.value = "";
      } catch (error) {
        this.error = error && error.message ? error.message : String(error);
      }
      addButton.disabled = false;
      this._paint();
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

    const items = this._bagItems();
    if (items.length === 0) {
      const empty = this._textNode("Bag is empty.");
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

    const quantityInput = this._smallInput("input");
    quantityInput.type = "number";
    quantityInput.min = "1";
    quantityInput.value = String(item.quantity);
    quantityInput.style.width = "48px";
    quantityInput.addEventListener("change", () => this._updateItem(item.id, { quantity: quantityInput.value }));

    const deleteButton = this._button("Delete", { bg: QM_COLOR_DANGER, fg: QM_COLOR_DANGER_FG });
    deleteButton.addEventListener("click", async () => {
      const chatId = this.chatId;
      if (!chatId) return;
      try {
        const result = await QM.deleteItem(chatId, QM_OWNER_ID, item.id);
        this.items = result.items;
        this.outfits = result.outfits;
        this.error = null;
      } catch (error) {
        this.error = error && error.message ? error.message : String(error);
      }
      this._paint();
    });

    topLine.append(label, quantityInput, deleteButton);

    const storedLine = document.createElement("div");
    Object.assign(storedLine.style, { display: "flex", alignItems: "center", gap: "6px" });

    const storedLabel = document.createElement("span");
    storedLabel.textContent = "Stored at:";
    Object.assign(storedLabel.style, { fontSize: "11px", color: "var(--muted-foreground, currentcolor)" });

    const storedInput = this._smallInput("input");
    storedInput.type = "text";
    storedInput.placeholder = "bag";
    storedInput.value = item.location.startsWith("stored:") ? item.location.slice("stored:".length) : "";
    storedInput.style.flex = "1";
    storedInput.addEventListener("change", () => {
      const text = storedInput.value.trim();
      this._updateItem(item.id, { location: text ? `stored:${text}` : "bag" });
    });

    storedLine.append(storedLabel, storedInput);

    const equipLine = document.createElement("div");
    Object.assign(equipLine.style, { display: "flex", alignItems: "center", gap: "6px" });
    const defaultSlotSelect = this._defaultSlotSelect(item);
    defaultSlotSelect.style.flex = "1";
    const equipButton = this._button("Equip");
    equipButton.disabled = !item.defaultSlot;
    equipButton.style.opacity = item.defaultSlot ? "1" : "0.5";
    equipButton.addEventListener("click", () => {
      if (item.defaultSlot) this._updateItem(item.id, { location: `equipped:${item.defaultSlot}` });
    });
    equipLine.append(defaultSlotSelect, equipButton);

    row.append(topLine, storedLine, equipLine, this._descriptionInput(item));
    return row;
  },
};
