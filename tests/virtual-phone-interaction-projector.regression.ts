import assert from "node:assert/strict";
import { projectInteractionContext } from "../packages/virtual-phone/src/phone/system/interaction-projector";
import type { PhoneEvent, PhoneInteractionLedger } from "../packages/virtual-phone/src/phone/system/interaction-model";

const alex = { kind: "character" as const, id: "alex", name: "Alex" };
const mara = { kind: "character" as const, id: "mara", name: "Mara" };
const at = "2026-08-14T10:00:00.000Z";

const event = (overrides: Partial<PhoneEvent> = {}): PhoneEvent => ({
  id: "event-1", chatId: "chat-1", phoneId: "phone-alex", appId: "messages",
  verb: "notification.presented", actors: { actor: mara, owner: alex, holder: alex },
  audience: { kind: "private", principalIds: [alex.id] }, physicalObserverIds: [], canon: "canonical",
  data: { promptSummary: "Alex's phone vibrates; a message from Mara arrived.", body: "the unread secret" },
  source: { kind: "background" }, occurredAt: at, recordedAt: at,
  idempotencyKey: "message-1:notification:alex", ...overrides,
});

const ledger: PhoneInteractionLedger = {
  events: [event()],
  knowledge: [],
  processes: [],
};
const unread = projectInteractionContext(ledger, alex);
assert.match(unread ?? "", /message from Mara arrived/u);
assert.doesNotMatch(unread ?? "", /unread secret/u);

ledger.knowledge.push({
  id: "knowledge-1", chatId: "chat-1", knower: alex,
  proposition: "Mara says the bridge closes at ten.", sourceEventId: "message-opened-1",
  provenance: "read", confidence: "reliable", privacy: { kind: "private", principalIds: [alex.id] }, acquiredAt: at,
});
assert.match(projectInteractionContext(ledger, alex) ?? "", /Alex learned: Mara says the bridge closes at ten/u);
assert.equal(projectInteractionContext(ledger, mara), null, "phone ownership/chat membership never widens private knowledge");

const networkPost = event({
  id: "event-post", verb: "post.published", audience: { kind: "public" },
  data: { promptSummary: "Alex posted on Noodle." }, idempotencyKey: "post-1",
});
assert.equal(projectInteractionContext({ events: [networkPost] }, mara), null, "online public is not physical perception");
networkPost.physicalObserverIds = [mara.id];
assert.match(projectInteractionContext({ events: [networkPost] }, mara) ?? "", /posted on Noodle/u);

assert.equal(projectInteractionContext(ledger, alex, { since: at }), null, "already-projected changes stay quiet");
process.stdout.write("Virtual Phone interaction projector regression passed.\n");
