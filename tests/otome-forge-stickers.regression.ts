// Otome Hearth's chat stickers (#2044).
// - Names: `[name_emotion]`, slugged (accents folded, spaces to "_"); a love interest whose slug the protagonist or
//   another love interest shares takes his id's last 4 characters, so every name is one sticker.
// - The bracket parser reads either order, folds case and accents, takes one sticker per reply, drops a sticker-shaped
//   name nobody owns and keeps other bracketed text; the old JSON face field is no longer a sticker. A label counts
//   characters in the reply's check and the stored set alike.
// - P17 lists only stickers that exist: the protagonist's five (the built-in set with images off) and, with images on,
//   his painted ones; the thread renders stickers by name for him and for P18, and an old face sticker as before.
// - send() accepts only a sticker she may send in that thread.
// - GET /runs/:run designs his nine in the background once he reaches level 2 with images on, paints one sticker per
//   level reached (levels a story already reached included) one at a time in the low lane, the protagonist's five only
//   after the phone opened with images on, leaves them waiting for a tap under Ask or review (no paid call), lists a
//   sticker only once its cut-out settled (hers too; the Album shows it painting meanwhile) and keeps its old cut-out
//   shown while a newer cleanup rebuilds it, rests 10 minutes after a failed paint, and a restart leaves at most one
//   stopped. Images off paints nothing.
// - The sticker prompt is a chibi bust on the look's matte with the look's rating and adult tags; an edit keeps them.
// - A tap paints once; the Album lists the stickers she has and those waiting for a tap.
import assert from "node:assert/strict";
import test from "node:test";
import type {
  PhoneMessage,
  StickerView,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { STICKERS_PER_LI } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/stickers.ts";
import type { CutoutClient } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cutout.ts";
import { cutoutsSettled } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cutout.ts";
import {
  STICKER_FRAMING,
  chatReplyMessages,
  renderThread,
  stickerPrompt,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import {
  normalizeStickerSetReply,
  queueStickers,
  stickerLookup,
  stickerNames,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/stickers.ts";
import { createBackgroundQueue } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/background-queue.ts";
import {
  playerId,
  runDocTarget,
  stateId,
  unitId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  normalizeThread,
  sendMessage,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/chat.ts";
import {
  normalizeChatReply,
  type ReplySticker,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/replies.ts";
import { registerAlbumRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/album.ts";
import { registerArtRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/art.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import {
  normalizeState,
  readRun,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { createOtomeArt } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/expressions.ts";
import { paintSlot } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/paint.ts";
import { artWorld, routesOf, setImages, until } from "./fixtures/otome-forge-art.ts";
import { KAI, MIR, SOL, at, json, storyWorld } from "./fixtures/otome-forge-story.ts";

const EMOTIONS = ["guarded", "smug", "pensive", "flustered", "sulking", "teasing", "proud", "tender", "devoted"];
const setReply = (emotions: readonly string[] = EMOTIONS) =>
  json({
    stickers: emotions.map((emotion) => ({ emotion, label: `${emotion}!`, look: `a ${emotion} chibi face` })),
  });
const SET = EMOTIONS.map((emotion) => ({ emotion, label: `${emotion}!`, look: `a ${emotion} chibi face` }));

/** Kai at `level` with his nine designed (no paints yet). */
async function giveSet(t: Awaited<ReturnType<typeof storyWorld>>, li = KAI) {
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, li)), normalizeUnit, (unit) => ({
    ...unit,
    stickers: { set: SET, at, art: {} },
  }));
}
async function setLevel(t: Awaited<ReturnType<typeof storyWorld>>, li: string, level: number) {
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: { ...state.lis, [li]: { ...state.lis[li]!, points: (level - 1) * 300 } },
  }));
}
const markPhoneOpened = (t: Awaited<ReturnType<typeof storyWorld>>) =>
  t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    stickers: {},
  }));

/** A free cut-out that lands at once (or is held until `release()`). */
function cutouts({ hold = false }: { hold?: boolean } = {}) {
  let release!: () => void;
  const gate = hold ? new Promise<void>((resolve) => (release = resolve)) : Promise.resolve();
  const calls: string[] = [];
  const client: CutoutClient = {
    async cutOut(url) {
      calls.push(url);
      await gate;
      return { url: `${url}.cut.png`, id: `cut-${calls.length}` };
    },
    deleteGalleryImage: async () => true,
  };
  return { client, calls, release: () => release?.() };
}

