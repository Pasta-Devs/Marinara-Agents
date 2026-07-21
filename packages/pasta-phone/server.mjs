// ──────────────────────────────────────────────
// Pasta Phone — group runtime
//
// Package-owned and hand-authored, not generated: there is no Engine-side source
// to bundle from, so this file is the source. It has no imports on purpose, so
// the shipped artifact is exactly what you read here.
//
// Persistence mirrors Hierarchical Maps: the package keeps its own JSON blob in
// its global agent settings, read and written through the Engine's own agent API
// via app.inject. That store is durable across restarts, so no new storage
// mechanism is invented here.
//
// Shape: { groups: { [groupId]: { id, name, chatIds: [], createdAt } } }
//
// Only chat ids are stored. Names and modes are resolved by the client from the
// Engine's chat list, so a renamed chat never goes stale in a group.
// ──────────────────────────────────────────────
const AGENT_TYPE = "pasta-phone";
const PREFIX = "/api/pasta-phone";
const MAX_NAME = 120;
const MAX_ID = 200;
const MAX_GROUPS = 200;
const MAX_CHATS_PER_GROUP = 100;

function badRequest(reply, message) {
  return reply.status(400).send({ error: message });
}

/** Trust boundary: these ids come straight off the wire. */
function readId(value) {
  return typeof value === "string" && value.trim() && value.length <= MAX_ID ? value.trim() : null;
}

function readName(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_NAME);
}

function normalizeGroup(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = readId(value.id);
  const name = readName(value.name);
  if (!id || !name) return null;
  const chatIds = Array.isArray(value.chatIds)
    ? [...new Set(value.chatIds.map(readId).filter(Boolean))].slice(0, MAX_CHATS_PER_GROUP)
    : [];
  if (chatIds.length === 0) return null;
  return {
    id,
    name,
    chatIds,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
  };
}

function normalizeGroups(settings) {
  const raw = settings && typeof settings === "object" ? settings.groups : null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const groups = {};
  for (const candidate of Object.values(raw)) {
    const group = normalizeGroup(candidate);
    if (group) groups[group.id] = group;
  }
  return groups;
}

export function activate({ app }) {
  async function readSettings() {
    const response = await app.inject({ method: "GET", url: "/api/agents" });
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Could not read Pasta Phone agent settings (${response.statusCode})`);
    }
    const configs = response.json();
    const config = Array.isArray(configs) ? configs.find((item) => item?.type === AGENT_TYPE) : null;
    const settings = config?.settings;
    if (settings && typeof settings === "object" && !Array.isArray(settings)) return settings;
    if (typeof settings !== "string") return {};
    try {
      const parsed = JSON.parse(settings);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  async function writeSettings(settings) {
    const response = await app.inject({
      method: "PATCH",
      url: `/api/agents/type/${encodeURIComponent(AGENT_TYPE)}`,
      headers: { "x-marinara-csrf": "1" },
      payload: { settings },
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Could not update Pasta Phone agent settings (${response.statusCode})`);
    }
  }

  // Read-modify-write against a shared blob, so mutations are serialized. Without
  // this, two concurrent edits both read the old groups and the second write wins.
  let queue = Promise.resolve();
  function mutate(change) {
    const operation = queue.then(async () => {
      const settings = await readSettings();
      const groups = normalizeGroups(settings);
      const result = change(groups);
      await writeSettings({ ...settings, groups });
      return result;
    });
    queue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async function listGroups() {
    return Object.values(normalizeGroups(await readSettings())).sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
  }

  /** A chat belongs to at most one group; adding it anywhere detaches it elsewhere. */
  function detach(groups, chatId) {
    for (const group of Object.values(groups)) {
      group.chatIds = group.chatIds.filter((id) => id !== chatId);
      if (group.chatIds.length === 0) delete groups[group.id];
    }
  }

  return app
    .register(
      async (instance) => {
        instance.get("/groups", async () => ({ groups: await listGroups() }));

        instance.get("/groups/for-chat/:chatId", async (request, reply) => {
          const chatId = readId(request.params.chatId);
          if (!chatId) return badRequest(reply, "A chat id is required");
          const groups = await listGroups();
          return { group: groups.find((group) => group.chatIds.includes(chatId)) ?? null };
        });

        instance.post("/groups", async (request, reply) => {
          const body = request.body ?? {};
          const chatId = readId(body.chatId);
          const name = readName(body.name);
          if (!chatId) return badRequest(reply, "A chat id is required");
          if (!name) return badRequest(reply, "A group name is required");
          const group = await mutate((groups) => {
            if (Object.keys(groups).length >= MAX_GROUPS) throw new Error("Too many Pasta Phone groups");
            detach(groups, chatId);
            const created = {
              id: `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
              name,
              chatIds: [chatId],
              createdAt: new Date().toISOString(),
            };
            groups[created.id] = created;
            return created;
          });
          return reply.status(201).send({ group });
        });

        instance.post("/groups/:groupId/chats", async (request, reply) => {
          const groupId = readId(request.params.groupId);
          const chatId = readId((request.body ?? {}).chatId);
          if (!groupId || !chatId) return badRequest(reply, "A group id and chat id are required");
          const group = await mutate((groups) => {
            const target = groups[groupId];
            if (!target) return null;
            detach(groups, chatId);
            // detach may have dropped the target if that chat was its only member.
            const surviving = groups[groupId] ?? { ...target, chatIds: [] };
            groups[groupId] = surviving;
            if (!surviving.chatIds.includes(chatId)) {
              if (surviving.chatIds.length >= MAX_CHATS_PER_GROUP) throw new Error("That group is full");
              surviving.chatIds = [...surviving.chatIds, chatId];
            }
            return surviving;
          });
          if (!group) return reply.status(404).send({ error: "That Pasta Phone group no longer exists" });
          return { group };
        });

        instance.delete("/groups/:groupId/chats/:chatId", async (request, reply) => {
          const groupId = readId(request.params.groupId);
          const chatId = readId(request.params.chatId);
          if (!groupId || !chatId) return badRequest(reply, "A group id and chat id are required");
          const group = await mutate((groups) => {
            const target = groups[groupId];
            if (!target) return null;
            target.chatIds = target.chatIds.filter((id) => id !== chatId);
            // The group only disappears once nobody is left in it.
            if (target.chatIds.length === 0) {
              delete groups[groupId];
              return { removed: true, group: null };
            }
            return { removed: true, group: target };
          });
          if (!group) return reply.status(404).send({ error: "That Pasta Phone group no longer exists" });
          return group;
        });
      },
      { prefix: PREFIX },
    )
    .then(() => () => {});
}

export async function selfCheck({ app }) {
  const response = await app.inject({ method: "GET", url: `${PREFIX}/groups` });
  if (response.statusCode !== 200) {
    throw new Error(`Pasta Phone group routes did not register (${response.statusCode})`);
  }
  if (!Array.isArray(response.json().groups)) throw new Error("Pasta Phone group listing is unavailable");
}
