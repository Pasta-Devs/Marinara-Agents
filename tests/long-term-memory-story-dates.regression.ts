import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRegressionToCompletion, runWithSafeCleanup } from "./regression-helpers.ts";

const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";

async function main() {
  const { countStoryDays, formatStoryPosition, mergeStoryTime, resolveStoryTime } = await import(
    `${source}/persistence/story-time.ts`
  );
  const { textHashForLtmSourceMaterial } = await import(`${source}/extraction/source-hash.ts`);
  const hash = (sourceText: string) => textHashForLtmSourceMaterial({ sourceText });
  const { ltmNoteSchema } =
    await import("../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts");
  const timestamp = "2026-11-19T00:00:00.000Z";

  // Merge: the trust order manual > Engine > stated, and an equal origin refreshes.
  const at = (origin: string, date: string) => ({
    start: { date },
    origin,
    ...(origin === "stated" ? { evidence: date, sourceHash: hash(date) } : {}),
  });
  const mergeCases: [string | undefined, string | undefined, string | undefined][] = [
    [undefined, undefined, undefined],
    [undefined, "stated", "stated"],
    ["stated", undefined, "stated"],
    ["stated", "stated", "stated"],
    ["stated", "world_state", "world_state"],
    ["world_state", "stated", "world_state"],
    ["world_state", "game_clock", "game_clock"],
    ["message_time", "world_state", "world_state"],
    ["manual", "world_state", "manual"],
    ["manual", "stated", "manual"],
    ["world_state", "manual", "manual"],
    ["manual", "manual", "manual"],
  ];
  // A reading that holds only a time gives way to a dated one, unless the user typed it.
  const timeOnly = (origin: string) => ({ start: { time: "evening" }, origin });
  assert.equal(mergeStoryTime(timeOnly("world_state"), at("stated", "new"))?.origin, "stated");
  assert.equal(mergeStoryTime(timeOnly("manual"), at("stated", "new"))?.origin, "manual");
  // The stamp's time of day survives the stated date unless the date brings its own.
  assert.deepEqual(mergeStoryTime(timeOnly("world_state"), at("stated", "new"))?.start, {
    date: "new",
    time: "evening",
  });
  assert.equal(
    mergeStoryTime(timeOnly("world_state"), { ...at("stated", "new"), start: { date: "new", time: "dawn" } })?.start
      .time,
    "dawn",
  );
  // A time-only stamp read from older piece text does not leak its time; one read from the same text keeps it.
  assert.deepEqual(
    mergeStoryTime({ ...timeOnly("world_state"), sourceHash: hash("older text") }, at("stated", "new"))?.start,
    { date: "new" },
  );
  assert.deepEqual(
    mergeStoryTime({ ...timeOnly("world_state"), sourceHash: hash("new") }, at("stated", "new"))?.start,
    { date: "new", time: "evening" },
  );
  for (const [existing, incoming, kept] of mergeCases) {
    const existingTime = existing ? at(existing, "old") : undefined,
      incomingTime = incoming ? at(incoming, "new") : undefined;
    const merged = mergeStoryTime(existingTime, incomingTime);
    assert.equal(merged?.origin, kept, `${existing} then ${incoming}`);
    if (existing && incoming)
      assert.equal(
        merged?.start.date,
        kept === incoming ? "new" : "old",
        `${existing} then ${incoming} keeps the right one`,
      );
  }

  // Counting. Each piece is [text, storyTime, jumps]; jumps undefined means the piece was never scanned.
  type Jump = { quote: string; amount: number | null; unit: string | null; implied?: true };
  const day = (amount: number | null, quote = "later", implied?: true): Jump => ({
      quote,
      amount,
      unit: "day",
      ...(implied ? { implied } : {}),
    }),
    span = (amount: number | null, unit: string | null, quote = "later"): Jump => ({ quote, amount, unit });
  const stated = (text: string, date: string, time?: string) => ({
    start: { date, ...(time ? { time } : {}) },
    origin: "stated",
    evidence: date,
    sourceHash: hash(text),
  });
  const piece = (text: string, jumps?: Jump[], storyTime?: object) => ({
    id: `source_${text.replace(/\W+/g, "_").toLowerCase()}`,
    sourceHash: hash(text),
    ...(storyTime ? { storyTime } : {}),
    ...(jumps ? { storyTimeScan: { sourceHash: hash(text), jumps } } : {}),
  });
  const ends = (pieces: ReturnType<typeof piece>[]) =>
    countStoryDays(pieces).map((result: any) => formatStoryPosition(result.end));
  const starts = (pieces: ReturnType<typeof piece>[]) =>
    countStoryDays(pieces).map((result: any) => formatStoryPosition(result.start));

  const thursday = [
    piece("Thursday morning, Wren opens the shop. The next morning she leaves.", [day(1, "The next morning", true)], {
      ...stated("Thursday morning, Wren opens the shop. The next morning she leaves.", "Thursday", "morning"),
    }),
    piece("Wren walks the coast road.", []),
    piece("Three weeks later Wren reaches Harrowmere.", [span(3, "week", "Three weeks later")]),
    piece("A few days later the rain stops.", [day(null, "A few days later")]),
    piece("Two months later the harbour freezes.", [span(2, "month", "Two months later")]),
    piece("On Monday the ice breaks.", [], stated("On Monday the ice breaks.", "Monday")),
  ];
  assert.deepEqual(starts(thursday), [
    "Day 1 · Thursday morning",
    "Day 2 · Friday",
    "Day 2 · Friday",
    "Day 23 · Friday",
    "a few days after Day 23",
    "Monday, about 2 months after Day 23",
  ]);
  assert.deepEqual(ends(thursday), [
    "Day 2 · Friday",
    "Day 2 · Friday",
    "Day 23 · Friday",
    "a few days after Day 23",
    "about 2 months after Day 23",
    "Monday, about 2 months after Day 23",
  ]);

  // Removing one jump re-flows every later piece.
  const withoutWeeks = thursday.map((entry, index) =>
    index === 2 ? piece("Three weeks later Wren reaches Harrowmere.", []) : entry,
  );
  assert.deepEqual(ends(withoutWeeks).slice(2, 5), [
    "Day 2 · Friday",
    "a few days after Day 2",
    "about 2 months after Day 2",
  ]);

  // A weekday that disagrees with the count records that unmeasured time passed.
  assert.deepEqual(
    ends([
      piece("Thursday.", [], stated("Thursday.", "Thursday")),
      piece("Saturday.", [], stated("Saturday.", "Saturday")),
    ]),
    ["Day 1 · Thursday", "Saturday, some time after Day 1"],
  );

  // No length, years, and several jumps in one piece.
  assert.deepEqual(ends([piece("Start.", []), piece("Time passed.", [span(null, null, "Time passed")])]), [
    "Day 1",
    "some time after Day 1",
  ]);
  assert.deepEqual(ends([piece("Start.", []), piece("A year on.", [span(1, "year", "A year on")])]), [
    "Day 1",
    "about 1 year after Day 1",
  ]);
  assert.deepEqual(
    ends([piece("Start.", []), piece("Days, then weeks.", [day(1), span(1, "week"), span(2, "week")])]),
    ["Day 1", "Day 23"],
  );
  assert.deepEqual(ends([piece("Start.", []), piece("Years then days.", [span(2, "year"), day(3)])]), [
    "Day 1",
    "about 2 years after Day 1",
  ]);

  // An exact date restarts the count from it, and the weekday in it is not repeated.
  const harvest = "Harvest Day, Year 3";
  assert.deepEqual(
    ends([
      piece("Start.", [span(1, "month")]),
      piece(`It is ${harvest}.`, [day(2, "Two days later")], stated(`It is ${harvest}.`, harvest)),
      piece("Thursday, 4 May.", [], stated("Thursday, 4 May.", "Thursday, 4 May")),
      piece("Next day.", [day(1, "Next day")]),
    ]),
    ["about 1 month after Day 1", `2 days after ${harvest}`, "Thursday, 4 May", "Friday, 1 day after Thursday, 4 May"],
  );

  // An unchecked piece makes it and every later piece unknown; a stale scan counts as unchecked.
  assert.deepEqual(ends([piece("Start.", [day(1)]), piece("Unchecked."), piece("Later.", [day(1)])]), [
    "Day 2",
    "not worked out yet",
    "not worked out yet",
  ]);
  const stale = { ...piece("Old text.", [day(5)]), sourceHash: hash("New text.") };
  assert.deepEqual(ends([piece("Start.", []), stale]), ["Day 1", "not worked out yet"]);
  // A stale stated date is ignored but its scan still counts.
  assert.deepEqual(ends([{ ...piece("Text.", [day(1)]), storyTime: stated("Older text.", "Midsummer") }]), ["Day 2"]);

  // An Engine date covers its piece: its jumps are not added, and its end keeps the date.
  const engine = { start: { date: "Spring 3", time: "noon" }, origin: "world_state" };
  const pinned = countStoryDays([piece("Spring.", [day(4)], engine), piece("After.", [day(1)])]);
  assert.deepEqual(pinned[0].end, {
    kind: "counted",
    anchor: "Spring 3",
    days: 0,
    after: [],
    time: "noon",
    origin: "world_state",
  });
  assert.deepEqual(
    pinned.map((result: any) => formatStoryPosition(result.end)),
    ["Spring 3, noon", "1 day after Spring 3"],
  );
  // A date the user typed on a piece is pinned the same way, and older piece text does not void it.
  const typedOnPiece = { start: { date: "Spring 4" }, origin: "manual", sourceHash: hash("Older text.") };
  assert.deepEqual(ends([piece("Spring.", [day(2)], typedOnPiece), piece("After.", [day(1)])]), [
    "Spring 4",
    "1 day after Spring 4",
  ]);
  // A stated end, as the scan stores a date it found after the jumps.
  assert.deepEqual(
    ends([
      piece("Day one.", []),
      piece("Two days on, the fair.", [day(2)], {
        ...stated("Two days on, the fair.", "Fair Day"),
        start: { time: "dawn" },
        end: { date: "Fair Day" },
      }),
    ]),
    ["Day 1", "Fair Day"],
  );

  // resolveStoryTime over stored notes.
  const chatPiece = (id: string, chatId: string, range: string, text: string, extra: object = {}) =>
    ltmNoteSchema.parse({
      id,
      type: "source",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId, chatIds: [chatId] },
      tags: ["imported_chat_messages"],
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      provenance: { kind: "chat_transcript", sourceId: chatId, entryId: `${id}-entry` },
      sections: {
        source: { text, updatedAt: timestamp, evidence: [`chat:${chatId}`, `message_range:${range}`] },
      },
      ...extra,
    });
  const scanned = (text: string, jumps: Jump[]) => ({
    storyTimeScan: { sourceHash: hash(text), jumps },
  });
  const pieces = [
    // Stored out of order: the resolver sorts by message range.
    chatPiece(
      "source_wren_3",
      "chat-a",
      "21-30",
      "Three weeks later.",
      scanned("Three weeks later.", [span(3, "week")]),
    ),
    chatPiece("source_wren_1", "chat-a", "1-10", "Thursday.", {
      storyTime: stated("Thursday.", "Thursday"),
      ...scanned("Thursday.", []),
    }),
    chatPiece("source_wren_2", "chat-a", "11-20", "Next day.", scanned("Next day.", [day(1)])),
    chatPiece("source_other_1", "chat-b", "1-5", "Elsewhere.", scanned("Elsewhere.", [span(1, "year")])),
  ];
  const byId = new Map(pieces.map((note) => [note.id, note]));
  const contribution = (sourceNoteId: string, updatedAt: string) => ({
    owner: "source",
    sourceNoteId,
    sourceHash: "a".repeat(64),
    text: "Contributed.",
    updatedAt,
  });
  const memory = (id: string, type: string, contributions: object[], extra: object = {}) =>
    ltmNoteSchema.parse({
      id,
      type,
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      sections: { facts: { text: "Fact.", updatedAt: timestamp, contributions } },
      ...extra,
    });
  const show = (resolved: any) => ({
    start: formatStoryPosition(resolved.start),
    ...(resolved.end ? { end: formatStoryPosition(resolved.end) } : {}),
    ...(resolved.asOf ? { asOf: true } : {}),
    sourceNoteIds: resolved.sourceNoteIds,
  });

  // An archived piece, scanned or not, is left out of the count.
  const archived = chatPiece("source_wren_archived", "chat-a", "15-15", "Archived.", { status: "archived" });
  assert.deepEqual(show(resolveStoryTime(byId.get("source_wren_3")!, new Map([...byId, [archived.id, archived]]))), {
    start: "Day 2 · Friday",
    end: "Day 23 · Friday",
    sourceNoteIds: ["source_wren_3"],
  });
  assert.deepEqual(show(resolveStoryTime(byId.get("source_wren_2")!, byId)), {
    start: "Day 1 · Thursday",
    end: "Day 2 · Friday",
    sourceNoteIds: ["source_wren_2"],
  });
  const event = memory("timeline_wren_trip", "timeline_event", [
    contribution("source_wren_3", "2026-11-19T02:00:00.000Z"),
    contribution("source_wren_2", "2026-11-19T01:00:00.000Z"),
  ]);
  assert.deepEqual(show(resolveStoryTime(event, byId)), {
    start: "Day 1 · Thursday",
    end: "Day 23 · Friday",
    sourceNoteIds: ["source_wren_2", "source_wren_3"],
  });
  const character = memory("char_wren", "character", [contribution("source_wren_2", "2026-11-19T01:00:00.000Z")]);
  assert.deepEqual(show(resolveStoryTime(character, byId)), {
    start: "Day 2 · Friday",
    asOf: true,
    sourceNoteIds: ["source_wren_2"],
  });
  // A memory drawing on two chats is dated from the chat of its newest contribution.
  const mixed = memory("char_wren_mixed", "character", [
    contribution("source_wren_3", "2026-11-19T01:00:00.000Z"),
    contribution("source_other_1", "2026-11-19T03:00:00.000Z"),
  ]);
  assert.deepEqual(show(resolveStoryTime(mixed, byId)), {
    start: "about 1 year after Day 1",
    asOf: true,
    sourceNoteIds: ["source_other_1"],
  });
  // A date the user typed wins over the pieces; no contributions means unknown.
  const typed = memory("world_wren_shop", "world", [contribution("source_wren_3", timestamp)], {
    storyTime: { start: { date: "First of Frostmonth" }, end: { date: "Midwinter", time: "dusk" }, origin: "manual" },
  });
  assert.deepEqual(show(resolveStoryTime(typed, byId)), {
    start: "First of Frostmonth",
    end: "Midwinter, dusk",
    sourceNoteIds: [],
  });
  assert.deepEqual(show(resolveStoryTime(memory("world_no_source", "world", []), byId)), {
    start: "not worked out yet",
    sourceNoteIds: [],
  });

  // Recall: a timeline bullet starts with its story date. The date is in the chunk hash, so a changed jump on an earlier
  // piece rebuilds the chunks of the events after it, and only those; the chunk text, and so its embedding, stays.
  const { chunkNotes, CURRENT_LTM_CHUNK_FORMAT_VERSION } = await import(`${source}/recall/chunking.ts`);
  const { formatLtmChunkPromptText } = await import(`${source}/recall/prompt-text.ts`);
  assert.equal(CURRENT_LTM_CHUNK_FORMAT_VERSION, 7);
  const timeline = (id: string, contributions: object[], extra: object = {}) =>
    memory(id, "timeline_event", contributions, extra);
  const events = [
    event,
    timeline("timeline_exact", [], {
      storyTime: { start: { date: "3rd of Frostfall", time: "evening" }, origin: "manual" },
    }),
    timeline("timeline_vague", [contribution("source_other_1", timestamp)]),
    timeline("timeline_none", []),
    timeline("timeline_first", [contribution("source_wren_1", timestamp)]),
  ];
  const chunksOf = (notes: any[]) =>
    new Map(
      chunkNotes(notes)
        .filter((chunk: any) => chunk.noteType === "timeline_event")
        .map((chunk: any) => [chunk.noteId, chunk]),
    );
  const before = chunksOf([...pieces, ...events]);
  assert.deepEqual(Object.fromEntries([...before].map(([id, chunk]: any) => [id, formatLtmChunkPromptText(chunk)])), {
    timeline_wren_trip: "[Day 1, Thursday to Day 23, Friday] Fact.",
    timeline_exact: "[3rd of Frostfall, evening] Fact.",
    timeline_vague: "[Day 1 to about 1 year after Day 1] Fact.",
    timeline_none: "Fact.",
    timeline_first: "[Day 1, Thursday] Fact.",
  });
  const changedJump = pieces.map((note) =>
    note.id === "source_wren_2" ? { ...note, storyTimeScan: { ...note.storyTimeScan!, jumps: [day(2)] } } : note,
  );
  const after = chunksOf([...changedJump, ...events]);
  assert.equal(
    formatLtmChunkPromptText(after.get("timeline_wren_trip")),
    "[Day 1, Thursday to Day 24, Saturday] Fact.",
  );
  assert.notEqual(after.get("timeline_wren_trip").sourceHash, before.get("timeline_wren_trip").sourceHash);
  assert.equal(after.get("timeline_wren_trip").text, before.get("timeline_wren_trip").text);
  for (const id of ["timeline_exact", "timeline_vague", "timeline_none", "timeline_first"])
    assert.equal(after.get(id).sourceHash, before.get(id).sourceHash, `${id} keeps its chunk`);
  // A bare label on its own line: the date stays with the event text, not on a bullet of its own.
  assert.equal(
    formatLtmChunkPromptText({ ...before.get("timeline_first"), text: "summary:\nFact." }),
    "[Day 1, Thursday] Fact.",
  );

  await findStoryDates({ hash, resolveStoryTime, formatStoryPosition });

  process.stdout.write(
    "Long-Term Memory story dates regression: merge, day count, formatter, resolver, find story dates ok\n",
  );
}

