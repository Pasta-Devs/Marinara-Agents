// Quartermaster — capability package server entrypoint.
// Owns the per-chat, per-owner inventory: stored in persistence.documents
// (kind "inventory", one document per chat+owner), served under
// /api/quartermaster so the client element can read and mutate it.
//
// v1 slice: a flat item list for the persona only (name, description,
// quantity, location), a fixed equip-slot vocabulary, and saved outfits
// (named snapshots of the equip-slot state). No images, locks, or party
// members yet.
//
// Also wires up agents.json's single "quartermaster" entry as a real
// post_processing pipeline agent — an LLM call that reads each turn's
// narration and returns a full-snapshot description of the owner's current
// items/equip state, which reconcileTrackerOutput turns into real mutations
// against this same store. One agent def doing both UI/storage identity and
// the real LLM call, not two — every other package in this repo ships
// exactly one (Memory Nag is the precedent for this exact hybrid shape:
// client+server+routes AND a real post_processing agent, all under one
// entry). See reconcileTrackerOutput's own comment for the design.
//
// Also registers a prompt-context contributor (inventorySummaryText) that
// feeds a curated, location-aware inventory summary to the NARRATOR every
// generation — separate from the agent's own prepareContext, which feeds the
// TRACKER AGENT its prior state instead.
//
// location is one of:
//   "bag"                 — carried, unequipped
//   "equipped:<slot>"     — <slot> must be one of EQUIP_SLOTS
//   "stored:<free text>"  — a named stash ("at home", "in the car")
//
// Slot naming: deliberately NOT split left/right the way Beholder's physical-
// state tracker is (head/foot/ear/eye pairs stay one slot each here — an
// equip model needs one item per slot, and a pair of boots is one inventory
// item, not two). Hands stay split (weapon_left_hand/weapon_right_hand)
// since dual-wielding and shield+weapon are real, common cases worth the
// precision. Layered slots (underwear/clothing/armor) are named
// <garment-type>_<region> rather than reusing the extension's UI-column
// grouping, so a future narrative-driven equip agent can reason about
// exactly what and where from the slot id alone.
import { randomUUID } from "node:crypto";
import { join, dirname } from "node:path";
import { mkdir, writeFile, readFile, readdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Order matches the portrait ring layout, read top → left → right → bottom:
// head/neck/eyes/ears above the portrait; armor/clothing/underwear stacked on
// the left; back+hands (accessories) and both weapon hands on the right;
// feet/belt below. This order is what equippedItemNamesText/EQUIP_SLOTS
// consumers show items in, not just a display grouping.
const EQUIP_SLOTS = [
  "head",
  "neck",
  "eyes",
  "ears",
  "armor_torso",
  "armor_legs",
  "clothing_torso",
  "clothing_legs",
  "underwear_top",
  "underwear_bottom",
  "back",
  "hands",
  "weapon_left_hand",
  "weapon_right_hand",
  "feet",
  "belt",
];
const EQUIP_SLOT_SET = new Set(EQUIP_SLOTS);
// Three of the extension's original SLOT_GROUPS toggles (armor/underwear/
// weapon) — the rest of the slots ("just regular slots", per the request)
// have no group and are always on. SLOT_GROUP_DEFAULTS is the fresh-owner
// default for each: underwear off (SFW by default), armor/weapons on (most
// characters use them; hiding is for the RP styles that don't).
const SLOT_GROUPS = {
  underwear: new Set(["underwear_top", "underwear_bottom"]),
  armor: new Set(["armor_torso", "armor_legs"]),
  weapons: new Set(["weapon_left_hand", "weapon_right_hand"]),
};
const SLOT_GROUP_DEFAULTS = { underwear: false, armor: true, weapons: true };
const APPEARANCE_FEED_MODES = new Set(["off", "outfitDescription", "equippedNames"]);

// A slot with no group is always visible/equippable. `visibility` is the
// {showUnderwear, showArmor, showWeapons} slice of an inventory state.
function slotGroupVisible(slot, visibility) {
  for (const [group, slots] of Object.entries(SLOT_GROUPS)) {
    if (slots.has(slot)) return visibility[`show${group[0].toUpperCase()}${group.slice(1)}`] === true;
  }
  return true;
}

const PACKAGE_ID = "quartermaster";
const INVENTORY_KIND = "inventory";
const QM_EXPORT_FORMAT_VERSION = 1;
const MAX_ITEM_NAME_LENGTH = 200;
const MAX_ITEM_DESCRIPTION_LENGTH = 4000;
const MAX_STORED_LOCATION_LENGTH = 200;
const MAX_OUTFIT_NAME_LENGTH = 200;
const MAX_OUTFIT_DESCRIPTION_LENGTH = 4000;
// A single tracker-agent turn touching more items than this is far more
// likely a malformed/hallucinated response than a real narrative event —
// reconcileTrackerOutput skips the whole turn (logged, not applied) rather
// than trust a suspiciously large batch. See that function's own comment.
const MAX_TRACKER_OPERATIONS_PER_TURN = 25;
// The tracker's own "reasoning" field, now persisted into lastTrackerChange
// (not just logged) so the Recent Changes UI can show it -- capped short
// since it's meant to be brief, unlike a real item/outfit description.
const MAX_TRACKER_REASONING_LENGTH = 500;

// ── Generate Image (item/outfit portrait AI generation) ─────────────────────
// Ported from the legacy RPG Inventory extension's own default prompt
// templates/dimensions (_planning/RPG Inventory/extension.js) -- dimensions
// are fixed constants, not user-editable in v1 (unlike the legacy
// extension's own config.itemImageW/H), templates ARE user-editable (see
// itemImagePromptTemplate/outfitPortraitPromptTemplate in loadInventoryState).
const DEFAULT_ITEM_IMAGE_PROMPT_TEMPLATE =
  "A crisp, studio photograph of a detailed {item}, {item_description}, set on a dark slate surface, dramatic cinematic side-lighting, 8k resolution, dark neutral background, perfectly centered item sheet asset.";
const DEFAULT_OUTFIT_PORTRAIT_PROMPT_TEMPLATE =
  "A full body portrait in a casual pose of {name}, {persona_appearance}, wearing {equipped_items}.";
const ITEM_IMAGE_GEN_WIDTH = 512;
const ITEM_IMAGE_GEN_HEIGHT = 512;
const OUTFIT_PORTRAIT_GEN_WIDTH = 768;
const OUTFIT_PORTRAIT_GEN_HEIGHT = 1152;
const MAX_PROMPT_TEMPLATE_LENGTH = 4000; // same scale as MAX_ITEM_DESCRIPTION_LENGTH/MAX_OUTFIT_DESCRIPTION_LENGTH
const MAX_REVIEW_PROMPT_LENGTH = 4000; // the one-off, possibly-edited review-step text sent to /generate

// ── Outfit portraits ─────────────────────────────────────────────────────────
// Stored as real files under the Engine's shared gallery/ dir (confirmed, via
// live production evidence, to survive long-term without being swept — see
// _planning/capability-package-platform-notes.md), NOT in this package's own
// documents store: at pack-image scale this belongs in files, and even for a
// single portrait a real file avoids base64's ~33% size inflation. Metadata
// (which file belongs to which outfit) still lives in the outfit record
// itself, which IS a document — only the bytes are files.
//
// Filenames always include a fresh random component on every upload, never
// reused for a replacement — this is what makes the portrait URL
// cache-safe: a browser that already cached the old image at the old URL
// never sees the new one at that URL, because the new one has a different
// URL. No cache-busting query params or headers needed.
const PORTRAIT_MIME_TO_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const PORTRAIT_EXT_TO_CONTENT_TYPE = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
const MAX_PORTRAIT_BYTES = 3 * 1024 * 1024; // post-decode; client resizes/compresses before upload

function galleryPortraitDir(dataDir, chatId) {
  return join(dataDir, "gallery", "quartermaster", "portraits", chatId);
}

function avatarsNpcDir(dataDir, chatId) {
  return join(dataDir, "avatars", "npc", chatId);
}

// Decodes a `data:image/...;base64,...` string into bytes + a safe filename
// extension, or returns null for anything malformed/oversized/unsupported —
// callers turn that into a 400 rather than writing anything to disk.
function decodePortraitDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  const ext = PORTRAIT_MIME_TO_EXT[match[1]];
  if (!ext) return null;
  let buffer;
  try {
    buffer = Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
  if (buffer.length === 0 || buffer.length > MAX_PORTRAIT_BYTES) return null;
  return { buffer, ext, contentType: PORTRAIT_EXT_TO_CONTENT_TYPE[ext] };
}

// Best-effort delete — a portrait file that's already gone (never written,
// or removed some other way) must never fail the request that's replacing
// or clearing it.
async function removePortraitFileIfExists(filePath) {
  try {
    await unlink(filePath);
  } catch {
    // Already gone, or never existed — nothing to do.
  }
}

// ── Item images ───────────────────────────────────────────────────────────
// Not chat-scoped, and not a stored per-item reference the way outfit
// portraits are — matched purely by normalized name against whatever's in
// gallery/quartermaster/items/ (recursively), same convention the original
// extension used for its own image-pack matching. This is deliberate: it's
// what lets a user drop a whole pre-made pack's folder structure straight
// into items/ and have it "just work" without needing per-item state for
// every one of thousands of pack images, and it means a rename that happens
// to land on another pack image's name picks it up automatically. Read-time
// only (no persisted index) so a hand-added file is found immediately, the
// same tradeoff the original extension made for the same reason.
//
// Broader extension set than PORTRAIT_MIME_TO_EXT/decodePortraitDataUrl:
// this only ever reads pre-existing files, never decodes uploaded bytes, so
// gif (animated pack art) is fine here even though the upload path (canvas
// re-encode) doesn't support it.
const ITEM_IMAGE_EXT_TO_CONTENT_TYPE = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

function galleryItemsDir(dataDir) {
  return join(dataDir, "gallery", "quartermaster", "items");
}

// Depth-first: files at each level before descending into subfolders, both
// alphabetical, first match wins — same tie-break the outfit/item
// name-matching (qmNormalizeMatchKey) already uses elsewhere in this file.
async function findItemImageFile(dir, targetKey) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const files = entries.filter((entry) => entry.isFile()).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of files) {
    const dot = entry.name.lastIndexOf(".");
    if (dot <= 0) continue;
    const ext = entry.name.slice(dot + 1).toLowerCase();
    if (!ITEM_IMAGE_EXT_TO_CONTENT_TYPE[ext]) continue;
    if (qmNormalizeMatchKey(entry.name.slice(0, dot)) === targetKey) return { path: join(dir, entry.name), ext };
  }
  const dirs = entries.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of dirs) {
    const found = await findItemImageFile(join(dir, entry.name), targetKey);
    if (found) return found;
  }
  return null;
}

// ── Bundled slot icons ──────────────────────────────────────────────────────
// Generic, always-available equip-slot artwork (a hat, gloves, a breastplate,
// a sword, ...) — distinct from item images above: those are per-item,
// gallery-stored, and optional; these ship as part of the package itself so
// every slot looks right immediately after install, with no setup step. Read
// from disk beside this very file (`icons/<slot>.webp`, declared in
// manifest.json's files list and archived byte-identical, same guarantee
// client.js has) rather than from context.dataDir — this is package code, not
// package data. import.meta.url resolves into this install's own extracted
// snapshot directory (confirmed in _planning/capability-package-platform-
// notes.md), which carries a copy of every declared file, icons/ included.
// NOT cached in memory, despite living beside genuinely immutable code —
// confirmed live as a real bug, not just a theoretical one: this package's
// own dev-catalog test loop reinstalls the SAME version (0.1.1) repeatedly
// with different icon file *contents* each time, so "a version bump gets a
// fresh process" (this comment's own prior justification for caching) does
// not hold here — the Marinara Engine process can easily outlive several
// icon-content swaps without restarting, and an in-memory Map has no way to
// notice the files on disk changed out from under it. A plain readFile per
// request costs nothing meaningful at this size (1-2KB each) and is simply
// always correct, which an unbounded process-lifetime cache with no
// invalidation path was not.
const SLOT_ICON_DIR = join(dirname(fileURLToPath(import.meta.url)), "icons");
// weapon_right_hand has no file of its own — the left-hand sword art is
// reused as-is (the generated blade points straight up, symmetric enough
// that a distinct or mirrored asset wasn't worth a second generation).
const SLOT_ICON_FILES = {
  head: "head",
  neck: "neck",
  eyes: "eyes",
  ears: "ears",
  armor_torso: "armor_torso",
  armor_legs: "armor_legs",
  clothing_torso: "clothing_torso",
  clothing_legs: "clothing_legs",
  underwear_top: "underwear_top",
  underwear_bottom: "underwear_bottom",
  back: "back",
  hands: "hands",
  weapon_left_hand: "weapon_left_hand",
  weapon_right_hand: "weapon_left_hand",
  feet: "feet",
  belt: "belt",
};
async function loadSlotIconBuffer(slot) {
  const baseName = SLOT_ICON_FILES[slot];
  if (!baseName) return null;
  try {
    return await readFile(join(SLOT_ICON_DIR, `${baseName}.webp`));
  } catch {
    return null;
  }
}

function inventoryDocId(chatId, ownerId) {
  return `${chatId}:${ownerId}`;
}

// 0 is a valid quantity — "used up but still tracked" — so this only rejects
// genuinely invalid input (non-numeric, negative), not zero.
function normalizeQuantity(value) {
  const quantity = Math.trunc(Number(value));
  return Number.isFinite(quantity) && quantity >= 0 ? quantity : 1;
}

function normalizeText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

// Returns the normalized default-slot value (a slot id or null to clear),
// or undefined if invalid.
function normalizeDefaultSlot(value) {
  if (value === null || value === "") return null;
  return typeof value === "string" && EQUIP_SLOT_SET.has(value) ? value : undefined;
}

// Returns the normalized location string, or null if invalid. `visibility`
// gates equipping INTO a hidden group's slot the same way it gates the
// client's slot picker — "enable/disable", not just hide — so an agent or
// direct API call can't equip one while the owner has that group turned off.
// Already-equipped items in a since-hidden group are left alone by this
// check; it only blocks new equips.
function normalizeLocation(value, visibility) {
  const text = normalizeText(value, MAX_STORED_LOCATION_LENGTH);
  if (!text || text === "bag") return "bag";
  if (text.startsWith("equipped:")) {
    const slot = text.slice("equipped:".length);
    if (!EQUIP_SLOT_SET.has(slot)) return null;
    if (!slotGroupVisible(slot, visibility)) return null;
    return text;
  }
  if (text.startsWith("stored:")) {
    return text.length > "stored:".length ? text : null;
  }
  return null;
}

