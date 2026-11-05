import assert from "node:assert/strict";

import { slurp2Source } from "./slurp2-source";

const root = "packages/slurp2/src/engine/packages/";
const client = `${root}client/src/slp/`;
const read = (path: string) => slurp2Source(`${root}${path}`);
const homeState = read("client/src/slp/app/slp-home-state.ts");
const hub = read("client/src/slp/app/screens/SlpScreenHub.tsx");
const inputs = read("client/src/slp/modules/settings/SlpSettingsInputs.tsx");
const controls = read("client/src/slp/modules/settings/SlpSettingsControls.tsx");
const nav = read("client/src/slp/features/backstage/SlpBackstageNavigation.tsx");
const placement = read("client/src/slp/features/backstage/slp-backstage-placement.ts");
const scheduler = read("server/src/slp/features/world/slp-world-scheduler-service.ts");
const settings = read("server/src/slp/modules/settings/slp-settings.ts");
void client;

// 1. Fresh install: the age gate writes nothing and leads into the first run (the Basic screen);
// `completed` is written at its end. The empty hub stays for a player who closes it.
const gate = homeState.slice(
  homeState.indexOf("const enterFromGate"),
  homeState.indexOf("useEffect(() => {\n    if (!gateCelebrating)"),
);
assert.doesNotMatch(gate, /onboarding: "completed"/u, "the gate no longer completes onboarding");
assert.match(gate, /setOnboardingState\("entered"\)/u);
assert.match(gate, /setOnboardingMode\("first-run"\)/u, "the gate opens the first run");
assert.match(hub, /<SlpEmptyState/u, "the hub has an empty state for the first visit");

// 2. No text connection: manual pace (slpBasicStamp, see slurp2-basic-setup.regression.ts).

// 3. Spice is a page of its own with no SlurpSettings key, so search lists it as a page.
assert.match(placement, /SLP_BACKSTAGE_PAGE_PLACEMENT[\s\S]*spice: slurp\("spice"/u);
assert.match(nav, /\.\.\.SLP_BACKSTAGE_PAGE_PLACEMENT/u);

// 5. Accessibility: names that say what the control is.
assert.match(inputs, /role="switch"\s+aria-labelledby=\{labelId\}/u, "Own value switch is named by its field");
assert.match(controls, /aria-label=\{label \? `\$\{label\}: −1` : "−1"\}/u, "stepper buttons name their field");
assert.match(
  controls,
  /aria-labelledby=\{nameId\}[\s\S]*aria-describedby=/u,
  "toggle name is the label, not the detail",
);
assert.doesNotMatch(controls, /aria-label=\{title\}\s*>\s*<h3/u, "a settings group is not a landmark");
assert.match(inputs, /<fieldset disabled=\{off\} aria-describedby=/u, "choice detail and reason reach the group");

// 6. Wallet comment matches the default.
assert.match(settings, /walletEnabled: true/u);
assert.doesNotMatch(settings, /Wallet economy\. Off by default/u);

// 7. The trends tick never fails the world tick.
assert.match(scheduler, /advanceSlurpTrends\(app\.db, new Date\(\)\)\.catch\(/u);
console.log("slurp2 quick wins ok");
