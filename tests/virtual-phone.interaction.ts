import assert from "node:assert/strict";
import {
  appendKnowledgeClaim,
  appendPhoneEvent,
  normalizePhoneInteractionLedger,
  upsertPhoneProcess,
  type KnowledgeClaim,
  type PhoneEvent,
  type PhoneProcess,
  type PrincipalRef,
} from "../packages/virtual-phone/src/phone/system/interaction-model";

const alex: PrincipalRef = { kind: "persona", id: "alex", name: "Alex" };
const mara: PrincipalRef = { kind: "character", id: "mara", name: "Mara" };
const sam: PrincipalRef = { kind: "character", id: "sam", name: "Sam" };
const at = "2026-08-14T10:00:00.000Z";

function event(overrides: Partial<PhoneEvent> = {}): PhoneEvent {
  return {
    id: "event-1",
    chatId: "chat-1",
    phoneId: "phone-alex",
    appId: "messages",
    verb: "notification.presented",
    actors: { actor: mara, owner: alex, holder: alex },
    audience: { kind: "private", principalIds: [alex.id] },
    physicalObserverIds: [],
    canon: "canonical",
    data: { senderName: "Mara", preview: "Can we talk?" },
    source: { kind: "background" },
    occurredAt: at,
    recordedAt: at,
    idempotencyKey: "message-1:notification.presented:alex",
    ...overrides,
  };
}

function knowledge(overrides: Partial<KnowledgeClaim> = {}): KnowledgeClaim {
  return {
    id: "knowledge-1",
    chatId: "chat-1",
    knower: alex,
    proposition: "Mara asked Alex to meet at the station.",
    sourceEventId: "event-opened",
    provenance: "read",
    confidence: "reliable",
    privacy: { kind: "private", principalIds: [alex.id] },
    acquiredAt: at,
    ...overrides,
  };
}

function orderProcess(overrides: Partial<PhoneProcess> = {}): PhoneProcess {
  return {
    id: "order-1",
    chatId: "chat-1",
    phoneId: "phone-alex",
    appId: "shop",
    kind: "order",
    state: "placed",
    participants: [alex],
    data: { item: "red coat" },
    createdAt: at,
    updatedAt: at,
    sourceEventId: "event-order-placed",
    ...overrides,
  };
}

function main() {
  // A notification is a visibility event, not an implicit read. Even when its preview is stored,
  // normalizing the ledger must never manufacture knowledge of the unread message body.
  const unread = normalizePhoneInteractionLedger({ events: [event()], knowledge: [], processes: [] });
  assert.equal(unread.events[0]?.verb, "notification.presented");
  assert.deepEqual(unread.knowledge, []);
  assert.equal(JSON.stringify(unread).includes("meet at the station"), false);

  // Knowledge remains attached to its explicit knower. Phone ownership and chat membership do not
  // broaden a private claim to another character.
  const isolated = normalizePhoneInteractionLedger({
    events: [],
    knowledge: [knowledge(), knowledge({ id: "knowledge-2", knower: mara, proposition: "Alex has the key." })],
    processes: [],
  });
  assert.deepEqual(isolated.knowledge.filter((claim) => claim.knower.id === alex.id).map((claim) => claim.proposition), [
    "Mara asked Alex to meet at the station.",
  ]);
  assert.deepEqual(isolated.knowledge.filter((claim) => claim.knower.id === sam.id), []);

  // Online/public audience and physical observability remain independent. This event is public on
  // the network, while only Sam is recorded as physically able to notice the phone action.
  const observable = event({
    id: "event-post",
    appId: "noodler",
    verb: "post.published",
    audience: { kind: "public" },
    physicalObserverIds: [sam.id, sam.id],
    data: { summary: "Alex posted publicly", body: "private screen text" },
    idempotencyKey: "message-9:post.published",
  });
  const [normalizedObservable] = normalizePhoneInteractionLedger({ events: [observable] }).events;
  assert.deepEqual(normalizedObservable?.audience, { kind: "public" });
  assert.deepEqual(normalizedObservable?.physicalObserverIds, [sam.id]);

  // A swipe/branch retry with the same idempotency key is one committed action. The latest
  // normalized envelope replaces the earlier copy instead of adding a second side effect.
  const firstCommit = event({ id: "event-send-a", verb: "message.sent", idempotencyKey: "turn-7:send:mara" });
  const retriedCommit = event({
    id: "event-send-b",
    verb: "message.sent",
    source: { kind: "character-command", messageId: "turn-7", swipeIndex: 1 },
    idempotencyKey: "turn-7:send:mara",
  });
  const deduplicated = appendPhoneEvent([firstCommit], retriedCommit);
  assert.equal(deduplicated.length, 1);
  assert.equal(deduplicated[0]?.id, "event-send-b");

  // Delayed consequences preserve a single process identity plus an explicit transition. Merely
  // placing or shipping an order never becomes receipt/possession by implication.
  const placed = orderProcess({ dueAt: "2026-08-15T10:00:00.000Z" });
  const shipped = orderProcess({
    state: "shipped",
    previousState: "placed",
    updatedAt: "2026-08-15T08:00:00.000Z",
    dueAt: "2026-08-15T10:00:00.000Z",
    sourceEventId: "event-order-shipped",
  });
  const transitioned = upsertPhoneProcess([placed], shipped);
  assert.equal(transitioned.length, 1);
  assert.equal(transitioned[0]?.state, "shipped");
  assert.equal(transitioned[0]?.previousState, "placed");
  assert.notEqual(transitioned[0]?.state, "received");

  // Claims use their own stable IDs: repeating the same committed acquisition updates rather than
  // duplicating it, while a distinct knower requires a distinct claim.
  const refreshedClaim = knowledge({ proposition: "Mara said the station meeting is at noon." });
  assert.equal(appendKnowledgeClaim([knowledge()], refreshedClaim).length, 1);

  process.stdout.write("Virtual Phone interaction ledger scenarios ok\n");
}

main();