test("names fold accents and case, and a shared slug takes the love interest's id suffix, deterministically", async () => {
  const t = await storyWorld({ runKey: "r-stnames-aaaaaa" });
  const run = (await readRun(t.store, t.runId))!;
  assert.deepEqual(
    [...stickerNames(run)],
    [
      ["you", "ines"],
      [KAI, "kai"],
      [MIR, "mireille"],
      [SOL, "sol"],
    ],
  );
  // The protagonist named like him keeps the bare slug; two love interests with one slug both take their suffix.
  const clash = {
    player: { ...run.player, name: "Kai" },
    units: [
      { ...run.units[0]!, name: "Kai" },
      { ...run.units[1]!, name: "Élodie Rose" },
      { ...run.units[2]!, name: "élodie-rose" },
    ],
  };
  assert.deepEqual(
    [...stickerNames(clash)],
    [
      ["you", "kai"],
      [KAI, "kai_ab12"],
      [MIR, "elodie_rose_cd34"],
      [SOL, "elodie_rose_ef56"],
    ],
  );
  const name = stickerLookup(clash);
  assert.deepEqual(name(`${KAI}:smug`), { name: "kai_ab12_smug", about: "smug", who: "li", ownerName: "Kai" });
  assert.deepEqual(name("you:laugh"), { name: "kai_laugh", about: "laughing", who: "player", ownerName: "Kai" });
  assert.equal(name("li-nobody-zz99:smug"), null);
});

test("the bracket parser reads either order, one sticker a reply, and drops names nobody owns", () => {
  const names = { li: "Dottore", player: "Mari" };
  const listed: ReplySticker[] = [
    { id: "li-dottore-ab12:pensive", name: "dottore_pensive", about: "pensive" },
    { id: "you:laugh", name: "mari_laugh", about: "laughing" },
    { id: "li-kai-cd34:smug", name: "kai_cd34_smug", about: "smug" },
  ];
  const parse = (...texts: string[]) =>
    normalizeChatReply({ messages: texts.map((text) => ({ text })) }, names, listed) as {
      messages: Array<{ text: string; sticker?: string }>;
    };
  assert.deepEqual(parse("[pensive_dottore]").messages, [{ text: "", sticker: "li-dottore-ab12:pensive" }]);
  assert.deepEqual(parse("Ha. [MARI LAUGH]").messages, [{ text: "Ha.", sticker: "you:laugh" }]);
  assert.deepEqual(parse("[Dóttore-Pensive] fine").messages, [{ text: "fine", sticker: "li-dottore-ab12:pensive" }]);
  assert.deepEqual(parse("[smug_kai_cd34]").messages, [{ text: "", sticker: "li-kai-cd34:smug" }]);
  // One sticker in a reply: the next is taken out of its message, which is skipped when nothing is left.
  assert.deepEqual(parse("[mari_laugh]", "[dottore_pensive]", "Still here.").messages, [
    { text: "", sticker: "you:laugh" },
    { text: "Still here." },
  ]);
  // A name nobody owns is dropped; other bracketed text stays, a word or several, accented or not.
  assert.deepEqual(parse("[dottore_furious] I [sigh] see.").messages, [{ text: "I [sigh] see." }]);
  assert.equal(typeof normalizeChatReply({ messages: [{ text: "[mari_cry]" }] }, names, listed), "string");
  assert.deepEqual(parse("Fine. [laughs softly] Go to bed.", "See you at [Café Lumière].").messages, [
    { text: "Fine. [laughs softly] Go to bed." },
    { text: "See you at [Café Lumière]." },
  ]);
  assert.deepEqual(parse("[voice message]").messages, [{ text: "[voice message]" }], "never refused as empty");
  assert.deepEqual(parse("[well-known] spot").messages, [{ text: "[well-known] spot" }]);
  // The JSON field is read the same way; a bare face name is no longer a sticker.
  const field = normalizeChatReply({ messages: [{ text: "", sticker: "dottore_pensive" }] }, names, listed);
  assert.deepEqual(field, { messages: [{ text: "", sticker: "li-dottore-ab12:pensive" }] });
  assert.equal(typeof normalizeChatReply({ messages: [{ text: "", sticker: "cold" }] }, names, listed), "string");
});

