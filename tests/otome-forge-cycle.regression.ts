// Otome Forge's period tracker (M6, C/lib/cycle.ts and C/lib/cycle-storage.ts): today's state at every boundary (day
// n of a logged period, due in 3..1 days, due around today, nothing), never "late" (a passed prediction gives way to
// the next), irregular cycles predicting nothing, future and repeated starts ignored, the calendar's logged and
// predicted hearts, the day changing in two zones and across midnight; the care line's three templates with the
// protagonist's own pronoun ("their" by default) and nothing else accepted, its speak options without a cacheKey;
// storage that may be blocked, the export and import round trip (which never loosens the mode), Delete all (the cycle
// and care-note keys only, and a caring message still on its way is not kept), every change made to the tracker as
// stored now (so another tab's mode or Delete all is never overwritten), today's caring messages dropped when the day
// changes and tied to today's state, the opt-in birthday; and neither key ever appears in the server bundle.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  addDays,
  careLine,
  careLines,
  careSpeakOptions,
  careStateKey,
  cycleMarks,
  cycleToday,
  dayNumber,
  defaultCycle,
  isCareLine,
  logStart,
  nextPredictedStart,
  normalizeCycle,
  removeStart,
  STARTS_MAX,
  type CycleData,
  type CycleToday,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/cycle.ts";
import {
  CARE_NOTE_STORAGE_KEY,
  careNoteKey,
  CYCLE_STORAGE_KEY,
  browserStorage,
  deleteAllCycleData,
  deletionCount,
  dropStaleCareNotes,
  exportCycle,
  exportFileName,
  importCycle,
  isMonthDay,
  PROFILE_STORAGE_KEY,
  readCareNote,
  readCycle,
  readProfile,
  updateCycle,
  writeCareNote,
  writeCycle,
  writeProfile,
  type StorageLike,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/cycle-storage.ts";
import { localDay } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/tap-mood.ts";
import { playsHomeCue } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/screens/screens.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** An in-memory localStorage. */
function memoryStorage(seed: Record<string, string> = {}) {
  const items = new Map(Object.entries(seed));
  const storage: StorageLike = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, String(value)),
    removeItem: (key) => void items.delete(key),
  };
  return { storage, items };
}

/** A browser that refuses storage (a private window, blocked site data): every call throws. */
const blocked: StorageLike = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

const START = "2026-10-01";
const on = (patch: Partial<CycleData> = {}): CycleData => ({
  ...defaultCycle(),
  enabled: true,
  starts: [START],
  ...patch,
});
const at = (data: CycleData, offset: number) => cycleToday(data, addDays(START, offset));

test("today at every boundary: day 1..n of a logged period, due in 3, 2, 1 days, around today, then nothing", () => {
  const data = on(); // 28-day cycle, 5-day period
  assert.deepEqual(at(data, 0), { kind: "day", n: 1 });
  assert.deepEqual(at(data, 4), { kind: "day", n: 5 });
  assert.equal(at(data, 5), null);
  assert.equal(at(data, 24), null);
  assert.deepEqual(at(data, 25), { kind: "due", inDays: 3 });
  assert.deepEqual(at(data, 26), { kind: "due", inDays: 2 });
  assert.deepEqual(at(data, 27), { kind: "due", inDays: 1 });
  assert.deepEqual(at(data, 28), { kind: "due-today" });
  // The predicted day passed with nothing logged: never "late", just the next cycle's prediction.
  assert.equal(at(data, 29), null);
  assert.deepEqual(at(data, 28 + 25), { kind: "due", inDays: 3 });
  assert.deepEqual(at(data, 56), { kind: "due-today" });
  // A start logged on the 30th day counts from there.
  const logged = logStart(data, addDays(START, 30), addDays(START, 30));
  assert.deepEqual(at(logged, 31), { kind: "day", n: 2 });
  assert.deepEqual(at(logged, 30 + 28), { kind: "due-today" });

  // Lengths at their limits.
  assert.deepEqual(at(on({ periodLength: 2 }), 1), { kind: "day", n: 2 });
  assert.equal(at(on({ periodLength: 2 }), 2), null);
  assert.deepEqual(at(on({ periodLength: 8 }), 7), { kind: "day", n: 8 });
  assert.deepEqual(at(on({ cycleLength: 21 }), 21), { kind: "due-today" });
  assert.deepEqual(at(on({ cycleLength: 45 }), 42), { kind: "due", inDays: 3 });
});

