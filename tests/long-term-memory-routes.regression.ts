import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

async function main() {
  const engineRoot=process.env.MARINARA_ENGINE_ROOT??process.cwd();
  const Fastify=(await import(pathToFileURL(join(engineRoot,"packages/server/node_modules/fastify/fastify.js")).href)).default;
  const {registerCapabilityPrivilegedRoutes}=await import(pathToFileURL(join(engineRoot,"packages/server/src/services/capability-packages/capability-route-registration.service.ts")).href);
  const {activate}=await import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/server-entry.ts");
  const app=Fastify();
  const dataDir=await mkdtemp(join(tmpdir(),"marinara-ltm-routes-"));
  const installed={id:"long-term-memory",version:"1.0.0",installedAt:"2026-07-17T00:00:00.000Z",status:"active",error:null,readiness:"pending",readinessError:null,legacy:false,manifest:{schemaVersion:2,capabilityApi:{major:1,minor:3},builtAgainst:{engineVersion:"2.3.2",engineCommit:"a".repeat(40)},id:"long-term-memory",name:"Long-Term Memory",version:"1.0.0",description:"fixture",engine:{min:"2.3.2",maxExclusive:"2.4.0"},kind:["agent"],entrypoints:{server:"server.mjs",agents:"agents.json"},files:[{path:"server.mjs",sha256:"0".repeat(64),bytes:1}],permissions:["agent-runtime","routes","storage"],restartRequired:true}};
  const previousSecret=process.env.ADMIN_SECRET;
  const previousRequireSecret=process.env.MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK;
  process.env.ADMIN_SECRET="ltm-route-secret";
  process.env.MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK="true";
  let cleanup:(()=>void|Promise<void>)|undefined;
  let storageService:any;
  try{
    cleanup=await activate({dataDir,api:{runtime:{logger:{debug(){},info(){},warn(){},error(){}},persistence:{async getChat(chatId:string){return chatId==="chat-b"?{id:chatId,mode:"roleplay",characterIds:[],groupId:null,metadata:{}}:null;}}},registerService(name:string,service:unknown){if(name==="long-term-memory:storage")storageService=service;return()=>void service||void name;},registerPrivilegedRoutes:(routes:any,options:{prefix:string})=>registerCapabilityPrivilegedRoutes(app,installed as any,routes,options)}});
    await app.ready();
    assert.equal((await app.inject({method:"GET",url:"/api/long-term-memory/settings"})).statusCode,403);
    const headers={"x-admin-secret":"ltm-route-secret"};
    assert.equal((await app.inject({method:"GET",url:"/api/long-term-memory/settings",headers})).statusCode,200);
    assert.equal((await app.inject({method:"GET",url:"/api/long-term-memory/status",headers})).statusCode,200);
    const created=await app.inject({method:"POST",url:"/api/long-term-memory/notes",headers,payload:{id:"world_route_fixture",title:"Route fixture",type:"world",status:"active",modes:["roleplay"],scope:{chatId:"chat-a",chatIds:["chat-a"]},tags:["route_fixture"],keywords:["cobalt"],links:[],sections:{facts:{text:"The cobalt key is beneath the observatory.",updatedAt:"2026-07-17T00:00:00.000Z"}}}});
    assert.equal(created.statusCode,201,created.body);
    const concurrent=await Promise.all([1,2].map(()=>app.inject({method:"POST",url:"/api/long-term-memory/notes",headers,payload:{id:"world_concurrent_fixture",type:"world",status:"active",modes:["roleplay"],scope:{},tags:[],keywords:[],links:[],sections:{facts:{text:"Only one create may commit.",updatedAt:"2026-07-17T00:00:00.000Z"}}}})));
    assert.deepEqual(concurrent.map((response)=>response.statusCode).sort(),[201,409]);
    const listed=await app.inject({method:"GET",url:"/api/long-term-memory/notes?scopeChatIds=chat-a&includeGlobal=false",headers});
    assert.deepEqual(listed.json().map((note:any)=>note.id),["world_route_fixture"]);
    const searched=await app.inject({method:"POST",url:"/api/long-term-memory/search",headers,payload:{queryText:"cobalt observatory",scope:{chatId:"chat-a",chatIds:["chat-a"]}}});
    assert.equal(searched.statusCode,200,searched.body);
    assert.equal(searched.json().chunks[0]?.chunk.noteId,"world_route_fixture");
    const transfer=await app.inject({method:"POST",url:"/api/long-term-memory/notes/transfer",headers,payload:{noteIds:["world_route_fixture"],mode:"copy",destinationChatId:"chat-b"}});
    assert.equal(transfer.statusCode,200,transfer.body);
    assert.deepEqual(transfer.json().updatedNoteIds,["world_route_fixture"]);
    const source=await app.inject({method:"POST",url:"/api/long-term-memory/notes",headers,payload:{id:"source_route_review",title:"Draft source",type:"source",status:"active",modes:["roleplay"],scope:{chatId:"chat-a",chatIds:["chat-a"]},tags:["source_summary"],keywords:[],links:[],sections:{source:{text:"The eastern gate is sealed at dusk.",updatedAt:"2026-07-17T00:00:00.000Z"}}}});
    assert.equal(source.statusCode,201,source.body);
    const mutationId="10000000-0000-4000-8000-000000000001";
    const draft=await storageService.drafts.createDraft({sourceNoteId:"source_route_review",chatId:"chat-a",scope:{chatId:"chat-a",chatIds:["chat-a"]},modes:["roleplay"],summary:"Remember the gate schedule.",mutations:[{id:mutationId,kind:"create_note",risk:"low",confidence:0.9,summary:"Create gate fact",evidence:["The eastern gate is sealed at dusk."],note:{id:"world_eastern_gate",title:"Eastern gate",type:"world",status:"active",modes:["roleplay"],scope:{chatId:"chat-a",chatIds:["chat-a"]},tags:[],keywords:["gate","dusk"],links:[],sections:{facts:{text:"The eastern gate is sealed at dusk.",updatedAt:"2026-07-17T00:00:00.000Z"}}}}]});
    const review=await app.inject({method:"GET",url:"/api/long-term-memory/drafts/review?sourceNoteId=source_route_review",headers});
    assert.equal(review.statusCode,200,review.body);
    assert.equal(review.json().counts.drafts,1);
    assert.equal(review.json().sources[0]?.drafts[0]?.freshness,"fresh");
    assert.equal(review.json().sources[0]?.targets[0]?.noteId,"world_eastern_gate");
    const accepted=await app.inject({method:"POST",url:`/api/long-term-memory/drafts/${draft.id}/accept`,headers,payload:{mutationIds:[mutationId]}});
    assert.equal(accepted.statusCode,200,accepted.body);
    assert.deepEqual(accepted.json().appliedMutationIds,[mutationId]);
    assert.equal(accepted.json().draft.status,"accepted");
    assert.equal((await storageService.storage.getNote("world_eastern_gate"))?.sections.facts.text,"The eastern gate is sealed at dusk.");
    const integrity=await app.inject({method:"GET",url:"/api/long-term-memory/integrity",headers});
    assert.equal(integrity.statusCode,200,integrity.body);
    assert.equal(integrity.json().ok,true);
    await cleanup();
    cleanup=undefined;
    assert.equal((await app.inject({method:"GET",url:"/api/long-term-memory/settings",headers})).statusCode,404);
  }finally{
    await cleanup?.();
    await app.close();
    await rm(dataDir,{recursive:true,force:true});
    if(previousSecret===undefined)delete process.env.ADMIN_SECRET;else process.env.ADMIN_SECRET=previousSecret;
    if(previousRequireSecret===undefined)delete process.env.MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK;else process.env.MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=previousRequireSecret;
  }
  process.stdout.write("Long-Term Memory routes regression: guard, settings, notes, search, draft review/apply, cleanup ok\n");
}

void main().catch((error)=>{console.error(error);process.exitCode=1;});
