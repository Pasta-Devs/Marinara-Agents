// Quartermaster — client-side fetch helpers for the package's own privileged
// routes (server.mjs). QM is the shared namespace concatenated files use to
// talk to each other, the way Beholder's src/*.js share BH.

const QM = {};

async function qmRequest(path, options) {
  // Only set Content-Type when there's actually a JSON body — Fastify's body
  // parser rejects a bodyless request (GET/DELETE) that still declares
  // application/json with "Body cannot be empty when content-type is set to
  // 'application/json'".
  const headers = options && options.body ? { "Content-Type": "application/json" } : {};
  const response = await fetch(`/api/quartermaster${path}`, { ...options, headers });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((body && body.error) || `Request failed (${response.status})`);
  }
  return body;
}

QM.listItems = (chatId, ownerId) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}`, { method: "GET" });

QM.addItem = (chatId, ownerId, item) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/items`, {
    method: "POST",
    body: JSON.stringify(item),
  });

QM.updateItem = (chatId, ownerId, itemId, patch) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/items/${encodeURIComponent(itemId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );

QM.deleteItem = (chatId, ownerId, itemId) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/items/${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
  );

QM.createOutfit = (chatId, ownerId, outfit) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/outfits`, {
    method: "POST",
    body: JSON.stringify(outfit),
  });

QM.updateOutfit = (chatId, ownerId, outfitId, patch) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/outfits/${encodeURIComponent(outfitId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );

QM.equipOutfit = (chatId, ownerId, outfitId) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/outfits/${encodeURIComponent(outfitId)}/equip`,
    { method: "POST", body: "{}" },
  );

QM.deleteOutfit = (chatId, ownerId, outfitId) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/outfits/${encodeURIComponent(outfitId)}`,
    { method: "DELETE" },
  );

// The host's Settings > Advanced > Message Tools > Debug Mode toggle isn't
// exposed through capabilityProps for this package's slots (confirmed live:
// a mounted element's own capabilityProps carries chatId/chatMode/
// mobileCompact/trackerRetryBusy/lockMode/toolbarButtonClass/localization --
// no debugMode field at all, unlike whatever slot type noodle/slurp use).
// The host does persist it to localStorage under its own Zustand store key
// (sources/engine/packages/client/src/stores/ui.store.ts's `name:
// "marinara-engine-ui"`), which a same-origin package script can read
// directly -- confirmed live to reflect the real toggle state. Read fresh at
// request time (not cached) since the user can flip the toggle while a
// builder modal is already open. Not a documented package API, just the
// only mechanism that actually works for these slots -- could break if the
// Engine ever renames this store's persist key.
function qmReadHostDebugMode() {
  try {
    return JSON.parse(localStorage.getItem("marinara-engine-ui"))?.state?.debugMode === true;
  } catch {
    return false;
  }
}

// Build Wardrobe: a one-shot generation call, no write. Returns { proposal }.
QM.generateWardrobe = (chatId, ownerId, direction, includePersonaContext) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/wardrobe/generate`, {
    method: "POST",
    body: JSON.stringify({ direction, includePersonaContext, debugMode: qmReadHostDebugMode() }),
  });

// The separate confirm step that actually persists a previously-generated proposal.
QM.confirmWardrobe = (chatId, ownerId, proposal) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/wardrobe/confirm`, {
    method: "POST",
    body: JSON.stringify({ proposal }),
  });

QM.updateSettings = (chatId, ownerId, settings) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/settings`, {
    method: "PATCH",
    body: JSON.stringify(settings),
  });

QM.unequipAll = (chatId, ownerId) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/unequip-all`, {
    method: "POST",
    body: "{}",
  });

// Reverts to the snapshot captured just before the last tracker-agent turn —
// see server.mjs's reconcileTrackerOutput/restore route for the single-level
// (not a full history) design.
QM.restoreInventory = (chatId, ownerId) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/restore`, {
    method: "POST",
    body: "{}",
  });

// Per-item undo from the Recent Changes view — see server.mjs's
// /revert-item route for the staleness guard (refuses rather than
// overwrites if the item changed again since the recorded turn).
QM.revertTrackerItem = (chatId, ownerId, itemId) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/revert-item`, {
    method: "POST",
    body: JSON.stringify({ itemId }),
  });

