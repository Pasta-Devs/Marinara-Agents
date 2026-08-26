// Quartermaster — inline tracker-panel accordion. Renders directly into the
// tracker-panel slot's element (unlike the toolbar slot, which is just a
// launcher button for QM.dock) as a native <details>/<summary> tree, matching
// how built-in trackers like Inventory Tracker show up as a collapsible
// section in the same panel: a top-level "Quartermaster" section containing
// three sub-sections (Equipped, Outfits, Inventory). A pure view over
// QM.state (05-state.js) — see 10-dock.js's header comment for why both
// views share one state module instead of each keeping their own copy.
//
// This is the compact, read-mostly companion to the floating dock: Equipped
// and Outfits can act (unequip/equip), Inventory is just name + qty per the
// requested scope — full editing (descriptions, stored locations, adding
// items) stays in the dock.

QM.panel = {
  container: null,
  unsubscribe: null,

  mount(container) {
    if (this.container === container) {
      this.paint();
      return;
    }
    this.unmount();
    this.container = container;
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
  },

  paint() {
    if (!this.container) return;
    this.container.replaceChildren(this._build());
  },

  _build() {
    const root = document.createElement("details");
    Object.assign(root.style, { fontSize: "12px", fontFamily: "system-ui, sans-serif" });

    const summary = document.createElement("summary");
    summary.textContent = "Quartermaster";
    Object.assign(summary.style, { cursor: "pointer", fontWeight: "600", padding: "4px 0" });
    root.appendChild(summary);

    if (!QM.state.chatId) {
      root.appendChild(QM.textNode("No active chat."));
      return root;
    }

    const body = document.createElement("div");
    Object.assign(body.style, { display: "flex", flexDirection: "column", gap: "4px", padding: "4px 0 4px 10px" });

    if (QM.state.error) {
      const errorNode = QM.textNode(`Error: ${QM.state.error}`);
      errorNode.style.color = QM_COLOR_DANGER;
      body.appendChild(errorNode);
    }

    body.append(
      this._buildSubsection("Equipped", this._buildEquipped()),
      this._buildSubsection("Outfits", this._buildOutfits()),
      this._buildSubsection("Inventory", this._buildInventory()),
    );

    root.appendChild(body);
    return root;
  },

  _buildSubsection(label, content) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = label;
    Object.assign(summary.style, { cursor: "pointer", padding: "3px 0" });
    Object.assign(details.style, { borderTop: "1px solid var(--border, rgba(128,128,128,0.2))" });
    details.append(summary, content);
    return details;
  },

  _row(children) {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "3px 0 3px 8px",
    });
    row.append(...children);
    return row;
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
      Object.assign(slotLabel.style, { color: "var(--muted-foreground, currentcolor)", fontSize: "11px" });

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
      Object.assign(wrapper.style, { padding: "3px 0 3px 8px" });

      const topLine = document.createElement("div");
      Object.assign(topLine.style, { display: "flex", alignItems: "center", gap: "6px" });

      const name = document.createElement("span");
      name.textContent = outfit.name;
      name.style.flex = "1";
      name.style.fontWeight = "600";

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
      Object.assign(itemsLine.style, { color: "var(--muted-foreground, currentcolor)", fontSize: "11px" });

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
      Object.assign(categoryLabel.style, {
        color: "var(--muted-foreground, currentcolor)",
        fontSize: "11px",
        padding: "3px 0 0 8px",
      });
      list.appendChild(categoryLabel);
      for (const item of category.items) {
        const name = document.createElement("span");
        name.textContent = item.name;
        name.style.flex = "1";
        const qty = document.createElement("span");
        qty.textContent = `×${item.quantity}`;
        qty.style.color = "var(--muted-foreground, currentcolor)";
        list.appendChild(this._row([name, qty]));
      }
    }
    return list;
  },

  _empty(text) {
    const node = document.createElement("div");
    node.textContent = text;
    Object.assign(node.style, { color: "var(--muted-foreground, currentcolor)", padding: "3px 0 3px 8px" });
    return node;
  },
};
