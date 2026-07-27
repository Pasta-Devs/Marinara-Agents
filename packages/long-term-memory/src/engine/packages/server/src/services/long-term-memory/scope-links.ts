import { randomUUID } from "node:crypto";
import { ltmEventSchema, ltmNoteSchema, type LtmEvent } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { withMergedLtmScopeLinks } from "../../../../shared/src/features/agents/long-term-memory/scope.js";
import { commitLtmMutation, type LtmMutationFileChange } from "./mutation-transaction.js";
import { nowIso } from "./ltm-utils.js";
import { notePathForId } from "./paths.js";
import { rebuildLongTermMemoryIndexes } from "./rebuild.js";
import { LongTermMemoryStorage } from "./storage.js";
import { withLtmVaultLock } from "./vault-lock.js";

export async function applyLtmScopeLinksToDerivedNotes(
  sourceNoteId:string,
  links:{chatIds?:string[];characterIds?:string[]},
  options:{root:string},
){
  return withLtmVaultLock(options.root, async () => {
    const storage=new LongTermMemoryStorage(options.root);
    if(!await storage.getNote(sourceNoteId))return null;
    const affectedNoteIds:string[]=[];
    const files:LtmMutationFileChange[]=[];
    const events:LtmEvent[]=[];
    const timestamp=nowIso();
    for(const note of await storage.listNotes()){
      if(!note.links.some((link)=>link.target===sourceNoteId&&link.relation==="extracted_from"))continue;
      const scope=withMergedLtmScopeLinks(note.scope,links);
      if(JSON.stringify(scope)===JSON.stringify(note.scope))continue;
      const next=ltmNoteSchema.parse({...note,scope,updatedAt:timestamp,version:note.version+1});
      affectedNoteIds.push(next.id);
      files.push({path:notePathForId(next.id,next.type,options.root),before:note,after:next});
      events.push(ltmEventSchema.parse({id:randomUUID(),ts:timestamp,type:`${next.type}.updated`,target:next.id,payload:{note:next,patch:{scope}}}));
    }
    if(files.length)await commitLtmMutation(options.root,{files,events});
    const rebuild=affectedNoteIds.length?await rebuildLongTermMemoryIndexes({root:options.root}):null;
    return{sourceNoteId,count:affectedNoteIds.length,affectedNoteIds,rebuild};
  });
}