// Equipping into an already-occupied slot bumps the previous occupant back
// to the bag — an equip slot holds one item, matching how the extension's
// slots behaved.
function applyLocation(items, item, location) {
  if (location.startsWith("equipped:")) {
    for (const candidate of items) {
      if (candidate.id !== item.id && candidate.location === location) candidate.location = "bag";
    }
  }
  item.location = location;
}

// slot -> a snapshot of the currently-equipped item, not just its id. Saved
// outfits carry name/description alongside the id so a saved outfit is a
// durable, self-contained record — see applyOutfitEquip's own comment for
// why this matters (an item can go missing from the live inventory for
// reasons that have nothing to do with the outfit itself).
function currentEquippedSlots(items) {
  const slots = {};
  for (const item of items) {
    if (item.location.startsWith("equipped:")) {
      slots[item.location.slice("equipped:".length)] = { itemId: item.id, name: item.name, description: item.description };
    }
  }
  return slots;
}

// Outfits saved before this shape existed stored a bare itemId string per
// slot. Normalize on read so old data keeps working (comparisons just never
// match once the id is stale, same as before) rather than throwing — new
// saves/updates always write the full object shape via currentEquippedSlots.
function normalizeOutfitSlotSnapshot(value) {
  if (typeof value === "string") return { itemId: value, name: null, description: null };
  if (value && typeof value === "object") {
    return { itemId: value.itemId ?? null, name: value.name ?? null, description: value.description ?? null };
  }
  return { itemId: null, name: null, description: null };
}

// An outfit stays "the current outfit" as long as every slot IT saved is
// still worn exactly as saved — equipping something extra in a slot the
// outfit never claimed (a backpack, a ring) doesn't unequip it, only
// swapping out one of the outfit's own slots does. Used to be exact-set
// equality (same slot COUNT, not just the outfit's own slots matching),
// which meant putting on literally anything else while an outfit was worn
// silently dropped it as "active" — the appearance-macro description and
// the real-avatar-replace sync would both revert as if the whole outfit had
// been removed, even though every one of its own items was still on.
// extraEquippedNames below is what surfaces that "something extra" instead
// of just silently ignoring it.
function outfitMatchesCurrent(outfit, items) {
  const current = currentEquippedSlots(items);
  const outfitEntries = Object.entries(outfit.slots ?? {});
  if (outfitEntries.length === 0) return false; // a slotless outfit is never "currently worn"
  return outfitEntries.every(
    ([slot, snapshot]) => current[slot]?.itemId === normalizeOutfitSlotSnapshot(snapshot).itemId,
  );
}

// Names of currently equipped items in a slot the given (already-matching)
// outfit doesn't itself reference — gear worn alongside the outfit rather
// than part of it. Stable EQUIP_SLOTS order, matching equippedItemNamesText.
function extraEquippedNames(outfit, items) {
  const current = currentEquippedSlots(items);
  const outfitSlots = new Set(Object.keys(outfit.slots ?? {}));
  const names = [];
  for (const slot of EQUIP_SLOTS) {
    if (outfitSlots.has(slot)) continue;
    const item = current[slot];
    if (item) names.push(item.name);
  }
  return names;
}

// Equips a saved outfit: unequips everything currently worn, then applies
// each saved slot. If a slot's referenced item no longer exists — deleted,
// or dropped by a tracker-agent turn that (mistakenly or not) omitted it
// from a full-snapshot response — the outfit's OWN saved name/description
// recreates it fresh instead of the slot silently staying empty. This is
// what makes an outfit a durable backup rather than a set of live item-id
// references: re-equipping it is what restores anything that went missing,
// which is also why item deletion no longer prunes outfit slot data (see the
// two call sites this replaced). Mutates `state` in place; no return value.
function applyOutfitEquip(state, outfit) {
  for (const item of state.items) {
    if (item.location.startsWith("equipped:")) item.location = "bag";
  }
  for (const [slot, rawSnapshot] of Object.entries(outfit.slots ?? {})) {
    if (!slotGroupVisible(slot, state)) continue;
    const snapshot = normalizeOutfitSlotSnapshot(rawSnapshot);
    let item = snapshot.itemId ? state.items.find((candidate) => candidate.id === snapshot.itemId) : undefined;
    // Recreating strictly by id would duplicate an item that already exists
    // under the same name but a different id — e.g. two outfits each saved
    // their own "sneakers" snapshot at different times, neither of whose
    // itemId still resolves; equipping both used to mint two separate
    // "sneakers" items. Match by normalized name first, same as
    // reconcileTrackerOutput's own find-or-create just below, before ever
    // minting a new item — only create when NEITHER the id nor the name
    // resolves to anything already in the inventory.
    if (!item && snapshot.name) {
      const key = qmNormalizeMatchKey(snapshot.name);
      item = state.items.find((candidate) => qmNormalizeMatchKey(candidate.name) === key);
    }
    if (!item && snapshot.name) {
      item = {
        id: randomUUID(),
        name: snapshot.name,
        description: snapshot.description || "",
        quantity: 1,
        location: "bag",
        defaultSlot: null,
        favorite: false,
      };
      state.items.push(item);
    }
    if (!item) continue; // legacy slot with neither a live id nor a recreatable name
    item.location = `equipped:${slot}`;
    outfit.slots[slot] = { itemId: item.id, name: item.name, description: item.description };
  }
}

// Commits a Build Wardrobe proposal (already validated by
// parseWardrobeProposal) into real items/outfits. Deliberately does NOT
// call applyOutfitEquip -- this only builds saved definitions, nothing gets
// worn. Two passes: items first (so an outfit in the same proposal can
// reference an item defined earlier in it), then outfits, which resolve
// "itemNames" against ALL of state.items -- not just this proposal's own
// new ones -- so an outfit can equally reference something the persona
// already owned before this call. Mutates `state` in place.
function applyGeneratedWardrobe(state, proposal) {
  const createdItemNames = [];
  for (const entry of proposal.items) {
    const key = qmNormalizeMatchKey(entry.name);
    const existing = state.items.find((candidate) => qmNormalizeMatchKey(candidate.name) === key);
    if (existing) continue; // reuse as-is -- never overwrite a possibly-customized existing item
    state.items.push({
      id: randomUUID(),
      name: entry.name,
      description: entry.description || "",
      quantity: entry.quantity,
      location: "bag",
      defaultSlot: entry.defaultSlot,
      favorite: false,
    });
    createdItemNames.push(entry.name);
  }

  const createdOutfitNames = [];
  const reusedItemNames = new Set();
  const skipped = [];
  for (const outfitEntry of proposal.outfits) {
    const outfitKey = qmNormalizeMatchKey(outfitEntry.name);
    if (state.outfits.some((candidate) => qmNormalizeMatchKey(candidate.name) === outfitKey)) {
      skipped.push({ name: outfitEntry.name, reason: "duplicate-name" });
      continue;
    }
    const slots = {};
    for (const memberName of outfitEntry.itemNames) {
      const memberKey = qmNormalizeMatchKey(memberName);
      const item = state.items.find((candidate) => qmNormalizeMatchKey(candidate.name) === memberKey);
      if (!item || !item.defaultSlot) continue; // unresolvable member, or nothing to place it in -- drop silently
      if (slots[item.defaultSlot]) {
        skipped.push({ outfitName: outfitEntry.name, itemName: memberName, reason: "slot-collision" });
        continue;
      }
      slots[item.defaultSlot] = { itemId: item.id, name: item.name, description: item.description };
      if (!createdItemNames.includes(item.name)) reusedItemNames.add(item.name);
    }
    state.outfits.push({
      id: randomUUID(),
      name: outfitEntry.name,
      description: outfitEntry.description || "",
      slots,
      portraitFile: null,
    });
    createdOutfitNames.push(outfitEntry.name);
  }

  return { createdItemNames, createdOutfitNames, reusedItemNames: [...reusedItemNames], skipped };
}

function equippedItemNamesText(items) {
  const names = [];
  for (const slot of EQUIP_SLOTS) {
    const item = items.find((candidate) => candidate.location === `equipped:${slot}`);
    if (item) names.push(item.name);
  }
  return names.join(", ");
}

// ── Image generation (loopback to the Engine's own REST API) ───────────────
// No api.runtime.images method exists (confirmed against every package's own
// package-runtime.ts: the full CapabilityRuntimeHost surface is only
// persistence/resources/languageModels/json/logger/isDebugAgentsEnabled).
// packages/gacha-forge/server.mjs is this repo's only other AI-image-
// generation package, and it works by calling the Engine's own internal REST
// route via a loopback fetch() from its own server-side Node code -- this
// ports that exact, real, shipped mechanism in readable form, not through
// api.runtime.
function engineLoopbackBaseUrl(env) {
  const port = Number.parseInt(env.PORT, 10);
  const scheme = env.SSL_CERT && env.SSL_KEY ? "https" : "http";
  return `${scheme}://127.0.0.1:${Number.isFinite(port) ? port : 7860}`;
}