test("P17 lists only stickers that exist, and threads render stickers by name, old faces as before", async () => {
  const t = await storyWorld({ runKey: "r-stp17-aaaaaa" });
  const run = (await readRun(t.store, t.runId))!;
  const unit = run.units.find((entry) => entry.id === KAI)!;
  const name = stickerLookup(run);
  const yours = ["laugh", "love", "shy", "sad", "pout"].map((emotion) => ({
    id: `you:${emotion}`,
    ...name(`you:${emotion}`)!,
  }));
  const tail: PhoneMessage[] = [
    { id: "m-1", who: "player", text: "", sticker: "you:laugh", at },
    { id: "m-2", who: "li", text: "", sticker: `${KAI}:smug`, at },
    { id: "m-3", who: "li", text: "", sticker: "cold", at },
    { id: "m-4", who: "player", text: "?", sticker: "li-gone-zz99:smug", at },
  ];
  const prompt = (his: ReplySticker[]) =>
    chatReplyMessages({
      world: run.world,
      player: run.player,
      unit,
      liState: run.state.lis[KAI]!,
      tail,
      memories: [],
      story: "",
      stickers: { his, yours, name },
    })
      .map((message) => message.content)
      .join("\n");
  const off = prompt([]);
  assert.match(off, /Ines's stickers, which you may send too: \[ines_laugh\] \(laughing\), \[ines_love\] \(in love\)/);
  assert.doesNotMatch(off, /Your stickers:/, "no stickers of his before one is painted");
  assert.doesNotMatch(off, /"sticker"/, "the JSON shape no longer carries a face");
  const on = prompt([{ id: `${KAI}:smug`, name: "kai_smug", about: "smug" }]);
  assert.match(on, /Your stickers: \[kai_smug\] \(smug\)\./);
  assert.match(on, /e\.g\. "\[kai_smug\]"/);
  assert.match(
    on,
    /Ines: \[sends the sticker \[ines_laugh\] \(laughing\)\]\nKai: \[kai_smug\]\nKai: \[sticker: cold face\]\nInes: \? \[a sticker\]/,
  );
  assert.equal(
    renderThread(tail.slice(0, 2), { li: "Kai", player: "Ines" }, "told", name),
    "Ines: [sticker: Ines, laughing]\nKai: [sticker: Kai, smug]",
  );
});

test("she may send her five and his painted ones in his thread only; anything else is a 400", async () => {
  const t = await artWorld({
    runKey: "r-stsend-aaaaaa",
    replies: Array.from({ length: 6 }, () => json({ messages: [{ text: "Hm." }] })),
  });
  await assert.doesNotReject(sendMessage(t.deps, t.runId, KAI, { sticker: "you:pout" }));
  await giveSet(t);
  await setLevel(t, KAI, 3);
  // Owed but not painted, another love interest's, unknown: refused before anything is saved or sent.
  for (const [li, sticker] of [
    [KAI, `${KAI}:guarded`],
    [MIR, `${KAI}:guarded`],
    [KAI, "you:cry"],
  ] as const) {
    await assert.rejects(
      sendMessage(t.deps, t.runId, li, { sticker }),
      (error: { statusCode?: number }) => error.statusCode === 400,
    );
  }
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    stickers: { ...unit.stickers!, art: { guarded: { state: "ready", at, url: "/api/global-gallery/file/g.png" } } },
    cutouts: { "/api/global-gallery/file/g.png": { state: "ready", at, url: "/api/global-gallery/file/g.cut.png" } },
  }));
  await assert.doesNotReject(sendMessage(t.deps, t.runId, KAI, { sticker: `${KAI}:guarded` }));
  await assert.rejects(sendMessage(t.deps, t.runId, MIR, { sticker: `${KAI}:guarded` }));
  // With images off his stickers are not offered, so they cannot be sent; hers still can.
  await setImages(t.store, t.runId, { connectionId: null });
  await assert.rejects(sendMessage(t.deps, t.runId, KAI, { sticker: `${KAI}:guarded` }));
  await assert.doesNotReject(sendMessage(t.deps, t.runId, KAI, { sticker: "you:laugh" }));
  assert.deepEqual(
    (await t.store.readDoc(`${t.runId}:chat:${KAI}`, (data) => data as { messages: PhoneMessage[] }))!.messages
      .filter((message) => message.who === "player")
      .map((message) => message.sticker),
    ["you:pout", `${KAI}:guarded`, "you:laugh"],
    "a refused sticker saved nothing",
  );
});

