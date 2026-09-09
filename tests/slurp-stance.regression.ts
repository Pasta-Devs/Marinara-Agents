// One resolved position, not one prompt line per signal. Nine lines describing the same person is
// a contradiction, and a model resolves a contradiction by averaging it away.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  activeSlurpStrikes,
  resolveSlurpStance,
  SLURP_STRIKE_WINDOW_DAYS,
  type SlurpStanceInput,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-stance.js";
import {
  slurpDayVibe,
  slurpDayVibeDescription,
  slurpDayVibeFacts,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-day-vibe.js";

const base: SlurpStanceInput = {
  rapportTier: "regular",
  rapportScore: 40,
  moodTone: "neutral",
  audienceArc: null,
  dayVibe: null,
  availability: { online: true, activity: null },
  subscribed: false,
  isRequest: false,
  tone: "unfiltered",
  coolingOff: false,
  strikes: 0,
};
const stance = (patch: Partial<SlurpStanceInput> = {}) => resolveSlurpStance({ ...base, ...patch });

// Rule 1. A boundary wins outright, whatever the relationship says.
const cooling = stance({ coolingOff: true, rapportTier: "whale", rapportScore: 100, moodTone: "warm" });
assert.equal(cooling.latitude, "cool_off");
assert.equal(cooling.warmth, "cold");

// Rule 4. Rapport floors a fall without granting immunity. "You, of all people" beats forgiveness.
assert.equal(stance({ moodTone: "cold", rapportTier: "stranger" }).warmth, "cold");
assert.equal(stance({ moodTone: "cold", rapportTier: "whale" }).warmth, "guarded");
// A whale is still not answered warmly while the conversation is going badly.
assert.notEqual(stance({ moodTone: "cold", rapportTier: "whale" }).warmth, "warm");

// Rule 2. On an ordinary mood the relationship decides.
assert.equal(stance({ moodTone: "neutral", rapportTier: "stranger" }).warmth, "guarded");
assert.equal(stance({ moodTone: "neutral", rapportTier: "whale" }).warmth, "close");

// Rule 3. The day colours, it never decides.
const badDay = stance({ dayVibe: "Today has been quiet.", moodTone: "neutral", rapportTier: "favourite" });
assert.equal(badDay.warmth, "close", "a bad day must not chill a good relationship");
assert.ok(badDay.instructions.some((line) => line.includes("Let it show in how you write")));

// Rule 5. Being busy shortens a reply. It does not chill it.
const away = stance({ availability: { online: false, activity: "at the gym" }, rapportTier: "favourite" });
assert.equal(away.warmth, "close");
assert.ok(away.instructions.some((line) => line.includes("keep it short")));

// The tone dial caps what is reachable, reusing the setting that already defaults to the middle.
// `slurp-tone.ts` ships that default because "a hostile default would ambush somebody".
assert.equal(stance({ moodTone: "cold", tone: "warm" }).latitude, "normal");
assert.equal(stance({ moodTone: "cool", tone: "warm" }).latitude, "normal");
assert.equal(stance({ moodTone: "cold", tone: "mixed" }).latitude, "curt");
assert.equal(stance({ moodTone: "cold", tone: "unfiltered" }).latitude, "cool_off");
// Two strikes closes it. One bad afternoon does not.
assert.equal(stance({ moodTone: "cold", tone: "unfiltered", strikes: 1 }).latitude, "close");
assert.equal(stance({ moodTone: "cold", tone: "mixed", strikes: 9 }).latitude, "curt", "the dial caps closing too");

// Every decision names the layer that caused it, so the debug panel never has to guess.
assert.ok(stance().evidence.some((entry) => entry.layer === "rapport"));
assert.ok(stance().evidence.some((entry) => entry.layer === "mood"));
assert.ok(stance().evidence.some((entry) => entry.layer === "tone dial"));

// A served strike stops counting once its window has passed.
const day = 86_400_000;
const at = new Date("2026-09-08T00:00:00.000Z");
assert.equal(activeSlurpStrikes(1, new Date(at.getTime() - day).toISOString(), at), 1);
assert.equal(activeSlurpStrikes(1, new Date(at.getTime() - (SLURP_STRIKE_WINDOW_DAYS + 1) * day).toISOString(), at), 0);
assert.equal(activeSlurpStrikes(3, null, at), 0);

// The day vibe reads state and never rolls dice, for the reason `slurp-audience-arc.ts` gives.
assert.equal(slurpDayVibe({ earnedToday: 0, averageDaily: 0, daysSinceLastPost: 30 }), "flat");
assert.equal(slurpDayVibe({ earnedToday: 200, averageDaily: 50, daysSinceLastPost: 1 }), "good");
assert.equal(slurpDayVibe({ earnedToday: 1, averageDaily: 50, daysSinceLastPost: 1 }), "quiet");
assert.equal(slurpDayVibe({ earnedToday: 50, averageDaily: 50, daysSinceLastPost: 1 }), "ordinary");
// Compared against this creator's own average, never a shared threshold. A small creator having a
// normal week must not be told they are failing.
assert.equal(slurpDayVibe({ earnedToday: 8, averageDaily: 4, daysSinceLastPost: 1 }), "good");
assert.equal(slurpDayVibe({ earnedToday: 0, averageDaily: 0, daysSinceLastPost: 1 }), "ordinary");
assert.equal(slurpDayVibeDescription("ordinary"), null, "an ordinary day is not news");

const facts = slurpDayVibeFacts(
  {
    coins: 0,
    lifetime: 0,
    ledger: [
      { kind: "tip", amount: 30, at: "2026-09-08T09:00:00.000Z" },
      { kind: "tip", amount: 10, at: "2026-09-07T09:00:00.000Z" },
      { kind: "tip", amount: -5, at: "2026-09-07T10:00:00.000Z" },
    ],
    payoutOn: null,
  } as Parameters<typeof slurpDayVibeFacts>[0],
  "2026-09-07T09:00:00.000Z",
  new Date("2026-09-08T12:00:00.000Z"),
);
assert.equal(facts.earnedToday, 30);
assert.equal(facts.averageDaily, 10, "payouts and reversals are not earnings");
assert.equal(facts.daysSinceLastPost, 1);

// The debug view runs the real builder. A reconstruction drifts and then reports a prompt the
// model never received.
const routes = readFileSync("packages/slurp/src/engine/packages/server/src/routes/slurp-messages.routes.ts", "utf8");
assert.match(routes, /buildSlurpMessagePrompt\(\{/u);
assert.match(routes, /if \(!isDebugAgentsEnabled\(\)\) return reply\.code\(404\)/u);
// The prompt returned is the built one, which `buildSlurpMessagePrompt` has already redacted.
// There is no second, unredacted path: that door would undo the concealed-identity rules.
assert.match(routes, /prompt: built\.messages/u);
assert.doesNotMatch(routes, /disclosureMode: "public"|skipProtect|protect: false/u);

// A boundary outranks everything, and it is checked before any generation is paid for.
const operation = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-message.operation.ts",
  "utf8",
);
assert.match(operation, /status: "cooling"/u);
assert.match(operation, /thread\.coolUntil && thread\.coolUntil > new Date\(\)\.toISOString\(\)/u);
// The words the creator left them with are written before the door closes.
assert.match(operation, /recordReplyOutcome[\s\S]{0,1200}?applyBoundary/u);

console.log("slurp stance regression passed");
