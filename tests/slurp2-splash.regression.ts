import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const splash = slurp2Source(
  join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpSplash.tsx"),
);

// G's thread: the old two-column hero is gone; G sits at the top of the chat as the intro card.
assert.match(
  splash,
  /message\.kind === "intro"\) return \{ kind: "card", id: message\.id, align: "center", content: <GIntro \/> \}/u,
);
assert.match(splash, /h-24 w-24[\s\S]*?sm:h-32 sm:w-32/u, "Gunterlie must stay compact at phone and desktop widths");
assert.match(splash, /rounded-full bg-\[var\(--noodle-accent\)\]\/15[\s\S]*?rotate-6 object-contain/u);
assert.match(
  splash,
  /viewBox="0 0 28 44"[\s\S]*?M22 4 13 0M18 22H4m18 18-9 4/u,
  "the hero must keep all three emphasis lines",
);
assert.match(splash, /Hey, I’m G\.[\s\S]*?The dude responsible for all the bugs\./u);
assert.match(splash, /occasionally\s*feral, and absolutely full of bugs\./u);
assert.match(splash, /Slurp calls your text and image models on its own, and one tap can call them more than once\./u);
assert.doesNotMatch(splash, /const BROKEN|Everything that is not really working/u);

// The Discord card and the composer link use the one shared link (SlpChrome's SLP_DISCORD_BUG_URL).
assert.match(splash, /<a[\s\S]*?href=\{SLP_DISCORD_BUG_URL\}[\s\S]*?target="_blank"[\s\S]*?rel="noreferrer"/u);
assert.match(splash, /placeholder: "G can’t read this\. Find me in Slurp General\."[\s\S]*?href: SLP_DISCORD_BUG_URL/u);
assert.match(splash, /Found a bug\? Obviously\.[\s\S]*?Slurp General[\s\S]*?Opens in a new tab\./u);
assert.match(splash, /function DiscordMark\(\)[\s\S]*?viewBox="0 0 64 48"[\s\S]*?<DiscordMark \/>/u);
assert.match(splash, /focus-visible:ring-2 focus-visible:ring-\[var\(--slurp-focus\)\]/u);

// The changelog is the thread's history: no disclosure, a "New" divider, and "Got it" as the reply.
assert.doesNotMatch(splash, /Hide earlier releases|historyExpanded|earlierReleases/u);
assert.match(splash, /kind: "divider", id: message\.id, label: "New"/u);
assert.match(splash, /\{ id: "got-it", label: "Got it", primary: true, onSelect: finish \}/u);
assert.match(splash, /const finish = \(\) => \{\s*markSeen\(\);\s*onDismiss\(\);/u);

// Consent is the reply chip; nothing is stored before it.
assert.match(
  splash,
  /label: "I get it: alpha, my own risk",[\s\S]*?onSelect: \(\) => \{\s*markSeen\(\);\s*setConsented\(true\);/u,
);
assert.match(splash, /\{ id: "leave", label: "Leave Slurp", onSelect: onLeave \}/u);
assert.match(splash, /Cool\. Support will take it from here\. Be nice to them, they’re me in a tie\./u);
assert.match(splash, /localStorage\.setItem\(SEEN_KEY, SLURP2_VERSION\)/u);
// Step 8: the X is no longer hidden; X and Escape mean Leave Slurp (a real exit from first-run consent).
assert.doesNotMatch(splash, /panelClassName="\[&>div:first-child>button\]:hidden"/u);
// The chat shell hides the Modal header but brings its own X; X and Escape still mean Leave Slurp.
assert.match(splash, /const close = \(\) => \(consenting \? leaveUnlessBackdrop\(onLeave\) : finish\(\)\);/u);
assert.match(splash, /onClose=\{close\}[\s\S]*?closeDisabled=\{consenting && !onLeave\}/u);
assert.match(splash, /onClick=\{close\}\s*aria-label=\{consenting \? "Leave Slurp" : "Close"\}/u);
assert.match(splash, /panelStyle=\{getSlpAccentStyle\(SLP_PINK\)\}/u);
// First focus lands on the host name in the chat header (outside the scrolling list), not the Discord link.
assert.match(splash, /ref=\{titleRef\} tabIndex=\{-1\} data-autofocus/u);

console.log("Slurp2 splash regressions passed.");