async function engineApiFetch(path, options) {
  if (typeof fetch !== "function") throw new Error("engine-image: no fetch available");
  const response = await fetch(`${engineLoopbackBaseUrl(process.env)}${path}`, options);
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = typeof body?.error === "string" ? body.error : "";
    } catch {
      detail = "";
    }
    throw new Error(`engine ${path} -> ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return response.json();
}

// Never trusts a caller-supplied connectionId blindly -- re-lists real
// connections every call and validates/falls back, same as gacha-forge's own
// md() helper: exact id match, else the provider's isDefault connection,
// else the first one. Returns null only when there is truly no
// image_generation connection configured at all. Purely a READ (GET
// /api/connections) -- preferredConnectionId (Quartermaster's own saved
// setting) only steers which entry this one call's result picks; nothing
// here can mutate a connection's config or default flag, and nothing here
// is written back to the Engine.
async function resolveImageConnection(preferredConnectionId) {
  const connections = await engineApiFetch("/api/connections", { method: "GET" });
  const imageConnections = Array.isArray(connections)
    ? connections.filter((candidate) => candidate && candidate.provider === "image_generation")
    : [];
  if (imageConnections.length === 0) return null;
  const preferred = imageConnections.find((candidate) => candidate.id === preferredConnectionId);
  if (preferred) return preferred;
  return (
    imageConnections.find((candidate) => candidate.isDefault === true || candidate.isDefault === "true") ||
    imageConnections[0]
  );
}

// Mirrors the legacy RPG Inventory extension's own imgKey/normName exactly
// (extension.js: normName = lowercase+trim, imgKey = replace non-alphanumeric
// runs with "-", trim leading/trailing "-", fall back to "item" if empty).
function qmImageSlug(text) {
  const normalized = String(text || "")
    .trim()
    .toLowerCase();
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";
}

// The actual paid call. Confirmed live (a real generated item image came
// back showing the chat's active persona instead of a clean product shot,
// for multiple different items) that this endpoint was silently rewriting
// our prompt to blend in persona/character appearance -- the
// "prompt override may not have taken" warning below fired every time. A
// first attempted fix (dropping purpose: "avatar", adding
// includeReferenceImages/includePersonaWhenMentionedInPrompt opt-out flags
// guessed from a DIFFERENT, unrelated engine mechanism) did NOT fix it --
// confirmed live that the SAME chat, SAME connection, generating via the
// legacy extension's own original code against this same running Engine
// produces a clean result RIGHT NOW, proving the endpoint itself still
// supports this correctly and the bug is a real difference in what we send,
// not an Engine-side regression. Re-diffed our request against the legacy
// extension's own proven-working one field-by-field and found two REAL
// differences beyond the guessed flags above (now removed): (1) `name` was
// the raw display name ("Pink slippers") instead of a normalized slug --
// the very field the Engine's own hardcoded avatar-portrait template
// interpolates verbatim ("...portrait for Pink slippers..."), and (2) our
// promptOverrides id used a "qm-item-"/"qm-outfit-" prefix instead of the
// legacy extension's own "avatar:" prefix. This now matches that proven
// request shape exactly (connectionId/name/appearance/width/height/
// promptOverrides, nothing else) rather than gacha-forge's differently-
// shaped, never-independently-verified one.
async function generateImageViaEngine({ connectionId, name, prompt, width, height, logger }) {
  const slug = qmImageSlug(name);
  const result = await engineApiFetch("/api/characters/avatar-generation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      connectionId,
      name: slug,
      appearance: prompt,
      width,
      height,
      promptOverrides: [{ id: `avatar:${slug}`, prompt }],
    }),
  });
  if (typeof result?.image !== "string" || !result.image.startsWith("data:")) {
    throw new Error("Engine returned no usable image");
  }
  if (typeof result.prompt === "string" && result.prompt !== prompt) {
    // The echoed prompt itself, not just a boolean warning -- if the
    // includeReferenceImages/includePersonaWhenMentionedInPrompt opt-out
    // above doesn't fully fix this, seeing exactly what the Engine rewrote
    // it to is the next real lead, same way seeing the actual capabilityProps
    // object (not just a guess) is what settled the debugMode investigation
    // earlier in this package's own history.
    logger?.warn(
      "[quartermaster] image generation prompt override may not have taken for %s -- Engine echoed: %s",
      name,
      result.prompt,
    );
  }
  return result.image;
}

// Ports the legacy RPG Inventory extension's buildItemPrompt exactly
// (extension.js lines 3629-3644): fills {item}/{item_description}, but when
// the item has no description, drops "{item_description}" AND one adjacent
// comma rather than leaving a dangling ", ," in the final prompt.
function buildItemImagePrompt(template, item) {
  const tmpl = typeof template === "string" && template.trim() ? template : DEFAULT_ITEM_IMAGE_PROMPT_TEMPLATE;
  const description = (item.description || "").trim();
  let out = tmpl;
  if (description) {
    out = out.replace(/\{item_description\}/g, description);
  } else {
    out = out
      .replace(/,\s*\{item_description\}\s*,/g, ",")
      .replace(/,?\s*\{item_description\}\s*,?/g, "")
      .replace(/\{item_description\}/g, "");
  }
  out = out.replace(/\{item\}/g, item.name || "item");
  return out.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").trim();
}

// A portrait is generated for one SPECIFIC saved outfit, which may not even
// be what's currently equipped right now (the user could be viewing/editing
// a different outfit than the one actually worn) -- so this is scoped to
// THIS outfit's own saved data, never state.items' live equip state. Prefers
// the outfit's own descriptive text (the same whole-look description Build
// Wardrobe already writes / users already author) since that's what
// actually makes the image model render the character IN the described
// outfit; falls back to a plain name list from the outfit's own saved slots
// only when it has no description at all.
function outfitVisualDescriptionText(outfit) {
  const description = (outfit.description || "").trim();
  if (description) return description;
  const names = Object.values(outfit.slots || {})
    .map((slot) => slot.name)
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : "no special equipment";
}

// Ports buildPortraitPrompt (extension.js lines 3680-3689), with one
// deliberate deviation: personaAppearance must be ONLY the persona's own
// Appearance field text (see resolvePersonaWardrobeContext's own appearance
// key) -- never a fallback to description/personality/scenario/backstory,
// unlike the legacy extension's own `persona.appearance || persona.description`.
// An empty personaAppearance resolves to "", cleaned up by the same
// comma/whitespace collapse below, not silently backfilled from anything else.
function buildOutfitPortraitPrompt(template, { personaName, personaAppearance, equippedItemsText }) {
  const tmpl = typeof template === "string" && template.trim() ? template : DEFAULT_OUTFIT_PORTRAIT_PROMPT_TEMPLATE;
  const out = tmpl
    .replace(/\{name\}/g, personaName || "the character")
    .replace(/\{persona_appearance\}/g, personaAppearance || "")
    .replace(/\{equipped_items\}/g, equippedItemsText || "no special equipment");
  return out.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").trim();
}

// The text a {{getvar::quartermaster_appearance_<ownerId>}} macro should
// currently resolve to, per the owner's appearanceFeedMode. "outfitDescription"
// falls back to the equipped item names when the current equip state doesn't
// exactly match any saved outfit — there's no "current outfit" concept then,
// but showing nothing would be worse than showing what's actually worn.
function computeAppearanceText(state) {
  if (state.appearanceFeedMode === "outfitDescription") {
    const matching = state.outfits.find((outfit) => outfitMatchesCurrent(outfit, state.items));
    if (!matching) return equippedItemNamesText(state.items);
    const extras = extraEquippedNames(matching, state.items);
    return extras.length > 0 ? `${matching.description} Also wearing ${extras.join(", ")}.` : matching.description;
  }
  if (state.appearanceFeedMode === "equippedNames") {
    return equippedItemNamesText(state.items);
  }
  return "";
}

// ── Agent-driven inventory sync ──────────────────────────────────────────────
// The single "quartermaster" agent (agents.json), running post_processing,
// reads each turn's narration and returns a full-snapshot JSON description of
// what the owner currently has/wears. reconcileTrackerOutput (wired up in
// activate() via the agent-runtime capability) turns that into real mutations
// against this same persisted state, through the same applyLocation/
// persistState paths the HTTP routes use — so a change made by the agent and
// a change made by clicking around the dock are indistinguishable afterward.
//
// v1 is persona-only (QM_TRACKER_OWNER_ID is a reserved sentinel, matching
// the extension's player-subject "id: player" and Character Tracker's own
// convention of keeping the player out of presentCharacters), but this
// function takes ownerId as a real parameter rather than assuming it, so
// adding party members later is a call-site change, not a rewrite.
const QM_TRACKER_OWNER_ID = "persona";

// Same rule every built-in tracker (World State, Character Tracker, Persona
// Stats, Hierarchical Maps, the roleplay-summary agent) uses to decide
// whether it's active for a chat — confirmed against the Engine's own
// generation code, not guessed: chatMeta.enableAgents plus
// chatMeta.activeAgentIds is the one signal the pipeline itself uses to
// decide whether an agent's post_processing turn even runs, so gating our
// own prompt-context contribution on the same fields keeps us consistent
// with what "disabling the agent" already means everywhere else. Without
// this, a user who disables Quartermaster after using it keeps getting its
// last-known inventory fed to the narrator indefinitely — the exact bug
// found in another package's contributor, which isn't self-gated this way.
function isQuartermasterAgentActive(chatMeta) {
  if (!chatMeta || chatMeta.enableAgents !== true) return false;
  const activeAgentIds = Array.isArray(chatMeta.activeAgentIds) ? chatMeta.activeAgentIds : [];
  return activeAgentIds.includes(PACKAGE_ID);
}

// Case/separator-insensitive only — "Blue Hat" and "blue-hat" are the same
// item, but "Blue Hat" and "Hat" are never merged automatically. Matching on
// meaning (not just formatting) would risk silently merging visually-distinct
// items once per-item images exist.
function qmNormalizeMatchKey(name) {
  return typeof name === "string" ? name.trim().toLowerCase().replace(/[-_\s]+/g, "") : "";
}

// Base-26 letter tag for outfits (A, B, ... Z, AA, AB, ...) -- shared between
// formatAgentRuntimeContext (assigning the tag the model sees) and
// reconcileTrackerOutput (resolving the model's returned tag back to a real
// outfit). Both sides must stay in lockstep with the plain array order of
// state.outfits -- never a re-sorted view -- since they read the exact same
// array within one pipeline turn (see the agent-runtime service comment
// below for why nothing can mutate it in between).
function qmOutfitTagLetter(index) {
  let n = index;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

// The tracker agent's own <agent_runtime_context> — plain dash-list text
// instead of a JSON object. A returned object gets JSON.stringify'd and
// HTML-entity-escaped by the engine when it's embedded into the prompt
// (confirmed by reading it back from a live debug log — a wall of `&quot;`),
// which burns tokens and is harder for the model to scan than a flat list.
// Matches the plain-list style the built-in Background agent's own
// <available_backgrounds> block uses for the same reason.
//
// Each item/outfit carries a bracketed tag ([1], [2]... / [A], [B]...) so
// the model can target an EXISTING one exactly, instead of having to retype
// its name closely enough for qmNormalizeMatchKey to fuzzy-match it back —
// a wrong or slightly-off retyped name under a targeted-update scheme risks
// silently mutating the wrong item, where a garbled tag just fails to match
// anything. Tags are plain array-index based (item N -> index N-1, outfit
// letter -> qmOutfitTagLetter(index)) -- reconcileTrackerOutput rebuilds the
// identical mapping from the same freshly-loaded arrays to resolve them.
function formatAgentRuntimeContext(items, outfitNames) {
  const lines = ["Items:"];
  if (items.length === 0) {
    lines.push("(none)");
  } else {
    items.forEach((item, index) => {
      const description = item.description ? ` -- ${item.description}` : "";
      lines.push(`[${index + 1}] ${item.name}${description} (qty ${item.quantity}, ${item.location})`);
    });
  }
  lines.push("Outfits:");
  if (outfitNames.length === 0) {
    lines.push("(none)");
  } else {
    outfitNames.forEach((name, index) => lines.push(`[${qmOutfitTagLetter(index)}] ${name}`));
  }
  return lines.join("\n");
}

const MAX_WARDROBE_EXISTING_ITEMS_LISTED = 100;

// Builds the two messages for one Build Wardrobe generation call. Pure --
// no I/O, no state mutation -- so it's trivially testable and reusable
// between the initial attempt and a retry. `existingItems` lets the model
// reuse something the persona already owns instead of inventing a
// near-duplicate; outfits are allowed to reference them by exact name (see
// buildGeneratedWardrobe's own comment for why that's safe to allow).
function buildWardrobePrompt(direction, personaContext, existingItems, includePersonaContext) {
  const systemMessage = [
    "You are designing a wardrobe of clothing/gear items and outfits for a persona in a roleplay, based on the user's style direction below.",
    "",
    "Respond ONLY with valid JSON, no prose, no markdown:",
    "{",
    '  "items": [',
    '    { "name": "string", "description": "string (optional, 1-2 sentences)", "quantity": integer >= 1, "defaultSlot": "<slot id>" | null }',
    "  ],",
    '  "outfits": [',
    '    { "name": "string", "description": "string (how the complete outfit looks and fits on the persona when worn)", "itemNames": ["exact name of an item -- either one you defined above, or an already-existing item from the list below", "..."] }',
    "  ]",
    "}",
    "",
    `Valid slot ids (use these exact strings only, or null): ${EQUIP_SLOTS.join(", ")}.`,
    "",
    "RULES:",
    "1. Design enough NEW items to cover whatever the direction describes that the persona doesn't already own -- don't skip or merge requested outfits.",
    '2. An outfit\'s "itemNames" may reference an item you just defined in "items" above, OR an already-existing item from the list below, by its exact name -- prefer reusing an existing item that already fits over inventing a near-duplicate.',
    '3. Only include WEARABLE items in "itemNames" -- clothing, footwear, armor, and worn accessories. Never a phone, wallet, book, or other carried-but-not-worn object, even if it already exists in the inventory below.',
    '4. Give a NEW item a "defaultSlot" whenever it\'s worn in a fixed spot; leave it null only for something with no natural equip slot.',
    "5. Never give two items in the same outfit the same defaultSlot.",
    "6. Only invent a new item when nothing existing already fits what the outfit needs.",
    '7. An outfit\'s "description" describes the complete look as a whole -- how it appears and fits on the persona when worn -- not a list of its items.',
    "8. Keep new item names short and distinct (a color/material/type in the name -- never shorten a distinguishing detail out of it).",
    "9. quantity is almost always 1 for wearables.",
  ].join("\n");

  const userLines = ["## Style direction (what the user is asking for)", direction];

  if (includePersonaContext && personaContext) {
    const personaLines = ["", "## Persona (who you're designing this wardrobe for)"];
    if (personaContext.description) personaLines.push(`Description: ${personaContext.description}`);
    if (personaContext.personality) personaLines.push(`Personality: ${personaContext.personality}`);
    if (personaContext.scenario) personaLines.push(`Scenario: ${personaContext.scenario}`);
    if (personaContext.appearance) personaLines.push(`Appearance: ${personaContext.appearance}`);
    if (personaContext.backstory) personaLines.push(`Backstory: ${personaContext.backstory}`);
    if (personaLines.length > 2) userLines.push(...personaLines);
  }

  if (existingItems.length > 0) {
    const listed = existingItems.slice(0, MAX_WARDROBE_EXISTING_ITEMS_LISTED);
    userLines.push("", '## Existing wearable inventory (reuse these by exact name in "itemNames" when they fit)');
    for (const item of listed) {
      const description = item.description ? `: ${item.description}` : "";
      userLines.push(`- "${item.name}" (${item.defaultSlot})${description}`);
    }
  }

  return { systemMessage, userMessage: userLines.join("\n") };
}

// Reconciles one tracker-agent turn's raw JSON output into the owner's
// canonical inventory. `persistState` is passed in rather than imported,
// since it's a closure defined in activate() (it also syncs the appearance
// macro — see persistState's own definition there).
//
const MAX_WARDROBE_ITEMS = 60;
const MAX_WARDROBE_OUTFITS = 12;
const WARDROBE_LLM_TEMPERATURE = 0.8; // creative -- unlike the tracker agent's temperature 0, this is meant to invent varied ideas, not report facts
const WARDROBE_LLM_MAX_TOKENS = 4096;
const WARDROBE_MAX_ATTEMPTS = 2; // 1 initial + 1 retry, same cap gacha-forge's own generation retry loop uses

// Validates/coerces a Build Wardrobe response (either the raw LLM completion
// text, or the client's echoed-back proposal re-serialized to a string by
// the /confirm route) into a trustworthy `{items, outfits}` shape. Every
// field goes through the SAME normalizers the rest of this file already
// uses for item/outfit input -- this never accepts the LLM's (or a
// tampered client's) JSON as-is. Returns null, never throws, when nothing
// usable survives -- an outfit built entirely from reused existing items is
// valid even with zero new items, so an empty "items" array alone is not a
// failure; only BOTH being empty is. `parseJsonish` is `runtime.json.
// parseJsonish` (a lenient extractor -- strips code fences etc.), passed in
// rather than imported since this file has no direct Engine import for it.
function parseWardrobeProposal(raw, parseJsonish, logger) {
  let parsed;
  try {
    parsed = parseJsonish(raw);
  } catch (error) {
    logger?.warn("[quartermaster] wardrobe proposal was not parseable JSON: %s", error instanceof Error ? error.message : String(error));
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const items = [];
  for (const entry of Array.isArray(parsed.items) ? parsed.items : []) {
    if (items.length >= MAX_WARDROBE_ITEMS) break;
    if (!entry || typeof entry !== "object") continue;
    const name = normalizeText(entry.name, MAX_ITEM_NAME_LENGTH);
    if (!name) continue;
    const defaultSlot = normalizeDefaultSlot(entry.defaultSlot);
    items.push({
      name,
      description: normalizeText(entry.description, MAX_ITEM_DESCRIPTION_LENGTH),
      quantity: normalizeQuantity(entry.quantity) || 1,
      defaultSlot: defaultSlot || null,
    });
  }

  const outfits = [];
  for (const entry of Array.isArray(parsed.outfits) ? parsed.outfits : []) {
    if (outfits.length >= MAX_WARDROBE_OUTFITS) break;
    if (!entry || typeof entry !== "object") continue;
    const name = normalizeText(entry.name, MAX_OUTFIT_NAME_LENGTH);
    if (!name) continue;
    const itemNames = (Array.isArray(entry.itemNames) ? entry.itemNames : [])
      .map((value) => normalizeText(value, MAX_ITEM_NAME_LENGTH))
      .filter(Boolean);
    outfits.push({ name, description: normalizeText(entry.description, MAX_OUTFIT_DESCRIPTION_LENGTH), itemNames });
  }

  if (items.length === 0 && outfits.length === 0) return null;
  return { items, outfits };
}

// The retry loop for one Build Wardrobe generation call. Mirrors
// gacha-forge's own proven inline-retry shape (simpler than hierarchical-
// maps' separate fitContext-guarded repair sub-request, which this payload
// is too small to need): on a parse/shape failure, the bad response is
// appended back into the SAME conversation with a corrective instruction
// and retried once, at a lower temperature. Never throws -- every failure
// path returns `{ok: false, error}` and is logged via `logger.warn` first.
async function generateWardrobeProposal({
  runtime,
  logger,
  debugMode,
  agentConnectionId,
  chatConnectionId,
  direction,
  personaContext,
  existingItems,
  includePersonaContext,
}) {
  const { systemMessage, userMessage } = buildWardrobePrompt(direction, personaContext, existingItems, includePersonaContext);
  let messages = [
    { role: "system", content: systemMessage },
    { role: "user", content: userMessage },
  ];

  for (let attempt = 1; attempt <= WARDROBE_MAX_ATTEMPTS; attempt += 1) {
    let resolved;
    try {
      // Explicit connectionId first: the tracker agent's OWN configured
      // connection (getAgentConfig, resolved by the route below), so
      // switching that in the Agents menu also moves wardrobe generation
      // with it. Falls back to the chat's own default connection only when
      // the agent has no override set, same fallback chain every other
      // package in this repo already uses.
      resolved = await runtime.languageModels.resolveForRequest({ connectionId: agentConnectionId, chatConnectionId });
    } catch (error) {
      logger?.warn("[quartermaster] wardrobe generation could not resolve a language model: %s", error instanceof Error ? error.message : String(error));
      return { ok: false, error: "no-connection" };
    }

    // Passing debugMode to chatComplete does NOT itself produce any logging --
    // it's just forwarded to the provider call. The Engine's own
    // "[agent-debug] <id> raw response" line for the tracker agent comes from
    // the pipeline executor calling the host's `logger.debugOverride`, so
    // this call does the same: `debugOverride` logs at `.warn` (visible even
    // at the default `warn` log level) when debugMode is on, `.debug`
    // otherwise, exactly like every other package's on-demand LLM route.
    logger?.debugOverride?.(debugMode, "[quartermaster] wardrobe request (attempt %d): %s", attempt, JSON.stringify(messages));

    let result;
    try {
      result = await resolved.chatComplete(messages, {
        temperature: attempt === 1 ? WARDROBE_LLM_TEMPERATURE : Math.min(WARDROBE_LLM_TEMPERATURE, 0.3),
        maxTokens: WARDROBE_LLM_MAX_TOKENS,
        debugMode,
      });
    } catch (error) {
      logger?.warn("[quartermaster] wardrobe generation call failed: %s", error instanceof Error ? error.message : String(error));
      return { ok: false, error: "generation-failed" };
    }

    const rawContent = typeof result.content === "string" ? result.content : "";
    logger?.debugOverride?.(debugMode, "[quartermaster] wardrobe raw response (attempt %d, %d chars): %s", attempt, rawContent.length, rawContent);
    const proposal = rawContent ? parseWardrobeProposal(rawContent, runtime.json.parseJsonish, logger) : null;
    if (proposal) return { ok: true, proposal };

    if (result.finishReason === "length") {
      logger?.warn("[quartermaster] wardrobe generation response was truncated (attempt %d)", attempt);
      return { ok: false, error: "truncated" };
    }

    if (attempt < WARDROBE_MAX_ATTEMPTS) {
      logger?.warn("[quartermaster] wardrobe generation produced unusable JSON, retrying (attempt %d)", attempt);
      messages = [
        ...messages,
        { role: "assistant", content: rawContent },
        { role: "user", content: "That was not valid JSON matching the requested schema. Respond again with ONLY the corrected JSON object -- no prose, no markdown." },
      ];
    }
  }
  return { ok: false, error: "generation-failed" };
}

// Patch semantics, NOT full-snapshot (see git history for the prior design,
// which matched every other tracker in this ecosystem — Inventory Tracker/
// Character Tracker/World State — but risked a weaker model's incomplete
// re-listing silently deleting anything it forgot to mention, and risked a
// large inventory's own full re-listing hitting the agent's maxTokens cap
// mid-output). The tracker now targets EXISTING items/outfits by the exact
// bracketed tag formatAgentRuntimeContext showed it ([1].. items, [A]..
// outfits) instead of retyping a name for qmNormalizeMatchKey to fuzzy-match
// back — a garbled tag just fails to resolve, where a garbled retyped name
// could plausibly land on the wrong item. Nothing is deleted by omission any
// more: only an explicit "removeItem" entry removes anything.
async function reconcileTrackerOutput(documents, persistState, chatId, ownerId, data, logger) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return;

  const addEntries = Array.isArray(data.addItem) ? data.addItem : [];
  const updateEntries = Array.isArray(data.updateItem) ? data.updateItem : [];
  const removeEntries = Array.isArray(data.removeItem) ? data.removeItem : [];
  const totalOps = addEntries.length + updateEntries.length + removeEntries.length;
  if (totalOps > MAX_TRACKER_OPERATIONS_PER_TURN) {
    // A turn genuinely touching this many items is far less likely than a
    // malformed/hallucinated response — skip the WHOLE turn (nothing
    // partially applied), same as a JSON-parse failure already does
    // upstream: the next turn's context is unaffected and gets a fresh try.
    logger?.warn(
      "[quartermaster] tracker turn touched %d items (cap %d) -- skipping the whole turn as likely malformed",
      totalOps,
      MAX_TRACKER_OPERATIONS_PER_TURN,
    );
    return;
  }

  const state = await loadInventoryState(documents, chatId, ownerId);

  // Snapshot exactly as this turn found it, before any of this turn's own
  // changes apply. Serves two purposes: the existing "Restore Inventory"
  // whole-state safety net, AND the "before" side of the lastTrackerChange
  // diff below. Overwrites whatever was snapshotted last turn: single-level
  // undo by design, not a full history stack.
  state.previousSnapshot = {
    items: state.items.map((item) => ({ ...item })),
    outfits: state.outfits.map((savedOutfit) => ({ ...savedOutfit, slots: { ...savedOutfit.slots } })),
  };

  // Tag maps built from these exact arrays in their stored (never re-sorted)
  // order — must match formatAgentRuntimeContext's own assignment exactly,
  // which it does as long as nothing mutates state.items/state.outfits
  // between this turn's prepareContext and finalizeResult (true: the
  // agent-runtime service below only reads/writes through this same store,
  // and one pipeline turn never interleaves with another).
  const itemByTag = new Map(state.items.map((item, index) => [index + 1, item]));
  const outfitByTag = new Map(state.outfits.map((savedOutfit, index) => [qmOutfitTagLetter(index), savedOutfit]));

  let outfit = null;
  if (data.equipOutfit !== null && data.equipOutfit !== undefined) {
    outfit = outfitByTag.get(String(data.equipOutfit).trim().toUpperCase()) || null;
    if (!outfit) {
      logger?.warn("[quartermaster] tracker equipOutfit targeted an unknown tag %s -- skipped", JSON.stringify(data.equipOutfit));
    }
  }
  // applyOutfitEquip mutates outfit.slots to the resolved (possibly freshly
  // recreated) item ids, so outfitItemIds has to be read back AFTER it runs.
  let outfitItemIds = null;
  if (outfit) {
    applyOutfitEquip(state, outfit);
    outfitItemIds = new Set(Object.values(outfit.slots).map((snapshot) => snapshot.itemId));
  }

  for (const entry of addEntries) {
    if (!entry || typeof entry !== "object") continue;
    const name = normalizeText(entry.name, MAX_ITEM_NAME_LENGTH);
    if (!name) continue;
    const key = qmNormalizeMatchKey(name);

    // Same find-or-create-by-normalized-name merge the full-snapshot design
    // always used: an "addItem" for something already tracked under this
    // name merges into it instead of creating a duplicate. Only merges on a
    // matching NAME, never similarity — "Blue Hat" and "Red Hat" always stay
    // separate items.
    let item = state.items.find((candidate) => qmNormalizeMatchKey(candidate.name) === key);
    if (!item) {
      item = {
        id: randomUUID(),
        name,
        description: "",
        quantity: 1,
        location: "bag",
        defaultSlot: null,
        favorite: false,
      };
      state.items.push(item);
    }

    if (entry.description !== undefined) item.description = normalizeText(entry.description, MAX_ITEM_DESCRIPTION_LENGTH);
    if (entry.quantity !== undefined) item.quantity = normalizeQuantity(entry.quantity);
    // An item the active outfit already placed keeps that placement — the
    // outfit is authoritative over its own slots this turn.
    if (!(outfitItemIds && outfitItemIds.has(item.id))) {
      const rawLocation = typeof entry.location === "string" ? entry.location : "bag";
      const location = normalizeLocation(rawLocation, state);
      if (location !== null) applyLocation(state.items, item, location);
    }
  }

  for (const entry of updateEntries) {
    if (!entry || typeof entry !== "object") continue;
    const item = itemByTag.get(Number(entry.target));
    if (!item) {
      logger?.warn("[quartermaster] tracker updateItem targeted an unknown tag %s -- skipped", JSON.stringify(entry.target));
      continue;
    }
    // Patch-only, guarded by KEY PRESENCE, not truthiness: an omitted key
    // leaves that field completely untouched; a key present with an empty/
    // falsy value ("", 0) is a deliberate change and does apply. location
    // in particular must NOT default to anything here (unlike addItem's
    // "bag" default for a brand-new item) — defaulting a missing location
    // to "bag" on an update would silently reset an item's placement every
    // time only its quantity/description changed.
    if ("description" in entry) item.description = normalizeText(entry.description, MAX_ITEM_DESCRIPTION_LENGTH);
    if ("quantity" in entry) item.quantity = normalizeQuantity(entry.quantity);
    if ("location" in entry && !(outfitItemIds && outfitItemIds.has(item.id))) {
      const location = typeof entry.location === "string" ? normalizeLocation(entry.location, state) : null;
      if (location !== null) applyLocation(state.items, item, location);
    }
  }

  const removeIds = new Set();
  for (const tag of removeEntries) {
    const item = itemByTag.get(Number(tag));
    if (!item) {
      logger?.warn("[quartermaster] tracker removeItem targeted an unknown tag %s -- skipped", JSON.stringify(tag));
      continue;
    }
    removeIds.add(item.id);
  }
  // Saved outfits are NOT pruned when an item they reference is removed here
  // — see applyOutfitEquip's own comment: the outfit keeps its own name/
  // description snapshot precisely so it can recreate the item next time
  // it's equipped.
  if (removeIds.size > 0) state.items = state.items.filter((item) => !removeIds.has(item.id));

  // lastTrackerChange: one diff pass against previousSnapshot, taken AFTER
  // every operation above has applied. This uniformly covers a plain add,
  // an addItem that merged into an existing item, and an outfit-equip's own
  // side effects on its items (including anything it unequipped), with no
  // bookkeeping needed at each call site above. Always overwritten — even
  // to an empty record on a turn that changed nothing — same single-turn
  // scope as previousSnapshot, so the two always describe the same
  // most-recent turn. See the /revert-item route for how a stale entry here
  // (something changed again since) is guarded against rather than blindly
  // overwritten.
  const fieldsOf = (item) => ({ description: item.description, quantity: item.quantity, location: item.location });
  const beforeById = new Map(state.previousSnapshot.items.map((item) => [item.id, item]));
  const afterById = new Map(state.items.map((item) => [item.id, item]));
  const changeLog = {
    appliedAt: new Date().toISOString(),
    reasoning: normalizeText(data.reasoning, MAX_TRACKER_REASONING_LENGTH),
    addedItems: [],
    updatedItems: [],
    removedItems: [],
    equippedOutfitName: outfit ? outfit.name : null,
  };
  for (const [id, after] of afterById) {
    const before = beforeById.get(id);
    if (!before) {
      changeLog.addedItems.push({ id, name: after.name });
    } else if (
      before.description !== after.description ||
      before.quantity !== after.quantity ||
      before.location !== after.location
    ) {
      changeLog.updatedItems.push({ id, name: after.name, before: fieldsOf(before), after: fieldsOf(after) });
    }
  }
  for (const [id, before] of beforeById) {
    if (!afterById.has(id)) changeLog.removedItems.push({ id, name: before.name, before: fieldsOf(before) });
  }
  state.lastTrackerChange = changeLog;

  await persistState(chatId, ownerId, state);
}

// The narrator-facing summary — deliberately separate from
// computeAppearanceText/the {{getvar}} macro above, which stays equipped-only
// for image generation. This one is location-aware (equipped/carried/stored
// in one list, since item.location already encodes which) and includes only
// what the narrator needs to write consistent prose: never reasoning, the
// raw add/remove mechanics, or (once built) image-generation bookkeeping.
// Returns null when there's nothing to say, so the prompt-context contributor
// can skip contributing entirely rather than send an empty block.
function inventorySummaryText(personaName, items) {
  if (items.length === 0) return null;
  const lines = [];

  const equipped = equippedItemNamesText(items);
  if (equipped) lines.push(`Equipped: ${equipped}`);

  const nameWithQuantity = (item) => (item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name);

  const carried = items.filter((item) => item.location === "bag");
  if (carried.length > 0) lines.push(`Carrying: ${carried.map(nameWithQuantity).join(", ")}`);

  const storedByLocation = new Map();
  for (const item of items) {
    if (!item.location.startsWith("stored:")) continue;
    const label = item.location.slice("stored:".length);
    if (!storedByLocation.has(label)) storedByLocation.set(label, []);
    storedByLocation.get(label).push(item);
  }
  for (const [label, storedItems] of [...storedByLocation.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`Stored (${label}): ${storedItems.map(nameWithQuantity).join(", ")}`);
  }

  if (lines.length === 0) return null;
  return `${personaName}'s inventory —\n${lines.join("\n")}`;
}

// One dynamic variable per owner (quartermaster_appearance_persona for now;
// quartermaster_appearance_<characterId> once party support lands), written
// via chatMeta.macroVariables so a user-placed {{getvar::...}} token in that
// owner's appearance field resolves to it per chat. updateChatMetadata is a
// full REPLACE of the chat's metadata, not a merge (confirmed against the
// Engine's capability-persistence.service.ts), so this always reads the
// current metadata first and writes back the merged object — never the
// macroVariables patch alone, which would wipe every other metadata key the
// chat (or another package) has written. withChatLock serializes this
// against the Engine's own per-turn metadata writes (e.g. the narrator's own
// {{setvar}} persistence) so the two can't race and drop each other's
// change.
function appearanceVariableName(ownerId) {
  return `quartermaster_appearance_${ownerId}`;
}

// A user following this package's own README places
// {{getvar::quartermaster_appearance_<ownerId>}} literally in the persona's
// Appearance field so the Engine's own per-turn template rendering can
// substitute it during narration. The portrait-generation prompt reads that
// field straight from persistence, bypassing that rendering entirely, so the
// literal unresolved token would otherwise leak into the image-generation
// request as dead syntax. Strip it out entirely (not resolve it to real
// content -- unlike Build Wardrobe's own persona context, which deliberately
// leaves this macro untouched to avoid anchoring generation toward the
// CURRENT outfit; a portrait prompt has no such concern since it isn't
// trying to describe an existing look, only clean up noise the model has no
// use for).
function stripAppearanceMacroToken(text, ownerId) {
  if (!text) return text;
  const pattern = new RegExp(String.raw`\{\{\s*getvar::${appearanceVariableName(ownerId)}\s*\}\}`, "gi");
  return text
    .replace(pattern, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function syncAppearanceMacro(persistence, chatId, ownerId, state) {
  const variableName = appearanceVariableName(ownerId);
  const text = computeAppearanceText(state);
  await persistence.withChatLock(chatId, async () => {
    const chat = await persistence.getChat(chatId);
    if (!chat) return;
    const rawMetadata = chat.metadata;
    const metadata =
      typeof rawMetadata === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(rawMetadata);
              return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
            } catch {
              return {};
            }
          })()
        : rawMetadata && typeof rawMetadata === "object"
          ? { ...rawMetadata }
          : {};
    const macroVariables =
      metadata.macroVariables && typeof metadata.macroVariables === "object" ? { ...metadata.macroVariables } : {};
    if (macroVariables[variableName] === text) return;
    macroVariables[variableName] = text;
    metadata.macroVariables = macroVariables;
    await persistence.updateChatMetadata({ chatId, metadata, updatedAt: new Date().toISOString() });
  });
}

