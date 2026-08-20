import assert from "node:assert/strict";
import {
  NOODLE_EMPTY_TIMELINE_REASON,
  parseNoodleGeneratedRefreshResponse,
  validateNoodleGeneratedRefresh,
} from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-generated-refresh";
import { parseNoodleGeneratedProfiles } from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-generated-profiles";
import { parseNoodleGeneratedProfiles as parseSlurpGeneratedProfiles } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-generated-profiles";

assert.deepEqual(parseNoodleGeneratedProfiles([]), { profiles: [], rejected: [] });
assert.deepEqual(
  parseNoodleGeneratedProfiles({
    profiles: [
      {
        entityId: "character-2",
        name: "Lygus",
        handle: "lygus",
        bio: "A spectator.",
        location: "The Exomyth",
      },
    ],
  }),
  {
    profiles: [
      {
        entityId: "character-2",
        name: "Lygus",
        handle: "lygus",
        bio: "A spectator.",
        location: "The Exomyth",
      },
    ],
    rejected: [],
  },
);
assert.deepEqual(parseNoodleGeneratedProfiles([{ profiles: [] }]), { profiles: [], rejected: [] });
const slurpProfile = {
  entityId: "slurp-character-1",
  name: "Lygus",
  handle: "lygus",
  bio: "A spectator.",
  location: "The Exomyth",
};
assert.deepEqual(parseSlurpGeneratedProfiles({ profiles: [slurpProfile] }), {
  profiles: [slurpProfile],
  rejected: [],
});
assert.deepEqual(parseSlurpGeneratedProfiles([{ profiles: [slurpProfile] }]), {
  profiles: [slurpProfile],
  rejected: [],
});
assert.deepEqual(parseSlurpGeneratedProfiles([slurpProfile]), {
  profiles: [slurpProfile],
  rejected: [],
});
assert.deepEqual(parseSlurpGeneratedProfiles({ profiles: [] }), { profiles: [], rejected: [] });
assert.deepEqual(parseSlurpGeneratedProfiles([{ profiles: [] }]), { profiles: [], rejected: [] });
assert.deepEqual(parseSlurpGeneratedProfiles([]), { profiles: [], rejected: [] });
assert.ok(parseSlurpGeneratedProfiles({ profiles: [{ entityId: "invalid" }] }).rejected[0]?.issueCount);
assert.throws(() => parseSlurpGeneratedProfiles({ profiles: null }));
assert.throws(() => parseNoodleGeneratedProfiles({ profiles: null }));
assert.throws(() => parseNoodleGeneratedProfiles([{ profiles: null }]));
assert.ok(parseNoodleGeneratedProfiles({ profiles: [{ entityId: "invalid" }] }).rejected[0]?.issueCount);
assert.deepEqual(
  parseNoodleGeneratedProfiles([
    {
      entityId: "character-1",
      name: "Dottore",
      handle: "dottore",
      bio: "A scholar of progress.",
      location: "Snezhnaya",
    },
  ]),
  {
    profiles: [
      {
        entityId: "character-1",
        name: "Dottore",
        handle: "dottore",
        bio: "A scholar of progress.",
        location: "Snezhnaya",
      },
    ],
    rejected: [],
  },
);

for (const emptyResponse of ["[]", "[\n]", '{"posts":[],"interactions":[],"follows":[]}']) {
  const empty = parseNoodleGeneratedRefreshResponse(emptyResponse);
  assert.deepEqual(empty.refresh, { posts: [], interactions: [], follows: [], digests: [] });
  assert.equal(validateNoodleGeneratedRefresh(empty.refresh, new Set(), new Set()), NOODLE_EMPTY_TIMELINE_REASON);
}

const parsed = parseNoodleGeneratedRefreshResponse(
  JSON.stringify([
    {
      tempId: "post-1",
      authorHandle: "character",
      content: "A short update.",
      imagePrompt: null,
      attachGalleryImage: false,
      poll: null,
    },
  ]),
);
assert.equal(parsed.refresh.posts.length, 1);
assert.equal(parsed.refresh.posts[0]?.authorHandle, "character");
assert.equal(validateNoodleGeneratedRefresh(parsed.refresh, new Set(["character"]), new Set(["character"])), null);

console.log("Noodle generated refresh regressions passed.");
