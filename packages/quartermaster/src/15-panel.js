// Quartermaster — inline tracker-panel accordion. Renders directly into the
// tracker-panel slot's element (unlike the toolbar slot, which is just a
// launcher button for QM.dock), matching how built-in trackers show up as a
// collapsible section in the same panel: a top-level "Quartermaster" section
// containing three sub-sections (Equipped, Outfits, Inventory). A pure view
// over QM.state (05-state.js) — see 10-dock.js's header comment for why both
// views share one state module instead of each keeping their own copy.
//
// Headers are hand-built <div>/<button> structures, NOT <details>/<summary>.
// The Engine's native section header (SectionHeader in SectionControls.tsx)
// is a clickable button containing, in order, a rotating chevron span, an
// icon span, and a title span, with its own hover/focus treatment — <summary>
// has no equivalent slot for the icon and no hover styling hook that matches.
// memory-nag (MemoryNagTrackerPanel.tsx), a real capability package rendering
// into this same tracker-panel slot, independently hand-builds the identical
// chevron-frame → icon → title layout with manually-tracked collapsed state
// for the same reason — confirming this is the established pattern for
// package-supplied tracker-panel content, not just native-only.
//
// The whole DOM tree (including headers) is built ONCE and cached (this.root,
// per-section refs in this._sections) — only each section's content <div>
// gets replaceChildren() on every repaint, and expanded/collapsed state lives
// in this.expanded rather than in the DOM. Rebuilding elements from scratch on
// every equip/unequip (the first version did this with <details>) reset them
// to closed every time, since a freshly-created element has no memory of
// prior state — collapsing the whole menu on every click.
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
// Header container: layout/border only, not interactive — mirrors
// SectionHeader's outer element in SectionControls.tsx.
const QM_TRACKER_HEADER_CLASS =
  "relative flex min-h-7 items-center gap-1 border-b border-[var(--border)]/42 px-1 py-0.5";
// The actual clickable toggle inside the header — carries the hover/focus
// treatment, copied verbatim from SectionHeader's button className.
const QM_TRACKER_TOGGLE_CLASS =
  "flex min-w-0 flex-1 items-center gap-1 self-stretch rounded-sm px-0 text-left cursor-pointer select-none transition-colors hover:bg-[var(--accent)]/18 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--border)]";
const QM_TRACKER_CHEVRON_FRAME_CLASS = "flex h-3.5 w-3 shrink-0 items-center justify-center";
const QM_TRACKER_CHEVRON_CLASS =
  "text-[color:var(--tracker-profile-icon,var(--muted-foreground))] opacity-60 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]";
const QM_TRACKER_ICON_CLASS =
  "flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[color:var(--tracker-profile-icon,var(--muted-foreground))] opacity-75";
const QM_TRACKER_TITLE_CLASS =
  "min-w-0 flex-1 truncate font-semibold uppercase tracking-[0.08em] text-[var(--foreground)]/62 " +
  QM_TRACKER_TEXT_MICRO;