test("never late: over two years after one start, today is only ever a period day, a prediction soon, or nothing", () => {
  for (const cycleLength of [21, 28, 35, 45]) {
    const data = on({ cycleLength });
    let previous: CycleToday | null = null;
    for (let offset = 0; offset < 760; offset += 1) {
      const state = at(data, offset);
      assert.ok(state === null || ["day", "due", "due-today"].includes(state.kind), JSON.stringify(state));
      if (state?.kind === "day") assert.ok(offset < data.periodLength, "day n only from a logged start");
      if (state?.kind === "due") assert.ok(state.inDays >= 1 && state.inDays <= 3);
      // After "around today" comes nothing, never a count past the predicted day.
      if (previous?.kind === "due-today") assert.equal(state, null);
      previous = state;
    }
  }
});

test("off, nothing logged, irregular, future and repeated starts", () => {
  assert.equal(cycleToday(defaultCycle(), START), null, "off by default");
  assert.equal(cycleToday({ ...on(), enabled: false }, START), null);
  assert.equal(cycleToday(on({ starts: [] }), START), null);
  assert.equal(cycleToday(on(), "not-a-day"), null);
  // Irregular: only logged starts count, so nothing is ever predicted.
  const irregular = on({ irregular: true });
  assert.deepEqual(at(irregular, 2), { kind: "day", n: 3 });
  for (let offset = 5; offset < 120; offset += 1) assert.equal(at(irregular, offset), null);
  assert.equal(nextPredictedStart(irregular, START), null);
  // A start after today is not counted (and logStart refuses one).
  assert.equal(cycleToday(on({ starts: [addDays(START, 1)] }), START), null);
  const today = addDays(START, 10);
  assert.equal(logStart(on(), addDays(today, 1), today).starts.length, 1);
  assert.deepEqual(logStart(on(), START, today).starts, [START], "a repeat changes nothing");
  // The newest start on or before today wins.
  const two = on({ starts: [START, addDays(START, 29)] });
  assert.deepEqual(at(two, 30), { kind: "day", n: 2 });
  assert.deepEqual(removeStart(two, START).starts, [addDays(START, 29)]);
  assert.equal(nextPredictedStart(two, addDays(START, 30)), addDays(START, 29 + 28));
});

test("stored data is read field by field: damaged values take their defaults, dates are real, starts capped", () => {
  assert.deepEqual(normalizeCycle(null), defaultCycle());
  assert.deepEqual(normalizeCycle("{}"), defaultCycle());
  const read = normalizeCycle({
    version: 9,
    enabled: "yes",
    mode: "send-everything",
    cycleLength: 60,
    periodLength: 1.5,
    irregular: 1,
    starts: ["2026-02-30", "2026-10-05", "2026-10-01", "2026-10-05", "10/01/2026", 20261001, null],
  });
  assert.deepEqual(read, { ...defaultCycle(), starts: ["2026-10-01", "2026-10-05"] });
  assert.equal(normalizeCycle({ enabled: true, mode: "keep-off-model" }).mode, "keep-off-model");
  const many = Array.from({ length: STARTS_MAX + 30 }, (_, index) => addDays("2000-01-01", index * 28));
  const capped = normalizeCycle({ starts: many.reverse() }).starts;
  assert.equal(capped.length, STARTS_MAX);
  assert.equal(capped.at(-1), many[0], "the newest starts are kept, oldest first");
  assert.ok(Number.isNaN(dayNumber("2025-02-29")));
  assert.equal(dayNumber("2024-02-29") - dayNumber("2024-02-28"), 1);
});