QM.uploadItemImage = (chatId, ownerId, itemId, imageDataUrl) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/items/${encodeURIComponent(itemId)}/image`,
    {
      method: "POST",
      body: JSON.stringify({ imageDataUrl }),
    },
  );

// Generate Image: cheap prompt preview (no image-gen cost) + the paid
// generate call, for both items and outfits. Neither route saves anything --
// the caller feeds /generate's returned imageDataUrl into the EXISTING
// uploadItemImage/uploadOutfitPortrait above to actually persist it, exactly
// like a real upload.
QM.itemImagePromptPreview = (chatId, ownerId, itemId) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/items/${encodeURIComponent(itemId)}/image/prompt-preview`,
    { method: "POST", body: "{}" },
  );

QM.generateItemImage = (chatId, ownerId, itemId, prompt) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/items/${encodeURIComponent(itemId)}/image/generate`,
    { method: "POST", body: JSON.stringify({ prompt }) },
  );

QM.outfitPortraitPromptPreview = (chatId, ownerId, outfitId) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/outfits/${encodeURIComponent(outfitId)}/portrait/prompt-preview`,
    { method: "POST", body: "{}" },
  );

QM.generateOutfitPortrait = (chatId, ownerId, outfitId, prompt) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/outfits/${encodeURIComponent(outfitId)}/portrait/generate`,
    { method: "POST", body: JSON.stringify({ prompt }) },
  );

// Same-origin plain fetch straight at the Engine's own top-level route, NOT
// qmRequest (that's scoped to /api/quartermaster/...) -- mirrors pixelforge's
// PF.api.getJson (packages/pixelforge/src/00-prelude.js): permissions gate
// what server.mjs itself can call, not what browser JS can fetch same-origin,
// so this needs no package permission. Filtered client-side the same way
// server.mjs's own resolveImageConnection filters server-side.
QM.listImageConnections = async () => {
  const response = await fetch("/api/connections", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Could not load connections (${response.status})`);
  const connections = await response.json();
  return Array.isArray(connections) ? connections.filter((c) => c && c.provider === "image_generation") : [];
};

QM.deleteItemImage = (chatId, ownerId, itemId) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/items/${encodeURIComponent(itemId)}/image`,
    {
      method: "DELETE",
    },
  );

// Not a fetch — the <img src> URL. A 404 (no matching image, uploaded or
// pack) is handled by the caller's onerror, not here.
QM.itemImageUrl = (chatId, ownerId, itemId) =>
  `/api/quartermaster/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/items/${encodeURIComponent(itemId)}/image`;

// Items confirmed to have no image (uploaded or pack), so repeated repaints
// of the same item — the dock/panel rebuild their DOM on every reflow, not
// just once — don't keep re-requesting (and re-404ing/re-logging) a URL
// already known to fail. Session-lifetime only, not persisted: a page
// reload re-checks everything once, which is fine. Cleared for a specific
// item by uploadItemImage/deleteItemImage below; a rename that happens to
// newly match a pack image is the one case this can go stale on, until the
// next reload — rare enough not to warrant duplicating the server's
// name-matching logic here just to key this more precisely.
QM._missingItemImageIds = new Set();

// Not a fetch — the <img src> URL for a slot's bundled generic artwork
// (server.mjs's SLOT_ICON_FILES). Not chat/owner-scoped — this is package
// content, not chat data. A 404 (unrecognized slot) is handled by the
// caller's onerror, same as itemImageUrl.
QM.slotIconUrl = (slot) => `/api/quartermaster/inventory/slot-icon/${encodeURIComponent(slot)}`;

QM.uploadOutfitPortrait = (chatId, ownerId, outfitId, imageDataUrl) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/outfits/${encodeURIComponent(outfitId)}/portrait`,
    { method: "POST", body: JSON.stringify({ imageDataUrl }) },
  );

QM.deleteOutfitPortrait = (chatId, ownerId, outfitId) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/outfits/${encodeURIComponent(outfitId)}/portrait`,
    { method: "DELETE" },
  );

// Not a fetch — just the <img src> URL. Callers append a cache-buster (the
// filename change already busts the browser cache; this is only relevant if
// callers ever hit this before the state refetch lands, which none do today,
// so plain is fine) only if they need to force a reload of the SAME filename.
QM.outfitPortraitUrl = (chatId, ownerId, outfitId) =>
  `/api/quartermaster/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/outfits/${encodeURIComponent(outfitId)}/portrait`;

QM.exportInventory = (chatId, ownerId) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/export`, { method: "GET" });

QM.importInventory = (chatId, ownerId, payload) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/import`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
