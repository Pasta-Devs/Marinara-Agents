// Pending Item Changes: an agent change to a hidden item waiting on the user
// (server.mjs's queuePendingHiddenChange, while "Ask before agent changes to
// hidden items" is on). qmBuildPendingEntry is one entry's review card,
// shared by the popup below and the dock's own Pending Item Changes section.
// Only Accept or Keep settles an entry; closing the popup just leaves the
// rest waiting in the dock.

// pendingId -> the server's { stale, before, current, after } answer to an
// accept, or { gone: true } once the item turned out deleted; and pendingId
// -> the "Show item" box's state. Both live outside the DOM so a repaint
// (the dock and popup rebuild their cards on every state change) keeps them.
const qmPendingReviews = new Map();
const qmPendingShowChoices = new Map();

const QM_PENDING_FIELDS = [
  { key: "description", label: "Description", format: (value) => value || "(none)" },
  { key: "quantity", label: "Quantity", format: (value) => String(value) },
  { key: "location", label: "Location", format: (value) => qmLocationLabel(value) },
];

// [Field | column 1 | column 2 ...], listing only fields that differ
// between the columns. columns: [{ title, fields }].
function qmBuildPendingComparison(columns) {
  const changed = QM_PENDING_FIELDS.filter(({ key }) =>
    columns.some((column) => column.fields[key] !== columns[0].fields[key]),
  );
  if (changed.length === 0) {
    const same = QM.textNode("Nothing would change.");
    Object.assign(same.style, { margin: "0", fontSize: "11px", color: "var(--muted-foreground, currentcolor)" });
    return same;
  }
  const grid = document.createElement("div");
  Object.assign(grid.style, {
    display: "grid",
    gridTemplateColumns: `auto repeat(${columns.length}, minmax(0, 1fr))`,
    gap: "4px 8px",
    fontSize: "11px",
  });
  const cell = (text, style) => {
    const el = document.createElement("div");
    el.textContent = text;
    Object.assign(el.style, { wordBreak: "break-word", minWidth: "0", ...style });
    return el;
  };
  grid.appendChild(cell("", {}));
  for (const column of columns) grid.appendChild(cell(column.title, { fontWeight: "600" }));
  for (const field of changed) {
    grid.appendChild(cell(field.label, { color: "var(--muted-foreground, currentcolor)" }));
    for (const column of columns) {
      grid.appendChild(cell(field.format(column.fields[field.key]), { maxHeight: "84px", overflowY: "auto" }));
    }
  }
  return grid;
}

function qmBuildPendingEntry(entry) {
  const card = document.createElement("div");
  Object.assign(card.style, {
    border: "1px solid var(--border, rgba(128,128,128,0.4))",
    borderRadius: "var(--radius, 4px)",
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  });

  const title = document.createElement("div");
  title.textContent = entry.before.name;
  title.style.fontWeight = "600";
  card.appendChild(title);

  const note = (text) => {
    const line = QM.textNode(text);
    Object.assign(line.style, { margin: "0", fontSize: "11px", color: "var(--muted-foreground, currentcolor)" });
    card.appendChild(line);
  };
  const buttons = [];
  const actionButton = (label, primary, onClick) => {
    const button = primary
      ? QM.button(label)
      : QM.button(label, {
          bg: "var(--secondary, transparent)",
          fg: "var(--secondary-foreground, inherit)",
          border: true,
        });
    Object.assign(button.style, { padding: "3px 10px", fontSize: "11px" });
    button.addEventListener("click", onClick);
    buttons.push(button);
    return button;
  };

  // Ticked: the item is shown again once this is settled, whichever way.
  // Starts from the access setting, but unticked for a removal-only change.
  const showLabel = document.createElement("label");
  Object.assign(showLabel.style, {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    cursor: "pointer",
  });
  const showBox = document.createElement("input");
  showBox.type = "checkbox";
  showBox.checked =
    qmPendingShowChoices.get(entry.id) ?? (!entry.remove && qmAccessModeShows(QM.state.hiddenItemAccess));
  showBox.addEventListener("change", () => qmPendingShowChoices.set(entry.id, showBox.checked));
  const showText = document.createElement("span");
  showText.textContent = "Show (unhide) this item";
  showLabel.append(showBox, showText);

  const settle = async (decision, extra = {}) => {
    for (const button of buttons) button.disabled = true;
    const result = await QM.state.resolvePending(entry.id, { decision, show: showBox.checked, ...extra });
    if (result.stale || result.gone) {
      qmPendingReviews.set(entry.id, result);
      QM.state._notify();
    } else if (result.error) {
      for (const button of buttons) button.disabled = false;
    } else {
      qmPendingReviews.delete(entry.id);
      qmPendingShowChoices.delete(entry.id);
    }
  };

  const review = qmPendingReviews.get(entry.id);
  const actions = document.createElement("div");
  Object.assign(actions.style, { display: "flex", flexWrap: "wrap", gap: "6px" });

  if (review?.gone) {
    note("This item was deleted, so the agent's change can't be applied.");
    actions.append(actionButton("Dismiss", true, () => settle("keep", { show: false })));
    card.appendChild(actions);
    return card;
  }

  if (review?.stale) {
    // What "Apply" would really produce: only the fields the agent changed,
    // laid over the item as it is now (the resolve route's override).
    const applied = { ...review.current };
    for (const { key } of QM_PENDING_FIELDS) {
      if (review.after[key] !== review.before[key]) applied[key] = review.after[key];
    }
    note("This item changed after the agent suggested this. Compare, then choose.");
    card.appendChild(
      qmBuildPendingComparison([
        { title: "When suggested", fields: review.before },
        { title: "Now", fields: review.current },
        { title: "With agent's change", fields: applied },
      ]),
    );
    card.appendChild(showLabel);
    actions.append(
      actionButton("Apply the agent's change", true, () => settle("accept", { override: true })),
      actionButton("Keep current", false, () => settle("keep")),
    );
    card.appendChild(actions);
    return card;
  }

  if (entry.remove) {
    note("The agent wants to remove this hidden item.");
  } else {
    card.appendChild(
      qmBuildPendingComparison([
        { title: "Now", fields: entry.before },
        { title: "Agent's change", fields: entry.after },
      ]),
    );
  }
  if (entry.descriptionLocked && !entry.remove && entry.after.description !== entry.before.description) {
    note("Its description is locked; accepting changes it anyway.");
  }
  card.appendChild(showLabel);
  actions.append(
    actionButton("Accept changes", true, () => settle("accept")),
    actionButton("Keep old item details", false, () => settle("keep")),
  );
  card.appendChild(actions);
  return card;
}