// Find story dates: the Engine dates what it can, the model scans the rest, and every quote is checked before apply.
async function findStoryDates({ hash, resolveStoryTime, formatStoryPosition }: any) {
  const { checkStoryDatesScan, previewLtmStoryDates, applyLtmStoryDates, scopeLtmStoryDates } = await import(
    `${source}/maintenance/story-dates.ts`
  );
  const { configurePackageRuntime } = await import(`${source}/package-runtime.ts`);
  const { LongTermMemoryStorage } = await import(`${source}/persistence/storage.ts`);
  const { readLtmDebugLog } = await import(`${source}/maintenance/debug-log.ts`);
  const { ltmStoryDatesApplyRequestSchema } =
    await import("../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts");

  // The checks on one answer, without a model.
  const scan = (text: string, answer: object) => checkStoryDatesScan(text, { stated: null, jumps: [], ...answer }, "n");
  const jump = (quote: string, amount: number | null, unit: string | null, implied = false) => ({
    quote,
    amount,
    unit,
    implied,
  });
  const reasons = (result: any) => result.rejected.map((entry: any) => entry.reason);
  assert.deepEqual(scan("Twenty five days later.", { jumps: [jump("Twenty five days later", 25, "day")] }).jumps, [
    { quote: "Twenty five days later", amount: 25, unit: "day" },
  ]);
  const few = scan("A few days later.", { jumps: [jump("A few days later", 1, "day")] });
  assert.deepEqual(
    [few.jumps, reasons(few)],
    [[{ quote: "A few days later", amount: null, unit: "day" }], ["amount_not_in_quote"]],
    "'a few' is not an exact amount",
  );
  assert.deepEqual(scan("After a fortnight.", { jumps: [jump("After a fortnight", 14, "day")] }).jumps[0].amount, 14);
  const noUnit = scan("Some time later.", { jumps: [jump("Some time later", 2, "week")] });
  assert.deepEqual(
    [noUnit.jumps[0], reasons(noUnit)],
    [{ quote: "Some time later", amount: null, unit: null }, ["unit_not_in_quote"]],
  );
  assert.deepEqual(reasons(scan("Tomorrow.", { stated: { date: "tomorrow", quote: "Tomorrow" } })), ["not_a_date"]);
  assert.deepEqual(scan("It was Day 3.", { stated: { date: "Day 3", quote: "Day 3" } }).stated, {
    date: "Day 3",
    quote: "Day 3",
  });
  // A quote must stand as whole words: never part of a longer number or word.
  assert.deepEqual(reasons(scan("It was Day 30 of the siege.", { stated: { date: "Day 3", quote: "Day 3" } })), [
    "quote_not_found",
  ]);
  assert.deepEqual(reasons(scan("We had 10 apples.", { stated: { date: "1", quote: "1" } })), ["quote_not_found"]);
  assert.deepEqual(reasons(scan("13 days later.", { jumps: [jump("3 days later", 3, "day")] })), ["quote_not_found"]);
  assert.deepEqual(reasons(scan("Twenty-three days later.", { jumps: [jump("three days later", 3, "day")] })), [
    "quote_not_found",
  ]);
  const cutAmount = scan("Twenty three days later.", { jumps: [jump("three days later", 3, "day")] });
  assert.deepEqual(
    [cutAmount.jumps, reasons(cutAmount)],
    [[{ quote: "three days later", amount: null, unit: "day" }], ["amount_not_in_quote"]],
    "the piece's word before the quote is part of the amount",
  );
  assert.deepEqual(
    scan("On Day 3's dawn.", { stated: { date: "Day 3", quote: "Day 3" } }).stated?.date,
    "Day 3",
    "a possessive after the quote still ends a word",
  );
  // A unit that is not one of the four, even an object key such as "toString", is dropped, not a crash.
  assert.deepEqual(reasons(scan("Two days later.", { jumps: [jump("Two days later", 2, "toString")] })), ["invalid"]);
  const lateWeekday = scan("Two days later, on Monday.", {
    stated: { date: "Monday", quote: "on Monday" },
    jumps: [jump("Two days later", 2, "day")],
  });
  assert.deepEqual(
    [lateWeekday.stated, lateWeekday.jumps.length, reasons(lateWeekday)],
    [null, 1, ["weekday_after_jump"]],
  );
  const lateDate = scan("Two days later came the 3rd of Frostfall. A week on.", {
    stated: { date: "the 3rd of Frostfall", quote: "the 3rd of Frostfall" },
    jumps: [jump("Two days later", 2, "day"), jump("A week on", 1, "week")],
  });
  assert.deepEqual(
    [lateDate.stated?.date, lateDate.jumps.map((entry: any) => entry.quote), reasons(lateDate)],
    ["the 3rd of Frostfall", ["A week on"], ["jump_before_date"]],
  );
  assert.deepEqual(reasons(scan("At dusk.", { stated: { date: "Spring 3", time: "noon", quote: "At dusk" } })), [
    "date_not_in_quote",
  ]);

  const previousZone = process.env.TZ;
  process.env.TZ = "UTC";
  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-story-dates-"));
  const root = join(dataDir, "long-term-memory");
  const timestamp = "2026-11-19T00:00:00.000Z";
  const chat = (id: string, mode: string) => ({
    id,
    name: id,
    mode,
    characterIds: [],
    groupId: null,
    personaId: null,
    connectionId: null,
    metadata: {},
    lastMessageAt: null,
    updatedAt: timestamp,
  });
  const chats = [chat("chat-talk", "conversation"), chat("chat-wren", "roleplay")];
  const message = (chatId: string, id: string, createdAt = timestamp) => ({
    id,
    chatId,
    role: "user",
    characterId: null,
    content: "Line.",
    activeSwipeIndex: 0,
    extra: {},
    createdAt,
  });
  const messages = new Map([
    [
      "chat-talk",
      [message("chat-talk", "t1", "2026-10-28T09:30:00.000Z"), message("chat-talk", "t2"), message("chat-talk", "t3")],
    ],
    ["chat-wren", ["w1", "w2", "w3", "w4"].map((id) => message("chat-wren", id))],
  ]);
  const releaseHost = configurePackageRuntime({
    dataDir,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    persistence: {
      dataDir,
      getChat: async (id: string) => chats.find((entry) => entry.id === id) ?? null,
      listChats: async () => chats,
      listMessages: async (id: string) => messages.get(id) ?? [],
    },
  } as never);
  const storage = new LongTermMemoryStorage(root);
  const model = { name: "Fictional Provider", model: "fictional-model-1", maxOutputTokens: 4000 };
  let counter = 0;
  // A new note takes no story date, so one is written after it is created.
  const createPiece = async (chatId: string, number: number, entryId: string, text: string, storyTime?: object) => {
    const created = await storage.createNote({
      id: `source_${(counter++).toString(16).padStart(8, "0")}`,
      title: `${chatId} piece ${number}`,
      type: "source",
      modes: ["roleplay"],
      scope: { chatId, chatIds: [chatId] },
      tags: ["imported_chat_messages"],
      keywords: [],
      links: [],
      provenance: { kind: "chat_transcript", sourceId: chatId, entryId },
      sections: {
        source: { text, updatedAt: timestamp, evidence: [`chat:${chatId}`, `message_range:${number}-${number}`] },
      },
    });
    return storyTime ? storage.updateNote(created.id, { storyTime } as never) : created;
  };
  const reply = (answers: object[]) => JSON.stringify({ pieces: answers });
  const textsOf = (prompt: string) =>
    prompt
      .split(/^=== p\d+ ===\n/m)
      .slice(1)
      .map((text) => text.trim());

  await runWithSafeCleanup(
    "LTM find story dates",
    async () => {
      await storage.initializeLtmStore();
      const kitchen = "Tea in the kitchen on Thursday.";
      // A stated date on a piece the Engine can date: the Engine's date replaces it.
      const talk = await createPiece("chat-talk", 1, "t1", kitchen, {
        start: { date: "Thursday" },
        origin: "stated",
        evidence: "Thursday",
        sourceHash: hash(kitchen),
      });
      const manualText = "Thursday, the shop opens.";
      const manual = await createPiece("chat-talk", 2, "t2", manualText, {
        start: { date: "Spring 4" },
        origin: "manual",
      });
      // Its first message is no longer at its number (hidden or edited): the Engine does not date it.
      const moved = await createPiece("chat-talk", 3, "t-hidden", "The kettle boils.");
      const texts = [
        "Thursday morning, Wren opens the shop. Three days later she sails.",
        "The bell rang twice.",
        "On the 4th of Frostfall, a few days later, the rain stops.",
        "Morning came over the harbour. That night the lamps burned.",
      ];
      const [first, missing, third, fourth] = await Promise.all(
        texts.map((text, index) => createPiece("chat-wren", index + 1, `w${index + 1}`, text)),
      );

      assert.deepEqual(await scopeLtmStoryDates({ storage }), {
        count: 6,
        chats: [
          { chatId: "chat-talk", dated: 1, checked: 0, notChecked: 2 },
          { chatId: "chat-wren", dated: 0, checked: 0, notChecked: 4 },
        ],
      });

      const answers: Record<string, object> = {
        "The kettle boils.": { stated: null, jumps: [] },
        [texts[0]!]: {
          stated: { date: "Thursday", time: "morning", quote: "Thursday morning" },
          jumps: [jump("Three days later", 3, "day"), jump("Two weeks passed", 2, "week")],
        },
        [texts[2]!]: {
          stated: { date: "the 5th of Frostfall", quote: "the 4th of Frostfall" },
          jumps: [jump("a few days later", 3, "day")],
        },
        [texts[3]!]: {
          stated: null,
          jumps: [jump("Morning came", 1, "day", true), jump("That night", 1, "day", true)],
        },
      };
      const prompts: string[] = [];
      const answering = async (messages: { content: string }[]) => {
        prompts.push(messages[1]!.content);
        const sent = textsOf(messages[1]!.content);
        return `\`\`\`json\n${reply([
          ...sent.flatMap((text, index) => (answers[text] ? [{ id: `p${index + 1}`, ...answers[text] }] : [])),
          { id: "p99", stated: null, jumps: [] },
        ])}\n\`\`\``;
      };
      const before = JSON.stringify(await storage.listNotes());
      const preview = await previewLtmStoryDates({ root, storage, languageModel: model, complete: answering });
      assert.equal(JSON.stringify(await storage.listNotes()), before, "preview changes nothing");
      assert.deepEqual(
        prompts.map(textsOf),
        [["The kettle boils."], texts],
        "one call per chat; the Engine-dated and the user-dated pieces are not sent",
      );
      for (const prompt of prompts)
        for (const date of ["2026-10-28", "Spring 4", talk.id])
          assert.ok(!prompt.includes(date), `the prompt holds only piece text, not ${date}`);
      assert.deepEqual(
        [preview.total, preview.checked, preview.unchecked, preview.failedChunks, preview.truncated],
        [7, 5, 1, 0, true],
      );
      const rowOf = (id: string) => preview.pieces.find((row: any) => row.noteId === id) as any;
      assert.equal(rowOf(talk.id).kind, "engine");
      assert.deepEqual(rowOf(talk.id).storyTime.start, { date: "2026-10-28", time: "09:30" });
      assert.equal(rowOf(moved.id).kind, "scan");
      assert.equal(rowOf(manual.id), undefined);
      assert.deepEqual(
        [rowOf(first.id).stated, rowOf(first.id).jumps],
        [
          { date: "Thursday", time: "morning", quote: "Thursday morning" },
          [{ quote: "Three days later", amount: 3, unit: "day" }],
        ],
      );
      assert.deepEqual(
        [rowOf(third.id).stated, rowOf(third.id).jumps],
        [null, [{ quote: "a few days later", amount: null, unit: "day" }]],
      );
      assert.deepEqual(rowOf(fourth.id).jumps, [{ quote: "Morning came", amount: 1, unit: "day", implied: true }]);
      // Where each jump reaches once the preview is applied, counted from the dates in this same preview. The piece the
      // reply missed is not checked, so the jumps after it reach no known day.
      assert.deepEqual(
        [rowOf(talk.id).reaches, rowOf(first.id).reaches, rowOf(third.id).reaches, rowOf(fourth.id).reaches],
        [undefined, ["Day 4 · Sunday"], [null], [null]],
      );
      assert.deepEqual(
        preview.rejected.map((entry: any) => [entry.noteId, entry.kind, entry.reason]),
        [
          [null, "piece", "unknown_id"],
          [null, "piece", "unknown_id"],
          [missing.id, "piece", "missing"],
          [first.id, "jump", "quote_not_found"],
          [third.id, "stated", "date_not_in_quote"],
          [third.id, "jump", "amount_not_in_quote"],
          [fourth.id, "jump", "implied_without_morning"],
        ],
      );

      // Apply writes the rows; the Engine date replaces the stated one.
      let rebuilds = 0;
      const rebuild = async () => {
        rebuilds += 1;
        return { status: "deferred" as const, error: "test" } as never;
      };
      const asApplyRow = (row: any) =>
        row.kind === "engine"
          ? { kind: "engine", noteId: row.noteId, sourceHash: row.sourceHash }
          : { kind: "scan", noteId: row.noteId, sourceHash: row.sourceHash, stated: row.stated, jumps: row.jumps };
      const applied = await applyLtmStoryDates({ root, storage, rows: preview.pieces.map(asApplyRow), rebuild });
      assert.deepEqual([applied.applied.length, applied.skipped, applied.rejected, rebuilds], [5, [], [], 1]);
      assert.equal((await storage.getNote(talk.id))?.storyTime?.origin, "message_time");
      assert.deepEqual((await storage.getNote(first.id))?.storyTime?.start, { date: "Thursday", time: "morning" });
      assert.deepEqual((await storage.getNote(moved.id))?.storyTimeScan?.jumps, []);

      // The piece the reply missed stays not checked and blocks the count after it.
      const notesById = async () => new Map((await storage.listNotes()).map((note: any) => [note.id, note]));
      const at = async (id: string) => {
        const byId = await notesById();
        return formatStoryPosition(resolveStoryTime(byId.get(id), byId).end);
      };
      assert.equal(await at(first.id), "Day 4 · Sunday");
      assert.equal(await at(third.id), "not worked out yet");

      // A carried-on run starts at the missed piece; checked pieces are not sent again.
      prompts.length = 0;
      answers[texts[1]!] = { stated: null, jumps: [] };
      const carried = await previewLtmStoryDates({
        root,
        storage,
        languageModel: model,
        complete: answering,
        after: preview.next,
      });
      assert.deepEqual([prompts.map(textsOf), carried.next], [[[texts[1]]], null]);
      // A forged row is checked again: the invented quote is left out, the piece is marked checked.
      const forged = await applyLtmStoryDates({
        root,
        storage,
        rows: [
          {
            kind: "scan",
            noteId: missing.id,
            sourceHash: hash(texts[1]!),
            stated: { date: "Midsummer", quote: "on Midsummer" },
            jumps: [],
          },
        ],
        rebuild,
      });
      assert.deepEqual(
        forged.rejected.map((entry: any) => entry.reason),
        ["quote_not_found"],
      );
      assert.equal((await storage.getNote(missing.id))?.storyTime, undefined);
      assert.notEqual(await at(third.id), "not worked out yet");

      // A date the user typed is never replaced.
      const onManual = await applyLtmStoryDates({
        root,
        storage,
        rows: [
          {
            kind: "scan",
            noteId: manual.id,
            sourceHash: hash(manualText),
            stated: { date: "Thursday", quote: "Thursday" },
            jumps: [],
          },
        ],
        rebuild,
      });
      assert.deepEqual(onManual.applied, [manual.id]);
      assert.deepEqual((await storage.getNote(manual.id))?.storyTime, {
        start: { date: "Spring 4" },
        origin: "manual",
      });
      const engineOnManual = await applyLtmStoryDates({
        root,
        storage,
        rows: [{ kind: "engine", noteId: manual.id, sourceHash: hash(manualText) }],
        rebuild,
      });
      assert.deepEqual(engineOnManual.skipped, [{ noteId: manual.id, reason: "no_engine_date" }]);

      // Changed text: apply refuses the old row, and the piece is sent again.
      const current = (await storage.getNote(first.id))!;
      const changed = "Thursday morning, Wren opens the shop. Four days later she sails.";
      await storage.updateNote(first.id, {
        sections: { ...current.sections, source: { ...current.sections.source!, text: changed } },
      });
      const stale = await applyLtmStoryDates({ root, storage, rows: [asApplyRow(rowOf(first.id))], rebuild });
      assert.deepEqual(stale.skipped, [{ noteId: first.id, reason: "text_changed" }]);
      prompts.length = 0;
      answers[changed] = { stated: null, jumps: [] };
      await previewLtmStoryDates({ root, storage, languageModel: model, complete: answering });
      assert.deepEqual(prompts.map(textsOf), [[changed]]);

      // Every call failing is an error; an aborted run stops after the call in flight.
      await assert.rejects(
        previewLtmStoryDates({
          root,
          storage,
          languageModel: model,
          complete: async () => {
            throw new Error("provider down");
          },
        }),
        (error: { code?: string }) => error.code === "ltm_model_output_unusable",
      );
      const controller = new AbortController();
      let calls = 0;
      await assert.rejects(
        previewLtmStoryDates({
          root,
          storage,
          languageModel: model,
          signal: controller.signal,
          complete: async () => {
            calls += 1;
            controller.abort();
            throw new Error("aborted");
          },
        }),
      );
      assert.equal(calls, 1);

      // The debug log holds counts, never piece text.
      const log = JSON.stringify(await readLtmDebugLog(root));
      assert.ok(log.includes("story_dates_chunk") && log.includes("story_dates_apply"));
      for (const text of [...texts, kitchen, "Frostfall"])
        assert.ok(!log.includes(text), `the debug log must not hold piece text: ${text}`);

      assert.ok(!ltmStoryDatesApplyRequestSchema.safeParse({ rows: [] }).success);
      const row = { kind: "engine", noteId: talk.id, sourceHash: hash(kitchen) };
      assert.ok(!ltmStoryDatesApplyRequestSchema.safeParse({ rows: [row, row] }).success);
    },
    [
      () => releaseHost(),
      () => rm(dataDir, { recursive: true, force: true }),
      () => {
        if (previousZone === undefined) delete process.env.TZ;
        else process.env.TZ = previousZone;
      },
    ],
  );
}

void runRegressionToCompletion("long-term-memory-story-dates", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
