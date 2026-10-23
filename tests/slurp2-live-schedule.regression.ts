import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source.ts";
import {
  slurpLiveNextSlot,
  slurpLiveAnnouncementDue,
  slurpLiveMayStart,
  slurpLiveDueNotifications,
  slurpLiveAnnouncementText,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live.ts";
import {
  normalizeSlurpLiveSettings,
  slurpLiveSettingsValid,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/settings/slp-live-settings.ts";

const settings = {
  liveFrequency: "normal" as const,
  liveStartHour: 18,
  liveEndHour: 24,
  liveMinMinutes: 20,
  liveMaxMinutes: 40,
};
const now = new Date("2026-10-23T08:00:00.000Z");
const previous = new Date("2026-10-20T19:00:00.000Z");
const normal = slurpLiveNextSlot("creator-1", previous, now, 0, settings);
const rare = slurpLiveNextSlot("creator-1", previous, now, 0, { ...settings, liveFrequency: "rare" });
const often = slurpLiveNextSlot("creator-1", previous, now, 0, { ...settings, liveFrequency: "often" });
assert.ok(rare.startsAt >= normal.startsAt && normal.startsAt >= often.startsAt);
assert.ok(slurpLiveNextSlot("creator-1", previous, now, 150, settings).startsAt <= normal.startsAt);
for (const slot of [rare, normal, often]) {
  assert.ok(slot.startsAt.getHours() >= 18 && slot.startsAt.getHours() < 24);
  assert.ok((slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000 >= 20);
  assert.ok((slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000 <= 40);
}
const morning = slurpLiveNextSlot("creator-2", previous, now, 0, { ...settings, liveStartHour: 8, liveEndHour: 10 });
assert.ok(morning.startsAt.getHours() >= 8 && morning.startsAt.getHours() < 10);
for (let hour = 0; hour < 24; hour++) {
  const instant = new Date(2026, 9, 23, hour, 58);
  const slot = slurpLiveNextSlot("creator-2", null, instant, 0, {
    ...settings,
    liveStartHour: 8,
    liveEndHour: 10,
  });
  assert.ok(slot.startsAt.getHours() >= 8 && slot.startsAt.getHours() < 10);
  assert.ok(slot.startsAt.getTime() >= instant.getTime() + 7 * 3_600_000);
}
const announced = Array.from({ length: 100 }, (_, i) =>
  slurpLiveNextSlot(`creator-${i}`, null, now, 0, settings),
).filter((slot) => slot.announcedFor);
assert.ok(announced.length >= 35 && announced.length <= 65, "about half of planned shows are announced");
const start = announced[0]!.startsAt;
const notice = {
  id: "show-1",
  startedAt: start.toISOString(),
  announcedFor: start.toISOString(),
  announcementPostId: null,
};
assert.equal(slurpLiveAnnouncementDue(notice, new Date(start.getTime() - 6 * 3_600_000)), false);
assert.equal(slurpLiveAnnouncementDue(notice, new Date(start.getTime() - 2 * 3_600_000)), true);
assert.equal(slurpLiveAnnouncementDue({ ...notice, announcementPostId: "post" }, start), false);
assert.match(slurpLiveAnnouncementText(start), /Live at/);
const active = (hostKind: "creator" | "player", hostId: string) => ({
  hostKind,
  hostId,
  startedNoticeAt: now.toISOString(),
  endedAt: null,
  endsAt: new Date(now.getTime() + 3_600_000).toISOString(),
});
assert.equal(slurpLiveMayStart([active("creator", "a"), active("creator", "b")], "creator", "c", now), false);
assert.equal(slurpLiveMayStart([active("creator", "a"), active("player", "p")], "creator", "b", now), true);
assert.equal(slurpLiveMayStart([active("player", "p")], "player", "q", now), false);
assert.equal(slurpLiveMayStart([active("creator", "a")], "creator", "a", now), false);
assert.deepEqual(slurpLiveDueNotifications(["one", "one", "two"], "two"), ["one"]);
assert.deepEqual(slurpLiveDueNotifications([], "two"), []);
assert.deepEqual(slurpLiveDueNotifications(["one"], null), ["one"]);
assert.equal(slurpLiveSettingsValid(settings), true);
assert.equal(slurpLiveSettingsValid({ ...settings, liveStartHour: 24 }), false);
assert.equal(slurpLiveSettingsValid({ ...settings, liveMinMinutes: 50 }), false);
assert.deepEqual(
  normalizeSlurpLiveSettings({ ...settings, liveStartHour: 24, liveMinMinutes: 50 }, settings),
  settings,
);
assert.deepEqual(normalizeSlurpLiveSettings(settings, settings), settings);
const source = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/modules/settings/slp-settings.ts");
assert.match(source, /liveFrequency: z\.enum\(\["rare", "normal", "often"\]\)/);
assert.match(source, /liveStartHour: z\.number\(\)\.int\(\)\.min\(0\)\.max\(23\)/);
assert.match(source, /liveEndHour: z\.number\(\)\.int\(\)\.min\(1\)\.max\(24\)/);
assert.match(source, /liveMinMinutes: z\.number\(\)\.int\(\)\.min\(10\)\.max\(120\)/);
assert.match(source, /liveMaxMinutes: z\.number\(\)\.int\(\)\.min\(10\)\.max\(120\)/);
console.log("slurp2 live schedule: ok");
