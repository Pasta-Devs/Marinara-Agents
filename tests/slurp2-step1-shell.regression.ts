import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Redesign step 1: the shell (floating nav, hub header, More sheet, sidebar, toasts, app states, Engine entry).
const root = join(import.meta.dirname, "..");
const slp = join(root, "packages/slurp2/src/engine/packages/client/src/slp");
const src = (path: string) => readFileSync(join(slp, path), "utf8");
const shell = src("modules/chrome/SlpShell.tsx");
const chrome = src("base/chrome/SlpChrome.tsx");
const host = src("app/SlpHomeHost.tsx");
const hub = src("app/screens/SlpScreenHub.tsx");
const entry = src("slp-client-entry.tsx");
const kit = src("modules/chrome/SlpStateKit.tsx");

// B14: another Creator's profile is not "Profile". Only the viewer's own Creator highlights the tab.
assert.match(
  host,
  /navigation\.view === "profile"\s*\?[\s\S]{0,160}navigation\.accountId === mainAuthorProfile\?\.id\s*\?\s*\("profile" as const\)\s*:\s*null/u,
);

// Floating pill nav: glass, one tab component with aria-current, hides on scroll through the shared hook.
// Step 3.1 (user): the pill uses the header's glass, and screens scroll behind it (no reserved padding;
// only list ends and bottom bars keep room, see slurp2-step3.1-shell-polish).
const nav = shell.slice(shell.indexOf('data-component="NoodleView.MobileBottomNav"') - 900);
assert.match(nav, /ref=\{setMobileNav\}/u);
assert.match(nav, /rounded-full p-1[\s\S]*?SLP_BAR_GLASS_CLASS/u);
assert.match(nav, /bottom-\[calc\(10px\+var\(--slurp-bottom-safe-inset\)\)\]/u, "safe-area aware");
assert.match(shell, /useHideOnScroll\(scrollRoot,/u);
assert.match(shell, /resetKey: activeView/u, "a new screen brings the nav back");
// 0.3.6: the nav-hidden flag restyles only the bars that follow it, not every post under the scroll root.
assert.match(shell, /toggleAttribute\("data-slp-nav-hidden", hidden\)/u);
assert.match(entry, /\[data-slp-nav-hidden\] \.slp-nav-live \{ --slp-nav-live: 0px; \}/u);
assert.match(
  shell,
  // Step 2: the tint is a gradient, so it needs the `image:` hint (`bg-[var(...)]` compiled to an
  // invalid background-color and painted nothing).
  /function SlpNavTab[\s\S]*?h-12[\s\S]*?bg-\[image:var\(--slurp-nav-active\)\]/u,
  "48 px tabs, tint when active",
);
assert.match(shell, /aria-label=\{badge > 0 \? `\$\{label\}, /u, "the count is read with the label, not glued to it");

// The hook: capture phase (screens own their scrollers), per-scroller counting, focus brings it back,
// and the clamp scroll caused by giving the space back is ignored (no hide/show loop at the page end).
assert.match(chrome, /addEventListener\("scroll", update, \{ passive: true, capture: true \}\)/u);
assert.match(chrome, /if \(target !== source\)/u);
assert.match(chrome, /bar\.addEventListener\("focusin", show\)/u);
assert.match(chrome, /if \(performance\.now\(\) < settleUntil\) return;/u);

// While Slurp itself loads or failed: no stale nav counts, no back arrow, a hub skeleton or the error card.
const appState = host.slice(host.indexOf("accountsQuery.isLoading || accountsQuery.isError"));
assert.match(appState, /noodlerUnseenCount=\{0\} notificationCount=\{0\}/u);
assert.match(appState, /<SlpSkeleton shape="hub"/u);
assert.match(appState, /<SlpErrorState/u);
assert.doesNotMatch(appState.slice(0, appState.indexOf("renderSlurpHomeCreatorFlow")), /SlpCreatorFrame/u);

// Desktop sidebar: a Studio row (B19) and the shared balance chip.
// W: Studio is gone (its own-page half is the profile's Dashboard); Stir is in the phone nav and the sidebar.
assert.equal((shell.match(/onClick=\{onOpenStir\}/gu) ?? []).length, 2, "Stir in the phone nav and the sidebar");
assert.match(shell, /walletChip\("h-7 px-2\.5 text-xs"\)/u);
// Step 2: the hub uses the one shared chip (the user asked for a shared component, not copies).
assert.match(hub, /<SlpBalanceChip \/>/u);
assert.match(shell, /export function SlpBalanceChip[\s\S]*?SLP_BALANCE_CHIP_CLASS/u);

// More is an SlpSheet; Pulse closes it first so Pulse is not hidden under the sheet.
// Step 7: Pulse is a SlpSheet too, and opening a sheet closes the one that is open (B8).
assert.match(shell, /<SlpSheet\s+open=\{mobileDrawerOpen\}/u);
assert.match(src("modules/chrome/SlpPulse.tsx"), /<SlpSheet open=\{open\} onClose=\{onClose\}/u);
assert.match(src("modules/chrome/SlpSheet.tsx"), /closeOpenOverlay\?\.\(\);\s*closeOpenOverlay = close;/u);

// Hub header: wordmark left, chip right. Step 3.1 (user): the refresh ⋯ is gone, the feed updates itself.
assert.match(hub, /<SlpWordmark \/>/u);
assert.doesNotMatch(hub, /onRefresh|headerMenuRef/u);

// Toasts: the Engine's position and theme, token accents (no richColors), scoped CSS, above the pill.
assert.doesNotMatch(entry, /richColors/u);
assert.match(entry, /localStorage\.getItem\("marinara-engine-ui"\)/u);
assert.match(entry, /position=\{position === "bottom" \? "bottom-center" : "top-center"\}/u);
assert.match(entry, /theme=\{theme\}/u);
assert.match(entry, /\[data-slp-toaster\] \[data-sonner-toaster\]\[data-y-position="bottom"\]/u);
assert.doesNotMatch(
  entry,
  /\n {2}\[data-sonner-toaster\]\[data-x-position/u,
  "no unscoped rule that moves the Engine's toaster",
);

// Report bug: a small sheet with Discord (the splash's link) and the prefilled GitHub issue.
const splash = src("features/onboarding/SlpSplash.tsx");
const discord = chrome.match(/SLP_DISCORD_BUG_URL = "([^"]+)"/u)?.[1];
// The splash links through the same constant, so the two can never drift apart.
assert.ok(discord && splash.includes("href={SLP_DISCORD_BUG_URL}"), "the same Discord link as the release splash");
assert.match(kit, /<SlpSheet[\s\S]*?SLP_DISCORD_BUG_URL[\s\S]*?bugReportHref\(cause\)/u);

// Engine entry: the accessible name has no trailing period.
const build = readFileSync(join(root, "scripts/build-feature-packages.mjs"), "utf8");
const slurp2 = build.slice(build.indexOf('id: "slurp2"'), build.indexOf("ownedSourcePaths: slurp2OwnedSourcePaths"));
const slurp2Tab = build.slice(build.indexOf("ownedSourcePaths: slurp2OwnedSourcePaths"));
assert.match(slurp2Tab, /ariaLabel: "Open Slurp",/u);
assert.doesNotMatch(slurp2, /ariaLabel: "[^"]*\.",?/u);

console.log("slurp2 step 1 shell regression passed");