test("the calendar's hearts: logged days up to today, the rest predicted, passed predictions never drawn", () => {
  const today = addDays(START, 2);
  const marks = cycleMarks(on(), "2026-09-25", "2026-11-30", today);
  assert.equal(marks.get(START), "logged");
  assert.equal(marks.get(addDays(START, 2)), "logged");
  assert.equal(marks.get(addDays(START, 3)), "predicted", "the rest of this period is still to come");
  assert.equal(marks.get(addDays(START, 4)), "predicted");
  assert.equal(marks.get(addDays(START, 5)), undefined);
  for (let day = 28; day < 33; day += 1) assert.equal(marks.get(addDays(START, day)), "predicted");
  assert.equal(marks.get(addDays(START, 33)), undefined);
  assert.equal(marks.get("2026-09-30"), undefined);
  // Seen from after the predicted start passed unlogged: that period is not drawn, the next one is.
  const later = cycleMarks(on(), "2026-10-01", "2026-12-31", addDays(START, 30));
  assert.equal(later.get(addDays(START, 28)), undefined);
  assert.equal(later.get(addDays(START, 30)), undefined);
  assert.equal(later.get(addDays(START, 56)), "predicted");
  assert.equal(later.get(START), "logged");
  // Irregular: only what was logged, the rest of a period still going included (its legend has no "predicted").
  const irregular = cycleMarks(on({ irregular: true }), "2026-10-01", "2026-12-31", addDays(START, 10));
  assert.deepEqual([...irregular.values()], Array(5).fill("logged"));
  const going = cycleMarks(on({ irregular: true }), "2026-10-01", "2026-12-31", addDays(START, 1));
  assert.deepEqual(
    [...going],
    [
      [START, "logged"],
      [addDays(START, 1), "logged"],
    ],
  );
  assert.equal(cycleMarks({ ...on(), enabled: false }, "2026-10-01", "2026-12-31", today).size, 0);
});

test("days follow the conversation's time zone: one instant is two days in two zones, and midnight moves it", () => {
  const data = on({ starts: ["2026-10-25"] });
  const instant = new Date("2026-10-28T22:30:00Z");
  const warsaw = localDay("Europe/Warsaw", instant);
  const auckland = localDay("Pacific/Auckland", instant);
  assert.equal(warsaw, "2026-10-28");
  assert.equal(auckland, "2026-10-29");
  assert.deepEqual(cycleToday(data, warsaw), { kind: "day", n: 4 });
  assert.deepEqual(cycleToday(data, auckland), { kind: "day", n: 5 });
  // Across Warsaw's midnight (UTC+1 after the clocks went back on 25 October).
  assert.deepEqual(cycleToday(data, localDay("Europe/Warsaw", new Date("2026-10-28T22:59:00Z"))), {
    kind: "day",
    n: 4,
  });
  assert.deepEqual(cycleToday(data, localDay("Europe/Warsaw", new Date("2026-10-28T23:01:00Z"))), {
    kind: "day",
    n: 5,
  });
  assert.equal(cycleToday(data, localDay("Europe/Warsaw", new Date("2026-10-29T23:01:00Z"))), null);
});

test("the care line: three templates in English with the protagonist's own pronoun, and nothing else passes", () => {
  const mira = { name: "Mira Vale", pronouns: { possessive: "her" } };
  assert.equal(careLine({ kind: "day", n: 2 }, mira), "Mira Vale has told you: today is day 2 of her period.");
  assert.equal(careLine({ kind: "due", inDays: 3 }, mira), "Mira Vale has told you: her period is due in 3 days.");
  assert.equal(careLine({ kind: "due", inDays: 1 }, mira), "Mira Vale has told you: her period is due in 1 day.");
  assert.equal(careLine({ kind: "due-today" }, mira), "Mira Vale has told you: her period is due around today.");
  // "their" by default, and whatever the profile says otherwise.
  assert.equal(careLine({ kind: "day", n: 1 }, { name: "Ash" }), "Ash has told you: today is day 1 of their period.");
  assert.equal(
    careLine({ kind: "day", n: 1 }, { name: "Ash", pronouns: { possessive: "  " } }),
    "Ash has told you: today is day 1 of their period.",
  );
  assert.equal(
    careLine({ kind: "due-today" }, { name: "Rin", pronouns: { possessive: "xyr" } }),
    "Rin has told you: xyr period is due around today.",
  );
  assert.equal(careLines(mira).length, 1 + 8 + 3);
  for (const line of careLines(mira)) assert.ok(isCareLine(line, mira));
  for (const line of [
    "Mira Vale has told you: today is day 9 of her period.",
    "Mira Vale has told you: her period is late.",
    "Mira Vale has told you: today is day 2 of her period. Her last three started on 1, 29 and 27.",
    "Mira Vale has told you:  today is day 2 of her period.",
    "Mira has told you: today is day 2 of her period.",
    "Mira Vale has told you: today is day 2 of their period.",
    "",
    null,
  ]) {
    assert.equal(isCareLine(line, mira), false, String(line));
  }
  // Voiced through M2b's audio with caching off: no cacheKey, so the Engine's audio cache never holds it.
  assert.deepEqual(careSpeakOptions(), { cache: false });
});

