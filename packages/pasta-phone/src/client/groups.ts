// ──────────────────────────────────────────────
// Pasta Phone — group state
//
// Backed by the package's own routes, which persist a groups blob in the
// package's global agent settings (see server.mjs). Group records hold chat ids
// only; names and modes are joined here from the Engine's chat list so a renamed
// chat never shows a stale name inside the phone.
//
// A chat belongs to at most one group. That invariant is enforced server-side in
// the mutation handlers, not here, so concurrent edits cannot break it.
// ──────────────────────────────────────────────
import { useEffect, useSyncExternalStore } from "react";
import { phoneApi } from "./api";

export type PhoneChatMode = "conversation" | "roleplay" | "game";

export interface PhoneChat {
  id: string;
  name: string;
  mode: PhoneChatMode;
}

/** As stored by the package: ids only. */
export interface PhoneGroupRecord {
  id: string;
  name: string;
  chatIds: string[];
  createdAt: string;
}

/** As rendered: chat ids resolved against the Engine's chat list. */
export interface PhoneGroup {
  id: string;
  name: string;
  chats: PhoneChat[];
}

interface PhoneState {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  groups: PhoneGroupRecord[];
  chats: PhoneChat[];
}

function asMode(mode: unknown): PhoneChatMode {
  return mode === "roleplay" || mode === "game" ? mode : "conversation";
}

let state: PhoneState = { status: "idle", error: null, groups: [], chats: [] };
const listeners = new Set<() => void>();

function set(next: Partial<PhoneState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let inFlight: Promise<void> | null = null;

export function refreshPhoneGroups(): Promise<void> {
  if (inFlight) return inFlight;
  set({ status: state.status === "ready" ? "ready" : "loading", error: null });
  inFlight = (async () => {
    try {
      const [groupsResponse, chats] = await Promise.all([
        phoneApi.get<{ groups: PhoneGroupRecord[] }>("/pasta-phone/groups"),
        // The Engine's own chat list; used only to label group members.
        phoneApi.get<Array<{ id: string; name: string; mode: string }>>("/chats"),
      ]);
      set({
        status: "ready",
        error: null,
        groups: Array.isArray(groupsResponse?.groups) ? groupsResponse.groups : [],
        chats: (Array.isArray(chats) ? chats : []).map((chat) => ({
          id: chat.id,
          name: typeof chat.name === "string" && chat.name.trim() ? chat.name : "Untitled chat",
          mode: asMode(chat.mode),
        })),
      });
    } catch (error) {
      set({ status: "error", error: error instanceof Error ? error.message : "Could not load Pasta Phone groups" });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function usePhoneState(): PhoneState {
  const value = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  useEffect(() => {
    if (state.status === "idle") void refreshPhoneGroups();
  }, []);
  return value;
}

function resolve(record: PhoneGroupRecord, chats: PhoneChat[]): PhoneGroup {
  const byId = new Map(chats.map((chat) => [chat.id, chat]));
  return {
    id: record.id,
    name: record.name,
    // A chat the user deleted outright still has an id in the group until it is
    // removed, so fall back rather than dropping the row silently.
    chats: record.chatIds.map((id) => byId.get(id) ?? { id, name: "Unavailable chat", mode: "conversation" }),
  };
}

export function usePhoneGroups(): PhoneGroup[] {
  const { groups, chats } = usePhoneState();
  return groups.map((record) => resolve(record, chats));
}

export function useGroupForChat(chatId: string | null): PhoneGroup | null {
  const { groups, chats } = usePhoneState();
  if (!chatId) return null;
  const record = groups.find((group) => group.chatIds.includes(chatId));
  return record ? resolve(record, chats) : null;
}

export async function createGroup(name: string, chatId: string): Promise<void> {
  await phoneApi.post("/pasta-phone/groups", { name, chatId });
  await refreshPhoneGroups();
}

export async function addChatToGroup(groupId: string, chatId: string): Promise<void> {
  await phoneApi.post(`/pasta-phone/groups/${encodeURIComponent(groupId)}/chats`, { chatId });
  await refreshPhoneGroups();
}

export async function removeChatFromGroup(groupId: string, chatId: string): Promise<void> {
  await phoneApi.delete(
    `/pasta-phone/groups/${encodeURIComponent(groupId)}/chats/${encodeURIComponent(chatId)}`,
  );
  await refreshPhoneGroups();
}
