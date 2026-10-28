import assert from "node:assert/strict";
import {
  clampSlurpDraftText,
  repairSlurpStageProfileDraft,
  SLURP_STAGE_PROFILE_LIMITS,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-stage-profile-repair.ts";
import { slurp2Source } from "./slurp2-source";

const allowed = ["flirty", "playful", "dominant", "lingerie", "roleplay", "art"];
const base = { displayName: "Vee Velvet", handle: "@vee velvet", bio: "Hi.", stagePersonality: "Warm." };

// The reported answer: every field present, one tag outside the list. It must repair, not fail.
const reported = repairSlurpStageProfileDraft(
  { ...base, gender: "female", tags: ["flirty", "playful", "dominant", "lingerie", "roleplay", "teasing"] },
  allowed,
);
assert.ok(reported);
assert.deepEqual(reported.draft.tags, ["flirty", "playful", "dominant", "lingerie", "roleplay"]);
assert.equal(reported.draft.gender, "female");
assert.equal(reported.draft.handle, "vee_velvet", "a leading @ and spaces are cleaned");
assert.ok(reported.notes.some((note) => /not in your tag list/u.test(note)));

// Over-long text is shortened at a sentence, and the user is told.
const long = "This is a sentence that goes on. ".repeat(60);
const shortened = repairSlurpStageProfileDraft(
  { ...base, stagePersonality: long, gender: "f", tags: allowed },
  allowed,
);
assert.ok(shortened);
assert.ok(shortened.draft.stagePersonality.length <= SLURP_STAGE_PROFILE_LIMITS.stagePersonality);
assert.ok(shortened.draft.stagePersonality.endsWith("."), "the cut lands on a sentence end");
assert.ok(shortened.notes.some((note) => /Stage personality was shortened/u.test(note)));
assert.equal(clampSlurpDraftText("short", 10), "short");
assert.equal(clampSlurpDraftText("a".repeat(20), 10).length, 10);

// Gender spellings and tag strings are understood; nothing usable stays a note, not an error.
assert.equal(repairSlurpStageProfileDraft({ ...base, gender: "Woman" }, allowed)?.draft.gender, "female");
assert.equal(repairSlurpStageProfileDraft({ ...base, gender: "non-binary" }, allowed)?.draft.gender, "other");
const unknown = repairSlurpStageProfileDraft({ ...base, gender: "robot", tags: "flirty, art; playful" }, allowed);
assert.ok(unknown);
assert.equal(unknown.draft.gender, null);
assert.deepEqual(unknown.draft.tags, ["flirty", "art", "playful"]);
assert.ok(unknown.notes.includes("Pick a gender before saving."));
const bare = repairSlurpStageProfileDraft({ displayName: "Nine" }, allowed);
assert.ok(bare);
assert.equal(bare.draft.handle, "nine");
assert.ok(bare.notes.some((note) => /at least 3 tags/u.test(note)));

// Only an answer with no object or no name is unusable.
assert.equal(repairSlurpStageProfileDraft("Sure, here is a profile", allowed), null);
assert.equal(repairSlurpStageProfileDraft({ bio: "no name" }, allowed), null);

// Wiring: the service repairs with jsonrepair as a last resort, and the bulk route strips form-only keys.
const root = "packages/slurp2/src/engine/packages/server/src/";
const service = slurp2Source(`${root}services/slurp/slurp-stage-profile-draft.service.ts`);
assert.match(service, /jsonrepair\(/u);
assert.match(service, /Length limits: displayName at most/u);
const routes = slurp2Source(`${root}routes/slurp.routes.ts`);
assert.match(routes, /sourceSnapshot: _draftSnapshot,[\s\S]*?\.\.\.generatedProfile/u);
assert.match(routes, /safeParse\(\{ stageProfile: generatedProfile \}\)/u);

console.log("slurp2 stage profile repair regression passed");