test("the sticker prompt is a chibi bust on the look's matte, with the look's rating and adult tags kept on an edit", async () => {
  const t = await artWorld({ runKey: "r-stprompt-aaaaaa" });
  const world = (await readRun(t.store, t.runId))!.world;
  const style = { styleText: "soft watercolor", positiveTags: "pastel", negativeTags: "blurry" };
  const built = stickerPrompt({
    name: "Kai",
    identityLine: "tall man, green eyes, black hair",
    outfitLine: "navy coat",
    presentation: "man",
    look: "smirking, one eyebrow raised",
    world,
    style,
  });
  assert.ok(built.prompt.startsWith("soft watercolor, tall man, green eyes, black hair, smirking"), built.prompt);
  assert.ok(built.prompt.includes(STICKER_FRAMING), built.prompt);
  // #2066: one sticker set, one look: no white die-cut outline around some of them and not others.
  assert.match(built.prompt, /no white outline around the figure/u);
  assert.match(built.negativePrompt, /white outline, white border, sticker border, die-cut border/u);
  assert.match(built.prompt, /plain flat solid chroma magenta #FF00FF background/, "green and blue are named: magenta");
  assert.match(built.prompt, /safe for work, fully clothed, adult man/);
  assert.match(built.negativePrompt, /child, childlike, minor/);
  assert.match(built.negativePrompt, /full body/);
  assert.match(built.negativePrompt, /blurry/);
  const edited = stickerPrompt(
    { name: "Kai", identityLine: "", outfitLine: "", presentation: "man", look: "", world, style },
    { prompt: "a chibi Kai waving", negativePrompt: "text" },
  );
  assert.match(edited.prompt, /^a chibi Kai waving, .*adult man/);
  assert.match(edited.negativePrompt, /^text, .*child/);
});

test("his set is nine distinct emotions, never another love interest's nine", () => {
  const reply = { stickers: SET };
  assert.deepEqual(normalizeStickerSetReply(reply), SET);
  assert.equal(SET.length, STICKERS_PER_LI);
  assert.match(String(normalizeStickerSetReply({ stickers: SET.slice(0, 8) })), /exactly 9/);
  assert.match(String(normalizeStickerSetReply({ stickers: [...SET.slice(0, 8), SET[0]!] })), /used twice/);
  assert.match(
    String(
      normalizeStickerSetReply({ stickers: SET.map((entry, i) => (i ? entry : { ...entry, emotion: "Very Smug" })) }),
    ),
    /one lowercase English word/,
  );
  assert.match(String(normalizeStickerSetReply(reply, [[...EMOTIONS].reverse()])), /same as another/);
  // A label is counted in characters by the reply's check and the stored set alike: 16 characters that are 26 UTF-16
  // units (emoji) keep all nine, so no later sticker moves a level down.
  const emoji = "Hmph! 💢💢💢💢💢💢💢💢💢💢";
  assert.deepEqual([[...emoji].length, emoji.length], [16, 26]);
  const set = normalizeStickerSetReply({
    stickers: SET.map((entry, i) => (i === 1 ? { ...entry, label: emoji } : entry)),
  });
  assert.ok(Array.isArray(set));
  const stored = normalizeUnit({ ...normalizeUnit({}), stickers: { set, at, art: {} } }).stickers!;
  assert.deepEqual(
    stored.set.map((entry) => [entry.emotion, entry.label]),
    set.map((entry) => [entry.emotion, entry.label]),
  );
  assert.match(
    String(normalizeStickerSetReply({ stickers: SET.map((e) => ({ ...e, label: "x".repeat(25) })) })),
    /1 to 24/,
  );
  assert.equal(
    normalizeUnit({ ...normalizeUnit({}), stickers: { set: [{ ...SET[0]!, label: "x".repeat(25) }], at, art: {} } })
      .stickers,
    undefined,
  );
});

/** The art world with the run, art, phone-start and Album routes, a background lane and free cut-outs. */
async function stickerWorld(runKey: string, options: { ask?: boolean; replies?: string[]; hold?: boolean } = {}) {
  const t = await artWorld({
    runKey,
    images: { ask: options.ask ?? false },
    replies: options.replies ?? [
      setReply(),
      setReply(EMOTIONS.map((e) => `${e}x`)),
      setReply(EMOTIONS.map((e) => `${e}y`)),
    ],
  });
  const background = createBackgroundQueue(t.runtime);
  const cut = cutouts({ hold: options.hold });
  const deps = { ...t.deps, background, cutouts: cut.client };
  const art = createOtomeArt(deps);
  const full = { ...deps, art };
  const runs = routesOf(registerRunRoutes, full, runKey);
  const arts = routesOf(registerArtRoutes, full, runKey);
  const album = routesOf(registerAlbumRoutes, full, runKey);
  const view = async (query: object = {}) => {
    const result = await runs("GET", "/runs/:run", query);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body.view as { stickers: StickerView[]; stickersPending?: true; cutoutsPending?: true };
  };
  const unit = async (li = KAI) => (await t.store.readDoc(unitId(t.runId, li), normalizeUnit))!;
  const player = async () => (await t.store.readDoc(playerId(t.runId), normalizePlayer))!;
  /** Reads the run until nothing is pending (each read starts what is owed), then lets the cut-outs settle. */
  const settle = async () => {
    for (let round = 0; round < 60; round += 1) {
      const shown = await view();
      await cutoutsSettled();
      if (!shown.stickersPending && !shown.cutoutsPending) return;
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    assert.fail("stickers never settled");
  };
  const stickerPaints = () => t.paid.filter((call) => /chibi sticker/.test(call.request.prompt));
  return { ...t, deps: full, art, background, cut, runs, arts, album, view, unit, player, settle, stickerPaints };
}

test("images off: nothing is designed or painted, and the book holds her built-in five", async () => {
  const t = await stickerWorld("r-stoff-aaaaaa");
  await setImages(t.store, t.runId, { connectionId: null });
  await setLevel(t, KAI, 6);
  const started = await t.arts("POST", "/runs/:run/stickers");
  assert.deepEqual(started.body, { started: false }, "the phone opened without images starts nothing");
  assert.equal((await t.player()).stickers, undefined);
  await markPhoneOpened(t);
  const shown = await t.view();
  assert.equal(shown.stickersPending, undefined);
  assert.deepEqual(
    shown.stickers.map((sticker) => [sticker.id, sticker.name, sticker.url ?? null]),
    ["laugh", "love", "shy", "sad", "pout"].map((emotion) => [`you:${emotion}`, `ines_${emotion}`, null]),
  );
  await queueStickers(t.deps, t.runId, { debugMode: false });
  await t.settle();
  assert.deepEqual([t.calls.length, t.paid.length], [0, 0]);
  assert.equal((await t.unit()).stickers, undefined);
});

test("a love interest at level 2 or more gets his nine designed, then one painted sticker per level reached", async () => {
  const t = await stickerWorld("r-stlevels-aaaaaa");
  await setLevel(t, KAI, 4);
  await setLevel(t, MIR, 1);
  const first = await t.view();
  assert.equal(first.stickersPending, true, "his set is being designed");
  await t.settle();
  const kai = await t.unit();
  assert.deepEqual(
    kai.stickers!.set.map((sticker) => sticker.emotion),
    EMOTIONS,
  );
  assert.equal((await t.unit(MIR)).stickers, undefined, "level 1 designs nothing");
  // Levels 2, 3 and 4: three paints, one at a time in the low lane, each a chibi of him with his likeness.
  assert.deepEqual(Object.keys(kai.stickers!.art), ["guarded", "smug", "pensive"]);
  assert.equal(t.stickerPaints().length, 3);
  assert.ok(t.stickerPaints().every((call) => call.method === "generatePortrait" && call.request.width === 1024));
  assert.deepEqual(
    t.stickerPaints().map((call) => /a (\w+) chibi face/.exec(call.request.prompt)?.[1]),
    ["guarded", "smug", "pensive"],
  );
  // Each is listed once its cut-out settled, with its cut-out.
  const shown = await t.view();
  assert.deepEqual(
    shown.stickers
      .filter((sticker) => sticker.owner === KAI)
      .map((s) => [s.name, s.level, s.url!.endsWith(".cut.png")]),
    [
      ["kai_guarded", 2, true],
      ["kai_smug", 3, true],
      ["kai_pensive", 4, true],
    ],
  );
  // Level 5 later: the next read paints just that one.
  await setLevel(t, KAI, 5);
  await t.settle();
  assert.equal(t.stickerPaints().length, 4);
  assert.deepEqual(Object.keys((await t.unit()).stickers!.art), ["guarded", "smug", "pensive", "flustered"]);
  // The protagonist's five wait for the phone; once it opened they are painted too.
  assert.equal((await t.player()).stickers, undefined);
  assert.deepEqual((await t.arts("POST", "/runs/:run/stickers")).body, { started: true });
  await t.settle();
  assert.deepEqual(Object.keys((await t.player()).stickers!), ["laugh", "love", "shy", "sad", "pout"]);
  assert.equal(t.stickerPaints().length, 9);
  // Hers are cut out too (GET /runs/:run queues them), so the picker, the bubbles and the Album show the cut-outs.
  assert.deepEqual(
    (await t.view()).stickers
      .filter((sticker) => sticker.owner === "you")
      .map((sticker) => [sticker.name, !!sticker.url?.endsWith(".cut.png")]),
    ["laugh", "love", "shy", "sad", "pout"].map((emotion) => [`ines_${emotion}`, true]),
  );
  assert.ok(
    t
      .stickerPaints()
      .slice(4)
      .every((call) => call.request.name === "Ines"),
  );
});

test("only one sticker paints at a time per run, in the low lane behind a tap", async () => {
  const t = await stickerWorld("r-stlane-aaaaaa");
  await giveSet(t);
  await setLevel(t, KAI, 3);
  let live = 0;
  let most = 0;
  const original = t.images.generatePortrait;
  t.images.generatePortrait = async (request) => {
    live += 1;
    most = Math.max(most, live);
    await new Promise((resolve) => setTimeout(resolve, 5));
    live -= 1;
    return original(request);
  };
  await Promise.all([t.view(), t.view(), t.view()]);
  await t.settle();
  assert.equal(most, 1);
  assert.equal(t.stickerPaints().length, 2);

  // In the low lane: a scene paint (high) queued while the connection is busy goes before the next sticker.
  await setLevel(t, KAI, 4);
  const order: string[] = [];
  let release!: () => void;
  const busy = paintSlot("conn-image", () => new Promise<void>((resolve) => (release = resolve)), "high");
  void t.view();
  await until(
    async () => (await t.unit()).stickers?.art.pensive?.state === "pending",
    "the sticker waits for the lane",
  );
  t.images.generatePortrait = async (request) => (order.push("sticker"), original(request));
  const scene = paintSlot("conn-image", async () => void order.push("scene"), "high");
  // While it waits, more reads of the run claim nothing else: a restart now would stop this one sticker only.
  await Promise.all([t.view(), t.view(), t.view()]);
  await setLevel(t, KAI, 6);
  await Promise.all([t.view(), t.view()]);
  // Let any chain those reads started claim what it would.
  for (let round = 0; round < 100; round += 1) await new Promise((resolve) => setImmediate(resolve));
  const pending = Object.values((await t.unit()).stickers!.art).filter((art) => art.state === "pending");
  assert.equal(pending.length, 1, "one sticker in flight per run");
  release();
  await Promise.all([busy, scene]);
  await t.settle();
  assert.deepEqual(order, ["scene", "sticker", "sticker", "sticker"]);
});

test("Ask before painting or prompt review leaves them waiting for a tap, which paints once", async () => {
  const t = await stickerWorld("r-stask-aaaaaa", { ask: true });
  await giveSet(t);
  await setLevel(t, KAI, 3);
  await t.settle();
  assert.deepEqual(
    Object.values((await t.unit()).stickers!.art).map((art) => art.state),
    ["waiting-consent", "waiting-consent"],
  );
  assert.equal(t.paid.length, 0, "nothing paid before the tap");
  const album = await t.album("GET", "/runs/:run/album");
  assert.deepEqual(
    album.body.stickers
      .filter((s: { owner: string }) => s.owner === KAI)
      .map((s: { name: string; art?: { state: string } }) => [s.name, s.art?.state]),
    [
      ["kai_guarded", "waiting-consent"],
      ["kai_smug", "waiting-consent"],
    ],
  );
  const prompt = await t.arts("POST", "/runs/:run/art/sticker/prompt", { sticker: `${KAI}:guarded` });
  assert.ok(prompt.body.prompt.includes(STICKER_FRAMING));
  const [one, two] = await Promise.all([
    t.arts("POST", "/runs/:run/art/sticker", { sticker: `${KAI}:guarded` }),
    t.arts("POST", "/runs/:run/art/sticker", { sticker: `${KAI}:guarded` }),
  ]);
  assert.deepEqual([one.body.art.state, two.body.art.state], ["ready", "ready"]);
  assert.equal(t.stickerPaints().length, 1, "two taps pay once");
  // A tap on one already painted answers with it and pays nothing, even once images are turned off.
  await setImages(t.store, t.runId, { connectionId: null });
  const again = await t.arts("POST", "/runs/:run/art/sticker", { sticker: `${KAI}:guarded` });
  assert.deepEqual([again.status, again.body.art?.state], [200, "ready"]);
  assert.equal(t.stickerPaints().length, 1);
  await setImages(t.store, t.runId, { connectionId: "conn-image" });
  // Review mode from a GET does the same with Ask off.
  const u = await stickerWorld("r-streview-aaaaaa");
  await giveSet(u);
  await setLevel(u, KAI, 2);
  await u.view({ reviewImagePrompts: "true" });
  await until(async () => !!(await u.unit()).stickers?.art.guarded, "the sticker is claimed");
  assert.equal((await u.unit()).stickers!.art.guarded!.state, "waiting-consent");
  assert.equal(u.paid.length, 0);
});

test("a sticker is listed only after its cut-out settles, and a restart leaves at most one stopped", async () => {
  const t = await stickerWorld("r-stcut-aaaaaa", { hold: true });
  await giveSet(t);
  await setLevel(t, KAI, 2);
  await t.view();
  await until(async () => (await t.unit()).stickers?.art.guarded?.state === "ready", "the sticker is painted");
  const held = await t.view();
  assert.equal(held.cutoutsPending, true);
  assert.equal(
    held.stickers.some((sticker) => sticker.owner === KAI),
    false,
    "not before its cut-out",
  );
  // The Album shows it as painting meanwhile (and so keeps polling), never drops it.
  const albumKai = async () =>
    (await t.album("GET", "/runs/:run/album")).body.stickers
      .filter((s: { owner: string }) => s.owner === KAI)
      .map((s: { name: string; art?: { state: string }; url?: string }) => [
        s.name,
        s.art?.state ?? null,
        !!s.url?.endsWith(".cut.png"),
      ]);
  assert.deepEqual(await albumKai(), [["kai_guarded", "pending", false]]);
  t.cut.release();
  await t.settle();
  assert.equal((await t.view()).stickers.filter((sticker) => sticker.owner === KAI).length, 1);
  assert.deepEqual(await albumKai(), [["kai_guarded", null, true]]);

  // A paint left pending by a restart reads as stopped, is never painted again by itself, and nothing else stops.
  const u = await stickerWorld("r-strestart-aaaaaa");
  await giveSet(u);
  await setLevel(u, KAI, 4);
  await u.store.updateDoc(runDocTarget("unit", unitId(u.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    stickers: { ...unit.stickers!, art: { guarded: { state: "pending", at } } },
  }));
  await u.settle();
  const album = await u.album("GET", "/runs/:run/album");
  const states = album.body.stickers
    .filter((s: { owner: string }) => s.owner === KAI)
    .map((s: { name: string; art?: { state: string }; url?: string }) => [
      s.name,
      s.art?.state ?? (s.url ? "shown" : ""),
    ]);
  assert.deepEqual(states, [
    ["kai_guarded", "stopped"],
    ["kai_smug", "shown"],
    ["kai_pensive", "shown"],
  ]);
  assert.equal(u.stickerPaints().length, 2);
});

test("a cut-out refresh keeps showing the sticker's old cut-out, so nothing she has reads as new or painting", async () => {
  const t = await stickerWorld("r-strefresh-aaaaaa", { hold: true });
  await giveSet(t);
  await setLevel(t, KAI, 2);
  const art = "/api/global-gallery/file/g.png";
  const old = "/api/global-gallery/file/g.old-cut.png";
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    stickers: { ...unit.stickers!, art: { guarded: { state: "ready", at, url: art } } },
    cutouts: { [art]: { state: "ready", at, url: old, cleanupRevision: 1 } },
  }));
  // An Engine update advertises a newer cleanup: the next read rebuilds the cut-out (held here) from the original.
  t.cut.client.cleanupRevision = async () => 2;
  const kai = (stickers: StickerView[]) => stickers.filter((sticker) => sticker.owner === KAI).map((s) => s.url);
  // Released however this ends: a held cut-out would hold back every later cut-out in this file.
  try {
    const during = await t.view();
    assert.equal(during.cutoutsPending, true, "the refresh is on its way");
    assert.deepEqual(kai(during.stickers), [old], "the read that queues it");
    assert.deepEqual(kai((await t.view()).stickers), [old], "a read while it runs");
    const album = (await t.album("GET", "/runs/:run/album")).body.stickers.filter(
      (s: { owner: string }) => s.owner === KAI,
    );
    assert.deepEqual(
      album.map((s: { url?: string; art?: unknown }) => [s.url, s.art ?? null]),
      [[old, null]],
    );
  } finally {
    t.cut.release();
  }
  await t.settle();
  assert.deepEqual(kai((await t.view()).stickers), [`${art}.cut.png`], "the new cut-out once it lands");
});

