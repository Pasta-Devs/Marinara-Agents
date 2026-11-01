// #1995: the Story Location bar keeps the exact current location visible however deep the map is. Each display keeps
// parent-to-child order and marks left-out ancestors with a leading ellipsis; adaptive keeps as many trailing levels as
// fit the bar. Presentation only: the bar's title and label keep the full root-to-leaf path.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  STORY_LOCATION_DISPLAY_DEFAULT,
  formatStoryLocationTrail,
  storyLocationDisplay,
  storyLocationTrail,
  trailingCrumbsThatFit,
} from "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/story-location-trail.ts";

const deep = ["Continent", "Realm", "Province", "City", "District", "Building", "Floor", "Room"];
const shown = (display: Parameters<typeof storyLocationTrail>[1], fitting?: number) =>
  formatStoryLocationTrail(storyLocationTrail(deep, display, fitting));

// The four documented displays, adaptive by default.
assert.equal(STORY_LOCATION_DISPLAY_DEFAULT, "adaptive");
assert.equal(shown("full"), deep.join(" › "), "full keeps today's root-to-leaf display");
assert.equal(shown("current"), "… › Room", "current shows only the exact place");
assert.equal(shown("nearby"), "… › Building › Floor › Room", "nearby shows the place and two ancestors");
assert.equal(shown("adaptive", 3), "… › Building › Floor › Room", "adaptive shows the trailing levels that fit");
assert.equal(shown("adaptive"), deep.join(" › "), "adaptive before a measurement shows the whole path");

// Every display always includes the current location, and adds no ellipsis when nothing is left out.
for (const display of ["adaptive", "current", "nearby", "full"] as const) {
  for (const fitting of [0, 1, 99, undefined]) {
    const trail = storyLocationTrail(deep, display, fitting);
    assert.equal(trail.shown.at(-1), "Room", `${display} (${fitting}) shows the exact current location`);
    assert.deepEqual(trail.shown, deep.slice(deep.length - trail.shown.length), `${display} keeps order`);
    assert.equal(trail.omitted, trail.shown.length < deep.length);
  }
}
assert.deepEqual(storyLocationTrail(["Room"], "nearby"), { shown: ["Room"], omitted: false });
assert.deepEqual(storyLocationTrail(["Floor", "Room"], "current"), { shown: ["Room"], omitted: true });
assert.deepEqual(storyLocationTrail([], "adaptive", 2), { shown: [], omitted: false }, "no breadcrumb shows nothing");

// A saved choice that is missing or unknown falls back to the default.
assert.equal(storyLocationDisplay("nearby"), "nearby");
assert.equal(storyLocationDisplay("everything"), "adaptive");
assert.equal(storyLocationDisplay(null), "adaptive");

// Adaptive fitting: trailing crumbs plus separators, and the leading ellipsis whenever ancestors are left out.
const widths = [80, 50, 60, 30, 70, 64, 40, 36]; // Continent … Room
const separator = 12;
const ellipsis = 10;
assert.equal(trailingCrumbsThatFit(widths, separator, ellipsis, 36), 1, "a narrow bar still shows the current place");
assert.equal(trailingCrumbsThatFit(widths, separator, ellipsis, 10), 1, "the current place truncates on its own");
// Room 36 + sep 12 + Floor 40 = 88, plus the marker (10 + 12) = 110.
assert.equal(trailingCrumbsThatFit(widths, separator, ellipsis, 110), 2);
assert.equal(trailingCrumbsThatFit(widths, separator, ellipsis, 109), 1, "a level shows only with room for the marker");
const whole = widths.reduce((sum, width) => sum + width, 0) + separator * (widths.length - 1);
assert.equal(
  trailingCrumbsThatFit(widths, separator, ellipsis, whole),
  widths.length,
  "the whole path needs no marker",
);
assert.equal(trailingCrumbsThatFit(widths, separator, ellipsis, whole - 1), widths.length - 1);
assert.equal(trailingCrumbsThatFit([], separator, ellipsis, 500), 0);

// The bar wires it up: the trail shows, the full path stays in the title and label, and the options panel spells it out.
const bar = readFileSync(
  new URL(
    "../packages/hierarchical-maps/src/engine/packages/client/src/features/spatial-context/components/SpatialContextRuntimeBar.tsx",
    import.meta.url,
  ),
  "utf8",
);
assert.match(bar, /\{trailLabel\}/u, "the bar shows the chosen trail");
assert.match(bar, /aria-label=\{`Story location: \$\{breadcrumbLabel\}`\}/u, "the bar's label keeps the full path");
assert.match(bar, /title=\{breadcrumbLabel\}\s*>\s*<MapPin/u, "the bar's hover title keeps the full path");
assert.match(
  bar,
  /data-story-location-full-path[^>]*>\s*\{breadcrumbLabel\}/u,
  "the options panel shows the full path",
);
assert.match(bar, /saveStoryLocationDisplay\(next\)/u, "a chosen display is saved on this device");

console.log("world maps story location trail regression passed");
