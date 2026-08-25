// Quartermaster — capability package server entrypoint.
// Owns the per-chat, per-owner inventory: stored in persistence.documents
// (kind "inventory", one document per chat+owner), served under
// /api/quartermaster so the client element can read and mutate it.
//
// v1 slice: a flat item list for the persona only (name, description,
// quantity, location), a fixed equip-slot vocabulary, and saved outfits
// (named snapshots of the equip-slot state). appearanceFeedMode is stored
// here but not yet acted on — that's the next step, once there's a real
// outfit description to actually feed into a {{getvar}} appearance macro.
// No images, locks, or party members yet.
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

const EQUIP_SLOTS = [
  "head",
  "neck",
  "eyes",
  "ears",
  "feet",
  "accessory",
  "belt",
  "underwear_top",
  "underwear_bottom",
  "clothing_torso",
  "clothing_legs",
  "armor_torso",
  "armor_legs",
  "weapon_left_hand",
  "weapon_right_hand",
];
const EQUIP_SLOT_SET = new Set(EQUIP_SLOTS);
const APPEARANCE_FEED_MODES = new Set(["off", "outfitDescription", "equippedNames"]);

const PACKAGE_ID = "quartermaster";
const INVENTORY_KIND = "inventory";
const MAX_ITEM_NAME_LENGTH = 200;
const MAX_ITEM_DESCRIPTION_LENGTH = 4000;
const MAX_STORED_LOCATION_LENGTH = 200;
const MAX_OUTFIT_NAME_LENGTH = 200;
const MAX_OUTFIT_DESCRIPTION_LENGTH = 4000;

function inventoryDocId(chatId, ownerId) {
  return `${chatId}:${ownerId}`;
}

