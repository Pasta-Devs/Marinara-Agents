// Actual package SDK registration and HTTP routes; only persistence and the model transport are controlled.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const chatRunId = "chat-continuity-fixture";
export const chatUnitId = `${chatRunId}:unit:arden`;
export const chatConnectionId = "same-main-connection";
const clone = structuredClone;

export async function createChatRuntime({ stored, archived = 0, port = 0 } = {}) {
  const docs = new Map(stored ? clone(stored) : []);
  const handlers = new Map();
  const calls = [];
  const resolved = [];
  const errors = [];
  const logs = [];
  const transport = { stage: "channel", mode: "reply", started: null, release: null };
  const seed = (id, kind, data) =>
    docs.set(id, { id, packageId: "gacha-forge", kind, name: id, revision: 1, data: clone(data) });
  if (!stored) {
    seed("index", "index", {
      activeRunId: chatRunId,
      runs: [
        {
          runId: chatRunId,
          name: "Fixture",
          scenario: "A lighthouse garden.",
          connectionId: chatConnectionId,
          protagonist: { name: "Mari" },
          images: { off: true },
          story: { choices: false, preforge: "off" },
        },
      ],
    });
    seed(`${chatRunId}:session`, "session", {
      roster: { [chatUnitId]: { level: 20, bondFights: 100000, bondCurve: 2 } },
      wallet: { vigor: 100, funds: 10000, aether: 1000 },
      account: { level: 100, xp: 0 },
      progress: {},
    });
    seed(chatUnitId, "unit", { unitId: chatUnitId, kind: "character", name: "Arden", rarity: 5 });
  }
  const directory = await mkdtemp(join(tmpdir(), "forge-chat-runtime-"));
  const path = join(directory, "server.mjs");
  await writeFile(
    path,
    await readFile(
      process.env.GACHA_CHAT_SERVER_UNDER_TEST || new URL("../../packages/gacha-forge/server.mjs", import.meta.url),
    ),
  );
  const nativeFetch = globalThis.fetch;
  const server = createServer(async (request, reply) => {
    try {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      let response;
      if (request.url === "/v1/chat/completions") {
        const summary = String(body.messages?.[0]?.content || "").includes(
          "Summarize only the supplied canonical story history",
        );
        calls.push({ stage: transport.stage, kind: summary ? "summary" : transport.stage, body });
        if (transport.release) {
          transport.started?.();
          await transport.release;
        }
        if (transport.mode === "fail") throw new Error("Controlled provider unavailable");
        const content =
          typeof transport.reply === "function"
            ? await transport.reply(body, transport)
            : transport.mode === "empty"
              ? ""
              : summary
                ? JSON.stringify({ summary: "A prior meeting and remembered promise." })
                : transport.stage === "channel"
                  ? JSON.stringify({ name: "Lantern Line", blurb: "A private lighthouse channel." })
                  : transport.stage === "memory"
                    ? JSON.stringify({
                        memory: "Mari and Arden agreed to meet at the lighthouse.",
                        quote: "Meet me at the lighthouse.",
                      })
                    : "Arden: I heard your first message.";
        response = { choices: [{ message: { content }, finish_reason: "stop" }] };
      } else {
        const handler = handlers.get(`${request.method} ${request.url}`);
        assert.ok(handler, `Actual package route registered: ${request.url}`);
        response = await handler({ body });
      }
      reply.writeHead(200, { "content-type": "application/json" });
      reply.end(JSON.stringify(response));
    } catch (error) {
      errors.push({ name: error.name, message: error.message, stack: error.stack });
      reply.writeHead(500, { "content-type": "application/json" });
      reply.end(JSON.stringify({ error: error.message }));
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    if (url.pathname.startsWith("/api/characters/") && transport.cards instanceof Map) {
      const id = decodeURIComponent(url.pathname.slice("/api/characters/".length));
      const card = transport.cards.get(id);
      return Response.json(card ?? { error: "not found" }, { status: card ? 200 : 404 });
    }
    if (url.pathname === "/api/connections")
      return Response.json([
        { id: chatConnectionId, provider: "custom", model: "controlled-same-main-model", maxContext: 10000 },
      ]);
    assert.equal(url.origin, origin, "No remote provider or user data may be contacted");
    return nativeFetch(input, options);
  };
  const documents = {
    getById: async (_package, id) => clone(docs.get(id) ?? null),
    list: async (_package, kind) => clone([...docs.values()].filter((doc) => !kind || doc.kind === kind)),
    create: async (document) => {
      assert.ok(!docs.has(document.id));
      const saved = { ...clone(document), revision: 1 };
      docs.set(saved.id, saved);
      return clone(saved);
    },
    update: async (document) => {
      const old = docs.get(document.id);
      if (old?.revision !== document.expectedRevision) return null;
      const saved = { ...old, ...clone(document), revision: old.revision + 1 };
      delete saved.expectedRevision;
      docs.set(saved.id, saved);
      return clone(saved);
    },
    remove: async () => {
      throw new Error("Chat history must never be deleted");
    },
  };
  const persistence = { documents };
  let cleanup;
  const close = async () => {
    try {
      await cleanup?.();
    } finally {
      globalThis.fetch = nativeFetch;
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await rm(directory, { recursive: true, force: true });
    }
  };
  try {
    const { activate } = await import(pathToFileURL(path).href);
    cleanup = await activate({
      dataDir: directory,
      package: { id: "gacha-forge", version: "fixture" },
      api: {
        runtime: {
          persistence,
          json: { parseJsonish: JSON.parse },
          logger: Object.fromEntries(
            ["info", "warn", "error", "debug"].map((level) => [level, (...args) => logs.push({ level, args })]),
          ),
          languageModels: {
            resolveForRequest: async (request) => {
              resolved.push(request);
              assert.equal(request.connectionId, chatConnectionId);
              return {
                connectionId: chatConnectionId,
                model: "controlled-same-main-model",
                maxContext: 10000,
                chatComplete: async (messages, options) => {
                  const response = await nativeFetch(`${origin}/v1/chat/completions`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ model: "controlled-same-main-model", messages }),
                    signal: transport.ignoreAbort ? undefined : options.signal,
                  });
                  if (!response.ok) throw new Error("Controlled provider unavailable");
                  const data = await response.json();
                  return { content: data.choices[0].message.content, finishReason: "stop" };
                },
              };
            },
          },
        },
        registerPrivilegedRoutes: async (register) =>
          register({
            get: (name, handler) => handlers.set(`GET ${name}`, handler),
            post: (name, handler) => handlers.set(`POST ${name}`, handler),
          }),
      },
    });
  } catch (error) {
    await close();
    throw error;
  }
  const post = async (name, extra = {}) => {
    const response = await nativeFetch(origin + name, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: chatRunId, unitId: chatUnitId, ...extra }),
    });
    return { status: response.status, body: await response.json() };
  };
  const chatDoc = () =>
    [...docs.values()].find((doc) => doc.data?.unitId === chatUnitId && Array.isArray(doc.data?.messages));
  let opened;
  try {
    opened = await post("/chat/open");
    assert.equal(opened.body.ok, true, JSON.stringify(opened));
    if (archived) {
      // Discover the actual chat document id by one player persist, then reset only isolated fixture documents.
      transport.stage = "reply";
      await post("/chat/send", { text: "Discover fixture chat document." });
      const document = chatDoc();
      document.data.messages = Array.from({ length: archived }, (_, index) => ({
        id: `archived-${index}`,
        who: index % 2 ? "unit" : "player",
        text: `ARCHIVE_RAW_${index}`,
        at: index,
        ...(index === 1 ? { photo: { url: "fixture://archived-picture" } } : {}),
      }));
      document.data.sessions = [{ count: archived, at: 1, memory: "A prior meeting.", quote: "A remembered promise." }];
      calls.length = 0;
    }
    transport.stage = "reply";
  } catch (error) {
    await close();
    throw error;
  }
  return {
    origin,
    docs,
    persistence,
    calls,
    resolved,
    errors,
    logs,
    transport,
    post,
    opened,
    chatDoc,
    session: () => docs.get(`${chatRunId}:session`).data,
    close,
  };
}
