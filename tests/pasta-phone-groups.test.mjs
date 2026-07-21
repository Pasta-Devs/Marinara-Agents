// Pasta Phone — group runtime check.
//
// Drives packages/pasta-phone/server.mjs against a stand-in for the Fastify app
// and the Engine's agent API, so the persistence rules are exercised without an
// Engine checkout: one group per chat, removal leaving the group intact for the
// other members, empty groups disappearing, and the blob surviving a restart.
//
//   node tests/pasta-phone-groups.test.mjs
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const serverModule = join(repoRoot, "packages/pasta-phone/server.mjs");

/** Stands in for the agents table: the blob that must survive a restart. */
function createAgentStore() {
  let settings = {};
  return {
    read: () => settings,
    inject: async ({ method, url, payload }) => {
      if (method === "GET" && url === "/api/agents") {
        return { statusCode: 200, json: () => [{ id: "cfg", type: "pasta-phone", settings }] };
      }
      if (method === "PATCH" && url.startsWith("/api/agents/type/")) {
        settings = payload.settings;
        return { statusCode: 200, json: () => ({ settings }) };
      }
      return { statusCode: 404, json: () => ({ error: "not found" }) };
    },
  };
}

/** Minimal Fastify stand-in: collects routes, then dispatches by method + path. */
function createApp(store) {
  const routes = [];
  const add = (method) => (path, handler) => routes.push({ method, path, handler });
  const instance = { get: add("GET"), post: add("POST"), delete: add("DELETE") };
  const app = {
    inject: store.inject,
    register: async (plugin, { prefix }) => {
      await plugin(instance);
      for (const route of routes) if (!route.full) route.full = `${prefix}${route.path}`;
      return app;
    },
  };

  app.call = async (method, path, body) => {
    for (const route of routes) {
      const parts = route.full.split("/");
      const actual = path.split("/");
      if (route.method !== method || parts.length !== actual.length) continue;
      const params = {};
      let matched = true;
      for (const [index, part] of parts.entries()) {
        if (part.startsWith(":")) params[part.slice(1)] = decodeURIComponent(actual[index]);
        else if (part !== actual[index]) { matched = false; break; }
      }
      if (!matched) continue;
      let status = 200;
      const reply = {
        status(code) { status = code; return reply; },
        send: (value) => value,
      };
      const result = await route.handler({ params, body }, reply);
      return { status, body: result };
    }
    throw new Error(`No route for ${method} ${path}`);
  };
  return app;
}

async function boot(store) {
  const { activate } = await import(`${serverModule}?v=${Math.random()}`);
  const app = createApp(store);
  await activate({ app });
  return app;
}

const store = createAgentStore();
let app = await boot(store);

const groupsOf = async () => (await app.call("GET", "/api/pasta-phone/groups")).body.groups;
const groupFor = async (chatId) =>
  (await app.call("GET", `/api/pasta-phone/groups/for-chat/${chatId}`)).body.group;

// Create a group from chat A.
const created = await app.call("POST", "/api/pasta-phone/groups", { chatId: "chat-a", name: "Chat A group" });
assert.equal(created.status, 201, "creating a group should report created");
const groupId = created.body.group.id;
assert.deepEqual(created.body.group.chatIds, ["chat-a"]);

// Add chat B.
await app.call("POST", `/api/pasta-phone/groups/${groupId}/chats`, { chatId: "chat-b" });
assert.deepEqual((await groupFor("chat-b")).chatIds, ["chat-a", "chat-b"], "chat B should join the group");
assert.equal((await groupFor("chat-a")).id, groupId, "chat A should still resolve to the group");

// A chat lives in at most one group: joining a second one detaches it from the first.
const second = await app.call("POST", "/api/pasta-phone/groups", { chatId: "chat-c", name: "Second" });
await app.call("POST", `/api/pasta-phone/groups/${second.body.group.id}/chats`, { chatId: "chat-b" });
assert.deepEqual((await groupFor("chat-a")).chatIds, ["chat-a"], "chat B should have left the first group");
assert.equal((await groupFor("chat-b")).id, second.body.group.id, "chat B should be in the second group only");
assert.equal((await groupsOf()).length, 2);

// Re-adding a chat that is already the group's only member must be a no-op, not
// a way to delete the group out from under itself via the detach step.
const solo = await app.call("POST", "/api/pasta-phone/groups", { chatId: "chat-solo", name: "Solo" });
await app.call("POST", `/api/pasta-phone/groups/${solo.body.group.id}/chats`, { chatId: "chat-solo" });
const soloGroup = await groupFor("chat-solo");
assert.ok(soloGroup, "re-adding the only member should not delete the group");
assert.deepEqual(soloGroup.chatIds, ["chat-solo"]);
assert.equal(soloGroup.name, "Solo", "the group should keep its name");
await app.call("DELETE", `/api/pasta-phone/groups/${solo.body.group.id}/chats/chat-solo`);

// Removing one chat leaves the group intact for everyone else.
await app.call("POST", `/api/pasta-phone/groups/${groupId}/chats`, { chatId: "chat-d" });
await app.call("DELETE", `/api/pasta-phone/groups/${groupId}/chats/chat-d`);
assert.equal(await groupFor("chat-d"), null, "removed chat should have no group");
assert.deepEqual((await groupFor("chat-a")).chatIds, ["chat-a"], "the group should survive for its other member");

// Removing the last member retires the group.
await app.call("DELETE", `/api/pasta-phone/groups/${groupId}/chats/chat-a`);
assert.equal(await groupFor("chat-a"), null);
assert.equal((await groupsOf()).length, 1, "the emptied group should be gone");

// Bad input is rejected rather than stored.
assert.equal((await app.call("POST", "/api/pasta-phone/groups", { chatId: "", name: "x" })).status, 400);
assert.equal((await app.call("POST", "/api/pasta-phone/groups", { chatId: "chat-z", name: "  " })).status, 400);
assert.equal(
  (await app.call("POST", "/api/pasta-phone/groups/does-not-exist/chats", { chatId: "chat-z" })).status,
  404,
);

// Concurrent mutations must not lose writes to the shared blob.
const target = (await groupsOf())[0].id;
await Promise.all([
  app.call("POST", `/api/pasta-phone/groups/${target}/chats`, { chatId: "par-1" }),
  app.call("POST", `/api/pasta-phone/groups/${target}/chats`, { chatId: "par-2" }),
  app.call("POST", `/api/pasta-phone/groups/${target}/chats`, { chatId: "par-3" }),
]);
const afterParallel = (await groupsOf())[0].chatIds;
for (const id of ["par-1", "par-2", "par-3"]) {
  assert.ok(afterParallel.includes(id), `${id} was lost to a concurrent write`);
}

// Restart: a fresh activate() over the same stored blob keeps every group.
const before = await groupsOf();
app = await boot(store);
assert.deepEqual(await groupsOf(), before, "groups should survive a restart");
assert.equal((await groupFor("par-1")).id, target, "membership should survive a restart");

console.log("Pasta Phone groups: all runtime checks passed.");
