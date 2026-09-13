import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const splash = readFileSync(
  join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpSplash.tsx"),
  "utf8",
);

assert.match(splash, /grid-cols-\[minmax\(0,1fr\)_6rem\][\s\S]*?sm:grid-cols-\[minmax\(0,1fr\)_8rem\]/u);
assert.match(splash, /h-24 w-24[\s\S]*?sm:h-32 sm:w-32/u, "Gunterlie must stay compact at phone and desktop widths");
assert.match(splash, /rounded-full bg-\[var\(--noodle-accent\)\]\/15[\s\S]*?rotate-6 object-contain/u);
assert.match(
  splash,
  /viewBox="0 0 28 44"[\s\S]*?M22 4 13 0M18 22H4m18 18-9 4/u,
  "the hero must keep all three emphasis lines",
);
assert.match(splash, /Hey, I’m G\.[\s\S]*?The dude responsible for all the bugs\./u);
assert.match(splash, /occasionally\s*feral, and absolutely full of bugs\./u);
assert.match(splash, /Slurp can use text and image models without always asking first\./u);
assert.doesNotMatch(splash, /const BROKEN|Everything that is not really working/u);

assert.match(
  splash,
  /<a[\s\S]*?href="https:\/\/discord\.com\/channels\/1417099416812392641\/1539355721853046926"[\s\S]*?target="_blank"[\s\S]*?rel="noreferrer"/u,
);
assert.match(splash, /Found a bug\? Obviously\.[\s\S]*?Slurp General[\s\S]*?Opens in a new tab\./u);
assert.match(splash, /function DiscordMark\(\)[\s\S]*?viewBox="0 0 64 48"[\s\S]*?<DiscordMark \/>/u);
assert.match(splash, /focus-visible:ring-2 focus-visible:ring-\[var\(--slurp-focus\)\]/u);

assert.match(splash, /aria-expanded=\{historyExpanded\}/u);
assert.match(splash, /aria-controls="slurp2-earlier-releases"/u);
assert.match(splash, /Hide earlier releases/u);
assert.match(splash, /Show \$\{earlierReleases\.length\} earlier release/u);
assert.match(splash, /hidden=\{!historyExpanded\}/u);
assert.match(splash, /earlierReleases\.length > 0/u, "one unseen release must not render a disclosure");

assert.match(splash, /I understand this is alpha software and I use it at my own risk\./u);
assert.match(splash, /if \(!approved\) return/u);
assert.match(splash, /localStorage\.setItem\(SEEN_KEY, SLURP2_VERSION\)/u);
assert.match(splash, /panelClassName="\[&>div:first-child>button\]:hidden"/u);
assert.match(splash, /panelStyle=\{getNoodleAccentStyle\(NOODLE_PINK\)\}/u);
assert.match(splash, /topRef\.current\?\.focus\(\{ preventScroll: true \}\)/u);

console.log("Slurp2 splash regressions passed.");
