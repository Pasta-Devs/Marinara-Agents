// ──────────────────────────────────────────────
// Big Cheese: server activation and the REST routes under /api/big-cheese
// ──────────────────────────────────────────────
// The server bundle may not import Engine modules; everything goes through api.runtime.
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import { BigCheeseError, CreateRunBody, createRunStore, type RunStore } from "./store.js";

interface Request {
  params?: unknown;
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
  const runId = (request: Request) => (request.params as { id?: unknown } | undefined)?.id;

  // Known failures go out as { error, code }; anything else is logged and hidden behind a 500.
  const handle = (run: (request: Request) => Promise<unknown>) => async (request: Request, reply: Reply) => {
    try {
      return await run(request);
    } catch (error) {
      if (error instanceof BigCheeseError) {
        return reply.status(error.statusCode).send({ error: error.message, code: error.code });
      }
      runtime.logger.error(error, "Big Cheese request failed");
      return reply.status(500).send({ error: "Big Cheese could not complete the request." });
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
          const body = CreateRunBody.safeParse(request.body ?? {});
          if (!body.success) throw new BigCheeseError(400, "Invalid request: kitId.", "bad-request");
          return { run: await store.create(body.data.kitId) };
        }),
      );
      router.get(
        "/runs/:id",
        handle(async (request) => ({ run: await store.get(runId(request)) })),
      );
      router.delete(
        "/runs/:id",
        handle(async (request) => {
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