test("storage may be missing or blocked: reads fall back to the defaults and writes report they were not kept", () => {
  assert.equal(browserStorage(), null, "no window here");
  assert.deepEqual(readCycle(null), defaultCycle());
  assert.equal(writeCycle(on(), null), false);
  assert.deepEqual(readCycle(blocked), defaultCycle());
  assert.equal(writeCycle(on(), blocked), false);
  assert.equal(deleteAllCycleData(blocked), false);
  assert.equal(readCareNote("2026-10-28", "k", blocked), null);
  assert.equal(
    writeCareNote("2026-10-28", "k", { text: "Rest.", source: "pool", state: "day:2", at: "" }, blocked),
    false,
  );
  assert.deepEqual(readProfile(blocked), { version: 1, birthday: null });
  assert.equal(writeProfile({ version: 1, birthday: "03-14" }, blocked), false);
  // Damaged JSON reads as the defaults too.
  const { storage } = memoryStorage({ [CYCLE_STORAGE_KEY]: "{not json" });
  assert.deepEqual(readCycle(storage), defaultCycle());
  // A write keeps only the checked shape.
  assert.equal(writeCycle({ ...on(), starts: [START, "garbage"] } as CycleData, storage), true);
  assert.deepEqual(readCycle(storage), on());
});

test("export and import move the logged days between devices, and an import never loosens the mode", () => {
  const phone = on({ cycleLength: 31, periodLength: 6, irregular: true, starts: ["2026-08-29", "2026-09-29", START] });
  const file = exportCycle(phone, new Date("2026-10-28T09:00:00Z"));
  const parsed = JSON.parse(file);
  assert.deepEqual(Object.keys(parsed).sort(), [
    "cycleLength",
    "exportedAt",
    "format",
    "irregular",
    "periodLength",
    "starts",
    "version",
  ]);
  assert.equal(exportFileName("2026-10-28"), "otome-forge-cycle-2026-10-28.json");

  const laptop: CycleData = { ...defaultCycle(), enabled: true, mode: "keep-off-model" };
  const read = importCycle(file, laptop);
  assert.ok(read.ok);
  assert.deepEqual(read.data, { ...phone, enabled: true, mode: "keep-off-model" });
  // Round trip: export what was imported, import it again, same data.
  const again = importCycle(exportCycle(read.data), laptop);
  assert.ok(again.ok);
  assert.deepEqual(again.data, read.data);

  assert.deepEqual(importCycle("not json", laptop), { ok: false, reason: "unreadable" });
  assert.deepEqual(importCycle("[]", laptop), { ok: false, reason: "not-cycle" });
  assert.deepEqual(importCycle(JSON.stringify({ format: "gacha-forge", version: 1, starts: [] }), laptop), {
    ok: false,
    reason: "not-cycle",
  });
  const damaged = importCycle(JSON.stringify({ ...parsed, cycleLength: 99, starts: ["2026-13-01", START] }), laptop);
  assert.ok(damaged.ok);
  assert.equal(damaged.data.cycleLength, 28);
  assert.deepEqual(damaged.data.starts, [START]);
});

