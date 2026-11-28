// Otome Hearth 0.28.0: a scene's reply shape sits at the very end of the task turn, not only near the top of the
// cached instructions. The shape used to appear about a fifth of the way into the third system message, with the whole
// choice-rules block, the effects block, the voices block and the task after it, so a model reading only the tail had
// nothing to copy and answered in prose or in a fence. The two places now say the same thing from one constant.
//
// What is pinned here:
//   - The scene's last message is the task turn, a user message, and it ends with the reply shape.
//   - The shape it ends with is the same text the instructions carry, so the two cannot drift.
//   - The trailer sits after every other instruction, including the content-contract reminder.
//   - A date node and his-side node, which build their own task lines, still end on the shape.
//   - A Confrontation and a Closer keep their own shapes (untouched by this change).
import assert from "node:assert/strict";
import test from "node:test";
import type {
  Chapter,
  ChapterNode,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import {
  defaultLiState,
  normalizeState,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { beatMessages } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import { CAST, HE, KAI, MIR, SHE, bible } from "./fixtures/otome-forge-story.ts";

const world = normalizeWorld({ connections: { narration: "conn-text" } });
const player = { ...normalizePlayer({}), name: "Ines", pronouns: SHE };
const units = CAST.map((li) => ({ ...normalizeUnit({}), id: li.id, name: li.name, pronouns: HE, bible: bible() }));
const state = normalizeState({ lis: { [KAI]: defaultLiState(), [MIR]: defaultLiState() } });

/** The reply shape as a scene writes it, the same text the instructions carry. */
const SHAPE =
  '{"musicMood": "home|date|tender|tense|angst|confession", "places": [{"name": "...", "tags": "..."}], "segments": [{"speaker": "", "text": "...", "thought": false, "expression": "", "place": "..."}]}';

function scene(chapter: Partial<Chapter> = {}, node: Partial<ChapterNode> = {}) {
  const fullNode = { i: 0, kind: "beat", guide: "A night in the lamp room.", cast: [KAI], ...node } as ChapterNode;
  const fullChapter = {
    kind: "main",
    number: 2,
    title: "Rain",
    lead: KAI,
    foil: MIR,
    nodes: [fullNode],
    ...chapter,
  } as Chapter;
  return beatMessages({
    world,
    player,
    units,
    state,
    chapter: fullChapter,
    node: fullNode,
    storySoFar: [],
    memory: "",
  });
}

const last = (messages: Array<{ role: string; content: string }>) => messages[messages.length - 1]!;

test("the task turn is the last message and states the reply shape at its end", () => {
  const messages = scene();
  const tail = last(messages as Array<{ role: string; content: string }>);
  assert.equal(tail.role, "user", "the task reaches the model as a user turn");
  assert.ok(tail.content.includes(SHAPE), `the task turn states the shape:\n…${tail.content.slice(-260)}`);
  assert.match(tail.content, /no markdown and no code fence/);
});

test("the shape the trailer states is the shape the instructions carry", () => {
  const messages = scene();
  const instructions = messages.find(
    (message) => message.role === "system" && message.content.includes("You are the narrator"),
  )!;
  assert.ok(instructions, "the narrator's instructions are still sent");
  assert.ok(instructions.content.includes(SHAPE), "the instructions state the same shape");
  // One occurrence in the instructions, one in the trailer: two, not three, and neither is a near-miss.
  const occurrences = messages.filter((message) => message.content.split(SHAPE).length - 1).length;
  assert.equal(occurrences, 2, "the shape is stated exactly twice");
});

test("the shape comes last in the task turn, and the content-contract reminder after it", () => {
  const tail = last(scene() as Array<{ role: string; content: string }>);
  const reminder = tail.content.indexOf("Keep to the CONTENT CONTRACT above");
  const shape = tail.content.lastIndexOf(SHAPE);
  assert.ok(reminder >= 0, "the content-contract reminder is still there");
  assert.ok(shape > tail.content.indexOf("What happens:"), "the trailer follows the task's own lines");
  assert.ok(shape > tail.content.indexOf("Narrate node"), "and the node heading");
  // The reminder stays the final line, as it was before this change (S/tests/otome-forge-beats.ts pins it).
  assert.match(tail.content, /Keep to the CONTENT CONTRACT above, silently\.$/u);
  assert.ok(shape < reminder, "the shape sits immediately before the reminder, not after it");
});

test("a date's node and his side's node still end on the shape", () => {
  for (const chapter of [{ kind: "date" as const, date: { li: KAI, placeName: "the lamp room" } }, { hisSide: true }]) {
    const tail = last(scene(chapter) as Array<{ role: string; content: string }>);
    assert.ok(
      tail.content.includes(SHAPE),
      `${"hisSide" in chapter ? "his side" : "a date"} states the shape:\n…${tail.content.slice(-200)}`,
    );
  }
});

test("the last node, which adds the big-choice rules, still states the shape last", () => {
  const tail = last(
    scene({
      nodes: [{ i: 0, kind: "beat", guide: "The last.", cast: [KAI] } as ChapterNode],
    } as Partial<Chapter>) as Array<{
      role: string;
      content: string;
    }>,
  );
  const shape = tail.content.lastIndexOf(SHAPE);
  const reminder = tail.content.indexOf("Keep to the CONTENT CONTRACT above");
  // The prompt capitalises this line ("- This is the chapter's last node: …"); a lowercase search finds nothing and
  // made the comparison below pass against -1, so it is matched as written.
  const lastNodeRule = tail.content.indexOf("This is the chapter's last node");
  assert.ok(lastNodeRule >= 0, "the last-node rules are in the task turn");
  assert.ok(shape > lastNodeRule, "the shape follows the last-node rules");
  assert.ok(shape < reminder, "and sits immediately before the reminder");
});
