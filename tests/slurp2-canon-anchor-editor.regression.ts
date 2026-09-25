import assert from "node:assert/strict";
import {
  slpCanonAnchorDraft,
  slpCanonAnchorsFromDraft,
  type SlpCanonAnchors,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/creators/slp-canon-anchor-text.ts";

const anchors: SlpCanonAnchors = {
  people: [
    { name: "Cloud", relation: "old friend" },
    { name: "Mary-Jane", relation: "" },
  ],
  places: ["the bar"],
  work: ["running the bar"],
  objects: [],
  habits: ["late-night cleanup"],
  runningJokes: [],
  palette: { showcase: 4 },
  heat: { min: 1, max: 2 },
  routine: [{ time: "18:00", activity: "opening the bar" }],
};

// Editing without changes gives back the same anchors, palette kept.
const draft = slpCanonAnchorDraft(anchors);
assert.equal(draft.people, "Cloud — old friend\nMary-Jane");
assert.deepEqual(slpCanonAnchorsFromDraft(draft, anchors.palette), anchors);

// Blank lines and routine lines without a time drop out; heat stays within 0-3 and min <= max.
const edited = slpCanonAnchorsFromDraft(
  { ...draft, places: "the bar\n\n  the rooftop  ", routine: "08:00 coffee\nlate shift", heatMin: 3, heatMax: 1 },
  {},
);
assert.deepEqual(edited.places, ["the bar", "the rooftop"]);
assert.deepEqual(edited.routine, [{ time: "08:00", activity: "coffee" }]);
assert.deepEqual(edited.heat, { min: 3, max: 3 });
// A missing extraction starts from an empty draft.
assert.equal(slpCanonAnchorDraft(null).people, "");

console.log("slurp2 canon anchor editor regression checks passed");
