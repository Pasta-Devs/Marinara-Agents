import { readFile, rm } from "node:fs/promises";
import { ltmIndexPointerSchema } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { writeJsonAtomic } from "./atomic-json.js";
import { isEnoent } from "./ltm-utils.js";
import { getLongTermMemoryDirectories, safeJoin } from "./paths.js";
export const ltmIndexPointerPath=(root:string)=>safeJoin(getLongTermMemoryDirectories(root).indexes,"current.json");
export const ltmIndexGenerationManifestPath=(root:string,id:string)=>safeJoin(getLongTermMemoryDirectories(root).indexes,`generations/${id}/manifest.json`);
export async function readLtmIndexPointer(root:string){try{return ltmIndexPointerSchema.parse(JSON.parse(await readFile(ltmIndexPointerPath(root),"utf8")));}catch(e){if(isEnoent(e))return null;throw e;}}
export async function publishLtmIndexGeneration(root:string,pointer:unknown){const parsed=ltmIndexPointerSchema.parse(pointer);await readFile(ltmIndexGenerationManifestPath(root,parsed.generationId));await writeJsonAtomic(ltmIndexPointerPath(root),parsed);return parsed;}
export async function removeLtmIndexGeneration(root:string,id:string){await rm(safeJoin(getLongTermMemoryDirectories(root).indexes,`generations/${id}`),{recursive:true,force:true});}
