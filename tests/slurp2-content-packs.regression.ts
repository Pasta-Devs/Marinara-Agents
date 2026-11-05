/**
 * S — content packs (Backstage › Packs): pack toggles join and leave the event and storyline
 * libraries, every pack item fits a Creator or is skipped (never watered down), pack dates fire on
 * their days with their moments in order, and pack storylines run their lifecycle, poll included.
 */
import assert from "node:assert/strict";

import {
  readSlurpContentPackToggles,
  slurpApplyContentPacks,
  slurpContentPackSummaries,
  slurpContentStoryPack,
  slurpPackGate,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-content-packs.ts";
import { parseSlpStoryPack } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-story-packs.ts";
import { slurpStoryLookChange } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/storylines/slp-story-state.ts";
import { slurpTasteWeight } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-spice.ts";
import {
  readSlpDramaLibrary,
  slpDramaEnabledIds,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-drama-library.ts";
import {
  parseSlpStoryPackV2,
  slpStorylinesFromV1,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-storyline-v1.ts";
import {
  SLURP_CONTENT_PACK_LIBRARY,
  type SlurpPackBeat,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-content-pack-library.ts";
import {
  slurpBirthdayOccasion,
  slurpBirthdayOf,
  slurpOccasionBeat,
  slurpFitPattern,
  slurpPackFits,
  slurpPackTopicOff,
  slurpPackOccasions,
  type SlurpOccasion,
  type SlurpOccasionCreator,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-occasion-beats.ts";
import {
  slurpArcFitsCreator,
  slurpArcTypeIsOnce,
  slurpAutoArcPick,
  slurpNormalizeArcLibrary,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-arc-library.ts";
import { makeSlurpProject } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-project.ts";
import {
  slurpProjectChoose,
  slurpProjectPollDue,
  slurpProjectTick,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-arc-progress.ts";
import { slurpPostPurpose } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-purpose.ts";
import {
  projectSlpStoryCalendar,
  reconcileSlpScheduledOccurrences,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-story-runtime.ts";
import {
  slurpNormalizePlatformEvents,
  slurpPlatformEventInstruction,
  slurpRunningPlatformEventWindows,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-platform-events.ts";
import { slpStoryPackSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-story-engine.ts";
import { slurp2Source } from "./slurp2-source.ts";

const root = "packages/slurp2/src/engine/packages";
const server = (path: string) => slurp2Source(`${root}/server/src/slp/${path}`);
const client = (path: string) => slurp2Source(`${root}/client/src/slp/${path}`);
const DAY = 86_400_000;
const utc = (value: string) => new Date(`${value}T12:00:00.000Z`);

// --- Pack toggles ---------------------------------------------------------------------------------

// The settings read (`normalizeSlurpSettings`, pinned below) does exactly this; it needs the Engine
// to load, so the join is run here through the same pure steps.
type Libraries = {
  contentPacks: Record<string, boolean>;
  arcLibrary: ReturnType<typeof slurpNormalizeArcLibrary>;
  platformEvents: ReturnType<typeof slurpNormalizePlatformEvents>;
};
function normalizeSlurpSettings(raw: string | null): Libraries {
  const record = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  const contentPacks = readSlurpContentPackToggles(record.contentPacks);
  const { arcs, events } = slurpApplyContentPacks({
    arcs: slurpNormalizeArcLibrary(record.arcLibrary),
    events: slurpNormalizePlatformEvents(record.platformEvents),
    toggles: contentPacks,
    maxArcs: 200,
    maxEvents: 100,
  });
  return { contentPacks, arcLibrary: arcs, platformEvents: events };
}
const fresh = normalizeSlurpSettings(null);
const eventIds = (settings: typeof fresh) => settings.platformEvents.map((event) => event.id);
const arcIds = (settings: typeof fresh) => settings.arcLibrary.map((arc) => arc.id);

assert.deepEqual(fresh.contentPacks, {}, "no pack choice stored until the player makes one");
for (const id of ["pack-slurpcon", "pack-slurpies", "pack-pride", "pack-summer-body", "pack-exam-week-winter"])
  assert.ok(eventIds(fresh).includes(id), `default-on pack event ${id} is in the calendar`);
for (const id of ["pack-fan-meet-greet", "pack-nominated"])
  assert.ok(arcIds(fresh).includes(id), `default-on pack storyline ${id} is in the library`);
// Decision after S (2026-09-28): "Spicy firsts" starts off; switched on, its storylines join.
for (const id of ["pack-first-toy", "pack-toy-reviews", "pack-going-explicit"]) {
  assert.ok(!arcIds(fresh).includes(id), `off-by-default pack storyline ${id} is not in the library`);
  assert.ok(
    arcIds(normalizeSlurpSettings(JSON.stringify({ contentPacks: { "slurp-pack-spicy-firsts": true } }))).includes(id),
    `switched on, ${id} joins the library`,
  );
}
for (const id of ["new-year", "valentines", "halloween", "christmas"])
  assert.ok(eventIds(fresh).includes(id), `core holiday ${id} stays`);
assert.ok(arcIds(fresh).includes("moving"), "the everyday storylines stay");
const packEvent = fresh.platformEvents.find((event) => event.id === "pack-slurpcon")!;
assert.equal(packEvent.provenance?.packId, "slurp-pack-slurpcon");
assert.equal(packEvent.builtin, true);
assert.equal(packEvent.enabled, true);
assert.equal(packEvent.automation, "inherit", "the player's occasion choice (suggest / auto) still decides");
assert.deepEqual(packEvent.activation, { kind: "annual", month: 8, day: 14, durationDays: 4 });

// Reading twice changes nothing: the join is idempotent.
assert.deepEqual(normalizeSlurpSettings(JSON.stringify(fresh)), fresh);

// Off: the pack's items leave both libraries; the rest stays.
const off = normalizeSlurpSettings(
  JSON.stringify({ ...fresh, contentPacks: { "slurp-pack-slurpcon": false, "slurp-pack-spicy-firsts": false } }),
);
assert.ok(!eventIds(off).includes("pack-slurpcon"));
assert.ok(!arcIds(off).includes("pack-fan-meet-greet"));
assert.ok(!arcIds(off).includes("pack-first-toy"));
assert.ok(eventIds(off).includes("pack-slurpies") && eventIds(off).includes("valentines"));
// On again: back.
// Spicy firsts is off by default now (decision after S), so "on again" switches it on by hand.
const onAgain = normalizeSlurpSettings(
  JSON.stringify({ ...off, contentPacks: { "slurp-pack-slurpcon": true, "slurp-pack-spicy-firsts": true } }),
);
assert.ok(eventIds(onAgain).includes("pack-slurpcon") && arcIds(onAgain).includes("pack-first-toy"));

// A pack item the player hid or edited stays as they left it, and is never added twice.
const edited = normalizeSlurpSettings(
  JSON.stringify({
    ...fresh,
    platformEvents: fresh.platformEvents.map((event) =>
      event.id === "pack-slurpcon" ? { ...event, hidden: true, guidance: "Our own con." } : event,
    ),
  }),
);
const cons = edited.platformEvents.filter((event) => event.provenance?.contentId === "slurpcon");
assert.equal(cons.length, 1);
assert.equal(cons[0]!.hidden, true);
assert.equal(cons[0]!.guidance, "Our own con.");

// A full library is never rejected and reset: the pack waits for room.
const hundred = Array.from({ length: 100 }, (_, index) => ({
  ...fresh.platformEvents[0]!,
  id: `custom-${index}`,
  contentId: `custom-${index}`,
  builtin: false,
  provenance: undefined,
}));
const full = normalizeSlurpSettings(JSON.stringify({ ...fresh, platformEvents: hundred }));
assert.equal(full.platformEvents.length, 100);
assert.ok(
  full.platformEvents.every((event) => event.id.startsWith("custom-")),
  "the player's 100 events are kept",
);
const applied = slurpApplyContentPacks({ arcs: [], events: [], toggles: {}, maxArcs: 1, maxEvents: 2 });
assert.equal(applied.arcs.length, 1);
assert.equal(applied.events.length, 2);

// Toggles are read strictly: unknown packs and non-booleans are dropped.
assert.deepEqual(readSlurpContentPackToggles({ "slurp-pack-awards": false, nope: true, "slurp-pack-seasons": "yes" }), {
  "slurp-pack-awards": false,
  // An imported pack's switch lives in the same setting (PR 5b).
  nope: true,
});

// Every pack is a valid portable story pack, and Backstage gets a name, a one-line "adds" and contents.
for (const pack of SLURP_CONTENT_PACK_LIBRARY) {
  assert.ok(slpStoryPackSchema.safeParse(slurpContentStoryPack(pack)).success, `${pack.id} parses`);
  assert.ok(pack.adds.length > 20 && pack.adds.length <= 160 && !pack.adds.includes("\n"), `${pack.id} one line`);
}
for (const summary of slurpContentPackSummaries())
  assert.ok(summary.dates.length + summary.arcs.length + summary.extras.length > 0, `${summary.id} lists contents`);

// --- Fit (never watered down, skipped where it does not fit) -------------------------------------

const creator = (text: string, patch: Partial<SlurpOccasionCreator> = {}): SlurpOccasionCreator => ({
  text,
  level: "suggestive",
  hardNoes: [],
  avoid: [],
  partner: null,
  collab: null,
  ...patch,
});
const TATTOO = "Kai is a tattoo artist in Lisbon. Never uses exclamation marks. Loves horror films.";
const STUDENT = "Mira studies law at uni and climbs on weekends.";
const exam = SLURP_CONTENT_PACK_LIBRARY.flatMap((pack) => pack.events).find((e) => e.contentId === "exam-week-winter")!;
assert.equal(slurpPackFits(exam.fit, creator(TATTOO)), false, "exam week needs a student");
assert.equal(slurpPackFits(exam.fit, creator(STUDENT)), true);
assert.equal(
  slurpPackFits(exam.fit, creator(`${STUDENT} She hates talking about exams.`)),
  false,
  "a card never rules out",
);

const arcFit = (id: string) =>
  SLURP_CONTENT_PACK_LIBRARY.flatMap((pack) => pack.arcs).find((arc) => arc.contentId === id)!.fit;
assert.equal(slurpPackFits(arcFit("first-toy"), creator(STUDENT)), false, "a Flirty Creator gets no toy storyline");
assert.equal(slurpPackFits(arcFit("first-toy"), creator(STUDENT, { level: "explicit" })), true);
assert.equal(
  slurpPackFits(arcFit("first-toy"), creator(STUDENT, { level: "explicit", hardNoes: ["toys"] })),
  false,
  "a hard no rules it out",
);
assert.equal(
  slurpPackFits(
    arcFit("toy-reviews"),
    creator(`${STUDENT} She would never use a dildo on camera.`, { level: "explicit" }),
  ),
  false,
);
assert.equal(slurpPackFits(arcFit("first-custom"), creator(STUDENT)), true, "a custom request fits any level");
assert.equal(slurpPackFits(arcFit("fan-meet-greet"), creator(`${TATTOO} Hates crowds.`)), false);

// Storylines: the library pick never starts a pack storyline that does not fit. Spicy firsts is off by
// default now (decision after S), so fit is tested with it switched on.
const spicyOn = normalizeSlurpSettings(JSON.stringify({ contentPacks: { "slurp-pack-spicy-firsts": true } }));
const libraryType = (id: string) => spicyOn.arcLibrary.find((arc) => arc.id === id)!;
assert.equal(slurpArcFitsCreator(libraryType("pack-first-toy"), STUDENT), false, "unknown level counts as Flirty");
assert.equal(slurpArcFitsCreator(libraryType("pack-first-toy"), STUDENT, { level: "explicit", hardNoes: [] }), true);
const picks = new Set<string>();
for (let day = 0; day < 400; day += 1) {
  const pick = slurpAutoArcPick({
    creatorAccountId: `c-${day % 7}`,
    at: new Date(Date.UTC(2026, 0, 1) + day * DAY),
    projects: [],
    library: spicyOn.arcLibrary,
    creatorTags: [],
    lastAutoAt: null,
    cooldownWeeks: 1,
    creatorText: STUDENT,
    creatorSpice: { level: "suggestive", hardNoes: [] },
  });
  if (pick && "type" in pick) picks.add(pick.type.id);
}
for (const id of ["pack-first-toy", "pack-toy-reviews", "pack-first-explicit-set", "pack-going-explicit"])
  assert.ok(!picks.has(id), `${id} never starts on its own for a Flirty Creator`);
assert.ok(picks.size >= 4, "other storylines still start");

// --- Calendar dates fire ---------------------------------------------------------------------------

const august = projectSlpStoryCalendar({
  events: fresh.platformEvents,
  occurrences: [],
  from: new Date("2026-08-01T00:00:00Z"),
  to: new Date("2026-09-01T00:00:00Z"),
});
assert.ok(
  august.some((item) => item.sourceId === "pack-slurpcon" && item.startsAt.startsWith("2026-08-14")),
  "SlurpCon is in the Calendar on its day",
);
const reconciled = reconcileSlpScheduledOccurrences({
  events: fresh.platformEvents,
  occurrences: [],
  accounts: [{ id: "mira", hiddenAt: null, settings: { profile: { tags: [] } } } as never],
  at: utc("2026-08-15"),
  automation: "auto",
});
assert.ok(
  reconciled.activated.some((item) => item.blueprintId === "pack-slurpcon"),
  "an automatic occasion starts",
);
const suggested = reconcileSlpScheduledOccurrences({
  events: fresh.platformEvents,
  occurrences: [],
  accounts: [],
  at: utc("2026-08-15"),
  automation: "suggest",
});
const mira = { id: "mira", tags: [] };
const running = (at: Date, occurrences: Parameters<typeof slurpRunningPlatformEventWindows>[3] = []) =>
  slurpRunningPlatformEventWindows(fresh.platformEvents, at, mira, occurrences);
assert.equal(running(utc("2026-08-13")).length, 0, "nothing before the day");
const con = running(utc("2026-08-15")).find((window) => window.contentId === "slurpcon")!;
assert.equal(new Date(con.startsAt).toISOString(), "2026-08-14T00:00:00.000Z");
assert.equal(con.endsAt - con.startsAt, 4 * DAY);
assert.ok(
  !running(utc("2026-08-15"), suggested.occurrences).some((window) => window.contentId === "slurpcon"),
  "a suggested occasion waits for the player, like the prompt",
);
assert.equal(
  running(utc("2026-08-15"), suggested.occurrences).length === 0,
  slurpPlatformEventInstruction(fresh.platformEvents, utc("2026-08-15"), mira, {
    occurrences: suggested.occurrences,
    facts: [],
  }) === null,
  "moments and the prompt agree on what runs",
);

// The moments of a running occasion: in order, on time, each once, stale ones skipped.
const occasionsAt = (at: Date, text = STUDENT, subscribers = 0) =>
  slurpPackOccasions({
    windows: running(at),
    toggles: {},
    creatorAccountId: "mira",
    creatorText: text,
    subscribers,
    at,
  }).filter((occasion) => !occasion.key.startsWith("birthday:"));
const ordinary = ["casual", "set", "behind_the_scenes", "appreciation", "business"] as const;
const walk = (from: Date, hours: number, who: SlurpOccasionCreator, text = STUDENT) => {
  const used: string[] = [];
  const lines: string[] = [];
  for (let step = 0; step < hours; step += 3) {
    const at = new Date(from.getTime() + step * 3_600_000);
    const beat = slurpOccasionBeat({
      creatorAccountId: "mira",
      sequence: step,
      at,
      creator: who,
      occasions: occasionsAt(at, text),
      used,
      history: { sharedToday: {} },
      intents: ordinary,
    });
    if (beat?.sharedId) {
      used.push(beat.sharedId);
      lines.push(beat.line);
    }
  }
  return { used, lines };
};
const con4 = walk(new Date("2026-08-14T00:00:00Z"), 4 * 24 + 12, creator(STUDENT));
const conKeys = con4.used.filter((key) => key.startsWith("occasion:slurpcon:"));
assert.ok(conKeys.length >= 4, `most SlurpCon moments go out (${conKeys.length})`);
assert.equal(new Set(conKeys).size, conKeys.length, "each moment once");
const order = conKeys.map((key) => Number(key.split(":").at(-1)));
assert.deepEqual(
  order,
  [...order].sort((a, b) => a - b),
  "in order",
);
assert.equal(
  walk(new Date("2026-08-19T00:00:00Z"), 48, creator(STUDENT)).used.filter((k) => k.includes("slurpcon")).length,
  0,
);

// Halloween night waits for the last day (atDay), the costume is decided first.
const halloween = walk(new Date("2026-10-25T00:00:00Z"), 7 * 24, creator(STUDENT));
const night = halloween.used.findIndex((key) => key.startsWith("occasion:halloween:") && key.endsWith(":2"));
assert.ok(night >= 0, "Halloween night goes out");
const nightBeat = slurpOccasionBeat({
  creatorAccountId: "mira",
  sequence: 1,
  at: utc("2026-10-29"),
  creator: creator(STUDENT),
  occasions: occasionsAt(utc("2026-10-29")),
  used: ["occasion:halloween:2026-10-25:0", "occasion:halloween:2026-10-25:1"],
  history: { sharedToday: {} },
  intents: ordinary,
});
assert.equal(nightBeat, null, "Halloween night is not posted before Oct 31");

// Started late by the player (a suggested occasion): its fixed days stay on the calendar (sim finding).
const halloweenEvent = fresh.platformEvents.find((event) => event.id === "halloween")!;
const lateStart = [
  {
    blueprintId: "halloween",
    status: "active",
    startsAt: "2026-10-30T09:00:00.000Z",
    endsAt: "2026-11-01T00:00:00.000Z",
    participantIds: [],
    blueprint: halloweenEvent,
  },
];
const lateWindows = slurpRunningPlatformEventWindows(fresh.platformEvents, utc("2026-10-31"), mira, lateStart);
assert.equal(new Date(lateWindows[0]!.dateAt).toISOString().slice(0, 10), "2026-10-25");
const lateOccasion = slurpPackOccasions({
  windows: lateWindows,
  toggles: {},
  creatorAccountId: "mira",
  creatorText: STUDENT,
  subscribers: 0,
  at: utc("2026-10-31"),
}).find((occasion) => occasion.key.startsWith("halloween:"))!;
assert.equal(lateOccasion.key, "halloween:2026-10-25", "the same moments, however late it started");
assert.equal(new Date(lateOccasion.dueAt[2]!).toISOString().slice(0, 10), "2026-10-31", "Halloween night on Oct 31");
assert.equal(new Date(lateOccasion.dueAt[2]!).toISOString().slice(11, 13), "18", "in the evening");
assert.ok(lateOccasion.dueAt[2]! < lateOccasion.endsAt);

// Exam week only for the student; the tattoo artist sits it out (the platform line still runs).
assert.ok(walk(utc("2026-02-01"), 10 * 24, creator(STUDENT)).used.some((key) => key.includes("exam-week")));
assert.ok(!walk(utc("2026-02-01"), 10 * 24, creator(TATTOO), TATTOO).used.some((key) => key.includes("exam-week")));
// A topic the player asked to leave out blocks it too.
assert.ok(
  !walk(utc("2026-10-25"), 7 * 24, creator(STUDENT, { avoid: ["halloween"] })).used.some((key) =>
    key.includes("halloween"),
  ),
);

// Couples and collabs: the moment is written with the people in their life.
const valentines = occasionsAt(utc("2026-02-14")).find((occasion) => occasion.key.startsWith("valentines:"))!;
const pickLine = (
  who: SlurpOccasionCreator,
  occasions: SlurpOccasion[],
  at: Date,
  intents: readonly string[] = ordinary,
) => {
  for (let sequence = 0; sequence < 20; sequence += 1) {
    const beat = slurpOccasionBeat({
      creatorAccountId: "mira",
      sequence,
      at,
      creator: who,
      occasions,
      used: [],
      history: { sharedToday: {} },
      intents: intents as never,
    });
    if (beat) return beat;
  }
  return null;
};
const withTess = pickLine(creator(STUDENT, { partner: "Tess" }), [valentines], utc("2026-02-14"))!;
assert.match(withTess.line, /with Tess/u);
assert.deepEqual(withTess.cast, ["Tess"]);
const single = pickLine(creator(STUDENT), [valentines], utc("2026-02-14"))!;
assert.equal(single.cast.length, 0);
assert.doesNotMatch(single.line, /\{partner\}/u);
// Merge S × U: a pack moment with the partner or a collab partner is the Creator's own post, never a tagged collab.
assert.match(withTess.line, /your own post about your life, not a collab: Tess can be in it, but no collab tag/u);
assert.doesNotMatch(single.line, /collab tag/u);
const conOpen = occasionsAt(new Date("2026-08-14T01:00:00Z")).find((occasion) => occasion.key.startsWith("slurpcon:"))!;
assert.match(
  pickLine(creator(STUDENT, { collab: "Rue" }), [conOpen], new Date("2026-08-14T01:00:00Z"))!.line,
  /booth with Rue/u,
);
assert.match(
  pickLine(creator(STUDENT, { collab: "Rue" }), [conOpen], new Date("2026-08-14T01:00:00Z"))!.line,
  /not your collab with Rue: they can be in it, but no collab tag and no split/u,
);

// Purposes: on a free teaser slot only a moment that can tease runs (the usual tease → drop follows).
const teaser = pickLine(creator(STUDENT), [conOpen], new Date("2026-08-14T01:00:00Z"), ["teaser"]);
assert.ok(
  teaser === null || ["achievement", "showcase", "tease_flirt", "anticipation", "sensory_mood"].includes(teaser.type),
);
// One moment reaches at most two Creators a day.
assert.equal(
  slurpOccasionBeat({
    creatorAccountId: "mira",
    sequence: 0,
    at: utc("2026-02-14"),
    creator: creator(STUDENT),
    occasions: [valentines],
    used: [],
    history: { sharedToday: { [`occasion:${valentines.key}:0`]: 2 } },
    intents: ordinary,
  }),
  null,
);

// Birthday week: from the card when it says, else a steady day of their own; three moments in order.
assert.deepEqual(slurpBirthdayOf("x", "Her birthday is March 3rd, she hates it."), { month: 3, day: 3 });
assert.deepEqual(slurpBirthdayOf("x", "Born on 21st of October in Hamburg."), { month: 10, day: 21 });
assert.deepEqual(slurpBirthdayOf("x", "Geburtstag am 7. Mai."), { month: 5, day: 7 });
assert.deepEqual(slurpBirthdayOf("kai", TATTOO), slurpBirthdayOf("kai", TATTOO), "steady");
const bday = { month: 3, day: 3 };
const beats: SlurpPackBeat[] = [
  { type: "anticipation", line: "a" },
  { type: "social_moment", line: "b" },
  { type: "showcase", line: "c" },
];
assert.equal(slurpBirthdayOccasion(bday, beats, utc("2026-02-27")), null);
const birthdayFit = slurpBirthdayOccasion(bday, beats, utc("2026-03-03"))!.fit;
assert.equal(slurpPackFits(birthdayFit, creator(STUDENT)), true);
assert.equal(
  slurpPackFits(birthdayFit, creator(`${STUDENT} She hates birthdays.`)),
  false,
  "a card that hates them skips",
);
assert.equal(slurpPackFits(birthdayFit, creator(STUDENT, { avoid: ["birthday"] })), false, "a leave-out topic skips");
const week = slurpBirthdayOccasion(bday, beats, utc("2026-03-02"))!;
assert.equal(week.key, "birthday:2026-03-03");
assert.deepEqual(
  week.dueAt.map((value) => new Date(value).toISOString().slice(0, 10)),
  ["2026-03-01", "2026-03-03", "2026-03-04"],
);
assert.ok(
  slurpPackOccasions({
    windows: [],
    toggles: { "slurp-pack-seasons": false },
    creatorAccountId: "mira",
    creatorText: "Her birthday is March 3.",
    subscribers: 0,
    at: utc("2026-03-03"),
  }).every((occasion) => !occasion.key.startsWith("birthday")),
  "no birthday week with its pack off",
);

// The first thousand subscribers: celebrated when it really happens, once, as a thank-you. V moved it from
// Spicy firsts (off by default) into Seasons of life (on by default), so the default toggles bring it.
const subs = (count: number) =>
  slurpPackOccasions({
    windows: [],
    toggles: {},
    creatorAccountId: "m",
    creatorText: "",
    subscribers: count,
    at: utc("2026-05-05"),
  }).filter((occasion) => occasion.key === "first-1k-subs");
assert.equal(subs(999).length, 0);
assert.equal(subs(1200).length, 0, "long past it is not news");
const thousand = subs(1040);
assert.equal(thousand.length, 1);
assert.equal(
  slurpPackOccasions({
    windows: [],
    toggles: { "slurp-pack-spicy-firsts": true, "slurp-pack-seasons": false },
    creatorAccountId: "m",
    creatorText: "",
    subscribers: 1040,
    at: utc("2026-05-05"),
  }).filter((occasion) => occasion.key === "first-1k-subs").length,
  0,
  "the first-1,000 post follows Seasons of life, not Spicy firsts",
);
const cheers = pickLine(creator(STUDENT), thousand, utc("2026-05-05"))!;
assert.equal(cheers.sharedId, "occasion:first-1k-subs:0");
assert.equal(
  slurpOccasionBeat({
    creatorAccountId: "m",
    sequence: 3,
    at: utc("2026-05-05"),
    creator: creator(STUDENT),
    occasions: thousand,
    used: ["occasion:first-1k-subs:0"],
    history: { sharedToday: {} },
    intents: ordinary,
  }),
  null,
  "once",
);
assert.equal(slurpPostPurpose({ beat: cheers, intent: "casual" }).kind, "thanks");

// --- Storyline lifecycle ---------------------------------------------------------------------------

const toyType = libraryType("pack-first-toy");
assert.equal(slurpArcTypeIsOnce(toyType), true, "a first happens once");
let project = makeSlurpProject("arc-1", { type: toyType, origin: "auto" }, utc("2026-04-01"))!;
assert.equal(project.chapters.length, 4);
assert.ok(project.choices[1], "the fans pick the toy in a real poll");
let clock = utc("2026-04-01");
let pollSeen = false;
for (let guard = 0; guard < 40 && project.status === "active"; guard += 1) {
  clock = new Date(clock.getTime() + DAY);
  if (slurpProjectPollDue(project, clock)) {
    pollSeen = true;
    project = slurpProjectChoose(project, clock, [1, 5])!;
    assert.match(
      project.chapters[project.chapter]!,
      /the fans picked: go big or go home/u,
      "the winner is the next chapter",
    );
    continue;
  }
  project = slurpProjectTick(project, clock);
}
assert.ok(pollSeen, "the poll was settled");
assert.equal(project.status, "complete", "the storyline ends");
assert.equal(project.chapters.length, 5, "the poll added one chapter");
// A once storyline never comes back on its own for the same Creator.
assert.equal(
  slurpAutoArcPick({
    creatorAccountId: "c-0",
    at: new Date(Date.UTC(2026, 0, 1)),
    projects: [{ ...project, typeId: "pack-first-toy" }],
    library: [toyType],
    creatorTags: [],
    lastAutoAt: null,
    cooldownWeeks: 1,
    creatorText: STUDENT,
    creatorSpice: { level: "explicit", hardNoes: [] },
  }),
  null,
);

// --- Wiring --------------------------------------------------------------------------------------

const beatService = server("features/feed/slp-post-beat-service.ts");
assert.ok(
  beatService.indexOf("planSlurpOccasionBeat(") > beatService.indexOf("planSlurpTieBeat(") &&
    beatService.indexOf("planSlurpOccasionBeat(") < beatService.indexOf("slurpSteeredBeat("),
  "occasion moments come after a collab commitment and before steering",
);
const occasionService = server("features/feed/slp-occasion-service.ts");
assert.doesNotMatch(occasionService, /claimSlurpModelBudget|createLLMProvider|chatComplete/u, "no AI call of its own");
assert.match(
  server("modules/settings/slp-settings.ts"),
  /candidate\.arcLibrary = slurpNormalizeArcLibrary\([^;]+;\s+\/\/[^\n]+\n\s+candidate\.contentPacks = readSlurpContentPackToggles\(rawRecord\.contentPacks\);\s+\(\{ arcs: candidate\.arcLibrary, events: candidate\.platformEvents \} = slurpApplyContentPacks\(\{[^}]+maxArcs: SLURP_ARC_LIBRARY_MAX,\s+maxEvents: SLURP_PLATFORM_EVENTS_MAX,/u,
  "the settings read joins the packs after both libraries are read, inside their limits",
);
assert.match(server("data/projects/slp-projects-storage-2.ts"), /creatorSpice,/u);
assert.match(server("features/world/slp-story-routes.ts"), /contentPacks: slurpContentPackSummaries\(\)/u);
const panel = client("features/world/SlpPacksPanel.tsx");
assert.match(panel, /<SettingAnchor settingKey="contentPacks">\s+<SlpContentPacksSection/u);
assert.match(panel, /update\("contentPacks", next\)/u);
const section = client("features/world/SlpContentPacksSection.tsx");
assert.match(
  section,
  /<Toggle\s+label=\{pack\.name\}\s+detail=\{pack\.adds\}/u,
  "each pack: a switch, its name and what it adds",
);
const en = JSON.parse(client("locales/en.json")) as Record<string, string>;
for (const key of ["title", "lead", "inside", "birthday", "firstSubs"])
  assert.ok(en[`ui.slurp.packs.content.${key}`], `locale key ${key}`);
// In-world copy only: no disclaimers, no "simulated", no warnings (user rule).
const copy =
  JSON.stringify(SLURP_CONTENT_PACK_LIBRARY) +
  Object.entries(en)
    .filter(([key]) => key.startsWith("ui.slurp.packs.content"))
    .join(" ");
assert.doesNotMatch(copy, /\b(simulat\w*|fake|AI|disclaimer|warning|consent|18\+)\b/u);

// Fits are JSON word lists (PR 5): a word matches whole, `word*` its start, phrases and odd characters stay literal.
assert.deepEqual(
  JSON.parse(JSON.stringify(SLURP_CONTENT_PACK_LIBRARY)),
  SLURP_CONTENT_PACK_LIBRARY,
  "built-in packs are plain data",
);
const words = slurpFitPattern(["toy", "work out", "prüfung*", "c++"])!;
assert.ok(words.test("My new TOY arrived") && words.test("time to work out") && words.test("Prüfungsphase"));
assert.ok(!words.test("toyota") && !words.test("workout") && !words.test("cpp"));
assert.ok(words.test("I write c++"));
assert.equal(slurpFitPattern([]), undefined);
const card = { text: "She studies at uni.", level: "explicit" as const, hardNoes: ["toys"] };
assert.equal(slurpPackFits({ needs: ["uni"] }, card), true);
assert.equal(slurpPackFits({ needs: ["college"] }, card), false);
assert.equal(slurpPackFits({ hardNo: ["toys", "dildos"] }, card), false);
assert.equal(slurpPackFits({ topic: ["gym"] }, { ...card, avoid: ["the gym"] }), false);

// --- PR 5b: built-ins as v2, imported packs as a gate -------------------------------------
// Every built-in pack is also a valid v2 file: its arcs as storylines, its dated events as occasions.
for (const pack of SLURP_CONTENT_PACK_LIBRARY) {
  const v1 = slurpContentStoryPack(pack);
  const { storylines, errors } = slpStorylinesFromV1({ arcs: v1.arcs, events: [], situations: [], dramas: [] });
  assert.deepEqual(errors, [], `${pack.id} arcs convert`);
  const v2 = parseSlpStoryPackV2({
    format: v1.format,
    schemaVersion: 2,
    id: pack.id,
    version: v1.version,
    name: pack.name,
    description: pack.adds,
    storylines,
    occasions: v1.events.map((event, index) => ({
      ...event,
      fit: pack.events[index]!.fit,
      beats: pack.events[index]!.beats,
    })),
  });
  assert.ok(v2.pack, `${pack.id} is a v2 pack: ${v2.errors.join("; ")}`);
}
// An imported v2 occasion: Review lists its event part, the second parse keeps it, the planner runs its beats.
const bakery = parseSlpStoryPack({
  format: "marinara-slurp-story-pack",
  schemaVersion: 2,
  id: "bakery-pack",
  version: "1.0.0",
  name: "Bakery",
  topics: ["baking"],
  occasions: [
    {
      id: "bread-day",
      name: "Bread day",
      activation: { kind: "annual", month: 10, day: 16, durationDays: 2 },
      fit: { needs: ["baker"] },
      beats: [
        { type: "showcase", line: "Fresh loaves." },
        { type: "hologram", line: "A type the planner does not know." },
      ],
    },
  ],
});
assert.ok(bakery.pack, bakery.errors.join("; "));
assert.equal(bakery.pack.events.length, 1, "an occasion's event part is an event for Review");
assert.equal(parseSlpStoryPack(bakery.pack).pack?.occasions?.length, 1, "the routes' second parse keeps occasions");
assert.deepEqual(parseSlpStoryPack(bakery.pack).pack?.topics, ["baking"]);
const breadDay = slurpPackOccasions({
  windows: [
    { contentId: "bread-day", name: "Bread day", startsAt: Date.parse("2026-10-16"), endsAt: Date.parse("2026-10-18") },
  ],
  toggles: Object.fromEntries(SLURP_CONTENT_PACK_LIBRARY.map((pack) => [pack.id, false])),
  creatorAccountId: "m",
  creatorText: "",
  subscribers: 0,
  at: utc("2026-10-16"),
  imported: bakery.pack.occasions,
});
assert.equal(breadDay.length, 1, "an imported occasion runs with every built-in pack off");
assert.deepEqual(
  breadDay[0]!.beats.map((beat) => beat.type),
  ["showcase"],
  "an unknown beat type is dropped",
);
assert.deepEqual(breadDay[0]!.fit, { needs: ["baker"] });
// The gate: an imported pack switched off keeps its entries and their switches, but none starts.
const gated = slurpPackGate(
  [
    { id: "a", provenance: { packId: "bakery-pack", contentId: "a" } },
    { id: "b", provenance: { packId: "other", contentId: "b" } },
    { id: "c", provenance: undefined },
  ],
  { "bakery-pack": false },
);
assert.deepEqual(
  gated.map((entry) => entry.id),
  ["b", "c"],
);
const imported = readSlpDramaLibrary({
  situations: [],
  dramas: [],
  storylines: [],
  packs: [
    { id: "bakery-pack", name: "Bakery", version: "1.0.0", topics: ["baking", 3], occasions: bakery.pack.occasions },
    { name: "no id" },
  ],
});
assert.equal(imported.packs.length, 1, "a record without an id is dropped");
assert.deepEqual(imported.packs[0]!.topics, ["baking"]);
assert.equal(imported.packs[0]!.occasions.length, 1);
assert.deepEqual(
  slpDramaEnabledIds({ ...imported, storylines: [{ id: "s1", packId: "bakery-pack" } as never] }, ["s1", "x"], {
    "bakery-pack": false,
  }),
  ["x"],
  "a drama of a pack switched off does not run; its own switch stays",
);

// PR 5c: a pack topic switched off is a "never" for that pack only; tastes weigh picks; storylines give looks.
assert.equal(slurpPackTopicOff("bakery-pack", { topic: ["food"] }, { "bakery-pack:food": false }), true);
assert.equal(
  slurpPackTopicOff("bakery-pack", { needs: ["bak*"] }, { "bakery-pack:baking": false }),
  true,
  "needs count too",
);
assert.equal(
  slurpPackTopicOff("other-pack", { topic: ["food"] }, { "bakery-pack:food": false }),
  false,
  "only that pack",
);
assert.equal(slurpPackTopicOff("bakery-pack", { topic: ["food"] }, { "bakery-pack:food": true }), false);
assert.equal(slurpPackTopicOff("bakery-pack", undefined, { "bakery-pack:food": false }), false, "no fit, no topic");
assert.deepEqual(
  slpDramaEnabledIds(
    { ...imported, storylines: [{ id: "s1", packId: "bakery-pack", fit: { topic: ["food"] } } as never] },
    ["s1", "x"],
    { "bakery-pack:food": false },
  ),
  ["x"],
  "a pack storyline on a switched-off topic does not run",
);
assert.equal(slurpTasteWeight({ topic: ["baking"] }, []), 1);
assert.equal(slurpTasteWeight(undefined, [{ text: "baking", strength: "often" }]), 1);
assert.equal(slurpTasteWeight({ topic: ["baking"] }, [{ text: "baking bread", strength: "often" }]), 3);
assert.equal(
  slurpTasteWeight({ needs: ["bread*"], topic: ["food"] }, [
    { text: "bread", strength: "hint" },
    { text: "food", strength: "obsessed" },
  ]),
  5,
);
{
  const look = {
    name: "Apron",
    summary: "Flour-dusted apron",
    description: "A bakery apron, flour on the pocket.",
    tags: ["work"],
    suitability: "both" as const,
    enabled: true,
  };
  const own = { id: "l1", name: "Apron", source: { kind: "manual" as const } };
  const given = { id: "l2", name: "apron", source: { kind: "storyline" as const, label: "Bread day" } };
  assert.deepEqual(
    slurpStoryLookChange({ kind: "add-look", look }, [own]),
    { add: look },
    "the player's look is not the storyline's",
  );
  assert.equal(
    slurpStoryLookChange({ kind: "add-look", look }, [own, given], "Bread day"),
    null,
    "a look is given once",
  );
  assert.deepEqual(slurpStoryLookChange({ kind: "remove-look", name: "APRON" }, [own, given], "Bread day"), {
    remove: "l2",
  });
  assert.equal(
    slurpStoryLookChange({ kind: "remove-look", name: "Apron" }, [own]),
    null,
    "the player's own look stays",
  );
  assert.equal(
    slurpStoryLookChange({ kind: "remove-look", name: "Apron" }, [own, given], "Other story"),
    null,
    "a storyline takes back only its own look",
  );
  assert.equal(slurpStoryLookChange({ kind: "remove-creator-fact", tag: "x" }, [given]), null);
}

console.log("slurp2 content packs: ok");
