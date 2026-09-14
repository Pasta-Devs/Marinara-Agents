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
// An omitted tags value may take an array alias; a malformed one is refused so the retry can fix it.
assert.deepEqual(parse({ ...base, gender: "other", themes: ["art", "music"] }), {
  gender: "other",
  tags: ["art", "music"],
});
const refuses = (value: unknown) =>
  slurpGeneratedDiscoveryProfileSchema.safeParse(normalizeNoodlerStageProfileDraft(value)).success === false;
assert.ok(refuses({ ...base, gender: "female", tags: "art, music" }), "a string tags value must be refused");
assert.ok(refuses({ ...base, gender: "female", tags: { first: "art" } }), "an object tags value must be refused");
assert.ok(
  refuses({ ...base, gender: "female", tags: "art", themes: ["art", "music"] }),
  "a malformed tags value must not be replaced by an alias",
);
// A value the schema does not allow is still refused, so the model's retry prompt stays useful.
assert.equal(
  slurpGeneratedDiscoveryProfileSchema.safeParse(normalizeNoodlerStageProfileDraft({ ...base, gender: "robot" }))
    .success,
  false,
);

// The prompt must ask for what the create step requires: a gender and at least three tags.
import("node:fs").then(({ readFileSync }) => {
  const service = readFileSync(
    new URL(
      "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-stage-profile-draft.service.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(service, /gender must be male, female, or other\./u);
  assert.doesNotMatch(service, /otherwise use null/u, "the prompt must not invite a null gender");
  assert.match(service, /three to eight relevant values/u);
  console.log("slurp2 draft discovery optional regression passed");
});