async function loadInventoryDoc(documents, chatId, ownerId) {
  return documents.getById(PACKAGE_ID, inventoryDocId(chatId, ownerId));
}

async function loadInventoryState(documents, chatId, ownerId) {
  const doc = await loadInventoryDoc(documents, chatId, ownerId);
  const outfits = Array.isArray(doc?.data?.outfits) ? doc.data.outfits : [];
  return {
    items: Array.isArray(doc?.data?.items) ? doc.data.items : [],
    // portraitFile defaults to null for outfits saved before this feature
    // existed — same forward-compatible-read pattern as
    // normalizeOutfitSlotSnapshot above.
    outfits: outfits.map((outfit) => ({ portraitFile: null, ...outfit })),
    appearanceFeedMode: APPEARANCE_FEED_MODES.has(doc?.data?.appearanceFeedMode) ? doc.data.appearanceFeedMode : "off",
    // Per-group defaults (SLOT_GROUP_DEFAULTS): underwear off so a fresh
    // inventory is SFW, armor/weapons on since most characters use them.
    showUnderwear: typeof doc?.data?.showUnderwear === "boolean" ? doc.data.showUnderwear : SLOT_GROUP_DEFAULTS.underwear,
    showArmor: typeof doc?.data?.showArmor === "boolean" ? doc.data.showArmor : SLOT_GROUP_DEFAULTS.armor,
    showWeapons: typeof doc?.data?.showWeapons === "boolean" ? doc.data.showWeapons : SLOT_GROUP_DEFAULTS.weapons,
    // Opt-in, default-off, per-chat: also push the active outfit's portrait
    // to the persona's real avatar (resources.updatePersona), not just
    // Quartermaster's own dock. originalPersonaAvatarPath/originalAvatarCaptured
    // let a later revert (outfit unequipped, or one with no portrait equipped)
    // restore exactly what was there before Quartermaster ever touched it —
    // captured lazily, the first time the toggle actually fires.
    replaceRealAvatarOnEquip: typeof doc?.data?.replaceRealAvatarOnEquip === "boolean" ? doc.data.replaceRealAvatarOnEquip : false,
    originalAvatarCaptured: typeof doc?.data?.originalAvatarCaptured === "boolean" ? doc.data.originalAvatarCaptured : false,
    originalPersonaAvatarPath:
      typeof doc?.data?.originalPersonaAvatarPath === "string" || doc?.data?.originalPersonaAvatarPath === null
        ? doc.data.originalPersonaAvatarPath
        : null,
    // The npc-avatar file Quartermaster itself last wrote for this chat, so
    // the next sync can clean it up first — avatars/npc/ isn't swept by the
    // Engine (confirmed), so without this every equip cycle leaks one file.
    lastAvatarNpcFile: typeof doc?.data?.lastAvatarNpcFile === "string" ? doc.data.lastAvatarNpcFile : null,
    // A single-level undo for the tracker agent specifically: captured at
    // the top of reconcileTrackerOutput, right before that turn's changes
    // are applied, so a bad or wildly wrong agent response can be reverted
    // via "Restore Inventory" in Settings. Not a full history stack — see
    // that function's own comment and the /restore route for the scope.
    previousSnapshot:
      doc?.data?.previousSnapshot && typeof doc.data.previousSnapshot === "object"
        ? {
            items: Array.isArray(doc.data.previousSnapshot.items) ? doc.data.previousSnapshot.items : [],
            outfits: Array.isArray(doc.data.previousSnapshot.outfits) ? doc.data.previousSnapshot.outfits : [],
          }
        : null,
    // What the last tracker-agent turn actually did, in review-able form —
    // the "Recent Changes" view in Settings, plus the source of truth for
    // /revert-item's per-item undo. Written by reconcileTrackerOutput
    // alongside previousSnapshot (same single-turn scope, always in
    // lockstep with it — see that function's own comment).
    lastTrackerChange:
      doc?.data?.lastTrackerChange && typeof doc.data.lastTrackerChange === "object"
        ? {
            appliedAt: typeof doc.data.lastTrackerChange.appliedAt === "string" ? doc.data.lastTrackerChange.appliedAt : "",
            reasoning: typeof doc.data.lastTrackerChange.reasoning === "string" ? doc.data.lastTrackerChange.reasoning : "",
            addedItems: Array.isArray(doc.data.lastTrackerChange.addedItems) ? doc.data.lastTrackerChange.addedItems : [],
            updatedItems: Array.isArray(doc.data.lastTrackerChange.updatedItems) ? doc.data.lastTrackerChange.updatedItems : [],
            removedItems: Array.isArray(doc.data.lastTrackerChange.removedItems) ? doc.data.lastTrackerChange.removedItems : [],
            equippedOutfitName:
              typeof doc.data.lastTrackerChange.equippedOutfitName === "string"
                ? doc.data.lastTrackerChange.equippedOutfitName
                : null,
          }
        : null,
    // Generate Image settings -- a purely local preference read only when
    // THIS package calls the Engine's own image-generation route (see
    // resolveImageConnection/generateImageViaEngine below); never anything
    // that touches an Engine-wide default. Empty template string means "use
    // the built-in default", not the literal default text -- same
    // fallback-at-use-time pattern as every other optional text field here.
    imageConnectionId: typeof doc?.data?.imageConnectionId === "string" ? doc.data.imageConnectionId : null,
    itemImagePromptTemplate:
      typeof doc?.data?.itemImagePromptTemplate === "string" ? doc.data.itemImagePromptTemplate : "",
    outfitPortraitPromptTemplate:
      typeof doc?.data?.outfitPortraitPromptTemplate === "string" ? doc.data.outfitPortraitPromptTemplate : "",
  };
}

