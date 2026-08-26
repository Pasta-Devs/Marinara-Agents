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
