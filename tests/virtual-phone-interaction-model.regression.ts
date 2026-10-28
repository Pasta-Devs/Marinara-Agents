import assert from "node:assert/strict";
import {
  PHONE_INTERACTION_LIMITS,
  appendPhoneEvent,
  normalizeAudience,
  normalizeInteractionData,
  normalizeKnowledgeClaim,
  normalizePhoneEvent,
  normalizePhoneEvents,
  normalizePhoneProcess,
  normalizePrincipal,
  upsertPhoneProcess,
  type PhoneEvent,
  type PhoneProcess,
} from "../packages/virtual-phone/src/phone/system/interaction-model";

const alex = { kind: "character" as const, id: "alex", name: "Alex" };
const user = { kind: "user" as const, id: "user" };

function event(overrides: Partial<PhoneEvent> = {}): PhoneEvent {
  return {
    id: "event-1",
    chatId: "chat-1",
    phoneId: "phone-1",
    appId: "messages",
    verb: "message.opened",
    actors: { actor: alex, operator: user, owner: alex, holder: alex },
    audience: { kind: "private", principalIds: ["alex"] },
    physicalObserverIds: [],
    canon: "canonical",
    data: { messageId: "message-1" },
    source: { kind: "user-ui" },
    occurredAt: "2026-08-14T08:00:00Z",
    recordedAt: "2026-08-14T08:00:01Z",
    idempotencyKey: "open:message-1:alex",
    ...overrides,
  };
}

assert.deepEqual(normalizePrincipal({ ...alex, name: "  Alex   Smith  " }), { ...alex, name: "Alex Smith" });
assert.equal(normalizePrincipal({ kind: "character", id: "alex" }), null);
assert.deepEqual(normalizeAudience({ kind: "private", principalIds: ["alex", "alex", "sam"] }), {
  kind: "private",
  principalIds: ["alex", "sam"],
});
assert.equal(normalizeAudience({ kind: "private", principalIds: [] }), null);

const unsafe = JSON.parse('{"safe":"yes","__proto__":{"polluted":true},"infinite":null}');
unsafe.infinite = Number.POSITIVE_INFINITY;
const safe = normalizeInteractionData(unsafe) as Record<string, unknown>;
assert.equal(Object.getPrototypeOf(safe), null);
assert.equal(safe.safe, "yes");
assert.equal(Object.hasOwn(safe, "__proto__"), false);
assert.equal(safe.infinite, null);
assert.equal(({} as { polluted?: boolean }).polluted, undefined);

const normalizedEvent = normalizePhoneEvent(event({ physicalObserverIds: ["sam", "sam"] }));
assert.ok(normalizedEvent);
assert.deepEqual(normalizedEvent.physicalObserverIds, ["sam"]);
assert.equal(normalizedEvent.recordedAt, "2026-08-14T08:00:01.000Z");
assert.equal(normalizePhoneEvent({ ...event(), recordedAt: "not a date" }), null);

const replacedEvents = normalizePhoneEvents([
  event(),
  event({ id: "event-2", verb: "message.read", recordedAt: "2026-08-14T08:01:00Z" }),
]);
assert.equal(replacedEvents.length, 1, "idempotency keys, not event ids, prevent branch/swipe duplication");
assert.equal(replacedEvents[0]?.id, "event-2");
assert.equal(appendPhoneEvent(replacedEvents, event({ id: "event-3", idempotencyKey: "another" })).length, 2);

const claim = normalizeKnowledgeClaim({
  id: "claim-1",
  chatId: "chat-1",
  knower: alex,
  proposition: "  The bridge closes at 22:00.  ",
  sourceEventId: "event-1",
  provenance: "read",
  confidence: "reliable",
  privacy: { kind: "private", principalIds: ["alex"] },
  acquiredAt: "2026-08-14T08:00:00Z",
});
assert.equal(claim?.proposition, "The bridge closes at 22:00.");
assert.equal(normalizeKnowledgeClaim({ ...claim, confidence: "certain" }), null);

const phoneProcess: PhoneProcess = {
  id: "order-1",
  chatId: "chat-1",
  phoneId: "phone-1",
  appId: "shop",
  kind: "order",
  state: "placed",
  participants: [alex],
  data: { total: 12 },
  createdAt: "2026-08-14T08:00:00Z",
  updatedAt: "2026-08-14T08:00:00Z",
  sourceEventId: "event-1",
};
assert.ok(normalizePhoneProcess(phoneProcess));
const updated = { ...phoneProcess, state: "shipped", previousState: "placed", updatedAt: "2026-08-14T09:00:00Z" };
assert.equal(upsertPhoneProcess([phoneProcess], updated)[0]?.state, "shipped");

const overLimit = Array.from({ length: PHONE_INTERACTION_LIMITS.events + 2 }, (_, index) => event({
  id: `event-${index}`,
  idempotencyKey: `key-${index}`,
}));
const bounded = normalizePhoneEvents(overLimit);
assert.equal(bounded.length, PHONE_INTERACTION_LIMITS.events);
assert.equal(bounded[0]?.id, "event-2", "bounded ledgers retain the newest valid records");

process.stdout.write("Virtual Phone interaction model regression passed.\n");
