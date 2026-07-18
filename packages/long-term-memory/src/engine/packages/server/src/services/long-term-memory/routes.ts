import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  ltmConflictSchema,
  ltmDraftMutationSchema,
  ltmDraftReviewResponseSchema,
  ltmDraftStatusSchema,
  ltmDebugPhaseSchema,
  ltmDebugStatusSchema,
  ltmExtractionSettingsSchema,
  ltmExtractSourceNoteRequestSchema,
  ltmExtractSourceNoteResponseSchema,
  ltmGlobalSettingsSchema,
  ltmIsoTimestampSchema,
  ltmLinkSchema,
  ltmModeSchema,
  ltmNoteIdSchema,
  ltmNoteTitleSchema,
  ltmNoteTypeSchema,
  ltmNoteTransferApplyResponseSchema,
  ltmNoteTransferPreviewRequestSchema,
  ltmNoteTransferPreviewResponseSchema,
  ltmIntegrityResponseSchema,
  ltmImportSourceNotesRequestSchema,
  ltmImportSourceNotesResponseSchema,
  ltmInteropPreviewRequestSchema,
  ltmInteropPreviewResponseSchema,
  ltmRepairRequestSchema,
  ltmRepairResponseSchema,
  ltmStatusResponseSchema,
  ltmScopeSchema,
  ltmSectionKeySchema,
  ltmSectionSchema,
  ltmStatusSchema,
  ltmSubjectsSchema,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { clearLtmDebugLog, exportLtmDebugLog, readLtmDebugLog } from "./debug-log.js";
import { LtmDraftProjectionError } from "./draft-projector.js";
import { projectLongTermMemoryDraftReview } from "./draft-review.js";
import { getLtmExtractionConfig, updateLtmExtractionConfig } from "./extraction-config.js";
import { countBy, isEnoent } from "./ltm-utils.js";
import { checkLongTermMemoryIntegrity, repairLongTermMemory } from "./maintenance.js";
import { applyLtmNoteTransfer, LtmNoteTransferError, previewLtmNoteTransfer } from "./note-transfer.js";
import { getPackageLanguageModels, getPackagePersistence, logger } from "./package-runtime.js";
import { getLongTermMemoryDirectories, LTM_DIR_NAME } from "./paths.js";
import { longTermMemoryRecallIndexPath, parseLtmRecallIndex, rebuildLongTermMemoryIndexes } from "./rebuild.js";
import { readLtmIndexState } from "./index-state.js";
import { CURRENT_LTM_CHUNK_FORMAT_VERSION } from "./chunking.js";
import { retrieveLongTermMemory } from "./retrieval.js";
import { applyLongTermMemoryDraft, LtmDraftApplyError } from "./reconciliation.js";
import { applyLtmScopeLinksToDerivedNotes } from "./scope-links.js";
import { getLtmGlobalSettings, updateLtmGlobalSettings } from "./settings.js";
import type { LongTermMemoryDraftStore } from "./draft-store.js";
import type { LongTermMemoryStorage } from "./storage.js";
import { readLongTermMemoryInjectionReceipt } from "./usage.js";
import { ltmModeForChatMode, resolveChatLtmScope } from "./chat-scope.js";
import { isLtmSourceNote } from "./source-extraction.js";
import { processLongTermMemorySource } from "./source-processing.js";
import { importPackageInterop, previewPackageInterop } from "./interop.js";