function normalizeQuantity(value) {
  const quantity = Math.trunc(Number(value));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
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

// Returns the normalized location string, or null if invalid.
function normalizeLocation(value) {
  const text = normalizeText(value, MAX_STORED_LOCATION_LENGTH);
  if (!text || text === "bag") return "bag";
  if (text.startsWith("equipped:")) {
    const slot = text.slice("equipped:".length);
    return EQUIP_SLOT_SET.has(slot) ? text : null;
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

// slot -> itemId for every currently-equipped item.
function currentEquippedSlots(items) {
  const slots = {};
  for (const item of items) {
    if (item.location.startsWith("equipped:")) slots[item.location.slice("equipped:".length)] = item.id;
  }
  return slots;
}

function outfitMatchesCurrent(outfit, items) {
  const current = currentEquippedSlots(items);
  const outfitEntries = Object.entries(outfit.slots ?? {});
  const currentEntries = Object.entries(current);
  if (outfitEntries.length !== currentEntries.length) return false;
  return outfitEntries.every(([slot, itemId]) => current[slot] === itemId);
}

// The text a {{getvar::quartermaster_appearance_<ownerId>}} macro should
// currently resolve to, per the owner's appearanceFeedMode. "outfitDescription"
// only has something to feed when the CURRENT equip state exactly matches a
// saved outfit — there's no "current outfit" concept otherwise, so it's
// empty rather than guessing.
function computeAppearanceText(state) {
  if (state.appearanceFeedMode === "outfitDescription") {
    const matching = state.outfits.find((outfit) => outfitMatchesCurrent(outfit, state.items));
    return matching ? matching.description : "";
  }
  if (state.appearanceFeedMode === "equippedNames") {
    const names = [];
    for (const slot of EQUIP_SLOTS) {
      const item = state.items.find((candidate) => candidate.location === `equipped:${slot}`);
      if (item) names.push(item.name);
    }
    return names.join(", ");
  }
  return "";
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
  return {
    items: Array.isArray(doc?.data?.items) ? doc.data.items : [],
    outfits: Array.isArray(doc?.data?.outfits) ? doc.data.outfits : [],
    appearanceFeedMode: APPEARANCE_FEED_MODES.has(doc?.data?.appearanceFeedMode) ? doc.data.appearanceFeedMode : "off",
  };
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
  const { persistence } = api.runtime;
  const { documents } = persistence;

  // Every route below calls this instead of saveInventoryState directly, so
  // the appearance macro can never fall out of sync with an equip/outfit/
  // settings change — there's exactly one path to disk, and it's this one.
  async function persistState(chatId, ownerId, state) {
    await saveInventoryState(documents, chatId, ownerId, state);
    await syncAppearanceMacro(persistence, chatId, ownerId, state);
  }

  const releaseRoutes = await api.registerPrivilegedRoutes(
    async (routes) => {
      routes.get("/inventory/:chatId/:ownerId", async (request, reply) => {
        const { chatId, ownerId } = request.params;
        const state = await loadInventoryState(documents, chatId, ownerId);
        return { ...state, equipSlots: EQUIP_SLOTS };
      });

      routes.post("/inventory/:chatId/:ownerId/items", async (request, reply) => {
        const { chatId, ownerId } = request.params;
        const body = request.body ?? {};
        const name = normalizeText(body.name, MAX_ITEM_NAME_LENGTH);
        if (!name) return reply.status(400).send({ error: "Item name is required" });

        const location = body.location === undefined ? "bag" : normalizeLocation(body.location);
        if (location === null) return reply.status(400).send({ error: "Invalid location" });
        const defaultSlot = body.defaultSlot === undefined ? null : normalizeDefaultSlot(body.defaultSlot);
        if (defaultSlot === undefined) return reply.status(400).send({ error: "Invalid defaultSlot" });

        const item = {
          id: randomUUID(),
          name,
          description: normalizeText(body.description, MAX_ITEM_DESCRIPTION_LENGTH),
          quantity: normalizeQuantity(body.quantity),
          location: "bag",
          defaultSlot,
        };
        const state = await loadInventoryState(documents, chatId, ownerId);
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
        }
        if (body.description !== undefined) item.description = normalizeText(body.description, MAX_ITEM_DESCRIPTION_LENGTH);
        if (body.quantity !== undefined) item.quantity = normalizeQuantity(body.quantity);
        if (body.location !== undefined) {
          const location = normalizeLocation(body.location);
          if (location === null) return reply.status(400).send({ error: "Invalid location" });
          applyLocation(state.items, item, location);
        }
        if (body.defaultSlot !== undefined) {
          const defaultSlot = normalizeDefaultSlot(body.defaultSlot);
          if (defaultSlot === undefined) return reply.status(400).send({ error: "Invalid defaultSlot" });
          item.defaultSlot = defaultSlot;
        }

        await persistState(chatId, ownerId, state);
        return { items: state.items, outfits: state.outfits };
      });

      routes.post("/inventory/:chatId/:ownerId/unequip-all", async (request, reply) => {
        const { chatId, ownerId } = request.params;
        const state = await loadInventoryState(documents, chatId, ownerId);
        for (const item of state.items) {
          if (item.location.startsWith("equipped:")) item.location = "bag";
        }
        await persistState(chatId, ownerId, state);
        return { items: state.items, outfits: state.outfits };
      });

      routes.delete("/inventory/:chatId/:ownerId/items/:itemId", async (request, reply) => {
        const { chatId, ownerId, itemId } = request.params;
        const state = await loadInventoryState(documents, chatId, ownerId);
        const nextItems = state.items.filter((candidate) => candidate.id !== itemId);
        if (nextItems.length === state.items.length) return reply.status(404).send({ error: "Item not found" });
        state.items = nextItems;

        // An item leaving the inventory drops out of any saved outfit that
        // referenced it, matching the extension's behavior — the outfit
        // itself survives, just with one fewer slot filled.
        for (const outfit of state.outfits) {
          for (const [slot, referencedItemId] of Object.entries(outfit.slots)) {
            if (referencedItemId === itemId) delete outfit.slots[slot];
          }
        }

        await persistState(chatId, ownerId, state);
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

      routes.post("/inventory/:chatId/:ownerId/outfits/:outfitId/equip", async (request, reply) => {
        const { chatId, ownerId, outfitId } = request.params;
        const state = await loadInventoryState(documents, chatId, ownerId);
        const outfit = state.outfits.find((candidate) => candidate.id === outfitId);
        if (!outfit) return reply.status(404).send({ error: "Outfit not found" });

        // Equipping an outfit replaces the whole equipped set in one step —
        // everything currently worn comes off first, then the outfit's items
        // go on. Matches the extension: "unequip whatever you're wearing and
        // equip that outfit's items into their saved slots, in one step."
        for (const item of state.items) {
          if (item.location.startsWith("equipped:")) item.location = "bag";
        }
        for (const [slot, itemId] of Object.entries(outfit.slots)) {
          const item = state.items.find((candidate) => candidate.id === itemId);
          if (item) item.location = `equipped:${slot}`;
        }

        await persistState(chatId, ownerId, state);
        return { items: state.items, outfits: state.outfits };
      });

      routes.delete("/inventory/:chatId/:ownerId/outfits/:outfitId", async (request, reply) => {
        const { chatId, ownerId, outfitId } = request.params;
        const state = await loadInventoryState(documents, chatId, ownerId);
        const nextOutfits = state.outfits.filter((candidate) => candidate.id !== outfitId);
        if (nextOutfits.length === state.outfits.length) return reply.status(404).send({ error: "Outfit not found" });
        state.outfits = nextOutfits;

        await persistState(chatId, ownerId, state);
        return { items: state.items, outfits: state.outfits };
      });

      routes.patch("/inventory/:chatId/:ownerId/settings", async (request, reply) => {
        const { chatId, ownerId } = request.params;
        const body = request.body ?? {};
        if (!APPEARANCE_FEED_MODES.has(body.appearanceFeedMode)) {
          return reply.status(400).send({ error: "Invalid appearanceFeedMode" });
        }
        const state = await loadInventoryState(documents, chatId, ownerId);
        state.appearanceFeedMode = body.appearanceFeedMode;
        await persistState(chatId, ownerId, state);
        return { appearanceFeedMode: state.appearanceFeedMode };
      });
    },
    { prefix: `/api/${PACKAGE_ID}` },
  );

  return () => {
    releaseRoutes();
  };
}
