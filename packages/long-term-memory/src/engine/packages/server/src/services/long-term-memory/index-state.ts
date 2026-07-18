import { ltmIndexStateSchema, type LtmIndexState } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import { quarantineLtmIndexArtifact } from "./index-quarantine.js";
import { nowIso } from "./ltm-utils.js";
import { getLongTermMemoryDirectories, safeJoin } from "./paths.js";
import { logger, withKeyedLock } from "./package-runtime.js";
const locks = new Map<string, Promise<void>>();
export function ltmIndexStatePath(root: string) { return safeJoin(getLongTermMemoryDirectories(root).indexes, "state.json"); }
async function readDisk(root: string) { return ltmIndexStateSchema.parse(await readJsonFile(ltmIndexStatePath(root), { version: 1 })); }
async function readOrRecover(root:string){try{return await readDisk(root);}catch(error){logger.warn(error,"[ltm] Quarantining malformed index state");await quarantineLtmIndexArtifact(root,ltmIndexStatePath(root));const state=ltmIndexStateSchema.parse({version:1,revision:Date.now(),dirty:true,dirtyAt:nowIso(),rebuildState:"failed",rebuildCompletedAt:nowIso(),error:"Malformed long-term memory index state was quarantined; rebuild indexes."});await writeJsonAtomic(ltmIndexStatePath(root),state);return state;}}
export async function readLtmIndexState(root: string) {
  try { return await readDisk(root); } catch (error) {
    return withKeyedLock(locks, root, () => readOrRecover(root));
  }
}
async function update(root: string, fn: (state: LtmIndexState) => LtmIndexState) { return withKeyedLock(locks, root, async () => { const next = ltmIndexStateSchema.parse(fn(await readOrRecover(root))); await writeJsonAtomic(ltmIndexStatePath(root), next); return next; }); }
export function markLtmIndexesDirty(root: string) { return update(root, (state) => ({ ...state, revision: state.revision + 1, dirty: true, dirtyAt: nowIso() })); }
export function markLtmIndexesClean(root:string){return update(root,(state)=>({...state,dirty:false,dirtyAt:undefined,rebuildState:"idle",rebuildCompletedAt:nowIso(),error:undefined}));}
