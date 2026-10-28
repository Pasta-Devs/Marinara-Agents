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
    async mutateDoc<T>(
      target: DocTarget,
      normalize: Normalize<T>,
      change: (current: T) => T | Promise<T>,
      { attempts = DEFAULT_ATTEMPTS }: { attempts?: number } = {},
    ): Promise<T> {
      const id = checkedId(target.id);
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const document = await get(id);
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
