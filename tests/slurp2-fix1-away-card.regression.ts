import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { slurpAwayKind } from "../packages/slurp2/src/engine/packages/client/src/slp/features/messages/slp-away-kind";

// Fix phase 1 (user correction): the "Creator is away" card of 649a7024 is back, with one small picture
// per away kind the server really knows (schedule activity, time back, a conversation cool-off).
const now = Date.UTC(2026, 8, 27, 12, 0);
const off = (activity: string | null, minutesUntilOnline: number | null) => ({
  online: false,
  activity,
  minutesUntilOnline,
});

// Schedule blocks from the server's away list map to their kind, with the time back.
assert.deepEqual(slurpAwayKind({ status: "queued", availability: off("Sleeping", 290), now }), {
  kind: "asleep",
  backAt: now + 290 * 60_000,
});
assert.equal(slurpAwayKind({ status: "queued", availability: off("In bed", 60), now }).kind, "asleep");
assert.equal(slurpAwayKind({ status: "queued", availability: off("On set for the shoot", 95), now }).kind, "busy");
assert.equal(slurpAwayKind({ status: "owed", availability: off("Lecture", 30), now }).kind, "busy");
assert.equal(slurpAwayKind({ status: "queued", availability: off("Gym, leg day", 50), now }).kind, "gym");
assert.equal(slurpAwayKind({ status: "queued", availability: off("Workout", 50), now }).kind, "gym");
assert.equal(slurpAwayKind({ status: "queued", availability: off("Flight to Lisbon", 200), now }).kind, "trip");
assert.equal(slurpAwayKind({ status: "queued", availability: off("driving home", 20), now }).kind, "trip");
// No activity and no time back: gone quiet. No activity with a time back: the plain (original) away.
assert.deepEqual(slurpAwayKind({ status: "queued", availability: off(null, null), now }), {
  kind: "quiet",
  backAt: null,
});
assert.deepEqual(slurpAwayKind({ status: "queued", availability: off(null, 40), now }), {
  kind: "away",
  backAt: now + 40 * 60_000,
});
// Online, or nothing known: the original card.
assert.equal(
  slurpAwayKind({ status: "owed", availability: { online: true, activity: "Sleeping", minutesUntilOnline: 0 }, now })
    .kind,
  "away",
);
assert.equal(slurpAwayKind({ status: "ineligible", availability: null, now }).kind, "away");
// A cool-off wins over the schedule and brings its own time back; the status alone still says cooling.
const coolUntil = new Date(now + 135 * 60_000).toISOString();
assert.deepEqual(slurpAwayKind({ status: "queued", availability: off("Sleeping", 290), coolUntil, now }), {
  kind: "cooling",
  backAt: now + 135 * 60_000,
});
assert.deepEqual(slurpAwayKind({ status: "cooling", availability: null, now }), { kind: "cooling", backAt: null });
// An expired cool-off is ignored.
assert.equal(
  slurpAwayKind({ status: "queued", availability: off("Gym", 10), coolUntil: new Date(now - 1).toISOString(), now })
    .kind,
  "gym",
);

// The card frame, tag and title of 649a7024 are back, and every kind has its own art and copy.
const root = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/client/src/slp");
const view = readFileSync(join(root, "features/messages/SlpThreadView.tsx"), "utf8");
const bubble = readFileSync(join(root, "features/messages/SlpMessageBubble.tsx"), "utf8");
const messages = readFileSync(join(root, "features/messages/SlpMessages.tsx"), "utf8");
const en = JSON.parse(readFileSync(join(root, "locales/en.json"), "utf8")) as Record<string, string>;
assert.match(
  view,
  /rounded-lg bg-\[radial-gradient\(circle_at_50%_0%,color-mix\(in_srgb,var\(--noodle-accent\)_12%,transparent\),transparent_48%\),linear-gradient\(160deg,var\(--slurp-surface-raised\),var\(--slurp-surface\)\)\]/u,
);
assert.match(view, /text-\[0\.62rem\] font-bold uppercase text-\[var\(--noodle-accent\)\]/u);
assert.match(view, /<SlurpAwayAnimation account=\{headerAccount \?\? null\} kind=\{awayCard\.kind\} \/>/u);
// After a reload only the owed reply is left: an offline Creator still gets the away card.
assert.match(view, /Boolean\(availability && !availability\.online\)/u);
for (const kind of ["away", "asleep", "busy", "gym", "trip", "cooling", "quiet"]) {
  assert.match(bubble, new RegExp(`\\b${kind}: \\{ Icon: \\w+, motion: "\\w+", mote: `, "u"), kind);
  assert.match(messages, new RegExp(`\\b${kind}: \\{ tag: "`, "u"), kind);
  if (kind !== "away") {
    assert.ok(en[`ui.slurp.messages.awayKind.${kind}.tag`], kind);
    assert.ok(en[`ui.slurp.messages.awayKind.${kind}.title`], kind);
  }
}
// Static under reduced motion.
assert.match(
  bubble,
  /prefers-reduced-motion: reduce\) \{\s*\.slurp-away-glow, \.slurp-away-moon, \.slurp-away-moon\[data-motion\] \{ animation: none; \}/u,
);
assert.match(bubble, /\.slurp-away-mote, \.slurp-away-mote\[data-mote\] \{ animation: none; opacity: 0\.5; \}/u);

console.log("slurp2 fix1 away card regression passed");
