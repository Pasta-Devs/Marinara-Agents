import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { splitSlurpReplyBurst } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-messaging";
import {
  slurpDayVibe,
  slurpDayVibeFacts,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/slp-day-vibe";

// Plane sweep (4c): one section per Plane issue fixed on this branch. Source pins where the module
// imports the Engine logger or database, behaviour checks where the module is pure.
const pkg = (path: string) =>
  readFileSync(join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages", path), "utf8");
const en = JSON.parse(pkg("client/src/slp/locales/en.json")) as Record<string, string>;

// ── Plane 130: "Messages per reply" is an upper limit, and its top value applies ──
assert.match(en["ui.slurp.settings.messaging.bubbleLimit"] ?? "", /^Up to /u, "the label names a maximum");
assert.match(en["ui.slurp.settings.messaging.bubbleLimitDetail"] ?? "", /can use fewer/u);
const messageOperation = pkg("server/src/slp/features/messages/slp-message-operation.ts");
assert.doesNotMatch(
  messageOperation,
  /energy >= 70 \? 3 : 2/u,
  "a fixed 3 made the stepper's 4 a value that never applied",
);
const longReply = Array.from({ length: 8 }, (_, index) => `This is sentence number ${index + 1} of the reply.`).join(
  " ",
);
assert.equal(splitSlurpReplyBurst(longReply, true, 4).length, 4, "a limit of 4 can send four messages");
assert.equal(splitSlurpReplyBurst(longReply, true, 1).length <= 2, true);

// ── Plane 220 (+ 221): "Refresh now" works with the scheduled audience switched off ──
const fanOperation = pkg("server/src/slp/features/audience/slp-fan-activity-operation.ts");
const runBody = fanOperation.slice(fanOperation.indexOf("export async function runCreatorFanActivity("));
assert.match(
  runBody,
  /const settings = fanActivitySettingsFor\(await noodle\.getSettings\(\), input\.mode === "manual"\);/u,
  "a manual run reads the switch as on",
);
assert.ok(
  runBody.indexOf("fanActivitySettingsFor(") < runBody.indexOf('return { status: "disabled"'),
  "the disabled early return sees the manual settings",
);
assert.match(fanOperation, /return manual \? \{ \.\.\.settings, fanActivityEnabled: true \} : settings;/u);
assert.match(fanOperation, /const effective = fanActivitySettingsFor\(settings, manual\);/u);
assert.match(fanOperation, /resolveCreatorFanActivityPolicy\(effective, creator\)\.enabled/u);
assert.match(fanOperation, /id: activity\.id,\s+manual,/u, "the storage write knows the run was manual");
assert.match(
  pkg("server/src/slp/data/feed/slp-feed-interaction-storage-3.ts"),
  /if \(\(!settings\.fanActivityEnabled && !input\.manual\) \|\| override\?\.enabled === false\) return null;/u,
  "a Creator switched off on their own page stays off, even for a manual run",
);
assert.doesNotMatch(
  pkg("client/src/slp/features/audience/SlpAudiencePanel.tsx"),
  /disabled=\{refreshFans\.isPending \|\| !settings\.fanActivityEnabled\}/u,
  "Refresh now is not greyed out by the schedule switch",
);
assert.match(en["ui.slurp.settings.audience.enabledDetail"] ?? "", /Refresh now still/u);

// ── Plane 236: the Creator Overview names the storyline that is running, not only a count ──
const overview = pkg("client/src/slp/features/creators/settings/SlpCreatorOverviewSection.tsx");
assert.match(overview, /const runningProjects = projects\.filter\(\(project\) => project\.status === "active"\);/u);
assert.match(overview, /runningProjects\.map\(\(project\) => \(\s*<p key=\{project\.id\}[^>]*>\s*\{project\.title\}/u);

// ── Plane 300: a creator's day is not "quiet" just because the UTC day has only begun ──
// The vibe is cached from the first reply after UTC midnight; a calendar window scored that moment
// as "nothing came in" and the creator kept that mood all day.
{
  const ledger = [
    { kind: "tip", amount: 40, at: "2026-09-26T20:00:00.000Z" },
    { kind: "tip", amount: 40, at: "2026-09-25T20:00:00.000Z" },
    { kind: "tip", amount: 40, at: "2026-09-24T20:00:00.000Z" },
  ];
  const earnings = { coins: 0, lifetime: 120, ledger, payoutOn: null } as unknown as Parameters<
    typeof slurpDayVibeFacts
  >[0];
  const justAfterMidnight = slurpDayVibeFacts(
    earnings,
    "2026-09-26T19:00:00.000Z",
    new Date("2026-09-27T00:30:00.000Z"),
  );
  assert.equal(justAfterMidnight.earnedToday, 40, "last night's tip still counts at 00:30");
  assert.equal(justAfterMidnight.averageDaily, 40);
  assert.equal(slurpDayVibe(justAfterMidnight), "ordinary", "a normal day reads as ordinary, not quiet");
  const quiet = slurpDayVibeFacts(earnings, "2026-09-26T19:00:00.000Z", new Date("2026-09-27T21:00:00.000Z"));
  assert.equal(quiet.earnedToday, 0);
  assert.equal(slurpDayVibe(quiet), "quiet", "a real 24 hours with nothing is still quiet");
}

// ── Plane 326 (part): a DM reply knows who the player persona is ──
// The fan's public profile (a persona's About me or card description) reaches the DM prompt,
// capped, and only for a player persona: a generated fan or invited character already has a voice.
assert.match(
  pkg("server/src/slp/features/messages/slp-message-generation-service.ts"),
  /\.\.\.\(!input\.fanVoice && input\.viewer\.bio\?\.trim\(\)\s*\? \{ about: protect\(input\.viewer\.bio\)\.slice\(0, SLURP_FAN_VOICE_PROMPT_MAX\) \}\s*: \{\}\),/u,
);
