// Otome Forge's log audit (M7 playtest, plan §1.9): with every debug condition off (no debugMode, no DEBUG_AGENTS, the
// logger below the debug level), a session that plans a chapter, writes a scene through a bad reply, a provider failure
// and a refusal, texts a love interest and asks for a Caring message leaves no prompt, request body, care line or care
// note in any line written at info, warn or error, and no prompt is logged at all.
import assert from "node:assert/strict";
import test from "node:test";
import { forgeTimeZoneRoutes } from "@forge-kit/time-zone-server.mjs";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import {
  createHandle,
  type OtomeReply,
  type RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  runDocTarget,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { registerCareRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/care.ts";
import { registerPhoneRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/phone.ts";
import { registerStoryRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/story.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { KAI, beatReply, json, planReply, storyWorld } from "./fixtures/otome-forge-story.ts";
import type { FakeLogEntry, FakeReply } from "./fixtures/otome-forge-fakes.ts";

const PROMPT = "PROMPT-SENTINEL-the-drowned-bell";
const BODY = "BODY-SENTINEL: are you still at the lighthouse?";
const CARE_LINE = "Ines has told you: today is day 2 of her period.";
const CARE_NOTE = "Sit. I made tea, and the blanket is already warm.";
const SECRETS = [PROMPT, BODY, CARE_LINE, CARE_NOTE, "day 2 of her period"];

type Messages = CapabilityLanguageModelMessage[];
const isPhonePrompt = (messages: Messages) => messages[0]!.content.includes("in your private message thread");

/** Every route of the story, phone and care modules on one fake router (as the Engine wraps them), debug off. */
function routesOf(deps: object, runKey: string) {
  const routes = new Map<string, RouteHandler>();
  const router = forgeTimeZoneRoutes({
    get: (path: string, handler: RouteHandler) => void routes.set(`GET ${path}`, handler),
    post: (path: string, ...rest: unknown[]) => void routes.set(`POST ${path}`, rest.at(-1) as RouteHandler),
  });
  for (const register of [registerStoryRoutes, registerPhoneRoutes, registerCareRoutes])
    register(router, deps as never);
  return async (path: string, body: object = {}, params: Record<string, string> = {}) => {
    const handler = routes.get(`POST ${path}`);
    assert.ok(handler, `POST ${path} is registered`);
    let status = 200;
    const reply: OtomeReply & { header(): OtomeReply } = {
      status(code) {
        status = code;
        return reply;
      },
      send: () => reply,
      header: () => reply,
    };
    await handler(
      {
        method: "POST",
        url: path,
        body: { timeZone: "UTC", debugMode: false, ...body },
        params: { run: runKey, ...params },
        query: {},
      },
      reply,
    );
    return status;
  };
}

/** Everything a log line carries, as one string: its format, its arguments and its error's message and stack. */
const written = (entry: FakeLogEntry) =>
  JSON.stringify([
    entry.message,
    entry.args,
    entry.error instanceof Error ? [entry.error.message, entry.error.stack] : entry.error,
  ]);

/** A line the logger writes at its default level: anything but debug and a debugOverride that stays at debug. */
const atDefault = (entry: FakeLogEntry) =>
  entry.level === "info" ||
  entry.level === "warn" ||
  entry.level === "error" ||
  (entry.level === "debugOverride" && entry.override === true);

test("with debug off, no line above debug carries a prompt, a request body, a care line or a care note", async () => {
  const replies: FakeReply[] = [
    // P5: one malformed reply (the repair turn's prompt is logged too), then the plan.
    "Here is your chapter plan, as requested.",
    json(planReply()),
    // P6: the provider fails, then refuses twice (a 422), then writes the scene; the lookahead writes the next one.
    new Error("provider unavailable (503)"),
    "I can't continue this scene.",
    "I cannot write that.",
    json(beatReply()),
    json(beatReply()),
    // P17 for the message, then P27 for the Caring message; a second care request fails at the provider.
    (messages) => {
      assert.ok(isPhonePrompt(messages), "the phone reply");
      return json({ messages: [{ text: "Still here. The lamp needs me." }], suggestions: ["Come down."] });
    },
    json({ note: CARE_NOTE }),
    new Error("provider unavailable (503)"),
  ];
  const t = await storyWorld({ runKey: "r-logs01-aaaaaa", replies });
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    premise: `${world.premise} ${PROMPT}`,
    setting: `${world.setting} ${PROMPT}`,
  }));
  const post = routesOf({ ...t.deps, handle: createHandle(t.runtime.logger) }, "r-logs01-aaaaaa");

  assert.equal(await post("/runs/:run/chapters/next", { lead: KAI }), 200);
  const beat = { key: "main-1", i: "0" };
  assert.equal(await post("/runs/:run/chapters/:key/beats/:i", {}, beat), 500, "the provider failure");
  assert.equal(await post("/runs/:run/chapters/:key/beats/:i", {}, beat), 422, "the refusal");
  assert.equal(await post("/runs/:run/chapters/:key/beats/:i", {}, beat), 200);
  await t.settle();
  assert.equal(await post("/runs/:run/phone/:li/send", { text: BODY, id: "c-0001-abcd" }, { li: KAI }), 200);
  assert.equal(await post("/runs/:run/care-note", { li: KAI, careLine: CARE_LINE }), 200);
  assert.equal(await post("/runs/:run/care-note", { li: KAI, careLine: CARE_LINE }), 200, "a failure falls back");
  assert.equal(t.calls.length, replies.length, "every scripted call was made");

  const loud = t.logs.filter(atDefault);
  assert.ok(
    loud.some((entry) => entry.level === "error"),
    "the provider failure is logged (the sweep reached a failure path)",
  );
  for (const entry of loud) {
    for (const secret of SECRETS) {
      assert.ok(!written(entry).includes(secret), `${entry.level} "${entry.message}" carries "${secret}"`);
    }
  }

  // The secrets were in flight (the provider received each), and with the logger below debug no prompt is logged at
  // all, not even at the debug level (the kit's logForgeStoryPrompt returns before it formats one).
  const sent = JSON.stringify(t.calls.map((call) => call.messages));
  for (const secret of [PROMPT, BODY, CARE_LINE]) assert.ok(sent.includes(secret), `the provider got "${secret}"`);
  assert.deepEqual(
    t.logs.filter((entry) => entry.message.includes("Messages sent to the provider")),
    [],
  );
});
