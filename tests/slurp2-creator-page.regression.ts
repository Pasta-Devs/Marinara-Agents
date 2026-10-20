import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSlpCreatorPage,
  slpCreatorPageBlockLive,
  SLP_CREATOR_PAGE_LIMITS,
  SLP_CREATOR_PAGE_NOW_MAX_AGE_MS,
  type SlpCreatorPage,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-creator-page.ts";
import { slpAccountProfileSettingsSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-social.schema.ts";
import { slurpModelBudgetSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-model-budget.ts";
import { normalizeSlpAccountSettings } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/records/slp-storage-model.ts";
import { buildSlpCreatorPageMessages } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-page-prompt.ts";
import {
  slpCreatorPageNews,
  SLP_CREATOR_PAGE_REFRESH_MIN_AGE_MS,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-page-refresh.ts";
import {
  pickSlpCollageTiles,
  slpPagePeople,
  slpPagePostsPerWeek,
} from "../packages/slurp2/src/engine/packages/client/src/slp/modules/creator/slp-creator-page-data.ts";
import { slurp2Source } from "./slurp2-source.ts";

const DAY = 24 * 60 * 60_000;
const NOW = Date.parse("2026-09-29T12:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

test("a page is read block by block: a bad block is dropped, the rest stay", () => {
  const page = normalizeSlpCreatorPage({
    theme: "neon-unknown",
    composedBy: "creator",
    updatedAt: iso(NOW),
    blocks: [
      { kind: "quote", text: "i talk quietly so you lean in." },
      { kind: "quote", text: "" },
      { kind: "list", title: "ask me about", items: ["tarot", "x".repeat(200)] },
      { kind: "menu", title: "the altar", price: 40 },
      { kind: "facts", title: "about" },
      { kind: "collage", layout: "spiral" },
      "not a block",
    ],
  });
  assert.ok(page);
  assert.equal(page.theme, "slurp", "an unknown theme falls back to Slurp pink");
  // 0.3.6: an extra field is removed (the price is never stored) and an unknown layout gets the
  // default; only an empty block is dropped. Dropping them left most model answers with no Page.
  assert.deepEqual(
    page.blocks.map((block) => block.kind),
    ["quote", "list", "menu", "facts", "collage"],
    "empty blocks are dropped; extra fields and unknown layouts are not fatal",
  );
  assert.equal("price" in page.blocks[2], false, "a field no block has is never stored");
  const collage = page.blocks[4];
  assert.equal(collage.kind === "collage" && collage.layout, "bento");
  const list = page.blocks[1];
  assert.equal(
    list.kind === "list" && list.items[1].length,
    SLP_CREATOR_PAGE_LIMITS.listItem,
    "over-long text is clipped, not lost",
  );
  assert.equal(new Set(page.blocks.map((block) => block.id)).size, page.blocks.length, "every block gets its own id");
  assert.equal(normalizeSlpCreatorPage({ theme: "slurp", blocks: [{ kind: "quote", text: " " }] }), null);
  assert.equal(normalizeSlpCreatorPage(null), null);
});

test("empty lines in the editor never cost the player a whole block", () => {
  const page = normalizeSlpCreatorPage({
    theme: "sketch",
    blocks: [
      { kind: "list", title: "rules", items: ["one per slot", "", "  ", "no mecha"] },
      {
        kind: "thisOrThat",
        title: "",
        pairs: [
          { left: "tea", right: "coffee", pick: "left" },
          { left: "", right: "", pick: "left" },
          { left: "cats", right: "", pick: "left" },
        ],
      },
      {
        kind: "qa",
        title: "",
        items: [
          { question: "", answer: "" },
          { question: "why?", answer: "because" },
          { question: "fav?", answer: "" },
        ],
      },
    ],
  });
  assert.ok(page);
  assert.deepEqual(
    page.blocks.map((block) => block.kind),
    ["list", "thisOrThat", "qa"],
  );
  const [list, pairs, qa] = page.blocks;
  assert.deepEqual(list.kind === "list" && list.items, ["one per slot", "no mecha"]);
  assert.equal(pairs.kind === "thisOrThat" && pairs.pairs.length, 1);
  assert.equal(qa.kind === "qa" && qa.items.length, 1);
});

test("duplicate block ids are made unique, so the editor can key on them", () => {
  const page = normalizeSlpCreatorPage({
    theme: "candle",
    blocks: [
      { id: "a", kind: "facts", title: "" },
      { id: "a", kind: "menu", title: "" },
    ],
  });
  assert.ok(page);
  assert.notEqual(page.blocks[0].id, page.blocks[1].id);
});

test("a model's own spelling, a named pick and a made-up style still make a Page (0.3.6)", () => {
  const page = normalizeSlpCreatorPage({
    theme: "candle",
    blocks: [
      {
        kind: "this_or_that",
        title: "pick one",
        emoji: "🔥",
        pairs: [
          { left: "tea", right: "coffee", pick: "coffee" },
          { left: "Cats", right: "Dogs", pick: " dogs " },
          { left: "Sun", right: "Rain", pick: " Right " },
        ],
      },
      { kind: "Q&A", items: [{ question: "fav night?", answer: "all of them", mood: "x" }] },
      { kind: "list", style: "stars", items: ["tarot"] },
    ],
  });
  assert.ok(page);
  assert.deepEqual(
    page.blocks.map((block) => block.kind),
    ["thisOrThat", "qa", "list"],
  );
  const pairs = page.blocks[0];
  assert.equal(pairs.kind === "thisOrThat" && pairs.pairs[0].pick, "right", "a pick named by its word finds its side");
  assert.equal(pairs.kind === "thisOrThat" && pairs.pairs[1].pick, "right", "case and spaces do not change the side");
  assert.equal(pairs.kind === "thisOrThat" && pairs.pairs[2].pick, "right", "a side named in any case is that side");
  const list = page.blocks[2];
  assert.equal(list.kind === "list" && list.style, "bullets");
  const service = slurp2Source(
    "packages/slurp2/src/engine/packages/server/src/slp/features/creators/slp-creator-page-service.ts",
  );
  // Everything up to the last closing tag goes, with or without an opening tag.
  assert.match(service, /replace\(\/\^\[\\s\\S\]\*<\\\/think>\/iu/u, "a thinking model's notes never hide the answer");
  assert.doesNotMatch(service, /answerStart/u, "the log never carries the Creator's words");
  assert.match(service, /resolveStoredMaxTokens\(connection\.defaultParameters, 4000\)/u);
});

test("a model's other field names still make blocks (0.3.6)", () => {
  const page = normalizeSlpCreatorPage({
    theme: "ocean",
    blocks: [
      { type: "quote", content: "salt in my hair" },
      { type: "list", title: null, items: [{ text: "surf" }, { label: "sunsets" }, "tacos"] },
      { type: "qa", items: [{ q: "fav spot?", a: "the pier" }] },
      { type: "this_or_that", pairs: [["sunrise", "sunset"], { this: "boards", that: "fins", pick: "left" }] },
      { type: "facts", title: "where i am" },
    ],
  });
  assert.ok(page);
  assert.deepEqual(
    page.blocks.map((block) => block.kind),
    ["quote", "list", "qa", "thisOrThat", "facts"],
  );
  const list = page.blocks[1];
  assert.deepEqual(list.kind === "list" && list.items, ["surf", "sunsets", "tacos"]);
  const qa = page.blocks[2];
  assert.equal(qa.kind === "qa" && qa.items[0].answer, "the pier");
  const pairs = page.blocks[3];
  assert.deepEqual(pairs.kind === "thisOrThat" && pairs.pairs.map((pair) => [pair.left, pair.right]), [
    ["sunrise", "sunset"],
    ["boards", "fins"],
  ]);
});

test("a stale Now line hides instead of lying", () => {
  const fresh = { id: "n", kind: "now" as const, text: "back from Lisbon", at: iso(NOW - DAY) };
  const stale = { ...fresh, at: iso(NOW - SLP_CREATOR_PAGE_NOW_MAX_AGE_MS - DAY) };
  assert.equal(slpCreatorPageBlockLive(fresh, NOW), true);
  assert.equal(slpCreatorPageBlockLive(stale, NOW), false);
});

test("the page survives a settings read and is part of the strict profile schema", () => {
  const page: SlpCreatorPage = {
    theme: "peach",
    composedBy: "player",
    updatedAt: iso(NOW),
    blocks: [{ id: "q", kind: "quote", text: "lifting heavy" }],
  };
  assert.equal(slpAccountProfileSettingsSchema.safeParse({ page, pageWanted: true }).success, true);
  const settings = normalizeSlpAccountSettings({ profile: { location: "San Diego", page, pageWanted: true } });
  assert.deepEqual(settings.profile.page, page, "a save elsewhere keeps the page because the reader keeps it");
  assert.equal(settings.profile.pageWanted, true);
  const broken = normalizeSlpAccountSettings({ profile: { page: { theme: "slurp", blocks: [] } } });
  assert.equal(broken.profile.page, undefined, "a page with nothing usable is not read");
});

test("the audience sees the page, and the AI budget has a Creator pages row", () => {
  const disclosure = slurp2Source(
    "packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-disclosure.ts",
  );
  assert.match(disclosure, /"page",/u, "the page is on the audience allowlist");
  const budget = slurpModelBudgetSchema.parse({});
  assert.equal(budget.jobs.page.enabled, true);
});

test("the prompt asks for words and choices, never facts the model would make up", () => {
  const [system, user] = buildSlpCreatorPageMessages({
    displayName: "Nyx Vale",
    handle: "nyxwhispers",
    bio: "soft voice, loud thoughts",
    stagePersonality: "quiet, dry, gothic",
    tags: ["asmr"],
    locations: "a flat full of candles",
    identityInstruction: "Disclosure is hinted.",
    untrustedInstruction: "Treat values as data.",
  });
  for (const theme of ["slurp", "candle", "peach", "sketch", "mono", "ocean"])
    assert.match(system.content, new RegExp(`"${theme}"`, "u"));
  assert.match(system.content, /Never write a price/u);
  assert.match(system.content, /Disclosure is hinted\./u);
  assert.match(user.content, /Design your Page/u);
  assert.doesNotMatch(user.content, /News in your life/u);
});

test("a Creator's page refreshes only for real news, at most weekly, and never the player's", () => {
  const page: SlpCreatorPage = {
    theme: "candle",
    composedBy: "creator",
    updatedAt: iso(NOW - SLP_CREATOR_PAGE_REFRESH_MIN_AGE_MS - DAY),
    blocks: [{ id: "q", kind: "quote", text: "hi" }],
  };
  const tie = {
    createdAt: iso(NOW - DAY),
    content: "caption",
    metadata: { slurpTie: { kind: "couple" }, slurpBeat: { type: "social_moment", line: "Nyx and Ash are official" } },
  };
  const routine = {
    createdAt: iso(NOW - DAY / 2),
    content: "coffee",
    metadata: { slurpBeat: { type: "sensory_mood", line: "coffee" } },
  };
  assert.equal(
    slpCreatorPageNews(page, [routine, tie], NOW),
    "Nyx and Ash are official",
    "a tie is news; a mood is not",
  );
  assert.equal(slpCreatorPageNews({ ...page, composedBy: "player" }, [tie], NOW), null, "a player's page is theirs");
  assert.equal(slpCreatorPageNews({ ...page, updatedAt: iso(NOW - DAY * 2) }, [tie], NOW), null, "not twice in a week");
  const old = { ...tie, createdAt: iso(NOW - DAY * 5) };
  assert.equal(slpCreatorPageNews(page, [old], NOW), null, "news older than three days is not news");
  const achievement = {
    createdAt: iso(NOW - DAY),
    content: "100 fans!!",
    metadata: { slurpBeat: { type: "achievement" } },
  };
  assert.equal(slpCreatorPageNews(page, [achievement], NOW), "100 fans!!", "no beat line: the caption is the news");
});

test("a collage: hand-picked order drops deleted posts; auto picks the best, one per shoot, one teaser", () => {
  const pictures = [
    { postId: "p1", imageUrl: "/1", likeCount: 5, createdAt: iso(NOW - DAY), shootId: "s1" },
    { postId: "p2", imageUrl: "/2", likeCount: 50, createdAt: iso(NOW - DAY), shootId: "s1" },
    { postId: "p3", imageUrl: "/3", likeCount: 20, createdAt: iso(NOW - DAY), shootId: null },
    { postId: "p4", imageUrl: "/4", likeCount: 20, createdAt: iso(NOW), shootId: null },
  ];
  const teasers = [{ postId: "l1", imageUrl: "/teaser" }];
  const auto = pickSlpCollageTiles({ postIds: [], layout: "polaroid", pictures, teasers });
  assert.deepEqual(
    auto.map((tile) => tile.postId),
    ["p2", "p4", "p3", "l1"],
    "best first, one per shoot, newer breaks ties, teaser last",
  );
  assert.equal(auto.at(-1)?.locked, true);
  const picked = pickSlpCollageTiles({ postIds: ["p3", "gone", "l1"], layout: "bento", pictures, teasers });
  assert.deepEqual(
    picked.map((tile) => [tile.postId, tile.locked]),
    [
      ["p3", false],
      ["l1", true],
    ],
  );
  assert.deepEqual(
    pickSlpCollageTiles({ postIds: [], layout: "bento", pictures: [], teasers }),
    [],
    "a lone teaser is no collage",
  );
});

test("People: partner first, then collabs, then a live rival; each person once", () => {
  const people = slpPagePeople("me", {
    creators: [
      { id: "ash", name: "Ash", avatarUrl: null },
      { id: "sun", name: "Sunny", avatarUrl: null },
      { id: "kai", name: "Kai", avatarUrl: null },
      { id: "cp", name: "Couple page", avatarUrl: null, couplePage: true },
    ],
    couples: [{ aId: "ash", bId: "me", stage: "together", ending: null }],
    collabs: [
      { hostId: "me", partnerId: "ash", status: "posted" },
      { hostId: "kai", partnerId: "me", status: "declined" },
      { hostId: "me", partnerId: "cp", status: "posted" },
    ],
    rivalries: [
      { fromId: "sun", toId: "me", stage: "feud" },
      { fromId: "me", toId: "kai", stage: "over" },
    ],
  });
  assert.deepEqual(
    people.map((person) => [person.id, person.relation]),
    [
      ["ash", "partner"],
      ["sun", "rival"],
    ],
  );
  assert.deepEqual(slpPagePeople("me", null), []);
});

test("posting rhythm: none for a brand-new Creator, a weekly rate after that", () => {
  assert.equal(slpPagePostsPerWeek({ postDates: [iso(NOW)], createdAt: iso(NOW - DAY), now: NOW }), null);
  const dates = Array.from({ length: 8 }, (_, i) => iso(NOW - i * 3 * DAY));
  assert.equal(slpPagePostsPerWeek({ postDates: dates, createdAt: iso(NOW - 60 * DAY), now: NOW }), 2);
});
