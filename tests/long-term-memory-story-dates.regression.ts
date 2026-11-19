import assert from "node:assert/strict";
import { runRegressionToCompletion } from "./regression-helpers.ts";

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

  process.stdout.write("Long-Term Memory story dates regression: merge, day count, formatter, resolver ok\n");
}

void runRegressionToCompletion("long-term-memory-story-dates", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
