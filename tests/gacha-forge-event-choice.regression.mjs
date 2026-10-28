// Chapters → What happens next offers the season's story event beside the next chapter and any Character Story
// (1.26.0). This reads the shipped client: the chapter list renderer, the forge loader, the chapter map and the
// busy labels, plus the seasonal source that wires the event's row.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { forgeSeasonalEnglish } from "../packages/gacha-forge/src/seasonal-events-en.mjs";
import {
  adoptForgeSeasonalResponse,
  forgeSeasonalHeld,
  openForgeSeasonalEvent,
  wireForgeSeasonalEvents,
} from "../packages/gacha-forge/src/seasonal-events-client.mjs";
import { chapterRunId, chapterUnitId, createChapterRuntime } from "./fixtures/gacha-forge-chapter-runtime.mjs";

const directory = await mkdtemp(join(tmpdir(), "gacha-event-choice-"));
const copy = join(directory, "client.mjs");
globalThis.HTMLElement = class {};
globalThis.window = globalThis;
const source = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
await writeFile(copy, source + "\nexport { bp, Js, Zd, Ox, forgeSeasonalNextStory, forgeSeasonalRequest };\n");
const client = await import(pathToFileURL(copy).href);
await rm(directory, { recursive: true, force: true });
const { bp, Js, Zd, Ox, forgeSeasonalNextStory } = client;

const now = Date.now();
const event = {
  seq: 1,
  chapter: "event-1",
  title: "The Lantern Crossing",
  art: "/art.webp",
  state: "ready",
  live: true,
  canStart: true,
  played: 0,
  endsAt: now + 864e5,
};
const offered = (changes = {}, story = { seasonalEvents: true }) =>
  forgeSeasonalNextStory({ _run: { story }, _forgeSeasonalState: { events: [{ ...event, ...changes }] } });
