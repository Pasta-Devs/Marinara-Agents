import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { slurp2BackstageSource } from "./slurp2-backstage-source";
import { slurp2Source } from "./slurp2-source";

// Toggling an ad-image setting blanked half the Slurp panel until a refresh (#133): a render throw
// took down the whole root, and the main column's height/animation chain could strand a hidden box.
const clientRoot = "packages/slurp2/src/engine/packages/client/src";
const entry = slurp2Source(`${clientRoot}/slurp-package-entry.tsx`);
const shell = readFileSync(`${clientRoot}/components/slurp/SlurpShell.tsx`, "utf8");
const settings = slurp2BackstageSource();
const backstage = readFileSync(`${clientRoot}/components/slurp/slurp-backstage.ts`, "utf8");
const world = readFileSync(`${clientRoot}/components/slurp/SlurpBackstageWorld.tsx`, "utf8");
const automation = readFileSync(`${clientRoot}/components/slurp/SlurpBackstageAutomation.tsx`, "utf8");

assert.match(backstage, /arcs: "Plan templates"/u, "templates must use product vocabulary");
assert.match(
  backstage,
  /content\("arcs", "plan templates", "stories"\)/u,
  "stories must remain searchable as templates",
);
assert.match(
  world,
  /landing\.stories[\s\S]*defaultValue: "World simulation"/u,
  "the World landing must describe world controls",
);
assert.match(
  automation,
  /settingKey="storyRate"[\s\S]*ui\.slurp\.settings\.storyRate/u,
  "the separate Story-post cadence must remain intact",
);
const storiesGroupStart = automation.indexOf("settings.images.storiesGroup");
const storiesGroupEnd = automation.indexOf("</SettingsGroup>", storiesGroupStart);
assert.ok(storiesGroupStart >= 0 && storiesGroupEnd > storiesGroupStart, "the Story image settings group must exist");
const storiesGroup = automation.slice(storiesGroupStart, storiesGroupEnd);
assert.match(
  storiesGroup,
  /settingKey="storyImageWidth"[\s\S]*settingKey="storyImageHeight"/u,
  "Story image settings must keep the existing dimensions",
);

assert.match(entry, /class SlurpErrorBoundary extends Component/u, "slurp2 needs a render error boundary");
assert.match(entry, /static getDerivedStateFromError/u, "the boundary must render a fallback, not just log");
assert.match(entry, /componentDidCatch\(error: Error, info: ErrorInfo\)/u, "the boundary must log the component stack");
assert.match(
  entry,
  /<SlurpErrorBoundary>[\s\S]*<SlurpHome[\s\S]*<AppDialogRenderer \/>[\s\S]*<\/SlurpErrorBoundary>/u,
  "the boundary must wrap the whole root tree",
);

// An AnimatePresence exit that never completes leaves the outgoing view mounted at opacity 0.
assert.doesNotMatch(shell, /<AnimatePresence mode="wait"/u, "the view swap must not gate on an exit animation");
assert.match(shell, /key=\{activeView\}/u, "the view swap still remounts on the active view");

// h-full against an auto-height flex ancestor let the lower half overflow the clip.
function assertMainSizing(source: string) {
  const mainTags = [...source.matchAll(/<main\b[^>]*>/gu)];
  assert.ok(mainTags.length > 0, "settings must contain a <main> pane");
  for (const [tag] of mainTags) {
    const classes = /className="([^"]*)"/u.exec(tag)?.[1].split(/\s+/u) ?? [];
    assert.ok(
      classes.includes("min-h-0") && classes.includes("flex-1"),
      `settings <main> must size from the flex chain: ${tag.trim()}`,
    );
  }
}
assertMainSizing(settings);
assertMainSizing('<main\n className="min-h-0 flex-1">');
assert.throws(() => assertMainSizing("<section />"), /must contain a <main>/u);
assert.throws(() => assertMainSizing('<main\n className="min-h-0">'), /must size from the flex chain/u);
assert.match(
  settings,
  /min-h-0 flex-1 overflow-y-auto bg-\[var\(--slurp-canvas\)\]/u,
  "the settings pane must scroll inside its clip",
);

console.log("slurp2 settings blank panel regression passed");
