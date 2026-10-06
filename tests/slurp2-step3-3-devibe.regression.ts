import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  SLP_AMBIENT_SCROLL_QUIET_MS,
  slpAmbientMayLook,
  slpLeadingPhotoSrc,
} from "../packages/slurp2/src/engine/packages/client/src/slp/modules/chrome/slp-canvas-ambient";

// Redesign step 3.3: 3.2 follow-ups (ending chip, resume toast, fading pill stars), the de-vibe
// pass (own glyphs, no coloured stripes, new canvas art, no em dashes, a display face) and
// in-universe copy.
const root = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/client/src/slp");
const client = (path: string) => readFileSync(join(root, path), "utf8");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/u.test(name) ? [path] : [];
  });
const sources = walk(root).map((path) => ({ path, text: readFileSync(path, "utf8") }));

// ── 3.2 follow-ups ──
const actions = client("app/screens/SlpProfileLeadingActions.tsx");
assert.match(
  actions,
  /const endingChip = subscriptionState\.kind === "cancelled" && \(/u,
  "cancelled + paid: a static chip",
);
assert.match(actions, /"ui\.slurp\.profile\.endsDay"/u);
assert.match(actions, /\) : endingChip \? \(\s+endingChip\s+\) : \(/u, "the chip takes the Follow slot");
assert.match(
  actions,
  /playSlpBurst\(origin\);\s+toast\.success\(localizeUi\("ui\.slurp\.profile\.subscriptionResumed"/u,
  "a resume ends in a Burst and a toast, only after it succeeded",
);
assert.match(client("app/screens/SlpScreenHub.tsx"), /<SlpTwinkle\s+fade\s+points=/u, "the pill's stars fade out");
assert.match(
  client("modules/sparkle/slp-sparkle-styles.ts"),
  /@keyframes slp-twinkle-fade \{[\s\S]*?100% \{ opacity: 0;/u,
);

// ── Glyphs: no Lucide Sparkles left; the nav, like and lock use Slurp's own ──
for (const { path, text } of sources) {
  const lucide = text.match(/import \{([^}]*)\} from "lucide-react"/gu)?.join(" ") ?? "";
  assert.doesNotMatch(lucide, /\bSparkles\b/u, `${path} imports Lucide Sparkles`);
}
const shell = client("modules/chrome/SlpShell.tsx");
// Release 0.3.0 (user): the last tab is "More" again (the persona's avatar, else the More glyph), and
// the Stir spoon is a plain nav glyph like the others.
for (const glyph of ["SlpHubGlyph", "SlpMoreGlyph", "SlpInboxGlyph", "SlpDiscoverGlyph", "SlpStirGlyph"])
  assert.match(shell, new RegExp(`<${glyph} size=\\{20\\} filled=`, "u"), `${glyph} fills when active`);
assert.match(client("modules/post/SlpPostCard.tsx"), /<SlpHeartGlyph\s+size=\{18\}\s+filled=\{likedByPersona\}/u);
assert.match(client("modules/post/SlpLockedMedia.tsx"), /<SlpLockGlyph /u);

// ── No coloured stripes: tint marks active, selected and success ──
assert.doesNotMatch(client("base/chrome/SlpChrome.tsx"), /SLURP_ROW_ACTIVE_CLASS =\s+"[^"]*before:/u);
assert.doesNotMatch(client("modules/settings/SlpSettingsControls.tsx"), /start-0 w-0\.5/u, "GuidanceBox stripe");
assert.doesNotMatch(client("slp-client-entry.tsx"), /inset 3px 0|--slp-toast-bar/u, "toast stripe");

// ── Canvas: no radial orbs ──
const chrome = client("base/chrome/SlpChrome.tsx");
const art = chrome.slice(chrome.indexOf('"--slurp-canvas-art":'), chrome.indexOf("...style,"));
assert.doesNotMatch(art, /radial-gradient/u, "the three orbs are gone");
assert.match(client("modules/chrome/SlpShell.tsx"), /\{slurpActive && <SlpCanvasAmbient \/>\}/u);
// The room takes its colour from the photo with the largest visible area; avatars, unloaded and
// skipped pictures never lead.
const photo = (src: string, [left, top, right, bottom]: number[], extra: Record<string, unknown> = {}) => ({
  src,
  currentSrc: "",
  complete: true,
  naturalWidth: 800,
  closest: () => null,
  getBoundingClientRect: () => ({ left, top, right, bottom }) as DOMRect,
  ...extra,
});
const viewport = { width: 1440, height: 900 };
const room = (...imgs: ReturnType<typeof photo>[]) => ({ querySelectorAll: () => imgs });
assert.equal(
  slpLeadingPhotoSrc(room(photo("a", [0, 0, 300, 300]), photo("b", [0, 500, 800, 1400])), viewport),
  "b",
  "measures only the part on screen (b: 800 × 400 beats a: 300 × 300)",
);
assert.equal(slpLeadingPhotoSrc(room(photo("avatar", [0, 0, 96, 96])), viewport), null, "too small");
assert.equal(slpLeadingPhotoSrc(room(photo("off", [0, 1000, 800, 1600])), viewport), null, "off screen");
assert.equal(slpLeadingPhotoSrc(room(photo("wait", [0, 0, 800, 800], { complete: false })), viewport), null);
assert.equal(slpLeadingPhotoSrc(room(photo("skip", [0, 0, 800, 800], { closest: () => ({}) })), viewport), null);
assert.equal(slpLeadingPhotoSrc(room(photo("x", [0, 0, 800, 800], { currentSrc: "blob:1" })), viewport), "blob:1");

// ── Display face: one woff2 inside the bundle, used by the wordmark, big names and big money ──
const font = client("base/chrome/slp-display-font.ts");
const woff2 = Buffer.from(font.match(/SLP_DISPLAY_FONT_WOFF2 =\s+"([A-Za-z0-9+/=]+)"/u)![1], "base64");
assert.equal(woff2.subarray(0, 4).toString("latin1"), "wOF2", "the data URL is a woff2 file");
assert.ok(woff2.length < 40_000, "subset stays small");
assert.match(font, /Open Font License/u, "the OFL notice travels with the font");
assert.match(client("slp-client-entry.tsx"), /\$\{SLP_DISPLAY_FONT_STYLES\}/u);
assert.match(shell, /className="slp-display text-xl leading-none">\{SLURP_NAME\}/u);
assert.match(client("features/creators/SlpProfileSurface.tsx"), /"slp-display max-w-full text-\[28px\]/u);
// Step 6 moved the earnings balance into the shared Collect card: still two Fraunces balances.
assert.equal(
  (client("app/screens/SlpScreenWallet.tsx") + client("app/screens/SlpCollectCard.tsx")).match(/slp-display mt-/gu)
    ?.length,
  2,
);

// ── Copy: no em dashes, nothing that says the world is not real ──
const locales = ["en", "de", "ko", "pl"].map((lang) => ({
  lang,
  strings: JSON.parse(client(`locales/${lang}.json`)) as Record<string, string>,
}));
for (const { lang, strings } of locales)
  for (const [key, value] of Object.entries(strings)) assert.ok(!value.includes("—"), `${lang} ${key} has an em dash`);
const en = locales[0]!.strings;
const fiction =
  /simulat|\bfake\b|fictional|part of the fiction|made-up|invented|not real|no money|nothing (is|here) charge|decoration|roleplay (points|state|surface|space)/iu;
for (const [key, value] of Object.entries(en)) {
  // Model instructions and the unused privacy note name the machinery on purpose.
  if (key === "ui.noodle.noodlehome.noodlerIsStillBeingImplementedAndIsNotUsable") continue;
  assert.doesNotMatch(value, fiction, `${key} breaks the fiction: ${value}`);
}
assert.match(en["ui.noodle.agegate.cardBrand"]!, /Pastapay/u, "the 18+ gag stays");
assert.match(en["ui.noodle.noodlerwizard.intro.attention.cost"]!, /provider may bill/u, "the real cost warning stays");
assert.match(client("features/onboarding/SlpSplash.tsx"), /Your\s+provider may bill every call\./u);
for (const { path, text } of sources) {
  if (/slp-release\.ts$/u.test(path)) continue; // shipped release notes
  // Sentences only (a capital letter and a space), so setting keys and search aliases stay out.
  for (const literal of text.match(/"[A-Z][^"\n]* [^"\n]*"/gu) ?? [])
    if (!/prompt|model/iu.test(literal)) assert.doesNotMatch(literal, fiction, `${path}: ${literal}`);
}

console.log("slurp2 step 3.3 de-vibe regression passed");

// Fix phase 1b: the room never swaps its colour layer while the reader scrolls (a new layer under the
// scroller stopped iOS momentum flings after a short distance).
assert.equal(slpAmbientMayLook(10_000, Number.NEGATIVE_INFINITY), true, "no scroll yet");
assert.equal(slpAmbientMayLook(10_000, 10_000 - 100), false, "mid-fling");
assert.equal(slpAmbientMayLook(10_000, 10_000 - SLP_AMBIENT_SCROLL_QUIET_MS), true, "settled");
const ambient = client("modules/chrome/SlpCanvasAmbient.tsx");
assert.match(ambient, /frame\.addEventListener\("scroll", onScroll, \{ capture: true, passive: true \}\)/u);
assert.match(ambient, /const now = performance\.now\(\);[\s\S]{0,120}?!slpAmbientMayLook\(now, lastScrollAt\)/u);
