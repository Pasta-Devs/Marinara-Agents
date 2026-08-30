// Quartermaster — small shared DOM-building helpers used by both QM.dock
// (the floating panel) and QM.panel (the inline tracker-panel accordion),
// so the two views stay visually and behaviorally consistent instead of
// each hand-rolling their own button/input styling.

// Inline styles (Object.assign(el.style, ...) below) can't express :hover,
// :active, or :focus-visible at all — those need a real stylesheet rule.
// Injected once, globally, since both the dock and the tracker-panel
// accordion share QM.button(). brightness() rather than per-variant hover
// colors so it works uniformly across every bg (--primary, --secondary, the
// fixed danger/success reds/greens) without a hover color per variant.
const QM_BUTTON_STYLE_ID = "qm-button-style";
const QM_BUTTON_STYLE = `
.qm-btn{ transition: filter 0.1s ease, transform 0.05s ease; }
.qm-btn:hover{ filter: brightness(1.12); }
.qm-btn:active{ filter: brightness(0.92); transform: translateY(1px); }
.qm-btn:focus-visible{ outline: 2px solid var(--ring, var(--border, currentcolor)); outline-offset: 1px; }
`;

function qmEnsureButtonStyle() {
  if (document.getElementById(QM_BUTTON_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = QM_BUTTON_STYLE_ID;
  style.textContent = QM_BUTTON_STYLE;
  (document.head || document.body).appendChild(style);
}

QM.textNode = function textNode(text) {
  const node = document.createElement("p");
  node.style.margin = "0 0 8px";
  node.textContent = text;
  return node;
};

// Centered — the Outfits/Equipped/Bag column headings sat flush left before
// (the default for a block element), which read as misaligned against the
// centered portrait ring between them. In the Equipped column the heading
// sits in a grid alongside the Unequip All button (10-dock.js), which
// centers it via a spacer column regardless of this text-align; here it
// matters for Outfits/Bag, where the heading is the column's sole full-width
// child.
QM.sectionHeading = function sectionHeading(text) {
  const heading = document.createElement("h3");
  heading.textContent = text;
  Object.assign(heading.style, {
    margin: "0 0 6px",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "var(--muted-foreground, currentcolor)",
    textAlign: "center",
  });
  return heading;
};

QM.smallInput = function smallInput(tag) {
  const el = document.createElement(tag);
  Object.assign(el.style, {
    background: "var(--input, transparent)",
    color: "inherit",
    border: "1px solid var(--border, rgba(0,0,0,0.2))",
    borderRadius: "var(--radius, 4px)",
    padding: "2px 4px",
    fontSize: "12px",
  });
  // <select>'s CLOSED box respects author background/color reliably, but the
  // OPEN dropdown popup is largely native-rendered by the browser —
  // Chromium in particular picks its colors from color-scheme, ignoring
  // var(--input)/color:inherit. Rather than hardcoding light (which put a
  // bright white popup against a dark app), read the Engine's own theme
  // signal — App.tsx sets document.documentElement.dataset.theme on every
  // theme change, mirrored to :root's own color-scheme — and match it, so
  // the popup at least looks native-dark or native-light instead of always
  // light. Still an approximation (real per-variable popup theming isn't
  // reliably achievable across browsers), but a matching native scheme reads
  // far less jarring than a fixed white box in a dark app.
  if (tag === "select") {
    const isDark = document.documentElement.dataset.theme !== "light";
    el.style.colorScheme = isDark ? "dark" : "light";
    el.style.background = isDark ? "#1a1a1a" : "#fff";
    el.style.color = isDark ? "#f2f2f2" : "#000";
  }
  return el;
};

// Shared button factory so danger/success/neutral styling stays consistent.
// bg/fg are CSS color values; border draws a themed outline for neutral
// (non-colored) buttons instead of a solid fill.
QM.button = function button(text, { bg, fg, border } = {}) {
  qmEnsureButtonStyle();
  const el = document.createElement("button");
  el.type = "button";
  el.className = "qm-btn";
  el.textContent = text;
  Object.assign(el.style, {
    background: bg ?? "var(--primary, #444)",
    color: fg ?? "var(--primary-foreground, #fff)",
    border: border ? "1px solid var(--border, rgba(0,0,0,0.2))" : "none",
    borderRadius: "var(--radius, 4px)",
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
  // A hidden group's slots drop out of the picker, matching the portrait
  // ring — same "disabled AND hidden" behavior as the original extension's
  // groupEnabled(), not just a cosmetic hide.
  for (const slot of QM_EQUIP_SLOTS) {
    if (!QM.state.slotVisible(slot)) continue;
    const option = document.createElement("option");
    option.value = slot;
    option.textContent = QM_SLOT_LABELS[slot];
    select.appendChild(option);
  }
  select.value = item.defaultSlot || "";
  select.addEventListener("change", () => QM.state.updateItem(item.id, { defaultSlot: select.value || null }));
  return select;
};
