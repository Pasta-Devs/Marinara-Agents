import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shell = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpShell.tsx", "utf8");

// The drawer already overlaid the page; the flicker came from the panel sitting at x:100% during
// its slide-in and widening the page. `clip`, not `hidden` — `hidden` would make this a scroll
// container and break every sticky header inside it.
assert.match(shell, /overflow-x-clip/u);
assert.doesNotMatch(shell, /flex h-full min-h-0 flex-col overflow-x-hidden bg-\[var\(--background\)\]/u);

// The desktop persona popover must size to its own content, not to the sidebar's width.
assert.doesNotMatch(shell, /absolute bottom-\[calc\(100%\+0\.5rem\)\] left-0 right-0/u);
assert.match(shell, /absolute bottom-\[calc\(100%\+0\.5rem\)\] start-0 z-30 w-\[min\(22rem,/u);

// The mobile drawer used to render the whole persona list open, pushing the identity card away.
const drawer = shell.slice(shell.indexOf("NoodleView.MobileDrawer"), shell.indexOf("</aside>"));
assert.match(drawer, /<details className="group mt-3">/u, "the drawer's persona list must be collapsed by default");
assert.match(drawer, /group-open:rotate-180/u);

const surface = readFileSync(
  "packages/slurp/src/engine/packages/client/src/components/slurp/SlurpProfileSurface.tsx",
  "utf8",
);
// Editing happens in place now: there is exactly one identity block, not a display one and a
// separate stacked form.
assert.match(surface, /const inPlaceFieldClass/u);
assert.doesNotMatch(surface, /mt-5 w-full space-y-3 text-left/u, "the separate editor form must be gone");
for (const field of ["editor.onNameChange", "editor.onHandleChange", "editor.onBioChange", "editor.onLocationChange"]) {
  assert.match(surface, new RegExp(field.replace(".", "\\."), "u"), `${field} must still be reachable`);
}
// The avatar overlaps the banner rather than sitting flush under it.
assert.match(surface, /relative z-10 -mt-20 pt-0 @min-\[680px\]:-mt-28/u);

console.log("slurp-chrome regression passed");
