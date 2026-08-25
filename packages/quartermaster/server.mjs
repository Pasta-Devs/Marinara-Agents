// Quartermaster — capability package server entrypoint.
// Owns the per-chat, per-owner inventory: stored in persistence.documents
// (kind "inventory", one document per chat+owner), served under
// /api/quartermaster so the client element can read and mutate it.
//
// v1 slice: a flat item list for the persona only (name, description,
// quantity, location) plus a fixed equip-slot vocabulary. No images, locks,
// or party members yet — those build on this once equip/locations prove out.
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

const PACKAGE_ID = "quartermaster";
const INVENTORY_KIND = "inventory";
const MAX_ITEM_NAME_LENGTH = 200;
const MAX_ITEM_DESCRIPTION_LENGTH = 4000;
const MAX_STORED_LOCATION_LENGTH = 200;

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

async function loadInventoryDoc(documents, chatId, ownerId) {
  return documents.getById(PACKAGE_ID, inventoryDocId(chatId, ownerId));
}

async function loadInventoryItems(documents, chatId, ownerId) {
  const doc = await loadInventoryDoc(documents, chatId, ownerId);
  return Array.isArray(doc?.data?.items) ? doc.data.items : [];
}

async function saveInventoryItems(documents, chatId, ownerId, items) {
  const id = inventoryDocId(chatId, ownerId);
  const now = new Date().toISOString();
  const existing = await documents.getById(PACKAGE_ID, id);
  if (!existing) {
    await documents.create({
      id,
      packageId: PACKAGE_ID,
      kind: INVENTORY_KIND,
      name: `Inventory ${id}`,
      description: "Quartermaster inventory record.",
      data: { chatId, ownerId, items },
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
    data: { chatId, ownerId, items },
    updatedAt: now,
  });
}

export async function activate(context) {
  const { api } = context;
  const { documents } = api.runtime.persistence;

  const releaseRoutes = await api.registerPrivilegedRoutes(
    async (routes) => {
      routes.get("/inventory/:chatId/:ownerId", async (request, reply) => {
        const { chatId, ownerId } = request.params;
        const items = await loadInventoryItems(documents, chatId, ownerId);
        return { items, equipSlots: EQUIP_SLOTS };
      });

      routes.post("/inventory/:chatId/:ownerId/items", async (request, reply) => {
        const { chatId, ownerId } = request.params;
        const body = request.body ?? {};
        const name = normalizeText(body.name, MAX_ITEM_NAME_LENGTH);
        if (!name) return reply.status(400).send({ error: "Item name is required" });

        const location = body.location === undefined ? "bag" : normalizeLocation(body.location);
        if (location === null) return reply.status(400).send({ error: "Invalid location" });

        const item = {
          id: randomUUID(),
          name,
          description: normalizeText(body.description, MAX_ITEM_DESCRIPTION_LENGTH),
          quantity: normalizeQuantity(body.quantity),
          location: "bag",
        };
        const items = await loadInventoryItems(documents, chatId, ownerId);
        applyLocation(items, item, location);
        items.push(item);
        await saveInventoryItems(documents, chatId, ownerId, items);
        return { items };
      });

      routes.patch("/inventory/:chatId/:ownerId/items/:itemId", async (request, reply) => {
        const { chatId, ownerId, itemId } = request.params;
        const body = request.body ?? {};
        const items = await loadInventoryItems(documents, chatId, ownerId);
        const item = items.find((candidate) => candidate.id === itemId);
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
          applyLocation(items, item, location);
        }

        await saveInventoryItems(documents, chatId, ownerId, items);
        return { items };
      });

      routes.delete("/inventory/:chatId/:ownerId/items/:itemId", async (request, reply) => {
        const { chatId, ownerId, itemId } = request.params;
        const items = await loadInventoryItems(documents, chatId, ownerId);
        const nextItems = items.filter((candidate) => candidate.id !== itemId);
        if (nextItems.length === items.length) return reply.status(404).send({ error: "Item not found" });

        await saveInventoryItems(documents, chatId, ownerId, nextItems);
        return { items: nextItems };
      });
    },
    { prefix: `/api/${PACKAGE_ID}` },
  );

  return () => {
    releaseRoutes();
  };
}
