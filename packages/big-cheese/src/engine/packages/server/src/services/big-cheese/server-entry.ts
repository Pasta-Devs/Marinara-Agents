// ──────────────────────────────────────────────
// Big Cheese: server activation and the REST routes under /api/big-cheese
// ──────────────────────────────────────────────
// The server bundle may not import Engine modules; everything goes through api.runtime.
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import { engineModel } from "./ai/tasks.js";
import { createBoard } from "./board.js";
import { CastRequest, ReadBody, castRead, listCast, midCast, refreshCast, resolveCast, systemsOf } from "./cast.js";
import { createGame, kitView, view } from "./game.js";
import { createPlace } from "./place.js";
import { BigCheeseError, CreateRunBody, createRunStore, type RunStore } from "./store.js";

interface Request {
  params?: unknown;
  query?: unknown;
  body?: unknown;
}
interface Reply {
  status(code: number): Reply;
  send(payload: unknown): Reply;
}
interface Router {
  get(path: string, handler: (request: Request, reply: Reply) => Promise<unknown>): void;
  post(path: string, handler: (request: Request, reply: Reply) => Promise<unknown>): void;
  delete(path: string, handler: (request: Request, reply: Reply) => Promise<unknown>): void;
}

interface ActivationContext {
  api: {
    runtime: CapabilityRuntimeHost;
    registerPrivilegedRoutes(
      routes: (router: Router) => Promise<void>,
      options: { prefix: string },
    ): Promise<() => void | Promise<void>>;
  };
}

let activeStore: RunStore | null = null;

export async function activate({ api }: ActivationContext) {
  const { runtime } = api;
  const store = createRunStore(runtime.persistence.documents);
  // The default connection. Without one the game plays in Lite mode.
  const board = createBoard(store, runtime.persistence.documents);
  const game = createGame(store, () => engineModel(runtime, null).catch(() => undefined));
  const place = createPlace(store, () => engineModel(runtime, null).catch(() => undefined));
  const runId = (request: Request) => (request.params as { id?: unknown } | undefined)?.id;

  // Known failures go out as { error, code }; anything else is logged and hidden behind a 500.
  const handle = (run: (request: Request) => Promise<unknown>) => async (request: Request, reply: Reply) => {
    try {
      return await run(request);
    } catch (error) {
      if (error instanceof BigCheeseError) {
        return reply.status(error.statusCode).send({ code: error.code, message: error.message });
      }
      runtime.logger.error(error, "Big Cheese request failed");
      return reply.status(500).send({ code: "internal", message: "Big Cheese could not complete the request." });
    }
  };

  const releaseRoutes = await api.registerPrivilegedRoutes(
    async (router) => {
      router.get(
        "/runs",
        handle(async () => ({ runs: await store.list() })),
      );
      router.post(
        "/runs",
        handle(async (request) => {
          const body = CreateRunBody.merge(CastRequest).safeParse(request.body ?? {});
          if (!body.success) throw new BigCheeseError(400, "Invalid request.", "bad-request");
          return game.create(body.data.kitId, body.data.lite, await resolveCast(runtime, body.data.kitId, body.data));
        }),
      );
      router.get(
        "/cast",
        handle(() => listCast(runtime)),
      );
      router.post(
        "/cast/read",
        handle(async (request) => {
          const body = ReadBody.safeParse(request.body ?? {});
          if (!body.success) throw new BigCheeseError(400, "Invalid request.", "bad-request");
          return castRead(runtime, body.data);
        }),
      );
      router.get(
        "/runs/:id",
        handle(async (request) => view(await store.get(runId(request)))),
      );
      const param = (request: Request, key: string) => String((request.params as Record<string, unknown>)[key]);
      const action = (path: string, run: (request: Request) => Promise<unknown>) =>
        router.post(`/runs/:id/${path}`, handle(run));
      action("scenes/:sceneId/choose", (r) => game.choose(runId(r), param(r, "sceneId"), r.body));
      action("day/start", (r) => game.dayStart(runId(r), r.body).then(board.morning));
      action("board/preview", (r) => board.preview(runId(r), r.body));
      action("board/play", (r) => board.play(runId(r), r.body));
      action("board/rewind", (r) => board.rewind(runId(r), r.body));
      router.get(
        "/runs/:id/board/journal",
        handle((r) => board.journal(runId(r), r.query)),
      );
      action("cards/:cardId/answer", (r) => game.answer(runId(r), param(r, "cardId"), r.body));
      action("day/end", (r) => game.dayEnd(runId(r), r.body));
      action("letters/:index/read", (r) => game.readLetter(runId(r), Number(param(r, "index")), r.body));
      action("hearing/witness", (r) => game.witness(runId(r), r.body));
      action("hearing/evidence", (r) => game.evidence(runId(r), r.body));
      action("hearing/talk", (r) => game.talk(runId(r), r.body));
      action("promises/:threadId/keep", (r) => game.keepPromise(runId(r), param(r, "threadId"), r.body));
      action("hearing/start", (r) => game.hearingStart(runId(r), r.body));
      // T6: the Preview screen reads the place with a cast applied, without making a run.
      router.post(
        "/preview",
        handle(async (request) => {
          const body = CreateRunBody.merge(CastRequest).safeParse(request.body ?? {});
          if (!body.success) throw new BigCheeseError(400, "Invalid request.", "bad-request");
          const cast = await resolveCast(runtime, body.data.kitId, body.data);
          return { kit: { ...kitView(body.data.kitId, cast), systems: systemsOf(body.data.kitId, cast) } };
        }),
      );

      // T9: mid-run cast (cast.md section 9). Both go through the run write queue.
      action("cast", async (r) => view(await midCast(runtime, store, runId(r), r.body)));
      action("cast/:pid/refresh", async (r) =>
        view(await refreshCast(runtime, store, runId(r), param(r, "pid"), r.body)),
      );

      router.get(
        "/runs/:id/rooms",
        handle((r) => place.rooms(runId(r))),
      );
      router.get(
        "/runs/:id/grapevine",
        handle((r) => place.grapevine(runId(r), r.query)),
      );
      action("rooms/refresh", (r) => place.refresh(runId(r), r.body));
      action("rooms/:room/visit", (r) => place.visit(runId(r), param(r, "room"), r.body));
      router.get(
        "/runs/:id/rooms",
        handle((r) => place.rooms(runId(r))),
      );
      router.get(
        "/runs/:id/grapevine",
        handle((r) => place.grapevine(runId(r), r.query)),
      );
      action("rooms/refresh", (r) => place.refresh(runId(r), r.body));
      action("rooms/:room/visit", (r) => place.visit(runId(r), param(r, "room"), r.body));
      router.delete(
        "/runs/:id",
        handle(async (request) => {
          await board.remove(runId(request));
          await store.remove(runId(request));
          return { ok: true };
        }),
      );
    },
    { prefix: "/api/big-cheese" },
  );
  activeStore = store;

  return async () => {
    if (activeStore === store) activeStore = null;
    await releaseRoutes();
  };
}

export async function selfCheck() {
  if (!activeStore) throw new Error("Big Cheese routes did not activate");
  await activeStore.list();
}
