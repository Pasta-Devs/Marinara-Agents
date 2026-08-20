import assert from "node:assert/strict";
import {
  isEmptyNoodleGeneratedRefreshResponse,
  parseNoodleGeneratedRefreshResponse,
  validateNoodleGeneratedRefresh,
} from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-generated-refresh";
import { parseNoodleGeneratedProfiles } from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-generated-profiles";
import { parseNoodleGeneratedProfiles as parseSlurpGeneratedProfiles } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-generated-profiles";
import {
  isEmptyNoodleGeneratedRefreshResponse as isEmptySlurpGeneratedRefreshResponse,
  validateNoodleGeneratedRefresh as validateSlurpGeneratedRefresh,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-generated-refresh";

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
assert.deepEqual(parseSlurpGeneratedProfiles({ profiles: [{ entityId: "invalid" }] }).rejected, [
  { index: 0, issueCount: 4 },
]);
assert.throws(() => parseSlurpGeneratedProfiles({ profiles: null }));
assert.throws(() => parseNoodleGeneratedProfiles({ profiles: null }));
assert.throws(() => parseNoodleGeneratedProfiles([{ profiles: null }]));
assert.deepEqual(parseNoodleGeneratedProfiles({ profiles: [{ entityId: "invalid" }] }).rejected, [
  { index: 0, issueCount: 4 },
]);
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

assert.equal(isEmptyNoodleGeneratedRefreshResponse("[]"), true);
assert.equal(isEmptyNoodleGeneratedRefreshResponse("[\n]"), true);
assert.equal(isEmptyNoodleGeneratedRefreshResponse("[null]"), false);
assert.equal(isEmptySlurpGeneratedRefreshResponse("[]"), true);
assert.equal(isEmptySlurpGeneratedRefreshResponse("[\n]"), true);
assert.equal(isEmptySlurpGeneratedRefreshResponse("[null]"), false);
assert.throws(() => parseNoodleGeneratedProfiles({ profiles: null }));
assert.throws(() => parseNoodleGeneratedProfiles([{ profiles: null }]));
assert.deepEqual(parseNoodleGeneratedProfiles({ profiles: [{ entityId: "invalid" }] }).rejected, [
  { index: 0, issueCount: 4 },
]);
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

assert.deepEqual(parseNoodleGeneratedRefreshResponse("[]"), {
  refresh: { posts: [], interactions: [], follows: [], digests: [] },
  rejected: [],
});
assert.equal(
  validateNoodleGeneratedRefresh({ posts: [], interactions: [], follows: [], digests: [] }, new Set(), new Set(), true),
  null,
);

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
assert.equal(
  validateSlurpGeneratedRefresh({ posts: [], interactions: [], follows: [], digests: [] }, new Set(), new Set(), true),
  null,
);

console.log("Noodle generated refresh regressions passed.");
