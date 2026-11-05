/**
 * S — paid sexting sessions (docs/SPICY.md, item 2, PR 3): 20 minutes for three of her PPV pictures, claimed
 * before it is paid, three phases in the DM prompt, instant replies, and one in-session PPV at her full level.
 */
import assert from "node:assert/strict";
import {
  readSlurpSexting,
  slurpSextingGuidance,
  slurpSextingPhase,
  slurpSextingPrice,
  slurpSextingStart,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-sexting.ts";
import { slurpReplyPacing } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-messaging.ts";
import type { SlurpRapport } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-rapport.ts";
import { slurp2Source } from "./slurp2-source.ts";

const rapport = (tier: SlurpRapport["tier"], extra: Partial<SlurpRapport> = {}): SlurpRapport => ({
  score: 0,
  tier,
  contributions: [],
  ...extra,
});

// Price: three of her PPV pictures; a kept favourite peak takes 15% off; no price set reads as 10.
assert.equal(slurpSextingPrice(12, rapport("regular")), 36);
assert.equal(slurpSextingPrice(10, rapport("acquaintance", { peak: "favourite" })), 26);
assert.equal(slurpSextingPrice(undefined, rapport("stranger")), 30);

// 20 minutes: warm-up, heated, finish, then over.
const at = new Date("2026-10-22T20:00:00.000Z");
const session = slurpSextingStart(at);
assert.equal(session.endsAt, "2026-10-22T20:20:00.000Z");
const minute = (n: number) => at.getTime() + n * 60_000;
assert.equal(slurpSextingPhase(session, minute(1)), "warmUp");
assert.equal(slurpSextingPhase(session, minute(10)), "heated");
assert.equal(slurpSextingPhase(session, minute(17)), "finish");
assert.equal(slurpSextingPhase(session, minute(20)), null);
assert.equal(slurpSextingPhase(null, minute(1)), null);

// Stored JSON; anything malformed is no session.
assert.deepEqual(readSlurpSexting(JSON.stringify(session)), { ...session, pictureOffered: false });
assert.equal(readSlurpSexting("{"), null);
assert.equal(readSlurpSexting(JSON.stringify({ startedAt: 1 })), null);
assert.equal(readSlurpSexting(null), null);

// The prompt asks for the picture only when it is due.
assert.match(slurpSextingGuidance("heated", true), /Send one picture now/);
assert.doesNotMatch(slurpSextingGuidance("heated", false), /Send one picture/);
assert.match(slurpSextingGuidance("finish", false), /afterglow/);

// She answers at once while a session runs, even offline.
const pacing = (sexting: boolean) =>
  slurpReplyPacing({
    online: false,
    rapport: rapport("stranger"),
    subscribed: false,
    messageLength: 20,
    minutesUntilOnline: 120,
    sexting,
  });
assert.equal(pacing(true).mode, "instant");
assert.equal(pacing(true).notBeforeMs, 0);
assert.notEqual(pacing(false).mode, "instant");

// The live paths.
const server = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/server/src/slp/${path}`);
assert.match(
  server("data/messages/slp-messages-storage-base.ts"),
  /session\.startedAt !== startedAt \|\| session\.pictureOffered === offered\) return false;/,
  "an old reply never overwrites a newer session",
);
assert.match(
  server("features/messages/slp-follow-up-scheduler-service.ts"),
  /if \(slurpSextingPhase\(thread\.sexting\) \|\| \(await slurpCreatorInScene/,
  "follow-ups wait out a session",
);
// A picture that never arrives gives the one PPV back.
assert.match(
  server("features/messages/slp-message-operation.ts"),
  /if \(drawn === "unavailable"\) await releaseSextingPicture\(\);/,
);
assert.match(
  server("features/messages/slp-message-operation.ts"),
  /\.catch\(async \(error: unknown\) => \{\n\s*await releaseSextingPicture\(\);\n\s*throw error;/,
);
assert.match(
  server("features/messages/slp-messages-creator-routes.ts"),
  /sexting: slurpSextingPhase\(thread\.sexting\) !== null,/,
  "the prompt debug view shows the session too",
);
const route = server("features/messages/slp-messages-send-routes.ts");
assert.match(
  route,
  /startSexting\(thread\.id, session\)[\s\S]{0,400}tipInThread\(viewer\.id, creator\.id, price, "Sexting session"/,
  "claimed before it is paid",
);
assert.match(
  route,
  /const requestId = parsed\.data\.requestId && `\$\{parsed\.data\.requestId\}:\$\{session\.startedAt\}`;/,
  "a stale id never pays for a new session",
);
assert.match(
  route,
  /if \(sent\.status !== "sent"\) \{\n\s*await messages\.cancelSexting\(thread\.id, session\.startedAt\)/,
);
assert.match(route, /creator\.sourceKind === "persona" \|\| isSlurpSupportThread\(thread\)/);
const operation = server("features/messages/slp-message-operation.ts");
assert.equal(operation.match(/sexting: sextingPhase !== null,/g)?.length, 3, "both pacing calls and the prompt");
// Her level, not a fake subscription: the viewer card and the stance keep the real `subscribed`.
assert.match(operation, /\n\s*subscribed,\n\s*sexting: sextingPhase !== null,\n\s*dmPolicy/);
assert.match(operation, /slurpSextingGuidance\(sextingPhase, sextingPicture\)/);
assert.match(
  operation,
  /const sextingPpv =\s*sextingPicture &&\s*!partner &&\s*!demanded &&\s*reply\.imageMode !== "hostile" &&\s*imageAllowedBySettings &&\s*\(await messagesStore\.markSextingPicture\(thread\.id, thread\.sexting!\.startedAt\)\);/,
  "claimed before the picture is drawn",
);
assert.match(operation, /price: slurpPpvPrice\(messaging\.ppvPrice\)/);

assert.match(server("features/messages/slp-messages-thread-routes.ts"), /sextingPrice:\n\s*side === "viewer"/);
assert.equal(
  server("features/messages/slp-messages-thread-routes.ts").match(/sextingPrice:/g)?.length,
  2,
  "the thread route and the compose route both price the session",
);
assert.match(server("data/messages/slp-messages-storage-helpers.ts"), /sexting: readSlurpSexting\(row\.sexting\)/);
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/messages/SlpThreadHeader.tsx"),
  /!ownsCreator && !asSupport && <SlpSextingBar model=\{model\} \/>/,
);

console.log("slurp2 sexting sessions: ok");
