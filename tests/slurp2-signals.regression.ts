import assert from "node:assert/strict";
import {
  slurpOrderSignals,
  slurpSignalFromEvent,
  slurpSignalFromFact,
  slurpSignalFromPost,
  slurpSignalFromPromise,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/continuity/slp-signals.ts";

const identity = { sourceKind: "character", sourceEntityId: "char-1", creatorAccountId: "creator-1" };
const fact = (overrides: Record<string, unknown>) =>
  ({
    ...identity,
    id: "f1",
    factType: "circumstance",
    subject: "",
    text: "the evening at the bar",
    audienceScope: "creator_private",
    realityScope: "slurp",
    threadId: null,
    confidence: 1,
    salience: 0.5,
    status: "active",
    source: "chat",
    evidence: "",
    sourceHash: "",
    contribution: "manual",
    createdAt: "2026-09-24T10:00:00.000Z",
    updatedAt: "2026-09-24T10:00:00.000Z",
    expiresAt: null,
    ...overrides,
  }) as never;

// A saved chat moment is an Engine-chat signal with its text; a fan's private note shows its kind only.
const chat = slurpSignalFromFact(fact({}));
assert.equal(chat.source, "engine-chat");
assert.equal(chat.summary, "Life: the evening at the bar");
const privateNote = slurpSignalFromFact(
  fact({ id: "f2", audienceScope: "thread_private", source: "slurp_message", text: "secret" }),
);
assert.equal(privateNote.source, "message");
assert.doesNotMatch(privateNote.summary, /secret/u);

// A DM event is its label, never its payload text.
const event = slurpSignalFromEvent({
  ...identity,
  id: "e1",
  eventType: "request_received",
  source: "slurp_message",
  realityScope: "slurp",
  audienceScope: "thread_private",
  threadId: "t1",
  payload: { text: "please post the red dress" },
  status: "active",
  confidence: 1,
  evidence: "",
  relatedIds: ["m1"],
  fingerprint: "x",
  contribution: "system",
  occurredAt: "2026-09-25T09:00:00.000Z",
  createdAt: "2026-09-25T09:00:00.000Z",
  expiresAt: null,
} as never);
assert.equal(event.summary, "A subscriber asked for something");
assert.deepEqual(event.refs, ["e1", "m1"]);

const post = slurpSignalFromPost({
  id: "p1",
  authorAccountId: "creator-1",
  title: "Neon set",
  content: "caption",
  access: "locked",
  createdAt: "2026-09-25T11:00:00.000Z",
});
assert.equal(post.summary, "Posted (locked): Neon set");
const promise = slurpSignalFromPromise("creator-1", {
  id: "o1",
  topic: "red dress set",
  workflow: "planned",
  plannedAt: "2026-09-25T08:00:00.000Z",
  dueAt: "2026-09-26T08:00:00.000Z",
});
assert.equal(promise.summary, "Open promise: red dress set (due 2026-09-26 08:00)");

// Newest first, one per id, inside the window, capped.
const ordered = slurpOrderSignals([chat, post, event, post, { ...promise, at: "2026-08-01T00:00:00.000Z" }], {
  since: new Date("2026-09-11T00:00:00.000Z"),
  limit: 10,
});
assert.deepEqual(
  ordered.map((signal) => signal.id),
  ["post:p1", "event:e1", "fact:f1"],
);

console.log("slurp2 signals regression checks passed");