test("a failed sticker paint rests the chain, so a broken image connection fails one sticker, not every one owed", async () => {
  const t = await stickerWorld("r-stfail-aaaaaa");
  await giveSet(t);
  await setLevel(t, KAI, 4);
  const original = t.images.generatePortrait;
  let tries = 0;
  t.images.generatePortrait = async (request) => {
    tries += 1;
    await original(request);
    throw new Error("the image connection is down");
  };
  await t.settle();
  // More reads while it rests start nothing, and the run stops polling for stickers.
  await Promise.all([t.view(), t.view(), t.view()]);
  await t.settle();
  assert.equal(tries, 1);
  assert.deepEqual(
    Object.entries((await t.unit()).stickers!.art).map(([emotion, art]) => [emotion, art.state]),
    [["guarded", "failed"]],
  );
  assert.equal((await t.view()).stickersPending, undefined);
  // The Album offers its Retry, and a tap still paints it at once.
  t.images.generatePortrait = original;
  const tap = await t.arts("POST", "/runs/:run/art/sticker", { sticker: `${KAI}:guarded` });
  assert.equal(tap.body.art.state, "ready");
  assert.equal(t.stickerPaints().length, 2, "the failed try and the tap");
  assert.equal((await t.unit()).stickers!.art.smug, undefined, "the others wait out the rest");
});

