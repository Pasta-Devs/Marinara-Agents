import assert from "node:assert/strict";
import Fastify from "fastify";
import { activate } from "../packages/virtual-phone/src/phone/system/server-entry";

// Boots the real Virtual Phone routes on Fastify with a fake Engine and proves that Home
// phones work for app routes while the story Engine never sees a "home:" chat id.
type Rec = {
  id: string;
  packageId: string;
  kind: string;
  name: string;
  description: string;
  data: unknown;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
const records: Rec[] = [];
const clone = <T>(value: T): T => structuredClone(value);
const documents = {
  async list(packageId: string, kind: string) {
    return clone(records.filter((r) => r.packageId === packageId && r.kind === kind));
  },
  async create(input: Omit<Rec, "revision">) {
    const r = { ...clone(input), revision: 1 };
    records.push(r);
    return clone(r);
  },
  async update(input: Rec & { expectedRevision: number }) {
    const i = records.findIndex((r) => r.id === input.id && r.revision === input.expectedRevision);
    if (i < 0) return null;
    records[i] = { ...records[i]!, ...clone(input), revision: records[i]!.revision + 1 };
    return clone(records[i]!);
  },
  async remove(packageId: string, id: string, revision: number) {
    const i = records.findIndex((r) => r.packageId === packageId && r.id === id && r.revision === revision);
    if (i < 0) return false;
    records.splice(i, 1);
    return true;
  },
};

const engineCalls: string[] = [];
const modelPrompts: string[] = [];
const spy =
  (name: string) =>
  async (...args: unknown[]) => {
    engineCalls.push(`${name}:${JSON.stringify(args)}`);
    return name.startsWith("list") ? [] : null;
  };
const characters = [{ id: "char-a", data: { name: "Ava", description: "Ava runs a bakery.", personality: "warm" } }];
const api = {
  runtime: {
    languageModels: {
      resolve: async () => ({
        chatComplete: async (messages: unknown) => {
          modelPrompts.push(JSON.stringify(messages));
          return {
            content: JSON.stringify({
              products: ["Rye loaf, $4"],
              places: ["Sweet Ava Bakery"],
              people: ["Bo"],
              emails: [],
            }),
          };
        },
      }),
    },
    persistence: {
      documents,
      getChat: spy("getChat"),
      listMessages: spy("listMessages"),
      getGameState: spy("getGameState"),
      createMessageWithSwipe: spy("createMessageWithSwipe"),
      appendRoleplayEvent: spy("appendRoleplayEvent"),
      listChatImages: spy("listChatImages"),
    },
    resources: {
      listCharacters: async (ids?: string[]) => characters.filter((c) => !ids || ids.includes(c.id)),
      listPersonas: async () => [],
    },
    calls: { list: spy("calls.list"), create: spy("calls.create"), update: spy("calls.update") },
    logger: { error() {}, warn() {}, info() {} },
  },
  registerPrivilegedRoutes: async () => () => {},
} as never;

async function main() {
  let routes: never = undefined as never;
  (api as { registerPrivilegedRoutes: unknown }).registerPrivilegedRoutes = async (plugin: never) => {
    routes = plugin;
    return () => {};
  };
  await activate({ api });
  const app = Fastify();
  await app.register(routes, { prefix: "/api/virtual-phone" });
  const call = async (method: "GET" | "POST" | "DELETE" | "PATCH", url: string, payload?: unknown) => {
    const res = await app.inject({ method, url: `/api/virtual-phone${url}`, payload: payload as never });
    return { status: res.statusCode, body: res.body ? (JSON.parse(res.body) as Record<string, any>) : {} };
  };

  // Home lists characters and opens one phone, stably across reopen.
  const home = await call("GET", "/home");
  assert.equal(home.status, 200);
  assert.equal(home.body.characters[0].id, "char-a");
  assert.equal((await call("POST", "/home/phones", { characterId: "nobody" })).status, 404);
  const opened = await call("POST", "/home/phones", { characterId: "char-a" });
  assert.equal(opened.status, 200);
  const phoneId: string = opened.body.phone.phoneId ?? opened.body.phone.document.identity.phoneId;
  const scope: string = opened.body.phone.chatScope?.[0] ?? opened.body.phone.document.identity.chatScope[0];
  assert.equal(scope, "home:char-a");
  assert.equal((await call("POST", "/home/phones", { characterId: "char-a" })).body.phone.phoneId ?? phoneId, phoneId);

  // Home scope as chatId is the contract for chat-requiring apps: contacts, calls, noodle, library.
  const q = `?chatId=${encodeURIComponent(scope)}`;
  const added = await call("POST", `/phones/${phoneId}/contacts${q}`, { name: "Bo", bio: "baker friend" });
  assert.equal(added.status, 200, JSON.stringify(added.body));
  const contacts = await call("GET", `/phones/${phoneId}/contacts${q}`);
  assert.equal(contacts.status, 200);
  assert.ok(JSON.stringify(contacts.body).includes("Bo"));
  assert.equal((await call("GET", `/phones/${phoneId}/library`)).status, 200);
  // Apps the phone does not have installed stay 404 for a Home phone, as for a story phone.
  assert.equal((await call("GET", `/phones/${phoneId}/noodle/feed${q}`)).status, 404);
  assert.equal((await call("GET", `/phones/${phoneId}/notifications${q}`)).status, 200);

  // Calls say plainly that they are unavailable instead of failing or reaching the Engine.
  const calls = await call("GET", `/phones/${phoneId}/calls${q}`);
  assert.equal(calls.status, 200);
  assert.equal(calls.body.available, false);
  assert.match(String(calls.body.reason), /Home phone/);

  // Saved Home world persists independently of any chat.
  assert.equal(
    (await call("POST", `/phones/${phoneId}/world-facts${q}`, { text: "Ava owns Sweet Ava bakery", source: "Home" }))
      .status,
    200,
  );
  assert.ok(JSON.stringify(records).includes("Sweet Ava bakery"));
  assert.ok(JSON.stringify((await call("GET", `/phones/${phoneId}/contacts${q}`)).body).includes("Bo"));

  // Generation apps run for a Home phone: 200 (fallback content for a bare model), no null-chat crash,
  // and the character card reaches the prompt.
  await call("PATCH", `/phones/${phoneId}/settings`, {
    installedApps: ["settings", "shop", "maps", "find", "goodle", "mail", "noodler", "tindler", "contacts", "messages"],
  });
  const generated: Array<[string, string, unknown?]> = [
    ["POST", `/phones/${phoneId}/shop/search${q}`, { query: "bread" }],
    ["POST", `/phones/${phoneId}/maps/search${q}`, { query: "bakery" }],
    ["POST", `/phones/${phoneId}/find/locate${q}`, {}],
    ["POST", `/phones/${phoneId}/goodle/search${q}`, { query: "flour" }],
    ["POST", `/phones/${phoneId}/mail/inbox${q}`, {}],
    ["POST", `/phones/${phoneId}/tindler/deck${q}`, {}],
    ["POST", `/phones/${phoneId}/noodle/post${q}`, { text: "fresh loaves" }],
    ["GET", `/phones/${phoneId}/noodle/feed${q}`, undefined],
  ];
  for (const [method, url, payload] of generated) {
    const res = await call(method as "GET" | "POST", url, payload);
    assert.ok(res.status === 200, `${method} ${url} -> ${res.status} ${JSON.stringify(res.body)}`);
  }
  assert.ok(
    modelPrompts.some((prompt) => prompt.includes("Ava runs a bakery")),
    `${modelPrompts.length} prompts: ${modelPrompts[0]?.slice(0, 600)}`,
  );

  // Valid model output lands in the response, not only a 200.
  const shop = await call("POST", `/phones/${phoneId}/shop/search${q}`, { query: "bread" });
  assert.deepEqual(shop.body.products, ["Rye loaf, $4"]);
  const maps = await call("POST", `/phones/${phoneId}/maps/search${q}`, { query: "bakery" });
  assert.deepEqual(maps.body.places, ["Sweet Ava Bakery"]);

  // A story phone for the same character is a different world: never listed in Home contacts, never messageable.
  const story = await call("POST", "/phones", {
    ownerType: "character",
    ownerId: "char-a",
    ownerName: "Ava",
    chatId: "chat-1",
  });
  const storyPhoneId: string | undefined = story.body.phone?.phoneId ?? story.body.phone?.document?.identity?.phoneId;
  assert.ok(storyPhoneId && storyPhoneId !== phoneId, JSON.stringify(story.body));
  assert.ok(!JSON.stringify((await call("GET", `/phones/${phoneId}/contacts${q}`)).body).includes(storyPhoneId));
  assert.equal(
    (await call("POST", `/phones/${phoneId}/messaging/send${q}`, { toPhoneId: "chat:home:char-a", text: "hi" })).status,
    400,
  );

  // Fail closed: a real story chat or another character's Home, by query, body or params, never reaches the Engine.
  const callsBefore = engineCalls.length;
  for (const forged of ["real-story-chat", "home:char-b"]) {
    const fq = `?chatId=${encodeURIComponent(forged)}`;
    assert.equal((await call("GET", `/phones/${phoneId}/contacts${fq}`)).status, 400);
    assert.equal((await call("GET", `/phones/${phoneId}/calls${fq}`)).status, 400);
    assert.equal((await call("POST", `/phones/${phoneId}/mail/inbox${fq}`, {})).status, 400);
    assert.equal((await call("POST", `/phones/${phoneId}/noodle/post`, { chatId: forged, text: "x" })).status, 400);
    assert.equal((await call("POST", `/chats/${encodeURIComponent(forged)}/phones/${phoneId}/session`)).status, 400);
  }
  assert.equal(engineCalls.length, callsBefore);

  // Story-only routes stay shut for a Home scope.
  assert.equal((await call("POST", `/chats/${encodeURIComponent(scope)}/phones/${phoneId}/session`)).status, 400);
  assert.equal((await call("POST", `/chats/${encodeURIComponent(scope)}/phones/${phoneId}/show`)).status, 400);
  assert.equal((await call("POST", `/chats/${encodeURIComponent(scope)}/phones/${phoneId}/access`)).status, 400);
  assert.equal((await call("GET", `/chats/${encodeURIComponent(scope)}/phones`)).status, 400);

  // Story phone lists never include Home phones.
  assert.ok(!JSON.stringify((await call("GET", "/chats/chat-1/phones")).body).includes(phoneId));

  // The Engine never saw the Home scope, and nothing was written to any story.
  assert.deepEqual(
    engineCalls.filter((c) => c.includes("home:")),
    [],
  );
  assert.deepEqual(
    engineCalls.filter((c) => /^(createMessageWithSwipe|appendRoleplayEvent)/.test(c)),
    [],
  );

  await app.close();
  console.log("virtual-phone home backend regression passed");
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
