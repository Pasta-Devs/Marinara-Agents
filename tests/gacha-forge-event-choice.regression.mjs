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
  forgeSeasonalNodePay,
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
const finished = { ...event, canStart: false, opened: now, played: 10, after: 1, hard: 0, veryhard: 0, combats: 3 };

test("a played story event sits in the timeline after the chapter it followed, Done, Ended or Paused", () => {
  const options = { offers: [], beats: 3, heldBy: "", event: null };
  const html = bp(two, 3, true, { ...options, played: [finished] });
  assert.deepEqual(cards(html), [
    'cleared data-open-chapter="1"',
    'bond cleared data-story-event-open="event-1"',
    'cleared data-open-chapter="2"',
    'new data-open-chapter="3"',
  ]);
  // Done, it shows a cleared chapter's marks (1.27.0); with its Hard fights closed it is read again only.
  assert.match(
    html,
    /data-story-event-open="event-1">.*Story event · Done.*<h3 class="ch-title">The Lantern Crossing<\/h3>.*Played\. Enter to read it again; reading changes nothing\..*<span class="diffs"><span class="on">N<\/span><span class="">H<\/span><span class="">V<\/span><\/span>.*Revisit played scenes/u,
  );
  assert.doesNotMatch(html, /Played 10 \/ 10/u);
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

test("an event's map draws the chapter's pills: Hard once the event is done, Very Hard once every fight is won on Hard", () => {
  // 1.26.3 removed them, since events were Normal-only; 1.27.0 gives a finished event's fights Hard and Very Hard.
  const plan = {
    title: "The crossing",
    nodes: Array.from({ length: 10 }, (_, index) => ({
      type: index % 3 === 2 ? "combat" : "story",
      title: `N${index}`,
    })),
  };
  const map = (difficulty, progress, props = {}) =>
    Zd({
      plan,
      difficulty,
      progress: { normal: 0, hard: 0, veryhard: 0, ...progress },
      chapterNumber: "event-1",
      forgeEvent: "The Lantern Crossing",
      cp: { normal: 2000, hard: 3000, veryhard: 4000 },
      ...props,
    });
  const pill = (html, key) =>
    new RegExp(
      `<button class="diff-pill" type="button" role="tab" aria-selected="[a-z]+" data-diff="${key}"([^>]*)>`,
      "u",
    ).exec(html)?.[1];
  const playing = map("normal", { normal: 4 });
  assert.equal(pill(playing, "normal"), "");
  assert.equal(pill(playing, "hard"), ' disabled title="Clear Normal to unlock"');
  assert.equal(pill(playing, "veryhard"), ' disabled title="Clear Hard to unlock"');
  assert.match(playing, /Recommended BP <b>2,000<\/b>/u);
  const done = map("normal", { normal: 10 });
  assert.equal(pill(done, "hard"), "", "a finished event opens Hard");
  assert.equal(pill(done, "veryhard"), ' disabled title="Clear Hard to unlock"');
  assert.match(done, /Chapter complete/u);
  // Hard lists only the fights, each as a chapter's: cleared, the next to start, then locked.
  const hard = map("hard", { normal: 10, hard: 1 });
  assert.equal(hard.match(/class="node-row /gu)?.length, 3);
  assert.deepEqual(
    [...hard.matchAll(/class="node-row ([a-z]+)"/gu)].map((match) => match[1]),
    ["done", "current", "locked"],
  );
  assert.match(hard, /&#10004; Cleared.*data-start.*Locked/su);
  assert.doesNotMatch(hard, /data-replay|data-play/u, "a cleared fight is never offered again");
  assert.match(hard, /Recommended BP <b>3,000<\/b>/u);
  assert.equal(pill(map("hard", { normal: 10, hard: 2 }), "veryhard"), ' disabled title="Clear Hard to unlock"');
  const veryHard = map("veryhard", { normal: 10, hard: 3, veryhard: 3 });
  assert.equal(pill(veryHard, "veryhard"), "");
  assert.match(veryHard, /aria-selected="true" data-diff="veryhard"/u);
  assert.match(veryHard, /Very Hard complete/u);
  // A chapter's map is unchanged.
  assert.match(
    Zd({ plan, difficulty: "normal", progress: { normal: 10, hard: 0, veryhard: 0 }, chapterNumber: 2 }),
    /<button class="diff-pill" type="button" role="tab" aria-selected="false" data-diff="hard">/u,
  );
});

test("an event's Normal nodes show their Vigor only, and its Hard fights a chapter's pay", () => {
  const nodePay = {
    combat: { vigor: 5, rank: 300, funds: 500, aether: 100, insight: { shard: 0 } },
    story: { vigor: 5, rank: 150, funds: 500, aether: 100, insight: { shard: 0 } },
  };
  const hardPay = { ...nodePay, combat: { ...nodePay.combat, funds: 750, aether: 150 } };
  const host = (difficulty, chapter = "event-1") => ({
    _planChapter: chapter,
    _forgeEvent: { chapter: "event-1", title: "The Lantern Crossing" },
    _difficulty: difficulty,
  });
  const plan = {
    title: "The crossing",
    nodes: [
      { type: "story", title: "A" },
      { type: "combat", title: "B" },
    ],
  };
  const meta = (pay, difficulty = "normal") =>
    [
      ...Zd({ plan, difficulty, progress: { normal: 10, hard: 0 }, forgeEvent: "The Lantern Crossing", pay }).matchAll(
        /<span class="meta">(.*?)<\/span><\/div>/gu,
      ),
    ].map((match) => match[1]);
  const eventNormal = meta(forgeSeasonalNodePay(host("normal"), nodePay));
  assert.equal(eventNormal.length, 2);
  for (const node of eventNormal) {
    assert.match(node, /class="cost">.*5<\/span>/u);
    assert.doesNotMatch(node, /class="prize"/u, "an event's Normal pays its own rewards, not a chapter's");
  }
  assert.equal(forgeSeasonalNodePay(host("hard"), hardPay), hardPay);
  assert.match(meta(forgeSeasonalNodePay(host("hard"), hardPay), "hard")[0], /750.*150.*\+300/u);
  assert.equal(forgeSeasonalNodePay(host("normal", 2), nodePay), nodePay, "a chapter keeps its pay");
  assert.equal(forgeSeasonalNodePay(host("normal"), undefined), undefined);
  // The shipped map reads its pay through it.
  assert.ok(source.includes("pay:forgeSeasonalNodePay(this,this._nodePay&&this._nodePay[this._difficulty])"));
});

test("a finished event's card offers Enter event while its Hard fights are open, with the cleared marks", () => {
  const options = { offers: [], beats: 3, heldBy: "", event: null };
  const card = (changes) =>
    /data-story-event-open="event-1">(.*?)<\/article>/u.exec(
      bp(two, 3, true, { ...options, played: [{ ...finished, ...changes }] }),
    )?.[1];
  const open = card({ hardOpen: true, hard: 3, veryhard: 1 });
  assert.match(open, /Story event · Done/u);
  assert.match(
    open,
    /Played\. Enter to read it again, or fight its battles on Hard and Very Hard until the event ends\./u,
  );
  assert.match(
    open,
    /<span class="diffs"><span class="on">N<\/span><span class="on">H<\/span><span class="">V<\/span><\/span>/u,
  );
  assert.match(open, />Enter event/u);
  // The marks count the plan's own fights.
  assert.match(card({ hard: 3, combats: 4 }), /<span class="on">N<\/span><span class="">H<\/span>/u);
  assert.match(card({ hard: 4, veryhard: 4, combats: 4 }), /<span class="on">H<\/span><span class="on">V<\/span>/u);
  assert.match(card({ hardOpen: false }), />Revisit played scenes/u);
  // Unfinished, it keeps its played bar.
  assert.match(card({ played: 4, live: false }), /Played 4 \/ 10/u);
});

test("finishing the event's last node opens Hard on its cards without reading the list again", () => {
  const host = {
    _run: { runId: "w", story: { seasonalEvents: true } },
    _planChapter: "event-1",
    _forgeEvent: { ...event, opened: now, played: 9 },
    _forgeSeasonalState: {
      ok: true,
      events: [{ ...event, canStart: false, opened: now, played: 9, after: 1, combats: 0 }],
    },
  };
  // The list was read before the event opened, so it had no plan to count fights from; opening it does.
  const fights = Array.from({ length: 10 }, (_, index) => ({
    type: [1, 4, 6, 8].includes(index) ? "combat" : "story",
  }));
  adoptForgeSeasonalResponse(
    host,
    "/story-event/plan",
    { runId: "w", chapter: "event-1" },
    {
      ok: true,
      plan: { nodes: fights },
      progress: { "event-1": { normal: 9 } },
      event: { ...event, opened: now, after: 1 },
    },
  );
  assert.equal(host._forgeSeasonalState.events[0].combats, 4);
  assert.equal(host._forgeSeasonalState.events[0].hardOpen, false);
  adoptForgeSeasonalResponse(
    host,
    "/story-event/complete",
    { runId: "w", chapter: "event-1" },
    { ok: true, progress: { "event-1": { normal: 10 } } },
  );
  const [row] = host._forgeSeasonalState.events;
  assert.deepEqual(
    { played: row.played, hard: row.hard, hardOpen: row.hardOpen },
    { played: 10, hard: 0, hardOpen: true },
  );
  assert.equal(host._forgeEvent.played, 10);
  const html = bp(two, 3, true, {
    offers: [],
    beats: 3,
    heldBy: "",
    event: null,
    played: host._forgeSeasonalState.events,
  });
  assert.match(html, /data-story-event-open="event-1">.*Story event · Done.*Enter event/u);
  // The last Very Hard win closes it again; so does Seasonal events off.
  adoptForgeSeasonalResponse(
    host,
    "/story-event/complete",
    { runId: "w", chapter: "event-1" },
    { ok: true, progress: { "event-1": { normal: 10, hard: 4, veryhard: 4 } } },
  );
  assert.equal(host._forgeSeasonalState.events[0].hardOpen, false);
  assert.equal(host._forgeEvent.veryhard, 4);
  host._run.story.seasonalEvents = false;
  adoptForgeSeasonalResponse(
    host,
    "/story-event/plan",
    { runId: "w", chapter: "event-1" },
    {
      ok: true,
      plan: { nodes: fights },
      progress: { "event-1": { normal: 10, hard: 1 } },
      event: { ...event, opened: now, after: 1 },
    },
  );
  assert.equal(host._forgeSeasonalState.events[0].hardOpen, false, "a cached plan read while events are off");
});

test("an event that ends while Chapters shows it closes Hard even when the refresh at its end is dropped", async () => {
  Object.assign(globalThis, {
    forgeSeasonalEnglish,
    wireForgeBannerAnimation() {},
    syncForgeAudio() {},
    stopForgeStoryRequests() {},
  });
  globalThis.document = { createElement: () => ({ dataset: {} }) };
  // A wide margin so a slow runner still loads the row before the event ends.
  const endsAt = Date.now() + 400;
  let answer = { ok: true, serverNow: Date.now(), events: [{ ...finished, endsAt, hard: 1 }] },
    reads = 0,
    filled = 0;
  const host = {
    _root: {
      querySelector: (selector) => (selector === "[data-forge-seasonal-layout]" ? {} : null),
      querySelectorAll: () => [],
    },
    _run: { runId: "w", story: { seasonalEvents: true } },
    _forgeSeasonalRunId: "w",
    _forgeSeasonalEnabled: true,
    _hudView: "chapters",
    _eventSlots: [],
    // _postJson answers null for a failed fetch and for a story request stopped by entering an event or cancelling.
    _postJson: async () => (reads++, answer),
    _renderBrowser() {},
    _fillChapters: () => filled++,
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
  const card = () =>
    /data-story-event-open="event-1">(.*?)<\/article>/u.exec(
      bp(two, 3, true, { offers: [], beats: 3, heldBy: "", event: null, played: host._forgeSeasonalState.events }),
    )?.[1];
  wireForgeSeasonalEvents(host);
  await settle();
  assert.equal(host._forgeSeasonalState.events[0].hardOpen, true);
  assert.match(card(), />Enter event/u);
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, endsAt - Date.now()) + 50));
  answer = null;
  filled = 0;
  wireForgeSeasonalEvents(host);
  await settle();
  assert.equal(reads, 2, "the event's end reads the list again");
  assert.equal(host._forgeSeasonalState.ok, true, "the dropped read keeps the list");
  assert.equal(host._forgeSeasonalState.events[0].hardOpen, false, "an ended event no longer offers Hard");
  assert.equal(filled, 1, "Chapters is drawn again from the kept list");
  assert.match(card(), />Revisit played scenes/u);
  assert.doesNotMatch(card(), /Hard and Very Hard until the event ends/u);
  wireForgeSeasonalEvents(host);
  await settle();
  assert.equal(reads, 2, "the window's end reads the list once");
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
