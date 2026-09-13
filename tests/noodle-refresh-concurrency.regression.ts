import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { z } from "zod";
import { tryNoodleOperation } from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-operation-lock.js";

async function main() {
  const routes = readFileSync(
    new URL("../packages/noodle/src/engine/packages/server/src/routes/noodle.routes.ts", import.meta.url),
    "utf8",
  );
  const schema = routes.slice(
    routes.indexOf("const noodleGenerationRequestSchema ="),
    routes.indexOf("const noodleRescheduleRefreshSchema ="),
  );
  const route = routes.slice(routes.indexOf('app.post("/refresh",'), routes.lastIndexOf("\n}"));
  type Reply = { code: (status: number) => Reply; send: (body: unknown) => unknown };
  let handler!: (request: { body: unknown; headers: Record<string, string> }, reply: Reply) => Promise<unknown>;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let settingsReads = 0;
  let generations = 0;
  let fail = false;
  runInNewContext(stripTypeScriptTypes(`${schema}\n${route}`), {
    z,
    tryNoodleOperation,
    app: {
      post: (_path: string, registered: typeof handler) => {
        handler = registered;
      },
    },
    noodle: {
      getSettings: async () => {
        settingsReads++;
        await held;
        return { generationConnectionId: "connection" };
      },
    },
    connections: { getWithKey: async () => ({ id: "connection" }) },
    resolveImageCaptioningRuntime: async () => ({}),
    admissionModeForRequest: () => "foreground",
    normalizePromptTimeZone: () => "UTC",
    publicGeneration: {
      generate: async () => {
        generations++;
        if (fail) throw new Error("provider failed");
        return { ok: true, result: { bootstrap: {} } };
      },
    },
    isConnectionAdmissionFailure: () => false,
    getErrorMessage: (error: Error) => error.message,
  });
  const request = { body: { mode: "public" }, headers: {} };
  const response = () => {
    const result = { status: 200, body: undefined as unknown };
    const reply: Reply = {
      code: (status) => {
        result.status = status;
        return reply;
      },
      send: (body) => {
        result.body = body;
        return body;
      },
    };
    return { result, reply };
  };
  const first = response();
  const active = handler(request, first.reply);
  const duplicate = response();
  await handler(request, duplicate.reply);
  assert.equal(duplicate.result.status, 409, "a concurrent refresh must fail before joining provider admission");
  assert.match(JSON.stringify(duplicate.result.body), /already running/);
  assert.equal(settingsReads, 1, "the second request must not start its own preflight");
  release();
  await active;
  assert.equal(generations, 1);

  fail = true;
  const failed = response();
  await handler(request, failed.reply);
  assert.equal(failed.result.status, 500);
  fail = false;
  const retry = response();
  await handler(request, retry.reply);
  assert.equal(retry.result.status, 200, "a failed refresh must release the operation guard");
  assert.equal(generations, 3);
  console.log("Noodle concurrent refresh and failed-run cleanup regression passed.");
}

void main();