test("old face stickers stay on stored messages, and the run view's book keeps painted stickers with images off", async () => {
  const t = await stickerWorld("r-stold-aaaaaa");
  await giveSet(t);
  await setLevel(t, KAI, 2);
  await t.settle();
  await setImages(t.store, t.runId, { connectionId: null });
  const shown = await t.view();
  assert.ok(
    shown.stickers.some((sticker) => sticker.id === `${KAI}:guarded` && sticker.url),
    "an old message still shows it",
  );
  const album = await t.album("GET", "/runs/:run/album");
  assert.ok(album.body.stickers.some((s: { id: string; url?: string }) => s.id === `${KAI}:guarded` && s.url));
  assert.equal(album.body.cgs.length, 0, "stickers are not CGs (Home's backdrop reads those)");
  // A stored thread keeps an old face sticker and a new sticker id; anything else is dropped on its own.
  const thread = normalizeThread({
    li: KAI,
    messages: [
      { id: "m-old", who: "li", text: "", sticker: "cold", at },
      { id: "m-new", who: "player", text: "", sticker: "you:laugh", at },
      { id: "m-bad", who: "li", text: "hm", sticker: "smug", at },
    ],
  });
  assert.deepEqual(
    thread.messages.map((message) => [message.id, message.sticker ?? null]),
    [
      ["m-old", "cold"],
      ["m-new", "you:laugh"],
      ["m-bad", null],
    ],
  );
});