// Neither slot instance's capabilityProps carries personaInfo/avatarUrl --
// confirmed against the Engine's actual render sites
// (RoleplayHUD.tsx's roleplay-tracker props and TrackerDataSidebar.tsx's
// tracker-panel props are both far narrower than assumed). So the persona's
// avatar/name are resolved server-side instead: the chat's personaId, then
// that persona's record via the resources facade — the same field names the
// Engine's own client reads (persona.avatarPath, persona.name) for the
// identical purpose. One lookup shared by both resolvers below, rather than
// two copies of the same chat→persona round trip.
async function resolveChatPersonaData(persistence, resources, chatId) {
  const chat = await persistence.getChat(chatId);
  if (!chat || !chat.personaId) return null;
  const [persona] = await resources.listPersonas([chat.personaId]);
  return persona?.data ?? null;
}

async function resolvePersonaAvatarUrl(persistence, resources, chatId) {
  const data = await resolveChatPersonaData(persistence, resources, chatId);
  const avatarPath = data && typeof data.avatarPath === "string" ? data.avatarPath : null;
  return avatarPath || null;
}

// The opt-in real-avatar-replace sync. `outfit` is the outfit now considered
// "active" (currently equipped, per outfitMatchesCurrent) — pass null when
// nothing matches any saved outfit at all (unequip-all). Whether that outfit
// actually has a portrait decides swap vs. revert; a portrait-less active
// outfit is treated the same as "nothing active" (revert), so the avatar
// always reflects the current specific outfit's portrait or the persona's
// normal avatar, never a stale one from a previously-equipped outfit.
//
// Mutates `state` (originalAvatarCaptured/originalPersonaAvatarPath/
// lastAvatarNpcFile) — caller is responsible for persisting it afterward,
// same as every other state-mutating helper in this file.
async function syncRealAvatarForOutfit(persistence, resources, dataDir, chatId, state, outfit) {
  if (!state.replaceRealAvatarOnEquip) return;
  const chat = await persistence.getChat(chatId);
  const personaId = chat?.personaId;
  if (!personaId) return;

  if (!state.originalAvatarCaptured) {
    const [persona] = await resources.listPersonas([personaId]);
    const currentAvatarPath =
      persona?.data && typeof persona.data.avatarPath === "string" ? persona.data.avatarPath : null;
    state.originalPersonaAvatarPath = currentAvatarPath;
    state.originalAvatarCaptured = true;
  }

  if (state.lastAvatarNpcFile) {
    await removePortraitFileIfExists(join(avatarsNpcDir(dataDir, chatId), state.lastAvatarNpcFile));
    state.lastAvatarNpcFile = null;
  }

  if (outfit && outfit.portraitFile) {
    let buffer;
    try {
      buffer = await readFile(join(galleryPortraitDir(dataDir, chatId), outfit.portraitFile));
    } catch {
      return; // Portrait record exists but the file is missing — leave the avatar as-is rather than guess.
    }
    const ext = outfit.portraitFile.slice(outfit.portraitFile.lastIndexOf(".") + 1);
    const filename = `qm-${outfit.id}-${randomUUID().slice(0, 8)}.${ext}`;
    const dir = avatarsNpcDir(dataDir, chatId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), buffer);
    await resources.updatePersona(personaId, { avatarPath: `/api/avatars/npc/${encodeURIComponent(chatId)}/${filename}` });
    state.lastAvatarNpcFile = filename;
  } else {
    await resources.updatePersona(personaId, { avatarPath: state.originalPersonaAvatarPath });
  }
}

// Falls back to a generic label rather than failing the whole prompt-context
// contribution when there's no active persona to name.
async function resolvePersonaName(persistence, resources, chatId) {
  const data = await resolveChatPersonaData(persistence, resources, chatId);
  const name = data && typeof data.name === "string" ? data.name.trim() : "";
  return name || "The persona";
}

// Personas share the same character-card-shaped record characters do (confirmed against
// another package's own character-context reader) — description/personality/scenario/
// appearance/backstory are all real, if usually sparser than a full character. Used by the
// wardrobe builder to give the model a sense of who it's dressing; every other Quartermaster
// feature only ever needed avatarPath/name. Each field capped defensively (a persona record
// isn't otherwise size-bounded here) and omitted entirely when blank, so a persona with nothing
// filled in still returns a valid (empty) context rather than failing.
const MAX_WARDROBE_CONTEXT_FIELD_LENGTH = 2000;
async function resolvePersonaWardrobeContext(persistence, resources, chatId) {
  const data = await resolveChatPersonaData(persistence, resources, chatId);
  if (!data || typeof data !== "object") return null;
  const extensions = data.extensions && typeof data.extensions === "object" ? data.extensions : {};
  const context = {};
  const fields = {
    description: data.description,
    personality: data.personality,
    scenario: data.scenario,
    appearance: data.appearance ?? extensions.appearance,
    backstory: data.backstory ?? extensions.backstory,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string" && value.trim()) {
      context[key] = value.trim().slice(0, MAX_WARDROBE_CONTEXT_FIELD_LENGTH);
    }
  }
  return Object.keys(context).length > 0 ? context : null;
}

async function saveInventoryState(documents, chatId, ownerId, state) {
  const id = inventoryDocId(chatId, ownerId);
  const now = new Date().toISOString();
  const existing = await documents.getById(PACKAGE_ID, id);
  const data = { chatId, ownerId, ...state };
  if (!existing) {
    await documents.create({
      id,
      packageId: PACKAGE_ID,
      kind: INVENTORY_KIND,
      name: `Inventory ${id}`,
      description: "Quartermaster inventory record.",
      data,
      createdAt: now,
      updatedAt: now,
    });
    return;
  }
  await documents.update({
    id,
    packageId: PACKAGE_ID,
    expectedRevision: existing.revision,
    name: existing.name,
    description: existing.description,
    data,
    updatedAt: now,
  });
}

