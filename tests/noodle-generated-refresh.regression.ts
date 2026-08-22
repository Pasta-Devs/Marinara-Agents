import assert from "node:assert/strict";
import {
  NOODLE_EMPTY_TIMELINE_REASON,
  parseNoodleGeneratedRefresh,
  parseNoodleGeneratedRefreshResponse,
  validateNoodleGeneratedRefresh,
} from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-generated-refresh";
import { parseNoodleGeneratedProfiles } from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-generated-profiles";
import { parseNoodleGeneratedProfiles as parseSlurpGeneratedProfiles } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-generated-profiles";
import { parseNoodleGeneratedRefreshResponse as parseSlurpGeneratedRefreshResponse } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-generated-refresh";

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

const slurpFlatActivity = parseSlurpGeneratedRefreshResponse(
  JSON.stringify([
    {
      tempId: "slurp-post-1",
      authorHandle: "@character",
      content: "A Slurp update.",
      poll: null,
      imagePrompt: null,
      attachGalleryImage: false,
    },
    { tempId: "invalid" },
  ]),
);
assert.equal(slurpFlatActivity.refresh.posts.length, 1);
assert.equal(slurpFlatActivity.refresh.posts[0]?.tempId, "slurp-post-1");
assert.equal(slurpFlatActivity.refresh.posts[0]?.authorHandle, "@character");
assert.equal(slurpFlatActivity.refresh.posts[0]?.content, "A Slurp update.");
assert.equal(slurpFlatActivity.rejected.length, 1);
assert.equal(slurpFlatActivity.rejected[0]?.collection, "posts");
assert.equal(slurpFlatActivity.rejected[0]?.index, 1);
assert.ok(slurpFlatActivity.rejected[0]?.issueCount);

const wrappedRefresh = parseNoodleGeneratedRefreshResponse(
  JSON.stringify([
    {
      posts: [
        {
          tempId: "post-1",
          authorHandle: "@character",
          content: "A short update.",
          poll: null,
          imagePrompt: null,
          attachGalleryImage: false,
        },
      ],
      interactions: [],
      follows: [],
      digests: [],
    },
  ]),
);
assert.equal(wrappedRefresh.refresh.posts.length, 1, "a wrapped refresh object must be unwrapped");
assert.equal(wrappedRefresh.rejected.length, 0);
assert.equal(wrappedRefresh.refresh.posts[0]?.authorHandle, "@character");
assert.equal(
  validateNoodleGeneratedRefresh(wrappedRefresh.refresh, new Set(["character"]), new Set(["character"])),
  null,
);

const invitedOnlyFixture = parseSlurpGeneratedRefreshResponse(
  JSON.stringify([
    {
      posts: [
        {
          tempId: "post_001",
          authorHandle: "@doctor_ratio",
          content: "The hypothesis still needs a rigorous proof.",
          poll: null,
          imagePrompt: null,
          attachGalleryImage: false,
        },
        {
          tempId: "post_002",
          authorHandle: "@dottore",
          content: "Experimentation will settle it sooner.",
          poll: null,
          imagePrompt: null,
          attachGalleryImage: false,
        },
      ],
      interactions: [{ type: "reply", targetTempId: "post_001" }],
      follows: [],
      digests: [],
    },
  ]),
);
assert.equal(invitedOnlyFixture.refresh.posts.length, 2, "wrapped valid posts must survive a malformed interaction");
assert.equal(invitedOnlyFixture.rejected.length, 1);
assert.equal(invitedOnlyFixture.rejected[0]?.collection, "interactions");
assert.equal(invitedOnlyFixture.rejected[0]?.index, 0);

// Over-long generated text is clipped to the field limit instead of losing the
// whole row, in the keyed-object form and in the top-level array form.
const overLongPost = {
  tempId: "post_003",
  authorHandle: "@dottore",
  content: "n".repeat(4600),
  poll: null,
  imagePrompt: null,
  attachGalleryImage: false,
};
const clippedObject = parseNoodleGeneratedRefresh({ posts: [overLongPost], interactions: [], follows: [] });
assert.equal(clippedObject.rejected.length, 0, "an over-long post must not be rejected");
assert.equal(clippedObject.refresh.posts.length, 1);
assert.equal(clippedObject.refresh.posts[0]?.content.length, 4000);

const clippedArray = parseNoodleGeneratedRefresh([
  overLongPost,
  { actorHandle: "@dottore", type: "reply", targetTempId: "post_003", content: "r".repeat(2600) },
]);
assert.equal(clippedArray.rejected.length, 0, "an over-long array row must not be rejected");
assert.equal(clippedArray.refresh.posts[0]?.content.length, 4000);
assert.equal(clippedArray.refresh.interactions[0]?.content?.length, 2000);

console.log("Noodle generated refresh regressions passed.");
