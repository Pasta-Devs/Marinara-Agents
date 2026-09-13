import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Toggling an ad-image setting blanked half the Slurp panel until a refresh (#133): a render throw
// took down the whole root, and the main column's height/animation chain could strand a hidden box.
const clientRoot = "packages/slurp2/src/engine/packages/client/src";
const entry = readFileSync(`${clientRoot}/slurp-package-entry.tsx`, "utf8");
const shell = readFileSync(`${clientRoot}/components/slurp/SlurpShell.tsx`, "utf8");
const settings = readFileSync(`${clientRoot}/components/slurp/SlurpSettings.tsx`, "utf8");

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
for (const line of settings.split("\n").filter((entry) => entry.includes("<main className="))) {
  assert.ok(
    line.includes("min-h-0") && line.includes("flex-1"),
    `settings <main> must size from the flex chain: ${line.trim()}`,
  );
}
assert.match(
  settings,
  /min-h-0 flex-1 overflow-y-auto bg-\[var\(--slurp-canvas\)\]/u,
  "the settings pane must scroll inside its clip",
);

console.log("slurp2 settings blank panel regression passed");
