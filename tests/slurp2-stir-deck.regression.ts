/**
 * W: the Stir tab slides up as a sheet over the page it was opened from. Every Stir link opens it, any other
 * move closes it, and the sheets Stir opens (play, plan, Pulse) stack on top of it instead of closing it.
 */
import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source.ts";

const client = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/client/src/slp/${path}`);

const host = client("app/SlpHomeHost.tsx");
assert.match(
  host,
  /const stir = next\.mode === "creator" && \(next\.view === "stir" \|\| next\.view === "studio"\);\n\s*useSlpStirDeck\.setState\(\{ open: stir \}\);\n\s*if \(!stir\) go\(next\);/,
  "a Stir link opens the sheet; any other move closes it",
);
assert.match(
  host,
  /current\.view === "messages"\) go\(\{ mode: "creator", view: "hub" \}\)/,
  "back from a chat lands on the feed",
);
assert.match(host, /const onNavigate = useSlpStirDeckNavigate\(\{ navigation, onNavigate: navigateRaw \}\);/);
assert.match(host, /<SlpStirDeck\s/);

const sheet = client("modules/chrome/SlpSheet.tsx");
assert.match(
  sheet,
  /closeOpenOverlay\?\.\(\);\n\s*if \(!base\) closeOpenOverlay = close;/,
  "a base sheet never registers as the one overlay",
);
assert.match(sheet, /event\.key === "Escape" && !\(base && closeOpenOverlay\)/, "Escape closes the sheet on top first");

const screen = client("features/stir/SlpStirScreen.tsx");
assert.match(screen, /<SlpSheet\s+open=\{sheet\.open\}\s+onClose=\{sheet\.onClose\}\s+base\s+back/);

assert.match(
  sheet,
  /useDialogFocusScope\(open && mounted, panelRef, undefined, undefined, base \? "\[data-slp-sheet\]" : undefined\)/,
  "Tab stays in the sheet on top",
);
assert.match(
  host,
  /useEffect\(\(\) => \(\) => useSlpStirDeck\.setState\(\{ open: false \}\), \[\]\);/,
  "leaving Slurp closes Stir",
);
assert.match(
  client("app/screens/SlpHomeHelpers.tsx"),
  /useEffect\(\(\) => registerSlpBackLayer\(\(\) => onCloseRef\.current\(\)\), \[\]\);/,
  "Android back closes a Story",
);

console.log("slurp2 stir deck: ok");
