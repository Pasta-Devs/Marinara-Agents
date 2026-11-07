// Otome Hearth (#2153): birthdays. A love interest's bible birthday can be celebrated from Remind Me on the day and for
// the 7 days after it, once per birthday year, with one of her Shop gifts or none.
// - The window: the day and 7 late days, across the new year, 02-29 on 02-28 in a common year, nothing for a date no
//   year has, and the scene key's round trip.
// - The offers: only once the story is forged and a chapter after the prologue is read; never before he joined the
//   cast (read in the request's time zone); never for someone gone or without a bible; `started` once registered;
//   gone once read; an edited birthday never celebrates a year twice.
// - Celebrate makes no model call, does not wait on the run's foreground queue, builds a one-node Character Story and
//   spends exactly one gift in the write that registers it; a double tap or a resend resumes; each refusal (409
//   conflict, 409 locked, 404) leaves no scene and spends nothing; a run deleted meanwhile leaves no scene.
// - The scene's guide names the birthday or how many days late it is (1 day, 3 days), and the gift or none; the
//   aphrodisiac's sentence comes only with the aphrodisiac, which NSFW Heat spends like any gift.
// - Reading the scene to its end pays its beat and the gift's affection, uncapped; a replay pays nothing; a figurine
//   scene still pays only its beat. The gift and the birthday reach only the last, uncached message; the cached
//   messages are a figurine scene's, byte for byte; the scene is his private Character Story.
// - The Home note's birthday line falls on 02-28 in a common year; Home and the calendar send `celebrate` only when
//   there is one; a stored chapter's gift reads back, an unknown one is dropped, and the client never sees it.
import assert from "node:assert/strict";
import test from "node:test";
import { forgeTimeZoneRoutes } from "@forge-kit/time-zone-server.mjs";
import type {
  Chapter,
  RunState,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  BIRTHDAY_LATE_DAYS,
  birthdayIn,
  birthdayOfKey,
  birthdaySceneKey,
  birthdayWindow,
  lastBirthday,
  realMonthDay,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/birthdays.ts";
import { defaultContent } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import {
  figurineLiOf,
  figurineSceneKey,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/shop.ts";
import { addDays } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/wish.ts";
import { runForeground } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/generation.ts";
import {
  birthdayOffers,
  celebrateBirthday,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/home/birthday.ts";
import { noteDay } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/home/note.ts";
import type {
  OtomeReply,
  RouteDeps,
  RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  chapterId,
  isChapterKey,
  runDocTarget,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  birthdayStoryChapter,
  ensureFigurineStory,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/items/character-story.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import { registerCareRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/care.ts";
import { registerHomeRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/home.ts";
import { registerStoryRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/story.ts";
import {
  normalizeState,
  readRun,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeChapter,
  toChapterView,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { readBeatToEnd } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/state/rewards.ts";
import { KAI, MIR, SOL, beatReply, bible, json, storyWorld } from "./fixtures/otome-forge-story.ts";

const IMPOSSIBLE = ["02-30", "02-31", "04-31", "06-31", "09-31", "11-31"];
const MET = { "main-1": { beatsRead: 6, completed: "2026-10-30T20:00:00.000Z", applied: [] } };

function code(error: unknown): string | undefined {
  return (error as { code?: string }).code;
}

/** Runs `work` in `zone`, as a route does (the kit's time zones wrap every route by its request's `timeZone`). */
function inZone<T>(zone: string, work: () => T): T {
  let result!: T;
  const router = forgeTimeZoneRoutes({
    get: (_path: string, handler: (request: unknown) => unknown) => handler({ query: { timeZone: zone } }),
    post: () => undefined,
  });
  router.get("/", () => {
    result = work();
  });
  return result;
}

test("the birthday window: the day and 7 late days, across the new year, 02-29 in a common year, none for no day", () => {
  assert.equal(BIRTHDAY_LATE_DAYS, 7);
  assert.deepEqual(birthdayWindow("11-07", "2026-11-07"), { year: 2026, day: "2026-11-07", daysLate: 0 });
  assert.deepEqual(birthdayWindow("11-07", "2026-11-14"), { year: 2026, day: "2026-11-07", daysLate: 7 });
  assert.equal(birthdayWindow("11-07", "2026-11-15"), null, "8 days late is too late");
  assert.equal(birthdayWindow("11-07", "2026-11-06"), null, "the day before is not yet");
  assert.deepEqual(birthdayWindow("12-30", "2027-01-03"), { year: 2026, day: "2026-12-30", daysLate: 4 });
  assert.deepEqual(lastBirthday("11-07", "2026-11-20"), { year: 2026, day: "2026-11-07", daysLate: 13 });
  // 02-29 is on 02-28 in a common year, the day Remind Me's grid draws it, and on its own day in a leap year.
  assert.equal(birthdayIn("02-29", 2027), "2027-02-28");
  assert.equal(birthdayIn("02-29", 2028), "2028-02-29");
  assert.deepEqual(birthdayWindow("02-29", "2027-02-28"), { year: 2027, day: "2027-02-28", daysLate: 0 });
  assert.deepEqual(birthdayWindow("02-29", "2027-03-01"), { year: 2027, day: "2027-02-28", daysLate: 1 });
  assert.deepEqual(birthdayWindow("02-29", "2028-02-29"), { year: 2028, day: "2028-02-29", daysLate: 0 });
  assert.equal(birthdayWindow("02-29", "2028-02-28"), null);
  // A date no year has is no birthday, on any day: nothing on 03-02 or 05-01 either.
  for (const md of IMPOSSIBLE) {
    assert.equal(realMonthDay(md), false, md);
    for (let day = "2027-01-01"; day <= "2028-12-31"; day = addDays(day, 1)) {
      assert.equal(birthdayWindow(md, day), null, `${md} on ${day}`);
    }
  }
  assert.ok(["01-31", "02-29", "04-30", "12-31"].every(realMonthDay));
  assert.ok(!["13-01", "00-10", "1-01", "", 101].some(realMonthDay));

  // The scene's key round-trips, fits a chapter key with the longest love interest id, and is no figurine's.
  const longest = "li-abcdefghijklmnop-ab12";
  assert.equal(birthdaySceneKey(KAI, 2026), "story-birthday-li-kai-ab12-2026");
  assert.deepEqual(birthdayOfKey(birthdaySceneKey(longest, 2026)), { li: longest, year: 2026 });
  assert.ok(isChapterKey(birthdaySceneKey(longest, 2026)));
  assert.equal(birthdayOfKey(figurineSceneKey(KAI)), null);
  assert.equal(figurineLiOf(birthdaySceneKey(KAI, 2026)), null);
  assert.equal(birthdayOfKey("story-birthday-li-kai-ab12"), null);
});

test("birthday offers: forged and met, never before he joined, never for someone gone, started, read, edited", async () => {
  const t = await storyWorld({ runKey: "r-bday01-aaaaaa" });
  const base = (await readRun(t.store, t.runId))!;
  const withBirthdays = (lis: Record<string, string>) => ({
    ...base,
    units: base.units.map((unit) => (lis[unit.id] ? { ...unit, bible: bible({ birthday: lis[unit.id] }) } : unit)),
  });
  const run = withBirthdays({ [KAI]: "11-07", [MIR]: "11-01", [SOL]: "02-30" });
  const today = "2026-11-07";

  assert.deepEqual(birthdayOffers(run, today), [], "no chapter read yet");
  const prologueOnly = {
    ...run,
    state: { ...run.state, chapters: { prologue: { beatsRead: 1, completed: "2026-10-28T11:00:00Z", applied: [] } } },
  };
  assert.deepEqual(birthdayOffers(prologueOnly, today), [], "the prologue meets no one");
  const met = { ...run, state: { ...run.state, chapters: MET } };
  assert.deepEqual(birthdayOffers(met, today), [
    { li: KAI, day: "2026-11-07", daysLate: 0, started: false },
    { li: MIR, day: "2026-11-01", daysLate: 6, started: false },
  ]);
  assert.deepEqual(
    birthdayOffers({ ...met, world: { ...met.world, forge: { phase: "units", steps: [] } } }, today),
    [],
  );

  // Not before the day he joined the cast; a createdAt that does not read sets no bound.
  const joined = {
    ...met,
    units: met.units.map((unit) =>
      unit.id === MIR ? { ...unit, createdAt: "2026-11-03T10:00:00.000Z" } : { ...unit, createdAt: "" },
    ),
  };
  assert.deepEqual(
    birthdayOffers(joined, today).map((offer) => offer.li),
    [KAI],
  );
  // Gone from the story, or with no bible: no birthday.
  const { [KAI]: _gone, ...lis } = met.state.lis;
  assert.deepEqual(
    birthdayOffers({ ...met, state: { ...met.state, lis } }, today).map((offer) => offer.li),
    [MIR],
  );
  assert.deepEqual(birthdayOffers({ ...met, units: met.units.map((unit) => ({ ...unit, bible: null })) }, today), []);

  // Started once registered; gone once read; an edited birthday in the same year offers nothing again.
  const key = birthdaySceneKey(KAI, 2026);
  const started = {
    ...met,
    state: { ...met.state, chapters: { ...MET, [key]: { beatsRead: 0, completed: null, applied: [] } } },
  };
  assert.deepEqual(birthdayOffers(started, today)[0], { li: KAI, day: "2026-11-07", daysLate: 0, started: true });
  const read = {
    ...met,
    state: {
      ...met.state,
      chapters: { ...MET, [key]: { beatsRead: 1, completed: "2026-11-07T12:00:00Z", applied: [] } },
    },
  };
  assert.deepEqual(
    birthdayOffers(read, today).map((offer) => offer.li),
    [MIR],
  );
  const edited = { ...read, units: withBirthdays({ [KAI]: "11-05", [MIR]: "11-01" }).units };
  assert.deepEqual(
    birthdayOffers(edited, today).map((offer) => offer.li),
    [MIR],
    "that year's birthday was celebrated",
  );

  // He joined at 23:30 UTC on 11-06, which is already 11-07 in Tokyo: a 11-06 birthday is his in UTC only.
  const late = {
    ...withBirthdays({ [KAI]: "11-06" }),
    state: { ...run.state, chapters: MET },
  };
  late.units = late.units.map((unit) => (unit.id === KAI ? { ...unit, createdAt: "2026-11-06T23:30:00.000Z" } : unit));
  const kaiIn = (zone: string) => inZone(zone, () => birthdayOffers(late, "2026-11-08")).filter((o) => o.li === KAI);
  assert.deepEqual(kaiIn("UTC"), [{ li: KAI, day: "2026-11-06", daysLate: 2, started: false }]);
  assert.deepEqual(kaiIn("Asia/Tokyo"), []);
});

/** Home, the calendar and the story routes on a fake router in the kit's time zones; `call` answers as Fastify does. */
function birthdayRoutes(deps: RouteDeps, runKey: string) {
  const routes = new Map<string, RouteHandler>();
  const collect =
    (method: "GET" | "POST") =>
    (path: string, ...rest: unknown[]) =>
      routes.set(`${method} ${path}`, rest.at(-1) as RouteHandler);
  const router = forgeTimeZoneRoutes({ get: collect("GET"), post: collect("POST") });
  registerHomeRoutes(router, deps);
  registerCareRoutes(router, deps);
  registerStoryRoutes(router, deps);
  return async (method: "GET" | "POST", path: string, body: object = {}, params: Record<string, string> = {}) => {
    const handler = routes.get(`${method} ${path}`);
    assert.ok(handler, `${method} ${path} is registered`);
    let status = 200;
    let payload: unknown;
    const reply: OtomeReply = {
      status(value) {
        status = value;
        return reply;
      },
      send(value) {
        payload = value;
        return reply;
      },
    };
    const fields = { timeZone: "UTC", debugMode: false };
    const result = await handler(
      {
        method,
        url: path,
        body: method === "POST" ? { ...fields, ...body } : undefined,
        params: { run: runKey, ...params },
        query: method === "GET" ? fields : {},
      },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as Record<string, any> };
  };
}

/** Today in UTC, as the routes read it with `timeZone: "UTC"`. */
const utcToday = () => new Date().toISOString().slice(0, 10);

/** A met story whose love interests' birthdays are `birthdays` (MM-DD) and whose protagonist owns `gifts`. */
async function birthdayWorld(
  runKey: string,
  { birthdays = {}, gifts = {}, replies = [] as string[], content = defaultContent() } = {} as {
    birthdays?: Record<string, string>;
    gifts?: RunState["owned"]["gifts"];
    replies?: string[];
    content?: ReturnType<typeof defaultContent>;
  },
) {
  const t = await storyWorld({ runKey, replies, content });
  // Anyone not named has a birthday far from today, so the day the tests run never offers it.
  const far = addDays(utcToday(), 100).slice(5);
  for (const [li, birthday] of Object.entries({ [KAI]: far, [MIR]: far, [SOL]: far, ...birthdays })) {
    await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, li)), normalizeUnit, (unit) => ({
      ...unit,
      bible: bible({ birthday }),
    }));
  }
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: MET,
    owned: { ...state.owned, gifts },
  }));
  const call = birthdayRoutes(t.deps, runKey);
  const chapter = (key: string) => t.store.readDoc(chapterId(t.runId, key), normalizeChapter);
  return { ...t, call, chapter };
}

test("Celebrate makes no model call, waits on no queue, and spends one gift in the write that registers the scene", async () => {
  const today = utcToday();
  const md = today.slice(5);
  const t = await birthdayWorld("r-bday02-bbbbbb", {
    birthdays: { [KAI]: md, [MIR]: md },
    gifts: { flowers: 1, chocolates: 1 },
  });
  // A scene being written ahead holds the run's foreground queue: Celebrate answers all the same.
  let release!: () => void;
  const held = runForeground(t.runId, () => new Promise<void>((resolve) => (release = resolve)));
  try {
    const celebrated = await t.call("POST", "/runs/:run/home/birthday", { li: KAI, gift: "flowers" });
    assert.equal(celebrated.status, 200, JSON.stringify(celebrated.body));
    const key = birthdaySceneKey(KAI, Number(today.slice(0, 4)));
    assert.deepEqual(celebrated.body, { key, resumed: false });
    assert.equal(t.calls.length, 0, "no model call");

    const chapter = (await t.chapter(key))!;
    assert.deepEqual(
      { kind: chapter.kind, li: chapter.li, lead: chapter.lead, gift: chapter.gift, title: chapter.title },
      { kind: "story", li: KAI, lead: KAI, gift: "flowers", title: "Kai's Birthday" },
    );
    assert.equal(chapter.nodes.length, 1);
    assert.deepEqual(chapter.nodes[0]!.cast, [KAI]);
    assert.equal(chapter.nodes[0]!.cg, undefined);
    const guide = chapter.nodes[0]!.guide;
    assert.match(guide, /^A BIRTHDAY SCENE between Kai and the protagonist: today is Kai's birthday\./);
    assert.match(guide, /THE GIFT: the protagonist gives Kai a bouquet of flowers\./);
    assert.doesNotMatch(
      guide,
      /aphrodisiac|consent|non-graphic|\bSFW\b/i,
      "nothing but the content contract limits it",
    );

    let state = (await t.state())!;
    assert.deepEqual(state.owned.gifts, { chocolates: 1 }, "one bouquet spent");
    assert.deepEqual(state.chapters[key], { beatsRead: 0, completed: null, applied: [] });

    // A double tap resumes and spends nothing.
    const again = await t.call("POST", "/runs/:run/home/birthday", { li: KAI, gift: "flowers" });
    assert.deepEqual(again.body, { key, resumed: true });

    // Two at once: one scene, one gift, one of them resumed.
    const both = await Promise.all([
      t.call("POST", "/runs/:run/home/birthday", { li: MIR, gift: "chocolates" }),
      t.call("POST", "/runs/:run/home/birthday", { li: MIR, gift: "chocolates" }),
    ]);
    assert.deepEqual(
      both.map((answer) => answer.status),
      [200, 200],
    );
    assert.deepEqual(both.map((answer) => answer.body.resumed).sort(), [false, true]);
    state = (await t.state())!;
    assert.deepEqual(state.owned.gifts, {}, "the box of chocolates spent once");
    assert.equal(t.calls.length, 0);

    // A resend after the late days are over, for a scene already registered, resumes rather than 404.
    assert.deepEqual(await celebrateBirthday(t.deps, t.runId, KAI, undefined, addDays(today, BIRTHDAY_LATE_DAYS + 2)), {
      key,
      resumed: true,
    });

    // The client sees it as his story, without its gift or guide.
    const story = await t.call("GET", "/runs/:run/story");
    const entry = story.body.chapters.find((item: { key: string }) => item.key === key);
    assert.deepEqual({ kind: entry.kind, li: entry.li, nodes: entry.nodes }, { kind: "story", li: KAI, nodes: 1 });
    const detail = await t.call("GET", "/runs/:run/chapters/:key", {}, { key });
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal(detail.body.chapter.gift, undefined);
    assert.equal(JSON.stringify(detail.body).includes("BIRTHDAY SCENE"), false);
  } finally {
    release();
    await held;
  }
});

test("Celebrate refuses a gift she lacks, the aphrodisiac under SFW, and a birthday out of reach, leaving nothing", async () => {
  const today = utcToday();
  const t = await birthdayWorld("r-bday03-cccccc", {
    birthdays: { [KAI]: today.slice(5), [MIR]: addDays(today, -(BIRTHDAY_LATE_DAYS + 1)).slice(5) },
    gifts: { aphrodisiac: 1 },
  });
  const key = birthdaySceneKey(KAI, Number(today.slice(0, 4)));
  const before = await t.state();

  const lacking = await t.call("POST", "/runs/:run/home/birthday", { li: KAI, gift: "wine" });
  assert.deepEqual([lacking.status, lacking.body.code], [409, "conflict"]);
  const locked = await t.call("POST", "/runs/:run/home/birthday", { li: KAI, gift: "aphrodisiac" });
  assert.deepEqual([locked.status, locked.body.code], [409, "locked"]);
  assert.equal(await t.chapter(key), null, "the scene went with the refusal");
  assert.deepEqual(await t.state(), before, "nothing spent, nothing registered");

  for (const body of [
    { li: MIR },
    { li: SOL },
    { li: "li-nobody-zz99" },
    { li: "not an id" },
    { li: KAI, gift: "rubies" },
  ]) {
    const refused = await t.call("POST", "/runs/:run/home/birthday", body);
    assert.deepEqual([refused.status, refused.body.code], [404, "not-found"], JSON.stringify(body));
  }
  assert.equal((await t.call("POST", "/runs/:run/home/birthday", {})).status, 400);

  // A run deleted while it was celebrated: its scene goes too.
  const deleted = { store: { ...t.store, updateDoc: async () => null } as typeof t.store };
  await assert.rejects(celebrateBirthday(deleted, t.runId, KAI, undefined), (error) => code(error) === "not-found");
  assert.equal(await t.chapter(key), null);
  assert.equal(t.calls.length, 0);
});

test("the guide names the day or how late it is and the gift or none; NSFW Heat spends the aphrodisiac", async () => {
  const kai = { id: KAI, name: "Kai" };
  const guide = (options: Parameters<typeof birthdayStoryChapter>[1]) =>
    birthdayStoryChapter(kai, options, "2026-11-07T10:00:00.000Z").nodes[0]!.guide;
  const APHRODISIAC =
    " It is an aphrodisiac, and it works: desire builds between them from here, as far as the content contract allows.";
  const onTheDay = guide({ year: 2026, daysLate: 0 });
  assert.match(onTheDay, /: today is Kai's birthday\. /);
  assert.ok(
    onTheDay.includes(
      "The protagonist brings no gift; remembering the day is the gift, and Kai reacts to that in character.",
    ),
    "no gift: remembering is the gift",
  );
  assert.doesNotMatch(onTheDay, /THE GIFT|aphrodisiac|days? ago/);
  assert.ok(
    guide({ year: 2026, daysLate: 1 }).includes(
      "Kai's birthday was 1 day ago, and the protagonist celebrates it late; Kai takes that as Kai would.",
    ),
  );
  const late = guide({ year: 2026, daysLate: 3, gift: "wine" });
  assert.ok(late.includes("Kai's birthday was 3 days ago, and the protagonist celebrates it late;"));
  assert.doesNotMatch(late, /today is/);
  assert.ok(late.includes("THE GIFT: the protagonist gives Kai a bottle of wine."));
  assert.ok(!late.includes(APHRODISIAC), "the aphrodisiac's sentence only for the aphrodisiac");
  const aphrodisiac = guide({ year: 2026, daysLate: 0, gift: "aphrodisiac" });
  assert.ok(aphrodisiac.includes(`THE GIFT: the protagonist gives Kai an aphrodisiac.`));
  assert.ok(aphrodisiac.includes(APHRODISIAC));
  assert.doesNotMatch(aphrodisiac, /consent|non-graphic|graphic|tasteful|fade|tease|imply|implied/i);

  // Under NSFW Heat the aphrodisiac is a gift like any: spent in the write that registers the scene, and in its guide.
  const today = utcToday();
  const t = await birthdayWorld("r-bday06-ffffff", {
    birthdays: { [KAI]: today.slice(5) },
    gifts: { aphrodisiac: 1, flowers: 1 },
    content: { ...defaultContent(), heat: "explicit" },
  });
  const celebrated = await t.call("POST", "/runs/:run/home/birthday", { li: KAI, gift: "aphrodisiac" });
  assert.equal(celebrated.status, 200, JSON.stringify(celebrated.body));
  const chapter = (await t.chapter(celebrated.body.key))!;
  assert.equal(chapter.gift, "aphrodisiac");
  assert.ok(chapter.nodes[0]!.guide.includes(APHRODISIAC));
  assert.deepEqual((await t.state())!.owned.gifts, { flowers: 1 }, "the aphrodisiac spent, the flowers kept");
  assert.equal(t.calls.length, 0);
});

test("the birthday scene pays its beat and the gift's affection, uncapped; a replay and a figurine scene pay no gift", () => {
  const dayKey = "2026-11-07";
  const state = {
    ...normalizeState({ lis: { [KAI]: { points: 300 } } }),
    daily: { dayKey, starlight: 400, affection: { [KAI]: 150 } },
  } as RunState;
  const node = { i: 0, kind: "beat" as const, guide: "A BIRTHDAY SCENE.", cast: [KAI] };
  const chapter = {
    key: birthdaySceneKey(KAI, 2026),
    kind: "story" as const,
    lead: KAI,
    nodes: [node],
    ledger: { relationship: [], conflict: [], offscreen: [] },
    gift: "wine" as const,
  };
  const read = readBeatToEnd(state, chapter, 0, { dayKey });
  assert.deepEqual(read.grants, [
    { source: "beat", starlight: 30 },
    { source: "gift", li: KAI, affection: 120 },
  ]);
  assert.equal(read.state.lis[KAI]!.points, 420, "in full, though the day's 150 is used");
  assert.deepEqual(read.state.daily, state.daily, "no cap counts it");
  assert.deepEqual(readBeatToEnd(read.state, chapter, 0, { dayKey }).grants, [], "a replay pays nothing");
  const { gift: _gift, ...figurine } = { ...chapter, key: figurineSceneKey(KAI) };
  assert.deepEqual(readBeatToEnd(state, figurine, 0, { dayKey }).grants, [{ source: "beat", starlight: 30 }]);
});

test("read to its end, the scene's prompt keeps the birthday after the cache breakpoint, and he alone remembers it", async () => {
  const today = utcToday();
  const t = await birthdayWorld("r-bday04-dddddd", {
    birthdays: { [KAI]: today.slice(5) },
    gifts: { flowers: 1 },
    replies: [json(beatReply()), json(beatReply())],
  });
  // A figurine scene of his in the same run, for the cached messages.
  const figurine = await ensureFigurineStory(t.deps, t.runId, { id: KAI, name: "Kai" });
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: { ...state.chapters, [figurine]: { beatsRead: 0, completed: null, applied: [] } },
  }));
  const { key } = (await t.call("POST", "/runs/:run/home/birthday", { li: KAI, gift: "flowers" })).body;
  for (const scene of [figurine, key]) {
    const written = await t.call("POST", "/runs/:run/chapters/:key/beats/:i", {}, { key: scene, i: "0" });
    assert.equal(written.status, 200, JSON.stringify(written.body));
  }
  assert.equal(t.calls.length, 2, "one call each: the scene itself");
  const [figurineCall, birthdayCall] = t.calls.map((call) => call.messages);
  const last = birthdayCall!.at(-1)!.content!;
  assert.ok(last.includes("A BIRTHDAY SCENE between Kai and the protagonist"));
  assert.ok(last.includes("a bouquet of flowers"));
  assert.ok(last.includes("ONE-SCENE side story of Kai's"), "P23's one-scene framing");
  const cached = (messages: typeof birthdayCall) => messages!.slice(0, -1).map((message) => message.content);
  assert.ok(cached(birthdayCall).length > 0);
  assert.deepEqual(cached(birthdayCall), cached(figurineCall), "the cached messages are a figurine scene's");
  assert.ok(!cached(birthdayCall).join("\n").includes("bouquet"));

  const read = await t.call("POST", "/runs/:run/chapters/:key/beats/:i/read", { segment: 2 }, { key, i: "0" });
  assert.equal(read.status, 200, JSON.stringify(read.body));
  assert.equal(read.body.chapterDone, true);
  assert.deepEqual(read.body.grants, [
    { source: "beat", starlight: 30 },
    { source: "gift", li: KAI, affection: 40 },
  ]);
  const source = (await readMemorySources(t.store, t.runId)).find((entry) => entry.id === key);
  assert.ok(source, "the scene is canon");
  assert.equal(source.kind, "character-story");
  assert.equal(source.audience?.[0], KAI, "private to him");
  // Read: no longer offered.
  const home = await t.call("GET", "/runs/:run/home");
  assert.equal(home.body.celebrate, undefined);
});

test("the note's birthday falls on 02-28 in a common year; Home and the calendar send celebrate only when there is one", async () => {
  const unit = (birthday: string) => ({ name: "Kai", bible: bible({ birthday }) });
  const world = { createdAt: "" };
  const special = (birthday: string, day: string) =>
    noteDay(unit(birthday), world, Date.parse(`${day}T12:00:00Z`)).special;
  assert.deepEqual(special("02-29", "2027-02-28"), ["Today is Kai's birthday."]);
  assert.deepEqual(special("02-29", "2028-02-29"), ["Today is Kai's birthday."]);
  assert.deepEqual(special("02-29", "2028-02-28"), []);
  assert.deepEqual(special("02-30", "2027-03-02"), []);
  assert.deepEqual(special("11-07", "2026-11-07"), ["Today is Kai's birthday."]);

  const today = utcToday();
  const t = await birthdayWorld("r-bday05-eeeeee", {
    birthdays: { [KAI]: today.slice(5), [MIR]: addDays(today, -3).slice(5), [SOL]: addDays(today, 30).slice(5) },
  });
  const year = (day: string) => Number(day.slice(0, 4));
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: {
      ...state.chapters,
      [birthdaySceneKey(MIR, year(addDays(today, -3)))]: { beatsRead: 0, completed: null, applied: [] },
    },
  }));
  const home = await t.call("GET", "/runs/:run/home");
  assert.deepEqual(home.body.celebrate, [KAI], "only a birthday not yet celebrated");
  const calendar = await t.call("GET", "/runs/:run/calendar");
  assert.deepEqual(calendar.body.celebrate, [
    { li: KAI, day: today, daysLate: 0, started: false },
    { li: MIR, day: addDays(today, -3), daysLate: 3, started: true },
  ]);

  // None to celebrate: the field is left out, so older answers and this one read alike.
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (stored) => ({
    ...stored,
    forge: { ...stored.forge, phase: "units" },
  }));
  assert.equal("celebrate" in (await t.call("GET", "/runs/:run/home")).body, false);
  assert.equal("celebrate" in (await t.call("GET", "/runs/:run/calendar")).body, false);
});

test("a stored chapter's gift reads back, an unknown one is dropped, an older chapter has none, the client sees none", () => {
  const chapter: Chapter = {
    key: birthdaySceneKey(KAI, 2026),
    kind: "story",
    li: KAI,
    lead: KAI,
    title: "Kai's Birthday",
    tags: [],
    summary: "",
    nodes: [{ i: 0, kind: "beat", guide: "A BIRTHDAY SCENE.", cast: [KAI] }],
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: "2026-11-07T10:00:00.000Z",
    connectionId: "",
    gift: "chocolates",
  };
  assert.deepEqual(normalizeChapter(chapter), chapter);
  assert.equal(normalizeChapter({ ...chapter, gift: "rubies" })!.gift, undefined);
  const { gift: _gift, ...older } = chapter;
  assert.deepEqual(normalizeChapter(older), older);
  assert.equal("gift" in toChapterView(chapter), false);
});