export async function activate(context) {
  const { api } = context;
  const { persistence, resources, logger } = api.runtime;
  const { documents } = persistence;

  // Every route below calls this instead of saveInventoryState directly, so
  // the appearance macro can never fall out of sync with an equip/outfit/
  // settings change — there's exactly one path to disk, and it's this one.
  async function persistState(chatId, ownerId, state) {
    await saveInventoryState(documents, chatId, ownerId, state);
    await syncAppearanceMacro(persistence, chatId, ownerId, state);
  }

  // Wires the "quartermaster" agent's post_processing pipeline run to this
  // package's own store — see reconcileTrackerOutput's own comment. Keyed
  // "agent-runtime:<packageId>" per the capability-agent-runtime contract;
  // requires the "agent-runtime" permission in the manifest.
  //
  // prepareContext hands the owner's CURRENT persisted items back into the
  // agent's own prompt (via <agent_runtime_context>, referenced in the
  // prompt template) — sourced from our own canonical store rather than
  // depending on the engine's generic committed-tracker-state carryback,
  // which isn't confirmed to apply to third-party packages.
  const releaseAgentRuntime = api.registerService(`agent-runtime:${PACKAGE_ID}`, {
    async prepareContext({ context }) {
      if (context.chatMode !== "roleplay") return null;
      const state = await loadInventoryState(documents, context.chatId, QM_TRACKER_OWNER_ID);
      return formatAgentRuntimeContext(
        state.items,
        state.outfits.map((outfit) => outfit.name),
      );
    },
    async finalizeResult({ context, result }) {
      if (context.chatMode === "roleplay" && result?.success && result.data && typeof result.data === "object") {
        try {
          await reconcileTrackerOutput(documents, persistState, context.chatId, QM_TRACKER_OWNER_ID, result.data, logger);
        } catch (error) {
          // A bad or malformed turn must never break generation — the next
          // turn's full-snapshot output self-corrects, same as every other
          // tracker in this ecosystem tolerates an occasional bad response.
          // Still logged (not just swallowed) so a turn that fails EVERY
          // time — as opposed to an occasional bad model response — is
          // actually visible instead of looking identical to silent success.
          logger.warn(
            "[quartermaster] reconcileTrackerOutput failed for chat %s: %s",
            context.chatId,
            error instanceof Error ? error.message : String(error),
          );
        }
      }
      return result;
    },
  });

  // The curated narrator feed — separate from, and narrower
  // than, agent-runtime's prepareContext above: that one feeds the TRACKER
  // AGENT its own prior state so it can decide what changed; this feeds the
  // NARRATOR a short, location-aware summary so prose stays consistent with
  // what's actually equipped/carried. Gated on the agent being currently
  // enabled for the chat (isQuartermasterAgentActive) — disabling the agent
  // now stops this feed the same turn, matching every built-in tracker's own
  // behavior, rather than continuing to report whatever was last written.
  // provides.inventory:true hands us the built-in [inventory:] block/command
  // instead of running both side by side.
  const releasePromptContext = api.registerPromptContext(async ({ chatId, mode, chatMeta }) => {
    if (mode !== "roleplay" || !chatId || !isQuartermasterAgentActive(chatMeta)) return null;
    try {
      const state = await loadInventoryState(documents, chatId, QM_TRACKER_OWNER_ID);
      // Skip the persona lookup entirely when there's nothing to report yet —
      // this runs on every generation, not just once.
      if (state.items.length === 0) return null;
      const personaName = await resolvePersonaName(persistence, resources, chatId);
      const text = inventorySummaryText(personaName, state.items);
      if (!text) return null;
      return { text, provides: { inventory: true } };
    } catch {
      return null;
    }
  });

  const releaseRoutes = await api.registerPrivilegedRoutes(
    async (routes) => {
      // Bundled, not per-chat — no chatId/ownerId in the path. NOT cached
      // aggressively, despite that: this route's URL is just the slot name
      // ("/inventory/slot-icon/head"), which never changes across package
      // versions, unlike the outfit-portrait route below (whose filename
      // gets a fresh random suffix on every replace, making long caching
      // actually safe there). An immutable/year-long Cache-Control here
      // would tell the browser to keep serving pre-update bytes forever once
      // cached once. Confirmed live as TWO stacked stale-cache bugs, not
      // one: clearing the browser's own site data still kept showing old
      // icons, because loadSlotIconBuffer also cached the file contents in
      // memory for the Engine process's own lifetime (see that function's
      // own comment) — a real icon-content swap needed both layers cleared,
      // browser cache and a server restart, to actually show up. Same short
      // cache window the item-image route uses.
      routes.get("/inventory/slot-icon/:slot", async (request, reply) => {
        const { slot } = request.params;
        const buffer = await loadSlotIconBuffer(slot);
        if (!buffer) return reply.status(404).send({ error: "No icon for slot" });
        reply.header("Cache-Control", "public, max-age=300");
        reply.type("image/webp");
        return reply.send(buffer);
      });

      routes.get("/inventory/:chatId/:ownerId", async (request, reply) => {
        const { chatId, ownerId } = request.params;
        const state = await loadInventoryState(documents, chatId, ownerId);
        const personaAvatarUrl = await resolvePersonaAvatarUrl(persistence, resources, chatId);
        return { ...state, equipSlots: EQUIP_SLOTS, personaAvatarUrl };
      });

      routes.post("/inventory/:chatId/:ownerId/items", async (request, reply) => {
        const { chatId, ownerId } = request.params;
        const body = request.body ?? {};
        const name = normalizeText(body.name, MAX_ITEM_NAME_LENGTH);
        if (!name) return reply.status(400).send({ error: "Item name is required" });

        const defaultSlot = body.defaultSlot === undefined ? null : normalizeDefaultSlot(body.defaultSlot);
        if (defaultSlot === undefined) return reply.status(400).send({ error: "Invalid defaultSlot" });

        const state = await loadInventoryState(documents, chatId, ownerId);
        const location = body.location === undefined ? "bag" : normalizeLocation(body.location, state);
        if (location === null) return reply.status(400).send({ error: "Invalid location" });

        const item = {
          id: randomUUID(),
          name,
          description: normalizeText(body.description, MAX_ITEM_DESCRIPTION_LENGTH),
          quantity: normalizeQuantity(body.quantity),
          location: "bag",
          defaultSlot,
          favorite: false,
        };
        applyLocation(state.items, item, location);
        state.items.push(item);
        await persistState(chatId, ownerId, state);
        return { items: state.items, outfits: state.outfits };
      });

      routes.patch("/inventory/:chatId/:ownerId/items/:itemId", async (request, reply) => {
        const { chatId, ownerId, itemId } = request.params;
        const body = request.body ?? {};
        const state = await loadInventoryState(documents, chatId, ownerId);
        const item = state.items.find((candidate) => candidate.id === itemId);
        if (!item) return reply.status(404).send({ error: "Item not found" });

        if (body.name !== undefined) {
          const name = normalizeText(body.name, MAX_ITEM_NAME_LENGTH);
          if (!name) return reply.status(400).send({ error: "Item name is required" });
          item.name = name;
          // Outfit slots carry their own name/description snapshot, not a
          // live reference (see applyOutfitEquip's own comment) — a rename
          // has to be pushed into every saved outfit's copy too, or a
          // renamed item shows its old name the next time that outfit's
          // equipped, and (worse) would fail to name-match itself on a
          // future recreate, minting a duplicate under the old name.
          for (const outfit of state.outfits) {
            for (const snapshot of Object.values(outfit.slots ?? {})) {
              if (snapshot && typeof snapshot === "object" && snapshot.itemId === item.id) snapshot.name = name;
            }
          }
        }
        if (body.description !== undefined) item.description = normalizeText(body.description, MAX_ITEM_DESCRIPTION_LENGTH);
        if (body.quantity !== undefined) item.quantity = normalizeQuantity(body.quantity);
        if (body.location !== undefined) {
          const location = normalizeLocation(body.location, state);
          if (location === null) return reply.status(400).send({ error: "Invalid location" });
          applyLocation(state.items, item, location);
        }
        if (body.defaultSlot !== undefined) {
          const defaultSlot = normalizeDefaultSlot(body.defaultSlot);
          if (defaultSlot === undefined) return reply.status(400).send({ error: "Invalid defaultSlot" });
          item.defaultSlot = defaultSlot;
        }
        if (body.favorite !== undefined) item.favorite = Boolean(body.favorite);

        await persistState(chatId, ownerId, state);
        return { items: state.items, outfits: state.outfits };
      });

      routes.post("/inventory/:chatId/:ownerId/unequip-all", async (request, reply) => {
        const { chatId, ownerId } = request.params;
        const state = await loadInventoryState(documents, chatId, ownerId);
        for (const item of state.items) {
          if (item.location.startsWith("equipped:")) item.location = "bag";
        }
        await syncRealAvatarForOutfit(persistence, resources, context.dataDir, chatId, state, null);
        await persistState(chatId, ownerId, state);
        return { items: state.items, outfits: state.outfits };
      });

      // Reverts items+outfits to the snapshot captured just before the LAST
      // tracker-agent turn (reconcileTrackerOutput's own previousSnapshot
      // write) — the "Restore Inventory" safety net in Settings, for when a
      // bad agent response wipes or badly mangles the inventory and there's
      // nothing to re-import. Single-level: restoring consumes the snapshot
      // (set to null) rather than leaving it in place, so clicking it twice
      // can't ping-pong between the same two states.
      routes.post("/inventory/:chatId/:ownerId/restore", async (request, reply) => {
        const { chatId, ownerId } = request.params;
        const state = await loadInventoryState(documents, chatId, ownerId);
        if (!state.previousSnapshot) return reply.status(409).send({ error: "Nothing to restore" });

        state.items = state.previousSnapshot.items;
        state.outfits = state.previousSnapshot.outfits;
        state.previousSnapshot = null;

        const active = state.outfits.find((candidate) => outfitMatchesCurrent(candidate, state.items));
        await syncRealAvatarForOutfit(persistence, resources, context.dataDir, chatId, state, active ?? null);

        await persistState(chatId, ownerId, state);
        return { items: state.items, outfits: state.outfits, previousSnapshot: state.previousSnapshot };
      });

      // Per-item undo, additive to the whole-inventory /restore above — for
      // "one specific thing from the last turn is wrong," not "everything's
      // a mess." Matches strictly by id against lastTrackerChange's own
      // self-contained before/after values (never falls back to name, so a
      // stale entry can never land on an unrelated item that happens to
      // reuse a name later) and refuses rather than overwrites if the item
      // has moved on since — something else (a manual edit, a later turn)
      // changed it again after this record was made. See
      // reconcileTrackerOutput's own comment on why lastTrackerChange is a
      // fresh diff every turn, not a rolling history.
      routes.post("/inventory/:chatId/:ownerId/revert-item", async (request, reply) => {
        const { chatId, ownerId } = request.params;
        const itemId = typeof request.body?.itemId === "string" ? request.body.itemId : "";
        if (!itemId) return reply.status(400).send({ error: "itemId is required" });

        const state = await loadInventoryState(documents, chatId, ownerId);
        const change = state.lastTrackerChange;
        if (!change) return reply.status(409).send({ error: "Nothing to revert" });

        const fieldsMatch = (item, fields) =>
          item.description === fields.description && item.quantity === fields.quantity && item.location === fields.location;

        const addedIndex = change.addedItems.findIndex((entry) => entry.id === itemId);
        const updatedIndex = change.updatedItems.findIndex((entry) => entry.id === itemId);
        const removedIndex = change.removedItems.findIndex((entry) => entry.id === itemId);

        if (addedIndex !== -1) {
          // "Before" an add is "didn't exist" — reverting just removes it,
          // but only while it's still exactly what the turn created.
          const item = state.items.find((candidate) => candidate.id === itemId);
          if (!item) return reply.status(409).send({ error: "Item no longer exists" });
          state.items = state.items.filter((candidate) => candidate.id !== itemId);
          change.addedItems.splice(addedIndex, 1);
        } else if (updatedIndex !== -1) {
          const entry = change.updatedItems[updatedIndex];
          const item = state.items.find((candidate) => candidate.id === itemId);
          if (!item) return reply.status(409).send({ error: "Item no longer exists" });
          if (!fieldsMatch(item, entry.after)) {
            return reply.status(409).send({ error: "This item has changed since -- can't safely revert" });
          }
          item.description = entry.before.description;
          item.quantity = entry.before.quantity;
          const location = normalizeLocation(entry.before.location, state);
          if (location !== null) applyLocation(state.items, item, location);
          change.updatedItems.splice(updatedIndex, 1);
        } else if (removedIndex !== -1) {
          const entry = change.removedItems[removedIndex];
          if (state.items.some((candidate) => candidate.id === itemId)) {
            return reply.status(409).send({ error: "Item already exists again -- can't safely revert" });
          }
          // Fresh id, not the dead one — nothing else references an item's
          // id across a deletion (outfits keep their own name/description
          // slot snapshot, not a live item reference), so there's no reason
          // to reclaim it.
          const item = {
            id: randomUUID(),
            name: entry.name,
            description: entry.before.description,
            quantity: entry.before.quantity,
            location: "bag",
            defaultSlot: null,
            favorite: false,
          };
          const location = normalizeLocation(entry.before.location, state);
          if (location !== null) applyLocation(state.items, item, location);
          state.items.push(item);
          change.removedItems.splice(removedIndex, 1);
        } else {
          return reply.status(404).send({ error: "Nothing to revert for this item" });
        }

        state.lastTrackerChange = change;
        const active = state.outfits.find((candidate) => outfitMatchesCurrent(candidate, state.items));
        await syncRealAvatarForOutfit(persistence, resources, context.dataDir, chatId, state, active ?? null);

        await persistState(chatId, ownerId, state);
        return { items: state.items, outfits: state.outfits, lastTrackerChange: state.lastTrackerChange };
      });

      routes.delete("/inventory/:chatId/:ownerId/items/:itemId", async (request, reply) => {
        const { chatId, ownerId, itemId } = request.params;
        const state = await loadInventoryState(documents, chatId, ownerId);
        const nextItems = state.items.filter((candidate) => candidate.id !== itemId);
        if (nextItems.length === state.items.length) return reply.status(404).send({ error: "Item not found" });
        state.items = nextItems;

        // Saved outfits keep their own name/description snapshot per slot
        // now (not just the id), so a deleted item's slot is NOT pruned —
        // re-equipping that outfit later recreates it fresh. See
        // applyOutfitEquip's own comment for why this is deliberate.

        await persistState(chatId, ownerId, state);
        return { items: state.items, outfits: state.outfits };
      });

      // Serves an item's image, resolved by NAME (not a stored reference —
      // see findItemImageFile's own comment). 404 with no body when nothing
      // matches; the client swaps to its placeholder box on that, not an
      // error state.
      routes.get("/inventory/:chatId/:ownerId/items/:itemId/image", async (request, reply) => {
        const { chatId, ownerId, itemId } = request.params;
        const state = await loadInventoryState(documents, chatId, ownerId);
        const item = state.items.find((candidate) => candidate.id === itemId);
        if (!item) return reply.status(404).send({ error: "Item not found" });

        const found = await findItemImageFile(galleryItemsDir(context.dataDir), qmNormalizeMatchKey(item.name));
        if (!found) return reply.status(404).send({ error: "No matching image" });

        let buffer;
        try {
          buffer = await readFile(found.path);
        } catch {
          return reply.status(404).send({ error: "Image file missing" });
        }
        reply.header("Cache-Control", "public, max-age=300");
        reply.type(ITEM_IMAGE_EXT_TO_CONTENT_TYPE[found.ext] ?? "application/octet-stream");
        return reply.send(buffer);
      });

      // Uploads an image for this item, straight into gallery/quartermaster/items/
      // (never a subfolder — those are reserved for a hand-placed image pack,
      // never touched by upload/remove). Named after the item's OWN normalized
      // match key so it's found by the exact same lookup a pack image would be,
      // and any existing top-level file(s) matching that key are removed first
      // (an item has at most one uploaded image; re-uploading replaces it,
      // even across a format change, e.g. a prior .png replaced by a .jpg).
      routes.post("/inventory/:chatId/:ownerId/items/:itemId/image", async (request, reply) => {
        const { chatId, ownerId, itemId } = request.params;
        const body = request.body ?? {};
        const decoded = decodePortraitDataUrl(body.imageDataUrl);
        if (!decoded) return reply.status(400).send({ error: "Invalid or oversized image" });

        const state = await loadInventoryState(documents, chatId, ownerId);
        const item = state.items.find((candidate) => candidate.id === itemId);
        if (!item) return reply.status(404).send({ error: "Item not found" });

        const dir = galleryItemsDir(context.dataDir);
        await mkdir(dir, { recursive: true });
        const key = qmNormalizeMatchKey(item.name);
        let existing;
        try {
          existing = await readdir(dir, { withFileTypes: true });
        } catch {
          existing = [];
        }
        for (const entry of existing) {
          if (!entry.isFile()) continue;
          const dot = entry.name.lastIndexOf(".");
          if (dot <= 0 || qmNormalizeMatchKey(entry.name.slice(0, dot)) !== key) continue;
          await removePortraitFileIfExists(join(dir, entry.name));
        }
        await writeFile(join(dir, `${key}.${decoded.ext}`), decoded.buffer);

        return { items: state.items, outfits: state.outfits };
      });

      // Cheap: fills the saved (or default) item-image prompt template with
      // this item's own name/description -- no LLM/image-gen cost, so safe
      // to call every time "Generate" is opened. Shares buildItemImagePrompt
      // with /generate below so the review textarea always starts from
      // exactly what would be sent.
      routes.post("/inventory/:chatId/:ownerId/items/:itemId/image/prompt-preview", async (request, reply) => {
        const { chatId, ownerId, itemId } = request.params;
        const state = await loadInventoryState(documents, chatId, ownerId);
        const item = state.items.find((candidate) => candidate.id === itemId);
        if (!item) return reply.status(404).send({ error: "Item not found" });
        return { prompt: buildItemImagePrompt(state.itemImagePromptTemplate, item) };
      });

      // The paid call. Body: { prompt } -- the review-step text (possibly
      // edited). Returns { imageDataUrl }, UNSAVED -- mirrors Build
      // Wardrobe's generate/confirm split: the client hands this data URL
      // to the ALREADY-EXISTING POST .../items/:itemId/image route above to
      // actually persist it, exactly like an upload would. This route never
      // writes to storage.
      routes.post("/inventory/:chatId/:ownerId/items/:itemId/image/generate", async (request, reply) => {
        const { chatId, ownerId, itemId } = request.params;
        const body = request.body ?? {};
        const prompt = normalizeText(body.prompt, MAX_REVIEW_PROMPT_LENGTH);
        if (!prompt) return reply.status(400).send({ error: "A prompt is required" });

        const state = await loadInventoryState(documents, chatId, ownerId);
        const item = state.items.find((candidate) => candidate.id === itemId);
        if (!item) return reply.status(404).send({ error: "Item not found" });

        let connection;
        try {
          connection = await resolveImageConnection(state.imageConnectionId);
        } catch (error) {
          logger?.warn(
            "[quartermaster] could not reach the Engine's own connections list: %s",
            error instanceof Error ? error.message : String(error),
          );
          return reply.status(502).send({ error: "engine-unreachable" });
        }
        if (!connection) return reply.status(400).send({ error: "no-image-connection" });

        try {
          const imageDataUrl = await generateImageViaEngine({
            connectionId: connection.id,
            name: item.name,
            prompt,
            width: ITEM_IMAGE_GEN_WIDTH,
            height: ITEM_IMAGE_GEN_HEIGHT,
            logger,
          });
          return { imageDataUrl };
        } catch (error) {
          logger?.warn(
            "[quartermaster] item image generation failed: %s",
            error instanceof Error ? error.message : String(error),
          );
          return reply.status(502).send({ error: "generation-failed" });
        }
      });

      // Removes only an UPLOADED image (a top-level file matching this
      // item's key) — never touches a subfolder, so this can never delete
      // anything from a hand-placed image pack. If a pack image also
      // happens to match this item's name, it'll still show afterward;
      // that's a real, known limitation of matching purely by name rather
      // than a per-item reference, not a bug.
      routes.delete("/inventory/:chatId/:ownerId/items/:itemId/image", async (request, reply) => {
        const { chatId, ownerId, itemId } = request.params;
        const state = await loadInventoryState(documents, chatId, ownerId);
        const item = state.items.find((candidate) => candidate.id === itemId);
        if (!item) return reply.status(404).send({ error: "Item not found" });

        const dir = galleryItemsDir(context.dataDir);
        const key = qmNormalizeMatchKey(item.name);
        let entries;
        try {
          entries = await readdir(dir, { withFileTypes: true });
        } catch {
          entries = [];
        }
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          const dot = entry.name.lastIndexOf(".");
          if (dot <= 0 || qmNormalizeMatchKey(entry.name.slice(0, dot)) !== key) continue;
          await removePortraitFileIfExists(join(dir, entry.name));
        }

        return { items: state.items, outfits: state.outfits };
      });

      routes.post("/inventory/:chatId/:ownerId/outfits", async (request, reply) => {
        const { chatId, ownerId } = request.params;
        const body = request.body ?? {};
        const name = normalizeText(body.name, MAX_OUTFIT_NAME_LENGTH);
        if (!name) return reply.status(400).send({ error: "Outfit name is required" });

        const state = await loadInventoryState(documents, chatId, ownerId);
        const outfit = {
          id: randomUUID(),
          name,
          description: normalizeText(body.description, MAX_OUTFIT_DESCRIPTION_LENGTH),
          slots: currentEquippedSlots(state.items),
          portraitFile: null,
        };
        state.outfits.push(outfit);
        await persistState(chatId, ownerId, state);
        return { items: state.items, outfits: state.outfits };
      });

      routes.patch("/inventory/:chatId/:ownerId/outfits/:outfitId", async (request, reply) => {
        const { chatId, ownerId, outfitId } = request.params;
        const body = request.body ?? {};
        const state = await loadInventoryState(documents, chatId, ownerId);
        const outfit = state.outfits.find((candidate) => candidate.id === outfitId);
        if (!outfit) return reply.status(404).send({ error: "Outfit not found" });

        if (body.name !== undefined) {
          const name = normalizeText(body.name, MAX_OUTFIT_NAME_LENGTH);
          if (!name) return reply.status(400).send({ error: "Outfit name is required" });
          outfit.name = name;
        }
        if (body.description !== undefined) {
          outfit.description = normalizeText(body.description, MAX_OUTFIT_DESCRIPTION_LENGTH);
        }
        // "Update" in the extension's sense — resave the currently-equipped
        // items into this outfit without changing its name/description.
        if (body.resnapshot === true) outfit.slots = currentEquippedSlots(state.items);

        await persistState(chatId, ownerId, state);
        return { items: state.items, outfits: state.outfits };
      });

      // Build Wardrobe: a one-shot, user-triggered LLM call (not the
      // recurring post_processing tracker agent) that proposes new items +
      // outfits from a free-text style direction. This route never writes
      // to storage -- it only returns the parsed proposal for the client to
      // preview; /wardrobe/confirm below is the separate step that actually
      // persists, mirroring hierarchical-maps' own generate-then-save split
      // for its "World Maps" AI builder.
      routes.post("/inventory/:chatId/:ownerId/wardrobe/generate", async (request, reply) => {
        const { chatId, ownerId } = request.params;
        const body = request.body ?? {};
        const direction = normalizeText(body.direction, 4000);
        if (!direction) return reply.status(400).send({ error: "A style direction is required" });
        const includePersonaContext = body.includePersonaContext !== false;
        // The host's Debug Mode toggle only rides along on the normal
        // per-turn chat-generation request -- a plain custom route like this
        // one has no other way to see it, so the client forwards its own
        // live copy (QM.state.debugMode, synced from capabilityProps). Still
        // OR'd with isDebugAgentsEnabled() (the server-env override) so a
        // forced-on env var keeps working regardless of what the client
        // sends, same fallback chain hierarchical-maps uses for its own
        // on-demand generation routes.
        const debugMode = body.debugMode === true || (api.runtime.isDebugAgentsEnabled?.() ?? false);

        const state = await loadInventoryState(documents, chatId, ownerId);
        const personaContext = includePersonaContext
          ? await resolvePersonaWardrobeContext(persistence, resources, chatId)
          : null;
        const chat = await persistence.getChat(chatId);
        // The tracker agent's own configured connection (editable in the
        // Agents menu) takes priority, so switching it there also moves
        // wardrobe generation -- falls back to the chat's default connection
        // only when the agent has none set.
        const agentConfig = await api.runtime.getAgentConfig();

        const result = await generateWardrobeProposal({
          runtime: api.runtime,
          logger,
          debugMode,
          agentConnectionId: agentConfig?.connectionId ?? null,
          chatConnectionId: chat?.connectionId ?? null,
          direction,
          personaContext,
          includePersonaContext,
          // Wearable only (a real defaultSlot) -- a phone/wallet/book with no
          // equip slot must never be offered as outfit material in the first
          // place, not just discouraged by the prompt's own rules.
          existingItems: state.items
            .filter((item) => item.defaultSlot)
            .map((item) => ({ name: item.name, description: item.description, defaultSlot: item.defaultSlot })),
        });
        if (!result.ok) return reply.status(502).send({ error: result.error });
        return { proposal: result.proposal };
      });

      // The confirm step for Build Wardrobe. The client echoes back exactly
      // what /generate returned (unedited in v1 -- no per-item editing yet);
      // this re-validates it server-side via the same parseWardrobeProposal
      // used on the raw LLM text, rather than trusting the client's copy.
      routes.post("/inventory/:chatId/:ownerId/wardrobe/confirm", async (request, reply) => {
        const { chatId, ownerId } = request.params;
        const body = request.body ?? {};
        const proposal = parseWardrobeProposal(JSON.stringify(body.proposal ?? {}), (value) => JSON.parse(value), logger);
        if (!proposal) return reply.status(400).send({ error: "Invalid wardrobe proposal" });

        const state = await loadInventoryState(documents, chatId, ownerId);
        const summary = applyGeneratedWardrobe(state, proposal);
        await persistState(chatId, ownerId, state);
        return { items: state.items, outfits: state.outfits, summary };
      });

      routes.post("/inventory/:chatId/:ownerId/outfits/:outfitId/equip", async (request, reply) => {
        const { chatId, ownerId, outfitId } = request.params;
        const state = await loadInventoryState(documents, chatId, ownerId);
        const outfit = state.outfits.find((candidate) => candidate.id === outfitId);
        if (!outfit) return reply.status(404).send({ error: "Outfit not found" });

        // Equipping an outfit replaces the whole equipped set in one step —
        // everything currently worn comes off first, then the outfit's items
        // go on, recreating anything that's gone missing since it was saved.
        // See applyOutfitEquip's own comment.
        applyOutfitEquip(state, outfit);
        await syncRealAvatarForOutfit(persistence, resources, context.dataDir, chatId, state, outfit);

        await persistState(chatId, ownerId, state);
        return { items: state.items, outfits: state.outfits };
      });

      routes.delete("/inventory/:chatId/:ownerId/outfits/:outfitId", async (request, reply) => {
        const { chatId, ownerId, outfitId } = request.params;
        const state = await loadInventoryState(documents, chatId, ownerId);
        const outfit = state.outfits.find((candidate) => candidate.id === outfitId);
        if (!outfit) return reply.status(404).send({ error: "Outfit not found" });
        const wasActive = outfitMatchesCurrent(outfit, state.items);
        state.outfits = state.outfits.filter((candidate) => candidate.id !== outfitId);

        if (outfit.portraitFile) {
          await removePortraitFileIfExists(join(galleryPortraitDir(context.dataDir, chatId), outfit.portraitFile));
        }
        if (wasActive) await syncRealAvatarForOutfit(persistence, resources, context.dataDir, chatId, state, null);

        await persistState(chatId, ownerId, state);
        return { items: state.items, outfits: state.outfits };
      });

      // Upload/replace an outfit's portrait. Body: { imageDataUrl }, a
      // data:image/(png|jpeg|webp);base64,... string — resizing/compressing
      // is the client's job (QM.state), this route only validates and
      // decodes. The old file (if replacing) is removed after the new one is
      // written successfully, never before — a failed write must never leave
      // the outfit pointing at a file that no longer exists. If this outfit
      // is the currently-equipped one and the real-avatar toggle is on, the
      // new portrait also becomes the persona's real avatar immediately.
      routes.post("/inventory/:chatId/:ownerId/outfits/:outfitId/portrait", async (request, reply) => {
        const { chatId, ownerId, outfitId } = request.params;
        const body = request.body ?? {};
        const decoded = decodePortraitDataUrl(body.imageDataUrl);
        if (!decoded) return reply.status(400).send({ error: "Invalid or oversized portrait image" });

        const state = await loadInventoryState(documents, chatId, ownerId);
        const outfit = state.outfits.find((candidate) => candidate.id === outfitId);
        if (!outfit) return reply.status(404).send({ error: "Outfit not found" });

        const dir = galleryPortraitDir(context.dataDir, chatId);
        const filename = `${outfitId}-${randomUUID().slice(0, 8)}.${decoded.ext}`;
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, filename), decoded.buffer);
        const previousFile = outfit.portraitFile;
        outfit.portraitFile = filename;
        if (previousFile) await removePortraitFileIfExists(join(dir, previousFile));

        if (outfitMatchesCurrent(outfit, state.items)) {
          await syncRealAvatarForOutfit(persistence, resources, context.dataDir, chatId, state, outfit);
        }

        await persistState(chatId, ownerId, state);
        return { items: state.items, outfits: state.outfits };
      });

      // Cheap: fills the saved (or default) outfit-portrait prompt template
      // from the persona's name + its OWN Appearance field only (never
      // description/personality/backstory, no fallback between them -- see
      // buildOutfitPortraitPrompt's own comment) plus this SPECIFIC outfit's
      // own saved description (falling back to its own saved item names,
      // never live equip state -- see outfitVisualDescriptionText).
      routes.post("/inventory/:chatId/:ownerId/outfits/:outfitId/portrait/prompt-preview", async (request, reply) => {
        const { chatId, ownerId, outfitId } = request.params;
        const state = await loadInventoryState(documents, chatId, ownerId);
        const outfit = state.outfits.find((candidate) => candidate.id === outfitId);
        if (!outfit) return reply.status(404).send({ error: "Outfit not found" });

        const personaData = await resolveChatPersonaData(persistence, resources, chatId);
        const personaName = (personaData && typeof personaData.name === "string" && personaData.name.trim()) || "the character";
        const rawPersonaAppearance =
          typeof personaData?.appearance === "string"
            ? personaData.appearance.trim()
            : typeof personaData?.extensions?.appearance === "string"
              ? personaData.extensions.appearance.trim()
              : "";
        const personaAppearance = stripAppearanceMacroToken(rawPersonaAppearance, ownerId);

        return {
          prompt: buildOutfitPortraitPrompt(state.outfitPortraitPromptTemplate, {
            personaName,
            personaAppearance,
            equippedItemsText: outfitVisualDescriptionText(outfit),
          }),
        };
      });

      // The paid call, same shape as the item one above -- body: { prompt },
      // returns { imageDataUrl } UNSAVED. The client hands this to the
      // ALREADY-EXISTING POST .../outfits/:outfitId/portrait route above to
      // actually persist it.
      routes.post("/inventory/:chatId/:ownerId/outfits/:outfitId/portrait/generate", async (request, reply) => {
        const { chatId, ownerId, outfitId } = request.params;
        const body = request.body ?? {};
        const prompt = normalizeText(body.prompt, MAX_REVIEW_PROMPT_LENGTH);
        if (!prompt) return reply.status(400).send({ error: "A prompt is required" });

        const state = await loadInventoryState(documents, chatId, ownerId);
        const outfit = state.outfits.find((candidate) => candidate.id === outfitId);
        if (!outfit) return reply.status(404).send({ error: "Outfit not found" });

        let connection;
        try {
          connection = await resolveImageConnection(state.imageConnectionId);
        } catch (error) {
          logger?.warn(
            "[quartermaster] could not reach the Engine's own connections list: %s",
            error instanceof Error ? error.message : String(error),
          );
          return reply.status(502).send({ error: "engine-unreachable" });
        }
        if (!connection) return reply.status(400).send({ error: "no-image-connection" });

        try {
          const imageDataUrl = await generateImageViaEngine({
            connectionId: connection.id,
            name: outfit.name,
            prompt,
            width: OUTFIT_PORTRAIT_GEN_WIDTH,
            height: OUTFIT_PORTRAIT_GEN_HEIGHT,
            logger,
          });
          return { imageDataUrl };
        } catch (error) {
          logger?.warn(
            "[quartermaster] outfit portrait generation failed: %s",
            error instanceof Error ? error.message : String(error),
          );
          return reply.status(502).send({ error: "generation-failed" });
        }
      });

      routes.delete("/inventory/:chatId/:ownerId/outfits/:outfitId/portrait", async (request, reply) => {
        const { chatId, ownerId, outfitId } = request.params;
        const state = await loadInventoryState(documents, chatId, ownerId);
        const outfit = state.outfits.find((candidate) => candidate.id === outfitId);
        if (!outfit) return reply.status(404).send({ error: "Outfit not found" });

        if (outfit.portraitFile) {
          await removePortraitFileIfExists(join(galleryPortraitDir(context.dataDir, chatId), outfit.portraitFile));
          outfit.portraitFile = null;
        }

        if (outfitMatchesCurrent(outfit, state.items)) {
          await syncRealAvatarForOutfit(persistence, resources, context.dataDir, chatId, state, outfit);
        }

        await persistState(chatId, ownerId, state);
        return { items: state.items, outfits: state.outfits };
      });

      // Serves the raw image bytes for an outfit's portrait — the dock's
      // <img src> points directly here, never at a gallery/ path. The
      // filename always changes on replace (see decodePortraitDataUrl's own
      // comment above), so this can be cached aggressively: the URL itself
      // only ever refers to one immutable set of bytes.
      routes.get("/inventory/:chatId/:ownerId/outfits/:outfitId/portrait", async (request, reply) => {
        const { chatId, ownerId, outfitId } = request.params;
        const state = await loadInventoryState(documents, chatId, ownerId);
        const outfit = state.outfits.find((candidate) => candidate.id === outfitId);
        if (!outfit || !outfit.portraitFile) return reply.status(404).send({ error: "No portrait set" });

        let buffer;
        try {
          buffer = await readFile(join(galleryPortraitDir(context.dataDir, chatId), outfit.portraitFile));
        } catch {
          return reply.status(404).send({ error: "Portrait file missing" });
        }
        const ext = outfit.portraitFile.slice(outfit.portraitFile.lastIndexOf(".") + 1);
        reply.header("Cache-Control", "public, max-age=31536000, immutable");
        reply.type(PORTRAIT_EXT_TO_CONTENT_TYPE[ext] ?? "application/octet-stream");
        return reply.send(buffer);
      });

      // Portable export/import (plan: carry a character sheet between chats
      // without needing the tracker agent enabled at the destination — the
      // original extension's own export/import, ported). Item/outfit ids are
      // reissued on import rather than kept as-is: importing the same file
      // twice, or into a chat that already has data with colliding ids,
      // should never silently merge two unrelated items that happen to share
      // an id. Outfit slot references are remapped through the old->new id
      // map so an imported outfit still points at ITS OWN freshly-issued
      // items instead of falling back to applyOutfitEquip's by-name
      // recreation (which would work, but would leave the freshly-imported
      // item sitting unused in the bag as a duplicate).
      routes.get("/inventory/:chatId/:ownerId/export", async (request, reply) => {
        const { chatId, ownerId } = request.params;
        const state = await loadInventoryState(documents, chatId, ownerId);
        // Informational only — the import route never reads this back. It's
        // here so the client can put a real name on the downloaded file
        // instead of just a date, for a user juggling exports from several
        // personas.
        const personaName = await resolvePersonaName(persistence, resources, chatId);
        // portraitFile is a filename in THIS chat's own gallery folder — meaningless
        // (and a dead reference) once exported, so it's replaced with the actual image
        // bytes (base64) instead, which travel with the file and get re-saved as a real
        // file again on import, under whatever chat it lands in.
        const outfits = await Promise.all(
          state.outfits.map(async ({ portraitFile, ...outfit }) => {
            if (!portraitFile) return outfit;
            try {
              const buffer = await readFile(join(galleryPortraitDir(context.dataDir, chatId), portraitFile));
              const ext = portraitFile.slice(portraitFile.lastIndexOf(".") + 1);
              const contentType = PORTRAIT_EXT_TO_CONTENT_TYPE[ext] ?? "image/png";
              return { ...outfit, portraitDataUrl: `data:${contentType};base64,${buffer.toString("base64")}` };
            } catch {
              return outfit; // Portrait record exists but the file's missing — export without it.
            }
          }),
        );
        return {
          formatVersion: QM_EXPORT_FORMAT_VERSION,
          exportedAt: new Date().toISOString(),
          personaName,
          items: state.items,
          outfits,
          showUnderwear: state.showUnderwear,
          showArmor: state.showArmor,
          showWeapons: state.showWeapons,
          appearanceFeedMode: state.appearanceFeedMode,
          replaceRealAvatarOnEquip: state.replaceRealAvatarOnEquip,
          // imageConnectionId deliberately NOT exported -- it's a reference to
          // a connection configured on THIS Engine installation, not portable
          // data (same reasoning as originalAvatarCaptured/lastAvatarNpcFile
          // below, just for a different reason: those are chat-history-
          // specific, this one is installation-specific). The two prompt
          // templates ARE portable plain text, so those travel.
          itemImagePromptTemplate: state.itemImagePromptTemplate,
          outfitPortraitPromptTemplate: state.outfitPortraitPromptTemplate,
        };
      });

      routes.post("/inventory/:chatId/:ownerId/import", async (request, reply) => {
        const { chatId, ownerId } = request.params;
        const body = request.body ?? {};
        if (!Array.isArray(body.items) || !Array.isArray(body.outfits)) {
          return reply.status(400).send({ error: "Import file is missing items or outfits" });
        }

        const state = await loadInventoryState(documents, chatId, ownerId);
        state.appearanceFeedMode = APPEARANCE_FEED_MODES.has(body.appearanceFeedMode)
          ? body.appearanceFeedMode
          : "off";
        state.showUnderwear = typeof body.showUnderwear === "boolean" ? body.showUnderwear : SLOT_GROUP_DEFAULTS.underwear;
        state.showArmor = typeof body.showArmor === "boolean" ? body.showArmor : SLOT_GROUP_DEFAULTS.armor;
        state.showWeapons = typeof body.showWeapons === "boolean" ? body.showWeapons : SLOT_GROUP_DEFAULTS.weapons;
        // Plain preference carry-over, not a full toggle-on sync (an import
        // is generally into a fresh/empty state with nothing yet equipped to
        // reflect) — originalAvatarCaptured/originalPersonaAvatarPath/
        // lastAvatarNpcFile are deliberately NOT importable; they're specific
        // to this chat's own persona history, not portable data.
        state.replaceRealAvatarOnEquip =
          typeof body.replaceRealAvatarOnEquip === "boolean" ? body.replaceRealAvatarOnEquip : false;
        // imageConnectionId is deliberately NOT imported -- see the export
        // route's own comment; a connection id from another chat/installation
        // wouldn't necessarily exist here. The two prompt templates ARE
        // portable plain text, so those carry over (empty string, same as a
        // fresh chat, when the export file doesn't have them -- e.g. one
        // exported before this feature existed).
        state.itemImagePromptTemplate = normalizeText(body.itemImagePromptTemplate, MAX_PROMPT_TEMPLATE_LENGTH);
        state.outfitPortraitPromptTemplate = normalizeText(body.outfitPortraitPromptTemplate, MAX_PROMPT_TEMPLATE_LENGTH);

        const idMap = new Map();
        const nextItems = [];
        for (const raw of body.items) {
          if (!raw || typeof raw !== "object") continue;
          const name = normalizeText(raw.name, MAX_ITEM_NAME_LENGTH);
          if (!name) continue;
          const location = normalizeLocation(raw.location, state) ?? "bag";
          const item = {
            id: randomUUID(),
            name,
            description: normalizeText(raw.description, MAX_ITEM_DESCRIPTION_LENGTH),
            quantity: normalizeQuantity(raw.quantity),
            location: "bag",
            defaultSlot: normalizeDefaultSlot(raw.defaultSlot) || null,
            favorite: Boolean(raw.favorite),
          };
          applyLocation(nextItems, item, location);
          nextItems.push(item);
          if (typeof raw.id === "string") idMap.set(raw.id, item.id);
        }

        const nextOutfits = [];
        for (const raw of body.outfits) {
          if (!raw || typeof raw !== "object") continue;
          const name = normalizeText(raw.name, MAX_OUTFIT_NAME_LENGTH);
          if (!name) continue;
          const slots = {};
          for (const [slot, snapshot] of Object.entries(raw.slots ?? {})) {
            if (!EQUIP_SLOT_SET.has(slot) || !snapshot || typeof snapshot !== "object") continue;
            const snapshotName = normalizeText(snapshot.name, MAX_ITEM_NAME_LENGTH);
            if (!snapshotName) continue;
            slots[slot] = {
              itemId: idMap.get(snapshot.itemId) ?? null,
              name: snapshotName,
              description: normalizeText(snapshot.description, MAX_ITEM_DESCRIPTION_LENGTH),
            };
          }
          const outfitId = randomUUID();
          let portraitFile = null;
          const decodedPortrait = decodePortraitDataUrl(raw.portraitDataUrl);
          if (decodedPortrait) {
            const dir = galleryPortraitDir(context.dataDir, chatId);
            const filename = `${outfitId}-${randomUUID().slice(0, 8)}.${decodedPortrait.ext}`;
            await mkdir(dir, { recursive: true });
            await writeFile(join(dir, filename), decodedPortrait.buffer);
            portraitFile = filename;
          }
          nextOutfits.push({
            id: outfitId,
            name,
            description: normalizeText(raw.description, MAX_OUTFIT_DESCRIPTION_LENGTH),
            slots,
            portraitFile,
          });
        }

        state.items = nextItems;
        state.outfits = nextOutfits;
        await persistState(chatId, ownerId, state);
        return {
          items: state.items,
          outfits: state.outfits,
          appearanceFeedMode: state.appearanceFeedMode,
          showUnderwear: state.showUnderwear,
          showArmor: state.showArmor,
          showWeapons: state.showWeapons,
          replaceRealAvatarOnEquip: state.replaceRealAvatarOnEquip,
        };
      });

      routes.patch("/inventory/:chatId/:ownerId/settings", async (request, reply) => {
        const { chatId, ownerId } = request.params;
        const body = request.body ?? {};
        const state = await loadInventoryState(documents, chatId, ownerId);

        if (body.appearanceFeedMode !== undefined) {
          if (!APPEARANCE_FEED_MODES.has(body.appearanceFeedMode)) {
            return reply.status(400).send({ error: "Invalid appearanceFeedMode" });
          }
          state.appearanceFeedMode = body.appearanceFeedMode;
        }
        for (const key of ["showUnderwear", "showArmor", "showWeapons"]) {
          if (body[key] === undefined) continue;
          if (typeof body[key] !== "boolean") return reply.status(400).send({ error: `Invalid ${key}` });
          state[key] = body[key];
        }

        if (body.replaceRealAvatarOnEquip !== undefined) {
          if (typeof body.replaceRealAvatarOnEquip !== "boolean") {
            return reply.status(400).send({ error: "Invalid replaceRealAvatarOnEquip" });
          }
          const wasOn = state.replaceRealAvatarOnEquip;
          const nowOn = body.replaceRealAvatarOnEquip;

          if (wasOn && !nowOn && state.originalAvatarCaptured) {
            // Restore whatever the real avatar was before Quartermaster ever
            // touched it. Called while the flag is still true — syncRealAvatarForOutfit
            // no-ops when it's false — then reset capture state so a future
            // re-enable starts fresh from whatever's actually there then,
            // not this stale snapshot.
            await syncRealAvatarForOutfit(persistence, resources, context.dataDir, chatId, state, null);
            state.originalAvatarCaptured = false;
            state.originalPersonaAvatarPath = null;
          }
          state.replaceRealAvatarOnEquip = nowOn;
          if (!wasOn && nowOn) {
            // Reflect the currently-equipped outfit's portrait immediately,
            // rather than waiting for the next explicit equip action.
            const active = state.outfits.find((candidate) => outfitMatchesCurrent(candidate, state.items));
            await syncRealAvatarForOutfit(persistence, resources, context.dataDir, chatId, state, active ?? null);
          }
        }

        if (body.imageConnectionId !== undefined) {
          if (body.imageConnectionId !== null && typeof body.imageConnectionId !== "string") {
            return reply.status(400).send({ error: "Invalid imageConnectionId" });
          }
          state.imageConnectionId = body.imageConnectionId || null;
        }
        for (const key of ["itemImagePromptTemplate", "outfitPortraitPromptTemplate"]) {
          if (body[key] === undefined) continue;
          if (typeof body[key] !== "string") return reply.status(400).send({ error: `Invalid ${key}` });
          state[key] = normalizeText(body[key], MAX_PROMPT_TEMPLATE_LENGTH);
        }

        await persistState(chatId, ownerId, state);
        return {
          appearanceFeedMode: state.appearanceFeedMode,
          showUnderwear: state.showUnderwear,
          showArmor: state.showArmor,
          showWeapons: state.showWeapons,
          replaceRealAvatarOnEquip: state.replaceRealAvatarOnEquip,
          imageConnectionId: state.imageConnectionId,
          itemImagePromptTemplate: state.itemImagePromptTemplate,
          outfitPortraitPromptTemplate: state.outfitPortraitPromptTemplate,
        };
      });
    },
    { prefix: `/api/${PACKAGE_ID}` },
  );

  return () => {
    releaseRoutes();
    releaseAgentRuntime();
    releasePromptContext();
  };
}
