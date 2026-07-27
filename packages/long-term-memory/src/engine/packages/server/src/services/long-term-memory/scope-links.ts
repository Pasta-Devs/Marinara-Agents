import { withMergedLtmScopeLinks } from "../../../../shared/src/features/agents/long-term-memory/scope.js";
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
    for(const note of await storage.listNotes()){
      if(!note.links.some((link)=>link.target===sourceNoteId&&link.relation==="extracted_from"))continue;
      const scope=withMergedLtmScopeLinks(note.scope,links);
      if(JSON.stringify(scope)===JSON.stringify(note.scope))continue;
      affectedNoteIds.push((await storage.updateNote(note.id,{scope})).id);
    }
    const rebuild=affectedNoteIds.length?await rebuildLongTermMemoryIndexes({root:options.root}):null;
    return{sourceNoteId,count:affectedNoteIds.length,affectedNoteIds,rebuild};
  });
}
