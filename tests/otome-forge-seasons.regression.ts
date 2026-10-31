// Otome Forge 0.6.5: seasonal banners (SH/wish.ts rotationSeason, S/wish/prompts.ts, S/wish/banners.ts). A month's
// first rotation, the one that starts on day 1–14, carries that month's theme on its three banners: P20 is told the
// month and theme (a world without the holiday takes its own version of it), the banner keeps it as `season`, and its
// view shows it, as an Echo too. The theme's earlier banners of the kind are named even once they are past the last
// twelve, so next year's October is not this year's again. Any other rotation's P20 prompt is byte for byte the one it
// was before: its digests were taken from the 0.6.3 builder before seasons were written.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test, { mock } from "node:test";
import type { Unit } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  LIMIT_DEFAULTS,
  defaultContent,
  type ContentSettings,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import * as wish from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/wish.ts";
import {
  bannerId,
  itemId,
  runDocTarget,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import {
  normalizeBanner,
  normalizeItem,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/wish.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { readBanner } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/wish/banners.ts";
import { bannerPlanMessages } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/wish/prompts.ts";
import { CAST, HE, SHE, bible } from "./fixtures/otome-forge-story.ts";
import { KAI, MIR, SOL, rotationReplies, wishWorld } from "./fixtures/otome-forge-wish.ts";

/** Each month, its season and the cue P20 reads (Northern Hemisphere). */
const MONTHS: Array<[month: number, season: wish.Season, cue: string]> = [
  [1, "new-year", "January's seasonal banner. Theme: New Year, fresh starts in winter."],
  [2, "valentines-day", "February's seasonal banner. Theme: Valentine's Day."],
  [3, "white-day", "March's seasonal banner. Theme: White Day, the first days of spring."],
  [4, "cherry-blossoms", "April's seasonal banner. Theme: cherry blossoms, spring."],
  [5, "gardens-in-bloom", "May's seasonal banner. Theme: flowers and gardens in bloom."],
  [6, "june-bride", "June's seasonal banner. Theme: June bride, early summer."],
  [7, "summer-festival", "July's seasonal banner. Theme: summer festival, the beach."],
  [8, "summer-nights", "August's seasonal banner. Theme: summer nights, fireworks."],
  [9, "harvest-moon", "September's seasonal banner. Theme: harvest moon, moon festival."],
  [10, "halloween", "October's seasonal banner. Theme: Halloween."],
  [11, "autumn", "November's seasonal banner. Theme: autumn."],
  [12, "christmas", "December's seasonal banner. Theme: Christmas."],
];
const day = (year: number, month: number, date: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;

test("each month's first rotation carries that month's theme, and one that starts later in the month none", () => {
  assert.deepEqual(
    MONTHS.map(([, season]) => season),
    [...wish.SEASONS],
  );
  for (const [month, season] of MONTHS) {
    for (const date of [1, 7, 14])
      assert.equal(wish.rotationSeason(day(2027, month, date)), season, day(2027, month, date));
    for (const date of [15, 22, 28])
      assert.equal(wish.rotationSeason(day(2027, month, date)), null, day(2027, month, date));
  }
});

test("day 14 is the last seasonal start of a month and day 15 the first that is not", () => {
  assert.equal(wish.rotationSeason("2026-10-14"), "halloween");
  assert.equal(wish.rotationSeason("2026-10-15"), null);
  assert.equal(wish.rotationSeason("2026-10-31"), null);
  assert.equal(wish.rotationSeason("2026-11-01"), "autumn");
  assert.equal(wish.rotationSeason("2026-12-31"), null);
  assert.equal(wish.rotationSeason("2027-01-01"), "new-year");
  assert.equal(wish.rotationSeason("2028-02-14"), "valentines-day");
  assert.equal(wish.rotationSeason("2028-02-29"), null);
  for (const notADay of ["", "soon", "2026-10", "2026-10-5", "2026-13-01", "2026-02-30", "2026-10-00"]) {
    assert.equal(wish.rotationSeason(notADay), null, notADay);
  }
});

test("from any creation day, a story's rotations carry exactly one seasonal start a month, in that month's theme", () => {
  /** The month after `month` ("YYYY-MM"). */
  const next = (month: string) => wish.addDays(`${month}-01`, 31).slice(0, 7);
  // Fourteen creation days in a row (every offset a rotation can have from a month's start) and a leap day.
  const created = [...Array.from({ length: 14 }, (_, i) => wish.addDays("2026-10-18", i)), "2028-02-29"];
  for (const createdDay of created) {
    const rotations = 30; // 420 days: more than a year
    const starts = Array.from(
      { length: rotations },
      (_, rotation) => wish.rotationWindow(createdDay, rotation).startsDay,
    );
    const seasonal = starts.flatMap((startsDay) => {
      const season = wish.rotationSeason(startsDay);
      return season ? [{ month: startsDay.slice(0, 7), season }] : [];
    });
    // Every whole month the rotations span (after the first one's month, before the last one's): exactly one, in its
    // own month's theme. The first month has none when the story began after the 14th.
    let whole = 0;
    for (let month = next(starts[0]!.slice(0, 7)); month < starts.at(-1)!.slice(0, 7); month = next(month)) {
      const found = seasonal.filter((entry) => entry.month === month);
      assert.deepEqual(
        found.map((entry) => entry.season),
        [wish.SEASONS[Number(month.slice(5)) - 1]],
        `${createdDay}: ${month}`,
      );
      whole += 1;
    }
    assert.ok(whole >= 12, `${createdDay} spans a whole year (${whole} months)`);
    assert.equal(
      new Set(seasonal.map((entry) => entry.month)).size,
      seasonal.length,
      `${createdDay}: never two a month`,
    );
  }
});

// ── P20 ──

function planInput(kind: wish.BannerKind, content: ContentSettings = defaultContent()) {
  const world = normalizeWorld({
    title: "The Lantern Court",
    premise: "Someone is putting out the harbour's lanterns.",
    setting: "A harbour city lit by lanterns that must never go out.",
    content,
    connections: { narration: "conn-text" },
  });
  const units: Unit[] = CAST.map((li) => ({
    ...normalizeUnit({}),
    id: li.id,
    name: li.name,
    pronouns: HE,
    bible: bible(),
  }));
  return {
    kind,
    world,
    player: { ...normalizePlayer({}), name: "Ines", pronouns: SHE },
    units,
    state: normalizeState({}),
    featured: units[0]!,
    ...(kind === "my-wardrobe" ? { partnerLook: { name: "Tide", outfitLine: "navy coat", title: "Tide" } } : {}),
    earlierTitles: ["Lantern Vigil"],
    memory: "The lanterns on the quay went dark.",
  };
}

const digest = (messages: Array<{ role: string; content: string }>) =>
  createHash("sha256")
    .update(messages.map((message) => `${message.role}:${message.content}`).join("\n\u0000\n"))
    .digest("hex")
    .slice(0, 16);

/** Taken from the 0.6.3 builder, before seasons. */
const BEFORE_SEASONS: Record<wish.BannerKind, string> = {
  memories: "a80f67495d9ab2ea",
  "his-wardrobe": "1777b13d1151cdb3",
  "my-wardrobe": "90b60b7952e41d3a",
};

test("a rotation that is not seasonal sends the P20 prompt it sent before seasons", () => {
  for (const kind of wish.BANNER_KINDS) {
    assert.equal(digest(bannerPlanMessages(planInput(kind))), BEFORE_SEASONS[kind], kind);
    assert.equal(digest(bannerPlanMessages({ ...planInput(kind), season: null })), BEFORE_SEASONS[kind], kind);
  }
});

test("a seasonal rotation's P20 plans every item on the month's theme, in the world's own version of it", () => {
  const explicit: ContentSettings = { ...defaultContent(), heat: "explicit", limits: { ...LIMIT_DEFAULTS.angst } };
  for (const content of [defaultContent(), explicit]) {
    for (const kind of wish.BANNER_KINDS) {
      const plain = bannerPlanMessages(planInput(kind, content));
      const seasonal = bannerPlanMessages({
        ...planInput(kind, content),
        season: { id: "halloween", earlierTitles: ["Masks on the Quay"] },
      });
      const user = seasonal[1]!.content;
      assert.ok(user.includes("SEASON: this rotation is October's seasonal banner. Theme: Halloween."), kind);
      assert.ok(user.includes("Every title, premise, look and Snapshot follows the theme."), kind);
      assert.ok(
        user.includes(
          "A story set in the real world has the holiday or custom itself; a world without it has its own version (a winter festival of gifts and lights in place of Christmas, a night of masks and spirits in place of Halloween).",
        ),
        kind,
      );
      // Last October's banner is named however far back it is; the last twelve are listed as before.
      assert.ok(user.includes("EARLIER OCTOBER BANNERS OF THIS KIND (do not repeat): Masks on the Quay"), kind);
      assert.ok(user.includes("EARLIER BANNERS OF THIS KIND (do not repeat): Lantern Vigil"), kind);
      assert.ok(user.endsWith(plain[1]!.content.split("\n\n").at(-1)!), "the task stays last");
      // The rules, the Heat and the content contracts are the ones every banner gets: the season adds no rule of its own.
      assert.equal(seasonal[0]!.content, plain[0]!.content, `${kind}: the system message is unchanged`);
      assert.equal(user.replace(/\n\nSEASON: [^]*?(?=\n\nPlan the )/, ""), plain[1]!.content, kind);
    }
  }
  for (const [, season, cue] of MONTHS) {
    const [, user] = bannerPlanMessages({ ...planInput("memories"), season: { id: season, earlierTitles: [] } });
    assert.ok(user!.content.includes(cue), season);
    assert.doesNotMatch(user!.content, /EARLIER [A-Z]+ BANNERS OF THIS KIND/, "no earlier seasonal banners, no line");
  }
});

// ── Wish open ──

/** Sets the world's creation time. */
const createdOn = (t: Awaited<ReturnType<typeof wishWorld>>, createdAt: string) =>
  t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({ ...world, createdAt }));

/** A Memories banner of `rotation`, written straight into the store with its 5★ (all P20 reads of an earlier one). */
async function seedMemories(t: Awaited<ReturnType<typeof wishWorld>>, rotation: number, createdDay: string) {
  const key = wish.bannerKey("memories", rotation);
  const five = normalizeItem({ id: `${key}-f`, kind: "memory5", banner: key, li: KAI, title: `Seeded ${rotation}` });
  await t.store.mutateDoc(runDocTarget("item", itemId(t.runId, five.id)), normalizeItem, () => five);
  await t.store.mutateDoc(runDocTarget("banner", bannerId(t.runId, key)), normalizeBanner, () =>
    normalizeBanner({
      key,
      kind: "memories",
      rotation,
      ...wish.rotationWindow(createdDay, rotation),
      featuredLi: KAI,
      items: {
        five: [five.id],
        four: [1, 2, 3].map((n) => `${key}-a${n}`),
        three: [1, 2, 3, 4, 5, 6].map((n) => `${key}-s${n}`),
      },
    }),
  );
}

test("Wish open plans a month's first rotation on its theme and keeps it; the next one that month is the planner's choice", async () => {
  let now = Date.parse("2026-10-05T12:00:00.000Z");
  mock.method(Date, "now", () => now);
  try {
    const t = await wishWorld({
      runKey: "r-m4seas01-aaaaaa",
      images: { connectionId: null },
      replies: [...rotationReplies(KAI), ...rotationReplies(MIR, " II"), ...rotationReplies(SOL, " III")],
    });
    await createdOn(t, "2026-10-05T09:00:00.000Z");
    const user = (call: number) => t.calls[call]!.messages[1]!.content as string;

    // Rotation 0 starts on October 5th: all three banners are Halloween's.
    const october = (await t.call("POST", "/runs/:run/wish/open")).body.wish as wish.WishView;
    assert.deepEqual(october.rotation, { number: 0, startsDay: "2026-10-05", endsDay: "2026-10-18" });
    assert.deepEqual(
      october.banners.map((banner) => [banner.key, banner.season]),
      [
        ["memories-0", "halloween"],
        ["his-wardrobe-0", "halloween"],
        ["my-wardrobe-0", "halloween"],
      ],
    );
    assert.equal(t.calls.length, 3);
    for (const call of [0, 1, 2]) {
      assert.ok(
        user(call).includes("SEASON: this rotation is October's seasonal banner. Theme: Halloween."),
        `${call}`,
      );
    }
    assert.equal((await readBanner(t.store, t.runId, "his-wardrobe-0"))?.season, "halloween", "the banner keeps it");

    // Rotation 1 starts on October 19th: the planner's own choice, and rotation 0 keeps its badge in Echoes.
    now = Date.parse("2026-10-19T12:00:00.000Z");
    const later = (await t.call("POST", "/runs/:run/wish/open")).body.wish as wish.WishView;
    assert.deepEqual(
      later.banners.map((banner) => [banner.key, "season" in banner]),
      [
        ["memories-1", false],
        ["his-wardrobe-1", false],
        ["my-wardrobe-1", false],
      ],
    );
    assert.deepEqual(
      later.echoes.map((banner) => [banner.key, banner.season]),
      [
        ["my-wardrobe-0", "halloween"],
        ["his-wardrobe-0", "halloween"],
        ["memories-0", "halloween"],
      ],
    );
    assert.equal(t.calls.length, 6);
    for (const call of [3, 4, 5]) assert.doesNotMatch(user(call), /SEASON:|EARLIER [A-Z]+ BANNERS/, `${call}`);
    assert.equal((await readBanner(t.store, t.runId, "memories-1"))?.season, undefined);

    // A year on (rotation 26 starts on October 4th, 2027), twelve later Memories banners have pushed last October's
    // past the last twelve titles; it is still named as an earlier October banner, so the plan does not repeat it.
    for (let rotation = 2; rotation <= 13; rotation += 1) await seedMemories(t, rotation, "2026-10-05");
    now = Date.parse("2027-10-04T12:00:00.000Z");
    const nextYear = (await t.call("POST", "/runs/:run/wish/open")).body.wish as wish.WishView;
    assert.deepEqual(
      nextYear.banners.map((banner) => [banner.key, banner.season]),
      [
        ["memories-26", "halloween"],
        ["his-wardrobe-26", "halloween"],
        ["my-wardrobe-26", "halloween"],
      ],
    );
    const memories = user(6);
    const earlier = memories.split("\n").find((line) => line.startsWith("EARLIER BANNERS OF THIS KIND"))!;
    assert.ok(!earlier.includes("Lantern Vigil"), "last October's title is past the last twelve");
    assert.ok(memories.includes("EARLIER OCTOBER BANNERS OF THIS KIND (do not repeat): Lantern Vigil\n"), memories);
    assert.ok(user(7).includes("EARLIER OCTOBER BANNERS OF THIS KIND (do not repeat): Harbour Night\n"));
  } finally {
    mock.restoreAll();
  }
});