const cleared = [
  { chapter: 1, title: "Embers", premise: "", combats: 3, normal: 10, hard: 0, veryhard: 0, cleared: true },
];
const offer = { id: "w:unit:arden", part: 1, name: "Arden", state: "pending", beats: 0, after: 1 };
const lists = {
  "next chapter only": [cleared, 2, true, { offers: [], beats: 3, heldBy: "" }],
  "next chapter or a Character Story": [cleared, 2, true, { offers: [offer], beats: 3, heldBy: "" }],
  "a Character Story open": [
    cleared,
    2,
    false,
    { offers: [{ ...offer, state: "open", beats: 1 }], beats: 3, heldBy: "Arden" },
  ],
  "next chapter forged, not started": [
    [...cleared, { chapter: 2, title: "Ash", premise: "", combats: 3, normal: 0, cleared: false }],
    3,
    false,
    { offers: [], beats: 3, heldBy: "" },
  ],
};
const rows = (html) =>
  [...html.matchAll(/<div class="ch-opt"( data-[a-z-]+="[^"]*")>/gu)].map((match) => match[1].trim());

test("the event is offered only when it can start, and every other list is unchanged", () => {
  for (const [why, changes, story] of [
    ["blocked by a half-played story", { canStart: false }],
    ["still preparing", { state: "preparing" }],
    ["ended", { live: false, endsAt: now - 1 }],
    ["Seasonal events off", {}, { seasonalEvents: false }],
    ["finished", { opened: now, played: 10 }],
  ])
    assert.equal(offered(changes, story), null, why);
  for (const [name, [chapters, next, unlocked, options]] of Object.entries(lists)) {
    const plain = bp(chapters, next, unlocked, options);
    assert.equal(bp(chapters, next, unlocked, { ...options, event: null }), plain, name);
    const withEvent = bp(chapters, next, unlocked, { ...options, event: offered() });
    if (!unlocked) assert.equal(withEvent, plain, `${name}: no choice card, so no event row`);
  }
});

test("a startable event is the last option of What happens next, after the unchanged chapter and Character Story rows", () => {
  for (const name of ["next chapter only", "next chapter or a Character Story"]) {
    const [chapters, next, unlocked, options] = lists[name];
    const plain = bp(chapters, next, unlocked, options),
      html = bp(chapters, next, unlocked, { ...options, event: offered() });
    assert.match(html, /<h3 class="ch-title">What happens next<\/h3>/u, name);
    assert.deepEqual(rows(html), [
      'data-open-chapter="2"',
      ...(options.offers.length ? ['data-open-bond="w:unit:arden#1"'] : []),
      'data-story-event-open="event-1"',
    ]);
    for (const row of plain.match(/<div class="ch-opt".*?<\/button><\/div>/gu) || [])
      assert.ok(html.includes(row), name);
    const row = /<div class="ch-opt" data-story-event-open="event-1">.*?<\/div>/u.exec(html)[0];
    assert.match(row, /<img src="\/art\.webp"/u);
    assert.match(row, /<b>The Lantern Crossing<\/b>/u);
    assert.match(row, /seven scenes and three fights\. Chapter Two stays where it is, but waits until you finish\./u);
    assert.match(row, new RegExp(forgeSeasonalEnglish["events.play"], "u"));
  }
});

test("a started event takes the next chapter's place until it is finished, as an open Character Story does", () => {
  const [chapters, next, unlocked, options] = lists["next chapter or a Character Story"];
  const html = bp(chapters, next, unlocked, { ...options, event: offered({ opened: now, played: 3 }) });
  assert.deepEqual(rows(html), [], "no Begin on the chapter or a Character Story it holds");
  assert.match(
    html,
    /<article class="ch-card bond open" data-story-event-open="event-1">.*Story event · Open.*The Lantern Crossing.*The main story waits until you finish it\..*Played 3 \/ 10.*Continue event/u,
  );
});

test("the forge loader and the chapter map name the event; chapters and Character Stories read as before", () => {
  const text = (html, pattern) => pattern.exec(html)?.[1];
  const loader = Js({ chapter: "event-1", forgeEvent: "The Lantern Crossing" });
  assert.equal(text(loader, /<span class="eyebrow">(.*?)<\/span>/u), "Forging a story event");
  assert.equal(text(loader, /<h2>(.*?)<\/h2>/u), "The Lantern Crossing");
  assert.match(loader, /Forging The Lantern Crossing from everything that has happened/u);
  assert.equal(text(Js({ chapter: 2 }), /<h2>(.*?)<\/h2>/u), "Chapter Two");
  assert.equal(
    text(Js({ chapter: "bond-arden", bondLabel: "Arden's Story" }), /<span class="eyebrow">(.*?)<\/span>/u),
    "Forging a Character Story",
  );
  const plan = { title: "The crossing", nodes: [{ type: "story", title: "Lanterns" }] };
  const eyebrow = (props) =>
    text(Zd({ plan, difficulty: "normal", progress: { normal: 0 }, ...props }), /<div class="eyebrow">(.*?)<\/div>/u);
  assert.equal(eyebrow({ chapterNumber: "event-1", forgeEvent: "The Lantern Crossing" }), "The Lantern Crossing");
  assert.equal(eyebrow({ chapterNumber: 2 }), "Chapter Two");
});

test("the busy pill names an event's scenes and fights written in the background", () => {
  const label = (key) => {
    const entry = Ox.find((candidate) => candidate.match.test(key));
    return entry ? entry.label(key.match(entry.match)) : "Generating";
  };
  assert.equal(label("w:beat:event-1:3"), "Writing the next scene");
  assert.equal(label("w:combat:event-1:0"), "Designing a fight");
  assert.equal(label("w:combat:2:0"), "Designing a fight · chapter 2");
});

test("an event chapter pre-forges through the main /preforge routes and keeps its own story routes", () => {
  const { forgeSeasonalRequest } = client;
  for (const path of ["/preforge", "/preforge/start", "/preforge/retry", "/preforge/cancel"])
    assert.equal(forgeSeasonalRequest(path, { chapter: "event-1" }), path);
  assert.equal(forgeSeasonalRequest("/chapter-plan", { chapter: "event-1" }), "/story-event/plan");
  assert.equal(forgeSeasonalRequest("/choice", { chapter: "event-1" }), "/story-event/choice");
});

test("the row starts the event, the archive does not repeat it, a held chapter opens the event, and new progress reads events again", async () => {
  // The seasonal source as the bundle inlines it, with the bundle's own helpers stubbed.
  Object.assign(globalThis, {
    forgeSeasonalEnglish,
    wireForgeBannerAnimation() {},
    syncForgeAudio() {},
    stopForgeStoryRequests() {},
  });
  const listener = () => {
    const node = { dataset: { storyEventOpen: "event-1" }, addEventListener: (_type, run) => (node.click = run) };
    return node;
  };
  const row = listener(),
    appended = [];
  const chapters = {
    querySelector: (selector) => (selector === '[data-story-event-open="event-1"]' ? row : null),
    append: (section) => appended.push(section),
  };
  globalThis.document = { createElement: () => ({ dataset: {} }) };
  let loads = 0;
  const host = {
    _root: {
      querySelector: (selector) =>
        selector === "[data-forge-seasonal-layout]" ? {} : selector === "[data-chapters-list]" ? chapters : null,
      querySelectorAll: (selector) => (selector === "[data-story-event-open]" ? [row] : []),
    },
    _run: { runId: "w", story: { seasonalEvents: true } },
    _forgeSeasonalRunId: "w",
    _forgeSeasonalEnabled: true,
    _forgeSeasonalState: { events: [event] },
    _hudView: "chapters",
    _chaptersData: { chapters: [] },
    _eventSlots: [],
    _planChapter: 2,
    _plan: { title: "Chapter 1" },
    async _postJson() {
      loads += 1;
      return { ok: true, serverNow: Date.now(), events: [event] };
    },
    _renderBrowser() {},
  };
  wireForgeSeasonalEvents(host);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(appended, [], "the event the choice offers is not listed again under the archive");
  wireForgeSeasonalEvents(host);
  await new Promise((resolve) => setImmediate(resolve));
  host._chaptersData = { chapters: [] };
  wireForgeSeasonalEvents(host);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(loads, 1, "the same list loaded again (background work changed) reads nothing");
  host._chaptersData = { chapters: [{ chapter: 1, normal: 10, cleared: true }] };
  wireForgeSeasonalEvents(host);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(loads, 2, "a list with new progress reads the events once more");
  row.click();
  assert.deepEqual(
    { chapter: host._planChapter, view: host._hudView, plan: host._plan, title: host._forgeEvent.title },
    { chapter: "event-1", view: "chapter", plan: null, title: "The Lantern Crossing" },
  );
  // A chapter or Character Story the open event holds (story-event-open) opens the event instead of an error.
  const held = { ...host, _planChapter: 2, _plan: null, _hudView: "chapter", _forgeEvent: null };
  assert.equal(
    forgeSeasonalHeld(held, { error: "story-event-open", eventChapter: "event-1", title: "The Lantern Crossing" }),
    true,
  );
  assert.equal(held._planChapter, "event-1");
  assert.equal(forgeSeasonalHeld(held, { error: "story-event-open", eventChapter: "chapter-2" }), false);
});

test("starting the event marks it opened in the list read before, so Chapters shows its open card, not the choice again", () => {
  const host = {
    _run: { runId: "w", story: { seasonalEvents: true } },
    _planChapter: "event-1",
    _forgeSeasonalState: { events: [{ ...event }] },
  };
  // /chapters does not change when an event opens, so this cached list is all Chapters has until a reload.
  adoptForgeSeasonalResponse(
    host,
    "/story-event/plan",
    { runId: "w", chapter: "event-1" },
    { ok: true, plan: {}, progress: {}, event: { ...event, opened: now, after: 1 } },
  );
  const [chapters, next, unlocked, options] = lists["next chapter only"];
  const html = bp(chapters, next, unlocked, { ...options, event: forgeSeasonalNextStory(host) });
  assert.match(html, /<article class="ch-card bond open" data-story-event-open="event-1">/u);
  assert.doesNotMatch(html, /data-open-chapter="2"/u);
  assert.equal(host._forgeEvent.opened, now);
});

test("opening the event while Chapters reads the events again keeps the list, so its open card still shows", async () => {
  Object.assign(globalThis, {
    forgeSeasonalEnglish,
    wireForgeBannerAnimation() {},
    syncForgeAudio() {},
    stopForgeStoryRequests() {},
  });
  globalThis.document = { createElement: () => ({ dataset: {} }) };
  let answer;
  const host = {
    _root: {
      querySelector: (selector) => (selector === "[data-forge-seasonal-layout]" ? {} : null),
      querySelectorAll: () => [],
    },
    _run: { runId: "w", story: { seasonalEvents: true } },
    _forgeSeasonalRunId: "w",
    _forgeSeasonalEnabled: true,
    _forgeSeasonalState: { ok: true, events: [{ ...event }] },
    _hudView: "chapters",
    _chaptersData: { chapters: [{ chapter: 1, normal: 10, cleared: true }] },
    _eventSlots: [],
    _planChapter: 2,
    _plan: null,
    // The read is stopped by opening the event: _postJson answers null for a stopped story request.
    _postJson: () => new Promise((resolve) => (answer = resolve)),
    _renderBrowser() {},
  };
  wireForgeSeasonalEvents(host);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(typeof answer, "function", "Chapters reads the events again for new progress");
  openForgeSeasonalEvent(host, host._forgeSeasonalState.events[0]);
  answer(null);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(host._forgeSeasonalState.ok, true, "the stopped read keeps the list it was refreshing");
  adoptForgeSeasonalResponse(
    host,
    "/story-event/plan",
    { runId: "w", chapter: "event-1" },
    { ok: true, plan: {}, progress: {}, event: { ...event, opened: now, after: 1 } },
  );
  assert.equal(forgeSeasonalNextStory(host)?.opened, now);
});

// 1.26.3: a played event sits in the chapter timeline after the chapter it followed, as a finished Character Story
// does. Before, Chapters drew only an event that could start or was open, so a finished one was missing.
const two = [...cleared, { ...cleared[0], chapter: 2, title: "Ash" }];
const cards = (html) =>
  [...html.matchAll(/<article class="ch-card ([a-z ]+)"( data-[a-z-]+="[^"]*")?>/gu)].map((match) =>
    `${match[1]}${match[2] ?? ""}`.trim(),
  );
const eyebrow = (html) => /data-story-event-open="event-1">.*?<div class="ch-eyebrow">(.*?)<\/div>/u.exec(html)?.[1];
const finished = { ...event, canStart: false, opened: now, played: 10, after: 1 };

test("a played story event sits in the timeline after the chapter it followed, Done, Ended or Paused", () => {
  const options = { offers: [], beats: 3, heldBy: "", event: null };
  const html = bp(two, 3, true, { ...options, played: [finished] });
  assert.deepEqual(cards(html), [
    'cleared data-open-chapter="1"',
    'bond cleared data-story-event-open="event-1"',
    'cleared data-open-chapter="2"',
    'new data-open-chapter="3"',
  ]);
  assert.match(
    html,
    /data-story-event-open="event-1">.*Story event · Done.*<h3 class="ch-title">The Lantern Crossing<\/h3>.*Played\. Enter to read it again; reading changes nothing\..*Played 10 \/ 10.*Revisit played scenes/u,
  );
  assert.equal(
    eyebrow(bp(two, 3, true, { ...options, played: [{ ...finished, played: 4, live: false }] })),
    "Story event · Ended",
  );
  // Still live but not offered: Seasonal events is off, so it waits rather than ended.
  assert.equal(eyebrow(bp(two, 3, true, { ...options, played: [{ ...finished, played: 4 }] })), "Story event · Paused");
  assert.equal(
    cards(bp(two, 3, true, { ...options, played: [{ ...finished, after: 0 }] }))[0],
    'bond cleared data-story-event-open="event-1"',
  );
  assert.equal(
    cards(bp(cleared, 2, true, { ...options, played: [{ ...finished, after: 2 }] }))[1],
    'bond cleared data-story-event-open="event-1"',
  );
  for (const played of [undefined, [], [{ ...event }]])
    assert.equal(bp(two, 3, true, { ...options, played }), bp(two, 3, true, options), "nothing played, nothing added");
  // The open event the next-story choice draws keeps its open card and is not repeated in the timeline.
  const open = { ...finished, played: 3 },
    held = bp(two, 3, true, { ...options, event: open, played: [open] });
  assert.deepEqual(cards(held), [
    'cleared data-open-chapter="1"',
    'cleared data-open-chapter="2"',
    'bond open data-story-event-open="event-1"',
  ]);
});

test("Chapters passes the read events to the timeline, so the finished event shows there and not in the archive", () => {
  Object.assign(globalThis, {
    forgeSeasonalEnglish,
    wireForgeBannerAnimation() {},
    syncForgeAudio() {},
    stopForgeStoryRequests() {},
  });
  globalThis.document = { createElement: () => ({ dataset: {} }) };
  // The shipped _fillChapters, run with the shipped chapter list renderer and the seasonal source's wiring.
  const start = source.indexOf("_fillChapters(){"),
    end = source.indexOf("_bondName(){", start);
  assert.ok(start >= 0 && end > start && source.indexOf("_fillChapters(){", start + 1) === -1);
  const fillChapters = new Function(
    "bp",
    "forgeSeasonalNextStory",
    "wireForgeSeasonalEvents",
    `return { ${source.slice(start, end)} }._fillChapters;`,
  )(bp, forgeSeasonalNextStory, wireForgeSeasonalEvents);
  const appended = [];
  const list = {
    innerHTML: "",
    querySelector: (selector) =>
      /^\[data-story-event-open=/u.test(selector) && list.innerHTML.includes(selector.slice(1, -1)) ? {} : null,
    append: (section) => appended.push(section),
  };
  const chaptersData = { chapters: two, nextChapter: 3, nextUnlocked: true, bonds: [] };
  const host = {
    _root: {
      querySelector: (selector) =>
        selector === "[data-chapters-list]" ? list : selector === "[data-forge-seasonal-layout]" ? {} : null,
      querySelectorAll: () => [],
    },
    _chaptersState: "ready",
    _chaptersData: chaptersData,
    _forgeSeasonalChapters: JSON.stringify(chaptersData),
    _run: { runId: "w", story: { seasonalEvents: true } },
    _forgeSeasonalRunId: "w",
    _forgeSeasonalEnabled: true,
    _forgeSeasonalState: { ok: true, events: [finished] },
    _hudView: "chapters",
    _eventSlots: [],
    _renderBrowser() {},
  };
  fillChapters.call(host);
  assert.deepEqual(
    { cards: cards(list.innerHTML), archive: appended.length },
    {
      cards: [
        'cleared data-open-chapter="1"',
        'bond cleared data-story-event-open="event-1"',
        'cleared data-open-chapter="2"',
        'new data-open-chapter="3"',
      ],
      archive: 0,
    },
  );
});

test("an event's map draws no difficulty pills, since an event has only Normal; a chapter keeps them", () => {
  // A finished event unlocked Hard: its pills were drawn and only marked hidden, which the map's
  // .diff-pill { display: inline-flex } overrode, so Hard listed fights the server never lets start.
  const plan = {
    title: "The crossing",
    nodes: Array.from({ length: 10 }, (_, index) => ({
      type: index % 3 === 2 ? "combat" : "story",
      title: `N${index}`,
    })),
  };
  const map = (props) => Zd({ plan, difficulty: "normal", progress: { normal: 10, hard: 0, veryhard: 0 }, ...props });
  const eventMap = map({ chapterNumber: "event-1", forgeEvent: "The Lantern Crossing" });
  assert.doesNotMatch(eventMap, /data-diff|diff-pill|Higher difficulty/u);
  assert.match(
    eventMap,
    /<div class="cap-diff"><\/div>\s*<div class="cap-scroll">/u,
    "the row the map's grid counts stays",
  );
  assert.equal(eventMap.match(/class="node-row done"/gu)?.length, 10);
  assert.match(eventMap, /Chapter complete/u);
  assert.match(
    map({ chapterNumber: 2 }),
    /<button class="diff-pill" type="button" role="tab" aria-selected="false" data-diff="hard">/u,
  );
});

test("side stories after one chapter are drawn in the order they were opened, from the real /chapters and /story-events", async () => {
  // After Chapter 1 the player opened event-1 (it ended at 4/10), then Arden's Character Story, then event-2. Story
  // memory tells them in that order (forge-kit orderForgeStorySources). The server lists events newest first, and
  // Chapters drew the slot as Character Stories, then events in that list's order: Arden, event-2, event-1.
  const f = await createChapterRuntime();
  try {
    const session = f.session();
    session.progress = { 1: { normal: 10 }, 2: { normal: 10 }, "event-1": { normal: 4 }, "event-2": { normal: 10 } };
    delete session.reading;
    session.bondChapters = { [chapterUnitId]: { beats: 3, after: 1, opened: 2000 } };
    for (const [seq, opened, endsAt] of [
      [1, 1000, now - 864e5],
      [2, 3000, now + 864e5],
    ])
      f.seed(`${chapterRunId}:story-event:${seq}`, "story-event", {
        seq,
        chapter: `event-${seq}`,
        title: `Event ${seq}`,
        state: "ready",
        startedAt: opened,
        endsAt,
        after: 1,
        opened,
      });
    const listed = await f.post("/chapters"),
      read = await f.post("/story-events");
    assert.equal(listed.body.ok, true, JSON.stringify(listed));
    assert.deepEqual(
      read.body.events.map((entry) => entry.chapter),
      ["event-2", "event-1"],
      "the server lists the newest event first",
    );
    const { chapters, nextChapter, nextUnlocked, bonds, bondBeats } = listed.body;
    const html = bp(chapters, nextChapter, nextUnlocked, {
      offers: bonds,
      beats: bondBeats,
      heldBy: "",
      event: null,
      played: read.body.events,
    });
    assert.deepEqual(cards(html).slice(0, 5), [
      'cleared data-open-chapter="1"',
      'bond cleared data-story-event-open="event-1"',
      `bond cleared data-open-bond="${chapterUnitId}#1"`,
      'bond cleared data-story-event-open="event-2"',
      'cleared data-open-chapter="2"',
    ]);
  } finally {
    await f.close();
  }
  // A Character Story part opened before 1.8.12 has no opening time and leads its slot, as in story memory; the
  // slot past the last chapter (after a reset) is ordered by the chapter each followed, then by opening.
  const arden = { id: "w:unit:arden", part: 1, name: "Arden", state: "done", beats: 3, after: 1 };
  const slot = (offers, played, chapters = two) =>
    cards(bp(chapters, 3, true, { offers, beats: 3, heldBy: "", event: null, played }))
      .filter((card) => card.startsWith("bond "))
      .map((card) => card.replace(/^bond cleared /u, ""));
  assert.deepEqual(slot([arden], [{ ...finished, opened: 1 }]), [
    'data-open-bond="w:unit:arden#1"',
    'data-story-event-open="event-1"',
  ]);
  // Only Chapter 1 is listed, so both stories after Chapter 2 or 3 fall in that last slot.
  assert.deepEqual(
    slot(
      [{ ...arden, after: 2, opened: 5 }],
      [
        { ...finished, after: 3, opened: 1 },
        { ...finished, chapter: "event-2", seq: 2, after: 2, opened: 3 },
      ],
      cleared,
    ),
    ['data-story-event-open="event-2"', 'data-open-bond="w:unit:arden#1"', 'data-story-event-open="event-1"'],
  );
});