// Lucide's ChevronDown path, redrawn at a fixed pixel size (not left to the
// component's own 24x24 default) so it actually fits the chevron frame —
// memory-nag's own chevron CSS does the same thing (explicit width/height on
// the icon itself) rather than relying on the frame to clip it.
const QM_TRACKER_CHEVRON_SVG =
  '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
  '<path d="m6 9 6 6 6-6"></path>' +
  "</svg>";
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
  // Collapsed by default for every section, matching the previous
  // <details>-without-`open`-attribute behavior — this rewrite changes how
  // the header looks and where state lives, not the default open/closed
  // state. Persists across repaints and container remounts (e.g. switching
  // between detached/docked tracker panel) since it lives on `this`, not
  // rebuilt with the DOM.
  expanded: { root: false, equipped: false, outfits: false, inventory: false },
  _sections: null,

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
    const root = document.createElement("div");
    root.className = QM_TRACKER_SECTION_SHELL_CLASS;

    const rootSection = this._buildHeader("Quartermaster", QM_ICON_SVG, "root");
    root.appendChild(rootSection.header);

    const body = document.createElement("div");
    Object.assign(body.style, { display: "flex", flexDirection: "column" });

    this.errorNode = document.createElement("div");
    this.errorNode.className = QM_TRACKER_ROW_CLASS;
    this.errorNode.style.color = QM_COLOR_DANGER;
    this.errorNode.style.display = "none";

    const equipped = this._buildSubsection("Equipped", "equipped");
    this.equippedContent = equipped.content;
    const outfits = this._buildSubsection("Outfits", "outfits");
    this.outfitsContent = outfits.content;
    const inventory = this._buildSubsection("Inventory", "inventory");
    this.inventoryContent = inventory.content;

    body.append(this.errorNode, equipped.wrapper, outfits.wrapper, inventory.wrapper);
    root.appendChild(body);

    this._sections = {
      root: { toggle: rootSection.toggle, chevron: rootSection.chevron, content: body },
      equipped: { toggle: equipped.toggle, chevron: equipped.chevron, content: equipped.content },
      outfits: { toggle: outfits.toggle, chevron: outfits.chevron, content: outfits.content },
      inventory: { toggle: inventory.toggle, chevron: inventory.chevron, content: inventory.content },
    };
    this._applyExpanded();

    this.container.replaceChildren(root);
    this.root = root;
  },

  // Hand-built replica of the native SectionHeader (SectionControls.tsx): a
  // header shell (layout/border only) containing one clickable toggle button
  // with a rotating chevron, an optional package icon, and a title — see the
  // file-level comment for why this replaces <details>/<summary>. `iconSvg`
  // is only passed for the root section: nested sub-sections aren't separate
  // packages, so they get the chevron + hover + title but no icon slot.
  _buildHeader(label, iconSvg, key) {
    const header = document.createElement("div");
    header.className = QM_TRACKER_HEADER_CLASS;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = QM_TRACKER_TOGGLE_CLASS;

    const chevronFrame = document.createElement("span");
    chevronFrame.className = QM_TRACKER_CHEVRON_FRAME_CLASS;
    chevronFrame.setAttribute("aria-hidden", "true");
    const chevron = document.createElement("span");
    chevron.className = QM_TRACKER_CHEVRON_CLASS;
    chevron.innerHTML = QM_TRACKER_CHEVRON_SVG;
    chevronFrame.appendChild(chevron);
    toggle.appendChild(chevronFrame);

    if (iconSvg) {
      const iconSpan = document.createElement("span");
      iconSpan.className = QM_TRACKER_ICON_CLASS;
      iconSpan.setAttribute("aria-hidden", "true");
      iconSpan.innerHTML = iconSvg;
      toggle.appendChild(iconSpan);
    }

    const title = document.createElement("span");
    title.textContent = label;
    title.className = QM_TRACKER_TITLE_CLASS;
    toggle.appendChild(title);

    toggle.setAttribute("aria-label", label);
    toggle.addEventListener("click", () => this._toggleSection(key));
    header.appendChild(toggle);

    return { header, toggle, chevron };
  },

  _buildSubsection(label, key) {
    const wrapper = document.createElement("div");
    const built = this._buildHeader(label, null, key);
    const content = document.createElement("div");
    wrapper.append(built.header, content);
    return { wrapper, content, toggle: built.toggle, chevron: built.chevron };
  },

  _toggleSection(key) {
    this.expanded[key] = !this.expanded[key];
    this._applyExpanded();
  },

  _applyExpanded() {
    if (!this._sections) return;
    for (const key of Object.keys(this._sections)) {
      const { toggle, chevron, content } = this._sections[key];
      const open = this.expanded[key];
      content.style.display = open ? "" : "none";
      chevron.classList.toggle("-rotate-90", !open);
      toggle.setAttribute("aria-expanded", String(open));
    }
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
