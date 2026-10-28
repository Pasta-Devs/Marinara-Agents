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
  wireForgeSeasonalEvents,
} from "../packages/gacha-forge/src/seasonal-events-client.mjs";

const directory = await mkdtemp(join(tmpdir(), "gacha-event-choice-"));
const copy = join(directory, "client.mjs");
globalThis.HTMLElement = class {};
globalThis.window = globalThis;
await writeFile(
  copy,
  (await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8")) +
    "\nexport { bp, Js, Zd, Ox, forgeSeasonalNextStory, forgeSeasonalRequest };\n",
);
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
