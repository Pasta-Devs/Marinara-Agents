import assert from "node:assert/strict";
import {
  normalizeSlurpSharedIdeas,
  normalizeSlurpSharedWorldEvent,
  SLURP_SHARED_IDEA_DAILY_CAP,
  slurpTopicalTags,
  slurpUsableSharedIdeas,
  type SlurpSharedIdea,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-shared-preseed.ts";
import {
  selectSlurpBeat,
  type SlurpCanonAnchors,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-beat.ts";

// Only templates the selector can make personal survive: a known type and anchor kind, one {a}.
const ideas = normalizeSlurpSharedIdeas(
  {
    ideas: [
      { type: "sensory_mood", anchorKind: "places", template: "The first autumn storm starts while you are at {a}." },
      { type: "showcase", anchorKind: "work", template: "No slot here." },
      { type: "showcase", anchorKind: "work", template: "{a} and {a} twice." },
      { type: "not-a-type", anchorKind: "work", template: "You show {a}." },
      { type: "showcase", anchorKind: "friends", template: "You show {a}." },
      { type: "callback", anchorKind: "work", template: "Back to {a} from last week." },
    ],
  },
  "world",
  "world:2026-09-25",
);
assert.equal(ideas.length, 1, "only the storm template survives");
for (const idea of ideas) {
  assert.equal(idea.template.split("{a}").length, 2);
  assert.match(idea.id, /^world:2026-09-25:\d$/u);
}

// An event needs a name and guidance; its length is kept to one week.
assert.deepEqual(
  normalizeSlurpSharedWorldEvent({ event: { name: "Cozy week", guidance: "Post warm things.", days: 30 } }),
  {
    name: "Cozy week",
    guidance: "Post warm things.",
    days: 7,
  },
);
assert.equal(normalizeSlurpSharedWorldEvent({ event: null }), null);

// Mood and adult tags are not topics; custom tags are.
assert.deepEqual(
  slurpTopicalTags(
    ["Cosplay", "flirty", "lingerie", "Baking"],
    [
      { tag: "cosplay", group: "themes" },
      { tag: "flirty", group: "vibe" },
      { tag: "lingerie", group: "adult" },
    ],
  ),
  ["cosplay", "baking"],
);

// The daily cap removes an idea once enough Creators used it today.
const idea = (id: string, overrides: Partial<SlurpSharedIdea> = {}): SlurpSharedIdea => ({
  id,
  type: "showcase",
  anchorKind: "places",
  template: "Everyone on Slurp shows their favourite corner of {a} today.",
  source: "world",
  ...overrides,
});
const usable = slurpUsableSharedIdeas({
  world: [idea("w:0"), idea("w:1")],
  niche: { cosplay: [idea("n:0", { source: "niche" })], fitness: [idea("n:1", { source: "niche" })] },
  topics: ["cosplay"],
  usedToday: { "w:1": SLURP_SHARED_IDEA_DAILY_CAP },
});
assert.deepEqual(
  usable.map((entry) => entry.id),
  ["w:0", "n:0"],
  "capped world idea and other topics are out",
);

// A shared idea becomes this Creator's moment: its slot takes their own anchor, and the beat
// remembers the idea for the cap.
const anchors: SlurpCanonAnchors = {
  people: [],
  places: ["the bar"],
  work: [],
  objects: [],
  habits: [],
  runningJokes: [],
  palette: { showcase: 5 },
  heat: { min: 0, max: 1 },
};
const history = { recentOwn: [], recentAnchors: [], globalCounts: {} };
let sharedBeats = 0;
for (let sequence = 0; sequence < 60; sequence += 1) {
  const beat = selectSlurpBeat("creator-x", sequence, anchors, history, ["casual"], [idea("w:0")]);
  if (beat?.sharedId) {
    sharedBeats += 1;
    assert.equal(beat.sharedId, "w:0");
    assert.equal(beat.line, "Everyone on Slurp shows their favourite corner of the bar today.");
  }
}
assert.ok(sharedBeats > 0, "shared ideas are actually drawn");
// Without shared ideas the draw is exactly what it was before level 1.
assert.deepEqual(
  selectSlurpBeat("creator-x", 3, anchors, history, ["casual"]),
  selectSlurpBeat("creator-x", 3, anchors, history, ["casual"], []),
);

console.log("slurp2 shared preseed regression checks passed");
