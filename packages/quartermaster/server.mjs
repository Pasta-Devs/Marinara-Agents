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
// entry). See reconcileTrackerOutput's own comment and plan §16 for the
// design.
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
const MAX_ITEM_NAME_LENGTH = 200;
const MAX_ITEM_DESCRIPTION_LENGTH = 4000;
const MAX_STORED_LOCATION_LENGTH = 200;
const MAX_OUTFIT_NAME_LENGTH = 200;
const MAX_OUTFIT_DESCRIPTION_LENGTH = 4000;

function inventoryDocId(chatId, ownerId) {
  return `${chatId}:${ownerId}`;
}

// 0 is a valid quantity — "used up but still tracked" (plan §16.3) — so this
// only rejects genuinely invalid input (non-numeric, negative), not zero.
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

function equippedItemNamesText(items) {
  const names = [];
  for (const slot of EQUIP_SLOTS) {
    const item = items.find((candidate) => candidate.location === `equipped:${slot}`);
    if (item) names.push(item.name);
  }
  return names.join(", ");
}

// The text a {{getvar::quartermaster_appearance_<ownerId>}} macro should
// currently resolve to, per the owner's appearanceFeedMode. "outfitDescription"
// falls back to the equipped item names when the current equip state doesn't
// exactly match any saved outfit — there's no "current outfit" concept then,
// but showing nothing would be worse than showing what's actually worn.
function computeAppearanceText(state) {
  if (state.appearanceFeedMode === "outfitDescription") {
    const matching = state.outfits.find((outfit) => outfitMatchesCurrent(outfit, state.items));
    return matching ? matching.description : equippedItemNamesText(state.items);
  }
  if (state.appearanceFeedMode === "equippedNames") {
    return equippedItemNamesText(state.items);
  }
  return "";
}

// ── Agent-driven inventory sync (plan §16) ──────────────────────────────────
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

// Case/separator-insensitive only — "Blue Hat" and "blue-hat" are the same
// item, but "Blue Hat" and "Hat" are never merged automatically. Matching on
// meaning (not just formatting) would risk silently merging visually-distinct
// items once per-item images exist (plan §16.3).
function qmNormalizeMatchKey(name) {
  return typeof name === "string" ? name.trim().toLowerCase().replace(/[-_\s]+/g, "") : "";
}

// Reconciles one tracker-agent turn's raw JSON output into the owner's
// canonical inventory. `persistState` is passed in rather than imported,
// since it's a closure defined in activate() (it also syncs the appearance
// macro — see persistState's own definition there).
//
// Full-snapshot semantics, matching every other tracker in this ecosystem
// (Inventory Tracker/Character Tracker/World State, per plan §16.2/16.3): an
// item not present in `data.items` this turn is removed. `equipOutfit`, when
// it matches a saved outfit, is authoritative for equip state and overrides
// any "equipped:<slot>" location on that outfit's own items — the outfit is
// the whole point of the shortcut, so its items are also exempt from the
// full-snapshot deletion rule even if the agent doesn't re-list them.
async function reconcileTrackerOutput(documents, persistState, chatId, ownerId, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return;
  const state = await loadInventoryState(documents, chatId, ownerId);

  let outfit = null;
  if (typeof data.equipOutfit === "string" && data.equipOutfit.trim()) {
    const key = qmNormalizeMatchKey(data.equipOutfit);
    outfit = state.outfits.find((candidate) => qmNormalizeMatchKey(candidate.name) === key) || null;
  }
  const outfitItemIds = outfit ? new Set(Object.values(outfit.slots)) : null;
  const seenIds = new Set();
  if (outfit) {
    for (const item of state.items) {
      if (item.location.startsWith("equipped:")) item.location = "bag";
    }
    for (const [slot, itemId] of Object.entries(outfit.slots)) {
      if (!slotGroupVisible(slot, state)) continue;
      const item = state.items.find((candidate) => candidate.id === itemId);
      if (item) {
        item.location = `equipped:${slot}`;
        seenIds.add(item.id);
      }
    }
  }

  const entries = Array.isArray(data.items) ? data.items : [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const name = normalizeText(entry.name, MAX_ITEM_NAME_LENGTH);
    if (!name) continue;
    const key = qmNormalizeMatchKey(name);

    let item = state.items.find((candidate) => qmNormalizeMatchKey(candidate.name) === key);
    if (!item) {
      item = { id: randomUUID(), name, description: "", quantity: 1, location: "bag", defaultSlot: null };
      state.items.push(item);
    }
    seenIds.add(item.id);

    if (entry.description !== undefined) item.description = normalizeText(entry.description, MAX_ITEM_DESCRIPTION_LENGTH);
    if (entry.quantity !== undefined) item.quantity = normalizeQuantity(entry.quantity);

    // An item the active outfit already placed keeps that placement,
    // regardless of what this entry's own location says — the outfit is
    // authoritative (see the file comment above).
    if (outfitItemIds && outfitItemIds.has(item.id)) continue;
    const rawLocation = typeof entry.location === "string" ? entry.location : "bag";
    const location = normalizeLocation(rawLocation, state);
    if (location !== null) applyLocation(state.items, item, location);
  }

  // Full snapshot: anything not re-stated (or covered by the active outfit)
  // this turn is gone.
  state.items = state.items.filter((item) => seenIds.has(item.id));
  for (const savedOutfit of state.outfits) {
    for (const [slot, itemId] of Object.entries(savedOutfit.slots)) {
      if (!state.items.some((item) => item.id === itemId)) delete savedOutfit.slots[slot];
    }
  }

  await persistState(chatId, ownerId, state);
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
    // Per-group defaults (SLOT_GROUP_DEFAULTS): underwear off so a fresh
    // inventory is SFW, armor/weapons on since most characters use them.
    showUnderwear: typeof doc?.data?.showUnderwear === "boolean" ? doc.data.showUnderwear : SLOT_GROUP_DEFAULTS.underwear,
    showArmor: typeof doc?.data?.showArmor === "boolean" ? doc.data.showArmor : SLOT_GROUP_DEFAULTS.armor,
    showWeapons: typeof doc?.data?.showWeapons === "boolean" ? doc.data.showWeapons : SLOT_GROUP_DEFAULTS.weapons,
  };
}

