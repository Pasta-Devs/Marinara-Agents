// ──────────────────────────────────────────────
// Pasta Phone — group state
//
// ponytail: in-memory only. Group membership resets on reload and is not shared
// between chats or browser tabs. This is deliberately the UI shape of the real
// thing without the data behind it: the package-owned persistence (a groups blob
// keyed by group id, written through the package's global agent settings the way
// Hierarchical Maps does it) and the routes that back it land in a later change.
// Nothing here talks to the server, so nothing here needs new permissions.
//
// A chat belongs to at most one group. That invariant is enforced in
// addChatToGroup / createGroup rather than left to callers.
// ──────────────────────────────────────────────
import { useSyncExternalStore } from "react";

export type PhoneChatMode = "conversation" | "roleplay" | "game";

export interface PhoneChat {
  id: string;
  name: string;
  mode: PhoneChatMode;
}

export interface PhoneGroup {
  id: string;
  name: string;
  chats: PhoneChat[];
}

// Stand-in for the chats the user could pick from. The real picker reads the
// Engine's chat list once this is wired to real data.
export const CANDIDATE_CHATS: PhoneChat[] = [
  { id: "mock-chat-b", name: "Lorem Ipsum", mode: "conversation" },
  { id: "mock-chat-c", name: "Dolor Sit", mode: "roleplay" },
  { id: "mock-chat-d", name: "Amet Consectetur", mode: "game" },
  { id: "mock-chat-e", name: "Sed Eiusmod", mode: "conversation" },
];

let groups: PhoneGroup[] = [];
const listeners = new Set<() => void>();

function emit() {
  groups = [...groups];
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePhoneGroups(): PhoneGroup[] {
  return useSyncExternalStore(
    subscribe,
    () => groups,
    () => groups,
  );
}

export function useGroupForChat(chatId: string | null): PhoneGroup | null {
  const all = usePhoneGroups();
  if (!chatId) return null;
  return all.find((group) => group.chats.some((chat) => chat.id === chatId)) ?? null;
}

/** A chat is in at most one group, so adding it anywhere removes it everywhere else. */
function detach(chatId: string) {
  groups = groups.map((group) => ({ ...group, chats: group.chats.filter((chat) => chat.id !== chatId) }));
}

export function createGroup(name: string, firstChat: PhoneChat): PhoneGroup {
  detach(firstChat.id);
  const group: PhoneGroup = {
    id: `group-${Date.now().toString(36)}`,
    name: name.trim() || "New group",
    chats: [firstChat],
  };
  groups = [...groups, group];
  emit();
  return group;
}

export function addChatToGroup(groupId: string, chat: PhoneChat) {
  detach(chat.id);
  groups = groups.map((group) =>
    group.id === groupId && !group.chats.some((member) => member.id === chat.id)
      ? { ...group, chats: [...group.chats, chat] }
      : group,
  );
  emit();
}

/** Removes one chat, leaving the group intact for everyone else. */
export function removeChatFromGroup(groupId: string, chatId: string) {
  groups = groups
    .map((group) => (group.id === groupId ? { ...group, chats: group.chats.filter((c) => c.id !== chatId) } : group))
    .filter((group) => group.chats.length > 0);
  emit();
}
