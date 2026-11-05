const forgeUnitPortraitSelector = '.gf-stage > .gf-view > .root > [data-screen="unit"] .cp-portrait';

function forgeUnitImageUrl(image, host) {
  try {
    const source = image?.getAttribute("src");
    return source?.trim() ? new URL(source, host.ownerDocument.baseURI).href : "";
  } catch {
    return "";
  }
}

/** Retain the decoded resource only for an unchanged unit portrait, not its controls or panels. */
export function captureForgeUnitPortrait(host, screen) {
  if (screen !== "unit" || host._lastScreen !== "unit" || host._portraitOpen) return null;
  const node = host._root?.querySelector(forgeUnitPortraitSelector);
  const image = node?.querySelector(".cp-photo");
  const unitId = node?.closest("[data-fly]")?.getAttribute("data-fly");
  const source = forgeUnitImageUrl(image, host);
  if (!unitId || unitId !== host._rosterUnitId || !source || !image?.complete || !(image.naturalWidth > 0)) return null;
  // A pending replacement may still expose its previously decoded currentSrc.
  if (image.currentSrc && new URL(image.currentSrc, host.ownerDocument.baseURI).href !== source) return null;
  return { node, image, unitId, source };
}

export function restoreForgeUnitPortrait(host, saved) {
  if (
    !saved ||
    host._portraitOpen ||
    host._rosterUnitId !== saved.unitId ||
    !saved.image.complete ||
    !(saved.image.naturalWidth > 0)
  )
    return;
  if (forgeUnitImageUrl(saved.image, host) !== saved.source) return;
  const node = host._root?.querySelector(forgeUnitPortraitSelector);
  if (node?.closest("[data-fly]")?.getAttribute("data-fly") !== saved.unitId) return;
  const image = node?.querySelector(".cp-photo");
  if (!image || forgeUnitImageUrl(image, host) !== saved.source) return;
  node.replaceWith(saved.node);
}