// Neither slot instance's capabilityProps carries personaInfo/avatarUrl --
// confirmed against the Engine's actual render sites this session
// (RoleplayHUD.tsx's roleplay-tracker props and TrackerDataSidebar.tsx's
// tracker-panel props are both far narrower than assumed). So the portrait
// is resolved server-side instead: the chat's personaId, then that
// persona's avatarPath via the resources facade — the same field name the
// Engine's own client reads (persona.avatarPath) for the identical purpose.
async function resolvePersonaAvatarUrl(persistence, resources, chatId) {
  const chat = await persistence.getChat(chatId);
  if (!chat || !chat.personaId) return null;
  const [persona] = await resources.listPersonas([chat.personaId]);
  const avatarPath = persona && persona.data && typeof persona.data.avatarPath === "string" ? persona.data.avatarPath : null;
  return avatarPath || null;
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
  const { persistence, resources } = api.runtime;
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
  // which isn't confirmed to apply to third-party packages (plan §16.7).
  const releaseAgentRuntime = api.registerService(`agent-runtime:${PACKAGE_ID}`, {
    async prepareContext({ context }) {
      if (context.chatMode !== "roleplay") return null;
      const state = await loadInventoryState(documents, context.chatId, QM_TRACKER_OWNER_ID);
      return {
        items: state.items.map((item) => ({
          name: item.name,
          description: item.description || undefined,
          quantity: item.quantity,
          location: item.location,
        })),
        outfits: state.outfits.map((outfit) => outfit.name),
      };
    },
    async finalizeResult({ context, result }) {
      if (context.chatMode === "roleplay" && result?.success && result.data && typeof result.data === "object") {
        try {
          await reconcileTrackerOutput(documents, persistState, context.chatId, QM_TRACKER_OWNER_ID, result.data);
        } catch {
          // A bad or malformed turn must never break generation — the next
          // turn's full-snapshot output self-corrects, same as every other
          // tracker in this ecosystem tolerates an occasional bad response.
        }
      }
      return result;
    },
  });

  const releaseRoutes = await api.registerPrivilegedRoutes(
    async (routes) => {
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
        // An outfit saved while a group was visible can still reference that
        // group's slots after it's turned off again — skip just those
        // assignments rather than failing the whole outfit.
        for (const item of state.items) {
          if (item.location.startsWith("equipped:")) item.location = "bag";
        }
        for (const [slot, itemId] of Object.entries(outfit.slots)) {
          if (!slotGroupVisible(slot, state)) continue;
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

        await persistState(chatId, ownerId, state);
        return {
          appearanceFeedMode: state.appearanceFeedMode,
          showUnderwear: state.showUnderwear,
          showArmor: state.showArmor,
          showWeapons: state.showWeapons,
        };
      });
    },
    { prefix: `/api/${PACKAGE_ID}` },
  );

  return () => {
    releaseRoutes();
    releaseAgentRuntime();
  };
}
