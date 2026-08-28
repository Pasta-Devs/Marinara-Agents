import assert from "node:assert/strict";

import {
  buildScopeIndexes,
  deriveScopeBranchChats,
  deriveScopeBranches,
  deriveScopeConversations,
  type ScopeTargetChat,
  type ScopeTargetGroup,
} from "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/scope-targets.js";

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

process.stdout.write("Long-Term Memory scope target regression: grouped chats and filtered branches stay aligned\n");
