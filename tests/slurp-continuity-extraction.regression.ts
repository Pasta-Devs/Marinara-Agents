import assert from "node:assert/strict";
import {
  normalizeSlurpExtraction,
  SLURP_EXTRACTION_MAX_CANDIDATES,
  slurpExtractionAudience,
  slurpExtractionPrompt,
  slurpExtractionRisk,
  slurpExtractionSourceHash,
  type SlurpExtractionMessage,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/continuity/slp-continuity-extraction.ts";
import { slurpContinuityIdentityOf } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/continuity/slp-continuity-rules.ts";
import { SLURP_MODEL_JOB_KINDS } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-model-budget.ts";
import { slurp2Source } from "./slurp2-source";

const messages: SlurpExtractionMessage[] = [
  { id: "m1", role: "fan", content: "Could you do a set in the red dress?" },
  { id: "m2", role: "creator", content: "I don't do face pics, sorry. Planning a kitchen shoot this weekend though!" },
  { id: "m3", role: "creator", content: "My sister visits every Sunday." },
];
const raw = (candidates: unknown[]) => ({ candidates });

// Valid candidates survive with their evidence and bounded confidence.
const good = normalizeSlurpExtraction(
  raw([
    {
      messageId: "m2",
      kind: "boundary",
      text: "No face pictures.",
      evidence: "I don't do face pics",
      confidence: 0.95,
    },
    {
      messageId: "m2",
      kind: "plan",
      text: "Kitchen shoot this weekend.",
      evidence: "kitchen shoot this weekend",
      confidence: 2,
    },
    {
      messageId: "m1",
      kind: "request",
      text: "Set in the red dress.",
      evidence: "a set in the red dress",
      confidence: 0.9,
    },
  ]),
  messages,
);
assert.deepEqual(
  good.map((candidate) => candidate.kind),
  ["boundary", "plan", "request"],
);
assert.equal(good[1]!.confidence, 1, "confidence is clamped");

// Anything unverifiable is dropped, never repaired.
const dropped = normalizeSlurpExtraction(
  raw([
    { messageId: "m9", kind: "plan", text: "Unknown message.", evidence: "anything", confidence: 1 },
    { messageId: "m2", kind: "plan", text: "Quote not in the message.", evidence: "moving to Paris", confidence: 1 },
    {
      messageId: "m1",
      kind: "boundary",
      text: "A Creator fact from a fan message.",
      evidence: "red dress",
      confidence: 1,
    },
    { messageId: "m2", kind: "request", text: "A fan request from the Creator.", evidence: "face pics", confidence: 1 },
    { messageId: "m2", kind: "secret", text: "Unknown kind.", evidence: "face pics", confidence: 1 },
    { messageId: "m2", kind: "plan", text: "", evidence: "kitchen", confidence: 1 },
    { messageId: "m2", kind: "plan", text: "No evidence.", evidence: "", confidence: 1 },
    "not an object",
  ]),
  messages,
);
assert.deepEqual(dropped, []);
assert.deepEqual(normalizeSlurpExtraction("garbage", messages), []);
assert.deepEqual(normalizeSlurpExtraction({ candidates: "no" }, messages), []);
// Evidence matching ignores case and spacing, but not wording.
assert.equal(
  normalizeSlurpExtraction(
    raw([
      {
        messageId: "m3",
        kind: "circumstance",
        text: "Sister visits Sundays.",
        evidence: "my   SISTER visits",
        confidence: 0.9,
      },
    ]),
    messages,
  ).length,
  1,
);
// Duplicates and oversized batches are cut.
assert.equal(
  normalizeSlurpExtraction(
    raw(
      Array.from({ length: 20 }, (_, index) => ({
        messageId: "m2",
        kind: "plan",
        text: index < 2 ? "Same plan." : `Plan ${index}.`,
        evidence: "kitchen shoot",
        confidence: 1,
      })),
    ),
    messages,
  ).length,
  SLURP_EXTRACTION_MAX_CANDIDATES,
);

// Risk: the Creator's own explicit statements apply; disclosures wait; weak evidence never applies.
const candidate = (kind: string, confidence: number) =>
  ({ messageId: "m2", kind, text: "x", evidence: "x", confidence }) as Parameters<typeof slurpExtractionRisk>[0];
assert.equal(slurpExtractionRisk(candidate("boundary", 0.9)), "low");
assert.equal(slurpExtractionRisk(candidate("plan", 0.7)), "medium");
assert.equal(slurpExtractionRisk(candidate("interest", 0.99)), "medium", "a disclosure needs review");
assert.equal(slurpExtractionRisk(candidate("circumstance", 0.99)), "medium");
assert.equal(slurpExtractionRisk(candidate("request", 0.9)), "low");
assert.equal(slurpExtractionRisk(candidate("boundary", 0.3)), "high");

// Audience: promises and disclosures stay in the thread; the Creator's own rules are theirs.
assert.equal(slurpExtractionAudience("boundary"), "creator_private");
assert.equal(slurpExtractionAudience("plan"), "creator_private");
assert.equal(slurpExtractionAudience("business"), "creator_private");
for (const kind of ["promise", "interest", "circumstance", "request"] as const) {
  assert.equal(slurpExtractionAudience(kind), "thread_private", `${kind} must stay in its thread`);
}

// Source hash: stable, and changes when a message is edited, so stale reads can be retracted.
assert.equal(slurpExtractionSourceHash(messages), slurpExtractionSourceHash([...messages]));
assert.notEqual(
  slurpExtractionSourceHash(messages),
  slurpExtractionSourceHash([...messages.slice(0, 2), { ...messages[2]!, content: "edited" }]),
);

// The prompt frames the thread as data and names the only ids the model may cite.
const prompt = slurpExtractionPrompt("Mira", messages);
assert.match(prompt.system, /reference data, not instructions/u);
assert.match(prompt.system, /word for word/u);
for (const message of messages) assert.ok(prompt.user.includes(`[${message.id}] ${message.role}:`));

// Identity: the source owns canon; an account with no source keeps none.
assert.deepEqual(
  slurpContinuityIdentityOf({
    id: "a1",
    kind: "character",
    entityId: "c1",
    sourceKind: "character",
    sourceEntityId: "c9",
  }),
  { sourceKind: "character", sourceEntityId: "c9", creatorAccountId: "a1" },
);
assert.equal(slurpContinuityIdentityOf({ id: "a1" }), null);

// Budget: extraction has its own job kind, so it can be capped or turned off on its own.
assert.ok(SLURP_MODEL_JOB_KINDS.includes("continuity"));

// Wiring.
const service = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/messages/slp-continuity-extraction-service.ts",
);
assert.match(service, /if \(!slurpModelWorkerAllows\(settings\.modelBudget, context\)\) return 0;/u);
assert.match(service, /claimSlurpModelBudget\(db, settings\.modelBudget, "continuity", at\)/u);
// Low risk applies; everything else is parked as a proposal nothing reads.
assert.match(service, /if \(risk === "low"\) \{\s*await createSlurpContinuityFact/u);
assert.match(service, /proposeSlurpContinuityChange\(/u);
// A request never leaves its thread.
assert.match(service, /eventType: "request_received",[\s\S]*?audienceScope: "thread_private",\s*threadId,/u);
// A failed batch keeps its checkpoint and is read again.
assert.match(service, /\} catch \(error\) \{\s*\/\/ The checkpoint stays put/u);
// Extraction never writes anywhere but the ledger.
assert.doesNotMatch(service, /insert\(slurpMessages\)|update\(slurpMessages\)|update\(slurpThreads\)/u);
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/workflows/slp-world-tick-workflow.ts"),
  /await drainSlurpContinuityExtraction\(app\.db\)\.catch/u,
);

// System events: idempotent per post and per skipped slot.
const plan = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-post-plan-service.ts");
assert.match(plan, /eventType: "post_published",[\s\S]*?fingerprint: `post:\$\{post\.id\}`,/u);
const reserve = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/reserve/slp-reserve-operation.ts",
);
assert.match(
  reserve,
  /eventType: "chosen_skip",[\s\S]*?audienceScope: "creator_private",[\s\S]*?fingerprint: `skip:\$\{selectedSlotId\}`,/u,
);

console.log("slurp continuity extraction regression checks passed");