test("Delete all cycle data removes the tracker and today's caring messages in one go, and nothing else", () => {
  const today = "2026-10-28";
  const { storage, items } = memoryStorage({
    "otome-forge:look:v1": "pearl",
    "marinara-engine-ui": "{}",
    [PROFILE_STORAGE_KEY]: JSON.stringify({ version: 1, birthday: "03-14" }),
  });
  writeCycle(on(), storage);
  const entry = { text: "Rest.", source: "model" as const, state: "day:2", at: "" };
  writeCareNote(today, careNoteKey("r-1", "li-ilvar-0001"), entry, storage);
  assert.ok(items.has(CYCLE_STORAGE_KEY) && items.has(CARE_NOTE_STORAGE_KEY));
  const before = deletionCount();
  assert.equal(deleteAllCycleData(storage), true);
  assert.equal(deletionCount(), before + 1, "a caring message still on its way sees the deletion");
  assert.equal(items.has(CYCLE_STORAGE_KEY), false);
  assert.equal(items.has(CARE_NOTE_STORAGE_KEY), false);
  assert.deepEqual([...items.keys()].sort(), ["marinara-engine-ui", "otome-forge:look:v1", PROFILE_STORAGE_KEY].sort());
  assert.deepEqual(readCycle(storage), defaultCycle(), "off again, as by default");
  assert.equal(deleteAllCycleData(storage), true, "deleting nothing is fine");
});

test("today's caring messages are kept per love interest for the day only, and go when the day changes", () => {
  const { storage, items } = memoryStorage();
  const ilvar = careNoteKey("r-1", "li-ilvar-0001");
  const cassian = careNoteKey("r-1", "li-cassian-0002");
  writeCareNote("2026-10-28", ilvar, { text: "Tea first.", source: "model", state: "day:2", at: "a" }, storage);
  writeCareNote("2026-10-28", cassian, { text: "Rest here.", source: "pool", state: "day:2", at: "b" }, storage);
  assert.deepEqual(readCareNote("2026-10-28", ilvar, storage), {
    text: "Tea first.",
    source: "model",
    state: "day:2",
    at: "a",
  });
  assert.equal(readCareNote("2026-10-28", cassian, storage)?.text, "Rest here.");
  assert.equal(readCareNote("2026-10-28", careNoteKey("r-2", "li-ilvar-0001"), storage), null);
  // The next day: nothing, and yesterday's are removed as soon as they are seen.
  assert.equal(readCareNote("2026-10-29", ilvar, storage), null);
  assert.equal(items.has(CARE_NOTE_STORAGE_KEY), false);
  writeCareNote("2026-10-28", ilvar, { text: "Tea first.", source: "model", state: "day:2", at: "a" }, storage);
  dropStaleCareNotes("2026-10-29", storage);
  assert.equal(items.has(CARE_NOTE_STORAGE_KEY), false);
  // Why this browser picked a comfort line itself is kept with it; anything else is dropped.
  writeCareNote(
    "2026-10-28",
    ilvar,
    { text: "Rest.", source: "pool", reason: "kept-off", state: "due:1", at: "c" },
    storage,
  );
  assert.deepEqual(readCareNote("2026-10-28", ilvar, storage), {
    text: "Rest.",
    source: "pool",
    reason: "kept-off",
    state: "due:1",
    at: "c",
  });
  items.set(
    CARE_NOTE_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      dayKey: "2026-10-28",
      notes: { [ilvar]: { text: "Rest.", source: "x", reason: "y" } },
    }),
  );
  assert.deepEqual(readCareNote("2026-10-28", ilvar, storage), { text: "Rest.", source: "pool", state: "", at: "" });
  // A damaged entry is skipped, not shown.
  items.set(
    CARE_NOTE_STORAGE_KEY,
    JSON.stringify({ version: 1, dayKey: "2026-10-28", notes: { [ilvar]: { text: 3 } } }),
  );
  assert.equal(readCareNote("2026-10-28", ilvar, storage), null);
});

test("a caring message answers one state of the day: a start logged later makes the kept one stale", () => {
  const keys = [
    careStateKey({ kind: "day", n: 1 }),
    careStateKey({ kind: "day", n: 2 }),
    careStateKey({ kind: "due", inDays: 1 }),
    careStateKey({ kind: "due", inDays: 2 }),
    careStateKey({ kind: "due-today" }),
  ];
  assert.deepEqual(keys, ["day:1", "day:2", "due:1", "due:2", "due-today"]);
  // Due tomorrow in the morning; the period starts and is logged the same day.
  const today = addDays(START, 27);
  const due = cycleToday(on(), today)!;
  assert.deepEqual(due, { kind: "due", inDays: 1 });
  const { storage } = memoryStorage();
  const key = careNoteKey("r-1", "li-ilvar-0001");
  writeCareNote(today, key, { text: "It’s coming soon.", source: "model", state: careStateKey(due), at: "" }, storage);
  const started = cycleToday(logStart(on(), today, today), today)!;
  assert.deepEqual(started, { kind: "day", n: 1 });
  assert.notEqual(readCareNote(today, key, storage)?.state, careStateKey(started), "Caring message asks again");
});

