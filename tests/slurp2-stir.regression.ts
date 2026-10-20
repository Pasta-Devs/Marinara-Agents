/**
 * W — Stir: one lever system over the action layer. The action layer v2 (every action has its Stir
 * metadata and a preview), previews write nothing, the planner's answer becomes cards, "Do it" runs
 * exactly the steps the player saw, work plays can be refused while love and drama always happen,
 * Slurp Support proposes Stir cards instead of changing the Creator at once, "In play" and the
 * suggestions, the "Plans" budget row, and the wiring (routes, Mari's preview, the client).
 */
import assert from "node:assert/strict";
import {
  SLP_ACTION_META,
  SLP_ACTION_NAMES,
  SLP_ACTIONS,
  SLP_STIR_CATEGORIES,
  slpActionCatalog,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-actions.ts";
import { slpStirPlaySchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-stir.ts";
import {
  SLURP_MODEL_JOB_KINDS,
  slurpModelBudgetSchema,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-model-budget.ts";
import {
  SLP_DEFAULT_STEERING,
  type SlpCreatorSteering,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-creator-steering.ts";
import { SLURP_SUPPORT_ACCOUNT_ID } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-support.ts";
import {
  SLURP_NO_TIES,
  type SlurpTieCreator,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-ties.ts";
import { newSlurpCouple } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-couples.ts";
import {
  SLURP_TIE_LEVERS,
  slurpPreviewTieLever,
  slurpSuggestCollabPlay,
  type SlurpStirTieWorld,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-stir-tie-preview.ts";
import {
  buildSlpStirPlanMessages,
  readSlpStirPlanAnswer,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/assist/slp-stir-plan.ts";
import {
  slpRunStirSteps,
  slpSortStirSteps,
  slpSupportPlayOnce,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/assist/slp-stir-play.ts";
import {
  slpStirLive,
  slpStirSuggestions,
  type SlpStirLiveInput,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/assist/slp-stir-live.ts";
import {
  applySlurpSupportTalk,
  readSlurpSupportTakeaway,
  type SlurpSupportProposal,
  type SlurpSupportTalkStore,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-support.ts";
import { slurp2Source } from "./slurp2-source.ts";

const client = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/client/src/slp/${path}`);
const server = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/server/src/slp/${path}`);
const shared = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/shared/src/slp/${path}`);

const creator = (id: string, text: string, tags: string[], extra: Partial<SlurpTieCreator> = {}): SlurpTieCreator => ({
  id,
  name: id[0]!.toUpperCase() + id.slice(1),
  text,
  tags,
  automatic: true,
  followers: 1000,
  ...extra,
});
const mira = creator("mira", "Climbing coach. Sassy and outspoken. Lives for bouldering and gym training.", [
  "fitness",
]);
const kai = creator("kai", "Tattoo artist. Calm and quiet. Loves horror films.", ["art"]);
const rue = creator("rue", "Yoga teacher who loves the gym. She would never do collabs with other creators.", [
  "fitness",
]);
const noor = creator("noor", "Baker. Married to Sam, her husband of ten years.", ["food"], { cardPartners: ["Sam"] });
const me = creator("me", "Gym girl who loves lifting.", ["fitness"], { automatic: false });
const AT = new Date("2026-10-01T12:00:00Z");

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const inner of Object.values(value as Record<string, unknown>)) deepFreeze(inner);
  }
  return value;
}

const world = (extra: Partial<SlurpStirTieWorld> = {}): SlurpStirTieWorld =>
  deepFreeze({
    creators: [mira, kai, rue, noor, me],
    avatars: new Map([["mira", "/m.png"]]),
    ties: structuredClone(SLURP_NO_TIES),
    couples: [],
    ...extra,
  });

async function main() {
  // --- 1. Action layer v2: every action has Stir metadata, a preview and a runner case ------------
  for (const name of SLP_ACTION_NAMES) {
    const meta = SLP_ACTION_META[name];
    assert.ok(meta, `${name}: metadata`);
    // "desk": the Support desk's tools (0.3.5), used from the desk and Support threads, not the deck.
    assert.ok(
      meta.category === "help" || meta.category === "desk" || SLP_STIR_CATEGORIES.includes(meta.category),
      `${name}: a deck category`,
    );
    assert.ok(SLP_ACTIONS[name].summary.length <= 300, `${name}: a summary Professor Mari accepts`);
  }
  for (const entry of slpActionCatalog()) {
    assert.equal(typeof entry.deck, "boolean", "the catalog carries the Stir metadata");
    assert.doesNotMatch(JSON.stringify(entry), /schema|zod/iu, "and no schema objects");
  }
  assert.ok(slpActionCatalog().length <= 50, "within the Engine's Mari catalog limit");
  const deck = SLP_ACTION_NAMES.filter((name) => SLP_ACTION_META[name].deck);
  assert.deepEqual(
    [...deck].sort(),
    [
      "add-idea",
      // 0.3.5: polyamory's card (shown only with the setting on).
      "add-to-couple",
      "cool-rivalry",
      "couple-page",
      // 0.3.1: new levers over systems that already existed.
      "invent-event",
      "new-look",
      // Merge R × W (on purpose): R's brand deal lever is a work card now, no longer "soon".
      "offer-brand-deal",
      "push-collab",
      "run-audience",
      // 0.3.11: bonds and drama packs.
      "set-bond",
      "set-spice",
      "set-tip-goal",
      "set-up-couple",
      "start-drama",
      "start-event",
      "start-rivalry",
      "start-storyline",
      // 0.3.44: trends.
      "start-trend",
      "steer-couple",
      "steer-creator",
      "steer-storyline",
      "steer-trend",
      "suggest-collab",
      "write-post",
    ],
    "the deck: every lever that used to be a button somewhere, plus a rivalry to start",
  );
  for (const category of SLP_STIR_CATEGORIES)
    assert.ok(
      deck.some((name) => SLP_ACTION_META[name].category === category),
      `${category} has cards`,
    );
  // Work can be refused; love and drama always happen (W default).
  assert.equal(SLP_ACTION_META["suggest-collab"].refusable, true);
  for (const name of ["set-up-couple", "steer-couple", "start-rivalry"] as const)
    assert.equal(SLP_ACTION_META[name].refusable, false, `${name} always happens`);
  const preview = server("features/assist/slp-action-preview.ts");
  const tiePreview = server("modules/projects/slp-stir-tie-preview.ts");
  const runner = server("features/assist/slp-action-runner.ts");
  // The Support desk's levers (0.3.5) preview and run in their own file, like the tie levers.
  const deskLevers = server("features/assist/slp-desk-levers.ts");
  const isDesk = (name: string) => SLP_ACTION_META[name as keyof typeof SLP_ACTION_META].category === "desk";
  // 0.3.11: drama packs preview and run in their own file too.
  const dramaLevers = server("features/world/slp-drama-levers.ts");
  for (const name of SLP_ACTION_NAMES) {
    const tie = (SLURP_TIE_LEVERS as readonly string[]).includes(name);
    const drama = name === "start-drama" || name === "end-drama";
    const source = tie ? tiePreview : drama ? dramaLevers : isDesk(name) ? deskLevers : preview;
    if (isDesk(name) && name === "seed-trend")
      assert.match(source, /if \(name === "seed-trend"\)/u, `${name}: has a preview`);
    else assert.match(source, new RegExp(`case "${name}"`, "u"), `${name}: has a preview`);
  }
  for (const name of SLP_ACTION_NAMES.filter((entry) => !(SLURP_TIE_LEVERS as readonly string[]).includes(entry)))
    if (isDesk(name))
      assert.match(deskLevers, new RegExp(`case "${name}"|name === "${name}"`, "u"), `${name}: the desk runs it`);
    else if (name === "start-drama" || name === "end-drama")
      assert.match(dramaLevers, new RegExp(`case "${name}":\\s+return`, "u"), `${name}: the drama levers run it`);
    else assert.match(runner, new RegExp(`case "${name}"`, "u"), `${name}: the runner dispatches it`);
  assert.match(runner, /if \(isSlpDeskLever\(name\)\) return runSlpDeskLever\(db, name, input\)/u, "desk levers too");
  // 0.3.7: Slurp coins (a perk, a challenge reward, a contract bonus) never go to a page the player
  // runs: its earnings pay out into the player's own wallet. The run, the preview and the desk tick agree.
  assert.match(deskLevers, /\(name === "grant-perk" && ask\.perk === "coins"\)/u);
  assert.match(deskLevers, /\(name === "set-challenge" && ask\.reward\?\.perk === "coins"\)/u);
  assert.match(deskLevers, /\(name === "offer-contract" && \(ask\.weeklyBonus \?\? 0\) > 0\)/u);
  assert.match(deskLevers, /if \(deskPaysOwnPage\(name, raw, creator\)\)/u, "the run refuses");
  assert.match(deskLevers, /: deskPaysOwnPage\(name, input, account\)\s*\? "ownPageCoins"/u, "the preview refuses");
  const deskTick = server("features/messages/desk/slp-desk-tick-operation.ts");
  assert.match(deskTick, /event\.challenge\.reward\.kind === "coins" && paysCoins/u);
  assert.match(deskTick, /event\.contract\.weeklyBonus > 0 && paysCoins/u);
  assert.match(runner, /if \(isSlurpTieLever\(name\)\) \{\s+const ran = await runSlurpTieLever/u, "tie levers too");
  assert.match(runner, /preview: \(name: string, input: unknown\) => previewSlpAction\(db, name, input\)/u);
  assert.match(
    SLP_ACTIONS["steer-storyline"].summary + JSON.stringify(SLP_ACTIONS["steer-storyline"].inputs),
    /insert.*label/su,
  );

  // --- 2. A preview writes nothing ----------------------------------------------------------------
  // The pure previews run the rules on a frozen world: a write would throw.
  const frozen = world();
  const before = JSON.stringify({ ties: frozen.ties, couples: frozen.couples });
  for (const [name, input] of [
    ["suggest-collab", { aId: "mira", bId: "kai", happen: false }],
    ["start-rivalry", { fromId: "mira", toId: "kai" }],
    ["set-up-couple", { aId: "mira", bId: "kai" }],
    ["push-collab", { collabId: "nope" }],
    ["cool-rivalry", { rivalryId: "nope" }],
    ["steer-couple", { coupleId: "nope", steer: "date" }],
    ["couple-page", { coupleId: "nope", open: true }],
  ] as const)
    slurpPreviewTieLever(frozen, name, input, AT);
  assert.equal(JSON.stringify({ ties: frozen.ties, couples: frozen.couples }), before, "the world is unchanged");
  // The I/O previews read and never write: no write call anywhere in the preview path.
  for (const source of [preview, tiePreview])
    assert.doesNotMatch(
      source,
      /mutate|\.set\(|patchSlurp|addSlurp|removeSlurp|startStoryEvent|setStoryOccurrenceStatus|directProject|updateSlurp|runCreatorFanActivity|generateAndApply|claimSlurpModelBudget|chatComplete/u,
      "a preview never writes and never calls the AI",
    );
  assert.match(
    server("features/projects/slp-stir-ties.ts"),
    /return slurpPreviewTieLever\(await readWorld\(db\), name, input, at\);/u,
  );

  // --- 3. Work can be refused in character; love and drama always happen -------------------------
  {
    const asked = slurpPreviewTieLever(world(), "suggest-collab", { aId: "mira", bId: "rue", happen: false }, AT);
    assert.equal(asked.error, null);
    assert.equal(asked.when, "nextLook", "the one asked answers at the next look");
    assert.deepEqual(asked.notes, [{ kind: "noCollabs", name: "Rue" }], "Rue's card says no collabs: she may say no");
    const forced = slurpPreviewTieLever(world(), "suggest-collab", { aId: "mira", bId: "rue", happen: true }, AT);
    assert.deepEqual(forced.notes, [], "make it happen: no refusal note");
    assert.equal(forced.when, "now");
    const offBrand = slurpPreviewTieLever(world(), "suggest-collab", { aId: "kai", bId: "noor", happen: false }, AT);
    assert.equal(offBrand.notes[0]?.kind, "mayDecline", "no shared niche: they may say no");
    // The play itself: without the switch the request waits for an answer, with it they agree now.
    const waits = slurpSuggestCollabPlay(SLURP_NO_TIES, mira, rue, { at: AT, id: "c1", happen: false });
    assert.ok(typeof waits !== "string" && waits.collabs[0]!.status === "asked");
    const agreed = slurpSuggestCollabPlay(SLURP_NO_TIES, mira, rue, { at: AT, id: "c1", happen: true });
    assert.ok(typeof agreed !== "string" && agreed.collabs[0]!.status === "agreed");
    const ownPage = slurpSuggestCollabPlay(SLURP_NO_TIES, mira, me, { at: AT, id: "c2", happen: false });
    assert.ok(
      typeof ownPage !== "string" && ownPage.collabs[0]!.status === "agreed",
      "your own page said yes by asking",
    );

    // Love always happens: against Noor's card (married) it still starts, and the card colours it.
    const love = slurpPreviewTieLever(world(), "set-up-couple", { aId: "kai", bId: "noor" }, AT);
    assert.equal(love.error, null, "set up against a card: it happens");
    assert.deepEqual(love.notes, [{ kind: "complicated", name: "Noor" }]);
    const busy = slurpPreviewTieLever(
      world({ couples: [newSlurpCouple("k1", "kai", "mira", "player", AT.toISOString(), "dating")] }),
      "set-up-couple",
      { aId: "kai", bId: "rue" },
      AT,
    );
    assert.equal(busy.error, "busy", "someone already seeing someone on Slurp is the one hard stop");
    // Drama always happens: Kai has no fire in him, the rivalry still starts, the card colours it.
    const drama = slurpPreviewTieLever(world(), "start-rivalry", { fromId: "kai", toId: "mira" }, AT);
    assert.equal(drama.error, null);
    assert.deepEqual(drama.notes, [{ kind: "notDramatic", name: "Kai" }]);
    assert.equal(typeof drama.detail.cause, "string", "a cause from the world's list when none is given");
    assert.equal(
      slurpPreviewTieLever(world(), "start-rivalry", { fromId: "me", toId: "mira" }, AT).error,
      "noHost",
      "someone Slurp posts for throws the shade",
    );
    const couple = newSlurpCouple("k1", "kai", "mira", "player", AT.toISOString(), "dating");
    const date = slurpPreviewTieLever(
      world({ couples: [couple] }),
      "steer-couple",
      { coupleId: "k1", steer: "date" },
      AT,
    );
    assert.deepEqual(
      date.who.map((entry) => entry.id),
      ["kai", "mira"],
    );
    assert.equal(date.who[1]!.avatarUrl, "/m.png", "cards show the real avatars");
    assert.equal(
      slurpPreviewTieLever(world({ couples: [couple] }), "steer-couple", { coupleId: "k1", steer: "patchUp" }, AT)
        .error,
      "notOpen",
      "only a rocky couple can patch it up",
    );
  }

  // --- 4. Plain words → plan → cards ---------------------------------------------------------------
  {
    const messages = buildSlpStirPlanMessages({
      text: "make Mira and Kai flirt this week",
      creators: [
        { id: "mira", name: "Mira", handle: "mira", automatic: true },
        { id: "kai", name: "Kai", handle: "kai", automatic: true },
      ],
      world: {
        couples: [],
        collabs: [],
        rivalries: [],
        events: [{ id: "slurpcon", name: "SlurpCon", running: false }],
        storylines: [],
      },
      about: { id: "mira", name: "Mira" },
      post: null,
    });
    const system = messages[0]!.content;
    const user = messages[1]!.content;
    assert.match(system, /Answer with JSON only/u);
    assert.match(system, /never invent one/u);
    // Merge R × W (on purpose): brand deals are a real lever now; the planner is told how to name one.
    assert.match(system, /offer-brand-deal/u, "the planner knows how a brand deal names its brand");
    assert.match(user, /- offer-brand-deal: /u, "brand deals are offered like every deck lever");
    assert.match(user, /- set-up-couple: /u, "deck levers are offered");
    assert.doesNotMatch(user, /- write-text: |- draw-picture: /u, "writing help and pictures are not plays");
    assert.match(user, /- mira: Mira \(@mira\)/u);
    assert.match(user, /# In focus\nmira: Mira/u);
    assert.match(user, /slurpcon: SlurpCon/u);
    assert.ok(user.trimEnd().endsWith("make Mira and Kai flirt this week"), "the player's words come last, quoted");

    const answer = readSlpStirPlanAnswer(
      '<think>hm</think>```json\n{"steps":[{"action":"set-up-couple","input":{"aId":"mira","bId":"kai"},"why":"flirt"},' +
        '{"action":"offer-brand-deal","input":{"accountId":"mira"}},{"action":"write-text","input":{"field":"bio"}},' +
        '{"action":"make-it-rain","input":{}}],"question":null,"cant":["Frogs cannot rain yet."]}\n```',
    );
    assert.ok(answer);
    assert.equal(answer.steps.length, 4);
    assert.deepEqual(answer.cant, ["Frogs cannot rain yet."]);
    const sorted = slpSortStirSteps(answer.steps);
    // Merge R × W (on purpose): the brand deal step is a play now, not a "soon" line.
    assert.deepEqual(sorted.plays, [
      { action: "set-up-couple", input: { aId: "mira", bId: "kai" } },
      { action: "offer-brand-deal", input: { accountId: "mira" } },
    ]);
    assert.deepEqual(
      sorted.cant,
      ["slp-stir:unknown:write-text", "slp-stir:unknown:make-it-rain"],
      "a step that is no play is said by the app, in the player's language",
    );
    // The desk opens its tools in the Stir play sheet: a desk step is a play, never "unknown" (0.3.6).
    assert.deepEqual(slpSortStirSteps([{ action: "grant-perk", input: { accountId: "mira" } }]).plays, [
      { action: "grant-perk", input: { accountId: "mira" } },
    ]);
    // The plan's one card is the preview of that step.
    const card = slurpPreviewTieLever(world(), "set-up-couple", sorted.plays[0]!.input, AT);
    assert.equal(card.error, null);
    assert.deepEqual(
      card.who.map((entry) => entry.name),
      ["Mira", "Kai"],
    );
    assert.equal(readSlpStirPlanAnswer("I think they should flirt!"), null, "no JSON: no plan, never a crash");
    assert.deepEqual(readSlpStirPlanAnswer('{"steps":[],"question":"Which Lena?"}')?.question, "Which Lena?");
    const service = server("features/assist/slp-stir-service.ts");
    // 0.3.6: the player's plan is off the budget; a Creator's DM proposal (world) is on the Plans row.
    assert.match(
      service,
      /origin === "world" && !\(await claimSlurpModelBudget\(db, settings\.modelBudget, "plan"\)\)/u,
    );
    assert.match(
      server("features/assist/slp-stir-routes.ts"),
      /creatorBelongsToViewer\(account as never, viewer\) : undefined,\s+"player",/u,
    );
    assert.match(service, /Plans need your AI connection\. The cards still work\./u);
    assert.match(
      service,
      /const \{ cards, cant \} = await previewSlpStirSteps\(db, answer\.steps\);/u,
      "every step previewed",
    );
  }

  // --- 5. "Do it" runs exactly the previewed steps --------------------------------------------------
  {
    const calls: { action: string; input: Record<string, unknown> }[] = [];
    const steps = [
      { action: "set-up-couple", input: { aId: "mira", bId: "kai" } },
      { action: "write-text", input: { field: "bio" } },
      { action: "add-idea", input: { accountId: "mira", text: "A flirty Story about Kai" } },
      { action: "start-rivalry", input: { fromId: "kai", toId: "rue" } },
    ];
    const played = await slpRunStirSteps<string>(steps, async (action, input) => {
      calls.push({ action, input });
      if (action === "add-idea") return { ok: false, error: "That is plenty of ideas for now." };
      return { ok: true, value: { action }, undo: action === "set-up-couple" ? "undo-couple" : null };
    });
    assert.deepEqual(
      calls,
      [steps[0], steps[2], steps[3]],
      "each play once, in order, with the input the player saw; writing help never runs as a play",
    );
    assert.deepEqual(
      played.steps.map((step) => [step.action, step.ok]),
      [
        ["set-up-couple", true],
        ["write-text", false],
        ["add-idea", false],
        ["start-rivalry", true],
      ],
      "a failing step does not stop the others, and every step is reported",
    );
    assert.deepEqual(played.undo, ["undo-couple"], "Undo holds only what ran and can be taken back");
    assert.equal(slpStirPlaySchema.safeParse({ steps: [] }).success, false, "a play has at least one step");
    assert.equal(
      slpStirPlaySchema.safeParse({ steps: Array.from({ length: 9 }, () => steps[0]) }).success,
      false,
      "and at most eight",
    );
    const service = server("features/assist/slp-stir-service.ts");
    assert.match(
      service,
      /slpRunStirSteps<SlpActionUndo>\(input\.steps, \(action, stepInput\) =>\s+runSlpActionWithUndo\(db, action, stepInput\)/u,
    );
    assert.match(
      service,
      /for \(const entry of \[\.\.\.claimed\.undo\]\.reverse\(\)\) \{\s+const done = await undoSlpAction/u,
      "Undo newest first, after the play is claimed",
    );
  }

  // --- 6. Slurp Support proposes Stir cards; nothing changes before "Do it" -----------------------
  {
    const writes: string[] = [];
    const proposals: { id: string; proposal: SlurpSupportProposal }[] = [];
    const steering: SlpCreatorSteering = { ...SLP_DEFAULT_STEERING, mood: "cozy", push: ["gym"] };
    const store: SlurpSupportTalkStore<null> = {
      recordThreadOutcome: async (threadId) => void writes.push(`thread:${threadId}`),
      readSteering: async () => steering,
      propose: async (id, proposal) => {
        writes.push(`propose:${id}`);
        proposals.push({ id, proposal });
      },
      hasMemory: async () => false,
      addMemory: async (creatorAccountId) => void writes.push(`memory:${creatorAccountId}`),
    };
    const talk = {
      thread: { id: "support-mira", viewerAccountId: SLURP_SUPPORT_ACCOUNT_ID, creatorAccountId: "mira" },
      trigger: { id: "s1", content: "Could you and Kai do a collab? Also travel posts do well." },
      reply: { id: "r1" },
      outcome: null,
      staff: {
        mood: "restless",
        focus: "travel",
        idea: "Airport outfit",
        more: "trips",
        less: null,
        takeaway: "Slurp Support told me travel does well.",
        stir: "a collab with Kai",
      },
      supportName: "Slurp Support",
    };
    await applySlurpSupportTalk(store, talk);
    assert.deepEqual(writes, ["thread:support-mira", "memory:mira", "propose:r1"], "only the memory is kept at once");
    assert.deepEqual(proposals[0], {
      id: "r1",
      proposal: {
        steps: [
          {
            action: "steer-creator",
            input: { accountId: "mira", mood: "restless", focus: "travel", push: ["gym", "trips"], avoid: [] },
          },
          { action: "add-idea", input: { accountId: "mira", text: "Airport outfit" } },
        ],
        stir: "a collab with Kai",
      },
    });
    assert.equal(steering.mood, "cozy", "the steering is untouched until the player confirms");
    // A fan's thread is refused outright.
    writes.length = 0;
    await applySlurpSupportTalk(store, { ...talk, thread: { ...talk.thread, viewerAccountId: "persona-ben" } });
    assert.deepEqual(writes, []);
    // Only a wish: still a proposal (planned by the server into cards).
    assert.equal(readSlurpSupportTakeaway({ stir: "set me up with Kai" })?.stir, "set me up with Kai");
    const operation = server("features/messages/slp-message-operation.ts");
    assert.match(operation, /planSlpStir\(db, \{ text: proposal\.stir, creatorId: creator\.id \}\)/u);
    assert.match(operation, /stirProposal: \{\s+steps: \[\.\.\.proposal\.steps, \.\.\.extra\],/u);
    assert.match(
      server("modules/messages/slp-dm-roles.ts"),
      /"stir": when \$\{viewer\} asks for something beyond you/u,
    );
    assert.match(server("base/prompting/slp-response-format.ts"), /"takeaway", "stir"\]/u);
    const routes = server("features/assist/slp-stir-routes.ts");
    assert.match(routes, /if \(supportMessageId\)\s+await markSupportPlayed/u, "a played plan shows as played");
  }

  // --- 7. "In play" and the suggestions (code only) -------------------------------------------------
  {
    const input: SlpStirLiveInput = {
      at: AT,
      creators: [
        {
          id: "mira",
          name: "Mira",
          avatarUrl: null,
          automatic: true,
          lastPostAt: AT.toISOString(),
          pace: "usual",
          ideas: 2,
        },
        {
          id: "kai",
          name: "Kai",
          avatarUrl: null,
          automatic: true,
          lastPostAt: "2026-09-20T12:00:00Z",
          pace: "usual",
          ideas: 0,
        },
        { id: "rue", name: "Rue", avatarUrl: null, automatic: true, lastPostAt: null, pace: "break", ideas: 0 },
      ],
      couples: [
        { id: "k1", aId: "mira", bId: "kai", stage: "rocky", stageAt: AT.toISOString() },
        { id: "k2", aId: "rue", bId: "noor", stage: "split", stageAt: AT.toISOString() },
      ],
      collabs: [{ id: "c1", hostId: "mira", partnerId: "rue", status: "agreed", dropAt: "2026-10-02T19:00:00Z" }],
      rivalries: [],
      events: [
        { id: "slurpcon", name: "SlurpCon", running: true, endsAt: "2026-10-04T00:00:00Z" },
        { id: "awards", name: "The Slurpies", running: false, endsAt: null },
      ],
      owed: [],
      firstVisit: false,
    };
    const live = slpStirLive(input);
    assert.deepEqual(
      live.map((entry) => entry.id),
      ["event:slurpcon", "couple:k1", "collab:c1", "pace:rue", "ideas:mira"],
      "running events, couples, collabs, breaks and queued ideas; no split couple",
    );
    const suggestions = slpStirSuggestions(input);
    assert.ok(suggestions.length <= 3);
    assert.deepEqual(suggestions[0]?.step, { action: "steer-couple", input: { coupleId: "k1", steer: "patchUp" } });
    assert.ok(
      suggestions.some((entry) => entry.kind === "quiet" && entry.who[0]?.id === "kai"),
      "Kai has been quiet for 11 days; Rue is on a break, so she is left alone",
    );
    const first = slpStirSuggestions({ ...input, couples: [], firstVisit: true, owed: [] });
    assert.equal(first[0]?.kind, "firstPlay", "the first visit starts with one pair to set up");
    assert.deepEqual(first[0]?.step, { action: "set-up-couple", input: { aId: "mira", bId: "kai" } });
    assert.doesNotMatch(server("modules/assist/slp-stir-live.ts"), /chatComplete|claimSlurpModelBudget/u);
  }

  // --- 8. The "Plans" budget row ------------------------------------------------------------------
  assert.ok(SLURP_MODEL_JOB_KINDS.includes("plan"));
  const budget = slurpModelBudgetSchema.parse({});
  assert.equal(budget.jobs.plan.maxPerDay, 20);
  const oldSaved = slurpModelBudgetSchema.parse({ jobs: { dm_reply: { enabled: true, priority: 1, maxPerDay: 40 } } });
  assert.equal(oldSaved.jobs.plan.maxPerDay, 20, "a budget saved before W gets the row");
  assert.match(client("locales/en.json"), /"ui\.slurp\.settings\.aiBudget\.job\.plan": "Plans"/u);

  // --- 9. The client: three ways in, one preview, one "Do it" ------------------------------------
  {
    const shell = client("modules/chrome/SlpShell.tsx");
    // Release 0.3.0 (user): the last tab is "More" again (it opens the More sheet with the own page and
    // its Dashboard); the spoon is a plain nav glyph, no pink disc. Studio stays gone.
    const tabs = shell.slice(shell.indexOf("Hub · Discover · Stir · Inbox · More"));
    const order = [
      "onMobileHomeTap",
      "onOpenSearch",
      "onOpenStir",
      "onOpenMessages",
      "() => onMobileDrawerOpenChange(true)",
    ].map((name) => tabs.indexOf(`onClick={${name}`));
    assert.ok(
      order.every((at, index) => at > 0 && (index === 0 || at > order[index - 1]!)),
      "Hub · Discover · Stir · Inbox · More",
    );
    assert.match(
      shell,
      /localizeUi\("ui\.slurp\.navigation\.more", \{ defaultValue: "More" \}\)/u,
      "Me became More again",
    );
    assert.doesNotMatch(shell, /onOpenStudio/u, "no Studio row left");
    // The user's call: Stir has its own spoon glyph (Slurp's glyph set, not a library icon).
    assert.match(client("base/chrome/SlpGlyphs.tsx"), /export const SlpStirGlyph = slpGlyph\("Stir"/u);
    assert.match(
      shell,
      /<SlpStirGlyph size=\{20\} filled=\{activeView === "stir"\} \/>/u,
      "the Stir tab wears the spoon",
    );
    // The deck is fed from the catalog, never hand-built.
    const deck = client("features/stir/slp-stir-deck.ts");
    assert.match(deck, /SLP_ACTION_NAMES\.filter\(\(name\) => SLP_ACTION_META\[name\]\.deck\)/u);
    // Nothing runs before "Do it": the box plans, a card previews, only the Do it button plays.
    const cards = client("features/stir/SlpStirCards.tsx");
    // Pulse + E (task B): Do it runs as a Pulse task, so the play is awaited inside it (mutateAsync).
    assert.match(cards, /play\.mutateAsync\(\{ steps, origin, supportMessageId: options\.supportMessageId \}\)/u);
    assert.match(
      cards,
      /const steps = cards\.filter\(\(card\) => !card\.error\)\.map\(\(card\) => \(\{ action: card\.action, input: card\.input \}\)\);/u,
      "exactly the previewed input",
    );
    const box = client("features/stir/SlpStirBox.tsx");
    assert.doesNotMatch(box, /\/stir\/play/u, "the box never plays by itself");
    assert.match(client("features/stir/slp-stir-hooks.ts"), /`\$\{base\}\/plan`/u);
    // Slurp Support: the cards sit under the Creator's reply, and Do it marks the plan played.
    assert.match(
      client("features/messages/SlpThreadView.tsx"),
      /readSlpStirProposal\(entry\.message\.metadata\) && \(\s*<SlpStirSupportCards/u,
    );
    assert.match(
      client("features/stir/SlpStirSupportCards.tsx"),
      /doIt\.run\(cards, "support", \{[\s\S]*?supportMessageId: messageId/u,
    );
    // The ✦ sheet: from a profile, a post's ⋯ and Creator tools; the steering card moved in.
    assert.match(
      client("features/stir/SlpStirCreatorSheet.tsx"),
      /<SlpCreatorSteeringCard creatorId=\{creator\.id\} name=\{creator\.name\} \/>/u,
    );
    const profile = client("app/screens/SlpScreenProfile.tsx");
    assert.match(profile, /openSlpStir\(\{ creatorId: profile\.id \}\)/u);
    assert.doesNotMatch(profile, /<SlpCreatorSteeringCard/u, "Creator tools keeps a row that opens the sheet");
    assert.match(
      client("modules/post/SlpPostMenu.tsx"),
      /ctx\.stir\?\.\(\{ id: post\.id, authorAccountId: post\.authorAccountId \}\)/u,
    );
    // Studio went: its own-page half is the Dashboard sheet from the own profile's action row.
    assert.match(client("app/screens/SlpProfileLeadingActions.tsx"), /data-slp-dashboard-open/u);
    assert.match(client("app/screens/SlpDashboard.tsx"), /function SlpDashboardSheet\(/u);
    // Start now and chapter moves left Settings. Release 0.3.0 (user): Pulse's quick starts are back as
    // small chips (Generate posts, Run audience) that run as tasks; a new plan still starts in Stir only.
    assert.doesNotMatch(client("features/world/SlpPlatformEventsPanel.tsx"), /startEvent\.mutate/u);
    assert.doesNotMatch(client("features/projects/SlpProjectsBoard.tsx"), /<SlpArcChapterControls/u);
    assert.match(client("modules/chrome/SlpPulse.tsx"), /<PulseQuickStarts/u);
    assert.doesNotMatch(client("modules/chrome/SlpPulse.tsx"), /stir\/plan/u);
    // First visit: one short hint; the box has examples.
    assert.match(client("features/stir/SlpStirScreen.tsx"), /slurp2:stir-hint-seen/u);
    assert.match(client("locales/en.json"), /"ui\.slurp\.stir\.box": "What should we stir up\?"/u);
  }

  // --- 9. Wiring: routes, entry, Mari ------------------------------------------------------------
  const routes = server("features/assist/slp-stir-routes.ts");
  for (const route of [
    'app.post("/slurp/actions/:name/preview"',
    'app.post("/slurp/stir/preview"',
    'app.post("/slurp/stir/plan"',
    'app.post("/slurp/stir/play"',
    'app.post("/slurp/stir/plays/:id/undo"',
    'app.get("/slurp/stir"',
  ])
    assert.ok(routes.includes(route), route);
  assert.match(server("slp-server-entry.ts"), /await slpStirRoutes\(app, deps\);/u);
  // Merge R × W (on purpose): the "soon" hook is gone; the brand deal is a deck card with a preview.
  assert.doesNotMatch(shared("slp-actions.ts"), /SLP_STIR_SOON/u);

  // --- 0.3.0 review: a Support plan plays once, and the ✦ sheet's cards keep their data ------------
  {
    const once = slpSupportPlayOnce();
    const marked = new Set<string>();
    let plays = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const played = async (id: string) => marked.has(id);
    const play = (id: string) => async () => {
      plays++;
      await gate;
      marked.add(id);
      return `play-${plays}`;
    };
    // A double tap: both requests arrive before the first play is marked.
    const first = once("m1", played, play("m1"));
    const second = await once("m1", played, play("m1"));
    release();
    assert.equal(await first, "play-1");
    assert.equal(second, null, "the second request at the same time does not play");
    assert.equal(await once("m1", played, play("m1")), null, "a stale card after the play does not play again");
    assert.equal(await once("m2", played, play("m2")), "play-2", "another Support plan still plays");
    assert.equal(await once(undefined, played, play("x")), "play-3", "a play from Stir has no lock");
    await assert.rejects(
      once("m3", played, async () => {
        throw new Error("model down");
      }),
    );
    assert.equal(await once("m3", played, play("m3")), "play-4", "a failed play can be tried again");
    const routes = server("features/assist/slp-stir-routes.ts");
    assert.match(
      routes,
      /await supportOnce\(supportMessageId, supportPlayed, async \(\) => \{[\s\S]{0,400}markSupportPlayed\(/u,
    );
    assert.match(routes, /return answer \?\? reply\.code\(409\)/u);
    assert.match(client("features/stir/SlpStirSupportCards.tsx"), /doIt\.pending \|\| sent\}/u);
    // The play sheet a quick card opens closes the ✦ sheet; the query must not follow `target` to "none".
    const sheet = client("features/stir/SlpStirCreatorSheet.tsx");
    assert.match(sheet, /useSlurpStir\(about \? personaId : null\)/u);
    assert.doesNotMatch(sheet, /useSlurpStir\(target/u);
    assert.match(sheet, /<SlpStirPlaySheet\s+action=\{playing\}[\s\S]{0,120}view=\{view\}/u);
  }
}

void main().then(
  () => console.log("slurp2-stir: ok"),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
