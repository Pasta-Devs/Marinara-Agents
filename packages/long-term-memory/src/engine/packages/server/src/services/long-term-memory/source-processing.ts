import { createHash } from "node:crypto";
import type {
  LtmExtractionAccounting,
  LtmExtractionDiagnostic,
  LtmExtractionOutcome,
  LtmExtractionResponse,
  LtmImportedSourceResult,
  LtmMode,
  LtmNote,
  LtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { isLtmSourceLikeNote } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { logger, type PackageLanguageModel } from "./package-runtime.js";
import { rebuildLongTermMemoryIndexes } from "./rebuild.js";
import { applyLongTermMemoryDraft } from "./reconciliation.js";
import { extractLongTermMemoryFromSourceNote, finalizeLongTermMemoryExtractionDraft } from "./source-extraction.js";
import { LongTermMemoryStorage } from "./storage.js";
import { loadTrustedLtmSubjectCatalog } from "./subject-identity.js";
import { compileEvidenceUnitExtraction, sourceHashForEvidenceUnitExtraction } from "./evidence-unit-extraction.js";
import { canUpdateLtmScopedTarget } from "./scoped-targets.js";
import { LtmServiceError } from "./service-error.js";

export type ImportedSourceItem={sourceId:string;title:string;note:LtmNote;created:boolean;deterministicSourceText?:string};
type PreparedSource={operationId:string;chatId?:string;extractionMethod:"llm"|"deterministic";sourceNote:LtmNote;extractionMode:LtmMode;diagnostics:LtmExtractionDiagnostic[];outcome:LtmExtractionOutcome;accounting:LtmExtractionAccounting;response:LtmExtractionResponse;reviewRequired:boolean};
type PrepareOptions={sourceNote:LtmNote;languageModel?:PackageLanguageModel|null;scope?:LtmScope;modes?:LtmMode[];mode?:LtmMode;instruction?:string;operationId:string;signal?:AbortSignal;root?:string;chatId?:string;directGameMode?:boolean;directSourceText?:string};

function abortError(){const error=new Error("Long-term memory import was cancelled.");error.name="AbortError";return error;}
function throwIfAborted(signal?:AbortSignal){if(signal?.aborted)throw abortError();}
function cancelled(error:unknown,signal?:AbortSignal){return signal?.aborted||(error instanceof Error&&error.name==="AbortError");}
function canMarkCurrent(prepared:PreparedSource){return prepared.outcome.state==="success"||(prepared.extractionMethod==="deterministic"&&prepared.outcome.state==="partial_success"&&!prepared.diagnostics.some((item)=>item.severity==="error"))||(prepared.outcome.state==="no_suggestions_created"&&prepared.outcome.droppedUnits===0&&!prepared.diagnostics.some((item)=>item.severity==="error"));}
async function rebuildAfterSourceExtraction(root?: string) { try { await rebuildLongTermMemoryIndexes({ root }); } catch (error) { logger.warn(error, "[ltm] Deferred index rebuild after source extraction"); } }

function deterministicUuid(seed: string) {
  const hex = createHash("sha256").update(seed).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((Number.parseInt(hex[16]!, 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function directGameUnits(sourceNote: LtmNote, sourceText: string, sourceHash: string) {
  const evidence = [`source_note:${sourceNote.id}`, ...(sourceNote.sections.source?.evidence ?? [])];
  const units = [] as import("../../../../shared/src/features/agents/long-term-memory/schema.js").LtmEvidenceUnit[];
  const sourceSuffix = createHash("sha256").update(sourceNote.id).digest("hex").slice(0, 10);
  const occurrences = new Map<string, number>();
  for (const block of sourceText.split(/\n\n+/)) {
    const match = block.match(/^##\s+(timeline_event|thread|world_fact)\n([^:]+):\s*(.+)$/s);
    if (!match) continue;
    const bucket = match[1] as "timeline_event" | "thread" | "world_fact";
    const field = match[2]!.trim();
    const value = match[3]!.trim();
    const text = (bucket === "thread" ? `${field}: ${value}` : value).slice(0, 2000);
    if (!text) continue;
    const fieldKey = field.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "entry";
    const occurrence = occurrences.get(fieldKey) ?? 0;
    occurrences.set(fieldKey, occurrence + 1);
    const subjectId = `${bucket === "timeline_event" ? "session_event" : bucket === "thread" ? "session_thread" : "game_fact"}_${fieldKey}_${occurrence + 1}_${sourceSuffix}`;
    units.push({
      id: deterministicUuid(`${sourceNote.id}:${sourceHash}:${bucket}:${subjectId}:${text}`),
      bucket,
      subjectId,
      sectionKey: bucket === "timeline_event" ? "event" : bucket === "thread" ? "status" : "facts",
      text,
      claimKind: bucket === "timeline_event" ? "change" : "static",
      importance: bucket === "timeline_event" ? "major" : "moderate",
      keywords: [],
      evidence,
      confidence: 0.9,
      salience: 0.75,
      status: "active",
      links: bucket === "timeline_event"
        ? [{ target: sourceNote.id, relation: "extracted_from" }]
        : [],
      sourceHash,
    });
  }
  return units;
}

export async function prepareLongTermMemorySource(options:PrepareOptions):Promise<PreparedSource>{
  throwIfAborted(options.signal);
  const scope=options.scope??options.sourceNote.scope;
  const extractionMode = options.mode ?? options.sourceNote.modes[0] ?? "roleplay";
  if (options.directGameMode && extractionMode === "game") {
    const sourceHash = sourceHashForEvidenceUnitExtraction(options.sourceNote);
    const sourceText = options.directSourceText ?? options.sourceNote.sections.source?.text ?? "";
    const existingNotes = (await new LongTermMemoryStorage(options.root).listNotes()).filter(
      (note) => !isLtmSourceLikeNote(note) && canUpdateLtmScopedTarget(note.scope, scope),
    );
    const response = { summary: "Directly ingested Game Mode summary.", units: directGameUnits(options.sourceNote, sourceText, sourceHash) };
    const compiled = compileEvidenceUnitExtraction({
      unitResponse: response,
      sourceText, sourceNote: options.sourceNote, existingNotes,
      scope, modes: options.modes ?? ["game"], mode: "game", sourceHash,
      skipStructuredBackfill: true,
    });
    return { operationId: options.operationId, chatId: options.chatId, sourceNote: options.sourceNote, extractionMode: "game", response: compiled.compiledResponse, diagnostics: compiled.diagnostics, outcome: compiled.outcome, accounting: compiled.accounting, extractionMethod: "deterministic", reviewRequired: false };
  }
  if(!options.languageModel)throw new LtmServiceError("No language model available for source note extraction",400,"ltm_model_configuration");
  const result=await extractLongTermMemoryFromSourceNote({noteId:options.sourceNote.id,languageModel:options.languageModel,scope,modes:options.modes??options.sourceNote.modes,mode:options.mode,instruction:options.instruction,operationId:options.operationId,signal:options.signal,root:options.root,chatId:options.chatId,trustedSubjectCatalog:await loadTrustedLtmSubjectCatalog(scope,options.root)});
  throwIfAborted(options.signal);
  return{...result,extractionMethod:"llm",reviewRequired: options.sourceNote.provenance?.kind === "character" || options.sourceNote.provenance?.kind === "lorebook"};
}

async function commitPreparedLongTermMemorySource(prepared: PreparedSource, options: { root?: string; overlay?: Map<string, LtmNote>; applyLowRisk?: boolean }) {
  const draft = await finalizeLongTermMemoryExtractionDraft({
    sourceNote: prepared.sourceNote,
    response: prepared.response,
    scope: prepared.sourceNote.scope,
    modes: prepared.sourceNote.modes,
    extractionMode: prepared.extractionMode,
    operationId: prepared.operationId,
    diagnostics: prepared.diagnostics,
    outcome: prepared.outcome,
    accounting: prepared.accounting,
    reviewRequired: prepared.reviewRequired,
    chatId: prepared.chatId,
  }, { root: options.root, overlay: options.overlay });
  const markCurrent = canMarkCurrent(prepared);
  const note = markCurrent && draft.source.extractionFingerprint
    ? await new LongTermMemoryStorage(options.root).updateNote(prepared.sourceNote.id, { extractionFingerprint: draft.source.extractionFingerprint })
    : prepared.sourceNote;
  const fingerprintPersisted = markCurrent && Boolean(note.extractionFingerprint);
  const applyResult = options.applyLowRisk && !prepared.reviewRequired && fingerprintPersisted && draft.mutations.length
    ? await applyLongTermMemoryDraft(draft.id, { root: options.root, actor: "maintenance_api", autoApplyLowRiskOnly: true, rebuildIndexes: false, operationId: prepared.operationId })
    : null;
  const finalDraft = applyResult?.draft ?? draft;
  return { draft: finalDraft, note, applyResult };
}

export async function processLongTermMemorySource(options:PrepareOptions&{applyLowRisk?:boolean}){
  const prepared=await prepareLongTermMemorySource(options);
  const committed=await commitPreparedLongTermMemorySource(prepared,{root:options.root,applyLowRisk:options.applyLowRisk});
  if (committed.draft.mutations.length) await rebuildAfterSourceExtraction(options.root);
  return{operationId:prepared.operationId,draft:committed.draft,diagnostics:prepared.diagnostics,outcome:prepared.outcome,accounting:prepared.accounting,response:prepared.response,appliedMutationIds:committed.applyResult?.appliedMutationIds??[],skippedMutationIds:committed.applyResult?.skippedMutationIds??[]};
}

function failed(item:ImportedSourceItem,method:"llm"|"deterministic",stage:"extract"|"finalize",error:unknown,isCancelled:boolean,prepared?:PreparedSource):LtmImportedSourceResult{
  const message=error instanceof Error?error.message:`Failed to ${stage} imported source`,base={sourceId:item.sourceId,title:item.title,note:item.note,created:item.created,sourceWriteStatus:item.created?"created" as const:"refreshed" as const,extractionMethod:method,retryable:true as const,draft:null,outcome:prepared?.outcome??{state:"no_suggestions_created" as const,totalCandidates:0,keptUnits:0,droppedUnits:0,droppedCandidates:[],droppedCandidateDetailsTruncated:false},accounting:prepared?.accounting??{providerCandidates:0,normalizedAdditions:0,parserRejections:0,validationRejections:0,deduplications:0,keptUnits:0},appliedMutationIds:[],skippedMutationIds:[]};
  return isCancelled?{...base,extractionStatus:"cancelled",error:{code:"cancelled",message},diagnostics:[...(prepared?.diagnostics??[]),{severity:"warning",code:"cancelled",message}]}:{...base,extractionStatus:"failed",error:{code:`${stage}_failed`,message},diagnostics:[...(prepared?.diagnostics??[]),{severity:"error",code:`${stage}_failed`,message}]};
}

export async function processLongTermMemorySourceBatch(options:{items:ImportedSourceItem[];languageModel?:PackageLanguageModel|null;mode?:LtmMode;instruction?:string;operationId:string;signal:AbortSignal;applyLowRisk?:boolean;concurrency:number;root?:string;chatId?:string;directGameMode?:boolean}){
  const preparedResults:Array<{state:"prepared";item:ImportedSourceItem;prepared:PreparedSource}|{state:"failed";result:LtmImportedSourceResult}|undefined>=new Array(options.items.length);let next=0;
  await Promise.all(Array.from({length:Math.min(Math.max(options.concurrency,1),options.items.length)},async()=>{while(next<options.items.length){const index=next++,item=options.items[index]!,directGameMode=Boolean(options.directGameMode&&item.deterministicSourceText);try{preparedResults[index]={state:"prepared",item,prepared:await prepareLongTermMemorySource({sourceNote:item.note,languageModel:options.languageModel,mode:options.mode,instruction:options.instruction,operationId:options.operationId,signal:options.signal,root:options.root,chatId:options.chatId,directGameMode,directSourceText:item.deterministicSourceText})};}catch(error){preparedResults[index]={state:"failed",result:failed(item,directGameMode?"deterministic":"llm","extract",error,cancelled(error,options.signal))};}}}));
  const storage=new LongTermMemoryStorage(options.root),overlay=new Map<string,LtmNote>(),results:LtmImportedSourceResult[]=[];let hasDraftMutations=false;
  for(const entry of preparedResults){if(!entry)continue;if(entry.state==="failed"){results.push(entry.result);continue;}const{item,prepared}=entry;try{throwIfAborted(options.signal);const committed=await commitPreparedLongTermMemorySource(prepared,{root:options.root,overlay,applyLowRisk:options.applyLowRisk});hasDraftMutations||=committed.draft.mutations.length>0;results.push({sourceId:item.sourceId,title:item.title,note:committed.note,created:item.created,sourceWriteStatus:item.created?"created":"refreshed",extractionStatus:"succeeded",extractionMethod:prepared.extractionMethod,retryable:false,draft:committed.draft,diagnostics:prepared.diagnostics,outcome:prepared.outcome,accounting:prepared.accounting,appliedMutationIds:committed.applyResult?.appliedMutationIds??[],skippedMutationIds:committed.applyResult?.skippedMutationIds??[]});}catch(error){results.push(failed(item,prepared.extractionMethod,"finalize",error,cancelled(error,options.signal),prepared));}}
  if(hasDraftMutations)await rebuildAfterSourceExtraction(options.root);
  return results;
}
