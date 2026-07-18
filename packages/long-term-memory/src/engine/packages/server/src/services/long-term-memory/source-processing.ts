import type {
  LtmExtractionAccounting,
  LtmExtractionDiagnostic,
  LtmExtractionDraft,
  LtmExtractionOutcome,
  LtmExtractionResponse,
  LtmImportedSourceResult,
  LtmMode,
  LtmNote,
  LtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { prepareGameJournalIngest } from "./direct-ingest.js";
import type { LongTermMemoryExtractionModel } from "./model.js";
import { rebuildLongTermMemoryIndexes } from "./rebuild.js";
import { applyLongTermMemoryDraft } from "./reconciliation.js";
import { extractLongTermMemoryFromSourceNote, finalizeLongTermMemoryExtractionDraft } from "./source-extraction.js";
import { LongTermMemoryStorage } from "./storage.js";
import { loadTrustedLtmSubjectCatalog } from "./subject-identity.js";

export type ImportedSourceItem={sourceId:string;title:string;note:LtmNote;created:boolean};
type PreparedSource={extractionMethod:"llm"|"direct_ingest";sourceNote:LtmNote;extractionMode:LtmMode;diagnostics:LtmExtractionDiagnostic[];outcome:LtmExtractionOutcome;accounting:LtmExtractionAccounting;response:LtmExtractionResponse;draft:LtmExtractionDraft|null;draftless?:boolean};
type PrepareOptions={sourceNote:LtmNote;provider?:LongTermMemoryExtractionModel|null;model?:string;scope?:LtmScope;modes?:LtmMode[];mode?:LtmMode;instruction?:string;operationId:string;signal?:AbortSignal;root?:string;chatId?:string;persistDraft?:boolean};

function abortError(){const error=new Error("Long-term memory import was cancelled.");error.name="AbortError";return error;}
function throwIfAborted(signal?:AbortSignal){if(signal?.aborted)throw abortError();}
function cancelled(error:unknown,signal?:AbortSignal){return signal?.aborted||(error instanceof Error&&error.name==="AbortError");}
function canMarkCurrent(prepared:PreparedSource){return prepared.response.mutations.length>0||(prepared.outcome.state==="no_suggestions_created"&&prepared.outcome.droppedUnits===0&&prepared.diagnostics.length===0);}

export async function prepareLongTermMemorySource(options:PrepareOptions):Promise<PreparedSource>{
  throwIfAborted(options.signal);
  if(options.sourceNote.tags.includes("imported_game_journal")){
    const result=await prepareGameJournalIngest(options.sourceNote,options.root,{provider:options.provider,model:options.model,operationId:options.operationId,signal:options.signal});
    throwIfAborted(options.signal);
    if(options.persistDraft===false||result.draftless)return{...result,extractionMethod:"direct_ingest",draft:null};
    const draft=await finalizeLongTermMemoryExtractionDraft({sourceNote:result.sourceNote,response:result.response,scope:result.sourceNote.scope,modes:["game"],extractionMode:"game",operationId:options.operationId,diagnostics:result.diagnostics,outcome:result.outcome,accounting:result.accounting},{root:options.root});
    return{...result,extractionMethod:"direct_ingest",draft};
  }
  if(!options.provider)throw new Error("No LLM provider available for non-game source note extraction");
  const scope=options.scope??options.sourceNote.scope;
  const result=await extractLongTermMemoryFromSourceNote({noteId:options.sourceNote.id,provider:options.provider,model:options.model??"",scope,modes:options.modes??options.sourceNote.modes,mode:options.mode,instruction:options.instruction,operationId:options.operationId,signal:options.signal,root:options.root,chatId:options.chatId,trustedSubjectCatalog:await loadTrustedLtmSubjectCatalog(scope,options.root),persistDraft:options.persistDraft});
  throwIfAborted(options.signal);
  return{...result,extractionMethod:"llm"};
}

export async function processLongTermMemorySource(options:PrepareOptions&{applyLowRisk?:boolean}){
  const prepared=await prepareLongTermMemorySource({...options,persistDraft:true});
  const applyResult=options.applyLowRisk&&prepared.draft?.mutations.length?await applyLongTermMemoryDraft(prepared.draft.id,{root:options.root,actor:"maintenance_api",autoApplyLowRiskOnly:true,rebuildIndexes:false,operationId:options.operationId}):null;
  const draft=applyResult?.draft??prepared.draft;
  if(canMarkCurrent(prepared)&&draft?.source.extractionFingerprint)await new LongTermMemoryStorage(options.root).updateNote(prepared.sourceNote.id,{extractionFingerprint:draft.source.extractionFingerprint});
  await rebuildLongTermMemoryIndexes({root:options.root,scope:applyResult?.appliedMutationIds.length?"all":"source"});
  return{operationId:options.operationId,draft,diagnostics:prepared.diagnostics,outcome:prepared.outcome,accounting:prepared.accounting,response:prepared.response,appliedMutationIds:applyResult?.appliedMutationIds??[],skippedMutationIds:applyResult?.skippedMutationIds??[]};
}

function failed(item:ImportedSourceItem,method:"llm"|"direct_ingest",stage:"extract"|"finalize",error:unknown,isCancelled:boolean,prepared?:PreparedSource):LtmImportedSourceResult{
  const message=error instanceof Error?error.message:`Failed to ${stage} imported source`,base={sourceId:item.sourceId,title:item.title,note:item.note,created:item.created,sourceWriteStatus:item.created?"created" as const:"refreshed" as const,extractionMethod:method,retryable:true as const,draft:null,outcome:prepared?.outcome??{state:"no_suggestions_created" as const,totalCandidates:0,keptUnits:0,droppedUnits:0,droppedCandidates:[]},accounting:prepared?.accounting??{providerCandidates:0,normalizedAdditions:0,parserRejections:0,validationRejections:0,deduplications:0,keptUnits:0},appliedMutationIds:[],skippedMutationIds:[]};
  return isCancelled?{...base,extractionStatus:"cancelled",error:{code:"cancelled",message},diagnostics:[...(prepared?.diagnostics??[]),{severity:"warning",code:"cancelled",message}]}:{...base,extractionStatus:"failed",error:{code:`${stage}_failed`,message},diagnostics:[...(prepared?.diagnostics??[]),{severity:"error",code:`${stage}_failed`,message}]};
}

export async function processLongTermMemorySourceBatch(options:{items:ImportedSourceItem[];provider?:LongTermMemoryExtractionModel|null;model?:string;mode?:LtmMode;instruction?:string;operationId:string;signal:AbortSignal;applyLowRisk?:boolean;concurrency:number;root?:string}){
  const preparedResults:Array<{state:"prepared";item:ImportedSourceItem;prepared:PreparedSource}|{state:"failed";result:LtmImportedSourceResult}|undefined>=new Array(options.items.length);let next=0;
  await Promise.all(Array.from({length:Math.min(Math.max(options.concurrency,1),options.items.length)},async()=>{while(next<options.items.length){const index=next++,item=options.items[index]!;try{preparedResults[index]={state:"prepared",item,prepared:await prepareLongTermMemorySource({sourceNote:item.note,provider:options.provider,model:options.model,mode:options.mode,instruction:options.instruction,operationId:options.operationId,signal:options.signal,root:options.root,persistDraft:false})};}catch(error){preparedResults[index]={state:"failed",result:failed(item,item.note.tags.includes("imported_game_journal")?"direct_ingest":"llm","extract",error,cancelled(error,options.signal))};}}}));
  const storage=new LongTermMemoryStorage(options.root),overlay=new Map<string,LtmNote>(),results:LtmImportedSourceResult[]=[];
  for(const entry of preparedResults){if(!entry)continue;if(entry.state==="failed"){results.push(entry.result);continue;}const{item,prepared}=entry;try{throwIfAborted(options.signal);if(prepared.draftless){results.push({sourceId:item.sourceId,title:item.title,note:prepared.sourceNote,created:item.created,sourceWriteStatus:item.created?"created":"refreshed",extractionStatus:"succeeded",extractionMethod:prepared.extractionMethod,retryable:false,draft:null,diagnostics:prepared.diagnostics,outcome:prepared.outcome,accounting:prepared.accounting,appliedMutationIds:[],skippedMutationIds:[]});continue;}const draft=await finalizeLongTermMemoryExtractionDraft({sourceNote:prepared.sourceNote,response:prepared.response,scope:prepared.sourceNote.scope,modes:prepared.sourceNote.modes,extractionMode:prepared.extractionMode,operationId:options.operationId,diagnostics:prepared.diagnostics,outcome:prepared.outcome,accounting:prepared.accounting},{root:options.root,overlay});const applied=options.applyLowRisk&&draft.mutations.length?await applyLongTermMemoryDraft(draft.id,{root:options.root,actor:"maintenance_api",autoApplyLowRiskOnly:true,rebuildIndexes:false,operationId:options.operationId}):null,finalDraft=applied?.draft??draft,note=canMarkCurrent(prepared)&&finalDraft.source.extractionFingerprint?await storage.updateNote(prepared.sourceNote.id,{extractionFingerprint:finalDraft.source.extractionFingerprint}):prepared.sourceNote;results.push({sourceId:item.sourceId,title:item.title,note,created:item.created,sourceWriteStatus:item.created?"created":"refreshed",extractionStatus:"succeeded",extractionMethod:prepared.extractionMethod,retryable:false,draft:finalDraft,diagnostics:prepared.diagnostics,outcome:prepared.outcome,accounting:prepared.accounting,appliedMutationIds:applied?.appliedMutationIds??[],skippedMutationIds:applied?.skippedMutationIds??[]});}catch(error){results.push(failed(item,prepared.extractionMethod,"finalize",error,cancelled(error,options.signal),prepared));}}
  if(options.items.length)await rebuildLongTermMemoryIndexes({root:options.root,scope:results.some((item)=>item.appliedMutationIds.length)?"all":"source"});
  return results;
}
