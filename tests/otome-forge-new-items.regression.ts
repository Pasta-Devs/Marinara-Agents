// Otome Hearth 0.21.0, new items (the maintainer's: a dot by each item won from Wish until it is clicked):
// - a pull appends each item it wins, once, to `owned.unseen` in the pull's own write; a duplicate adds nothing;
// - the Wardrobe marks a new look, the Album a new Memory, Moment or Snapshot, and the run view counts them by where
//   they are kept (collectionOf: a wardrobe banner's 5★ and 4★s in the Wardrobe, everything else in the Album);
// - POST .../items/:item/seen lets one go and answers with the counts; a second time changes nothing;
// - a state from before 0.21.0 reads with none unseen, and an id that is not owned is never unseen.
import assert from "node:assert/strict";
import test from "node:test";
import type {
  OtomeReply,
  RouteDeps,
  RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  collectionOf,
  unseenCounts,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/wish.ts";
import { stateId } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { albumView } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/album.ts";
import { registerItemRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/items.ts";
import { wardrobeView } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/wardrobe.ts";
import {
  normalizeState,
  readRun,
  toRunView,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { pullWish } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/wish/pull.ts";
import { rotationReplies, wishWorld } from "./fixtures/otome-forge-wish.ts";

const always = (value: number) => () => value;

/** The item routes on a fake router; `call` answers like Fastify ({status, body}). */
function itemRoutes(deps: RouteDeps, runKey: string) {
  const routes = new Map<string, RouteHandler>();
  registerItemRoutes(
    {
      get: (path: string, handler: RouteHandler) => routes.set(`GET ${path}`, handler),
      post: (path: string, handler: RouteHandler) => routes.set(`POST ${path}`, handler),
    },
    deps,
  );
  return async (path: string, params: Record<string, string>) => {
    const handler = routes.get(`POST ${path}`)!;
    let status = 200;
    let payload: unknown;
    const reply: OtomeReply = {
      status(code) {
        status = code;
        return reply;
      },
      send(value) {
        payload = value;
        return reply;
      },
    };
    const result = await handler(
      { method: "POST", url: path, body: {}, params: { run: runKey, ...params }, query: {} },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as Record<string, any> };
  };
}

test("an item's collection follows its id: a wardrobe banner's looks in the Wardrobe, all else in the Album", () => {
  for (const [id, where] of [
    ["his-wardrobe-0-f", "wardrobe"],
    ["his-wardrobe-3-a2", "wardrobe"],
    ["my-wardrobe-1-f", "wardrobe"],
    ["my-wardrobe-1-a3", "wardrobe"],
    ["his-wardrobe-0-s4", "album"],
    ["my-wardrobe-2-s1", "album"],
    ["memories-0-f", "album"],
    ["memories-0-a1", "album"],
    ["memories-5-s6", "album"],
  ] as const) {
    assert.equal(collectionOf(id), where, id);
  }
  assert.deepEqual(unseenCounts(["memories-0-f", "his-wardrobe-0-a1", "my-wardrobe-0-s2"]), { wardrobe: 1, album: 2 });
});

test("a pull's new items wait unseen with their dots until each is seen; a duplicate adds none", async () => {
  const runKey = "r-newitem-aaaaaa";
  const t = await wishWorld({ runKey, images: { connectionId: null }, replies: rotationReplies() });
  assert.equal((await t.call("POST", "/runs/:run/wish/open")).status, 200);
  const state = async () => (await t.store.readDoc(stateId(t.runId), normalizeState))!;
  assert.deepEqual((await state()).owned.unseen, [], "a story begins with none");

  // Ten at 0.5: nine of the same Snapshot (one new, eight duplicates) and the tenth pull's 4★ look.
  const pulled = await pullWish(t.deps, t.runId, { banner: "his-wardrobe-0", count: 10, random: always(0.5) });
  const won = pulled.results.filter((result) => result.isNew).map((result) => result.item.id);
  assert.equal(won.length, 2, JSON.stringify(pulled.results.map((result) => result.item.id)));
  const look = won.find((id) => collectionOf(id) === "wardrobe")!;
  const snapshot = won.find((id) => collectionOf(id) === "album")!;
  assert.ok(look && snapshot);
  assert.deepEqual((await state()).owned.unseen, won, "each new item once, in the order won");

  const run = (await readRun(t.store, t.runId))!;
  assert.deepEqual(toRunView(runKey, run.world, run.player, run.units, run.state).unseen, { wardrobe: 1, album: 1 });
  const wardrobe = await wardrobeView(t.deps, t.runId);
  const looks = [...wardrobe.me, ...Object.values(wardrobe.him).flat()];
  assert.deepEqual(
    looks.filter((entry) => entry.new).map((entry) => entry.id),
    [look],
    "only the new look has its dot",
  );
  const album = await albumView(t.deps, t.runId);
  assert.deepEqual(
    album.memories.filter((item) => item.new).map((item) => item.id),
    [snapshot],
  );

  // Pulled again, the same items are duplicates: nothing new waits.
  await pullWish(t.deps, t.runId, { banner: "his-wardrobe-0", count: 1, random: always(0.5) });
  assert.deepEqual((await state()).owned.unseen, won);

  const seen = itemRoutes(t.deps, runKey);
  const first = await seen("/runs/:run/items/:item/seen", { item: look });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.deepEqual(first.body.unseen, { wardrobe: 0, album: 1 });
  assert.deepEqual((await state()).owned.unseen, [snapshot]);
  const again = await seen("/runs/:run/items/:item/seen", { item: look });
  assert.deepEqual(again.body.unseen, { wardrobe: 0, album: 1 }, "seen twice changes nothing");
  const after = await wardrobeView(t.deps, t.runId);
  assert.equal(
    [...after.me, ...Object.values(after.him).flat()].some((entry) => entry.new),
    false,
  );
  assert.equal((await seen("/runs/:run/items/:item/seen", { item: "not-an-item" })).status, 404);
  assert.deepEqual((await seen("/runs/:run/items/:item/seen", { item: snapshot })).body.unseen, {
    wardrobe: 0,
    album: 0,
  });
});

test("a state from before 0.21.0 has none unseen, and only owned items are ever unseen", () => {
  assert.deepEqual(normalizeState({ owned: { items: ["memories-0-f"] } }).owned.unseen, []);
  const read = normalizeState({
    owned: {
      items: ["memories-0-f", "my-wardrobe-0-a1"],
      unseen: ["my-wardrobe-0-a1", "memories-0-a2", "my-wardrobe-0-a1", 7, "memories-0-f"],
    },
  });
  assert.deepEqual(read.owned.unseen, ["my-wardrobe-0-a1", "memories-0-f"], "owned ones, each once, in order");
});
