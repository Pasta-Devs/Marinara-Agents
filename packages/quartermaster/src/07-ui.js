// Quartermaster — small shared DOM-building helpers used by both QM.dock
// (the floating panel) and QM.panel (the inline tracker-panel accordion),
// so the two views stay visually and behaviorally consistent instead of
// each hand-rolling their own button/input styling.

QM.textNode = function textNode(text) {
  const node = document.createElement("p");
  node.style.margin = "0 0 8px";
  node.textContent = text;
  return node;
};

QM.sectionHeading = function sectionHeading(text) {
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
};

QM.smallInput = function smallInput(tag) {
  const el = document.createElement(tag);
  Object.assign(el.style, {
    background: "var(--input, transparent)",
    color: "inherit",
    border: "1px solid var(--border, rgba(0,0,0,0.2))",
    borderRadius: "4px",
    padding: "2px 4px",
    fontSize: "12px",
  });
  // <select>'s CLOSED box respects author background/color reliably, but the
  // OPEN dropdown popup is largely native-rendered by the browser —
  // Chromium in particular picks colors for it from the page's inherited
  // color-scheme, ignoring var(--input)/color:inherit, which produced
  // white-background/light-text. Forcing color-scheme: light plus explicit
  // (non-variable) colors fixes both the closed box and the popup
  // consistently — real theme-matching for the popup itself isn't reliably
  // achievable across browsers.
  if (tag === "select") {
    el.style.colorScheme = "light";
    el.style.background = "#fff";
    el.style.color = "#000";
  }
  return el;
};

// Shared button factory so danger/success/neutral styling stays consistent.
// bg/fg are CSS color values; border draws a themed outline for neutral
// (non-colored) buttons instead of a solid fill.
QM.button = function button(text, { bg, fg, border } = {}) {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = text;
  Object.assign(el.style, {
    background: bg ?? "var(--primary, #444)",
    color: fg ?? "var(--primary-foreground, #fff)",
    border: border ? "1px solid var(--border, rgba(0,0,0,0.2))" : "none",
    borderRadius: "4px",
    padding: "2px 8px",
    cursor: "pointer",
    fontSize: "12px",
  });
  return el;
};

QM.descriptionInput = function descriptionInput(item) {
  const input = QM.smallInput("input");
  input.type = "text";
  input.placeholder = "Description";
  input.value = item.description || "";
  input.addEventListener("change", () => QM.state.updateItem(item.id, { description: input.value }));
  return input;
};

QM.defaultSlotSelect = function defaultSlotSelect(item) {
  const select = QM.smallInput("select");
  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "Default slot…";
  select.appendChild(noneOption);
  // Underwear slots drop out of the picker while hidden, matching the
  // portrait ring — same "disabled AND hidden" behavior as the original
  // extension's groupEnabled(), not just a cosmetic hide.
  for (const slot of QM_EQUIP_SLOTS) {
    if (!QM.state.showUnderwear && QM_UNDERWEAR_SLOTS.has(slot)) continue;
    const option = document.createElement("option");
    option.value = slot;
    option.textContent = QM_SLOT_LABELS[slot];
    select.appendChild(option);
  }
  select.value = item.defaultSlot || "";
  select.addEventListener("change", () => QM.state.updateItem(item.id, { defaultSlot: select.value || null }));
  return select;
};