// Opens by itself (on document.body, so it shows with the dock closed) when
// unseen pending changes arrive. Closing it marks what's left as seen, so it
// won't reopen for them; they stay in the dock's Pending Item Changes.
QM.pendingPopup = {
  backdrop: null,
  list: null,
  chatId: null,
  // Entries this popup is showing; grows if more arrive while it's open.
  ids: new Set(),
  // Closed-on entries, so the popup can't reopen for them while the
  // markPendingSeen request is still in flight.
  deferred: new Set(),
  _escapeHandler: null,

  sync() {
    if (this.chatId !== QM.state.chatId) {
      this._remove();
      this.deferred.clear();
      this.chatId = QM.state.chatId;
    }
    const entries = QM.state.pendingHiddenChanges ?? [];
    const unseen = entries.filter((entry) => !entry.seen && !this.deferred.has(entry.id));
    if (!this.backdrop && unseen.length === 0) return;
    if (!this.backdrop) this._open();
    for (const entry of unseen) this.ids.add(entry.id);
    const shown = entries.filter((entry) => this.ids.has(entry.id));
    if (shown.length === 0) {
      this._remove();
      return;
    }
    this.list.replaceChildren(...shown.map((entry) => qmBuildPendingEntry(entry)));
  },

  close() {
    const remaining = (QM.state.pendingHiddenChanges ?? [])
      .filter((entry) => this.ids.has(entry.id) && !entry.seen)
      .map((entry) => entry.id);
    for (const id of remaining) this.deferred.add(id);
    this._remove();
    QM.state.markPendingSeen(remaining);
  },

  _open() {
    const backdrop = document.createElement("div");
    Object.assign(backdrop.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(0, 0, 0, 0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
      boxSizing: "border-box",
      zIndex: "10000",
    });
    backdrop.addEventListener("pointerdown", (event) => {
      if (event.target === backdrop) this.close();
    });

    const panel = document.createElement("div");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Pending Item Changes");
    Object.assign(panel.style, {
      background: "var(--card, #1c1c1c)",
      color: "var(--card-foreground, inherit)",
      border: "1px solid var(--border, rgba(128,128,128,0.3))",
      borderRadius: "var(--radius, 6px)",
      padding: "12px",
      width: "min(440px, 100%)",
      maxHeight: "100%",
      overflowY: "auto",
      boxSizing: "border-box",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      fontSize: "12px",
    });

    const header = document.createElement("div");
    Object.assign(header.style, { display: "flex", alignItems: "center", gap: "8px" });
    const title = document.createElement("div");
    title.textContent = "Pending Item Changes";
    Object.assign(title.style, { fontWeight: "600", flex: "1" });
    const closeButton = QM.button("×", { bg: "transparent", border: true, fg: "inherit" });
    closeButton.style.padding = "0 6px";
    closeButton.setAttribute("aria-label", "Decide later");
    closeButton.title = "Decide later";
    closeButton.addEventListener("click", () => this.close());
    header.append(title, closeButton);

    const intro = QM.textNode(
      "The agent tried to change hidden items. Closing this keeps them waiting under Pending Item Changes " +
        "in Quartermaster.",
    );
    Object.assign(intro.style, { margin: "0", fontSize: "11px", color: "var(--muted-foreground, currentcolor)" });

    const list = document.createElement("div");
    Object.assign(list.style, { display: "flex", flexDirection: "column", gap: "8px" });

    panel.append(header, intro, list);
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);
    this.backdrop = backdrop;
    this.list = list;
    this._escapeHandler = (event) => {
      if (event.key === "Escape") this.close();
    };
    document.addEventListener("keydown", this._escapeHandler);
  },

  _remove() {
    this.backdrop?.remove();
    this.backdrop = null;
    this.list = null;
    this.ids = new Set();
    if (this._escapeHandler) document.removeEventListener("keydown", this._escapeHandler);
    this._escapeHandler = null;
  },
};

QM.state.subscribe(() => QM.pendingPopup.sync());
