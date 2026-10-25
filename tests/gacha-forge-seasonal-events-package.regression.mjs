import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createChapterRuntime,
  chapterRunId as runId,
  chapterUnitId as unitId,
  freshMainPlan,
} from "./fixtures/gacha-forge-chapter-runtime.mjs";

const directory = await mkdtemp(join(tmpdir(), "gacha-seasonal-sdk-")),
  replayPath = join(directory, "server.mjs");
await writeFile(
  replayPath,
  (await readFile(new URL("../packages/gacha-forge/server.mjs", import.meta.url), "utf8")) +
    "\nexport { Gm as replayCombat };\n",
);
const { replayCombat } = await import(pathToFileURL(replayPath).href);
const skill = {
  name: "Lighthouse strike",
  effect: "damage",
  power: 100,
  target: "enemy",
  description: "A clean strike.",
};
const guest = {
  name: "Neris",
  description: "NEW_EVENT_GUEST_DESCRIPTION",
  personality: "NEW_EVENT_GUEST_PERSONALITY",
  backstory: "NEW_EVENT_GUEST_BACKSTORY",
  appearance: "NEW_EVENT_GUEST_APPEARANCE",
};
const overview = {
  title: "The Lantern Crossing",
  theme: "A winter festival of promises.",
  premise: "Keep the coast's old promise.",
  cast: [unitId],
  newCharacter: guest,
  rewards: { funds: 6000, aether: 320, insight: 6 },
  special: "character",
  bannerPrompt: "Lanterns along a dark coast",
  musicPrompt:
    "A wistful oboe motif answers a restrained harp ostinato, with modal inner voices, a contrasting middle and a seamless instrumental loop.",
};
const guide = {
  enemy: "Clockwork sentinel",
  tier: "soldier",
  opening: "The festival's practice guard awakens.",
  objective: "Win the friendly trial.",
  outcomeOnWin: "The lantern procession continues.",
  formation: [
    {
      name: "Clockwork sentinel",
      role: "Warrior",
      affinity: "Fire",
      position: "front",
      stats: { hp: 10, atk: 10, def: 10, spd: 10 },
      skill,
      tier: "soldier",
      anonymous: true,
    },
  ],
};
const f = await createChapterRuntime();
// Exercise event generation with room for canon and the 8192-token answer floor.
f.transport.maxContext = 262144;
try {
  for (const [id] of f.docs)
    if (id.startsWith(`${runId}:chapter:2`) || id.startsWith(`${runId}:beat:2:`) || id.startsWith(`${runId}:summary:2`))
      f.docs.delete(id);
  const run = f.docs.get("index").data.runs[0];
  run.story.seasonalEvents = true;
  const session = f.session();
  session.progress = { 1: { normal: 10 } };
  delete session.reading;
  const hero = {
    ...f.docs.get(unitId).data,
    name: "Arden",
    role: "Mage",
    affinity: "Water",
    position: "front",
    stats: { hp: 100, atk: 100, def: 100, spd: 100 },
    skill,
    passive: { name: "Steady light", effect: "heal", power: 60, target: "self", trigger: "on_round" },
    appearance: "Blue coat.",
    identitySex: "male",
  };
  f.docs.get(unitId).data = hero;
  const rewardId = `${runId}:unit:beryl`;
  f.seed(rewardId, "unit", {
    ...hero,
    name: "Beryl",
    rarity: 4,
    cardId: "",
    description: "UNSEEN_BERYL_MUST_NOT_BE_KNOWN_CAST",
  });
  const leader = `${runId}:unit:protagonist`;
  f.seed(leader, "unit", { ...hero, name: "Mari", cardId: "", isProtagonist: true });
  session.roster[leader] = { level: 100, bondFights: 0 };
  session.roster[unitId].level = 100;
  session.presets = [{ name: "Fixture team", board: { front: [unitId, null, null], back: [null, null, null] } }];
  session.activePreset = 0;
  f.transport.reply = (body) => {
    const system = String(body.messages?.[0]?.content || "");
    if (system.includes("substantial, self-contained seasonal story event")) return JSON.stringify(overview);
    if (system.includes("Summarize only the supplied canonical story history"))
      return JSON.stringify({ summary: "The canonical lighthouse friendship and event procession remain true." });
    if (system.includes("You are the chapter planner for a gacha story mode"))
      return JSON.stringify({
        ...freshMainPlan,
        title: "The crossing begins",
        premise: "Friends share the festival and meet Neris.",
      });
    if (system.includes("formation") && system.includes("outcomeOnWin")) {
      const tier = /ENCOUNTER TIER: (soldier|elite|boss)/u.exec(system)?.[1] || "soldier";
      return JSON.stringify({
        ...guide,
        tier,
        formation: guide.formation.map((enemy) => ({ ...enemy, tier })),
        dialogueCues: [
          { speaker: "enemy-0", content: "Welcome to the friendly trial.", type: "main", trigger: "intro" },
          { speaker: "enemy-0", content: "The procession may continue.", type: "main", trigger: "victory" },
          { speaker: "enemy-0", content: "Rest and try the trial again.", type: "main", trigger: "defeat" },
        ],
      });
    }
    return JSON.stringify({
      segments: [{ speaker: "Arden", text: "We keep the promise together.", place: "Lighthouse" }],
      places: [{ name: "Lighthouse", tags: "night coast, lanterns" }],
      choices: [],
    });
  };
  const post = async (path, body = {}) => {
    const response = await fetch(f.origin + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId, timeZone: "Europe/Warsaw", ...body }),
    });
    return { status: response.status, body: await response.json() };
  };
  let result = await post("/story-events");
  assert.equal(result.body.ok, true, JSON.stringify(result));
  assert.ok(Number.isFinite(result.body.serverNow) && result.body.serverNow > 0);
  assert.equal(
    f.calls.filter((call) => call.body.messages?.[0]?.content.includes("SEASONAL EVENT:")).length,
    0,
    "Overview must precede opt-in story generation",
  );
  const overviewRequest = f.calls.find((call) =>
    call.body.messages?.[0]?.content.includes("substantial, self-contained"),
  );
  assert.ok(overviewRequest);
  assert.doesNotMatch(JSON.stringify(overviewRequest.body), /UNSEEN_BERYL|DISALLOWED_CARD_SCENARIO/u);
  assert.match(JSON.stringify(overviewRequest.body), /CURRENT_AUTHORED_CARD_CANON/u);
  const event = result.body.events[0];
  assert.equal(event.chapter, "event-1");
  assert.equal(event.rewards.find((reward) => reward.kind === "character").unitId, rewardId);
  result = await post("/story-event/plan", { chapter: event.chapter });
  assert.equal(result.body.ok, true, JSON.stringify(result));
  assert.equal(result.body.plan.nodes.filter((node) => node.type === "combat").length, 3);
  const revision = result.body.storyRevision;
  assert.equal((await post("/chapter-plan", { chapter: 2 })).body.error, "story-event-open");
  assert.equal(
    (await post("/story-event/start", { chapter: event.chapter, storyIndex: 0, storyRevision: revision + 1 })).body
      .error,
    "story-changed",
  );
  let storyIndex = 0,
    combatIndex = 0;
  const startFunds = f.session().wallet.funds,
    startAether = f.session().wallet.aether;
  for (const [nodeIndex, node] of result.body.plan.nodes.entries()) {
    const body = { chapter: event.chapter, storyRevision: revision };
    if (node.type === "story") {
      const started = await post("/story-event/start", { ...body, storyIndex });
      assert.equal(started.body.ok, true, JSON.stringify(started));
      const beat = await post("/story-event/beat", { ...body, storyIndex });
      assert.equal(beat.body.ok, true, JSON.stringify(beat));
      assert.equal(beat.body.segments[0].text, "We keep the promise together.");
      const sent = f.calls.findLast((call) =>
        call.body.messages?.some((message) => String(message.content).includes("SEASONAL EVENT CHARACTER CANON")),
      );
      assert.ok(sent);
      assert.match(JSON.stringify(sent.body), /NEW_EVENT_GUEST_BACKSTORY/u);
      assert.match(JSON.stringify(sent.body), /NEW_EVENT_GUEST_APPEARANCE/u);
      assert.doesNotMatch(JSON.stringify(sent.body), /DISALLOWED_CARD_SCENARIO/u);
      const complete = await post("/story-event/complete", { ...body, nodeIndex });
      assert.equal(complete.body.ok, true, JSON.stringify(complete));
      storyIndex++;
    } else {
      const ready = await post("/story-event/battle", { ...body, combatIndex });
      assert.equal(ready.body.ok, true, JSON.stringify(ready));
      assert.ok(ready.body.allies.length && ready.body.enemies.length);
      const started = await post("/story-event/battle/start", { ...body, combatIndex });
      assert.equal(started.body.ok, true, JSON.stringify(started));
      const packet = structuredClone(f.session().combatPending.fight),
        replay = replayCombat(packet, []);
      assert.equal(replay.result, "win", "Strong fixture team wins actual deterministic combat");
      const complete = await post("/story-event/complete", { ...body, nodeIndex, log: replay.log });
      assert.equal(complete.body.ok, true, JSON.stringify(complete));
      combatIndex++;
    }
  }
  assert.equal(f.session().progress[event.chapter].normal, 10);
  assert.equal(f.session().wallet.funds, startFunds + 6000);
  assert.equal(f.session().wallet.aether, startAether + 320);
  assert.ok(f.session().roster[rewardId], "The prepared four-star character is actually claimed");
  const before = structuredClone(f.session());
  assert.equal(
    (await post("/story-event/complete", { chapter: event.chapter, nodeIndex: 9, storyRevision: revision })).body
      .cached,
    true,
  );
  assert.deepEqual(f.session(), before, "Replay cannot grant rewards again");
  const next = await post("/chapter-plan", { chapter: 2, storyRevision: revision });
  assert.equal(next.body.ok, true, JSON.stringify(next));
  assert.ok(
    [...f.docs.values()]
      .find((row) => row.id === `${runId}:summary:memory`)
      ?.data.records?.some((record) => record.kind === "story-event"),
    "Completed events enter canonical story memory",
  );
  // Controlled prepainted gallery data exercises the actual outfit grant without paid image generation.
  const eventDoc = f.docs.get(`${runId}:story-event:1`),
    outfitId = `outfit:story-event:2:${unitId}`;
  f.seed(`${runId}:story-event:2`, "story-event", {
    ...structuredClone(eventDoc.data),
    seq: 2,
    chapter: "event-2",
    after: 1,
    opened: Date.now(),
    rewards: [
      {
        nodeIndex: 9,
        kind: "outfit",
        unitId,
        qty: 1,
        name: "Lantern coat",
        outfit: {
          id: outfitId,
          themeKey: "story-event:2",
          name: "Lantern coat",
          prompt: "A blue festival coat",
          url: "fixture://controlled-outfit",
          ref: "global-gallery:fixture-event-outfit",
          history: [],
        },
      },
    ],
  });
  f.seed(`${runId}:chapter:event-2`, "chapter-plan", {
    ...freshMainPlan,
    chapter: "event-2",
    eventId: `${runId}:story-event:2`,
    after: 1,
    opened: Date.now(),
  });
  f.seed(`${runId}:beat:event-2:6`, "beat", {
    chapter: "event-2",
    storyIndex: 6,
    segments: [{ text: "The second festival closes." }],
  });
  f.session().progress["event-2"] = { normal: 9 };
  f.faults.updateId = unitId;
  const beforeRollback = structuredClone(f.docs);
  const failedOutfit = await post("/story-event/complete", {
    chapter: "event-2",
    nodeIndex: 9,
    storyRevision: revision,
  });
  assert.equal(failedOutfit.status, 500);
  assert.match(failedOutfit.body.error, /write-conflict/u);
  assert.deepEqual(f.docs, beforeRollback, "A mid-grant conflict rolls back outfit and progress together");
  f.faults.updateId = "";
  assert.equal(
    (await post("/story-event/complete", { chapter: "event-2", nodeIndex: 9, storyRevision: revision })).body.ok,
    true,
  );
  assert.equal(f.docs.get(unitId).data.outfits.filter((outfit) => outfit.id === outfitId).length, 1);
  assert.equal(
    (await post("/story-event/complete", { chapter: "event-2", nodeIndex: 9, storyRevision: revision })).body.cached,
    true,
  );
  assert.equal(f.docs.get(unitId).data.outfits.filter((outfit) => outfit.id === outfitId).length, 1);
  run.story.seasonalEvents = false;
  assert.equal(
    (await post("/story-event/beat", { chapter: event.chapter, storyIndex: 0, storyRevision: revision })).body.ok,
    true,
    "Played scenes remain readable after opt-out",
  );
  const animation = await post("/banner-animation", { banner: "char-standard" });
  assert.equal(animation.body.error, "animations-off", "Timezone metadata reaches the same real animation path");
  const unknown = await post("/banner-animation", { banner: "char-standard", unknown: true });
  assert.equal(unknown.body.error, "bad-request");
  assert.equal(f.errors.length, 1, JSON.stringify(f.errors));
  assert.match(f.errors[0].message, /story-event-write-conflict/u);
  console.log(
    "Actual seasonal SDK/HTTP overview, opt-in, authored/guest canon, story/combat, four-star rewards, replay, version fencing and animation metadata regressions passed.",
  );
} catch (error) {
  await writeFile(
    join(tmpdir(), "marinara-seasonal-sdk-last-failure.json"),
    JSON.stringify({ error: String(error), calls: f.calls, errors: f.errors, logs: f.logs }, null, 2),
  );
  throw error;
} finally {
  await f.close();
  await rm(directory, { recursive: true, force: true });
}
