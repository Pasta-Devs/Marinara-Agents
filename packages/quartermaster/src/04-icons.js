// Quartermaster — simple inline SVG pictograms, one per equip slot, shown in
// an equipped-slot box when the slot has no equipped item, or when it does
// but that item has no matching image (see _buildOverlaySlotBox's own
// fallback logic). Deliberately plain geometric silhouettes rather than
// detailed art — they render at ~32px, and fill="currentColor" so they
// inherit whatever color the box's own text is using rather than carrying
// their own.
const QM_SLOT_ICON_PATHS = {
  head: '<path d="M12 3a7 7 0 0 0-7 7v3.5A1.5 1.5 0 0 0 6.5 15H8v2h8v-2h1.5a1.5 1.5 0 0 0 1.5-1.5V10a7 7 0 0 0-7-7Z"/><rect x="9" y="10.5" width="6" height="1.4" rx="0.7"/>',
  neck: '<path d="M6 4 L12 12 L18 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="15" r="2.6"/>',
  eyes: '<path d="M2 12s4-6.5 10-6.5S22 12 22 12s-4 6.5-10 6.5S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="12" r="2.8"/>',
  ears: '<path d="M9.5 3.5c3.6 0 5.8 2.7 5.8 5.8 0 1.8-.9 2.8-.9 4.5 0 1.4-1.1 2.7-2.7 2.7-1.1 0-1.9-.7-1.9-1.8 0-.9.7-1.4.7-2.5 0-1.2-1-1.9-1-3.2 0-2.3.8-4 0-5.5Z"/>',
  hands:
    '<path d="M7.2 9.2a4.8 4.8 0 0 1 9.6 0v5.6a4.8 4.8 0 0 1-9.6 0Z"/><path d="M6 10.5a2 2 0 0 1 2.8-1.8L8 12.5H6Z"/>',
  back: '<rect x="6" y="7" width="12" height="14" rx="3"/><path d="M9 7V5.2a3 3 0 0 1 6 0V7" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="9" y="13" width="6" height="4" rx="1" fill-opacity="0.35"/>',
  armor_torso: '<path d="M12 2.5 6.5 5.5v5c0 6 2.7 10 5.5 10s5.5-4 5.5-10v-5Z"/>',
  clothing_torso: '<path d="M8.3 3.8 4 6.8l2 3.2 2-1V20h8V9l2 1 2-3.2-4.3-3-1.7 1.6h-3Z"/>',
  armor_legs:
    '<rect x="6.5" y="4" width="4.2" height="16" rx="1.8"/><rect x="13.3" y="4" width="4.2" height="16" rx="1.8"/>',
  clothing_legs: '<path d="M7 3h10l1 8.5-1.3 9.5h-2.9l-1.3-10-1.3 10H8.3L7 11.5Z"/>',
  underwear_top:
    '<path d="M4 8c0-2.3 1.9-4.3 4-4.3S11.3 5.7 11.3 8c0 2.2-2 5.2-3.3 5.2S4 10.2 4 8Z"/><path d="M20 8c0-2.3-1.9-4.3-4-4.3S12.7 5.7 12.7 8c0 2.2 2 5.2 3.3 5.2S20 10.2 20 8Z"/>',
  underwear_bottom: '<path d="M5 5h14l-1.1 6.2c-.9 4.7-2.9 7.3-5.9 7.3s-5-2.6-5.9-7.3Z"/>',
  weapon_left_hand:
    '<path d="M11.3 2 12.7 2 12.7 14 11.3 14Z"/><rect x="8.3" y="14" width="7.4" height="1.8" rx="0.9"/><rect x="11.1" y="15.8" width="1.8" height="5.7" rx="0.9"/>',
  weapon_right_hand:
    '<path d="M11.3 2 12.7 2 12.7 14 11.3 14Z"/><rect x="8.3" y="14" width="7.4" height="1.8" rx="0.9"/><rect x="11.1" y="15.8" width="1.8" height="5.7" rx="0.9"/>',
  belt: '<rect x="2" y="10" width="20" height="4" rx="1.2"/><rect x="9.3" y="8.3" width="5.4" height="7.4" rx="1" fill-opacity="0.35"/>',
  feet: '<path d="M9 3h4v9.3l4.4 3.1c1.4 1 .7 3.1-1 3.1H7.4C6.6 18.5 6 17.8 6 17V8.5C6 5.5 7.2 3 9 3Z"/>',
};

// <svg fill="currentColor"> wrapper around a slot's path markup — sizePx is
// both width and height (icons are always square). Falls back to a plain
// empty <svg> for an unrecognized slot rather than throwing, since a future
// slot addition shouldn't be able to break rendering.
QM.buildSlotIcon = function buildSlotIcon(slot, sizePx) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(sizePx));
  svg.setAttribute("height", String(sizePx));
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = QM_SLOT_ICON_PATHS[slot] ?? "";
  return svg;
};

// The bundled photographic slot icon (server.mjs's SLOT_ICON_FILES) as an
// <img>, falling back to the plain SVG pictogram above on a 404 or load
// failure — same "always render something" guarantee buildSlotIcon itself
// gives for an unrecognized slot. object-fit: contain, not cover: several of
// these (the sword, the necklace) are tall/thin or wide/short rather than
// square, and cover would crop off the point or the pendant to fill a square
// box; contain letterboxes instead, which reads fine against the box's own
// dark background.
QM.buildSlotIconRaster = function buildSlotIconRaster(slot, sizePx) {
  const img = document.createElement("img");
  img.alt = "";
  img.setAttribute("aria-hidden", "true");
  Object.assign(img.style, { width: `${sizePx}px`, height: `${sizePx}px`, objectFit: "contain", display: "block" });
  img.addEventListener("error", () => {
    img.replaceWith(QM.buildSlotIcon(slot, sizePx));
  });
  img.src = QM.slotIconUrl(slot);
  return img;
};