const NOTE_BODY_LIMIT_BYTES=512*1024;
const DRAFT_BODY_LIMIT_BYTES=512*1024;
const SEARCH_BODY_LIMIT_BYTES=128*1024;
const MAINTENANCE_BODY_LIMIT_BYTES=32*1024;
const ltmIdentifierSchema=z.string().min(1).max(120).regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);
const scopedIds=z.preprocess((value)=>{const values=Array.isArray(value)?value:typeof value==="string"?value.split(","):[];return values.map(String).map((item)=>item.trim()).filter(Boolean);},z.array(z.string().min(1).max(120)).max(100).optional());
const queryBoolean=z.preprocess((value)=>value==="true"?true:value==="false"?false:value,z.boolean().optional());
const listNotesQuery=z.object({type:ltmNoteTypeSchema.optional(),status:ltmStatusSchema.optional(),tag:ltmIdentifierSchema.optional(),scopeChatIds:scopedIds,scopeGroupId:z.string().min(1).max(120).optional(),scopeCharacterIds:scopedIds,includeGlobal:queryBoolean}).strict();
const createNoteBody=z.object({id:ltmNoteIdSchema,title:ltmNoteTitleSchema.optional(),type:ltmNoteTypeSchema,status:ltmStatusSchema,modes:z.array(ltmModeSchema).min(1).max(8),scope:ltmScopeSchema.default({}),tags:z.array(ltmIdentifierSchema).max(100).default([]),keywords:z.array(z.string().trim().min(1).max(80)).max(30).default([]),createdAt:ltmIsoTimestampSchema.optional(),updatedAt:ltmIsoTimestampSchema.optional(),links:z.array(ltmLinkSchema).max(250).default([]),sections:z.record(ltmSectionKeySchema,ltmSectionSchema),conflicts:z.array(ltmConflictSchema).max(250).optional(),subjects:ltmSubjectsSchema.optional(),version:z.number().int().min(1).optional()}).strict();
const updateNoteBody=z.object({title:ltmNoteTitleSchema.optional(),status:ltmStatusSchema.optional(),modes:z.array(ltmModeSchema).min(1).max(8).optional(),scope:ltmScopeSchema.optional(),tags:z.array(ltmIdentifierSchema).max(100).optional(),keywords:z.array(z.string().trim().min(1).max(80)).max(30).optional(),links:z.array(ltmLinkSchema).max(250).optional(),sections:z.record(ltmSectionKeySchema,ltmSectionSchema).optional(),conflicts:z.array(ltmConflictSchema).max(250).optional(),subjects:ltmSubjectsSchema.optional()}).strict().refine((value)=>Object.keys(value).length>0,"Patch body must include at least one updatable field.");
const removeScopeBody=z.object({chatIds:z.array(z.string().min(1).max(120)).max(100).optional(),groupId:z.string().min(1).max(120).optional(),characterIds:z.array(z.string().min(1).max(120)).max(100).optional()}).strict().refine((value)=>Boolean(value.chatIds?.length||value.groupId||value.characterIds?.length),"At least one scope link is required.");
const applyDerivedBody=z.object({chatIds:z.array(z.string().min(1).max(120)).max(100).optional(),characterIds:z.array(z.string().min(1).max(120)).max(100).optional()}).strict().refine((value)=>Boolean(value.chatIds?.length||value.characterIds?.length),"Provide at least one chat or character link to apply.");
const searchBody=z.object({queryText:z.string().max(20_000),mode:ltmModeSchema.optional(),scope:ltmScopeSchema.optional(),characterIds:z.array(z.string().min(1).max(120)).max(100).optional(),includeResolved:z.boolean().optional(),maxChunks:z.number().int().min(1).max(100).optional(),maxTokens:z.number().int().min(128).max(16_384).optional(),minScore:z.number().finite().min(0).max(1).optional(),semanticWeight:z.number().finite().min(0).max(1).optional(),lexicalWeight:z.number().finite().min(0).max(1).optional(),graphWeight:z.number().finite().min(0).max(1).optional(),keywordWeight:z.number().finite().min(0).max(1).optional()}).strict();
const draftQuery=z.object({status:ltmDraftStatusSchema.optional(),chatId:z.string().min(1).max(120).optional()}).strict();
const draftReviewQuery=z.object({sourceNoteId:ltmNoteIdSchema.optional(),chatId:z.string().min(1).max(120).optional(),status:ltmDraftStatusSchema.optional()}).strict();
const acceptDraftBody=z.object({mutationIds:z.array(z.string().uuid()).min(1).optional(),lowRiskOnly:z.boolean().optional(),editedMutations:z.array(ltmDraftMutationSchema).optional()}).strict().default({});
const debugQuery=z.object({limit:z.coerce.number().int().min(1).max(1000).default(200),operationId:z.string().uuid().optional(),sourceNoteId:ltmNoteIdSchema.optional(),draftId:z.string().uuid().optional(),status:ltmDebugStatusSchema.optional(),phase:ltmDebugPhaseSchema.optional()}).strict();
function extractionErrorStatus(message:string){
  if(/(?:language model connection|selected language model|selected connection|no language model|no model|no base URL|random pool|choose a language model|configured)/i.test(message))return 400;
  if(message.includes("not found"))return 404;
  if(/mode is not enabled/i.test(message))return 400;
  return 502;
}

