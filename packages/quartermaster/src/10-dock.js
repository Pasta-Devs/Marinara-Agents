// Quartermaster — self-managed floating sheet panel. Mirrors Beholder's
// BH.dock (src/80-dock.js): the host's Tracker Panel is small and shared
// chrome, not roomy enough for a real character-sheet layout (portrait,
// equip-slot columns, inventory grid). So the panel lives in its own
// fixed-position element appended to document.body, independent of any
// host-provided slot container, and BOTH the roleplay-tracker toolbar
// button and the tracker-panel launcher just toggle this same panel open.
//
// v1 slice: still just the persona item list from 00-element.js's earlier
// inline version, relocated here. No equip slots/portrait/party tabs yet.

const QM_OWNER_ID = "persona";

QM.dock = {
  chatId: null,
  isOpenFlag: false,
  root: null,
  body: null,
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
      width: "340px",
      maxHeight: "70vh",
      display: "none",
      flexDirection: "column",
      background: "#fff",
      color: "#1a1a1a",
      border: "1px solid rgba(0,0,0,0.15)",
      borderRadius: "8px",
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
      borderBottom: "1px solid rgba(0,0,0,0.1)",
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

  _paint() {
    if (!this.body) return;
    const chatId = this.chatId;
    this.body.replaceChildren();

    if (!chatId) {
      this.body.appendChild(this._textNode("No active chat."));
      return;
    }

    if (this.error) {
      const errorNode = this._textNode(`Error: ${this.error}`);
      errorNode.style.color = "#c0392b";
      this.body.appendChild(errorNode);
    }

    this.body.appendChild(this._buildAddItemForm(chatId));
    this.body.appendChild(this._buildItemList(chatId));
  },

  _textNode(text) {
    const node = document.createElement("p");
    node.style.margin = "0 0 8px";
    node.textContent = text;
    return node;
  },

  _buildAddItemForm(chatId) {
    const form = document.createElement("form");
    Object.assign(form.style, { display: "flex", gap: "6px", marginBottom: "10px" });

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Item name";
    nameInput.required = true;
    nameInput.style.flex = "1";

    const quantityInput = document.createElement("input");
    quantityInput.type = "number";
    quantityInput.min = "1";
    quantityInput.value = "1";
    quantityInput.style.width = "56px";

    const addButton = document.createElement("button");
    addButton.type = "submit";
    addButton.textContent = "Add";

    form.append(nameInput, quantityInput, addButton);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      if (!name) return;
      addButton.disabled = true;
      try {
        const result = await QM.addItem(chatId, QM_OWNER_ID, { name, quantity: quantityInput.value });
        this.items = result.items;
        this.error = null;
      } catch (error) {
        this.error = error && error.message ? error.message : String(error);
      }
      this._paint();
    });

    return form;
  },

  _buildItemList(chatId) {
    const list = document.createElement("ul");
    Object.assign(list.style, {
      listStyle: "none",
      margin: "0",
      padding: "0",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    });

    const items = this.items ?? [];
    if (items.length === 0) {
      const empty = this._textNode("No items yet.");
      empty.style.opacity = "0.7";
      list.appendChild(empty);
      return list;
    }

    for (const item of items) {
      list.appendChild(this._buildItemRow(chatId, item));
    }
    return list;
  },

  _buildItemRow(chatId, item) {
    const row = document.createElement("li");
    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      border: "1px solid rgba(128,128,128,0.3)",
      borderRadius: "4px",
      padding: "4px 6px",
    });

    const label = document.createElement("span");
    label.textContent = item.name;
    label.style.flex = "1";
    label.title = item.description || "";

    const quantityInput = document.createElement("input");
    quantityInput.type = "number";
    quantityInput.min = "1";
    quantityInput.value = String(item.quantity);
    quantityInput.style.width = "48px";
    quantityInput.addEventListener("change", async () => {
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
    deleteButton.addEventListener("click", async () => {
      try {
        const result = await QM.deleteItem(chatId, QM_OWNER_ID, item.id);
        this.items = result.items;
        this.error = null;
      } catch (error) {
        this.error = error && error.message ? error.message : String(error);
      }
      this._paint();
    });

    row.append(label, quantityInput, deleteButton);
    return row;
  },
};
