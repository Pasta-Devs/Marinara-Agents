import assert from "node:assert/strict";

import {
  buildScopeIndexes,
  buildScopeMemoryPresence,
  deriveScopeBranchChats,
  deriveScopeBranches,
  deriveScopeConversations,
  type ScopeTargetChat,
  type ScopeTargetGroup,
  uniqueById,
} from "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/scope-targets.js";
import { getLtmChatDisplayName } from "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/chat-scope.js";
import {
  chatOnlyLtmScope,
  ltmScopesOverlap,
  matchesLtmScope,
} from "../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/scope.js";

// Verify getLtmChatDisplayName helper handles metadata.branchName, stringified metadata, and empty/fallback values
assert.equal(
  getLtmChatDisplayName({ name: "Base Chat", metadata: { branchName: "Final Branch" } }),
  "Final Branch",
  "uses branchName from object metadata when present",
);
assert.equal(
  getLtmChatDisplayName({ name: "Base Chat", metadata: JSON.stringify({ branchName: "Parsed Branch" }) }),
  "Parsed Branch",
  "parses stringified metadata to extract branchName",
);
assert.equal(
  getLtmChatDisplayName({ name: "Base Chat", metadata: { branchName: "   " } }),
  "Base Chat",
  "falls back to chat.name when branchName is whitespace",
);
assert.equal(
  getLtmChatDisplayName({ name: "Base Chat", metadata: {} }),
  "Base Chat",
  "falls back to chat.name when branchName is missing",
);
assert.equal(
  getLtmChatDisplayName({ name: "", metadata: {} }),
  "",
  "returns empty string when both branchName and chat.name are empty",
);
assert.equal(getLtmChatDisplayName(null), "", "handles null chat safely");

const chatDestination = chatOnlyLtmScope("chat-x");
assert.deepEqual(chatDestination, { chatId: "chat-x", chatIds: ["chat-x"] });
assert.equal(
  matchesLtmScope(
    { id: "world_x", type: "world", scope: chatDestination },
    {
      scope: { chatId: "chat-y", personaIds: ["persona-p"], characterIds: ["character-a"], groupIds: ["group-g"] },
      includeGlobal: false,
    },
  ),
  false,
);
for (const scope of [{ personaIds: ["persona-p"] }, { characterIds: ["character-a"] }, { groupIds: ["group-g"] }]) {
  assert.equal(
    matchesLtmScope(
      { id: "world_shared", type: "world", scope },
      {
        scope: { chatId: "chat-y", personaIds: ["persona-p"], characterIds: ["character-a"], groupIds: ["group-g"] },
        includeGlobal: false,
      },
    ),
    true,
  );
}

const chats: ScopeTargetChat[] = [
  {
    id: "branch-conversation",
    label: "Conversation branch",
    mode: "conversation",
    groupId: "group-a",
    personaId: null,
    characterIds: ["character-a"],
  },
  {
    id: "branch-roleplay",
    label: "Roleplay branch",
    mode: "roleplay",
    groupId: "group-a",
    personaId: null,
    characterIds: ["character-a"],
  },
  {
    id: "standalone-chat",
    label: "Standalone chat",
    mode: "conversation",
    groupId: null,
    personaId: null,
    characterIds: ["character-a"],
  },
];
const groups: ScopeTargetGroup[] = [
  { id: "group-a", label: "Conversation A", chatIds: chats.slice(0, 2).map((chat) => chat.id) },
];
const indexes = buildScopeIndexes(chats);

assert.deepEqual(
  deriveScopeBranchChats(chats).map((chat) => chat.id),
  ["branch-conversation", "branch-roleplay"],
  "every grouped chat is available as a branch target",
);
assert.deepEqual(
  deriveScopeBranches(
    deriveScopeConversations(chats, groups, "character-a", indexes).find(
      (conversation) => conversation.id === "group:group-a",
    ),
    indexes,
  ).map((chat) => chat.id),
  ["branch-conversation", "branch-roleplay"],
  "a character-filtered group retains all of its valid branches",
);
assert.deepEqual(
  deriveScopeBranches(
    deriveScopeConversations(
      chats.filter((chat) => chat.mode === "conversation"),
      groups,
      "character-a",
      indexes,
    ).find((conversation) => conversation.id === "group:group-a"),
    indexes,
  ).map((chat) => chat.id),
  ["branch-conversation"],
  "mode filtering changes branch visibility deliberately",
);
const conversationOnlyGroupChats = chats
  .filter((chat) => Boolean(chat.groupId))
  .map((chat) => ({ ...chat, mode: "conversation" as const }));
assert.equal(
  deriveScopeConversations(
    conversationOnlyGroupChats.filter((chat) => chat.mode === "roleplay"),
    groups,
    "character-a",
    buildScopeIndexes(conversationOnlyGroupChats),
  ).some((conversation) => conversation.id === "group:group-a"),
  false,
  "a group with no chats in the active mode is not a conversation target",
);
assert.deepEqual(
  deriveScopeBranches(
    deriveScopeConversations(chats, groups, "character-a", indexes).find(
      (conversation) => conversation.id === "chat:standalone-chat",
    ),
    indexes,
  ),
  [],
  "standalone chats do not appear in the branch selector",
);

// The vault place pickers sort every place by memory presence on each render, so the
// index must give exactly the per-memory ltmScopesOverlap answer without rescanning.
const memoryPresence = [
  { chatId: "chat-a", chatIds: ["chat-a"] },
  { groupIds: ["group-g"] },
  { characterIds: [" character-c "] },
  { personaIds: ["persona-p"] },
  {},
  { chatIds: [], characterIds: [""] },
];
const presenceTargets = [
  [{ chatId: "chat-a", chatIds: ["chat-a"] }, true],
  [{ chatIds: ["chat-b"] }, false],
  [{ groupId: "group-g" }, true],
  [{ groupId: "group-h", chatIds: ["chat-z"] }, false],
  [{ characterIds: ["character-c"] }, true],
  [{ chatId: "chat-z", chatIds: ["chat-z"], characterIds: ["character-c"] }, true],
  [{ personaId: "persona-p" }, true],
  [{ personaId: "persona-q" }, false],
  [{ characterIds: [""] }, false],
  [{}, false],
  [undefined, false],
] as const;
const hasMemories = buildScopeMemoryPresence(memoryPresence);
for (const [scope, expected] of presenceTargets) {
  const scanned = memoryPresence.some((noteScope) => ltmScopesOverlap(noteScope, scope, { includeGlobal: false }));
  assert.equal(scanned, expected, `scan baseline for ${JSON.stringify(scope)}`);
  assert.equal(hasMemories(scope), scanned, `presence index matches the scan for ${JSON.stringify(scope)}`);
}
assert.equal(buildScopeMemoryPresence([])({ chatIds: ["chat-a"] }), false, "no memories means no presence");
assert.deepEqual(
  uniqueById([
    { id: "a", order: 1 },
    { id: "b", order: 2 },
    { id: "a", order: 3 },
  ]),
  [
    { id: "a", order: 1 },
    { id: "b", order: 2 },
  ],
  "place lists keep the first target for each id in order",
);

process.stdout.write("Long-Term Memory scope target regression: grouped chats and filtered branches stay aligned\n");