export function createLongTermMemoryRoutes(runtime:{root:string;storage:LongTermMemoryStorage;draftStore:LongTermMemoryDraftStore}):FastifyPluginAsync{
  return async(app)=>{
    const {root,storage,draftStore}=runtime;
    const rebuildAfterMutation=async()=>rebuildLongTermMemoryIndexes({root}).catch((error)=>{logger.warn(error,"[ltm] Deferred index rebuild after maintenance mutation");return null;});
    app.get("/status",async()=>{await storage.initializeLtmStore();const notes=await storage.listNotes();const dirs=getLongTermMemoryDirectories(root);const events=await stat(dirs.eventLog).then((info)=>({logAvailable:true,bytes:info.size}),()=>({logAvailable:false,bytes:0}));const integrity=await checkLongTermMemoryIntegrity(root);const state=await readLtmIndexState(root);const index=await readFile(longTermMemoryRecallIndexPath(root),"utf8").then((value)=>parseLtmRecallIndex(JSON.parse(value))).catch(()=>null);const chunks=index?Object.values(index.metadata.chunks):[];return ltmStatusResponseSchema.parse({initialized:true,directory:LTM_DIR_NAME,notes:{total:notes.length,byType:countBy(notes.map((note)=>note.type)),byStatus:countBy(notes.map((note)=>note.status))},events,indexes:{health:integrity.health,manifestAvailable:false,generationId:null,currentGenerationId:null,recovered:false,dirty:state.dirty,rebuildState:state.rebuildState,errors:integrity.issues.filter((issue)=>issue.severity==="error").map((issue)=>({index:"recall",code:issue.code})),warnings:integrity.issues.filter((issue)=>issue.severity!=="error").map((issue)=>issue.message),generatedAt:index?.generatedAt??null,sourceHash:index?.sourceHash??null,noteCount:index?notes.length:null,chunkCount:index?chunks.length:null,chunkFormatVersion:index?CURRENT_LTM_CHUNK_FORMAT_VERSION:null,embeddingsAvailable:Boolean(index?.embeddings.embeddedChunkCount),embeddedChunkCount:index?.embeddings.embeddedChunkCount??0}});});
    app.get<{Querystring:unknown}>("/debug-log",async(request)=>({events:await readLtmDebugLog(debugQuery.parse(request.query),root)}));
    app.get("/debug-log/export",async(_request,reply)=>reply.header("content-type","application/x-ndjson; charset=utf-8").header("content-disposition",`attachment; filename=\"ltm-debug-log-${Date.now()}.jsonl\"`).send(await exportLtmDebugLog(root)));
    app.delete("/debug-log",async()=>clearLtmDebugLog(root));
    app.get<{Params:{chatId:string}}>("/last-injection/:chatId",async(request)=>{const receipt=await readLongTermMemoryInjectionReceipt(request.params.chatId,root);if(!receipt)return{memoryCount:0,tokenCount:0,memories:[]};const titles=new Map((await storage.listNotes()).map((note)=>[note.id,note.title?.trim()||note.id]));const memories=new Map<string,{noteId:string;title:string;tokenCount:number}>();for(const chunk of receipt.chunks){const current=memories.get(chunk.noteId);if(current)current.tokenCount+=chunk.tokenCount;else memories.set(chunk.noteId,{noteId:chunk.noteId,title:titles.get(chunk.noteId)??chunk.noteId,tokenCount:chunk.tokenCount});}return{memoryCount:memories.size,tokenCount:receipt.serializedTokenCount,memories:[...memories.values()]};});
    app.get("/settings",async()=>getLtmGlobalSettings(root));
    app.put<{Body:unknown}>("/settings",{bodyLimit:MAINTENANCE_BODY_LIMIT_BYTES},async(request)=>updateLtmGlobalSettings(ltmGlobalSettingsSchema.parse(request.body??{}),root));
    app.get("/extraction-settings",async()=>getLtmExtractionConfig(root));
    app.put<{Body:unknown}>("/extraction-settings",{bodyLimit:MAINTENANCE_BODY_LIMIT_BYTES},async(request)=>updateLtmExtractionConfig(ltmExtractionSettingsSchema.parse(request.body??{}),root));
    app.get<{Querystring:unknown}>("/notes",async(request)=>{const query=listNotesQuery.parse(request.query);const scope=query.scopeChatIds?.length||query.scopeGroupId||query.scopeCharacterIds?.length?{...(query.scopeChatIds?.length?{chatIds:query.scopeChatIds,chatId:query.scopeChatIds[0]}:{}),...(query.scopeGroupId?{groupId:query.scopeGroupId}:{}),...(query.scopeCharacterIds?.length?{characterIds:query.scopeCharacterIds}:{})}:undefined;return storage.listNotes({type:query.type,status:query.status,tag:query.tag,scope,characterIds:query.scopeCharacterIds,includeGlobal:query.includeGlobal});});
    app.get<{Params:{id:string}}>("/notes/:id",async(request,reply)=>{const note=await storage.getNote(ltmNoteIdSchema.parse(request.params.id));return note??reply.status(404).send({error:"Long-term memory note not found"});});
    app.post<{Params:{id:string};Body:unknown}>("/notes/:id/extract",{bodyLimit:DRAFT_BODY_LIMIT_BYTES},async(request,reply)=>{
      const id=ltmNoteIdSchema.parse(request.params.id);
      const body=ltmExtractSourceNoteRequestSchema.parse(request.body??{});
      const sourceNote=await storage.getNote(id);
      if(!sourceNote)return reply.status(404).send({error:"Long-term memory note not found"});
      if(!isLtmSourceNote(sourceNote))return reply.status(400).send({error:"Long-term memory note is not a source note"});
      const chat=body.chatId?await getPackagePersistence().getChat(body.chatId):null;
      if(body.chatId&&!chat)return reply.status(404).send({error:"Chat not found"});
      const operationId=randomUUID();
      try{
        const resolved=sourceNote.tags.includes("imported_game_journal")?null:await getPackageLanguageModels().resolveForRequest({connectionId:body.connectionId,chatConnectionId:chat?.connectionId??null,model:body.model});
        const provider=resolved?{
          name:resolved.name,
          maxContext:resolved.maxContext,
          maxOutputTokens:resolved.maxOutputTokens,
          complete:(messages:any,options:any)=>resolved.chatComplete(messages,{temperature:options.temperature,maxTokens:options.maxTokens,debugMode:options.debugMode,reasoningEffort:options.reasoningEffort,verbosity:options.verbosity,signal:options.signal,responseFormat:options.responseFormat}),
          fitContext:(messages:any,options:any)=>resolved.fitContext(messages,{maxTokens:options.maxTokens}),
        }:null;
        return ltmExtractSourceNoteResponseSchema.parse(await processLongTermMemorySource({sourceNote,provider,model:resolved?.model,scope:chat?resolveChatLtmScope(chat):sourceNote.scope,modes:chat?[ltmModeForChatMode(chat.mode)]:sourceNote.modes,mode:body.mode,instruction:body.instruction,operationId,applyLowRisk:body.applyLowRisk,root,chatId:chat?.id}));
      }catch(error){
        const message=error instanceof Error?error.message:"Failed to extract long-term memory from source note";
        logger.error(error,"[ltm] Source note extraction route failed");
        const status=sourceNote.tags.includes("imported_game_journal")?502:extractionErrorStatus(message);
        return reply.status(status).send({error:message});
      }
    });
    app.post<{Body:unknown}>("/import/preview",{bodyLimit:MAINTENANCE_BODY_LIMIT_BYTES},async(request)=>ltmInteropPreviewResponseSchema.parse(await previewPackageInterop(ltmInteropPreviewRequestSchema.parse(request.body??{}),root)));
    app.post<{Body:unknown}>("/import/source-notes",{bodyLimit:DRAFT_BODY_LIMIT_BYTES},async(request,reply)=>{const controller=new AbortController(),abort=()=>controller.abort();request.raw.once("aborted",abort);request.raw.once("close",()=>{if(request.raw.aborted)abort();});try{return ltmImportSourceNotesResponseSchema.parse(await importPackageInterop(ltmImportSourceNotesRequestSchema.parse(request.body??{}),root,controller.signal));}catch(error){const message=error instanceof Error?error.message:"Failed to import long-term memory sources";return reply.status(extractionErrorStatus(message)).send({error:message});}finally{request.raw.off("aborted",abort);}});
    app.post<{Body:unknown}>("/notes/transfer-preview",{bodyLimit:MAINTENANCE_BODY_LIMIT_BYTES},async(request,reply)=>{const body=ltmNoteTransferPreviewRequestSchema.parse(request.body??{});const chat=await getPackagePersistence().getChat(body.destinationChatId);if(!chat)return reply.status(404).send({error:"Destination chat not found"});try{return ltmNoteTransferPreviewResponseSchema.parse(await previewLtmNoteTransfer(body,chat,{root,storage}));}catch(error){return reply.status(error instanceof LtmNoteTransferError?error.statusCode:500).send({error:error instanceof Error?error.message:"Failed to preview long-term memory transfer"});}});
    app.post<{Body:unknown}>("/notes/transfer",{bodyLimit:MAINTENANCE_BODY_LIMIT_BYTES},async(request,reply)=>{const body=ltmNoteTransferPreviewRequestSchema.parse(request.body??{});const chat=await getPackagePersistence().getChat(body.destinationChatId);if(!chat)return reply.status(404).send({error:"Destination chat not found"});try{return ltmNoteTransferApplyResponseSchema.parse(await applyLtmNoteTransfer(body,chat,{root,storage,rebuild:async()=>{const result=await rebuildAfterMutation();return result?{generatedAt:result.generatedAt,noteCount:result.noteCount,chunkCount:result.chunkCount,sourceChunkCount:result.sourceChunkCount,embeddedChunkCount:result.embeddedChunkCount,embeddingsAvailable:result.embeddingsAvailable}:null;}}));}catch(error){return reply.status(error instanceof LtmNoteTransferError?error.statusCode:500).send({error:error instanceof Error?error.message:"Failed to transfer long-term memory notes"});}});
    app.post<{Body:unknown}>("/notes",{bodyLimit:NOTE_BODY_LIMIT_BYTES},async(request,reply)=>{const body=createNoteBody.parse(request.body);try{const note=await storage.createNote(body);await rebuildAfterMutation();return reply.status(201).send(note);}catch(error){if(error instanceof Error&&error.message.includes("already exists"))return reply.status(409).send({error:error.message});throw error;}});
    app.patch<{Params:{id:string};Body:unknown}>("/notes/:id",{bodyLimit:NOTE_BODY_LIMIT_BYTES},async(request,reply)=>{const id=ltmNoteIdSchema.parse(request.params.id);if(!await storage.getNote(id))return reply.status(404).send({error:"Long-term memory note not found"});const note=await storage.updateNote(id,updateNoteBody.parse(request.body));await rebuildAfterMutation();return note;});
    app.post<{Params:{id:string};Body:unknown}>("/notes/:id/scope/apply-to-derived",async(request,reply)=>{const result=await applyLtmScopeLinksToDerivedNotes(ltmNoteIdSchema.parse(request.params.id),applyDerivedBody.parse(request.body??{}),{root});return result??reply.status(404).send({error:"Long-term memory note not found"});});
    app.delete<{Params:{id:string} }>("/notes/:id",async(request,reply)=>{const id=ltmNoteIdSchema.parse(request.params.id);if(!await storage.getNote(id))return reply.status(404).send({error:"Long-term memory note not found"});const notes=await storage.archiveSourceNoteWithDerived(id);const rebuild=await rebuildAfterMutation();return{archived:true,note:notes[0],notes,rebuild};});
    app.post<{Body:unknown}>("/notes/permanent-delete",async(request)=>{const body=z.object({ids:z.array(ltmNoteIdSchema).min(1).max(100)}).strict().parse(request.body??{});const result=await storage.deleteNotesPermanently(body.ids);if(result.deletedIds.length)await rebuildAfterMutation();return{deletedIds:result.deletedIds,failedIds:result.failedIds};});
    app.delete<{Params:{id:string};Body:unknown}>("/notes/:id/scope",async(request,reply)=>{const id=ltmNoteIdSchema.parse(request.params.id);if(!await storage.getNote(id))return reply.status(404).send({error:"Long-term memory note not found"});const result=await storage.removeNoteFromScope(id,removeScopeBody.parse(request.body??{}));if(result.changed)await rebuildAfterMutation();return result.deleted?{deleted:true,unscoped:false,id}:{deleted:false,unscoped:result.changed,id,note:result.note};});
    app.post("/rebuild",async()=>rebuildLongTermMemoryIndexes({root}));
    app.get("/integrity",async()=>ltmIntegrityResponseSchema.parse(await checkLongTermMemoryIntegrity(root)));
    app.post<{Body:unknown}>("/repair",{bodyLimit:MAINTENANCE_BODY_LIMIT_BYTES},async(request)=>{const body=ltmRepairRequestSchema.parse(request.body);return ltmRepairResponseSchema.parse(await repairLongTermMemory(body.actions,root));});
    app.post<{Body:unknown}>("/search",{bodyLimit:SEARCH_BODY_LIMIT_BYTES},async(request)=>retrieveLongTermMemory({...searchBody.parse(request.body),root}));
    app.get<{Querystring:unknown}>("/drafts",async(request)=>draftStore.listDrafts(draftQuery.parse(request.query)));
    app.get<{Querystring:unknown}>("/drafts/pending-count",async(request)=>({count:(await draftStore.listDrafts({...draftQuery.parse(request.query),status:"pending"})).length}));
    app.get<{Querystring:unknown}>("/drafts/review",async(request)=>{const query=draftReviewQuery.parse(request.query);return ltmDraftReviewResponseSchema.parse(await projectLongTermMemoryDraftReview({root,sourceNoteId:query.sourceNoteId,chatId:query.chatId,status:query.status}));});
    app.post<{Params:{id:string};Body:unknown}>("/drafts/:id/accept",{bodyLimit:DRAFT_BODY_LIMIT_BYTES},async(request,reply)=>{const id=z.string().uuid().parse(request.params.id);const body=acceptDraftBody.parse(request.body??{});try{return await applyLongTermMemoryDraft(id,{root,actor:"maintenance_api",mutationIds:body.mutationIds,editedMutations:body.editedMutations,autoApplyLowRiskOnly:body.lowRiskOnly,operationId:randomUUID()});}catch(error){const message=error instanceof Error?error.message:"Failed to apply long-term memory draft";const status=error instanceof LtmDraftApplyError?error.statusCode:error instanceof LtmDraftProjectionError?409:message.includes("not found")?404:message.includes("not pending")?409:400;const code=error instanceof LtmDraftApplyError?error.code:error instanceof LtmDraftProjectionError?error.code:"ltm_draft_apply_failed";return reply.status(status).send({error:message,code});}});
    app.post<{Params:{id:string};Body:unknown}>("/drafts/:id/skip",async(request,reply)=>{const id=z.string().uuid().parse(request.params.id);const body=z.object({mutationIds:z.array(z.string().uuid()).min(1)}).strict().parse(request.body??{});const result=await draftStore.deleteDraftMutations(id,body.mutationIds);if(!result.deleted)return reply.status(result.reason==="not_pending"?409:404).send({error:result.reason==="not_pending"?"Long-term memory draft is not pending":"Long-term memory draft mutation not found"});return{deleted:true,draftId:id,mutationIds:body.mutationIds,draft:result.draft};});
    app.delete<{Params:{id:string}}>("/drafts/:id",async(request,reply)=>{const id=z.string().uuid().parse(request.params.id);if(!await draftStore.deleteDraft(id))return reply.status(404).send({error:"Long-term memory draft not found"});return{deleted:true,id};});
  };
}