test("every change is made to the tracker as stored now: another tab's mode or Delete all is never overwritten", () => {
  // Two tabs share one storage; tab A read the tracker before tab B changed it.
  const { storage, items } = memoryStorage();
  const starts = ["2026-08-04", "2026-09-01", START];
  writeCycle(on({ starts }), storage);
  const tabA = readCycle(storage);
  writeCycle({ ...readCycle(storage), mode: "keep-off-model" }, storage);
  const later = updateCycle(tabA, false, (data) => ({ ...data, cycleLength: 30 }), storage);
  assert.equal(later.kept, true);
  assert.equal(later.data.mode, "keep-off-model", "tab B's stricter mode stays");
  assert.equal(readCycle(storage).cycleLength, 30);

  // Tab B deletes everything; tab A then logs a start from its old screen: no deleted day comes back.
  deleteAllCycleData(storage);
  const logged = updateCycle(
    tabA,
    false,
    (data) => (data.enabled ? logStart(data, "2026-10-20", "2026-10-28") : data),
    storage,
  );
  assert.deepEqual(logged.data, defaultCycle());
  assert.equal(items.has(CYCLE_STORAGE_KEY), false, "a change that changes nothing writes nothing");
  const length = updateCycle(tabA, false, (data) => ({ ...data, periodLength: 6 }), storage);
  assert.deepEqual(length.data.starts, [], "a length set from the old screen brings back no start");
  assert.equal(readCycle(storage).enabled, false);

  // A browser that keeps nothing: the screen's own copy is the only one, and changes build on it.
  const first = updateCycle(defaultCycle(), false, (data) => ({ ...data, enabled: true }), blocked);
  assert.deepEqual([first.kept, first.data.enabled], [false, true]);
  const second = updateCycle(first.data, true, (data) => logStart(data, START, "2026-10-28"), blocked);
  assert.deepEqual([second.kept, second.data.enabled, second.data.starts], [false, true, [START]]);
});

test("the player's birthday is opt-in, a real month and day, and removed when cleared", () => {
  for (const value of ["03-14", "02-29", "12-31", "01-01"]) assert.ok(isMonthDay(value), value);
  for (const value of ["02-30", "04-31", "13-01", "00-10", "3-14", "2026-03-14", null]) {
    assert.equal(isMonthDay(value), false, String(value));
  }
  const { storage, items } = memoryStorage();
  assert.deepEqual(readProfile(storage), { version: 1, birthday: null });
  assert.equal(writeProfile({ version: 1, birthday: "02-29" }, storage), true);
  assert.equal(readProfile(storage).birthday, "02-29");
  assert.equal(writeProfile({ version: 1, birthday: null }, storage), true);
  assert.equal(items.has(PROFILE_STORAGE_KEY), false);
});

test("the server bundle never names the tracker's or the caring messages' storage", () => {
  const server = readFileSync(join(root, "packages/otome-forge/server.mjs"), "utf8");
  const client = readFileSync(join(root, "packages/otome-forge/client.js"), "utf8");
  for (const key of [CYCLE_STORAGE_KEY, CARE_NOTE_STORAGE_KEY, PROFILE_STORAGE_KEY]) {
    assert.equal(server.includes(key), false, `server.mjs names ${key}`);
    assert.ok(client.includes(key), `client.js keeps ${key}`);
  }
});

test("Remind Me is a screen of the story: M2b's home music plays on beneath it and the tracker it opens", () => {
  assert.equal(playsHomeCue("remind", "home"), true);
  assert.equal(playsHomeCue("settings", "remind"), true, "Settings → Tracker, opened from Remind Me");
});
