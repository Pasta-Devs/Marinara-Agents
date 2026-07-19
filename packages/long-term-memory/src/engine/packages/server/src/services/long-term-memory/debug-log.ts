import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { ltmDebugEventSchema, type LtmDebugEvent, type LtmDebugPhase, type LtmDebugStatus } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { isEnoent } from "./ltm-utils.js";
import { getLongTermMemoryDirectories, getLongTermMemoryRoot } from "./paths.js";
import { logger } from "./package-runtime.js";

export type LtmDebugEventInput = Omit<LtmDebugEvent, "id" | "ts" | "operationId" | "error"> & {
  operationId?: string;
  error?: unknown;
  root?: string;
};

function serialize(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { message: String(error) };
}

export async function recordLtmDebugEvent(input: LtmDebugEventInput): Promise<LtmDebugEvent | null> {
  try {
    const {
      root = getLongTermMemoryRoot(),
      operationId = randomUUID(),
      error,
      ...fields
    } = input;
    const event = ltmDebugEventSchema.parse({
      id: randomUUID(),
      ts: new Date().toISOString(),
      operationId,
      ...fields,
      error: error ? serialize(error) : undefined,
    });
    const path = getLongTermMemoryDirectories(root).debugLog;
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(event)}\n`, "utf8");
    return event;
  } catch (error) {
    logger.warn(error, "[ltm] Failed to record debug event");
    return null;
  }
}
export async function withLtmDebugOperation<T>(base:Omit<LtmDebugEventInput,"status"|"durationMs">,operation:(operationId:string)=>Promise<T>){const operationId=base.operationId??randomUUID();const started=Date.now();await recordLtmDebugEvent({...base,operationId,status:"started"});try{const result=await operation(operationId);await recordLtmDebugEvent({...base,operationId,status:"ok",durationMs:Date.now()-started});return result;}catch(error){await recordLtmDebugEvent({...base,operationId,status:"error",durationMs:Date.now()-started,error});throw error;}}
export async function readLtmDebugLog(filter:{limit?:number;operationId?:string;sourceNoteId?:string;draftId?:string;status?:LtmDebugStatus;phase?:LtmDebugPhase}={},root=getLongTermMemoryRoot()){const content=await readFile(getLongTermMemoryDirectories(root).debugLog,"utf8").catch((e)=>{if(isEnoent(e))return "";throw e;});const events=content.split("\n").filter(Boolean).flatMap((line)=>{try{const parsed=ltmDebugEventSchema.safeParse(JSON.parse(line));return parsed.success?[parsed.data]:[];}catch{return[];}}).filter((event)=>!filter.operationId||event.operationId===filter.operationId).filter((event)=>!filter.sourceNoteId||event.sourceNoteId===filter.sourceNoteId).filter((event)=>!filter.draftId||event.draftId===filter.draftId).filter((event)=>!filter.status||event.status===filter.status).filter((event)=>!filter.phase||event.phase===filter.phase);return typeof filter.limit==="number"?events.slice(-filter.limit):events;}
export async function exportLtmDebugLog(root=getLongTermMemoryRoot()){return readFile(getLongTermMemoryDirectories(root).debugLog,"utf8").catch((e)=>{if(isEnoent(e))return "";throw e;});}
export async function clearLtmDebugLog(root=getLongTermMemoryRoot()){const path=getLongTermMemoryDirectories(root).debugLog;await mkdir(dirname(path),{recursive:true});await writeFile(path,"","utf8");return{cleared:true};}
