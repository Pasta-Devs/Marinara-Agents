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
  underwearToggle: null,
  equippedContainer: null,
  outfitsContainer: null,
  outfitForm: null,
  form: null,
  listContainer: null,
  portraitWrapper: null,
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
      // Wider than the flat 3-column list this replaced — the center column
      // now needs room for a portrait flanked by two stacked slot columns on
      // each side, plus a slot row above and below it.
      width: "min(960px, 95vw)",
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
    this.underwearToggle = null;
    this.equippedContainer = null;
    this.outfitsContainer = null;
    this.outfitForm = null;
    this.form = null;
    this.listContainer = null;
    this.portraitWrapper = null;
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
      this.underwearToggle = null;
      this.equippedContainer = null;
      this.outfitsContainer = null;
      this.outfitForm = null;
      this.form = null;
      this.listContainer = null;
      this.portraitWrapper = null;
      this.portraitImage = null;
      this.portraitPlaceholder = null;
      return;
    }

    if (!this.form || !this.body.contains(this.form)) {
      this.errorNode = QM.textNode("");
      this.errorNode.style.color = QM_COLOR_DANGER;
      this.errorNode.style.display = "none";

      const feedRow = this._buildAppearanceFeedRow();
      const underwearRow = this._buildUnderwearToggleRow();

      // Built once and cached — the ring layout re-inserts this same node on
      // every repaint instead of rebuilding it, so equipping/unequipping
      // something doesn't reset or reload the portrait <img>.
      this.portraitWrapper = this._buildPortrait();

      const columns = document.createElement("div");
      Object.assign(columns.style, { display: "flex", gap: "12px", alignItems: "flex-start" });

      // Left: Outfits. Center: portrait ring. Right: Bag/Inventory.
      const outfitsColumn = document.createElement("div");
      Object.assign(outfitsColumn.style, { flex: "1", minWidth: "0" });
      this.outfitsContainer = document.createElement("div");
      this.outfitForm = this._buildSaveOutfitForm();
      outfitsColumn.append(QM.sectionHeading("Outfits"), this.outfitForm, this.outfitsContainer);

      const equippedColumn = document.createElement("div");
      Object.assign(equippedColumn.style, { flex: "1.6", minWidth: "0" });
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
      equippedColumn.append(equippedHeadingRow, this.equippedContainer);

      const bagColumn = document.createElement("div");
      Object.assign(bagColumn.style, { flex: "1", minWidth: "0" });
      this.form = this._buildAddItemForm();
      this.listContainer = document.createElement("div");
      bagColumn.append(QM.sectionHeading("Bag"), this.form, this.listContainer);

      columns.append(outfitsColumn, equippedColumn, bagColumn);
      this.body.replaceChildren(this.errorNode, feedRow, underwearRow, columns);
    }

    if (QM.state.error) {
      this.errorNode.textContent = `Error: ${QM.state.error}`;
      this.errorNode.style.display = "";
    } else {
      this.errorNode.style.display = "none";
    }

    this.feedSelect.value = QM.state.appearanceFeedMode;
    this.underwearToggle.checked = QM.state.showUnderwear;
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

  // A checkbox, not a select — this is a single on/off toggle, not a choice
  // among several modes. Off by default (see QM.state.showUnderwear):
  // matches the original extension's groupEnabled() convention of a group
  // hidden here removing its slots from both the portrait layout and the
  // equip picker (07-ui.js's defaultSlotSelect), not just a cosmetic hide.
  _buildUnderwearToggleRow() {
    const row = document.createElement("label");
    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      marginBottom: "8px",
      fontSize: "12px",
      cursor: "pointer",
    });

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", () => QM.state.updateShowUnderwear(checkbox.checked));
    this.underwearToggle = checkbox;

    const text = document.createElement("span");
    text.textContent = "Show underwear slots";
    text.style.color = "var(--muted-foreground, currentcolor)";

    row.append(checkbox, text);
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
  // arrangement, not slot membership.
  _buildEquippedSection() {
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, { display: "flex", flexDirection: "column", gap: "6px", alignItems: "center" });

    wrapper.appendChild(this._buildSlotBoxRow(QM_PORTRAIT_LAYOUT.top));

    const middleRow = document.createElement("div");
    Object.assign(middleRow.style, { display: "flex", gap: "8px", alignItems: "flex-start", justifyContent: "center" });

    const leftStack = document.createElement("div");
    Object.assign(leftStack.style, { display: "flex", gap: "4px" });
    for (const group of QM_PORTRAIT_LAYOUT.left) {
      leftStack.appendChild(this._buildSlotBoxColumn(group.header, group.slots));
    }
    // Stacked beneath the Clothing column specifically (the last column
    // appended above), not a third column of its own — matches "underneath
    // clothing" from the requested layout. Dropped entirely while hidden,
    // same as every other underwear-gated surface (05-state.js/07-ui.js).
    if (QM.state.showUnderwear) {
      const clothingColumn = leftStack.lastElementChild;
      clothingColumn.appendChild(this._buildSlotBoxColumnHeading(QM_PORTRAIT_LAYOUT.underwear.header));
      for (const slot of QM_PORTRAIT_LAYOUT.underwear.slots) clothingColumn.appendChild(this._buildSlotBox(slot));
    }

    const rightStack = document.createElement("div");
    Object.assign(rightStack.style, { display: "flex", gap: "4px" });
    for (const group of QM_PORTRAIT_LAYOUT.right) {
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
    // A stored defaultSlot can still point at an underwear slot that's since
    // been hidden (defaultSlotSelect just won't offer it as an option
    // anymore) — block the shortcut button too, or it'd be the one way left
    // to equip into a slot the toggle is supposed to disable.
    const canEquip = Boolean(item.defaultSlot) && (QM.state.showUnderwear || !QM_UNDERWEAR_SLOTS.has(item.defaultSlot));
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
