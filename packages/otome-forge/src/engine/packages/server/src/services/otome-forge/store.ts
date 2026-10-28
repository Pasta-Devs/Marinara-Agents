// ──────────────────────────────────────────────
// Otome Forge: the package's documents in the Engine's store (api.runtime.persistence.documents)
// ──────────────────────────────────────────────
// Every read is normalized, so a document from an older test build or a hand edit still has the full shape. Every
// write is revision-checked: another writer that got there first makes the change re-read and apply again.
import type { CapabilityDocumentRecord, CapabilityDocumentStore } from "@marinara-engine/shared";
import { OtomeForgeError } from "./http.js";
import { OTOME_FORGE_PACKAGE_ID, isOtomeId } from "./ids.js";

/** Reads stored data into its full shape. `undefined` (no document yet) must give the defaults. */
export type Normalize<T> = (data: unknown) => T;

export interface DocTarget {
  id: string;
  kind: string;
  name: string;
}

const DEFAULT_ATTEMPTS = 4;

function checkedId(id: string): string {
  if (isOtomeId(id)) return id;
  throw new RangeError(`Otome Forge document ids start with "otome-forge:": ${String(id).slice(0, 60)}`);
}

export function createOtomeStore(documents: CapabilityDocumentStore) {
  const get = (id: string) => documents.getById(OTOME_FORGE_PACKAGE_ID, checkedId(id));

  /** The removed revision, or null when the document was already gone; a newer revision is re-read and removed. */
  async function remove(id: string, attempts: number) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const document = await get(id);
      if (!document) return null;
      if (await documents.remove(OTOME_FORGE_PACKAGE_ID, document.id, document.revision)) return document;
    }
    throw new OtomeForgeError(409, `Otome Forge data changed while removing ${id}. Try again.`, "conflict");
  }

  async function write<T>(
    target: DocTarget,
    normalize: Normalize<T>,
    change: (current: T) => T | Promise<T>,
    attempts: number,
    create: boolean,
  ): Promise<T | null> {
    const id = checkedId(target.id);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const document = await get(id);
      if (!document && !create) return null;
      const next = await change(normalize(document?.data));
      const at = new Date().toISOString();
      if (!document) {
        try {
          const created = await documents.create({
            id,
            packageId: OTOME_FORGE_PACKAGE_ID,
            kind: target.kind,
            name: target.name,
            description: "",
            data: next,
            createdAt: at,
            updatedAt: at,
          });
          return normalize(created.data);
        } catch (error) {
          // Another request created it first: apply the change on top of theirs. Still missing means the create
          // failed for its own reason.
          if (!(await get(id))) throw error;
          continue;
        }
      }
      const saved = await documents.update({
        id,
        packageId: OTOME_FORGE_PACKAGE_ID,
        expectedRevision: document.revision,
        name: document.name,
        description: document.description,
        data: next,
        updatedAt: at,
      });
      if (saved) return normalize(saved.data);
    }
    throw new OtomeForgeError(409, `Otome Forge data changed while saving ${id}. Try again.`, "conflict");
  }

  return {
    /** The normalized document, or null while it does not exist. Never creates it. */
    async readDoc<T>(id: string, normalize: Normalize<T>): Promise<T | null> {
      const document = await get(id);
      return document ? normalize(document.data) : null;
    },

    /**
     * Applies `change` to the document and saves it, creating it from `normalize(undefined)` when missing. A stale
     * revision or a lost create race re-reads and applies `change` again; once `attempts` are spent it is a 409.
     * `change` may throw an OtomeForgeError to refuse the write.
     */
    mutateDoc<T>(
      target: DocTarget,
      normalize: Normalize<T>,
      change: (current: T) => T | Promise<T>,
      { attempts = DEFAULT_ATTEMPTS }: { attempts?: number } = {},
    ): Promise<T> {
      return write(target, normalize, change, attempts, true) as Promise<T>;
    },

    /**
     * mutateDoc for a document that must already exist: a missing one stays missing and this resolves null. Use it for
     * writes that must not bring back a deleted run (a late paint, a settings change racing a delete).
     */
    updateDoc<T>(
      target: DocTarget,
      normalize: Normalize<T>,
      change: (current: T) => T | Promise<T>,
      { attempts = DEFAULT_ATTEMPTS }: { attempts?: number } = {},
    ): Promise<T | null> {
      return write(target, normalize, change, attempts, false);
    },

    /** Removes the document; false when it was already gone. A newer revision is re-read and removed. */
    async removeDoc(id: string, { attempts = DEFAULT_ATTEMPTS }: { attempts?: number } = {}): Promise<boolean> {
      return !!(await remove(id, attempts));
    },

    /**
     * Removes the document and returns it as removed (normalized), or null when it was already gone: what it held is
     * exactly the revision that went, even when another writer saved a newer one in between (M2b: a dropped beat's CG).
     */
    async takeDoc<T>(
      id: string,
      normalize: Normalize<T>,
      { attempts = DEFAULT_ATTEMPTS }: { attempts?: number } = {},
    ): Promise<T | null> {
      const removed = await remove(id, attempts);
      return removed ? normalize(removed.data) : null;
    },

    /**
     * Every document of `kind` in the run `runId`, newest first.
     * ponytail: loads every document of that kind across runs and filters by the `${runId}:` prefix; the ceiling is a
     * few thousand beats, and the upgrade path is a per-run cache cleared on writes.
     */
    async listRun(kind: string, runId: string): Promise<CapabilityDocumentRecord[]> {
      const prefix = `${checkedId(runId)}:`;
      return (await documents.list(OTOME_FORGE_PACKAGE_ID, kind)).filter((document) => document.id.startsWith(prefix));
    },
  };
}

export type OtomeStore = ReturnType<typeof createOtomeStore>;
