// Quartermaster — client-side fetch helpers for the package's own privileged
// routes (server.mjs). QM is the shared namespace concatenated files use to
// talk to each other, the way Beholder's src/*.js share BH.

const QM = {};

const QM_UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// ponytail: every package route sits behind the Engine's privileged gate, so a
// session from another device needs the admin secret the Engine's own client
// keeps under this localStorage key (loopback is exempt, which is why this went
// unnoticed). Same approach as Memory Nag and Relationship Tracker; replace
// with a host-provided fetch if the Engine ever adds one.
function qmAdminSecret() {
  try {
    return localStorage.getItem("marinara_admin_secret")?.trim() || "";
  } catch {
    return "";
  }
}

// CSRF marker sent explicitly rather than relying on the Engine's global fetch shim.
function qmAuthHeaders(method) {
  const headers = {};
  if (QM_UNSAFE_METHODS.has(method)) headers["x-marinara-csrf"] = "1";
  const secret = qmAdminSecret();
  if (secret) headers["X-Admin-Secret"] = secret;
  return headers;
}

// Turns the gate's refusal into a step the user can take on this device.
// Wording matches Relationship Tracker, Noodle and Slurp (#1136).
function qmResponseError(response, body) {
  const message = body && typeof body.error === "string" ? body.error : "";
  if (response.status === 403 && /admin.secret/i.test(message)) {
    return /X-Admin-Secret/.test(message) && qmAdminSecret()
      ? "The Admin Secret saved on this device does not match the Engine's ADMIN_SECRET. Enter the same value in Settings → Advanced → Admin Access."
      : "Marinara Engine blocked Quartermaster because this device has no Admin Secret. Set ADMIN_SECRET in the Engine's .env file if it is not set yet, then enter the same value in Settings → Advanced → Admin Access.";
  }
  return message || `Request failed (${response.status})`;
}

async function qmRequest(path, options) {
  const method = (options && options.method) || "GET";
  // Only set Content-Type when there's actually a JSON body — Fastify's body
  // parser rejects a bodyless request (GET/DELETE) that still declares
  // application/json with "Body cannot be empty when content-type is set to
  // 'application/json'".
  const headers = qmAuthHeaders(method);
  if (options && options.body) headers["Content-Type"] = "application/json";
  const response = await fetch(`/api/quartermaster${path}`, { ...options, headers, credentials: "same-origin" });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(qmResponseError(response, body));
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
  const response = await fetch("/api/connections", {
    headers: { ...qmAuthHeaders("GET"), Accept: "application/json" },
    credentials: "same-origin",
  });
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
// item by uploadItemImage/deleteItemImage below, and entirely by Refresh
// Images or an Admin Secret change (qmSyncImageSecret); a rename that happens to
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

// An <img src> can't send X-Admin-Secret, so with a secret saved on this device
// our own (gated) image URLs load through fetch into a session cache of object
// URLs, shared by every element showing that image: the dock rebuilds its lists
// on every repaint, so loading per element would refetch everything each time.
// Without a saved secret nothing changes: a plain src, as before.
//
// Entry status: "loading", "ok", "missing" (a confirmed 404, like
// _missingItemImageIds) or "failed" (refused secret, server or network error).
// Both failures stay cached so repaints don't refetch them; reopening the dock
// retries "failed" ones, and Refresh Images or a secret change retries all.
// The cache is our only cache (no-store), so a cleared entry never comes back
// from the browser's HTTP cache, where portraits are marked immutable.
const qmImageCache = new Map();
// img -> the cache entry it last asked for, so only its latest request applies.
const qmImageTargets = new WeakMap();
let qmImageCacheSecret = null;

// ponytail: a retired object URL is revoked after a delay instead of tracking
// every element using it. An image already on screen keeps its decoded
// picture; the delay covers one that was still loading it.
function qmRetireImage(entry) {
  const objectUrl = entry.objectUrl;
  if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
}

QM.forgetImage = (url) => {
  const entry = qmImageCache.get(url);
  if (!entry) return;
  qmImageCache.delete(url);
  qmRetireImage(entry);
};

QM.clearImageCache = () => {
  for (const entry of qmImageCache.values()) qmRetireImage(entry);
  qmImageCache.clear();
};

// A new or removed secret can fix (or cause) refused requests, so everything,
// including items remembered as having no image, gets a fresh try.
function qmSyncImageSecret(secret) {
  if (qmImageCacheSecret === null) qmImageCacheSecret = secret;
  if (secret === qmImageCacheSecret) return;
  qmImageCacheSecret = secret;
  QM.clearImageCache();
  QM._missingItemImageIds.clear();
}

QM.retryFailedImages = () => {
  qmSyncImageSecret(qmAdminSecret());
  for (const [url, entry] of qmImageCache) {
    if (entry.status === "failed") qmImageCache.delete(url);
  }
};

function qmLoadImage(url) {
  const entry = { status: "loading", objectUrl: null, ready: null };
  qmImageCache.set(url, entry);
  entry.ready = fetch(url, { headers: qmAuthHeaders("GET"), credentials: "same-origin", cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) return response.status === 404 ? "missing" : "failed";
      const blob = await response.blob();
      // Forgotten while loading: discard without creating an object URL.
      if (qmImageCache.get(url) !== entry) return "stale";
      entry.objectUrl = URL.createObjectURL(blob);
      return "ok";
    })
    .catch(() => "failed")
    .then((status) => {
      entry.status = status;
    });
  return entry;
}

// A failed load fires the img's "error" event, which every caller already uses
// for its fallback; event.qmRetryable marks a failure that isn't a real "no image".
QM.setImageSrc = (img, url) => {
  const secret = qmAdminSecret();
  qmSyncImageSecret(secret);
  if (!secret || !url.startsWith("/api/quartermaster/")) {
    qmImageTargets.delete(img);
    img.src = url;
    return;
  }
  const entry = qmImageCache.get(url) || qmLoadImage(url);
  if (qmImageTargets.get(img) === entry) return;
  qmImageTargets.set(img, entry);
  entry.ready.then(() => {
    if (qmImageTargets.get(img) !== entry || qmImageCache.get(url) !== entry) return;
    if (entry.status === "ok") {
      img.src = entry.objectUrl;
      return;
    }
    const event = new Event("error");
    event.qmRetryable = entry.status === "failed";
    img.dispatchEvent(event);
  });
};

QM.exportInventory = (chatId, ownerId) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/export`, { method: "GET" });

QM.importInventory = (chatId, ownerId, payload) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/import`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
