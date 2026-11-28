// Otome Hearth haptics (0.34.0): cues read from a reply, the scene and message paths, the server's loop over the Engine's
// Intiface connection (a fake one here), and what the reader plays at a line. The maintainer's rules: no cap on strength
// anywhere, every pattern loops until the story changes it, and Stop always stops every toy.
import assert from "node:assert/strict";
import test from "node:test";
import type {
  Chapter,
  ChapterNode,
  HapticCue,
  Segment,
  World,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  hapticsOn,
  isHapticsUrl,
  normalizeHapticCues,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/haptics.ts";
import { normalizeOtomeAudio } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/audio.ts";
import { hapticAt } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/reader-state.ts";
import {
  CYCLE_MS,
  LEASE_MS,
  createOtomeHaptics,
  cueCommand,
  cueTargets,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/haptics.ts";
import { normalizeBeatReply } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/beats.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeChatReply } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/replies.ts";
import { KAI, storyWorld } from "./fixtures/otome-forge-story.ts";
import {
  playerId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  beatMessages,
  chatReplyMessages,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";

type Device = { index: number; name: string; capabilities: string[] };

const LUSH: Device = { index: 0, name: "Lovense Lush 3", capabilities: ["vibrate"] };
const NORA: Device = { index: 1, name: "Lovense Nora", capabilities: ["vibrate", "rotate"] };
const KEON: Device = { index: 2, name: "Kiiroo Keon", capabilities: ["position"] };

/** The Engine's haptics as a package sees them, recording every command. */
function fakeIntiface(devices: Device[] = [LUSH, NORA, KEON], fail: Set<number> = new Set()) {
  const commands: Array<Record<string, unknown>> = [];
  let connected = true;
  const haptics = {
    status: () => ({ connected, serverUrl: null, scanning: false, devices: connected ? devices : [] }),
    connect: async () => {
      connected = true;
    },
    executeCommand: async (command: Record<string, unknown>) => {
      if (typeof command.deviceIndex === "number" && fail.has(command.deviceIndex)) throw new Error("Device dropped");
      commands.push(command);
    },
  };
  const runtime = {
    integrations: { haptics },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
  } as unknown as Parameters<typeof createOtomeHaptics>[0];
  return { runtime, commands, disconnect: () => (connected = false) };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("a reply's cues are read leniently, the whole range kept, a percentage read as one, an unknown action left out", () => {
  assert.deepEqual(
    normalizeHapticCues([
      { action: "vibrate", pattern: "wave", intensity: 1 },
      { action: "Thrust", intensity: 85, device: "Keon" },
      { action: "spin", pattern: "nonsense" },
      { action: "lick" },
      { action: "stop", device: "Lush" },
      { action: "vibrate", intensity: 0.2 },
    ]),
    [
      { action: "vibrate", pattern: "wave", intensity: 1 },
      { action: "position", pattern: "steady", intensity: 0.85, device: "Keon" },
      { action: "rotate", pattern: "steady", intensity: 0.6 },
      { action: "stop", device: "Lush" },
    ],
    "no cap: 1.0 stays 1.0; at most four cues",
  );
  assert.deepEqual(normalizeHapticCues({ action: "buzz", intensity: "0.9" }), [
    { action: "vibrate", pattern: "steady", intensity: 0.9 },
  ]);
  assert.deepEqual(normalizeHapticCues("vibrate"), []);
  assert.equal(isHapticsUrl("ws://127.0.0.1:12345"), true);
  assert.equal(isHapticsUrl("wss://toys.example.org/intiface"), true);
  assert.equal(isHapticsUrl("http://127.0.0.1:12345"), false);
  assert.equal(isHapticsUrl("ws://a b"), false);
  // The setting: off by default, an address kept only when it is one.
  assert.deepEqual([normalizeOtomeAudio({}).haptics, normalizeOtomeAudio({}).hapticsUrl], [false, ""]);
  assert.deepEqual(
    [normalizeOtomeAudio({ haptics: true, hapticsUrl: "ws://10.0.0.2:12345" }).hapticsUrl],
    ["ws://10.0.0.2:12345"],
  );
  assert.equal(normalizeOtomeAudio({ hapticsUrl: "javascript:alert(1)" }).hapticsUrl, "");
  // Only an explicit story with the setting on.
  const world = (heat: string, haptics: boolean) => ({ content: { heat }, audio: { haptics } });
  assert.deepEqual([world("explicit", true), world("fade", true), world("explicit", false)].map(hapticsOn), [
    true,
    false,
    false,
  ]);
});

test("a scene keeps a line's cues only while haptics are on, and a cue that cannot be read never costs the line", () => {
  const units = [{ id: KAI, name: "Kai Arden" }];
  const node = { i: 0, kind: "beat", guide: "Night.", cast: [KAI] } as ChapterNode;
  const context = { node, units, state: normalizeState({ lis: { [KAI]: { stage: 3 } } }), last: false };
  const reply = {
    segments: [
      { speaker: "", text: "His hand finds the small of your back.", haptic: [{ action: "vibrate", intensity: 0.3 }] },
      { speaker: "Kai", text: "Breathe.", haptic: [{ action: "nonsense" }] },
      { speaker: "", text: "Then he does not stop.", haptic: { action: "vibrate", pattern: "ramp", intensity: 1 } },
    ],
  };
  const on = normalizeBeatReply(reply, { ...context, haptics: true });
  assert.ok(typeof on === "object", String(on));
  assert.deepEqual(
    on.segments.map((segment) => segment.haptic),
    [
      [{ action: "vibrate", pattern: "steady", intensity: 0.3 }],
      undefined,
      [{ action: "vibrate", pattern: "ramp", intensity: 1 }],
    ],
  );
  assert.equal(on.segments.length, 3, "a bad cue drops itself, never its line");
  const off = normalizeBeatReply(reply, context);
  assert.ok(typeof off === "object", String(off));
  assert.ok(
    off.segments.every((segment) => segment.haptic === undefined),
    "haptics off: no cue is kept",
  );
});

test("a message drives the toys only while he holds the remote", () => {
  const names = { li: "Kai Arden", player: "Ines" };
  const raw = {
    messages: [{ text: "Hold still.", haptic: [{ action: "vibrate", pattern: "pulse", intensity: 0.7 }] }],
  };
  const held = normalizeChatReply(raw, names, [], false, true);
  assert.ok(typeof held === "object");
  assert.deepEqual(held.messages[0]!.haptic, [{ action: "vibrate", pattern: "pulse", intensity: 0.7 }]);
  const notHeld = normalizeChatReply(raw, names);
  assert.ok(typeof notHeld === "object");
  assert.equal(notHeld.messages[0]!.haptic, undefined);
});

test("a cue goes to the toy it names, else to every toy that can do it, else to each toy's own output", () => {
  const all = [LUSH, NORA, KEON];
  const names = (cue: HapticCue) => cueTargets(cue, all as never).map((device) => device.name);
  assert.deepEqual(names({ action: "vibrate" }), ["Lovense Lush 3", "Lovense Nora"]);
  assert.deepEqual(names({ action: "rotate", device: "nora" }), ["Lovense Nora"]);
  assert.deepEqual(names({ action: "position" }), ["Kiiroo Keon"]);
  assert.deepEqual(names({ action: "constrict" }), ["Lovense Lush 3", "Lovense Nora", "Kiiroo Keon"], "nobody can");
  assert.deepEqual(names({ action: "vibrate", device: "Hush" }), ["Lovense Lush 3", "Lovense Nora"], "unknown name");
  // A toy that cannot do the action takes its own; full strength goes as written; each command lasts about a cycle.
  assert.deepEqual(cueCommand({ action: "constrict", pattern: "steady", intensity: 1 }, KEON as never), {
    deviceIndex: 2,
    action: "position",
    intensity: 1,
    pattern: "steady",
    duration: CYCLE_MS / 1000 + 0.5,
  });
  assert.equal(
    cueCommand({ action: "vibrate", pattern: "wave", intensity: 1 }, LUSH as never)!.duration,
    CYCLE_MS / 1000,
  );
});

test("the loop plays every cue again each cycle until it is replaced, kept alive, or stopped; nothing is capped", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout", "Date"] });
  const toys = fakeIntiface();
  const haptics = createOtomeHaptics(toys.runtime);
  await haptics.play("run-a", [{ action: "vibrate", pattern: "wave", intensity: 1 }]);
  assert.deepEqual(
    toys.commands.map((command) => [command.deviceIndex, command.action, command.intensity, command.pattern]),
    [
      [0, "vibrate", 1, "wave"],
      [1, "vibrate", 1, "wave"],
    ],
    "both vibrators, at full strength",
  );
  assert.equal(haptics.view().playing, true);
  // It loops: the same cue again every cycle.
  toys.commands.length = 0;
  t.mock.timers.tick(CYCLE_MS);
  await settle();
  assert.equal(toys.commands.length, 2, "played again");
  // A new line replaces it, and the toy it no longer names stops.
  toys.commands.length = 0;
  await haptics.play("run-a", [{ action: "rotate", device: "Nora", intensity: 0.5 }]);
  assert.deepEqual(
    toys.commands.map((command) => [command.deviceIndex, command.action]),
    [
      [1, "rotate"],
      [0, "stop"],
    ],
  );
  // Kept alive while its line is on screen; without a keep, it ends by itself and every toy stops.
  for (let elapsed = 0; elapsed < LEASE_MS * 2; elapsed += CYCLE_MS) {
    if (elapsed < LEASE_MS) assert.equal(haptics.keep("run-a"), true);
    t.mock.timers.tick(CYCLE_MS);
    await settle();
  }
  assert.equal(haptics.view().playing, false, "the lease ran out");
  assert.deepEqual(toys.commands.at(-1), { deviceIndex: "all", action: "stop" });
  assert.equal(haptics.keep("run-a"), false, "nothing to keep");
  // Stop always ends it and stops every toy.
  await haptics.play("run-a", [{ action: "vibrate" }]);
  await haptics.stop();
  assert.equal(haptics.view().playing, false);
  assert.deepEqual(toys.commands.at(-1), { deviceIndex: "all", action: "stop" });
  // A line of stops alone ends the loop too.
  await haptics.play("run-a", [{ action: "vibrate" }]);
  await haptics.play("run-a", [{ action: "stop" }]);
  assert.equal(haptics.view().playing, false);
  haptics.dispose();
});

test("Test all pulses every connected toy at full strength and says which moved", async () => {
  const toys = fakeIntiface([LUSH, NORA, KEON], new Set([1]));
  const haptics = createOtomeHaptics(toys.runtime);
  const results = await haptics.test();
  assert.deepEqual(results, [
    { index: 0, name: "Lovense Lush 3", ok: true },
    { index: 1, name: "Lovense Nora", ok: false, error: "Device dropped" },
    { index: 2, name: "Kiiroo Keon", ok: true },
  ]);
  assert.deepEqual(
    toys.commands.map((command) => [command.deviceIndex, command.action, command.intensity, command.pattern]),
    [
      [0, "vibrate", 1, "pulse"],
      [2, "position", 1, "pulse"],
    ],
  );
  assert.deepEqual(
    haptics.devicesText().split("\n"),
    ["- Lovense Lush 3: vibrate", "- Lovense Nora: vibrate, rotate", "- Kiiroo Keon: position"],
    "the prompts name every connected toy",
  );
  toys.disconnect();
  assert.deepEqual(await haptics.test(), [], "nothing connected, nothing tested");
  assert.equal(haptics.devicesText(), "");
  haptics.dispose();
});

test("the reader plays the newest cue up to the line, from the line it is on; a line of stops plays nothing", () => {
  const line = (text: string, haptic?: HapticCue[]) => ({
    main: 0,
    kind: "segment" as const,
    segment: { speaker: "", text, ...(haptic ? { haptic } : {}) } as Segment,
  });
  const timeline = {
    lines: [
      line("He leans in."),
      line("His mouth.", [{ action: "vibrate", intensity: 0.4 }]),
      line("Slower."),
      line("Then nothing.", [{ action: "stop" }]),
      line("Again.", [{ action: "vibrate", pattern: "ramp", intensity: 1 }]),
    ],
    pending: new Map(),
  };
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((index) => hapticAt(timeline, index)?.index ?? null),
    [null, 1, 1, null, 4],
  );
});

test("the scene and message prompts carry the haptic rule only while haptics are on, the toys and the remote in the turn", async () => {
  const t = await storyWorld({ runKey: "r-haptics-aaaaaa", replies: [] });
  const [stored, player, state] = await Promise.all([
    t.store.readDoc(worldId(t.runId), normalizeWorld),
    t.store.readDoc(playerId(t.runId), normalizePlayer),
    t.state(),
  ]);
  const unit = (await t.store.readDoc(unitId(t.runId, KAI), normalizeUnit))!;
  const node = { i: 0, kind: "beat", guide: "Night.", cast: [KAI] } as ChapterNode;
  const chapter = { kind: "main", number: 1, title: "Night", lead: KAI, nodes: [node] } as Chapter;
  const world = (heat: "explicit" | "fade", haptics: boolean) =>
    ({ ...stored!, content: { ...stored!.content, heat }, audio: { ...stored!.audio, haptics } }) as World;
  const scene = (w: World, toys = "") =>
    beatMessages({
      world: w,
      player: player!,
      units: [unit],
      state: state!,
      chapter,
      node,
      storySoFar: [],
      memory: "",
      toys,
    });
  const on = scene(world("explicit", true), "- Lovense Lush 3: vibrate");
  const instructions = on.find((message) => message.content.includes("- haptic: "))?.content ?? "";
  const turn = on.at(-1)!.content;
  assert.ok(instructions.includes("- haptic: the protagonist's connected toys play the scene"), "the rule");
  assert.notEqual(instructions, turn, "in the instructions, not the task turn");
  assert.ok(instructions.includes("Intensity uses the whole range up to 1.0"), "no cap");
  assert.ok(!instructions.includes("Lovense Lush 3"), "the toys never in the cached instructions");
  assert.ok(turn.includes("THE PROTAGONIST'S TOYS, CONNECTED NOW (name: what it can do)\n- Lovense Lush 3: vibrate"));
  assert.ok(scene(world("explicit", true)).at(-1)!.content.includes("No toy is connected right now"));
  for (const off of [world("fade", true), world("explicit", false)]) {
    const text = scene(off)
      .map((message) => message.content)
      .join("\n");
    assert.ok(!text.includes('"haptic"') && !text.includes("TOYS"), "off: not a word of it");
  }
  const chat = (w: World, remote?: number) =>
    chatReplyMessages({
      world: w,
      player: player!,
      unit,
      liState: state!.lis[KAI]!,
      tail: [],
      memories: [],
      story: "",
      ...(remote ? { remote, toys: "- Lovense Lush 3: vibrate" } : {}),
    });
  const held = chat(world("explicit", true), 24);
  assert.ok(held[0]!.content.includes("The protagonist may hand you the remote of their toys"), "the rule, cached");
  assert.ok(held.at(-1)!.content.includes("has handed you the remote of their toys, for about 24 more minutes"));
  assert.ok(held.at(-1)!.content.includes("- Lovense Lush 3: vibrate"));
  assert.ok(!chat(world("explicit", true)).at(-1)!.content.includes("handed you the remote"), "not held: no remote");
  assert.ok(
    !chat(world("fade", true), 24)
      .map((message) => message.content)
      .join("\n")
      .includes("remote"),
  );
});
