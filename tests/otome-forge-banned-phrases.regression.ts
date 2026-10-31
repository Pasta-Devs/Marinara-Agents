// Otome Hearth: the player's own banned phrases (Settings → Content), beside the built-in list.
// - Typed phrases are split at commas, semicolons and line breaks, unquoted and kept once (Story Writer's rule).
// - With none, the banned-phrases line is the one every prompt carried before, byte for byte; with some, it ends with
//   them, quoted, in every prompt that writes story or a character's words: scenes, messages and caring messages.
// - POST /runs/:run/settings saves them as typed (trimmed), refuses a list over its limit, and an empty one clears it.
import assert from "node:assert/strict";
import test from "node:test";
import {
  BANNED_PHRASES,
  OWN_BANNED_PHRASES_MAX,
  parseBannedPhrases,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/banned-phrases.ts";
import { careNoteMessages } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/care/prompts.ts";
import { worldId } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { chatReplyMessages } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/prompts.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { defaultLiState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { beatMessages } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/prompts.ts";
import {
  BANNED_PHRASES_RULE,
  bannedPhrasesRule,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/writing-rules.ts";
import { routesOf } from "./fixtures/otome-forge-art.ts";
import { CAST, HE, KAI, SHE, at, bible, storyWorld } from "./fixtures/otome-forge-story.ts";

const OWN = ' "wet heat", slick folds;\nWet Heat\n“tell me to stop” ';
const text = (messages: Array<{ content: string }>) => messages.map((message) => message.content).join("\n");

test("typed phrases are split, unquoted and kept once", () => {
  assert.deepEqual(parseBannedPhrases(OWN), ["wet heat", "slick folds", "tell me to stop"]);
  assert.deepEqual(parseBannedPhrases(""), []);
  assert.deepEqual(parseBannedPhrases(undefined), []);
});

test("with none of their own, the line is the one before; with some, it ends with them quoted", () => {
  assert.equal(bannedPhrasesRule(), BANNED_PHRASES_RULE);
  assert.equal(bannedPhrasesRule(""), BANNED_PHRASES_RULE);
  assert.equal(BANNED_PHRASES_RULE, `- Never use these overused phrases or patterns: ${BANNED_PHRASES.join("; ")}.`);
  assert.equal(
    bannedPhrasesRule(OWN),
    `- Never use these overused phrases or patterns: ${BANNED_PHRASES.join("; ")}; "wet heat"; "slick folds"; "tell me to stop".`,
  );
});

test("scenes, messages and caring messages all carry the player's own banned phrases", () => {
  const world = { ...normalizeWorld({ connections: { narration: "c" } }), bannedPhrases: OWN };
  const plain = { ...world, bannedPhrases: "" };
  const units = CAST.map((li) => ({ ...normalizeUnit({}), id: li.id, name: li.name, pronouns: HE, bible: bible() }));
  const kai = units.find((unit) => unit.id === KAI)!;
  const player = { ...normalizePlayer({}), name: "Ines", pronouns: SHE };
  const node = { i: 0, kind: "beat" as const, guide: "A night in the lamp room.", cast: [KAI] };
  const chapter = { kind: "main" as const, number: 2, title: "Rain", lead: KAI, foil: KAI, nodes: [node] };
  const scene = (w: typeof world) =>
    text(
      beatMessages({
        world: w,
        player,
        units,
        state: { lis: { [KAI]: defaultLiState() } } as never,
        chapter,
        node,
        storySoFar: "",
        memory: "",
      }),
    );
  const chat = text(
    chatReplyMessages({
      world,
      player,
      unit: kai,
      liState: defaultLiState(),
      tail: [{ id: "m-1", who: "player", text: "Still awake?", at }],
      memories: [],
      story: "",
      offscreen: "",
    }),
  );
  const care = text(careNoteMessages({ world, player, unit: kai, careLine: "Ines has told you: a rough day." }));
  const line = bannedPhrasesRule(OWN);
  for (const [kind, prompt] of Object.entries({ scene: scene(world), chat, care })) {
    assert.ok(prompt.includes(line), `${kind} carries them`);
  }
  // With none, the prompt is the one before: the built-in line, and nothing of theirs.
  const before = scene(plain);
  assert.ok(before.includes(BANNED_PHRASES_RULE) && !before.includes('"wet heat"'));
  assert.equal(scene(world).replace(line, BANNED_PHRASES_RULE), before, "the line is all that changes");
});

test("Settings → Content saves them as typed, refuses a list too long, and clears with an empty one", async () => {
  const t = await storyWorld({ runKey: "r-banned01-aaaaaa" });
  const runs = routesOf(registerRunRoutes, t.deps, "r-banned01-aaaaaa");
  const saved = await runs("POST", "/runs/:run/settings", { bannedPhrases: `  ${OWN}  ` });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.world.bannedPhrases, OWN.trim(), "the view shows them as typed");
  const stored = async () => (await t.store.readDoc(worldId(t.runId), normalizeWorld))!.bannedPhrases;
  assert.equal(await stored(), OWN.trim());
  const other = await runs("POST", "/runs/:run/settings", { writingStyle: "Present tense." });
  assert.equal(other.status, 200);
  assert.equal(await stored(), OWN.trim(), "another setting leaves them as they were");
  const tooLong = await runs("POST", "/runs/:run/settings", { bannedPhrases: "x".repeat(OWN_BANNED_PHRASES_MAX + 1) });
  assert.equal(tooLong.status, 400);
  assert.equal(await stored(), OWN.trim(), "a refused list changes nothing");
  assert.equal((await runs("POST", "/runs/:run/settings", { bannedPhrases: "" })).status, 200);
  assert.equal(await stored(), "");
});
