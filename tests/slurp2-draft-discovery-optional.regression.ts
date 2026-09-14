import assert from "node:assert/strict";
import { slurpGeneratedDiscoveryProfileSchema } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-discovery-profile.ts";
import { normalizeNoodlerStageProfileDraft } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-stage-profile-normalize.ts";

// Gender and tags are optional on a Creator. An AI draft that leaves them out used to fail the
// discovery schema, and the retry failed the same way, so the whole draft errored.
const base = { displayName: "Vera Vale", handle: "veravale", bio: "Painter.", stagePersonality: "Warm." };
const parse = (value: unknown) => slurpGeneratedDiscoveryProfileSchema.parse(normalizeNoodlerStageProfileDraft(value));

assert.deepEqual(parse(base), { gender: null, tags: [] }, "a draft without gender or tags must parse");
assert.deepEqual(parse({ ...base, tags: ["art"] }), { gender: null, tags: ["art"] });
assert.deepEqual(parse({ ...base, gender: "female" }), { gender: "female", tags: [] });
assert.deepEqual(parse({ ...base, gender: "", tags: null }), { gender: null, tags: [] });
assert.deepEqual(parse({ ...base, gender: "male", tags: ["art", "music"] }), {
  gender: "male",
  tags: ["art", "music"],
});
// A value the schema does not allow is still refused, so the model's retry prompt stays useful.
assert.equal(
  slurpGeneratedDiscoveryProfileSchema.safeParse(normalizeNoodlerStageProfileDraft({ ...base, gender: "robot" }))
    .success,
  false,
);

console.log("slurp2 draft discovery optional regression passed");
