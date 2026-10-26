import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SYSTEM_PROMPT,
  defaultStorySettings,
  type StoryChapter,
  type StorySettings,
} from "../packages/story-writer/src/engine/packages/client/src/lib/story-writer/model.ts";
import {
  buildChapterMessages,
  buildSummaryMessages,
  buildTimelineMessages,
  chapterTokenBudget,
  endsMidSentence,
  findBannedPhrases,
  formatCharacterCard,
  joinContinuation,
  parseTimelineResponse,
  stripLeadingThinking,
  visibleStreamingText,
  type PromptCharacter,
} from "../packages/story-writer/src/engine/packages/client/src/lib/story-writer/prompt.ts";

function settings(patch: Partial<StorySettings> = {}): StorySettings {
  return { ...defaultStorySettings(), ...patch };
}

function chapter(index: number, patch: Partial<StoryChapter> = {}): StoryChapter {
  return {
    id: `chapter-${index}-0000`,
    storyId: "story-1",
    text: `Chapter ${index} text. The hero walks on.`,
    summary: "",
    status: "complete",
    request: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...patch,
  };
}

function character(name: string, patch: Partial<PromptCharacter> = {}): PromptCharacter {
  return {
    name,
    description: "",
    personality: "",
    backstory: "",
    appearance: "",
    scenario: "",
    exampleDialogue: "",
    ...patch,
  };
}

function build(input: Partial<Parameters<typeof buildChapterMessages>[0]> = {}) {
  return buildChapterMessages({
    settings: settings(),
    chapters: [],
    mode: "next",
    characters: [],
    personas: [],
    lore: [],
    ...input,
  });
}

const TAGS = [
  "story_details",
  "story_overview",
  "world_info",
  "characters",
  "personas",
  "story_notes",
  "timeline",
  "earlier_chapters",
  "length",
  "banned_phrases",
  "language",
  "formatting",
];

