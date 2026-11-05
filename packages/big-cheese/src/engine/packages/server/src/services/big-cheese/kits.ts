// Big Cheese: the saved kits library (design.md section 13 step 4, section 14).
// A saved kit is one document of kind "kit", id `big-cheese:kit:<key>`. The model may only repair
// an import that failed the check, and the repaired kit is checked again.
import { randomBytes } from "node:crypto";
import type { CapabilityDocumentStore } from "@marinara-engine/shared";
import { runTask, type ModelCall } from "./ai/tasks.js";
import { normalizeKit } from "./core/kits/normalize.js";
import { PLACES } from "./core/kits/places.js";
import type { PlaceKit } from "./core/kits/types.js";
import { BigCheeseError, PACKAGE_ID } from "./store.js";

const KIND = "kit";
const docId = (key: string) => `${PACKAGE_ID}:kit:${key}`;
const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function createKits(documents: CapabilityDocumentStore, getModel: () => Promise<ModelCall | undefined>) {
  const read = async (key: unknown) => {
    if (typeof key !== "string" || !KEY.test(key) || key.length > 60)
      throw new BigCheeseError(404, "No such kit.", "not-found");
    const record = await documents.getById(PACKAGE_ID, docId(key));
    if (!record) throw new BigCheeseError(404, "No such kit.", "not-found");
    return record;
  };

  /** Writes a kit that passed the check. `fresh` gives an import a new key so it never replaces a kit. */
  async function put(kit: PlaceKit, fresh: boolean) {
    // A built-in id would hide the built-in kit in the picker, so such a kit gets a suffix.
    const key = fresh || Object.hasOwn(PLACES, kit.id) ? `${kit.id}-${randomBytes(3).toString("hex")}` : kit.id;
    const saved = { ...kit, id: key };
    const at = new Date().toISOString();
    const old = await documents.getById(PACKAGE_ID, docId(key));
    const data = { kit: saved };
    if (old) {
      const ok = await documents.update({
        id: old.id,
        packageId: PACKAGE_ID,
        expectedRevision: old.revision,
        name: saved.name,
        description: saved.family,
        data,
        updatedAt: at,
      });
      if (!ok) throw new BigCheeseError(409, "The kit changed. Try again.", "conflict");
    } else {
      await documents.create({
        id: docId(key),
        packageId: PACKAGE_ID,
        kind: KIND,
        name: saved.name,
        description: saved.family,
        data,
        createdAt: at,
        updatedAt: at,
      });
    }
    return saved;
  }

  /** Checks a kit. A refused import goes to the model once (kit.fix) and is checked again. */
  async function check(raw: unknown, repair: boolean) {
    let result = normalizeKit(raw);
    if (!result.ok && !result.fatal && repair) {
      const model = await getModel();
      if (model) {
        const { output } = await runTask("kit.fix", { kit: raw, reasons: result.reasons }, { model });
        result = normalizeKit(output.kit);
      }
    }
    if (!result.ok) throw new BigCheeseError(400, result.reasons.join(" "), "bad-kit");
    return result;
  }

  return {
    async list() {
      const records = await documents.list(PACKAGE_ID, KIND);
      return records
        .flatMap((r) => {
          const kit = (r.data as { kit?: PlaceKit }).kit;
          return kit
            ? [{ id: kit.id, name: kit.name, family: kit.family, premise: kit.premise, updatedAt: r.updatedAt }]
            : [];
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    /** The kit a run is made from. Throws 404 when the id is unknown. */
    async get(key: unknown): Promise<PlaceKit> {
      // The editor opens a built-in kit too; saving it makes a new kit (see put).
      if (typeof key === "string" && Object.hasOwn(PLACES, key)) return PLACES[key as keyof typeof PLACES];
      return ((await read(key)).data as { kit: PlaceKit }).kit;
    },
    /** Saves a kit from the editor. The same id replaces the saved kit. */
    async save(raw: unknown) {
      const { kit, fixes } = await check(raw, false);
      return { kit: await put(kit, false), fixes };
    },
    /** Saves a kit from a file as a new kit. A broken file may get one model repair. */
    async import(raw: unknown) {
      const { kit, fixes } = await check(raw, true);
      return { kit: await put(kit, true), fixes };
    },
  };
}
export type Kits = ReturnType<typeof createKits>;
