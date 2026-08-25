// Quartermaster — capability package server entrypoint.
// Owns the per-chat, per-owner inventory: stored in persistence.documents
// (kind "inventory", one document per chat+owner), served under
// /api/quartermaster so the client element can read and mutate it.
//
// v1 slice: a flat item list for the persona only (name, description,
// quantity, location as free text). No equip slots, images, locks, or party
// members yet — those build on this once the basic read/write path is proven.

import { randomUUID } from "node:crypto";

const PACKAGE_ID = "quartermaster";
const INVENTORY_KIND = "inventory";
const MAX_ITEM_NAME_LENGTH = 200;
const MAX_ITEM_DESCRIPTION_LENGTH = 4000;
const MAX_ITEM_LOCATION_LENGTH = 200;

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
        return { items };
      });

      routes.post("/inventory/:chatId/:ownerId/items", async (request, reply) => {
        const { chatId, ownerId } = request.params;
        const body = request.body ?? {};
        const name = normalizeText(body.name, MAX_ITEM_NAME_LENGTH);
        if (!name) return reply.status(400).send({ error: "Item name is required" });

        const item = {
          id: randomUUID(),
          name,
          description: normalizeText(body.description, MAX_ITEM_DESCRIPTION_LENGTH),
          quantity: normalizeQuantity(body.quantity),
          location: normalizeText(body.location, MAX_ITEM_LOCATION_LENGTH) || "bag",
        };
        const items = await loadInventoryItems(documents, chatId, ownerId);
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
        if (body.location !== undefined) item.location = normalizeText(body.location, MAX_ITEM_LOCATION_LENGTH) || "bag";

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