test("empty settings leave out every optional system section", () => {
  const [system, ...rest] = build({ settings: settings({ bannedPhrases: "" }) });
  assert.equal(system?.role, "system");
  assert.ok(system?.content.startsWith(DEFAULT_SYSTEM_PROMPT));
  for (const tag of TAGS) {
    const expected = tag === "length" || tag === "formatting";
    assert.equal(system?.content.includes(`<${tag}>`), expected, tag);
  }
  assert.match(system!.content, /Nothing has been written yet\. Write chapter 1 at about 2,000 words\./);
  assert.match(system!.content, /Open with the chapter's title as a level-one heading/);
  assert.deepEqual(rest, [{ role: "user", content: "Continue." }]);
});

test("every filled setting gets its section, in the documented order", () => {
  const [system] = build({
    settings: settings({
      title: "The Long Road",
      fandom: "Discworld",
      genre: "Fantasy",
      rating: "Teen",
      relationships: "Vimes/Sybil",
      warnings: "Violence",
      tags: "hurt/comfort, angst",
      author: "Terry Pratchett",
      style: "third person limited, present tense",
      overview: "A watchman walks home.",
      notes: "Ankh-Morpork has no sewers.",
      timeline: [
        { id: "event-1-aaaa", text: "Leave the Watch House", done: true },
        { id: "event-2-aaaa", text: "Reach home", done: false },
      ],
      targetWords: 10_000,
      language: "English",
      authorNote: "Make it rain.",
      keepFullChapters: 0,
    }),
    chapters: [chapter(1, { summary: "He leaves." })],
    characters: [character("Vimes", { description: "A tired copper." })],
    personas: [character("Sybil", { personality: "Kind." })],
    lore: [{ name: "City", content: "The river is solid.", order: 1, position: 0 }],
  });
  const content = system!.content;
  let previous = -1;
  for (const tag of TAGS) {
    const index = content.indexOf(`<${tag}>`);
    assert.ok(index > previous, `${tag} is present and after the previous section`);
    previous = index;
  }
  assert.match(
    content,
    /<story_details>\nTitle: The Long Road\nFandom: Discworld\nGenre: Fantasy\nRating: Teen\nRelationships: Vimes\/Sybil\nContent warnings: Violence\nTags: hurt\/comfort, angst\nWrite in the style of: Terry Pratchett\nNarration style: third person limited, present tense\n<\/story_details>/,
  );
  assert.match(
    content,
    /<timeline>\nPlanned events in order;[^\n]*\n1\. \[x\] Leave the Watch House\n2\. \[ \] Reach home\n<\/timeline>/,
  );
  assert.match(content, /<characters>\n<Vimes>\nDescription: A tired copper\.\n<\/Vimes>\n<\/characters>/);
  assert.match(content, /<personas>\n<Sybil>\nPersonality: Kind\.\n<\/Sybil>\n<\/personas>/);
  assert.match(content, /<language>\nWrite the story in English\.\n<\/language>/);
  assert.match(content, /<formatting>\n[^<]*\n<\/formatting>$/, "the author's note is not a system section");
  assert.ok(!content.includes("Make it rain."));
});

test("the author's note is a user message at its depth, like Roleplay's Author's Notes", () => {
  const story = {
    chapters: [chapter(1), chapter(2)],
    settings: { authorNote: "Make {{char}} cry.", keepFullChapters: 5 },
    characters: [character("Vimes")],
  };
  const at = (depth: number) =>
    build({ ...story, settings: settings({ ...story.settings, authorNoteDepth: depth }) }).map(
      (message) => `${message.role}:${message.content.startsWith("Make") ? message.content : message.role}`,
    );
  // Depth 0: right before the continue message (the Engine merges the two user messages).
  assert.deepEqual(at(0), [
    "system:system",
    "user:user",
    "assistant:assistant",
    "user:user",
    "assistant:assistant",
    "user:Make Vimes cry.",
    "user:user",
  ]);
  // Depth 1: before the latest chapter.
  assert.equal(at(1).indexOf("user:Make Vimes cry."), 4);
  // Never above the system prompt.
  assert.equal(at(99).indexOf("user:Make Vimes cry."), 1);
  // An empty story: system, note, continue.
  const empty = build({ settings: settings({ authorNote: "Begin at dawn." }) });
  assert.deepEqual(
    empty.map((message) => message.content.slice(0, 14)),
    [empty[0]!.content.slice(0, 14), "Begin at dawn.", "Continue."],
  );
  // No note, no extra message.
  assert.equal(build({ ...story, settings: settings({ ...story.settings, authorNote: "  " }) }).length, 6);
});

test("history replays each chapter as a user request and an assistant reply", () => {
  const messages = build({
    settings: settings({ continueMessage: "Go on, please.", keepFullChapters: 5 }),
    chapters: [chapter(1, { request: "Start with a storm." }), chapter(2)],
  });
  assert.deepEqual(
    messages.map((message) => message.role),
    ["system", "user", "assistant", "user", "assistant", "user"],
  );
  assert.equal(messages[1]?.content, "Start with a storm.");
  assert.equal(messages[2]?.content, "Chapter 1 text. The hero walks on.");
  // A chapter with no stored request replays the continue message.
  assert.equal(messages[3]?.content, "Go on, please.");
  assert.equal(messages.at(-1)?.content, "Go on, please.");
  assert.match(messages[0]!.content, /Write chapter 3 at about/);
});

test("older summarized chapters move to <earlier_chapters>; older unsummarized ones stay in full", () => {
  const chapters = [
    chapter(1, { text: "# Dawn\n\nFirst chapter.", summary: "The hero wakes." }),
    chapter(2, { summary: "The hero leaves." }),
    chapter(3),
    chapter(4),
    chapter(5),
  ];
  const messages = build({ settings: settings({ keepFullChapters: 2 }), chapters });
  const system = messages[0]!.content;
  assert.match(
    system,
    /<earlier_chapters>\nChapter 1 — Dawn \(summary\): The hero wakes\.\n\nChapter 2 — untitled \(summary\): The hero leaves\.\n<\/earlier_chapters>/,
  );
  const assistant = messages.filter((message) => message.role === "assistant").map((message) => message.content);
  assert.deepEqual(assistant, [chapters[2]!.text, chapters[3]!.text, chapters[4]!.text]);
  assert.ok(!messages.slice(1).some((message) => message.content.includes("First chapter.")));
  // A chapter inside the last N is sent in full even when it has a summary.
  const recent = build({ settings: settings({ keepFullChapters: 5 }), chapters });
  assert.ok(!recent[0]!.content.includes("<earlier_chapters>"));
  assert.equal(recent.filter((message) => message.role === "assistant").length, 5);
});

test("continue mode sends the partial chapter, then the continue message", () => {
  const partial = chapter(3, { text: "She opened the door and", status: "draft", request: "Write the reunion." });
  const messages = build({ mode: "continue", chapters: [chapter(1), chapter(2), partial] });
  assert.deepEqual(messages.slice(-3), [
    { role: "user", content: "Write the reunion." },
    { role: "assistant", content: "She opened the door and" },
    { role: "user", content: "Continue." },
  ]);
  const system = messages[0]!.content;
  assert.match(system, /Continue chapter 3 exactly where the last assistant message stops\./);
  assert.match(system, /Do not repeat what is already written and do not add a heading\./);
  assert.doesNotMatch(system, /Open with the chapter's title/);
  assert.match(system, /Write chapter 3 at about 2,000 words\. About 5 words of it are already written\./);

  // An emptied last chapter (a rewrite) is written from scratch as chapter 3.
  const rewrite = build({ mode: "continue", chapters: [chapter(1), chapter(2), { ...partial, text: "" }] });
  assert.equal(rewrite.at(-1)?.content, "Continue.");
  assert.equal(rewrite.filter((message) => message.role === "assistant").length, 2);
  assert.match(rewrite[0]!.content, /Open with the chapter's title/);
  assert.match(rewrite[0]!.content, /Write chapter 3 at about/);
});

test("the length section reports progress against the target and asks for an ending near it", () => {
  const chapters = [chapter(1, { text: "word ".repeat(4_000) })];
  const midway = build({ settings: settings({ targetWords: 10_000 }), chapters })[0]!.content;
  assert.match(
    midway,
    /The story so far: about 4,000 words in 1 chapter\. Target: about 10,000 words in total; about 40% is written, so pace the plot to end near the target\. Write chapter 2 at about 2,000 words\./,
  );
  assert.doesNotMatch(midway, /final chapter/);
  const ending = build({ settings: settings({ targetWords: 5_000 }), chapters })[0]!.content;
  assert.match(ending, /about 80% is written/);
  assert.match(
    ending,
    /This should be the final chapter or very close to it: bring the story to its ending\. Write chapter 2/,
  );
  assert.doesNotMatch(build({ chapters })[0]!.content, /Target:/);
});

test("banned phrases are listed once each", () => {
  const system = build({ settings: settings({ bannedPhrases: "ozone, jaws working,\nElara; ozone" }) })[0]!.content;
  assert.match(
    system,
    /<banned_phrases>\nNever use these words or phrases: ozone, jaws working, Elara\n<\/banned_phrases>/,
  );
});

test("{{char}} and {{user}} become the cast's names, or the protagonist", () => {
  const system = build({
    settings: settings({ overview: "{{char}} meets {{user}}." }),
    characters: [character("Alice", { description: "{{char}} loves {{ user }}." }), character("Carol")],
    personas: [character("Bob", { backstory: "{{user}} grew up near {{char}}." })],
    lore: [{ name: "House", content: "{{user}} lives in {{CHAR}}'s house.", order: 0, position: 0 }],
  })[0]!.content;
  assert.match(system, /Description: Alice loves Bob\./);
  assert.match(system, /<Carol \/>/);
  assert.match(system, /Backstory: Bob grew up near Alice\./);
  assert.match(system, /Bob lives in Alice's house\./);
  assert.match(system, /<story_overview>\nAlice meets Bob\.\n<\/story_overview>/);
  const alone = build({ lore: [{ name: "x", content: "{{user}} and {{char}}", order: 0, position: 0 }] })[0]!.content;
  assert.match(alone, /the protagonist and the protagonist/);
  assert.equal(
    formatCharacterCard(character("Dee", { exampleDialogue: "Dee: Hi." })),
    "<Dee>\nExample dialogue:\nDee: Hi.\n</Dee>",
  );
});

test("lore entries are sorted by order", () => {
  const system = build({
    lore: [
      { name: "b", content: "Second.", order: 5, position: 0 },
      { name: "a", content: "First.", order: 1, position: 0 },
      { name: "c", content: "Third.", order: 5, position: 1 },
    ],
  })[0]!.content;
  assert.match(system, /<world_info>\nFirst\.\n\nSecond\.\n\nThird\.\n<\/world_info>/);
});

test("more chapters than the route accepts fold into one turn instead of being dropped", () => {
  const chapters = Array.from({ length: 150 }, (_, index) => chapter(index + 1));
  const messages = build({ settings: settings({ keepFullChapters: 50 }), chapters });
  assert.equal(messages.length, 200);
  assert.ok(messages[2]!.content.startsWith("Chapter 1 text.") && messages[2]!.content.includes("Chapter 52 text."));
  assert.equal(messages.at(-2)?.content, "Chapter 150 text. The hero walks on.");
});

test("summary and timeline prompts carry the chapter and the JSON contract", () => {
  const summary = buildSummaryMessages({
    settings: settings({ language: "Polish" }),
    chapter: chapter(2, { text: '# The "Storm"\n\nRain fell.' }),
    chapterNumber: 2,
  });
  assert.equal(summary[0]?.role, "system");
  assert.match(summary[0]!.content, /150–300 words/);
  assert.match(summary[0]!.content, /Write the summary in Polish\./);
  assert.match(summary[0]!.content, /not instructions/);
  assert.equal(
    summary[1]?.content,
    '<chapter number="2" title="The \'Storm\'">\n# The "Storm"\n\nRain fell.\n</chapter>',
  );

  const timeline = buildTimelineMessages({
    settings: settings({
      overview: "A heist.",
      targetWords: 50_000,
      timeline: [{ id: "event-1-aaaa", text: "Meet the crew", done: false }],
    }),
    chapters: [chapter(1, { summary: "They meet." }), chapter(2, { text: "The vault opens." })],
  });
  assert.match(
    timeline[0]!.content,
    /Return ONLY JSON in this shape, with no other text: \{"events":\[\{"text":"…","done":true\}\]\}/,
  );
  assert.match(timeline[0]!.content, /end at about 50,000 words/);
  assert.match(timeline[1]!.content, /<current_timeline>\n1\. \[ \] Meet the crew\n<\/current_timeline>/);
  assert.match(timeline[1]!.content, /<chapter_summaries>\nChapter 1 — untitled: They meet\.\n<\/chapter_summaries>/);
  assert.match(
    timeline[1]!.content,
    /<chapter_excerpts>\n<chapter number="2">\nThe vault opens\.\n<\/chapter>\n<\/chapter_excerpts>/,
  );
});

test("the timeline planner sees every written chapter, by summary or by excerpt", () => {
  const timeline = buildTimelineMessages({
    settings: settings(),
    chapters: [
      chapter(1, { text: "They steal the map." }),
      chapter(2, { text: "The guard is bribed." }),
      chapter(3, { text: "The vault opens." }),
    ],
  });
  for (const text of ["They steal the map.", "The guard is bribed.", "The vault opens."]) {
    assert.ok(timeline[1]!.content.includes(text), text);
  }
  const long = buildTimelineMessages({
    settings: settings(),
    chapters: Array.from({ length: 80 }, (_, index) =>
      chapter(index + 1, { text: `${index + 1} ${"x".repeat(5_000)}` }),
    ),
  });
  assert.ok(long[1]!.content.length < 70_000, "the excerpts share one budget");
  assert.match(long[1]!.content, /Chapters 1, 2, [\d, ]+ have no summary and are not included here\./);
  assert.ok(long[1]!.content.includes('<chapter number="80">'), "the newest chapters come first");
});

test("parseTimelineResponse reads JSON, fenced JSON and numbered lists, and keeps unchanged ids", () => {
  const previous = [
    { id: "event-keep-0001", text: "Meet the crew", done: false },
    { id: "event-gone-0002", text: "Old plan", done: false },
  ];
  const json = parseTimelineResponse(
    '{"events":[{"text":"Meet the crew","done":true},{"text":"Crack the vault","done":false}]}',
    previous,
  );
  assert.deepEqual(
    json.map(({ text, done }) => ({ text, done })),
    [
      { text: "Meet the crew", done: true },
      { text: "Crack the vault", done: false },
    ],
  );
  assert.equal(json[0]?.id, "event-keep-0001");
  assert.notEqual(json[1]?.id, "event-gone-0002");
  assert.match(json[1]!.id, /^[a-z0-9][a-z0-9-]{7,63}$/);

  const fenced = parseTimelineResponse(
    '<think>plan it</think>Here you go:\n```json\n{"events":[{"text":"  meet THE crew "},"Escape"]}\n```',
    previous,
  );
  assert.deepEqual(
    fenced.map(({ text, done }) => ({ text, done })),
    [
      { text: "meet THE crew", done: false },
      { text: "Escape", done: false },
    ],
  );
  assert.equal(fenced[0]?.id, "event-keep-0001");

  const list = parseTimelineResponse(
    "Timeline:\n1. [x] Meet the crew\n2) [ ] Crack the vault\n- Escape\nNot an event",
    [],
  );
  assert.deepEqual(
    list.map(({ text, done }) => ({ text, done })),
    [
      { text: "Meet the crew", done: true },
      { text: "Crack the vault", done: false },
      { text: "Escape", done: false },
    ],
  );
  assert.equal(new Set(list.map((event) => event.id)).size, 3);
  assert.deepEqual(parseTimelineResponse("I cannot help with that.", previous), []);
});

test("banned phrases in scripts written without spaces are found inside sentences", () => {
  assert.deepEqual(findBannedPhrases("他嘴角上扬地笑了", "嘴角上扬"), ["嘴角上扬"]);
  assert.deepEqual(findBannedPhrases("彼はにやりと笑った", "にやり"), ["にやり"]);
  assert.deepEqual(findBannedPhrases("Elaravel smiled.", "Elara"), []);
  assert.deepEqual(findBannedPhrases("Elara说她会来。", "Elara"), ["Elara"], "a Latin word beside Han text is whole");
});

test("the system message stays under the route's limit when summaries fill it", () => {
  const [system] = build({
    settings: settings({ keepFullChapters: 0, overview: "O".repeat(50_000), notes: "N".repeat(50_000) }),
    chapters: Array.from({ length: 300 }, (_, index) => chapter(index + 1, { summary: "S".repeat(2_000) })),
  });
  assert.ok(system!.content.length <= 500_000, `${system!.content.length} characters`);
  assert.match(system!.content, /<formatting>/, "the closing sections are kept");
});

test("findBannedPhrases matches single words whole and phrases anywhere", () => {
  const banned = "ozone, jaws working, Elara";
  assert.deepEqual(findBannedPhrases("The smell of OZONE filled the air.", banned), ["ozone"]);
  assert.deepEqual(findBannedPhrases("Ozonelike haze. Elaras everywhere.", banned), []);
  assert.deepEqual(findBannedPhrases("**Elara**'s jaws\nworking hard.", banned), ["jaws working", "Elara"]);
  assert.deepEqual(findBannedPhrases("Nothing here.", ""), []);
});

test("joinContinuation adds a space only between two words", () => {
  assert.equal(joinContinuation("She ran", "into the night."), "She ran into the night.");
  assert.equal(joinContinuation("She ran ", "into the night."), "She ran into the night.");
  assert.equal(joinContinuation("She said,", '"Wait."'), 'She said,"Wait."');
  assert.equal(joinContinuation("The end.", "\n\nNext morning"), "The end.\n\nNext morning");
  assert.equal(joinContinuation("Count to", "3"), "Count to 3");
  assert.equal(joinContinuation("", "Start"), "Start");
});

test("leading reasoning is stripped at the end and hidden while it streams", () => {
  assert.equal(stripLeadingThinking("<think>plan</think>\n\nOnce upon a time."), "Once upon a time.");
  assert.equal(stripLeadingThinking("  <THINKING>a</THINKING><thought>b</thought>Story"), "Story");
  assert.equal(stripLeadingThinking("<think>never closed"), "<think>never closed");
  assert.equal(stripLeadingThinking("Story <think>inline</think>"), "Story <think>inline</think>");
  assert.equal(visibleStreamingText("<thi"), "");
  assert.equal(visibleStreamingText("\n<think>still planning"), "");
  assert.equal(visibleStreamingText("<think>done</think>Once"), "Once");
  assert.equal(visibleStreamingText("<b>Bold claim"), "<b>Bold claim");
});

test("cut-off detection and the chapter token budget", () => {
  assert.equal(endsMidSentence("She opened the door and"), true);
  assert.equal(endsMidSentence('"Run," she said.'), false);
  assert.equal(endsMidSentence('He left."\n'), false);
  assert.equal(endsMidSentence("***"), false);
  // Sentence ends of other scripts and quotation styles are endings, not cut-offs.
  for (const ending of [
    "„Wir müssen gehen.“",
    "»Ja.«",
    "वह चला गया।",
    "یہ ٹھیک ہے۔",
    "هل أنت بخير؟",
    "Τι κάνεις;",
    "ፍቅር ነው።",
    "「はい」",
    "สวัสดีครับ",
  ]) {
    assert.equal(endsMidSentence(ending), false, ending);
  }
  assert.equal(endsMidSentence("Она пошла в"), true);
  assert.equal(chapterTokenBudget(2_000, null), 3_600);
  assert.equal(chapterTokenBudget(2_000, 8_000), 8_000);
  assert.equal(chapterTokenBudget(20_000, 500_000), 200_000);
});

test("no message outgrows the 500,000 characters /generate/raw accepts", () => {
  const long = "word ".repeat(2_400);
  const messages = build({
    settings: settings({ keepFullChapters: 50 }),
    chapters: Array.from({ length: 160 }, (_, index) => chapter(index + 1, { text: `${index + 1} ${long}` })),
  });
  assert.ok(messages.length <= 200);
  for (const message of messages) assert.ok(message.content.length <= 500_000, `${message.role} fits`);
  // The newest chapters stay whole; only the oldest folded text is cut.
  assert.equal(messages.at(-2)?.content, `160 ${long}`.trimEnd());
  const summarized = build({
    settings: settings({ keepFullChapters: 0 }),
    chapters: Array.from({ length: 300 }, (_, index) => chapter(index + 1, { summary: "S".repeat(2_000) })),
  });
  assert.ok(summarized[0]!.content.length <= 500_000, "the summaries section fits too");
});

test("an unclosed reasoning block is not read as a timeline", () => {
  assert.deepEqual(parseTimelineResponse("<think>\n1. Plan the heist\n2. Escape", []), []);
});
