// ──────────────────────────────────────────────
// Big Cheese: server activation and the REST routes under /api/big-cheese
// ──────────────────────────────────────────────
// The server bundle may not import Engine modules; everything goes through api.runtime.
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import { engineModel } from "./ai/tasks.js";
import { createAdvance } from "./advance.js";
import { createAdvisors } from "./advisors.js";
import { createBoard } from "./board.js";
import { CastRequest, ReadBody, castRead, listCast, midCast, refreshCast, resolveCast, systemsOf } from "./cast.js";
import { createGame, kitView, view } from "./game.js";
import { KITS } from "./core/kits/index.js";
import { createKits } from "./kits.js";
import { createDraft } from "./draft.js";
import { createMeetings } from "./meetings.js";
import { createRules } from "./rules.js";
import { createAdult } from "./adult.js";
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
  patch?(path: string, handler: (request: Request, reply: Reply) => Promise<unknown>): void;
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
  const board = createBoard(store, runtime.persistence.documents, () =>
    engineModel(runtime, null).catch(() => undefined),
  );
  const game = createGame(store, () => engineModel(runtime, null).catch(() => undefined));
  const place = createPlace(store, () => engineModel(runtime, null).catch(() => undefined));
  const advance = createAdvance(store, game, board, () => engineModel(runtime, null).catch(() => undefined));
  const advisors = createAdvisors(store);
  const meetings = createMeetings(store, () => engineModel(runtime, null).catch(() => undefined));
  const rules = createRules(store);
  const adult = createAdult(store);
  const kits = createKits(runtime.persistence.documents, () => engineModel(runtime, null).catch(() => undefined));
  const draft = createDraft(() => engineModel(runtime, null).catch(() => undefined));
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
          // A saved kit is frozen into the run. Its family's built-in id stays as the run's kitId.
          const custom = body.data.savedKit ? await kits.get(body.data.savedKit) : undefined;
          const kitId = custom
            ? (Object.values(KITS).find((k) => k.place.family === custom.family)?.place.id ?? "hafenkai")
            : body.data.kitId;
          return game.create(
            kitId,
            body.data.lite,
            await resolveCast(runtime, kitId, body.data),
            custom,
            body.data.mode,
          );
        }),
      );
      router.get(
        "/kits",
        handle(async () => ({ kits: await kits.list() })),
      );
      router.get(
        "/kits/:id",
        handle((request) => kits.get(runId(request))),
      );
      router.post(
        "/kits",
        handle(async (request) => kits.save((request.body as { kit?: unknown } | undefined)?.kit)),
      );
      router.post(
        "/kits/import",
        handle(async (request) => kits.import((request.body as { kit?: unknown } | undefined)?.kit)),
      );
      // T3: a wish becomes a kit draft, or one part of a draft is rerolled.
      router.post(
        "/place/draft",
        handle(async (request) => draft.make(request.body)),
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
      router.get(
        "/runs/:id/board/coming-up",
        handle((r) => board.comingUp(runId(r))),
      );
      router.patch?.(
        "/runs/:id/board/coming-up",
        handle((r) => board.patch(runId(r), r.body)),
      );
      // The client posts through its one action helper; PATCH is the same call.
      action("board/coming-up", (r) => board.patch(runId(r), r.body));
      action("cards/:cardId/answer", (r) => game.answer(runId(r), param(r, "cardId"), r.body));
      action("day/end", (r) => game.dayEnd(runId(r), r.body));
      action("letters/:index/read", (r) => game.readLetter(runId(r), Number(param(r, "index")), r.body));
      action("hearing/witness", (r) => game.witness(runId(r), r.body));
      action("hearing/evidence", (r) => game.evidence(runId(r), r.body));
      action("hearing/talk", (r) => game.talk(runId(r), r.body));
      action("promises/:threadId/keep", (r) => game.keepPromise(runId(r), param(r, "threadId"), r.body));
      action("projects/start", (r) => game.projectStart(runId(r), r.body));
      action("hearing/start", (r) => game.hearingStart(runId(r), r.body));
      // T3: big scenes
      action("big-scene/start", (r) => game.bigStart(runId(r), r.body));
      action("big-scene/decline", (r) => game.bigDecline(runId(r), r.body));
      // T6: the Preview screen reads the place with a cast applied, without making a run.
      router.post(
        "/preview",
        handle(async (request) => {
          const body = CreateRunBody.merge(CastRequest).safeParse(request.body ?? {});
          if (!body.success) throw new BigCheeseError(400, "Invalid request.", "bad-request");
          const cast = await resolveCast(runtime, body.data.kitId, body.data);
          return { kit: { ...kitView(body.data, cast), systems: systemsOf(body.data.kitId, cast) } };
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
      // T8: viewer mode and skip ahead (design.md sections 11 and 12).
      action("advance", (r) => advance(runId(r), r.body));
      // T11: advisors and office hours.
      action("advisors", (r) => advisors.circle(runId(r), r.body));
      action("office-hours/book", (r) => advisors.book(runId(r), r.body));
      action("office-hours/hold", (r) => advisors.hold(runId(r), r.body));
      // T4: meetings (design.md section 7).
      action("meetings/start", (r) => meetings.start(runId(r), r.body));
      action("meetings/choose", (r) => meetings.choose(runId(r), r.body));
      // T7: house rules and decrees (design.md section 9, 16).
      router.get(
        "/runs/:id/rules",
        handle((r) => rules.list(runId(r))),
      );
      action("rule", (r) => rules.set(runId(r), r.body));
      // T6: adult module (README Adult module).
      router.get(
        "/runs/:id/adult",
        handle((r) => adult.list(runId(r))),
      );
      action("adult", (r) => adult.set(runId(r), r.body));
      action("adult/affairs/:threadId", (r) => adult.choose(runId(r), param(r, "threadId"), r.body));

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
