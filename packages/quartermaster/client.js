// Quartermaster 0.1.3 — Marinara Engine roleplay-tracker capability (single-file client bundle)
// Built from packages/quartermaster/src (3 modules) by scripts/build-quartermaster-package.mjs. Do not edit; edit src/ and rebuild.
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

// ===== 10-dock.js =====
// Quartermaster — self-managed floating sheet panel. Mirrors Beholder's
// BH.dock (src/80-dock.js): the host's Tracker Panel is small and shared
// chrome, not roomy enough for a real character-sheet layout (portrait,
// equip-slot columns, inventory grid). So the panel lives in its own
// fixed-position element appended to document.body, independent of any
// host-provided slot container, and BOTH the roleplay-tracker toolbar
// button and the tracker-panel launcher just toggle this same panel open.
//
// Styled entirely with the host's own CSS custom properties (--popover,
// --foreground, --border, etc. — defined on :root in the Engine's
// globals.css). Our panel is plain light DOM appended under document.body,
// so it inherits those variables directly: no palette to guess or keep in
// sync, and it follows the user's actual active theme, not just light/dark.
//
// v1 slice: persona-only. Equip slots + bag/stored locations. No images,
// locks, outfits, or party members yet.

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

QM.dock = {
  chatId: null,
  isOpenFlag: false,
  root: null,
  body: null,
  errorNode: null,
  equippedContainer: null,
  form: null,
  listContainer: null,
  items: null,
  error: null,

  isOpen() {
    return this.isOpenFlag;
  },

  setChat(chatId) {
    if (this.chatId === chatId) return;
    this.chatId = chatId;
    this.items = null;
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
      width: "380px",
      maxHeight: "78vh",
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
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Close Quartermaster");
    Object.assign(closeButton.style, {
      border: "none",
      background: "transparent",
      fontSize: "16px",
      lineHeight: "1",
      cursor: "pointer",
      color: "inherit",
    });
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
    this.equippedContainer = null;
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
      } catch (error) {
        this.error = error && error.message ? error.message : String(error);
      }
    }
    this._paint();
  },

  // Rebuilds only what changed. The add-item form is built once and left
  // alone on every repaint — rebuilding it on every add/delete/quantity
  // change was wiping out whatever the user had already typed into the name
  // field, since a fresh <input> has no value.
  _paint() {
    if (!this.body) return;

    if (!this.chatId) {
      this.body.replaceChildren(this._textNode("No active chat."));
      this.errorNode = null;
      this.equippedContainer = null;
      this.form = null;
      this.listContainer = null;
      return;
    }

    if (!this.form || !this.body.contains(this.form)) {
      this.errorNode = this._textNode("");
      this.errorNode.style.color = "var(--destructive, #c0392b)";
      this.errorNode.style.display = "none";

      const equippedHeading = this._sectionHeading("Equipped");
      this.equippedContainer = document.createElement("div");

      const bagHeading = this._sectionHeading("Bag");
      this.form = this._buildAddItemForm();
      this.listContainer = document.createElement("div");

      this.body.replaceChildren(
        this.errorNode,
        equippedHeading,
        this.equippedContainer,
        bagHeading,
        this.form,
        this.listContainer,
      );
    }

    if (this.error) {
      this.errorNode.textContent = `Error: ${this.error}`;
      this.errorNode.style.display = "";
    } else {
      this.errorNode.style.display = "none";
    }

    this.equippedContainer.replaceChildren(this._buildEquippedSection());
    this.listContainer.replaceChildren(this._buildItemList());
  },

  _sectionHeading(text) {
    const heading = document.createElement("h3");
    heading.textContent = text;
    Object.assign(heading.style, {
      margin: "10px 0 6px",
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

  _bagItems() {
    return (this.items ?? []).filter((item) => !item.location.startsWith("equipped:"));
  },

  _itemInSlot(slot) {
    return (this.items ?? []).find((item) => item.location === `equipped:${slot}`) ?? null;
  },

  async _setLocation(itemId, location) {
    const chatId = this.chatId;
    if (!chatId) return;
    try {
      const result = await QM.updateItem(chatId, QM_OWNER_ID, itemId, { location });
      this.items = result.items;
      this.error = null;
    } catch (error) {
      this.error = error && error.message ? error.message : String(error);
    }
    this._paint();
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
      alignItems: "center",
      gap: "6px",
      border: "1px solid var(--border, rgba(128,128,128,0.3))",
      borderRadius: "4px",
      padding: "4px 6px",
    });

    const label = document.createElement("span");
    label.textContent = QM_SLOT_LABELS[slot];
    Object.assign(label.style, { width: "108px", flexShrink: "0", fontSize: "12px" });
    row.appendChild(label);

    const equippedItem = this._itemInSlot(slot);
    if (equippedItem) {
      const name = document.createElement("span");
      name.textContent = equippedItem.name;
      name.style.flex = "1";
      name.title = equippedItem.description || "";

      const unequipButton = document.createElement("button");
      unequipButton.type = "button";
      unequipButton.textContent = "Unequip";
      Object.assign(unequipButton.style, {
        background: "var(--secondary, transparent)",
        color: "var(--secondary-foreground, inherit)",
        border: "1px solid var(--border, rgba(0,0,0,0.2))",
        borderRadius: "4px",
        padding: "2px 6px",
        cursor: "pointer",
        fontSize: "12px",
      });
      unequipButton.addEventListener("click", () => this._setLocation(equippedItem.id, "bag"));

      row.append(name, unequipButton);
      return row;
    }

    const bagItems = this._bagItems();
    const select = document.createElement("select");
    select.disabled = bagItems.length === 0;
    Object.assign(select.style, {
      flex: "1",
      background: "var(--input, transparent)",
      color: "inherit",
      border: "1px solid var(--border, rgba(0,0,0,0.2))",
      borderRadius: "4px",
      padding: "2px 4px",
      fontSize: "12px",
    });
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
      if (itemId) this._setLocation(itemId, `equipped:${slot}`);
    });

    row.appendChild(select);
    return row;
  },

  _buildAddItemForm() {
    const form = document.createElement("form");
    Object.assign(form.style, { display: "flex", gap: "6px", marginBottom: "8px" });

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Item name";
    nameInput.required = true;
    Object.assign(nameInput.style, {
      flex: "1",
      background: "var(--input, transparent)",
      color: "inherit",
      border: "1px solid var(--border, rgba(0,0,0,0.2))",
      borderRadius: "4px",
      padding: "3px 6px",
    });

    const quantityInput = document.createElement("input");
    quantityInput.type = "number";
    quantityInput.min = "1";
    quantityInput.value = "1";
    Object.assign(quantityInput.style, {
      width: "56px",
      background: "var(--input, transparent)",
      color: "inherit",
      border: "1px solid var(--border, rgba(0,0,0,0.2))",
      borderRadius: "4px",
      padding: "3px 6px",
    });

    const addButton = document.createElement("button");
    addButton.type = "submit";
    addButton.textContent = "Add";
    Object.assign(addButton.style, {
      background: "var(--primary, #444)",
      color: "var(--primary-foreground, #fff)",
      border: "none",
      borderRadius: "4px",
      padding: "3px 10px",
      cursor: "pointer",
    });

    form.append(nameInput, quantityInput, addButton);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const chatId = this.chatId;
      const name = nameInput.value.trim();
      if (!chatId || !name) return;
      addButton.disabled = true;
      try {
        const result = await QM.addItem(chatId, QM_OWNER_ID, { name, quantity: quantityInput.value });
        this.items = result.items;
        this.error = null;
        nameInput.value = "";
        quantityInput.value = "1";
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
    label.title = item.description || "";

    const quantityInput = document.createElement("input");
    quantityInput.type = "number";
    quantityInput.min = "1";
    quantityInput.value = String(item.quantity);
    Object.assign(quantityInput.style, {
      width: "48px",
      background: "var(--input, transparent)",
      color: "inherit",
      border: "1px solid var(--border, rgba(0,0,0,0.2))",
      borderRadius: "4px",
      padding: "2px 4px",
    });
    quantityInput.addEventListener("change", async () => {
      const chatId = this.chatId;
      if (!chatId) return;
      try {
        const result = await QM.updateItem(chatId, QM_OWNER_ID, item.id, { quantity: quantityInput.value });
        this.items = result.items;
        this.error = null;
      } catch (error) {
        this.error = error && error.message ? error.message : String(error);
      }
      this._paint();
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    Object.assign(deleteButton.style, {
      background: "var(--destructive, #c0392b)",
      color: "var(--destructive-foreground, #fff)",
      border: "none",
      borderRadius: "4px",
      padding: "3px 8px",
      cursor: "pointer",
    });
    deleteButton.addEventListener("click", async () => {
      const chatId = this.chatId;
      if (!chatId) return;
      try {
        const result = await QM.deleteItem(chatId, QM_OWNER_ID, item.id);
        this.items = result.items;
        this.error = null;
      } catch (error) {
        this.error = error && error.message ? error.message : String(error);
      }
      this._paint();
    });

    topLine.append(label, quantityInput, deleteButton);

    const bottomLine = document.createElement("div");
    Object.assign(bottomLine.style, { display: "flex", alignItems: "center", gap: "6px" });

    const storedLabel = document.createElement("span");
    storedLabel.textContent = "Stored at:";
    Object.assign(storedLabel.style, { fontSize: "11px", color: "var(--muted-foreground, currentcolor)" });

    const storedInput = document.createElement("input");
    storedInput.type = "text";
    storedInput.placeholder = "bag";
    storedInput.value = item.location.startsWith("stored:") ? item.location.slice("stored:".length) : "";
    Object.assign(storedInput.style, {
      flex: "1",
      fontSize: "11px",
      background: "var(--input, transparent)",
      color: "inherit",
      border: "1px solid var(--border, rgba(0,0,0,0.2))",
      borderRadius: "4px",
      padding: "2px 4px",
    });
    storedInput.addEventListener("change", () => {
      const text = storedInput.value.trim();
      this._setLocation(item.id, text ? `stored:${text}` : "bag");
    });

    bottomLine.append(storedLabel, storedInput);

    row.append(topLine, bottomLine);
    return row;
  },
};

// ===== 90-element.js =====
// Quartermaster — capability package client entrypoint.
// Registers <marinara-capability-quartermaster>, mounted by the host once per
// slot instance with a "view" attribute telling us which one — "toolbar" for
// the compact roleplay-tracker launcher, "tracker" for the tracker-panel
// launcher. Both are just buttons that toggle QM.dock (10-dock.js), the
// self-managed floating panel — matches Beholder's src/90-element.js, where
// both slots launch the same BH.dock rather than each rendering their own
// content.
//
// v1 slice: persona-only inventory. No equip slots, images, locks, party
// members, or narrator ingestion yet.
//
// Game Mode coverage is unresolved — roleplay-tracker/tracker-panel are
// documented as Roleplay-only; not yet decided how (or whether) this reaches
// Game Mode.

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
  }

  get _chatId() {
    return this._props && typeof this._props.chatId === "string" ? this._props.chatId : null;
  }

  _render() {
    QM.dock.setChat(this._chatId);

    let button = this._button;
    if (!button || !this.contains(button)) {
      button = document.createElement("button");
      button.type = "button";
      button.addEventListener("click", () => QM.dock.toggle());
      this.replaceChildren(button);
      this._button = button;
    }

    const view = this.getAttribute("view");
    const props = this._props;
    const hostClass = props && typeof props.toolbarButtonClass === "string" ? props.toolbarButtonClass : "";
    button.className = `${hostClass} qm-launch`.trim();
    button.textContent = view === "tracker" ? "Open Quartermaster" : "Quartermaster";
    button.setAttribute("aria-pressed", QM.dock.isOpen() ? "true" : "false");
  }
}

const QUARTERMASTER_TAG = "marinara-capability-quartermaster";
if (!customElements.get(QUARTERMASTER_TAG)) customElements.define(QUARTERMASTER_TAG, QuartermasterElement);

})();
