import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { SLP_SPARKLE_STYLES } from "../packages/slurp2/src/engine/packages/client/src/slp/modules/sparkle/slp-sparkle-styles";

// Redesign step 0b: design-language foundations (tokens, type floor, sparkle rules, spend moment).
const slp = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/client/src/slp");
const src = (path: string) => readFileSync(join(slp, path), "utf8");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/u.test(name) ? [path] : [];
  });

// Colour roles: ink, tint, glow, on-accent and the top highlight exist; icons take the ink.
const chrome = src("base/chrome/SlpChrome.tsx");
for (const token of ["--slurp-ink", "--slurp-tint", "--slurp-glow", "--slurp-on-accent", "--slurp-highlight"]) {
  assert.match(chrome, new RegExp(`"${token}":`, "u"), `${token} must be a Slurp token`);
}
assert.match(chrome, /NOODLE_ICON_SCOPE_CLASS = "\[&_:where\(svg\)\]:text-\[var\(--noodle-accent-foreground\)\]"/u);

// The primary CTA is the Slurp pink fill with plum text (user decision after the 0b screenshots).
assert.match(src("modules/chrome/SlpButton.tsx"), /bg-\[var\(--noodle-accent\)\] text-\[var\(--slurp-on-accent\)\]/u);

// Text on pink fills uses the token, never a hard-coded zinc.
for (const file of walk(slp)) {
  assert.doesNotMatch(readFileSync(file, "utf8"), /text-zinc-950/u, `${file} must use --slurp-on-accent`);
}

// Type floor: shared layers carry no 9–11 px rem sizes.
for (const file of [...walk(join(slp, "base")), ...walk(join(slp, "modules"))]) {
  assert.doesNotMatch(readFileSync(file, "utf8"), /text-\[0\.\d+rem\]/u, `${file} must use the type scale`);
}

// Sparkle rules: every animation runs only without reduced motion, and every looping one is slow.
const [motionBlock] = SLP_SPARKLE_STYLES.split("@keyframes");
const [staticPart, animatedPart = ""] = motionBlock!.split("@media (prefers-reduced-motion: no-preference)");
assert.doesNotMatch(staticPart!, /animation:/u, "no animation outside the no-preference block");
const loops = [...animatedPart.matchAll(/animation:([^;]+);/gu)].flatMap(([, value]) =>
  value!.split(/,(?![^(]*\))/u).filter((part) => part.includes("infinite")),
);
assert.ok(loops.length >= 4, "ambient layers loop");
for (const loop of loops) {
  const seconds = Number(/(\d+(?:\.\d+)?)s\b/u.exec(loop)?.[1]);
  assert.ok(seconds >= 4, `ambient cycle "${loop.trim()}" must be at least 4 s`);
}
assert.match(animatedPart, /\[data-slp-paused\][^{]*\{ animation-play-state: paused/u, "ambient pauses off-screen");
assert.match(
  src("slp-client-entry.tsx"),
  /\$\{SLP_SPARKLE_STYLES\}/u,
  "sparkle CSS is injected with the package styles",
);

// Spend moment: plays only after the spend resolved, and a free gamble gets no coin fly.
const locked = src("modules/post/SlpLockedPostCard.tsx");
const unlockAt = locked.indexOf("await onUnlock(post.id)");
const momentAt = locked.indexOf("if (spent) playSlpSpendMoment(origin)");
assert.ok(unlockAt > 0 && momentAt > unlockAt, "the spend moment follows the resolved unlock");
assert.match(locked, /spent = result\.outcome !== "free" && result\.outcome !== "already-unlocked"/u);
// Fix phase 1 (R1-077): a free subscription (SlurpCoins off) gets no coin fly, like a free gamble.
assert.match(
  src("app/screens/SlpProfileLeadingActions.tsx"),
  /\.then\(\s*(?:\/\/[^\n]*\n\s*)?\(\) => \(slurpSubscriptionPriceOf\(viewerCreator\) > 0 \? playSlpSpendMoment\(origin\) : undefined\),/u,
);

console.log("slurp2 step 0b foundations regression: ok");
