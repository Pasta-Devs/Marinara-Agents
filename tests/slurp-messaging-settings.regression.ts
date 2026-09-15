// The Messaging settings tab. Each control has to reach the behaviour it names, or it is a knob
// that does nothing — which is how the Advanced toggle in the conversation overview ended up.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = "packages/slurp2/src/engine/packages";
const settingsStorage = readFileSync(`${root}/server/src/services/storage/slurp.storage.ts`, "utf8");
const messagesStorage = readFileSync(`${root}/server/src/services/storage/slurp-messages.storage.ts`, "utf8");
const scheduler = readFileSync(`${root}/server/src/services/slurp/slurp-message-scheduler.service.ts`, "utf8");
const operation = readFileSync(`${root}/server/src/services/slurp/slurp-message.operation.ts`, "utf8");
const messaging = readFileSync(`${root}/server/src/services/slurp/slurp-messaging.ts`, "utf8");
const view = readFileSync(`${root}/client/src/components/slurp/SlurpSettings.tsx`, "utf8");
const sections = readFileSync(`${root}/client/src/components/slurp/slurp-navigation.types.ts`, "utf8");
const locales = JSON.parse(readFileSync(`${root}/client/src/localization/locales/en.json`, "utf8")) as Record<
  string,
  string
>;

// Every setting is stored and defaulted.
for (const key of [
  "messagesAwayRepliesEnabled",
  "messagesReplyBubbleLimit",
  "messagesDefaultDmPolicy",
  "messagesDefaultRequestFee",
  "messagesDefaultPpvPrice",
]) {
  assert.ok(settingsStorage.includes(`${key}:`), `${key} is missing from the settings schema or its defaults`);
  assert.ok(view.includes(`settings.${key}`), `${key} has no control in the Messaging tab`);
}

// Away replies gate the background loop, and nothing else. A commission and the rest of a reply
// already sent are owed to the fan and still arrive.
assert.match(scheduler, /awayReplies \? await storage\.listThreadsAwaitingReply\(\) : \[\]/u);
assert.ok(
  scheduler.indexOf("deliverDueSlurpCommissions") < scheduler.indexOf("messagesAwayRepliesEnabled"),
  "commission delivery must not sit behind the away-replies switch",
);

// The burst limit reaches the splitter, and one means one message.
assert.match(operation, /const burstLimit = Math\.min\(settings\.messagesReplyBubbleLimit/u);
assert.match(operation, /burstLimit > 1 &&/u);

// The per-creator defaults come from settings rather than the shipped constant.
assert.match(messaging, /defaults: SlurpCreatorMessaging = SLURP_DEFAULT_CREATOR_MESSAGING/u);
assert.match(
  messagesStorage,
  /readSlurpCreatorMessaging\(\(await readMessagingBlob\(\)\)\[creatorAccountId\], await messagingDefaults\(\)\)/u,
);

// The tab is reachable and named.
assert.match(sections, /"messaging",/u);
assert.ok(locales["ui.slurp.settings.tabs.messaging"], "the Messaging tab has no label");
for (const key of Object.keys(locales).filter((key) => key.startsWith("ui.slurp.settings.messaging."))) {
  assert.ok(locales[key].trim(), `${key} is empty`);
}

console.log("slurp messaging settings regression passed");
