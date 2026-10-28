// Otome Forge's Home (M3): one message of the day per love interest per local day, across midnight in two zones and
// under requests that arrive together; a rupture makes the note curt and the lines cold; P16 and P15 carry the `home`
// wording (SFW whatever the Heat), the knowledge boundary, the no-absence rule, and P15 the comfort rule word for word;
// the note recalls as his own reader; line packs are background "ensure" jobs that backfill every love interest once,
// catch a new stage, never write a pack twice, and wait out a failure; the cut-out is made once and a failed one is
// never tried again; Home set and the unread count; tap annoyance, line picking and the typing delay (pure). A
// rupture that opens or is repaired later the same day replaces the day's note once; the note's recall is framed as
// what he may know; the small hours are late night and the note's day is the request's own instant; P15 keeps no
// question and its comfort lines are warmth only; a debug request folds into a line-pack job that waits; his face on
// Home follows a tap, then his note, then a rupture, and a tap line is voiced under a ref of its own words.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import { forgeTimeZoneRoutes } from "@forge-kit/time-zone-server.mjs";
import type {
  Grievance,
  StageLines,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { defaultContent } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import {
  LINE_COUNTS,
  sentenceCount,
  timeOfDayOf,
  wordCount,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/home.ts";
import { tapLineRef } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/audio.ts";
import {
  homeFace,
  isAnnoyed,
  pickLine,
  recordTap,
  tapMode,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/tap-mood.ts";
import { typingDelay } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/typing-delay.ts";
import {
  createCutoutClient,
  cutoutsSettled,
  type CutoutClient,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cutout.ts";
import { createBackgroundQueue } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/background-queue.ts";
import { COMFORT_RULE } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/content-contract.ts";
import { runForeground } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/generation.ts";
import {
  LINE_RETRY_MS,
  ensureLinePacks,
  normalizeLinePack,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/home/lines.ts";
import {
  checkNote,
  noteDay,
  serveNote,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/home/note.ts";
import {
  mentionsAbsence,
  NO_ABSENCE_RULE,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/home/prompts.ts";
import type {
  OtomeReply,
  RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  chatId,
  noteId,
  playerId,
  runDocTarget,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { normalizeThread } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/chat.ts";
import {
  registerHomeRoutes,
  type HomeRouteDeps,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/home.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { KAI, MIR, SOL, json, storyWorld } from "./fixtures/otome-forge-story.ts";

type Messages = CapabilityLanguageModelMessage[];
const system = (messages: Messages) => messages[0]!.content;
const isNote = (messages: Messages) => system(messages).includes("message of the day");
const isPack = (messages: Messages) => system(messages).includes("pre-written Home lines");

const noteReply = (text = "The lamp room was warm today. I left the kettle on for you.") => ({
  text,
  face: "tender",
  mood: { word: "restless", reason: "the north light again tonight" },
});

const lines = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix} line ${index + 1}.`);
const times = (zone: string) => ({
  morning: lines(`${zone} morning`, 3),
  day: lines(`${zone} day`, 3),
  night: lines(`${zone} night`, 3),
});
function packReply(name = "Kai") {
  return {
    tap: { head: times(`${name} head`), hand: times(`${name} hand`), heart: times(`${name} heart`) },
    annoyed: lines(`${name} annoyed`, 4),
    cold: lines(`${name} cold`, 6),
    comfort: lines(`${name} comfort`, 8),
    claw: {
      cheer: lines(`${name} cheer`, 4),
      cheat: lines(`${name} cheat`, 3),
      win: lines(`${name} win`, 3),
      miss: lines(`${name} miss`, 3),
      plush: lines(`${name} plush`, 3),
    },
  };
}

/** The love interest a line-pack prompt is for. */
const packName = (messages: Messages) => /Home lines of ([^,]+),/.exec(system(messages))?.[1] ?? "Kai";

/** Answers every call: a note for P16, a pack for P15 (named after whoever it is for). */
const answers = (note: () => Record<string, unknown> = () => noteReply()) =>
  Array.from({ length: 40 }, () => (messages: Messages) => {
    if (isNote(messages)) return json(note());
    if (isPack(messages)) return json(packReply(packName(messages)));
    throw new Error("unexpected prompt");
  });

/** The Home routes on a fake router, wrapped in the kit's time zones as server-entry wraps them. */
function homeRoutes(deps: HomeRouteDeps, runKey: string) {
  const routes = new Map<string, RouteHandler>();
  registerHomeRoutes(
    forgeTimeZoneRoutes({
      get: (path: string, handler: RouteHandler) => routes.set(`GET ${path}`, handler),
      post: (path: string, handler: RouteHandler) => routes.set(`POST ${path}`, handler),
    }),
    deps,
  );
  return async (
    method: "GET" | "POST",
    path: string,
    {
      body = {},
      params = {},
      timeZone = "UTC",
    }: { body?: object; params?: Record<string, string>; timeZone?: string } = {},
  ) => {
    const handler = routes.get(`${method} ${path}`);
    assert.ok(handler, `${method} ${path} is registered`);
    let status = 200;
    let payload: unknown;
    const reply: OtomeReply = {
      status(code) {
        status = code;
        return reply;
      },
      send(value) {
        payload = value;
        return reply;
      },
    };
    const fields = { timeZone, debugMode: true };
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

/** A forged world with Home's routes, a background lane and (optionally) a cut-out client. */
async function homeWorld(
  runKey: string,
  options: Omit<Parameters<typeof storyWorld>[0], "runKey"> = {},
  extra: Partial<HomeRouteDeps> = {},
) {
  const t = await storyWorld({ runKey, replies: answers(), ...options });
  const background = createBackgroundQueue(t.runtime);
  const deps: HomeRouteDeps = { ...t.deps, background, ...extra };
  const call = homeRoutes(deps, runKey);
  const notes = () => t.calls.filter((entry) => isNote(entry.messages));
  const packs = () => t.calls.filter((entry) => isPack(entry.messages));
  const unit = async (li: string) => (await t.store.readDoc(unitId(t.runId, li), normalizeUnit))!;
  return { ...t, background, deps, call, notes, packs, unit };
}

/** Lets queued foreground and background work run (the queues settle within a few turns). */
async function settle(runId: string, until: () => boolean | Promise<boolean> = () => false) {
  for (let round = 0; round < 200; round += 1) {
    if (await until()) return;
    await new Promise((resolve) => setImmediate(resolve));
    await runForeground(runId, async () => undefined);
  }
}

const note = (li: string, timeZone: string) => ({ body: { li }, timeZone });

// ── The message of the day ──

for (const { zone, before, after, day, next } of [
  // 23:58 and 00:01 local time, on each side of the zone's own midnight.
  {
    zone: "America/Los_Angeles",
    before: "2026-10-29T06:58:00.000Z",
    after: "2026-10-29T07:01:00.000Z",
    day: "2026-10-28",
    next: "2026-10-29",
  },
  {
    zone: "Asia/Tokyo",
    before: "2026-10-28T14:58:00.000Z",
    after: "2026-10-28T15:01:00.000Z",
    day: "2026-10-28",
    next: "2026-10-29",
  },
]) {
  test(`one note per love interest per local day, across midnight in ${zone}`, async (context) => {
    context.mock.timers.enable({ apis: ["Date"], now: Date.parse(before) });
    let count = 0;
    const t = await homeWorld(`r-note${zone === "Asia/Tokyo" ? "t" : "l"}-aaaaaa`, {
      replies: answers(() => noteReply(`Note number ${(count += 1)} for today, written in my own hand.`)),
    });

    const first = await t.call("POST", "/runs/:run/home/note", note(KAI, zone));
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.note.dayKey, day, "the day is the zone's own");
    assert.equal(first.body.note.li, KAI);
    assert.equal(first.body.note.face, "tender");
    assert.equal(first.body.note.mood.reason, "the north light again", "a long reason is cut to four words");
    assert.equal(first.body.note.connectionId, undefined, "the wire carries no connection");
    assert.ok(await t.store.readDoc(noteId(t.runId, day, KAI), (data) => data), "saved under its day");

    context.mock.timers.setTime(Date.parse(before) + 60_000);
    const again = await t.call("POST", "/runs/:run/home/note", note(KAI, zone));
    assert.equal(again.body.note.text, first.body.note.text, "a later visit the same day reads it back");
    const home = await t.call("GET", "/runs/:run/home", { timeZone: zone });
    assert.equal(home.body.note.text, first.body.note.text, "Home shows today's note");
    assert.equal(t.notes().length, 1, "one model call for the day");

    // Two requests at once for another love interest: one call, one note.
    const [a, b] = await Promise.all([
      t.call("POST", "/runs/:run/home/note", note(MIR, zone)),
      t.call("POST", "/runs/:run/home/note", note(MIR, zone)),
    ]);
    assert.equal(a.status, 200);
    assert.equal(a.body.note.text, b.body.note.text);
    assert.equal(t.notes().length, 2, "one call per love interest");

    context.mock.timers.setTime(Date.parse(after));
    const before3 = (await t.call("GET", "/runs/:run/home", { timeZone: zone })).body;
    assert.equal(before3.note, null, "a new local day has no note until it is asked for");
    const tomorrow = await t.call("POST", "/runs/:run/home/note", note(KAI, zone));
    assert.equal(tomorrow.body.note.dayKey, next);
    assert.notEqual(tomorrow.body.note.text, first.body.note.text);
    assert.equal(t.notes().length, 3);
    const prompt = t.notes().at(-1)!.messages.at(-1)!.content;
    assert.match(prompt, /RECENT NOTES[\s\S]*Note number 1 for today/, "yesterday's note is passed in, not repeated");
    assert.ok(!prompt.includes("Note number 2"), "another love interest's note is not his");
  });
}

test("P16 carries the home wording, the boundary and the no-absence rule; it recalls as his own reader", async () => {
  const recalls: unknown[] = [];
  const memory = {
    async recall(options: unknown) {
      recalls.push(options);
      return {
        status: { phase: "ready" as const, retryable: false },
        overview: "",
        details: [{ id: "phone-1", kind: "chat", title: "A call", content: "RECALLED: the night on the pier." }],
        text: "",
      };
    },
    maintain: async () => true,
  };
  const t = await homeWorld(
    "r-wrds-aaaaaa",
    { content: { ...defaultContent(), heat: "explicit", darkness: "dark" } },
    { memory: memory as unknown as HomeRouteDeps["memory"] },
  );
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    ledgers: { ...state.ledgers, offscreen: [{ key: "main-1", li: KAI, line: "OFFSCREEN: Kai rewired the bell." }] },
  }));
  assert.equal((await t.call("POST", "/runs/:run/home/note", note(KAI, "UTC"))).status, 200);
  const sent = t.notes()[0]!.messages;
  assert.ok(system(sent).includes(forgeKnowledgeBoundary), "the note carries the knowledge boundary");
  assert.match(system(sent), /CONTENT CONTRACT[\s\S]*Heat: SFW\./, "SFW wording whatever the Heat");
  assert.ok(!/Heat: NSFW/.test(system(sent)), "never the NSFW wording");
  assert.match(system(sent), /possessive or sharp about story events only/, "Dark only about story events");
  assert.ok(system(sent).includes(NO_ABSENCE_RULE));
  assert.match(system(sent), /No question that demands an answer/);
  assert.match(
    sent.at(-1)!.content,
    /What Kai may know of the story \(Kai remembers only what Kai was there for or was told; anything else reached Kai only as news, so the note never claims Kai was there\):\nRECALLED: the night on the pier/,
    "shared canon he may have been off-screen for is framed as news, never as his own memory",
  );
  assert.ok(!sent.at(-1)!.content.includes("Something Kai remembers"));
  assert.match(sent.at(-1)!.content, /OFFSCREEN: Kai rewired the bell/);
  assert.match(sent.at(-1)!.content, /TODAY\n\w+day (morning|afternoon|evening|late night, after midnight)\./);
  assert.ok(!sent.at(-1)!.content.includes("HIDDEN-TRUTH"), "an unrevealed secret shows only as tells");
  assert.equal(recalls.length, 1);
  assert.deepEqual(
    [(recalls[0] as { reader?: string }).reader, (recalls[0] as { job?: string }).job],
    [KAI, "chat"],
    "recall reads as Kai's own reader, so another's private canon never reaches his note",
  );
});

test("a note that asks, runs long or speaks of absence gets the repair turn; a decline saves nothing", async () => {
  const replies = [
    noteReply("Where have you been all this time, I wondered."),
    noteReply("Did you sleep at all last night?"),
    noteReply("Fine. The lamp is lit."),
  ];
  const t = await homeWorld("r-chck-aaaaaa", { replies: replies.map((reply) => json(reply)) });
  const first = await t.call("POST", "/runs/:run/home/note", note(KAI, "UTC"));
  assert.equal(first.status, 502, "absence then a question: bad-format");
  assert.equal(first.body.code, "bad-format");
  assert.equal(t.calls.length, 2, "one repair turn, never more");
  assert.match(t.calls[1]!.messages.at(-1)!.content, /never mention the protagonist being away/);
  assert.equal((await t.store.listRun("note", t.runId)).length, 0, "nothing saved");
  const second = await t.call("POST", "/runs/:run/home/note", note(KAI, "UTC"));
  assert.equal(second.status, 200, "the next visit writes it");
  assert.equal(second.body.note.text, "Fine. The lamp is lit.");

  const declined = await homeWorld("r-dcln-aaaaaa", { replies: ["", ""] });
  const refused = await declined.call("POST", "/runs/:run/home/note", note(KAI, "UTC"));
  assert.equal(refused.status, 422);
  assert.equal(refused.body.code, "declined");
  assert.equal((await declined.store.listRun("note", declined.runId)).length, 0);
});

// ── Rupture ──

test("a rupture makes the note curt and the lines cold", async () => {
  const grievance: Grievance = {
    id: "g-north",
    li: KAI,
    by: "li",
    text: "She told the harbour master about the north light.",
    severity: "rupture",
    opened: "main-1/5",
    status: "open",
  };
  const long = noteReply("I left the lamp lit, and the kettle, and a note on the stair, because I still cannot stop.");
  const t = await homeWorld("r-rupt-aaaaaa", {
    lis: { [KAI]: { grievances: [grievance], rupture: { grievanceId: "g-north", since: "2026-10-28T09:00:00.000Z" } } },
    replies: [json(long), json(noteReply("The lamp is lit."))],
  });
  const written = await t.call("POST", "/runs/:run/home/note", note(KAI, "UTC"));
  assert.equal(written.status, 200, JSON.stringify(written.body));
  assert.equal(written.body.note.text, "The lamp is lit.");
  const [firstTry, repair] = t.notes();
  assert.match(system(firstTry!.messages), /curt: one short, distant sentence of at most 14 words/);
  assert.match(firstTry!.messages.at(-1)!.content, /A rupture stands between them \(g-north\)/);
  assert.match(repair!.messages.at(-1)!.content, /14 words or fewer/, "a warm, long note is sent back");
  // A curt note is one sentence; a warm one may be two.
  const curt = checkNote(true, []);
  assert.equal(curt(noteReply("I am busy. Do not wait.")), "text must be one sentence");
  assert.equal((curt(noteReply("I am busy today.")) as { text: string }).text, "I am busy today.");
  assert.equal(
    (checkNote(false, [])(noteReply("I am busy. Do not wait.")) as { text: string }).text,
    "I am busy. Do not wait.",
  );

  const pack: StageLines = {
    stage: 1,
    tap: { head: times("head"), hand: times("hand"), heart: times("heart") },
    annoyed: lines("annoyed", 4),
    cold: lines("cold", 6),
    at: "2026-10-28T10:00:00.000Z",
  };
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    lines: { stages: { "1": pack }, fixed: null },
  }));
  const view = (await t.call("GET", "/runs/:run/lis/:li/lines", { params: { li: KAI } })).body;
  assert.equal(view.rupture, true);
  assert.equal(view.tap, null, "no warm tap line during a rupture");
  assert.deepEqual(view.annoyed, []);
  assert.deepEqual(view.cold, pack.cold, "only his cold lines");
  const home = (await t.call("GET", "/runs/:run/home")).body;
  assert.equal(home.rupture, true);
  const calm = (await t.call("GET", "/runs/:run/lis/:li/lines", { params: { li: MIR } })).body;
  assert.equal(calm.rupture, false, "a rupture is his alone");
});

test("a rupture that opens or is repaired later the same day replaces the day's note once", async () => {
  let count = 0;
  const t = await homeWorld("r-flip-aaaaaa", {
    replies: answers(() => noteReply(`The lamp is lit, note ${(count += 1)}.`)),
  });
  const warm = await t.call("POST", "/runs/:run/home/note", note(KAI, "UTC"));
  assert.equal(warm.status, 200, JSON.stringify(warm.body));
  assert.equal(warm.body.note.curt, false);
  const grievance: Grievance = {
    id: "g-bell",
    li: KAI,
    by: "li",
    text: "She rang the bell he asked her not to.",
    severity: "rupture",
    opened: "main-1/4",
    status: "open",
  };
  const setRupture = (open: boolean) =>
    t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
      ...state,
      lis: {
        ...state.lis,
        [KAI]: {
          ...state.lis[KAI]!,
          grievances: [{ ...grievance, status: open ? "open" : "addressed" }],
          rupture: open ? { grievanceId: grievance.id, since: "2026-10-28T12:00:00.000Z" } : null,
        },
      },
    }));

  // A chapter opens a rupture: Home has no note until the curt one is written, and requests together write it once.
  await setRupture(true);
  const stale = (await t.call("GET", "/runs/:run/home")).body;
  assert.deepEqual([stale.rupture, stale.note], [true, null], "the warm note is stale");
  const [a, b] = await Promise.all([
    t.call("POST", "/runs/:run/home/note", note(KAI, "UTC")),
    t.call("POST", "/runs/:run/home/note", note(KAI, "UTC")),
  ]);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.deepEqual([a.body.note.text, a.body.note.curt], [b.body.note.text, true]);
  assert.notEqual(a.body.note.text, warm.body.note.text);
  assert.equal(t.notes().length, 2, "one more call for the rupture");
  assert.match(system(t.notes()[1]!.messages), /curt: one short, distant sentence/);
  assert.equal((await t.call("GET", "/runs/:run/home")).body.note.text, a.body.note.text, "Home shows the curt note");
  assert.equal((await t.call("POST", "/runs/:run/home/note", note(KAI, "UTC"))).body.note.text, a.body.note.text);

  // Repaired the same day: a warm note again, once; still one document for the day.
  await setRupture(false);
  assert.equal((await t.call("GET", "/runs/:run/home")).body.note, null);
  const mended = await t.call("POST", "/runs/:run/home/note", note(KAI, "UTC"));
  assert.equal(mended.body.note.curt, false);
  assert.equal(t.notes().length, 3);
  assert.equal((await t.store.listRun("note", t.runId)).length, 1);
});

test("the small hours are late night, and the note's day is the instant the request named it", async (context) => {
  // Saturday 2026-10-31, 02:00 UTC: the small hours, not Saturday evening.
  context.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-31T02:00:00.000Z") });
  const t = await homeWorld("r-hour-aaaaaa");
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, MIR)), normalizeUnit, (unit) => ({
    ...unit,
    bible: { ...unit.bible!, birthday: "10-30" },
  }));
  assert.equal((await t.call("POST", "/runs/:run/home/note", note(KAI, "UTC"))).status, 200);
  assert.match(t.notes()[0]!.messages.at(-1)!.content, /TODAY\nSaturday late night, after midnight\.\n/);

  // A request that named its day at 23:59 on Friday and ran after midnight: Friday's note, told it is Friday evening
  // and Mireille's birthday (Friday's), never Saturday's.
  const late = await serveNote(t.deps, t.runId, MIR, { debugMode: false, now: Date.parse("2026-10-30T23:59:00.000Z") });
  assert.equal(late.dayKey, "2026-10-30");
  assert.match(t.notes()[1]!.messages.at(-1)!.content, /TODAY\nFriday evening\. Today is Mireille's birthday\./);
  assert.deepEqual(noteDay({ name: "Kai", bible: null }, { createdAt: "" }, Date.parse("2026-10-31T19:00:00.000Z")), {
    weekday: "Saturday",
    hour: 19,
    special: [],
  });
});

// ── Line packs ──

test("P15: the line-pack schema, the comfort rule and the counts", async () => {
  const at = "2026-10-28T10:00:00.000Z";
  const ok = normalizeLinePack(packReply(), { stage: 2, withFixed: true, at });
  assert.ok(typeof ok !== "string", String(ok));
  assert.equal(ok.stage.stage, 2);
  assert.equal(ok.stage.tap.heart.night.length, LINE_COUNTS.tap);
  assert.equal(ok.stage.cold.length, LINE_COUNTS.cold);
  assert.equal(ok.fixed!.comfort.length, LINE_COUNTS.comfort);
  assert.equal(ok.fixed!.claw.cheat.length, LINE_COUNTS.claw.cheat);
  const stageOnly = normalizeLinePack(
    { ...packReply(), comfort: null, claw: null },
    { stage: 3, withFixed: false, at },
  );
  assert.ok(typeof stageOnly !== "string" && stageOnly.fixed === null, "a later stage writes no fixed lines");

  const tooLong = packReply();
  tooLong.cold[0] = "This line keeps going on and on far past the fourteen word limit that every line keeps.";
  assert.match(String(normalizeLinePack(tooLong, { stage: 1, withFixed: true, at })), /cold needs 6 distinct lines/);
  const repeated = packReply();
  repeated.annoyed = ["Enough.", "enough.", "Enough", "Stop."];
  assert.match(String(normalizeLinePack(repeated, { stage: 1, withFixed: true, at })), /annoyed needs 4/);
  const away = packReply();
  away.tap.hand.day[1] = "Welcome back, finally.";
  assert.match(String(normalizeLinePack(away, { stage: 1, withFixed: true, at })), /tap\.hand\.day/);
  assert.match(
    String(normalizeLinePack({ ...packReply(), comfort: [] }, { stage: 1, withFixed: true, at })),
    /comfort needs 8/,
  );
  // A stored line is replayed on every tap or Rough day?, with no way to answer it: no question, in any script.
  const asks = packReply();
  asks.tap.head.morning[0] = "Have you eaten today?";
  assert.match(
    String(normalizeLinePack(asks, { stage: 1, withFixed: true, at })),
    /tap\.head\.morning needs 3 distinct lines .* never ask a question \(got 2\)/,
  );
  const comfortAsks = packReply();
  comfortAsks.comfort[0] = "¿Comiste algo hoy";
  assert.match(String(normalizeLinePack(comfortAsks, { stage: 1, withFixed: true, at })), /comfort needs 8/);
  const rhetorical = packReply();
  rhetorical.annoyed[0] = "Again?";
  const kept = normalizeLinePack(rhetorical, { stage: 1, withFixed: true, at });
  assert.ok(typeof kept !== "string" && kept.stage.annoyed[0] === "Again?", "an annoyed line may be rhetorical");
});

test("line packs backfill every love interest once in the background, catch a new stage and never write twice", async () => {
  const t = await homeWorld("r-pack-aaaaaa");
  const before = await t.call("GET", "/runs/:run/lis/:li/lines", { params: { li: KAI } });
  assert.equal(before.body.ready, false, "until his pack exists, Home uses the catalog's lines");
  assert.equal(before.body.tap, null);
  assert.deepEqual(before.body.comfort, []);

  // The first Home visit queues every love interest's pack; another visit while they wait queues nothing more.
  assert.equal((await t.call("GET", "/runs/:run/home")).body.lines.ready, false, "Home never waits for the pack");
  await t.call("GET", "/runs/:run/home");
  await settle(t.runId, async () => (await t.unit(SOL)).lines?.fixed != null && t.packs().length >= 3);
  await settle(t.runId);
  assert.equal(t.packs().length, 3, "one P15 call per love interest");
  assert.ok(
    t.calls.filter((entry) => isPack(entry.messages)).every((entry) => entry.connectionId === "conn-text"),
    "on the structured job's connection (narration here)",
  );
  const sent = t.packs()[0]!.messages;
  assert.ok(system(sent).includes(COMFORT_RULE), "the comfort rule, word for word");
  assert.match(
    system(sent),
    /- comfort: [^\n]*These lines are warmth only, whatever the stage and the rules below: no darkness, possessiveness/,
    "Darkness never reaches the comfort pool (plan §1.7)",
  );
  assert.ok(system(sent).includes(forgeKnowledgeBoundary));
  assert.ok(system(sent).includes(NO_ABSENCE_RULE));
  assert.match(system(sent), /CONTENT CONTRACT[\s\S]*Heat: SFW\./);
  assert.match(sent.at(-1)!.content, /LOVE INTEREST\nKai \(he\/him\) — stage 1/, "his scene card");

  for (const li of [KAI, MIR, SOL]) {
    const view = (await t.call("GET", "/runs/:run/lis/:li/lines", { params: { li } })).body;
    assert.equal(view.ready, true, li);
    assert.equal(view.stage, 1);
    assert.equal(view.tap.head.morning.length, 3);
    assert.equal(view.comfort.length, 8);
    assert.equal(view.claw.plush.length, 3);
  }
  assert.match((await t.call("GET", "/runs/:run/lis/:li/lines", { params: { li: MIR } })).body.cold[0], /^Mireille/);
  await t.call("GET", "/runs/:run/home");
  await settle(t.runId);
  assert.equal(t.packs().length, 3, "a later visit writes nothing");

  // Kai reaches stage 2: only his stage-2 pack is written, without the fixed lines, and stage 1's stays.
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: { ...state.lis, [KAI]: { ...state.lis[KAI]!, stage: 2 } },
  }));
  const stale = (await t.call("GET", "/runs/:run/lis/:li/lines", { params: { li: KAI } })).body;
  assert.equal(stale.ready, false);
  assert.equal(stale.tap.head.day[0], "Kai head day line 1.", "meanwhile the nearest stage's lines");
  await settle(t.runId, async () => !!(await t.unit(KAI)).lines?.stages["2"]);
  assert.equal(t.packs().length, 4);
  assert.ok(!system(t.packs()[3]!.messages).includes(COMFORT_RULE), "the fixed lines are written once");
  const kai = await t.unit(KAI);
  assert.ok(kai.lines?.stages["1"] && kai.lines.stages["2"]);
  assert.equal(kai.lines!.fixed!.comfort[0], "Kai comfort line 1.", "the fixed lines are never replaced");
  assert.ok(t.calls.every((entry) => entry.options?.temperature === 0.9));
});

test("a failed pack waits before it is tried again", async (context) => {
  context.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-28T10:00:00.000Z") });
  const t = await homeWorld("r-fail-aaaaaa", { replies: ["", "", ...answers()] });
  await t.call("GET", "/runs/:run/lis/:li/lines", { params: { li: KAI } });
  await settle(t.runId, () => t.calls.length >= 2);
  await settle(t.runId);
  assert.equal(t.calls.length, 2, "a declined pack: the call and its repair turn, nothing more");
  await t.call("GET", "/runs/:run/lis/:li/lines", { params: { li: KAI } });
  await settle(t.runId);
  assert.equal(t.calls.length, 2, "not asked again at once");
  context.mock.timers.setTime(Date.parse("2026-10-28T10:00:00.000Z") + LINE_RETRY_MS + 1);
  await t.call("GET", "/runs/:run/lis/:li/lines", { params: { li: KAI } });
  await settle(t.runId, async () => !!(await t.unit(KAI)).lines);
  assert.equal(t.packs().length, 3, "tried again once the cool-down is over");
});

test("a debug request folds into a line-pack job that is still waiting, so its prompt is logged", async () => {
  const t = await homeWorld("r-dbug-aaaaaa");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  // Something else holds the connection's background slot (memory upkeep, say).
  t.background.ensure({ key: "blocker", connectionId: "conn-text", run: () => gate });
  assert.deepEqual(await ensureLinePacks(t.deps, t.runId, [KAI], { debugMode: false }), [KAI]);
  assert.deepEqual(await ensureLinePacks(t.deps, t.runId, [KAI], { debugMode: true }), [], "already waiting");
  release();
  await settle(t.runId, async () => !!(await t.unit(KAI)).lines);
  const logged = t.logs.filter((entry) => entry.level === "debugOverride" && entry.args[0] === "line-pack");
  assert.ok(logged.length >= 1 && logged.every((entry) => entry.override === true), "logged as the UI asked");
});

// ── Cut-outs ──

test("the worn look is cut out once; a failed cut-out pans and is never tried again", async () => {
  const cuts: string[] = [];
  let fail = false;
  const cutouts: CutoutClient = {
    async cutOut(url) {
      cuts.push(url);
      if (fail) throw new Error("no background remover");
      return { id: `cut${cuts.length}`, url: `/api/global-gallery/file/cut-${cuts.length}.png` };
    },
    deleteGalleryImage: async () => true,
  };
  const t = await homeWorld("r-cuts-aaaaaa", {}, { cutouts });
  const portrait = "/api/global-gallery/file/kai.png";
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    portrait,
  }));
  const [one, two] = await Promise.all([t.call("GET", "/runs/:run/home"), t.call("GET", "/runs/:run/home")]);
  assert.deepEqual(one.body.look, { url: portrait, source: "look", cutoutState: "pending" });
  assert.equal(two.body.look.cutoutState, "pending");
  await cutoutsSettled();
  assert.deepEqual(cuts, [portrait], "made once");
  const ready = (await t.call("GET", "/runs/:run/home")).body.look;
  assert.deepEqual(ready, {
    url: portrait,
    source: "look",
    cutoutState: "ready",
    cutout: "/api/global-gallery/file/cut-1.png",
  });
  assert.equal((await t.unit(KAI)).cutouts[portrait]!.ref, "global-gallery:cut1", "a deleted run takes it along");

  fail = true;
  const repainted = "/api/global-gallery/file/kai-2.png";
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    portrait: repainted,
  }));
  await t.call("GET", "/runs/:run/home");
  await cutoutsSettled();
  const uncut = (await t.call("GET", "/runs/:run/home")).body.look;
  assert.equal(uncut.cutoutState, "uncut", "the slow pan over the uncut look");
  await cutoutsSettled();
  assert.equal(cuts.length, 2, "never tried again");

  // A cut-out left pending by a restart is never made again either.
  const orphan = "/api/global-gallery/file/kai-3.png";
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    portrait: orphan,
    cutouts: { ...unit.cutouts, [orphan]: { state: "pending", at: "2026-10-28T09:00:00.000Z" } },
  }));
  assert.equal((await t.call("GET", "/runs/:run/home")).body.look.cutoutState, "uncut");
  await cutoutsSettled();
  assert.equal(cuts.length, 2);
});

test("Home's faces are the ready set on his worn look, read through the kit, each cut out in turn", async () => {
  const cuts: string[] = [];
  const cutouts: CutoutClient = {
    async cutOut(url) {
      cuts.push(url);
      return { id: `c${cuts.length}`, url: `${url}.cut.png` };
    },
    deleteGalleryImage: async () => true,
  };
  const t = await homeWorld("r-face-aaaaaa", {}, { cutouts });
  const portrait = "/api/global-gallery/file/kai.png";
  const set = (state: string) => ({
    [portrait]: {
      state,
      at: "2026-10-28T10:00:00.000Z",
      images: { tender: { url: "/t.png" }, cold: { url: "/c.png" } },
    },
  });
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    portrait,
    expressions: set("pending"),
  }));
  assert.deepEqual((await t.call("GET", "/runs/:run/home")).body.faces, {}, "a set still painting shows none");
  await cutoutsSettled();
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    expressions: set("ready"),
  }));
  await t.store.mutateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    images: { ...world.images, expressions: true },
  }));
  // Each face says its cut-out is on its way, so Home asks again until it lands (the look's alone was not enough: a
  // look cut out on an earlier visit left Home showing his uncut faces for the whole visit).
  const painting = (await t.call("GET", "/runs/:run/home")).body;
  assert.equal(painting.look.cutoutState, "ready", "his look was cut out on the visit before");
  assert.deepEqual(painting.faces, {
    tender: { url: "/t.png", cutoutState: "pending" },
    cold: { url: "/c.png", cutoutState: "pending" },
  });
  await cutoutsSettled();
  assert.deepEqual(cuts, [portrait, "/t.png", "/c.png"], "the look, then each ready face, once");
  assert.deepEqual((await t.call("GET", "/runs/:run/home")).body.faces, {
    tender: { url: "/t.png", cutout: "/t.png.cut.png", cutoutState: "ready" },
    cold: { url: "/c.png", cutout: "/c.png.cut.png", cutoutState: "ready" },
  });
});

test("L0 is his newest unlocked CG, else the newest painted place, never another love interest's CG", async () => {
  const t = await homeWorld("r-back-aaaaaa");
  const backdrop = async () => (await t.call("GET", "/runs/:run/home")).body.backdrop;
  assert.equal(await backdrop(), null, "nothing painted: the gradient alone");

  const place = (name: string, at: string, state = "ready") => ({
    name,
    tags: "harbour, night",
    art: { state, at, ...(state === "ready" ? { url: `/api/global-gallery/file/${name}.png` } : {}) },
  });
  await t.store.mutateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    places: {
      quay: place("quay", "2026-10-28T09:00:00.000Z"),
      tower: place("tower", "2026-10-28T11:00:00.000Z"),
      cellar: place("cellar", "2026-10-28T12:00:00.000Z", "pending"),
    },
  }));
  assert.deepEqual(await backdrop(), { url: "/api/global-gallery/file/tower.png", kind: "place" });

  const cg = (key: string, li: string, at: string) => ({
    key,
    url: `/api/global-gallery/file/${key}.png`,
    ref: key,
    at,
    li,
  });
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    album: {
      cgs: [
        cg("main-1-0", KAI, "2026-10-28T08:00:00.000Z"),
        cg("main-2-1", KAI, "2026-10-28T10:00:00.000Z"),
        cg(`route-${MIR}-2-0`, MIR, "2026-10-28T13:00:00.000Z"),
      ],
    },
  }));
  assert.deepEqual(await backdrop(), { url: "/api/global-gallery/file/main-2-1.png", kind: "cg" }, "his newest CG");
  await t.call("POST", "/runs/:run/home/set", { body: { li: SOL } });
  assert.deepEqual(await backdrop(), { url: "/api/global-gallery/file/tower.png", kind: "place" }, "none of his own");
  await t.call("POST", "/runs/:run/home/set", { body: { li: MIR } });
  assert.equal((await backdrop()).url, `/api/global-gallery/file/route-${MIR}-2-0.png`, "hers behind her");
});

// ── Home set, Him and Me, unread ──

test("a stalled loopback read or cleanup times out, so the cut-out fails instead of holding the queue", async () => {
  // Answers the look itself at once; every other request (the cleanup) waits until its signal aborts.
  const look = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489", "hex");
  const stalled = (answerSource: boolean): typeof fetch =>
    ((input: string | URL | Request, init?: RequestInit) => {
      const signal = init?.signal;
      if (!signal) return Promise.reject(new Error("a loopback request without a timeout"));
      if (answerSource && String(input).endsWith("/look.png")) {
        return Promise.resolve(new Response(look, { headers: { "content-type": "image/png" } }));
      }
      return new Promise<Response>((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
    }) as typeof fetch;
  for (const answerSource of [false, true]) {
    const client = createCutoutClient({ baseUrl: "http://127.0.0.1:9", fetch: stalled(answerSource), timeoutMs: 20 });
    await assert.rejects(client.cutOut("/api/global-gallery/file/look.png"), { name: "TimeoutError" });
  }
});

test("Home shows the chosen love interest or the protagonist, and counts unread replies", async () => {
  const t = await homeWorld(
    "r-show-aaaaaa",
    {},
    { cutouts: { cutOut: async () => ({ url: "/x.png" }), deleteGalleryImage: async () => true } },
  );
  const first = (await t.call("GET", "/runs/:run/home")).body;
  assert.equal(first.li, KAI, "the first love interest in cast order by default");
  assert.equal(first.show, "him");
  assert.equal(first.look, null, "no image: initials on a gradient");
  assert.deepEqual(first.faces, {});
  assert.equal(first.unread, 0);

  const set = await t.call("POST", "/runs/:run/home/set", { body: { li: MIR, show: "me" } });
  assert.deepEqual(set.body.home, { li: MIR, show: "me" });
  assert.equal((await t.call("POST", "/runs/:run/home/set", { body: { li: "li-nobody-zz99" } })).status, 404);
  assert.equal((await t.call("POST", "/runs/:run/home/set", { body: { show: "her" } })).status, 400);
  await t.store.mutateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    portrait: "/api/global-gallery/file/ines.png",
  }));
  const me = (await t.call("GET", "/runs/:run/home")).body;
  assert.equal(me.li, MIR);
  assert.deepEqual(me.look, { url: "/api/global-gallery/file/ines.png", source: "look", cutoutState: "uncut" });

  await t.store.mutateDoc(runDocTarget("chat", chatId(t.runId, KAI)), normalizeThread, () => ({
    version: 1,
    li: KAI,
    messages: [
      { id: "m-1-aaaaaaaa", who: "player", text: "Hi", at: "2026-10-28T09:00:00.000Z" },
      { id: "m-2-aaaaaaaa", who: "li", text: "Hm.", at: "2026-10-28T09:01:00.000Z" },
      { id: "m-3-aaaaaaaa", who: "li", text: "Fine.", at: "2026-10-28T09:05:00.000Z" },
    ],
    sessions: [],
    seenAt: "2026-10-28T09:02:00.000Z",
    suggestions: [],
  }));
  assert.equal((await t.call("GET", "/runs/:run/home")).body.unread, 1, "his replies after the thread was seen");
  assert.equal((await t.call("POST", "/runs/:run/home/note", note("li-nobody-zz99", "UTC"))).status, 404);
});

// ── Pure ──

test("tap annoyance, time of day, the word counts, line picks and the typing delay (pure)", () => {
  let taps: number[] = [];
  for (let index = 0; index < 5; index += 1) taps = recordTap(taps, 1_000 + index * 1_000);
  assert.equal(isAnnoyed(taps, 5_000), false, "five taps are fine");
  taps = recordTap(taps, 6_000);
  assert.equal(isAnnoyed(taps, 6_000), true, "the sixth inside 20 s annoys him");
  assert.equal(tapMode(taps, 6_000, false), "annoyed");
  assert.equal(isAnnoyed(taps, 30_000), false, "it passes");
  assert.equal(tapMode([], 0, true), "cold", "a rupture is cold whatever the taps");

  assert.deepEqual([4, 5, 11, 12, 17, 18, 23, 0].map(timeOfDayOf), [
    "night",
    "morning",
    "morning",
    "day",
    "day",
    "night",
    "night",
    "night",
  ]);
  assert.equal(wordCount("You left the lab light on again."), 7);
  assert.equal(wordCount("灯りを消しておいた。"), 5, "CJK: one word per two characters");
  assert.equal(
    wordCount("그는 아침에도 연구실의 불을 끄고 아무런 말도 없이 조용히 돌아왔습니다."),
    10,
    "Korean puts spaces between its words: 10 words of 30 syllables are 10, within a line's 14",
  );
  assert.equal(sentenceCount("You left it on. I turned it off. Don't thank me."), 3);
  assert.equal(sentenceCount("灯りを消した。礼はいらない。"), 2);
  assert.equal(sentenceCount("No full stop at the end"), 1);
  assert.equal(sentenceCount("Rest well. ♡"), 1, "a trailing symbol is not a sentence");
  assert.equal(sentenceCount("Hi! :)"), 1);
  assert.equal(sentenceCount("Rest well.♡"), 1, "a symbol glued to the terminator still closes the sentence");
  assert.equal(sentenceCount("One. Two. Three.♡"), 3);
  assert.equal(sentenceCount("Wait...what"), 1, "an ellipsis glued to a word is one mark, not a closed sentence");
  assert.equal(mentionsAbsence("You’re back"), true, "a curly apostrophe is the same contraction");
  assert.equal(mentionsAbsence("you’ve been gone"), true);
  assert.equal(mentionsAbsence("you're back"), true);

  // A tap never repeats the line just shown while the pool has another; the phone types 40 ms a character, 4 s at most,
  // less what the player already waited.
  assert.equal(
    pickLine(["a", "b"], "a", () => 0),
    "b",
  );
  assert.equal(pickLine(["a"], "a"), "a", "a pool of one repeats");
  assert.equal(pickLine([], null), null);
  assert.equal(typingDelay(""), 0);
  assert.equal(typingDelay("hello"), 200);
  assert.equal(typingDelay("a".repeat(200)), 4000, "capped");
  assert.equal(typingDelay("hello", 100), 100, "less the wait already spent");
  assert.equal(typingDelay("hello", 9_000), 0);
});

test("his face on Home and the ref a tap line is voiced under (pure)", () => {
  // A tap's face while its line shows, else the note's, else cold during a rupture, else his plain look.
  assert.equal(homeFace("hurt", "fond", false), "tender");
  assert.equal(homeFace("hurt", "annoyed", false), "flustered");
  assert.equal(homeFace("tender", "cold", true), "cold");
  assert.equal(homeFace("hurt", null, true), "hurt", "the note's face outlasts the rupture's default");
  assert.equal(homeFace("", null, true), "cold");
  assert.equal(homeFace("", null, false), "");
  // Each line has its own clip (the Engine never keys one by its text), stable from visit to visit.
  const ref = tapLineRef(KAI, "Careful with the hair.");
  assert.match(ref, new RegExp(`^tap:${KAI}:[0-9a-z]+$`));
  assert.equal(tapLineRef(KAI, "Careful with the hair."), ref);
  assert.notEqual(tapLineRef(KAI, "Careful with the hair!"), ref);
  assert.notEqual(tapLineRef(MIR, "Careful with the hair."), ref);
});
