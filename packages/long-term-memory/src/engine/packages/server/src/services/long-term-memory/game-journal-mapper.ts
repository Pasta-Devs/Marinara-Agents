import { createHash, randomUUID } from "node:crypto";
import type { LtmEvidenceUnit, LtmScope } from "../../../../shared/src/features/agents/long-term-memory/schema.js";

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue { return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {}; }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : []; }
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function slug(value: string, fallback: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,72)||fallback; }
function npcSubjectId(value:string,fallback:string){const colon=value.match(/^\s*([A-Za-z][A-Za-z0-9' -]{1,80})\s*:/)?.[1],proper=value.match(/\b([A-Z][A-Za-z0-9']+(?:\s+[A-Z][A-Za-z0-9']+){0,3})\b/)?.[1],candidate=(colon??proper??value).replace(/^(?:npc|character)\s+/i,"").trim();return`npc_${slug(candidate,fallback)}`;}
function unit(bucket:LtmEvidenceUnit["bucket"],subjectId:string,sectionKey:string,value:string,chatId:string,sourceHash:string,extra:Partial<LtmEvidenceUnit>={}):LtmEvidenceUnit{return{id:randomUUID(),bucket,subjectId,sectionKey,text:value.slice(0,2_000),keywords:[],evidence:extra.evidence??[`chat:${chatId}`],confidence:0.95,salience:0.7,importance:extra.importance??"moderate",status:extra.status??"active",links:extra.links??[],sourceHash};}

export function computeGameSourceHash(journal:unknown,summaries:unknown[]){return createHash("sha256").update(JSON.stringify({journal,summaries})).digest("hex");}

export function renderGameSourceText(journalValue:unknown,summaries:unknown[]){
  const journal=record(journalValue);const parts:string[]=[];
  const quests=Array.isArray(journal.quests)?journal.quests.map(record):[];
  const entries=Array.isArray(journal.entries)?journal.entries.map(record):[];
  if(quests.length)parts.push(`Quests:\n${quests.map((q)=>`- [${text(q.status)||"active"}] ${text(q.name)||"Quest"}: ${text(q.description)}${strings(q.objectives).length?`\n  Objectives: ${strings(q.objectives).join("; ")}`:""}`).join("\n")}`);
  if(strings(journal.locations).length)parts.push(`Locations:\n${strings(journal.locations).map((item)=>`- ${item}`).join("\n")}`);
  if(entries.length)parts.push(`Journal Entries:\n${entries.map((entry)=>`- [${text(entry.type)||"note"}] ${text(entry.title)||"Entry"}: ${text(entry.content)}`).join("\n")}`);
  const npcLog=Array.isArray(journal.npcLog)?journal.npcLog.map(record):[],inventory=Array.isArray(journal.inventoryLog)?journal.inventoryLog.map(record):[];
  if(npcLog.length)parts.push(`NPC Log:\n${npcLog.map((npc)=>`- ${text(npc.npcName)}: ${strings(npc.interactions).join("; ")}`).join("\n")}`);
  if(inventory.length)parts.push(`Inventory:\n${inventory.map((entry)=>`- (${text(entry.action)}) ${Number(entry.quantity)||1}x ${text(entry.item)}`).join("\n")}`);
  for(const raw of summaries){const summary=record(raw);parts.push(`Session ${Number(summary.sessionNumber)||1}:\nSummary: ${text(summary.summary)}\nResume Point: ${text(summary.resumePoint)}\nParty State: ${text(summary.partyState)}\nParty Dynamics: ${text(summary.partyDynamics)}${strings(summary.keyDiscoveries).length?`\nKey Discoveries:\n${strings(summary.keyDiscoveries).map((item)=>`- ${item}`).join("\n")}`:""}${strings(summary.characterMoments).length?`\nCharacter Moments:\n${strings(summary.characterMoments).map((item)=>`- ${item}`).join("\n")}`:""}${strings(summary.littleDetails).length?`\nLittle Details:\n${strings(summary.littleDetails).map((item)=>`- ${item}`).join("\n")}`:""}${strings(summary.npcUpdates).length?`\nNPC Updates:\n${strings(summary.npcUpdates).map((item)=>`- ${item}`).join("\n")}`:""}${text(summary.nextSessionRequest)?`\nNext Session Request: ${text(summary.nextSessionRequest)}`:""}`);}
  return parts.join("\n\n---\n\n").trim();
}

export function mapGameJournalToEvidenceUnits(journalValue:unknown,summaries:unknown[],ctx:{chatId:string;scope:LtmScope;sourceHash:string}){
  const journal=record(journalValue);const units:LtmEvidenceUnit[]=[];
  for(const [index,raw] of (Array.isArray(journal.entries)?journal.entries:[]).entries()){
    const entry=record(raw),value=text(entry.content);if(!value)continue;const kind=text(entry.type),name=slug(text(entry.title),`entry_${index+1}`),evidence=[`journal_entry:${text(entry.timestamp)||index+1}`,`chat:${ctx.chatId}`];
    if(kind==="npc")units.push(unit("character_fact",npcSubjectId(`${text(entry.title)}: ${value}`,name),"facts",value,ctx.chatId,ctx.sourceHash,{evidence}));
    else if(kind==="combat"||kind==="event")units.push(unit("timeline_event",`${kind||"event"}_${name}`,"event",value,ctx.chatId,ctx.sourceHash,{evidence}));
    else if(kind==="item")units.push(unit("character_fact","party_inventory","items",value,ctx.chatId,ctx.sourceHash,{evidence}));
    else units.push(unit("world_fact",`${kind==="location"?"location":"note"}_${name}`,kind==="location"?"discovered":"notes",value,ctx.chatId,ctx.sourceHash,{evidence}));
  }
  for(const raw of Array.isArray(journal.quests)?journal.quests:[]){const quest=record(raw),id=text(quest.id)||text(quest.name)||"quest",status=text(quest.status);units.push(unit("thread",`quest_${slug(id,"quest")}`,status==="active"?"quest":"summary",[text(quest.name),text(quest.description),...strings(quest.objectives)].filter(Boolean).join("\n"),ctx.chatId,ctx.sourceHash,{evidence:[`journal_quest:${id}`,`chat:${ctx.chatId}`],status:status==="completed"?"resolved":status==="failed"?"archived":"active"}));}
  for(const location of strings(journal.locations))units.push(unit("world_fact",`location_${slug(location,"location")}`,"discovered",`Discovered: ${location}`,ctx.chatId,ctx.sourceHash));
  for(const raw of Array.isArray(journal.npcLog)?journal.npcLog:[]){const npc=record(raw),name=text(npc.npcName),interactions=strings(npc.interactions);if(name&&interactions.length)units.push(unit("character_fact",`npc_${slug(name,"npc")}`,"developments",`${name}: ${interactions.join("; ")}`,ctx.chatId,ctx.sourceHash,{evidence:[`npc_log:${name}`,`chat:${ctx.chatId}`]}));}
  for(const raw of Array.isArray(journal.inventoryLog)?journal.inventoryLog:[]){const entry=record(raw),item=text(entry.item);if(item)units.push(unit("character_fact","party_inventory","items",`${text(entry.action)||"updated"} ${Number(entry.quantity)||1}x ${item}`,ctx.chatId,ctx.sourceHash,{evidence:[`inventory_log:${text(entry.timestamp)||item}`,`chat:${ctx.chatId}`],status:text(entry.action)==="acquired"?"active":"resolved"}));}
  for(const raw of summaries){const summary=record(raw),session=Number(summary.sessionNumber)||1,evidence=[`session:${session}`,`chat:${ctx.chatId}`];if(text(summary.summary))units.push(unit("timeline_event",`session_${session}`,"event",text(summary.summary),ctx.chatId,ctx.sourceHash,{evidence}));if(text(summary.resumePoint))units.push(unit("world_fact",`session_${session}_resume`,"resume_point",text(summary.resumePoint),ctx.chatId,ctx.sourceHash,{evidence}));if(text(summary.partyState))units.push(unit("character_fact","party","state",text(summary.partyState),ctx.chatId,ctx.sourceHash,{evidence}));if(text(summary.partyDynamics))units.push(unit("relationship_state","party","state",text(summary.partyDynamics),ctx.chatId,ctx.sourceHash,{evidence}));for(const discovery of strings(summary.keyDiscoveries))units.push(unit("world_fact",`discovery_${slug(discovery,"discovery")}`,"discoveries",discovery,ctx.chatId,ctx.sourceHash,{evidence}));for(const moment of strings(summary.characterMoments))units.push(unit("timeline_event",`char_${slug(moment,"moment")}`,"event",moment,ctx.chatId,ctx.sourceHash,{evidence}));for(const detail of strings(summary.littleDetails))units.push(unit("character_fact",`char_${slug(detail,"detail")}`,"details",detail,ctx.chatId,ctx.sourceHash,{evidence}));for(const update of strings(summary.npcUpdates))units.push(unit("character_fact",npcSubjectId(update,"npc_update"),"developments",update,ctx.chatId,ctx.sourceHash,{evidence}));if(text(summary.nextSessionRequest))units.push(unit("thread",`player_request_${session}`,"quest",text(summary.nextSessionRequest),ctx.chatId,ctx.sourceHash,{evidence}));}
  return units;
}
