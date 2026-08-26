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
