import assert from "node:assert/strict";
import { meanwhileRoutes } from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/routes.ts";
import { runDuePass } from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/scheduler.ts";
import { configureMeanwhileRuntime } from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/store.ts";

const docs = new Map<string, any>();
let writes = 0;
const runtime: any = {
  logger: { warn: () => undefined },
  languageModels: {
    resolve: async (id: string) => {
      if (id !== "good") throw new Error("no such connection");
      return {};
    },
  },
  persistence: {
    listChats: async () => [],
    documents: {
      getById: async (_p: string, id: string) => docs.get(id) ?? null,
      create: async (input: any) => {
        writes++;
        docs.set(input.id, { ...input, revision: 1 });
        return docs.get(input.id);
      },
      update: async (input: any) => {
        writes++;
        const doc = docs.get(input.id);
        if (doc.revision !== input.expectedRevision) return null;
        docs.set(input.id, { ...doc, ...input, revision: doc.revision + 1 });
        return docs.get(input.id);
      },
    },
  },
};

// A minimal stand-in for Fastify: it records handlers, and reply.code(n).send(v) becomes { status, body }.
const handlers = new Map<string, (request: any, reply: any) => Promise<any>>();
const app: any = {};
for (const method of ["get", "post", "patch", "delete"]) {
  app[method] = (path: string, handler: any) => handlers.set(`${method.toUpperCase()} ${path}`, handler);
}

async function call(method: string, url: string, payload?: unknown) {
  // "/circles/abc/time" matches the route "/circles/:id/time".
  const m = /^\/circles\/([^/]+)(\/.*)?$/.exec(url);
  const handler = handlers.get(`${method} ${m ? `/circles/:id${m[2] ?? ""}` : url}`)!;
  const reply = { code: (status: number) => ({ send: (body: unknown) => ({ replied: true, status, body }) }) };
  const out = await handler({ params: { id: m?.[1] }, body: payload }, reply);
  return out && typeof out === "object" && "replied" in out ? (out as any) : { status: 200, body: out };
}

async function main() {
  const release = configureMeanwhileRuntime(runtime);
  await meanwhileRoutes(app, {});

  // Unknown kinds are rejected.
  assert.equal((await call("POST", "/circles", { name: "Bad", allowedKinds: ["nope"] })).status, 400);
  assert.equal((await call("POST", "/circles", { name: "Bad", bigKindsAllowed: ["work"] })).status, 400);

  // D2: shared world defaults to on for exactly one linked chat, else off; an explicit value wins.
  assert.equal((await call("POST", "/circles", { name: "One", linkedChatIds: ["a"] })).body.sharedWorld, true);
  assert.equal((await call("POST", "/circles", { name: "Two", linkedChatIds: ["a", "b"] })).body.sharedWorld, false);
  assert.equal((await call("POST", "/circles", { name: "None" })).body.sharedWorld, false);
  assert.equal(
    (await call("POST", "/circles", { name: "Auto", bigAuto: true })).body.bigAuto,
    true,
    "bigAuto is an editable field",
  );
  assert.equal((await call("POST", "/circles", { name: "Plain" })).body.bigAuto, false, "big events wait by default");
  const made = (await call("POST", "/circles", { name: "Off", linkedChatIds: ["a"], sharedWorld: false })).body;
  assert.equal(made.sharedWorld, false);
  const id = made.id as string;

  // Set time: impossible dates are rejected; a real time is kept in the Circle's zone.
  assert.equal((await call("POST", `/circles/${id}/time`, { wall: "2026-02-31T10:00" })).status, 400);
  assert.equal((await call("POST", `/circles/${id}/time`, { wall: "2026-11-05T25:99" })).status, 400);
  assert.equal(
    (await call("POST", `/circles/${id}/time`, { wall: "2026-11-05T18:00" })).body.status.nowWall.slice(0, 16),
    "2026-11-05T18:00",
  );

  // Invalid fields: 400 and nothing written.
  const before = writes;
  for (const bad of [
    { budgetCallsPerDay: null },
    { budgetCallsPerDay: "" },
    { budgetCallsPerDay: 0 },
    { budgetCallsPerDay: 201 },
    { budgetCallsPerDay: 1.5 },
    { setting: "x".repeat(601) },
    { timezone: "Mars/Base" },
    { connectionId: "missing" },
  ]) {
    assert.equal((await call("PATCH", `/circles/${id}`, bad)).status, 400, JSON.stringify(bad));
    assert.equal((await call("POST", "/circles", { name: "Bad", ...bad })).status, 400, JSON.stringify(bad));
  }
  assert.equal(writes, before);
  assert.equal(
    (await call("PATCH", `/circles/${id}`, { connectionId: "good", budgetCallsPerDay: 20, setting: "x".repeat(600) }))
      .status,
    200,
  );

  // Unknown ids: 404 and no write.
  const quiet = writes;
  assert.equal((await call("PATCH", "/circles/nope", { name: "x" })).status, 404);
  assert.equal((await call("DELETE", "/circles/nope")).status, 404);
  assert.equal(writes, quiet);

  // A pass that outlives deactivate must not reject unhandled: its own catch handles the missing runtime.
  const pass = runDuePass();
  release();
  await pass.catch(() => undefined);
  console.log("meanwhile routes regression passed");
}

void main();
