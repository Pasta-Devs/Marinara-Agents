import assert from "node:assert/strict";
import { test } from "node:test";
import {
  forgeAddCalendarDays,
  forgeCalendarDaysBetween,
  forgeDayKey,
  forgeMonthKey,
  forgeResetIn,
  forgeTimeZoneRoutes,
  forgeValidTimeZone,
  forgeWallDate,
  forgeWeekday,
  forgeWeekKey,
} from "../sources/forge-kit/time-zone-server.mjs";

const routes = new Map();
const api = forgeTimeZoneRoutes({
  get: (path, handler) => routes.set(path, handler),
  post: (path, handler) => routes.set(path, handler),
});
const inZone = (zone, callback) => {
  api.post("/fixture", callback);
  return routes.get("/fixture")({ body: { timeZone: zone } });
};

test("calendar dates follow the client on opposite sides of midnight", () => {
  const now = Date.parse("2026-10-25T00:30:00Z");
  assert.equal(
    inZone("Europe/Warsaw", () => forgeDayKey(now)),
    "2026-10-25",
  );
  assert.equal(
    inZone("America/Los_Angeles", () => forgeDayKey(now)),
    "2026-10-24",
  );
  assert.equal(
    inZone("Pacific/Kiritimati", () => forgeWallDate(now).getUTCHours()),
    14,
  );
});

test("unstarted reward calendars and invalid dates never count days since the Unix epoch", () => {
  const now = Date.parse("2026-10-25T11:00:00Z");
  for (const start of [0, null, undefined, "invalid"])
    assert.equal(
      inZone("Europe/Warsaw", () => forgeCalendarDaysBetween(start, now)),
      0,
    );
  assert.equal(
    inZone("Europe/Warsaw", () => forgeCalendarDaysBetween(now, now - 1)),
    0,
  );
});

test("daily resets honor 23-hour and 25-hour days", () => {
  for (const [stamp, hours] of [
    ["2026-03-28T23:00:00Z", 23],
    ["2026-10-24T22:00:00Z", 25],
  ]) {
    const time = Date.parse(stamp);
    assert.equal(
      inZone("Europe/Warsaw", () => forgeResetIn(time)),
      hours * 3600000,
    );
    assert.equal(
      inZone("Europe/Warsaw", () => forgeCalendarDaysBetween(time, time + hours * 3600000)),
      1,
    );
  }
});

test("weekly and monthly rotations use local calendar boundaries", () => {
  const sunday = Date.parse("2026-10-25T15:30:00Z");
  assert.equal(
    inZone("Asia/Tokyo", () => forgeWeekday(sunday)),
    0,
  );
  assert.equal(
    inZone("Asia/Tokyo", () => forgeWeekKey(sunday)),
    "2026-10-26",
  );
  assert.equal(
    inZone("UTC", () => forgeWeekKey(sunday)),
    "2026-10-19",
  );
  assert.equal(
    inZone("Asia/Tokyo", () => forgeMonthKey(Date.parse("2026-12-31T15:01:00Z"))),
    "2027-01",
  );
  const monthEnd = Date.parse("2026-10-31T14:00:00Z");
  assert.equal(
    inZone("Asia/Tokyo", () => forgeResetIn(monthEnd, "month")),
    3600000,
  );
});

test("new banner periods retain their local wall-clock time over a clock change", () => {
  const now = Date.parse("2026-10-18T10:15:00Z");
  assert.equal(
    inZone("Europe/Warsaw", () => new Date(forgeAddCalendarDays(now, 14)).toISOString()),
    "2026-11-01T11:15:00.000Z",
  );
});

test("parallel clients keep separate async timezone scopes and reject invalid names", async () => {
  api.get("/async", async (request) => {
    await new Promise((resolve) => setImmediate(resolve));
    return forgeDayKey(request.query.now);
  });
  const now = Date.parse("2026-10-25T00:30:00Z");
  const handler = routes.get("/async");
  assert.deepEqual(
    await Promise.all([
      handler({ query: { timeZone: "Europe/Warsaw", now } }),
      handler({ query: { timeZone: "America/Los_Angeles", now } }),
    ]),
    ["2026-10-25", "2026-10-24"],
  );
  assert.equal(forgeValidTimeZone("not/a-zone"), "UTC");
  assert.equal(forgeValidTimeZone({}), "UTC");
  assert.equal(
    inZone("not/a-zone", () => forgeDayKey(now)),
    "2026-10-25",
  );
});
