// A mood that only changes word choice is a number. A mood that changes how fast somebody answers,
// and how many messages they send, is a person.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  slurpReplyPacing,
  slurpReplyBubbleDelayMs,
  splitSlurpReplyBurst,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-messaging.js";
import { scoreSlurpRapport } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-rapport.js";

const rapport = (score: number) => ({ score, tier: "regular" as const, contributions: [] });
const pace = (mood: number, online = true) =>
  slurpReplyPacing({
    online,
    rapport: rapport(40),
    subscribed: false,
    messageLength: 100,
    minutesUntilOnline: 60,
    mood,
  });

// Being kept waiting is how annoyance reads in a chat, long before the words arrive.
assert.ok(pace(-80).typingMs > pace(0).typingMs, "a bad mood must slow the reply");
assert.ok(pace(80).typingMs < pace(0).typingMs, "a good mood must speed it up");
assert.ok(pace(-80, false).notBeforeMs > pace(0, false).notBeforeMs, "a bad mood must lengthen the queue");

// A warm conversation reaches further into the off hours. A cold one does not get a midnight reply.
const offHours = (mood: number) =>
  slurpReplyPacing({
    online: false,
    rapport: rapport(50),
    subscribed: true,
    messageLength: 100,
    minutesUntilOnline: 300,
    mood,
  });
assert.equal(offHours(60).mode, "delayed");
assert.equal(offHours(-90).mode, "delayed");
assert.ok(offHours(-90).notBeforeMs > offHours(60).notBeforeMs);

// Omitting the mood must behave exactly as before it existed.
const withoutMood = slurpReplyPacing({
  online: true,
  rapport: rapport(40),
  subscribed: false,
  messageLength: 100,
  minutesUntilOnline: 60,
});
assert.equal(withoutMood.typingMs, pace(0).typingMs);

// Real rapport objects still flow through unchanged.
assert.ok(
  slurpReplyPacing({
    online: true,
    rapport: scoreSlurpRapport({
      subscribed: true,
      subscribedDays: 30,
      lapsed: false,
      tippedCoins: 50,
      unlockedCoins: 0,
      commissionsDelivered: 0,
      viewerMessages: 10,
      creatorMessages: 8,
      averageViewerMessageLength: 80,
      daysSinceViewerMessage: 1,
    }),
    subscribed: true,
    messageLength: 100,
    minutesUntilOnline: null,
    mood: 0,
  }).typingMs > 0,
);

// Nobody texts in paragraphs when they are enjoying themselves.
const long =
  "that is so kind of you. i genuinely did not expect anyone to notice that detail. it made my whole week honestly.";
assert.ok(splitSlurpReplyBurst(long, true).length > 1, "a warm reply must arrive as a burst");
assert.equal(splitSlurpReplyBurst(long, true).join(" "), long, "no words may be lost in the split");
assert.ok(splitSlurpReplyBurst(long, true).length <= 3, "a burst is two or three messages, not a stream");

// Somebody being short with you does not send three messages. The shape carries the mood.
assert.deepEqual(splitSlurpReplyBurst(long, false), [long]);
// Nothing short is ever split, whatever the mood.
assert.deepEqual(splitSlurpReplyBurst("sure", true), ["sure"]);
// One long sentence stays one message rather than being cut mid-clause.
const oneSentence =
  "i have been thinking about what you said all afternoon and i still do not really know how to answer it properly";
assert.deepEqual(splitSlurpReplyBurst(oneSentence, true), [oneSentence]);

// Later bubbles have fixed, bounded delays that can be persisted as absolute due times.
const firstDelay = slurpReplyBubbleDelayMs({ bubbleIndex: 1, bubbleCount: 3, nextBubble: "one more thing" });
const secondDelay = slurpReplyBubbleDelayMs({
  bubbleIndex: 2,
  bubbleCount: 3,
  nextBubble: "and this is the last part",
});
assert.ok(firstDelay >= 500 && secondDelay >= 500, "bubble delays must be positive");
assert.ok(firstDelay <= 30_000 && secondDelay <= 30_000, "bubble delays must stay bounded");

const operation = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-message.operation.ts",
  "utf8",
);
// The mood the pacing reads is healed first, so a fan is not kept waiting over an old argument.
assert.match(operation, /currentMood = recoverSlurpMood\([\s\S]*?mood: currentMood,/u);
// Only a conversation going well bursts.
assert.match(operation, /reply\.latitude === "normal"[\s\S]{0,80}?reply\.moodShift !== "down"/u);

// Being rude in public counts as much as being rude in private. A creator who forgave in the
// comments what she would not forgive in a DM would not read as one person.
const commentReply = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-reply-generation.service.ts",
  "utf8",
);
assert.match(commentReply, /moodShift: generated\.moodShift/u);
assert.match(commentReply, /noodleResponseFormat\(input\.connection\.model, "noodler_dm"\)/u);
assert.doesNotMatch(commentReply, /noodleGeneratedNoodlerReplySchema/u);

const creatorReply = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-creator-reply.operation.ts",
  "utf8",
);
assert.match(creatorReply, /applyExternalMoodShift\(claim\.viewer\.id, claim\.creator\.id, moodShift\)/u);
// Never at the price of the reply, which is already written by then.
assert.match(creatorReply, /applyExternalMoodShift[\s\S]{0,120}?\.catch\(/u);

// A generated audience member's feelings are not a relationship the player has.
const audienceReply = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-audience-reply.operation.ts",
  "utf8",
);
assert.doesNotMatch(audienceReply, /applyExternalMoodShift/u);

const storage = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/storage/slurp-messages.storage.ts",
  "utf8",
);
// An ordinary comment must not cost a storage write on every reply in the world.
assert.match(storage, /if \(shift === "same"\) return;/u);

console.log("slurp felt mood regression passed");
