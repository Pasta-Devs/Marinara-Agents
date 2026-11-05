import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatRelativeTime } from "../packages/slurp2/src/engine/packages/client/src/slp/base/ui/slp-date-time";
import {
  formatSlpAmount,
  formatSlpPercent,
} from "../packages/slurp2/src/engine/packages/client/src/slp/base/ui/slp-number-format";

// Redesign step 0c: sheet/menu primitive, state kit, formatting helpers.
const slp = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/client/src/slp");
const src = (path: string) => readFileSync(join(slp, path), "utf8");

// Timestamp: relative in lists and feeds, the full date for the future.
const now = Date.parse("2026-09-26T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();
assert.equal(formatRelativeTime(ago(20_000), "en", now), "now");
assert.equal(formatRelativeTime(ago(4 * 60_000), "en", now), "4m");
assert.equal(formatRelativeTime(ago(2 * 3_600_000), "en", now), "2h");
assert.match(formatRelativeTime(ago(3 * 86_400_000), "en", now), /^[A-Z][a-z]{2}$/u, "a weekday within the week");
assert.equal(formatRelativeTime("2026-08-12T12:00:00Z", "en", now), "Aug 12");
assert.equal(formatRelativeTime("2025-08-12T12:00:00Z", "en", now), "Aug 12, 2025");
assert.notEqual(formatRelativeTime("2026-09-27T12:00:00Z", "en", now), "now", "a scheduled time is not 'now'");
assert.equal(formatRelativeTime("not a date", "en", now), "");

// Money (B34): numbers and whole-number strings get the reader's separators; labels pass through.
assert.equal(formatSlpAmount(1284, "en"), "1,284");
assert.equal(formatSlpAmount("1284", "en"), "1,284");
assert.equal(formatSlpAmount("+2500", "en"), "+2,500");
assert.equal(formatSlpAmount(1284, "de"), "1.284");
assert.equal(formatSlpAmount("…", "en"), "…");
assert.equal(formatSlpPercent(0.42, "en"), "42%");
assert.match(src("modules/coin/SlpCoin.tsx"), /formatSlpAmount\(amount, i18n\.language\)/u);
// One coin rule: an amount in copy is "25 <coin/>" (number, then the glyph), never "25 coins".
const english = JSON.parse(src("locales/en.json")) as Record<string, string>;
for (const [key, value] of Object.entries(english)) {
  assert.doesNotMatch(
    value,
    /\{\{\w+\}\}\s*(more\s+)?(coins?|SlurpCoins?)\b/iu,
    `${key}: amount + coin glyph, not the word`,
  );
}
assert.match(src("modules/coin/SlpCoin.tsx"), /const COIN_MARK = \/\(\\S\*\?\)\\s\*<coin\\\/>\/gu/u);
// W: Studio's own-page half is the Dashboard sheet now.
assert.doesNotMatch(src("app/screens/SlpDashboard.tsx"), /<SlurpCoin size/u, "no stray glyph after a sentence");

// Sheet: one primitive for menus and dialogs; Escape and scrim close it; one at a time.
const sheet = src("modules/chrome/SlpSheet.tsx");
assert.match(sheet, /closeOpenOverlay\?\.\(\)/u, "opening a sheet closes the one already open");
// A history entry of its own made the Engine's back handler close the Engine's top layer.
assert.doesNotMatch(sheet, /history\.(pushState|back)\(/u);
// A base sheet (Stir, 0.3.63) also counts the sheets stacked on it.
assert.match(sheet, /useDialogFocusScope\(open && mounted, panelRef[,)]/u, "focus is trapped");
for (const file of ["modules/post/SlpPostMenu.tsx", "modules/post/SlpInteractionMenu.tsx"]) {
  const menu = src(file);
  const fan = menu.indexOf("<SlpSheetGroup>");
  const tools = menu.indexOf('ui.slurp.post.creatorTools"');
  assert.ok(fan > 0 && tools > fan, `${file}: operator actions come last, as Creator tools`);
}
assert.match(src("modules/post/SlpReportModal.tsx"), /<SlpRadioRow/u);
assert.doesNotMatch(src("modules/post/SlpReportModal.tsx"), /<select/u, "report reasons are radio rows");

// The unlock spend moment starts from the post's own Unlock button, not the closed sheet's row.
const locked = src("modules/post/SlpLockedPostCard.tsx");
assert.match(locked, /const trigger = unlockTriggerRef\.current\?\.getBoundingClientRect\(\)/u);
assert.ok(
  locked.indexOf("setUnlockSheetOpen(false);\n      if (spent)") > 0,
  "the sheet closes before the spend moment plays",
);

// State kit: the 0a stopgaps are gone.
assert.doesNotMatch(src("modules/chrome/SlpStateKit.tsx"), /export function (LoadingState|ErrorState)\b/u);
assert.match(src("modules/chrome/SlpStateKit.tsx"), /STILL_CONNECTING_MS = 4000/u);

console.log("slurp2 step 0c primitives regression: ok");
